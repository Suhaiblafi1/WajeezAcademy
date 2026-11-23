/* الإرسالُ على واتساب (٢٤ نوفمبر ٢٠٢٦) — والعلّةُ في رأس `server/services/whatsapp/send.service.ts`.

   ① الموافقةُ بغرضها: نموذجُ المنحة للخدمة لا للتسويق، ومن بلا موافقةٍ لا تصله.
   ② الإيقافُ بعد كتابة الطابور يمنع خروجَها، وحدُّ اليوم يقف، وما يُعاد يُؤجَّل ولا يسقط.
   ③ «توقف» و«اشترك» من Meta، والخبرُ المعادُ لا يُكتب مرّتين، والتوقيعُ إلزاميّ.
   ④ لا يُفتح الإرسالُ ناقصا، ولا يُكتب السرُّ بقناعه. */

import { createHmac } from 'node:crypto'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { CloudError, cloudConfig, readTemplate, saveCloudConfig } from '../../services/whatsapp/cloud'
import { drainWhatsApp, handleHook, importConsents, recipientsOf, reply, sendCampaign, stopCampaign } from '../../services/whatsapp/send.service'
import { GRANT_CONSENT_AR } from '../../../src/application/commerce/grant-landing'
import { isStopWord, templateSlots } from '../../../src/application/marketing/whatsapp-send'

let prisma: PrismaClient
let owner = ''
const STAMP = String(Date.now()).slice(-6)
const PNID = '111222333'
const phone = (n: number) => `+96279${n}${STAMP}`
const tail = (n: number) => `79${n}${STAMP}`
const FULL = { phoneNumberId: PNID, wabaId: '444555666', token: 'tok-secret-1234', appSecret: 'app-secret-9999', verifyToken: 'verify-me-0000' }
const IN = { template: 'remind', language: 'ar', params: ['{{name}}'], audience: 'opted' as const }
const hook = (from: string, body: string, id: string, pnid = PNID) => ({
  entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: pnid }, messages: [{ id, from, type: 'text', text: { body } }] } }] }],
})
const meta = (category: 'UTILITY' | 'MARKETING') => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
  data: [{ name: 'remind', language: 'ar', status: 'APPROVED', category, components: [{ type: 'BODY', text: 'مرحبا {{1}}' }] }],
}), { status: 200 })))

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  owner = (await new AuthService(prisma).register(`wa-send-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
}, 240_000)

beforeEach(async () => {
  await prisma.whatsAppMessage.deleteMany()
  await prisma.whatsAppCampaign.deleteMany()
  await prisma.whatsAppConsent.deleteMany()
  await prisma.whatsAppOptOut.deleteMany({ where: { tail: { endsWith: STAMP } } })
  await prisma.integrationSetting.deleteMany({ where: { provider: 'whatsapp_cloud' } })
  await saveCloudConfig(prisma, owner, { enabled: true, ...FULL })
})
afterEach(() => vi.unstubAllGlobals())

const consent = (n: number, kind: 'utility' | 'marketing' = 'utility') =>
  importConsents(prisma, { phones: [phone(n)], kind, textAr: 'وافق في نموذج التسجيل' }, owner)

describe('① الموافقة بغرضها', () => {
  it('⚠️ نموذج المنحة للخدمة لا للتسويق، ومن بلا موافقة لا تصله', async () => {
    await prisma.lead.create({ data: { fullName: 'من عبأ', phone: phone(1), source: 'campaign', campaign: 'x', consentAr: GRANT_CONSENT_AR } })
    await prisma.lead.create({ data: { fullName: 'بلا موافقة', phone: phone(2), source: 'site' } })
    await prisma.lead.create({ data: { fullName: 'محلي', phone: `079${STAMP}1`, source: 'site' } })
    await consent(3, 'marketing')
    const has = async (c: 'UTILITY' | 'MARKETING') => (await recipientsOf(prisma, 'all', c)).to.map((p) => p.tail).filter((t) => t.endsWith(STAMP)).sort()
    expect(await has('UTILITY')).toEqual([tail(1), tail(3)].sort())
    expect(await has('MARKETING')).toEqual([tail(3)])
    expect((await recipientsOf(prisma, 'all', 'UTILITY')).check.invalid).toBeGreaterThan(0)
  })
  it('⚠️ موافقة الخدمة لا تفتح التسويق، ومن أوقف لا يعاد بالتسجيل', async () => {
    await consent(1)
    expect((await recipientsOf(prisma, 'opted', 'MARKETING')).to).toHaveLength(0)
    await prisma.whatsAppOptOut.create({ data: { tail: tail(2), phone: phone(2) } })
    expect(await consent(2)).toMatchObject({ added: 0, optedOut: 1 })
  })
})

describe('② الطابور', () => {
  it('⚠️ العدد الذي رآه هو ما يرسل، ولا يرسل الإرسال نفسه مرتين', async () => {
    meta('UTILITY')
    await consent(1)
    await expect(sendCampaign(prisma, IN, 2, owner)).rejects.toMatchObject({ code: 'count_changed' })
    await sendCampaign(prisma, IN, 1, owner)
    await expect(sendCampaign(prisma, IN, 1, owner)).rejects.toMatchObject({ code: 'already' })
    expect(await prisma.whatsAppMessage.count()).toBe(1)
  })
  it('⚠️ من أوقف بعد كتابة الطابور لا تصله', async () => {
    meta('UTILITY')
    await consent(1); await consent(2)
    await sendCampaign(prisma, IN, 2, owner)
    await prisma.whatsAppOptOut.create({ data: { tail: tail(1), phone: phone(1) } })
    const sentTo: string[] = []
    await drainWhatsApp(prisma, { limit: 10, send: async (_c, p) => { sentTo.push(p); return `wamid-${p}` } })
    expect(sentTo).toEqual([phone(2)])
  })
  it('⚠️ حد اليوم يقف، والباقي ينتظر', async () => {
    meta('UTILITY')
    await saveCloudConfig(prisma, owner, { enabled: true, dailyCap: 1 })
    await consent(1); await consent(2)
    await sendCampaign(prisma, IN, 2, owner)
    let n = 0
    for (let i = 0; i < 2; i += 1) await drainWhatsApp(prisma, { limit: 10, send: async () => `wamid-cap-${(n += 1)}` })
    expect(n).toBe(1)
    expect(await prisma.whatsAppMessage.count({ where: { status: 'queued' } })).toBe(1)
  })
  it('⚠️ ما يزول وحده يؤجل، وما انقطع لا يعاد، والإيقاف يلغي الباقي', async () => {
    meta('UTILITY')
    await consent(1); await consent(2)
    const { id } = await sendCampaign(prisma, IN, 2, owner)
    await drainWhatsApp(prisma, { limit: 1, send: async () => { throw new CloudError('سرعة', 130429, true) } })
    expect(await prisma.whatsAppMessage.count({ where: { status: 'queued', notBefore: { not: null } } })).toBe(1)
    await drainWhatsApp(prisma, { limit: 1, send: async () => { throw new CloudError('انقطع', null, false) } })
    expect(await prisma.whatsAppMessage.count({ where: { status: 'failed' } })).toBe(1)
    expect(await stopCampaign(prisma, id, owner)).toEqual({ cancelled: 1 })
  })
})

describe('③ ما تخبر به Meta', () => {
  const from = (n: number) => phone(n).slice(1)
  it('⚠️ «توقف» يمنع ويمحو موافقته ويلغي ما ينتظره، و«اشترك» يسجلها', async () => {
    meta('UTILITY')
    await consent(1)
    await sendCampaign(prisma, IN, 1, owner)
    await handleHook(prisma, hook(from(1), ' توقّف ', 'm1'))
    expect(await prisma.whatsAppOptOut.count({ where: { tail: tail(1) } })).toBe(1)
    expect(await prisma.whatsAppConsent.count({ where: { tail: tail(1) } })).toBe(0)
    expect(await prisma.whatsAppMessage.count({ where: { status: 'cancelled' } })).toBe(1)
    await handleHook(prisma, hook(from(1), 'اشترك', 'm2'))
    expect((await recipientsOf(prisma, 'opted', 'MARKETING')).to.map((p) => p.tail)).toEqual([tail(1)])
    /* والخبرُ المعادُ لـ«توقف» القديم لا يمحو اشتراكَه بعده */
    await handleHook(prisma, hook(from(1), 'توقف', 'm1'))
    expect(await prisma.whatsAppConsent.count({ where: { tail: tail(1), kind: 'marketing' } })).toBe(1)
    await handleHook(prisma, hook(from(2), 'توقف', 'm3', '999'))
    expect(await prisma.whatsAppOptOut.count({ where: { tail: tail(2) } }), 'رقم آخر ليس لنا').toBe(0)
  })
  it('⚠️ الكلمة وحدها لا ورودها، والحال لا يرجع إلى الوراء', async () => {
    expect(isStopWord('لا تتوقف عن إرسالها')).toBe(false)
    await prisma.whatsAppMessage.create({ data: { direction: 'out', status: 'read', tail: tail(1), phone: phone(1), body: 'x', metaId: 'st1' } })
    await handleHook(prisma, { entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: PNID }, statuses: [{ id: 'st1', status: 'delivered' }] } }] }] })
    expect((await prisma.whatsAppMessage.findUniqueOrThrow({ where: { metaId: 'st1' } })).status).toBe('read')
  })
  it('⚠️ لا رد حرا بعد 24 ساعة', async () => {
    await prisma.whatsAppMessage.create({ data: { direction: 'in', status: 'received', tail: tail(1), phone: phone(1), body: 'مرحبا', createdAt: new Date(Date.now() - 25 * 3_600_000) } })
    await expect(reply(prisma, tail(1), 'أهلا', owner)).rejects.toMatchObject({ code: 'closed' })
  })
  it('⚠️ بلا توقيع صحيح يرد الباب، وتحقق العنوان برمزه، والإدارة لا تفتح لغيرها', async () => {
    const app = await buildApp(prisma)
    const payload = JSON.stringify(hook(from(1), 'مرحبا', 'sig1'))
    const post = (sig: string) => app.inject({ method: 'POST', url: '/api/webhooks/whatsapp-cloud', headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig }, payload })
    expect((await post('sha256=00')).statusCode).toBe(401)
    expect((await post(`sha256=${createHmac('sha256', FULL.appSecret).update(payload).digest('hex')}`)).statusCode).toBe(200)
    expect(await prisma.whatsAppMessage.count({ where: { metaId: 'sig1' } })).toBe(1)
    const verify = (t: string) => app.inject({ method: 'GET', url: `/api/webhooks/whatsapp-cloud?hub.mode=subscribe&hub.verify_token=${t}&hub.challenge=42` })
    expect((await verify('wrong')).statusCode).toBe(403)
    expect((await verify(FULL.verifyToken)).body).toBe('42')
    expect((await app.inject({ method: 'GET', url: '/api/admin/whatsapp/threads' })).statusCode).toBe(401)
    await app.close()
  })
})

describe('④ الربط والقوالب', () => {
  it('⚠️ لا يفتح ناقصا، ولا يكتب السر بقناعه', async () => {
    await saveCloudConfig(prisma, owner, { enabled: true, token: '••••1234' })
    expect((await cloudConfig(prisma)).token).toBe(FULL.token)
    await prisma.integrationSetting.deleteMany({ where: { provider: 'whatsapp_cloud' } })
    await expect(saveCloudConfig(prisma, owner, { enabled: true, phoneNumberId: PNID })).rejects.toMatchObject({ code: 'incomplete' })
  })
  it('⚠️ قالب بخانة في زره أو صورة لا يرسل من هنا', () => {
    const t = (components: object[]) => readTemplate({ name: 'a', language: 'ar', status: 'APPROVED', category: 'UTILITY', components: components as never })
    expect(t([{ type: 'BODY', text: 'x' }])?.unsupportedAr).toBeNull()
    expect(t([{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: 'x' }])?.unsupportedAr).toBeTruthy()
    expect(t([{ type: 'BODY', text: 'x' }, { type: 'BUTTONS', buttons: [{ type: 'URL', url: 'https://a/{{1}}' }] }])?.unsupportedAr).toBeTruthy()
    expect(templateSlots('{{name}}')).toBeNull()
    expect(templateSlots('{{1}} {{2}} {{1}}')).toBe(2)
  })
})

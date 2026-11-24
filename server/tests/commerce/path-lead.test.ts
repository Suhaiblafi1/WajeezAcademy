/* «لم تقرر بعد؟ اترك رقمك» في `/go/BF80` (٢٤ نوفمبر ٢٠٢٦) — والعلّةُ في `PathLeadForm.tsx`.

   ① حالةُ مستشارٍ بعميلها ونصِّ موافقتها ومن أين جاءت. ② ولا حالتان لرقمٍ واحد، والجوابُ واحد. ③ ورقمٌ بلا رمز دولةٍ
   يُردّ، ورمزُ مسارٍ خاصٍّ أو مجهولٌ ٤٠٤، والفخُّ يُردّ. ④ ولا يُعطى كودَ منحة ولا يُعدّ من مسجّليها. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { PATH_CONTACT_CONSENT_AR } from '../../../src/application/advisor/guest-contact'

let prisma: PrismaClient
let app: FastifyInstance
let ip = 0
const PHONE = `+9627${String(Date.now()).slice(-8)}`
const post = (code: string, payload: object) =>
  app.inject({ method: 'POST', url: `/api/public/go/${code}/contact`, payload, remoteAddress: `10.77.0.${++ip}` })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  await app.ready()
}, 240_000)
afterAll(async () => { await app?.close() })

describe('رقم من صفحة المسار العام', () => {
  it('⚠️ حالة بعميلها وموافقتها ومصدرها — ولا كود منحة ولا تسجيل فيها', async () => {
    const res = await post('bf80', { fullName: 'زائر الإعلان', phone: PHONE })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ ok: true, consentAr: PATH_CONTACT_CONSENT_AR })
    const [kase, ...rest] = await prisma.advisorCase.findMany({ where: { lead: { phone: PHONE } }, include: { lead: { include: { grantCode: true } } } })
    expect(rest).toHaveLength(0)
    expect(kase!.lead).toMatchObject({ fullName: 'زائر الإعلان', source: 'campaign', channel: 'go-BF80', campaign: null, consentAr: PATH_CONTACT_CONSENT_AR, grantCode: null })
    expect(kase!.nextAction).toBe('تواصل أول — ترك رقمه في صفحة BF80')
  })

  it('⚠️ ومن أعاد لا تفتح له ثانية، والجواب واحد — ويكتب أنه عاد من الصفحة', async () => {
    const res = await post('BF80', { fullName: 'زائر الإعلان', phone: PHONE })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ ok: true, consentAr: PATH_CONTACT_CONSENT_AR })
    const cases = await prisma.advisorCase.findMany({ where: { lead: { phone: PHONE } }, include: { contactEvents: true } })
    expect(cases).toHaveLength(1)
    expect(cases[0]!.contactEvents.map((e) => e.summary).join()).toContain('من صفحة BF80')
  })

  it('⚠️ رقم بلا رمز دولة، واسم بحرف، ورمز غير عام، والفخ — كلها ترد', async () => {
    expect((await post('BF80', { fullName: 'زائر', phone: '0791234567' })).statusCode).toBe(400)
    expect((await post('BF80', { fullName: 'ز', phone: '+962791230001' })).statusCode).toBe(422)
    expect((await post('ABCDEFGH', { fullName: 'زائر', phone: '+962791230002' })).statusCode).toBe(404)
    expect((await post('BF80', { fullName: 'زائر', phone: '+962791230003', website: 'x' })).statusCode).toBe(400)
    expect(await prisma.lead.count({ where: { phone: { in: ['+962791230001', '+962791230002', '+962791230003'] } } })).toBe(0)
  })
})

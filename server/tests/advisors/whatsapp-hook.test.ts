/* بابُ منصّة محادثات واتساب (١٩ أكتوبر ٢٠٢٦) — قرارُ صاحب المنصّة: «b»، والعلّةُ في `whatsapp-hook.service.ts`.

   ① **لا يُفتح بلا رمز** — ولا وهو معطَّل.
   ② **الطالبُ برقمه كما يصل من واتساب، والمستشارُ ببريده** — فيُسجَّل التواصلُ في حالته، ويُسقط
      التذكير، وتبدأ به عمولةُ ما أسنده النظام.
   ③ **ولمستشار الحالة وحدَه، ومرّةً كلَّ ستّ ساعات** — وما لا يُسجَّل يُقال سببُه بجوابٍ ٢٠٠. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { buildApp } from '../../http/app'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService, attributedRevenue } from '../../services/advisor.service'
import { WhatsAppHookService } from '../../services/whatsapp-hook.service'
import { saveWhatsAppHookConfig, whatsAppHookView } from '../../services/integrations.service'

const TOKEN = 'wa-hook-token-for-tests-0123456789abcdef'
const HOUR = 3_600_000

let prisma: PrismaClient
let app: FastifyInstance
let auth: AuthService
let advisors: AdvisorService
let managerId = ''
let advA = ''
let advB = ''
let seq = 0

const post = (body: Record<string, unknown>, headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` }) =>
  app.inject({
    method: 'POST', url: '/api/webhooks/whatsapp-contact',
    headers: { 'content-type': 'application/json', ...headers },
    payload: JSON.stringify(body),
  })

/** زائرٌ ترك رقمَه المحلّيّ آخرَ التشخيص — وحالتُه عند `advisorId` */
async function guestWith(advisorId: string) {
  const local = `079${String(5000000 + ++seq)}`
  await advisors.requestContactAsGuest({ fullName: `زائر ${seq}`, phone: local })
  const kase = await prisma.advisorCase.findFirstOrThrow({ where: { lead: { phone: local } } })
  await advisors.assign(kase.id, advisorId, managerId)
  /* وواتساب يرسله دوليّا بلا «+» ولا صفر */
  return { caseId: kase.id, waPhone: `962${local.slice(1)}` }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
  managerId = (await auth.register('hook-manager@test.local', 'Manager#12345', 'مدير')).userId
  await auth.setRoles(managerId, ['operations_manager'])
  advA = (await auth.register('hook-a@test.local', 'Advisor#12345', 'مستشار أ')).userId
  advB = (await auth.register('hook-b@test.local', 'Advisor#12345', 'مستشار ب')).userId
  for (const id of [advA, advB]) await auth.setRoles(id, ['advisor'])
  await saveWhatsAppHookConfig(prisma, managerId, { enabled: true, token: TOKEN })
}, 240_000)

afterAll(async () => { await app?.close() })

describe('① لا يُفتح بلا رمز', () => {
  it('⚠️ بلا رمز أو برمزٍ خطأ: ٤٠١ ولا يُكتب شيء', async () => {
    const { caseId, waPhone } = await guestWith(advA)
    const body = { studentPhone: waPhone, advisorEmail: 'hook-a@test.local' }
    expect((await post(body, {})).statusCode).toBe(401)
    expect((await post(body, { authorization: 'Bearer wrong-token-wrong-token-wrong' })).statusCode).toBe(401)
    expect(await prisma.contactEvent.count({ where: { caseId, source: 'whatsapp_hook' } })).toBe(0)
  })

  it('⚠️ ومعطَّلا لا يُفتح ولو بالرمز الصحيح', async () => {
    await saveWhatsAppHookConfig(prisma, managerId, { enabled: false })
    try {
      const { waPhone } = await guestWith(advA)
      expect((await post({ studentPhone: waPhone, advisorEmail: 'hook-a@test.local' })).statusCode).toBe(401)
    } finally {
      await saveWhatsAppHookConfig(prisma, managerId, { enabled: true })
    }
  })

  it('والرمزُ القصيرُ يُرفض — ولا يُعاد كاملا في شاشة التكاملات', async () => {
    await expect(saveWhatsAppHookConfig(prisma, managerId, { enabled: true, token: 'short' })).rejects.toThrow()
    const view = await whatsAppHookView(prisma)
    expect(view.hasToken).toBe(true)
    expect(view.token).not.toContain(TOKEN.slice(0, 10))
  })
})

describe('② يُسجَّل في حالة الطالب', () => {
  it('⚠️ رقمُ واتساب الدوليّ يطابق ما كتبه الزائرُ محلّيّا — ويسقط به التذكير', async () => {
    const { caseId, waPhone } = await guestWith(advA)
    const res = await post({ studentPhone: `+${waPhone}`, advisorEmail: 'HOOK-A@test.local' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ logged: true, outcome: 'logged' })
    const ev = await prisma.contactEvent.findFirst({ where: { caseId, source: 'whatsapp_hook' } })
    expect(ev?.createdBy, 'سُجّل التواصلُ بلا صاحبه').toBe(advA)
    expect((await prisma.advisorCase.findUniqueOrThrow({ where: { id: caseId } })).status).toBe('contacted')

    await prisma.advisorAssignment.updateMany({ where: { caseId, unassignedAt: null }, data: { assignedAt: new Date(Date.now() - 25 * HOUR) } })
    await prisma.contactEvent.updateMany({ where: { caseId }, data: { createdAt: new Date(Date.now() - 24 * HOUR) } })
    await advisors.remindDue()
    const bells = await prisma.notification.findMany({ where: { userId: advA, templateKey: 'advisor.case.no_contact' } })
    expect(bells.some((n) => (n.data as { caseId?: string }).caseId === caseId), 'ذُكّر من راسل من المنصّة').toBe(false)
  })

  it('⚠️ وبه تبدأ عمولةُ ما أسنده النظام — ٢٥٠ دفعها الطالبُ بعده تُحسب', async () => {
    const { userId } = await auth.register(`hook-buyer-${++seq}@test.local`, 'Learner#12345', 'مشتري')
    const phone = `07960000${String(seq).padStart(2, '0')}`
    const { case: kase } = await advisors.attachDiagnostic(userId, { top: { id: 'PW-X', name: 'م' } })
    /* رقمُ صاحب الحساب في ملفّ المتعلّم — لا عميلَ محتملا برقم */
    await prisma.learnerProfile.update({ where: { userId }, data: { phone } })
    await prisma.advisorAssignment.updateMany({ where: { caseId: kase!.id, unassignedAt: null }, data: { advisorId: advB, automatic: true } })
    const before = await attributedRevenue(prisma, advB)

    expect((await post({ studentPhone: `962${phone.slice(1)}`, advisorEmail: 'hook-b@test.local' })).json()).toMatchObject({ logged: true })
    const paidAt = new Date(Date.now() + 1000)
    await prisma.order.create({ data: { userId, status: 'paid', subtotal: 250, total: 250, currency: 'USD', paidAt, createdAt: paidAt } })
    expect(await attributedRevenue(prisma, advB) - before, 'لم تبدأ العمولةُ بتواصل المنصّة').toBe(250)
  })
})

describe('③ لمستشار الحالة وحدَه، ومرّةً كلَّ ستّ ساعات', () => {
  it('⚠️ من ليس الطالبُ في عهدته لا يُكتب له — ويُقال السبب', async () => {
    const { caseId, waPhone } = await guestWith(advA)
    const res = await post({ studentPhone: waPhone, advisorEmail: 'hook-b@test.local' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ logged: false, outcome: 'not_assigned' })
    expect(await prisma.contactEvent.count({ where: { caseId, source: 'whatsapp_hook' } })).toBe(0)
  })

  it('⚠️ وفي ستّ ساعاتٍ تواصلٌ واحد — وبعدها ثانٍ', async () => {
    const { caseId, waPhone } = await guestWith(advA)
    const hook = new WhatsAppHookService(prisma)
    const t0 = new Date()
    expect((await hook.handle({ studentPhone: waPhone, advisorEmail: 'hook-a@test.local' }, t0)).outcome).toBe('logged')
    expect((await hook.handle({ studentPhone: waPhone, advisorEmail: 'hook-a@test.local' }, new Date(t0.getTime() + HOUR))).outcome).toBe('throttled')
    expect((await hook.handle({ studentPhone: waPhone, advisorEmail: 'hook-a@test.local' }, new Date(t0.getTime() + 7 * HOUR))).outcome).toBe('logged')
    expect(await prisma.contactEvent.count({ where: { caseId, source: 'whatsapp_hook' } })).toBe(2)
  })

  it('⚠️ ومستشارٌ لا نعرفه، ورقمٌ بلا حالة، ورقمٌ ليس رقما — كلٌّ بسببه', async () => {
    const { waPhone } = await guestWith(advA)
    expect((await post({ studentPhone: waPhone, advisorEmail: 'nobody@test.local' })).json().outcome).toBe('unknown_advisor')
    expect((await post({ studentPhone: '962700000001', advisorEmail: 'hook-a@test.local' })).json().outcome).toBe('no_case')
    expect((await post({ studentPhone: 'abc-de', advisorEmail: 'hook-a@test.local' })).json().outcome).toBe('bad_phone')
  })

  it('⚠️ وبريدُ موظّفٍ ليس مستشارا، أو مستشارٍ موقوف — لا يُكتب له', async () => {
    const { caseId, waPhone } = await guestWith(advA)
    expect((await post({ studentPhone: waPhone, advisorEmail: 'hook-manager@test.local' })).json().outcome).toBe('unknown_advisor')
    await prisma.user.update({ where: { id: advA }, data: { status: 'suspended' } })
    try {
      expect((await post({ studentPhone: waPhone, advisorEmail: 'hook-a@test.local' })).json().outcome).toBe('unknown_advisor')
    } finally {
      await prisma.user.update({ where: { id: advA }, data: { status: 'active' } })
    }
    expect(await prisma.contactEvent.count({ where: { caseId, source: 'whatsapp_hook' } })).toBe(0)
  })

  it('⚠️ والحالةُ المغلقةُ لا يُكتب فيها', async () => {
    const { caseId, waPhone } = await guestWith(advA)
    await prisma.advisorCase.update({ where: { id: caseId }, data: { status: 'closed' } })
    expect((await post({ studentPhone: waPhone, advisorEmail: 'hook-a@test.local' })).json().outcome).toBe('no_case')
  })

  it('وآخرُ ما وصل يُقال في شاشة التكاملات', async () => {
    const view = await whatsAppHookView(prisma)
    expect(view.pulse?.outcome).toBeTruthy()
    expect(view.url).toMatch(/\/api\/webhooks\/whatsapp-contact$/)
  })
})

/* بابُ منصّة محادثات واتساب (١٩ أكتوبر ٢٠٢٦) — قرارُ صاحب المنصّة: «b»، والعلّةُ في `whatsapp-hook.service.ts`.

   ① **لا يُفتح بلا رمز** — ولا وهو معطَّل.
   ② **الطالبُ برقمه كما يصل من واتساب، والمستشارُ ببريده** — فيُسجَّل التواصلُ في حالته، ويُسقط
      التذكير، وتبدأ به عمولةُ ما أسنده النظام.
   ③ **ولمستشار الحالة وحدَه، ومرّةً كلَّ ستّ ساعات** — وما لا يُسجَّل يُقال سببُه بجوابٍ ٢٠٠.
   ④ **ورقمٌ بلا حالة تُفتح له حالةٌ عند من راسله** — مرّةً لا مرّتين، وبريدُه في الحالة يربطها
      بحسابه حين يوثّقه. */

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

  it('⚠️ ومستشارٌ لا نعرفه، ورقمٌ ليس رقما — كلٌّ بسببه، ولا تُفتح حالة', async () => {
    const { waPhone } = await guestWith(advA)
    expect((await post({ studentPhone: waPhone, advisorEmail: 'nobody@test.local' })).json().outcome).toBe('unknown_advisor')
    expect((await post({ studentPhone: '962700000999', advisorEmail: 'nobody@test.local' })).json().outcome).toBe('unknown_advisor')
    expect(await prisma.lead.count({ where: { phone: { contains: '700000999' } } }), 'فُتحت حالةٌ لمستشارٍ لا نعرفه').toBe(0)
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

  it('⚠️ والحالةُ المغلقةُ لا يُكتب فيها — تُفتح بجانبها حالةٌ جديدة', async () => {
    const { caseId, waPhone } = await guestWith(advA)
    await prisma.advisorCase.update({ where: { id: caseId }, data: { status: 'closed' } })
    expect((await post({ studentPhone: waPhone, advisorEmail: 'hook-a@test.local' })).json().outcome).toBe('opened')
    expect(await prisma.contactEvent.count({ where: { caseId, source: 'whatsapp_hook' } }), 'كُتب في المغلقة').toBe(0)
  })

  it('وآخرُ ما وصل يُقال في شاشة التكاملات', async () => {
    const view = await whatsAppHookView(prisma)
    expect(view.pulse?.outcome).toBeTruthy()
    expect(view.url).toMatch(/\/api\/webhooks\/whatsapp-contact$/)
  })
})

describe('④ رقمٌ بلا حالة — تُفتح له حالةٌ عند من راسله', () => {
  it('⚠️ مسنَدةً له تلقائيّا، وفيها أوّلُ تواصل — باسمه من المنصّة', async () => {
    const res = await post({ studentPhone: '962781111001', studentName: 'سلمى من واتساب', advisorEmail: 'hook-a@test.local' })
    expect(res.json()).toMatchObject({ logged: true, outcome: 'opened' })
    const kase = await prisma.advisorCase.findFirstOrThrow({
      where: { lead: { phone: '962781111001' } },
      include: { lead: true, assignments: true, contactEvents: true },
    })
    expect(kase.lead?.source).toBe('whatsapp')
    expect(kase.lead?.fullName).toBe('سلمى من واتساب')
    expect(kase.status).toBe('contacted')
    expect(kase.assignments).toHaveLength(1)
    expect(kase.assignments[0]).toMatchObject({ advisorId: advA, automatic: true, assignedBy: null, unassignedAt: null })
    expect(kase.contactEvents.map((e) => [e.createdBy, e.source])).toEqual([[advA, 'whatsapp_hook']])
    /* ورسالةٌ تاليةٌ تجد الحالة — لا تفتح ثانية */
    expect((await post({ studentPhone: '0781111001', advisorEmail: 'hook-a@test.local' })).json().outcome).toBe('throttled')
    expect(await prisma.lead.count({ where: { phone: { contains: '781111001' } } })).toBe(1)
  })

  it('⚠️ ورسائلُ معا لرقمٍ جديد لا تفتح حالتين', async () => {
    const hook = new WhatsAppHookService(prisma)
    const outs = await Promise.all([1, 2, 3].map(() => hook.handle({ studentPhone: '962782222002', advisorEmail: 'hook-a@test.local' })))
    expect(outs.filter((o) => o.outcome === 'opened'), 'فُتحت أكثرُ من حالة').toHaveLength(1)
    expect(await prisma.advisorCase.count({ where: { lead: { phone: '962782222002' } } })).toBe(1)
  })

  it('وبلا اسمٍ يُسمّى بآخر أرقامه', async () => {
    await post({ studentPhone: '962783333003', advisorEmail: 'hook-a@test.local' })
    expect((await prisma.lead.findFirstOrThrow({ where: { phone: '962783333003' } })).fullName).toBe('عميل واتساب 3003')
  })

  it('⚠️ وبريدُه في الحالة يربطها بحسابه الموثَّق — فتُحسب للمستشار دفعاتُه', async () => {
    await post({ studentPhone: '962784444004', advisorEmail: 'hook-b@test.local' })
    const kase = await prisma.advisorCase.findFirstOrThrow({ where: { lead: { phone: '962784444004' } } })
    const { userId } = await auth.register('wa-student@test.local', 'Learner#12345', 'طالب واتساب')
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } })

    expect(await advisors.setLeadEmail(advB, kase.id, ' WA-Student@test.local ')).toEqual({ linked: true })
    expect((await prisma.advisorCase.findUniqueOrThrow({ where: { id: kase.id } })).clientId, 'لم تلحق حسابَه').toBe(userId)
    const before = await attributedRevenue(prisma, advB)
    const paidAt = new Date(Date.now() + 1000)
    await prisma.order.create({ data: { userId, status: 'paid', subtotal: 90, total: 90, currency: 'USD', paidAt, createdAt: paidAt } })
    expect(await attributedRevenue(prisma, advB) - before).toBe(90)
  })

  it('⚠️ وبريدٌ لم يوثّقه صاحبُه يُحفظ ولا يربط — حتّى يوثّقه', async () => {
    await post({ studentPhone: '962785555005', advisorEmail: 'hook-a@test.local' })
    const kase = await prisma.advisorCase.findFirstOrThrow({ where: { lead: { phone: '962785555005' } } })
    await auth.register('wa-unverified@test.local', 'Learner#12345', 'لم يوثق')
    expect(await advisors.setLeadEmail(advA, kase.id, 'wa-unverified@test.local')).toEqual({ linked: false })
    const after = await prisma.advisorCase.findUniqueOrThrow({ where: { id: kase.id }, include: { lead: true } })
    expect(after.clientId).toBeNull()
    expect(after.lead?.email).toBe('wa-unverified@test.local')
  })

  it('⚠️ ولا يكتبه إلّا مستشارُ الحالة — ولا يُغيَّر بعد أن لحقت حسابا، ولا لبريدٍ له حالةٌ أخرى', async () => {
    await post({ studentPhone: '962786666006', advisorEmail: 'hook-a@test.local' })
    const kase = await prisma.advisorCase.findFirstOrThrow({ where: { lead: { phone: '962786666006' } } })
    await expect(advisors.setLeadEmail(advB, kase.id, 'x@test.local')).rejects.toMatchObject({ code: 'not_assigned' })
    await expect(advisors.setLeadEmail(advA, kase.id, 'wa-unverified@test.local')).rejects.toMatchObject({ code: 'case_exists' })
    await expect(advisors.setLeadEmail(advA, kase.id, 'ليس بريدا')).rejects.toMatchObject({ code: 'bad_email' })

    const linked = await prisma.advisorCase.findFirstOrThrow({ where: { lead: { phone: '962784444004' } } })
    await expect(advisors.setLeadEmail(advB, linked.id, 'other@test.local')).rejects.toMatchObject({ code: 'already_linked' })
  })
})

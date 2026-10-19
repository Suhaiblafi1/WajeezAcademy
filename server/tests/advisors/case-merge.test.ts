/* حالتان لطالبٍ واحد تُدمجان (١٩ أكتوبر ٢٠٢٦) — قرارُ صاحب المنصّة: «A»، والعلّةُ عند `mergeCases`.

   ① **كلُّ ما في الحالتين يصير في واحدة** — والأخرى تُغلق وفيها سببُها، وملاحظةٌ تقول ما دُمج.
   ② **ويبقى عند المستشار المختار** — وتبقى ذاتُ الحساب، فلا تُنسب دفعةٌ لمن لم يكن الطالبُ عنده.
   ③ **ولا تُدمج حالتان لحسابين، ولا مغلقة، ولا حالةٌ مع نفسها.**
   ④ **ومن كتب بريدا له حالةٌ أخرى يُبلَّغ عنه من يدمج** — مرّةً في اليوم. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService, attributedRevenue } from '../../services/advisor.service'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
let managerId = ''
let advA = ''
let advB = ''
let seq = 0

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY)
const active = (caseId: string) => prisma.advisorAssignment.findFirst({ where: { caseId, unassignedAt: null } })

/** حالةٌ برقمٍ وحدَه عند `advisorId` — كما تفتحها منصّةُ واتساب أو زائرٌ ترك رقمَه */
async function phoneCase(advisorId: string, assignedAt = new Date()) {
  const phone = `0795${String(100000 + ++seq)}`
  const lead = await prisma.lead.create({ data: { fullName: `زائر ${seq}`, phone, source: 'whatsapp' } })
  const kase = await prisma.advisorCase.create({ data: { leadId: lead.id, status: 'contacted' } })
  await prisma.advisorAssignment.create({ data: { caseId: kase.id, advisorId, assignedAt, automatic: true } })
  return { caseId: kase.id, phone }
}
/** حالةٌ لصاحب حساب عند `advisorId` — كما يفتحها التشخيصُ أو الشراء */
async function accountCase(advisorId: string, assignedAt = new Date()) {
  const email = `merge-client-${++seq}@test.local`
  const { userId } = await auth.register(email, 'Client#12345', `طالب ${seq}`)
  const lead = await prisma.lead.create({ data: { fullName: `طالب ${seq}`, email, userId, source: 'site' } })
  const kase = await prisma.advisorCase.create({ data: { leadId: lead.id, clientId: userId, status: 'new', createdAt: assignedAt } })
  await prisma.advisorAssignment.create({ data: { caseId: kase.id, advisorId, assignedAt, assignedBy: managerId } })
  return { caseId: kase.id, userId, email }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
  managerId = (await auth.register('merge-manager@test.local', 'Manager#12345', 'مدير')).userId
  await auth.setRoles(managerId, ['operations_manager'])
  advA = (await auth.register('merge-a@test.local', 'Advisor#12345', 'مستشار أ')).userId
  advB = (await auth.register('merge-b@test.local', 'Advisor#12345', 'مستشار ب')).userId
  for (const id of [advA, advB]) await auth.setRoles(id, ['advisor'])
}, 240_000)

describe('① كلُّ ما في الحالتين يصير في واحدة', () => {
  it('⚠️ التواصلُ والملاحظاتُ والمتابعاتُ والرقم — والأخرى تُغلق ويُرفع إسنادُها', async () => {
    const acc = await accountCase(advA)
    const ph = await phoneCase(advB)
    await prisma.contactEvent.create({ data: { caseId: ph.caseId, channel: 'whatsapp', summary: 'من واتساب', createdBy: advB } })
    await prisma.advisorNote.create({ data: { caseId: ph.caseId, authorId: advB, body: 'يريد دورة القيادة' } })
    await prisma.followUp.create({ data: { caseId: ph.caseId, scheduledAt: new Date(Date.now() + DAY), createdBy: advB } })

    const out = await advisors.mergeCases([acc.caseId, ph.caseId], advA, managerId)
    expect(out).toEqual({ keptId: acc.caseId, closedId: ph.caseId })

    const kept = await prisma.advisorCase.findUniqueOrThrow({
      where: { id: acc.caseId }, include: { lead: true, contactEvents: true, notes: true, followUps: true },
    })
    expect(kept.contactEvents.map((e) => e.summary)).toContain('من واتساب')
    expect(kept.notes.map((n) => n.body)).toContain('يريد دورة القيادة')
    expect(kept.notes.some((n) => n.body.startsWith('دمجت معها حالة') && n.body.includes(ph.phone)), 'لا ملاحظةَ تقول ما دُمج').toBe(true)
    expect(kept.followUps).toHaveLength(1)
    expect(kept.lead?.phone, 'سقط رقمُ الحالة الأخرى').toBe(ph.phone)
    expect(kept.lead?.email).toBe(acc.email)
    expect(kept.status, 'بقيت «جديدة» وقد كُلّم في الأخرى').toBe('contacted')

    const closed = await prisma.advisorCase.findUniqueOrThrow({ where: { id: ph.caseId } })
    expect(closed.status).toBe('closed')
    expect(await active(ph.caseId), 'بقي إسنادُ المغلقة').toBeNull()
    expect(await prisma.auditEvent.findFirst({ where: { action: 'advisor.cases.merge', entityId: acc.caseId } })).not.toBeNull()
  })
})

describe('② يبقى عند المستشار المختار — وتبقى ذاتُ الحساب', () => {
  it('⚠️ المختارُ من الأخرى ينتقل إلى الباقية، ومن كان فيها يُرفع', async () => {
    const acc = await accountCase(advA)
    const ph = await phoneCase(advB)
    const out = await advisors.mergeCases([ph.caseId, acc.caseId], advB, managerId)
    expect(out.keptId, 'بقيت حالةٌ بلا حساب وأُغلقت ذاتُ الحساب').toBe(acc.caseId)
    expect((await active(acc.caseId))?.advisorId).toBe(advB)
    expect(await prisma.advisorAssignment.count({ where: { caseId: acc.caseId, advisorId: advA, unassignedAt: { not: null } } })).toBe(1)
  })

  it('⚠️ وبلا حسابٍ فيهما: حالةُ المختار تبقى — وإلّا الأقدم', async () => {
    const older = await phoneCase(advA, ago(5))
    const newer = await phoneCase(advB, ago(1))
    await prisma.advisorCase.update({ where: { id: older.caseId }, data: { createdAt: ago(5) } })
    expect((await advisors.mergeCases([older.caseId, newer.caseId], advB, managerId)).keptId).toBe(newer.caseId)

    const x = await phoneCase(advA, ago(5))
    const y = await phoneCase(advA, ago(1))
    await prisma.advisorCase.update({ where: { id: x.caseId }, data: { createdAt: ago(5) } })
    expect((await advisors.mergeCases([y.caseId, x.caseId], advB, managerId)).keptId).toBe(x.caseId)
  })

  it('⚠️ والمالُ كالنقل: ما دُفع قبل الدمج لمن كان عنده، وما بعده للمختار', async () => {
    const acc = await accountCase(advA, ago(10))
    const ph = await phoneCase(advB, ago(3))
    const before = { a: await attributedRevenue(prisma, advA), b: await attributedRevenue(prisma, advB) }
    await prisma.order.create({ data: { userId: acc.userId, status: 'paid', subtotal: 100, total: 100, currency: 'USD', paidAt: ago(1), createdAt: ago(1) } })

    await advisors.mergeCases([acc.caseId, ph.caseId], advB, managerId)
    const later = new Date(Date.now() + 60_000)
    await prisma.order.create({ data: { userId: acc.userId, status: 'paid', subtotal: 40, total: 40, currency: 'USD', paidAt: later, createdAt: later } })

    expect(await attributedRevenue(prisma, advA) - before.a, 'سقط ما دُفع وهو عند الأوّل').toBe(100)
    expect(await attributedRevenue(prisma, advB) - before.b, 'نُسب للمختار ما قبل الدمج').toBe(40)
  })
})

describe('③ ما لا يُدمج', () => {
  it('⚠️ حالتان لحسابين، ومغلقة، والحالةُ مع نفسها، ومستشارٌ غيرُ نشط', async () => {
    const one = await accountCase(advA)
    const two = await accountCase(advB)
    await expect(advisors.mergeCases([one.caseId, two.caseId], advA, managerId)).rejects.toMatchObject({ code: 'different_accounts' })
    await expect(advisors.mergeCases([one.caseId, one.caseId], advA, managerId)).rejects.toMatchObject({ code: 'same_case' })
    const ph = await phoneCase(advA)
    await prisma.advisorCase.update({ where: { id: ph.caseId }, data: { status: 'closed' } })
    await expect(advisors.mergeCases([one.caseId, ph.caseId], advA, managerId)).rejects.toMatchObject({ code: 'case_closed' })
    const open = await phoneCase(advA)
    await expect(advisors.mergeCases([one.caseId, open.caseId], managerId, managerId)).rejects.toMatchObject({ code: 'not_advisor' })
    expect((await prisma.advisorCase.findUniqueOrThrow({ where: { id: open.caseId } })).status, 'رُفض الدمجُ وأُغلقت الحالة').toBe('contacted')
  })
})

describe('④ بريدٌ له حالةٌ أخرى — يُبلَّغ من يدمج', () => {
  it('⚠️ مرّةً في اليوم للحالة — ويُقال للمستشار إنّ الإدارةَ أُبلغت', async () => {
    const acc = await accountCase(advA)
    const ph = await phoneCase(advB)
    for (let i = 0; i < 2; i++) {
      await expect(advisors.setLeadEmail(advB, ph.caseId, acc.email)).rejects.toMatchObject({ code: 'case_exists' })
    }
    const bells = await prisma.notification.findMany({ where: { userId: managerId, templateKey: 'advisor.case.duplicate' } })
    const forCase = bells.filter((n) => (n.data as { caseId?: string }).caseId === ph.caseId)
    expect(forCase, 'لم يُبلَّغ من يدمج — أو بُلّغ مع كلّ محاولة').toHaveLength(1)
    expect((forCase[0]!.data as { otherCaseId?: string }).otherCaseId).toBe(acc.caseId)
  })

  it('والبحثُ يجد الحالةَ بلا مستشار أيضا — فتُدمج', async () => {
    const lead = await prisma.lead.create({ data: { fullName: 'بلا مستشار للدمج', phone: '0795999001', source: 'diagnostic' } })
    const kase = await prisma.advisorCase.create({ data: { leadId: lead.id } })
    expect((await advisors.searchOpenCases('بلا مستشار للدمج')).some((c) => c.id === kase.id)).toBe(true)
  })
})

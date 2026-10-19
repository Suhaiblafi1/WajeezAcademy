/* الطالبُ والمستشار من أوّل تشخيصٍ حتّى الدفع (١٩ أكتوبر ٢٠٢٦).

   أربعُ فجواتٍ أُغلقت بقرار صاحب المنصّة:
   ① **الإسنادُ تلقائيٌّ لأقلّ المستشارين حالاتٍ مفتوحة** — والإداريُّ يرى ما أُسند ويغيّره.
   ② **نتيجةُ الضيف تلحق حسابَه حين يدخل** — ولا تُكتب فوق أحدثَ منها، ولا تفتح حالةً ثانيةً
      لمن تنتظر حالتُه توثيقَ بريده.
   ③ **من يشتري بلا تشخيصٍ يجد مستشارا** — عند أوّل طلب تسجيلٍ أو دفع، مرّةً واحدة.
   ④ **ومن دفع صارت حالتُه «سجّل»** — ويُبلَّغ مستشارُه، ويبقى في «طلابي». */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService } from '../../services/advisor.service'
import { CommerceService } from '../../services/commerce.service'
import { LearnersService } from '../../services/learners.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
let commerce: CommerceService
let managerId = ''
let advA = ''
let advB = ''
let advOff = ''

let phoneSeq = 0
const nextPhone = () => `07920000${String(++phoneSeq).padStart(2, '0')}`
const activeAssignee = async (caseId: string) =>
  (await prisma.advisorAssignment.findFirst({ where: { caseId, unassignedAt: null } }))

async function guestCase(name: string) {
  const phone = nextPhone()
  await advisors.requestContactAsGuest({ fullName: name, phone })
  return prisma.advisorCase.findFirstOrThrow({ where: { lead: { phone } } })
}

let cohortSeq = 0
async function openCohort() {
  cohortSeq += 1
  return (await prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) },
      courseId: 'C-BIZ-101', title: `شعبة المسار ${cohortSeq}`, status: 'open', registrationOpen: true, financialReady: true,
      price: 120, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() + 30 * 86_400_000),
    },
  })).id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
  commerce = new CommerceService(prisma)
  managerId = (await auth.register('flow-manager@test.local', 'Manager#12345', 'مدير')).userId
  await auth.setRoles(managerId, ['operations_manager'])
  advA = (await auth.register('flow-adv-a@test.local', 'Advisor#12345', 'مستشار أ')).userId
  advB = (await auth.register('flow-adv-b@test.local', 'Advisor#12345', 'مستشار ب')).userId
  advOff = (await auth.register('flow-adv-off@test.local', 'Advisor#12345', 'مستشار موقوف')).userId
  for (const id of [advA, advB, advOff]) await auth.setRoles(id, ['advisor'])
  await prisma.user.update({ where: { id: advOff }, data: { status: 'suspended' } })
  /* مستشارو البذر — إن وُجدوا — خارج هذا القياس: الحسابُ على أ وب وحدَهما */
  await prisma.user.updateMany({
    where: { roles: { some: { roleId: 'advisor' } }, id: { notIn: [advA, advB, advOff] } },
    data: { status: 'suspended' },
  })
}, 240_000)

describe('① الإسنادُ تلقائيٌّ لأقلّ المستشارين حالاتٍ مفتوحة', () => {
  it('⚠️ الحالةُ الثانيةُ لمن لا حالةَ عنده — والثالثةُ لمن طال عهدُه بآخر إسناد — والموقوفُ لا يُسند إليه', async () => {
    const first = await activeAssignee((await guestCase('زائر ١')).id)
    const second = await activeAssignee((await guestCase('زائر ٢')).id)
    const third = await activeAssignee((await guestCase('زائر ٣')).id)
    expect([first?.advisorId, second?.advisorId].sort()).toEqual([advA, advB].sort())
    expect(third?.advisorId, 'لم يُراعَ من طال عهدُه بآخر إسناد').toBe(first?.advisorId)
    expect([first, second, third].map((a) => a?.advisorId)).not.toContain(advOff)
  })

  it('⚠️ وفي التعادل لمن طال عهدُه بآخر إسناد — لا لترتيب المعرّف', async () => {
    /* حِملان متساويان، وأقربُهما إسنادا صاحبُ المعرّف الأصغر — فالمعرّفُ وحدَه يختاره خطأً */
    await prisma.advisorCase.updateMany({ data: { status: 'closed' } })
    const [small, big] = [advA, advB].sort((x, y) => x.localeCompare(y))
    await advisors.assign((await guestCase('تعادل ١')).id, big!, managerId)
    await advisors.assign((await guestCase('تعادل ٢')).id, small!, managerId)
    const next = await activeAssignee((await guestCase('تعادل ٣')).id)
    expect(next?.advisorId, 'اختير أقربُهما إسنادا').toBe(big)
  })

  it('⚠️ وأقلُّهم حالاتٍ مفتوحةً يأخذ — لا بالدور', async () => {
    /* أ يحمل حالتين مفتوحتين على الأقلّ، وب لا شيء — فالحِملُ لا الدورُ يقرّر */
    for (const n of ['حمل أ ١', 'حمل أ ٢']) await advisors.assign((await guestCase(n)).id, advA, managerId)
    const ofB = await prisma.advisorAssignment.findMany({ where: { advisorId: advB, unassignedAt: null }, select: { caseId: true } })
    await prisma.advisorCase.updateMany({ where: { id: { in: ofB.map((x) => x.caseId) } }, data: { status: 'closed' } })
    const a1 = await activeAssignee((await guestCase('زائر ٤')).id)
    const a2 = await activeAssignee((await guestCase('زائر ٥')).id)
    expect(a1?.advisorId).toBe(advB)
    expect(a2?.advisorId, 'وُزّعت بالدور لا بالحِمل').toBe(advB)
  })

  it('⚠️ الإسنادُ باسم النظام، ويُبلَّغ المستشار — والإداريُّ يراه ويغيّره', async () => {
    const kase = await guestCase('زائر للمراجعة')
    const link = await activeAssignee(kase.id)
    expect(link?.assignedBy, 'نُسب الإسنادُ لأحدٍ لم يُسند').toBeNull()
    const bell = await prisma.notification.findFirst({ where: { userId: link!.advisorId, templateKey: 'advisor.case.assigned', data: { path: ['caseId'], equals: kase.id } } })
    expect(bell).not.toBeNull()

    expect((await advisors.listAutoAssigned()).some((c) => c.id === kase.id)).toBe(true)
    const other = link!.advisorId === advA ? advB : advA
    await advisors.assign(kase.id, other, managerId)
    expect((await activeAssignee(kase.id))?.advisorId).toBe(other)
    expect((await advisors.listAutoAssigned()).some((c) => c.id === kase.id), 'بقي «تلقائيّا» بعد أن غيّره الإداريّ').toBe(false)
  })

  it('⚠️ ولا مستشارَ نشطا — تبقى في الطابور كما كانت', async () => {
    await prisma.user.updateMany({ where: { id: { in: [advA, advB] } }, data: { status: 'suspended' } })
    try {
      const kase = await guestCase('زائر بلا مستشار')
      expect(await activeAssignee(kase.id)).toBeNull()
      expect((await advisors.listUnassigned()).some((c) => c.id === kase.id)).toBe(true)
    } finally {
      await prisma.user.updateMany({ where: { id: { in: [advA, advB] } }, data: { status: 'active' } })
    }
  })
})

describe('② نتيجةُ الضيف تلحق حسابَه حين يدخل', () => {
  const OLD = { top: { id: 'PW-OLD' }, v: 'old' }
  const NEW = { top: { id: 'PW-NEW' }, v: 'new' }

  it('⚠️ لا تُكتب نسخةٌ أقدمُ فوق ما في الحساب — والأحدثُ تُكتب', async () => {
    const { userId } = await auth.register('sync-newer@test.local', 'Learner#12345', 'متعلّم')
    await advisors.attachDiagnostic(userId, NEW)
    const older = new Date(Date.now() - 3600_000)
    await advisors.attachDiagnostic(userId, OLD, undefined, { completedAt: older })
    let profile = await prisma.learnerProfile.findUniqueOrThrow({ where: { userId } })
    expect(profile.diagnosticSnapshot, 'محت نسخةٌ قديمةٌ تشخيصا أحدثَ منها').toMatchObject({ v: 'new' })

    await advisors.attachDiagnostic(userId, OLD, undefined, { completedAt: new Date(Date.now() + 1000) })
    profile = await prisma.learnerProfile.findUniqueOrThrow({ where: { userId } })
    expect(profile.diagnosticSnapshot).toMatchObject({ v: 'old' })
  })

  it('وحسابٌ بلا تشخيص تُكتب فيه النتيجةُ وتُفتح حالتُه', async () => {
    const { userId } = await auth.register('sync-first@test.local', 'Learner#12345', 'متعلّم')
    const out = await advisors.attachDiagnostic(userId, NEW, undefined, { completedAt: new Date(Date.now() - 86_400_000) })
    expect(out.case?.clientId).toBe(userId)
  })

  it('⚠️ ومن تنتظر حالتُه الضيفةُ توثيقَ بريده لا تُفتح له ثانية', async () => {
    await advisors.requestContactAsGuest({ fullName: 'ضيف سيسجّل', email: 'guest.then.login@test.local', phone: nextPhone() })
    const { userId } = await auth.register('guest.then.login@test.local', 'Learner#12345', 'ضيف سجّل')
    const out = await advisors.attachDiagnostic(userId, NEW)
    expect(out.case, 'أُعيدت حالةُ الضيف لمن لم يُثبت بريدَه').toBeNull()
    expect(await prisma.advisorCase.count({ where: { clientId: userId } }), 'فُتحت حالةٌ ثانية').toBe(0)
    const profile = await prisma.learnerProfile.findUniqueOrThrow({ where: { userId } })
    expect(profile.diagnosticSnapshot).toMatchObject({ v: 'new' })
  })
})

describe('③ من يشتري بلا تشخيصٍ يجد مستشارا', () => {
  it('⚠️ أوّلُ شراءٍ يفتح حالةً تُسنَد — والثاني لا يفتح أخرى', async () => {
    const { userId } = await auth.register('buyer.nodiag@test.local', 'Buyer#12345', 'مشترٍ بلا تشخيص')
    await commerce.checkout(userId, [await openCohort()])
    const cases = await prisma.advisorCase.findMany({ where: { clientId: userId }, include: { lead: true } })
    expect(cases, 'اشترى ولا يراه مستشار').toHaveLength(1)
    expect(cases[0]!.lead?.source).toBe('site')
    expect(await activeAssignee(cases[0]!.id), 'فُتحت ولم تُسنَد').not.toBeNull()

    await commerce.checkout(userId, [await openCohort()])
    expect(await prisma.advisorCase.count({ where: { clientId: userId } })).toBe(1)
  })

  it('⚠️ ومن عرفه مستشارٌ قبلُ لا تُفتح له — ولو أُغلقت حالتُه', async () => {
    const { userId } = await auth.register('buyer.known@test.local', 'Buyer#12345', 'مشترٍ معروف')
    const out = await advisors.attachDiagnostic(userId, { top: { id: 'PW-X' } })
    await prisma.advisorCase.update({ where: { id: out.case!.id }, data: { status: 'closed' } })
    await commerce.checkout(userId, [await openCohort()])
    expect(await prisma.advisorCase.count({ where: { clientId: userId } })).toBe(1)
  })

  it('⚠️ وطلبُ التسجيل بلا دفعٍ يفتحها كذلك — أوّلُ نيّةٍ معلَنة', async () => {
    const { userId } = await auth.register('requester.nodiag@test.local', 'Buyer#12345', 'طالب تسجيل')
    await commerce.requestEnrollment(userId, await openCohort())
    expect(await prisma.advisorCase.count({ where: { clientId: userId } }), 'طلب التسجيل ولا يراه مستشار').toBe(1)
  })

  it('وحسابُ التجربة لا يفتح حالةَ بيع', async () => {
    const { userId } = await auth.register('buyer.test@test.local', 'Buyer#12345', 'حساب تجربة')
    await prisma.user.update({ where: { id: userId }, data: { isTestAccount: true } })
    await commerce.checkout(userId, [await openCohort()])
    expect(await prisma.advisorCase.count({ where: { clientId: userId } })).toBe(0)
  })
})

describe('④ ومن دفع صارت حالتُه «سجّل»', () => {
  it('⚠️ الدفعُ يحوّل الحالة ويُبلّغ مستشارَها — ويبقى في «طلابي»', async () => {
    const { userId } = await auth.register('payer@test.local', 'Buyer#12345', 'من دفع')
    const out = await commerce.checkout(userId, [await openCohort()])
    const kase = await prisma.advisorCase.findFirstOrThrow({ where: { clientId: userId } })
    const advisorId = (await activeAssignee(kase.id))!.advisorId

    await commerce.payOrder(out.orderId, userId, `flow-${out.orderId}`)

    const after = await prisma.advisorCase.findUniqueOrThrow({ where: { id: kase.id } })
    expect(after.status, 'دفع وحالتُه كما كانت').toBe('enrolled')
    expect(await prisma.auditEvent.findFirst({ where: { action: 'advisor.case.client_paid', entityId: kase.id } })).not.toBeNull()
    const bell = await prisma.notification.findFirst({ where: { userId: advisorId, templateKey: 'advisor.case.client_paid' } })
    expect(bell, 'لم يُبلَّغ المستشارُ ببيعٍ تمّ').not.toBeNull()

    const mine = await new LearnersService(prisma).list({ kind: 'advisor', userId: advisorId })
    expect(mine.some((r) => r.user.id === userId), 'خرج من «طلابي» بعد أن دفع').toBe(true)
  })
})

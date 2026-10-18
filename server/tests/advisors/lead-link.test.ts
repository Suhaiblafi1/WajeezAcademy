/* العميلُ المحتمل يلحق حسابَه حين يُثبت بريدَه (١٨ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: الربطُ عند التوثيق لا عند التسجيل — والعلّةُ في `server/services/lead-link.ts`.

   والمقيس:
   ① **التسجيلُ وحدَه لا يربط** — بريدٌ كُتب لم يُثبَت.
   ② **والتوثيقُ يربط** — العميلَ المحتمل وحالتَه، ويُبلَّغ مستشارُه، ويُكتب الأثر.
   ③ **والأبوابُ الثلاثة سواء** — رابطُ التوثيق، وتوثيقُ الموظّف، ورابطُ الاستعادة.
   ④ **ولا يُنقل ما له صاحب** — عميلٌ محتملٌ لحسابٍ آخر، وحالةٌ لها صاحبُ حساب.
   ⑤ **و«طلابي» يرى طالبَه بعد الربط** — وهو الغرضُ كلُّه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService } from '../../services/advisor.service'
import { LearnersService } from '../../services/learners.service'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
let managerId = ''
let advisorId = ''

const caseByPhone = (phone: string) =>
  prisma.advisorCase.findFirstOrThrow({ where: { lead: { phone } }, include: { lead: true } })

/** حسابٌ بالبريد ثمّ توثيقُه برابطه — كما يقع لمن سجّل وفتح رسالته */
async function registerAndVerify(email: string, name: string) {
  const { userId } = await auth.register(email, 'Learner#12345', name)
  const issued = await auth.issueEmailVerification(userId)
  return { userId, verify: () => auth.verifyEmail(issued!.token) }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
  const m = await auth.register('link-manager@test.local', 'Manager#12345', 'مدير')
  managerId = m.userId
  await auth.setRoles(managerId, ['operations_manager'])
  const a = await auth.register('link-advisor@test.local', 'Advisor#12345', 'مستشار الربط')
  advisorId = a.userId
  await auth.setRoles(advisorId, ['advisor'])
}, 240_000)

describe('① التسجيلُ وحدَه لا يربط', () => {
  it('⚠️ حسابٌ بالبريد نفسِه — والحالةُ بلا صاحب حتّى يوثّق', async () => {
    await advisors.requestContactAsGuest({ fullName: 'زائر سيسجّل', email: 'guest.later@test.local', phone: '0791000001' })
    await registerAndVerify('guest.later@test.local', 'زائر سجّل')
    const kase = await caseByPhone('0791000001')
    expect(kase.clientId, 'رُبط ببريدٍ لم يُثبَت').toBeNull()
    expect(kase.lead!.userId).toBeNull()
  })
})

describe('② والتوثيقُ يربط', () => {
  it('⚠️ العميلُ المحتمل وحالتُه يلحقان الحساب — والمستشارُ يُبلَّغ والأثرُ يُكتب', async () => {
    await advisors.requestContactAsGuest({ fullName: 'زائر يوثّق', email: 'Verify.Me@Test.Local', phone: '0791000002' })
    const kase0 = await caseByPhone('0791000002')
    await advisors.assign(kase0.id, advisorId, managerId)

    const { userId, verify } = await registerAndVerify('verify.me@test.local', 'زائر وثّق')
    await verify()

    const kase = await caseByPhone('0791000002')
    expect(kase.clientId, 'لم تلحق الحالةُ صاحبَها بعد توثيقه').toBe(userId)
    expect(kase.lead!.userId).toBe(userId)

    const audit = await prisma.auditEvent.findFirst({ where: { action: 'advisor.case.client_linked', entityId: kase.id } })
    expect(audit?.actorId).toBe(userId)

    const bell = await prisma.notification.findFirst({ where: { userId: advisorId, templateKey: 'advisor.case.client_linked' } })
    expect(bell, 'لم يُبلَّغ المستشارُ المسنَد').not.toBeNull()
  })
})

describe('③ والأبوابُ الثلاثة سواء', () => {
  it('⚠️ توثيقُ الموظّف بيده يربط — والأثرُ باسمه', async () => {
    await advisors.requestContactAsGuest({ fullName: 'زائر بيد موظف', email: 'staff.verified@test.local', phone: '0791000003' })
    const { userId } = await auth.register('staff.verified@test.local', 'Learner#12345', 'زائر')
    await auth.verifyEmailByStaff(userId, managerId)
    const kase = await caseByPhone('0791000003')
    expect(kase.clientId).toBe(userId)
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'advisor.case.client_linked', entityId: kase.id } })
    expect(audit?.actorId).toBe(managerId)
  })

  it('⚠️ ورابطُ الاستعادة يُثبت البريد فيربط', async () => {
    await advisors.requestContactAsGuest({ fullName: 'زائر استعاد', email: 'reset.proves@test.local', phone: '0791000004' })
    const { userId } = await auth.register('reset.proves@test.local', 'Learner#12345', 'زائر')
    const { tokenForDelivery } = await auth.requestPasswordReset('reset.proves@test.local')
    await auth.resetPassword(tokenForDelivery!, 'NewPass#12345')
    expect((await caseByPhone('0791000004')).clientId).toBe(userId)
  })

  it('وعميلُ المستشار الذي أدخله بيده يلحق حسابَه كذلك', async () => {
    const own = await advisors.createOwnCase(advisorId, { fullName: 'من قابله', email: 'met.at.fair@test.local' })
    const { userId, verify } = await registerAndVerify('met.at.fair@test.local', 'من قابله')
    await verify()
    expect((await prisma.advisorCase.findUniqueOrThrow({ where: { id: own.id } })).clientId).toBe(userId)
  })
})

describe('④ ولا يُنقل ما له صاحب', () => {
  it('⚠️ حالةٌ لها صاحبُ حساب تبقى له — ولو وثّق غيرُه بريدا يطابق عميلَها', async () => {
    const owner = await auth.register('owner.account@test.local', 'Learner#12345', 'صاحب الحالة')
    await advisors.requestContactAsGuest({ fullName: 'زائر', email: 'shared.mail@test.local', phone: '0791000005' })
    const kase0 = await caseByPhone('0791000005')
    await prisma.advisorCase.update({ where: { id: kase0.id }, data: { clientId: owner.userId } })

    const { verify } = await registerAndVerify('shared.mail@test.local', 'آخر')
    await verify()
    expect((await caseByPhone('0791000005')).clientId, 'نُقلت حالةٌ من صاحبها').toBe(owner.userId)
  })

  it('وبريدٌ آخر لا يُربط به شيء', async () => {
    await advisors.requestContactAsGuest({ fullName: 'زائر', email: 'someone.else@test.local', phone: '0791000006' })
    const { verify } = await registerAndVerify('different.person@test.local', 'شخص آخر')
    await verify()
    expect((await caseByPhone('0791000006')).clientId).toBeNull()
  })
})

describe('⑤ و«طلابي» يرى طالبَه بعد الربط', () => {
  it('⚠️ المستشارُ المسنَد يقرأ تسجيلاتِه حين يسجّل في شعبة', async () => {
    await advisors.requestContactAsGuest({ fullName: 'طالب المستشار', email: 'my.learner@test.local', phone: '0791000007' })
    const kase = await caseByPhone('0791000007')
    await advisors.assign(kase.id, advisorId, managerId)
    const { userId, verify } = await registerAndVerify('my.learner@test.local', 'طالب المستشار')
    await verify()

    const course = await prisma.course.findFirstOrThrow({ where: { status: 'published' }, select: { id: true } })
    const cohort = await prisma.cohort.create({
      data: { courseId: course.id, title: 'شعبة الربط', status: 'open', capacity: 10, price: 100, currency: 'USD' },
    })
    await prisma.enrollment.create({ data: { cohortId: cohort.id, userId } })

    const mine = await new LearnersService(prisma).list({ kind: 'advisor', userId: advisorId })
    expect(mine.some((r) => r.user.id === userId), 'لا يراه المستشارُ في «طلابي» بعد ربطه').toBe(true)
  })
})

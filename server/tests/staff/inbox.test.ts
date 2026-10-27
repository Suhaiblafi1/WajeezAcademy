/* لوحُ «ما ينتظرك»: يجمع العملَ من الطوابير، ولا يعرض ما لا يملكه صاحبُه.

   الأصلُ في جولة ٢٠٢٦-٠٩: عشرونَ شاشةً وما ينتظر قرارا موزَّعٌ عليها، فمعرفةُ
   «أيَّ شاشةٍ أفتح» صارت شرطا للعمل. واللوحُ يُلغي هذا الشرط — بشرطَين:
   أن يكون محسوبا من الحقيقة لا من طابورٍ يبلى، وأن يُرشَّح بالصلاحيّات. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortService } from '../../services/cohort.service'
import { StaffInboxService } from '../../services/staff-inbox.service'
import { CohortPlanService } from '../../services/cohort-plan.service'
import { ROLE_PERMISSIONS } from '../../auth/permissions'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerSuggestionService } from '../../services/trainer-suggestion.service'
import { allSections, sectionsFor } from '../../../src/pages/admin/nav-map'

let prisma: PrismaClient
let inbox: StaffInboxService
let cohorts: CohortService
let managerId = ''
let learnerId = ''
let liveProfileId = ''
const COURSE = 'C-BIZ-101'
const permsOf = (role: string) => ROLE_PERMISSIONS[role] as readonly string[]

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  inbox = new StaffInboxService(prisma)
  cohorts = new CohortService(prisma)

  const m = await auth.register('inbox-manager@test.local', 'Manager#12345', 'مدير أكاديمي')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])
  const l = await auth.register('inbox-learner@test.local', 'Learner#12345', 'متعلّمُ اللوح')
  learnerId = l.userId
  await auth.setRoles(learnerId, ['learner'])
}, 240_000)

describe('اللوحُ يقول ما ينتظر فعلا', () => {
  it('لا يعرض بندا بعدّادٍ صفر — ولا يُختلَق عملٌ ليبدو مشغولا', async () => {
    const items = await inbox.forStaff(managerId, permsOf('academic_manager'))
    expect(items.filter((i) => i.count === 0)).toHaveLength(0)
  })

  it('ويُظهر مهمّةً أُسندت بالاسم، ويُعلّم المتأخّرةَ عاجلةً', async () => {
    await prisma.staffTask.create({
      data: {
        assigneeId: managerId, assignedBy: managerId, title: 'راجع طلبَ الشهادة',
        dueAt: new Date(Date.now() - 86_400_000), status: 'open',
      },
    })
    const items = await inbox.forStaff(managerId, permsOf('academic_manager'))
    const mine = items.find((i) => i.key === 'my_tasks')
    expect(mine?.count).toBe(1)
    expect(mine?.severity, 'ما فات موعدُه عاجل').toBe('urgent')
    expect(mine?.sample[0]).toContain('تأخّرت')
  })

  it('ويُظهر جلسةَ الأسبوع الناقصةَ مدرّبا أو رابطا — ولا يحسب المسودّة', async () => {
    const c = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةُ اللوح', capacity: 10, price: 100 })
    await cohorts.addSession(managerId, c.id, {
      title: 'جلسةُ الخطر',
      startsAt: new Date(Date.now() + 2 * 86_400_000),
      endsAt: new Date(Date.now() + 2 * 86_400_000 + 7_200_000),
    })
    await prisma.cohort.update({ where: { id: c.id }, data: { status: 'active' } })

    const items = await inbox.forStaff(managerId, permsOf('academic_manager'))
    const risk = items.find((i) => i.key === 'sessions_at_risk')
    expect(risk?.count).toBe(1)
    expect(risk?.severity).toBe('urgent')
    expect(risk?.sample[0]).toContain('بلا مدرّب')
    expect(risk?.sample[0]).toContain('بلا رابط')

    /* والمسودّةُ لا تُحسب: لا متعلّمَ فيها يُفاجَأ */
    const draft = await cohorts.create(managerId, { courseId: COURSE, title: 'مسودّةٌ بجلسة' })
    await cohorts.addSession(managerId, draft.id, {
      title: 'جلسةُ مسودّة',
      startsAt: new Date(Date.now() + 3 * 86_400_000),
      endsAt: new Date(Date.now() + 3 * 86_400_000 + 7_200_000),
    })
    const after = await inbox.forStaff(managerId, permsOf('academic_manager'))
    expect(after.find((i) => i.key === 'sessions_at_risk')?.count, 'المسودّةُ ليست خطرا').toBe(1)
  })

  /* «اقتراحاتُ تأجيلٍ تنتظر قرارك» ذهبت مع طابورها (٢٧ أكتوبر ٢٠٢٦، المرحلة السادسة — ج) — فاقتراحٌ قديمٌ
     بقي في الجدول لا يُعرض بندا لا يقرّره أحد */
  it('⚠️ واقتراحُ تأجيلٍ قديمٌ بقي في الجدول لا يصير بندا', async () => {
    const c = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةُ الاقتراح القديم' })
    const session = await cohorts.addSession(managerId, c.id, {
      title: 'جلسةٌ اقتُرح تأجيلها',
      startsAt: new Date(Date.now() + 10 * 86_400_000),
      endsAt: new Date(Date.now() + 10 * 86_400_000 + 7_200_000),
    })
    await prisma.sessionRescheduleRequest.create({
      data: {
        sessionId: session.id, requestedBy: managerId,
        currentStartsAt: session.startsAt,
        proposedStartsAt: new Date(Date.now() + 12 * 86_400_000),
        reason: 'سببٌ مكتوبٌ للإدارة',
      },
    })
    const items = await inbox.forStaff(managerId, permsOf('academic_manager'))
    expect(items.map((i) => i.key)).not.toContain('reschedules')
  })

  /* ═══ وخططُ الشعب المرسَلة (٣ أكتوبر ٢٠٢٦) ═══
     كانت تُعتمَد من بطاقة كلّ شعبةٍ وحدَها، ولا بندَ يقول إنّ أحدا ينتظر: لا يُفتح
     تسجيلُ الشعبة قبلها، ومدرّبُ الإعداد لا يُفعَّل حتّى تُعتمَد خططُه. */
  it('ويُظهر خطّةَ شعبةٍ مرسَلةً بشعبتها ومدرّبها — وبابُها شاشتُها الواحدة', async () => {
    const c = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةُ الخطّة المرسَلة' })
    const app = await prisma.trainerApplication.create({
      data: {
        reference: `TR-INBOX-${Date.now()}`, fullName: 'مدرّبُ اللوح', email: `inbox-trainer-${Date.now()}@test.local`,
        status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
      },
    })
    /* مدرّبٌ قائمٌ بحسابٍ موصول — فالطابورُ لا يعدّ ملفّا بلا حساب (#426) */
    const account = await new AuthService(prisma).register(`inbox-trainer-user-${Date.now()}@test.local`, 'Trainer#12345', 'مدرّبُ اللوح')
    const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id, userId: account.userId } })
    liveProfileId = profile.id
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId: c.id, trainerId: profile.id, status: 'submitted', submittedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] } },
    })
    const items = await inbox.forStaff(managerId, permsOf('academic_manager'))
    const plans = items.find((i) => i.key === 'cohort_plans')
    expect(plans?.count).toBe(1)
    expect(plans?.href).toBe('/admin/pending-plans')
    expect(plans?.sample).toEqual(['شعبةُ الخطّة المرسَلة — مدرّبُ اللوح · أرسلت اليوم'])
  })

  /* ═══ وما لا صاحبَ له لا يُعدّ (٣ أكتوبر ٢٠٢٦) ═══
     علّم #426 الطابورَ وشارتَه ألّا يعدّا خطّةَ مدرّبٍ حُذف أو شعبةٍ أُلغيت، وبقي
     هذا البندُ يعدّ كلَّ `submitted`: يقول اللوحُ «٣» والطابورُ «١». فالحارسُ
     يقيس البندَ بالطابور نفسِه، لا برقمٍ يُكتب بيد. */
  it('⚠️ ولا يعدّ خطّةً بلا صاحبٍ يعمل — عدُّه عدُّ الطابور نفسِه', async () => {
    /* ① خطّةُ مدرّبٍ فُكّ حسابُه بالحذف — وشعبتُها مسوّدةٌ باقية */
    const gone = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةُ مدرّبٍ حُذف' })
    const app = await prisma.trainerApplication.create({
      data: {
        reference: `TR-INBOX-GONE-${Date.now()}`, fullName: 'مدرّبٌ حُذف', email: `inbox-gone-${Date.now()}@test.local`,
        status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
      },
    })
    const unlinked = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId: gone.id, trainerId: unlinked.id, status: 'submitted', submittedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] } },
    })
    /* ② وخطّةُ مدرّبٍ قائمٍ في شعبةٍ أُلغيت */
    const cancelled = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةٌ أُلغيت' })
    await prisma.cohort.update({ where: { id: cancelled.id }, data: { status: 'cancelled' } })
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId: cancelled.id, trainerId: liveProfileId, status: 'submitted', submittedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] } },
    })

    const plans = (await inbox.forStaff(managerId, permsOf('academic_manager'))).find((i) => i.key === 'cohort_plans')
    expect(plans?.count).toBe(await new CohortPlanService(prisma).pendingCount())
    expect(plans?.count).toBe(1)
    expect(plans?.sample).toEqual(['شعبةُ الخطّة المرسَلة — مدرّبُ اللوح · أرسلت اليوم'])
  })

  /* ═══ وكم تنتظر — والبطيئةُ تعلو (٢٦ أكتوبر ٢٠٢٦، المرحلة الخامسة، `waitingAr`) ═══
     «الجولةُ ووقتُ الانتظار في الأعلى، فتظهر المراجعةُ البطيئةُ في «اليوم»» (خطّة لوحة الإدارة، ٣د). والوقتُ يُقدَّم
     بالساعة لا بخطّةٍ أقدم — فلا تتغيّر أعدادُ ما قبله. */
  it('⚠️ كلُّ سطرٍ بانتظاره — وأقدمُها ثلاثةَ أيّامٍ فأكثر يجعل البندَ عاجلا ويقول كم', async () => {
    const at = (days: number) => new Date(Date.now() + days * 86_400_000)
    const slow = (await inbox.forStaff(managerId, permsOf('academic_manager'), at(5))).find((i) => i.key === 'cohort_plans')!
    expect(slow.severity).toBe('urgent')
    expect(slow.whyAr).toMatch(/^أقدمها تنتظر منذ 5 أيام/)
    expect(slow.sample).toEqual(['شعبةُ الخطّة المرسَلة — مدرّبُ اللوح · تنتظر منذ 5 أيام'])
    const fresh = (await inbox.forStaff(managerId, permsOf('academic_manager'), at(2))).find((i) => i.key === 'cohort_plans')!
    expect(fresh.severity, 'يومان ليسا بطيئين').toBe('attention')
    expect(fresh.sample).toEqual(['شعبةُ الخطّة المرسَلة — مدرّبُ اللوح · تنتظر منذ يومين'])
  })

  it('والأعجلُ أوّلا — ترتيبُ القائمة هو ترتيبُ العمل', async () => {
    const items = await inbox.forStaff(managerId, permsOf('academic_manager'))
    const weight = { urgent: 0, attention: 1, info: 2 } as const
    const order = items.map((i) => weight[i.severity])
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
})

describe('ولا يعرض لأحدٍ ما لا يملك صلاحيّتَه', () => {
  it('المالية لا ترى طلباتِ نقل الشعب ولا الجلساتِ ولا طابورَ المحتوى', async () => {
    const keys = (await inbox.forStaff(managerId, permsOf('finance'))).map((i) => i.key)
    expect(keys).not.toContain('cohort_moves')
    expect(keys).not.toContain('sessions_at_risk')
    expect(keys).not.toContain('content_review')
  })

  it('والدعمُ لا يرى الشعبَ، ويرى تذاكرَه', async () => {
    await prisma.supportTicket.create({
      data: { userId: learnerId, subject: 'رابطُ الجلسة لا يعمل', category: 'technical', status: 'open' },
    })
    const support = await inbox.forStaff(managerId, permsOf('support'))
    expect(support.map((i) => i.key)).not.toContain('cohort_moves')
    expect(support.find((i) => i.key === 'support')?.count).toBe(1)
  })

  /* المنسّقُ يدير الشعبَ ولا يعتمد خططَها (`cohort.plan.approve` ليست له) */
  it('والمنسّقُ لا يرى الخططَ المرسَلة — يراها من يعتمدها', async () => {
    const keys = (await inbox.forStaff(managerId, permsOf('academic_coordinator'))).map((i) => i.key)
    expect(keys).not.toContain('cohort_plans')
    expect((await inbox.forStaff(managerId, permsOf('academic_manager'))).map((i) => i.key)).toContain('cohort_plans')
  })

  it('ومن لا صلاحيّةَ له أصلا يرى مهامَّه المسندةَ وحدَها', async () => {
    const items = await inbox.forStaff(managerId, [])
    expect(items.map((i) => i.key)).toEqual(['my_tasks'])
  })
})

/* «أبقِ ظاهرا للإدارة أنّ جددا ينتظرونه» (٢٠ أكتوبر ٢٠٢٦) — والعدُّ عدُّ حزمة الملفّات نفسِها.
   ورُئي ساقطا حين أُسقط البندُ من اللوح، وحين عُدّ من وصله اقتراح. */
describe('ومن ينتظر أن نكتب له «لماذا نفتخر» ونبذتَه', () => {
  const NAME = 'مدرّب ينتظر اقتراحا'
  let profileId = ''

  beforeAll(async () => {
    profileId = (await new TrainerReviewService(prisma)
      .createTrainerDirectly(managerId, { fullName: NAME, email: 'inbox-suggest@test.local' })).profileId
    await prisma.trainerCourseQualification.create({ data: { profileId, courseId: COURSE, status: 'qualified' } })
  })

  it('⚠️ مدرّبٌ له دورة معتمدة ولم يُكتب له — يظهر باسمه لمن يقرأ الطلبات وحده', async () => {
    const item = (await inbox.forStaff(managerId, ['trainer.applications.view'])).find((i) => i.key === 'trainer_suggestions_to_write')
    expect(item?.sample, 'لا يظهر من ينتظر').toContain(NAME)
    expect(item?.href).toBe('/admin/trainer-run')
    expect((await inbox.forStaff(managerId, ['cohort.manage'])).map((i) => i.key)).not.toContain('trainer_suggestions_to_write')
  })

  it('⚠️ وما إن يُقترح عليه يغيب', async () => {
    await new TrainerSuggestionService(prisma).propose(profileId, managerId, 'pitch', ['سطر أرسلناه'])
    const item = (await inbox.forStaff(managerId, ['trainer.applications.view'])).find((i) => i.key === 'trainer_suggestions_to_write')
    expect(item?.sample ?? [], 'بقي من وصله اقتراح').not.toContain(NAME)
  })
})

/* ═══ وكلُّ بندٍ يفتح شاشةً يراها صاحبُه — بصلاحيّاته هو (٢٤ أكتوبر ٢٠٢٦) ═══

   كان «طلبات تسجيل تنتظر مراجعة» يفتح «حالات بلا مستشار» (`/admin/exceptions`، وصلاحيّتُها `advisor.assign`): فالمنسّقُ
   الأكاديميُّ يصل شاشةً تردّه، ومديرُ العمليّات يصل طابورا غيرَ طابوره. والطابورُ لسانُ «طلبات التسجيل» في
   `/admin/finance` — وإليها يذهب عدّادُ الرئيسية. ظهر في دراسة لوحة الإدارة.

   والحارسُ عامٌّ لا للبند وحدَه: ما يظهر لدورٍ يفتح شاشةً في قائمته هو (`sectionsFor`). */
describe('كلّ بند يفتح شاشة يراها صاحبه', () => {
  const STAFF = ['academic_manager', 'academic_coordinator', 'operations_manager', 'diagnostic_manager', 'finance', 'support']

  beforeAll(async () => {
    const cohort = await prisma.cohort.create({ data: { courseId: COURSE, title: 'شعبة طلبات التسجيل' } })
    await prisma.enrollmentRequest.create({ data: { userId: learnerId, cohortId: cohort.id, status: 'pending' } })
  })

  it('⚠️ طلبات التسجيل تفتح الشاشة التي تحرسها صلاحيتها', async () => {
    const item = (await inbox.forStaff(managerId, permsOf('academic_coordinator'))).find((i) => i.key === 'enrollment_requests')
    expect(item, 'لا يظهر طلب التسجيل للمنسق').toBeTruthy()
    const screen = allSections.flatMap((s) => s.items).find((s) => s.to === item!.href.split('?')[0])
    expect(screen, `${item!.href} ليست شاشة في القائمة`).toBeTruthy()
    expect([screen!.need].flat(), `${item!.href} لا تحرسها صلاحية طلبات التسجيل`).toContain('enrollment.request.review')
  })

  it('⚠️ ولكل دور: ما يظهر له يفتح شاشة في قائمته', async () => {
    for (const role of STAFF) {
      const perms = permsOf(role)
      const reachable = new Set(sectionsFor(perms).flatMap((s) => s.items.map((i) => i.to)))
      for (const item of await inbox.forStaff(managerId, perms)) {
        const path = item.href.split('?')[0]
        expect(reachable.has(path), `${role}: «${item.titleAr}» يفتح ${path} وليست في قائمته`).toBe(true)
      }
    }
  })
})

/* ═══ وعقودٌ وقّعها أصحابُها تنتظر ختمَك (٢٤ أكتوبر ٢٠٢٦) ═══

   كانت شارةً على «العقود» وحدَها ولا بندَ لها هنا. فلمّا صار عددُ «اليوم» في سكّة الإدارة يجمع ما
   ينتظرك كلَّه، قال اللوحُ عددا وقالت السكّةُ غيرَه بعدد العقود. والعدُّ عدُّ الشارة نفسِه. */
describe('وعقود موقعة تنتظر ختمك', () => {
  beforeAll(async () => {
    const email = `inbox-signed-${Date.now()}@test.local`
    const user = await prisma.user.create({ data: { email, displayName: 'مدرب وقع', passwordHash: 'x' } })
    const application = await prisma.trainerApplication.create({
      data: { reference: `TR-INBOX-${Date.now()}`, fullName: 'مدرب وقع', email, status: 'contract_pending', userId: user.id },
    })
    const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: user.id } })
    await prisma.trainerContract.create({ data: { profileId: profile.id, title: 'عقد ينتظر الختم', status: 'signed' } })
  })

  it('⚠️ تعدّ كما تعدّها شارة «العقود» — وتفتح «العقود»', async () => {
    const item = (await inbox.forStaff(managerId, permsOf('academic_manager'))).find((i) => i.key === 'contracts_to_countersign')
    const badge = await new TrainerReviewService(prisma).countAwaitingCountersign()
    expect(badge.count).toBeGreaterThan(0)
    expect(item?.count, 'لا بند للعقود الموقعة — أو عدده غير عدد الشارة').toBe(badge.count)
    expect(item?.href).toBe('/admin/trainer-contracts')
    expect(item?.sample.some((s) => s.startsWith('مدرب وقع — '))).toBe(true)
  })

  it('ولا يراها من لا يملك العقود', async () => {
    const items = await inbox.forStaff(managerId, permsOf('academic_coordinator'))
    expect(items.some((i) => i.key === 'contracts_to_countersign')).toBe(false)
  })
})

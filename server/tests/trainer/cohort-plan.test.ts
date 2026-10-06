/* الشعبةُ ملكُ مدرّبها — يجهّزها ويقول «أوافق»، والإدارةُ تعتمد.

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦). وهذا الملفّ يحرس الحلقةَ كاملةً:
   ١) المدرّبُ يعدّل اسمَ شعبته ويحفظ محاورَها ومصادرَها — ويردّ السعرُ باسمه.
   ٢) ولا يُرسل بلا تأكيد، ويُرسل بتأكيدٍ فتصير `submitted`.
   ٣) والردُّ بتعديلاتٍ يحتاج نصّا، ويعيدها إليه بالنصّ.
   ٤) والاعتمادُ يجعلها `approved` — فتوفي شرطَ فتح الشعبة الخامس.
   ٥) ومدرّبٌ آخرُ لا يبلغها: ٤٠٣ لا ٤٠٤.
   ٦) والتسجيلُ يُضاف من رابطٍ بلا ملفّ.
   ٧) ومدّةُ الشعبة له (٢٧ سبتمبر ٢٠٢٦): تُحفظ في الخطّة فتفتح نافذتَه لحظتَها،
      وتُردّ من بابها الخلفيّ، وبالاعتماد تصير حدودَ الشعبة ويُشتقّ فصلُها. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { blockingBeforeSubmit, trainerOwned } from '../../../src/application/trainer/plan-gate'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService, type AvailabilityInput } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CohortPlanService, staticModulesFor, type TrainerPlanContent } from '../../services/cohort-plan.service'
import { CohortService } from '../../services/cohort.service'
import { makeReadyForApproval } from '../helpers/trainer-ready'
import { periodBounds } from '../../../src/application/trainer/cohort-period'
import { sinceReturn } from '../../../src/application/trainer/plan-diff'
import { fmtDateWith } from '../../../src/application/text/format-ar'

let prisma: PrismaClient
let plans: CohortPlanService
let adminId = ''
let trainerUserId = ''
let otherTrainerUserId = ''
let cohortId = ''
let termId = ''

const phase1 = (email: string, name: string) => ({
  fullName: name, email, country: 'الأردن', timezone: 'Asia/Amman',
  phoneCountryCode: '+962', phone: '790000002',
  specialties: ['تحليل البيانات والمالية'], domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم.',
  privacyConsent: true as const, password: 'Trainer#12345',
})

async function approvedTrainer(auth: AuthService, apps: TrainerApplicationService, review: TrainerReviewService, email: string, name: string) {
  const res = await apps.submitPhase1(phase1(email, name))
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: ['C-BIZ-101'],
    availability: { seasons: ['nov_jan'] } as AvailabilityInput, demoConsent: true as const, contact: { channel: 'email' },
  })
  const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await review.decide(app.id, adminId, 'move_to_review')
  await makeReadyForApproval(prisma, app.id, adminId)
  await review.decide(app.id, adminId, 'approve')
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: app.id } })
  void auth
  return { userId: app.userId!, profileId: profile.id }
}

/* مدّةُ الشعبة كما يحدّدها مدرّبُها (٢٧ سبتمبر ٢٠٢٦) — في مستقبلٍ لا يمضي */
const PERIOD = { startsOn: '2027-02-01', endsOn: '2027-04-30' }

const content: TrainerPlanContent = {
  kind: 'trainer',
  summaryAr: 'شعبةٌ تطبيقيّة — كلُّ وحدةٍ تنتهي بمهمّةٍ من واقع العمل',
  ...PERIOD,
  /* والمتنُ مكتوبٌ بقصد: صار «المحتوى النظريّ» شرطا لتمام مرحلة المحاور
     (د-١، ١٣ سبتمبر ٢٠٢٦)، وهذه الخطّةُ تمثّل مسودّةً **مكتملة** — فلو
     تُركت بلا متنٍ لاختبرت نقصا لا اكتمالا. */
  modules: [{
    moduleId: 'C-BIZ-101-M1', titleAr: 'المحور الأوّل — كما يراه المدرّب',
    activityAr: 'تطبيقٌ عمليٌّ على بياناتٍ حقيقيّة',
    bodyAr: 'الشرحُ المكتوب الذي يقرؤه المتعلّمُ داخل المنصّة قبل اللقاء الأوّل، وفيه ما يكفي ليبدأ.',
  }],
  resources: [{ title: 'كرّاسة الوحدة الأولى', url: 'https://example.com/unit-1.pdf' }],
  /* ومنذ صار للمحاور مواعيدُ (٢٧ سبتمبر ٢٠٢٦) فالمسودّةُ المكتملةُ مكتملةٌ بها:
     محورُها الواحدُ في موعدٍ يملأ المدّةَ، وله كرّاستُه */
  slots: [{ startsOn: PERIOD.startsOn, endsOn: PERIOD.endsOn, moduleIds: ['C-BIZ-101-M1'] }],
  /* وكرّاسةُ الدورة الواحدة وموضعُ محورها فيها (٣٠ سبتمبر ٢٠٢٦) */
  /* وإقرارُ قالب وجيز — المدرّبُ هنا جديد (٦ أكتوبر ٢٠٢٦) */
  workbook: { url: 'https://example.com/workbook.pdf', parts: [{ moduleId: 'C-BIZ-101-M1', whereAr: 'ص 1' }], onTemplate: true },
  /* ومستواها — شرطُ الخطوة الأولى ما دامت الخطّةُ في يده (٦ أكتوبر ٢٠٢٦) */
  level: { from: 'beginner', to: 'intermediate' },
  /* ولمن هي وماذا يريد متعلّمُها — شرطُها كذلك (٦ أكتوبر ٢٠٢٦) */
  audience: { stages: ['early_career', 'experienced'], goals: ['practical_skills'] },
}

describe('ملكيّةُ الشعبة واعتمادُها', () => {
  beforeAll(async () => {
    await setupTestDb()
    prisma = await testPrisma()
    const auth = new AuthService(prisma)
    const apps = new TrainerApplicationService(prisma)
    const review = new TrainerReviewService(prisma)
    plans = new CohortPlanService(prisma)
    const admin = await auth.register('admin-cohort-plan@test.local', 'Admin#12345', 'المدير الأكاديمي')
    adminId = admin.userId
    await auth.setRoles(adminId, ['academic_manager'])

    const t1 = await approvedTrainer(auth, apps, review, 'trainer-plan-owner@test.local', 'مدرب صاحب الشعبة')
    const t2 = await approvedTrainer(auth, apps, review, 'trainer-plan-other@test.local', 'مدرب آخر')
    trainerUserId = t1.userId; otherTrainerUserId = t2.userId

    const cohort = await prisma.cohort.create({ data: { courseId: 'C-BIZ-101', title: 'شعبة الاختبار', status: 'draft', price: 120, currency: 'USD' } })
    cohortId = cohort.id
    await prisma.cohortTrainer.create({ data: { cohortId, profileId: t1.profileId, role: 'lead', assignedBy: adminId } })
  })

  /* ═══ وما «لم يتمّ» في شعبةٍ وُلدت للتوّ ═══

     كان: «الاسمُ وحدَه تمّ لأنّها وُلدت به»، والفصلُ في صفٍّ يسمّي فاعلَه
     (الإدارة). ثمّ صارت المدّةُ للمدرّب (٢٧ سبتمبر ٢٠٢٦) فانقلب: الهُويّةُ
     اسمٌ **ومدّة**، والشعبةُ تُولد بلا مدّة — فصفُّها ينتظره، ولا صفَّ للفصل.
     والمحروسُ الأصليُّ باقٍ: لا يُكتب «لم يتمّ» على ما ليس بيده — والمدّةُ
     بيده. */
  it('الورشةُ تقول ما بقي — والهُويّةُ تنتظر مدّتَه، ولا صفَّ للفصل', async () => {
    const ws = await plans.workspace(trainerUserId, cohortId)
    expect(ws.plan).toBeNull()
    expect(ws.cohort.readOnly.price).toBe(120)
    expect(ws.course.baseModules.length).toBeGreaterThan(0)
    expect(ws.cohort.period, 'مدّةٌ لم يحدّدها أحد').toBeNull()

    const byKey = new Map(ws.checklist.map((c) => [c.key, c]))
    expect(byKey.get('identity')!.done, 'تمّت الهُويّةُ بلا مدّة').toBe(false)
    expect(byKey.get('term'), 'عاد صفُّ الفصل بيد الإدارة').toBeUndefined()

    const rest = ws.checklist.filter((c) => !c.optional)
    expect(rest.every((c) => !c.done), 'عُدَّ تامًّا ما لم يُعمَل بعد').toBe(true)
  })

  /* ═══ صفحةُ الشعبة الواحدة (٨ سبتمبر ٢٠٢٦) ═══ */
  /* ═══ نُقض بقرارٍ لا بتنازل (ق٨ · ١٧ سبتمبر ٢٠٢٦) ═══
     كان العنوانُ «اختياريّةٌ، وتتمّ بأوّل تكليف». وقرارُ صاحب المنصّة أن
     تحجب: «لا تكون المحاضرةُ إلزاميّةً والمُخرَجُ اختياريّا». */
  it('⚠️ والمهامُّ مرحلةٌ في التجهيز — وصارت شرطا يحجب', async () => {
    const before = (await plans.workspace(trainerUserId, cohortId)).checklist.find((c) => c.key === 'assignments')
    expect(before, 'لا مرحلةَ للمهامّ').toBeTruthy()
    expect(before!.optional, 'عادت المهامُّ اختياريّةً').toBe(false)
    expect(before!.done).toBe(false)
    await prisma.cohortAssessment.create({ data: { cohortId, title: 'واجبُ الوحدة الأولى', type: 'assignment', maxScore: 100 } })
    const ws = await plans.workspace(trainerUserId, cohortId)
    expect(ws.assessments.map((a) => a.title)).toContain('واجبُ الوحدة الأولى')
    /* ═══ ومنذ صار للمهمّة محورٌ تُفتح بعد لقائه (٢٧ سبتمبر ٢٠٢٦) ═══
       لا تُتمّ المرحلةَ مهمّةٌ لا يُعرف محورُها — ويُقال ذلك في سطرها. وتتمّ
       حين تُربط بمحورٍ في الخطّة (الحالةُ التي تلي الحفظ). */
    const row = ws.checklist.find((c) => c.key === 'assignments')!
    expect(row.done, 'تمّت المرحلةُ بمهمّةٍ بلا محور').toBe(false)
    expect(row.labelAr).toContain('غيرُ مربوطةٍ بمحور')
  })

  it('وموجزُ «شعبي» يقرأ القائمةَ نفسَها — فلا تفترق الحلقةُ عن الورشة', async () => {
    const rows = await plans.summaries(trainerUserId)
    const me = rows.find((r) => r.id === cohortId)
    expect(me, 'الشعبةُ ليست في الموجز').toBeTruthy()
    const ws = await plans.workspace(trainerUserId, cohortId)
    /* و«الاعتماد» خارجَ العدّ في الموضعَين معا (١٥ سبتمبر ٢٠٢٦): البطاقةُ
       تعدّ ما **يملك المدرّبُ إنجازَه**، ولا يملك قرارَ الإدارة. وكان
       يُعَدّ فيهما، فبطاقةُ شعبةٍ تامّةٍ تقول «٥ من ٦» أبدا.

       والمحروسُ هو هو: أن تقول البطاقةُ ما تقوله الورشة. فالقاعدةُ واحدةٌ
       هنا وهناك — ولو استُثني في أحدهما وحدَه لافترق الرقمان.

       ⚠️ ولذلك تُقرأ من `plan-gate` ولا تُكتب بيدٍ هنا: كان الاستثناءُ
       مكتوبا في هذا السطر (`key !== 'approval'`)، فلمّا صار صفُّ الفصل
       كصفِّ الاعتماد — يحجب الإرسالَ ولا يُعدّ على المدرّب — قال الاختبارُ
       خمسةً وقالت الخدمةُ أربعة. ونسختان من قاعدةٍ واحدةٍ تفترقان. */
    const required = trainerOwned(ws.checklist).filter((c) => !c.optional)
    expect(me!.total).toBe(required.length)
    expect(me!.done).toBe(required.filter((c) => c.done).length)

    /* و«التالي» ليس أوّلَ ما بقي عليه: هو أوّلُ ما يقف دونه الإرسالُ —
       وقد يكون بيدِ الإدارة. فشعبةٌ لم يُسمَّ فصلُها تقول بطاقتُها «التالي:
       تسمّي الإدارةُ فصلَ الشعبة» لا «اكتب المحاور» — وإلّا ساقته البطاقةُ
       إلى عملٍ بابُه مغلقٌ حتّى تُفتح الشعبة. */
    expect(me!.next?.key).toBe(blockingBeforeSubmit(ws.checklist)[0]!.key)
    /* والتالي أوّلُ ما بيده الآن: مدّتُه — لا فصلٌ ينتظر أن تسمّيه الإدارة */
    expect(me!.next?.key, 'بطاقةُ شعبةٍ بلا مدّةٍ لا تقول ما ينقصها').toBe('identity')
    /* ومدرّبٌ آخرُ لا يرى شعبةَ غيره في موجزه */
    expect((await plans.summaries(otherTrainerUserId)).map((r) => r.id)).not.toContain(cohortId)
  })

  it('ومحاورُ الكتالوج الثابت تسند الورشةَ حين تخلو القاعدة', async () => {
    const mods = await staticModulesFor('C-AI-103')
    expect(mods.length).toBe(4)
    expect(mods[0].moduleId).toBe('C-AI-103-M1')
    expect(mods.every((m) => m.titleAr.length > 2)).toBe(true)
    expect(await staticModulesFor('C-NOPE-000')).toEqual([])
  })

  it('يعدّل الاسمَ — والسعرُ يُردّ باسمه لا يُبتلع', async () => {
    await plans.updateCohort(trainerUserId, cohortId, { title: 'شعبة الكتابة بالذكاء الاصطناعي — الدفعة الأولى' })
    const row = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } })
    expect(row.title).toContain('الدفعة الأولى')
    await expect(plans.updateCohort(trainerUserId, cohortId, { title: 'x'.repeat(5), price: 1 }))
      .rejects.toMatchObject({ code: 'admin_only_field' })
    const after = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } })
    expect(Number(after.price)).toBe(120)
  })

  /* ═══ والبابُ الخلفيُّ إلى المواعيد أُغلق (٢٧ سبتمبر ٢٠٢٦) ═══
     كان المدرّبُ يكتب البدءَ والانتهاءَ على الشعبة مباشرةً — فتصل المسجَّلين
     بلا اعتماد. وصارت المدّةُ في الخطّة تُعتمَد معها، فالمفتاحُ يُردّ باسمه. */
  it('⚠️ ولا يكتب مواعيدَ الشعبة مباشرةً — تُردّ باسمها وتُحال إلى الخطّة', async () => {
    await expect(plans.updateCohort(trainerUserId, cohortId, { startsAt: new Date('2027-02-01') }))
      .rejects.toMatchObject({ code: 'period_in_plan' })
    await expect(plans.updateCohort(trainerUserId, cohortId, { title: 'اسمٌ جديدٌ صالح', daysOfWeek: ['sun'] }))
      .rejects.toMatchObject({ code: 'period_in_plan' })
    const row = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } })
    expect(row.startsAt, 'كُتب البدءُ من البابِ الخلفيّ').toBeNull()
  })

  it('ومدرّبٌ آخرُ لا يبلغها — ٤٠٣', async () => {
    await expect(plans.workspace(otherTrainerUserId, cohortId)).rejects.toMatchObject({ code: 'not_your_cohort' })
  })

  /* ═══ والمدّةُ تُفحص عند الحفظ — والناقصُ لا يُحفظ نصفا ═══ */
  it('⚠️ ومدّةٌ فاسدةٌ أو ناقصةٌ تُردّ بلغة من يصحّحها — ولا تُفتح بها نافذة', async () => {
    await expect(plans.savePlan(trainerUserId, cohortId, { ...content, startsOn: '2027-04-30', endsOn: '2027-02-01' }))
      .rejects.toMatchObject({ code: 'bad_period' })
    await expect(plans.savePlan(trainerUserId, cohortId, { ...content, endsOn: null }))
      .rejects.toMatchObject({ code: 'bad_period' })
    await expect(plans.savePlan(trainerUserId, cohortId, { ...content, startsOn: '2020-01-05', endsOn: '2020-02-05' }))
      .rejects.toMatchObject({ code: 'bad_period', message: expect.stringContaining('مضى') })
    const row = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } })
    expect(row.scheduleWindowStart, 'فُتحت نافذةٌ بمدّةٍ مردودة').toBeNull()
  })

  it('يحفظ المحاورَ والمصادرَ مسودّةً، فتُقفل بنودُها في القائمة', async () => {
    const plan = await plans.savePlan(trainerUserId, cohortId, content)
    expect(plan.status).toBe('draft')

    /* ═══ ونافذتُه تتبع مدّتَه لحظةَ الحفظ — والحدودُ المعلَنةُ لا تُمَسّ ═══ */
    const { from, to } = periodBounds(PERIOD)
    const row = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } })
    expect(row.scheduleWindowStart?.toISOString(), 'النافذةُ لا تتبع المدّة').toBe(from.toISOString())
    expect(row.scheduleWindowEnd?.toISOString()).toBe(to.toISOString())
    expect(row.startsAt, 'كُتبت الحدودُ المعلَنةُ قبل الاعتماد').toBeNull()
    const saved = await plans.workspace(trainerUserId, cohortId)
    expect(saved.checklist.find((c) => c.key === 'identity')?.done, 'اسمٌ ومدّةٌ لم يُتمّا الهُويّة').toBe(true)
    const ws = await plans.workspace(trainerUserId, cohortId)
    expect(ws.checklist.find((c) => c.key === 'modules')?.done).toBe(true)
    /* ⚠️ ولو غاب المتنُ لم تتمّ المرحلةُ — والحفظُ يمرّ على أيّ حال (د-١) */
    const bare = { ...content, modules: content.modules.map((m) => ({ ...m, bodyAr: '' })) }
    const draft = await plans.savePlan(trainerUserId, cohortId, bare)
    expect(draft.status, 'نقصُ المتن منع الحفظَ — وهو يمنع الاعتمادَ وحدَه').toBe('draft')
    const after = await plans.workspace(trainerUserId, cohortId)
    expect(after.checklist.find((c) => c.key === 'modules')?.done, 'مرحلةُ المحاور تمّت بلا متن').toBe(false)
    await plans.savePlan(trainerUserId, cohortId, content)
    expect(ws.checklist.find((c) => c.key === 'resources')?.done).toBe(true)
    expect(ws.checklist.find((c) => c.key === 'approval')?.done).toBe(false)
    /* والمهمّةُ التي أُنشئت بلا محورٍ تُتمّ مرحلتَها حين تُربط بمحور الخطّة */
    await prisma.cohortAssessment.updateMany({ where: { cohortId, moduleId: null }, data: { moduleId: content.modules[0].moduleId } })
    const linked = await plans.workspace(trainerUserId, cohortId)
    expect(linked.checklist.find((c) => c.key === 'assignments')?.done, 'مهمّةٌ مربوطةٌ لم تُتمّ مرحلتَها').toBe(true)
  })

  /* ═══ ما صار الإرسالُ يشترطه (١٥ سبتمبر ٢٠٢٦) ═══

     `submit` صار يحتجّ بقائمة المراحل نفسِها التي تُطفئ الزرَّ في الشاشة —
     وكان يقبل ما تطفئه، فالحاجزُ زرٌّ لا بوّابة. فالشعبةُ لا تُرسَل حتّى
     يكون لها **فصلٌ** (منه حدودُها) و**لقاءٌ لكلّ محورٍ على الأقلّ**.

     وهذه الشعبةُ أُنشئت بلا فصلٍ ولا لقاء — وهو ما كان يكفي قبل القرار.
     فتُجهَّز هنا كما يجهّزها مدرّبُها في الشاشة، ثمّ تُرسَل. والمحروسُ لم
     يتبدّل: لا إرسالَ بلا تأكيد، وبتأكيدٍ تصير بانتظار الاعتماد. */
  const makeSubmittable = async () => {
    const term = await prisma.term.upsert({
      where: { year_season: { year: 2027, season: 'feb_apr' } },
      update: {},
      create: {
        year: 2027, season: 'feb_apr', titleAr: 'فصلُ الاختبار',
        startsOn: new Date('2027-02-01'), endsOn: new Date('2027-04-30'), status: 'open',
      },
    })
    termId = term.id
    /* والفصلُ لا يُسمّى هنا بيدٍ بعد اليوم (٢٧ سبتمبر ٢٠٢٦): يُشتقّ من تاريخ
       البدء عند الاعتماد — والاختبارُ الذي يليه يقيس أنّه اشتُقّ فعلا. */
    /* لقاءٌ لكلّ محورٍ في الخطّة — والخطّةُ محورٌ واحد، وداخلَ موعده.
       ومنذ صار اللقاءُ مربوطا بمحوره (٢٧ سبتمبر ٢٠٢٦) يُربط هنا كما يربطه
       مدرّبُه في بطاقة موعده — وما أُنشئ قبلُ بلا محورٍ يُربط كذلك. */
    const first = content.modules[0].moduleId
    await prisma.cohortSession.updateMany({ where: { cohortId, moduleIds: { isEmpty: true } }, data: { moduleIds: [first], moduleId: first } })
    const have = await prisma.cohortSession.count({ where: { cohortId } })
    for (let i = have; i < content.modules.length; i += 1) {
      await prisma.cohortSession.create({
        data: {
          cohortId, title: `لقاءُ المحور ${i + 1}`, startsAt: new Date(`2027-02-${String(i + 3).padStart(2, '0')}T15:00:00.000Z`),
          moduleIds: [content.modules[i].moduleId], moduleId: content.modules[i].moduleId,
        },
      })
    }
    /* والمهمّةُ مربوطةٌ بمحورها كذلك — ومنه متى تُفتح */
    await prisma.cohortAssessment.updateMany({ where: { cohortId, moduleId: null }, data: { moduleId: first } })
    /* ومهمّةٌ واحدةٌ على الأقلّ — صارت شرطا (ق٨). وتُنشأ هنا إن لم تكن:
       الحالةُ التي تسبقها تُنشئ واحدةً، والاتّكالُ على أثرِ حالةٍ أخرى
       يجعل هذه تسقط إن سقطت تلك — وهو ما وقع فعلا. */
    if ((await prisma.cohortAssessment.count({ where: { cohortId } })) === 0) {
      await prisma.cohortAssessment.create({
        data: { cohortId, title: 'مهمّةُ الإرسال', type: 'assignment', maxScore: 100, moduleId: first },
      })
    }
    /* ومشروعُ التخرّج — صار صفّا إلزاميّا (٣٠ سبتمبر ٢٠٢٦) */
    if ((await prisma.cohortAssessment.count({ where: { cohortId, type: 'project' } })) === 0) {
      await prisma.cohortAssessment.create({
        data: { cohortId, title: 'مشروعُ التخرّج', type: 'project', maxScore: 100, moduleId: first },
      })
    }
  }

  it('ولا يُرسل بلا تأكيد — وبتأكيدٍ تصير بانتظار الاعتماد', async () => {
    await makeSubmittable()
    await expect(plans.submit(trainerUserId, cohortId, false)).rejects.toMatchObject({ code: 'confirm_required' })
    const sent = await plans.submit(trainerUserId, cohortId, true)
    expect(sent.status).toBe('submitted')
    expect(sent.trainerConfirmedAt).not.toBeNull()
    /* وما يُنتظر اعتمادُه لا يُكتب فوقَه */
    await expect(plans.savePlan(trainerUserId, cohortId, content)).rejects.toMatchObject({ code: 'plan_submitted' })
    const pending = await plans.pending()
    expect(pending.some((p) => p.id === sent.id)).toBe(true)
  })

  it('الردُّ يحتاج نصّا، ويعيدها إليه بالنصّ', async () => {
    const latest = await prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId }, orderBy: { createdAt: 'desc' } })
    await expect(plans.decide(adminId, latest.id, false)).rejects.toMatchObject({ code: 'reason_required' })
    await plans.decide(adminId, latest.id, false, 'أضف مثالا تطبيقيّا في المحور الأوّل')
    const ws = await plans.workspace(trainerUserId, cohortId)
    expect(ws.plan?.status).toBe('changes_requested')
    expect(ws.plan?.reviewerNote).toContain('مثالا تطبيقيّا')
    /* ⑦ والخطّةُ كما رُدّت تُحفظ لحظةَ الردّ — ليُقابَل بها ما يُعاد إرسالُه (٣ أكتوبر ٢٠٢٦) */
    const returnedRow = await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: latest.id } })
    expect(returnedRow.returnedContent, 'لم تُحفظ الخطّةُ كما رُدّت').toEqual(latest.content)
    /* ولا «ما تغيّر منذ ردّك» قبل أن يعيد إرسالها */
    expect((await plans.latestForCohort(cohortId))?.returned).toBeNull()
  })

  it('يعدّل ويعيد الإرسال، والاعتمادُ يوفي شرطَ فتح الشعبة', async () => {
    /* والمتنُ المعدَّلُ يبلغ أرضيّةَ المحتوى النظريّ (`MIN_MODULE_BODY`):
       كان عشرين حرفا، وهو دون الأربعين. ومنذ صار `submit` يحتجّ بالقائمة
       (١٥ سبتمبر ٢٠٢٦) يُردّ الإرسالُ على متنٍ ناقص — وهو ما نصّ عليه
       شرطُ المحتوى النظريّ أصلا: «يمنع الاعتمادَ ولا يمنع الحفظ». */
    await plans.savePlan(trainerUserId, cohortId, {
      ...content,
      modules: [{ ...content.modules[0], bodyAr: 'مثالٌ تطبيقيٌّ أُضيف بعد ردِّ الإدارة، يشرح الخطوةَ بالتفصيل كما يقرؤها المتعلّم' }],
    })
    await plans.submit(trainerUserId, cohortId, true)
    /* وما طلبه المعتمِدُ يبقى مع الإرسال — ليقابله بما عُدّل (٣ب). وكان يُمحى
       هنا، فيفتح الخطّةَ المعادةَ ولا يدري ما طلبه منها */
    const resent = await plans.latestForCohort(cohortId)
    expect(resent?.status).toBe('submitted')
    expect(resent?.reviewerNotes, 'مُحي ما طلبه المعتمِدُ قبل أن يقابله').toEqual({ general: 'أضف مثالا تطبيقيّا في المحور الأوّل' })
    /* ⑦ ومعها الخطّةُ كما رُدّت ويومُ الردّ — لا المحتوى الجديد — فيُقرأ ما تغيّر في
       خطوته بالقاعدة التي تقرؤها الشاشة (`sinceReturn`) */
    expect(resent?.returned, 'لم تُعَد الخطّةُ كما رُدّت مع ما أُعيد إرسالُه').toBeTruthy()
    expect(resent!.returned!.at).toEqual(resent!.reviewedAt)
    expect(JSON.stringify(resent!.returned!.content), 'أُعيد المحتوى الجديدُ مكانَ ما رُدّ').not.toContain('أُضيف بعد ردِّ الإدارة')
    const since = sinceReturn(resent!.returned!.content, resent!.content, resent!.reviewerNotes, { date: (d) => d })
    expect(since.general).toBe('أضف مثالا تطبيقيّا في المحور الأوّل')
    expect(since.rows.map((r) => r.section), 'ما عُدّل في المحور لم يُقرأ في خطوته').toEqual(['modules'])
    const latest = await prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId }, orderBy: { createdAt: 'desc' } })
    /* ومتعلّمٌ التحق قبل الاعتماد — يُبلَّغ بأنّ حدودَ شعبته تحدّدت */
    const learner = await prisma.user.create({
      data: { email: `plan-learner-${Date.now()}@test.local`, displayName: 'متعلّمٌ التحق مبكّرا', passwordHash: 'x' },
    })
    await prisma.enrollment.create({ data: { cohortId, userId: learner.id, status: 'enrolled' } })

    const r = await plans.decide(adminId, latest.id, true)
    expect(r.status).toBe('approved')
    /* والاعتمادُ يرفعها: ما طُلب قد عُدّل واعتُمد */
    expect((await plans.latestForCohort(cohortId))?.reviewerNotes).toEqual({})
    /* ⑦ ويرفع معها الخطّةَ كما رُدّت */
    expect((await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: latest.id } })).returnedContent,
      'بقيت الخطّةُ كما رُدّت بعد الاعتماد').toBeNull()
    const ws = await plans.workspace(trainerUserId, cohortId)
    expect(ws.checklist.find((c) => c.key === 'approval')?.done).toBe(true)
    const check = await new CohortService(prisma).openChecklist(cohortId)
    expect(check.missing.some((m) => m.includes('خطة تقديم'))).toBe(false)

    /* ═══ والاعتمادُ يكتب المدّةَ حدودا معلَنة، ويشتقّ الفصل (٢٧ سبتمبر ٢٠٢٦) ═══ */
    const { from, to } = periodBounds(PERIOD)
    const row = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } })
    expect(row.startsAt?.toISOString(), 'لم تصر المدّةُ حدودَ الشعبة المعلَنة').toBe(from.toISOString())
    expect(row.endsAt?.toISOString()).toBe(to.toISOString())
    expect(row.termId, 'لم يُشتقّ الفصلُ من تاريخ البدء').toBe(termId)
    const told = await prisma.notification.findFirst({ where: { userId: learner.id, templateKey: 'cohort.schedule_changed' } })
    expect(told, 'لم يُبلَّغ من التحق بأنّ حدودَ شعبته تحدّدت').toBeTruthy()
    /* ⑪ واليومان يوما عمّان (٣ أكتوبر ٢٠٢٦): بدءُ المدّة منتصفُ ليل ١ فبراير هناك،
       وهو بمنطقة الخادم (UTC) مساءُ ٣١ يناير — فكان يُخبَر «تبدأ الأحد، 31 يناير».
       والمتوقَّعُ يُحسب من التاريخ نفسِه ظهرا بغرينتش، لا بالمساعد الذي يُختبَر */
    const dayOf = (ymd: string, o: Intl.DateTimeFormatOptions) =>
      fmtDateWith(`${ymd}T12:00:00Z`, { ...o, timeZone: 'UTC' })
    expect(told!.body, 'يومُ البدء في الخبر ليس يومَ عمّان')
      .toContain(`تبدأ ${dayOf(PERIOD.startsOn, { weekday: 'long', day: 'numeric', month: 'long' })}`)
    expect(told!.body).toContain(`وتنتهي ${dayOf(PERIOD.endsOn, { day: 'numeric', month: 'long' })}`)
  })

  /* ═══ وسقطت «مرحلةُ التسجيلات» من القائمة (٢٧ سبتمبر ٢٠٢٦) ═══

     كانت صفًّا اختياريّا يتمّ بلقاءٍ له تسجيل. وصار المسجَّلُ جلسةً في خطوة
     اللقاءات بمحوره ولحظةِ فتحه — «لا بأس أن جمعت بين المسجّلة والمباشرة
     لأنّهم نفسُ الأثر». والأثرُ المحروسُ هنا باقٍ بلا صفّ: تسجيلُ اللقاء —
     رفعا أو من سحابة زووم — يلحق لقاءه ويُرى معه في الورشة. */
  it('وتسجيلُ اللقاء يلحق لقاءه ويُرى معه — بلا صفٍّ في القائمة', async () => {
    /* واللقاءُ مربوطٌ بمحوره كما يربطه مدرّبُه — فلقاءٌ بلا محورٍ يحجب الإرسالَ
       في الحالة التي تلي، وليس ذلك ما يُقاس هنا */
    const first = content.modules[0].moduleId
    const session = await prisma.cohortSession.create({
      data: { cohortId, title: 'اللقاء الأوّل', startsAt: new Date('2027-02-10T15:00:00.000Z'), moduleIds: [first], moduleId: first },
    })
    const rec = await prisma.recording.create({
      data: { sessionId: session.id, title: 'تسجيل اللقاء الأوّل', externalUrl: 'https://example.com/rec-1' },
    })
    expect(rec.storageKey).toBeNull()
    const ws = await plans.workspace(trainerUserId, cohortId)
    expect(ws.checklist.map((c) => c.key), 'عاد صفُّ التسجيلات').not.toContain('recordings')
    const seen = ws.sessions.find((x) => x.id === session.id)
    expect(seen?.recordings.map((r) => r.externalUrl), 'التسجيلُ لا يُرى مع لقائه').toEqual(['https://example.com/rec-1'])
  })

  /* آخرَ السلسلة: يُرسل خطّةً جديدةً ويعتمدها، فلا يغيّر حالةَ ما قبله */
  it('اعتمادُ الخطّة لا يُعيد تسميةَ الدورة — ولو حملت الخطّةُ اقتراحا قديما', async () => {
    /* كان هنا الضدُّ تماما: خطّةٌ باقتراحَين، واعتمادٌ يكتب الاسمَ **على
       النسخة الحاليّة** بـ`updateMany`. وذلك ما كان يُعيد تسميةَ كلِّ شهادةٍ
       صدرت عن الدورة (ك-٢). فحُذف الصندوقُ (د-٦) وصارت التسميةُ إصدارا
       جديدا في قناتها (ح-٣)، وهذا الاختبارُ يحرس البابَ مغلقا.

       والاقتراحُ يُكتب هنا **في العمود مباشرةً** لا عبر `savePlan`: المخطّطُ
       لم يعد يقبل المفتاح، والمحاكاةُ المقصودة خطّةٌ محفوظةٌ قبل الحذف. */
    await plans.savePlan(trainerUserId, cohortId, content)
    const sent = await plans.submit(trainerUserId, cohortId, true)
    await prisma.cohortDeliveryPlan.update({
      where: { id: sent.id },
      data: {
        content: {
          ...(content as unknown as Record<string, unknown>),
          proposals: { courseTitleAr: 'دورة تحليل الأعمال — كما يراها المدرّب', pathwayTitleAr: 'مسارُ محلّل الأعمال' },
        },
      },
    })

    const course = await prisma.course.findUniqueOrThrow({
      where: { id: 'C-BIZ-101' }, select: { currentVersion: true, homePathwayId: true },
    })
    const before = await prisma.courseVersion.findFirstOrThrow({
      where: { courseId: 'C-BIZ-101', version: course.currentVersion },
    })

    const res = await plans.decide(adminId, sent.id, true)
    expect(res.status).toBe('approved')

    /* الاسمُ كما كان — ولا نسخةَ جديدةٌ وُلدت من اعتمادِ خطّة */
    const after = await prisma.courseVersion.findFirstOrThrow({
      where: { courseId: 'C-BIZ-101', version: course.currentVersion },
    })
    expect(after.titleAr).toBe(before.titleAr)
    expect(after.titleAr).not.toContain('كما يراها المدرّب')
    const nowCourse = await prisma.course.findUniqueOrThrow({ where: { id: 'C-BIZ-101' }, select: { currentVersion: true } })
    expect(nowCourse.currentVersion).toBe(course.currentVersion)

    /* واسمُ المسار كذلك */
    if (course.homePathwayId) {
      const pw = await prisma.pathway.findUniqueOrThrow({ where: { id: course.homePathwayId }, select: { currentVersion: true } })
      const pv = await prisma.pathwayVersion.findFirstOrThrow({ where: { pathwayId: course.homePathwayId, version: pw.currentVersion } })
      expect(pv.title, 'اسمُ المسار تغيّر باعتماد خطّة').not.toBe('مسارُ محلّل الأعمال')
    }

    /* ولا أثرَ جديدٌ بالفعل الذي زال */
    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'cohort.plan.proposal_applied', entityId: cohortId },
    })
    expect(audit).toBeNull()
  })

})

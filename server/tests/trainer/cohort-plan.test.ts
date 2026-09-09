/* الشعبةُ ملكُ مدرّبها — يجهّزها ويقول «أوافق»، والإدارةُ تعتمد.

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦). وهذا الملفّ يحرس الحلقةَ كاملةً:
   ١) المدرّبُ يعدّل اسمَ شعبته ويحفظ محاورَها ومصادرَها — ويردّ السعرُ باسمه.
   ٢) ولا يُرسل بلا تأكيد، ويُرسل بتأكيدٍ فتصير `submitted`.
   ٣) والردُّ بتعديلاتٍ يحتاج نصّا، ويعيدها إليه بالنصّ.
   ٤) والاعتمادُ يجعلها `approved` — فتوفي شرطَ فتح الشعبة الخامس.
   ٥) ومدرّبٌ آخرُ لا يبلغها: ٤٠٣ لا ٤٠٤.
   ٦) والتسجيلُ يُضاف من رابطٍ بلا ملفّ. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService, type AvailabilityInput } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CohortPlanService, staticModulesFor, type TrainerPlanContent } from '../../services/cohort-plan.service'
import { CohortService } from '../../services/cohort.service'

let prisma: PrismaClient
let plans: CohortPlanService
let adminId = ''
let trainerUserId = ''
let otherTrainerUserId = ''
let cohortId = ''

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
  await review.decide(app.id, adminId, 'approve')
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: app.id } })
  void auth
  return { userId: app.userId!, profileId: profile.id }
}

const content: TrainerPlanContent = {
  kind: 'trainer',
  summaryAr: 'شعبةٌ تطبيقيّة — كلُّ وحدةٍ تنتهي بمهمّةٍ من واقع العمل',
  modules: [{ moduleId: 'C-BIZ-101-M1', titleAr: 'المحور الأوّل — كما يراه المدرّب', activityAr: 'تطبيقٌ عمليٌّ على بياناتٍ حقيقيّة' }],
  resources: [{ title: 'كرّاسة الوحدة الأولى', url: 'https://example.com/unit-1.pdf' }],
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

  it('الورشةُ تقول ما بقي — وكلُّه لم يتمّ بعد', async () => {
    const ws = await plans.workspace(trainerUserId, cohortId)
    expect(ws.plan).toBeNull()
    expect(ws.cohort.readOnly.price).toBe(120)
    expect(ws.course.baseModules.length).toBeGreaterThan(0)
    const required = ws.checklist.filter((c) => !c.optional)
    expect(required.every((c) => !c.done)).toBe(true)
  })

  /* ═══ صفحةُ الشعبة الواحدة (٨ سبتمبر ٢٠٢٦) ═══ */
  it('التكاليفُ مرحلةٌ في التجهيز — اختياريّةٌ، وتتمّ بأوّل تكليف', async () => {
    const before = (await plans.workspace(trainerUserId, cohortId)).checklist.find((c) => c.key === 'assignments')
    expect(before, 'لا مرحلةَ للتكاليف').toBeTruthy()
    expect(before!.optional).toBe(true)
    expect(before!.done).toBe(false)
    await prisma.cohortAssessment.create({ data: { cohortId, title: 'واجبُ الوحدة الأولى', type: 'assignment', maxScore: 100 } })
    const ws = await plans.workspace(trainerUserId, cohortId)
    expect(ws.checklist.find((c) => c.key === 'assignments')!.done).toBe(true)
    expect(ws.assessments.map((a) => a.title)).toContain('واجبُ الوحدة الأولى')
  })

  it('وموجزُ «شعبي» يقرأ القائمةَ نفسَها — فلا تفترق الحلقةُ عن الورشة', async () => {
    const rows = await plans.summaries(trainerUserId)
    const me = rows.find((r) => r.id === cohortId)
    expect(me, 'الشعبةُ ليست في الموجز').toBeTruthy()
    const ws = await plans.workspace(trainerUserId, cohortId)
    const required = ws.checklist.filter((c) => !c.optional)
    expect(me!.total).toBe(required.length)
    expect(me!.done).toBe(required.filter((c) => c.done).length)
    expect(me!.next?.key).toBe(required.find((c) => !c.done)!.key)
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

  it('ومدرّبٌ آخرُ لا يبلغها — ٤٠٣', async () => {
    await expect(plans.workspace(otherTrainerUserId, cohortId)).rejects.toMatchObject({ code: 'not_your_cohort' })
  })

  it('يحفظ المحاورَ والمصادرَ مسودّةً، فتُقفل بنودُها في القائمة', async () => {
    const plan = await plans.savePlan(trainerUserId, cohortId, content)
    expect(plan.status).toBe('draft')
    const ws = await plans.workspace(trainerUserId, cohortId)
    expect(ws.checklist.find((c) => c.key === 'modules')?.done).toBe(true)
    expect(ws.checklist.find((c) => c.key === 'resources')?.done).toBe(true)
    expect(ws.checklist.find((c) => c.key === 'approval')?.done).toBe(false)
  })

  it('ولا يُرسل بلا تأكيد — وبتأكيدٍ تصير بانتظار الاعتماد', async () => {
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
  })

  it('يعدّل ويعيد الإرسال، والاعتمادُ يوفي شرطَ فتح الشعبة', async () => {
    await plans.savePlan(trainerUserId, cohortId, { ...content, modules: [{ ...content.modules[0], bodyAr: 'مثالٌ تطبيقيٌّ أُضيف' }] })
    await plans.submit(trainerUserId, cohortId, true)
    const latest = await prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId }, orderBy: { createdAt: 'desc' } })
    const r = await plans.decide(adminId, latest.id, true)
    expect(r.status).toBe('approved')
    const ws = await plans.workspace(trainerUserId, cohortId)
    expect(ws.checklist.find((c) => c.key === 'approval')?.done).toBe(true)
    const check = await new CohortService(prisma).openChecklist(cohortId)
    expect(check.missing.some((m) => m.includes('خطة تقديم'))).toBe(false)
  })

  it('والتسجيلُ يُضاف من رابطٍ بلا ملفّ', async () => {
    const session = await prisma.cohortSession.create({ data: { cohortId, title: 'اللقاء الأوّل', startsAt: new Date(Date.now() + 86400_000) } })
    const rec = await plans.addRecordingLink(trainerUserId, session.id, { title: 'تسجيل اللقاء الأوّل', url: 'https://example.com/rec-1' })
    expect(rec.externalUrl).toBe('https://example.com/rec-1')
    expect(rec.storageKey).toBeNull()
    const ws = await plans.workspace(trainerUserId, cohortId)
    expect(ws.checklist.find((c) => c.key === 'recordings')?.done).toBe(true)
  })
})

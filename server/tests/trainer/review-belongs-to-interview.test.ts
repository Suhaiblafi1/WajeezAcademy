/* التقييمُ يُعلَّق بمقابلةٍ بعينها، وقرارُه يُكتب في عمودها.

   ═══ ما طُلب (٢١ سبتمبر ٢٠٢٦) ═══

   «وإن وضعنا في التقييم أنّه اجتاز فليُعكَس على قسم المقابلة ويظهر في ملفّه.
   لا أريد شيئين: اجتاز واجتاز. وإن كان عندنا تقييمان أحدهما اجتاز والآخر لم
   يجتز فليُعكَس الاثنان على الليبل الرئيسيّ — مقيّمان مختلفان. ولا أريد
   التقييمَ العامّ، أريده مرتبطا بالمقابلات المجدولة».

   ═══ وما يُحرَس هنا ═══

   ① **لا قرارَ بلا لقاء** — وهو ما يمنع «التقييمَ العامّ» من الجذر.
   ② **ولا يُحكَم في لقاءِ غيرِه ولا في ملغًى** — والحارسُ في الخادم لا في
      الشاشة: الشاشةُ تمنع الاختيار، وهذا يردّ من جاء من غيرها.
   ③ **وقرارُ القارئ يُكتب في عمود الموعد** — فيُقرأ في قسم المقابلة وفي
      الملفّ بلا أن يُسجَّل مرّتين.
   ④ **ويمرّ بمسار الإدارة نفسِه** — فالغيابُ يعيد الطلبَ إلى ما قبل الحجز
      كما يفعل زرُّ الإدارة، ولا يُكتب العمودُ من بابٍ لا يعرف ذلك.
   ⑤ **واختلافُ القرّاء يسحب المكتوب** — العمودُ لا يسع قولَين، ولا يُختار
      أحدُهما بالصدفة (أيُّهما حفظ أخيرا).
   ⑥ **واتّفاقُهما يكتبه** — فمن حكم بعد صاحبه بمثل قوله أكّده ولم ينقضه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerDossierLinkService } from '../../services/trainer-dossier-link.service'
import { NO_SHOW } from '../../../src/application/trainer/interview-outcome'

let prisma: PrismaClient
let svc: TrainerDossierLinkService
let apps: TrainerApplicationService
let adminId = ''

const applicant = (n: number) => ({
  fullName: `متقدّمُ الربط ${n}`, email: `review-iv-${n}@test.local`,
  specialties: ['القيادة وتطوير المدراء'], domainYears: '4-7', trainingYears: 'workshops',
  trainingLanguages: ['العربية'], deliveryMode: 'remote' as const,
  motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي وأكتب لكل واحد ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const, password: 'Trainer#12345',
})

/** طلبٌ مقدَّمٌ ومعه موعدُ لقاء — ويُعاد معرّفاهما */
async function withInterview(n: number, at = new Date('2026-09-20T14:00:00Z')) {
  const res = await apps.submitPhase1(applicant(n))
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.transition(row.id, 'submitted', null, 'اكتمال الطلب')
  await apps.transition(row.id, 'under_review', null, 'بدء المراجعة')
  await apps.transition(row.id, 'shortlisted', null, 'اختصار أوّليّ')
  await apps.transition(row.id, 'interview_scheduled', null, 'جدولة مقابلة')
  const iv = await prisma.trainerInterview.create({
    data: { applicationId: row.id, scheduledAt: at, mode: 'remote' },
  })
  return { applicationId: row.id, interviewId: iv.id }
}

/** رابطُ قارئٍ باسمه — ويُعاد رمزُه */
async function linkFor(applicationId: string, reviewerName: string) {
  const { url } = await svc.create(applicationId, adminId, { reviewerName })
  return url.split('/r/')[1]
}

const outcomeOf = (interviewId: string) =>
  prisma.trainerInterview.findUniqueOrThrow({ where: { id: interviewId }, select: { outcome: true } })
    .then((r) => r.outcome)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  svc = new TrainerDossierLinkService(prisma)
  apps = new TrainerApplicationService(prisma)
  const auth = new AuthService(prisma)
  const admin = await auth.register('review-iv-admin@test.local', 'Admin#12345', 'المديرُ الأكاديميّ')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

describe('① لا قرارَ بلا لقاءٍ يُنسَب إليه', () => {
  it('حفظُ قرارٍ بلا مقابلةٍ يُردّ — وهو ما يمنع «التقييمَ العامّ»', async () => {
    const { applicationId } = await withInterview(1)
    const token = await linkFor(applicationId, 'قارئٌ بلا لقاء')
    await expect(svc.saveReview(token, { verdict: 'passed' }))
      .rejects.toMatchObject({ code: 'interview_required' })
  })

  it('وما لا قرارَ فيه يُحفَظ بلا مقابلة — الدرجاتُ والملاحظاتُ لا تُمنَع', async () => {
    const { applicationId } = await withInterview(2)
    const token = await linkFor(applicationId, 'قارئٌ يقيّم ولا يحكم')
    const saved = await svc.saveReview(token, { scores: { domain_expertise: 4 }, overallNote: 'ملاحظةٌ بلا قرار' })
    expect(saved.savedAt, 'رُدَّ حفظٌ لا قرارَ فيه').toBeTruthy()
  })
})

describe('② ولا يُحكَم في لقاءِ غيره ولا في ملغًى', () => {
  it('مقابلةُ طلبٍ آخرَ تُردّ — فلا يُعلَّق حكمٌ بلقاء إنسانٍ لم يُقرأ ملفُّه', async () => {
    const mine = await withInterview(3)
    const other = await withInterview(4)
    const token = await linkFor(mine.applicationId, 'قارئٌ يخطئ الملفّ')
    await expect(svc.saveReview(token, { verdict: 'passed', interviewId: other.interviewId }))
      .rejects.toMatchObject({ code: 'interview_not_found' })
  })

  it('والملغاةُ تُردّ — لا يُحكَم في لقاءٍ لم يقع', async () => {
    const { applicationId, interviewId } = await withInterview(5)
    await prisma.trainerInterview.update({ where: { id: interviewId }, data: { canceledAt: new Date() } })
    const token = await linkFor(applicationId, 'قارئُ الملغاة')
    await expect(svc.saveReview(token, { verdict: 'passed', interviewId }))
      .rejects.toMatchObject({ code: 'interview_canceled' })
  })
})

describe('③④ وقرارُ القارئ يُكتب في عمود الموعد', () => {
  it('«ناجح» من الرابط يصير نتيجةَ اللقاء — فلا يُسجَّل مرّتين', async () => {
    const { applicationId, interviewId } = await withInterview(6)
    expect(await outcomeOf(interviewId), 'للموعد نتيجةٌ قبل أن يحكم أحد').toBeNull()

    const token = await linkFor(applicationId, 'سارة')
    await svc.saveReview(token, { verdict: 'passed', interviewId })
    expect(await outcomeOf(interviewId), 'قرارُ الرابط لم يصل عمودَ الموعد').toBe('passed')
  })

  it('واسمُ القارئ في الأثر — فيُعرف من سجّلها وهو بلا حساب', async () => {
    const { applicationId, interviewId } = await withInterview(7)
    const token = await linkFor(applicationId, 'أحمدُ القارئ')
    await svc.saveReview(token, { verdict: 'hold', interviewId })

    const audits = await prisma.auditEvent.findMany({
      where: { entityId: applicationId, action: 'trainer.interview.outcome' },
    })
    expect(audits, 'لا أثرَ لتسجيل النتيجة').toHaveLength(1)
    expect(audits[0].actorId, 'اختُرع فاعلٌ لقارئٍ بلا حساب').toBeNull()
    expect(JSON.stringify(audits[0].meta), 'اسمُ القارئ غائبٌ عن الأثر').toContain('أحمدُ القارئ')
  })

  it('④ والغيابُ يعيد الطلبَ إلى ما قبل الحجز — كما يفعل زرُّ الإدارة', async () => {
    const { applicationId, interviewId } = await withInterview(8)
    const token = await linkFor(applicationId, 'قارئُ الغياب')
    await svc.saveReview(token, { verdict: NO_SHOW, interviewId })

    expect(await outcomeOf(interviewId)).toBe(NO_SHOW)
    const app = await prisma.trainerApplication.findUniqueOrThrow({
      where: { id: applicationId }, select: { status: true },
    })
    expect(app.status, 'بقي الطلبُ في «حُدّد موعدُه» وموعدُه لم يقع').toBe('shortlisted')
  })
})

describe('⑤⑥ واختلافُ القرّاء يسحب المكتوب، واتّفاقُهما يكتبه', () => {
  it('قارئان اختلفا: يُسحَب المكتوبُ ولا يُختار أحدُهما بالصدفة', async () => {
    const { applicationId, interviewId } = await withInterview(9)
    const first = await linkFor(applicationId, 'سارة')
    const second = await linkFor(applicationId, 'أحمد')

    await svc.saveReview(first, { verdict: 'passed', interviewId })
    expect(await outcomeOf(interviewId), 'قولُ الأوّل لم يُكتب').toBe('passed')

    await svc.saveReview(second, { verdict: 'failed', interviewId })
    expect(await outcomeOf(interviewId), 'كُتب قولُ آخرِ من حفظ — والعمودُ لا يسع قولَين').toBeNull()

    const cleared = await prisma.auditEvent.findMany({
      where: { entityId: applicationId, action: 'trainer.interview.outcome_cleared' },
    })
    expect(cleared, 'سُحبت النتيجةُ بلا أثرٍ يقول لماذا').toHaveLength(1)
  })

  it('ثمّ اتّفقا: يعود المكتوبُ قولَهما المتّفَقَ عليه', async () => {
    const { applicationId, interviewId } = await withInterview(10)
    const first = await linkFor(applicationId, 'سارة')
    const second = await linkFor(applicationId, 'أحمد')

    await svc.saveReview(first, { verdict: 'passed', interviewId })
    await svc.saveReview(second, { verdict: 'failed', interviewId })
    expect(await outcomeOf(interviewId)).toBeNull()

    /* ويعدل الثاني عن قوله — فلم يبقَ خلاف */
    await svc.saveReview(second, { verdict: 'passed', interviewId })
    expect(await outcomeOf(interviewId), 'اتّفقا ولم يُكتب قولُهما').toBe('passed')
  })

  it('واتّفاقُهما ابتداءً لا يُسجَّل مرّتين — فلا انتقالٌ ثانٍ في السجلّ', async () => {
    const { applicationId, interviewId } = await withInterview(11)
    const first = await linkFor(applicationId, 'سارة')
    const second = await linkFor(applicationId, 'أحمد')

    await svc.saveReview(first, { verdict: 'passed', interviewId })
    await svc.saveReview(second, { verdict: 'passed', interviewId })
    expect(await outcomeOf(interviewId)).toBe('passed')

    const audits = await prisma.auditEvent.findMany({
      where: { entityId: applicationId, action: 'trainer.interview.outcome' },
    })
    expect(audits, 'سُجّلت النتيجةُ مرّتين وهي هي').toHaveLength(1)
  })

  it('ومن سحب قرارَه وحدَه سحب معه ما كُتب في الموعد', async () => {
    const { applicationId, interviewId } = await withInterview(12)
    const token = await linkFor(applicationId, 'قارئٌ يتراجع')
    await svc.saveReview(token, { verdict: 'passed', interviewId })
    expect(await outcomeOf(interviewId)).toBe('passed')

    await svc.saveReview(token, { verdict: null, interviewId })
    expect(await outcomeOf(interviewId), 'بقي قولٌ في الموعد بلا قائلٍ يقوله').toBeNull()
  })
})

describe('⑦ وما وصل صفحةَ القارئ', () => {
  it('مواعيدُه تصله ليختار أيَّها يحكم فيه، ومعها قرارُه المحفوظ', async () => {
    const { applicationId, interviewId } = await withInterview(13)
    const token = await linkFor(applicationId, 'قارئٌ يقرأ مواعيده')
    await svc.saveReview(token, { verdict: 'hold', interviewId })

    const view = await svc.view(token) as {
      application: { interviews?: { id: string }[] }
      myReview: { interviewId: string | null } | null
    }
    expect(view.application.interviews?.map((iv) => iv.id), 'المواعيدُ لا تصل القارئ')
      .toContain(interviewId)
    expect(view.myReview?.interviewId, 'لا يعود إليه لقاؤه الذي حكم فيه').toBe(interviewId)
  })
})

/* الاعتمادُ بنقرةٍ واحدة — من «مقدَّم» إلى مدرّبٍ نشطٍ بحسابٍ عامل.

   كان الطريق ثمانَ نقراتٍ لا تُتّخذ إلا بالترتيب: مراجعة ← اختصار ← درسٌ
   تجريبيّ ← مراجعةٌ أكاديميّة ← قبولٌ مشروط ← عقد ← تهيئة ← تفعيل. وكلٌّ
   منها حالةٌ في القاعدة وزرٌّ في الشاشة، وكلٌّ منها تُنسى — فيبقى من اجتاز
   التقييمَ عالقا في منتصف السلسلة ولا يعلم أحدٌ أين وقف.

   وقرّر صاحبُ المنصّة أن يكون الاعتمادُ نقرةً واحدة. والنقرةُ الواحدةُ خطرُها
   أنّها تترك **نصفَ اعتماد**: حالةٌ «نشط» بلا ملفٍّ، أو بلا دورٍ، أو بحسابٍ
   لا يفتح البوّابة — وكلُّها تُقرأ على الشاشة اعتمادا تامّا. فأكثرُ ما هنا
   فحصٌ لتمامها لا لوقوعها.

   وما لا يجوز أن تفعله النقرة: أن تتخطّى توثيقَ البريد، أو أن تُحيي طلبا
   مرفوضا أو مسحوبا، أو أن يعتمد أحدٌ طلبَ نفسِه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import {
  TrainerApplicationService, ALLOWED_TRANSITIONS, APPROVABLE_BY_MAP, TRAINER_STATUSES,
} from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { ONE_CLICK_APPROVABLE_STATUSES } from '../../../src/application/trainer/approval'

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService
let review: TrainerReviewService
let adminId: string

const base = {
  phoneCountryCode: '+962', phone: '771050000', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدرّبة تسويق', specialties: ['التسويق الرقمي'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرةٌ ميدانيّة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'درّبتُ فرقا حقيقيّةً في بيئات عملٍ عربيّة، وأعرف الفرقَ بين من يعرف المادّة ومن يستطيع تعليمها. سأعطي كلَّ متعلّمٍ مهمّةً من واقع عمله في كلّ وحدة، وأراجع مخرجاته بنفسي وأكتب له ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
}

/** متقدّمٌ كامل: حسابٌ وبريدٌ موثَّق وطلبٌ مقدَّم — نقطةُ البداية الواقعيّة */
async function applicant(email: string, fullName: string) {
  const res = await apps.submitPhase1({ ...base, email, fullName })
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' },
  })
  await prisma.trainerApplication.update({ where: { id: row.id }, data: { emailVerifiedAt: new Date() } })
  return { id: row.id, reference: res.reference, userId: res.userId }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('admin-oneclick@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 180_000)

describe('اعتمادُ المدرّب بنقرةٍ واحدة', () => {
  it('من «مقدَّم» مباشرةً إلى «نشط» — بلا خطوةٍ وسيطةٍ واحدة', async () => {
    const a = await applicant('oneclick-1@test.local', 'سلمى المدرّبة')
    const before = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(before.status, 'نقطةُ البداية ليست «مقدَّم» — الفحصُ لا يقيس ما يدّعيه').toBe('submitted')

    await review.decide(a.id, adminId, 'approve', 'اعتماد بنقرة')

    const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(after.status).toBe('active')
    /* ولا خطوةَ وسيطةٌ اختُلقت في السجلّ: قفزةٌ واحدةٌ موثَّقة */
    const hops = await prisma.trainerStatusHistory.findMany({
      where: { applicationId: a.id }, orderBy: { createdAt: 'asc' },
    })
    const last = hops[hops.length - 1]
    expect(last.fromStatus).toBe('submitted')
    expect(last.toStatus).toBe('active')
  })

  it('والاعتمادُ تامٌّ لا نصفُه: ملفٌّ ومهامُّ تهيئةٍ وحسابٌ بدور مدرّب', async () => {
    const a = await applicant('oneclick-2@test.local', 'هاني المدرّب')
    await review.decide(a.id, adminId, 'approve')

    const profile = await prisma.trainerProfile.findUnique({ where: { applicationId: a.id } })
    expect(profile, 'حالةٌ «نشط» بلا ملفّ — اعتمادٌ لا يُسنَد إليه شيء').not.toBeNull()
    expect(profile!.userId, 'ملفٌّ بلا حساب — بوّابةٌ لا تُفتح').toBe(a.userId)

    const tasks = await prisma.trainerOnboardingTask.count({ where: { profileId: profile!.id } })
    expect(tasks).toBeGreaterThan(0)

    const roles = await prisma.userRole.findMany({ where: { userId: a.userId } })
    const ids = roles.map((r) => r.roleId)
    expect(ids, 'لا دورَ مدرّبٍ — يدخل ولا يرى بوّابتَه').toContain('trainer')
    expect(ids, 'بقي دورُ المتقدّم بعد أن صار مدرّبا').not.toContain('trainer_applicant')
  })

  it('ويُعتمَد كذلك من منتصف السلسلة — فالطلباتُ العالقةُ لا تحتاج إتمامَها', async () => {
    const a = await applicant('oneclick-3@test.local', 'رنا المدرّبة')
    await review.decide(a.id, adminId, 'move_to_review')
    await review.decide(a.id, adminId, 'shortlist')
    await review.decide(a.id, adminId, 'approve')
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(row.status).toBe('active')
  })

  it('والسلسلةُ التفصيليّةُ باقيةٌ تعمل — لم يُحذف طريقٌ بل أُضيف', async () => {
    const a = await applicant('oneclick-4@test.local', 'زيد المدرّب')
    for (const step of ['move_to_review', 'shortlist', 'request_demo', 'academic_review',
      'conditionally_approve'] as const) {
      await review.decide(a.id, adminId, step)
    }
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(row.status).toBe('conditionally_approved')
    /* وملفُّ القبول المشروط يُنشأ كما كان — الاختصارُ لم يُعطّله */
    expect(await prisma.trainerProfile.findUnique({ where: { applicationId: a.id } })).not.toBeNull()
    await review.decide(a.id, adminId, 'approve')
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('active')
  })

  it('ولا اعتمادَ لطلبٍ مرفوض — النهايةُ نهاية', async () => {
    const a = await applicant('oneclick-5@test.local', 'مرفوض المدرّب')
    await review.decide(a.id, adminId, 'reject', 'لا يناسب')
    await expect(review.decide(a.id, adminId, 'approve')).rejects.toMatchObject({ code: 'bad_transition' })
  })

  it('ولا اعتمادَ لبريدٍ لم يُوثَّق — الاعتمادُ يفتح حسابا، فلا يُفتح لبريدٍ مجهول', () => {
    for (const s of ['draft', 'email_verification_pending'] as const) {
      expect(ALLOWED_TRANSITIONS[s], `«${s}» يسمح بالاعتماد`).not.toContain('active')
    }
  })

  it('ولا يعتمد أحدٌ طلبَ نفسِه — حتّى بنقرةٍ واحدة', async () => {
    /* للمتقدّم حسابٌ منذ تقديمه؛ فلو نال صلاحيّةَ القرار يوما لَاعتمد نفسَه.
       والحارسُ يقارن بريدَ الفاعل ببريد الطلب، فيمنعه ولو كان مديرا. */
    const a = await applicant('oneclick-6@test.local', 'ذاتيّ المدرّب')
    await auth.setRoles(a.userId, ['academic_manager'])
    await expect(review.decide(a.id, a.userId, 'approve')).rejects.toMatchObject({ code: 'self_decision' })
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('submitted')
  })

  it('والشاشةُ والخادمُ يتّفقان على الحالات التي تُعتمَد منها — لا زرٌّ يُرفض ولا مسارٌ يُخفى', () => {
    expect([...ONE_CLICK_APPROVABLE_STATUSES].sort()).toEqual([...APPROVABLE_BY_MAP].sort())
    /* وكلُّ حالةٍ حيّةٍ في القائمة: لو أُضيفت حالةٌ جديدةٌ ونُسيت، فُضحت هنا */
    const live = TRAINER_STATUSES.filter(
      (s) => !['draft', 'email_verification_pending', 'rejected', 'withdrawn', 'suspended', 'active'].includes(s),
    )
    expect([...ONE_CLICK_APPROVABLE_STATUSES].sort()).toEqual([...live].sort())
  })
})

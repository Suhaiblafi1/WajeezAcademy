/* دعوةُ من وصل طلبُه ولم يحجز موعدَ لقاء التعارف.

   ═══ العطبُ الذي كُتب له ═══

   الحجزُ شاشةٌ تُرى مرّةً بعد الإرسال، ومن أغلقها ليعود «لاحقا» لا يعود. فيقف
   طلبٌ كاملٌ بلا لقاء، ونحسبه متأخّرا وهو ينتظرنا. ولم يكن بيد الإدارة إلّا
   «دعوةٌ إلى لقاءٍ ثانٍ» — نصُّها «نودّ أن نلتقيك مرّةً أخرى»، ولا تصلح لمن
   لم يلتقِنا بعد.

   ═══ وما يُفحص هنا ═══

   ① **يُرسَل ويُكتب في الأثر** — فعلٌ بلا أثرٍ لا يُعرف من فعله ولا متى،
      ورسالةٌ ثانيةٌ بعد يومَين تُقرأ إلحاحا ولا يعلم مرسلُها أنّها ثانية.
   ② **ولا يُذكَّر من حجز** — رسالةُ «لم تحجز» تصل من حجز أمسِ فتُقرأ إهمالا
      منّا؛ والملغى لا يُحسب حجزا، فمن ألغى أحوجُ الناس إلى التذكير.
   ③ **ولا من وقع في طلبه قرار** — المرفوضُ يُدعى إلى بابٍ مغلق.

   والرابعُ (سببُ الرفض لا يسافر في بريده) مفحوصٌ في المسار السريع:
   `src/tests/trainer-decision-mail.test.ts` — دالّاتٌ خالصةٌ لا تحتاج قاعدة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'

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

/** متقدّمٌ كامل: طلبٌ مقدَّمٌ وبريدٌ موثَّق — وهو من يُدعى */
async function applicant(email: string, fullName: string) {
  const res = await apps.submitPhase1({ ...base, email, fullName })
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' },
  })
  await prisma.trainerApplication.update({ where: { id: row.id }, data: { emailVerifiedAt: new Date() } })
  /* وحسابُه يُردّ معه: صفحةُ حالته تُقرأ به، وفيها تُعرض الدعوةُ التي بُعثت */
  return { id: row.id, reference: res.reference, userId: res.userId }
}

const remindersOf = (applicationId: string) => prisma.auditEvent.findMany({
  where: { entityId: applicationId, action: 'trainer.interview.remind' },
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('admin-remind@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 180_000)

describe('تذكيرُ المتقدّم بحجز موعده', () => {
  it('يُرسَل لمن وصل طلبُه ولم يحجز — ويُكتب في الأثر باسم من ذكّره', async () => {
    const a = await applicant('remind-1@test.local', 'سلمى المدرّبة')
    const before = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(before.status, 'نقطةُ البداية ليست «مقدَّم» — الفحصُ لا يقيس ما يدّعيه').toBe('submitted')
    expect(await remindersOf(a.id), 'أثرٌ قبل الفعل').toHaveLength(0)

    const out = await review.remindToBookInterview(a.id, adminId)
    /* والبريدُ لا يخرج في الاختبار (بوّابةُ `mail-gate`) — فالمقيسُ أنّ حالَه
       يُعاد ويُكتب، لا أنّه وصل. وحالُ «غير مهيّأ» حالٌ مقروءٌ لا إخفاقٌ صامت. */
    expect(out.emailDelivery).toBeTruthy()

    const trail = await remindersOf(a.id)
    expect(trail, 'ذُكِّر بلا أثر').toHaveLength(1)
    expect(trail[0].actorId).toBe(adminId)
    expect((trail[0].meta as { sentTo?: string }).sentTo).toBe('remind-1@test.local')
  })

  it('ولا يُذكَّر من حجز موعدَه — ولا يُكتب له أثرٌ بفعلٍ لم يقع', async () => {
    const a = await applicant('remind-2@test.local', 'هدى المدرّبة')
    await review.decide(a.id, adminId, 'move_to_review')
    await review.scheduleInterview(a.id, adminId, {
      scheduledAt: new Date(Date.now() + 86_400_000), mode: 'remote',
    })
    /* والحالةُ انتقلت إلى «مقابلة مجدولة» بالجدولة — فيُعاد الطلبُ إلى
       «مقدَّم» ليُقاس المانعُ الأوّل (موعدٌ قائم) وحدَه لا الحالة. */
    await prisma.trainerApplication.update({ where: { id: a.id }, data: { status: 'submitted' } })

    await expect(review.remindToBookInterview(a.id, adminId))
      .rejects.toMatchObject({ code: 'already_booked' })
    expect(await remindersOf(a.id), 'كُتب أثرٌ لتذكيرٍ لم يُرسَل').toHaveLength(0)
  })

  it('ومن ألغى موعدَه يُذكَّر — فالملغى ليس موعدا', async () => {
    const a = await applicant('remind-3@test.local', 'ريم المدرّبة')
    await review.decide(a.id, adminId, 'move_to_review')
    const iv = await review.scheduleInterview(a.id, adminId, {
      scheduledAt: new Date(Date.now() + 86_400_000), mode: 'remote',
    })
    await prisma.trainerInterview.update({ where: { id: iv.id }, data: { canceledAt: new Date() } })
    await prisma.trainerApplication.update({ where: { id: a.id }, data: { status: 'submitted' } })

    await review.remindToBookInterview(a.id, adminId)
    expect(await remindersOf(a.id)).toHaveLength(1)
  })

  it('ولا يُذكَّر من وقع في طلبه قرار — التذكيرُ يدعوه إلى بابٍ مغلق', async () => {
    const a = await applicant('remind-4@test.local', 'نور المدرّبة')
    await review.decide(a.id, adminId, 'reject', 'سببٌ داخليٌّ لا يُرسَل')

    await expect(review.remindToBookInterview(a.id, adminId))
      .rejects.toMatchObject({ code: 'not_bookable' })
    expect(await remindersOf(a.id)).toHaveLength(0)
  })

  /* ═══ والدعوةُ تُقرأ في صفحته — لا في بريده وحدَه (٢٢ سبتمبر ٢٠٢٦) ═══

     زرُّ الرسالة يفتح صفحةَ حالته بعينها (قرارُ ١٨ سبتمبر). فمن جاء منها كان
     يجد تقويما محيَّدا بلا كلمةٍ عمّا قرأه قبل لحظة — فيشكّ أنّه في الموضع
     الصحيح، أو يقرأ الرسالةَ آليّةً لا تعني ملفَّه.

     والمفحوصُ هنا **وصلُ الطرفَين**: فعلُ الأثر الذي يكتبه المُرسِل هو الذي
     تقرؤه `myApplication`. ولو افترقا لخرج البريدُ ولم تظهر الدعوةُ في
     الشاشة — عطبٌ لا يُحمِّر شيئا. أمّا مَن تُعرض له فحكمُه في الوحدة النقيّة
     ويُنقَض هناك: `src/tests/trainer/interview-invitation.test.ts`. */
  it('⚠️ وتاريخُها يصل صفحةَ حالته — فيجد في الموقع ما قرأه في بريده', async () => {
    const a = await applicant('remind-5@test.local', 'لمى المدرّبة')
    const before = await apps.myApplication(a.userId)
    expect(before.interviewInvitedAt, 'تاريخُ دعوةٍ لم تُبعَث').toBeNull()

    await review.remindToBookInterview(a.id, adminId)

    const after = await apps.myApplication(a.userId)
    expect(after.interviewInvitedAt, 'دُعي ولا تعرف صفحتُه').toBeInstanceOf(Date)
    /* وأحدثُ دعوةٍ لا أقدمُها: من دُعي مرّتين يُقرأ آخرُ ما بُعث إليه */
    const first = after.interviewInvitedAt!
    await review.remindToBookInterview(a.id, adminId)
    const again = await apps.myApplication(a.userId)
    expect(again.interviewInvitedAt!.getTime(), 'يُقرأ أوّلُ ما بُعث لا آخرُه')
      .toBeGreaterThanOrEqual(first.getTime())
  })

  it('وطلبٌ لا وجود له يُردّ ٤٠٤ لا ٥٠٠', async () => {
    await expect(review.remindToBookInterview('00000000-0000-4000-8000-000000000000', adminId))
      .rejects.toMatchObject({ code: 'not_found' })
  })
})

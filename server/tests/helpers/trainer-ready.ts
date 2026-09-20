/* تجهيزُ مدرّبٍ للاعتماد — سقالةُ اختبارٍ لا مسارَ إنتاج.

   ═══ لماذا وُجدت ═══

   منذ ٢٠ سبتمبر ٢٠٢٦ صار بين «مقدَّم» و«نشط» بوّابةٌ من ثلاث خطوات: أتعابٌ
   سارية، ودورةٌ مؤهَّلٌ لها، وعقدٌ موقَّع (`src/application/trainer/readiness.ts`).
   وأكثرُ جولات هذا المجلّد لا تفحص الاعتمادَ أصلا — تحتاج **مدرّبا نشطا**
   لتفحص ما بعده: حسابَه البنكيَّ أو رحيلَه أو مساراتِه أو اقتراحاتِه. فكانت
   تبلغه بـ`decide('approve')` نقرةً واحدة، وصارت تُردّ بـ`not_ready`.

   فهذه تُتمّ الخطواتِ الثلاثَ بأقصر طريقٍ صحيح، لتبقى تلك الجولاتُ تفحص ما
   كُتبت لفحصه. والبوّابةُ نفسُها — منعُها وتجاوزُها — مفحوصةٌ في
   `server/tests/trainer/readiness-gate.test.ts` وحدَها.

   ═══ وما لا تفعله ═══

   لا تعتمد. تُجهّز فحسب، ويبقى `approve` في الجولة نفسِها ظاهرا — فمن قرأ
   الاختبارَ رأى أين يقع الاعتمادُ ومتى.

   ولا تكتب تأهيلا إن كان ثمّة تأهيلٌ مبذورٌ من الطلب: `conditionally_approve`
   تبذر ما ذكره المتقدّمُ من دورات الكتالوج، وإضافةُ دورةٍ فوقها تُفسد جولاتٍ
   تَعُدّ ما بُذر (`auto-qualification.test.ts`). فتُضاف دورةُ سقالةٍ حين لا
   يكون له تأهيلٌ أصلا لا غير. */

import type { PrismaClient } from '@prisma/client'
import { TrainerReviewService } from '../../services/trainer-review.service'

/** دورةُ السقالة — تُنشأ مرّةً في القاعدة وتُعاد بعدها */
const FIXTURE_COURSE = 'C-FIXTURE-RDY'

async function ensureFixtureCourse(prisma: PrismaClient): Promise<string> {
  const found = await prisma.course.findUnique({ where: { id: FIXTURE_COURSE } })
  if (!found) {
    await prisma.course.create({ data: { id: FIXTURE_COURSE, status: 'published', currentVersion: 1 } })
    await prisma.courseVersion.create({
      data: { courseId: FIXTURE_COURSE, version: 1, titleAr: 'دورةُ سقالةِ التجهيز', totalHours: 10 },
    })
  }
  return FIXTURE_COURSE
}

/**
 * يُتمّ خطواتِ التجهيز الثلاثَ فتُفتح بوّابةُ الاعتماد.
 *
 * يُنادى **قبل** `decide('approve')` مباشرةً. وهو آمنٌ يُعاد: من جُهّز مرّةً
 * لا يُضاعَف تجهيزُه.
 */
export async function makeReadyForApproval(
  prisma: PrismaClient,
  applicationId: string,
  actorId: string,
): Promise<{ profileId: string }> {
  const review = new TrainerReviewService(prisma)

  /* ① القبولُ الداخليُّ يُنشئ الملفَّ ويبذر مؤهّلاتِه من طلبه.
        ومن كان ملفُّه قائما (طلبٌ نشطٌ أصلا، أو تعيينٌ داخليّ) يُتخطّى. */
  let profile = await prisma.trainerProfile.findUnique({ where: { applicationId } })
  if (!profile) {
    await review.decide(applicationId, actorId, 'conditionally_approve')
    profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId } })
  }
  const profileId = profile.id

  /* ② اتّفاقٌ ماليٌّ عامُّ النطاقِ ساري — وهو ما تفحصه البوّابة */
  const liveRule = await prisma.trainerCompensationRule.findFirst({
    where: { profileId, courseId: null, cohortId: null, effectiveTo: null },
  })
  if (!liveRule) {
    await prisma.trainerCompensationRule.create({
      data: { profileId, type: 'per_seat', rate: 25, currency: 'USD', minSeats: 0 },
    })
  }

  /* ③ دورةٌ مؤهَّلٌ لها — ولا تُضاف فوق ما بُذر من طلبه */
  const qualified = await prisma.trainerCourseQualification.count({
    where: { profileId, status: 'qualified' },
  })
  if (qualified === 0) {
    const courseId = await ensureFixtureCourse(prisma)
    await prisma.trainerCourseQualification.create({
      data: { profileId, courseId, status: 'qualified' },
    })
  }

  /* ④ عقدٌ وقّعه */
  const signed = await prisma.trainerContract.findFirst({
    where: { profileId, status: { in: ['signed', 'countersigned'] } },
  })
  if (!signed) {
    await prisma.trainerContract.create({
      data: { profileId, title: 'عقدُ سقالةِ اختبار', status: 'signed' },
    })
  }

  /* ولا تُمسّ اقتراحاتُه: هي ملحوظةٌ لا مانع (انظر `noticeAr`)، والبتُّ فيها
     قرارٌ يخصّ جولةَ الاقتراحات وحدَها. */
  return { profileId }
}

/* شعبةٌ يقبلها التسجيل — سقالةُ اختبارٍ لا مسارَ إنتاج (١٢ أكتوبر ٢٠٢٦).

   ═══ لماذا وُجدت ═══

   قرارُ صاحب المنصّة: «أريد أن يظهر للعوامّ فقط الدورات التي لها مدرّبٌ
   واعتمدتُها أنا». فصارت الشعبةُ لا تُعرض ولا تُباع ولا يُسجَّل فيها إلّا
   باعتماد خطّة مدرّبها (`registration-window.ts`) — ولا استثناءَ لشعبةٍ لا
   خطّةَ لمدرّبها أصلا.

   وأكثرُ جولات الشراء والتسجيل لا تفحص الاعتمادَ أصلا: تحتاج شعبةً **تقبل**
   لتفحص ما بعدها — السلّةَ والخصمَ والفاتورةَ والمقعد. فكانت تُنشئ الصفَّ
   بعلمٍ مرفوعٍ ويكفي، وصار يُردّ «بلا مدرّبٍ معتمَد».

   فهذه تكتب ما يكتبه الاعتمادُ في الإنتاج بأقصر طريقٍ صحيح: خطّةَ مدرّبٍ
   حالتُها `approved`. والبوّابةُ نفسُها — منعُها وفتحُها — مفحوصةٌ في
   `server/tests/commerce/registration-window.test.ts` وحدَها.

   ═══ وما لا تفعله ═══

   لا تُسنِد المدرّبَ إلى الشعبة (`CohortTrainer`): الإسنادُ يجرّ مستحقّاتٍ
   ورابطَ دعوةٍ واسما عامّا، وجولةٌ لا تفحصها لا تُحمَّل أثرَها. والملفُّ بلا
   حساب: لا يُعَدّ في المستخدمين ولا يدخل أحدا. */

import type { PrismaClient } from '@prisma/client'

/** بريدُ مدرّب السقالة — يُعرَف به فيُنشأ مرّةً في القاعدة ويُعاد بعدها */
const FIXTURE_EMAIL = 'fixture-approved-trainer@test.local'

/** معرّفُ ملفّ مدرّب السقالة */
export async function fixtureTrainerId(prisma: PrismaClient): Promise<string> {
  const found = await prisma.trainerApplication.findFirst({
    where: { email: FIXTURE_EMAIL }, select: { profile: { select: { id: true } } },
  })
  if (found?.profile) return found.profile.id
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-FIXTURE-${Date.now()}`, fullName: 'مدرّبُ السقالة', email: FIXTURE_EMAIL, status: 'active' },
  })
  return (await prisma.trainerProfile.create({ data: { applicationId: application.id } })).id
}

/** حقولُ خطّةٍ معتمَدةٍ لمدرّبٍ بعينه — لجولةٍ لها مدرّبُها: الخطّةُ خطّتُه كما في الإنتاج */
export function approvedPlanBy(trainerId: string) {
  return {
    trainerId,
    status: 'approved',
    content: { kind: 'trainer', modules: [], resources: [] },
  }
}

/** حقولُ خطّة مدرّبٍ معتمَدة — تُمرَّر في `plans: { create: … }` مع إنشاء الشعبة */
export async function approvedTrainerPlan(prisma: PrismaClient) {
  return approvedPlanBy(await fixtureTrainerId(prisma))
}

/** أو تُكتب لشعبةٍ قائمة — لما يُنشئه مسارٌ لا تملك الجولةُ حقولَه */
export async function approveTrainerPlanFor(prisma: PrismaClient, cohortId: string): Promise<void> {
  await prisma.cohortDeliveryPlan.create({ data: { cohortId, ...(await approvedTrainerPlan(prisma)) } })
}

/* كتابةُ مصدر التسجيل — بابٌ واحدٌ يناديه كلُّ موضعٍ يُنشئ حسابا.

   الحسبةُ والتعليلُ في `src/application/marketing/signup-source.ts`. وهنا الكتابةُ وحدَها:
   ما أرسله المتصفّح يُنظَّف (`cleanTouch`) ثمّ يُكتب صفّا مع الحساب. وتعذّرُها لا يُسقط
   الإنشاء: حسابٌ بلا مصدرٍ خيرٌ من متعلّمٍ أو متقدّمٍ يُردّ لأنّ وسمَ حملته لم يُحفظ.

   ويقبل المعاملةَ كما يقبل العميل: المتقدّمُ للتدريب يُنشأ حسابُه داخل معاملة طلبه،
   فيُكتب مصدرُه فيها — فإن سقطت المعاملةُ لم يبقَ مصدرٌ لحسابٍ لم يوجد. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { cleanTouch } from '../../src/application/marketing/signup-source'

/** كيف أُنشئ الحساب: سجّل بنفسه · أضافه مدير · من نموذج التقدّم للتدريب · قُبل طلبُه مستشارا */
export type SignupVia = 'self' | 'admin' | 'trainer_application' | 'advisor_application'

export async function recordSignupSource(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
  via: SignupVia,
  source?: unknown,
): Promise<void> {
  const t = cleanTouch(source)
  const data = {
    userId, via,
    utmSource: t?.utmSource, utmMedium: t?.utmMedium, utmCampaign: t?.utmCampaign,
    utmContent: t?.utmContent, utmTerm: t?.utmTerm,
    channel: t?.channel, wave: t?.wave, refCode: t?.refCode,
    referrerHost: t?.referrerHost, landingPath: t?.landingPath,
    firstSeenAt: t?.at ? new Date(t.at) : null,
  }
  /* في معاملةٍ لا يُبتلع الخطأ: خطأُ PostgreSQL يُفسد المعاملةَ كلَّها، فابتلاعُه يُسقط ما
     بعده بخطأٍ لا يُفهم. والصفُّ مفتاحُه الحسابُ وحدَه، فلا تصادمَ في حسابٍ أُنشئ لتوّه. */
  const inTransaction = !('$transaction' in db)
  try {
    await db.signupSource.create({ data })
  } catch (e) {
    if (inTransaction) throw e
    /* أفضلُ جهد — والحسابُ قد أُنشئ */
  }
}

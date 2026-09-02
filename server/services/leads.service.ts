/* خدمة العملاء المحتملين — بريدُ زائرٍ لم يُسجَّل، مقابل كود خصمٍ لا حساب.

   بديلُ صندوق التسجيل الكامل الذي حُذف من صفحتي المسار والتشخيص: الزائر
   يرى كل شيء بلا حاجز، وهذا هو السبيل الوحيد الباقي لالتقاط إشارة تسويقية
   عمّن تصفّح ولم يشترِ. لا يُنشئ حسابا ولا يطلب شيئا سوى البريد. */

import type { PrismaClient } from '@prisma/client'
import { FIRST_TIME_PROMO } from '../../src/application/commerce/first-time-promo'
import { sendDiscountCodeEmail } from './account-mail'

export async function captureDiscountLead(
  prisma: PrismaClient,
  input: { email: string; source: string; pathwayId?: string },
): Promise<{ code: string; percentOff: number }> {
  const email = input.email.trim().toLowerCase()
  await prisma.marketingLead.upsert({
    where: { email },
    update: { source: input.source, pathwayId: input.pathwayId ?? null, lastSeenAt: new Date() },
    create: { email, source: input.source, pathwayId: input.pathwayId ?? null },
  })
  /* أفضل جهد — تُنتظَر (لا نُطلقها بلا انتظار: البيئة بلا خادوم قد تُنهي
     العملية فور الرد) لكن فشلها لا يُسقط التقاط الإشارة ولا يمنع الردّ؛
     `sendDirectEmail` لا يرمي أبدا — يعيد حالة الفشل بدل ذلك */
  await sendDiscountCodeEmail(prisma, { to: email })
  return { code: FIRST_TIME_PROMO.code, percentOff: FIRST_TIME_PROMO.percentOff }
}

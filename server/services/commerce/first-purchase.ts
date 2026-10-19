/* «لأوّل عملية شراء» — الوعدُ صار قيدا (١٩ أكتوبر ٢٠٢٦).

   كودُ التشجيع (`FIRST_TIME_PROMO`) يُعرض على أربع صفحاتٍ «لأول عملية شراء»، ورأسُ ملفّه يقول
   «القيد يُطبَّق عند الفوترة» — ولم يكن في الفوترة قيد: يقبله كلُّ حسابٍ في كلّ شراءٍ بلا حدّ.
   وخُيّر صاحبُ المنصّة بين أن يُقيَّد كما يقول نصُّه، أو يُفتح ويُصحَّح النصّ، أو يُرفع —
   فاختار الأوّل.

   و«الشراءُ» طلبٌ دُفع فيه مالٌ ولو رُدّ بعدُ: الردُّ لا يجعل الشراءَ الثاني أوّلا. وما دُفع
   بصفرٍ (هديّةٌ أو كوبونٌ كامل) ليس شراءً. وطلبٌ ينتظر الدفعَ بالكود نفسِه يحجزه — فلا
   يُستعمل في طلبين معا ثمّ يُدفعان. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from '../auth.service'
import { FIRST_TIME_PROMO } from '../../../src/application/commerce/first-time-promo'

const PAID_ONCE = ['paid', 'partially_refunded', 'refunded']

export async function assertFirstPurchase(
  db: PrismaClient | Prisma.TransactionClient,
  coupon: { id: string; code: string },
  userId: string,
): Promise<void> {
  if (coupon.code !== FIRST_TIME_PROMO.code) return
  const bought = await db.order.findFirst({
    where: { userId, status: { in: PAID_ONCE }, total: { gt: 0 } }, select: { id: true },
  })
  if (bought) throw new AuthError('bad_coupon', `كود ${FIRST_TIME_PROMO.code} لأول عملية شراء فقط، وقد اشتريت من قبل.`)
  const pending = await db.order.findFirst({
    where: { userId, status: 'pending_payment', couponId: coupon.id }, select: { id: true },
  })
  if (pending) throw new AuthError('bad_coupon', `كود ${FIRST_TIME_PROMO.code} في طلب لم يكتمل دفعه. أتممه من «فواتيري»، أو اشتر بدون الكود.`)
}

/** أيُخصم له الكودُ الآن؟ — تسألها صفحةُ الدورة قبل أن تطرح الخصمَ من السعر المعروض، فلا تَعِد
    بسعرٍ يردّه لوحُ الدفع. والجوابُ من الفحص نفسِه الذي تفحص به الفوترة، لا من نسخةٍ في الواجهة. */
export async function firstPurchasePromoFor(
  db: PrismaClient, userId: string,
): Promise<{ eligible: true } | { eligible: false; reasonAr: string }> {
  const coupon = await db.coupon.findUnique({ where: { code: FIRST_TIME_PROMO.code }, select: { id: true, code: true, active: true } })
  if (!coupon?.active) return { eligible: false, reasonAr: 'الكوبون غير صالح' }
  try {
    await assertFirstPurchase(db, coupon, userId)
    return { eligible: true }
  } catch (e) {
    if (e instanceof AuthError) return { eligible: false, reasonAr: e.message }
    throw e
  }
}

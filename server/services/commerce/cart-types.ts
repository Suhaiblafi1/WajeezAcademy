/* ما تشترك فيه السلّةُ وحركةُ المال — في ملفٍّ لا يعتمد على أيٍّ منهما.

   وُلد هذا الملفّ من قطعِ `commerce.service` (كان ألفا ومئةً وواحدا وتسعين
   سطرا): لو بقيت هذه اللبِناتُ هناك لصار الاستيرادُ حلقةً — السلّةُ تستورد
   من الخدمة، والخدمةُ تستورد السلّة. فالمشتركُ ينزل إلى ملفٍّ ثالثٍ لا يستورد
   من أحدهما. */

import type { Prisma } from '@prisma/client'
import { AuthError } from '../auth.service'

export const num = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0)

/* الشعبةُ كما تلزم السلّة — بدورتها وآخر إصدارٍ منها، ليُبنى عنوانُ البند.
   والعنوانُ يُبنى مرّةً واحدة هنا: `quote` و`checkout` يعرضان النصَّ نفسَه،
   فلا يقرأ المشتري في الفاتورة اسما غيرَ الذي رآه على اللوح. */
export type CartCohort = Prisma.CohortGetPayload<{
  include: { course: { include: { versions: true } } }
}>

export const cartTitleOf = (c: CartCohort) =>
  `${c.course.versions[0]?.titleAr ?? c.courseId} — ${c.title}`

/* صلاحيةُ الكوبون — فحصٌ واحد لثلاثة مواضع شراء.

   كان منسوخا ثلاث مرّات (خطّة، سلّة، شعبةٌ واحدة)، فأيُّ شرطٍ يُضاف في
   واحدٍ يُنسى في اثنين. وقد حدث ذلك فعلا حين صار للكوبون قصرٌ على عميل:
   قصرٌ لا يُفحص عند الاستعمال زينةٌ في القاعدة — يكفي أن يقرأ العميل رمزه
   في فاتورته ويرسله إلى عشرة. */
export interface UsableCoupon {
  active: boolean
  expiresAt: Date | null
  maxUses: number | null
  usedCount: number
  restrictedToUserId: string | null
}

export function assertCouponUsable(coupon: UsableCoupon | null, userId: string): void {
  if (!coupon || !coupon.active) throw new AuthError('bad_coupon', 'الكوبون غير صالح')
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new AuthError('bad_coupon', 'الكوبون منتهي')
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new AuthError('bad_coupon', 'استنفد الكوبون عدد استخداماته')
  if (coupon.restrictedToUserId && coupon.restrictedToUserId !== userId) {
    throw new AuthError('bad_coupon', 'هذا الكوبون ليس لحسابك')
  }
}

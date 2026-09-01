/* حسابُ السلّة — الموضعُ الوحيد الذي يتحوّل فيه سعرُ القائمة إلى مبلغٍ يُقتطع.

   كانت الصفحةُ تَعِد بثلاثة والخادمُ يفي بواحد:

     · «خصم بناء المسار — ٢٠٪» و«يصل إلى ٢٥٪» — والخادمُ **لا يعرف السلّم**.
     · «ودورةٌ من اختيارك هديّة» — و`giftCourseId` **رايةُ عرضٍ** تُظهر شارةً
       في الخطّة، والدورةُ تُحاسَب بسعرها الكامل.
     · «١٠٪ لأوّل شراء بالكود WA2026» — والواجهةُ **لا ترسل الكود أصلا**.

   ولم يظهر شيءٌ من هذا لأنّ الشراء كان يمرّ بـ«طلب تسجيل» يراجعه إنسانٌ
   ويُصدر الفاتورة بيده. ومع الدفع المباشر تُقتطع الأرقامُ من البطاقة، فيرى
   المشتري على صفحة المزوّد رقما غيرَ الذي وعدته الصفحة.

   فالحسابُ كلُّه هنا، ويناديه الخادمُ في موضعين لا ثالثَ لهما: `quote` الذي
   يُعرض على الشاشة، و`checkout` الذي يكتب الطلب. وهما نداءٌ واحد لدالّةٍ
   واحدة — فلا يفترق المعروضُ عن المُصدَر بنيةً لا باتّفاق.

   والترتيبُ مقصود: **الباقةُ أوّلا ثمّ الكودُ على الباقي**، وهو ما تقوله
   سياسةُ الخصومات حرفيّا: «كود واحد فوق الناتج».

   الحارس: server/tests/commerce/cart-pricing.test.ts */

import { buildDiscountPct } from './discount-policy'

/** بندٌ في السلّة قبل الحساب — سعرُ القائمة كما في الشعبة */
export interface CartLine {
  cohortId: string
  courseId: string
  titleAr: string
  listPrice: number
}

/** ما يلزم من الكوبون للحساب — لا صلاحيّتَه، فتلك تُفحص قبلَه */
export interface CartCoupon {
  percentOff: number | null
  amountOff: number | null
}

export interface PricedLine extends CartLine {
  /** ما يدخل الفاتورة فعلا — صفرٌ للهديّة */
  unitPrice: number
  isGift: boolean
}

export interface CartPricing {
  lines: PricedLine[]
  /** عددُ الدورات المدفوعة — وعليه وحدَه يُحسب سلّم الباقة */
  paidCount: number
  /** مجموعُ أسعار القائمة شاملا الهديّة — ليُرى ما وُفِّر، ولا يدخل الحساب */
  listTotal: number
  subtotal: number
  bundlePct: number
  bundleDiscount: number
  couponDiscount: number
  discount: number
  total: number
}

/** تقريبٌ إلى أصغر وحدةٍ في العملة — لا «تدوير جميل» في مبلغٍ يُقتطع */
const money = (n: number) => Math.round(n * 100) / 100

export function priceCart(
  lines: readonly CartLine[],
  giftCourseId: string | null,
  coupon: CartCoupon | null,
): CartPricing {
  /* الهديّةُ بندٌ بصفر لا بندٌ محذوف: تبقى في الفاتورة ليقرأ المشتري أنّه
     أخذها، ويقرأ الخادمُ أنّه استحقّها. وحذفُها من البنود يُخفي الوعدَ عن
     الورقة الوحيدة التي تُحفظ منه. */
  const priced: PricedLine[] = lines.map((l) => {
    const isGift = giftCourseId !== null && l.courseId === giftCourseId
    return { ...l, isGift, unitPrice: isGift ? 0 : l.listPrice }
  })

  const paid = priced.filter((l) => !l.isGift)
  const subtotal = money(paid.reduce((s, l) => s + l.unitPrice, 0))
  const listTotal = money(priced.reduce((s, l) => s + l.listPrice, 0))

  /* السلّمُ على عدد المدفوع لا على عدد البنود: عدُّ الهديّة يرفع الخصمَ على
     ما يُدفع بسببِ ما لا يُدفع — فيُخصم مرّتين عن شيءٍ واحد. */
  const bundlePct = buildDiscountPct(paid.length)
  const bundleDiscount = money((subtotal * bundlePct) / 100)
  const afterBundle = money(subtotal - bundleDiscount)

  let couponDiscount = 0
  if (coupon) {
    couponDiscount = coupon.percentOff
      ? money((afterBundle * coupon.percentOff) / 100)
      : money(coupon.amountOff ?? 0)
    if (couponDiscount > afterBundle) couponDiscount = afterBundle
  }

  const discount = money(bundleDiscount + couponDiscount)
  return {
    lines: priced,
    paidCount: paid.length,
    listTotal,
    subtotal,
    bundlePct,
    bundleDiscount,
    couponDiscount,
    discount,
    total: money(Math.max(0, subtotal - discount)),
  }
}

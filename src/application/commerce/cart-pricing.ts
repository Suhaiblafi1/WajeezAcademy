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

   والترتيبُ مقصود: **الباقةُ أوّلا، ثمّ سقفُ المبلغ، ثمّ الكودُ على الباقي**.
   وهو ما تقوله سياسةُ الخصومات حرفيّا: «كود واحد فوق الناتج». والسقفُ قبل
   الكود لا بعده: هو حدُّ **سعرِ المسار**، لا حدُّ ما يدفعه صاحبُ كودٍ — ولو
   جاء بعده لَابتلع الكودَ كلَّه فوق السقف فصار الكودُ بلا أثرٍ لمن استحقّه.

   ═══ وكودُ المدرّب على دوراته وحدَها (٢٧ سبتمبر ٢٠٢٦) ═══

   الكوبونُ كان يقع على السلّة كلِّها. وكودُ المدرّب يحسم **من مستحقّاته**،
   فلو وقع على السلّة كلِّها لتحمّل عن دوراتِ مدرّبين غيره — وقرارُ صاحب
   المنصّة صريح: «لدوراته وحدَها، إن اشترى أحدٌ دوراتٍ أخرى مع مدرّبين غيره».
   فصار للكوبون **نطاقٌ** اختياريّ (`cohortIds`): بلا نطاقٍ يعمّ كما كان، وبه
   يقع على حصّة تلك الشعب ممّا بقي بعد الباقة والسقف — بنسبة سعرها من المجموع.

   الحارس: server/tests/commerce/cart-pricing.test.ts
   ونطاقُ الكود: src/tests/commerce/scoped-coupon.test.ts */

import { buildDiscountPct, bundleCapDiscount, money, MAX_BUNDLE_TOTAL_CURRENCY } from './discount-policy'

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
  /** الشعبُ التي يقع عليها وحدَها — كودُ المدرّب على دوراته. وبلا قيمةٍ يعمّ
      السلّةَ كما كان كلُّ كوبون. */
  cohortIds?: readonly string[] | null
  /** أقصى ما يمنحه بالمئة من وعائه — سقفُ كود المدرّب (٣٠) على وجهَيه، نسبةً
      ومبلغا. وبلا قيمةٍ لا سقفَ غيرُ الوعاء نفسِه، كما كان كلُّ كوبون. */
  maxPercentOfBase?: number | null
}

export interface PricedLine extends CartLine {
  /** ما يدخل الفاتورة فعلا — صفرٌ للهديّة */
  unitPrice: number
  isGift: boolean
  /** أوقع عليها الكوبون؟ — ليُرى أيُّ الدورات خصمها كودُ المدرّب */
  couponApplies: boolean
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
  /** ما اقتُطع بحكم سقف مبلغ السلّة — صفرٌ في السواد الأعظم من السلال */
  capDiscount: number
  couponDiscount: number
  /** عددُ الدورات المدفوعة التي وقع عليها الكوبون — صفرٌ يعني أنّ الكودَ لا
      يخصّ شيئا في هذه السلّة، فيُقال ذلك للمشتري لا يُقبَل صامتا */
  couponLines: number
  discount: number
  total: number
}

export function priceCart(
  lines: readonly CartLine[],
  giftCourseId: string | null,
  coupon: CartCoupon | null,
  /* عملةُ السلّة — يمنعها الخادمُ أن تختلط، فهي واحدةٌ للسلّة كلِّها.
     ويلزم هنا لأنّ السقفَ مبلغٌ لا نسبة: «٦٠٠» بلا عملةٍ رقمٌ بلا معنى. */
  currency: string = MAX_BUNDLE_TOTAL_CURRENCY,
): CartPricing {
  /* الهديّةُ بندٌ بصفر لا بندٌ محذوف: تبقى في الفاتورة ليقرأ المشتري أنّه
     أخذها، ويقرأ الخادمُ أنّه استحقّها. وحذفُها من البنود يُخفي الوعدَ عن
     الورقة الوحيدة التي تُحفظ منه. */
  const scope = coupon?.cohortIds ? new Set(coupon.cohortIds) : null
  const priced: PricedLine[] = lines.map((l) => {
    const isGift = giftCourseId !== null && l.courseId === giftCourseId
    /* الهديّةُ لا يقع عليها كوبون: سعرُها صفرٌ فلا شيءَ يُخصم منه */
    const couponApplies = coupon !== null && !isGift && (scope === null || scope.has(l.cohortId))
    return { ...l, isGift, unitPrice: isGift ? 0 : l.listPrice, couponApplies }
  })

  const paid = priced.filter((l) => !l.isGift)
  const subtotal = money(paid.reduce((s, l) => s + l.unitPrice, 0))
  const listTotal = money(priced.reduce((s, l) => s + l.listPrice, 0))

  /* السلّمُ على عدد المدفوع لا على عدد البنود: عدُّ الهديّة يرفع الخصمَ على
     ما يُدفع بسببِ ما لا يُدفع — فيُخصم مرّتين عن شيءٍ واحد. */
  const bundlePct = buildDiscountPct(paid.length)
  const bundleDiscount = money((subtotal * bundlePct) / 100)

  /* سقفُ المبلغ بندٌ ثانٍ مستقلّ لا نسبةٌ ثالثة: «خصم الباقة ٣٠٪» و«حدّ سعر
     المسار» سببان مختلفان يُقرآن في الفاتورة كلٌّ باسمه. */
  const capDiscount = money(bundleCapDiscount(money(subtotal - bundleDiscount), currency))
  const afterBundle = money(subtotal - bundleDiscount - capDiscount)

  let couponDiscount = 0
  const couponed = paid.filter((l) => l.couponApplies)
  if (coupon && couponed.length > 0) {
    /* وعاءُ الكوبون: ما بقي بعد الباقة والسقف — كلُّه لكوبونٍ عامّ، وحصّةُ
       شعب النطاق منه لكودِ مدرّب. والحصّةُ بنسبة السعر: خصمُ الباقة نسبةٌ
       تقع على كلّ بندٍ بقدره، والسقفُ يُوزَّع كذلك — فلا تتحمّل دورتُه من
       خصوم الأكاديميّة أقلَّ من غيرها ولا أكثر.

       والعامُّ يأخذ `afterBundle` نفسَه لا حاصلَ ضربٍ وقسمة: `x·s/s` قد يفترق
       عن `x` في آخر منزلة، فيقلب تقريبَ قرشٍ في كوبونٍ لم يتغيّر فيه شيء. */
    const base = scope === null
      ? afterBundle
      : subtotal > 0 ? (afterBundle * couponed.reduce((s, l) => s + l.unitPrice, 0)) / subtotal : 0
    couponDiscount = coupon.percentOff
      ? money((base * coupon.percentOff) / 100)
      : money(coupon.amountOff ?? 0)
    /* ═══ وسقفُ كود المدرّب على الوجهين (١ أكتوبر ٢٠٢٦) ═══
       النسبةُ مقيّدةٌ بالثلاثين في قاعدتها فلا يمسّها هذا، والمبلغُ كان يتخطّاه:
       خمسون دولارا على دورةٍ بستّين خصمُ ٨٣٪. فيُسقَف هنا — في الدالّة التي
       يناديها العرضُ والطلبُ معا — فلا يفترق ما يُرى عمّا يُقتطع. */
    if (coupon.maxPercentOfBase != null) {
      couponDiscount = Math.min(couponDiscount, money((base * coupon.maxPercentOfBase) / 100))
    }
    if (couponDiscount > money(base)) couponDiscount = money(base)
  }

  const discount = money(bundleDiscount + capDiscount + couponDiscount)
  return {
    lines: priced,
    paidCount: paid.length,
    listTotal,
    subtotal,
    bundlePct,
    bundleDiscount,
    capDiscount,
    couponDiscount,
    couponLines: couponed.length,
    discount,
    total: money(Math.max(0, subtotal - discount)),
  }
}

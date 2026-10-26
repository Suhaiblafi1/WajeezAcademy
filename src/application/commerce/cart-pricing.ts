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

   ═══ وخصمُ الخطّة كاملةً محفوظٌ لمن اشتراها على دفعات (١٢ أكتوبر ٢٠٢٦) ═══

   مشتري التشخيص تُقترح له خطّةٌ من أربع دورات، وبعضُها بلا شعبةٍ بعد. فيشتري
   ما فُتح اليوم بسلّم دورتين (٨٪)، ويشتري الباقيتين حين تُفتحان بسلّم دورتين
   أيضا — ولو اشتراها كلَّها معا لكان خصمُه ٢٨٪. فيدفع ثمنَ غيابِ شعبٍ لم نفتحها.

   وقرارُ صاحب المنصّة («أ٢»): لا يُعطى خصمُ الخطّة كاملةً اليوم على ما يشتريه
   وحدَه — وإلّا صار بابا: خطّةٌ من خمسٍ بلا شعبٍ ودورةٌ واحدةٌ بثلاثين بالمئة. بل
   يشتري اليومَ بسلّمه، فإذا اشترى من الخطّة نفسِها لاحقا **خُصم من فاتورته ما
   فاته** حتّى تبلغ الخطّةُ كلُّها سعرَها لو اشتُريت معا (`bundlePayable` على
   مجموعها وعددها، بالسقف نفسِه). فالخصمُ الكاملُ لمن اشترى الخطّةَ كاملةً فقط.

   وهو بندٌ رابعٌ مستقلّ (`planCredit`) بعد الباقة والسقف وقبل الكوبون: الكوبونُ
   طبقةٌ فوق سعر الباقة، فلا يُقاصَّ به ما فات من خصمها.

   ═══ وكودُ المنحة بدلُ الباقة لا فوقها (٢٠ أكتوبر ٢٠٢٦) ═══

   «منحة أعضاء وجيز» نسبةٌ من سعر القائمة (٦٠٪ يوم كُتب، ويغيّرها صاحبُ المنصّة متى شاء).
   وقرارُه («A»): لا تجتمع مع سلّم الباقة — يدفع صاحبُها نسبةً ثابتةً من السعر أيّا كان عددُ
   الدورات. فإن كان سعرُ الباقة في سلّةٍ أقلَّ من سعر المنحة (سقفُ المبلغ على سلّةٍ كبيرة، أو
   نسبةُ منحةٍ صغيرة) **دفع الأقلَّ** ولم يُحرق الكود: `grantBeaten` يقوله، والخادمُ يردّه.
   فلا يدفع أحدٌ بكود المنحة أكثرَ ممّا يدفعه بلا كود.

   الحارس: server/tests/commerce/cart-pricing.test.ts
   ونطاقُ الكود: src/tests/commerce/scoped-coupon.test.ts
   وكودُ أوّل شراء على أغلى دورة: src/tests/commerce/first-purchase-top-line.test.ts
   وخصمُ إكمال الخطّة: src/tests/commerce/plan-carry.test.ts
   وكودُ المنحة: src/tests/commerce/grant-pricing.test.ts */

import { buildDiscountPct, bundleCapDiscount, bundlePayable, money, MAX_BUNDLE_TOTAL_CURRENCY } from './discount-policy'

/** ما اشتُري من الخطّة في طلباتٍ سابقة — يحسبه الخادمُ من الطلبات المدفوعة */
export interface PlanCarry {
  /** دوراتُ الخطّة المدفوعة (غيرُ الهديّة) — ما وقع منها في هذه السلّة يُكمل الخطّة */
  planCourseIds: readonly string[]
  /** كم دورةً من الخطّة اشتُريت من قبل (خارجَ هذه السلّة) */
  boughtCount: number
  /** مجموعُ أسعارها كما فوترت */
  boughtList: number
  /** ما خُصم عنها بحكم الباقة وسقفِها وخصمِ الإكمال — بلا الكوبون */
  boughtReceived: number
}

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
  /** كودُ منحة: نسبتُه من مجموع السلّة بدلَ السلّم والسقف وخصم الإكمال — لا فوقها.
      ويقع على السلّة كلِّها، ولا يُجمع مع `cohortIds`. */
  replacesBundle?: boolean
  /** يقع على الدورة الأعلى سعرا وحدَها — كودُ أوّل شراء. ويُجمع مع الباقة كأيّ كود،
      لكنّ وعاءَه حصّةُ تلك الدورة ممّا بقي بعدها لا السلّةُ كلُّها. */
  topLineOnly?: boolean
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
  /** خصمُ إكمال الخطّة: ما فاته من خصمها في دفعاتٍ سابقة — صفرٌ في أوّل دفعة */
  planCredit: number
  couponDiscount: number
  /** عددُ الدورات المدفوعة التي وقع عليها الكوبون — صفرٌ يعني أنّ الكودَ لا
      يخصّ شيئا في هذه السلّة، فيُقال ذلك للمشتري لا يُقبَل صامتا */
  couponLines: number
  /** كودُ منحةٍ سعرُ الباقة في هذه السلّة أقلُّ منه — فيدفع سعرَ الباقة ولا يُستعمل الكود */
  grantBeaten: boolean
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
  /* ما اشتُري من الخطّة من قبل — وبلا قيمةٍ لا خصمَ إكمال، كما كانت كلُّ سلّة */
  carry: PlanCarry | null = null,
): CartPricing {
  /* الهديّةُ بندٌ بصفر لا بندٌ محذوف: تبقى في الفاتورة ليقرأ المشتري أنّه
     أخذها، ويقرأ الخادمُ أنّه استحقّها. وحذفُها من البنود يُخفي الوعدَ عن
     الورقة الوحيدة التي تُحفظ منه. */
  let scope: Set<string> | null = coupon?.cohortIds ? new Set(coupon.cohortIds) : null
  /* ═══ وكودُ أوّل شراء على الدورة الأعلى سعرا وحدَها (٢٦ أكتوبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة: «يخصم من الدورة الأعلى سعرا فقط» إن اختار أكثر من دورة. فيصير نطاقُه
     شعبةً واحدة — أغلى المدفوع، وأوّلُها عند التساوي — ويُحسب وعاؤه كما يُحسب لكود المدرّب:
     حصّتُها ممّا بقي بعد الباقة والسقف. */
  if (coupon?.topLineOnly) {
    const top = lines
      .filter((l) => (giftCourseId === null || l.courseId !== giftCourseId) && (scope === null || scope.has(l.cohortId)))
      .reduce<CartLine | null>((best, l) => (best === null || l.listPrice > best.listPrice ? l : best), null)
    scope = new Set(top ? [top.cohortId] : [])
  }
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
  let bundlePct = buildDiscountPct(paid.length)
  let bundleDiscount = money((subtotal * bundlePct) / 100)

  /* سقفُ المبلغ بندٌ ثانٍ مستقلّ لا نسبةٌ ثالثة: «خصم الباقة ٣٠٪» و«حدّ سعر
     المسار» سببان مختلفان يُقرآن في الفاتورة كلٌّ باسمه. */
  let capDiscount = money(bundleCapDiscount(money(subtotal - bundleDiscount), currency))

  /* خصمُ إكمال الخطّة: ما كانت ستبلغه الخطّةُ (ما اشتُري منها مع ما في السلّة)
     لو اشتُريت معا، ناقصا ما خُصم عن السابق وما يُخصم عن بنودها هنا بالسلّم.
     ولا يقلّ عن صفر — فلا تُحمَّل سلّةٌ ما زاد عن خصمٍ قديم. */
  let planCredit = 0
  if (carry && carry.boughtCount > 0 && subtotal > 0) {
    const planSet = new Set(carry.planCourseIds)
    const planPaid = paid.filter((l) => planSet.has(l.courseId))
    if (planPaid.length > 0) {
      const planSub = money(planPaid.reduce((s, l) => s + l.unitPrice, 0))
      const whole = money(carry.boughtList + planSub)
      const ideal = money(whole - bundlePayable(whole, carry.boughtCount + planPaid.length, currency))
      /* ما يناله السلّمُ والسقفُ هنا على بنود الخطّة — بحصّتها من السلّة */
      const normalHere = ((bundleDiscount + capDiscount) * planSub) / subtotal
      planCredit = money(Math.max(0, ideal - carry.boughtReceived - normalHere))
      planCredit = Math.min(planCredit, money(subtotal - bundleDiscount - capDiscount))
    }
  }
  const afterBundle = money(subtotal - bundleDiscount - capDiscount - planCredit)

  let couponDiscount = 0
  let grantBeaten = false
  const couponed = paid.filter((l) => l.couponApplies)
  if (coupon?.replacesBundle) {
    /* المنحةُ على مجموع السلّة لا على ما بعد الباقة — هي بدلُها. وتغلب حين تُعطي أكثر،
       فتُصفَّر بنودُ الباقة الثلاثة ويُقرأ في الفاتورة بندٌ واحد باسمها. */
    if (couponed.length > 0) {
      const grant = money((subtotal * (coupon.percentOff ?? 0)) / 100)
      if (grant > money(bundleDiscount + capDiscount + planCredit)) {
        bundlePct = 0
        bundleDiscount = 0
        capDiscount = 0
        planCredit = 0
        couponDiscount = Math.min(grant, subtotal)
      } else {
        grantBeaten = true
      }
    }
  } else if (coupon && couponed.length > 0) {
    /* وعاءُ الكوبون: ما بقي بعد الباقة والسقف — كلُّه لكوبونٍ عامّ، وحصّةُ
       شعب النطاق منه لكودِ مدرّب. والحصّةُ بنسبة السعر: خصمُ الباقة نسبةٌ
       تقع على كلّ بندٍ بقدره، والسقفُ يُوزَّع كذلك — فلا تتحمّل دورتُه من
       خصوم الأكاديميّة أقلَّ من غيرها ولا أكثر.

       والعامُّ يأخذ `afterBundle` نفسَه لا حاصلَ ضربٍ وقسمة: `x·s/s` قد يفترق
       عن `x` في آخر منزلة، فيقلب تقريبَ قرشٍ في كوبونٍ لم يتغيّر فيه شيء. */
    const scoped = money(couponed.reduce((s, l) => s + l.unitPrice, 0))
    const base = scope === null || scoped === subtotal
      ? afterBundle
      : subtotal > 0 ? (afterBundle * scoped) / subtotal : 0
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

  const discount = money(bundleDiscount + capDiscount + planCredit + couponDiscount)
  return {
    lines: priced,
    paidCount: paid.length,
    listTotal,
    subtotal,
    bundlePct,
    bundleDiscount,
    capDiscount,
    planCredit,
    couponDiscount,
    couponLines: couponed.length,
    grantBeaten,
    discount,
    total: money(Math.max(0, subtotal - discount)),
  }
}

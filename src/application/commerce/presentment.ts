/* عملةُ العرض عند الدفع — وثلاثٌ لا أكثر، ولكلٍّ منها سبب.

   الحسابُ كلُّه بالدولار: الكتالوج، والشعبة، والطلب، والفاتورة، وما يُعرض في
   المنصّة. وهذا لا يتغيّر. وما يتغيّر موضعٌ واحد: **بأيّ عملةٍ تُقتطع البطاقة**،
   ويختارها المشتري في لحظة الدفع وحدَها.

   ولماذا هذه الثلاث دون غيرها:

   · **الدولار** — عملةُ الحساب نفسِها، فلا تحويلَ ولا فرق.
   · **الدرهم الإماراتيّ** و**الريال السعوديّ** — **مربوطان بالدولار بسعرٍ
     رسميّ ثابت** لا يعوم: ٣٫٦٧٢٥ درهما و٣٫٧٥ ريالا للدولار. فالتحويلُ بهما
     حسابٌ مضبوط لا تقدير، ولا يحتاج مصدرَ أسعارٍ حيّا ولا يشيخ.

   وما استُبعد استُبعد لسببه لا لإهماله:

   · **الدينار الأردنيّ** مربوطٌ أيضا، لكنّ حسابَ Stripe لدينا أمريكيّ ولا
     يقبل `jod` أصلا — جُرّب فرُفض. فعرضُه وعدٌ يفشل عند أوّل بطاقة.
   · **الجنيه المصريّ** و**الليرة** ونظائرُهما **تعوم**، فسعرُ اليوم ليس سعرَ
     الغد. وتثبيتُ رقمٍ لها في الشيفرة يعني أن نبيع بخسارةٍ أو بغبنٍ صامت،
     ويكتشفه صاحبُ المنصّة من كشف حسابه لا من شاشته.

   ولا **تدوير**. في خدمة العرض القديمة كان الرقم يُدوَّر إلى أقرب خمسة ليبدو
   جميلا — وهو مقبولٌ في مُلصَق سعرٍ تقريبيّ، ومحرَّمٌ في مبلغٍ يُقتطع: الجميلُ
   هناك يعني أن يدفع المشتري غيرَ ما وُعد به. فالتحويلُ هنا يُقرَّب إلى أصغر
   وحدةٍ في العملة، ولا شيءَ بعد ذلك.

   الحارس: server/tests/commerce/presentment.test.ts */

/** عملةُ الدفتر — كلُّ ما يُخزَّن ويُعرض ويُقارَن بها، بلا استثناء.

    كانت سبعةُ نماذج في المخطّط تفترض الدينارَ الأردنيّ افتراضا
    (`@default("JOD")`) — منها `Cohort` و`Order` و`Invoice` و`Payment`، أي
    مسلكُ المال كلُّه. وخمسةُ مواضع في الخدمات تسقط إليه (`?? 'JOD'`).
    والكتالوجُ مسعَّرٌ بالدولار مئةً بالمئة.

    فأيُّ صفٍّ يُنشأ بلا عملةٍ صريحة كان يُولد بعملةٍ لا يبيع بها أحد. ولم
    يكن يُرمى له خطأ: يُخزَّن، ويُعرض، ويُجمع مع غيره — ويُكتشف عند أوّل
    بطاقةٍ ترفضه (حسابُ Stripe لدينا أمريكيّ ولا يقبل `jod` أصلا).

    فصار الافتراضُ هنا وحدَه، وهو ما يُقاس عليه المخطّطُ والخدمات معا. */
export const LEDGER_CURRENCY = 'USD'

export interface PresentmentInfo {
  /** كم وحدةً من هذه العملة في الدولار الواحد — سعرُ ربطٍ رسميّ ثابت */
  perUsd: number
  labelAr: string
  /** اسمُها معرَّفا — «الدولار الأمريكي» لا «ال» + `labelAr`.
   *
   *  فالتعريفُ في العربيّة يدخل الموصوفَ وصفتَه معا، و«ال»+«دولار أمريكي»
   *  تُخرج «الدولار أمريكي». ولا يُشتقّ بقاعدةٍ تُكتب هنا: يُكتب كما يُنطَق. */
  labelDefiniteAr: string
  symbol: string
  /** ═══ أيتقدّم الرمزُ الرقمَ؟ (٢٩ سبتمبر ٢٠٢٦) ═══

      «$30» للدولار و«30 ر.س» لغيره — وهو عُرفُ كلِّ عملةٍ لا اختيارُنا.

      وكان هذا الشرطُ مكتوبا في `formatPresentment` وحدَها (`code === 'USD'`)،
      فمن أضاف عملةً يتقدّم رمزُها لم يجد له موضعا يُعلنه فيه، ومن كتب صائغا
      ثانيا أعاد الشرطَ بيده — فينطق الموضعان بنطقَين. فصار خاصّيّةً في
      الجدول، تقرؤها الصائغتان كلتاهما. */
  symbolBefore: boolean
}

export const PRESENTMENT_CURRENCIES = {
  USD: { perUsd: 1, labelAr: 'دولار أمريكي', labelDefiniteAr: 'الدولار الأمريكي', symbol: '$', symbolBefore: true },
  AED: { perUsd: 3.6725, labelAr: 'درهم إماراتي', labelDefiniteAr: 'الدرهم الإماراتي', symbol: 'د.إ', symbolBefore: false },
  SAR: { perUsd: 3.75, labelAr: 'ريال سعودي', labelDefiniteAr: 'الريال السعودي', symbol: 'ر.س', symbolBefore: false },
} as const satisfies Record<string, PresentmentInfo>

export type PresentmentCurrency = keyof typeof PRESENTMENT_CURRENCIES

export const PRESENTMENT_CODES = Object.keys(PRESENTMENT_CURRENCIES) as PresentmentCurrency[]

export function isPresentmentCurrency(code: string): code is PresentmentCurrency {
  return Object.hasOwn(PRESENTMENT_CURRENCIES, code)
}

/** كم وحدةً صغرى في الوحدة الكبرى — الثلاثُ مئويّةٌ كلُّها */
const MINOR_PER_MAJOR = 100

/** يحوّل مبلغا بالدولار إلى عملة العرض، مقرَّبا إلى أصغر وحدةٍ فيها.

    لا تدويرَ «جميل»: هذا رقمٌ يُقتطع من بطاقة، فالمعروضُ هو المقتطَع. */
export function convertFromUsd(amountUsd: number, to: PresentmentCurrency): number {
  const rate = PRESENTMENT_CURRENCIES[to].perUsd
  return Math.round(amountUsd * rate * MINOR_PER_MAJOR) / MINOR_PER_MAJOR
}

/** صياغةُ المبلغ بعملته — بلا تحويلٍ ثانٍ، فالمبلغ محوَّلٌ أصلا */
export function formatPresentment(amount: number, code: PresentmentCurrency): string {
  const n = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return withCurrencyAr(n, code)
}

/* ═══ رمزُ العملة يُوضَع، والرقمُ لا يُقرأ (٢٩ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «use $ sign» — في العقد والشاشات جميعا، والرمزُ قبل
   الرقم. وكان المطبوعُ رمزَ العملة الثلاثيَّ بعده («30 USD»)، ومرّةً اسمَها
   منثورا في بندٍ («300 دولار أمريكي»).

   ─────────── ولمَ تستقبل نصّا لا رقما ───────────

   متنُ العقد وحدةٌ نقيّة: يستقبل أتعابَه **منسَّقةً نصّا**
   (`ContractCompensation.rate`) لأنّه لا يقرأ محلّيّةً ولا يحمل `Decimal`.
   فلو أُعيد هنا تحليلُ الرقم وتنسيقُه لَدخلت المحلّيّةُ وثيقةً تُهشَّم بصمتُها
   وتُوقَّع عليها — فيختلف نصُّ العقد باختلاف الجهاز الذي صيَّره.

   فهذه تضع الرمزَ في موضعه ولا تمسّ الرقمَ: ما وصلها نصّا يخرج كما وصل.

   ─────────── وما لا يُعرَف رمزُه يبقى برمزه الثلاثيّ ───────────

   عملةٌ لا في الجدول تُطبَع «120 XYZ» كما كانت — فلا يُخترع لها رمزٌ، ولا
   يسقط بيانُها من وثيقة. */

/** يضع رمزَ العملة في موضعه من مبلغٍ **منسَّقٍ أصلا**: «$30» · «30 ر.س» */
export function withCurrencyAr(formatted: string, code: string): string {
  if (!isPresentmentCurrency(code)) return `${formatted} ${code}`
  const { symbol, symbolBefore } = PRESENTMENT_CURRENCIES[code]
  return symbolBefore ? `${symbol}${formatted}` : `${formatted} ${symbol}`
}

/** اسمُ العملة منثورا — لجملةٍ تسمّي العملةَ ولا تعدّ مبلغا */
export function currencyNameAr(code: string): string {
  return isPresentmentCurrency(code) ? PRESENTMENT_CURRENCIES[code].labelAr : code
}

/** واسمُها معرَّفا: «بعملة واحدة هي **الدولار الأمريكي**» */
export function currencyNameDefiniteAr(code: string): string {
  return isPresentmentCurrency(code) ? PRESENTMENT_CURRENCIES[code].labelDefiniteAr : code
}

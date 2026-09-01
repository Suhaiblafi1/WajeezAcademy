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

export interface PresentmentInfo {
  /** كم وحدةً من هذه العملة في الدولار الواحد — سعرُ ربطٍ رسميّ ثابت */
  perUsd: number
  labelAr: string
  symbol: string
}

export const PRESENTMENT_CURRENCIES = {
  USD: { perUsd: 1, labelAr: 'دولار أمريكي', symbol: '$' },
  AED: { perUsd: 3.6725, labelAr: 'درهم إماراتي', symbol: 'د.إ' },
  SAR: { perUsd: 3.75, labelAr: 'ريال سعودي', symbol: 'ر.س' },
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
  const { symbol } = PRESENTMENT_CURRENCIES[code]
  const n = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return code === 'USD' ? `${symbol}${n}` : `${n} ${symbol}`
}

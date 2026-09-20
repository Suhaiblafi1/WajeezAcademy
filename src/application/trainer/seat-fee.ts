/* معادلةُ المقاعد — تطبيقٌ واحدٌ يقرؤه المحرّكُ والشاشةُ والمثالُ التوضيحيّ.

   ── ولمَ مُلّفٌ لمعادلةٍ من ثلاثة أسطر ──

   كانت للمعادلة نسختان في `earnings.service.ts` **وهما مختلفتان فعلا**:
   الكشفُ يطبّق الحدَّ الأدنى (`Math.max(general, minSeats - referred)`)،
   وتوقّعُ شاشة «مستحقّاتي» لا يطبّقه. فشعبةٌ فيها ثلاثةٌ عامّون واثنان
   بالإحالة وحدُّها الأدنى ثمانيةٌ تُعرض للمدرّب ١٣٥ ويُدفع له ٢١٠ — رقمان
   لشيءٍ واحد، والمدرّبُ يقرأ الأصغرَ ويظنّ أنّه غُبن، أو يقرأ الأكبرَ
   ويحسب عليه.

   ── والحدُّ الأدنى يُكمَّل من العامّ لا يُضاف إليه ──

   `Math.max(general, minSeats - referred)` لا `Math.max(general, minSeats)`:
   الحدُّ مضروبٌ على **مجموع** المقاعد، والمقعدُ بالإحالة يُحتسب ضمنه بسعره
   هو. فمن جاء برجلَين بإحالته في شعبةٍ حدُّها ثمانيةٌ لم يُدفع له على عشرة.

   وأثرُه الذي لا يُرى: تحت الحدّ الأدنى، المقعدُ بالإحالة **يزيح** مقعدا
   عامّا كان سيُحتسب — فقيمتُه الحدّيّةُ فرقُ السعرَين لا سعرُه كاملا. ومن
   كتب في مادّةٍ تسويقيّةٍ أنّ المقعدَ المحال «يساوي كذا» في شعبةٍ لم تبلغ
   الحدَّ فقد بالغ، ويُكتشف ذلك في أوّل كشف. */

export interface SeatFeeInput {
  /** مقاعدُ لم تسجّل عبر رابط هذا المدرّب — وليست بالضرورة من تسويق الأكاديميّة */
  general: number
  /** ما سُجّل عبر رابط إحالته هو */
  referred: number
  rate: number
  referralRate: number | null
  minSeats: number
}

export interface SeatFeeBreakdown {
  generalSeats: number
  referredSeats: number
  generalAmount: number
  referralAmount: number
  total: number
  /** مجموعُ ما يُحتسب عليه فعلا — قد يفوق المسجّلين حين يُطبَّق الحدُّ الأدنى */
  billedSeats: number
  floorApplied: boolean
}

export function perSeatBreakdown(input: SeatFeeInput): SeatFeeBreakdown {
  const { general, referred, rate, minSeats } = input
  const referralRate = input.referralRate === null ? rate : input.referralRate
  const generalSeats = Math.max(general, minSeats - referred)
  const generalAmount = generalSeats * rate
  const referralAmount = referred * referralRate
  return {
    generalSeats,
    referredSeats: referred,
    generalAmount,
    referralAmount,
    total: generalAmount + referralAmount,
    billedSeats: generalSeats + referred,
    floorApplied: minSeats > 0 && general + referred < minSeats,
  }
}

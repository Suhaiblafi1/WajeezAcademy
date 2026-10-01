/* معادلةُ المقاعد — تطبيقٌ واحدٌ يقرؤه المحرّكُ والشاشةُ والمثالُ التوضيحيّ.

   ── ولمَ مُلّفٌ لمعادلةٍ من ثلاثة أسطر ──

   كانت للمعادلة نسختان في `earnings.service.ts` **وهما مختلفتان فعلا**:
   الكشفُ يطبّق الحدَّ الأدنى، وتوقّعُ شاشة «مستحقّاتي» لا يطبّقه. فشعبةٌ
   تُعرض للمدرّب ١٣٥ ويُدفع له ٢١٠ — رقمان لشيءٍ واحد، والمدرّبُ يقرأ الأصغرَ
   ويظنّ أنّه غُبن، أو يقرأ الأكبرَ ويحسب عليه.

   ═══ والحدُّ الأدنى أرضيّةُ **مالٍ** لا أرضيّةُ **مقاعد** (١ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «الحدّ الأدنى المحصَّل من الطرفين ١٥ شخصا بحدّ أدنى
   ٢٢٥ بغضّ النظر من أين مصدرهم»، وعلّتُه بلفظه: «فنحن مع المدرّب شركاء…
   وليس واجبنا أن نضمن شيئا ليس بأيدينا، فشهرتُه تلعب دورا، وقوّةُ طرحه
   وفيديوهاته».

   فالمعادلةُ `max(ما احتُسب فعلا، minSeats × rate)`: يُحتسب ما سجّل بمصدره،
   فإن قصر المجموعُ عن الأرضيّة كُمّلت، وإن جاوزها فله الأكثر.

   ── والذي كان قبلها، ولمَ نُسخ ──

   كانت `Math.max(general, minSeats − referred) × rate + referred × referralRate`
   — أرضيّةً على **عدد** المقاعد: يُكمَّل العددُ من الخانة العامّة ويبقى مقعدُ
   الرابط بسعره **فوقها**. فخمسةٌ عبر رابطه ولا أحدَ سواهم تعطي ٢٧٥ لا ٢٢٥.

   وافترقت الصيغتان في ١٠٥ حالةٍ من ٤٤١ (حيث `general + referred < minSeats`
   و`referred > 0`)، بفرقٍ يبلغ تسعين دولارا. والأثرُ الذي يُقال صريحا: تحت
   الأرضيّة لا يزيد مقعدُ الرابط شيئا حتّى يتجاوز المجموعُ الأرضيّةَ — وكانت
   قيمتُه الحدّيّةُ قبل هذا فرقَ السعرَين. وقد قُرّر ذلك على بيّنةٍ منه.

   ═══ ولا أرضيّةَ لشعبةٍ لم تبدأ — وهو حقلٌ يُسأل عنه لا يُفترَض ═══

   بلا هذا تدفع الأرضيّةُ ٢٢٥ عن شعبةٍ فارغةٍ أُلغيت: `max(0, 225) = 225`.
   وقولُ صاحب المنصّة: «لو لم يسجّل أحدٌ لن نعقد الدورة… فهذا سيكون شرطا
   علينا لا داعي له»، فصار النصُّ «الشعبة التي بدأت جلساتها وقدّمها المدرب».

   و`cohortStarted` **حقلٌ مطلوب** لا استنتاجٌ داخليّ: للمعادلة ثلاثةُ
   مُستدعين، وأحدُهم (`projectCohort`) يبني عليه **رصيدَ أكواد** المدرّب —
   فأرضيّةٌ على شعبةٍ مفتوحةٍ لم تبدأ تنفخ رصيدَه فيُصدر أكوادا على مالٍ قد
   لا يأتي. ولو كان الحقلُ اختياريّا لَسها عنه مُستدعٍ بلا أن يقول المصرِّفُ
   شيئا. فهو يُسأل، ويُجاب من حالة الشعبة بـ`cohortStartedForFloor`.

   ── وأثرُه الذي لا يُرى ──

   `floorApplied` صارت تعني **أنّ مالا كُمّل فعلا** لا «أنّ المسجّلين أقلُّ من
   العدد». وكانت الثانيةَ، فشعبةٌ فيها عشرةٌ عبر رابطه بـ٢٥٠ دولارا تُطبَع في
   كشفه «طُبّق الحدُّ الأدنى» ولم يُكمَّل فيها شيء. */

/* والتقريبُ إلى فلسَين: `25.5 × 12` تُقرأ ٣٠٦ لا ٣٠٥٫٩٩٩٩٩٩٩٩٩٩٩٩٩٩ */
const round2 = (n: number) => Math.round(n * 100) / 100

/** حالاتُ الشعبة التي تُعَدّ بها «بدأت» في تطبيق الأرضيّة.
 *
 *  و`full` ليست منها: المقاعدُ امتلأت ولم تنعقد جلسةٌ بعد. */
export function cohortStartedForFloor(status: string | null | undefined): boolean {
  return status === 'active' || status === 'completed'
}

export interface SeatFeeInput {
  /** مقاعدُ لم تسجّل عبر رابط هذا المدرّب — وليست بالضرورة من تسويق الأكاديميّة */
  general: number
  /** ما سُجّل عبر رابط إحالته هو */
  referred: number
  rate: number
  referralRate: number | null
  minSeats: number
  /** أبدأت جلساتُ الشعبة؟ — بلا هذا لا أرضيّةَ (`cohortStartedForFloor`) */
  cohortStarted: boolean
}

export interface SeatFeeBreakdown {
  /** المقاعدُ المحتسَبةُ بالسعر العامّ — عددُها الفعليُّ، لا يُكمَّل بالأرضيّة */
  generalSeats: number
  referredSeats: number
  generalAmount: number
  referralAmount: number
  /** ما كُمّل به ليبلغ الأرضيّةَ — بندٌ مستقلٌّ في الكشف، وصفرٌ حين لا تُكمَّل */
  floorTopUp: number
  total: number
  /** مجموعُ ما سجّل فعلا — ولا يفوقه شيءٌ بعد نسخ أرضيّة المقاعد */
  billedSeats: number
  /** أكُمّل مالٌ فعلا؟ — لا «أقلُّ من العدد» */
  floorApplied: boolean
}

export function perSeatBreakdown(input: SeatFeeInput): SeatFeeBreakdown {
  const { general, referred, rate, minSeats, cohortStarted } = input
  const referralRate = input.referralRate === null ? rate : input.referralRate
  const generalAmount = general * rate
  const referralAmount = referred * referralRate
  const earned = generalAmount + referralAmount
  const floor = cohortStarted && minSeats > 0 ? minSeats * rate : 0
  const floorTopUp = Math.max(0, round2(floor - earned))
  return {
    generalSeats: general,
    referredSeats: referred,
    generalAmount,
    referralAmount,
    floorTopUp,
    total: round2(earned + floorTopUp),
    billedSeats: general + referred,
    floorApplied: floorTopUp > 0,
  }
}

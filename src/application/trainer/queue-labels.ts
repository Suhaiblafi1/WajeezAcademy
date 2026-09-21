/* ليبلاتُ صفّ الطابور — ما يُقرأ بجانب الحالة، وممّن يُقرأ.

   ═══ ما طُلب (٢١ سبتمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة شيئين:

   ① «قلتَ لي مرارا إنّك ستضع نتيجةَ التقييم بجانب الحالة، والتي اتّفقنا
      أن تأخذها من روابط التقييم التي استخدمناها لمقابلة المدرّب — إذا
      كانت النتيجةُ مطابقةً [للمسجَّلة] وإن كانت مختلفةً نُظهر الاثنين.
      هذا سيكون لنا دليلٌ أنّ المقابلة تمّت وهذه نتيجتُها».

   ② «أمّا الأشخاص الذين حجزوا موعدا فضعْ في الليبل موعدَ مقابلتهم
      القادمة، وإن لم يحجز فيكون الليبلُ أنّه لم يحجز موعدا بعد».

   ═══ ولمَ هما هنا لا في الشاشة ═══

   كلاهما حكمٌ خالصٌ بشروطٍ متشابكة — اتّفاقٌ واختلافٌ ومصدران، وموعدٌ
   مضى أو لم يأتِ، وثقةٌ في المزامنة تسقط. وحكمٌ بهذا التشابك مكتوبٌ داخل
   JSX يُقرأ بالعين ولا يُختبَر إلّا بتشغيل الشاشة. فهو هنا: يُنقَض حرفا
   حرفا، والشاشةُ تصيّر ما يردّه.

   **ولا لفظَ عربيٌّ في هذا الملفّ**: يردّ مفاتيحَ ومصادرَ، والألفاظُ من
   معاجمها في الشاشة (`interview-outcome` و`VERDICT_AR`). ولو كُتبت هنا
   لَصار للنتيجة معجمٌ ثالث. */

import { canRemindToBook } from './application-options'

/** من أين جاءت الكلمةُ المعروضة — والفرقُ بينهما هو كلُّ ما طُلب */
export type VerdictSource =
  /** ما سجّله مُجرِي المقابلة في بطاقة الموعد (`TrainerInterview.outcome`) */
  | 'recorded'
  /** ما كتبه القارئُ في رابط التقييم (`TrainerApplicationReview.verdict`) */
  | 'review'

export interface VerdictBadge {
  /** مفتاحٌ من معجم النتائج — لا لفظٌ، فالشاشةُ تترجمه */
  key: string
  source: VerdictSource
  /** من قاله — يُكتب حين يختلف القرّاء وحدَه، فلا اسمَ على قولٍ لا منازعَ له */
  byAr?: string
}

/** قرارُ قارئٍ باسمه — والاسمُ يلزم حين يُعرض قولان متخالفان */
export interface ReviewVerdict {
  verdict: string
  reviewerName: string | null
}

export interface VerdictFacts {
  /** نتيجةُ آخر لقاءٍ سُجّلت — `null` لمن لم يُقابَل أو لم تُسجَّل نتيجتُه */
  interviewOutcome: string | null
  /** قراراتُ روابط التقييم بأسماء قائليها — فارغةٌ لمن لم يقرأه أحدٌ برابط */
  reviewVerdicts: readonly ReviewVerdict[]
}

/**
 * ما يُعرض من نتائج اللقاء — واحدةٌ عند الاتّفاق، واثنتان عند الاختلاف.
 *
 * والقاعدةُ التي تُنتج ذلك أبسطُ من حالاتها: **المسجَّلةُ تُعرض، ويُعرض
 * معها من قرارات التقييم ما خالفها**. فإن وافقها انطوى فيها فصارت واحدة،
 * وإن خالفها ظهر إلى جانبها فصارتا اثنتين — وإن لم تُسجَّل مسجَّلةٌ أصلا
 * فقرارُ التقييم وحدَه هو الخبر.
 *
 * ولا يُعرض شيءٌ لمن لم يُقابَل ولم يُقرأ ملفُّه: فراغٌ أصدقُ من «بلا نتيجة»
 * مكرَّرةً في كلّ صفّ.
 */
export function verdictBadges(f: VerdictFacts): VerdictBadge[] {
  /* القرّاءُ يُجمَّعون بقولهم لا بأسمائهم: ثلاثةٌ قالوا «ناجح» شارةٌ واحدة
     لا ثلاث، وأسماؤهم عليها معا حين يكون لقولهم منازع. */
  const groups = new Map<string, string[]>()
  for (const r of f.reviewVerdicts) {
    if (!r?.verdict) continue
    const names = groups.get(r.verdict) ?? []
    if (r.reviewerName) names.push(r.reviewerName)
    groups.set(r.verdict, names)
  }

  /* وعددُ الأقوال المعروضة هو ما يقرّر: قولٌ واحدٌ لا يحتاج قائلا، وقولان
     متخالفان لا يُقرآن بلا قائلَيهما. */
  const distinct = [...groups.keys()]
  const contested = f.interviewOutcome
    ? distinct.some((v) => v !== f.interviewOutcome)
    : distinct.length > 1
  const named = (key: string): VerdictBadge => {
    const names = groups.get(key) ?? []
    return { key, source: 'review', ...(contested && names.length > 0 ? { byAr: names.join(' · ') } : {}) }
  }

  if (!f.interviewOutcome) return distinct.map(named)
  return [
    { key: f.interviewOutcome, source: 'recorded' as const },
    ...distinct.filter((v) => v !== f.interviewOutcome).map(named),
  ]
}

/* ═══ وما نتيجتُه في سطرٍ واحد — يُرشَّح به الطابور (٢١ سبتمبر ٢٠٢٦) ═══

   طلب صاحبُ المنصّة ترشيحَين لا واحدا: «واحدٌ للّيبل الرئيسيّ وهو نشط أو
   مرفوض، والثاني لنتيجة التقييم». والحالةُ عمودٌ في القاعدة يُرشَّح به، أمّا
   النتيجةُ فمحسوبةٌ من مصدرَين — فلزمها مفتاحٌ واحدٌ يُعدّ ويُرشَّح به.

   **ويُشتقّ من الشارات نفسِها** لا بحسابٍ ثانٍ: ما يُعرض هو ما يُرشَّح به،
   فلا يُنقَر مرشِّحٌ فيُخرج صفّا يقول غيرَ ما قال المرشِّح. */

/** لا قولَ لنا فيه بعد */
export const RESULT_NONE = 'none'
/** قولان متخالفان في اللقاء نفسِه — قارئان لم يتّفقا */
export const RESULT_CONTESTED = 'contested'

export function resultKey(f: VerdictFacts): string {
  const badges = verdictBadges(f)
  if (badges.length === 0) return RESULT_NONE
  const distinct = [...new Set(badges.map((b) => b.key))]
  return distinct.length === 1 ? distinct[0] : RESULT_CONTESTED
}

/** حالُ موعده كما يُقرأ في الصفّ */
export type BookingLabel =
  /** حجز، ولم يحن موعدُه بعد */
  | { kind: 'upcoming'; at: string }
  /** حجز، ومضى موعدُه ولنا فيه قولٌ مكتوب — جرى اللقاءُ وانتهى أمرُه */
  | { kind: 'held'; at: string }
  /** حجز، ومضى موعدُه ولا قولَ لنا فيه — لقاءٌ ينتظر من يكتب نتيجتَه */
  | { kind: 'overdue'; at: string }
  /** يُقبل حجزُه ولم يحجز */
  | { kind: 'unbooked' }
  /** لا خبرَ يُقال: انتهى أمرُ موعده، أو حالتُه لا تحجز، أو لا يُوثَق ما نعرفه */
  | null

/* ═══ وحقائقُ النتيجة منها — لا حقلُ الموعد وحدَه (٢١ سبتمبر ٢٠٢٦) ═══

   شكا صاحبُ المنصّة: «لماذا مكتوبٌ هنا بلا نتيجة ونحن وضعنا نتيجتَه وهي
   ظاهرة؟» — وصفُّه يحمل «مضى موعدُه — بلا نتيجة» و«يجتاز» جنبا إلى جنب.

   وعلّتُه أنّ «المعلَّق» كان يُقاس بـ`TrainerInterview.outcome` وحدَها، وهي
   ما يسجّله مُجرِي المقابلة في بطاقة الموعد. أمّا قرارُ رابط التقييم
   (`TrainerApplicationReview.verdict`) فلم يكن يُقرأ هنا — **وهو قولُنا
   فيه بعينه**، ومعروضٌ في الصفّ نفسِه على بُعد شارةٍ واحدة.

   فصار الصفُّ يناقض نفسَه: يقول «لا قولَ لنا فيه» وإلى جانبه قولُنا فيه.
   ولا تكفي أن تُبدَّل الكلمة: الشارةُ ذهبيّةٌ لأنّها **عملٌ علينا**، ومن
   كُتب قرارُه لا عملَ علينا في نتيجته. فتُقرأ النتيجةُ من مصدرَيها معا. */
export interface BookingFacts extends VerdictFacts {
  status: string
  /** المواعيدُ القائمة — لا ملغًى فيها ولا غياب */
  interviewsCount: number
  /** موعدُه الذي ينتظر — أقربُ قادمٍ بلا نتيجة، وإلّا فآخرُ ماضٍ بلا نتيجة */
  pendingInterviewAt: string | null
}

/**
 * ليبلُ الموعد — وشرطُ الصمت فيه أهمُّ من شرطِ الكلام.
 *
 * ═══ «لم يحجز» لا تُقال لمن لا يُنتظَر منه حجز ═══
 *
 * المردودُ والمسحوبُ والنشطُ لم يحجزوا موعدا كذلك، ووسمُهم به يملأ الطابورَ
 * بخبرٍ صحيحٍ لا عملَ تحته. فالمِحَكُّ هو `canRemindToBook` بعينه — من
 * يُعرَض عليه زرُّ «ذكّره بحجز الموعد» هو من يُقال عنه إنّه لم يحجز، ولا
 * أحدَ غيره. ولو كُتب شرطٌ ثانٍ هنا لَافترق الليبلُ عن الزرّ تحته.
 *
 * ═══ و«بلا نتيجة» لا تُقال لمن كُتب قولُنا فيه ═══
 *
 * الذهبيُّ هنا يعني **عملا علينا**: لقاءٌ جرى وينتظر من يكتب نتيجتَه. ومن
 * كُتب قرارُه في رابط التقييم فلا عملَ علينا في نتيجته — فيُقال «جرى لقاؤه»
 * هادئا، ويبقى التاريخُ مقروءا.
 *
 * ═══ ولا يُقال «لم يحجز» حين لا يُعرف من حجز ═══
 *
 * حين تسقط مزامنةُ Calendly تصدق «لم يحجز» على الجميع — فيُقرأ إهمالا من
 * المتقدّمين وهو عطبٌ عندنا. وهو العطبُ نفسُه الذي جعل عدَّ المرشِّح يُعرض
 * «؟». **والنفيُ وحدَه هو ما يسقط**: موعدٌ في القاعدة واقعٌ ولو سقطت
 * المزامنة — سُجِّل يدويّا أو وصل قبل سقوطها — فيبقى يُعرض.
 */
export function bookingLabel(
  f: BookingFacts,
  opts: { trusted: boolean; now: Date },
): BookingLabel {
  if (f.pendingInterviewAt) {
    const at = new Date(f.pendingInterviewAt)
    if (Number.isNaN(at.getTime())) return null
    if (at.getTime() > opts.now.getTime()) return { kind: 'upcoming', at: f.pendingInterviewAt }
    /* ═══ ومضى — فهل لنا فيه قول؟ ═══

       `verdictBadges` هي المِحَكُّ نفسُه الذي يُعرض به القولُ في الصفّ، فلا
       يمكن أن تظهر شارةُ نتيجةٍ ويُقال «بلا نتيجة» إلى جانبها: مصدرُ
       الحكمَين واحد. ولو كُتب الشرطُ هنا ثانيةً لانحرف أحدُهما يوما. */
    return verdictBadges(f).length > 0
      ? { kind: 'held', at: f.pendingInterviewAt }
      : { kind: 'overdue', at: f.pendingInterviewAt }
  }
  if (!opts.trusted) return null
  return canRemindToBook({ status: f.status, liveInterviews: f.interviewsCount })
    ? { kind: 'unbooked' }
    : null
}

/* ═══ شاراتُ المرشِّحات — تُحسب من الصفوف لا تُكتب (٢١ سبتمبر ٢٠٢٦) ═══

   كانت الشاشةُ تحسبها بيدها مرّتين — مرّةً للحالة ومرّةً للنتيجة — بسطرَين
   متطابقَين. وحارسٌ يقرأ نصَّ الشاشة بـ`regex` ليتثبّت من إسقاط الخالي كان
   يقع على السطر الثاني وهو يقصد الأوّل: نُقض إسقاطُ الخالي من شاراتِ الحالة
   فخضرّ الحارسُ لأنّ `resultFacets` أسفلَه فيه الشرطُ نفسُه.

   فخرج الحسابُ إلى دالّةٍ واحدةٍ تُفحَص بنيتُها: الترتيبُ ترتيبُ `keys`
   المعطاة — لا الأكثرَ عددا، فشارةٌ تقفز من موضعها كلّما تبدّل رقمٌ تُفقد
   اليدَ موضعَها — وما خلا من الصفوف لا يُعرض أصلا. */

/** شارةُ مرشِّحٍ: مفتاحُها وعددُ من تحتها في الطابور */
export interface Facet { key: string; n: number }

/** يعدّ الصفوفَ على `keys` بترتيبها، ويُسقط ما لا أحدَ تحته */
export function facetsOf<T>(
  keys: readonly string[],
  rows: readonly T[],
  keyOf: (row: T) => string,
): Facet[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = keyOf(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return keys.map((key) => ({ key, n: counts.get(key) ?? 0 })).filter((f) => f.n > 0)
}

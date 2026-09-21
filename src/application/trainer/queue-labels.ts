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
}

export interface VerdictFacts {
  /** نتيجةُ آخر لقاءٍ سُجّلت — `null` لمن لم يُقابَل أو لم تُسجَّل نتيجتُه */
  interviewOutcome: string | null
  /** قراراتُ روابط التقييم بلا تكرار — فارغةٌ لمن لم يقرأه أحدٌ برابط */
  reviewVerdicts: readonly string[]
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
  const reviewed = [...new Set(f.reviewVerdicts.filter(Boolean))]
  if (!f.interviewOutcome) {
    return reviewed.map((key) => ({ key, source: 'review' as const }))
  }
  return [
    { key: f.interviewOutcome, source: 'recorded' as const },
    ...reviewed
      .filter((v) => v !== f.interviewOutcome)
      .map((key) => ({ key, source: 'review' as const })),
  ]
}

/** حالُ موعده كما يُقرأ في الصفّ */
export type BookingLabel =
  /** حجز، ولم يحن موعدُه بعد */
  | { kind: 'upcoming'; at: string }
  /** حجز، ومضى موعدُه ولم تُسجَّل نتيجتُه — لقاءٌ ينتظر من يكتب قولَه فيه */
  | { kind: 'overdue'; at: string }
  /** يُقبل حجزُه ولم يحجز */
  | { kind: 'unbooked' }
  /** لا خبرَ يُقال: انتهى أمرُ موعده، أو حالتُه لا تحجز، أو لا يُوثَق ما نعرفه */
  | null

export interface BookingFacts {
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
    return { kind: at.getTime() > opts.now.getTime() ? 'upcoming' : 'overdue', at: f.pendingInterviewAt }
  }
  if (!opts.trusted) return null
  return canRemindToBook({ status: f.status, liveInterviews: f.interviewsCount })
    ? { kind: 'unbooked' }
    : null
}

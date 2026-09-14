/* قواعدُ رحيلِ المدرّب — قسمةٌ واحدةٌ يقرؤها الخادمُ والشاشة (ن-٩ · ن-١٠).

   ═══ قاعدتان تحملان السمعةَ كلَّها ═══

   ① **القرارُ قبل الرسالة.** «لا ينبغي أن يقرأ متعلّمٌ «رحل مدرّبُك» بلا أن
      يكون البديلُ في الجملة نفسِها». فالرسالةُ لا تخرج على صفٍّ لم يُقرَّر —
      تحمل ما يجري بعدها لا اعتذارا وانتظارا. وهي أهمُّ ما هنا: بريدٌ يسبق
      القرارَ يصنع الحكايةَ التي تُروى بعد سنة.
   ② **والاختيارُ لصاحبه.** حين لا بديلَ ولا نظير: «لا المنصّةُ تختار نيابةً
      عنه، ولا رصيدٌ يُفرَض على من أراد مالَه». فلا يُحَلّ صفٌّ بردٍّ أو رصيدٍ
      قبل أن يُكتب اختيارُه.

   ═══ وترتيبُ الطرق مقصود ═══

   بديلٌ أوّلا: المتعلّمُ يبقى بمقعده وجدوله ومالِه، ولا يتحرّك إلّا الاسم.
   ثمّ نقلٌ إلى **نظيرٍ معرَّف** — إصدارٌ من الرمز نفسِه، وهنا يثمر ح-٣:
   «انقلهم إلى ما يشبهه» تكفّ عن كونها اجتهادا وتصير مجموعةً محدودة.
   ثمّ الاختيارُ حين لا يصلح أحدُهما. */

/** لم يُقرَّر بعد — ولا رسالةَ تخرج عليه */
export const OUTCOME_PENDING = 'pending'

/** ما حُلّ فعلا */
export const RESOLVED_OUTCOMES = ['substituted', 'moved', 'refund_requested', 'credited'] as const
export type ResolvedOutcome = (typeof RESOLVED_OUTCOMES)[number]
export type CaseOutcome = typeof OUTCOME_PENDING | ResolvedOutcome

/** ما لا يُحَلّ إلّا باختيارِ صاحبه (ن-١٠) */
export const LEARNER_CHOICE_OUTCOMES = ['refund_requested', 'credited'] as const

/** ما يملك المتعلّمُ اختيارَه */
export const LEARNER_CHOICES = ['refund', 'credit'] as const
export type LearnerChoice = (typeof LEARNER_CHOICES)[number]

/** الاختيارُ ونتيجتُه — قسمةٌ واحدةٌ فلا يفترق موضعان */
export const OUTCOME_OF_CHOICE: Record<LearnerChoice, ResolvedOutcome> = {
  refund: 'refund_requested',
  credit: 'credited',
}

export function isResolved(outcome: string): boolean {
  return (RESOLVED_OUTCOMES as readonly string[]).includes(outcome)
}

/** هل يحتاج هذا المآلُ اختيارَ صاحبه؟ */
export function needsLearnerChoice(outcome: string): boolean {
  return (LEARNER_CHOICE_OUTCOMES as readonly string[]).includes(outcome)
}

export interface CaseLike {
  outcome: string
  learnerChoice: string | null
}

/* ═══ ① القرارُ قبل الرسالة ═══ */

/** لماذا لا تخرج الرسالةُ بعد — أو `null` فتخرج */
export function notifyBlockerAr(c: CaseLike): string | null {
  if (!isResolved(c.outcome)) {
    return 'لم يُقرَّر بعد ما يجري لهذا المتعلّم — ولا تخرج الرسالةُ قبل القرار'
  }
  return null
}

export function canNotify(c: CaseLike): boolean {
  return notifyBlockerAr(c) === null
}

/* ═══ ② والاختيارُ لصاحبه ═══ */

/** لماذا لا يُنفَّذ اختيارُه بعد — أو `null` فيُنفَّذ.
 *
 *  ═══ ولمَ دالّةٌ واحدةٌ تملك القاعدةَ كلَّها ═══
 *
 *  كانت القاعدةُ في موضعَين: هنا، وشرطٌ ثلاثيٌّ في `settleChoice` يسبقها.
 *  فنُقضت هنا **ولم يحمرّ شيء** — الشرطُ الآخرُ كان يردّ قبل أن تُبلَغ. وهو
 *  عينُ ما يحذّر منه المستودَع: حارسٌ أخضرُ لأنّه لا يُبلَغ، لا لأنّ ما
 *  يحرسه سليم.
 *
 *  فصارت تأخذ **الاختيارَ نفسَه**: لا مآلَ يُشتقّ خارجَها، ولا شرطَ يسبقها. */
export function settleBlockerAr(learnerChoice: string | null): string | null {
  if (!learnerChoice) return 'الاختيارُ لصاحبه — لا يُحَلّ بردٍّ ولا برصيدٍ قبل أن يختار'
  if (!(LEARNER_CHOICES as readonly string[]).includes(learnerChoice)) {
    return 'اختيارٌ غيرُ معروف — والمآلُ يتبع ما اختاره صاحبُه'
  }
  return null
}

/* ═══ ولا تُغلق الحالةُ واسمٌ واحدٌ معلَّق ═══ */

export interface CloseInput {
  cases: readonly { outcome: string; notifiedAt: Date | string | null }[]
}

/** ما يمنع إغلاقَ الحالة، بعبارةٍ تقول العدد لا «غيرُ مكتملة» */
export function closeBlockersAr(input: CloseInput): string[] {
  const out: string[] = []
  const unresolved = input.cases.filter((c) => !isResolved(c.outcome)).length
  if (unresolved > 0) out.push(`${unresolved} متعلّما لم يُحَلّ أمرُه بعد`)

  /* ومن حُلّ أمرُه ولم يُبلَّغ لم يُنتهَ منه: القرارُ بلا رسالةٍ لا يصل صاحبَه */
  const silent = input.cases.filter((c) => isResolved(c.outcome) && !c.notifiedAt).length
  if (silent > 0) out.push(`${silent} متعلّما قُرِّر أمرُه ولم يُبلَّغ`)
  return out
}

export function canClose(input: CloseInput): boolean {
  return closeBlockersAr(input).length === 0
}

/* ═══ وعبارةُ الاختيارَين واحدةٌ في البريد وفي الزرّ ═══

   البريدُ يعرض خيارَين والشاشةُ تعرض زرَّين، ولو كتب كلٌّ عبارتَه لافترقا:
   يقرأ «ردُّ ما تبقّى» ثمّ يجد زرّا مكتوبا عليه «استرجاع»، فيتردّد — أهو
   نفسُه؟ وهذا التردّدُ في لحظةٍ يقرّر فيها مصيرَ مالِه.

   فمن هنا يأخذان معا. ومن زاد خيارا ثالثا فنسي البريدَ سقط الحارس. */
export const CHOICE_LABEL_AR: Record<LearnerChoice, string> = {
  refund: 'ردُّ ما تبقّى من قيمة الشعبة',
  credit: 'رصيدٌ باسمك يُستعمل في شعبةٍ أخرى',
}

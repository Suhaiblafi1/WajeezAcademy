/* ═══ عدّادُ الشعب بجانب اسم المدرّب (١٨ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «كيف أعلم أنّ المدرّب كم دورةً قام بإعداد شعبها — كلِّها أو جزءٍ
   منها؟ ألا يكون هناك عدّادٌ جانبَ اسمه؟». وكان الجوابُ في صفحة موادّه وحدَها، دورةً
   دورة. فصار سطرُه المطويُّ في «العقود» يحمل العدد.

   · **كاملة**: شعبةٌ أُرسلت خطّتُها للاعتماد أو اعتُمدت — أتمّ ما عليه فيها.
   · **جزئيّة**: شعبةٌ قامت ولم تُرسَل خطّتُها، أو رُدّت إليه بملاحظات.
   · **لم يبدأ**: دورةٌ لا شعبةَ له فيها بعد.
   · **مؤجّلة**: أجّلتَ خطّتَها إلى موسمٍ قادم — ليست ناقصة، ولا تُعدّ جزئيّة (١٨ أكتوبر:
     «لا تنسَ أنّهم أجّلوا بعضها»).
   · **وما اعتذر عنه** لا يُعدّ من دوراته — يُذكر في التفصيل وحدَه.

   والحالُ من `coursesOf` نفسِها (`trainer-prep.service.ts`) — فلا يختلف العدّادُ عن صفحة
   الموادّ. وما خرج منها لأنّ شعبتَه قائمةٌ أو اعتُمدت خطّتُها يُعدّ «معتمدة». */

export interface PrepTally {
  /** دوراتُه بلا ما اعتذر عنه */
  total: number
  approved: number
  submitted: number
  partial: number
  notStarted: number
  postponed: number
  declined: number
}

/** حالُ الدورة كما تقرؤها `coursesOf` — و`done` لما خرج منها بشعبةٍ قائمة */
export type TallyState = 'to_decide' | 'preparing' | 'submitted' | 'returned' | 'approved' | 'declined' | 'done' | 'postponed'

export function prepTallyOf(states: readonly TallyState[]): PrepTally {
  const n = (...s: TallyState[]) => states.filter((x) => s.includes(x)).length
  const declined = n('declined')
  return {
    total: states.length - declined,
    approved: n('approved', 'done'),
    submitted: n('submitted'),
    partial: n('preparing', 'returned'),
    notStarted: n('to_decide'),
    postponed: n('postponed'),
    declined,
  }
}

/** السطرُ المطويّ: «الشعب: 2 كاملة · 1 جزئية · 1 مؤجلة من 5» — ولا شيءَ إن لم تكن له دورة */
export function prepTallyAr(t: PrepTally): string | null {
  if (t.total === 0) return null
  const full = t.approved + t.submitted
  const parts = [
    full > 0 ? `${full} كاملة` : null,
    t.partial > 0 ? `${t.partial} جزئية` : null,
    t.postponed > 0 ? `${t.postponed} مؤجلة` : null,
  ]
    .filter((x): x is string => x !== null)
  return `الشعب: ${parts.length > 0 ? parts.join(' · ') : '0'} من ${t.total}`
}

/** والتفصيلُ تحته: ما اعتُمد، وما ينتظر مراجعتك، وما يعدّه، وما لم يبدأ، وما اعتذر عنه */
export function prepTallyDetailAr(t: PrepTally): string {
  return [
    t.approved > 0 ? `معتمدة ${t.approved}` : null,
    t.submitted > 0 ? `تنتظر مراجعتك ${t.submitted}` : null,
    t.partial > 0 ? `قيد الإعداد ${t.partial}` : null,
    t.notStarted > 0 ? `لم يبدأ ${t.notStarted}` : null,
    t.postponed > 0 ? `مؤجلة ${t.postponed}` : null,
    t.declined > 0 ? `اعتذر عن ${t.declined}` : null,
  ].filter((x): x is string => x !== null).join(' · ')
}

/* ═══ من ينتظر نفسَه وهو يحسب أنّه ينتظرنا (١٩ أكتوبر ٢٠٢٦) ═══

   بلاغُ صاحب المنصّة عن مدرّبةٍ اعتُمد توقيعُها «كالعقود الجديدة»: دوراتُها التسعُ «لم يبدأ»،
   وبريدُ اعتمادها قال لها «ولا يتغيّر في بوّابتك شيء». وتوقيعُنا معلَّقٌ بإعداد دوراتها — فهي
   تنتظرنا ونحن ننتظرها. وصُحّح البريدُ لمن يأتي، وطلب أن يُعرف من أصابه قبله: «tell me who».

   فهم: عقدٌ غيرُ مشروطٍ اعتُمد توقيعُه ولم نوقّعه، وفي دوراته ما لم يبدأ. */
export interface WaitingRow {
  status: string
  gatesActivation: boolean
  prepTally?: PrepTally | null
}

export function waitingOnThemselves<T extends WaitingRow>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.status === 'signature_approved' && !r.gatesActivation && (r.prepTally?.notStarted ?? 0) > 0)
}

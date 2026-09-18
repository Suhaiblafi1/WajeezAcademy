/* ═══ دورةُ حياة الفصل — من يحرّكها، ومتى ═══

   ── العطبُ الذي يزيله هذا الملفّ، بالحرف ──

   للفصل حقلُ `status` بخمس قيمٍ منذ أن وُضع المخطَّط (`planned | open |
   active | closed | cancelled`)، **ولم يكن في المنصّة كلِّها سطرٌ واحدٌ
   يكتبه**. `TermService.create` لا يمرّره فيأخذ `planned` الافتراضيّة،
   ولا بابَ بعدها. فكلُّ فصلٍ في القاعدة `planned` إلى الأبد.

   وله خمسةُ قرّاءٍ عملوا في الفراغ:

     ① `TermService.list` تخفي `closed | cancelled` عن الإدارة — ولا شيءَ
       يصير كذلك، فخيارُ «أظهر المغلقة» لا يُظهر شيئا زائدا أبدا.
     ② `LIVE_TERM_STATUSES` في «الفصل القادم» وإتاحة المدرّبين.
     ③ `TrainerPathsShelf` تكتب للمتعلّم «التسجيلُ مفتوحٌ الآن» إن كان
       الفصلُ `open` — سطرٌ لم يره إنسانٌ قطّ.
     ④ `CohortService.openForTrainer` و`setTerm` تردّان `term_closed` —
       حارسٌ لا يقع في الإنتاج، وخضرتُه في الاختبار جاءت من صفٍّ كُتبت
       حالتُه بيدٍ لا من بابٍ قائم.
     ⑤ وشاشةُ الإدارة تترجم `draft | planning | running` — أسماءً ليست من
       قيم العمود أصلا — فتعرض لكلّ فصلٍ كلمةَ «planned» بالإنجليزيّة.

   ── والقاعدةُ التي تحلّه ──

   **قرارٌ وتقويم، لا خلطَ بينهما.** الفتحُ والإلغاءُ قرارُ الإدارة، تفعله
   بيدها ويُسجَّل بفاعله؛ والجريانُ والانتهاءُ حقيقةُ تقويمٍ تقع بلا قرار —
   فصلٌ مضت أشهرُه منتهٍ وإن لم ينقر أحدٌ زرّا. وهو التقسيمُ نفسُه المكتوبُ
   في وظيفة الشعب: «ولا تُفتَح شعبةٌ تلقائيّا: الفتحُ قرارٌ بشريّ». */

export const TERM_STATUSES = ['planned', 'open', 'active', 'closed', 'cancelled'] as const
export type TermStatus = (typeof TERM_STATUSES)[number]

/** الحالاتُ الحيّة: ما يُعرض للإدارة بلا «أظهر المنتهية» */
export const LIVE_TERM_STATUSES: readonly TermStatus[] = ['planned', 'open', 'active']

export const TERM_STATUS_AR: Record<TermStatus, string> = {
  planned: 'مخطَّط',
  open: 'مفتوحٌ للتسجيل',
  active: 'جارٍ',
  closed: 'منتهٍ',
  cancelled: 'ملغًى',
}

/** ماذا يقع إن اختير — كي يُقال للإداريّ قبل أن ينقر لا بعدَه */
export const TERM_STATUS_EFFECT_AR: Record<TermStatus, string> = {
  planned: 'يرجع خطّةً لم تُعلَن',
  open: 'يقبل الشعبَ الجديدة، ويُقرأ للمتعلّم «التسجيلُ مفتوحٌ الآن»',
  active: 'يصير جاريا — ويقع بنفسه ببلوغ أوّل أشهره',
  closed: 'لا تُفتح فيه شعبةٌ جديدةٌ ولا يُسمَّى فصلا لشعبةٍ قائمة',
  cancelled: 'يسقط من الحسبان كلِّه — ولا يُلغى فصلٌ فيه شعب',
}

/* ═══ ما تملك الإدارةُ اختيارَه من كلّ حال ═══

   `active` ليست منها: بلوغُ الشهرِ الأوّلِ ليس رأيا يُستأذَن فيه. و`closed`
   منها لأنّ الإنهاءَ المبكّر قرارٌ (فصلٌ يُطوى قبل أوانه)، وهي كذلك ما
   يقع بالتقويم حين تمضي الأشهر — والفعلُ واحدٌ والفاعلُ يختلف، فيُسجَّل. */
const ALLOWED: Record<TermStatus, readonly TermStatus[]> = {
  planned: ['open', 'cancelled'],
  open: ['active', 'closed', 'cancelled'],
  active: ['closed'],
  closed: [],
  cancelled: [],
}

/** ما يجوز للإدارة أن تنقل الفصلَ إليه الآن — والشاشةُ تبني أزرارَها منه */
export function nextStatuses(from: string): TermStatus[] {
  return [...(ALLOWED[from as TermStatus] ?? [])]
}

export function canMove(from: string, to: string): boolean {
  return nextStatuses(from).includes(to as TermStatus)
}

/* ═══ وما يقوله التقويمُ وحدَه ═══

   والمقارنةُ باليوم لا باللحظة: `startsOn` و`endsOn` حقلا **تاريخ** (@db.Date)
   فيُقرآن منتصفَ ليلِ UTC. ولو قُورن `endsOn` بالساعة لانتهى الفصلُ فجرَ
   يومه الأخير — وهو يومٌ كاملٌ من أيّامه. */
const dayStart = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

export function dueByDate(
  term: { status: string; startsOn: Date; endsOn: Date }, now: Date,
): TermStatus | null {
  if (term.status === 'closed' || term.status === 'cancelled') return null
  const today = dayStart(now)
  /* مضت أشهرُه: منتهٍ وإن لم يُفتح قطّ — ما لم يُعلَن لا يُنتظر إلى الأبد */
  if (dayStart(term.endsOn) < today) return 'closed'
  /* وبلوغُ أوّلِه يجريه — إن كان مفتوحا. والمخطَّطُ لا يُفتح بالتقويم:
     الفتحُ إعلانٌ للناس، ولا يُعلَن باسم الإدارة ما لم تقله. */
  if (term.status === 'open' && dayStart(term.startsOn) <= today) return 'active'
  return null
}

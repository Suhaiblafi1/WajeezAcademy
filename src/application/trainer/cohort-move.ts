/* ═══ نقلُ الشعبة إلى فصلٍ آخر — يطلبه المدرّبُ وتعتمده الإدارة (١٧ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «هل هناك خيارٌ للمدرّب أن يؤجّل دورتَه للفصول القادمة؟ إذا لا افعلها
   وضعها في مربّع كلّ شعبة، ومتى ما أجّلها يظهر لنا للموافقة في الإدارة». وعُرضت عليه ثلاثة
   آثارٍ للموافقة — إعادةُ فتح الخطّة على الفصل، أو نقلُ الشعبة نفسِها، أو طلبٌ بلا أثر —
   فاختار **النقل**: «وإن أعادها إلى الفصل في حالاتٍ نادرة، وكلُّ ذلك بموافقتي».

   فالطلبُ إلى أيّ فصلٍ قادمٍ غيرِ فصلها — بعده تأجيلا، أو قبله إعادةً — ولا يقع شيءٌ
   حتّى تعتمده الإدارة. وعند الاعتماد تُزاح مواعيدُ الشعبة كلُّها **بأسابيعَ كاملة**:
   يومُ الأسبوع والساعةُ كما اختارهما المدرّب، والمسافةُ أقربُ ما تكون إلى الفرق بين
   بدايتي الفصلين. والمتعلّمون يُبلَّغون بالموعد الجديد.

   بلا React ولا قاعدة — ويحرسه `src/tests/trainer/cohort-move.test.ts`. */

import { TRAINING_SEASONS, type TrainingSeason } from './application-options'
import { SEASON_MONTHS, termBounds, termOf, termTitleAr } from '../terms/season'

export interface TermRef { year: number; season: TrainingSeason }

/** كم فصلا قادما يُعرض للاختيار */
export const MOVE_CHOICE_COUNT = 4

/** الحالاتُ التي تُنقل منها الشعبة — ما لم تبدأ ولم تنتهِ ولم تُلغَ */
export const MOVABLE_STATUSES = ['draft', 'open', 'full'] as const

/** أقلُّ طولٍ لسبب الطلب — الإدارةُ تقرؤه لتقرّر */
export const MOVE_REASON_MIN = 10

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

/** الفصلُ الذي يلي هذا */
export function nextTerm(t: TermRef): TermRef {
  const i = TRAINING_SEASONS.findIndex((s) => s.value === t.season)
  const season = TRAINING_SEASONS[(i + 1) % TRAINING_SEASONS.length]!.value
  /* الشتاءُ يبدأ في نوفمبر ويعبر رأسَ السنة: ما بعده في السنة التالية */
  return { year: SEASON_MONTHS[season].start < SEASON_MONTHS[t.season].start ? t.year + 1 : t.year, season }
}

export const sameTerm = (a: TermRef | null, b: TermRef | null): boolean =>
  Boolean(a && b && a.year === b.year && a.season === b.season)

export const termLabelAr = (t: TermRef): string => termTitleAr(t.year, t.season)

/** الفصولُ التي يُطلب النقلُ إليها: ما لم يبدأ بعد، غيرَ فصلِ الشعبة — الأقربُ أوّلا */
export function moveChoices(now: Date, current: TermRef | null, count = MOVE_CHOICE_COUNT): TermRef[] {
  const out: TermRef[] = []
  let t: TermRef = termOf(now)
  for (let guard = 0; out.length < count && guard < 12; guard += 1) {
    t = nextTerm(t)
    if (!sameTerm(t, current)) out.push(t)
  }
  return out
}

/** كم تُزاح المواعيد: الفرقُ بين بدايتي الفصلين، مقرَّبا إلى أسابيعَ كاملة */
export function moveShiftMs(from: TermRef, to: TermRef): number {
  const diff = termBounds(to.year, to.season).startsOn.getTime() - termBounds(from.year, from.season).startsOn.getTime()
  return Math.round(diff / WEEK_MS) * WEEK_MS
}

export const shiftDate = (d: Date | null, ms: number): Date | null => (d ? new Date(d.getTime() + ms) : null)

/* ═══ وتذكيرُ مدرّبيها قبل الفصل الجديد بشهر (١٧ أكتوبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «أرسل لمدرّبي الشعبة المنقولة قبل بدء الفصل الجديد بشهرٍ ليراجعوا الدورةَ
   ويعدّلوها إن لزم، وليتأكّدوا من مواعيد اللقاءات». فما كُتب قبل أشهرٍ قد تقادم. ومن نُقلت شعبتُه
   وبقي على الفصل أقلُّ من شهرٍ يُذكَّر في أوّل دورةٍ بعد الاعتماد. */
export const MOVE_REMINDER_DAYS = 30

/** متى يُذكَّر مدرّبو شعبةٍ نُقلت إلى هذا الفصل */
export function moveReminderAt(target: TermRef): Date {
  return new Date(termBounds(target.year, target.season).startsOn.getTime() - MOVE_REMINDER_DAYS * DAY_MS)
}

/** ما يمنع طلبَ النقل — جملةٌ تُعرض، أو `null` حين لا مانع */
export function moveProblemAr(input: {
  status: string
  firstStartsAt: Date | null
  current: TermRef | null
  target: TermRef
  now: Date
  reason: string
}): string | null {
  if (!(MOVABLE_STATUSES as readonly string[]).includes(input.status)) return 'الشعبة بدأت أو انتهت — لا تنقل'
  if (input.firstStartsAt && input.firstStartsAt.getTime() <= input.now.getTime()) return 'أول لقاء مضى — لا تنقل الشعبة بعد بدئها'
  if (!moveChoices(input.now, input.current).some((t) => sameTerm(t, input.target))) return 'اختر فصلا قادما غير فصلها'
  if (input.reason.trim().length < MOVE_REASON_MIN) return 'اكتب السبب — الإدارة تقرؤه لتقرّر'
  return null
}

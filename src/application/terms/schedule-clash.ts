/* ═══ مواعيدُ بلا تعارض — دورتان يأخذهما الطالبُ نفسُه لا تقعان في ساعةٍ واحدة (٢٢ أكتوبر ٢٠٢٦) ═══

   ─────────── ما يحلّه ───────────

   اختار كلُّ مدرّبٍ موعدَ شعبته وحدَه، فوقعت دورتان من مسارٍ واحدٍ في الساعة نفسِها. ووصلتنا على
   واتساب حالاتُ طلبةٍ أرادوا دورتين فلم يستطيعوا: يأخذ الطالبُ واحدةً، ونخسر الأخرى. وإبلاغُ المدرّبين أن
   يعدّلوا مواعيدَهم لا يحلّه: يتعارضون ثانيةً، والتنسيقُ بينهم صعب. فنرتّب نحن الجدولَ كلَّه، ويصل كلَّ
   مدرّبٍ تغيّر موعدُه بطاقةُ «قبل/بعد» يقبلها أو يرفضها بسبب.

   ─────────── أيُّ دورتين لا تتعارضان ───────────

   قرارُ صاحب المنصّة (٢٢ أكتوبر ٢٠٢٦): «لكي لا تتعارض دورةٌ مع أخرى بنفس المسار، أو دوراتٌ لنفس المستوى
   أو قريبةٌ منها للشخص نفسه أو الفئة المستهدفة نفسها». فالزوجُ مربوطٌ إن:

   ① **جمعهما مسارٌ عامّ** (`public-pathways.json`) — الطالبُ على المسار يأخذهما معا.
   ② **أو جمعتهما فئةٌ واحدة، ومستواهما واحدٌ أو متجاوران** — تأسيسيّ، تأسيسيّ–تطبيقيّ، تطبيقيّ، ممارس.
      وفئةُ الدورة فئاتُ مساراتها العامّة. **والدورةُ التي لا مسارَ عامًّا لها** تأخذ فئةَ مسارها في الكتالوج
      (`pathwayCategory`) — كأنّها فيه، وهو ما طلبه صاحبُ المنصّة لها: «recommend others as they were in
      the same path».

   وليس كلُّ تعارضٍ خسارة: دورةُ تسويقٍ ودورةُ أمنٍ سيبرانيّ في ساعةٍ واحدة لا تمنعان أحدا. فلو عُدّ كلُّ
   تداخلٍ تعارضا لاحمرّ التقويمُ كلُّه. ولا تتعارض شعبتان من الدورة نفسِها: هما بديلان لا دورتان.

   ─────────── والحلّ: أقلُّ ما يمكن من تغيير ───────────

   يمرّ على الشعب بترتيبٍ ثابت: ما لا يُنقل أوّلا (ثبّتته الإدارة، أو بدأ، أو عليه اقتراحٌ لم يُقرَّر فيه)،
   ثمّ **ما فيه طلبةٌ أكثر** — هم اشتروا على موعده — ثمّ أقلُّها تعارضا: فالشعبةُ التي تتعارض مع ثلاثٍ هي التي
   تنتقل، فينحلّ بنقلةٍ واحدةٍ ثلاثةُ تعارضات. وكلُّ شعبةٍ تبقى على موعدها إن لم يتعارض مع ما وُضع قبلها، وإلّا
   جُرّبت لها المواعيدُ الأقربُ إلى موعدها — اليومُ نفسُه بساعةٍ أخرى، ثمّ الساعةُ نفسُها بيومٍ آخر — حتّى يُوجد ما
   لا يتعارض ويبنيه بانيه (`proposeSchedule`) بلا إفساد. وما لم يُوجد له موعدٌ يُقال بسببه ولا يسقط صامتا.

   وهو محضٌ حتميّ: لا قاعدةَ ولا عشوائيّة، والبناءُ يُمرَّر دالّةً — فيُختبَر بمدخلاتٍ مصنوعة. */

import { WEEKDAY_AR, WORKDAYS } from '../trainer/plan-scorecard'
import { fitsTime } from '../trainer/schedule-proposal'
import { zonedClock, zonedDay } from '../trainer/cohort-period'

/* ─────────── الدورةُ وما يربطها ─────────── */

export interface ClashCourse {
  courseId: string
  titleAr: string
  levelAr: string | null
  /** مساراتُها العامّة */
  pathways: readonly { id: string; titleAr: string }[]
  /** فئاتُها المستهدفة — من مساراتها العامّة، أو من مسار الكتالوج لما لا مسارَ عامًّا له */
  audiences: readonly string[]
}

/** درجاتُ المستوى بترتيبها — والشرطةُ بين «تأسيسيّ» و«تطبيقيّ» قد تُكتب بأيّ شكل */
const LEVELS = ['تأسيسي', 'تأسيسي-تطبيقي', 'تطبيقي', 'ممارس'] as const

export function levelRank(levelAr: string | null | undefined): number | null {
  if (!levelAr) return null
  const s = levelAr.replace(/[ً-ْ]/g, '').replace(/\s*[–—-]\s*/g, '-').trim()
  const i = (LEVELS as readonly string[]).indexOf(s)
  return i < 0 ? null : i
}

/** مستويان واحدٌ أو متجاوران — والمجهولُ قريبٌ من كلّ مستوى: الحذرُ ألّا يُترك تعارضٌ لأنّا لم نعرف */
export function levelsClose(a: string | null, b: string | null): boolean {
  const x = levelRank(a)
  const y = levelRank(b)
  return x === null || y === null || Math.abs(x - y) <= 1
}

/** لماذا لا تتعارض هاتان الدورتان — أو `null` إن لم يربطهما شيء */
export function linkWhyAr(a: ClashCourse, b: ClashCourse): string | null {
  if (a.courseId === b.courseId) return null
  const path = a.pathways.find((p) => b.pathways.some((q) => q.id === p.id))
  if (path) return `في مسار «${path.titleAr}» نفسه`
  const audience = a.audiences.find((x) => b.audiences.includes(x))
  if (audience && levelsClose(a.levelAr, b.levelAr)) return `للفئة نفسها (${audience}) وبمستوى قريب`
  return null
}

/* ─────────── الشعبةُ ولقاءاتُها ─────────── */

export interface ClashInterval { startsAt: number; endsAt: number }

/** يومٌ وساعةٌ أسبوعيّان — `weekday` بـ`getUTCDay` (٠ الأحد).
    و`days` لشعبةٍ تلتقي أكثرَ من مرّةٍ في الأسبوع: أيّامُها نفسُها، والساعةُ وحدَها تتغيّر (٢٧ أكتوبر ٢٠٢٦) */
export interface WeeklySlot { weekday: number; clock: string; days?: readonly number[] }

/** موعدٌ رفضه المدرّب: يومُه كلُّه، أو ساعتُه في كلّ يوم، أو هذا الموعدُ وحدَه */
export interface RejectedSlot extends WeeklySlot { scope: 'day' | 'hour' | 'slot' }

export interface ClashCohort {
  cohortId: string
  title: string
  courseId: string
  trainerIds: readonly string[]
  /** طلبتُها المسجّلون — اشتروا على موعدها، فتُقدَّم على غيرها في البقاء */
  learners: number
  /** لقاءاتُها الآتية كما هي الآن */
  sessions: readonly ClashInterval[]
  /** لماذا لا تُنقل — أو `null` إن جاز نقلُها */
  fixedAr: string | null
  /** لقاءاتُها كما ستكون إن قُبل اقتراحٌ قائمٌ لم يُقرَّر فيه — فتوضع عليه لا على ما هي عليه */
  proposed?: readonly ClashInterval[] | null
  /** ما رفضه مدرّبُها من مواعيد — لا يُقترح ثانية */
  rejected?: readonly RejectedSlot[]
}

/** بناءُ الجدول على يومٍ وساعة — لقاءاتُه بعده، أو لماذا لا يُبنى */
export type BuildSchedule<T> = (cohortId: string, slot: WeeklySlot, whyAr: string) =>
  { ok: true; sessions: readonly ClashInterval[]; payload: T } | { ok: false; reasonAr: string }

export interface ClashPair {
  a: string
  b: string
  whyAr: string
  /** أوّلُ لقاءين يتداخلان، وكم مرّة */
  firstAt: number
  count: number
}

const overlaps = (x: ClashInterval, y: ClashInterval) => x.startsAt < y.endsAt && y.startsAt < x.endsAt

function overlapOf(xs: readonly ClashInterval[], ys: readonly ClashInterval[]): { firstAt: number; count: number } | null {
  let count = 0
  let firstAt = Infinity
  for (const x of xs) for (const y of ys) {
    if (overlaps(x, y)) { count += 1; firstAt = Math.min(firstAt, Math.max(x.startsAt, y.startsAt)) }
  }
  return count === 0 ? null : { firstAt, count }
}

/** لماذا لا تتعارض هاتان الشعبتان — الدورةُ أو المدرّبُ نفسُه — أو `null` */
function cohortLinkAr(a: ClashCohort, b: ClashCohort, courses: ReadonlyMap<string, ClashCourse>): string | null {
  if (a.trainerIds.some((t) => b.trainerIds.includes(t))) return 'للمدرب نفسه'
  const ca = courses.get(a.courseId)
  const cb = courses.get(b.courseId)
  return ca && cb ? linkWhyAr(ca, cb) : null
}

/** التعارضاتُ القائمةُ الآن — أزواجُ شعبٍ مربوطةٍ تتداخل لقاءاتُها */
export function findClashes(cohorts: readonly ClashCohort[], courses: ReadonlyMap<string, ClashCourse>): ClashPair[] {
  const out: ClashPair[] = []
  for (let i = 0; i < cohorts.length; i++) {
    for (let j = i + 1; j < cohorts.length; j++) {
      const a = cohorts[i]!
      const b = cohorts[j]!
      const why = cohortLinkAr(a, b, courses)
      if (!why) continue
      const hit = overlapOf(a.sessions, b.sessions)
      if (hit) out.push({ a: a.cohortId, b: b.cohortId, whyAr: why, ...hit })
    }
  }
  return out.sort((x, y) => x.firstAt - y.firstAt || x.a.localeCompare(y.a) || x.b.localeCompare(y.b))
}

/* ─────────── موعدُ الشعبة الغالب، والمواعيدُ المرشَّحة ─────────── */

/** يومُها وساعتُها الأكثرُ تكرارا — والتعادلُ لأسبقهما */
export function mainSlot(sessions: readonly ClashInterval[]): WeeklySlot | null {
  const tally = new Map<string, { n: number; first: number; slot: WeeklySlot }>()
  for (const s of [...sessions].sort((x, y) => x.startsAt - y.startsAt)) {
    const at = new Date(s.startsAt)
    const slot = { weekday: new Date(`${zonedDay(at)}T12:00:00Z`).getUTCDay(), clock: zonedClock(at) }
    const key = `${slot.weekday}|${slot.clock}`
    const t = tally.get(key) ?? { n: 0, first: s.startsAt, slot }
    t.n += 1
    tally.set(key, t)
  }
  const best = [...tally.values()].sort((x, y) => y.n - x.n || x.first - y.first)[0]
  return best?.slot ?? null
}

const minutesOf = (clock: string) => { const [h, m] = clock.split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const clockOf = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
const FRIDAY = 5
/** صلاةُ الجمعة — لا لقاءَ يمسّها */
const FRIDAY_PRAYER = { from: minutesOf('11:30'), to: minutesOf('13:30') }
/** أبكرُ موعدٍ في العطلة */
const WEEKEND_EARLIEST = minutesOf('10:00')

/** كلفةُ الانتقال من موعدٍ إلى آخر — كلّما قلّت كان التغييرُ على المدرّب وطلبته أخفّ.
    كلُّ نصف ساعةٍ نقطة، وتغييرُ اليوم خمس: فساعتان في اليوم نفسِه أخفُّ من يومٍ آخر بالساعة نفسِها. والانتقالُ
    بين أيّام العمل والعطلة أثقلُ من ذلك — يومُ عطلةٍ يُرتَّب له غيرُ مساءِ يوم عمل */
export function moveCost(from: WeeklySlot, to: WeeklySlot): number {
  const shift = Math.abs(minutesOf(from.clock) - minutesOf(to.clock)) / 30
  if (from.weekday === to.weekday) return shift
  const crossesWeekend = WORKDAYS.includes(from.weekday) !== WORKDAYS.includes(to.weekday)
  return 5 + shift + (crossesWeekend ? 4 : 0)
}

/** المواعيدُ المرشَّحةُ بترتيب قربها من موعدها — كلَّ نصف ساعة، بما يصلح للقاءٍ بطوله */
export function candidateSlots(from: WeeklySlot, minutes: number, rejected: readonly RejectedSlot[] = []): WeeklySlot[] {
  const out: WeeklySlot[] = []
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let m = WEEKEND_EARLIEST; m <= 22 * 60; m += 30) {
      const clock = clockOf(m)
      if (!fitsTime(weekday, clock, minutes)) continue
      if (weekday === FRIDAY && m < FRIDAY_PRAYER.to && m + minutes > FRIDAY_PRAYER.from) continue
      if (rejected.some((r) => (r.scope !== 'hour' && r.weekday === weekday && (r.scope === 'day' || r.clock === clock))
        || (r.scope === 'hour' && r.clock === clock))) continue
      out.push({ weekday, clock })
    }
  }
  return out.sort((x, y) => moveCost(from, x) - moveCost(from, y) || x.weekday - y.weekday || x.clock.localeCompare(y.clock))
}

/* ═══ وما يلتقي أكثرَ من مرّةٍ في الأسبوع: أيّامُه نفسُها بساعةٍ أخرى (٢٧ أكتوبر ٢٠٢٦) ═══

   سؤالُ صاحب المنصّة: «لماذا ثلاثٌ فقط وهي ثلاثون تعارضا؟». كانت الشعبةُ التي تلتقي يومين أو ثلاثةً في الأسبوع تعلق
   كلُّها («لا موعدَ أسبوعيٌّ واحدٌ يحملها») — وأكثرُ شعب الفصل كذلك، فلا ينحلّ ما بين اثنتين منها. فاختار («a»):
   **تبقى أيّامُها وتتغيّر الساعةُ وحدَها** — أخفُّ ما يقع على المدرّب وطلبته. */

/** أيّامُ لقاءاتها في الأسبوع بتوقيت عمّان — مرتّبةً من الأحد */
export function weekdaysOf(sessions: readonly ClashInterval[]): number[] {
  return [...new Set(sessions.map((s) => new Date(`${zonedDay(new Date(s.startsAt))}T12:00:00Z`).getUTCDay()))].sort((a, b) => a - b)
}

/** الساعاتُ المرشَّحةُ في أيّامها نفسِها بترتيب قربها — ما يصلح في كلّ يومٍ منها، وما لم يرفضه مدرّبُها.
    ومن رفض أيّامَها («هذا اليوم لا يناسبني») لا ساعةَ تحلّه هنا: الأيّامُ لا تتغيّر */
export function hourSlots(from: WeeklySlot, days: readonly number[], minutes: number, rejected: readonly RejectedSlot[] = []): WeeklySlot[] {
  if (rejected.some((r) => r.scope === 'day' && (r.days ?? [r.weekday]).some((d) => days.includes(d)))) return []
  const out: WeeklySlot[] = []
  for (let m = WEEKEND_EARLIEST; m <= 22 * 60; m += 30) {
    const clock = clockOf(m)
    if (!days.every((d) => fitsTime(d, clock, minutes))) continue
    if (days.includes(FRIDAY) && m < FRIDAY_PRAYER.to && m + minutes > FRIDAY_PRAYER.from) continue
    if (rejected.some((r) => r.clock === clock)) continue
    out.push({ weekday: from.weekday, clock, days })
  }
  const shift = (s: WeeklySlot) => Math.abs(minutesOf(s.clock) - minutesOf(from.clock))
  return out.sort((x, y) => shift(x) - shift(y) || x.clock.localeCompare(y.clock))
}

/* ═══ من ينتقل: أقلُّ عددٍ يحلّ الكلّ، وموزَّعٌ على المدرّبين (٢٧ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «إن نقلتَ واحدةً حلّت غيرَها، فاحسب جيّدا أوّلا وانقل واحدة.. ولا تطلب من مدرّبٍ أن ينقل
   شعبَه كلَّها — تغييرٌ من مدرّبٍ وآخرُ من غيره». فقبل أيّ بناء يُحسب من ينتقل على شبكة التعارضات:

   ① **ما يتعارض مع ثابتٍ ينتقل** — لا حلَّ غيرُه، فتعارضُه يبقى قائما حتّى يُختار.
   ② و**أكثرُها تعارضا** أوّلا: نقلةٌ واحدةٌ تحلّ ثلاثا خيرٌ من ثلاث. فإن تساوت: ما لا طلبةَ فيه، ثمّ **مدرّبٌ لم
      يُطلب منه شيءٌ بعد**، ثمّ ما يلتقي مرّةً في الأسبوع (يتغيّر فيه أقلّ)، ثمّ أقلُّها طلبة.
   ③ تُزال تعارضاتُه ويُعاد الحساب — حتّى لا يبقى تعارضٌ إلّا بين ثابتين.
   ④ **ولا نقلةَ زائدة**: من اختير ثمّ لم يبق له حين يُوضع تعارضٌ — لأنّ من كان يتعارض معه انتقل — يبقى على موعده
      (`planClashFree`: لا يُبنى جدولٌ لما لا يتعارض). */
function chooseMovers(cohorts: readonly ClashCohort[], pairs: readonly ClashPair[], pinned: (c: ClashCohort) => boolean): string[] {
  const byId = new Map(cohorts.map((c) => [c.cohortId, c]))
  /** تعارضاتُ كلّ شعبةٍ التي لم تُحلّ بعد */
  const live = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    if (!live.has(a)) live.set(a, new Set())
    live.get(a)!.add(b)
  }
  for (const p of pairs) { link(p.a, p.b); link(p.b, p.a) }
  const load = new Map<string, number>()
  const loadOf = (c: ClashCohort) => Math.max(0, ...c.trainerIds.map((t) => load.get(t) ?? 0))
  const chosen: string[] = []
  for (;;) {
    const pool = [...live.keys()].filter((id) => live.get(id)!.size > 0 && !pinned(byId.get(id)!)).map((id) => byId.get(id)!)
    if (pool.length === 0) break
    const key = (c: ClashCohort) => [
      -live.get(c.cohortId)!.size, Number(c.learners > 0), loadOf(c), Number(twiceWeekly(c.sessions)), c.learners,
      c.sessions[0]?.startsAt ?? 0,
    ]
    const best = pool.sort((x, y) => {
      const kx = key(x)
      const ky = key(y)
      const i = kx.findIndex((v, j) => v !== ky[j])
      return i < 0 ? x.cohortId.localeCompare(y.cohortId) : kx[i]! - ky[i]!
    })[0]!
    chosen.push(best.cohortId)
    for (const t of best.trainerIds) load.set(t, (load.get(t) ?? 0) + 1)
    for (const n of live.get(best.cohortId)!) live.get(n)!.delete(best.cohortId)
    live.get(best.cohortId)!.clear()
  }
  return chosen
}

/* ─────────── الحلّ ─────────── */

/** لقاءان بينهما أقلُّ من ستّة أيّام — أي أكثرُ من لقاءٍ في الأسبوع */
export function twiceWeekly(sessions: readonly ClashInterval[]): boolean {
  const starts = sessions.map((s) => s.startsAt).sort((a, b) => a - b)
  return starts.some((t, i) => i > 0 && t - starts[i - 1]! < 6 * 24 * 3_600_000)
}

export type ClashRow<T> =
  | { cohortId: string; action: 'keep'; slot: WeeklySlot | null }
  /** يُنقل: من موعده إلى موعدٍ لا يتعارض، ومع من كان يتعارض ولماذا */
  | { cohortId: string; action: 'move'; from: WeeklySlot | null; to: WeeklySlot; clashes: { cohortId: string; whyAr: string }[]; payload: T }
  /** يتعارض ولا يُنقل — لأنّه ثابت، أو لم يوجد له موعد */
  | { cohortId: string; action: 'stuck'; slot: WeeklySlot | null; clashes: { cohortId: string; whyAr: string }[]; whyAr: string }

export interface ClashPlan<T> {
  rows: ClashRow<T>[]
  /** التعارضاتُ الآن، قبل أيّ نقل */
  before: ClashPair[]
}

/** أوّلُ سطر «لماذا» في بطاقات هذه الشاشة — به تُعرف بطاقتُها من جداول المسارات الأخرى */
export const CLASH_REASON_PREFIX = 'موعدها الآن يتعارض'

/** سطرُ «لماذا» في البطاقة — بلغة المدرّب، وبأسماء الدورات لا المدرّبين */
export function clashWhyAr(clashes: readonly { courseTitleAr: string; whyAr: string }[]): string {
  if (clashes.length === 0) return `${CLASH_REASON_PREFIX} مع دورة قريبة منها`
  const first = clashes[0]!
  const more = clashes.length - 1
  const tail = more === 0 ? '' : more === 1 ? ' ودورة أخرى' : more === 2 ? ' ودورتين أخريين' : ` و${more} دورات أخرى`
  return `${CLASH_REASON_PREFIX} مع «${first.courseTitleAr}»${tail} ${first.whyAr}، والطالب نفسه قد يريد الدورتين`
}

export function planClashFree<T>(input: {
  cohorts: readonly ClashCohort[]
  courses: ReadonlyMap<string, ClashCourse>
  build: BuildSchedule<T>
}): ClashPlan<T> {
  const { cohorts, courses, build } = input
  const before = findClashes(cohorts, courses)
  const pinned = (c: ClashCohort) => c.fixedAr !== null || Boolean(c.proposed)
  /* من ينتقل يُحسب أوّلا على الشبكة كما ستكون — والشعبةُ التي عليها اقتراحٌ قائمٌ توضع على ما يقترحه */
  const effective = cohorts.map((c) => (c.proposed ? { ...c, sessions: c.proposed } : c))
  const movers = chooseMovers(effective, findClashes(effective, courses), pinned)
  const moving = new Set(movers)
  /* فيوضع الباقون على مواعيدهم أوّلا — الثابتُ قبل غيره — ثمّ ينتقل من اختير حولهم بترتيب اختياره */
  const byStart = (x: ClashCohort, y: ClashCohort) =>
    (x.sessions[0]?.startsAt ?? 0) - (y.sessions[0]?.startsAt ?? 0) || x.cohortId.localeCompare(y.cohortId)
  const stays = cohorts.filter((c) => !moving.has(c.cohortId)).sort((x, y) => Number(pinned(y)) - Number(pinned(x)) || byStart(x, y))
  const order = [...stays, ...movers.map((id) => cohorts.find((c) => c.cohortId === id)!)]

  const placed = new Map<string, readonly ClashInterval[]>()
  const byId = new Map(cohorts.map((c) => [c.cohortId, c]))
  /** مع من يتعارض هذا الوضعُ ممّا وُضع قبله */
  const clashesOf = (c: ClashCohort, sessions: readonly ClashInterval[]) => {
    const out: { cohortId: string; whyAr: string }[] = []
    for (const [id, other] of placed) {
      const why = cohortLinkAr(c, byId.get(id)!, courses)
      if (why && overlapOf(sessions, other)) out.push({ cohortId: id, whyAr: why })
    }
    return out
  }
  const titleOf = (id: string) => courses.get(byId.get(id)?.courseId ?? '')?.titleAr ?? byId.get(id)?.title ?? ''

  const rows: ClashRow<T>[] = []
  for (const c of order) {
    const now = c.proposed ?? c.sessions
    const main = mainSlot(now)
    const slot = main && twiceWeekly(now) ? { ...main, days: weekdaysOf(now) } : main
    const clashes = clashesOf(c, now)
    if (clashes.length === 0 || pinned(c)) {
      placed.set(c.cohortId, now)
      rows.push(clashes.length === 0
        ? { cohortId: c.cohortId, action: 'keep', slot }
        : { cohortId: c.cohortId, action: 'stuck', slot, clashes, whyAr: c.fixedAr ?? 'عليها اقتراح موعد لم يقرر فيه مدرّبها' })
      continue
    }
    /* وما يلتقي أكثرَ من مرّةٍ في الأسبوع لا يُضغط إلى يومٍ واحد: أيّامُه نفسُها بساعةٍ أخرى (`hourSlots`) */
    const longest = Math.max(...now.map((s) => Math.round((s.endsAt - s.startsAt) / 60_000)))
    const why = clashWhyAr(clashes.map((x) => ({ courseTitleAr: titleOf(x.cohortId), whyAr: x.whyAr })))
    let chosen: { to: WeeklySlot; sessions: readonly ClashInterval[]; payload: T } | null = null
    let lastFail: string | null = null
    /* وإن صلح موعدٌ وتعارض لم يُقل سببُ آخرِ ما لم يصلح — فذاك أبعدُ المواعيد لا سببُ العلوق */
    let built = false
    const candidates = !slot ? []
      : slot.days ? hourSlots(slot, slot.days, longest, c.rejected ?? [])
      : candidateSlots(slot, longest, c.rejected ?? [])
    for (const to of candidates) {
      if (slot && to.clock === slot.clock && (slot.days || to.weekday === slot.weekday)) continue
      const r = build(c.cohortId, to, why)
      if (!r.ok) { lastFail = r.reasonAr; continue }
      built = true
      if (clashesOf(c, r.sessions).length > 0) continue
      chosen = { to, sessions: r.sessions, payload: r.payload }
      break
    }
    if (!chosen) {
      placed.set(c.cohortId, now)
      rows.push({
        cohortId: c.cohortId, action: 'stuck', slot, clashes,
        whyAr: lastFail && !built ? `لا موعد بلا تعارض يصلح لها — ${lastFail}`
          : slot?.days && candidates.length === 0 && (c.rejected ?? []).some((r) => r.scope === 'day') ? 'رفض مدربها أيامها، والنقل هنا يغير الساعة وحدها'
          : slot?.days ? 'لا ساعة بلا تعارض في أيامها نفسها'
          : 'لا موعد بلا تعارض يصلح لها',
      })
      continue
    }
    placed.set(c.cohortId, chosen.sessions)
    rows.push({ cohortId: c.cohortId, action: 'move', from: slot, to: chosen.to, clashes, payload: chosen.payload })
  }
  /* بترتيب الشعب كما جاءت — لا بترتيب الحلّ */
  const index = new Map(cohorts.map((c, i) => [c.cohortId, i]))
  rows.sort((x, y) => index.get(x.cohortId)! - index.get(y.cohortId)!)
  return { rows, before }
}

/** «الثلاثاء 19:00» */
export const slotAr = (s: WeeklySlot | null): string => {
  if (!s) return '—'
  const days = (s.days?.length ? s.days : [s.weekday]).map((d) => WEEKDAY_AR[d] ?? '')
  const and = days.length === 1 ? days[0]! : `${days.slice(0, -1).join('، ')} و${days[days.length - 1]}`
  return `${and} ${s.clock}`
}

/* ─────────── سببُ الرفض — يختاره المدرّبُ بنقرة، فنعرف ما لا نقترحه ثانية ─────────── */

export const SCHEDULE_REJECT_REASONS = [
  { scope: 'day', labelAr: 'هذا اليوم لا يناسبني' },
  { scope: 'hour', labelAr: 'هذه الساعة لا تناسبني' },
] as const

/** ما رفضه المدرّبُ من سطر رفضه: اليومُ أو الساعةُ إن بدأ بأحد السببين، وإلّا الموعدُ وحدَه */
export function rejectedScope(noteAr: string | null | undefined): RejectedSlot['scope'] {
  const note = (noteAr ?? '').trim()
  return SCHEDULE_REJECT_REASONS.find((r) => note.startsWith(r.labelAr))?.scope ?? 'slot'
}

/** سطرُ الرفض بسببه أوّلا — يُبدَّل السببُ إن كان فيه غيرُه، ويبقى ما كتبه بعده */
export function withRejectReason(note: string, labelAr: string): string {
  const rest = SCHEDULE_REJECT_REASONS.reduce((t, r) => (t.startsWith(r.labelAr) ? t.slice(r.labelAr.length) : t), note)
    .replace(/^\s*[—-]?\s*/, '')
  return rest ? `${labelAr} — ${rest}` : labelAr
}

/* ─────────── تنبيهُ المدرّب وهو يختار موعدَ لقائه (٢٢ أكتوبر ٢٠٢٦) ─────────── */

/** لقاءٌ لدورةٍ قريبةٍ من دورته — باسم الدورة وسبب الربط، لا باسم مدرّبها */
export interface NearbyTime { startsAt: string; endsAt: string; courseTitleAr: string; whyAr: string }

/** ما يقع من لقاءات الدورات القريبة على هذا الوقت */
export function nearbyAt(nearby: readonly NearbyTime[], from: Date, to: Date): NearbyTime[] {
  const a = from.getTime()
  const b = to.getTime()
  return nearby.filter((n) => Date.parse(n.startsAt) < b && a < Date.parse(n.endsAt))
}

/** لقاءاتُ الدورات القريبة في يومٍ واحدٍ بتوقيت عمّان — يرى ما يتجنّبه قبل أن يختار الساعة */
export function nearbyOnDay(nearby: readonly NearbyTime[], day: string): NearbyTime[] {
  return nearby.filter((n) => zonedDay(new Date(n.startsAt)) === day)
}

/** «19:00–21:00 دورة X» */
export const nearbySpanAr = (n: NearbyTime) =>
  `${zonedClock(new Date(n.startsAt))}–${zonedClock(new Date(n.endsAt))} «${n.courseTitleAr}»`

/** سطرُ التنبيه: مع من يتعارض ولماذا، ثمّ الخيار — والقرارُ له */
export function nearbyWarnAr(hits: readonly NearbyTime[]): string | null {
  if (hits.length === 0) return null
  const titles = [...new Set(hits.map((h) => h.courseTitleAr))]
  const first = hits[0]!
  const more = titles.length - 1
  const tail = more === 0 ? '' : more === 1 ? ' ودورة أخرى' : ` و${more} دورات أخرى`
  return `في هذا الوقت لقاء «${first.courseTitleAr}»${tail} ${first.whyAr}، وقد يريد الطالب الدورتين معا. ننصح بوقت آخر، ولك أن تحفظه كما هو.`
}

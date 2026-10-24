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

/** يومٌ وساعةٌ أسبوعيّان — `weekday` بـ`getUTCDay` (٠ الأحد) */
export interface WeeklySlot { weekday: number; clock: string }

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
  const degree = new Map<string, number>()
  for (const p of before) {
    degree.set(p.a, (degree.get(p.a) ?? 0) + 1)
    degree.set(p.b, (degree.get(p.b) ?? 0) + 1)
  }
  const pinned = (c: ClashCohort) => c.fixedAr !== null || Boolean(c.proposed)
  const order = [...cohorts].sort((x, y) =>
    Number(pinned(y)) - Number(pinned(x))
    || y.learners - x.learners
    || (degree.get(x.cohortId) ?? 0) - (degree.get(y.cohortId) ?? 0)
    || (x.sessions[0]?.startsAt ?? 0) - (y.sessions[0]?.startsAt ?? 0)
    || x.cohortId.localeCompare(y.cohortId))

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
    const slot = mainSlot(now)
    const clashes = clashesOf(c, now)
    if (clashes.length === 0 || pinned(c)) {
      placed.set(c.cohortId, now)
      rows.push(clashes.length === 0
        ? { cohortId: c.cohortId, action: 'keep', slot }
        : { cohortId: c.cohortId, action: 'stuck', slot, clashes, whyAr: c.fixedAr ?? 'عليها اقتراح موعد لم يقرر فيه مدرّبها' })
      continue
    }
    /* ═══ وما يلتقي أكثرَ من مرّةٍ في الأسبوع لا يُنقل إلى يومٍ واحد (٢٤ أكتوبر ٢٠٢٦) ═══
       الجدولُ المقترحُ يومٌ وساعةٌ كلَّ أسبوع، فكان يضغط لقاءين أسبوعيّين إلى لقاءٍ ويؤخّر آخرَها. فيُقال سببُه
       ويُرتَّب بيد مدرّبه */
    if (twiceWeekly(now)) {
      placed.set(c.cohortId, now)
      rows.push({ cohortId: c.cohortId, action: 'stuck', slot, clashes, whyAr: 'لقاءاتها أكثر من مرة في الأسبوع — لا موعد أسبوعي واحد يحملها' })
      continue
    }
    const longest = Math.max(...now.map((s) => Math.round((s.endsAt - s.startsAt) / 60_000)))
    const why = clashWhyAr(clashes.map((x) => ({ courseTitleAr: titleOf(x.cohortId), whyAr: x.whyAr })))
    let chosen: { to: WeeklySlot; sessions: readonly ClashInterval[]; payload: T } | null = null
    let lastFail: string | null = null
    for (const to of slot ? candidateSlots(slot, longest, c.rejected ?? []) : []) {
      if (slot && to.weekday === slot.weekday && to.clock === slot.clock) continue
      const r = build(c.cohortId, to, why)
      if (!r.ok) { lastFail = r.reasonAr; continue }
      if (clashesOf(c, r.sessions).length > 0) continue
      chosen = { to, sessions: r.sessions, payload: r.payload }
      break
    }
    if (!chosen) {
      placed.set(c.cohortId, now)
      rows.push({
        cohortId: c.cohortId, action: 'stuck', slot, clashes,
        whyAr: lastFail ? `لا موعد بلا تعارض يصلح لها — ${lastFail}` : 'لا موعد بلا تعارض يصلح لها',
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
export const slotAr = (s: WeeklySlot | null): string => (s ? `${WEEKDAY_AR[s.weekday]} ${s.clock}` : '—')

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

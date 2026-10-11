/* ═══ جدولٌ ثابتٌ مقترح — كاملا بسلسلته (١١ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة لمّا رأى نصيحةَ «إيقاعٌ ثابتٌ وبلا عطل: 7 مواعيدَ مختلفة»: «يجب أن تكون ماذا كان
   وماذا نقترح.. وفي حال قمنا بتعديل شيءٍ قد يؤثّر على توقيتاتٍ أخرى يجب أن يكون التعديلُ كاملا بسلسلة،
   لكي لا نخرّب بدلَ ما نُصلح». ثمّ اختار: بطاقةٌ واحدةٌ بالجدول الجديد كلِّه.

   فهذا الملفُّ يبني الجدولَ من لقاءات الشعبة نفسِها:

   ① **اليومُ والساعة** أكثرُ ما في لقاءاته تكرارا ممّا يصلح وقتا (بعد الخامسة في أيّام العمل، ولا ينتهي
      بعد العاشرة والنصف) — فيتغيّر أقلُّ ما يمكن.
   ② **كلُّ لقاءٍ في موعد محوره** (`slots`) على ذلك اليوم، أقربَ ما يكون من تاريخه، بلا عطلة، وبترتيبه.
   ③ **والسلسلة**: مهمّةُ المحور تنتقل بقدر ما انتقل أوّلُ لقاءٍ له، ومشروعُ التخرّج يبقى بعد آخر لقاءٍ
      بأسبوع — ولا شيءَ يخرج عن مدّة الشعبة.
   ④ **ولا يُقترح ما يُفسد**: تُقاس البطاقةُ قبله وبعده (`planScorecard`) — فإن ساء معيارُ توقيتٍ واحد، أو
      سقط مُلزِمٌ لم يكن ساقطا، أو لم يتحسّن الإيقاع، لم يُقترح شيءٌ وقيل لماذا.

   وهو محضٌ لا يعرف قاعدة: يقرؤه الخادمُ حين تطلبه الإدارة، فيصير مسوّدةً تعتمدها قبل أن يراها المدرّب. */

import { MIN_SESSION_MINUTES } from './session-length'
import { zonedAt, zonedClock, zonedDay, type CohortPeriod } from './cohort-period'
import type { PlanSlot } from './axis-timeline'
import {
  HOLIDAYS, LATEST_END, MAX_DISTINCT_SLOTS, planScorecard, PROJECT_AFTER_SESSIONS_DAYS, WEEKDAY_AR, WORKDAY_EARLIEST, WORKDAYS,
  type ScorecardSession, type ScorecardTask, type ScoreItem,
} from './plan-scorecard'

const DAY_MS = 86_400_000

/** معاييرُ التوقيت التي لا يُسمح لجدولٍ مقترحٍ أن يُسيئها */
export const TIMING_KEYS = ['rhythm', 'session_times', 'session_gaps', 'weekly_load', 'task_timing', 'project_time'] as const

export interface ScheduleInput {
  period: CohortPeriod | null
  /** محتوى الخطّة — منه المحاورُ ومواعيدُها (`slots`) */
  content: unknown
  sessions: readonly (ScorecardSession & { id: string })[]
  tasks: readonly (ScorecardTask & { id: string })[]
  now?: Date
}

export interface ScheduleMove { sessionId: string; startsAt: string; endsAt: string }
export interface ScheduleTaskMove { assessmentId: string; dueAt: string }
export interface ScheduleEdit {
  kind: 'schedule'
  /** اليومُ (`getUTCDay`: ٠ الأحد) والساعةُ الثابتان */
  weekday: number
  clock: string
  moves: ScheduleMove[]
  tasks: ScheduleTaskMove[]
}

export type ScheduleProposal = { ok: true; edit: ScheduleEdit; reasonAr: string } | { ok: false; reasonAr: string }

/* ─────────── أيّامٌ وساعات ─────────── */

const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay()
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY_MS)
const minutesOf = (clock: string) => { const [h, m] = clock.split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const clockOf = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
const holiday = (day: string) => HOLIDAYS.some((h) => day.slice(5) === h.day)

/** أيصلح هذا اليومُ وهذه الساعةُ للقاءٍ بهذا الطول؟ — بقاعدة «أوقاتُ اللقاءات» نفسِها */
export function fitsTime(weekday: number, clock: string, mins: number): boolean {
  if (WORKDAYS.includes(weekday) && clock < WORKDAY_EARLIEST) return false
  return minutesOf(clock) + mins <= minutesOf(LATEST_END)
}

const gapsOf = (items: readonly ScoreItem[], key: string) => items.find((i) => i.key === key)?.gaps.length ?? 0
const labelOf = (items: readonly ScoreItem[], key: string) => items.find((i) => i.key === key)?.labelAr ?? key

/* ─────────── الجدول ─────────── */

export function proposeSchedule(input: ScheduleInput): ScheduleProposal {
  const live = input.sessions
    .filter((s) => !s.placeholder && s.status !== 'cancelled' && s.startsAt)
    .map((s) => {
      const at = new Date(s.startsAt).getTime()
      const end = s.endsAt ? new Date(s.endsAt).getTime() : null
      const mins = end && end > at ? Math.round((end - at) / 60_000) : MIN_SESSION_MINUTES
      return { id: s.id, at, mins, day: zonedDay(new Date(at)), clock: zonedClock(new Date(at)), moduleIds: [...(s.moduleIds ?? [])] }
    })
    .sort((a, b) => a.at - b.at)
  if (live.length < 2) return { ok: false, reasonAr: 'أقلُّ من لقاءين — لا جدولَ يُرتَّب' }

  const score = (sessions: ScheduleInput['sessions'], tasks: ScheduleInput['tasks']) =>
    planScorecard({ period: input.period, content: input.content, sessions, assessments: tasks, now: input.now })
  const before = score(input.sessions, input.tasks)
  if (gapsOf(before, 'rhythm') === 0 && gapsOf(before, 'session_times') === 0) {
    return { ok: false, reasonAr: 'لقاءاتُه على يومٍ وساعةٍ ثابتين وفي وقتٍ مناسب — لا جدولَ يُقترح' }
  }

  /* ① اليومُ والساعة: الأكثرُ تكرارا ممّا يصلح للقاءاته كلِّها — فيتغيّر أقلُّ ما يمكن */
  const longest = Math.max(...live.map((s) => s.mins))
  const tally = new Map<string, { n: number; first: number; weekday: number; clock: string }>()
  for (const s of live) {
    const weekday = weekdayOf(s.day)
    const key = `${weekday}|${s.clock}`
    const t = tally.get(key) ?? { n: 0, first: s.at, weekday, clock: s.clock }
    t.n += 1
    tally.set(key, t)
  }
  const ranked = [...tally.values()].sort((a, b) => b.n - a.n || a.first - b.first)
  let target = ranked.find((t) => fitsTime(t.weekday, t.clock, longest))
  if (!target) {
    /* لا موعدَ قائمٌ يصلح: يومُه الأكثرُ تكرارا، وساعةٌ تنتهي فيها أطولُ لقاءاته قبل العاشرة والنصف */
    const weekday = ranked[0]!.weekday
    const latest = Math.floor((minutesOf(LATEST_END) - longest) / 30) * 30
    const clock = clockOf(Math.min(minutesOf('19:00'), latest))
    if (!fitsTime(weekday, clock, longest)) {
      return { ok: false, reasonAr: 'لقاءاتُه أطولُ من أن تقع في وقتٍ مناسبٍ مساءً — قسّمها أوّلا' }
    }
    target = { n: 0, first: 0, weekday, clock }
  }

  /* ② كلُّ لقاءٍ في موعد محوره، على ذلك اليوم، أقربَ ما يكون من تاريخه — بترتيبه وبلا عطلة */
  const slots = (((input.content as { slots?: PlanSlot[] } | null)?.slots) ?? []).filter((x) => x?.startsOn && x?.endsOn)
  const period = input.period
  let prev: string | null = null
  const moved = new Map<string, { at: number; endAt: number }>()
  const moves: ScheduleMove[] = []
  for (const s of live) {
    const slot = slots.find((x) => x.moduleIds.some((m) => s.moduleIds.includes(m)))
    let from = slot?.startsOn ?? period?.startsOn ?? s.day
    let to = slot?.endsOn ?? period?.endsOn ?? s.day
    if (period?.startsOn && from < period.startsOn) from = period.startsOn
    if (period?.endsOn && to > period.endsOn) to = period.endsOn
    const days: string[] = []
    let d = addDays(from, (target.weekday - weekdayOf(from) + 7) % 7)
    for (; d <= to; d = addDays(d, 7)) if (!holiday(d) && (!prev || d > prev)) days.push(d)
    if (days.length === 0) {
      return {
        ok: false,
        reasonAr: `لا ${WEEKDAY_AR[target.weekday]} في موعد لقاء ${s.day} بلا عطلةٍ وبعد ما قبله — رتّب مواعيدَ المحاور أوّلا`,
      }
    }
    const day = days.reduce((best, x) => (Math.abs(daysBetween(s.day, x)) < Math.abs(daysBetween(s.day, best)) ? x : best))
    prev = day
    const at = zonedAt(day, target.clock).getTime()
    moved.set(s.id, { at, endAt: at + s.mins * 60_000 })
    if (at !== s.at) moves.push({ sessionId: s.id, startsAt: new Date(at).toISOString(), endsAt: new Date(at + s.mins * 60_000).toISOString() })
  }
  if (moves.length === 0) return { ok: false, reasonAr: 'لقاءاتُه على اليوم والساعة أنفسِهما — لا جدولَ يُقترح' }

  /* ③ والسلسلة: مهمّةُ المحور بقدر ما انتقل أوّلُ لقاءٍ له، والمشروعُ بعد آخر لقاءٍ بأسبوع — داخلَ المدّة */
  const firstOf = (moduleId: string) => live.find((s) => s.moduleIds.includes(moduleId))
  const endOfPeriod = (iso: string) => (period?.endsOn && zonedDay(iso) > period.endsOn ? zonedAt(period.endsOn, zonedClock(iso)).toISOString() : iso)
  const taskMoves: ScheduleTaskMove[] = []
  const lastOld = live[live.length - 1]!
  const lastNewAt = Math.max(...live.map((s) => moved.get(s.id)!.at))
  for (const t of input.tasks) {
    if (!t.dueAt || t.status === 'archived') continue
    const due = new Date(t.dueAt)
    let next: string | null = null
    if (t.type === 'project') {
      const oldGap = daysBetween(lastOld.day, zonedDay(due))
      const newLast = zonedDay(new Date(lastNewAt))
      if (oldGap >= PROJECT_AFTER_SESSIONS_DAYS && daysBetween(newLast, zonedDay(due)) < PROJECT_AFTER_SESSIONS_DAYS) {
        next = zonedAt(addDays(newLast, PROJECT_AFTER_SESSIONS_DAYS), zonedClock(due)).toISOString()
      }
    } else if (t.moduleId) {
      const s = firstOf(t.moduleId)
      if (s) {
        const shift = Math.round((moved.get(s.id)!.at - s.at) / DAY_MS)
        if (shift !== 0) next = zonedAt(addDays(zonedDay(due), shift), zonedClock(due)).toISOString()
      }
    }
    if (next) {
      next = endOfPeriod(next)
      if (Date.parse(next) !== due.getTime()) taskMoves.push({ assessmentId: t.id, dueAt: next })
    }
  }

  /* ④ ولا يُقترح ما يُفسد — البطاقةُ قبله وبعده */
  const after = score(
    input.sessions.map((s) => {
      const m = moved.get(s.id)
      return m ? { ...s, startsAt: new Date(m.at).toISOString(), endsAt: new Date(m.endAt).toISOString() } : s
    }),
    input.tasks.map((t) => {
      const m = taskMoves.find((x) => x.assessmentId === t.id)
      return m ? { ...t, dueAt: m.dueAt } : t
    }),
  )
  for (const key of TIMING_KEYS) {
    if (gapsOf(after, key) > gapsOf(before, key)) {
      return { ok: false, reasonAr: `جدولٌ ثابتٌ هنا يُسيء «${labelOf(after, key)}» — فلا يُقترح. رتّبه بيدك أو اكتب ملاحظة` }
    }
  }
  const wasBlocked = new Set(before.filter((i) => i.status === 'blocked').map((i) => i.key))
  const newlyBlocked = after.find((i) => i.status === 'blocked' && !wasBlocked.has(i.key))
  if (newlyBlocked) return { ok: false, reasonAr: `جدولٌ ثابتٌ هنا يُسقط «${newlyBlocked.labelAr}» — فلا يُقترح` }
  if (gapsOf(after, 'rhythm') + gapsOf(after, 'session_times') >= gapsOf(before, 'rhythm') + gapsOf(before, 'session_times')) {
    return { ok: false, reasonAr: 'لا جدولَ ثابتٌ يُحسّن الإيقاعَ داخلَ مواعيد المحاور — رتّبها أوّلا' }
  }

  /* والسببُ «ما هو الآن ← ما نقترح» (صاحب المنصّة، ١١ أكتوبر ٢٠٢٦): ما في لقاءاته اليومَ أوّلا، ثمّ الجدول */
  const nowAr = tally.size > MAX_DISTINCT_SLOTS ? `لقاءاتُك اليومَ على ${tally.size} مواعيدَ مختلفة`
    : live.some((s) => holiday(s.day)) ? 'من لقاءاتك اليومَ ما يقع في عطلةٍ رسميّة'
    : 'من لقاءاتك اليومَ ما يقع في وقتٍ غيرِ مناسب'
  const n = taskMoves.length
  const tasksAr = n === 0 ? '' : ` ومعها ${n === 1 ? 'موعدُ مهمّة' : n === 2 ? 'موعدا مهمّتين' : n <= 10 ? `مواعيدُ ${n} مهامّ` : `مواعيدُ ${n} مهمّةً`} تتبعها`
  const movedAr = moves.length === 1 ? 'لقاءٌ واحد' : moves.length === 2 ? 'لقاءان' : moves.length <= 10 ? `${moves.length} لقاءات` : `${moves.length} لقاءً`
  return {
    ok: true,
    edit: { kind: 'schedule', weekday: target.weekday, clock: target.clock, moves, tasks: taskMoves },
    reasonAr: `${nowAr} — نقترح ${WEEKDAY_AR[target.weekday]} ${target.clock} كلَّ أسبوع: ينتقل ${movedAr} من ${live.length}${tasksAr}، داخلَ مواعيد محاورها وبلا عطل.`,
  }
}

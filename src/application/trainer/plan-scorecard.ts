/* ═══ بطاقةُ المعايير — ما تُقاس به خطّةُ الشعبة، تحسبه المنصّةُ لا العين (٨ أكتوبر ٢٠٢٦) ═══

   طلب صاحبُ المنصّة: «أضف معاييرَ أخرى لتقييم العمل، مثل عدد ساعات اللقاء
   المباشر وعدد التطبيقات العمليّة، والتوقيت للدورة والوقت بين الجلسات
   وأوقاتها… اقترح أخرى وأنا أوافقك». فاقتُرحت اثنا عشرَ معيارا كلُّها تُقرأ
   من بيانات الخطّة نفسِها، فوافق، ثمّ قرّر سؤالين:

   ① **المُلزِمُ أقلُّه** («Keep required minimal»): أربعةٌ وحدَها تمنع الإرسال —
      انتهاءُ الشعبة في ٣٠ يناير، وموعدُ مشروع التخرّج داخلَها، وتطبيقٌ عمليٌّ
      ومُسلَّمٌ لكلّ محور، ومصدرٌ لكلّ محور. ومعها ما كان مُلزِما قبلها (لقاءٌ
      لكلّ محور). وما عداها **نصيحةٌ** تُقال بسببها، والمدرّبُ يختار — على قاعدة
      «لا إجبارَ على فعل» (٢ أكتوبر ٢٠٢٦).
   ② **والمدرّبُ يراها فحصا ذاتيّا** قبل أن يرسل («Yes, as a self-check»): البطاقةُ
      نفسُها التي يراها المعتمِد، فلا يصل المعتمِدَ ما يُعاد لسببٍ كان يُرى.

   ── ولمَ ملفٌّ واحد ──

   تقرؤه ثلاثةُ مواضع: بطاقةُ المراجعة عند المعتمِد، وفحصُ المدرّب الذاتيّ،
   وملفُّ المراجعة في الحزمة المنزَّلة. والمُلزِمُ منه يقرؤه **حاجزُ الإرسال في
   الخادم** (`buildChecklist`) بالدوالّ نفسِها المصدَّرة هنا — وقاعدتان تقولان
   الشيءَ نفسَه في موضعين تفترقان، فيرى المدرّبُ أخضرَ ويُردّ إرسالُه.

   ── والعتباتُ أسماءٌ لا أرقامٌ في الشيفرة ──

   كلُّ عتبةٍ أدناه ثابتٌ باسمه وسببِه، فمن غيّر رقما غيّره في موضعٍ واحدٍ يُقرأ
   سببُه بجانبه. */

import { termOf } from '../terms/season'
import { cohortDayAr, whenAr } from '../learning/cohort-gate'
import { zonedClock, zonedDay, type CohortPeriod } from './cohort-period'
import { MIN_SESSION_MINUTES, sessionMinutes } from './session-length'
import { resourceCategory } from './plan-overlay'
import { resourceHasSource } from './module-body'
import { startAdvice } from './start-advice'
import type { WorkspaceStep } from './workspace-step'
import { REVIEW_NOTE_MAX, type ReviewNotes } from './review-notes'

/* ─────────── العتبات ─────────── */

/** آخرُ يومٍ لشعب موسم الشتاء — «ينتهي في ٣٠ يناير (مشروعُ التخرّج) ولو انتهت
    اللقاءاتُ في ديسمبر» (صاحب المنصّة). والمواسمُ الأخرى بلا حدٍّ حتّى يُقرَّر لها */
export const WINTER_LAST_DAY = '01-30'
/** ساعتان لكلّ محور — حدُّ اللقاء الواحد (`MIN_SESSION_MINUTES`) مقيسا بالمحور،
    فلا يُغطّي لقاءٌ واحدٌ ثلاثةَ محاور */
export const LIVE_MINUTES_PER_MODULE = MIN_SESSION_MINUTES
/** ثلاثُ ساعاتٍ أطولُ لقاءٍ بلا نصيحة — بعدها ينصرف الانتباه */
export const LONG_SESSION_MINUTES = 180
/** أسبوعٌ أقصرُ فاصلٍ بلا نصيحة — بينهما يُنجَز التكليف (`ADVISED_GAP_DAYS`) */
export const MIN_GAP_DAYS = 7
/** ثلاثةُ أسابيعَ أطولُ فاصلٍ — بعدها يبرد الزخم */
export const MAX_GAP_DAYS = 21
/** أربعُ ساعاتٍ مباشرةٌ في أيّ سبعة أيّام — أكثرُ المتعلّمين يعملون أو يدرسون */
export const MAX_WEEKLY_MINUTES = 240
/** أيّامُ العمل في الأردن الأحدُ إلى الخميس (`getUTCDay`: ٠ = الأحد) */
const WORKDAYS = [0, 1, 2, 3, 4]
/** لا لقاءَ يبدأ قبل الخامسة مساءً في يوم عمل */
export const WORKDAY_EARLIEST = '17:00'
/** ولا لقاءَ ينتهي بعد العاشرة والنصف ليلا */
export const LATEST_END = '22:30'
/** أكثرُ من موعدين أسبوعيّين مختلفين ليس إيقاعا ثابتا */
export const MAX_DISTINCT_SLOTS = 2
/** عطلٌ رسميّةٌ في الأردن داخلَ موسم الشتاء — شهرٌ-يوم */
export const HOLIDAYS: readonly { day: string; nameAr: string }[] = [
  { day: '12-25', nameAr: 'عيد الميلاد' },
  { day: '01-01', nameAr: 'رأس السنة' },
]
/** أسبوعٌ بين آخر لقاءٍ وموعد مشروع التخرّج — وقتٌ يُبنى فيه */
export const PROJECT_AFTER_SESSIONS_DAYS = 7
/** ثلاثةُ أيّامٍ بين أوّل لقاءِ المحور وموعد مهمّته — لا تُطلب قبل أن تُشرح */
export const TASK_AFTER_SESSION_DAYS = 3
/** مصدران لكلّ محورٍ نصيحةً، والمُلزِمُ واحد */
export const ADVISED_SOURCES_PER_MODULE = 2

const DAY_MS = 86_400_000

/* ─────────── المدخل ─────────── */

export interface ScorecardModule {
  moduleId: string
  titleAr?: string | null
  activityAr?: string | null
  artifactAr?: string | null
}
export interface ScorecardResource {
  title?: string | null
  url?: string | null
  bodyFileKey?: string | null
  kind?: string | null
  category?: string | null
  moduleId?: string | null
}
export interface ScorecardSession {
  startsAt: string | Date
  endsAt?: string | Date | null
  moduleIds?: readonly string[] | null
  status?: string | null
  placeholder?: boolean | null
}
export interface ScorecardTask {
  title?: string | null
  type: string
  dueAt?: string | Date | null
  moduleId?: string | null
  briefAr?: string | null
  maxScore?: number | null
  status?: string | null
}
export interface ScorecardInput {
  period: CohortPeriod | null
  /** محتوى الخطّة كما يُحفظ — `modules` و`resources` */
  content: unknown
  sessions: readonly ScorecardSession[]
  assessments: readonly ScorecardTask[]
  /** اللحظةُ التي يُحكم بها — لنصيحة البدء الموسميّة */
  now?: Date
}

/* ─────────── المخرَج ─────────── */

/** `ok` تحقّق · `advice` نصيحةٌ لم تتحقّق · `blocked` مُلزِمٌ لم يتحقّق */
export type ScoreStatus = 'ok' | 'advice' | 'blocked'

export interface ScoreItem {
  key: string
  labelAr: string
  /** المعيارُ بجملة — ما يُقاس عليه */
  standardAr: string
  /** ما قِيس — يُقال في الحالين، لا حين يسقط وحدَه */
  measuredAr: string
  /** ما ينقص، سطرا لكلّ موضع — فارغٌ حين تحقّق */
  gaps: string[]
  required: boolean
  status: ScoreStatus
  /** الخطوةُ التي يُصلَح فيها */
  step: WorkspaceStep
}

/* ─────────── المُلزِمُ — يقرؤه حاجزُ الإرسال في الخادم ─────────── */

/** آخرُ يومٍ تنتهي فيه شعبةٌ تبدأ في هذا اليوم — أو `null` لموسمٍ بلا حدّ */
export function seasonLastDay(startsOn: string): string | null {
  const start = new Date(`${startsOn}T12:00:00Z`)
  if (Number.isNaN(start.getTime())) return null
  const { year, season } = termOf(start)
  return season === 'nov_jan' ? `${year + 1}-${WINTER_LAST_DAY}` : null
}

/** تنتهي الشعبةُ بعد آخر يومٍ لموسمها؟ — بلغة من يصحّحه، أو `null` */
export function seasonEndProblem(period: CohortPeriod | null): string | null {
  if (!period?.startsOn || !period.endsOn) return null
  const last = seasonLastDay(period.startsOn)
  if (!last || period.endsOn <= last) return null
  return `تنتهي الشعبةُ في ${cohortDayAr(period.endsOn)} — وشعبُ موسم الشتاء تنتهي في ${cohortDayAr(last)} على الأكثر، ومعها مشروعُ التخرّج`
}

/** جملةٌ لا حرف — كلمتان على الأقلّ. «x» و«-» ليسا تطبيقا عمليّا */
function sentence(s: string | null | undefined): boolean {
  return (s ?? '').trim().split(/\s+/).filter(Boolean).length >= 2
}

const modulesOf = (content: unknown): ScorecardModule[] => {
  const m = (content as { modules?: unknown } | null)?.modules
  return Array.isArray(m) ? (m as ScorecardModule[]) : []
}
const resourcesOf = (content: unknown): ScorecardResource[] => {
  const r = (content as { resources?: unknown } | null)?.resources
  return Array.isArray(r) ? (r as ScorecardResource[]) : []
}

/** محاورُ بلا تطبيقٍ عمليٍّ أو بلا مُسلَّم — بأرقامها وما ينقص كلًّا */
export function practiceGaps(modules: readonly ScorecardModule[]): string[] {
  const out: string[] = []
  modules.forEach((m, i) => {
    const missing = [
      sentence(m.activityAr) ? null : 'تطبيقٍ عمليّ',
      sentence(m.artifactAr) ? null : 'مُسلَّم',
    ].filter(Boolean)
    if (missing.length) out.push(`المحور ${i + 1}: بلا ${missing.join(' ولا ')}`)
  })
  return out
}

/** مصادرُ المحور — ما له رابطٌ أو ملفّ، بلا الجلسات المسجّلة: تلك لقاءاتٌ لا مصادر */
function moduleSources(resources: readonly ScorecardResource[], moduleId: string): ScorecardResource[] {
  return resources.filter((r) => r.moduleId === moduleId && resourceCategory(r) !== 'recorded' && resourceHasSource(r))
}

/** محاورُ بلا مصدرٍ واحد — بأرقامها */
export function sourceGaps(modules: readonly ScorecardModule[], resources: readonly ScorecardResource[]): string[] {
  return modules.flatMap((m, i) => (moduleSources(resources, m.moduleId).length === 0 ? [`المحور ${i + 1}: بلا مصدر`] : []))
}

const live = (t: { status?: string | null }) => t.status !== 'closed'
const projectsOf = (tasks: readonly ScorecardTask[]) => tasks.filter((t) => t.type === 'project' && live(t))

/** مشروعُ التخرّج بموعدٍ داخلَ الشعبة؟ — بلغة من يصحّحه، أو `null`.
    وغيابُ المشروع نفسِه صفٌّ آخرُ في القائمة (`project`) فلا يُكرَّر هنا */
export function projectDeadlineProblem(
  projects: readonly { dueAt?: string | Date | null }[],
  period: CohortPeriod | null,
): string | null {
  if (projects.length === 0) return null
  if (projects.some((p) => !p.dueAt)) return 'مشروعُ التخرّج بلا آخر موعدٍ للتسليم — حدّده أنت، داخلَ مدّة الشعبة'
  if (!period?.endsOn) return null
  const late = projects.find((p) => zonedDay(p.dueAt!) > period.endsOn)
  return late
    ? `موعدُ مشروع التخرّج ${whenAr(late.dueAt!)} — بعد نهاية الشعبة في ${cohortDayAr(period.endsOn)}`
    : null
}

/* ─────────── البطاقة ─────────── */

const dayIndex = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS)
const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay()
const WEEKDAY_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

/** «ساعتان» و«٤ ساعات» و«٢٫٥ ساعة» — بعدد العربيّة لا برقمٍ وكلمةٍ متنافرين */
export function hoursAr(minutes: number): string {
  const h = Math.round(minutes / 6) / 10
  if (h === 1) return 'ساعة'
  if (h === 2) return 'ساعتان'
  if (Number.isInteger(h) && h >= 3 && h <= 10) return `${h} ساعات`
  return `${h} ساعة`
}

/** «يوم» و«يومين» و«٤ أيّام» و«١٢ يوما» — بعد «بعد» */
export function daysAr(d: number): string {
  if (d === 1) return 'يوم'
  if (d === 2) return 'يومين'
  if (d >= 3 && d <= 10) return `${d} أيّام`
  return `${d} يوما`
}

const item = (x: Omit<ScoreItem, 'status'>): ScoreItem => ({
  ...x,
  status: x.gaps.length === 0 ? 'ok' : x.required ? 'blocked' : 'advice',
})

/** البطاقةُ كاملة — بترتيب خطوات المدرّب */
export function planScorecard(input: ScorecardInput): ScoreItem[] {
  const modules = modulesOf(input.content)
  const resources = resourcesOf(input.content)
  const period = input.period
  const now = input.now ?? new Date()
  const sessions = input.sessions
    .filter((s) => !s.placeholder && s.status !== 'cancelled' && s.startsAt)
    .map((s) => {
      const minutes = s.endsAt ? sessionMinutes(s.startsAt, s.endsAt) : null
      /* لقاءٌ بلا نهايةٍ مقروءة يُحسب بالحدّ الأدنى الذي لا يُحفظ لقاءٌ دونه */
      const mins = minutes !== null && minutes > 0 ? minutes : MIN_SESSION_MINUTES
      const day = zonedDay(s.startsAt)
      return {
        at: new Date(s.startsAt).getTime(), day, mins,
        clock: zonedClock(s.startsAt),
        endClock: zonedClock(new Date(new Date(s.startsAt).getTime() + mins * 60_000)),
        endDay: zonedDay(new Date(new Date(s.startsAt).getTime() + mins * 60_000)),
        moduleIds: s.moduleIds ?? [],
        whenAr: whenAr(s.startsAt),
      }
    })
    .sort((a, b) => a.at - b.at)
  const tasks = input.assessments.filter(live)
  const graded = tasks.filter((t) => t.type !== 'project')
  const projects = projectsOf(tasks)
  const n = modules.length
  const out: ScoreItem[] = []

  /* ═══ المعلومات الأساسيّة ═══ */
  const endProblem = seasonEndProblem(period)
  const lastDay = period?.startsOn ? seasonLastDay(period.startsOn) : null
  out.push(item({
    key: 'end_date', labelAr: 'نهايةُ الشعبة', required: true, step: 'identity',
    standardAr: lastDay ? `تنتهي في ${cohortDayAr(lastDay)} على الأكثر` : 'داخلَ موسمها',
    measuredAr: period?.endsOn ? `تنتهي في ${cohortDayAr(period.endsOn)}` : 'لم تُحدَّد مدّتُها بعد',
    gaps: endProblem ? [endProblem] : [],
  }))
  const start = startAdvice(period?.startsOn, zonedDay(now))
  if (start === 'early' || start === 'thanks') {
    out.push(item({
      key: 'start_date', labelAr: 'بدايةُ الشعبة', required: false, step: 'identity',
      standardAr: 'من أواخر نوفمبر فما بعد — يتّسع وقتُ التسويق لها',
      measuredAr: `تبدأ في ${cohortDayAr(period!.startsOn)}`,
      gaps: start === 'early' ? ['تبدأ قبل أواخر نوفمبر — والقرارُ لك'] : [],
    }))
  }

  /* ═══ المحاور ═══ */
  const practice = practiceGaps(modules)
  out.push(item({
    key: 'practice', labelAr: 'التطبيقُ العمليّ والمُسلَّم', required: true, step: 'modules',
    standardAr: 'لكلّ محورٍ تطبيقٌ عمليٌّ ومُسلَّمٌ يقرؤه إنسان',
    measuredAr: `${n - practice.length} من ${n} محاورَ تامّة`,
    gaps: practice,
  }))

  /* ═══ اللقاءات ═══ */
  const totalMinutes = sessions.reduce((s, x) => s + x.mins, 0)
  const neededMinutes = n * LIVE_MINUTES_PER_MODULE
  out.push(item({
    key: 'live_hours', labelAr: 'ساعاتُ اللقاء المباشر', required: false, step: 'sessions',
    standardAr: `ساعتان لكلّ محورٍ على الأقلّ — ${hoursAr(neededMinutes)} لهذه الشعبة`,
    measuredAr: `${sessions.length} ${sessions.length === 1 ? 'لقاء' : 'لقاءات'} — ${hoursAr(totalMinutes)}`,
    gaps: totalMinutes < neededMinutes ? [`ينقصها ${hoursAr(neededMinutes - totalMinutes)}`] : [],
  }))
  const uncovered = modules.flatMap((m, i) => (sessions.some((s) => s.moduleIds.includes(m.moduleId)) ? [] : [`المحور ${i + 1}: بلا لقاءٍ مباشر`]))
  out.push(item({
    key: 'live_per_module', labelAr: 'لقاءٌ لكلّ محور', required: true, step: 'sessions',
    standardAr: 'لكلّ محورٍ لقاءٌ مباشرٌ واحدٌ على الأقلّ',
    measuredAr: `${n - uncovered.length} من ${n} محاورَ لها لقاء`,
    gaps: uncovered,
  }))
  const long = sessions.filter((s) => s.mins > LONG_SESSION_MINUTES)
  out.push(item({
    key: 'session_length', labelAr: 'طولُ اللقاء', required: false, step: 'sessions',
    standardAr: 'بين ساعتين وثلاث — وما زاد يُقسَم أو تُخطَّط فيه استراحة',
    measuredAr: sessions.length ? `أطولُها ${hoursAr(Math.max(...sessions.map((s) => s.mins)))}` : 'لا لقاءَ بعد',
    gaps: long.map((s) => `${s.whenAr}: ${hoursAr(s.mins)}`),
  }))
  const gapRows: string[] = []
  let shortest: number | null = null
  let longest: number | null = null
  for (let i = 1; i < sessions.length; i++) {
    const d = dayIndex(sessions[i]!.day) - dayIndex(sessions[i - 1]!.day)
    shortest = shortest === null ? d : Math.min(shortest, d)
    longest = longest === null ? d : Math.max(longest, d)
    if (d < MIN_GAP_DAYS) gapRows.push(`${sessions[i]!.whenAr}: ${d === 0 ? 'في يوم اللقاء السابق نفسِه' : `بعد ${daysAr(d)} من سابقه`}`)
    else if (d > MAX_GAP_DAYS) gapRows.push(`${sessions[i]!.whenAr}: بعد ${daysAr(d)} من سابقه`)
  }
  out.push(item({
    key: 'session_gaps', labelAr: 'الفاصلُ بين اللقاءات', required: false, step: 'sessions',
    standardAr: `أسبوعٌ إلى أسبوعين — ولا أقلَّ من ${MIN_GAP_DAYS} أيّام ولا أكثرَ من ${MAX_GAP_DAYS} يوما`,
    measuredAr: shortest === null ? 'أقلُّ من لقاءين' : `من ${shortest} إلى ${longest} يوما`,
    gaps: gapRows,
  }))
  let heaviest = 0
  let heaviestAt = ''
  for (const s of sessions) {
    const sum = sessions.filter((x) => x.at >= s.at && x.at < s.at + 7 * DAY_MS).reduce((a, x) => a + x.mins, 0)
    if (sum > heaviest) { heaviest = sum; heaviestAt = s.whenAr }
  }
  out.push(item({
    key: 'weekly_load', labelAr: 'العبءُ الأسبوعيّ', required: false, step: 'sessions',
    standardAr: `${hoursAr(MAX_WEEKLY_MINUTES)} مباشرةٌ في الأسبوع على الأكثر`,
    measuredAr: sessions.length ? `أثقلُ أسبوعٍ ${hoursAr(heaviest)}` : 'لا لقاءَ بعد',
    gaps: heaviest > MAX_WEEKLY_MINUTES ? [`سبعةُ أيّامٍ من ${heaviestAt}: ${hoursAr(heaviest)}`] : [],
  }))
  let badTimes = 0
  const timeRows = sessions.flatMap((s) => {
    const rows: string[] = []
    if (WORKDAYS.includes(weekdayOf(s.day)) && s.clock < WORKDAY_EARLIEST) rows.push(`${s.whenAr}: في ساعات العمل`)
    if (s.endDay > s.day || s.endClock > LATEST_END) rows.push(`${s.whenAr}: ينتهي ${s.endDay > s.day ? 'بعد منتصف الليل' : `في ${s.endClock}`}`)
    if (rows.length) badTimes++
    return rows
  })
  out.push(item({
    key: 'session_times', labelAr: 'أوقاتُ اللقاءات', required: false, step: 'sessions',
    standardAr: 'الأحدُ إلى الخميس بعد الخامسة مساءً، أو الجمعةُ والسبت — ولا ينتهي لقاءٌ بعد العاشرة والنصف ليلا (بتوقيت عمّان)',
    measuredAr: sessions.length ? `${sessions.length - badTimes} من ${sessions.length} في وقتٍ مناسب` : 'لا لقاءَ بعد',
    gaps: timeRows,
  }))
  const slots = new Set(sessions.map((s) => `${weekdayOf(s.day)}|${s.clock}`))
  const rhythmRows: string[] = []
  if (slots.size > MAX_DISTINCT_SLOTS) {
    const named = [...slots].map((k) => { const [d, c] = k.split('|'); return `${WEEKDAY_AR[Number(d)]} ${c}` })
    rhythmRows.push(`${slots.size} مواعيدَ مختلفة: ${named.join(' · ')}`)
  }
  for (const s of sessions) {
    const h = HOLIDAYS.find((x) => s.day.slice(5) === x.day)
    if (h) rhythmRows.push(`${s.whenAr}: ${h.nameAr} — عطلةٌ رسميّة`)
  }
  out.push(item({
    key: 'rhythm', labelAr: 'إيقاعٌ ثابتٌ وبلا عطل', required: false, step: 'sessions',
    standardAr: 'اليومُ والساعةُ أنفسُهما كلَّ أسبوع — ولا لقاءَ في ٢٥ ديسمبر ولا في ١ يناير',
    measuredAr: sessions.length ? `${slots.size} ${slots.size === 1 ? 'موعدٌ أسبوعيّ' : 'مواعيدُ أسبوعيّة'}` : 'لا لقاءَ بعد',
    gaps: rhythmRows,
  }))

  /* ═══ المهامّ والمصادر ═══ */
  const dueProblem = projectDeadlineProblem(projects, period)
  out.push(item({
    key: 'project', labelAr: 'مشروعُ التخرّج', required: true, step: 'assignments',
    standardAr: 'مشروعٌ واحدٌ بآخر موعدٍ يحدّده المدرّب داخلَ مدّة الشعبة',
    measuredAr: projects.length === 0 ? 'لا مشروع' : projects.every((p) => p.dueAt) ? `موعدُه ${whenAr(projects[0]!.dueAt!)}` : 'بلا موعد',
    gaps: projects.length === 0 ? ['لا مشروعَ تخرّجٍ في الشعبة'] : dueProblem ? [dueProblem] : [],
  }))
  const lastSession = sessions[sessions.length - 1]
  const tight = lastSession
    ? projects.filter((p) => p.dueAt && dayIndex(zonedDay(p.dueAt)) - dayIndex(lastSession.day) < PROJECT_AFTER_SESSIONS_DAYS)
    : []
  if (projects.length && lastSession) {
    out.push(item({
      key: 'project_time', labelAr: 'وقتٌ لبناء المشروع', required: false, step: 'assignments',
      standardAr: `أسبوعٌ على الأقلّ بين آخر لقاءٍ وموعد المشروع`,
      measuredAr: `آخرُ لقاءٍ ${lastSession.whenAr}`,
      gaps: tight.map((p) => `موعدُ «${p.title ?? 'المشروع'}» ${whenAr(p.dueAt!)} — أقربُ من أسبوعٍ بعد آخر لقاء`),
    }))
  }
  const ungraded = modules.flatMap((m, i) => (graded.some((t) => t.moduleId === m.moduleId) ? [] : [`المحور ${i + 1}: بلا مهمّةٍ مقيَّمة`]))
  const activities = modules.filter((m) => sentence(m.activityAr)).length
  out.push(item({
    key: 'graded_tasks', labelAr: 'التطبيقاتُ العمليّة', required: false, step: 'assignments',
    standardAr: 'مهمّةٌ مقيَّمةٌ لكلّ محور (واجبٌ أو اختبار) — غيرَ مشروع التخرّج',
    measuredAr: `${activities} ${activities === 1 ? 'تطبيقٌ عمليّ' : 'تطبيقاتٍ عمليّة'} في المحاور · ${graded.length} ${graded.length === 1 ? 'مهمّةٌ مقيَّمة' : 'مهامَّ مقيَّمة'}`,
    gaps: ungraded,
  }))
  const firstSessionOf = (moduleId: string) => sessions.find((s) => s.moduleIds.includes(moduleId))
  const taskRows: string[] = []
  for (const t of graded) {
    const name = `«${t.title ?? 'مهمّة'}»`
    if ((t.briefAr ?? '').trim().length < 20) taskRows.push(`${name}: بلا وصفٍ يكفي ليُنجَز`)
    if (!t.maxScore || t.maxScore <= 0) taskRows.push(`${name}: بلا درجة`)
    const first = t.moduleId ? firstSessionOf(t.moduleId) : undefined
    if (t.dueAt && first && dayIndex(zonedDay(t.dueAt)) - dayIndex(first.day) < TASK_AFTER_SESSION_DAYS) {
      taskRows.push(`${name}: موعدُها ${whenAr(t.dueAt)} — قبل أن يمضي ${TASK_AFTER_SESSION_DAYS} أيّامٍ على لقاء محورها`)
    }
  }
  const dues = graded.filter((t) => t.dueAt).map((t) => ({ t, d: dayIndex(zonedDay(t.dueAt!)) })).sort((a, b) => a.d - b.d)
  for (let i = 1; i < dues.length; i++) {
    if (dues[i]!.d - dues[i - 1]!.d < 7) taskRows.push(`«${dues[i]!.t.title ?? 'مهمّة'}» و«${dues[i - 1]!.t.title ?? 'مهمّة'}»: موعدان في أسبوعٍ واحد`)
  }
  out.push(item({
    key: 'task_timing', labelAr: 'توقيتُ المهامّ ووضوحُها', required: false, step: 'assignments',
    standardAr: `كلُّ مهمّةٍ بوصفٍ ودرجة، وموعدُها بعد ${TASK_AFTER_SESSION_DAYS} أيّامٍ من لقاء محورها، ولا موعدين في أسبوع`,
    measuredAr: `${graded.length} ${graded.length === 1 ? 'مهمّة' : 'مهامّ'}`,
    gaps: taskRows,
  }))
  const noSource = sourceGaps(modules, resources)
  out.push(item({
    key: 'sources', labelAr: 'مصدرٌ لكلّ محور', required: true, step: 'assignments',
    standardAr: 'لكلّ محورٍ مصدرٌ واحدٌ على الأقلّ برابطٍ أو ملفّ',
    measuredAr: `${n - noSource.length} من ${n} محاورَ لها مصدر`,
    gaps: noSource,
  }))
  const mixRows = modules.flatMap((m, i) => {
    if (noSource.includes(`المحور ${i + 1}: بلا مصدر`)) return []
    const own = moduleSources(resources, m.moduleId)
    const cats = new Set(own.map((r) => resourceCategory(r)))
    const rows: string[] = []
    if (own.length < ADVISED_SOURCES_PER_MODULE) rows.push(`المحور ${i + 1}: مصدرٌ واحد`)
    else if (cats.size < 2) rows.push(`المحور ${i + 1}: ${cats.has('reading') ? 'كلُّها مقروء — أضف فيديو أو بودكاست' : 'كلُّها روابطُ عامّة — أضف كتابا أو ملخّصَ كتاب'}`)
    return rows
  })
  out.push(item({
    key: 'sources_mix', labelAr: 'تنوّعُ المصادر', required: false, step: 'assignments',
    standardAr: 'مصدران لكلّ محورٍ على الأقلّ: مقروءٌ (كتابٌ أو ملخّصُه) ومسموعٌ أو مرئيّ (فيديو، TEDx، بودكاست) — والعربيّةُ أو المترجَمةُ يفحصها المراجِع',
    measuredAr: `مصادرُ الشعبة: ${resources.filter((r) => resourceCategory(r) !== 'recorded' && resourceHasSource(r)).length}`,
    gaps: mixRows,
  }))
  return out
}

/** ما يمنع الإرسالَ من البطاقة — المُلزِمُ الذي لم يتحقّق */
export const blockedItems = (items: readonly ScoreItem[]) => items.filter((i) => i.status === 'blocked')
/** ما يُنصَح به — ولا يمنع شيئا */
export const adviceItems = (items: readonly ScoreItem[]) => items.filter((i) => i.status === 'advice')

/** رمزُ الحالة في النصّ المنزَّل */
export const STATUS_MARK: Record<ScoreStatus, string> = { ok: '✅', advice: '⚠️', blocked: '❌' }

/* ═══ ملاحظاتُ الردّ من البطاقة — بنقرة، ثمّ تُعدَّل قبل أن تُرسَل ═══

   ما سقط من المعايير مكتوبٌ في البطاقة بموضعه، ومكتوبٌ ثانيةً بيد المعتمِد في
   صناديق الردّ لكلّ خطوة. فيُملأ الصندوقُ منها: المطلوبُ أوّلا ثمّ المقترَح، كلٌّ
   في خطوته. ولا تُرسَل وحدَها — يقرؤها المعتمِدُ ويحذف ويضيف ثمّ يرسل. */
const NOTE_STEPS = ['identity', 'modules', 'workbooks', 'sessions', 'assignments'] as const

export function scorecardNotes(items: readonly ScoreItem[]): ReviewNotes {
  const out: ReviewNotes = {}
  for (const step of NOTE_STEPS) {
    const own = items.filter((i) => i.step === step && i.status !== 'ok')
    if (own.length === 0) continue
    const line = (word: string) => (i: ScoreItem) => `${word} — ${i.labelAr}: ${i.gaps.join('؛ ')}`
    const text = [
      ...own.filter((i) => i.status === 'blocked').map(line('مطلوب')),
      ...own.filter((i) => i.status === 'advice').map(line('مقترَح')),
    ].join('\n')
    out[step] = text.length > REVIEW_NOTE_MAX ? `${text.slice(0, REVIEW_NOTE_MAX - 1)}…` : text
  }
  return out
}

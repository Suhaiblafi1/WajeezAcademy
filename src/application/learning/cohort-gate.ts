/* ═══ نافذةُ الشعبة للمتعلّم — متى يُفتح له الشيء، ومتى يُسلِّم، ومتى ينتهي وصولُه ═══

   من قرارات صاحب المنصّة العشرة بكلمة «go» (٢٧ سبتمبر ٢٠٢٦):

   ④ «بعد انتهاء الشعبة تتوقّف اللقاءاتُ والتسليمات، ويبقى للمتعلّم ستّةُ
     أشهرٍ يقرأ فيها ما فُتح له» — قراءةً لا تسليما، ثمّ ينتهي الوصول.
   ⑤ مهامُّ المحور تُفتح حين ينتهي أوّلُ لقاءٍ له (`axis-timeline.ts`).
   ⑥ آخرُ موعدٍ للتسليم آخرُ الموعد، و«المتأخّرُ يُقبل ويُعلَّم».

   ── ولمَن تنطبق ──

   على الشعبة التي لخطّتها المعتمَدة مواعيدُ محاور (`buildTimeline` غيرُ
   `null`). وما اعتُمد قبل المواعيد يمضي كما بدأ — «الشعبُ الجاريةُ تنتهي
   بطريقتها»: لا يُقفل تسليمٌ في شعبةٍ لم يُقل لمتعلّميها يوما إنّ له آخرا،
   ولا يُسحب وصولٌ لم يُعلَن له أجل.

   ── ولمَ ملفٌّ محض ──

   يقرؤه الخادمُ حين يقرّر ما يصل المتعلّمَ وما يقبله منه، وتقرؤه شاشتُه
   حين تقول له «تُفتح الثلاثاء». وقاعدتان في موضعين تفترقان — فيُقال له
   «مفتوحة» ويردّ الخادمُ تسليمه. ولا ساعةَ تُقرأ هنا: اللحظةُ تُمرَّر. */

import {
  ACADEMY_ZONE, asPeriod, periodBounds, realDate, zonedDay, zonedInstant, type CohortPeriod,
} from '../trainer/cohort-period'
import { buildTimeline, sessionEnd, type AxisTimeline, type PlanSlot, type TimelineResource } from '../trainer/axis-timeline'
import { fmtDateWith } from '../text/format-ar'

/** «ستّةُ أشهرٍ» يقرأ فيها ما فُتح له بعد انتهاء الشعبة (④) */
export const ACCESS_MONTHS = 6

/** تاريخٌ بعد أشهر — ويُقصّ إلى آخر الشهر: ٣١ أغسطس + ٦ = آخرُ فبراير، لا ٣ مارس */
export function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = total - ny * 12
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  const pad = (v: number, w: number) => String(v).padStart(w, '0')
  return `${pad(ny, 4)}-${pad(nm + 1, 2)}-${pad(Math.min(d, last), 2)}`
}

/** حدّا ما بعد الشعبة — لحظتان بتوقيت عمّان */
export interface CohortWindow {
  /** آخرُ لحظةٍ في الشعبة — آخرُ ثانيةٍ من يومها الأخير. بعدها لا لقاءَ ولا تسليم */
  closesAt: Date
  /** آخرُ لحظةٍ في القراءة — آخرُ يومٍ بعد ستّة أشهرٍ من انتهائها */
  accessEndsAt: Date
}

export function cohortWindow(period: CohortPeriod | null | undefined): CohortWindow | null {
  if (!period || !realDate(period.startsOn) || !realDate(period.endsOn)) return null
  return {
    closesAt: periodBounds(period).to,
    accessEndsAt: zonedInstant(addMonths(period.endsOn, ACCESS_MONTHS), [23, 59, 59, 999]),
  }
}

/** «مفتوحة» · «للقراءة» بعد انتهائها · «انتهى الوصول» */
export type AccessState = 'open' | 'readonly' | 'ended'

export function accessState(w: CohortWindow | null, now: Date): AccessState {
  if (!w) return 'open'
  if (now.getTime() <= w.closesAt.getTime()) return 'open'
  if (now.getTime() <= w.accessEndsAt.getTime()) return 'readonly'
  return 'ended'
}

/** مدّةُ الشعبة كما يحكم بها المتعلّم — من خطّتها المعتمَدة، وإلّا من تاريخَي الشعبة.
    والخطّةُ المقروءةُ هنا معتمَدةٌ أصلا: لا يصل المتعلّمَ غيرُها. */
export function learnerPeriod(
  content: unknown,
  cohort: { startsAt?: Date | string | null; endsAt?: Date | string | null },
): CohortPeriod | null {
  const own = asPeriod((content ?? null) as { startsOn?: string | null; endsOn?: string | null } | null)
  if (own) return own
  if (cohort.startsAt && cohort.endsAt) return { startsOn: zonedDay(cohort.startsAt), endsOn: zonedDay(cohort.endsAt) }
  return null
}

/** لقاءٌ كما يصل الحكمَ — والمبدئيُّ والملغى لا يفتحان محورا */
export interface GateSession {
  startsAt: Date | string
  endsAt?: Date | string | null
  moduleIds?: readonly string[] | null
  moduleId?: string | null
  placeholder?: boolean | null
  status?: string | null
}

/** ما يحكم به على متعلّمي شعبةٍ في لحظة */
export interface LearnerGate {
  /** خطُّ المحاور — `null` لما اعتُمد بلا مواعيد، فلا بوّابةَ فيه */
  timeline: AxisTimeline | null
  /** حدّا ما بعد الشعبة — `null` لما لا خطَّ له */
  window: CohortWindow | null
  access: AccessState
}

/**
 * البوّابةُ من الخطّة المعتمَدة ولقاءاتِ الشعبة.
 *
 * واللقاءاتُ التي تُعدّ: ما يراه المتعلّمُ (المعتمَد — يرشّحه المستدعي
 * بـ`LEARNER_SESSION_WHERE`)، بلا المبدئيّ ولا الملغى — لقاءٌ أُلغي لا
 * «ينتهي» فيفتحَ مهامَّ محوره.
 */
export function learnerGate(input: {
  /** محتوى الخطّة المعتمَدة — أو `null` حين لا خطّة */
  content: unknown
  cohort: { startsAt?: Date | string | null; endsAt?: Date | string | null }
  sessions: readonly GateSession[]
  now: Date
}): LearnerGate {
  const c = (input.content ?? null) as { slots?: PlanSlot[] | null; resources?: TimelineResource[] | null } | null
  const period = learnerPeriod(c, input.cohort)
  const timeline = c && Array.isArray(c.slots) && c.slots.length > 0
    ? buildTimeline({
        slots: c.slots,
        sessions: input.sessions
          .filter((s) => !s.placeholder && s.status !== 'cancelled')
          .map((s) => ({
            startsAt: s.startsAt,
            endsAt: s.endsAt ?? null,
            moduleIds: s.moduleIds?.length ? s.moduleIds : s.moduleId ? [s.moduleId] : [],
          })),
        resources: Array.isArray(c.resources) ? c.resources : [],
        period,
      })
    : null
  const window = timeline ? cohortWindow(period) : null
  return { timeline, window, access: accessState(window, input.now) }
}

/** متى تُفتح المهمّة — مع مهامّ محورها بعد لقائه (⑤)، أو `null`: لا بوّابة */
export function assessmentOpensAt(gate: LearnerGate, moduleId: string | null | undefined): Date | null {
  if (!gate.timeline || !moduleId) return null
  return gate.timeline.workOpensAt(moduleId)
}

/** اللحظةُ بلغة المتعلّم وبتوقيت عمّان — «الثلاثاء ١٤ فبراير، ٦:٠٠ م» */
export function whenAr(at: Date | string): string {
  return fmtDateWith(at, {
    weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: ACADEMY_ZONE,
  })
}

export type SubmitRefusalCode = 'not_open_yet' | 'cohort_closed' | 'access_ended'

export type SubmitVerdict =
  | { ok: true; late: boolean }
  | { ok: false; code: SubmitRefusalCode; messageAr: string }

/**
 * أيُقبل التسليمُ الآن؟ وأمتأخّرٌ هو؟
 *
 * · قبل أن تُفتح المهمّةُ لا تسليم — لم يُشرح محورُها بعد (⑤).
 * · وبعد انتهاء الشعبة لا تسليم (④) — **إلّا ما طلب المدرّبُ إعادتَه**: طلبٌ
 *   صريحٌ منه، ولو رُدّ لصار زرُّه فخّا يُعيد فيه متعلّمٌ عملا لا يُقبل. وهذا
 *   ما بقي الوصولُ قائما؛ فبعد نهايته لا شيء.
 * · وبعد آخر الموعد يُقبل ويُعلَّم متأخّرا (⑥) — والإعادةُ بطلبٍ لا تُعلَّم:
 *   تأخّرُها من الطلب لا منه.
 */
export function submitVerdict(input: {
  opensAt: Date | null
  dueAt: Date | string | null
  window: CohortWindow | null
  now: Date
  resubmitRequested: boolean
}): SubmitVerdict {
  const now = input.now.getTime()
  if (!input.resubmitRequested && input.opensAt && now < input.opensAt.getTime()) {
    return {
      ok: false, code: 'not_open_yet',
      messageAr: `لم تُفتح هذه المهمّةُ بعد — تُفتح ${whenAr(input.opensAt)} بعد لقاء محورها`,
    }
  }
  if (input.window && now > input.window.closesAt.getTime()) {
    if (now > input.window.accessEndsAt.getTime()) {
      return { ok: false, code: 'access_ended', messageAr: 'انتهت مدّةُ الوصول إلى هذه الشعبة — لا تسليمَ بعدها' }
    }
    if (!input.resubmitRequested) {
      return {
        ok: false, code: 'cohort_closed',
        messageAr: `انتهت الشعبة ${whenAr(input.window.closesAt)} — والتسليمُ يتوقّف بانتهائها`,
      }
    }
  }
  const due = input.dueAt ? new Date(input.dueAt).getTime() : NaN
  return { ok: true, late: !input.resubmitRequested && Number.isFinite(due) && now > due }
}

/* ═══ المهمّةُ كما تصل المتعلّم ═══

   قبل أن تُفتح يصله عنوانُها ونوعُها وموعدُها ومتى تُفتح — ليعرف ما ينتظره
   — بلا تعليماتٍ ولا مرفقاتٍ ولا أسئلة. والأسئلةُ خاصّةً: اختبارٌ تُقرأ بنودُه
   قبل أوانه ليس اختبارا. وبعد انتهاء الوصول تبقى عناوينُ ما سلّمه، ومعها
   تسليماتُه ودرجاتُه في صفوفها.

   **انتقاءٌ لا حذف**: المحجوبةُ تُبنى من حقولٍ مسمّاة، فعمودٌ يُضاف إلى
   المهمّة غدا لا يتسرّب منها بنشرِ صفٍّ كاملٍ نسي أحدٌ أن يستثنيَ منه. */

/** ما يلزم الحجبَ من المهمّة — والزائدُ يمرّ مع المفتوحة وحدَها */
export interface GateableAssessment {
  id: string
  title: string
  type: string
  moduleId?: string | null
  dueAt?: Date | string | null
  maxScore?: number | null
  passScore?: number | null
}

/** مهمّةٌ لم تُفتح بعد — أو انتهى الوصولُ إليها */
export interface LockedAssessment {
  id: string
  title: string
  type: string
  moduleId: string | null
  dueAt: Date | string | null
  maxScore: number | null
  passScore: number | null
  briefAr: null
  attachments: []
  items: []
  rubric: null
  /** متى تُفتح — `null` حين انتهى الوصول */
  opensAt: string | null
  locked: true
}

export function gateAssessment<T extends GateableAssessment>(
  a: T,
  opensAt: Date | null,
  access: AccessState,
  now: Date,
): (T & { opensAt: string | null; locked: false }) | LockedAssessment {
  const ended = access === 'ended'
  if (!ended && (opensAt === null || opensAt.getTime() <= now.getTime())) {
    return { ...a, opensAt: opensAt ? opensAt.toISOString() : null, locked: false }
  }
  return {
    id: a.id,
    title: a.title,
    type: a.type,
    moduleId: a.moduleId ?? null,
    dueAt: a.dueAt ?? null,
    maxScore: a.maxScore ?? null,
    passScore: a.passScore ?? null,
    briefAr: null,
    attachments: [],
    items: [],
    rubric: null,
    opensAt: ended || !opensAt ? null : opensAt.toISOString(),
    locked: true,
  }
}

/* ═══ متى ينتهي اللقاءُ فلا يُدخَل ═══

   «بعد انتهاء اللقاء» لا يعني ساعتَه المجدولة: لقاءٌ بدأ متأخّرا يمتدّ بعدها،
   ومن انقطع اتّصالُه فيه يعود. فالحكمُ لـZoom أوّلا: أنهاه ← انتهى، وجارٍ ←
   لم ينتهِ. وبلا خبرٍ منه: ساعةٌ بعد نهايته المجدولة. واللقاءُ الذي «بدأ» ولم
   يصل خبرُ نهايته لا يبقى مفتوحا إلى الأبد — حدثٌ ضاع لا يُبقي بابا مفتوحا. */

/** مهلةٌ بعد النهاية المجدولة لمن لا خبرَ عنه من Zoom */
export const MEETING_GRACE_MS = 60 * 60_000
/** أطولُ ما يُعدّ فيه لقاءٌ بدأ ولم يُعلَن انتهاؤه «جاريا» */
export const MEETING_MAX_LIVE_MS = 8 * 60 * 60_000

export function meetingOver(
  s: { startsAt: Date | string; endsAt?: Date | string | null },
  zoom: { actualStartAt?: Date | string | null; actualEndAt?: Date | string | null } | null | undefined,
  now: Date,
): boolean {
  const t = (v: Date | string | null | undefined) => (v ? new Date(v).getTime() : NaN)
  const started = t(zoom?.actualStartAt)
  const ended = t(zoom?.actualEndAt)
  /* أنهاه Zoom — ما لم يبدأ بعد انتهائه (أُعيد فتحُ الاجتماع نفسِه) */
  if (Number.isFinite(ended) && (!Number.isFinite(started) || ended >= started)) return true
  if (Number.isFinite(started) && now.getTime() - started < MEETING_MAX_LIVE_MS) return false
  return now.getTime() > sessionEnd(s).getTime() + MEETING_GRACE_MS
}

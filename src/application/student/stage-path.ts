/* طريقُ الدورة — محطّاتٌ تُقرأ بترتيبها من أوّلها إلى الشهادة.

   قرارُ صاحب المنصّة (٢٦ أكتوبر ٢٠٢٦): «منصّةُ الطالب غيرُ مفهومةٍ ومكتظّةٌ وغيرُ
   احترافيّة… أعِد تصميمَها تسلسلا للمراحل: من أين يبدأ وماذا يقرأ… حتّى يتخرّج…
   ممتعةً على شكل تلعيبٍ بطريقةٍ أو بأخرى». وعُرضت عليه ثلاثةُ اتّجاهات، فاختار
   المزيج: **طريقُ محطّاتٍ** تعلوه **بطاقةُ «خطوتك التالية»**، و**نجومُ المحطّة**،
   و**«حصادك»**، و**الشهادةُ آخرَ الطريق** — «وأبقِه احترافيّا».

   وكانت الشاشةُ ثلاثةَ تبويباتٍ (الدروس · الجلسات · الواجبات) فوقها صندوقُ الكرّاسة
   وتحتها مواعيدُ تكرّر صفحاتِ الكرّاسة نفسَها: الشيءُ الواحدُ يُقرأ ثلاثَ مرّات، ولا
   شيءَ يقول «ابدأ من هنا». فصارت المحطّةُ وحدةَ العرض: فيها ما يُقرأ وما يُحضَر وما
   يُسلَّم، بترتيب الشعبة لا برقم الكتالوج — فلا يرى المتعلّمُ «المحور ١ ثمّ ٩» فيظنّ
   أنّ بينهما ما سقط.

   ── والتلعيبُ في حدود `momentum.ts` ──

   لا نقاطَ ولا سلسلةَ أيّامٍ ولا ترتيبَ بين المتعلّمين: ذلك قرارٌ قائمٌ بدليله، ولم
   يُنسخ. فالنجمةُ **أثرٌ مسجَّل**، واحدةٌ لكلّ نوعٍ في المحطّة:
     • قرأ — محاورُها كلُّها أُقرّ إكمالُها
     • حضر — جلساتُها كلُّها سُجّل حضورُه فيها (حاضرا أو متأخّرا)
     • سلّم — مهامُّها كلُّها قبلها مدرّبُه
   وما لا يوجد في المحطّة لا نجمةَ له تُحسب عليه: محطّةٌ بلا جلسةٍ نجمتان لا ثلاث.
   ولا نجمةَ بضغطة.

   والوحدةُ نقيّةٌ والوقتُ يُمرَّر — فتُفحص بالحساب لا بالنقر. */

import type { LearnerSlot } from '../trainer/plan-overlay'
import { splitLessons } from '../content/lesson-split'

/* ═══ ما ليس في خطّة الشعبة لا يُعرض (٢٦ أكتوبر ٢٠٢٦) ═══

   `overlayModules` تُبقي محاورَ الكتالوج كلَّها وتعلوها الخطّة. فمحورُ كتالوجٍ
   تركه المدرّبُ — شعبتُه من محوره الأوّل ثمّ محاورَ كتبها هو — يبقى فارغا بلا
   موعدٍ ولا متن، فيُقرأ تحت «محاور أخرى» بشارة «قيد التأليف» وهو لن يُكتب أبدا.
   رآه صاحبُ المنصّة، وخُيّر بين إخفائه وإبقائه بنصٍّ آخر، فقال: «a, hide them».
   وبلا خطّةٍ تُعرض محاورُ الكتالوج كما هي: هي الدورةُ حينئذ. */
export function inPlanOnly<T extends { id: string }>(
  modules: readonly T[],
  plan: { modules: readonly { moduleId: string }[] } | null | undefined,
): T[] {
  if (!plan || plan.modules.length === 0) return [...modules]
  const ids = new Set(plan.modules.map((m) => m.moduleId))
  return modules.filter((m) => ids.has(m.id))
}

export type Mark = 'done' | 'todo' | 'none'
export type StopState = 'done' | 'current' | 'open' | 'locked'

export interface PathModule {
  id: string
  title: string
  locked?: boolean
  opensAt?: string | null
}

export interface PathInput {
  modules: readonly PathModule[]
  slots: readonly LearnerSlot[]
  sessions: readonly { id: string; startsAt: string }[]
  assessments: readonly { id: string; moduleId?: string | null }[]
  doneModules: ReadonlySet<string>
  /** جلساتٌ سُجّل حضورُه فيها — حاضرا أو متأخّرا */
  attended: ReadonlySet<string>
  /** مهامُّ آخرُ تسليمٍ له فيها مقبول */
  accepted: ReadonlySet<string>
}

export interface PathStop {
  key: string
  /** رقمُ المحطّة كما يراه: ترتيبُها في شعبته، لا رقمُ محورها في الكتالوج */
  seq: number
  title: string
  /** موعدُها في خطّة الشعبة — `null` لشعبةٍ بلا مواعيد، فالمحطّةُ محور */
  slot: LearnerSlot | null
  moduleIds: string[]
  sessionIds: string[]
  assessmentIds: string[]
  locked: boolean
  opensAt: string | null
  marks: { read: Mark; attend: Mark; submit: Mark }
  stars: { earned: number; total: number }
  state: StopState
}

export interface StagePath {
  stops: PathStop[]
  /** محاورُ ليست في موعدٍ من خطّة الشعبة */
  looseModuleIds: string[]
  /** جلساتٌ ومهامُّ لا محطّةَ لها — تُعرض بعد الطريق ولا نجمَ لها */
  looseSessionIds: string[]
  looseAssessmentIds: string[]
  /** أوّلُ محطّةٍ مفتوحةٍ لم تكتمل — «أنت هنا». و-١ حين لا شيء */
  currentIndex: number
  stars: { earned: number; total: number }
}

const markOf = (ids: readonly string[], ok: ReadonlySet<string>): Mark =>
  ids.length === 0 ? 'none' : ids.every((id) => ok.has(id)) ? 'done' : 'todo'

/** الجلسةُ في الموعد الذي يحتوي لحظةَ بدئها — من أوّل يومه إلى آخر لحظةٍ فيه */
function slotOfSession(slots: readonly LearnerSlot[], startsAt: string): number {
  const t = Date.parse(startsAt)
  if (Number.isNaN(t)) return -1
  return slots.findIndex((s) => t >= Date.parse(s.opensAt) && t <= Date.parse(s.closesAt))
}

export function buildStagePath(input: PathInput): StagePath {
  const { modules, slots, sessions, assessments, doneModules, attended, accepted } = input
  const byId = new Map(modules.map((m) => [m.id, m]))

  type Raw = Omit<PathStop, 'marks' | 'stars' | 'state'>
  const raw: Raw[] = slots.length > 0
    ? slots.map((s, i) => {
        const ids = s.moduleIds.filter((id) => byId.has(id))
        return {
          key: `slot-${i}`,
          seq: i + 1,
          title: ids.map((id) => byId.get(id)!.title).join(' · ') || `الموعد ${i + 1}`,
          slot: s,
          moduleIds: ids,
          sessionIds: [],
          assessmentIds: [],
          locked: s.locked,
          opensAt: s.opensAt ?? null,
        }
      })
    : modules.map((m, i) => ({
        key: `module-${m.id}`,
        seq: i + 1,
        title: m.title,
        slot: null,
        moduleIds: [m.id],
        sessionIds: [],
        assessmentIds: [],
        locked: m.locked === true,
        opensAt: m.opensAt ?? null,
      }))

  const stopOfModule = new Map<string, number>()
  raw.forEach((s, i) => s.moduleIds.forEach((id) => stopOfModule.set(id, i)))

  const looseSessionIds: string[] = []
  for (const s of sessions) {
    const i = slots.length > 0 ? slotOfSession(slots, s.startsAt) : -1
    if (i >= 0) raw[i].sessionIds.push(s.id)
    else looseSessionIds.push(s.id)
  }

  const looseAssessmentIds: string[] = []
  for (const a of assessments) {
    const i = a.moduleId ? stopOfModule.get(a.moduleId) : undefined
    if (i !== undefined) raw[i].assessmentIds.push(a.id)
    else looseAssessmentIds.push(a.id)
  }

  const scored = raw.map((s) => {
    const marks = {
      read: markOf(s.moduleIds, doneModules),
      attend: markOf(s.sessionIds, attended),
      submit: markOf(s.assessmentIds, accepted),
    }
    const kinds = Object.values(marks).filter((m) => m !== 'none')
    const stars = { earned: kinds.filter((m) => m === 'done').length, total: kinds.length }
    return { ...s, marks, stars }
  })

  const complete = (s: (typeof scored)[number]) => s.stars.total > 0 && s.stars.earned === s.stars.total
  const currentIndex = scored.findIndex((s) => !s.locked && !complete(s))
  const stops: PathStop[] = scored.map((s, i) => ({
    ...s,
    state: complete(s) ? 'done' : s.locked ? 'locked' : i === currentIndex ? 'current' : 'open',
  }))

  return {
    stops,
    looseModuleIds: slots.length > 0 ? modules.filter((m) => !stopOfModule.has(m.id)).map((m) => m.id) : [],
    looseSessionIds,
    looseAssessmentIds,
    currentIndex,
    stars: stops.reduce((acc, s) => ({ earned: acc.earned + s.stars.earned, total: acc.total + s.stars.total }), { earned: 0, total: 0 }),
  }
}

/* ═══ «خطوتك التالية» — فعلٌ واحدٌ لا قائمة ═══

   الشاشةُ تفتح على ما يفعله الآن، بهذا الترتيب:
     ١) جلسةٌ تجري الآن (أو تبدأ خلال ربع ساعة) — فاتُها لا يُستدرك
     ٢) عملٌ طلب مدرّبُه إعادتَه — ينتظره إنسان
     ٣) مهمّةٌ مفتوحةٌ لم يسلّمها — بترتيب المحطّات
     ٤) أوّلُ محورٍ مقروءٍ لم يكتمل — بترتيب المحطّات
     ٥) جلستُه القادمة
     ٦) عملٌ سلّمه وينتظر حكمَ مدرّبه — فلا يُقال له «لا شيء»
     ٧) المحطّةُ المقفلةُ التالية ومتى تفتح
     ٨) أتمّ المحطّات كلَّها — فالشهادة
   وكلُّ حكمٍ هنا من بياناتٍ تصل الشاشةَ أصلا: لا هدفَ يُخترع ولا موعدَ يُفترض. */

export type NextStep =
  | { kind: 'live'; sessionId: string; title: string }
  | { kind: 'resubmit'; assessmentId: string; title: string; stopKey: string | null }
  | { kind: 'submit'; assessmentId: string; title: string; dueAt: string | null; stopKey: string | null }
  | { kind: 'read'; moduleId: string; title: string; stopKey: string | null }
  | { kind: 'session'; sessionId: string; title: string; startsAt: string }
  | { kind: 'review'; title: string; stopKey: string | null }
  | { kind: 'wait'; title: string; opensAt: string | null; stopKey: string }
  | { kind: 'finish' }

export interface NextStepInput {
  path: StagePath
  modules: readonly PathModule[]
  sessions: readonly { id: string; title: string; startsAt: string; endsAt: string | null; status: string }[]
  assessments: readonly { id: string; title: string; dueAt: string | null }[]
  /** مهامُّ يقبل الخادمُ تسليمَها الآن (`canSubmitNow`) */
  submittable: ReadonlySet<string>
  /** منها ما طلب مدرّبُه إعادتَه */
  resubmit: ReadonlySet<string>
  /** مهامُّ سلّمها وتنتظر حكمَ مدرّبه */
  inReview: ReadonlySet<string>
  /** محاورُ مفتوحةٌ لها متنٌ أو ملفّ — لا «يُكتب الآن» */
  readable: ReadonlySet<string>
  doneModules: ReadonlySet<string>
  now: number
}

const SOON_MS = 15 * 60_000
const DEFAULT_LENGTH_MS = 2 * 60 * 60_000

export function nextStep(input: NextStepInput): NextStep | null {
  const { path, modules, sessions, assessments, submittable, resubmit, inReview, readable, doneModules, now } = input
  const title = new Map(modules.map((m) => [m.id, m.title]))
  const task = new Map(assessments.map((a) => [a.id, a]))
  const stopOf = new Map<string, string>()
  for (const s of path.stops) for (const id of s.assessmentIds) stopOf.set(id, s.key)
  /* بترتيب الطريق ثمّ ما لا محطّةَ له */
  const ordered = [...path.stops.flatMap((s) => s.assessmentIds), ...path.looseAssessmentIds]

  const open = sessions.filter((s) => s.status !== 'done' && s.status !== 'cancelled')
  const live = open.find((s) => {
    const start = Date.parse(s.startsAt)
    const end = s.endsAt ? Date.parse(s.endsAt) : start + DEFAULT_LENGTH_MS
    return now >= start - SOON_MS && now <= end
  })
  if (live) return { kind: 'live', sessionId: live.id, title: live.title }

  const again = ordered.find((id) => resubmit.has(id))
  if (again) return { kind: 'resubmit', assessmentId: again, title: task.get(again)?.title ?? '', stopKey: stopOf.get(again) ?? null }

  const due = ordered.find((id) => submittable.has(id) && !resubmit.has(id))
  if (due) {
    const a = task.get(due)
    return { kind: 'submit', assessmentId: due, title: a?.title ?? '', dueAt: a?.dueAt ?? null, stopKey: stopOf.get(due) ?? null }
  }

  for (const s of path.stops) {
    const id = s.moduleIds.find((m) => readable.has(m) && !doneModules.has(m))
    if (id) return { kind: 'read', moduleId: id, title: title.get(id) ?? '', stopKey: s.key }
  }
  const looseRead = path.looseModuleIds.find((m) => readable.has(m) && !doneModules.has(m))
  if (looseRead) return { kind: 'read', moduleId: looseRead, title: title.get(looseRead) ?? '', stopKey: null }

  const upcoming = open
    .filter((s) => Date.parse(s.startsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
  if (upcoming) return { kind: 'session', sessionId: upcoming.id, title: upcoming.title, startsAt: upcoming.startsAt }

  const waiting = ordered.find((id) => inReview.has(id))
  if (waiting) return { kind: 'review', title: task.get(waiting)?.title ?? '', stopKey: stopOf.get(waiting) ?? null }

  const locked = path.stops.find((s) => s.state === 'locked')
  if (locked) return { kind: 'wait', title: locked.title, opensAt: locked.opensAt, stopKey: locked.key }

  if (path.stops.length > 0 && path.stops.every((s) => s.state === 'done')) return { kind: 'finish' }
  return null
}

/* ═══ الأثرُ من التسجيل — مرّةً لشاشتين (٢٧ أكتوبر ٢٠٢٦) ═══

   صفحةُ الدورة وشاشةُ الدراسة ترسمان الطريقَ نفسَه، فتقرآن الأثرَ من الموضع
   نفسِه: محاورُ أُقرّ إكمالُها، وجلساتٌ حضرها (حاضرا أو متأخّرا)، ومهامُّ آخرُ
   تسليمٍ له فيها مقبول. ولو حسبته كلٌّ منهما لنفسها لاختلفت نجومُ المحطّة
   بين الشاشتين يوما. */
export interface EvidenceSource {
  moduleProgress: readonly { moduleId: string; status: string }[]
  attendance: readonly { sessionId: string; status: string }[]
  submissions: readonly { assessmentId: string; status: string; submittedAt: string }[]
}

export function evidenceOf(d: EvidenceSource): { doneModules: Set<string>; attended: Set<string>; accepted: Set<string> } {
  const latest = new Map<string, { status: string; submittedAt: string }>()
  for (const s of d.submissions) {
    const cur = latest.get(s.assessmentId)
    if (!cur || s.submittedAt > cur.submittedAt) latest.set(s.assessmentId, s)
  }
  return {
    doneModules: new Set(d.moduleProgress.filter((m) => m.status === 'completed').map((m) => m.moduleId)),
    attended: new Set(d.attendance.filter((a) => a.status === 'present' || a.status === 'late').map((a) => a.sessionId)),
    accepted: new Set([...latest].filter(([, s]) => s.status === 'accepted').map(([id]) => id)),
  }
}

/** المحطّةُ التي فيها هذا المحور — `null` لمحورٍ خارج الطريق */
export function stopOfModule(path: StagePath, moduleId: string): PathStop | null {
  return path.stops.find((s) => s.moduleIds.includes(moduleId)) ?? null
}

/* ═══ وما بعد هذا المحور — بترتيب الطريق لا الكتالوج ═══

   كان «الوحدة التالية» في شاشة الدراسة ما يلي المحورَ في قائمة الكتالوج: محورٌ
   تركه المدرّبُ أو لم يُكتب بعد، ومحاورُ المدرّب في ذيلها. فصار:
     • أوّلُ محورٍ مقروءٍ بعده في الطريق — يُفتح
     • وإلّا محطّةٌ مقفلةٌ بعده — يُقال متى تفتح
     • وإلّا آخرُ الطريق
   وما لا متنَ له بعدُ يُتخطّى: لا يُدعى المتعلّمُ إلى صفحةٍ تقول «يصلك لاحقا». */
export type AfterModule =
  | { kind: 'read'; moduleId: string }
  | { kind: 'wait'; title: string; opensAt: string | null }
  | { kind: 'end' }

export function afterModule(path: StagePath, moduleId: string, readable: ReadonlySet<string>): AfterModule {
  const order = [...path.stops.flatMap((s) => s.moduleIds), ...path.looseModuleIds]
  const at = order.indexOf(moduleId)
  for (const id of order.slice(at + 1)) {
    if (readable.has(id)) return { kind: 'read', moduleId: id }
    const stop = stopOfModule(path, id)
    if (stop?.locked) return { kind: 'wait', title: stop.title, opensAt: stop.opensAt }
  }
  return { kind: 'end' }
}

/** المقروءُ: مفتوحٌ له متنٌ فيه درسٌ أو ملفٌّ أرفقه مدرّبُه — وما «يصلك قبل جلسته» لا يُدعى إليه */
export function readableModules(
  modules: readonly { id: string; locked?: boolean | null; body?: string | null; bodyFileKey?: string | null }[],
): Set<string> {
  return new Set(
    modules
      .filter((m) => !m.locked && (splitLessons(m.body ?? null).length > 0 || Boolean((m.bodyFileKey ?? '').trim())))
      .map((m) => m.id),
  )
}

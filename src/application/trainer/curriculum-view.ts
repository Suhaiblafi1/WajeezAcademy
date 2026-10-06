/* ═══ المنهجُ كاملا — من الألف إلى الياء (المرحلة ٣) ═══

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «عند المرحلة الأخيرة يجب أن يكون للمدرّب
   تصوّرٌ كاملٌ عمّا أضافه — وهو ما سنوافق عليه — صفحةٌ توضح كلَّ ما كتبه بالترتيب:
   المعلوماتُ الأساسيّة، ثمّ المحاورُ ورابطُ كرّاسةِ كلّ محورٍ وتحتها المهامُّ
   التطبيقيّةُ لكلّ محورٍ والمصادر، ثمّ المحورُ الثاني أو الثالث… وإذا جمع بين محاورَ
   مختلفةٍ يصبح «محور ١+٢»… وكأنّها منهجٌ متكاملٌ لدورته من الألف إلى الياء بكلّ
   تفاصيله، يقرؤه فتلهمه أيَّ تعديلات فيعود للتعديل بالمراحل السابقة — وهو ما
   سنقرؤه عند الموافقة».

   فالصفحةُ واحدةٌ للاثنين: خطوةُ المدرّب الأخيرة، وبطاقةُ المعتمِد — يقرآن الشيءَ
   نفسَه، فلا يُعتمَد غيرُ ما رآه صاحبُه. وتُبنى هنا من الخطّة ولقاءاتها ومهامّها
   بلا شاشة، فتُختبر محضةً (`curriculum-view.test.ts`).

   ── وما لا مواعيدَ له ──

   خطّةٌ اعتُمدت قبل المواعيد تُقرأ محورا محورا بالترتيب نفسِه — كلُّ محورٍ
   موعدُ نفسِه — فلا تسقط من الصفحة شعبةٌ جارية. وما لا محورَ له (لقاءٌ أو مهمّةٌ
   أو مصدرٌ للشعبة كلِّها) يُجمع في آخرها تحت «للشعبة كلِّها». */

import type { CohortPeriod } from './cohort-period'
import { resourceCategory, displayKind } from './plan-overlay'
import { workbookDone, workbookWhere, type CohortWorkbook, type PlanSlot } from './axis-timeline'
import { proposedTask, readTaskChange, taskReview, taskValues } from './task-approval'
import { asLevelRange, levelRangeAr } from './cohort-level'

export interface CurriculumInput {
  title: string
  period: CohortPeriod | null
  /** محتوى الخطّة كما يُحفظ — `modules` و`slots` و`resources` و`summaryAr` */
  content: unknown
  sessions: readonly {
    id: string
    title: string
    startsAt: string | Date
    endsAt?: string | Date | null
    moduleId?: string | null
    moduleIds?: readonly string[] | null
    approvalState?: string | null
    status?: string | null
    placeholder?: boolean | null
  }[]
  assessments: readonly {
    id: string
    title: string
    type: string
    dueAt?: string | Date | null
    moduleId?: string | null
    briefAr?: string | null
    attachments?: unknown
    status?: string | null
    maxScore?: number | null
    /** طلبُ المدرّب عليها بعد الاعتماد، وسببُ ردّ آخرِ طلب (٣ج-٣) */
    pendingChange?: unknown
    reviewerNote?: string | null
  }[]
  /** اعتُمدت للمدرّب خطّةٌ قطّ — فما ينتظر من المهامّ يُعلَّم بما ينتظره (٣ج-٣) */
  approvedOnce?: boolean
  /** اللحظةُ التي يُحكم بها على «انعقد» — تُمرَّر فتُختبر بلا انتظار */
  now?: Date
}

export interface CurriculumAxis {
  moduleId: string
  /** رقمُه في ترتيب الخطّة — «المحور ٣» */
  n: number
  title: string
  outcome: string | null
  activity: string | null
  artifact: string | null
  body: string | null
  bodyWords: number
  bodyFile: { key: string; name: string | null } | null
  /** أين يبدأ في كرّاسة الشعبة — «ص ٥» (٣٠ سبتمبر ٢٠٢٦) */
  workbookWhere: string | null
}

export interface CurriculumMeeting {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  /** أرقامُ محاوره — «لمحور ١ و٢» */
  axes: number[]
  /** معتمَدٌ · بانتظار الاعتماد · انعقد */
  state: 'approved' | 'pending' | 'held'
}

export interface CurriculumRecording { title: string; url: string | null; opensAt: string | null }

export interface CurriculumTask {
  id: string
  title: string
  type: string
  dueAt: string | null
  briefAr: string | null
  attachments: number
  /** ما ينتظر قرارَ الإدارة فيها بعد الاعتماد — جديدةٌ أو تعديلٌ أو حذف (٣ج-٣).
      ولا مفتاحَ لما لا ينتظر شيئا */
  review?: 'new' | 'edit' | 'remove'
}

export interface CurriculumResource {
  title: string
  url: string | null
  kind: string
  noteAr: string | null
  preReading: boolean
  fileKey: string | null
  fileName: string | null
}

export interface CurriculumGroup {
  key: string
  /** «المحور ١ + ٢» — أو «المحور ٣» */
  label: string
  /** للموعد تاريخاه — وللمحور في خطّةٍ بلا مواعيدَ لا تاريخ */
  startsOn: string | null
  endsOn: string | null
  axes: CurriculumAxis[]
  workbook: { title: string | null; url: string | null; fileKey: string | null; fileName: string | null } | null
  meetings: CurriculumMeeting[]
  recordings: CurriculumRecording[]
  tasks: CurriculumTask[]
  resources: CurriculumResource[]
}

export interface CurriculumView {
  title: string
  summaryAr: string | null
  /** مستوى الشعبة بجملته — «من مبتدئ إلى متوسّط» — أو `null` لما لم يُحدَّد (٦ أكتوبر ٢٠٢٦) */
  levelAr: string | null
  period: CohortPeriod | null
  /** على خطّ المحاور — أم محورا محورا كما اعتُمد قبله */
  bySlot: boolean
  /** كرّاسةُ الشعبة الواحدة — `null` لما قبلها (كرّاسةٌ لكلّ موعد) أو لما لم تُوضع بعد */
  workbook: { title: string | null; url: string | null; fileKey: string | null; fileName: string | null } | null
  groups: CurriculumGroup[]
  /** للشعبة كلِّها — ما لا محورَ له */
  general: { meetings: CurriculumMeeting[]; tasks: CurriculumTask[]; resources: CurriculumResource[] }
  counts: { axes: number; groups: number; meetings: number; tasks: number; resources: number; recordings: number }
}

interface PlanModule {
  moduleId: string
  titleAr?: string | null
  outcomeAr?: string | null
  activityAr?: string | null
  artifactAr?: string | null
  bodyAr?: string | null
  bodyFileKey?: string | null
  bodyFileName?: string | null
}
interface PlanResource {
  title?: string | null
  url?: string | null
  kind?: string | null
  category?: string | null
  noteAr?: string | null
  moduleId?: string | null
  preReading?: boolean | null
  opensAt?: string | null
  bodyFileKey?: string | null
  bodyFileName?: string | null
}

const text = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s : null
}
const iso = (v: string | Date | null | undefined): string | null => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
const words = (s: string | null) => (s ? s.split(/\s+/).filter(Boolean).length : 0)

/** «المحور ١ + ٢» — والأرقامُ بالترتيب */
export function axesLabel(ns: readonly number[]): string {
  if (ns.length === 0) return 'بلا محور'
  return `المحور ${[...ns].sort((a, b) => a - b).join(' + ')}`
}

export function curriculumView(input: CurriculumInput): CurriculumView {
  const c = (input.content ?? {}) as {
    summaryAr?: string | null; modules?: PlanModule[]; slots?: PlanSlot[]; resources?: PlanResource[]; workbook?: CohortWorkbook | null
    level?: unknown
  }
  const cw = c.workbook ?? null
  const modules = Array.isArray(c.modules) ? c.modules : []
  const slots = Array.isArray(c.slots) ? c.slots : []
  const resources = Array.isArray(c.resources) ? c.resources : []
  const pos = new Map(modules.map((m, i) => [m.moduleId, i + 1]))
  const now = input.now ?? new Date()

  const axisOf = (m: PlanModule): CurriculumAxis => {
    const body = text(m.bodyAr)
    const key = text(m.bodyFileKey)
    return {
      moduleId: m.moduleId,
      n: pos.get(m.moduleId) ?? 0,
      title: text(m.titleAr) ?? m.moduleId,
      outcome: text(m.outcomeAr),
      activity: text(m.activityAr),
      artifact: text(m.artifactAr),
      body,
      bodyWords: words(body),
      bodyFile: key ? { key, name: text(m.bodyFileName) } : null,
      workbookWhere: workbookWhere(cw, m.moduleId),
    }
  }
  const byId = new Map(modules.map((m) => [m.moduleId, m]))

  /* الموعدُ مجموعةُ محاوره — وبلا مواعيدَ فكلُّ محورٍ مجموعةُ نفسِه */
  const groups: CurriculumGroup[] = []
  const groupOf = new Map<string, CurriculumGroup>()
  const addGroup = (g: CurriculumGroup) => {
    groups.push(g)
    for (const a of g.axes) groupOf.set(a.moduleId, g)
  }
  const empty = { meetings: [], recordings: [], tasks: [], resources: [] }
  if (slots.length > 0) {
    slots.forEach((s, i) => {
      const axes = s.moduleIds.map((id) => byId.get(id)).filter((m): m is PlanModule => !!m).map(axisOf)
      const w = s.workbook
      addGroup({
        key: `slot-${i}`,
        label: axesLabel(axes.map((a) => a.n)),
        startsOn: s.startsOn, endsOn: s.endsOn,
        axes,
        workbook: workbookDone(w)
          ? { title: text(w?.title), url: text(w?.url), fileKey: text(w?.bodyFileKey), fileName: text(w?.bodyFileName) }
          : null,
        ...structuredClone(empty),
      })
    })
    /* محورٌ في الخطّة بلا موعد — يُعرض لا يُخفى: تقوله خطوةُ المحاور */
    for (const m of modules) {
      if (groupOf.has(m.moduleId)) continue
      addGroup({ key: `axis-${m.moduleId}`, label: axesLabel([pos.get(m.moduleId) ?? 0]), startsOn: null, endsOn: null, axes: [axisOf(m)], workbook: null, ...structuredClone(empty) })
    }
  } else {
    for (const m of modules) {
      addGroup({ key: `axis-${m.moduleId}`, label: axesLabel([pos.get(m.moduleId) ?? 0]), startsOn: null, endsOn: null, axes: [axisOf(m)], workbook: null, ...structuredClone(empty) })
    }
  }

  const general: CurriculumView['general'] = { meetings: [], tasks: [], resources: [] }

  /* اللقاءاتُ — لا المبدئيُّ ولا الملغى — بترتيب مواعيدها، في موعد أوّل محاورها */
  const meetings = input.sessions
    .filter((s) => !s.placeholder && s.status !== 'cancelled')
    .slice()
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  for (const s of meetings) {
    const ids = (s.moduleIds?.length ? s.moduleIds : s.moduleId ? [s.moduleId] : []).filter((id) => pos.has(id))
    const end = s.endsAt ? new Date(s.endsAt) : null
    const held = s.status === 'done' || (end !== null && end.getTime() < now.getTime())
    const row: CurriculumMeeting = {
      id: s.id, title: s.title, startsAt: iso(s.startsAt) ?? '', endsAt: iso(s.endsAt ?? null),
      axes: ids.map((id) => pos.get(id)!).sort((a, b) => a - b),
      state: held ? 'held' : s.approvalState === 'approved' ? 'approved' : 'pending',
    }
    const g = ids.length ? groupOf.get(ids[0]) : undefined
    ;(g ? g.meetings : general.meetings).push(row)
  }

  /* ═══ ومهامُّ ما بعد الاعتماد بما طُلب فيها (٣ج-٣) ═══

     الصفحةُ ما يُعتمَد — فالمعدَّلةُ تُقرأ بقيمها المقترَحة وموضعِها المقترَح،
     وتُعلَّم هي والجديدةُ والمطلوبُ حذفُها. والمسودّةُ التي ردّها المعتمِدُ ليست
     ممّا يُعتمَد: لا يعتمدها اعتمادُ الخطّة حتّى يعدّلها صاحبُها. */
  let tasks = 0
  for (const a of input.assessments) {
    if (a.status === 'closed') continue
    const review = taskReview({ status: a.status ?? 'published', pendingChange: a.pendingChange, reviewerNote: a.reviewerNote }, input.approvedOnce ?? false)
    if (review === 'declined' && a.status === 'draft') continue
    const change = readTaskChange(a.pendingChange)
    const v = proposedTask(taskValues({ ...a, maxScore: a.maxScore ?? 0 }), change)
    const row: CurriculumTask = {
      id: a.id, title: v.title, type: v.type, dueAt: iso(v.dueAt), briefAr: text(v.briefAr),
      attachments: change?.kind === 'edit' && change.fields.attachments
        ? change.fields.attachments.length
        : Array.isArray(a.attachments) ? a.attachments.length : 0,
      ...(review === 'new' || review === 'edit' || review === 'remove' ? { review } : {}),
    }
    const g = v.moduleId ? groupOf.get(v.moduleId) : undefined
    ;(g ? g.tasks : general.tasks).push(row)
    tasks += 1
  }

  let recordings = 0
  for (const r of resources) {
    const g = r.moduleId ? groupOf.get(r.moduleId) : undefined
    if (resourceCategory(r) === 'recorded' && g) {
      g.recordings.push({ title: text(r.title) ?? 'جلسةٌ مسجّلة', url: text(r.url), opensAt: text(r.opensAt) })
      recordings += 1
      continue
    }
    const row: CurriculumResource = {
      title: text(r.title) ?? 'مصدر', url: text(r.url), kind: displayKind(r), noteAr: text(r.noteAr),
      preReading: r.preReading === true, fileKey: text(r.bodyFileKey), fileName: text(r.bodyFileName),
    }
    ;(g ? g.resources : general.resources).push(row)
  }

  return {
    title: input.title,
    summaryAr: text(c.summaryAr),
    levelAr: levelRangeAr(asLevelRange(c.level)),
    period: input.period,
    bySlot: slots.length > 0,
    workbook: workbookDone(cw)
      ? { title: text(cw?.title), url: text(cw?.url), fileKey: text(cw?.bodyFileKey), fileName: text(cw?.bodyFileName) }
      : null,
    groups,
    general,
    counts: {
      axes: modules.length,
      groups: groups.length,
      meetings: meetings.length,
      tasks,
      resources: resources.length - recordings,
      recordings,
    },
  }
}

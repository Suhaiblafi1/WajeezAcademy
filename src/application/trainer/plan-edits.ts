/* ═══ تعديلاتٌ تقترحها الإدارةُ على خطّة المدرّب — يقبل كلًّا أو يرفضه (٨ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «التعديلُ معقّدٌ وقد يطلب من المدرّب وقتا طويلا… ألا يمكن أن
   تكون التعديلاتُ مباشرةً منّا على المنصّة، وهو يوافق أو يرفض لكلّ تعديلٍ من
   جهتنا؟». ثمّ اختار من ثلاثة خيارات: **نكتبها نحن ويختار المدرّب** — لا زرَّ
   ذكاءٍ داخل المنصّة بعد، ولا تعديلٌ من الإدارة يُقبل كلُّه أو يُردّ كلُّه.

   ── ما يقع ──

   · تُكتب التعديلاتُ ملفًّا (JSON) من تقرير المراجعة، ويرفعه المعتمِدُ على بطاقة
     المراجعة. فيُفحص كلُّ بندٍ على الخطّة **لحظةَ الرفع** ويُحفظ معه ما كان في
     موضعه (`before`) — ومن هذه اللقطة يرى المدرّبُ «قبل» و«بعد».
   · ويقرؤها المدرّبُ في صفحة شعبته بندا بندا: يقبله أو يرفضه. والقبولُ **حفظٌ
     منه** بالأبواب التي يحفظ بها هو (`savePlan` للخطّة، وبابا المهامّ واللقاءات
     لهما) — فكلُّ فحصٍ يمرّ به حفظُه يمرّ به التعديل، ولا بابَ خلفيٌّ تكتب منه
     الإدارةُ في خطّته.
   · وإن تغيّر الموضعُ بعد الرفع — عدّله المدرّبُ بيده — قيل له ذلك ولم يُكتب
     فوق ما كتب، ويختار: يقبله فوقه، أو يرفضه (قرارُ ٢ أكتوبر: لا إجبار).

   ── ولماذا هنا لا في الخادم ──

   الفحصُ والتطبيقُ والعرضُ يقرؤها الخادمُ والشاشتان معا: قاعدةٌ واحدةٌ لا ثلاث.
   وهذا الملفُّ محضٌ لا يعرف قاعدةً ولا شبكة. */

import { STAGE_LABELS, type ReviewSection } from './review-notes'
import { PLAN_MAX } from './plan-limits'
import { kindForCategory, RESOURCE_CATEGORIES, RESOURCE_KINDS, type ResourceCategory } from './plan-overlay'
import { whenAr } from '../learning/cohort-gate'
import { fmtDateWith } from '../text/format-ar'
import { ACADEMY_ZONE } from './cohort-period'

/* ─────────── ما يُعدَّل ─────────── */

/** حقولُ المحور التي يُقترح عليها نصٌّ — والملفُّ المرفوعُ بدل المتن ليس منها */
export const MODULE_EDIT_FIELDS = ['titleAr', 'outcomeAr', 'activityAr', 'artifactAr', 'bodyAr'] as const
export type ModuleEditField = (typeof MODULE_EDIT_FIELDS)[number]

/** حقولُ الخطّة نفسِها — والمدّةُ ليست منها: نقلُها يمسّ مواعيدَ المحاور كلَّها، فيبقى بيده */
export const PLAN_EDIT_FIELDS = ['summaryAr', 'liveNoteAr'] as const
export type PlanEditField = (typeof PLAN_EDIT_FIELDS)[number]

export const RESOURCE_EDIT_FIELDS = ['title', 'url', 'kind', 'category', 'noteAr', 'moduleId', 'preReading'] as const
export type ResourceEditField = (typeof RESOURCE_EDIT_FIELDS)[number]

export const TASK_EDIT_FIELDS = ['title', 'briefAr', 'dueAt', 'moduleId', 'maxScore'] as const
export type TaskEditField = (typeof TASK_EDIT_FIELDS)[number]

export const PLAN_EDIT_KINDS = [
  'module', 'plan', 'resource_add', 'resource_change', 'resource_remove',
  'task_add', 'task_change', 'session_move', 'session_remove',
] as const
export type PlanEditKind = (typeof PLAN_EDIT_KINDS)[number]

/** ═══ وكلُّ تعديلٍ يمرّ بالإدارة قبل المدرّب (١٠ أكتوبر ٢٠٢٦) ═══

    قرارُ صاحب المنصّة: «كلُّ ما يُطلب من المدرّب قبولُه يقبله المديرُ أو المديرُ
    الأكاديميُّ أو مديرُ المحتوى أوّلا». فالمرفوعُ يولد `proposed` — مسوّدةً لا يراها
    المدرّب — حتّى يعتمده من يملك `cohort.plan.edits.review` بندا بندا.

    `proposed` ينتظر مراجعةَ الإدارة · `dropped` حذفته الإدارةُ فلم يصل المدرّب ·
    `pending` اعتمدته الإدارةُ فينتظر المدرّب · `accepted` قبله فكُتب · `rejected` رفضه ·
    `withdrawn` سحبه المعتمِدُ قبل قراره · `lapsed` اعتُمدت الخطّةُ وهو لم يُقرَّر */
export const PLAN_EDIT_STATUSES = ['proposed', 'dropped', 'pending', 'accepted', 'rejected', 'withdrawn', 'lapsed'] as const
export type PlanEditStatus = (typeof PLAN_EDIT_STATUSES)[number]

/** ما يراه المدرّبُ منها — ولا يرى مسوّدةً لم تعتمدها الإدارةُ ولا ما حذفته */
export const TRAINER_VISIBLE_EDIT_STATUSES: readonly PlanEditStatus[] = ['pending', 'accepted', 'rejected']

/** أكثرُ ما يُرفع في ملفٍّ واحد — تقريرٌ أطولُ من هذا يُقسَم، لا يُغرَق به المدرّب */
export const PLAN_EDITS_MAX = 80

export interface ResourceFields {
  title: string
  url?: string | null
  kind?: string | null
  category?: string | null
  noteAr?: string | null
  moduleId?: string | null
  preReading?: boolean | null
}

/** المصدرُ الذي يُعدَّل يُعرف بعنوانه ورابطه (ومحورِه إن ذُكر) — فلا معرّفَ لمصدرٍ في الخطّة */
export interface ResourceMatch { title: string; url?: string | null; moduleId?: string | null }

export interface TaskFields {
  title: string
  type: 'assignment' | 'quiz' | 'project'
  moduleId?: string | null
  briefAr?: string | null
  maxScore?: number | null
  /** لحظةٌ ISO */
  dueAt?: string | null
}

export type PlanEdit =
  | { kind: 'module'; moduleId: string; set: Partial<Record<ModuleEditField, string | null>> }
  | { kind: 'plan'; set: Partial<Record<PlanEditField, string | null>> }
  | { kind: 'resource_add'; resource: ResourceFields }
  | { kind: 'resource_change'; match: ResourceMatch; set: Partial<ResourceFields> }
  | { kind: 'resource_remove'; match: ResourceMatch }
  | { kind: 'task_add'; task: TaskFields }
  | { kind: 'task_change'; assessmentId: string; set: Partial<Omit<TaskFields, 'type'>> }
  | { kind: 'session_move'; sessionId: string; startsAt: string; endsAt: string }
  | { kind: 'session_remove'; sessionId: string }

/** لقطةُ ما كان في الموضع لحظةَ الاقتراح — ومنها «قبل» */
export type EditSnapshot = Record<string, unknown> | null

export type Checked<T> = { ok: true; value: T } | { ok: false; problemAr: string }

/* ─────────── الخطوةُ التي يقع فيها ─────────── */

/** خطوةُ المدرّب التي يقع فيها التعديل — بها يُجمَع في شاشته ويُدلّ عليها */
export function planEditStep(edit: PlanEdit): ReviewSection {
  switch (edit.kind) {
    case 'module': return 'modules'
    case 'plan': return edit.set.liveNoteAr !== undefined && edit.set.summaryAr === undefined ? 'sessions' : 'identity'
    case 'session_move': case 'session_remove': return 'sessions'
    default: return 'assignments'
  }
}

/* ─────────── ما في الخطّة — بالقدر الذي يقرؤه التعديل ─────────── */

export interface EditableModule {
  moduleId: string; titleAr: string
  outcomeAr?: string | null; activityAr?: string | null; artifactAr?: string | null; bodyAr?: string | null
}
export interface EditableContent {
  summaryAr?: string | null
  liveNoteAr?: string | null
  modules: EditableModule[]
  resources: (ResourceFields & { bodyFileKey?: string | null })[]
}

/** الفارغُ والغائبُ سواء: «لم يُكتب» */
const norm = (v: unknown): unknown => (v === undefined || v === '' ? null : typeof v === 'string' ? v.trim() || null : v)

function pick<K extends string>(from: Record<string, unknown>, keys: readonly K[]): Record<K, unknown> {
  const out = {} as Record<K, unknown>
  for (const k of keys) out[k] = norm(from[k])
  return out
}

/** يتطابق مصدرٌ مع ما يُعرف به — عنوانُه ورابطُه، ومحورُه إن ذُكر */
function matches(r: ResourceFields, m: ResourceMatch): boolean {
  if (norm(r.title) !== norm(m.title)) return false
  if (norm(r.url) !== norm(m.url)) return false
  if (m.moduleId !== undefined && norm(r.moduleId) !== norm(m.moduleId)) return false
  return true
}

/** موضعُ المصدر المقصود — أو لماذا لا يُعرف */
export function findResource(resources: readonly ResourceFields[], m: ResourceMatch): Checked<number> {
  const hits = resources.map((r, i) => (matches(r, m) ? i : -1)).filter((i) => i >= 0)
  if (hits.length === 0) return { ok: false, problemAr: `لا مصدرَ في الخطّة بعنوان «${m.title}»${m.url ? ' ورابطِه' : ''}` }
  if (hits.length > 1) return { ok: false, problemAr: `في الخطّة أكثرُ من مصدرٍ بعنوان «${m.title}» — سمِّ محورَه ليُعرف المقصود` }
  return { ok: true, value: hits[0] }
}

const hasModule = (c: EditableContent, id: string | null | undefined) => !id || c.modules.some((m) => m.moduleId === id)

/** الحدودُ نفسُها التي يُحفظ بها ما يكتبه المدرّب — فلا يُقترح ما يردّه حفظُه */
const LIMITS: Partial<Record<string, number>> = {
  titleAr: PLAN_MAX.moduleTitle, outcomeAr: PLAN_MAX.outcomeAr, activityAr: PLAN_MAX.activityAr,
  artifactAr: PLAN_MAX.artifactAr, summaryAr: PLAN_MAX.summaryAr,
}

function textProblem(field: string, v: unknown): string | null {
  const max = LIMITS[field]
  if (max !== undefined && typeof v === 'string' && v.length > max) return `«${FIELD_AR[field] ?? field}» أطولُ من ${max} حرف`
  if (field === 'titleAr' && !(typeof v === 'string' && v.trim().length >= 2)) return 'عنوانُ المحور لا يُمحى'
  return null
}

function resourceProblem(r: Partial<ResourceFields>, c: EditableContent): string | null {
  if (r.title !== undefined && !(typeof r.title === 'string' && r.title.trim().length >= 2)) return 'عنوانُ المصدر قصيرٌ أو فارغ'
  if (typeof r.title === 'string' && r.title.length > PLAN_MAX.resourceTitle) return `عنوانُ المصدر أطولُ من ${PLAN_MAX.resourceTitle} حرف`
  if (typeof r.url === 'string' && r.url.length > PLAN_MAX.resourceUrl) return 'الرابطُ أطولُ من المسموح'
  if (typeof r.url === 'string' && r.url.trim() && !/^https?:\/\//i.test(r.url.trim())) return `الرابطُ «${r.url}» لا يبدأ بـhttp`
  if (r.kind != null && !(RESOURCE_KINDS as readonly string[]).includes(r.kind)) return `نوعُ المصدر «${r.kind}» ليس من الأنواع`
  if (r.category != null && !(RESOURCE_CATEGORIES as readonly string[]).includes(r.category)) return `صنفُ المصدر «${r.category}» ليس من الأصناف`
  if (r.moduleId && !hasModule(c, r.moduleId)) return `لا محورَ «${r.moduleId}» في الخطّة`
  return null
}

/* ─────────── الفحصُ لحظةَ الرفع — ولقطةُ «قبل» ─────────── */

/** ما في موضع تعديلٍ يقع في محتوى الخطّة — أو لماذا لا يقع. والمهامُّ واللقاءاتُ
    صفوفٌ لا محتوى: لقطتُها من الخادم (`taskSnapshot` و`sessionSnapshot`) */
export function contentBefore(edit: PlanEdit, c: EditableContent): Checked<EditSnapshot> {
  switch (edit.kind) {
    case 'module': {
      const m = c.modules.find((x) => x.moduleId === edit.moduleId)
      if (!m) return { ok: false, problemAr: `لا محورَ «${edit.moduleId}» في الخطّة` }
      const keys = Object.keys(edit.set) as ModuleEditField[]
      if (keys.length === 0) return { ok: false, problemAr: 'تعديلُ محورٍ بلا حقلٍ يُعدَّل' }
      for (const k of keys) {
        if (!(MODULE_EDIT_FIELDS as readonly string[]).includes(k)) return { ok: false, problemAr: `«${k}» ليس من حقول المحور` }
        const p = textProblem(k, edit.set[k]); if (p) return { ok: false, problemAr: p }
      }
      return { ok: true, value: pick(m as unknown as Record<string, unknown>, keys) }
    }
    case 'plan': {
      const keys = Object.keys(edit.set) as PlanEditField[]
      if (keys.length === 0) return { ok: false, problemAr: 'تعديلٌ بلا حقلٍ يُعدَّل' }
      for (const k of keys) {
        if (!(PLAN_EDIT_FIELDS as readonly string[]).includes(k)) return { ok: false, problemAr: `«${k}» ليس ممّا يُعدَّل في الخطّة` }
        const p = textProblem(k, edit.set[k]); if (p) return { ok: false, problemAr: p }
      }
      return { ok: true, value: pick(c as unknown as Record<string, unknown>, keys) }
    }
    case 'resource_add': {
      const p = resourceProblem(edit.resource, c); if (p) return { ok: false, problemAr: p }
      if (c.resources.length >= PLAN_MAX.resources) return { ok: false, problemAr: `في الخطّة ${PLAN_MAX.resources} مصدرا — الحدُّ الأعلى` }
      if (c.resources.some((r) => matches(r, { title: edit.resource.title, url: edit.resource.url ?? null, moduleId: edit.resource.moduleId ?? null }))) {
        return { ok: false, problemAr: `المصدرُ «${edit.resource.title}» في الخطّة فعلا` }
      }
      return { ok: true, value: null }
    }
    case 'resource_change': case 'resource_remove': {
      const at = findResource(c.resources, edit.match)
      if (!at.ok) return at
      if (edit.kind === 'resource_change') {
        const keys = Object.keys(edit.set)
        if (keys.length === 0) return { ok: false, problemAr: 'تعديلُ مصدرٍ بلا حقلٍ يُعدَّل' }
        const bad = keys.find((k) => !(RESOURCE_EDIT_FIELDS as readonly string[]).includes(k))
        if (bad) return { ok: false, problemAr: `«${bad}» ليس من حقول المصدر` }
        const p = resourceProblem(edit.set, c); if (p) return { ok: false, problemAr: p }
      }
      return { ok: true, value: pick(c.resources[at.value] as unknown as Record<string, unknown>, RESOURCE_EDIT_FIELDS) }
    }
    default:
      return { ok: false, problemAr: 'هذا التعديلُ لا يقع في محتوى الخطّة' }
  }
}

const isInstant = (v: unknown) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && !Number.isNaN(Date.parse(v))

/** ما يمنع تعديلَ مهمّةٍ أو لقاءٍ ممّا يُعرف من الخطّة نفسِها — أو `null`.
    وما يُعرف من صفّه (أهو من هذه الشعبة؟ ما موعدُه الآن؟) يفحصه الخادم */
export function rowEditProblem(edit: PlanEdit, c: EditableContent): string | null {
  const taskFields = (t: Partial<TaskFields>): string | null => {
    if (t.title !== undefined && !(typeof t.title === 'string' && t.title.trim().length >= 3)) return 'عنوانُ المهمّة أقصرُ من ثلاثة أحرف'
    if (t.moduleId && !hasModule(c, t.moduleId)) return `لا محورَ «${t.moduleId}» في الخطّة`
    if (t.maxScore != null && !(Number.isInteger(t.maxScore) && t.maxScore >= 1)) return 'الدرجةُ العظمى عددٌ صحيحٌ من ١ فما فوق'
    if (t.dueAt != null && !isInstant(t.dueAt)) return `موعدُ المهمّة «${t.dueAt}» ليس لحظةً مقروءة`
    if (typeof t.briefAr === 'string' && t.briefAr.length > 4000) return 'تعليماتُ المهمّة أطولُ من ٤٠٠٠ حرف'
    return null
  }
  switch (edit.kind) {
    case 'task_add':
      if (!['assignment', 'quiz', 'project'].includes(edit.task.type)) return `نوعُ المهمّة «${edit.task.type}» ليس من الأنواع`
      return taskFields(edit.task)
    case 'task_change': {
      const keys = Object.keys(edit.set)
      if (keys.length === 0) return 'تعديلُ مهمّةٍ بلا حقلٍ يُعدَّل'
      const bad = keys.find((k) => !(TASK_EDIT_FIELDS as readonly string[]).includes(k))
      if (bad) return `«${bad}» ليس من حقول المهمّة`
      return taskFields(edit.set)
    }
    case 'session_move':
      if (!isInstant(edit.startsAt) || !isInstant(edit.endsAt)) return 'موعدُ اللقاء ليس لحظةً مقروءة'
      if (Date.parse(edit.endsAt) <= Date.parse(edit.startsAt)) return 'نهايةُ اللقاء قبل بدايته'
      return null
    case 'session_remove':
      return null
    default:
      return 'هذا التعديلُ يقع في محتوى الخطّة لا في صفّ'
  }
}

/** لقطةُ مهمّةٍ بالحقول التي يمسّها التعديل — والموعدُ لحظةٌ ISO */
export function taskSnapshot(row: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const v = row[f]
    out[f] = v instanceof Date ? v.toISOString() : norm(v)
  }
  return out
}

/** لقطةُ لقاءٍ: موعدُه */
export function sessionSnapshot(row: { startsAt: Date | string; endsAt?: Date | string | null }): Record<string, unknown> {
  const iso = (v: Date | string | null | undefined) => (v == null ? null : new Date(v).toISOString())
  return { startsAt: iso(row.startsAt), endsAt: iso(row.endsAt) }
}

/** أتغيّر الموضعُ منذ الاقتراح؟ — والمقارنةُ على القيم لا على ترتيب المفاتيح */
export function sameSnapshot(a: EditSnapshot, b: EditSnapshot): boolean {
  if (a === null || b === null) return a === b
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    const x = norm(a[k]); const y = norm(b[k])
    if (typeof x === 'string' && typeof y === 'string' && !Number.isNaN(Date.parse(x)) && /^\d{4}-\d\d-\d\dT/.test(x)) {
      if (Date.parse(x) !== Date.parse(y)) return false
      continue
    }
    if (x !== y) return false
  }
  return true
}

/* ─────────── التطبيق ─────────── */

/** المصدرُ كما يُحفظ: صنفُه صريحٌ ونوعُه مشتقٌّ منه كما تكتبه شاشةُ المدرّب */
function resourceAsSaved(r: ResourceFields): ResourceFields {
  const category = (RESOURCE_CATEGORIES as readonly string[]).includes(r.category ?? '')
    ? r.category as ResourceCategory : 'public'
  const out: ResourceFields = {
    title: r.title.trim(), url: norm(r.url) as string | null, category,
    kind: r.kind ?? kindForCategory(category, false),
  }
  if (r.noteAr != null) out.noteAr = r.noteAr
  if (r.moduleId != null) out.moduleId = r.moduleId
  if (r.preReading != null) out.preReading = r.preReading
  return out
}

/** محتوى الخطّة بعد التعديل — لا يمسّ الأصلَ. ويُنادى بعد `contentBefore`:
    ما لا يقع يُردّ بسببه ولا يُطبَّق نصفا */
export function applyContentEdit<C extends EditableContent>(c: C, edit: PlanEdit): Checked<C> {
  const checked = contentBefore(edit, c)
  if (!checked.ok) return checked
  switch (edit.kind) {
    case 'module':
      return { ok: true, value: { ...c, modules: c.modules.map((m) => (m.moduleId === edit.moduleId ? { ...m, ...edit.set } : m)) } }
    case 'plan':
      return { ok: true, value: { ...c, ...edit.set } }
    case 'resource_add':
      return { ok: true, value: { ...c, resources: [...c.resources, resourceAsSaved(edit.resource)] } }
    case 'resource_change': {
      const at = findResource(c.resources, edit.match)
      if (!at.ok) return at
      const next = { ...c.resources[at.value], ...edit.set }
      /* والصنفُ إن تغيّر تبعه نوعُه — كما في شاشة المدرّب */
      if (edit.set.category !== undefined && edit.set.kind === undefined) {
        next.kind = kindForCategory(next.category as ResourceCategory, Boolean(next.bodyFileKey))
      }
      return { ok: true, value: { ...c, resources: c.resources.map((r, i) => (i === at.value ? next : r)) } }
    }
    case 'resource_remove': {
      const at = findResource(c.resources, edit.match)
      if (!at.ok) return at
      return { ok: true, value: { ...c, resources: c.resources.filter((_, i) => i !== at.value) } }
    }
    default:
      return { ok: false, problemAr: 'هذا التعديلُ لا يقع في محتوى الخطّة' }
  }
}

/** أيقع التعديلُ في محتوى الخطّة (فيُحفظ بـ`savePlan`) أم في صفّ مهمّةٍ أو لقاء؟ */
export const editsContent = (edit: PlanEdit): boolean =>
  edit.kind === 'module' || edit.kind === 'plan' || edit.kind.startsWith('resource_')

/* ─────────── العرض: «قبل» و«بعد» بلغة المدرّب ─────────── */

const FIELD_AR: Record<string, string> = {
  titleAr: 'العنوان', outcomeAr: 'المخرَج', activityAr: 'التطبيقُ العمليّ', artifactAr: 'ما يسلّمه المتعلّم',
  bodyAr: 'المحتوى النظريّ', summaryAr: 'النبذة', liveNoteAr: 'ملاحظةُ اللقاءات',
  title: 'العنوان', url: 'الرابط', kind: 'النوع', category: 'الصنف', noteAr: 'لماذا هذا المصدر',
  moduleId: 'المحور', preReading: 'قراءةٌ قبل اللقاء', briefAr: 'التعليمات', dueAt: 'الموعد', maxScore: 'الدرجةُ العظمى',
  type: 'النوع', when: 'الموعد',
}
const KIND_AR: Record<string, string> = {
  link: 'رابط', video: 'فيديو', book: 'كتاب', audiobook: 'كتاب صوتيّ', social: 'منشور', file: 'ملفّ',
}
const CATEGORY_AR: Record<string, string> = {
  recorded: 'دوراتٌ مسجّلة', reading: 'كتبٌ وملفّات', public: 'فيديوهاتٌ وروابطُ عامّة',
}
const TASK_TYPE_AR: Record<string, string> = { assignment: 'واجب', quiz: 'اختبار', project: 'مشروع' }

/** ما يعرفه العرضُ عن الشعبة — رقمُ كلّ محور، واسمُ المهمّة واللقاء */
export interface EditContext {
  moduleIds: readonly string[]
  taskTitle?: (id: string) => string | null
  sessionTitle?: (id: string) => string | null
}

/** صفُّ «قبل» و«بعد». والرابطُ يُقرأ مفكوكا ويُفتح (`beforeHref`/`afterHref`) — ليتحقّق منه قبل أن يقبله */
export interface EditRow {
  labelAr: string; beforeAr: string | null; afterAr: string | null; long?: boolean
  beforeHref?: string; afterHref?: string
}
export interface EditView { titleAr: string; stepAr: string; rows: EditRow[] }

function valueAr(field: string, v: unknown, ctx: EditContext): string | null {
  const x = norm(v)
  if (x === null) return null
  if (field === 'moduleId') {
    const i = ctx.moduleIds.indexOf(String(x))
    return i >= 0 ? `المحور ${i + 1}` : String(x)
  }
  if (field === 'kind') return KIND_AR[String(x)] ?? String(x)
  if (field === 'category') return CATEGORY_AR[String(x)] ?? String(x)
  if (field === 'type') return TASK_TYPE_AR[String(x)] ?? String(x)
  if (field === 'preReading') return x ? 'نعم' : 'لا'
  if (field === 'dueAt') return whenAr(String(x))
  /* الرابطُ العربيُّ يُخزَّن مرمَّزا (%D8%A7…) — ويُقرأ بحروفه */
  if (field === 'url') { try { return decodeURI(String(x)) } catch { return String(x) } }
  return String(x)
}

const LONG = new Set(['bodyAr', 'activityAr', 'briefAr', 'summaryAr', 'noteAr', 'outcomeAr', 'artifactAr'])

const isHttp = (v: unknown) => typeof v === 'string' && /^https?:\/\//i.test(v.trim())

function rowsFor(fields: readonly string[], before: Record<string, unknown> | null, after: Record<string, unknown> | null, ctx: EditContext): EditRow[] {
  return fields.map((f) => ({
    labelAr: FIELD_AR[f] ?? f,
    beforeAr: before ? valueAr(f, before[f], ctx) : null,
    afterAr: after ? valueAr(f, after[f], ctx) : null,
    ...(f === 'url' && before && isHttp(before[f]) ? { beforeHref: String(before[f]).trim() } : {}),
    ...(f === 'url' && after && isHttp(after[f]) ? { afterHref: String(after[f]).trim() } : {}),
    ...(LONG.has(f) ? { long: true } : {}),
  }))
}

const moduleNoAr = (id: string | null | undefined, ctx: EditContext) => {
  if (!id) return 'للشعبة كلِّها'
  const i = ctx.moduleIds.indexOf(id)
  return i >= 0 ? `للمحور ${i + 1}` : `للمحور «${id}»`
}

/** «السبت، 5 ديسمبر في 7:00 م حتّى 9:00 م» — بتوقيت عمّان كسائر مواعيد الشعبة */
const sessionWhenAr = (s: Record<string, unknown> | null) => {
  if (!s || !s.startsAt) return null
  const end = s.endsAt ? fmtDateWith(String(s.endsAt), { hour: 'numeric', minute: '2-digit', timeZone: ACADEMY_ZONE }) : null
  return `${whenAr(String(s.startsAt))}${end ? ` حتّى ${end}` : ''}`
}

/** التعديلُ بلغة من يقرّر فيه: عنوانٌ، وخطوتُه، وصفوفُ «قبل» و«بعد» */
export function planEditView(edit: PlanEdit, before: EditSnapshot, ctx: EditContext): EditView {
  const stepAr = STAGE_LABELS[planEditStep(edit)]
  const view = (titleAr: string, rows: EditRow[]): EditView => ({ titleAr, stepAr, rows })
  switch (edit.kind) {
    case 'module': {
      const i = ctx.moduleIds.indexOf(edit.moduleId)
      const keys = Object.keys(edit.set)
      const where = i >= 0 ? `المحور ${i + 1}` : `المحور «${edit.moduleId}»`
      return view(keys.length === 1 ? `${where} — ${FIELD_AR[keys[0]] ?? keys[0]}` : where, rowsFor(keys, before, edit.set, ctx))
    }
    case 'plan': {
      const keys = Object.keys(edit.set)
      return view(keys.map((k) => FIELD_AR[k] ?? k).join(' و'), rowsFor(keys, before, edit.set, ctx))
    }
    case 'resource_add': {
      const r = resourceAsSaved(edit.resource) as unknown as Record<string, unknown>
      const fields = ['title', 'url', 'category', 'noteAr', 'preReading'].filter((f) => norm(r[f]) !== null)
      return view(`مصدرٌ جديدٌ ${moduleNoAr(edit.resource.moduleId, ctx)}`, rowsFor(fields, null, r, ctx))
    }
    case 'resource_change': {
      const keys = Object.keys(edit.set)
      return view(`تعديلُ مصدر: «${edit.match.title}»`, rowsFor(keys, before, edit.set as Record<string, unknown>, ctx))
    }
    case 'resource_remove':
      return view(`حذفُ مصدر: «${edit.match.title}»`, rowsFor(['title', 'url', 'moduleId'], before, null, ctx))
    case 'task_add': {
      const t = edit.task as unknown as Record<string, unknown>
      const fields = ['title', 'type', 'briefAr', 'dueAt', 'maxScore'].filter((f) => norm(t[f]) !== null)
      return view(`مهمّةٌ جديدةٌ ${moduleNoAr(edit.task.moduleId, ctx)}`, rowsFor(fields, null, t, ctx))
    }
    case 'task_change': {
      const name = ctx.taskTitle?.(edit.assessmentId) ?? 'مهمّة'
      const keys = Object.keys(edit.set)
      return view(`تعديلُ مهمّة: «${name}»`, rowsFor(keys, before, edit.set as Record<string, unknown>, ctx))
    }
    case 'session_move': {
      const name = ctx.sessionTitle?.(edit.sessionId) ?? 'لقاء'
      return view(`نقلُ لقاء: «${name}»`, [{
        labelAr: FIELD_AR.when, beforeAr: sessionWhenAr(before), afterAr: sessionWhenAr({ startsAt: edit.startsAt, endsAt: edit.endsAt }),
      }])
    }
    case 'session_remove': {
      const name = ctx.sessionTitle?.(edit.sessionId) ?? 'لقاء'
      return view(`حذفُ لقاء: «${name}»`, [{ labelAr: FIELD_AR.when, beforeAr: sessionWhenAr(before), afterAr: null }])
    }
  }
}

/* ─────────── وما يُقال في رسالة القرار ─────────── */

/** سطرُ الرسالة حين تصحبها تعديلاتٌ مقترحة — أو لا شيء */
export function suggestedEditsLineAr(count: number, required: number): string | null {
  if (count <= 0) return null
  const n = count === 1 ? 'تعديلًا واحدا' : count === 2 ? 'تعديلَين' : count <= 10 ? `${count} تعديلات` : `${count} تعديلًا`
  const req = required <= 0 ? ''
    : required === count ? (count === 1 ? ' (مطلوب)' : ' (كلُّها مطلوبة)')
    : required === 1 ? ' (منها واحدٌ مطلوب)'
    : required === 2 ? ' (منها اثنان مطلوبان)'
    : ` (منها ${required} مطلوبة)`
  return `واقترحنا على خطّتك ${n}${req}، جاهزةً في صفحة الشعبة: ترى كلًّا بما قبله وما بعده، فتقبله أو ترفضه — وما تقبله يُكتب في خطّتك.`
}

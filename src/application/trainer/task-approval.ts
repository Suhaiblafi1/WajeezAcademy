/* ═══ مهامُّ بعد الاعتماد — تنتظر قرارَ الإدارة (المرحلة ٣ج-٣) ═══

   قرارُ صاحب المنصّة بكلمة «go» (٢٧ سبتمبر ٢٠٢٦): «وبعد الاعتماد كلُّ تغييرٍ
   باعتماد»، و«بالتأكيد يحقّ للمدرّب لاحقا أن يضيف ويعدّل كلَّ شيءٍ براحته
   بموافقة الإدارة».

   وكانت المهمّةُ تُنشأ وتُعدَّل وتُحذف بعد الاعتماد فتصل المسجَّلين لحظتَها —
   فما قرأه المعتمِدُ في المنهج غيرُ ما يقرؤه المتعلّمُ بعد ساعة. فصار:

   · **مهمّةٌ جديدة** بعد الاعتماد تُنشأ مسودّةً (`draft`) لا يراها المتعلّم،
     وتُنشر باعتماد الإدارة.
   · **وتعديلُ منشورةٍ** يُحفظ طلبا بجانبها (`pendingChange`) — والمتعلّمون
     يقرؤون المعتمَدَ حتّى يُعتمَد التعديل.
   · **وحذفُها** طلبٌ كذلك: تبقى عندهم حتّى يُعتمَد.
   · والمسودّةُ تُعدَّل وتُحذف بلا طلب — لا يراها أحدٌ بعد.
   · والردُّ يُبقي المعتمَدَ كما هو، ويصل المدرّبَ سببُه (`reviewerNote`).
   · واعتمادُ مراجعةِ الخطّة يعتمد معها ما ينتظر من مهامّها — الاعتمادُ واحد.

   وقبل أوّل اعتمادٍ لا طلبَ ولا انتظار: الخطّةُ كلُّها تنتظر، واعتمادُها يعتمد
   كلَّ ما فيها. وشعبةٌ لا خطّةَ لمدرّبها تبقى كما كانت.

   والقاعدةُ محضةٌ هنا: تحتجّ بها الخدمةُ، وتقرؤها شاشتا المدرّب والمعتمِد
   (`task-approval.test.ts`). */

import { readTypedLinks } from './plan-overlay'

/** ما يُطلب تعديلُه في المهمّة — وبهذا الترتيب يُقرأ للمعتمِد */
export const TASK_FIELDS = ['title', 'briefAr', 'type', 'maxScore', 'dueAt', 'moduleId', 'attachments'] as const
export type TaskField = (typeof TASK_FIELDS)[number]

export const TASK_FIELD_LABELS: Record<TaskField, string> = {
  title: 'العنوان',
  briefAr: 'التعليمات',
  type: 'النوع',
  maxScore: 'الدرجة العظمى',
  dueAt: 'آخرُ موعد',
  moduleId: 'المحور',
  attachments: 'المرفقات',
}

const TASK_TYPES = ['assignment', 'quiz', 'project'] as const

export interface TaskAttachment { title: string; url: string; kind: string }

/** المهمّةُ قيما تُقارَن — التاريخُ لحظةً بصيغة ISO، والمرفقاتُ مقروءة */
export interface TaskValues {
  title: string
  briefAr: string | null
  type: string
  maxScore: number
  dueAt: string | null
  moduleId: string | null
  attachments: TaskAttachment[]
}

export type TaskPatch = Partial<TaskValues>

export type TaskChange =
  | { kind: 'edit'; fields: TaskPatch; requestedAt: string }
  | { kind: 'remove'; requestedAt: string }

/**
 * حالُ المهمّة في الاعتماد:
 * · `live` منشورةٌ بلا طلب · `draft` مسودّةٌ قبل أوّل اعتماد (يعتمدها اعتمادُ الخطّة)
 * · `new` جديدةٌ تنتظر · `edit` تعديلٌ ينتظر · `remove` حذفٌ ينتظر
 * · `declined` ردّت الإدارةُ آخرَ طلب · `closed` مغلقة
 */
export type TaskReview = 'live' | 'draft' | 'new' | 'edit' | 'remove' | 'declined' | 'closed'

function iso(v: string | Date | null | undefined): string | null {
  if (v === null || v === undefined || v === '') return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/* الفراغُ والمسافاتُ «بلا تعليمات» — كي لا يُعدّ تعديلا ما لم يتغيّر */
const text = (v: string | null | undefined): string | null => (v && v.trim() ? v : null)

function attachmentsOf(raw: unknown): TaskAttachment[] {
  return readTypedLinks(raw).map((l) => ({ title: l.title, url: l.url, kind: l.kind ?? 'link' }))
}

/** صفُّ المهمّة كما في القاعدة أو كما وصل الشاشةَ — قيما تُقارَن */
export function taskValues(row: {
  title: string
  briefAr?: string | null
  type: string
  maxScore: number
  dueAt?: string | Date | null
  moduleId?: string | null
  attachments?: unknown
}): TaskValues {
  return {
    title: row.title,
    briefAr: text(row.briefAr),
    type: row.type,
    maxScore: row.maxScore,
    dueAt: iso(row.dueAt),
    moduleId: row.moduleId || null,
    attachments: attachmentsOf(row.attachments),
  }
}

/** ما أرسله المدرّبُ — والغائبُ لا يُمسّ، و`null` محوٌ مقصود */
export function toTaskPatch(input: {
  title?: string
  briefAr?: string | null
  type?: string
  maxScore?: number
  dueAt?: string | Date | null
  moduleId?: string | null
  attachments?: unknown
}): TaskPatch {
  const out: TaskPatch = {}
  if (input.title !== undefined) out.title = input.title
  if (input.briefAr !== undefined) out.briefAr = text(input.briefAr)
  if (input.type !== undefined) out.type = input.type
  if (input.maxScore !== undefined) out.maxScore = input.maxScore
  if (input.dueAt !== undefined) out.dueAt = iso(input.dueAt)
  if (input.moduleId !== undefined) out.moduleId = input.moduleId || null
  if (input.attachments !== undefined) out.attachments = attachmentsOf(input.attachments)
  return out
}

/* ═══ الطلبُ محفوظا — يُقرأ دفاعيّا ═══

   العمودُ `Json?`: ما فيه ما كتبه الخادم، وقد يكتبه إصدارٌ غدا بشكلٍ آخر. فحقلٌ
   مشوّهٌ يُسقَط وحدَه لا الطلبُ كلُّه، وطلبُ تعديلٍ لم يبقَ فيه حقلٌ ليس طلبا. */
function readTaskPatch(raw: unknown): TaskPatch {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const out: TaskPatch = {}
  if (typeof r.title === 'string' && r.title.trim()) out.title = r.title
  if (r.briefAr === null || typeof r.briefAr === 'string') out.briefAr = text(r.briefAr)
  if (typeof r.type === 'string' && (TASK_TYPES as readonly string[]).includes(r.type)) out.type = r.type
  if (typeof r.maxScore === 'number' && Number.isInteger(r.maxScore) && r.maxScore >= 1) out.maxScore = r.maxScore
  if (r.dueAt === null) out.dueAt = null
  else if (typeof r.dueAt === 'string' && iso(r.dueAt)) out.dueAt = iso(r.dueAt)
  if (r.moduleId === null || typeof r.moduleId === 'string') out.moduleId = (r.moduleId as string | null) || null
  if (Array.isArray(r.attachments)) out.attachments = attachmentsOf(r.attachments)
  return out
}

export function readTaskChange(raw: unknown): TaskChange | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const requestedAt = typeof r.requestedAt === 'string' ? r.requestedAt : ''
  if (r.kind === 'remove') return { kind: 'remove', requestedAt }
  if (r.kind === 'edit') {
    const fields = readTaskPatch(r.fields)
    return Object.keys(fields).length > 0 ? { kind: 'edit', fields, requestedAt } : null
  }
  return null
}

const same = (f: TaskField, a: TaskValues, b: TaskValues) =>
  f === 'attachments' ? JSON.stringify(a.attachments) === JSON.stringify(b.attachments) : a[f] === b[f]

export function applyTaskPatch(v: TaskValues, patch: TaskPatch): TaskValues {
  const out: TaskValues = { ...v }
  for (const f of TASK_FIELDS) {
    if (patch[f] !== undefined) (out as unknown as Record<TaskField, unknown>)[f] = patch[f]
  }
  return out
}

/** ما يفترق فيه المقترَحُ عن المعتمَد — وحدَه يُطلب ويُقرأ للمعتمِد */
export function diffTask(live: TaskValues, proposed: TaskValues): TaskPatch {
  const out: TaskPatch = {}
  for (const f of TASK_FIELDS) {
    if (!same(f, live, proposed)) (out as unknown as Record<TaskField, unknown>)[f] = proposed[f]
  }
  return out
}

/** المهمّةُ كما ستكون إن اعتُمد طلبُها — والحذفُ لا يغيّر قيمَها */
export function proposedTask(live: TaskValues, change: TaskChange | null): TaskValues {
  return change?.kind === 'edit' ? applyTaskPatch(live, change.fields) : live
}

/**
 * طلبُ تعديلٍ على منشورة: المقترَحُ = المعتمَدُ ← ما طُلب قبلُ ← ما يُطلب الآن،
 * ثمّ يُقابَل بالمعتمَد. فتعديلُ الطلب يعدّل الطلبَ لا المعتمَد، ومن أعاد القيمَ
 * إلى المعتمَد سحب طلبَه (`null`) — لا يُرسَل إلى الإدارة «تعديلٌ» لا شيءَ فيه.
 */
export function nextEditChange(live: TaskValues, previous: TaskChange | null, patch: TaskPatch, now: Date): TaskChange | null {
  const base = proposedTask(live, previous)
  const fields = diffTask(live, applyTaskPatch(base, patch))
  return Object.keys(fields).length > 0 ? { kind: 'edit', fields, requestedAt: now.toISOString() } : null
}

export function taskReview(
  row: { status: string; pendingChange?: unknown; reviewerNote?: string | null },
  approvedOnce: boolean,
): TaskReview {
  if (row.status === 'closed') return 'closed'
  if (row.status === 'draft') {
    if (row.reviewerNote) return 'declined'
    return approvedOnce ? 'new' : 'draft'
  }
  const change = readTaskChange(row.pendingChange)
  if (change) return change.kind
  return row.reviewerNote ? 'declined' : 'live'
}

/** أينتظر قرارَ الإدارة — ما تعرضه «مهامُّ تنتظر قرارك» وتقبله بابُ القرار */
export function awaitsDecision(review: TaskReview): boolean {
  return review === 'new' || review === 'edit' || review === 'remove'
}

/** ما ينتظر قرارَ الإدارة من مهامّ شعبة — ولا شيءَ قبل أوّل اعتماد: الخطّةُ كلُّها تنتظر */
export function awaitingTasks<T extends { status?: string | null; pendingChange?: unknown; reviewerNote?: string | null }>(
  rows: readonly T[], approvedOnce: boolean,
): T[] {
  if (!approvedOnce) return []
  return rows.filter((r) => awaitsDecision(taskReview({ status: r.status ?? 'published', pendingChange: r.pendingChange, reviewerNote: r.reviewerNote }, true)))
}

/**
 * ما يعتمده اعتمادُ الخطّة من المهامّ: كلُّ ما ينتظر، ومسودّاتُ ما قبل أوّل
 * اعتماد — فقد قرأها المعتمِدُ في المنهج. لا المردودُ: ردّه صاحبُ القرار نفسُه،
 * ولا يعود إلّا بتعديلٍ من صاحبه.
 */
export function planApprovalApplies(review: TaskReview): boolean {
  return review === 'draft' || awaitsDecision(review)
}

/* ═══ ما يُقال — للمدرّب في مهمّته، وللمعتمِد في قائمته ═══ */

export const TASK_REVIEW_TRAINER_AR: Partial<Record<TaskReview, string>> = {
  new: 'جديدةٌ — تنتظر اعتمادَ الإدارة، ولا يراها المتعلّمون قبله',
  edit: 'تعديلُك ينتظر اعتمادَ الإدارة — ويرى المتعلّمون المعتمَدَ حتّى يُعتمَد',
  remove: 'طلبتَ حذفَها — وتبقى عند المتعلّمين حتّى تعتمده الإدارة',
  declined: 'ردّت الإدارةُ طلبَك',
}

export const TASK_REVIEW_ADMIN_AR: Partial<Record<TaskReview, string>> = {
  new: 'مهمّةٌ جديدة',
  edit: 'تعديلُ مهمّةٍ منشورة',
  remove: 'حذفُ مهمّةٍ منشورة',
}

export interface TaskValueFormat {
  type: (t: string) => string
  date: (isoValue: string) => string
  axis: (moduleId: string) => string
}

const BRIEF_PREVIEW = 140

/** قيمةُ حقلٍ نصًّا يُقرأ — والفارغُ يُسمّى لا يُترك بياضا */
export function formatTaskValue<F extends TaskField>(field: F, value: TaskValues[F], fmt: TaskValueFormat): string {
  switch (field) {
    case 'title': return value as string
    case 'briefAr': {
      const v = value as string | null
      if (!v) return 'بلا تعليمات'
      return v.length > BRIEF_PREVIEW ? `${v.slice(0, BRIEF_PREVIEW).trimEnd()}…` : v
    }
    case 'type': return fmt.type(value as string)
    case 'maxScore': return String(value)
    case 'dueAt': return value ? fmt.date(value as string) : 'بلا موعد'
    case 'moduleId': return value ? fmt.axis(value as string) : 'بلا محور'
    case 'attachments': {
      const list = value as TaskAttachment[]
      return list.length === 0 ? 'بلا مرفقات' : list.map((a) => a.title).join('، ')
    }
  }
  return String(value)
}

export interface TaskChangeLine { field: TaskField; label: string; before: string; after: string }

/** سطورُ ما يتغيّر إن اعتُمد الطلب — «العنوان: قديم ← جديد» بترتيب الحقول */
export function changeLines(live: TaskValues, change: TaskChange | null, fmt: TaskValueFormat): TaskChangeLine[] {
  if (change?.kind !== 'edit') return []
  const next = proposedTask(live, change)
  return TASK_FIELDS.filter((f) => !same(f, live, next)).map((f) => ({
    field: f,
    label: TASK_FIELD_LABELS[f],
    before: formatTaskValue(f, live[f], fmt),
    after: formatTaskValue(f, next[f], fmt),
  }))
}

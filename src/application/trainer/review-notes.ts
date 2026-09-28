/* ═══ ملاحظاتُ المعتمِد — لكلّ خطوةٍ ملاحظتُها في خطوتها (المرحلة ٣ب) ═══

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): المنهجُ كاملا «هو ما سنقرؤه عند
   الموافقة على الشعبة، ونعطيه تعليماتٍ للإضافة والتعديل».

   وكان الردُّ صندوقا واحدا (`window.prompt`) بسطرٍ واحد: «ما الذي يُعدَّل؟».
   فيكتب المعتمِدُ فقرةً عن خمس خطوات، ويقرؤها المدرّبُ في رأس الشاشة ثمّ ينزل
   إلى خطوةٍ منها وقد غاب عنه نصفُها. فصارت الملاحظةُ **لكلّ خطوةٍ في خطوتها**:
   يكتبها المعتمِدُ تحت اسم الخطوة، ويقرؤها المدرّبُ في رأسها حين يفتحها، ويرى
   في الشريط أيَّ الخطوات عليها ملاحظة. وتبقى ملاحظةٌ عامّةٌ لما لا خطوةَ له.

   ── والأسماءُ من هنا ──

   مفاتيحُ الأقسام مفاتيحُ خطوات المدرّب نفسُها، وأسماؤها تُقرأ من هنا في
   شريطه (`CohortWorkspace`) وفي حقول المعتمِد (`CohortOps`). فلا يكتب المعتمِدُ
   «على الكرّاسات» ويبحث المدرّبُ عن خطوةٍ اسمُها غيرُه.

   ── والصفُّ القديم ──

   ردٌّ كُتب قبل الأقسام نصٌّ واحدٌ في `reviewerNote` — يُقرأ ملاحظةً عامّة،
   فلا يسقط من شاشة المدرّب ردٌّ لم يُعالَج بعد. */

export const STAGE_LABELS = {
  identity: 'المعلومات الأساسيّة',
  modules: 'المحاور ومواعيدها',
  workbooks: 'الكرّاسات',
  sessions: 'اللقاءات',
  assignments: 'المهامّ والمصادر',
} as const

export type ReviewSection = keyof typeof STAGE_LABELS

/** الأقسامُ بترتيب خطوات المدرّب — والعامّةُ ليست منها: لا خطوةَ لها */
export const REVIEW_SECTIONS: readonly { key: ReviewSection; label: string }[] =
  (Object.keys(STAGE_LABELS) as ReviewSection[]).map((key) => ({ key, label: STAGE_LABELS[key] }))

export type ReviewNotes = Partial<Record<'general' | ReviewSection, string>>

/** حدُّ الملاحظة الواحدة — كحدّ الصندوق الذي كان قبلها */
export const REVIEW_NOTE_MAX = 2000

const KEYS: readonly ('general' | ReviewSection)[] = ['general', ...REVIEW_SECTIONS.map((s) => s.key)]

/** ما يُحفظ: المفاتيحُ المعروفةُ وحدَها، نصوصا مشذّبةً غيرَ فارغة */
export function normalizeReviewNotes(input: unknown): ReviewNotes {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const src = input as Record<string, unknown>
  const out: ReviewNotes = {}
  for (const k of KEYS) {
    const v = src[k]
    if (typeof v !== 'string') continue
    const t = v.trim().slice(0, REVIEW_NOTE_MAX)
    if (t) out[k] = t
  }
  return out
}

export function hasReviewNotes(notes: ReviewNotes): boolean {
  return KEYS.some((k) => Boolean(notes[k]))
}

/** الخطواتُ التي عليها ملاحظة — بترتيبها في الشريط */
export function notedSections(notes: ReviewNotes): ReviewSection[] {
  return REVIEW_SECTIONS.filter((s) => Boolean(notes[s.key])).map((s) => s.key)
}

/** نصٌّ واحدٌ للجرس والأثر ولمن يقرأ `reviewerNote` — العامّةُ أوّلا ثمّ كلُّ خطوةٍ باسمها */
export function composeReviewNote(notes: ReviewNotes): string | null {
  const parts: string[] = []
  if (notes.general) parts.push(notes.general)
  for (const s of REVIEW_SECTIONS) {
    const t = notes[s.key]
    if (t) parts.push(`«${s.label}»: ${t}`)
  }
  return parts.length ? parts.join('\n\n') : null
}

/** الملاحظاتُ كما تُقرأ من الصفّ — والنصُّ القديمُ وحدَه ملاحظةٌ عامّة */
export function readReviewNotes(row: { reviewerNotes?: unknown; reviewerNote?: string | null }): ReviewNotes {
  const structured = normalizeReviewNotes(row.reviewerNotes)
  if (hasReviewNotes(structured)) return structured
  const legacy = row.reviewerNote?.trim()
  return legacy ? { general: legacy.slice(0, REVIEW_NOTE_MAX) } : {}
}

/** ما يقرؤه المدرّب — ما دامت الخطّةُ مردودةً إليه وحدَه. بعد إعادة الإرسال
 *  تبقى الملاحظاتُ في الصفّ ليقابلها المعتمِدُ بما عُدّل، ولا تبقى في شاشة
 *  المدرّب «ملاحظةً» عولجت؛ وبعد الاعتماد لا ملاحظات. */
export function notesForTrainer(plan: { status: string; reviewerNotes?: unknown; reviewerNote?: string | null } | null | undefined): ReviewNotes {
  if (!plan || plan.status !== 'changes_requested') return {}
  return readReviewNotes(plan)
}

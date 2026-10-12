/* ═══ ملفّاتُ التعديلات دفعةً واحدة (١٠ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «I need one place to upload all of them same time!» — وكان كلُّ
   ملفٍّ يُرفع من بطاقة خطّته، ثمانيةُ ملفّاتٍ في ثماني بطاقات. وكلُّ ملفٍّ يحمل خطّتَه
   (`planId`) فيعرف موضعه بلا سؤال: يُقرأ هنا، ويُرفع كلٌّ إلى خطّته بالمسلك نفسِه الذي في
   البطاقة — فيُفحص في الخادم كما يُفحص هناك، ويُرفع كلُّه أو يُردّ كلُّه.

   وما يُقرأ هنا قبل الرفع: أهو JSON، وأيذكر خطّتَه، وكم بندا فيه وكم منها مطلوب. ولا
   يُحكم هنا على البنود — ذلك للخادم وحدَه، على الخطّة كما هي ساعةَ الرفع. */

import { countAr } from '@/application/text/count-ar'

export type BulkFile =
  | { name: string; ok: true; planId: string; titleAr: string | null; body: unknown; count: number; required: number }
  | { name: string; ok: false; problemAr: string }

/** يقرأ ملفّا واحدا — ولا يرمي: ما لا يُقرأ يعود بسببه ليُعرض بجانب اسمه */
export function readEditsFile(name: string, text: string): BulkFile {
  let body: unknown
  try { body = JSON.parse(text) } catch { return { name, ok: false, problemAr: 'ليس ملفّ JSON مقروءا' } }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { name, ok: false, problemAr: 'ليس ملفّ تعديلات' }
  const f = body as { planId?: unknown; titleAr?: unknown; items?: unknown }
  if (typeof f.planId !== 'string' || !f.planId.trim()) {
    return { name, ok: false, problemAr: 'لا يذكر الملفّ خطّته (planId) — ارفعه من بطاقة خطّته' }
  }
  if (!Array.isArray(f.items) || f.items.length === 0) return { name, ok: false, problemAr: 'الملفّ بلا تعديلات' }
  const required = f.items.filter((x) => (x as { required?: unknown } | null)?.required === true).length
  return {
    name, ok: true, planId: f.planId.trim(), body,
    titleAr: typeof f.titleAr === 'string' && f.titleAr.trim() ? f.titleAr.trim() : null,
    count: f.items.length, required,
  }
}

const ITEM_FORMS = { one: 'بند', two: 'بندان', few: 'بنود', many: 'بندا' }

/** «رُفع مسوّدةً: 19 بندا، 3 منها مطلوبة» */
export function uploadedLineAr(count: number, required: number): string {
  return `رفع مسوّدة: ${countAr(count, ITEM_FORMS)}${required > 0 ? `، ${required} منها ${required === 1 ? 'مطلوب' : 'مطلوبة'}` : ''}`
}

/** «، مكان 19 مسودة سابقة» — حين يُستبدل الملفّ بمسوّداتٍ لم تُعتمد؛ ولا شيءَ إن لم يكن قبله شيء */
export function replacedLineAr(replaced: number): string {
  if (replaced <= 0) return ''
  return `، مكان ${countAr(replaced, { one: 'مسودة سابقة', two: 'مسودتين سابقتين', few: 'مسودات سابقة', many: 'مسودة سابقة' })}`
}

/** «، وسحب 5 بنود لم يقرر فيها» — في «ابدأ من جديد»؛ ولا شيءَ إن لم يكن قبله شيء */
export function withdrawnLineAr(withdrawn: number): string {
  if (withdrawn <= 0) return ''
  return `، وسحب ${countAr(withdrawn, ITEM_FORMS)} لم يقرر فيها المدرب`
}

/* ═══ ثلاثُ طرقٍ للرفع دفعةً — يختارها المعتمِد، ولا تُفترض (١٢ أكتوبر ٢٠٢٦) ═══
   «أضف» ما كان قبل الاستبدال، و«استبدل المسودات» (١٠ أكتوبر)، و«ابدأ من جديد» (١٢ أكتوبر): قال صاحبُ
   المنصّة «أريد أن أعيد كلَّ شيءٍ من البداية.. اسحب كلَّ شيءٍ وارفق كلَّ شيءٍ من جديد». والمسارُ لكلٍّ هنا
   لا في الشاشة — فلا يفترق ما تقوله عمّا يقع. */
export const BULK_MODES = ['add', 'drafts', 'all'] as const
export type BulkMode = (typeof BULK_MODES)[number]

export const BULK_MODE_AR: Record<BulkMode, { labelAr: string; whatAr: string }> = {
  add: {
    labelAr: 'أضف إلى ما هو موجود',
    whatAr: 'يبقى كل ما رفعته قبل. ويرد الملف إن وقع بند فيه على بند لم يقرر فيه بعد.',
  },
  drafts: {
    labelAr: 'استبدل المسودات التي لم تعتمدها بعد',
    whatAr: 'تسحب المسودات القديمة ويرفع الملف مكانها. وما اعتمدته للمدرب يبقى كما هو.',
  },
  all: {
    labelAr: 'ابدأ من جديد',
    whatAr: 'يسحب كل ما لم يقرر فيه المدرب — المسودات وما وصله — ويرفع الملف مكانه. يختفي المسحوب من صفحة المدرب، وتعيده «أعد ما سحبته» ما لم يقع عليه بند جديد. وما قبله المدرب أو رفضه لا يمس.',
  },
}

/** مسارُ الرفع لكلّ طريقة */
export function bulkUploadPath(planId: string, mode: BulkMode): string {
  const base = `/api/admin/cohort-plans/${planId}/edits`
  return mode === 'add' ? base : mode === 'drafts' ? `${base}/replace-drafts` : `${base}/replace-all`
}

/** خلاصةُ الدفعة — كم رُفع وكم رُدّ، ولا يُقال «تمّ» وفيها ما رُدّ */
export function bulkSummaryAr(done: number, failed: number): string {
  const total = done + failed
  if (failed === 0) return `رفعت الملفّات كلّها (${total}) مسوّدات — لا يصل المدرّبين منها شيء حتّى تعتمد بنودها.`
  if (done === 0) return `لم يرفع شيء — ردّت الملفّات كلّها (${total}) بأسبابها أدناه.`
  return `رفع ${done} من ${total} — وردّ ${failed} بسببه أدناه، وما ردّ لم يحفظ منه شيء.`
}

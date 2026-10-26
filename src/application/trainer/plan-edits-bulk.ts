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

/* ═══ «احذف المكرر» — يبقى آخرُ ملفٍّ رُفع على الخطّة (١٢ أكتوبر ٢٠٢٦، `keepLatest` في `plan-edit.service.ts`) ═══
   «give me a button to remove duplication» (صاحب المنصّة): أعادت «أعد ما سحبته» بنودَ رفعاتٍ سابقةٍ فوق
   الملفّ الجديد. فزرٌّ على البطاقة لخطّتها. وكان معه زرٌّ للخطط كلِّها في «خططٌ تنتظر اعتمادك» — وذهب بقول صاحب
   المنصّة «فقط تحميل ورفع» (٢٦ أكتوبر ٢٠٢٦).
   ومنذ ٢٠ أكتوبر ٢٠٢٦ لا يعيد «أعد ما سحبته» ما سحبه رفعُ ملفٍّ أو هذا الزرّ — فلا تقول نصوصُها إنّه يعيده
   (`restorable` في `plan-edit.service.ts`). */
export const KEEP_LATEST_AR = {
  labelAr: 'احذف المكرر',
  whatAr: 'في الخطة بنود من ملفات أقدم لم يقرر فيها المدرب. «احذف المكرر» يبقي آخر ملف رفعته فقط، ويسحب الأقدم من صفحة المدرب. وما قرر فيه لا يمس.',
} as const

export function keepLatestPath(planId: string): string {
  return `/api/admin/cohort-plans/${planId}/edits/keep-latest`
}

/** «سحب 35 بندا من ملفات أقدم…» — بعد الزرّ على البطاقة */
export function keptLatestAr(withdrawn: number): string {
  return `سحب ${countAr(withdrawn, ITEM_FORMS)} من ملفات أقدم، وبقي آخر ملف رفعته.`
}

/* ═══ والكرّاساتُ المصحّحةُ تُختار مع ملفّات التعديلات (١٢ أكتوبر ٢٠٢٦، `workbook_replace`) ═══
   «We fix the PDF, he accepts» (صاحب المنصّة). وبندُ الكرّاسة يحمل اسمَ ملفّها لا مفتاحَه — فالملفُّ لم يُرفع بعد.
   فيُختار الـPDF مع ملفّ التعديلات دفعةً واحدة: يُرفع كلٌّ إلى خطّته (`/edit-files`)، ويُكتب مفتاحُه في بنده، ثمّ
   يُرفع الملفّ. وما سُمّي ولم يُختر يُقال باسمه ولا يُرفع الملفّ. */
export const isPdfName = (name: string): boolean => /\.pdf$/i.test(name.trim())

/* ═══ والاسمُ يُقابَل بصورته الواحدة (١٧ أكتوبر ٢٠٢٦) ═══
   رُدّ ملفُّ تعديلاتٍ بـ«الملفات … ليس بين ما اخترته» والملفّاتُ مختارةٌ معه: الحزمةُ فُكّت في جهاز
   ماك، فصارت الهمزةُ في «أمن» و«وتأمينها» حرفين (ا + ٔ) والاسمُ في الملفّ حرفٌ واحد — والعينُ لا
   ترى فرقا. فيُقابَل الاسمان بعد ردّهما إلى صورةٍ واحدة (NFC)، ويُرفع الملفُّ باسمه في البند. */
export const pdfKey = (name: string): string => name.normalize('NFC').trim()

/** ملفّاتُ PDF المختارة — مفهرسةً بصورة الاسم الواحدة */
export function pickedPdfs<F extends { name: string }>(picked: readonly F[]): Map<string, F> {
  return new Map(picked.filter((f) => isPdfName(f.name)).map((f) => [pdfKey(f.name), f]))
}

/* ومرفقُ المهمّة الجديدُ مثلُها (١٧ أكتوبر ٢٠٢٦، `task_attachment`): PDF يُختار مع الملفّ ويُرفع من الباب نفسِه */
const FILE_KINDS: readonly unknown[] = ['workbook_replace', 'task_attachment']

interface WorkbookItem { kind?: unknown; file?: { key?: unknown; name?: unknown } | null }
const itemsOf = (body: unknown): WorkbookItem[] =>
  Array.isArray((body as { items?: unknown } | null)?.items) ? (body as { items: WorkbookItem[] }).items : []

/** أسماءُ الكرّاسات التي يحملها الملفّ بلا مفتاح — تُختار معه بأسمائها */
export function workbookFilesNeeded(body: unknown): string[] {
  const names = itemsOf(body)
    .filter((x) => FILE_KINDS.includes(x.kind) && !x.file?.key && typeof x.file?.name === 'string')
    .map((x) => String(x.file!.name).trim())
  return [...new Set(names)]
}

/** الملفُّ نفسُه وفي بنود كرّاساته مفاتيحُها — ولا يمسّ الأصل */
export function withWorkbookKeys(body: unknown, keys: Readonly<Record<string, string>>): unknown {
  const b = body as Record<string, unknown>
  return {
    ...b,
    items: itemsOf(body).map((x) => {
      const name = typeof x.file?.name === 'string' ? x.file.name.trim() : ''
      return FILE_KINDS.includes(x.kind) && !x.file?.key && keys[name]
        ? { ...x, file: { ...x.file, key: keys[name], mime: 'application/pdf' } }
        : x
    }),
  }
}

export const editFilePath = (planId: string) => `/api/admin/cohort-plans/${planId}/edit-files`

/** «الملف «…» ليس بين ما اخترته» — لما سُمّي في الملفّ ولم يُختر معه: كرّاسةً كان أو مرفقَ مهمّة */
export function missingWorkbooksAr(names: readonly string[]): string {
  return `${names.length === 1 ? 'الملف' : 'الملفات'} ${names.map((n) => `«${n}»`).join('، ')} ليس بين ما اخترته — اختره مع ملف التعديلات`
}

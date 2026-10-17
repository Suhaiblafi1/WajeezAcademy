/* التعديلاتُ المقترحةُ على وجهيها (٨ أكتوبر ٢٠٢٦) — تُرفع على بطاقة المراجعة، ويقرّر
   المدرّبُ في كلٍّ منها في صفحة شعبته.

   ① البطاقةُ ترفع الملفّ، والتعديلاتُ تكفي سببا لـ«اطلب تعديلات».
   ② وصفحةُ المدرّب تعرضها في المتن لا في الرأس اللاصق، ولا تقبل وفي يده ما لم يُحفظ
      (التحميلُ بعد القبول يمحو ما كتب)، وتسأله قبل أن يُكتب فوق ما عدّله بيده.

   والفحصُ على الشيفرة بلا تعليقاتها: حارسٌ طابق جملةً في تعليقٍ مرّ أخضرَ لسببٍ خاطئ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('بطاقة المراجعة', () => {
  const src = code('src/components/admin/TrainerPlanReview.tsx')

  it('ترفع ملفّ التعديلات — ولمن يعتمد وحده', () => {
    expect(src).toMatch(/<PlanEditsUploader[\s\S]{0,200}canUpload=\{canApprovePlan\}/)
  })

  it('⚠️ والتعديلات المنتظرة هي «اطلب تعديلات» — بلا بطاقة تنتظر لا ردّ، ويقال لماذا', () => {
    expect(src).toMatch(/onPending=\{setEditsPending\}/)
    expect(src).toMatch(/disabled=\{busy \|\| editsPending === 0\}/)
    expect(src).toMatch(/editsPending === 0 && \(\s*<p[^>]*>\s*لا بطاقة تنتظر المدرّب بعد/)
    /* والعددُ بطاقاتٌ لا ملاحظات — كما يعدّها الخادم (`pendingEdits`) */
    expect(code('src/components/PlanEdits.tsx')).toMatch(/const pendingCards = items\.filter\(\(x\) => x\.status === "pending" && x\.kind !== "note"\)\.length;\s*useEffect\(\(\) => \{ onPending\?\.\(pendingCards\); \}/)
  })
})

describe('مراجعة الإدارة قبل المدرّب (١٠ أكتوبر ٢٠٢٦)', () => {
  const card = code('src/components/admin/TrainerPlanReview.tsx')
  const panel = code('src/components/PlanEdits.tsx')

  it('⚠️ زرّا المراجعة لمن يملك صلاحيّتها وحده', () => {
    expect(card).toMatch(/const canReviewEdits = viewer\?\.permissions\.includes\("cohort\.plan\.edits\.review"\)/)
    expect(card).toMatch(/<PlanEditsUploader[\s\S]{0,300}canReview=\{canReviewEdits\}/)
    expect(panel).toMatch(/\{canReview && \(\s*<div[\s\S]{0,700}\/api\/admin\/plan-edits\/\$\{x\.id\}\/approve/)
    expect(panel).toMatch(/\/api\/admin\/plan-edits\/\$\{x\.id\}\/drop/)
  })

  it('⚠️ والمسوّدة تعرض كاملة بما قبلها وما بعدها — يراجع ما سيراه المدرّب', () => {
    const at = panel.indexOf('const draftItem = (x: PlanEditItem) =>')
    expect(at).toBeGreaterThan(0)
    expect(panel.slice(at, at + 1200)).toContain('<Rows view={x.view} />')
  })

  it('⚠️ وكلّ مسوّدة في مجموعتها — المطلوب مفتوح والمقترح مطويّ إلّا وفيه جدول جهّزه المعتمد الآن، ولا تسقط واحدة (١١ أكتوبر ٢٠٢٦)', () => {
    expect(panel).toMatch(/\(\[\["required", "المطلوب"\], \["suggested", "المقترح"\]\] as const\)\.map\(\(\[kind, label\]\) => \{/)
    expect(panel).toMatch(/const list = drafts\.filter\(\(x\) => x\.required === \(kind === "required"\)\);/)
    expect(panel).toMatch(/open=\{kind === "required" \|\| list\.some\(\(x\) => x\.kind === "schedule"\)\}/)
    expect(panel).toMatch(/\{list\.map\(\(x\) => draftItem\(x\)\)\}/)
  })
})

describe('الرفع دفعة واحدة — «خطط تنتظر اعتمادك» (١٠ أكتوبر ٢٠٢٦)', () => {
  const page = code('src/pages/admin/PendingPlans.tsx')
  const panel = code('src/components/PlanEdits.tsx')
  const bulk = panel.slice(panel.indexOf('export function PlanEditsBulkUpload'), panel.indexOf('export function PlanEditsPanel'))

  it('⚠️ لمن يعتمد وحده — كالرفع في البطاقة', () => {
    expect(page).toMatch(/const canUploadEdits = viewer\?\.permissions\.includes\("cohort\.plan\.approve"\)/)
    expect(page).toMatch(/\{rows !== null && canUploadEdits && \(\s*<PlanEditsBulkUpload/)
  })

  it('⚠️ كلّ ملفّ إلى خطّته بمسلك البطاقة نفسه — فيفحص كما يفحص هناك', () => {
    expect(bulk).toMatch(/apiPost<[^>]*>\(bulkUploadPath\(read\.planId, mode\), body\)/)
    expect(bulk).toMatch(/const body = needed\.length \? withWorkbookKeys\(read\.body, keys\) : read\.body;/)
    expect(bulk).toMatch(/<input[\s\S]{0,80}type="file"\s*multiple/)
  })

  it('⚠️ وما ردّ منها لا يوقف ما بعده', () => {
    const loop = bulk.slice(bulk.indexOf('for (const [i, file] of files.entries())'))
    expect(loop.indexOf('try {')).toBeGreaterThan(0)
    expect(loop.indexOf('try {'), 'الاعتراض داخل الحلقة لا حولها').toBeLessThan(loop.indexOf('setProgress(null)'))
  })

  it('⚠️ وطريقة الرفع يختارها المعتمد ولا تفترض — «أضف» ما لم يختر غيرها، وكل طريقة إلى مسلكها', () => {
    expect(bulk).toMatch(/const \[mode, setMode\] = useState<BulkMode>\("add"\)/)
    expect(bulk).toMatch(/\{BULK_MODES\.map\(\(m\) => \([\s\S]{0,160}<input type="radio"[^>]*checked=\{mode === m\}/)
    expect(bulk).toMatch(/await apiPost<[^>]*>\(bulkUploadPath\(read\.planId, mode\), body\)/)
    expect(bulk, 'لا مسلك مكتوب في الشاشة يفترق عمّا تقوله').not.toMatch(/edits\/replace-/)
  })

  it('وبطاقة الخطّة المفتوحة تعاد بعد الرفع إليها — فترى بنودها', () => {
    expect(page).toMatch(/onUploaded=\{\(id\) => setUploaded/)
    expect(page).toMatch(/<TrainerPlanReview\s+cohortId=\{r\.cohort\.id\}\s+key=\{`\$\{r\.id\}:\$\{uploaded\[r\.id\] \?\? 0\}`\}/)
  })
})

describe('صفحة المدرّب', () => {
  const src = code('src/pages/trainer/CohortWorkspace.tsx')
  const panel = code('src/components/PlanEdits.tsx')

  it('⚠️ في المتن لا في الرأس اللاصق — قائمة قد تطول', () => {
    const at = src.indexOf('<PlanEditsPanel')
    expect(at).toBeGreaterThan(0)
    expect(at, 'بعد إغلاق الشريط اللاصق').toBeGreaterThan(src.indexOf('</Bar>'))
  })

  it('⚠️ ولا يقبل وفي يده ما لم يحفظ — ولا والخطّة بانتظار القرار', () => {
    expect(src).toMatch(/<PlanEditsPanel[\s\S]{0,300}unsaved=\{Object\.values\(dirty\)\.some\(Boolean\)\}/)
    expect(src).toMatch(/<PlanEditsPanel[\s\S]{0,300}inHand=\{planStatus === "draft" \|\| planStatus === "changes_requested"\}/)
    /* وعلى خطّته المعتمدة يقرّر — ما بقي اقتراحاتٌ تُكتب فيها مباشرة (١٧ أكتوبر ٢٠٢٦) */
    expect(panel).toMatch(/const blocked = !inHand && !approved \? [^:]+ : unsaved \? /)
    expect(panel).toMatch(/x\.status === "pending" && !blocked &&/)
  })

  it('⚠️ وما عدّله بيده لا يكتب فوقه إلّا بزرّ يقول ذلك', () => {
    expect(panel).toMatch(/accept`, x\.stale \? \{ force: true \} : \{\}\)/)
    expect(panel).toContain('{x.stale ? "اقبله فوق ما كتبت" : "اقبله"}')
  })

  it('وبعد ما يكتب في الخطّة تعاد الصفحة من المحفوظ', () => {
    expect(src).toMatch(/<PlanEditsPanel[\s\S]{0,300}onApplied=\{\(\) => load\(\)\}/)
  })

  it('والرابط في «قبل» و«بعد» يفتح في لسان جديد ليتحقّق منه', () => {
    expect(panel).toMatch(/<Cell label="بعد" text=\{r\.afterAr\} href=\{r\.afterHref\}/)
    expect(panel).toMatch(/: href\s*\?\s*<a href=\{href\} target="_blank" rel="noreferrer"/)
  })

  it('والزرّ يدلّ ولا يأمر — ويقول إنّ الرفض لا يمسّ شيئا', () => {
    expect(panel).toContain('وما ترفضه لا يمسّ شيئا')
    expect(panel).not.toMatch(/وقّع|عرضك/)
  })
})

describe('«احذف المكرر» — على البطاقة وللخطط كلها (١٢ أكتوبر ٢٠٢٦)', () => {
  const page = code('src/pages/admin/PendingPlans.tsx')
  const panel = code('src/components/PlanEdits.tsx')
  const card = panel.slice(panel.indexOf('export function PlanEditsUploader'), panel.indexOf('export function PlanEditsDedupeAll'))
  const all = panel.slice(panel.indexOf('export function PlanEditsDedupeAll'), panel.indexOf('export function PlanEditsBulkUpload'))

  it('⚠️ البطاقة تقرأ عدده مع «أعد ما سحبته» — ولا يظهر الزرّ إلّا وفيها مكرر', () => {
    expect(card).toMatch(/setWithdrawn\(w\.count\); setOlder\(w\.older \?\? 0\);/)
    expect(card).toMatch(/\{older > 0 && \(\s*<Button[^>]*onClick=\{\(\) => void keepLatest\(\)\}>\s*\{KEEP_LATEST_AR\.labelAr\} \(\{older\}\)/)
    expect(card).toMatch(/apiPost<[^>]*>\(keepLatestPath\(planId\), \{\}\)/)
  })

  it('⚠️ وما يقع به يقال تحت الأزرار حين يظهر', () => {
    expect(card).toMatch(/\{canUpload && older > 0 && <p[^>]*>\{KEEP_LATEST_AR\.whatAr\}<\/p>\}/)
  })

  it('⚠️ وللخطط كلها زرّ واحد لمن يعتمد — طلب واحد يمرّ فيه الخادم على كل خطة مفتوحة، لا على خطط هذه الصفحة', () => {
    expect(page).toMatch(/\{rows !== null && canUploadEdits && \(\s*<PlanEditsDedupeAll onCleaned=/)
    expect(page).not.toMatch(/<PlanEditsDedupeAll\s+plans=/)
    expect(all).toMatch(/await apiPost<[^>]*>\(KEEP_LATEST_ALL_PATH, \{\}\)/)
    expect(all).not.toMatch(/for \(const p of plans\)/)
  })

  it('⚠️ وما لا مكرر فيه يعدّ «بلا مكرر» — من عدد ما فحصه الخادم', () => {
    expect(all).toMatch(/dedupeSummaryAr\(\{ cleaned: r\.cleaned\.length, withdrawn: r\.withdrawn, clean: r\.checked - r\.cleaned\.length, failed: 0 \}\)/)
  })

  it('⚠️ وبطاقة ما نظف تعاد — فلا يبقى عددها القديم', () => {
    expect(page).toMatch(/<PlanEditsDedupeAll onCleaned=\{\(id\) => setUploaded\(/)
    expect(all).toMatch(/for \(const id of r\.cleaned\) onCleaned\(id\);/)
  })
})

describe('والكرّاسات المصحّحة تختار مع ملفات التعديلات (١٢ أكتوبر ٢٠٢٦، workbook_replace)', () => {
  const panel = code('src/components/PlanEdits.tsx')
  const bulk = panel.slice(panel.indexOf('export function PlanEditsBulkUpload'), panel.indexOf('export function PlanEditsPanel'))

  it('⚠️ الـPDF لا يرفع وحده ملف تعديلات — يفصل ويرفع مع بنده', () => {
    expect(bulk).toMatch(/const pdfs = new Map\(picked\.filter\(\(f\) => isPdfName\(f\.name\)\)/)
    expect(bulk).toMatch(/const files = picked\.filter\(\(f\) => !isPdfName\(f\.name\)\);/)
    expect(bulk).toMatch(/accept="application\/json,\.json,application\/pdf,\.pdf"/)
  })

  it('⚠️ وما سمّي ولم يختر يردّ الملف باسمه قبل أن يرفع شيء', () => {
    const at = (re: RegExp) => bulk.search(re)
    expect(at(/if \(missing\.length\) throw new Error\(missingWorkbooksAr\(missing\)\);/)).toBeGreaterThan(0)
    expect(at(/if \(missing\.length\)/)).toBeLessThan(at(/editFilePath\(read\.planId\)/))
  })

  it('⚠️ وكل كراسة ترفع إلى خطتها ثم يكتب مفتاحها في بندها', () => {
    expect(bulk).toMatch(/apiPost<[^>]*>\(\s*editFilePath\(read\.planId\), \{ mime: "application\/pdf", originalName: n \}\);\s*await putSigned\(up\.uploadUrl, pdf, up\.maxBytes\);\s*keys\[n\] = up\.storageKey;/)
  })
})

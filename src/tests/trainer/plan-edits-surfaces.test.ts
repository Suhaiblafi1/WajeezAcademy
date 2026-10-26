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

  /* وصار الرفعُ في «أدوات Claude» والحالُ في `usePlanEdits` (٢٦ أكتوبر ٢٠٢٦، المرحلة الخامسة) */
  it('ترفع ملفّ التعديلات — ولمن يعتمد وحده', () => {
    expect(src).toMatch(/const canUploadEdits = canApprovePlan && !!trainerPlan && !planApproved;/)
    expect(src).toMatch(/\{canUploadEdits && \(\s*<>\s*<input\s+ref=\{editsFile\}[\s\S]{0,400}void edits\.upload\(f\)/)
  })

  it('⚠️ والتعديلات المنتظرة هي «اطلب تعديلات» — بلا بطاقة تنتظر لا ردّ، ويقال لماذا', () => {
    expect(src).toMatch(/const editsPending = edits\.pendingCards;/)
    expect(src).toMatch(/disabled=\{busy \|\| editsPending === 0\}/)
    expect(src).toMatch(/editsPending === 0 && \(\s*<p[^>]*>\s*لا بطاقة تنتظر المدرّب بعد/)
    /* والعددُ بطاقاتٌ لا ملاحظات — كما يعدّها الخادم (`pendingEdits`) */
    expect(code('src/hooks/usePlanEdits.ts')).toMatch(/const pendingCards = items\.filter\(\(x\) => x\.status === "pending" && x\.kind !== "note"\)\.length;\s*return \{ items, drafts, pendingCards,/)
  })
})

describe('مراجعة الإدارة قبل المدرّب (١٠ أكتوبر ٢٠٢٦)', () => {
  const card = code('src/components/admin/TrainerPlanReview.tsx')
  const panel = code('src/components/PlanEdits.tsx')

  it('⚠️ زرّا المراجعة لمن يملك صلاحيّتها وحده', () => {
    expect(card).toMatch(/const canReviewEdits = viewer\?\.permissions\.includes\("cohort\.plan\.edits\.review"\)/)
    expect(card).toMatch(/<PlanEditsDrafts edits=\{edits\} planId=\{trainerPlan\.id\} canReview=\{canReviewEdits && !planApproved\} \/>/)
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

/* ودفعةً واحدة (١٠ أكتوبر ٢٠٢٦) — وصار صندوقا واحدا لما رجع كلِّه بقول صاحب المنصّة «فقط تحميل ورفع» (٢٦ أكتوبر):
   بالرفع العاديّ وحدَه، بلا طرقٍ ثلاث. وما يخصّ الصندوقَ نفسَه في \`review-upload.test.ts\`. */
describe('الرفع دفعة واحدة — «خطط تنتظر اعتمادك»', () => {
  const page = code('src/pages/admin/PendingPlans.tsx')
  const box = code('src/components/admin/ReviewUpload.tsx')

  it('⚠️ لمن يعتمد وحده — كالرفع في البطاقة', () => {
    expect(page).toMatch(/const canUploadEdits = viewer\?\.permissions\.includes\("cohort\.plan\.approve"\)/)
    expect(page).toMatch(/\{rows !== null && canUploadEdits && \(\s*<ReviewUpload/)
  })

  it('⚠️ كلّ ملفّ إلى خطّته بمسلك البطاقة نفسه — فيفحص كما يفحص هناك', () => {
    expect(box).toMatch(/await apiPost<PlanEditsUploadCounts>\(\s*`\/api\/admin\/cohort-plans\/\$\{read\.planId\}\/edits`, needed\.length \? withWorkbookKeys\(read\.body, keys\) : read\.body\);/)
    expect(code('src/hooks/usePlanEdits.ts'), 'البطاقة لا ترفع إلى المسلك نفسه').toContain('`/api/admin/cohort-plans/${planId}/edits`, body)')
    expect(box).toMatch(/<input[\s\S]{0,80}type="file"\s*multiple/)
  })

  it('⚠️ وما ردّ منها لا يوقف ما بعده', () => {
    const loop = box.slice(box.indexOf('for (const [i, { file, read }] of reads.entries())'))
    expect(loop.indexOf('try {')).toBeGreaterThan(0)
    expect(loop.indexOf('try {'), 'الاعتراض داخل الحلقة لا حولها').toBeLessThan(loop.indexOf('setProgress(null)'))
  })

  it('⚠️ والرفع العادي وحده — لا طريقة تستبدل ولا تسحب', () => {
    expect(box, 'عادت طرق الرفع').not.toMatch(/edits\/replace-|type="radio"|BulkMode/)
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

/* ═══ الرفعُ يتجاهل المكرّر — فلا «احذف المكرر» ولا «أعد ما سحبته» (٢٦ أكتوبر ٢٠٢٦) ═══
   بُنيا لما تكرّر حين كانت إعادةُ الملفّ تُردّ أو تُرفع فوق ما قبلها (١٢ أكتوبر). وصار الرفعُ يتجاهل البطاقةَ نفسَها
   ويضع الأحدثَ مكانَ ما لم يُقرَّر فيه (`upload` في `plan-edit.service.ts`) — والخادمُ يحرسه `server/tests/plan/plan-edits.test.ts`. */
describe('الرفع يتجاهل المكرّر — والبطاقة بلا أدوات التنظيف', () => {
  const page = code('src/pages/admin/PendingPlans.tsx')
  const panel = code('src/components/PlanEdits.tsx')
  /* والبطاقةُ حالُها في خطّافها ولسانُها في `PlanEdits.tsx` (٢٦ أكتوبر ٢٠٢٦) */
  const card = code('src/hooks/usePlanEdits.ts') + panel.slice(panel.indexOf('export function PlanEditsDrafts'), panel.indexOf('export function PlanEditsPanel'))
  const box = code('src/components/admin/ReviewUpload.tsx')

  it('⚠️ لا «احذف المكرر» ولا «أعد ما سحبته» في البطاقة — ولا ما يقرأ عددهما', () => {
    expect(card.length, 'لم تقرأ البطاقة').toBeGreaterThan(1000)
    expect(card).not.toMatch(/keepLatest|keep-latest|edits\/restore|plan-edits\/withdrawn|احذف المكرر|أعد ما سحبته/)
  })

  it('⚠️ والبطاقة تقول ما وقع بالرفع من عدّ الخادم — لا من عدّ الملفّ', () => {
    expect(card).toMatch(/const r = await apiPost<\{ edits: PlanEditItem\[\] \} & PlanEditsUploadCounts>\(`\/api\/admin\/cohort-plans\/\$\{planId\}\/edits`, body\);\s*setItems\(r\.edits\);\s*setMsg\(`«\$\{file\.name\}»: \$\{uploadedLineAr\(r\)\}`\);/)
  })

  it('⚠️ و«اسحب ما لم يقرّر» باق — ويقول كيف يعود ما سحب', () => {
    expect(card).toMatch(/setItems\(await apiDelete<PlanEditItem\[\]>\(`\/api\/admin\/cohort-plans\/\$\{planId\}\/edits`\)\);\s*setMsg\("سحب ما لم يقرّر فيه\. ولتعيده ارفع ملفه من جديد\."\);/)
  })

  it('⚠️ وصندوق الرفع: ملف كله مرفوع من قبل «مرفوع» لا «رفع» — والسطر من عدّ الخادم', () => {
    expect(box).toMatch(/const r = await apiPost<PlanEditsUploadCounts>\(/)
    expect(box).toMatch(/state: r\.added > 0 \? "done" : "already", noteAr: uploadedLineAr\(r\)/)
    expect(box).not.toMatch(/uploadedLineAr\(read\./)
  })

  /* وكان للخطط كلِّها زرٌّ في «خطط تنتظر اعتمادك» — وذهب بقول صاحب المنصّة «فقط تحميل ورفع» (٢٦ أكتوبر ٢٠٢٦) */
  it('⚠️ ولا زرّ للخطط كلها في الصفحة', () => {
    expect(page).not.toMatch(/DedupeAll|keep-latest-all|KEEP_LATEST_ALL/)
    expect(panel).not.toMatch(/export function PlanEditsDedupeAll/)
  })
})

describe('والكرّاسات المصحّحة تختار مع ملفات التعديلات (١٢ أكتوبر ٢٠٢٦، workbook_replace)', () => {
  /* وصارت في صندوق الرفع الواحد (٢٦ أكتوبر ٢٠٢٦) — والفصلُ بينها وبين التقارير في \`review-upload.test.ts\` */
  const box = code('src/components/admin/ReviewUpload.tsx')

  it('⚠️ الـPDF لا يرفع وحده ملف تعديلات — يفصل ويرفع مع بنده', () => {
    expect(box).toMatch(/const \{ workbooks, reports \} = splitReviewFiles\(/)
    expect(box).toMatch(/const pdfs = pickedPdfs\(workbooks\);/)
  })

  it('⚠️ وما سمّي ولم يختر يردّ الملف باسمه قبل أن يرفع شيء', () => {
    const at = (re: RegExp) => box.search(re)
    expect(at(/if \(missing\.length\) throw new Error\(missingWorkbooksAr\(missing\)\);/)).toBeGreaterThan(0)
    expect(at(/if \(missing\.length\)/)).toBeLessThan(at(/editFilePath\(read\.planId\)/))
  })

  it('⚠️ وكل كراسة ترفع إلى خطتها ثم يكتب مفتاحها في بندها', () => {
    expect(box).toMatch(/apiPost<[^>]*>\(\s*editFilePath\(read\.planId\), \{ mime: "application\/pdf", originalName: n \}\);\s*await putSigned\(up\.uploadUrl, pdfs\.get\(pdfKey\(n\)\)!, up\.maxBytes\);\s*keys\[n\] = up\.storageKey;/)
  })
})

/* ═══ «اقبلها كلّها» وبعضُها بقي — والصفحةُ تُعاد على ما قُبل (٢٠ أكتوبر ٢٠٢٦) ═══
   كان ما بقي يرمي قبل إعادة التحميل، فتبقى الصفحةُ على ما قبل القبول ويكتب حفظُها التلقائيُّ القديمَ
   فوق ما قُبل. ورُئي ساقطا: أُعيد الرميُ بلا `onApplied` فسقط. */
describe('اقبلها كلّها وبقي بعضها', () => {
  it('⚠️ ما قبل منها يعيد الصفحة قبل أن يقال ما بقي', () => {
    expect(code('src/components/PlanEdits.tsx'))
      .toMatch(/if \(r\.skipped\.length\) \{\s*if \(r\.accepted > 0\) await onApplied\(\);\s*throw new Error\(/)
  })
})

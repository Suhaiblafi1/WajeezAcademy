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

describe('بطاقةُ المراجعة', () => {
  const src = code('src/components/admin/TrainerPlanReview.tsx')

  it('ترفع ملفَّ التعديلات — ولمن يعتمد وحدَه', () => {
    expect(src).toMatch(/<PlanEditsUploader[\s\S]{0,200}canUpload=\{canApprovePlan\}/)
  })

  it('⚠️ والتعديلاتُ المنتظِرةُ تكفي سببا لـ«اطلب تعديلات»', () => {
    expect(src).toMatch(/onPending=\{setEditsPending\}/)
    expect(src).toMatch(/<ReviewNotesForm[\s\S]{0,200}editsPending=\{editsPending\}/)
    expect(code('src/components/ReviewNotes.tsx')).toMatch(/const ready = hasReviewNotes\(clean\) \|\| editsPending > 0/)
  })
})

describe('مراجعةُ الإدارة قبل المدرّب (١٠ أكتوبر ٢٠٢٦)', () => {
  const card = code('src/components/admin/TrainerPlanReview.tsx')
  const panel = code('src/components/PlanEdits.tsx')

  it('⚠️ زرّا المراجعة لمن يملك صلاحيّتَها وحدَه', () => {
    expect(card).toMatch(/const canReviewEdits = viewer\?\.permissions\.includes\("cohort\.plan\.edits\.review"\)/)
    expect(card).toMatch(/<PlanEditsUploader[\s\S]{0,300}canReview=\{canReviewEdits\}/)
    expect(panel).toMatch(/\{canReview && \(\s*<div[\s\S]{0,700}\/api\/admin\/plan-edits\/\$\{x\.id\}\/approve/)
    expect(panel).toMatch(/\/api\/admin\/plan-edits\/\$\{x\.id\}\/drop/)
  })

  it('⚠️ والمسوّدةُ تُعرض كاملةً بما قبلها وما بعدها — يراجع ما سيراه المدرّب', () => {
    const at = panel.indexOf('drafts.map((x) =>')
    expect(at).toBeGreaterThan(0)
    expect(panel.slice(at, at + 1200)).toContain('<Rows view={x.view} />')
  })
})

describe('الرفعُ دفعةً واحدة — «خططٌ تنتظر اعتمادك» (١٠ أكتوبر ٢٠٢٦)', () => {
  const page = code('src/pages/admin/PendingPlans.tsx')
  const panel = code('src/components/PlanEdits.tsx')
  const bulk = panel.slice(panel.indexOf('export function PlanEditsBulkUpload'), panel.indexOf('export function PlanEditsPanel'))

  it('⚠️ لمن يعتمد وحدَه — كالرفع في البطاقة', () => {
    expect(page).toMatch(/const canUploadEdits = viewer\?\.permissions\.includes\("cohort\.plan\.approve"\)/)
    expect(page).toMatch(/\{rows !== null && canUploadEdits && \(\s*<PlanEditsBulkUpload/)
  })

  it('⚠️ كلُّ ملفٍّ إلى خطّته بمسلك البطاقة نفسِه — فيُفحص كما يُفحص هناك', () => {
    expect(bulk).toMatch(/apiPost<PlanEditItem\[\]>\(`\/api\/admin\/cohort-plans\/\$\{read\.planId\}\/edits`, read\.body\)/)
    expect(bulk).toMatch(/<input[\s\S]{0,80}type="file"\s*multiple/)
  })

  it('⚠️ وما رُدّ منها لا يوقف ما بعده', () => {
    const loop = bulk.slice(bulk.indexOf('for (const [i, file] of files.entries())'))
    expect(loop.indexOf('try {')).toBeGreaterThan(0)
    expect(loop.indexOf('try {'), 'الاعتراضُ داخل الحلقة لا حولها').toBeLessThan(loop.indexOf('setProgress(null)'))
  })

  it('وبطاقةُ الخطّة المفتوحة تُعاد بعد الرفع إليها — فتُرى بنودُها', () => {
    expect(page).toMatch(/onUploaded=\{\(id\) => setUploaded/)
    expect(page).toMatch(/<TrainerPlanReview\s+cohortId=\{r\.cohort\.id\}\s+key=\{`\$\{r\.id\}:\$\{uploaded\[r\.id\] \?\? 0\}`\}/)
  })
})

describe('صفحةُ المدرّب', () => {
  const src = code('src/pages/trainer/CohortWorkspace.tsx')
  const panel = code('src/components/PlanEdits.tsx')

  it('⚠️ في المتن لا في الرأس اللاصق — قائمةٌ قد تطول', () => {
    const at = src.indexOf('<PlanEditsPanel')
    expect(at).toBeGreaterThan(0)
    expect(at, 'بعد إغلاق الشريط اللاصق').toBeGreaterThan(src.indexOf('</Bar>'))
  })

  it('⚠️ ولا يُقبل وفي يده ما لم يُحفظ — ولا والخطّةُ بانتظار القرار', () => {
    expect(src).toMatch(/<PlanEditsPanel[\s\S]{0,300}unsaved=\{Object\.values\(dirty\)\.some\(Boolean\)\}/)
    expect(src).toMatch(/<PlanEditsPanel[\s\S]{0,300}inHand=\{planStatus === "draft" \|\| planStatus === "changes_requested"\}/)
    expect(panel).toMatch(/const blocked = !inHand \? [^:]+ : unsaved \? /)
    expect(panel).toMatch(/x\.status === "pending" && !blocked &&/)
  })

  it('⚠️ وما عدّله بيده لا يُكتب فوقه إلّا بزرٍّ يقول ذلك', () => {
    expect(panel).toMatch(/accept`, x\.stale \? \{ force: true \} : \{\}\)/)
    expect(panel).toContain('{x.stale ? "اقبله فوق ما كتبتُ" : "اقبله"}')
  })

  it('وبعد ما يُكتب في الخطّة تُعاد الصفحةُ من المحفوظ', () => {
    expect(src).toMatch(/<PlanEditsPanel[\s\S]{0,300}onApplied=\{\(\) => load\(\)\}/)
  })

  it('والرابطُ في «قبل» و«بعد» يُفتح في لسانٍ جديد ليتحقّق منه', () => {
    expect(panel).toMatch(/<Cell label="بعد" text=\{r\.afterAr\} href=\{r\.afterHref\}/)
    expect(panel).toMatch(/: href\s*\?\s*<a href=\{href\} target="_blank" rel="noreferrer"/)
  })

  it('والزرُّ يدلّ ولا يأمر — ويقول إنّ الرفضَ لا يمسّ شيئا', () => {
    expect(panel).toContain('وما ترفضه لا يمسّ شيئا')
    expect(panel).not.toMatch(/وقّع|عرضك/)
  })
})

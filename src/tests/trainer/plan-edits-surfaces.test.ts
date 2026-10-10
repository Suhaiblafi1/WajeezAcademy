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

  it('والزرُّ يدلّ ولا يأمر — ويقول إنّ الرفضَ لا يمسّ شيئا', () => {
    expect(panel).toContain('وما ترفضه لا يمسّ شيئا')
    expect(panel).not.toMatch(/وقّع|عرضك/)
  })
})

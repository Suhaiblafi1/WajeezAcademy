/* زرُّ «احذفها» في صندوق «شعب تحتاج فصلا منك» — بنيةٌ لا نصّ.

   قرارُ صاحب المنصّة (٢٠ أكتوبر ٢٠٢٦): «لماذا ما زالت هنا! احذفها». فيُفحص أنّ الزرَّ لما لا مدرّبَ
   له وحدَه، وبضغطتين، وأنّ «احذف الكلّ» يحمل ما لا مدرّبَ له وحدَه، وأنّ المسارَ خلف إدارة الشعب.
   وما يُحذف وما يبقى يحرسه `server/tests/learning/delete-trainerless-button.test.ts`. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const page = code('src/pages/admin/Terms.tsx')
const routes = code('server/http/routes/admin-learning.routes.ts')
const cohortsPage = code('src/pages/admin/AdminCohorts.tsx')

describe('زرّ «احذفها»', () => {
  it('⚠️ لما لا مدرّب له وحده — وبضغطتين', () => {
    expect(page, 'الزرّ لكلّ شعبة لا لما بلا مدرّب').toMatch(/\{c\.trainers\.length === 0 && \(\s*confirmCohortDelete === c\.id/)
    expect(page).toContain('void deleteTrainerless([c.id], `del-${c.id}`)')
  })

  it('⚠️ و«احذف الكلّ» يحمل ما لا مدرّب له وحده', () => {
    expect(page).toMatch(/filter\(\(c\) => c\.kind === "needs" && c\.trainers\.length === 0\)\.map\(\(c\) => c\.id\)/)
    expect(page).toContain('void deleteTrainerless(orphan, "del-all")')
  })

  it('والمسار خلف إدارة الشعب', () => {
    const at = routes.indexOf("'/api/admin/cohorts/delete-trainerless'")
    expect(at, 'لا مسار').toBeGreaterThan(-1)
    expect(routes.slice(at, at + 200)).toContain("requirePermission('cohort.manage')")
    expect(page).toContain('"/api/admin/cohorts/delete-trainerless"')
  })
})

/* ═══ و«احذفها» للملغاة في «تشغيل الشعب» — صندوقٌ بخيارين (٢٢ أكتوبر ٢٠٢٦) ═══
   «اجعل خيارَ الحذف واضحا جدّا» (صاحب المنصّة). وكان الزرُّ للملغاة التي لا مدرّبَ لها وحدَها، والملغاةُ لقلّة
   التسجيل لها مدرّبٌ دائما — فلا باب. وما يُحذف وما لا يحرسه `server/tests/learning/delete-cancelled.test.ts`. */
describe('و«احذفها» للملغاة في «تشغيل الشعب» — «هل هناك خاصّيّة حذفٍ غير الإلغاء؟»', () => {
  const box = code('src/components/admin/DeleteCancelledBox.tsx')

  it('⚠️ للملغاة كلها — لا لما بلا مدرب وحده', () => {
    expect(cohortsPage).toMatch(/\{c\.status === "cancelled" && \(\s*<DeleteCancelledBox cohortId=\{c\.id\}/)
    expect(cohortsPage, 'عاد الشرط على المدرب').not.toMatch(/c\.status === "cancelled" && c\.trainers\.length === 0/)
  })

  it('⚠️ وبضغطتين — والثانية تقول ما يحذف معها', () => {
    const remove = box.slice(box.indexOf('const remove'), box.indexOf('return (', box.indexOf('const remove')))
    expect(remove).toContain('apiPost(`/api/admin/cohorts/${cohortId}/delete-cancelled`, { withTrainerPlan: hasTrainer })')
    expect(box).toMatch(/confirming \? \([\s\S]*?onClick=\{\(\) => void remove\(\)\}[\s\S]*?: \(\s*<Button tone="danger" icon=\{Trash2\} onClick=\{\(\) => setConfirming\(true\)\}>/)
  })

  it('والخياران معروضان معا — وما يمنع الحذف يقال بدل الزر', () => {
    expect(box).toContain('أبقها ملغاة')
    expect(box).toContain('احذفها نهائيا')
    expect(box).toMatch(/!p\.canDelete \? \(\s*<p[^>]*>\{p\.blockedAr\}/)
  })
})

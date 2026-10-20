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

/* ═══ علامةُ الموادّ على كلّ دورةٍ في «جهّز شعب التعبئة» (١٨ أكتوبر ٢٠٢٦) ═══
 *
 * سأل صاحبُ المنصّة: «أصحيحٌ أنّ هذه الدورات معتمَدةٌ وموادَّها جاهزة؟» — والاعتمادُ يقينٌ فيها
 * والموادُّ لا. فاختار: «علِّمْ كلَّ دورة». والعلامةُ من صفّ التأهيل: كاملةٌ أو ناقصةٌ أو لا شيء.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MATERIALS_MARK_AR, materialsMarkOf } from '@/application/trainer/course-materials'

const FULL = {
  modules: [{ titleAr: 'محورٌ مكتوب', outcomeAr: 'مخرجُه' }],
  materialsUrl: 'https://example.com/m', taskAr: 'مشروعٌ يسلّمه', sourcesAr: 'كتابٌ', noteAr: '',
}

describe('العلامةُ تقول ما في صفّ التأهيل', () => {
  it('كاملةٌ وناقصةٌ ولا شيء', () => {
    expect(materialsMarkOf(FULL)).toBe('complete')
    expect(materialsMarkOf({ ...FULL, taskAr: '' })).toBe('partial')
    expect(materialsMarkOf({ modules: [{ titleAr: 'محورٌ وحدَه', outcomeAr: '' }] })).toBe('partial')
    expect(materialsMarkOf(null)).toBe('none')
    expect(materialsMarkOf({})).toBe('none')
    expect(materialsMarkOf({ modules: [{ titleAr: '', outcomeAr: 'مخرجٌ بلا محور' }], noteAr: 'ملحوظةٌ وحدَها' })).toBe('none')
  })

  it('ونصوصُها قصيرةٌ بلا تشكيل', () => {
    expect(MATERIALS_MARK_AR).toEqual({ complete: 'موادّ معتمدة', partial: 'موادّ ناقصة', none: 'بلا موادّ' })
  })
})

describe('والعلامةُ بجانب كلّ دورةٍ في البطاقة', () => {
  const SCREEN = readFileSync(resolve(__dirname, '../../pages/admin/TrainerContracts.tsx'), 'utf8')
  const start = SCREEN.indexOf('{prep.map((p) => (')
  const row = SCREEN.slice(start, SCREEN.indexOf('</ul>', SCREEN.indexOf('{p.courses.map((c) =>', start)))

  it('بعد اسم الدورة في صفّها', () => {
    expect(start).toBeGreaterThan(0)
    const title = row.indexOf('{c.titleAr}')
    const mark = row.search(/\{MATERIALS_MARK_AR\[c\.materials\]\}/)
    expect(title).toBeGreaterThan(0)
    expect(mark, 'العلامةُ ليست في صفّ الدورة').toBeGreaterThan(title)
  })
})

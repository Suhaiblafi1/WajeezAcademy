/* صفحةُ المدرّبين: «سيقدم فلان في موسم كذا» — بنيةٌ لا نصّ (١٩ أكتوبر ٢٠٢٦).

   «لماذا تظهر كلُّ الدورات للمدرّب وليس للموسم القادم؟» (صاحب المنصّة). فالبطاقةُ تقرأ `offer` بمواسمه من
   الخادم، ولكلّ موسمٍ رأسُه باسم المدرّب. والتعليقاتُ تُنزع قبل الفحص. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(process.cwd(), 'src/pages/Trainers.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('صفحة المدربين — الموسم القادم', () => {
  it('البطاقة تقرأ ما يقدمه بمواسمه', () => {
    expect(page).toMatch(/<TrainerOffer name=\{t\.name\} groups=\{t\.offer/)
  })

  it('ولكل موسم رأسه باسم المدرب — لا «دوراته» عامة', () => {
    expect(page).toMatch(/seasons\.map\(\(g\) =>[\s\S]*?seasonHeadingAr\(name, g\.termAr\)/)
    expect(page, 'عاد رأس «دوراته» العام').not.toContain('دوراته — تشترى من صفحتها')
  })
})

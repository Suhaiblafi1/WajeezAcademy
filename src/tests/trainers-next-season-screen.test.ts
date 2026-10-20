/* صفحةُ المدرّبين: دوراتُه بمواسمها، والرأسُ اسمُ الموسم وحدَه — بنيةٌ لا نصّ (١٩–٢٠ أكتوبر ٢٠٢٦).

   «لماذا تظهر كلُّ الدورات للمدرّب وليس للموسم القادم؟» (صاحب المنصّة). فالبطاقةُ تقرأ `offer` بمواسمه من
   الخادم، ولكلّ موسمٍ رأسُه باسم المدرّب. والتعليقاتُ تُنزع قبل الفحص. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(process.cwd(), 'src/pages/Trainers.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('صفحة المدربين — الموسم القادم', () => {
  it('البطاقة تقرأ ما يقدمه بمواسمه', () => {
    expect(page).toMatch(/<TrainerOffer groups=\{t\.offer/)
  })

  it('ولكل موسم رأسه — اسم الموسم، لا «دوراته» عامة', () => {
    expect(page).toMatch(/seasons\.map\(\(g, i\) =>[\s\S]*?seasonHeadingAr\(g\.termAr\)/)
    expect(page, 'عاد رأس «دوراته» العام').not.toContain('دوراته — تشترى من صفحتها')
  })

  /* ═══ «الكلام مكتظ» — الأقربُ مفتوحٌ وما بعده يُطوى، وخطٌّ أصغرُ وأخفّ (١٩ أكتوبر ٢٠٢٦) ═══

     «يجب أن تنسدل دورات الفصول الأخرى، واترك مسافات، وخفّف حجم الخط واجعله لايت» (صاحب المنصّة).
     رُئي ساقطا على البطاقة القديمة: المواسمُ كلُّها مفتوحة، والأسماءُ ١٤ بخطٍّ عريض. */
  it('⚠️ الموسم الأقرب مفتوح، وما بعده مطوي برأسه وعدد دوراته', () => {
    const block = page.slice(page.indexOf('seasons.map((g, i) =>'))
    expect(block, 'المواسم كلها مفتوحة').toMatch(/return i === 0 \? \(\s*<div[\s\S]*?\) : \(\s*<details/)
    expect(block, 'المطوي بلا رأسه').toMatch(/<summary[\s\S]*?seasonHeadingAr\(g\.termAr\)[\s\S]*?coursesCountAr\(g\.courses\.length\)[\s\S]*?<\/summary>/)
  })

  it('⚠️ وأسماء الدورات أصغر وأخف — لا ١٤ عريضة', () => {
    const row = page.match(/<span className="([^"]*)">\{c\.name\}<\/span>/)
    expect(row, 'سطر اسم الدورة غاب').not.toBeNull()
    expect(row![1].split(/\s+/)).toEqual(expect.arrayContaining(['text-fine', 'font-light']))
    expect(row![1], 'عاد الخط العريض').not.toMatch(/font-(bold|semibold)|text-read/)
  })
})

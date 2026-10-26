/* صفحةُ الدورة ولوحُ الشراء — ثلاثةُ طلباتٍ لصاحب المنصّة (٢٦ أكتوبر ٢٠٢٦).

   ① «ابنِ مسارك بنفسك» يقترح ما له شعبةٌ وحدَه، وأربعا: «لا تقترح له دوراتٍ ليس لديها شعب، وقلّل الاقتراحات
      إلى أربع». رُئي ساقطا على `suggestNext(picked, 8)`.
   ② و«ما يرافق الدورة» سطرٌ واحدٌ بأربع نقاط لا صندوقٌ ببطاقات: «اجعله بنقاطٍ في سطرٍ واحد.. أقلّ أهميّة وأصغر».
   ③ و«كلّ ما في هذا الطلب لك بالفعل» معه زرٌّ إلى «تعلّمي»: «لماذا لا يوجد هنا زرّ يأخذه إلى تعلّمي مباشرة؟».
   والشيفرةُ تُقرأ بلا تعليقاتها. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { suggestBuyable, suggestNext, BUYABLE_SUGGESTIONS } from '@/application/catalog/course-path'
import { courses } from '@/data/courses'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

describe('① الاقتراح يشترى', () => {
  const anchor = courses[0]!.id
  const all = suggestNext([anchor], Number.MAX_SAFE_INTEGER)

  it('⚠️ ما لا شعبة له لا يقترح — والترتيب هو هو', () => {
    const open = new Set(all.filter((_, i) => i % 3 === 0).map((s) => s.courseId))
    const out = suggestBuyable([anchor], (id) => open.has(id))
    expect(out.every((s) => open.has(s.courseId)), 'اقترحت دورة بلا شعبة').toBe(true)
    expect(out.map((s) => s.courseId)).toEqual(all.filter((s) => open.has(s.courseId)).slice(0, BUYABLE_SUGGESTIONS).map((s) => s.courseId))
  })

  it('⚠️ وأربع لا أكثر، ولا شيء حين لا شعبة', () => {
    expect(BUYABLE_SUGGESTIONS).toBe(4)
    expect(suggestBuyable([anchor], () => true)).toHaveLength(Math.min(4, all.length))
    expect(suggestBuyable([anchor], () => false)).toEqual([])
  })

  it('⚠️ والصفحة تقرأ الشعب في الاقتراح', () => {
    expect(code('src/pages/CoursePath.tsx')).toMatch(/suggestBuyable\(picked, \(id\) => \(cohorts\.get\(id\)\?\.length \?\? 0\) > 0\)/)
  })
})

describe('② ما يرافق الدورة سطر واحد', () => {
  it('⚠️ قائمة نقاط في شريط رقيق — لا بطاقة ولا شرح تحت كل نقطة', () => {
    const page = code('src/pages/CoursePath.tsx')
    expect(page).toMatch(/<Inset as="ul" aria-label="ما يرافق الدورة" className="[^"]*flex flex-wrap[^"]*">/)
    const block = page.slice(page.indexOf('aria-label="ما يرافق الدورة"'), page.indexOf('</Inset>', page.indexOf('aria-label="ما يرافق الدورة"')))
    expect(block).toContain('text-fine')
    expect(block, 'عاد الشرح تحت كل نقطة').not.toMatch(/b\.d\b/)
    expect(page, 'عاد صندوق العنوان').not.toMatch(/<Sparkles[^>]*\/> ما يرافق الدورة/)
  })
})

describe('③ زر إلى «تعلمي»', () => {
  it('⚠️ حين لا شيء يشترى: رابط إلى /student/learning في الصندوق نفسه', () => {
    const buy = code('src/components/BuyPanel.tsx')
    const box = buy.slice(buy.indexOf('{nothingLeft && ('), buy.indexOf('{nothingLeft && (') + 700)
    expect(box).toMatch(/<Button as=\{Link\} to="\/student\/learning"/)
  })
})

describe('④ مشتري المسار: ثلاثة مقترحات', () => {
  it('⚠️ ثلاث لا أكثر', async () => {
    const { PATHWAY_EXTRA_OPTIONS } = await import('@/application/catalog/course-path')
    expect(PATHWAY_EXTRA_OPTIONS).toBe(3)
  })
})

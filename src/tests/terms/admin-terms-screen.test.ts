/* شاشةُ المواسم — الخطواتُ الأربعُ في موضعٍ واحد.

   نظامُ الفصول كان كاملا في الخادم بلا شاشةٍ تناديه، فبقي التقويمُ العامّ
   فارغا وسأل صاحبُ المنصّة إن كان «يمتلئ بكلّ دورةٍ نُشرت». الشاشةُ تمشي
   الخطواتِ الأربع (إنشاءٌ · نافذةُ تسجيل · توزيعٌ بمعاينةٍ ثمّ تطبيق · نشر)،
   والذهبيُّ الواحدُ للنشر. وبطاقةُ الدورة في الكتالوج تقول متى تبدأ أقربُ
   شعبةٍ مفتوحة. (٨ سبتمبر ٢٠٢٦) */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('شاشةُ المواسم', () => {
  const screen = code('src/pages/admin/Terms.tsx')

  it('لها مسارٌ وبندٌ في القائمة محروسٌ بصلاحيّة الشعب', () => {
    expect(code('src/App.tsx')).toMatch(/path="\/admin\/terms" element=\{<AdminTerms \/>\}/)
    const row = code('src/pages/admin/AdminLayout.tsx').split('\n').find((l) => l.includes('/admin/terms'))
    expect(row, 'لا بندَ في القائمة').toBeTruthy()
    expect(row).toContain('cohort.manage')
  })

  it('تنادي الخطواتِ الأربع من مسارات الخادم القائمة — لا مسارَ جديد', () => {
    for (const path of [
      '/api/admin/terms?all=true', '"/api/admin/terms"',
      '/api/admin/terms/${t.id}/registration-window',
      '/api/admin/terms/${t.id}/plan', '/api/admin/terms/${t.id}/publish-calendar',
      '/api/admin/terms/${t.id}/available-trainers',
    ]) expect(screen, `لا تنادي: ${path}`).toContain(path)
  })

  it('والتوزيعُ معاينةٌ أوّلا وتطبيقٌ بطلبٍ صريح — والتواريخُ لا تُكتب باليد', () => {
    expect(screen).toContain('{ apply: false }')
    expect(screen).toContain('{ apply: true }')
    expect(screen, 'حقلُ تاريخٍ للموسم — الحدودُ تُحسب من الموسم').not.toMatch(/<input[^>]*(startsOn|endsOn)/)
    expect(screen).toMatch(/season: form\.season/)
  })

  it('والذهبيُّ الواحدُ للنشر', () => {
    const golds = screen.match(/tone="primary"/g) ?? []
    expect(golds).toHaveLength(1)
    expect(screen.slice(screen.indexOf('tone="primary"'), screen.indexOf('tone="primary"') + 200)).toContain('انشر التقويم')
  })
})

describe('بطاقةُ الدورة تقول متى تبدأ', () => {
  it('الكتالوجُ يقرأ الشعبَ المفتوحة ويعرض أقربَها على البطاقة', () => {
    const catalog = code('src/pages/Catalog.tsx')
    expect(catalog).toMatch(/useCourseCohorts\(\)/)
    expect(catalog).toContain('شعبةٌ مفتوحة · تبدأ')
  })
})

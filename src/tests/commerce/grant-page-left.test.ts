/* صفحةُ المنحة: من اشترى بكوده قبلُ يختار ما بقي له، لا الحدَّ كلَّه (٣١ أكتوبر ٢٠٢٦).

   كانت الصفحةُ تعرض حدَّ الحملة لمن عاد بعد شرائه: يختار أربعا وقد بقيت له اثنتان، فيرى سعرَ المنحة، ثمّ يردّ الخادمُ
   الكودَ (`grant_max_courses`) فيُسعَّر بلا منحة. فالحدُّ ما بقي على كوده من حسابه — والفحصُ على البنية بلا تعليقات. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const page = readFileSync(join(root, 'src/pages/MemberGrantPage.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
  .replace(/^\s*\/\/.*$/gm, '')
const myGrant = readFileSync(join(root, 'src/services/my-grant.ts'), 'utf8')

describe('صفحة المنحة · الحد ما بقي على الكود', () => {
  it('⚠️ الحد أصغر الاثنين: حد الحملة وما بقي على كوده من حسابه', () => {
    expect(page, 'لا يقرأ كود صاحب الحساب').toMatch(/const mine = useMyGrant\(\)/)
    const line = page.split('\n').find((l) => /const max = /.test(l) && !/view\.campaign\.maxCourses;$/.test(l.trim()))
    expect(line, 'لا حد للصفحة').toBeTruthy()
    expect(line!, 'الحد حد الحملة وحده').toMatch(/Math\.min\(\s*view\?\.campaign\.maxCourses/)
    expect(line!, 'ما بقي على الكود لا يدخل الحد').toMatch(/coursesLeftOn\(mine, nameAr\)/)
  })

  it('⚠️ وما بقي من كود المنحة نفسها لا الأخرى — ويقص ما اختير فوقه', () => {
    expect(myGrant, 'يعد ما بقي من كود المنحة الأخرى').toMatch(/grant\.nameAr !== grantNameAr/)
    expect(page, 'ما اختير فوق الحد يبقى').toMatch(/const picked = useMemo\(\(\) => \(allPicked\.length > max \? allPicked\.slice\(0, max\) : allPicked\), \[allPicked, max\]\)/)
  })
})

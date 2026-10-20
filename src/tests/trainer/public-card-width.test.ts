/* عرضُ بطاقة المدرّب في صفحة المدرّبين (٢٠ أكتوبر ٢٠٢٦).

   في لقطةٍ لبطاقة مدرّبةٍ على الموقع الحيّ خرجت أسطرُ دوراتها عن حافّة البطاقة وقُصّ «تفاصيل الدورة». وقيس
   الموقعُ الحيّ: ستُّ بطاقاتٍ من عشرٍ تخرج أسطرُها في الحاسوب، وفي الهاتف يكفي فتحُ بطاقةٍ واحدةٍ لتخرج البطاقاتُ
   العشرُ كلُّها عن الشاشة. والعلّةُ نفسُها التي في `slot-card-width.test.ts`: عمودُ الشبكة الضمنيُّ بعرض أعرض ما
   فيه، واسمُ الدورة سطرٌ واحدٌ مقصوص (`truncate`) فعرضُه الأدنى طولُه كلُّه — فمدّ قائمةَ الدورات، ومدّت القائمةُ
   البطاقة، ومدّت البطاقةُ عمودَ الصفحة في الهاتف.

   فكلُّ شبكةٍ في الصفحة تسمّي أعمدتَها من أصغر شاشة (`grid-cols-1` = `minmax(0, 1fr)`)، فلا يمدّها ما فيها.
   والفحصُ على الشيفرة بلا تعليقاتها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PAGE = readFileSync(join(process.cwd(), 'src/pages/Trainers.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

/** أصنافُ كلّ عنصرٍ في الصفحة — نصّا كانت أو قالبا */
const classLists = [...PAGE.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => (m[1] ?? m[2]).split(/\s+/))

describe('عرض بطاقة المدرب', () => {
  it('⚠️ كل شبكة في الصفحة تسمي أعمدتها من أصغر شاشة — لا يمدها اسم دورة طويل', () => {
    /* و`place-items-center` شبكةٌ تتوسّط حرفين في مربّعٍ ثابت (أوّلُ حرفَي الاسم بلا صورة) — لا قائمة */
    const grids = classLists.filter((c) => c.includes('grid') && !c.includes('place-items-center'))
    expect(grids.length, 'لا شبكة في الصفحة').toBeGreaterThanOrEqual(3)
    const loose = grids.filter((c) => !c.some((t) => t.startsWith('grid-cols-'))).map((c) => c.join(' '))
    expect(loose, 'شبكة بعمود ضمني يتسع لأعرض ما فيها').toEqual([])
  })
})

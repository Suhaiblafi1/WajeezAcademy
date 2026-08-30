/* سابقة «دورة» تُضاف مرّة واحدة — لا صفرا ولا مرّتين.

   وقع الوجهان معا في الإنتاج:

   الحدّ `\b` كان يحرس التكرار: `/^دورة\b/`. وهو حدُّ كلمةٍ لاتينيّ يعرف
   [A-Za-z0-9_] وحدها، فالحرف العربي غير كلميٍّ عنده — ولا حدَّ بين «ة»
   والفراغ بعدها. فالفحص يردّ «لا تبدأ بدورة» على عنوانٍ يبدأ بها.

   وما دامت عناوين الكتالوج بلا السابقة لم يظهر شيء: الحارس كان يُخفق على
   مدخلٍ لا يقع. فلمّا كُتبت «دورة» في `title_ar` عند إعادة التسمية صار كلُّ
   عنوانٍ يُعرض «دورة دورة …» — على واحدٍ وثمانين بطاقة.

   ولهذا يفحص هذا الملفّ الدالّة على عناوين الكتالوج الحقيقية لا على أمثلة
   مؤلَّفة: المصيدة كانت في التقاء الدالّة بالبيانات، لا في أيّهما وحده. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { courseTitleAr } from '../../application/catalog/course-title'

const CORE = JSON.parse(
  readFileSync(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8'),
) as { courses: { course_id: string; title_ar: string }[] }

describe('سابقة «دورة»', () => {
  it('لا تتكرّر على أيّ عنوان في الكتالوج', () => {
    const doubled = CORE.courses
      .map((c) => ({ id: c.course_id, shown: courseTitleAr(c.title_ar) }))
      .filter((x) => x.shown.startsWith('دورة دورة'))
    expect(doubled, 'عناوين تُعرض بسابقة مضاعفة').toEqual([])
  })

  it('كل عنوان معروض يبدأ بـ«دورة» مرّة واحدة', () => {
    for (const c of CORE.courses) {
      const shown = courseTitleAr(c.title_ar)
      expect(shown.startsWith('دورة '), c.course_id).toBe(true)
      expect(shown.split('دورة ').length - 1, `${c.course_id}: «دورة» تكرّرت`).toBeLessThanOrEqual(1)
    }
  })

  it('تُضاف لما لا يحملها، وتُترك لما يحملها', () => {
    expect(courseTitleAr('أساسيات التفاوض')).toBe('دورة أساسيات التفاوض')
    expect(courseTitleAr('دورة أساسيات التفاوض')).toBe('دورة أساسيات التفاوض')
    expect(courseTitleAr('  دورة التفاوض  ')).toBe('دورة التفاوض')
    expect(courseTitleAr('دورة')).toBe('دورة')
    expect(courseTitleAr('')).toBe('')
    /* «دورات» ليست «دورة»: كلمةٌ أخرى تبدأ بالحروف نفسها تأخذ السابقة */
    expect(courseTitleAr('دورات متقدمة')).toBe('دورة دورات متقدمة')
  })
})

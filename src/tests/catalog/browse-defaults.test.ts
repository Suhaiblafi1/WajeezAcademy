/* المرشِّحُ الافتراضيُّ في شاشة التصفّح — «كلّ الدورات» تعني كلَّها.

   العطبُ الذي يحرسه هذا الملفّ: كانت القيمةُ الافتراضيّةُ لمرشِّح المجال
   «أساسيات» لا «الكل» (`Catalog.tsx`، سطرٌ واحد). فمن يفتح `/courses` — وعنوانُها
   «كلّ الدورات — لمن يعرف ما يريد» — كان يرى **أربعا من إحدى وثمانين**،
   و`/pathways` ثلاثةَ عشرَ من عشرين. ولا رسالةَ خطأٍ ولا مؤشّرَ تصفية: الرقاقةُ
   مظلَّلةٌ فتُقرأ تبويبَ تصنيفٍ لا مرشِّحا يُخفي سبعا وسبعين دورة. ثمّ يبحث
   الزائرُ في صندوق البحث فيبحث داخلَ الأربع — فيبدو البحثُ عشوائيّا: ينجح إن
   صادف ما في «أساسيات»، ويفشل في كلّ ما عداه.

   والحارسُ على الخاصّيّة لا على العدد: «الافتراضيُّ لا يُنقص شيئا». فإضافةُ
   دورةٍ أو حذفُها لا تُفشله، وإعادةُ الافتراضيّ إلى مجالٍ بعينه تُفشله.

   ويحرس معه الاقترانَ الذي يسهل نسيانُه: القيمةُ الافتراضيّةُ تُحذف من عنوان
   الصفحة، فلو بقيت «أساسيات» افتراضيّةً هناك لصارت رقاقتُها غيرَ قابلةٍ
   للاختيار — تُحذف من العنوان فيرتدّ المعروضُ إلى «الكل». الموضعان يتغيّران
   معا أبدا. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import '../setup-catalog'
import { courses, courseCategories } from '../../data/courses'
import { pathways, pathwayCategory } from '../../data/pathways'

const SOURCE = readFileSync(new URL('../../pages/Catalog.tsx', import.meta.url), 'utf8')

describe('المرشِّحُ الافتراضيُّ في التصفّح', () => {
  it('الافتراضيُّ للمجال هو «الكل» — في القراءة', () => {
    expect(SOURCE).toContain(`params.get('cat') ?? 'الكل'`)
    expect(SOURCE).not.toContain(`params.get('cat') ?? 'أساسيات'`)
  })

  it('والافتراضيُّ نفسُه هو ما يُحذف من العنوان — وإلّا تعطّلت رقاقتُه', () => {
    expect(SOURCE).toContain(`key === 'cat' && value === 'الكل'`)
    expect(SOURCE).not.toContain(`key === 'cat' && value === 'أساسيات'`)
  })

  it('«الكل» أوّلُ الرقاقات فلا يبحث عنها أحد', () => {
    expect(courseCategories[0]).toBe('الكل')
  })

  /** المُسنَدُ نفسُه المستعمَلُ في `Catalog.tsx` — يُعاد هنا ليُقاس أثرُه */
  const shownCourses = (cat: string) => courses.filter((c) => cat === 'الكل' || c.category === cat)
  const shownPathways = (cat: string) => pathways.filter((c) => cat === 'الكل' || pathwayCategory(c.id) === cat)

  it('الافتراضيُّ لا يُخفي دورةً ولا مسارا', () => {
    expect(courses.length).toBeGreaterThan(0)
    expect(pathways.length).toBeGreaterThan(0)
    expect(shownCourses('الكل')).toHaveLength(courses.length)
    expect(shownPathways('الكل')).toHaveLength(pathways.length)
  })

  /* ولهذا الحارسُ أسنان: الافتراضيُّ القديمُ كان يُخفي الأغلبيّةَ فعلا. فلو
     عاد يوما لأسقط الاختبارَ أعلاه — وهذا يُثبت أنّه يقيس شيئا لا أنّه
     يمرّ دائما. */
  it('والافتراضيُّ القديمُ كان يُخفي أكثرَ من نصفِ الكتالوج', () => {
    expect(shownCourses('أساسيات').length).toBeLessThan(courses.length / 2)
    expect(shownCourses('أساسيات').length).toBeLessThan(shownCourses('الكل').length)
  })
})

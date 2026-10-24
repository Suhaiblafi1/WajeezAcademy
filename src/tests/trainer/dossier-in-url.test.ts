/* الملفُّ المفتوحُ موضعٌ في التاريخ — لا حالةٌ في الذاكرة.

   ═══ العطبُ الذي كُتب له ═══

   شكا صاحبُ المنصّة (٢٠ سبتمبر ٢٠٢٦): «أدخل ملفَّ طلبِ مدرّبٍ فأستصعب
   العودةَ للقائمة — الرجوعُ بالمتصفّح يأخذني لرئيسيّة الإدارة، والنقرُ على
   «طلبات المدربين» لا يعمل، فلا يبقى إلّا أن أصعد للأعلى وأنقر، وهذا غير
   عمليّ».

   وشكايتان، وعلّتُهما واحدة: `openDetail` كانت تكتب في `useState` ولا تمسّ
   العنوان. فالملفُّ ليس موضعا في التاريخ:

   ① **الرجوعُ يغادر الشاشةَ كلَّها** — آخرُ موضعٍ سُجّل هو ما قبلَ الشاشة،
      إذ لم يُسجَّل للملفّ موضعٌ قطّ. فالرجوعُ صحيحٌ في المتصفّح، والخطأُ
      عندنا: لم نقل له أنّ شيئا تغيّر.
   ② **والنقرُ على اسم الشاشة يبدو ميّتا** — يذهب إلى `/admin/trainers`
      وهو العنوانُ الذي نحن فيه، فلا يتغيّر شيءٌ ولا تُمسح الحالة. والزرُّ
      سليمٌ، والحالةُ هي التي لا تسمع.

   ═══ ولمَ الفحصُ على البنية ═══

   هذه سلوكُ متصفّحٍ لا سلوكُ دالّة: لا يُمسك بنداءٍ يُختبَر جوابُه. فيُفحَص
   ما يجعله ممكنا — أن يكون العنوانُ هو المصدر: منه يُقرأ المعرّف، وإليه
   يُكتب عند الفتح، ومنه يُمحى عند الإغلاق. ومن أعاد `setSelected` مصدرا
   ثانيا أسقط هذه.

   ═══ وصار الملفُّ عنوانا لا مُعامِلا (٢٤ أكتوبر ٢٠٢٦) ═══

   المرحلةُ الثالثةُ من مقترح لوحة الإدارة: ملفُّ كلِّ مدرّبٍ صفحتُه — `/admin/trainers/:id` لا `?app=` على عنوان
   الطابور. والحكمُ هو هو بقوّةٍ أكبر: الفتحُ ينتقل إلى عنوانه فيُسجَّل موضعا، و«رجوع» يعود إلى الطابور، و«الطلبات»
   في الدرب تعود إليه بمحطّته وبحثه. والرابطُ القديمُ `?app=` يُقرأ ويُحوَّل إلى عنوانه — بلا موضعٍ في التاريخ،
   وإلّا أعاد «رجوع» صاحبَه إلى رابطٍ يحوّله ثانيةً فلا يخرج. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SCREEN = 'src/pages/admin/TrainerApplications.tsx'
const code = readFileSync(join(process.cwd(), SCREEN), 'utf8')

describe('الملفّ المفتوح في العنوان', () => {
  it('والشاشة تقرأ الملفّ من العنوان — من مساره لا من حالة عندها', () => {
    expect(code, 'لا تقرأ معرّف الملفّ من المسار').toContain('const { id: recordId } = useParams<{ id: string }>();')
    expect(code, 'الملفّ المفتوح ليس ما يقوله المسار').toContain('const openApp = recordId ?? null;')
  })

  it('و«افتح» تنتقل إلى عنوان الملفّ — لا تكتب في `setSelected` رأسا', () => {
    const open = /const openDetail = .*/.exec(code)?.[0] ?? ''
    expect(open, 'لم يعثر على `openDetail`').toBeTruthy()
    expect(open, 'تفتح بلا أن تنتقل — فلا موضع يرجع إليه').toContain('navigate(`/admin/trainers/${id}`)')
    expect(open, 'تكتب في الحالة رأسا — فيفترق العنوان عمّا يعرض').not.toContain('setSelected')
  })

  it('و«أغلق» تعود إلى الطابور بمحطّته وبحثه', () => {
    const close = /const closeDetail = .*/.exec(code)?.[0] ?? ''
    expect(close, 'لم يعثر على `closeDetail`').toBeTruthy()
    expect(close, 'تغلق إلى غير الطابور').toContain('navigate(`/admin/trainers${listSearch.current}`)')
    expect(code, 'لا يحفظ ما كان عليه الطابور').toContain('if (!openApp && !legacyApp) listSearch.current = location.search;')
  })

  it('⚠️ والرابط القديم `?app=` يحوَّل إلى عنوانه — بلا موضع في التاريخ', () => {
    expect(code, 'لا يقرأ الرابط القديم').toMatch(/searchParams\.get\(["']app["']\)/)
    const redirect = /if \(!legacyApp\) return;[\s\S]*?\}, \[legacyApp, searchParams, navigate\]\);/.exec(code)?.[0] ?? ''
    expect(redirect, 'لا تحويل للرابط القديم').toContain('navigate(`/admin/trainers/${legacyApp}')
    expect(redirect, 'يحوّل بموضع في التاريخ — فرجوع يعيده إلى ما يحوّله ثانية').toContain('{ replace: true }')
    expect(redirect, 'يسقط ما في الرابط سوى الملفّ').toContain('rest.delete("app")')
  })

  /* ═══ وهذا هو الحارسُ الذي من أجله كُتب الملفّ ═══

     لو بقي في الشاشة موضعٌ واحدٌ يُغلق الملفَّ بـ`setSelected(null)` لَعاد
     العطبُ من حيث أُصلح: يُمحى المعروضُ ويبقى `?app=` في العنوان، فيُعاد
     الجلبُ في التصيير التالي ولا يُغلق شيء. ولا يُستثنى من ذلك إلّا مسحُ
     ما فشل جلبُه — وهو في `loadDetail` مقرونا بمحو المُعامِل. */
  it('ولا يغلق الملفّ بمحو الحالة وحدها — في أيّ موضع من الشاشة', () => {
    const closers = [...code.matchAll(/setSelected\(null\)/g)]
    /* الموضعُ الوحيدُ المسموح: داخلَ `useEffect` حين لا مُعامِلَ في العنوان */
    const effect = /useEffect\(\(\) => \{\s*if \(!openApp\) \{ setSelected\(null\); return; \}/.test(code)
    expect(effect, 'الأثر لا يمسح المعروض حين يخلو العنوان').toBe(true)
    expect(
      closers.length,
      'ثمّة موضع يمحو الحالة ويترك العنوان — فيبقى `?app=` ويعاد الفتح',
    ).toBe(1)
  })

  it('ودرب الوصول مكتوب: الطابور ثمّ اسم صاحبه', () => {
    expect(code, 'لا درب وصول — فمن دخل ملفّا بعد ملفّ نسي من أين جاء')
      .toMatch(/aria-label="مسار الوصول"/)
    expect(code, 'الدرب لا يعود بالإغلاق').toContain('onClick={closeDetail}')
  })
})

/* بطاقةُ Zoom في «التكاملات» — رمزُ الأحداث وعنوانُها (٣٠ سبتمبر ٢٠٢٦).

   كانت البطاقةُ بلا حقلٍ لرمز التحقّق من أحداث Zoom، فمن أعدّ Zoom منها وحدَها رفض
   Zoom عنوانَ أحداثه ولم يصل حدث. وما يُحفظ فعلا ويُقنَّع في الخادم محروسٌ في
   `server/tests/integrations/zoom-settings.test.ts`؛ وهنا أنّ الشاشةَ تحمله إليه:

   · حقلٌ **سرّيٌّ** مربوطٌ بالرمز — لا يُعرض ما يُكتب فيه.
   · يُبدأ بالمقنَّع من الخادم، والحفظُ يرسله مع بقيّة الإعداد.
   · والعنوانُ الذي يُنسخ إلى Zoom يُعرض للقراءة لا للتحرير.
   · وبريدُ المضيف الفارغُ يُرسَل فارغا — فيعود صاحبَ التطبيق كما يعد عنوانُ حقله.

   والفحصُ على **وسم الحقل نفسِه** لا على ورود كلمةٍ في الملفّ: يُقتطع الوسمُ الذي
   فيه الربطُ ثمّ يُسأل عن صفاته. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(join(process.cwd(), 'src/pages/admin/Integrations.tsx'), 'utf8')

/** وسمُ `<input …/>` الذي يحمل هذا الربط — كاملا بصفاته */
function inputTagWith(binding: string): string {
  const at = SRC.indexOf(binding)
  expect(at, `لا حقلَ مربوطا بـ${binding}`).toBeGreaterThan(-1)
  const start = SRC.lastIndexOf('<input', at)
  const end = SRC.indexOf('/>', at)
  expect(start).toBeGreaterThan(-1)
  const tag = SRC.slice(start, end + 2)
  /* ولم يتجاوز الاقتطاعُ وسمَه إلى وسمٍ قبله */
  expect(tag.slice(1).includes('<input'), 'اقتُطع أكثرُ من وسم').toBe(false)
  return tag
}

describe('رمزُ أحداث Zoom في البطاقة', () => {
  it('⚠️ حقلٌ سرّيٌّ مربوطٌ بالرمز — ويكتب فيه لا في غيره', () => {
    const tag = inputTagWith('value={zoomForm.webhookSecret}')
    expect(tag, 'يُعرض الرمزُ حروفا لمن يقف خلف الشاشة').toMatch(/type="password"/)
    expect(tag).toMatch(/setZoomForm\(\{ \.\.\.zoomForm, webhookSecret: e\.target\.value \}\)/)
  })

  it('⚠️ يُبدأ بالمقنَّع من الخادم — والحفظُ يرسله مع الإعداد', () => {
    expect(SRC).toMatch(/useState\(\{[^}]*webhookSecret: ""[^}]*\}\)/)
    expect(SRC, 'لا يُملأ من العرض — فيُرسَل فارغا ويبقى القديم ولا يُعرف أنّه محفوظ').toMatch(/webhookSecret: v\.zoom\.webhookSecret/)
    const save = /apiPut\("\/api\/admin\/integrations\/zoom", \{([^}]*)\}/.exec(SRC)
    expect(save, 'لا حفظَ لإعداد Zoom').not.toBeNull()
    expect(save![1], 'الحفظُ لا يحمل ما في النموذج كلَّه').toMatch(/\.\.\.zoomForm/)
  })

  it('⚠️ والبريدُ الفارغُ يُرسَل فارغا — لا يسقط من الطلب فيبقى المضيفُ القديم', () => {
    /* عنوانُ الحقل يعد: «اتركه فارغا لصاحب التطبيق». وكان الزرُّ يحوّل الفارغَ إلى لا شيء،
       فيسقط المفتاحُ من الطلب والخادمُ يُبقي لما غاب قيمتَه — فيبقى المضيفُ القديم.

       ويُنفَّذ تعبيرُ الحمولة نفسُه على نموذجٍ مصطنع، ثمّ يُمرَّر بـJSON كما يمرّ في الطلب
       (ما كان `undefined` يسقط) — فيُقاس ما يُرسَل لا كيف كُتب. */
    const save = /apiPut\("\/api\/admin\/integrations\/zoom", (\{[^}]*\})/.exec(SRC)
    expect(save, 'لا حفظَ لإعداد Zoom بحمولةٍ مكتوبةٍ في موضعه').not.toBeNull()
    const payload = new Function('zoomForm', `return (${save![1]})`) as (f: Record<string, unknown>) => unknown
    const wire = (hostEmail: string) => JSON.parse(JSON.stringify(payload({
      enabled: true, accountId: 'a', clientId: 'c', clientSecret: 's', webhookSecret: '', hostEmail,
    }))) as Record<string, unknown>
    expect(wire('   '), 'سقط البريدُ الفارغُ من الطلب — فيُبقي الخادمُ المضيفَ القديم').toHaveProperty('hostEmail', '')
    expect(wire(' host@wajeez.test ').hostEmail).toBe('host@wajeez.test')
  })

  it('والعنوانُ الذي يُنسخ إلى Zoom يُعرض للقراءة', () => {
    const tag = inputTagWith('value={view.zoom.webhookUrl}')
    expect(tag).toMatch(/\breadOnly\b/)
  })
})

/* لوحُ تفضيلات الإشعارات — وما يجب أن تحرسه الواجهة (المهمّة ٧٢).

   الحدُّ الحقيقيُّ يُفرَض في الخادم (`server/tests/notifications/preferences.test.ts`
   يُثبت أنّ صفَّ تفضيلٍ محفورا في القاعدة لا يُسكِت إيصالَ دفع). فما يبقى
   للواجهة ثلاثةُ أعطابٍ لا يكشفها اختبارُ خادم:

   ١) **قائمةُ أصنافٍ مكتوبةٌ في المتصفّح** تفترق عن الخادم يومَ يُضاف صنف —
      فتظهر شاشةٌ تعرض خمسةً والحدُّ على ستّة.
   ٢) **مفتاحٌ لما لا يُكتَم** — يُنقَر فيرتدّ، فيظنّ صاحبُه المنصّةَ معطوبة؛
      أو **إخفاءُ الصنف** فيظنّ أنّه كتَمَ كلَّ شيءٍ وهو يصله.
   ٣) **مفتاحُ بريدٍ** والبريدُ غيرُ موصول — وهو نفسُه العطبُ الذي عالجته
      المرحلةُ الأولى: زرٌّ يَعِد بما لا يفعل.

   والاختبارُ قراءةُ مصدرٍ لا تركيبُ DOM، كسائر حرّاس الواجهة هنا. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NOTIFICATION_CATEGORIES } from '../application/notifications/categories'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const panel = read('src/components/NotificationPreferences.tsx')
const screen = read('src/pages/student/Notifications.tsx')

describe('لوحُ تفضيلات الإشعارات', () => {
  it('يُبنى من الخادم: ينادي المسارَ قراءةً وكتابة', () => {
    expect(panel).toMatch(/apiGet<[^>]*>\("\/api\/me\/notification-preferences"\)/)
    expect(panel).toMatch(/apiPut<[\s\S]*?"\/api\/me\/notification-preferences"/)
  })

  it('ولا يحمل قائمةَ أصنافٍ خاصّةً به — وإلّا افترق عن الحدّ يومَ يُضاف صنف', () => {
    for (const c of NOTIFICATION_CATEGORIES) {
      expect(panel).not.toContain(`'${c.key}'`)
      expect(panel).not.toContain(`"${c.key}"`)
      /* ولا اسمُه العربيّ مكتوبا — الأسماءُ تأتي مع الصفوف */
      expect(panel).not.toContain(c.labelAr)
    }
    /* ولا يستورد جدولَ الأصناف فيصير له نسختان */
    expect(panel).not.toMatch(/application\/notifications\/categories/)
  })

  it('والمفتاحُ لا يُعرَض إلّا لما يجوز كتمُه — لا مفتاحَ يرتدّ', () => {
    /* شرطُ `silenceable` هو ما يفصل المفتاحَ عن الشارة */
    expect(panel).toMatch(/c\.silenceable \?[\s\S]*?type="checkbox"/)
    /* والشارةُ في الفرع الآخر: يُعرَض ولا يُخفى */
    expect(panel).toMatch(/يصلني دائما/)
    expect(panel).not.toMatch(/c\.silenceable &&[\s\S]{0,80}type="checkbox"/)
  })

  it('وسببُ القفل يُقال في موضعه — قفلٌ بلا تفسيرٍ يُقرأ تعطيلا', () => {
    expect(panel).toMatch(/!c\.silenceable && c\.lockedWhyAr/)
    expect(panel).toMatch(/\{c\.lockedWhyAr\}/)
  })

  it('ولا مفتاحَ بريدٍ اليوم — بل سطرُ الخادم يقول متى يظهر', () => {
    expect(panel).toMatch(/\{prefs\.emailNoteAr\}/)
    /* السطرُ يأتي من الخادم، ولا قناةَ بريدٍ في اللوح: لا اسمَ قناةٍ مكتوبا
       ولا مفتاحَ ثانيا إلى جانب مفتاح الصنف الواحد. */
    expect(panel).not.toMatch(/['"]email['"]/)
    expect(panel.match(/type="checkbox"/g) ?? []).toHaveLength(1)
  })

  it('والحالةُ تُقرأ من الخادم بعد كلّ تغيير لا تُفترض محلّيّا', () => {
    /* `await load()` بعد الكتابة: تفضيلٌ ظُنَّ محفوظا ولم يُحفظ أسوأُ من غيابه */
    expect(panel).toMatch(/await apiPut[\s\S]*?await load\(\)/)
  })

  it('وجوابُ الرفض يُعرَض بنصّه لا يُهمَل', () => {
    expect(panel).toMatch(/res\?\.error[\s\S]{0,80}toastError\(res\.error\.message_ar\)/)
  })

  it('وتعذُّرُ التحميل يُقال ومعه إعادةُ محاولة — لا لوحٌ فارغٌ بلا خبر', () => {
    expect(panel).toMatch(/تعذّر تحميلُ تفضيلات الإشعارات/)
    expect(panel).toMatch(/أعد المحاولة/)
  })

  it('ومساحةُ اللمس لا تقلّ عن ٤٤ نقطة', () => {
    expect(panel).toMatch(/min-h-\[44px\]/)
  })

  it('واللوحُ مركَّبٌ في شاشة إشعارات المتعلّم — وإلّا فهو مكوّنٌ لا يُفتح', () => {
    expect(screen).toMatch(/import NotificationPreferences from "@\/components\/NotificationPreferences"/)
    expect(screen).toMatch(/<NotificationPreferences \/>/)
  })
})

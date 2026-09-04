/* شاشةُ «مؤهّلاتي وإتاحتي» — وما يجب أن تقوله (المهمّة ٧١).

   أغربُ ما وجدتُه في هذه المهمّة أنّ نصفَها كان مكتوبا: `/api/trainer/me/qualifications`
   و`/api/trainer/catalog-scope` موجودان في الخادم منذ زمنٍ ومحروسان
   بصلاحيّاتهما، **ولا تنادِيهما شاشةٌ واحدة** — فالمدرّبُ يسأل الإدارةَ عمّا
   تعرفه المنصّةُ عنه. فالشاشةُ تعرضهما، ولذلك أوّلُ ما يُحرَس هنا أنّها
   تنادِيهما فعلا.

   وأمّا الإتاحةُ فجديدة، وفيها **تفرقةٌ لا تُفهَم من الشاشة إلّا إن قيلت**:
   الغيابُ مانعٌ والساعاتُ إرشاد. وإعلانٌ لا يُعرَف أثرُه إمّا يُترك فراغا أو
   يُملأ خوفا — فالنصُّ جزءٌ من الميزة لا زينةٌ عليها.

   وفي شاشة الإسناد: **الغيابُ يُقال قبل النقر** لا بعد الرفض بـ409. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const screen = read('src/pages/trainer/Qualifications.tsx')
const ops = read('src/pages/admin/CohortOps.tsx')
const layout = read('src/pages/trainer/TrainerLayout.tsx')
const app = read('src/App.tsx')

describe('شاشةُ مؤهّلات المدرّب وإتاحته', () => {
  it('تنادي المسارات الثلاثة — ومنها اثنان كانا مكتوبَين بلا شاشة', () => {
    expect(screen).toMatch(/\/api\/trainer\/me\/qualifications/)
    expect(screen).toMatch(/\/api\/trainer\/catalog-scope/)
    expect(screen).toMatch(/\/api\/trainer\/me\/availability/)
  })

  it('ولها مسارٌ في التطبيق وبندٌ في قائمة المدرّب — وإلّا فهي شاشةٌ لا تُفتح', () => {
    expect(app).toMatch(/path="\/trainer\/qualifications"/)
    expect(layout).toMatch(/\/trainer\/qualifications/)
  })

  it('وتقول إنّ الغيابَ مانعٌ لا تنبيه — التفرقةُ جزءٌ من الميزة', () => {
    expect(screen).toMatch(/مانعٌ لا تنبيه/)
    expect(screen, 'أثرُ الغياب يجب أن يُقال بلغة النتيجة').toMatch(/لن تُسنَد/)
  })

  it('وحالةُ الفراغ في التأهيل تقول الحقيقة: لا تؤهّل نفسك', () => {
    expect(screen).toMatch(/لا تستطيع أن تؤهّل نفسك/)
  })

  it('ولا تُرسل ما تعرف أنّه مردود: المدى يُفحَص عند الحقل قبل النداء', () => {
    expect(screen).toMatch(/تاريخُ النهاية بعد البداية/)
    expect(screen).toMatch(/aria-invalid/)
    expect(screen).toMatch(/role="alert"/)
  })
})

describe('شاشةُ الإسناد تقرأ الإتاحة قبل النقر', () => {
  it('تعرف الحقلَين الجديدَين في نوعها', () => {
    expect(ops).toMatch(/onLeave: boolean/)
    expect(ops).toMatch(/outsideDeclaredHours: number \| null/)
  })

  it('وتحذّر من الغياب بأنّ الإسنادَ سيُردّ — لا بعد أن يُردّ', () => {
    expect(ops).toMatch(/الإسنادُ سيُردّ/)
  })

  it('وتفرّق التنبيهَ من المنع: خارجُ الساعات «جائزٌ والقرارُ لك»', () => {
    expect(ops).toMatch(/الإسنادُ جائزٌ، والقرارُ لك/)
  })

  it('ولا يُقرأ الصفرُ تنبيها — `outsideDeclaredHours` تُختبَر بالقيمة لا بالوجود', () => {
    /* `picked.outsideDeclaredHours ?` تُسقط الصفرَ والـnull معا، وهذا المطلوب:
       الصفرُ يعني «كلُّها داخل ساعاته» فلا تنبيه له. */
    expect(ops).toMatch(/picked\??\.outsideDeclaredHours \?/)
  })
})

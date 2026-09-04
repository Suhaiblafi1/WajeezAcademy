/* لوحُ «مواعيدي» وشاشةُ «جدولي» — ما تحرسه الواجهة (المهمّة ٧٢).

   ثلاثةُ أعطابٍ لا يكشفها اختبارُ خادم:

   ١) **رابطٌ إلى العدم** — الزرُّ في اللوح كان أوّلَ ما كتبتُه
      `/student/course/${enrollmentId}`، وذلك المسارُ يتوقّع **معرّفَ دورةٍ**
      لا معرّفَ تسجيل. فالزرُّ يعمل ولا يوصل، وهو أسوأُ من غيابه. فالرابطُ
      يفتح مرحلةَ الدورة في «تعلّمي» حيث نموذجُ التسليم فعلا.
   ٢) **بطاقاتُ الاسترجاع تُعرَض صفوفا** فتُغرق واجبا واحدا بخمسين سطرا.
   ٣) **الحالةُ باللون وحدَه** — والفائتُ يجب أن يُقرأ بلفظه لا بحمرته.

   وشاشةُ المدرّب: لا تُفتح إن لم يكن لها مسارٌ في التطبيق وبندٌ في قائمته. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const panel = read('src/components/MyDeadlines.tsx')
const dashboard = read('src/pages/student/Dashboard.tsx')
const schedule = read('src/pages/trainer/Schedule.tsx')
const layout = read('src/pages/trainer/TrainerLayout.tsx')
const app = read('src/App.tsx')
const service = read('server/services/deadlines.service.ts')

describe('لوحُ «مواعيدي»', () => {
  it('ينادي مسارَه، ومركَّبٌ في لوحة المتعلّم', () => {
    expect(panel).toMatch(/"\/api\/learner\/deadlines"/)
    expect(dashboard).toMatch(/import MyDeadlines from "@\/components\/MyDeadlines"/)
    expect(dashboard).toMatch(/<MyDeadlines /)
  })

  it('والرابطُ يفتح مرحلةَ الدورة في «تعلّمي» — لا مسارا يتوقّع معرّفا آخر', () => {
    expect(panel).toMatch(/\/student\/learning\?stage=\$\{encodeURIComponent\(d\.courseId\)\}/)
    /* وهذا هو العطبُ الذي كان: مسارُ الدورة لا يقبل معرّفَ تسجيل */
    expect(panel).not.toMatch(/\/student\/course\/\$\{d\.enrollmentId\}/)
    /* والخادمُ يُرسل `courseId` فعلا — وإلّا كان الرابطُ `undefined` */
    expect(service).toMatch(/courseId: e\.cohort\.courseId/)
  })

  it('وبطاقاتُ الاسترجاعِ سطرٌ يشير إلى شاشتها لا صفوفٌ تُغرق واجبا', () => {
    expect(panel).toMatch(/retrievalDue > 0/)
    expect(panel).toMatch(/\/student\/review/)
    expect(panel).toMatch(/لا موعدَ نهائيَّ لها/)
  })

  it('والحالةُ تُقرأ بلفظها لا بلونها وحدَه', () => {
    expect(panel).toMatch(/\{d\.dueLabelAr\}/)
    expect(panel).toMatch(/فات موعدُه/)
  })

  it('واللوحُ يقول معناه بنصِّ الخادم — فلا يُقرأ الفراغُ عطبا', () => {
    expect(panel).toMatch(/\{data\.meaningAr\}/)
  })

  it('وتعذُّرُ النداء لا يُسقط لوحةَ المتعلّم — لوحٌ مساندٌ يغيب بصمت', () => {
    expect(panel).toMatch(/\.catch\(\(\) => undefined\)/)
  })
})

describe('شاشةُ «جدولي» للمدرّب', () => {
  it('لها مسارٌ في التطبيق وبندٌ في قائمة المدرّب', () => {
    expect(app).toMatch(/path="\/trainer\/schedule"/)
    expect(layout).toMatch(/\/trainer\/schedule/)
  })

  it('وتنادي مسارَها وتعرض معناه', () => {
    expect(schedule).toMatch(/"\/api\/trainer\/me\/schedule"/)
    expect(schedule).toMatch(/\{data\.meaningAr\}/)
  })

  it('وتقول لماذا وقع التزاحمُ ولم يمنعه الحارس — وإلّا قُرئ عطبا', () => {
    expect(schedule).toMatch(/حارسُ الإسناد/)
    expect(schedule).toMatch(/data\.clashing > 0/)
  })

  it('وتقول إنّ جلسةً بلا نهايةٍ تُحسب ساعةً — تقديرٌ يُعلَن لا يُخفى', () => {
    expect(schedule).toMatch(/تُحسب ساعةً واحدة/)
    expect(schedule).toMatch(/بلا وقتِ نهاية/)
    /* والتقديرُ نفسُه مكتوبٌ في الخدمة لا مُخمَّنٌ في الواجهة */
    expect(service).toMatch(/ASSUMED_MS = 60 \* 60_000/)
  })

  it('وفراغُها يُفسَّر بمدّته لا يُترك صامتا', () => {
    expect(schedule).toMatch(/titleAr="لا جلسةَ في الأفق"/)
    expect(schedule).toMatch(/reasonAr=\{`لا جلسةَ مجدولةً لك في \$\{data\.days\}/)
  })
})

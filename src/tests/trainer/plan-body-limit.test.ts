/* سقفُ متن المحور — رقمان كانا يقولان الشيءَ نفسَه وافترقا.

   وُجد في جولة الفحص (١٣ سبتمبر ٢٠٢٦) وهو يُعطّل تجهيزَ الشعب كلَّه:

   · تأليفُ المتون واستيرادُ الكتالوج على `MAX_BODY_CHARS` = ٤٠٠٠٠ حرفا.
   · وخطّةُ المدرّب كانت على ٦٠٠٠ مكتوبةً رقما في مخطّط الطريق.

   وشاشةُ الشعبة تبدأ من متون الكتالوج (`modules: w.course.baseModules`)
   وترسل `content` **كاملا** مع كلّ حفظ. فكان المدرّبُ يضغط «احفظ» في أيّ
   مرحلةٍ — الاسمُ أو المصادرُ أو المحاور — فيسقط الطلبُ كلُّه ٤٢٢ على
   «modules.0.bodyAr» بسبب متنٍ لم يمسّه أصلا.

   وقيس في القاعدة يومَها: **١٩١ متنا من ١٩١ فوق السقف** — لا متنَ واحدٌ
   تحته. متوسّطُها ٢٣٢٣١ حرفا وأطولُها ٣٥٣١٧.

   فالحارسُ على أن يبقى السقفُ **مستوردا** لا مكتوبا رقما: رقمٌ ثانٍ مكتوبٌ
   باليد هو بعينه ما أنتج العطب. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MAX_BODY_CHARS } from '../../../server/services/module-authoring.service'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** مخطّطُ محتوى الخطّة عند الخادم — لا الملفُّ كلُّه */
function planSchema(): string {
  const src = code('server/http/routes/learning-portal.routes.ts')
  const from = src.indexOf('const planContent = z.object({')
  expect(from, 'مخطّطُ الخطّة غيرُ موجود — تغيّرت بنيةُ الطريق').toBeGreaterThan(-1)
  return src.slice(from, src.indexOf("app.get('/api/trainer/cohorts/:id/workspace'"))
}

describe('سقفُ المتن واحدٌ في المنصّة كلِّها', () => {
  it('⚠️ خطّةُ المدرّب تستورد السقفَ ولا تكتبه رقما', () => {
    const schema = planSchema()
    expect(schema, 'السقفُ كُتب رقما في المخطّط — وهذا بابُ الافتراق').toMatch(/bodyAr: z\.string\(\)\.max\(MAX_BODY_CHARS\)/)
    expect(schema, 'رقمٌ مكتوبٌ باليد عاد إلى سقف المتن').not.toMatch(/bodyAr: z\.string\(\)\.max\(\d/)
  })

  it('⚠️ والسقفُ يتّسع لأطول متنٍ يقبله التأليفُ — وإلّا لم يُحفظ ما أُلّف', () => {
    /* السقفان يجب أن يكونا واحدا: ما قبِله التأليفُ يجب أن تقبله الخطّةُ
       التي تحمله، وإلّا وُلد متنٌ لا يستطيع مدرّبُه حفظَ شعبته معه. */
    const catalogCap = code('server/http/routes/catalog.routes.ts').match(/bodyAr: z\.string\(\)\.max\((\d+(?:_\d+)*)\)/)
    expect(catalogCap, 'سقفُ استيراد الكتالوج غيرُ موجود').toBeTruthy()
    expect(Number(catalogCap![1].replace(/_/g, '')), 'افترق سقفُ الكتالوج عن سقف التأليف').toBe(MAX_BODY_CHARS)
  })

  it('⚠️ والسقفُ فوقَ أطولِ متنٍ قِيس في الكتالوج يومَ الاكتشاف (٣٥٣١٧)', () => {
    /* لو خُفض دون ذلك عادت الشكوى نفسُها بصمت: حفظٌ يسقط بمتنٍ لم يُمسّ. */
    expect(MAX_BODY_CHARS).toBeGreaterThan(35_317)
  })
})

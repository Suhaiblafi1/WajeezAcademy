/* «المحتوى النظريّ» شرطٌ للاعتماد لا للحفظ (د-١).

   طلب صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦) أن يصير إلزاميّا لكلّ محور. وقرارُ
   التنفيذ — وهو ما يُحرَس هنا — **يمنع الاعتمادَ ولا يمنع الحفظ**: فمن كتب
   نصفَ شعبته ثمّ أغلق حاسوبه يجب أن يجد نصفَه حين يعود، ومرحلةٌ لا تُحفظ
   حتّى تكتمل تُخسِر العملَ الذي بُذل.

   وكان الشرطُ «فيها محاورُ» وحدَه — وهو صحيحٌ **دائما**، لأنّ المحاورَ
   تُحمَّل من الكتالوج بدءا. فمرحلةٌ تُعدّ تامّةً قبل أن يكتب المدرّبُ حرفا. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildChecklist } from '../../../server/services/cohort-plan.service'
import { MIN_MODULE_BODY } from '@/application/trainer/plan-overlay'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const body = (n: number) => 'ن'.repeat(n)
const plan = (bodies: (string | null)[]) => ({
  kind: 'trainer' as const,
  modules: bodies.map((b, i) => ({ moduleId: `M${i}`, titleAr: `محور ${i}`, bodyAr: b })),
  resources: [{ title: 'مرجع', url: 'https://x.test/a' }],
})
const build = (bodies: (string | null)[]) => buildChecklist({
  cohort: { title: 'شعبة', termId: 'T-winter' },
  content: plan(bodies) as never,
  sessions: [{ recordings: [] }],
  assessmentsCount: 0,
  planStatus: 'draft',
})
const modules = (bodies: (string | null)[]) => build(bodies).find((c) => c.key === 'modules')!

describe('متى تُعدّ مرحلةُ المحاور تامّة', () => {
  it('⚠️ محورٌ بلا محتوًى يمنع تمامَ المرحلة — وكان يمرّ دائما', () => {
    expect(modules([body(80), null]).done, 'محورٌ فارغٌ مرّ').toBe(false)
    expect(modules([body(80), '']).done).toBe(false)
    expect(modules([body(80), '    ']).done, 'المسافاتُ عُدّت محتوى').toBe(false)
  })

  it('⚠️ وحرفٌ واحدٌ ليس محتوًى — فشرطٌ يمرّ بحرفٍ شرطٌ صوريّ', () => {
    expect(modules([body(80), 'x']).done).toBe(false)
    expect(modules([body(80), body(MIN_MODULE_BODY - 1)]).done, 'مرّ ما دون الأرضيّة').toBe(false)
    expect(modules([body(80), body(MIN_MODULE_BODY)]).done, 'رُفض ما بلغ الأرضيّةَ تماما').toBe(true)
  })

  it('والأرضيّةُ أربعون — تُبدَّل بقرارٍ يُرى يسقط، لا بانزلاق', () => {
    /* الرقمُ مكتوبٌ هنا باليد ولا يُقرأ من الوحدة: لو قُرئ لتحرّك التوقّعُ
       معه ومرّ الحارسُ أخضرَ على تبديلٍ لم يره أحد. */
    expect(MIN_MODULE_BODY).toBe(40)
  })

  it('وبلا محاورَ أصلا فالمرحلةُ ناقصةٌ كما كانت', () => {
    expect(modules([]).done).toBe(false)
  })

  it('⚠️ والمرحلةُ تبقى **إلزاميّة** — لا تُرضى بجعلها اختياريّة', () => {
    /* أسهلُ طريقٍ لإسكات هذا الشرطِ أن تُقلَب `optional` — فيمرّ كلُّ ما
       فوق، ولا يحمرّ شيء. */
    expect(modules([body(80)]).optional).toBe(false)
  })
})

describe('ويمنع الاعتمادَ لا الحفظ', () => {
  it('⚠️ زرُّ الحفظ لا يُعطَّل بنقص المحتوى — يُعطَّل بغيابِ تغييرٍ فقط', () => {
    /* لو دخل `missingBody` في شرط تعطيل الحفظ لخسِر المدرّبُ ما كتبه. */
    const ws = code('src/pages/trainer/CohortWorkspace.tsx')
    const save = ws.slice(ws.indexOf('احفظ المحاور') - 400, ws.indexOf('احفظ المحاور'))
    expect(save, 'نقصُ المحتوى صار يمنع الحفظ').not.toContain('missingBody')
  })

  it('⚠️ وشاشةُ الاعتماد تسمّي المحاورَ الناقصةَ ولا تقول «ينقص شيء»', () => {
    /* شرطٌ لا يقول ما ينقص يترك المدرّبَ يفتح ثمانيةَ محاورَ واحدا واحدا. */
    const ws = read('src/pages/trainer/CohortWorkspace.tsx')
    expect(ws).toContain('ينقص المحتوى النظريُّ في')
    expect(ws, 'لا يُفتح الناقصُ بنقرة').toContain('setOpenModule(missingBody[0].moduleId)')
  })

  /* ═══ وصارت القاعدةُ دالّةً بعد أن كانت رقما (ع-٢) ═══

     كان الشرطُ «أربعون حرفا»، فكان يكفي أن يُستورَد الرقمُ في الموضعَين.
     وزاد ع-٢ بديلا — ملفٌّ يُرفق — فصار الشرطُ قسمةً: «مكتوبٌ **أو**
     مرفوع». ورقمٌ مشتركٌ لا يحرس قسمةً: تُزاد في موضعٍ دون آخرَ فيرى
     المدرّبُ محورَه تامّا بملفّه ويردّه الخادمُ بأنّه بلا متن.

     فالمقصودُ هو هو — مالكٌ واحدٌ — والمفحوصُ صار اسمَ الدالّة. */
  it('⚠️ والشاشةُ والخادمُ على قاعدةٍ واحدةٍ مستوردة — لا قاعدتَين', () => {
    const ws = code('src/pages/trainer/CohortWorkspace.tsx')
    const svc = code('server/services/cohort-plan.service.ts')
    expect(ws, 'الشاشةُ تقرّر التمامَ بنفسها').toContain('moduleBodyDone')
    expect(svc, 'الخادمُ يقرّر التمامَ بنفسه').toContain('moduleBodyDone')

    /* ولا يعود أحدُهما يقيس الطولَ بيده — لا رقما ولا `MIN_MODULE_BODY`
       مباشرةً: كلاهما يتخطّى بديلَ الملفّ فيُنكر محورا تامّا. */
    for (const [who, src] of [['الشاشة', ws], ['الخادم', svc]] as const) {
      expect(src, `${who} يقيس طولَ المتن بيده فيُنكر الملفَّ`)
        .not.toMatch(/bodyAr[^\n]*length\s*>=/)
    }
  })

  it('والاسمُ صار «المحتوى النظريّ» في الشاشة', () => {
    expect(read('src/pages/trainer/CohortWorkspace.tsx')).toContain('label="المحتوى النظريّ"')
  })
})

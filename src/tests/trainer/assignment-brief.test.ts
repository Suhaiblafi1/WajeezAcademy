/* التكليفُ يُقرأ قبل أن يُسلَّم — البندان ٦ و٨.

   ═══ العطب ═══

   كان المتعلّمُ يرى من التكليف عنوانا ودرجةً وموعدا لا غير. و`briefAr` —
   التعليماتُ التي يكتبها المدرّبُ وأُضيف عمودُها في ١٢ سبتمبر — **لم تكن
   تُعرض له أصلا**: لا في نوع `CohortAssessment` عند الواجهة، ولا في تصيير
   `StageWork`. فهو يُطالَب بتسليمٍ بلا أن يُقال له ما المطلوب.

   وقال صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «أرفِق الملفّات التي يريد». فمعها
   المرفقاتُ: نموذجٌ يُملأ أو مرجعٌ يُقرأ قبل التسليم. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readTypedLinks } from '@/application/trainer/plan-overlay'

const root = process.cwd()
const raw = (p: string) => readFileSync(join(root, p), 'utf8')
const code = (p: string) =>
  raw(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*(\/\/|--).*$/gm, '')

describe('① التعليماتُ تصل المتعلّم', () => {
  it('نوعُ التكليف عند الواجهة يحمل التعليماتِ والمرفقات', () => {
    const t = code('src/services/enrollment-detail.ts')
    const block = t.slice(t.indexOf('export interface CohortAssessment'), t.indexOf('export interface MySubmission'))
    expect(block, 'التعليماتُ خارج النوع فلا تُصيَّر').toMatch(/briefAr: string \| null/)
    /* والمرفقاتُ `unknown` بقصد: عمودُ JSON يُقرأ بمقروئه لا يُصدَّق */
    expect(block).toMatch(/attachments: unknown/)
  })

  it('وشاشةُ المتعلّم تصيّرهما', () => {
    const sw = code('src/components/journey/StageWork.tsx')
    expect(sw, 'التعليماتُ لا تُعرض').toMatch(/a\.briefAr &&/)
    expect(sw, 'المرفقاتُ لا تُعرض').toMatch(/readTypedLinks\(a\.attachments\)/)
  })

  it('والتعليماتُ نصٌّ لا متنٌ مصيَّر — فهذه الشاشةُ خريطةٌ لا مشغّل', () => {
    /* حارسُ `lesson-split.test.ts` يمنع `<LessonBody` في هذه الشاشة: المتنُ
       في مشغّله. والتعليماتُ تُعرض نصّا كما كتبها مدرّبُها، كما يراها هو في
       شاشته — فلا يَعِد أحدُهما بصيغةٍ لا يفي بها الآخر. */
    const sw = code('src/components/journey/StageWork.tsx')
    expect(sw).not.toContain('<LessonBody')
    expect(sw, 'الأسطرُ تُطوى فتضيع فقراتُ التعليمات').toMatch(/a\.briefAr &&[\s\S]{0,120}whitespace-pre-line/)
  })
})

describe('② المرفقاتُ تُحفظ وتُقرأ', () => {
  it('الخادمُ يقبلها في الإنشاء والتعديل بالقائمة البيضاء نفسِها', () => {
    const r = code('server/http/routes/learning-portal.routes.ts')
    expect((r.match(/attachments: z\.array\(/g) ?? []).length, 'المرفقاتُ في مسارٍ واحدٍ لا في الاثنين').toBe(2)
    expect((r.match(/kind: z\.enum\(RESOURCE_KINDS\)/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  it('والمصفوفةُ الفارغةُ محوٌ مقصودٌ لا إهمال', () => {
    const svc = code('server/services/assessment.service.ts')
    /* `patch.attachments ?` يُسقط المصفوفةَ الفارغة، فلا يستطيع المدرّبُ
       نزعَ مرفقٍ أخطأ فيه أبدا. */
    expect(svc).toMatch(/patch\.attachments !== undefined \?/)
  })

  it('وتخرج في حمولة المدرّب — وإلّا فتحَ التعديلَ فوجدها ذهبت', () => {
    const svc = code('server/services/cohort-plan.service.ts')
    expect(svc, 'المرفقاتُ ليست في الانتقاء').toMatch(/attachments: true/)
    expect(svc, 'المرفقاتُ ليست في المخرَج').toMatch(/attachments: a\.attachments/)
  })

  it('وقراءةُ العمود دفاعيّةٌ — صفٌّ مشوّهٌ لا يُسقط شاشةَ تكليف', () => {
    expect(readTypedLinks(null)).toEqual([])
    expect(readTypedLinks('ليست مصفوفة')).toEqual([])
    expect(readTypedLinks([null, 7, 'نصّ'])).toEqual([])
    /* والكائنُ المفردُ هو الحالةُ الخطرة: `for…of` عليه **يرمي** لا يعيد
       فراغا، فتسقط الشاشةُ كلُّها. ونصٌّ أو رقمٌ يمرّان بفحص العنصر بعده،
       فلا يُثبتان حراسةَ `Array.isArray` — وهذا يُثبتها. */
    expect(() => readTypedLinks({ title: 'أ', url: 'https://x.test' })).not.toThrow()
    expect(readTypedLinks({ title: 'أ', url: 'https://x.test' })).toEqual([])
    expect(() => readTypedLinks(7)).not.toThrow()
    /* والناقصُ يُسقَط وحدَه: مرفقٌ بلا رابطٍ لا يُبطل من بجانبه */
    expect(readTypedLinks([{ title: 'أ' }, { url: 'https://x.test' }, { title: 'ب', url: 'https://y.test' }]))
      .toEqual([{ title: 'ب', url: 'https://y.test', kind: 'link', noteAr: null }])
  })
})

describe('③ محرّرُ المتن — شريطٌ ومعاينةٌ بمكوّن المتعلّم نفسِه', () => {
  const ed = code('src/components/BodyEditor.tsx')

  it('خطوةُ المحاور تستعمل المحرّرَ لا مربّعَ نصٍّ عاريا', () => {
    const ws = code('src/pages/trainer/CohortWorkspace.tsx')
    expect(ws).toMatch(/<BodyEditor[\s\S]{0,200}bodyAr/)
    expect(ws, 'المتنُ ما زال مربّعَ نصٍّ بلا شريط').not.toMatch(/aria-label=\{`متن المحور \$\{i \+ 1\}`\}[^>]*className=\{areaCls\}/)
  })

  it('والمعاينةُ بـ`LessonBody` — لا بنسخةٍ تشبهه', () => {
    /* معاينةٌ بمكوّنٍ آخرَ وعدٌ يُخلَف: يرى المدرّبُ شيئا ويرى متعلّمُه
       غيرَه. والفحصُ على الاستيراد والاستعمال معا. */
    expect(ed).toMatch(/import LessonBody from '@\/components\/LessonBody'/)
    expect(ed).toMatch(/<LessonBody body=\{value\}/)
  })

  it('ولا محرّرَ غنيٌّ يُخرج HTML — فالحقنُ يعود ممكنا', () => {
    /* `LessonBody` يحوّل إلى عناصر React مباشرةً، فحقنُ HTML مستحيلٌ
       بنيويّا. ومحرّرٌ يُخرج HTML يعيد المنقّي وقائمةَ الحجب. */
    expect(ed).not.toContain('dangerouslySetInnerHTML')
    expect(ed).not.toContain('contentEditable')
  })

  it('والشريطُ يقرأ علاماتِه من الطبقة المحضّة لا يكتبها بيده', () => {
    expect(ed).toMatch(/from '@\/application\/content\/body-marks'/)
    expect(ed).toMatch(/BODY_MARKS\.map\(/)
  })
})

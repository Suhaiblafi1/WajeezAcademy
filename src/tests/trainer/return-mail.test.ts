/* بريدُ «اطلب تعديلات» — لطيفٌ عمليّ (١١ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «الإيميل الذي يصل المدرّب مخيفٌ وغيرُ مرتّب.. يجب أن يكون ملخّصا للتعديلات
   ومديحا له في البداية على إنجازه، وإبلاغَه بالخطوات وآليّةَ قبول التعديلات بسهولة.. كن لطيفا
   إيجابيّا وعمليّا».

   ① الشكرُ أوّلا، ثمّ ما جهّزناه ملخّصا، ثمّ الخطوات — وأوّلُ ما يفعله «اقبلها كلَّها».
   ② ملخّصٌ لا نصوص: عددُ التعديلات وخطواتُها، وأسماءُ الخطوات التي فيها ملاحظة، والتقريرُ بعدد ملفّاته.
   ③ والمطلوبُ يُقال حين يكون وحدَه — ولا يُقال «كلُّها اختياريّة» وفيها مطلوب.
   ④ والخدمةُ تبني البريدَ منه، وكلمةُ الإدارة وحدَها تُعرض — لا السطرُ الذي يُملأ به الردُّ تلقائيّا. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { returnMailAr, type ReturnMailInput } from '@/application/trainer/plan-decision'

const base: ReturnMailInput = {
  cohortTitle: 'الخطابة للأبناء — شعبة ٢',
  generalNote: null,
  notedSteps: ['المحاور ومواعيدها', 'اللقاءات'],
  edits: { count: 56, required: 0, bySteps: [{ label: 'المحاور ومواعيدها', n: 26 }, { label: 'المهامّ والمصادر', n: 30 }] },
  reports: 2,
}

describe('① الشكرُ أوّلا، ثمّ الملخّص، ثمّ الخطوات', () => {
  it('⚠️ يبدأ بالشكر على الخطّة — لا بـ«نحتاج تعديلا»', () => {
    const m = returnMailAr(base)
    expect(m.subject).toMatch(/^شكرا على خطّتك/)
    expect(m.heading).toMatch(/^شكرا على خطّتك/)
    expect(m.praise).toMatch(/شكرا على جهدك فيها/)
    expect(`${m.subject}${m.heading}${m.praise}`).not.toMatch(/نحتاج تعديلا|طُلبت تعديلاتٌ/)
  })

  it('⚠️ وأوّلُ ما يفعله بعد فتح الصفحة: «اقبلها كلَّها» — وآخرُه: يرسلها', () => {
    const m = returnMailAr(base)
    expect(m.steps[0]).toMatch(/^افتح صفحةَ شعبتك/)
    expect(m.steps[1]).toMatch(/اضغط «اقبلها كلَّها»/)
    expect(m.steps.at(-1)).toMatch(/^أرسل الخطّةَ من خطوة «الاعتماد»/)
    expect(m.cta).toBe('افتح صفحةَ شعبتك وراجع التعديلات')
  })
})

describe('② ملخّصٌ لا نصوص', () => {
  it('⚠️ عددُ التعديلات وخطواتُها، وأسماءُ الخطوات ذاتِ الملاحظة، والتقريرُ بعدد ملفّاته لا بأسمائها', () => {
    const [edits, notes, report] = returnMailAr(base).summary
    expect(edits).toBe('56 تعديلًا جاهزًا — كلُّها اختياريّة. في: «المحاور ومواعيدها» (26)، «المهامّ والمصادر» (30).')
    expect(notes).toBe('ملاحظاتٌ في «المحاور ومواعيدها» و«اللقاءات» — كلٌّ في رأس خطوتها.')
    expect(report).toBe('تقريرُ المراجعة (ملفّان) — في صفحة شعبتك تحت «تقرير المراجعة».')
  })

  it('وما لم يكن لا يُذكر — بلا تعديلاتٍ لا «اقبلها كلَّها»، وبلا تقريرٍ لا سطرَ له', () => {
    const m = returnMailAr({ ...base, edits: { count: 0, required: 0, bySteps: [] }, reports: 0 })
    expect(m.summary).toEqual(['ملاحظاتٌ في «المحاور ومواعيدها» و«اللقاءات» — كلٌّ في رأس خطوتها.'])
    expect(m.steps.join(' ')).not.toContain('اقبلها كلَّها')
    expect(m.cta).toBe('افتح صفحةَ شعبتك')
  })
})

describe('③ والمطلوبُ يُقال', () => {
  it('⚠️ «منها اثنان مطلوبان، والباقي اختياريّ» — وخطوتُه تقول إنّ المطلوبَ شرطُ الاعتماد', () => {
    const m = returnMailAr({ ...base, edits: { ...base.edits, count: 4, required: 2 } })
    expect(m.summary[0]).toMatch(/^4 تعديلات جاهزة — منها اثنان مطلوبان، والباقي اختياريّ/)
    expect(m.summary[0]).not.toContain('كلُّها اختياريّة')
    expect(m.steps[1]).toMatch(/اضغط «اقبلها كلَّها»/)
    expect(m.steps[1]).toMatch(/والمطلوبُ منها شرطُ الاعتماد/)
    expect(returnMailAr({ ...base, edits: { ...base.edits, count: 3, required: 3 } }).summary[0]).toMatch(/— كلُّها مطلوبة/)
  })
})

describe('④ والخدمةُ تبني البريدَ منه', () => {
  const src = readFileSync(join(process.cwd(), 'server/services/cohort-plan.service.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('⚠️ ردُّ الخطّة يمرّر `returnMailAr` بكلمة الإدارة وحدَها — ويُرسَل البريدُ من `returnMailDoc`', () => {
    expect(src).toMatch(/generalNote: asked\.general && asked\.general !== edits\.line \? asked\.general : null,/)
    expect(src).toMatch(/notedSteps: bySection\.map\(\(x\) => x\.label\),/)
    expect(src).toMatch(/if \(msg\.mail\) \{[\s\S]{0,300}renderMail\(returnMailDoc\(msg\.mail, trainer\.application\.fullName, url\)\)/)
    expect(src).not.toContain('راجعنا خطّةَ شعبتك ونحتاج تعديلا قبل اعتمادها')
  })

  it('والرسالةُ بترتيبها: الشكرُ، فالكلمة، فما جهّزناه، فالخطوات، فالزرّ', () => {
    const doc = src.slice(src.indexOf('export function returnMailDoc'))
    const at = (k: string) => doc.indexOf(k)
    expect(at("{ kind: 'p', text: m.praise }")).toBeGreaterThan(0)
    expect(at("{ kind: 'p', text: m.praise }")).toBeLessThan(at("kind: 'callout' as const, text: m.note"))
    expect(at("kind: 'callout' as const, text: m.note")).toBeLessThan(at("items: m.summary"))
    expect(at('items: m.summary')).toBeLessThan(at("{ kind: 'steps', items: m.steps"))
    expect(at("{ kind: 'steps', items: m.steps")).toBeLessThan(at("{ kind: 'cta', label: m.cta"))
  })
})

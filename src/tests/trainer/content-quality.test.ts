/* جودةُ المحتوى النظريّ (١١ أكتوبر ٢٠٢٦) — نصيحةٌ تُقرأ من المتن، بسببها وبما يُصلحها.

   يُبنى متنٌ سليمٌ يمرّ بكلّ فحص، ثمّ يُنقض منه شيءٌ واحدٌ في كلّ اختبار فيُرى
   الصفُّ الذي يسقط — `advice` لا `blocked`، ولا يسقط معه غيرُه. */

import { describe, expect, it } from 'vitest'
import { MIN_THEORY_WORDS, contentQuality, type QualityModule } from '@/application/trainer/content-quality'
import { blockedItems, planScorecard } from '@/application/trainer/plan-scorecard'
import { RED_PHRASES } from '@/application/content/red-rules'

/** متنٌ سليم: طولٌ يكفي، ومثالٌ محلول، وخطأٌ شائع، ونسبةٌ بمصدرها */
const SOUND = [
  'حين يرفع المتجرُ سعرَه بلا خطّة يخسر نصفَ زبائنه في شهر.',
  'شرحُ الفكرة '.repeat(MIN_THEORY_WORDS / 2),
  '### مثالٌ محلول',
  'لنفترض أنّ متجرا في عمّان يبيع القهوة بدينارين.',
  '### الخطأ الشائع',
  'أن يُقاس السعرُ بكلفة البضاعة وحدَها.',
  'وارتفعت المبيعاتُ ١٢٪ بحسب تقرير البنك المركزيّ لسنة ٢٠٢٤.',
].join('\n\n')

const mod = (bodyAr: string, extra: Partial<QualityModule> = {}): QualityModule => ({ moduleId: 'M1', bodyAr, ...extra })
const q = (bodyAr: string, extra: Partial<QualityModule> = {}) => contentQuality([mod(bodyAr, extra)])

describe('المتنُ السليم يمرّ', () => {
  it('لا عمقَ ناقصا ولا لغةً ولا رقما', () => {
    expect(q(SOUND)).toEqual({ read: 1, files: 0, depth: [], style: [], claims: [] })
  })
})

describe('① العمق', () => {
  it('متنٌ قصير', () => {
    const r = q('لنفترض مثالا عن خطأٍ شائعٍ في التسعير.')
    expect(r.depth).toEqual([`المحور 1: 7 كلمةً — اشرح الفكرةَ في ${MIN_THEORY_WORDS} كلمةً على الأقلّ`])
  })
  it('بلا مثال', () => {
    const r = q(SOUND.replace('### مثالٌ محلول', '').replace('لنفترض', 'قيل'))
    expect(r.depth).toEqual(['المحور 1: بلا مثالٍ محلول — أضف حالةً من سوقٍ عربيّ تُحلّ خطوةً خطوة'])
  })
  it('بلا خطأٍ شائع', () => {
    const r = q(SOUND.replace('### الخطأ الشائع', ''))
    expect(r.depth).toEqual(['المحور 1: لا يذكر خطأً شائعا — اكتب الخطأَ الذي يقع فيه المبتدئ وكيف يتجنّبه'])
  })
})

describe('② اللغة', () => {
  it('الحشوُ يُطابَق بلا تشكيلٍ وبهمزةٍ أخرى — ومرّةً واحدة', () => {
    const r = q(`${SOUND}\n\nتجدر الاشارة إلى السعر. وتجدر الإشارة مرّةً ثانية.`)
    expect(r.style).toEqual(['المحور 1: «تجدر الإشارة» — حشوٌ — احذفها وقل المعنى مباشرةً'])
  })
  it('والنداءُ في التطبيق العمليّ يُقرأ كما في المتن', () => {
    const r = q(SOUND, { activityAr: 'عزيزي المتعلم، حلّل الحالة' })
    expect(r.style).toEqual(['المحور 1: «عزيزي المتعلم» — خاطِب المتعلّمَ مباشرةً بلا نداء'])
  })
  it('التعريفُ المعجميُّ في رأس الفقرة — لا «يعرف» في وسط الجملة', () => {
    expect(q(`يُعرَّف التسعيرُ بأنّه تحديدُ قيمة السلعة.\n\n${SOUND}`).style)
      .toEqual(['المحور 1: فقرةٌ تبدأ بتعريفٍ معجميّ — ابدأ بموقفٍ أو مشكلةٍ ثمّ سمِّ المفهوم'])
    expect(q(`${SOUND}\n\nلا يعرف العميلُ ما يريد حتّى يراه.`).style).toEqual([])
  })
  it('والمقتبسُ بعلامة الشيفرة لا يُدان', () => {
    expect(q(`${SOUND}\n\nامنع في طلبك \`تجدر الإشارة\`.`).style).toEqual([])
  })
  it('وكلُّ عبارةٍ من القواعد الحمراء تُلتقط — إلّا «يُعرَّف» التي تُقرأ بموضعها', () => {
    for (const p of RED_PHRASES) {
      if (p.startsWith('يُعرَّف') || p.startsWith('يعرف')) continue
      expect(q(`${SOUND}\n\n${p} شيءٌ.`).style.length, p).toBe(1)
    }
  })
})

describe('③ الأرقامُ والوعود', () => {
  it('نسبةٌ بلا مصدر', () => {
    const r = q(`${SOUND}\n\nويخسر ٧٠٪ من المتاجر زبائنَها.`)
    expect(r.claims).toEqual(['المحور 1: نسبةٌ بلا مصدر «ويخسر ٧٠٪ من المتاجر زبائنَها.» — اذكر مصدرَها وسنتَها في الجملة نفسِها، أو احذف الرقمَ وقل المعنى'])
  })
  it('ووعدٌ بوظيفة', () => {
    expect(q(SOUND, { outcomeAr: 'ستحصل على وظيفة بعد المحور' }).claims)
      .toEqual(['المحور 1: «ستحصل على وظيفة» — وعدٌ لا يقيسه المحور — قل ما يقدر عليه المتعلّمُ بعده'])
  })
})

describe('في بطاقة المعايير', () => {
  const input = (modules: QualityModule[]) => ({ period: null, content: { modules, resources: [] }, sessions: [], assessments: [] })
  const rows = (modules: QualityModule[]) => planScorecard(input(modules)).filter((i) => i.key.startsWith('content_'))

  it('ثلاثةُ صفوفٍ نصيحةً لا حاجزا — في خطوة المحاور', () => {
    const r = rows([mod('قصير'), { moduleId: 'M2', bodyFileKey: 'k' }])
    expect(r.map((i) => `${i.key}:${i.status}:${i.step}:${i.required}`)).toEqual([
      'content_depth:advice:modules:false', 'content_style:ok:modules:false', 'content_claims:ok:modules:false',
    ])
    expect(r[0]!.measuredAr).toBe('قُرئ متنُ 1 من 2 محاور — و1 مرفوعةٌ ملفّا يقرؤها المعتمِد')
    expect(blockedItems(r)).toEqual([])
  })
  it('ولا صفَّ حين لا متنَ مكتوبا يُقرأ', () => {
    expect(rows([{ moduleId: 'M1', bodyFileKey: 'k' }, { moduleId: 'M2' }])).toEqual([])
  })
})

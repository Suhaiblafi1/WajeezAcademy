/* جودةُ المحتوى النظريّ (١١ أكتوبر ٢٠٢٦) — نصيحةٌ تُقرأ من المتن، بسببها وبما يُصلحها.

   يُبنى متنٌ سليمٌ يمرّ بكلّ فحص، ثمّ يُنقض منه شيءٌ واحدٌ في كلّ اختبار فيُرى
   الصفُّ الذي يسقط — `advice` لا `blocked`، ولا يسقط معه غيرُه. */

import { describe, expect as vexpect, it } from 'vitest'
import { plainAr } from '@/application/text/plain-ar'
/* ما يُفحص بلا تشكيلٍ إعرابيّ — بعضُ ما يُقرأ هنا بعد «اللغة البيضاء» وبعضُه (الخادمُ والعقودُ والتشخيص) قبلها */
const plainDeep = (v: unknown): unknown =>
  typeof v === 'string' ? plainAr(v) : Array.isArray(v) ? v.map(plainDeep)
    : v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plainDeep(x)])) : v
const expect = Object.assign((v: unknown, m?: string) => vexpect(plainDeep(v), m), vexpect) as typeof vexpect
import { MIN_THEORY_WORDS, contentQuality, definitionOpener, type QualityModule } from '@/application/trainer/content-quality'
import { blockedItems, planScorecard } from '@/application/trainer/plan-scorecard'
import { RED_PHRASES } from '@/application/content/red-rules'

/** متنٌ سليم: طولٌ يكفي، ومثالٌ محلول، وخطأٌ شائع، ونسبةٌ بمصدرها */
const SOUND = [
  'حين يرفع المتجر سعره بلا خطّة يخسر نصف زبائنه في شهر.',
  'شرح الفكرة '.repeat(MIN_THEORY_WORDS / 2),
  '### مثال محلول',
  'لنفترض أنّ متجرا في عمّان يبيع القهوة بدينارين.',
  '### الخطأ الشائع',
  'أن يقاس السعر بكلفة البضاعة وحدها.',
  'وارتفعت المبيعات ١٢٪ بحسب تقرير البنك المركزيّ لسنة ٢٠٢٤.',
].join('\n\n')

const mod = (bodyAr: string, extra: Partial<QualityModule> = {}): QualityModule => ({ moduleId: 'M1', bodyAr, ...extra })
const q = (bodyAr: string, extra: Partial<QualityModule> = {}) => contentQuality([mod(bodyAr, extra)])

describe('المتن السليم يمرّ', () => {
  it('لا عمق ناقصا ولا لغة ولا رقما', () => {
    expect(q(SOUND)).toEqual({ read: 1, files: 0, depth: [], style: [], claims: [] })
  })
})

describe('① العمق', () => {
  it('متن قصير', () => {
    const r = q('لنفترض مثالا عن خطأ شائع في التسعير.')
    expect(r.depth).toEqual([`المحور 1: 7 كلمة — اشرح الفكرة في ${MIN_THEORY_WORDS} كلمة على الأقلّ`])
  })
  it('بلا مثال', () => {
    const r = q(SOUND.replace('### مثال محلول', '').replace('لنفترض', 'قيل'))
    expect(r.depth).toEqual(['المحور 1: بلا مثال محلول — أضف حالة من سوق عربيّ تحلّ خطوة خطوة'])
  })
  it('بلا خطأ شائع', () => {
    const r = q(SOUND.replace('### الخطأ الشائع', ''))
    expect(r.depth).toEqual(['المحور 1: لا يسمّي خطأ شائعا — اكتبه في فقرة باسمه: ما يفعله المبتدئ، ولماذا يبدو صحيحا، وكيف يتجنّبه'])
  })
  it('⚠️ والكلمة تامّة لا جزء كلمة: «خطاب» ليست «خطأ»، و«تجنّبها» ليست خطأ شائعا', () => {
    const without = SOUND.replace('### الخطأ الشائع', '')
    expect(q(`${without}\n\nألق الخطاب واقفا.`).depth).toHaveLength(1)
    expect(q(`${without}\n\nهذه عقبات تجنّبها.`).depth).toHaveLength(1)
    expect(q(`${without}\n\nيظنّ كثيرون أنّ السعر الأعلى يطرد الزبون.`).depth).toEqual([])
    expect(q(`${without}\n\nومن أخطائهم أن يقيسوا الكلفة.`).depth).toEqual([])
  })
  it('و«مثاليّ» ليست «مثالا»', () => {
    expect(q(SOUND.replace('### مثال محلول', '').replace('لنفترض', 'قيل') + '\n\nالسعر المثاليّ يحسب.').depth).toHaveLength(1)
  })
})

describe('② اللغة', () => {
  it('الحشو يطابق بلا تشكيل وبهمزة أخرى — ومرّة واحدة', () => {
    const r = q(`${SOUND}\n\nتجدر الاشارة إلى السعر. وتجدر الإشارة مرّة ثانية.`)
    expect(r.style).toEqual(['المحور 1: «تجدر الإشارة» — حشو — احذفها وقل المعنى مباشرة'])
  })
  it('والنداء في التطبيق العمليّ يقرأ كما في المتن — وبأيّ صفة', () => {
    expect(q(SOUND, { activityAr: 'عزيزي المتعلم، حلّل الحالة' }).style)
      .toEqual(['المحور 1: «عزيزي المتعلم» — خاطب المتعلّم مباشرة بلا نداء'])
    expect(q(`${SOUND}\n\nعزيزي المدير، راجع فريقك.`).style)
      .toEqual(['المحور 1: «عزيزي المدير» — خاطب المتعلّم مباشرة بلا نداء'])
    expect(q(`${SOUND}\n\nقال لي أخي الأكبر إنّ السعر مرتفع.`).style).toEqual([])
  })
  it('فاتحة «في هذا المحور ستتعرّف» بفاصلتها وبلاها', () => {
    const line = ['المحور 1: «في هذا المحور ستتعرّف على…» — احذفها؛ العنوان يقول ما في المحور، فابدأ بموقف أو سؤال']
    expect(q(`في هذا المحور، ستتعرف على التسعير.\n\n${SOUND}`).style).toEqual(line)
    expect(q(`في هذا الدرس سنتعلّم التسعير.\n\n${SOUND}`).style).toEqual(line)
    expect(q(`${SOUND}\n\nفي هذا المحور أمثلة كثيرة.`).style).toEqual([])
  })
  it('«من المهمّ أن» مرّة تحتمل — وتكرارها حشو', () => {
    expect(q(`${SOUND}\n\nمن المهم أن تسأل.`).style).toEqual([])
    expect(q(`${SOUND}\n\nمن المهم أن تسأل. ومن المهمّ جدّا أن تسمع.`).style)
      .toEqual(['المحور 1: «من المهمّ أن» 2 مرّات — قل الأمر مباشرة: «افعل كذا» بدل «من المهمّ أن تفعل كذا»'])
  })
  it('التعريف المعجميّ في رأس الفقرة — «يعرّف X بأنّه» و«X هو/هي عمليّة…»', () => {
    expect(q(`يعرّف التسعير بأنّه تحديد قيمة السلعة.\n\n${SOUND}`).style)
      .toEqual(['المحور 1: فقرة تبدأ بتعريف معجميّ «يعرّف التسعير بأنّه تحديد قيمة السلعة.» — ابدأ بموقف أو مشكلة ثمّ سمّ المفهوم'])
    expect(q(`${SOUND}\n\nلا يعرف العميل ما يريد حتّى يراه.`).style).toEqual([])
    for (const def of [
      'رحلة المستفيد هي مجموعة المراحل التي يمرّ بها.',
      'الإقناع هو عمليّة تواصل تهدف إلى الفهم.',
      'أصحاب المصلحة هم الأفراد والجهات الذين يتأثّرون بالقرار.',
      '- نقطة الألم هي العائق الذي يواجهه المستفيد.',
      'أولا: المصداقيّة هي الأساس الذي يبنى عليه الإقناع.',
    ]) expect(definitionOpener(def), def).not.toBeNull()
    for (const not of [
      'والمرحلة الثانية هي التي تصدّق الأولى.',
      'الجزء الثالث هو الذي يقلب السؤال لصالحك.',
      'ليست الحاجة دائما هي الطلب الظاهر الذي يعبّر عنه العميل.',
      'السبب هو غياب خطّة واضحة.',
      'المشكلة هي أنّ الفريق لا يقيس.',
      '## البحث عن فرصة هو نظام لا قائمة',
      'في السوق اليوم منافسون كثيرون.',
    ]) expect(definitionOpener(not), not).toBeNull()
  })
  it('والمقتبس بعلامة الشيفرة لا يدان', () => {
    expect(q(`${SOUND}\n\nامنع في طلبك \`تجدر الإشارة\`.`).style).toEqual([])
  })
  it('وكلّ عبارة من القواعد الحمراء تلتقط — إلّا «يعرّف» التي تقرأ بموضعها', () => {
    for (const p of RED_PHRASES) {
      if (plainAr(p).startsWith('يعرّف') || plainAr(p).startsWith('يعرف')) continue
      expect(q(`${SOUND}\n\n${p} شيء.`).style.length, p).toBe(1)
    }
  })
})

describe('③ الأرقام والوعود', () => {
  it('نسبة بلا مصدر ولا سنة — سطر واحد للمحور بعدد ما فيه', () => {
    const r = q(`${SOUND}\n\nويخسر ٧٠٪ من المتاجر زبائنها. ويعود ٢٠٪ منهم بعد شهر.`)
    expect(r.claims).toEqual(['المحور 1: نسبة بلا مصدر ولا سنة «ويخسر ٧٠٪ من المتاجر زبائنها.» و1 غيرها — ما كان حقيقة عن الناس أو السوق فاذكر مصدره وسنته في الجملة نفسها، وما كان حسابا في مثال يبقى كما هو'])
  })
  it('⚠️ و«تؤكّد أحدث الدراسات» بلا سنة ليست مصدرا — والسنة أو «المصدر:» مصدر', () => {
    expect(q(`${SOUND}\n\nتؤكد أحدث الدراسات أن ٧٠٪ من التعلّم بالممارسة.`).claims).toHaveLength(1)
    expect(q(`${SOUND}\n\nتعلّم ٧٠٪ بالممارسة (لومباردو وآيشنغر، ١٩٩٦).`).claims).toEqual([])
    expect(q(`${SOUND}\n\nيرى ٤٠٪ من الموظفين ذلك. المصدر: مسح الأجور.`).claims).toHaveLength(1)
    expect(q(`${SOUND}\n\nيرى ٤٠٪ من الموظفين ذلك (المصدر: مسح الأجور ٢٠٢٥).`).claims).toEqual([])
  })
  it('والهدف والافتراض في المثال ليسا إحصاء', () => {
    expect(q(`${SOUND}\n\nمعيار النجاح: رفع نسبة رضا العملاء إلى 85% على الأقل.`).claims).toEqual([])
    expect(q(`${SOUND}\n\nلنفترض أنّ التضخّم ٣٪ سنويّا.`).claims).toEqual([])
    expect(q(`${SOUND}\n\nإذا كانت ٧٠٪ من إجاباتك «لا» فابدأ بالمحور الثاني.`).claims).toEqual([])
  })
  it('ووعد بوظيفة', () => {
    expect(q(SOUND, { outcomeAr: 'ستحصل على وظيفة بعد المحور' }).claims)
      .toEqual(['المحور 1: «ستحصل على وظيفة» — وعد لا يقيسه المحور — قل ما يقدر عليه المتعلّم بعده'])
  })
})

describe('في بطاقة المعايير', () => {
  const input = (modules: QualityModule[]) => ({ period: null, content: { modules, resources: [] }, sessions: [], assessments: [] })
  const rows = (modules: QualityModule[]) => planScorecard(input(modules)).filter((i) => i.key.startsWith('content_'))

  it('ثلاثة صفوف نصيحة لا حاجزا — في خطوة المحاور', () => {
    const r = rows([mod('قصير'), { moduleId: 'M2', bodyFileKey: 'k' }])
    expect(r.map((i) => `${i.key}:${i.status}:${i.step}:${i.required}`)).toEqual([
      'content_depth:advice:modules:false', 'content_style:ok:modules:false', 'content_claims:ok:modules:false',
    ])
    expect(r[0]!.measuredAr).toBe('قرئ متن 1 من 2 محاور — و1 مرفوعة ملفّا يقرؤها المعتمد')
    expect(blockedItems(r)).toEqual([])
  })
  it('ولا صفّ حين لا متن مكتوبا يقرأ', () => {
    expect(rows([{ moduleId: 'M1', bodyFileKey: 'k' }, { moduleId: 'M2' }])).toEqual([])
  })
})

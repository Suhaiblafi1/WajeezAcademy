import { describe, expect, it } from 'vitest'
import {
  MAX_NODES, entryOf, isTerminal, nodeOf, nodesReachingEnd, parseScenario, reachableNodes, replayPath, validateScenario,
} from '../../application/content/scenario'

const GOOD = [
  'موقف: أنت مسؤول عمليات، ومديرك يطلب أتمتة الفواتير في أسبوعين.',
  '',
  'عقدة: الطلب على مكتبك',
  'نص: ما أول ما تفعله؟',
  '> خيار: أشتري أداة اليوم',
  '  أثر: وفّرت أسبوعا في الاختيار وخسرت ثلاثة في التطبيق.',
  '  إلى: أداة قبل عملية',
  '> خيار: أرسم العملية أولا',
  '  أثر: ظهر أن ٤٠٪ من الفواتير تحتاج قرارا تقديريا.',
  '  إلى: العملية مرسومة',
  '',
  'عقدة: أداة قبل عملية',
  'نص: الأداة تعمل والعملية مكسورة.',
  'تأمل: ما الذي كان سيغيّر النتيجة لو قدّمته؟',
  '',
  'عقدة: العملية مرسومة',
  'نص: عرفت ما يُؤتمت وما يبقى بشريا.',
  'تأمل: أي خطوة كانت الأصعب في الرسم ولماذا؟',
].join('\n')

describe('ح-٥ تحليل السيناريو', () => {
  it('يقرأ الموقف والعقد والخيارات وآثارها ومساراتها', () => {
    const { scenario, errorsAr } = parseScenario(GOOD)
    expect(errorsAr).toEqual([])
    expect(scenario!.situationAr).toContain('أسبوعين')
    expect(scenario!.nodes).toHaveLength(3)
    const entry = entryOf(scenario!)!
    expect(entry.titleAr).toBe('الطلب على مكتبك')
    expect(entry.options).toHaveLength(2)
    expect(entry.options[0].effectAr).toContain('خسرت')
    expect(entry.options[1].toNode).toBe('العملية مرسومة')
    expect(isTerminal(nodeOf(scenario!, 'أداة قبل عملية')!)).toBe(true)
    expect(nodeOf(scenario!, 'أداة قبل عملية')!.reflectAr).toContain('النتيجة')
  })

  it('نصّ فارغ لا سيناريو ولا خطأ', () => {
    expect(parseScenario('').scenario).toBeNull()
    expect(parseScenario(null).errorsAr).toEqual([])
  })

  it('سطر غير مفهوم يُبلَّغ بنصّه', () => {
    expect(parseScenario('عقدة: أ\nكلام حر').errorsAr[0]).toContain('كلام حر')
  })

  it('السيناريو الصحيح يمرّ المدقّق', () => {
    expect(validateScenario(GOOD)).toEqual({ ok: true })
  })
})

describe('ح-٥ المدقّق — يمنع ما يبدو صحيحا وهو معطوب', () => {
  const errors = (raw: string) => {
    const r = validateScenario(raw)
    expect(r.ok).toBe(false)
    return (r as { ok: false; errorsAr: string[] }).errorsAr.join(' | ')
  }

  it('خيار واحد ليس قرارا', () => {
    const one = GOOD.replace(['> خيار: أرسم العملية أولا', '  أثر: ظهر أن ٤٠٪ من الفواتير تحتاج قرارا تقديريا.', '  إلى: العملية مرسومة'].join('\n'), '')
    expect(errors(one)).toContain('خيار واحد ليس قرارا')
  })

  it('«إلى:» إلى عقدة غير موجودة', () => {
    expect(errors(GOOD.replace('إلى: أداة قبل عملية', 'إلى: عقدة وهمية'))).toContain('لا تطابق أي عقدة')
  })

  it('خيار بلا «إلى:» يُبلَّغ ولا يُمرَّر', () => {
    expect(errors(GOOD.replace('  إلى: أداة قبل عملية\n', ''))).toContain('بلا «إلى:»')
  })

  it('عقدة لا تُبلَغ من البداية', () => {
    const orphan = `${GOOD}\n\nعقدة: منسية\nنص: لا أحد يصلني.\nتأمل: لماذا؟`
    expect(errors(orphan)).toContain('لا تُبلَغ من البداية')
  })

  it('مصيدة: مسار يدور بلا نهاية', () => {
    const trap = [
      'موقف: موقف.',
      'عقدة: أ',
      'نص: نص أ',
      '> خيار: إلى ب',
      '  إلى: ب',
      '> خيار: ابق في أ',
      '  إلى: أ',
      'عقدة: ب',
      'نص: نص ب',
      '> خيار: عد إلى أ',
      '  إلى: أ',
      '> خيار: ابق في ب',
      '  إلى: ب',
    ].join('\n')
    const e = errors(trap)
    expect(e).toContain('لا عقدة نهائية')
    expect(e).toContain('مصيدة')
  })

  it('عقدة نهائية بلا تأمل', () => {
    expect(errors(GOOD.replace('تأمل: ما الذي كان سيغيّر النتيجة لو قدّمته؟', ''))).toContain('بلا «تأمل:»')
  })

  it('تأمل على عقدة غير نهائية يُرفض — الصيغة لا تُترك ملتبسة', () => {
    expect(errors(GOOD.replace('نص: ما أول ما تفعله؟', 'نص: ما أول ما تفعله؟\nتأمل: سؤال في غير محله'))).toContain('للعقد النهائية فقط')
  })

  it('بلا موقف يُرفض، وعقدة واحدة تُرفض', () => {
    expect(errors(GOOD.replace(/^موقف:.*$/m, ''))).toContain('لا «موقف:»')
    expect(errors('موقف: م.\nعقدة: أ\nنص: ن\nتأمل: ت')).toContain('عقدة واحدة لا تصنع قرارا')
  })

  it('عنوان عقدة مكرَّر يُرفض — العناوين مفاتيح المسار', () => {
    expect(errors(GOOD.replace('عقدة: العملية مرسومة', 'عقدة: أداة قبل عملية'))).toContain('مكرَّر')
  })

  it('تجاوز حدّ العقد يُبلَّغ', () => {
    const many = ['موقف: م.', 'عقدة: بداية', 'نص: ن']
    for (let i = 0; i < MAX_NODES + 1; i++) many.push(`> خيار: خ${i}`, `  إلى: ن${i}`)
    for (let i = 0; i < MAX_NODES + 1; i++) many.push(`عقدة: ن${i}`, 'نص: ن', 'تأمل: ت')
    expect(errors(many.join('\n'))).toContain(`الحدّ ${MAX_NODES}`)
  })
})

describe('ح-٥ الوصول والمسار', () => {
  const s = parseScenario(GOOD).scenario!

  it('كل العقد قابلة للوصول وكلها تبلغ نهاية', () => {
    expect(reachableNodes(s).size).toBe(3)
    expect(nodesReachingEnd(s).size).toBe(3)
  })

  it('إعادة المسار تعيد العقد بالترتيب', () => {
    const r = replayPath(s, [{ node: 'الطلب على مكتبك', optionIndex: 1 }])
    expect(r.valid).toBe(true)
    expect(r.nodes.map((n) => n.titleAr)).toEqual(['الطلب على مكتبك', 'العملية مرسومة'])
  })

  it('خطوة غير صالحة توقف الإعادة ولا ترمي', () => {
    expect(replayPath(s, [{ node: 'الطلب على مكتبك', optionIndex: 9 }]).valid).toBe(false)
    expect(replayPath(s, [{ node: 'عقدة أخرى', optionIndex: 0 }]).valid).toBe(false)
  })
})

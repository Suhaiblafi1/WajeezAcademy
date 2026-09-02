import { describe, expect, it } from 'vitest'
import { MAX_MINUTES, MIN_MINUTES, parsePractice, validatePractice } from '../../application/content/practice'
import { parseRubric, validateRubric } from '../../application/content/rubric'

const GOOD_PRACTICE = [
  'نشاط: خريطةُ رسالةٍ لعرضٍ ستقدّمه فعلا',
  'زمن: 55',
  'مخرَج: خريطةُ رسالةٍ في صفحةٍ واحدة، ملفٌّ يُرفع',
  'بديل: من لا عمل له: عرضُ مشروعٍ جامعيٍّ — نفسُ الخطوات',
  '> خطوة: 10 · اختر عرضا سيُقدَّم خلال شهرٍ واكتب من يقرّر فيه',
  '> خطوة: 20 · اكتب الفكرةَ الرئيسةَ جملةً فيها حكمٌ يُخالَف',
  '> خطوة: 15 · اكتب ثلاثَ ركائزَ ومعها سندُ كلٍّ منها',
  '> خطوة: 10 · اقرأ الخريطةَ وحدَها واحكم: أتُفهَم بلا شرحك؟',
].join('\n')

const GOOD_RUBRIC = [
  'معيار: كلُّ ركيزةٍ معها سندُها',
  '- 3: لكلّ ركيزةٍ سندٌ مسمًّى صنفُه ومكتوبٌ ما يُبطلها',
  '- 2: الركائزُ مسنودةٌ ولا يُذكر ما يُبطلها',
  '- 1: ركيزةٌ أو أكثرُ بلا سندٍ يُرى',
  '',
  'معيار: الفكرةُ الرئيسةُ تُخالَف',
  '- 3: جملةٌ فيها حكمٌ يمكن أن يرفضه زميلٌ معقول',
  '- 2: جملةٌ فيها حكمٌ عامٌّ لا يُنازع فيه أحد',
  '- 1: موضوعٌ مسمًّى بلا حكمٍ يُقبل أو يُرفض',
].join('\n')

describe('ح-٦ تحليل النشاط التطبيقيّ', () => {
  it('يقرأ العنوان والزمن والمخرَج والبديل والخطوات', () => {
    const { practice, errorsAr } = parsePractice(GOOD_PRACTICE)
    expect(errorsAr).toEqual([])
    expect(practice?.minutes).toBe(55)
    expect(practice?.steps).toHaveLength(4)
    expect(practice?.steps[1].minutes).toBe(20)
    expect(practice?.artifactAr).toContain('ملفٌّ يُرفع')
    expect(validatePractice(GOOD_PRACTICE).ok).toBe(true)
  })

  it('يقبل الأرقام العربية في الزمن والخطوات', () => {
    const ar = GOOD_PRACTICE.replace('زمن: 55', 'زمن: ٥٥').replace('> خطوة: 20', '> خطوة: ٢٠')
    const { practice, errorsAr } = parsePractice(ar)
    expect(errorsAr).toEqual([])
    expect(practice?.minutes).toBe(55)
    expect(practice?.steps[1].minutes).toBe(20)
  })

  it('يردّ نشاطا مجموعُ خطواته لا يساوي زمنَه المعلَن', () => {
    const off = GOOD_PRACTICE.replace('> خطوة: 20', '> خطوة: 10')
    const r = validatePractice(off)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorsAr.join(' ')).toMatch(/مجموعُ أزمنة الخطوات 45/)
  })

  it('يردّ زمنا خارج ميزانيّة السياسة', () => {
    const short = ['نشاط: نشاطٌ قصير', 'زمن: 20', 'مخرَج: مذكّرةٌ ترفعها', 'بديل: من لا عمل له: مهمّةٌ بديلةٌ محدَّدة',
      '> خطوة: 10 · الخطوةُ الأولى بما يُفعل', '> خطوة: 5 · الخطوةُ الثانية بما يُفعل', '> خطوة: 5 · الخطوةُ الثالثة بما يُفعل'].join('\n')
    const r = validatePractice(short)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorsAr.join(' ')).toMatch(new RegExp(`${MIN_MINUTES}–${MAX_MINUTES}`))
  })

  it('يردّ مخرَجا هو إجاباتُ الأسئلة، وبديلا يُفتح بـ«تخيّل أنّك»', () => {
    const bad = GOOD_PRACTICE
      .replace('مخرَج: خريطةُ رسالةٍ في صفحةٍ واحدة، ملفٌّ يُرفع', 'مخرَج: إجابات الأسئلة في ملفّ')
      .replace(/بديل: .+/, 'بديل: تخيّل أنّك مديرُ عمليّاتٍ في شركةٍ كبيرة')
    const r = validatePractice(bad)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorsAr.join(' ')).toMatch(/إجابات الأسئلة/)
      expect(r.errorsAr.join(' ')).toMatch(/تخيّل أنّك/)
    }
  })

  it('يردّ نشاطا بلا بديلٍ لمن لا عمل له', () => {
    const r = validatePractice(GOOD_PRACTICE.replace(/بديل: .+\n/, ''))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorsAr.join(' ')).toMatch(/لا «بديل:»/)
  })

  it('لا يعدّ الفراغَ خطأ — الوحدةُ بلا نشاطٍ تُعَدّ ولا تُدان', () => {
    expect(parsePractice(null).errorsAr).toEqual([])
    expect(parsePractice('   ').practice).toBeNull()
  })
})

describe('ح-٧ تحليل الروبرك', () => {
  it('يقرأ المعايير ومستوياتها مرتّبةً من الأعلى', () => {
    const { rubric, errorsAr } = parseRubric(GOOD_RUBRIC)
    expect(errorsAr).toEqual([])
    expect(rubric?.criteria).toHaveLength(2)
    expect(rubric?.criteria[0].levels.map((l) => l.level)).toEqual([3, 2, 1])
    expect(validateRubric(GOOD_RUBRIC).ok).toBe(true)
  })

  it('يردّ مستوًى موصوفا بصفة حكم لا بسلوك', () => {
    const r = validateRubric(GOOD_RUBRIC.replace('- 3: لكلّ ركيزةٍ سندٌ مسمًّى صنفُه ومكتوبٌ ما يُبطلها', '- 3: ممتاز — عملٌ متميّزٌ في بنائه'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorsAr.join(' ')).toMatch(/صفة حكم/)
  })

  it('يردّ معيارا بمستويين', () => {
    const r = validateRubric(GOOD_RUBRIC.replace('- 2: الركائزُ مسنودةٌ ولا يُذكر ما يُبطلها\n', ''))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorsAr.join(' ')).toMatch(/ثلاثةٌ لكلّ معيار/)
  })

  it('يردّ أكثرَ من ثلاثة معايير — §٨: ثلاثةٌ لا أكثر', () => {
    const four = `${GOOD_RUBRIC}\n\nمعيار: ثالث\n- 3: وصفُ سلوكٍ أعلى هنا\n- 2: وصفُ سلوكٍ أوسط هنا\n- 1: وصفُ سلوكٍ أدنى هنا\n\nمعيار: رابع\n- 3: وصفُ سلوكٍ أعلى هنا\n- 2: وصفُ سلوكٍ أوسط هنا\n- 1: وصفُ سلوكٍ أدنى هنا`
    const r = validateRubric(four)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorsAr.join(' ')).toMatch(/عددُ المعايير 4/)
  })

  it('لا يعدّ الفراغَ خطأ', () => {
    expect(parseRubric(undefined).errorsAr).toEqual([])
    expect(parseRubric('').rubric).toBeNull()
  })
})

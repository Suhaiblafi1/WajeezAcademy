/* «لماذا هذا المسار» في صفحة المسار — بطلب صاحب المنصّة (٤ أكتوبر ٢٠٢٦).

   زالت شاشةُ النتيجة فزالت معها البطاقة، وبقي الموقعُ يَعِد بالشرح. فعادت إلى
   صفحة المسار: على المسار الذي هبط عليه التشخيصُ وحدَه، بعد الدورات وقبل
   السعر، ومن مداخلَ تُبنى في موضعٍ واحدٍ للشاشتين.

   والفحصُ البنيويّ يقرأ المصدرَ **بعد نزع تعليقاته**: مرّت في هذا المستودع
   حرّاسٌ خضراءُ لأنّها طابقت نصّا في تعليق. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DiagResult } from '@/data/diagnostic'
import { whyPathwayFacts, whyResultForPathway } from '@/application/plan/why-pathway'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/** المصدرُ بلا تعليقات: تعليقاتُ JSX، ثمّ `/* … *\/`، ثمّ أسطرُ `// …` */
const code = (p: string) =>
  read(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const sample = {
  top: { id: 'PW-STU-002' },
  reasons: ['هدفك: أوّل وظيفة', 'لا سيرةَ جاهزةً بعد'],
  confidenceBand: 'تطابق جيّد',
  resultJson: {
    confidence: { coverage: 0.8, consistency: 0.9, separation: 0.6, evidenceQuality: 0.7, stability: 0.85, total: 0.77 },
    strong_blockers_ar: ['فارقٌ صغيرٌ عن المسار التالي'],
    evidence_basis: { measured: 3, measurable: 7, unknown: 2 },
    change_makers_ar: ['لو كان هدفك تطويرَ مهارةٍ محدّدة'],
  },
} as unknown as DiagResult

describe('مداخلُ البطاقة من النتيجة — كما حسبها المحرّك', () => {
  it('تحمل الأسبابَ والأدلّةَ والصنفَ والموانعَ والأساسَ وما يغيّر النتيجة', () => {
    const f = whyPathwayFacts(sample)
    expect(f.reasons).toEqual(sample.reasons)
    expect(f.confidence?.total).toBe(0.77)
    expect(f.bandAr).toBe('تطابق جيّد')
    expect(f.blockers).toEqual(['فارقٌ صغيرٌ عن المسار التالي'])
    expect(f.basis).toEqual({ measured: 3, measurable: 7, unknown: 2 })
    expect(f.changeMakers).toEqual(['لو كان هدفك تطويرَ مهارةٍ محدّدة'])
  })

  it('وما لم يحسبه المحرّك يبقى فارغا — لا يُختلق', () => {
    const f = whyPathwayFacts({ ...sample, resultJson: {} } as unknown as DiagResult)
    expect(f.confidence).toBeUndefined()
    expect(f.blockers).toEqual([])
    expect(f.basis).toBeNull()
    expect(f.changeMakers).toEqual([])
  })
})

describe('تُشرح على المسار الذي هبط عليه التشخيصُ وحدَه', () => {
  it('⚠️ على مساره: تُقرأ النتيجة', () => {
    expect(whyResultForPathway('PW-STU-002', 'PW-STU-002', () => sample)).toBe(sample)
  })

  it('⚠️ وعلى مسارٍ غيرِه: لا شيء — ولا تُقرأ النتيجةُ أصلا', () => {
    let reads = 0
    const load = () => {
      reads++
      return sample
    }
    expect(whyResultForPathway('PW-MKT-001', 'PW-STU-002', load)).toBeNull()
    expect(whyResultForPathway('PW-STU-002', null, load)).toBeNull()
    expect(whyResultForPathway('', '', load)).toBeNull()
    expect(reads, 'قُرئت نتيجةٌ لتُشرح على مسارٍ لم يهبط عليه التشخيص').toBe(0)
  })

  it('ومَن لم تُحفظ له نتيجة: لا بطاقة', () => {
    expect(whyResultForPathway('PW-STU-002', 'PW-STU-002', () => null)).toBeNull()
  })
})

describe('وفي صفحة المسار: بعد الدورات، وقبل الإحالة والسعر', () => {
  const page = code('src/pages/Pathway.tsx')

  it('⚠️ البطاقةُ تُبنى من النتيجة المختارة بالمداخل المشتركة', () => {
    expect(page).toMatch(/whyResultForPathway\(\s*id \?\? "",\s*diagTopId,/)
    expect(page).toContain('<WhyThisPathway {...whyPathwayFacts(whyResult)}')
  })

  it('⚠️ وموضعُها: بعد رحلة الدورات، وقبل إحالة المستشار، وقبل لوح الشراء', () => {
    const at = (s: string) => {
      const i = page.indexOf(s)
      expect(i, `لم يُعثر على ${s}`).toBeGreaterThan(-1)
      return i
    }
    const why = at('<WhyThisPathway')
    expect(at('<CourseJourney'), 'البطاقةُ قبل الدورات — يُقرأ التبريرُ قبل المبرَّر').toBeLessThan(why)
    expect(why, 'البطاقةُ بعد إحالة المستشار').toBeLessThan(at('{advisorReferral && ('))
    expect(why, 'البطاقةُ بعد لوح الشراء').toBeLessThan(at('id="buy"'))
  })

  it('والشاشتان تبنيانها من موضعٍ واحد — لا اشتقاقَ ثانيا في شاشة النتيجة', () => {
    const diag = code('src/pages/Diagnostic.tsx')
    expect(diag).toContain('<WhyThisPathway {...whyPathwayFacts(result)}')
    expect(diag, 'شاشةُ النتيجة تشتقّ مداخلَ البطاقة بيدها من جديد').not.toContain('strong_blockers_ar')
  })
})

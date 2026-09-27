import { describe, expect, it } from 'vitest'
import { CATALOG_SCOPE_MIN_PUBLISHED, catalogScopeGate } from '../../application/catalog/scope-policy'

describe('هـ-١ نطاق الشعبة هو الافتراضي', () => {
  it('مدرب جديد: نطاق الكتالوج مغلق، والرسالة تقول ما يملكه وما يبلغه به', () => {
    const g = catalogScopeGate({ grantedAt: null, publishedCohortProposals: 0 })
    expect(g.allowed).toBe(false)
    expect(g.basis).toBe('none')
    expect(g.reasonAr).toContain('نطاق شعبتك')
    expect(g.reasonAr).toContain(`بقي ${CATALOG_SCOPE_MIN_PUBLISHED}`)
  })

  it('سجل مثبت يفتح النطاق — مقياس لا رأي', () => {
    const g = catalogScopeGate({ grantedAt: null, publishedCohortProposals: CATALOG_SCOPE_MIN_PUBLISHED })
    expect(g.allowed).toBe(true)
    expect(g.basis).toBe('earned')
    expect(g.reasonAr).toContain('سجلك')
  })

  it('دون الحدّ بواحد يبقى مغلقا — الحدّ حدّ لا تقريب', () => {
    const g = catalogScopeGate({ grantedAt: null, publishedCohortProposals: CATALOG_SCOPE_MIN_PUBLISHED - 1 })
    expect(g.allowed).toBe(false)
    expect(g.reasonAr).toContain('بقي 1')
  })

  it('المنح الصريح يتقدّم على السجل ولا يحتاجه', () => {
    const g = catalogScopeGate({ grantedAt: '2026-08-01T00:00:00.000Z', publishedCohortProposals: 0 })
    expect(g.allowed).toBe(true)
    expect(g.basis).toBe('granted')
  })

  it('الرسالة تشرح لماذا النطاق أوسع — لا «ممنوع» بلا سبب', () => {
    const g = catalogScopeGate({ grantedAt: null, publishedCohortProposals: 1 })
    expect(g.reasonAr).toContain('كل مسار وقالب وشعبة')
  })
})

/* ═══ ودورتُه هو — الأساسُ الثالث (٢٧ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «الخيار الأول» — يُفتح له ما أُهِّل له، لا الكتالوجُ
   كلُّه. وعلّةُ البوّابة مكتوبةٌ في رأس الملفّ: النطاقُ الأوسعُ «يصل إلى كلّ
   مسار وقالب وشعبة تستخدم الدورة». فحيث لا يستخدمها شيءٌ فلا وصولَ، فلا
   شيءَ تحرسه البوّابةُ أصلا — والحدُّ «اقتراحان منشوران» بديلٌ عن قياس
   الوصول، لا الوصولُ نفسُه.

   والفَرقُ دقيق: مؤهَّلٌ لدورةٍ يستخدمها مسارٌ ← تبقى البوّابةُ. */
describe('هـ-١ ودورتُه المؤهَّلُ لها التي لا يستخدمها أحد', () => {
  it('مؤهَّلٌ ولا يستخدمها أحد: يُفتح — والأساسُ يُسمّى', () => {
    const g = catalogScopeGate({
      grantedAt: null, publishedCohortProposals: 0,
      qualifiedForCourse: true, courseUnused: true,
    })
    expect(g.allowed).toBe(true)
    expect(g.basis).toBe('qualified_unused')
  })

  it('والرسالةُ تقول لماذا فُتح — لا «مسموح» بلا سبب', () => {
    const g = catalogScopeGate({
      grantedAt: null, publishedCohortProposals: 0,
      qualifiedForCourse: true, courseUnused: true,
    })
    expect(g.reasonAr).toContain('لا يستخدمها')
  })

  it('مؤهَّلٌ لدورةٍ يستخدمها مسارٌ أو قالبٌ أو شعبة: تبقى البوّابة', () => {
    const g = catalogScopeGate({
      grantedAt: null, publishedCohortProposals: 0,
      qualifiedForCourse: true, courseUnused: false,
    })
    expect(g.allowed).toBe(false)
    expect(g.basis).toBe('none')
  })

  it('غيرُ مؤهَّلٍ لدورةٍ خاليةٍ: لا يُفتح — الخلوُّ وحدَه ليس إذنا', () => {
    const g = catalogScopeGate({
      grantedAt: null, publishedCohortProposals: 0,
      qualifiedForCourse: false, courseUnused: true,
    })
    expect(g.allowed).toBe(false)
    expect(g.basis).toBe('none')
  })

  it('والمنحُ الصريحُ يتقدّم فيُسمّى `granted` لا `qualified_unused`', () => {
    const g = catalogScopeGate({
      grantedAt: '2026-08-01T00:00:00.000Z', publishedCohortProposals: 0,
      qualifiedForCourse: true, courseUnused: true,
    })
    expect(g.basis).toBe('granted')
  })

  it('وحين لا تُذكر الحقيقتان يبقى الحكمُ كما كان — لا تتبدّل حالٌ قائمة', () => {
    const g = catalogScopeGate({ grantedAt: null, publishedCohortProposals: 0 })
    expect(g.allowed).toBe(false)
    expect(g.basis).toBe('none')
  })

  it('والمغلقُ يُقال له إنّ دوراتَه مفتوحةٌ — فلا تكذب شاشةُ «مؤهّلاتي»', () => {
    const g = catalogScopeGate({ grantedAt: null, publishedCohortProposals: 0 })
    expect(g.reasonAr).toContain('دوراتُك')
  })
})

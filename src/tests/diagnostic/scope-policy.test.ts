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

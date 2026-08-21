import { describe, expect, it } from 'vitest'
import { launchPathways, courseById } from '../../domain/diagnostic/catalog'
import { auditStandard, recommendationUniverse } from '../../domain/diagnostic/v2_1/universe'
import { validateCatalogSource, COURSE_HOURS_MIN, COURSE_HOURS_MAX } from '../../../server/catalog/validate-source'

describe('أ-١ بوابة المصدر — الكتالوج المنشور يجتازها', () => {
  const r = validateCatalogSource()

  it('لا عطل واحد في ملفات المصدر', () => {
    expect(r.errorsAr).toEqual([])
  })

  it('تُبلّغ ما لا يجتازه الكتالوج تحذيرا لا خطأ — الحجب يمحو نصف الترشيحات', () => {
    /* عشرة مسارات بلا مهارة مقيسة اليوم: واقعة تُعلَن ولا تُفشل الاستيراد */
    expect(r.stats.pathwaysWithoutMeasurableSkill.length).toBeGreaterThan(0)
    expect(r.warningsAr.join(' ')).toContain('بلا مهارة مقيسة')
  })

  it('تُحصي ما فحصته — فحص لا يقول ما فحصه لا يُثق به', () => {
    expect(r.stats.pathways).toBe(launchPathways.length)
    expect(r.stats.courses).toBeGreaterThan(50)
    expect(r.stats.skills).toBeGreaterThan(200)
  })

  it('حدود الساعات معلنة ومعقولة', () => {
    expect(COURSE_HOURS_MIN).toBeGreaterThanOrEqual(1)
    expect(COURSE_HOURS_MAX).toBeGreaterThan(COURSE_HOURS_MIN)
  })
})

describe('أ-٣ تدقيق المسار القياسي', () => {
  it('كل مسار منشور معتمد بنيويا — البوابة تمنع الانحدار ولا تُسقط الحاضر', () => {
    const blocked = launchPathways.map((p) => auditStandard(p.id)).filter((a) => a.status !== 'approved_active')
    expect(blocked.map((a) => `${a.pathway_id}: ${a.reasons_ar.join(' · ')}`)).toEqual([])
  })

  it('كل مسار له جمهور وأهداف ومجال ودورات موجودة — وهذه هي شروط الحجب', () => {
    for (const p of launchPathways) {
      const a = auditStandard(p.id)
      expect(a.metrics.personas, p.id).toBeGreaterThan(0)
      expect(a.metrics.goals, p.id).toBeGreaterThan(0)
      expect(a.metrics.domains, p.id).toBeGreaterThan(0)
      expect(a.metrics.courses, p.id).toBeGreaterThan(0)
      expect(a.metrics.missing_courses, p.id).toEqual([])
    }
  })

  it('مسار غير موجود يُرفض بسبب مكتوب لا يرمي', () => {
    const a = auditStandard('PW-NOT-REAL')
    expect(a.status).toBe('needs_revision')
    expect(a.reasons_ar[0]).toContain('غير موجود')
  })

  it('ضعف القياس يُبلَّغ ولا يحجب — وإلا سقط نصف الكتالوج من المنافسة', () => {
    const unmeasured = launchPathways
      .map((p) => auditStandard(p.id))
      .filter((a) => a.metrics.measurable_skills === 0)
    expect(unmeasured.length).toBeGreaterThan(0)
    for (const a of unmeasured) {
      expect(a.status).toBe('approved_active')
      expect(a.reasons_ar.join(' ')).toContain('أداة فصل')
    }
  })

  it('الحالة تصل إلى الكيان في الفضاء — لا نصّ ثابت', () => {
    const u = recommendationUniverse()
    const standards = u.entities.filter((e) => e.entity_type === 'standard')
    expect(standards).toHaveLength(launchPathways.length)
    for (const e of standards) {
      const a = auditStandard(e.entity_id)
      expect(e.status, e.entity_id).toBe(a.status)
      expect(e.status_reasons_ar, e.entity_id).toEqual(a.reasons_ar)
    }
    /* وكل المسارات ما زالت في المنافسة — لا انحدار في السلوك */
    expect(u.active.filter((e) => e.entity_type === 'standard')).toHaveLength(launchPathways.length)
  })

  it('مقاييس التدقيق تطابق الكتالوج نفسه — لا مصدر ثانٍ للأرقام', () => {
    const p = launchPathways[0]
    const a = auditStandard(p.id)
    expect(a.metrics.courses).toBe(p.course_ids.length)
    expect(p.course_ids.every((c) => courseById.has(c))).toBe(true)
  })
})

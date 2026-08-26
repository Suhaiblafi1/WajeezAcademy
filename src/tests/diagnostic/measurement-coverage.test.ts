/* موجة ٦ · أ-١ — التغطية بثمنها. الاختبارات تحرس ثلاث حقائق:
   الترتيب بالأثر، وعدم خلط «مهارة مقيسة» بـ«مفتاح يُقاس بلا تسجيل»،
   واتفاق هذا التقرير مع بوابة المصدر على الأرقام نفسها. */

import { describe, expect, it } from 'vitest'
import { buildCoverageReport, coverageHeadlineAr } from '../../application/catalog/measurement-coverage'
import { measurableSkills } from '../../domain/diagnostic/v2_1/universe'
import { launchPathways, skillsCatalog } from '../../domain/diagnostic/catalog'
import { skillStateOf } from '../../application/catalog/skill-measurement'

const r = buildCoverageReport()

describe('التغطية لكل مسار', () => {
  it('كل مسار في الكتالوج له سطر', () => {
    expect(r.pathways).toHaveLength(launchPathways.length)
    expect(new Set(r.pathways.map((p) => p.pathwayId)).size).toBe(launchPathways.length)
  })

  it('المسار صفري التغطية يقول ثمنه: الوزن خامل لا «ضعيف»', () => {
    const zero = r.pathways.filter((p) => p.measured === 0)
    expect(zero.length).toBe(r.totals.pathwaysZeroCoverage)
    for (const p of zero) {
      expect(p.coverage).toBe(0)
      expect(p.costAr).toContain('خامل')
      expect(p.costAr).toContain('٢٥٪')
    }
  })

  it('الترتيب من الأسوأ تغطيةً — الأسوأ أولا كي يُرى', () => {
    for (let i = 1; i < r.pathways.length; i++) {
      expect(r.pathways[i].coverage).toBeGreaterThanOrEqual(r.pathways[i - 1].coverage)
    }
  })

  it('التغطية = المقيس ÷ النشط، ولا مقيسٌ أكثر من نشط', () => {
    for (const p of r.pathways) {
      expect(p.measured).toBeLessThanOrEqual(p.activeSkills)
      if (p.activeSkills > 0) expect(p.coverage).toBeCloseTo(p.measured / p.activeSkills, 10)
    }
  })
})

describe('الفجوات مرتبة بالأثر لا بالاستعمال', () => {
  it('ما يفتح أكثر أولا، ثم ما يُستعمل أكثر', () => {
    for (let i = 1; i < r.gaps.length; i++) {
      const a = r.gaps[i - 1], b = r.gaps[i]
      const ka = [a.unlocks.length, a.pathwayIds.length]
      const kb = [b.unlocks.length, b.pathwayIds.length]
      expect(ka[0] >= kb[0]).toBe(true)
      if (ka[0] === kb[0]) expect(ka[1] >= kb[1]).toBe(true)
    }
  })

  it('«يفتح» جزءٌ من «يُستعمل» دائما — لا مسار يُفتح بلا أن يستعملها', () => {
    for (const g of r.gaps) {
      for (const pid of g.unlocks) expect(g.pathwayIds).toContain(pid)
    }
  })

  it('المهارة المقيسة ليست فجوة أبدا', () => {
    const measured = measurableSkills()
    for (const g of r.gaps) expect(measured.has(g.slug), g.slug).toBe(false)
  })

  it('كل فجوة نشطة تشخيصيا — الموقوفة ليست فجوة بل قرار', () => {
    for (const g of r.gaps) expect(g.state).toBe('registered_unmeasured')
  })

  it('الفجوات مرتبة بالأثر تنازليا — وإلا فالترتيب بلا معنى', () => {
    expect(r.gaps.length).toBeGreaterThan(0)
    /* كان هنا شرط «أعلى فجوة تفتح مسارا». صار unlocks صفرا لكل الفجوات في
       2026-08-26 لأن كل المسارات صارت مغطّاة — ولا مسار مغلق ليُفتح. فالترتيب
       يُحرس بخاصيته الدائمة: لا فجوة أدنى تسبق أعلى منها أثرا. */
    for (let i = 1; i < r.gaps.length; i++) {
      expect(r.gaps[i - 1].unlocks.length).toBeGreaterThanOrEqual(r.gaps[i].unlocks.length)
    }
    if (r.gaps[0].unlocks.length > 0) expect(r.totals.topThreeUnlock).toBeGreaterThan(0)
  })
})

describe('لا خلط بين المقيس والمفتاح غير المسجَّل', () => {
  it('المجموع يطابق ما يقيسه المحرك، والقسمان منفصلان', () => {
    const registered = new Set(skillsCatalog.map((s) => s.slug))
    const engine = measurableSkills()
    expect(r.totals.measuredSkills + r.totals.measuredKeysUnregistered).toBe(engine.size)
    expect(r.totals.measuredSkills).toBe([...engine].filter((k) => registered.has(k)).length)
  })

  it('المقيس المسجَّل ≤ النشط', () => {
    expect(r.totals.measuredSkills).toBeLessThanOrEqual(r.totals.activeSkills)
  })

  it('النشط يستثني الموقوف بالحوكمة', () => {
    const active = skillsCatalog.filter((s) => skillStateOf(s.slug).state !== 'inactive').length
    expect(r.totals.activeSkills).toBe(active)
    expect(r.totals.activeSkills).toBeLessThan(skillsCatalog.length)
  })
})

describe('أسئلة القياس المعلّقة', () => {
  it('كل واحد يقيس مفتاحا غير مسجَّل، ويقول أهو على سطح B2C', () => {
    const registered = new Set(skillsCatalog.map((s) => s.slug))
    expect(r.orphanQuestions.length).toBeGreaterThan(0)
    for (const q of r.orphanQuestions) {
      expect(registered.has(q.measuredKey), q.measuredKey).toBe(false)
      expect(typeof q.onB2cSurface).toBe('boolean')
      expect(q.textAr.length).toBeGreaterThan(5)
    }
  })

  it('ما على سطح B2C منها يطابق ما يعدّه المحرك مقيسا بلا تسجيل — رقمٌ واحد لا رقمان', () => {
    const onSurface = r.orphanQuestions.filter((q) => q.onB2cSurface).map((q) => q.measuredKey)
    expect(new Set(onSurface).size).toBe(r.totals.measuredKeysUnregistered)
  })
})

describe('جملة الحال', () => {
  it('تقول العدد والثمن والفعل — لا نسبة مجردة', () => {
    const h = coverageHeadlineAr(r)
    /* للجملة حالتان في المنتج: نقص وتمام. كان الاختبار يثبّت حالة النقص وحدها
       حتى بلغت التغطية التمام في 2026-08-26. كلتاهما تُحرس الآن. */
    if (r.totals.pathwaysZeroCoverage > 0) {
      expect(h).toContain(String(r.totals.pathwaysZeroCoverage))
      expect(h).toContain('٢٥٪')
      expect(h).toContain(String(r.totals.topThreeUnlock))
    } else {
      expect(h).toContain(String(r.totals.pathways))
      expect(h).toContain('مهارة مقيسة')
      expect(h).not.toContain('خامل')
    }
  })
})

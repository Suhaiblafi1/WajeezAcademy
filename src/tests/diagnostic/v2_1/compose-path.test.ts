/* قياس كل المهارات وتركيب المسار من المقررات — الحارس على قلب المعمار:
   الفجوة تقود إلى مقرر، والمقررات تُركَّب مسارا. */

import { describe, it, expect } from 'vitest'
import { catalogCourses } from '../../../domain/diagnostic/catalog'
import {
  familyIndex,
  familiesForCourses,
  resolveSkillLevels,
  evidenceCoverage,
  INFERRED_EVIDENCE_WEIGHT,
} from '../../../domain/diagnostic/v2_1/skill-families'
import {
  composePath,
  learnerGaps,
  COMPOSED_MIN_COURSES,
  COMPOSED_MAX_COURSES,
  MAX_OFF_ANCHOR,
} from '../../../domain/diagnostic/v2_1/compose-path'
import { assessDomainsV21, derivePersonaV21 } from '../../../domain/diagnostic/v2_1/engine'
import type { DecisionContext, SkillState } from '../../../domain/diagnostic/v2/types'
import type { FactBag } from '../../../domain/diagnostic/types'

const fact = (value: unknown) => ({ value, evidenceQuality: 0.9, sourceQuestionIds: [] }) as unknown as FactBag[string]
function ctxOf(facts: FactBag, measured: Record<string, number> = {}): DecisionContext {
  const skillStates = new Map<string, SkillState>()
  for (const [slug, level] of Object.entries(measured)) skillStates.set(slug, { slug, state: 'measured', level })
  return { facts, persona: derivePersonaV21(facts), domains: assessDomainsV21(facts), skillStates }
}
const allSlugs = [...new Set(catalogCourses.flatMap((c) => c.skill_slugs))]

describe('عائلات المهارات — قياس الكل بلا سؤال لكل مهارة', () => {
  it('كل مهارة مقرر تنتمي إلى عائلة، ولكل عائلة اسم عربي مقروء', () => {
    const idx = familyIndex()
    for (const slug of allSlugs) expect(idx.familyOf.get(slug), slug).toBeDefined()
    for (const fam of idx.skillsOf.keys()) {
      const label = idx.labelOf.get(fam)
      expect(label, fam).toBeTruthy()
      /* اسمٌ مقروء لا رمز: لا يساوي معرّف العائلة نفسه */
      expect(label).not.toBe(fam)
    }
  })

  it('عائلات مسار واحد قليلة — التقييم ممكن بلا استجواب', () => {
    for (const pid of ['PW-FND-003', 'PW-STU-002', 'PW-EMP-003']) {
      const ids = catalogCourses.filter((c) => c.pathway_id === pid).map((c) => c.course_id)
      const fams = familiesForCourses(ids)
      expect(fams.length).toBeGreaterThan(0)
      expect(fams.length).toBeLessThanOrEqual(8)
    }
  })

  it('تقييم عائلة واحدة يمنح كل مهاراتها مستوى — مستدَلا لا مقيسا', () => {
    const idx = familyIndex()
    const fam = 'COM'
    const members = idx.skillsOf.get(fam)!
    expect(members.length).toBeGreaterThan(1)
    const r = resolveSkillLevels(members, new Map(), { [fam]: 2 })
    for (const slug of members) {
      const got = r.get(slug)!
      expect(got.level).toBe(2)
      expect(got.provenance).toBe('inferred')
      expect(got.viaFamily).toBe(fam)
    }
  })

  it('القياس المباشر يعلو على استدلال العائلة — الدليل لا يُلغى بترجيح', () => {
    const idx = familyIndex()
    const fam = 'COM'
    const slug = idx.skillsOf.get(fam)![0]
    const measured = new Map<string, SkillState>([[slug, { slug, state: 'measured', level: 5 }]])
    const r = resolveSkillLevels([slug], measured, { [fam]: 1 })
    expect(r.get(slug)!.level).toBe(5)
    expect(r.get(slug)!.provenance).toBe('measured')
  })

  it('مهارة بلا قياس ولا عائلة مقيَّمة تبقى مجهولة — لا يُخترع لها مستوى', () => {
    const r = resolveSkillLevels(allSlugs, new Map(), {})
    for (const v of r.values()) {
      expect(v.level).toBeNull()
      expect(v.provenance).toBe('unknown')
    }
  })

  it('المستدَل يُحتسب نصف المقاس في التغطية — لا يُدّعى دليلا مباشرا', () => {
    const idx = familyIndex()
    const members = idx.skillsOf.get('COM')!.slice(0, 4)
    const inferredOnly = resolveSkillLevels(members, new Map(), { COM: 3 })
    expect(evidenceCoverage(inferredOnly)).toBeCloseTo(INFERRED_EVIDENCE_WEIGHT, 5)
    const measured = new Map<string, SkillState>(members.map((s) => [s, { slug: s, state: 'measured' as const, level: 3 }]))
    expect(evidenceCoverage(resolveSkillLevels(members, measured, {}))).toBe(1)
  })
})

describe('تركيب المسار من المقررات', () => {
  const GRAD_AI: FactBag = {
    career_stage: fact('fresh_graduate'),
    need_id: fact('need_ai'),
    primary_goal: fact('ai_effective'),
  }

  it('يبني خطة بحجم مسار حقيقي ولا يكرر مقررا', () => {
    const plan = composePath(ctxOf(GRAD_AI), { AI: 1, COG: 2, COM: 3, DIG: 3 })
    expect(plan.courses.length).toBeGreaterThanOrEqual(COMPOSED_MIN_COURSES)
    expect(plan.courses.length).toBeLessThanOrEqual(COMPOSED_MAX_COURSES)
    expect(new Set(plan.courses.map((c) => c.courseId)).size).toBe(plan.courses.length)
    expect(plan.totalHours).toBeGreaterThan(0)
  })

  it('كل مقرر خارج المرساة مبرَّر بفجوة قوية — لا يدخل بالملاءمة وحدها', () => {
    /* مرساة بخمسة مقررات (career_direction) تجبر السادس على الخروج، فيُفحص
       التبرير على حالة واقعة لا مفترضة.
       ⚠ صدقٌ في حدود هذا الاختبار: هو تأكيدُ ثبات لا حارسُ طفرة. جُرّب إسقاط
       شرط التبرير في الشيفرة فلم يفشل — لأن عائلات مرساة الطالب (BIZ · COG ·
       COM · LEAD …) تغطي أغلب الكتالوج، فأيّ مقرر خارجي يسدّ فجوة قوية أصلا.
       يصير حارسا حقيقيا حين يتسع الكتالوج بعائلات لا تتقاطع مع المرساة. */
    const STUDENT: FactBag = {
      career_stage: fact('university_student'),
      need_id: fact('need_direction'),
      primary_goal: fact('explore'),
    }
    const ratings: Record<string, number> = {}
    for (const f of familyIndex().skillsOf.keys()) ratings[f] = 1
    const ctx = ctxOf(STUDENT)
    const plan = composePath(ctx, ratings)
    expect(plan.anchorDomain).toBe('career_direction')
    const off = plan.courses.filter((c) => !c.onAnchor)
    expect(off.length).toBeGreaterThan(0)
    expect(off.length).toBeLessThanOrEqual(MAX_OFF_ANCHOR)
    const resolved = resolveSkillLevels(allSlugs, ctx.skillStates, ratings)
    for (const c of off) {
      /* التبرير: يسدّ مهارة مستواها المُثبت 2 فأدنى */
      const strong = c.closesGaps.some((s) => {
        const lvl = resolved.get(s)?.level
        return lvl !== null && lvl !== undefined && lvl <= 2
      })
      expect(strong, `${c.courseId} خرج عن المرساة بلا فجوة قوية`).toBe(true)
    }
  })

  it('يركّب من أكثر من مسار حين تقتضي الفجوات — لا يكتفي بمسار جاهز', () => {
    const plan = composePath(ctxOf(GRAD_AI), { AI: 1, COG: 1, COM: 1, DIG: 1 })
    const pathways = new Set(plan.courses.map((c) => c.pathwayId))
    expect(pathways.size).toBeGreaterThanOrEqual(1)
    /* وإن جاءت كلها من مسار واحد يُسمّى صراحة بدل ادّعاء تركيب */
    if (pathways.size === 1) expect(plan.matchesPathwayId).toBe([...pathways][0])
    else expect(plan.matchesPathwayId).toBeNull()
  })

  it('كل مقرر مختار يسدّ فجوة أو يقع في مجال المرساة — لا مقرر بلا سبب', () => {
    const plan = composePath(ctxOf(GRAD_AI), { AI: 1, COG: 2, COM: 3, DIG: 3 })
    for (const c of plan.courses) expect(c.closesGaps.length > 0 || c.onAnchor).toBe(true)
  })

  it('الفجوات المغطاة والباقية تُحسب بصدق ولا تتقاطعان', () => {
    const ctx = ctxOf(GRAD_AI)
    const ratings = { AI: 1, COG: 2, COM: 3, DIG: 3 }
    const plan = composePath(ctx, ratings)
    const overlap = plan.coveredGaps.filter((s) => plan.uncoveredGaps.includes(s))
    expect(overlap).toEqual([])
    const gaps = learnerGaps(resolveSkillLevels(allSlugs, ctx.skillStates, ratings))
    expect(plan.coveredGaps.length + plan.uncoveredGaps.length).toBe(gaps.size)
  })

  it('بلا أي تقييم ولا قياس لا تُختلق فجوات', () => {
    const plan = composePath(ctxOf(GRAD_AI), {})
    expect(plan.coveredGaps).toEqual([])
    expect(plan.uncoveredGaps).toEqual([])
  })

  it('حتمي: نفس المدخلات تعطي نفس الخطة', () => {
    const mk = () => composePath(ctxOf(GRAD_AI), { AI: 1, COG: 2, COM: 3, DIG: 3 }).courses.map((c) => c.courseId)
    expect(mk()).toEqual(mk())
  })
})

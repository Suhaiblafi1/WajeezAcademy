/* ملاءمة المقرر — الاختبار الذي يحرس القاعدة الجوهرية:
   المهارة تُقاس على مقررها لا على اتحاد المسار. */

import { describe, it, expect, beforeAll } from 'vitest'
import { catalogCourses, courseById } from '../../../domain/diagnostic/catalog'
import {
  assessCourseFit,
  assessPathwayByCourses,
  personalizePlan,
  substitutionsFor,
  courseLevelOf,
  learnerLevel,
  MAX_SUBSTITUTIONS,
} from '../../../domain/diagnostic/v2_1/course-fit'
import { assessDomainsV21, derivePersonaV21 } from '../../../domain/diagnostic/v2_1/engine'
import type { DecisionContext, SkillState } from '../../../domain/diagnostic/v2/types'
import type { FactBag } from '../../../domain/diagnostic/types'

function ctxOf(facts: FactBag, skills: Record<string, number> = {}): DecisionContext {
  const skillStates = new Map<string, SkillState>()
  for (const [slug, level] of Object.entries(skills)) skillStates.set(slug, { slug, state: 'measured', level })
  return { facts, persona: derivePersonaV21(facts), domains: assessDomainsV21(facts), skillStates }
}
const fact = (value: unknown) => ({ value, evidenceQuality: 0.9, sourceQuestionIds: [] }) as unknown as FactBag[string]

describe('ملاءمة المقرر — لكل مقرر مهاراته', () => {
  beforeAll(() => {
    expect(catalogCourses.length).toBeGreaterThan(0)
  })

  it('مقرران في نفس المسار يختلفان بالملاءمة حين تختلف مهارات المتعلم — لا متوسط واحد للمسار', () => {
    const cs = catalogCourses.filter((c) => c.pathway_id === 'PW-EMP-003').sort((a, b) => a.sequence - b.sequence)
    expect(cs.length).toBe(5)
    /* نُتقن مهارات المقرر الأول كلها ولا شيء غيرها */
    const mastered = Object.fromEntries(cs[0].skill_slugs.map((s) => [s, 5]))
    const ctx = ctxOf({ career_stage: fact('manager') }, mastered)
    const first = assessCourseFit(cs[0], ctx)
    const last = assessCourseFit(cs[4], ctx)
    expect(first.masteredSkills.length).toBe(cs[0].skill_slugs.length)
    /* المقرر الذي أتقن المتعلم كل مهاراته حاجته صفر — والآخر لا */
    expect(first.skillNeed).toBe(0)
    expect(last.skillNeed).toBeGreaterThan(0)
    expect(last.total).toBeGreaterThan(first.total)
  })

  it('مقرر فوق مستوى المتعلم تنخفض ملاءمته — ولا يُعطى ما هو أكبر منه', () => {
    const practitioner = catalogCourses.find((c) => courseLevelOf(c) === 'practitioner')!
    const foundational = catalogCourses.find((c) => courseLevelOf(c) === 'foundational')!
    const student = ctxOf({ career_stage: fact('university_student') })
    expect(assessCourseFit(foundational, student).levelMatch).toBeGreaterThan(
      assessCourseFit(practitioner, student).levelMatch,
    )
  })

  it('موضع المتعلم يرتفع بالدليل المقيس ولا ينخفض به', () => {
    const bare = ctxOf({ career_stage: fact('fresh_graduate') })
    const proven = ctxOf({ career_stage: fact('fresh_graduate') }, { project_management: 5, data_literacy: 5 })
    expect(learnerLevel(proven.facts, proven.skillStates)).toBeGreaterThan(learnerLevel(bare.facts, bare.skillStates))
    const weak = ctxOf({ career_stage: fact('manager') }, { project_management: 1 })
    /* دليل ضعيف لا يهبط بالمدير عن موضع مرحلته */
    expect(learnerLevel(weak.facts, weak.skillStates)).toBe(learnerLevel(ctxOf({ career_stage: fact('manager') }).facts, new Map()))
  })

  it('الاستبدال قريبٌ لا عشوائي: كل بديل يشترك في مهارة أو يقع في مجال المتعلم الأول', () => {
    const ctx = ctxOf({ career_stage: fact('fresh_graduate'), need_id: fact('need_ai'), primary_goal: fact('ai_effective') })
    const plan = assessPathwayByCourses('PW-FND-003', ctx)
    const subs = substitutionsFor(plan, ctx)
    expect(subs.length).toBeLessThanOrEqual(MAX_SUBSTITUTIONS)
    for (const s of subs) {
      const from = courseById.get(s.replaced.courseId)!
      const to = courseById.get(s.replacement.courseId)!
      const shared = to.skill_slugs.filter((x) => from.skill_slugs.includes(x)).length
      const sameTopDomain = s.affinity_ar === 'في مجالك الأول'
      expect(shared > 0 || sameTopDomain).toBe(true)
      /* لا يُستبدل مقرر بأضعف منه */
      expect(s.replacement.total).toBeGreaterThan(s.replaced.total)
    }
  })

  it('المقرر الختامي لا يُستبدل — الشهادة تُبنى عليه', () => {
    /* نجعل الختامي الأضعف قطعا: نُتقن مهاراته وحدها فتصير حاجته صفرا، بينما
       تبقى بقية المقررات بحاجة مجهولة (0.5). فلولا الحماية لكان أول من يُستبدل. */
    const cs = catalogCourses.filter((c) => c.pathway_id === 'PW-FND-003')
    const maxSeq = Math.max(...cs.map((c) => c.sequence))
    const capstone = cs.find((c) => c.sequence === maxSeq)!
    const others = new Set(cs.filter((c) => c.sequence !== maxSeq).flatMap((c) => c.skill_slugs))
    /* مهارات خاصة بالختامي وحده — كي لا يُخفَّض معه غيرُه */
    const onlyCapstone = capstone.skill_slugs.filter((sl) => !others.has(sl))
    expect(onlyCapstone.length).toBeGreaterThan(0)
    const ctx = ctxOf(
      { career_stage: fact('fresh_graduate'), need_id: fact('need_ai'), primary_goal: fact('ai_effective') },
      Object.fromEntries(onlyCapstone.map((sl) => [sl, 5])),
    )
    const plan = assessPathwayByCourses('PW-FND-003', ctx)
    expect(plan.weakest!.sequence).toBe(maxSeq)

    const subs = substitutionsFor(plan, ctx)
    for (const sub of subs) expect(sub.replaced.sequence).not.toBe(maxSeq)
    expect(personalizePlan('PW-FND-003', ctx).courses.some((c) => c.courseId === capstone.course_id)).toBe(true)
  })

  it('الخطة تبقى خمسة مقررات بعد التشخيص — ولا تكرار', () => {
    for (const pid of ['PW-FND-003', 'PW-STU-002', 'PW-EMP-003']) {
      const ctx = ctxOf({ career_stage: fact('fresh_graduate') })
      const plan = personalizePlan(pid, ctx)
      expect(plan.courses.length).toBe(5)
      expect(new Set(plan.courses.map((c) => c.courseId)).size).toBe(5)
      expect(plan.totalHours).toBeGreaterThan(0)
    }
  })

  it('حتمي: نفس الحقائق تعطي نفس الخطة', () => {
    const mk = () => personalizePlan('PW-FND-003', ctxOf({ career_stage: fact('fresh_graduate'), need_id: fact('need_ai') }))
    expect(mk().courses.map((c) => c.courseId)).toEqual(mk().courses.map((c) => c.courseId))
  })

  it('مهارة غير مقيسة لا تُحسب فجوة ولا إتقانا — منتصف صادق', () => {
    const ctx = ctxOf({ career_stage: fact('experienced') })
    const c = assessCourseFit(catalogCourses[0], ctx)
    expect(c.gapSkills.length).toBe(0)
    expect(c.masteredSkills.length).toBe(0)
    expect(c.unknownSkills.length).toBe(catalogCourses[0].skill_slugs.length)
    expect(c.skillNeed).toBe(0.5)
  })
})

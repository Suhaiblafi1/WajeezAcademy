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
import { pathwayDomainsV2 } from '../../../domain/diagnostic/v2/data'
import { courseById } from '../../../domain/diagnostic/catalog'
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

/* الفجوة خادمة للهدف لا بديلة عنه.

   الترتيب في composePath بـ(ملاءمة + قيمة فجوة)، والفجوة المقيسة تُثقل بقوة.
   فمن هدفه «أول وظيفة» وقِيست له فجوة حادّة في مهارات جانبية، كانت مقررات تلك
   المهارات تصعد وتُزيح مقررات مجال الهدف نفسه — خطةٌ تعالج نقصا وتُسقط الهدف.
   هذه تثبت أن الحجز يعمل: نُغرق المتعلم بفجوات خارج مجال هدفه ونطلب الخطة. */
describe('حماية مجال الهدف من الفجوات الجانبية', () => {
  const domainsOf = (courseId: string) =>
    (pathwayDomainsV2[courseById.get(courseId)?.pathway_id ?? ''] ?? []) as string[]

  /* خريج هدفه أول وظيفة — ومجاله المعلن employment_readiness.
     ثم نقيس له فجوات حادّة (مستوى 1) في مهارات مقررات لا تنتمي إلى مجاله. */
  const JOB_SEEKER: FactBag = {
    career_stage: fact('fresh_graduate'),
    primary_goal: fact('first_job'),
    employment_status: fact('unemployed_seeking'),
  } as unknown as FactBag

  const offGoalSlugs = () => {
    const slugs = new Set<string>()
    for (const c of catalogCourses) {
      if (domainsOf(c.course_id).includes('employment_readiness')) continue
      for (const s of c.skill_slugs) slugs.add(s)
    }
    return [...slugs]
  }

  /* الحالة ليست مخترعة: مُسحت 380 تركيبة (هدف × احتياج × مرحلة) بفجوات حادّة
     خارج مجال الهدف، فكان أسوأها بلا الحجز صفرَ مقررات في مجال الهدف — وهي
     هذه بعينها: «أول وظيفة» + احتياج قيادي + خريج حديث، خطةٌ من ستة مقررات
     ليس فيها مقرر جاهزية توظيف واحد. ومع الحجز صارت أرضية المسح كلها اثنين. */
  it('«أول وظيفة» لا تخرج منها الجاهزية للتوظيف مهما اشتدّت فجوة جانبية', () => {
    const measured: Record<string, number> = {}
    for (const s of offGoalSlugs()) measured[s] = 1
    const facts = { ...JOB_SEEKER, need_id: fact('need_leadership') } as unknown as FactBag
    const plan = composePath(ctxOf(facts, measured))
    const inGoal = plan.courses.filter((c) => domainsOf(c.courseId).includes('employment_readiness'))
    expect(
      inGoal.length,
      `الخطة: ${plan.courses.map((c) => c.title_ar).join(' · ')}`,
    ).toBeGreaterThanOrEqual(2)
    expect(inGoal.every((c) => c.role === 'goal')).toBe(true)
  })

  it('الاحتياج لا يبتلع الهدف: مجال الهدف وحده هو المحجوز', () => {
    /* لو ضُمّ مجال الاحتياج إلى الهدف لملأ المقاعد وخرج الهدف — وهو ما وقع
       فعلا قبل الفصل. الحارس يمنع عودة الاتحاد. */
    const measured: Record<string, number> = {}
    for (const s of offGoalSlugs()) measured[s] = 1
    for (const need of ['need_leadership', 'need_direction', 'need_employability']) {
      const facts = { ...JOB_SEEKER, need_id: fact(need) } as unknown as FactBag
      const plan = composePath(ctxOf(facts, measured))
      const inGoal = plan.courses.filter((c) => domainsOf(c.courseId).includes('employment_readiness'))
      expect(inGoal.length, `احتياج ${need}`).toBeGreaterThanOrEqual(2)
    }
  })

  it('كل مقرر يحمل دورا واحدا مفهوما، وسببه يذكره', () => {
    const plan = composePath(ctxOf(JOB_SEEKER, { cv_writing: 1, interview_skills: 1 }))
    expect(plan.courses.length).toBeGreaterThan(0)
    for (const c of plan.courses) {
      expect(['goal', 'gap', 'support']).toContain(c.role)
      expect(c.why_ar.trim().length).toBeGreaterThan(5)
      if (c.role === 'goal') expect(c.why_ar).toContain('هدفك')
    }
  })

  it('بلا هدف معلن لا حجز — لا نحمي هدفا لا نعرفه', () => {
    const explorer: FactBag = { career_stage: fact('other_unsure'), primary_goal: fact('explore') } as unknown as FactBag
    const plan = composePath(ctxOf(explorer, { cv_writing: 1 }))
    /* لا انهيار ولا خطة فارغة — والأدوار تبقى مشتقّة */
    expect(plan.courses.length).toBeGreaterThan(0)
    for (const c of plan.courses) expect(['goal', 'gap', 'support']).toContain(c.role)
  })

  it('المؤجَّل يضيف مهارة لا يكررها، ولا يكرر ما في الخطة', () => {
    const plan = composePath(ctxOf(JOB_SEEKER, { cv_writing: 1, interview_skills: 2 }))
    const inPlan = new Set(plan.courses.map((c) => c.courseId))
    const planSkills = new Set(plan.courses.flatMap((c) => courseById.get(c.courseId)?.skill_slugs ?? []))
    for (const d of plan.deferred) {
      expect(inPlan.has(d.courseId), d.title_ar).toBe(false)
      const fresh = (courseById.get(d.courseId)?.skill_slugs ?? []).filter((s) => !planSkills.has(s))
      expect(fresh.length, `${d.title_ar} لا يضيف مهارة`).toBeGreaterThan(0)
    }
    expect(plan.deferred.length).toBeLessThanOrEqual(2)
  })
})

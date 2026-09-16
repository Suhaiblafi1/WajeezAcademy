/* ملاءمة المقرر — الاختبار الذي يحرس القاعدة الجوهرية:
   المهارة تُقاس على مقررها لا على اتحاد المسار. */

import { describe, it, expect, beforeAll } from 'vitest'
import { catalogCourses, courseById, launchPathways } from '../../../domain/diagnostic/catalog'
import { MIN_PATHWAY_COURSES } from '../../../data/courses'
import {
  assessCourseFit,
  assessPathwayByCourses,
  personalizePlan,
  substitutionsFor,
  courseLevelOf,
  learnerLevel,
  MAX_SUBSTITUTIONS,
} from '../../../domain/diagnostic/v2_1/course-fit'
import { familyIndex, INFERRED_EVIDENCE_WEIGHT } from '../../../domain/diagnostic/v2_1/skill-families'
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
    /* العدد يُقرأ لا يُكتب: كان مكتوبا ٥ فاحمرّ حين صار المسار أربع دورات بعد
       الدمج — والمقصود «أكثر من مقرر في المسار» لا رقمٌ بعينه */
    expect(cs.length).toBeGreaterThanOrEqual(2)
    /* نُتقن مهارات المقرر الأول كلها ولا شيء غيرها */
    const mastered = Object.fromEntries(cs[0].skill_slugs.map((s) => [s, 5]))
    const ctx = ctxOf({ career_stage: fact('manager') }, mastered)
    const first = assessCourseFit(cs[0], ctx)
    const last = assessCourseFit(cs[cs.length - 1], ctx)
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

  it('الخطة تبقى بكامل مقررات المسار بعد التشخيص — ولا تكرار', () => {
    /* كان العنوان والرقم «خمسة». وبعد دمج أوّل دورتين من كل مسار صارت أربعا،
       فاحمرّ الاختبار على تغيّرٍ مقصود. والمقصود منه أصلا: التشخيص يُخصّص
       المقررات ولا يُنقص عددها ولا يكرّرها — فيُقرأ العدد من المسار نفسه،
       بأرضيّةٍ صريحة تمنع انكماشه بصمت. */
    for (const pid of ['PW-FND-003', 'PW-STU-002', 'PW-EMP-003']) {
      const expected = launchPathways.find((p) => p.id === pid)!.course_ids.length
      expect(expected).toBeGreaterThanOrEqual(MIN_PATHWAY_COURSES)
      const ctx = ctxOf({ career_stage: fact('fresh_graduate') })
      const plan = personalizePlan(pid, ctx)
      expect(plan.courses.length, pid).toBe(expected)
      expect(new Set(plan.courses.map((c) => c.courseId)).size, pid).toBe(expected)
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

  /* ═══ تقييمُ العائلاتِ يصل ملاءمةَ المقرر ═══

     العلّة: المتعلّم يقيّم عائلاته في شبكةٍ تُعرض له، فتستعمله منافسةُ الكيانات
     (assessEntitySkills في compete.ts) ولا تستعمله ملاءمةُ المقرر — تقرأ
     ctx.skillStates وحدَها وتعطي كلَّ ما عداها UNKNOWN_NEED ثابتة. بل إنّ
     composePath يحسب resolveSkillLevels ثمّ يستدعي assessCourseFit فتُرمى
     نتيجتُه. فالمسارُ الوسيط يُرتَّب على ٢٥٪ من مهاراته مقيسةً، والباقي تخمين.

     والشرطُ الذي لا يُتنازل عنه: **المستدَلُّ يبقى مستدَلّا.** ملءُ التغطية
     بترجيحٍ يجعل التشخيصَ أكملَ لا أصدق — و«لا أعرف» إشارةٌ تُفقد إن مُلئت.
     فالاستدلالُ يحرّك الحاجةَ بوزنه المعلن (INFERRED_EVIDENCE_WEIGHT) ولا
     يُتقن مهارةً أبدا: إتقانٌ مستدَلٌّ يحرم المتعلّمَ دورةً بناءً على تقديرٍ
     ذاتيٍّ لعائلةٍ كاملة. */
  it('تقييمُ العائلة يُقرأ في ملاءمة المقرر — ويبقى ترجيحا لا دليلا', () => {
    const idx = familyIndex()
    const course = catalogCourses.find((c) => c.skill_slugs.every((s) => idx.familyOf.has(s)))
    expect(course, 'لا مقرّرَ كلُّ مهاراته ذاتُ عائلة').toBeTruthy()
    const fams = [...new Set(course!.skill_slugs.map((s) => idx.familyOf.get(s)!))]

    const facts = { career_stage: fact('manager') }
    const bare = ctxOf(facts)
    const measured = ctxOf(facts, Object.fromEntries(course!.skill_slugs.map((s) => [s, 5])))
    const inferred: DecisionContext = { ...ctxOf(facts), familyRatings: Object.fromEntries(fams.map((f) => [f, 5])) }

    const b = assessCourseFit(course!, bare)
    const m = assessCourseFit(course!, measured)
    const i = assessCourseFit(course!, inferred)

    /* ١) القياسُ المباشر يُتقن ويُصفّر الحاجة — كما كان */
    expect(m.skillNeed).toBe(0)
    expect(m.masteredSkills).toHaveLength(course!.skill_slugs.length)

    /* ٢) والاستدلالُ يُقرأ: الحاجةُ تنخفض عن المجهول */
    expect(i.skillNeed).toBeLessThan(b.skillNeed)

    /* ٣) ولا يُتقن — المقرّر يبقى في خطّته */
    expect(i.masteredSkills).toHaveLength(0)
    expect(i.skillNeed).toBeGreaterThan(0)

    /* ٤) وبوزنٍ معلن لا مُخترَع: نصفُ المسافة إلى المقيس لا كلُّها */
    expect(i.skillNeed).toBeCloseTo(b.skillNeed - INFERRED_EVIDENCE_WEIGHT * (b.skillNeed - m.skillNeed), 6)

    /* ٥) ويُقال للمتعلّم كم من حكمِنا ترجيح */
    expect(i.inferredSkills).toHaveLength(course!.skill_slugs.length)
    expect(m.inferredSkills).toHaveLength(0)
  })
})

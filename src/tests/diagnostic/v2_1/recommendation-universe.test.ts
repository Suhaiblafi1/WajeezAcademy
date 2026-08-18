/* اختبارات قبول فضاء التوصيات الموحد V2.1 (البند 19):
   كل احتياج يفتح مساره · قياسي يفوز عند الكفاية · مركب بلا قيمة إضافية يخسر ·
   مركب غير مجدٍ زمنيًا لا يفوز · مركب يفوز عند حاجة متعددة المجالات مُثبتة ·
   غير المتأكد بلا دليل → استكشاف بلا فرض · المهارة المجهولة صفر أثر ·
   حارس الحالة يمنع غير المعتمد أبدًا · ٣٦ كيانًا نشطًا (المرحلة 4: أُصلحت الخمسة
   المجمدة وأصبحت معتمدة وقابلة للوصول) · حتمية كاملة.
   كل التوقعات مثبتة من نتائج محققة فعلية عبر جسر الرحلات، لا من تخمين. */

import { describe, expect, it } from 'vitest'
import { createEngineV21, type RecommendationV21 } from '../../../domain/diagnostic/v2_1'
import { Q, type CareerStage } from '../../../domain/diagnostic/v2_1/maps'
import { recommendationUniverse, type RecommendationEntity } from '../../../domain/diagnostic/v2_1/universe'
import { assessEntityEligibility, assessEntitySkills, type CompetitionResult } from '../../../domain/diagnostic/v2_1/compete'
import type { DecisionContext } from '../../../domain/diagnostic/v2/types'

/* ─── محاكاة جلسة بإجابات نصية مدروسة (نفس نمط جسر الفحص المتحقق) ─── */
interface Journey {
  stage: CareerStage
  employment?: string
  goal?: string
  need?: string
  time?: string
  mastery?: string
  interest?: string
  answers?: Record<string, string>
  skillLevel?: number
}

const STAGE_LABEL: Record<CareerStage, string> = {
  university_student: 'طالب جامعي',
  fresh_graduate: 'خريج حديث',
  early_career: 'موظف في بداية مساري المهني',
  experienced: 'موظف ذو خبرة',
  manager: 'مدير / قائد فريق',
  senior_manager: 'مدير أول / تنفيذي',
  founder: 'مؤسس / صاحب عمل',
  freelancer: 'مستقل — أعمل لحسابي',
  trainer_ld: 'مدرب / معلم / مختص تعلم وتطوير',
  other_unsure: 'غير ذلك / غير متأكد',
}

function runJourney(name: string, script: Journey): {
  asked: string[]
  rec: RecommendationV21
  comp: CompetitionResult
} {
  const engine = createEngineV21(`test-universe-${name}`)
  const asked: string[] = []
  for (let i = 0; i < 20; i++) {
    const step = engine.nextQuestion()
    if (step.stop.shouldStop || !step.question) break
    const q = step.question
    asked.push(q.question_id)
    const byLabel = (l?: string): number => (l ? q.options_ar.indexOf(l) : -1)
    let idx = -1
    const explicit = script.answers?.[q.question_id]
    if (explicit !== undefined) idx = byLabel(explicit)
    if (idx < 0) {
      if (q.question_id === Q.STAGE) idx = byLabel(STAGE_LABEL[script.stage])
      else if (q.question_id === Q.EMPLOYMENT) idx = byLabel(script.employment ?? 'أعمل لدى جهة')
      else if (q.question_id === Q.GOAL) idx = byLabel(script.goal ?? '')
      else if (q.question_id === Q.NEED) idx = byLabel(script.need ?? '')
      else if (q.question_id === Q.TIME) idx = byLabel(script.time ?? '٢–٤ ساعات')
      else if (q.question_id === Q.MASTERY) idx = byLabel(script.mastery ?? 'غير متأكد')
      else if (q.question_id === 'QB-M3E-002') idx = byLabel(script.interest ?? 'لا أعرف')
      else if (q.answer_type === 'skill_level_5' || q.answer_type === 'likert_5') idx = (script.skillLevel ?? 3) - 1
      else idx = 0
      if (idx < 0) idx = 0
    }
    const label = q.options_ar[idx]
    const realId = q.active_option_ids?.[idx] ?? `o${idx + 1}`
    engine.answer({ questionId: q.question_id, value: label, optionIds: [realId] })
  }
  return { asked, rec: engine.recommend(), comp: engine.competeSnapshot() }
}

const FORMERLY_FROZEN = [
  'TPL-FIRST-JOB-001',
  'TPL-CX-001',
  'TPL-DIGITAL-TRAINER-001',
  'TPL-CYBER-MANAGER-001',
  'TPL-STRATEGY-001',
]

describe('فضاء التوصيات الموحد V2.1 — معايير القبول (البند 19)', () => {
  it('الفضاء النشط = 36 كيانًا (20 قياسيًا + 16 مركبًا) — الخمسة المجمدة سابقًا أُصلحت واعتُمدت (المرحلة 4)', () => {
    const universe = recommendationUniverse()
    expect(universe.active.length).toBe(36)
    expect(universe.active.filter((e) => e.entity_type === 'standard').length).toBe(20)
    expect(universe.active.filter((e) => e.entity_type === 'composite').length).toBe(16)
    for (const id of FORMERLY_FROZEN) {
      const e = universe.byId.get(id)
      expect(e, `كيان مفقود: ${id}`).toBeDefined()
      expect(e!.status, `${id} لم يعد معتمدًا`).toBe('approved_active')
      expect(universe.active.find((a) => a.entity_id === id), `${id} غائب عن الفضاء النشط`).toBeDefined()
    }
    // لا كيان قيد المراجعة حاليًا — وإن ظهر مستقبلًا يجب ألا يتسلل إلى النشط
    const notApproved = [...universe.byId.values()].filter((e) => e.status !== 'approved_active')
    for (const e of notApproved) {
      expect(universe.active.find((a) => a.entity_id === e.entity_id), `${e.entity_id} غير معتمد لكنه نشط`).toBeUndefined()
    }
  })

  it('حارس الحالة: أي كيان غير معتمد يُستبعد بحجة الحالة لا بمصادفة السياق', () => {
    /* حارس ثابت على مستوى الوحدة: نستنسخ كيانًا نشطًا بحالة needs_revision
       ونتأكد أن الأهلية تُرفض بسبب الحالة مهما كان السياق */
    const universe = recommendationUniverse()
    const active = universe.active[0]!
    const stubCtx = { persona: { key: 'employee_private' } } as unknown as DecisionContext
    const cloned: RecommendationEntity = { ...active, status: 'needs_revision' }
    const verdict = assessEntityEligibility(cloned, {}, stubCtx)
    expect(verdict.eligible).toBe(false)
    expect(verdict.stage_ar).toBe('الحالة')
    expect(verdict.excludedReasons_ar.join(' ')).toContain('لا ينافس حتى تكتمل مراجعته')
  })

  it('need_data يفتح PW-EMP-004: مؤهل في رحلة موظف يريد تحليل البيانات', () => {
    const { comp } = runJourney('بيانات-موظف', {
      stage: 'experienced',
      goal: 'تحسين أدائي في عملي الحالي',
      need: 'تحليل البيانات واتخاذ القرار',
      time: '٥–٧ ساعات',
    })
    const e = comp.eligibility.find((x) => x.entityId === 'PW-EMP-004')
    expect(e, 'PW-EMP-004 غائب عن سجل الأهلية').toBeDefined()
    expect(e!.eligible, `PW-EMP-004 مستبعد: ${e!.excludedReasons_ar.join(' | ')}`).toBe(true)
  })

  it('need_marketing يفتح PW-MKT-001 ويحققه فائزًا في رحلة نظيفة أحادية المجال', () => {
    const { rec } = runJourney('تسويق-موظف', {
      stage: 'early_career',
      goal: 'تحسين أدائي في عملي الحالي',
      need: 'التسويق والنمو',
      time: '٥–٧ ساعات',
      answers: { 'QB-M3B-012': 'لا', 'QB-M3B-003': 'لا', 'QB-M3B-001': 'خاص' },
    })
    expect(rec.kind).toBe('single_pathway')
    expect(rec.primaryPathway?.pathwayId).toBe('PW-MKT-001')
  })

  it('مركب بلا قيمة إضافية يخسر: رحلة أحادية المجال لا تنتج composite', () => {
    const { rec, comp } = runJourney('تسويق-أحادي', {
      stage: 'early_career',
      goal: 'تحسين أدائي في عملي الحالي',
      need: 'التسويق والنمو',
      time: '٥–٧ ساعات',
      answers: { 'QB-M3B-012': 'لا', 'QB-M3B-003': 'لا', 'QB-M3B-001': 'خاص' },
    })
    expect(rec.composite ?? null).toBeNull()
    /* لا مركب يجتاز البوابتين البنيويتين في حاجة أحادية — المتحدي الشرعي غير موجود */
    expect(comp.bestComposite).toBeNull()
  })

  it('مركب غير مجدٍ زمنيًا لا يفوز: مؤسس بأقل من ٣ ساعات يستبعد الخطط الثقيلة بالجدوى', () => {
    const { rec, comp } = runJourney('مؤسس-ضيق', {
      stage: 'founder',
      employment: 'لدي مشروعي الخاص',
      goal: 'تنمية مشروعي القائم وزيادة إيراداته',
      need: 'بناء مشروعي من الصفر',
      time: 'أقل من ٣ ساعات',
      mastery: 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف',
    })
    expect(rec.kind).toBe('single_pathway')
    expect(rec.primaryPathway?.pathwayId).toBe('PW-BIZ-001')
    expect(rec.composite ?? null).toBeNull()
    for (const id of ['TPL-VENTURE-001', 'TPL-FREELANCE-001']) {
      const e = comp.eligibility.find((x) => x.entityId === id)
      expect(e!.eligible).toBe(false)
      expect(e!.excludedReasons_ar.join(' ')).toContain('وقتك الأسبوعي الحالي دون حدها الأدنى')
    }
  })

  it('مركب يفوز عند حاجة متعددة المجالات مُثبتة: مستقل start_business + تفاوض + ميول أعمال', () => {
    const { rec } = runJourney('مستقل-ثلاثي', {
      stage: 'freelancer',
      goal: 'بدء مشروع أو مصدر دخل مستقل',
      need: 'التفاوض وإغلاق الصفقات',
      time: '٥–٧ ساعات',
      mastery: 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف',
      interest: 'أعمال',
    })
    /* المرحلة 4 (عدالة الدليل): مهارتا القالب الحاسمتان (التفاوض، الكتابة
       التجارية) لا يقيسهما أي سؤال في بنك V2.1، والسباق حي (هامش < 0.15) —
       فيفوز القالب ويُرفق، لكن يُوسم لمراجعة مستشار بدل فوز صامت بلا قياس */
    expect(rec.kind).toBe('advisor_referral')
    expect(rec.composite, 'فوز مركب بلا خطة مرفقة').not.toBeNull()
    expect(rec.composite!.templateId).toBe('TPL-FREELANCE-001')
    const reasons = JSON.stringify(rec)
    expect(reasons).toContain('مهارة حاسمة')
  })

  it('غير المتأكد بلا دليل → اتجاه استكشافي بلا مسار مفروض ولا مركب', () => {
    const { rec } = runJourney('مستكشف-بلا-دليل', {
      stage: 'other_unsure',
      employment: 'لا أعمل حاليًا',
      goal: 'غير متأكد — أريد أن يساعدني التشخيص',
      need: 'غير متأكد — أريد اقتراحًا مبنيًا على إجاباتي',
      interest: 'لا أعرف',
      skillLevel: 1,
      answers: { 'QB-M3E-004': 'لا يوجد دليل', 'QB-M2-005': 'غير واضح' },
    })
    expect(rec.kind).toBe('exploratory_direction')
    expect(rec.primaryPathway ?? null, 'استكشاف فرض مسارًا!').toBeNull()
    expect(rec.composite ?? null, 'استكشاف فرض مركبًا!').toBeNull()
    expect(rec.exploration).toBeDefined()
    expect(rec.exploration!.evidence_suggestions_ar.length).toBeGreaterThan(0)
    expect(rec.exploration!.internal_top_candidates.length).toBeGreaterThan(0)
  })

  it('المهارة المجهولة صفر أثر: لا gap ولا mastered ولا درجة فجوة مخترعة', () => {
    const universe = recommendationUniverse()
    const entity = universe.byId.get('PW-MKT-001')!
    /* حالة مهارات فارغة تمامًا — لم يُقس شيء */
    const a = assessEntitySkills(entity, new Map())
    expect(a.measuredCoverage).toBe(0)
    expect(a.gapScore).toBeNull()
    expect(a.gapSkillSlugs).toEqual([])
    expect(a.masteredSkillSlugs).toEqual([])
    expect(a.unknownSkillSlugs.length).toBeGreaterThan(0)
    expect(a.unknownSkillSlugs.length).toBe(
      entity.skill_slugs.filter((s) => a.unknownSkillSlugs.includes(s)).length,
    )
  })

  it('الحتمية: رحلة الفوز المركب مرتين تعطي نفس الأسئلة والنتيجة والثقة', () => {
    const script: Journey = {
      stage: 'freelancer',
      goal: 'بدء مشروع أو مصدر دخل مستقل',
      need: 'التفاوض وإغلاق الصفقات',
      time: '٥–٧ ساعات',
      mastery: 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف',
      interest: 'أعمال',
    }
    const a = runJourney('حتمية-أ', script)
    const b = runJourney('حتمية-ب', script)
    expect(a.asked).toEqual(b.asked)
    expect(a.rec.kind).toEqual(b.rec.kind)
    expect(a.rec.composite?.templateId ?? null).toEqual(b.rec.composite?.templateId ?? null)
    expect(a.rec.primaryPathway?.pathwayId ?? null).toEqual(b.rec.primaryPathway?.pathwayId ?? null)
    expect(a.rec.confidence.total).toEqual(b.rec.confidence.total)
  })
})

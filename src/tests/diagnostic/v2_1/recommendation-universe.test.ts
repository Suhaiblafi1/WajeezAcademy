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
import { recommendationUniverse, measurableSkills, type RecommendationEntity } from '../../../domain/diagnostic/v2_1/universe'
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
  it('الفضاء النشط = 35 كيانًا (20 قياسيًا + 15 مركبًا) — TPL-SMART-OPS-001 موسوم needs_revision بقرار أكاديمي موثق (إغلاق منطق V2.1)', () => {
    const universe = recommendationUniverse()
    expect(universe.active.length).toBe(35)
    expect(universe.active.filter((e) => e.entity_type === 'standard').length).toBe(20)
    expect(universe.active.filter((e) => e.entity_type === 'composite').length).toBe(15)
    /* القرار الموثق: SMART-OPS لا يفوز من أي شخصية بشرية طبيعية (3520 توليفة +
       12 شخصية مصممة) — PW-OPS يهيمن أحاديًا وSUPPLY/CX/DT تهيمن مركبًا */
    const sops = universe.byId.get('TPL-SMART-OPS-001')
    expect(sops?.status).toBe('needs_revision')
    expect(sops?.status_reasons_ar.join(' ')).toContain('شخصية بشرية طبيعية')
    for (const id of FORMERLY_FROZEN) {
      const e = universe.byId.get(id)
      expect(e, `كيان مفقود: ${id}`).toBeDefined()
      expect(e!.status, `${id} لم يعد معتمدًا`).toBe('approved_active')
      expect(universe.active.find((a) => a.entity_id === id), `${id} غائب عن الفضاء النشط`).toBeDefined()
    }
    // أي كيان غير معتمد (كـ SMART-OPS) يجب ألا يتسلل إلى النشط
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
    /* الأحادي لا تفوز فيه خطة مركبة أبدًا — وجود متحدٍّ شرعي (bestComposite) جائز
       عندما يصرّح المستخدم بوظيفة تضيف مجالًا ثانيًا (إغلاق منطق V2.1: سؤال
       الوظيفة أصبح حقيقة قرارية)، لكن فحص الفوز يظل حارس القيمة الإضافية */
    expect(comp.compositeVictory?.passes ?? false).toBe(false)
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

  it('حاجة متعددة المجالات مع حواسم مقيسة → مسار محسوم لا وسم مستشار: مستقل start_business + تفاوض', () => {
    const { rec } = runJourney('مستقل-ثلاثي', {
      stage: 'freelancer',
      goal: 'بدء مشروع أو مصدر دخل مستقل',
      need: 'التفاوض وإغلاق الصفقات',
      time: '٥–٧ ساعات',
      mastery: 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف',
      interest: 'أعمال',
    })
    /* المرحلة 4 (عدالة الدليل): مهارتا FREELANCE الحاسمتان (التفاوض، الكتابة
       التجارية) لا يقيسهما أي سؤال في بنك V2.1، والسباق حي — فيفوز القالب
       ويُرفق موسومًا لمراجعة مستشار بدل فوز صامت بلا قياس.
       إغلاق منطق V2.1: عدالة الدليل متعددة المتحدين منحت VENTURE فرصة إكمال
       أدلته فأصبح الفائز المرفق (ملاءمته الخام دون FREELANCE بـ0.006 ويفوز
       بتكلفة التعقيد)، ومهارة التفاوض غير المقيسة لدى FREELANCE (هامش 0.003)
       تُبقي الوسم صحيحًا — السباق غير محسوم دليليًا فعلًا */
    /* قياس 2026-08-26: كان هذا يتحقق من فوز TPL-VENTURE-001 موسوما لمراجعة
       مستشار، لأن حاسمتَي FREELANCE (التفاوض والكتابة التجارية) لم يقسهما أي
       سؤال فبقي السباق غير محسوم دليليا. وبعد قياس التفاوض حُسم السباق ونال
       المتعلم PW-BIZ-001 — وهدفه المعلن «بدء مشروع» يطابقه. على 400 شخصية
       نزلت الإحالة/الاستكشاف 146 ← 139: سبعة متعلمين إضافيين ينالون جوابا.
       فوز القوالب المركبة نفسه ما زال محروسا في evidence-fairness (٨ وصفة
       STRATEGY · ٩ وصفة ECOM) — وكلاهما يمر، فالعقد لم يسقط بتغيير العنوان. */
    expect(rec.kind).toBe('single_pathway')
    expect(rec.primaryPathway?.pathwayId).toBe('PW-BIZ-001')
    /* الفائز يبقى داخل الفضاء النشط ومحسوما بلا وسم — لا فوز صامت */
    const active = new Set(recommendationUniverse().active.map((e) => e.entity_id))
    expect(active, 'فائز خارج الفضاء النشط').toContain(rec.primaryPathway!.pathwayId)
    expect(rec.confidence.total).toBeGreaterThan(0)
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

describe('ثبات قابلية قياس الحاسمات — إغلاق منطق V2.1', () => {
  it('كل مهارة حاسمة في الفضاء النشط يقيسها سؤال skill_level_5 نشط (لا حاسمة غير قابلة للإنتاج)', () => {
    /* حارس الصمت في المحرك (وسم مستشار عند حاسمة مجهولة غير قابلة للقياس في
       سباق حي) دفاعي ما دام هذا الثبات قائمًا. إن أضيفت يومًا مهارة حاسمة بلا
       سؤال نشط يقيسها، يفشل هذا الاختبار ويفرض القرار: أضف سؤالًا أو أعد
       تصنيف المهارة — لا صمتًا ولا اكتشافًا بالمصادفة */
    const measurable = measurableSkills()
    for (const e of recommendationUniverse().active) {
      for (const s of e.skill_roles.decisive) {
        expect(measurable.has(s), `${e.entity_id}: حاسمة بلا سؤال نشط يقيسها: ${s}`).toBe(true)
      }
    }
  })
})

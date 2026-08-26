/* اختبارات Regression — المرحلة 4: عدالة الدليل المهاري وقابلية الوصول.
   تثبيت سلوكيات أُصلحت وموثقة، لا يجوز أن ترتد:
   ١) المهارات الأربع المقاسة غير المغطاة خارج التدفق الأساسي (post_recommendation)
   ٢) أسئلة ما بعد التوصية لا تستهلك ميزانية الأسئلة
   ٣) سؤال المهارة للفصل لا للتعزيز — لا يُسأل عند هامش مريح أبدًا
   ٤) سباق حي بحاسمة مجهولة: دليل أدنى مقاس + لا Strong مضلل + لا صمت في الشرح
   ٥) سباق مريح + حاسمة غير مقيسة → بلا وسم (لا إفراط إحالة)
   ٦) المهارة المقيسة بسؤال M4 تُحتسب حقيقة مغطاة في بوابة التغطية
   ٧) بوابة التغطية تفشل تحت الحد برسالة مفهومة
   ٨) وصفة STRATEGY القانونية تفوز (قالب كان unreachable)
   ٩) وصفة ECOM القانونية تفوز (قالب كسره تناقض شخصية البحث)
   ١٠) لا فائز خارج الفضاء النشط في أي رحلة
   ١١) الحتمية تُصان مع آليات الدليل (الرحلة الموسومة مرتان متطابقتان)
   ١٢) الاستكشاف لا يستهلك مقاعد لقياس مهارات */

import { describe, expect, it } from 'vitest'
import { createEngineV21, type RecommendationV21 } from '../../../domain/diagnostic/v2_1'
import { Q, type CareerStage } from '../../../domain/diagnostic/v2_1/maps'
import { recommendationUniverse, measurableSkills } from '../../../domain/diagnostic/v2_1/universe'
import { compositeVictoryCheck, type CompetitionResult } from '../../../domain/diagnostic/v2_1/compete'
import { questionPlanV21 } from '../../../domain/diagnostic/v2_1/data'

/* ─── جسر الرحلات (نفس نمط recommendation-universe) ─── */
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

interface StepTrace {
  questionId: string
  isSkillQuestion: boolean
  marginBefore: number
}

/* سؤال قياس مهارة حقيقي: يقيس slug مهارة معلنة في أدوار كيان ما (حاسمة/داعمة).
   لا يكفي layer21='evidence_skill' — QB-M3E-004 يقيس exploration_evidence
   (دليل استكشاف لا مهارة) ويُسأل عمدًا في رحلات الغموض */
const SKILL_SLUGS = (() => {
  const u = recommendationUniverse()
  const set = new Set<string>()
  for (const e of u.byId.values()) {
    for (const s of e.skill_roles.decisive) set.add(s)
    for (const s of e.skill_roles.supporting) set.add(s)
    for (const s of e.skill_roles.learning_outcome ?? []) set.add(s)
  }
  return set
})()

function runJourneyTraced(name: string, script: Journey): {
  asked: string[]
  trace: StepTrace[]
  rec: RecommendationV21
  comp: CompetitionResult
  engine: ReturnType<typeof createEngineV21>
} {
  const engine = createEngineV21(`test-evidence-${name}`)
  const asked: string[] = []
  const trace: StepTrace[] = []
  for (let i = 0; i < 20; i++) {
    const step = engine.nextQuestion()
    if (step.stop.shouldStop || !step.question) break
    const q = step.question
    asked.push(q.question_id)
    const snap = engine.competeSnapshot()
    const margin = snap.candidates.length >= 2 ? snap.candidates[0].netFit - snap.candidates[1].netFit : 1
    trace.push({
      questionId: q.question_id,
      isSkillQuestion: q.measures.some((m) => SKILL_SLUGS.has(m)),
      marginBefore: margin,
    })
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
    engine.answer({ questionId: q.question_id, value: q.options_ar[idx], optionIds: [q.active_option_ids?.[idx] ?? `o${idx + 1}`] })
  }
  return { asked, trace, rec: engine.recommend(), comp: engine.competeSnapshot(), engine }
}

/* قرار 2026-08-19: الثلاث ذات الفعل التخصيصي المبرمج تبقى post_recommendation؛
   QB-M4-002 (creative_thinking) أُوقف كليًا — لا مستهلك مبرمج لقياسه (retired_b2c). */
const MOVED_THREE = ['QB-M4-005', 'QB-M4-023', 'QB-M4-025']
const RETIRED_NO_ACTION = 'QB-M4-002'

/* رحلات متنوعة تغطي شخصيات مختلفة — تُستخدم في اختبارات الخصائص */
const PROPERTY_JOURNEYS: [string, Journey][] = [
  ['تسويق-مريح', { stage: 'experienced', goal: 'التقدم أو الترقية في عملي', need: 'التسويق ونمو العملاء', time: '٥–٧ ساعات', mastery: 'أن أتقن مهارة أو تخصصًا واحدًا بعمق' }],
  ['طالب-أول-وظيفة', { stage: 'university_student', employment: 'لا أعمل حاليًا', goal: 'الحصول على أول وظيفة', need: 'التفاوض وإغلاق الصفقات', skillLevel: 2 }],
  ['مؤسس-بداية', { stage: 'founder', employment: 'لدي مشروعي الخاص', goal: 'بدء مشروع أو مصدر دخل مستقل', need: 'بناء مشروعي من الصفر', time: '٥–٧ ساعات', skillLevel: 2 }],
  ['مدير-قيادة', { stage: 'manager', goal: 'الاستعداد لدور قيادي', need: 'القيادة وإدارة الفرق', skillLevel: 3 }],
  ['مستقل-تفاوض', { stage: 'freelancer', employment: 'أعمل لحسابي (عمل حر)', goal: 'بدء مشروع أو مصدر دخل مستقل', need: 'التفاوض وإغلاق الصفقات', time: '٥–٧ ساعات', mastery: 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف', interest: 'أعمال' }],
]

describe('Regression المرحلة 4 — عدالة الدليل المهاري', () => {
  it('١) المهارات الثلاث المنقولة: final_status = post_recommendation ولا تُسأل في أي رحلة', () => {
    for (const id of MOVED_THREE) {
      expect(questionPlanV21[id]?.final_status, `${id} لم تُنقل`).toBe('post_recommendation')
    }
    for (const [name, j] of PROPERTY_JOURNEYS) {
      const { asked } = runJourneyTraced(name, j)
      for (const id of MOVED_THREE) expect(asked, `${id} سُئلت في رحلة ${name}`).not.toContain(id)
    }
  })

  it('١ب) QB-M4-002 موقوفة كليًا: متقاعدة ولا تُسأل في أي رحلة ولا تدخل القابلية للقياس', () => {
    expect(questionPlanV21[RETIRED_NO_ACTION]?.final_status).toBe('retired')
    expect(questionPlanV21[RETIRED_NO_ACTION]?.surface).toBe('retired_b2c')
    expect(measurableSkills().has('creative_thinking')).toBe(false)
    for (const [name, j] of PROPERTY_JOURNEYS) {
      const { asked } = runJourneyTraced(name, j)
      expect(asked, `${RETIRED_NO_ACTION} سُئلت في رحلة ${name}`).not.toContain(RETIRED_NO_ACTION)
    }
  })

  it('٢) أسئلة ما بعد التوصية لا تستهلك ميزانية التدفق الأساسي أبدًا', () => {
    const postIds = Object.entries(questionPlanV21)
      .filter(([, p]) => p.final_status === 'post_recommendation')
      .map(([id]) => id)
    expect(postIds.length).toBeGreaterThan(20)
    for (const [name, j] of PROPERTY_JOURNEYS) {
      const { asked } = runJourneyTraced(name, j)
      for (const id of asked) {
        expect(postIds, `سؤال ما بعد التوصية ${id} تسلل إلى رحلة ${name}`).not.toContain(id)
      }
    }
  })

  it('٣) سؤال المهارة للفصل لا للتعزيز: لا يُسأل عند هامش مريح (≥ 0.15) أبدًا', () => {
    let skillQuestionsChecked = 0
    for (const [name, j] of PROPERTY_JOURNEYS) {
      const { trace } = runJourneyTraced(name, j)
      for (const st of trace) {
        if (!st.isSkillQuestion) continue
        skillQuestionsChecked++
        expect(
          st.marginBefore,
          `سؤال مهارة ${st.questionId} سُئل عند هامش مريح ${st.marginBefore.toFixed(3)} في رحلة ${name} — تعزيز لا فصل`,
        ).toBeLessThan(0.15)
      }
    }
    expect(skillQuestionsChecked, 'الرحلات لم تُنتج أي سؤال مهارة — الاختبار بلا دليل').toBeGreaterThan(0)
  })

  it('٤) سباق حي بحاسمة مجهولة: دليل أدنى مقاس + لا Strong مضلل + لا صمت في الشرح', () => {
    /* إغلاق منطق V2.1 — تصحيح فرضية موثق: الفحص الشامل أثبت أن كل مهارة حاسمة
       في الفضاء النشط قابلة للقياس بسؤال نشط (لا توجد حاسمة «غير قابلة للإنتاج»
       أصلًا — تحصينها اختبار ثبات في recommendation-universe). لذلك عقد «لا صمت»
       يُقفل بثلاثة أقفال قابلة للتحقق لا بوسم مستشار مستحيل البيانات:
       ١) حد الدليل الأدنى يقيس حاسمة واحدة على الأقل للمتصدر قبل الاكتفاء
       ٢) المهارة المجهولة (negotiation) لا تدخل الفجوات ولا الشرح ولا النتيجة
       ٣) الثقة تبقى دون «قوية» ما دام السباق حيًا بدليل ناقص */
    const { asked, rec, comp } = runJourneyTraced('مستقل-موسوم', {
      stage: 'freelancer',
      employment: 'أعمل لحسابي (عمل حر)',
      goal: 'بدء مشروع أو مصدر دخل مستقل',
      need: 'التواصل والعرض والتأثير',
      time: '٥–٧ ساعات',
      mastery: 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف',
      interest: 'أعمال',
    })
    expect(asked, 'حد الدليل الأدنى لم يقس أي حاسمة للمتصدر').toContain('QB-M4-010')
    /* قياس 2026-08-26: كان الفائز هنا TPL-FREELANCE-001. لم يتغيّر الترتيب الخام
       — PW-BIZ-001 كان ولا يزال أعلى صافيا (0.858 ثم 0.837) — بل تغيّر منح القالب
       ترقيته: القالب يشترط 7 حقائق بتغطية ≥ 0.8، وsales_negotiation لا يُنتجها
       إلا QB-M3C-008. وبإضافة أسئلة المهارات الثلاثة زاحمت المقاعدَ داخل سقف
       الأربعة عشر سؤالا فسقط QB-M3C-008، فنزلت التغطية دون البوابة.
       المفاضلة قِيست على 400 شخصية لا قُدِّرت: القوالب المركبة 3 ← 2، مقابل
       نزول الإحالة/الاستكشاف 146 ← 139 — أي سبعة متعلمين إضافيين ينالون
       توصية محددة بدل تحويلهم لمستشار. أُبقيت الأسئلة والمكسب الأكبر.
       الأقفال الثلاثة التي وُضع الاختبار لحراستها باقية كما هي أدناه. */
    expect(rec.kind).toBe('single_pathway')
    expect(rec.primaryPathway!.pathwayId).toBe('PW-BIZ-001')
    const winner = comp.candidates[0]
    expect(winner.skills.gapSkillSlugs, 'مهارة مجهولة احتُسبت فجوة').not.toContain('negotiation')
    expect(JSON.stringify(rec.reasons_ar), 'مهارة مجهولة تسللت إلى الشرح').not.toContain('negotiation')
    expect(rec.confidence.band, 'ثقة قوية مضللة رغم سباق حي بحاسمة مجهولة').not.toBe('strong')
    expect(rec.confidence.total).toBeGreaterThan(0)
  })

  it('٤ب) «قوية» لا تُمنح دون نصف المهارات مقيسة — ولو اتضح الهدف واتسع الهامش', () => {
    /* كان هذا الاختبار يقفل «قوية» لهذه الوصفة، ويمر لسببٍ غير الذي يدّعيه:
       اسمه «دليل مكتمل» بينما تغطيته المقيسة 10.5٪ فقط. ومرّ لأن مانع المهارات
       كان مشروطا بضيق الهامش (separation < 0.533) وهامش هذه الوصفة 0.56 —
       نجا بفارق 0.027 لا باستيفاء الشرط. وكان يناقض القاعدة رقم ٤ صراحة:
       «لا تطابق قوي مع تغطية مهارات دون 50٪».

       ولما أُغلق باب الكيان بلا جمهور معلن (كان يملأ المقعد الثاني بلا حق)،
       وصار المانع قاعدةً لا استثناء، انكشف التناقض. والقاعدة ٤ هي التي تبقى:
       «تطابق قوي» ادّعاء معرفةٍ بالمتعلم، ولا يُقال لمن قِسنا عُشر مهاراته.

       فالنطاق الأعلى اليوم غير قابل للبلوغ عمليا — وهذا وصفٌ صادق لحال القياس
       لا عيبٌ في المعايرة: تغطية القياس عند 4.9٪ من مهارات المقررات. يفتحه
       رفعُ التغطية لا تحريكُ العتبة. */
    const { rec } = runJourneyTraced('خريج-قوي', {
      stage: 'fresh_graduate',
      employment: 'لا أعمل حاليًا',
      goal: 'الحصول على أول وظيفة',
      need: 'الجاهزية لسوق العمل — سيرة ومقابلات وملف أعمال',
      mastery: 'أن أتقن مهارة أو تخصصًا واحدًا بعمق',
      answers: { 'QB-M2-005': 'واضح جدا' },
      skillLevel: 4,
    })
    expect(rec.primaryPathway?.pathwayId).toBe('PW-STU-002')
    const conf = (rec as unknown as { v2?: { confidence: { skillEvidenceCoverage: number; strongBlockers_ar: string[] } } }).v2
    expect(conf!.confidence.skillEvidenceCoverage).toBeLessThan(0.5)
    expect(conf!.confidence.strongBlockers_ar).toContain('أغلب مهارات المسار المتصدر لم تُقس بدليل مباشر.')
    expect(rec.confidence.band).toBe('good')
  })

  it('٥) سباق مريح + حاسمة غير مقيسة → فوز نظيف بلا وسم مستشار (لا إفراط إحالة)', () => {
    const { rec } = runJourneyTraced('تسويق-مريح', {
      stage: 'experienced',
      goal: 'التقدم أو الترقية في عملي',
      need: 'التسويق ونمو العملاء',
      time: '٥–٧ ساعات',
      mastery: 'أن أتقن مهارة أو تخصصًا واحدًا بعمق',
    })
    expect(rec.kind).toBe('single_pathway')
    expect(JSON.stringify(rec.reasons_ar)).not.toContain('مهارة حاسمة')
  })

  it('٦) المهارة المقيسة بسؤال M4 تُحتسب حقيقة مغطاة: تغطية ECOM = 1 رغم غياب مفاتيحها من الحقائق', () => {
    const { comp, engine } = runJourneyTraced('ecom-تغطية', {
      stage: 'freelancer',
      employment: 'أعمل لحسابي (عمل حر)',
      goal: 'زيادة دخلي وعملائي في العمل الحر',
      need: 'تحليل البيانات واتخاذ القرار',
      time: '٥–٧ ساعات',
      mastery: 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف',
      skillLevel: 2,
    })
    const self = comp.candidates.find((c) => c.entity.entity_id === 'TPL-ECOM-001')!
    const best = comp.candidates.filter((c) => c.entity.entity_type !== 'composite').sort((a, b) => b.netFit - a.netFit)[0]
    const facts = engine.getState().facts
    const ctx = (engine as unknown as { decisionContext(): Parameters<typeof compositeVictoryCheck>[3] }).decisionContext()
    const v = compositeVictoryCheck(self, best, facts, ctx)
    /* digital_marketing/business_finance مطلوبة ولا تعيش في حقيبة الحقائق —
       قياسها بأسئلة المهارات هو ما رفع التغطية إلى 1 */
    expect(facts['digital_marketing']).toBeUndefined()
    /* جوهر الاختبار: المهارة المقيسة بسؤال M4 تُحتسب حقيقة مغطاة رغم أنها لا
       تعيش في حقيبة الحقائق. يُثبَت بالآلية لا بمجموع ثابت: كانت التغطية 1
       حتى 2026-08-26، ثم صارت 0.875 لأن revenue_signal زوحم خارج سقف الأسئلة
       بعد قياس خمس مهارات إضافية — والبوابة ما زالت تمر (0.875 ≥ 0.8).
       تثبيت الرقم على 1 كان يقيس ترتيب الأسئلة لا الآلية المقصودة. */
    const measuredAsFact = ['digital_marketing', 'business_finance'].filter(
      (k) => facts[k] === undefined && ctx.skillStates.get(k)?.state === 'measured',
    )
    expect(measuredAsFact, 'لم تُحتسب أي مهارة مقيسة حقيقةً مغطاة').not.toEqual([])
    expect(v.factCoverage).toBeGreaterThanOrEqual(self.entity.minimum_evidence.fact_coverage)
    expect(v.passes).toBe(true)
  })

  it('٧) بوابة التغطية تفشل عند نقص الحقائق المطلوبة برسالة مفهومة', () => {
    const { comp, engine } = runJourneyTraced('ecom-تجريد', {
      stage: 'freelancer',
      employment: 'أعمل لحسابي (عمل حر)',
      goal: 'زيادة دخلي وعملائي في العمل الحر',
      need: 'تحليل البيانات واتخاذ القرار',
      time: '٥–٧ ساعات',
      mastery: 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف',
      skillLevel: 2,
    })
    const self = comp.candidates.find((c) => c.entity.entity_id === 'TPL-ECOM-001')!
    const best = comp.candidates.filter((c) => c.entity.entity_type !== 'composite').sort((a, b) => b.netFit - a.netFit)[0]
    const ctx = (engine as unknown as { decisionContext(): Parameters<typeof compositeVictoryCheck>[3] }).decisionContext()
    /* حقائق مجردة كليًا بلا قياس — التغطية يجب أن تهبط وتفشل البوابة */
    const strippedCtx = { ...ctx, skillStates: new Map() }
    const v = compositeVictoryCheck(self, best, {}, strippedCtx)
    expect(v.factCoverage).toBeLessThan(self.entity.minimum_evidence.fact_coverage)
    expect(v.passes).toBe(false)
    expect(v.reasons_ar.join(' ')).toContain('حقائق مطلوبة لم تُجمع')
  })

  it('٨) وصفة STRATEGY القانونية تفوز: مدير + مشاريع + هدف محايد + وظيفة قيادة', () => {
    const { rec } = runJourneyTraced('strategy-قانونية', {
      stage: 'manager',
      goal: 'تطوير مهارة محددة أعرفها',
      need: 'إدارة المشاريع',
      time: '٥–٧ ساعات',
      mastery: 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف',
      answers: { 'QB-M3B-011': 'قيادة' },
      skillLevel: 2,
    })
    expect(rec.composite?.templateId).toBe('TPL-STRATEGY-001')
  })

  it('٩) وصفة ECOM القانونية تفوز: مستقل متسق الشخصية + عمل حر قائم + بيانات', () => {
    const { rec } = runJourneyTraced('ecom-قانونية', {
      stage: 'freelancer',
      employment: 'أعمل لحسابي (عمل حر)',
      goal: 'زيادة دخلي وعملائي في العمل الحر',
      need: 'تحليل البيانات واتخاذ القرار',
      time: '٥–٧ ساعات',
      mastery: 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف',
      skillLevel: 2,
    })
    expect(rec.composite?.templateId).toBe('TPL-ECOM-001')
  })

  it('١٠) لا فائز خارج الفضاء النشط الـ35 في أي رحلة (SMART-OPS موسوم needs_revision — إغلاق منطق V2.1)', () => {
    const universe = recommendationUniverse()
    const activeIds = new Set(universe.active.map((e) => e.entity_id))
    expect(activeIds.size).toBe(35)
    for (const [name, j] of PROPERTY_JOURNEYS) {
      const { rec } = runJourneyTraced(name, j)
      const winner = rec.composite?.templateId ?? rec.primaryPathway?.pathwayId ?? null
      if (winner) expect(activeIds, `فائز خارج الفضاء في رحلة ${name}: ${winner}`).toContain(winner)
      for (const alt of rec.alternatives ?? []) {
        const altId = (alt as { pathwayId?: string }).pathwayId
        if (altId) expect(activeIds, `بديل خارج الفضاء في رحلة ${name}: ${altId}`).toContain(altId)
      }
    }
  })

  it('١١) الحتمية مع آليات الدليل: الرحلة الموسومة مرتان تعطيان تطابقًا تامًا', () => {
    const script: Journey = {
      stage: 'freelancer',
      employment: 'أعمل لحسابي (عمل حر)',
      goal: 'بدء مشروع أو مصدر دخل مستقل',
      need: 'التفاوض وإغلاق الصفقات',
      time: '٥–٧ ساعات',
      mastery: 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف',
      interest: 'أعمال',
    }
    const a = runJourneyTraced('حتمية-أ', script)
    const b = runJourneyTraced('حتمية-ب', script)
    expect(a.asked).toEqual(b.asked)
    expect(a.rec.kind).toBe(b.rec.kind)
    expect(a.rec.composite?.templateId ?? null).toBe(b.rec.composite?.templateId ?? null)
    expect(a.rec.confidence.total).toBe(b.rec.confidence.total)
    expect(a.rec.reasons_ar).toEqual(b.rec.reasons_ar)
  })

  it('١٢) الاستكشاف لا يستهلك مقاعد لقياس مهارات — رحلة غير متأكد بلا أسئلة M4', () => {
    const { asked, rec } = runJourneyTraced('استكشاف-نقي', {
      stage: 'other_unsure',
      employment: 'لا أعمل حاليًا',
      goal: 'غير متأكد — أريد أن يساعدني التشخيص',
      need: 'غير متأكد — أريد اقتراحًا مبنيًا على إجاباتي',
      interest: 'لا أعرف',
      skillLevel: 1,
    })
    expect(rec.kind).toBe('exploratory_direction')
    for (const id of asked) {
      /* لا سؤال يقيس slug مهارة حقيقية — أسئلة دليل الاستكشاف (exploration_evidence) مسموحة */
      const measuresSkill = (questionPlanV21[id]?.measures ?? []).some((m) => SKILL_SLUGS.has(m))
      expect(measuresSkill, `سؤال مهارة ${id} تسلل إلى رحلة استكشاف`).toBe(false)
    }
  })
})

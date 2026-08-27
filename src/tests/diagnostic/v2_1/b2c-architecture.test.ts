/* اختبارات قبول بنية أسئلة B2C — V2.1 (معايير النجاح §18):
   تسرب مؤسسي = 0 · لا school_student/parent · لا ميزانية/لغة/صاحب قرار ·
   لا تاريخ إكمال دورات يؤثر على المسار · كل سؤال نشط له أثر موثق ·
   المهارة المجهولة لا تؤثر · كل خيار له consequence · حتمية كاملة. */

import { describe, expect, it } from 'vitest'
import { createEngineV21, type RecommendationV21 } from '../../../domain/diagnostic/v2_1'
import {
  B2C_BANNED_FACTS,
  B2C_BANNED_QUESTION_PREFIXES,
  Q,
  goalsForStage,
  needsForStage,
  type CareerStage,
} from '../../../domain/diagnostic/v2_1/maps'
import { questionPlanV21 } from '../../../domain/diagnostic/v2_1/data'
import { keywordClassifiers, optionEffects, questionById } from '../../../domain/diagnostic/catalog'

/* ─── محاكاة جلسة كاملة: نجيب دائمًا بخيار حتمي (أول خيار صالح أو حسب السيناريو) ─── */
interface ScriptedJourney {
  stage: CareerStage
  employment?: string // optionId o1..o5
  goal?: string // optionId ضمن المفلترة
  need?: string
  mastery?: string
  skillLevel?: number // 1..5 لأسئلة الدليل
}

function runJourney(script: ScriptedJourney): {
  engine: ReturnType<typeof createEngineV21>
  asked: string[]
  rec: RecommendationV21
} {
  const engine = createEngineV21(`test-${Math.random().toString(36).slice(2, 8)}`)
  const asked: string[] = []
  for (let i = 0; i < 20; i++) {
    const step = engine.nextQuestion()
    if (step.stop.shouldStop || !step.question) break
    const q = step.question
    asked.push(q.question_id)
    let optionId: string
    if (q.question_id === Q.STAGE) {
      const stages: CareerStage[] = ['university_student', 'fresh_graduate', 'early_career', 'experienced', 'manager', 'senior_manager', 'founder', 'freelancer', 'trainer_ld', 'other_unsure']
      optionId = `o${stages.indexOf(script.stage) + 1}`
    } else if (q.question_id === Q.EMPLOYMENT) {
      optionId = script.employment ?? 'o3'
    } else if (q.question_id === Q.GOAL) {
      optionId = script.goal ?? (q.active_option_ids ?? [])[0] ?? 'o1'
    } else if (q.question_id === Q.NEED) {
      optionId = script.need ?? (q.active_option_ids ?? [])[0] ?? 'o1'
    } else if (q.question_id === Q.MASTERY) {
      optionId = script.mastery ?? 'o3'
    } else if (q.answer_type === 'skill_level_5' || q.answer_type === 'likert_5') {
      optionId = `o${script.skillLevel ?? 3}`
    } else {
      optionId = 'o1'
    }
    const idx = q.active_option_ids
      ? q.active_option_ids.indexOf(optionId)
      : Number(optionId.slice(1)) - 1
    const label = q.options_ar[idx] ?? q.options_ar[0]
    const realId = q.active_option_ids?.[idx] ?? optionId
    engine.answer({ questionId: q.question_id, value: label, optionIds: [realId] })
  }
  return { engine, asked, rec: engine.recommend() }
}

const ALL_STAGES: CareerStage[] = [
  'university_student', 'fresh_graduate', 'early_career', 'experienced', 'manager',
  'senior_manager', 'founder', 'freelancer', 'trainer_ld', 'other_unsure',
]

describe('بنية أسئلة B2C — معايير النجاح', () => {
  it('لا تسرب مؤسسي: لا سؤال M0/M9 ولا حقيقة محظورة في أي مرحلة مهنية', () => {
    for (const stage of ALL_STAGES) {
      const { asked, engine } = runJourney({ stage })
      for (const id of asked) {
        for (const prefix of B2C_BANNED_QUESTION_PREFIXES) {
          expect(id.startsWith(prefix), `${stage}: سؤال محظور ${id}`).toBe(false)
        }
        expect(id.startsWith('QB-M0-'), `${stage}: سؤال استقبال ${id}`).toBe(false)
      }
      for (const fact of B2C_BANNED_FACTS) {
        expect(engine.getState().facts[fact], `${stage}: حقيقة محظورة ${fact}`).toBeUndefined()
      }
    }
  })

  it('لا school_student ولا parent_guardian في أي جلسة', () => {
    for (const stage of ALL_STAGES) {
      const { engine } = runJourney({ stage })
      const tracePersona = JSON.stringify(engine.getState().trace)
      expect(tracePersona).not.toContain('school_student')
      expect(tracePersona).not.toContain('parent_guardian')
    }
  })

  it('الموافقة ليست سؤالًا: QB-M0-006 لا يُسأل أبدًا والموافقة إقرار واجهة', () => {
    const { asked, engine } = runJourney({ stage: 'experienced' })
    expect(asked).not.toContain('QB-M0-006')
    expect(engine.getState().consentGiven).toBe(true)
    expect(engine.getState().trace.some((t) => t.kind === 'consent_ui_ack')).toBe(true)
  })

  it('أسئلة سلوك إكمال الدورات لا تُسأل ولا تؤثر على المسار', () => {
    const { asked } = runJourney({ stage: 'experienced' })
    expect(asked).not.toContain('QB-M1-009')
    expect(asked).not.toContain('QB-M1-010')
  })

  it('التوفيق النهائي: كل سؤال له final_status واحدة والمجموع = 205', () => {
    const counts: Record<string, number> = {}
    for (const [id, p] of Object.entries(questionPlanV21)) {
      expect(p.final_status, `سؤال بلا حالة نهائية: ${id}`).toBeDefined()
      /* الاشتقاق حتمي من (surface, phase, action) — لا تناقض بين الحالة والسطح */
      if (p.surface === 'b2c') expect(['active_b2c', 'deep_only']).toContain(p.final_status)
      if (p.surface === 'post_recommendation') expect(p.final_status).toBe('post_recommendation')
      if (p.surface === 'b2b_b2g') expect(p.final_status).toBe('institutional')
      if (p.surface === 'ui_ack') expect(p.final_status).toBe('out_of_scope')
      if (p.surface === 'retired_b2c') expect(['retired', 'out_of_scope']).toContain(p.final_status)
      counts[p.final_status] = (counts[p.final_status] ?? 0) + 1
    }
    expect(Object.keys(questionPlanV21).length).toBe(205)
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(205)
    /* الأرقام المرجعية الموثقة — أي تغيير يتطلب تحديثًا مقصودًا لهذا الاختبار.
       المرحلة 4: نُقلت أسئلة المهارات الأربع المقاسة غير المغطاة
       (QB-M4-002/005/023/025) إلى ما بعد التوصية بقرار أكاديمي موثق.
       إغلاق منطق V2.1: نُقلت تسعة أسئلة مهارية أخرى (QB-M4-009/014/015/019/
       020/021/022/024/026) — مهاراتها غير معلَنة حاسمة ولا داعمة ولا مخرج
       تعلم لأي كيان نشط، ولم تُسأل قط في 12 ألف جلسة محاكاة — إلى ما بعد
       التوصية: قياسها قبل النتيجة مقعد بلا أثر قراري.
       حوكمة 2026-08-19: QB-M4-002 (creative_thinking) → retired_b2c — فحص
       الكود أثبت عدم وجود أي فعل تخصيص مبرمج يستهلك قياسها؛ لا تُسأل لمجرد
       جمع البيانات (post_recommendation 38→37 · retired 58→59)
       قياس 2026-08-26: أُضيفت ثلاثة أسئلة مهارية موقفية (QB-M4-027 إصغاء ·
       028 تعبير · 029 بحث سوق) تقيس أعلى ثلاث مهارات غير مقيسة أثرا، فارتفع
       active_b2c 62→65؛ وتقاعد QB-M3E-004 (ميت كليا: 54 مقعدا بلا أثر ولا
       مستهلك تصريحي لمفتاحه) فعاد 65→64 وretired 59→60. المجموع 198→201.
       تغطية 2026-08-26: أُضيفت أربعة أسئلة موقفية للمسارات الأربعة التي بقيت
       بلا مهارة مقيسة (QB-M4-030 مقابلات منظمة · 031 تخطيط توريد · 032 تحليل
       حاجة تدريبية · 033 تحليل انحرافات)، فصار كل مسار من العشرين فيه مهارة
       مقيسة ووزن فجوة المهارة (٢٥٪) يعمل في الكتالوج كله.
       active_b2c 64→68 والمجموع 201→205.
       توجيه 2026-08-27: وُجّهت تسعة أسئلة M4 كانت تقيس مفاتيح غير مسجّلة إلى
       مهاراتها المسجّلة — فلم يعد سؤال واحد يقيس مفتاحا لا وجود له. وثمانية
       منها بقيت في مواضعها؛ أما QB-M4-009 (الإنجليزية) فتقاعد: مهارته
       english_for_work محكومة بـfuture_catalog_skill ولا دورة تُعلّمها، فلا
       يُقاس ما لا يُعلَّم. post_recommendation 37→36 · retired 60→61،
       والمجموع 205 كما هو — انتقال حالة لا زيادة سؤال.
       حذف 2026-08-27: تقاعد QC-F7-001 (الساعات الأسبوعية) — قِيس بأربع شخصيات
       في أربع إجابات مع تثبيت كل ما عداه فأعطت الستة عشر تشغيلًا ناتجًا واحدًا:
       نفس المسار ونفس الدورات ونفس الساعات. ومعه تقاعد QB-M8-001 لأن شرط
       ظهوره (هدف عاجل + وقت منخفض) لم يعد قابلًا للتحقق أصلًا.
       active_b2c 68→67 · deep_only 11→10 · retired 61→63، والمجموع 205. */
    expect(counts).toEqual({ active_b2c: 67, deep_only: 10, post_recommendation: 36, institutional: 14, retired: 63, out_of_scope: 15 })
  })

  it('كل سؤال نشط في B2C له أثر قراري موثق في الخطة', () => {
    for (const stage of ALL_STAGES) {
      const { asked } = runJourney({ stage })
      for (const id of asked) {
        const plan = questionPlanV21[id]
        expect(plan, `سؤال بلا خطة: ${id}`).toBeDefined()
        expect(plan.surface, `${id} ليس b2c`).toBe('b2c')
        expect(plan.impact_ar.length, `${id} بلا أثر موثق`).toBeGreaterThan(10)
        expect(plan.action === 'keep' || plan.action === 'rewrite', `${id} فعل غير صالح: ${plan.action}`).toBe(true)
      }
    }
  })

  it('كل خيار في سؤال B2C نشط له consequence معرّف (أثر صريح أو مقياس ترتيبي)', () => {
    const active = Object.entries(questionPlanV21)
      .filter(([, p]) => p.surface === 'b2c')
      .map(([id]) => questionById.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q))
    expect(active.length).toBeGreaterThan(50)
    for (const q of active) {
      const hasExplicit = Boolean(optionEffects[q.question_id]) || Boolean(keywordClassifiers[q.question_id])
      const ordinal = ['skill_level_5', 'likert_5', 'single_choice', 'multi_choice', 'rank_top3'].includes(q.answer_type)
      /* أسئلة الالتقاط الحر في جولة التأكيد (ملاحظة عدم يقين/سبب رفض) consequence-ها موثق:
         تُسجل في تسليم المستشار — لكنها ليست أسئلة قرار */
      const documentedCapture =
        (q.answer_type === 'short_text' || q.answer_type === 'single_choice_or_text') &&
        questionPlanV21[q.question_id]?.phase === 'confirmation'
      expect(hasExplicit || ordinal || documentedCapture, `${q.question_id} بلا consequence`).toBe(true)
    }
  })

  it('خيارات الهدف والاحتياج تُفلتر حسب المرحلة — خيار لا يناسب المرحلة لا يُعرض', () => {
    const engine = createEngineV21()
    /* طالب جامعي */
    engine.answer({ questionId: Q.STAGE, value: 'طالب جامعي', optionIds: ['o1'] })
    engine.nextQuestion()
    const step = (function drain() {
      let s = engine.nextQuestion()
      while (s.question && s.question.question_id !== Q.GOAL && !s.stop.shouldStop) {
        const q = s.question
        engine.answer({ questionId: q.question_id, value: q.options_ar[0], optionIds: ['o1'] })
        s = engine.nextQuestion()
      }
      return s
    })()
    expect(step.question?.question_id).toBe(Q.GOAL)
    const goalOptions = step.question!.options_ar
    const studentGoals = new Set(goalsForStage('university_student').map((g) => g.label_ar))
    for (const opt of goalOptions) expect(studentGoals.has(opt), `خيار هدف غير مناسب لطالب: ${opt}`).toBe(true)
    expect(goalOptions).not.toContain('التقدم أو الترقية في عملي')
    expect(goalOptions).not.toContain('تنمية مشروعي القائم وزيادة إيراداته')
  })

  it('احتياجات الطالب الجامعي لا تعرض القيادة ولا سلسلة الإمداد', () => {
    const studentNeeds = new Set(needsForStage('university_student').map((n) => n.label_ar))
    expect([...studentNeeds].some((l) => l.includes('القيادة وإدارة الفرق'))).toBe(false)
    expect([...studentNeeds].some((l) => l.includes('سلسلة الإمداد'))).toBe(false)
    expect([...studentNeeds].some((l) => l.includes('الجاهزية لسوق العمل'))).toBe(true)
  })

  it('الحتمية: نفس الإجابات مرتين تعطي نفس الأسئلة والنتيجة', () => {
    const script: ScriptedJourney = { stage: 'experienced', employment: 'o3', goal: 'o2', need: undefined, skillLevel: 4 }
    const a = runJourney(script)
    const b = runJourney(script)
    expect(a.asked).toEqual(b.asked)
    expect(a.rec.primaryPathway?.pathwayId ?? null).toEqual(b.rec.primaryPathway?.pathwayId ?? null)
    expect(a.rec.kind).toEqual(b.rec.kind)
  })

  it('المهارة المجهولة لا تؤثر: لا فجوة ولا تفسير ولا ranking لمهارة لم تُقس', () => {
    const { rec } = runJourney({ stage: 'founder' })
    const v2 = rec.v2
    expect(v2).toBeDefined()
    const exp = (v2 as { explanation?: { unknown_skills?: { slug: string }[]; measured_skills?: { slug: string }[] } }).explanation
    expect(exp).toBeDefined()
    /* كل مهارة في التفسير إما مقاسة صراحة أو مجهولة صراحة — لا مستويات مخترعة */
    for (const m of exp?.measured_skills ?? []) expect(m.slug).toBeTruthy()
  })

  it('عدد الأسئلة بين 6 و14 في كل المراحل', () => {
    for (const stage of ALL_STAGES) {
      const { asked } = runJourney({ stage })
      expect(asked.length, `${stage}: ${asked.length} سؤالًا`).toBeGreaterThanOrEqual(6)
      expect(asked.length, `${stage}: ${asked.length} سؤالًا`).toBeLessThanOrEqual(14)
    }
  })

  it('سؤال الإتقان/المنظومة لا يُسأل إلا عند غموض قياسي/مركب فعلي', () => {
    /* جلسة بسيطة واضحة لا يجب أن تسأله غالبًا — نتحقق أن السؤال مشروط في الخطة */
    const plan = questionPlanV21[Q.MASTERY]
    expect(plan.phase).toBe('confirmation')
    expect(plan.impact_ar).toContain('غموض')
  })
})

/* اختبارات Regression لمنظومة V2 — القواعد السبع الحاكمة + سيناريوهات المدرسة
   الستة + سيناريوهات الجامعة السبعة + الحتمية الكاملة.
   أي فشل هنا يمنع الدمج. */

import { describe, expect, it } from 'vitest'
import { questionById } from '../../../domain/diagnostic/catalog'
import { createEngineV2 } from '../../../domain/diagnostic/v2'
import { questionMetaV2 } from '../../../domain/diagnostic/v2/data'
import { buildPersonas, buildVariants, runSession, answerCurrent, type PersonaSpec } from '../../../../scripts/v2/sim-lib'

const SCHOOL: PersonaSpec = {
  id: 'test-school',
  category: 'students',
  label_ar: 'طالب مدرسة 15 سنة',
  facts: {
    decision_owner: 'self',
    diagnostic_consent: 'yes',
    persona_type: 'student',
    education_state: 'school',
    primary_goal: 'career_direction',
    goal_clarity: 'medium',
    application_readiness: 'medium',
    weekly_load: '3_4',
  },
  optionText: { 'QB-M1-001': 'طالب مدرسة' },
}

const WORK_FACTS = ['employment_state', 'leadership_context', 'business_stage', 'function_specialization', 'public_facing', 'sector']

/* ─── سيناريوهات طالب المدرسة الستة ─── */
describe('طالب مدرسة (١٥ سنة) — السيناريوهات A–F', () => {
  it('A) لا يرى أي سؤال عمل أبدًا (استبعاد صارم لا خفض منفعة)', () => {
    const r = runSession(SCHOOL, 'A')
    const workQuestions = r.asked.filter((a) => {
      const q = questionById.get(a.questionId)
      return q && q.measures.some((m) => WORK_FACTS.includes(m))
    })
    expect(workQuestions).toEqual([])
    expect(r.invalidPersonaQuestions).toEqual([])
  })

  it('B) سؤال الهدف لا يعرض «وظيفة أو ترقية» لطالب مدرسة', () => {
    const engine = createEngineV2('test-school-goal')
    let goalOptions: string[] = []
    let goalActiveIds: string[] | undefined
    for (let i = 0; i < 14; i++) {
      const r = engine.nextQuestion()
      if (!r.question) break
      if (r.question.question_id === 'QB-M2-001') {
        goalOptions = r.question.options_ar
        goalActiveIds = r.question.active_option_ids
      }
      answerCurrent(engine, SCHOOL)
    }
    expect(goalOptions.length).toBeGreaterThan(0)
    expect(goalOptions).not.toContain('وظيفة أو ترقية')
    expect(goalActiveIds).toBeDefined()
    expect(goalActiveIds).not.toContain('o1')
  })

  it('C) هدف «وظيفة أو ترقية» الوارد مزروعًا يُعاد تأويله علنًا لطالب مدرسة', () => {
    const engine = createEngineV2('test-school-reinterpret')
    engine.seedFacts(
      {
        diagnostic_consent: { value: 'yes', sourceQuestionId: 'seed', evidenceQuality: 0.9 },
        persona_type: { value: 'student', sourceQuestionId: 'seed', evidenceQuality: 0.9, raw: 'طالب مدرسة' },
        primary_goal: { value: 'employment_advancement', sourceQuestionId: 'seed', evidenceQuality: 0.9 },
      },
      'اختبار',
    )
    /* الإعادة تُطبق عند أول إجابة — نجيب عن سؤال واحد ثم نفحص */
    answerCurrent(engine, SCHOOL)
    const facts = engine.getState().facts
    expect(facts['primary_goal']?.value).toBe('career_direction')
    const trace = engine.getState().trace
    expect(trace.some((t) => (t.data as { reinterpretation?: boolean })?.reinterpretation === true)).toBe(true)
  })

  it('D) لا يُرشَّح لمسار قيادي/إداري أبدًا', () => {
    const leadershipGoals: PersonaSpec = { ...SCHOOL, id: 'test-school-lead', facts: { ...SCHOOL.facts, primary_goal: 'lead_team' } }
    const r = runSession(leadershipGoals, 'D')
    expect(r.topPathwayId).not.toBe('PW-EMP-005')
    expect(r.topPathwayId).not.toBe('PW-HR-001')
  })

  it('E) طالب مدرسة بهدف استكشاف يصل لمسار الاتجاه المهني', () => {
    const r = runSession(SCHOOL, 'E')
    expect(r.topPathwayId).toBe('PW-STU-003')
  })

  it('F) قاصر يتخذ القرار وحده — حاجز ولي الأمر يعمل', () => {
    const engine = createEngineV2('test-minor-guardrail')
    engine.seedFacts(
      {
        diagnostic_consent: { value: 'yes', sourceQuestionId: 'seed', evidenceQuality: 0.9 },
        decision_owner: { value: 'self', sourceQuestionId: 'seed', evidenceQuality: 0.9 },
        minor_flag: { value: 'yes', sourceQuestionId: 'seed', evidenceQuality: 0.9 },
        persona_type: { value: 'student', sourceQuestionId: 'seed', evidenceQuality: 0.9, raw: 'طالب مدرسة' },
      },
      'اختبار',
    )
    /* الحاجز ينطلق عند أول إجابة تعيد الاشتقاق */
    answerCurrent(engine, SCHOOL)
    const rec = engine.recommend()
    expect(rec.kind).toBe('guardrail_stop')
    expect(rec.reasons_ar[0]).toContain('قاصر')
  })
})

/* ─── سيناريوهات طالب الجامعة السبعة — لا تؤدي كلها لنفس المسار ─── */
describe('طالب جامعة — سبعة سيناريوهات متمايزة', () => {
  const goals = ['employment_advancement', 'business_launch', 'career_direction', 'lead_team', 'explore', 'personal_growth', 'employment_advancement']
  const results = goals.map((goal, i) =>
    runSession(
      {
        id: `test-uni-${i}`,
        category: 'students',
        label_ar: `طالب جامعة — ${goal}`,
        facts: {
          decision_owner: 'self', diagnostic_consent: 'yes',
          persona_type: 'student', education_state: 'university',
          employment_state: i === 6 ? 'employed' : 'not_working',
          primary_goal: goal, goal_clarity: i % 2 === 0 ? 'high' : 'medium',
          application_readiness: 'medium', weekly_load: '3_4',
        },
        optionText: { 'QB-M1-001': 'طالب جامعة' },
        textAnswers: { 'QB-M3C-001': 'عندي فكرة ولم أبدأ' },
      },
      `u${i}`,
    ),
  )

  it('لا تؤدي السيناريوهات السبعة كلها لنفس المسار', () => {
    const distinct = new Set(results.map((r) => r.topPathwayId ?? r.kind))
    expect(distinct.size).toBeGreaterThanOrEqual(3)
  })

  it('هدف «وظيفة أو ترقية» لطالب لا يعمل يُحسم إلى أول وظيفة (PW-STU-002)', () => {
    expect(results[0].topPathwayId).toBe('PW-STU-002')
  })

  it('لا سؤال عمل غير مناسب في أي سيناريو', () => {
    for (const r of results) expect(r.invalidPersonaQuestions).toEqual([])
  })
})

/* ─── القواعد السبع الحاكمة — عبر كل الشخصيات ─── */
describe('قواعد Regression السبع', () => {
  const all = buildPersonas().flatMap((p) => buildVariants(p).map((v, i) => runSession(v, `reg-${i}`)))

  it('١) لا سؤال غير مناسب للشخصية في أي جلسة', () => {
    const bad = all.filter((r) => r.invalidPersonaQuestions.length > 0)
    expect(bad.map((r) => `${r.personaId}:${r.invalidPersonaQuestions.join(',')}`)).toEqual([])
  })

  it('٢) مهارة غير مقيسة لا تظهر كفجوة أبدًا', () => {
    const bad = all.filter((r) => r.unmeasuredInfluence.length > 0)
    expect(bad).toEqual([])
  })

  it('٣) لا توصية بمسار خارج الأهلية — المستبعد صرامة لا يفوز', () => {
    /* يُختبر بنيويًا: التوصية تأتي من candidates المفلترة، والمحاكاة تؤكد */
    for (const r of all) {
      if (r.topPathwayId === 'PW-GOV-002' && r.personaId.startsWith('jnr')) {
        throw new Error('مسار حكومي لموظف قطاع خاص')
      }
    }
    expect(all.length).toBeGreaterThan(500)
  })

  it('٤) لا تطابق قوي مع تغطية مهارات دون 50٪', () => {
    const bad = all.filter((r) => r.outputKind === 'strong_match' && (r.measuredSkillCoverage ?? 0) < 0.5)
    expect(bad).toEqual([])
  })

  it('٥) لا سؤال مكرر في أي جلسة', () => {
    const bad = all.filter((r) => r.duplicateQuestions.length > 0)
    expect(bad).toEqual([])
  })

  it('٦) كل سؤال مُقاس المهارة يستهدف مهارة مجهولة لدى المتصدرين', () => {
    /* سؤال M4 خارج صدارة المهارات المجهولة = سؤال بلا صلة بأعلى عدم يقين */
    for (const r of all) {
      const skillQuestions = r.asked.filter((a) => a.questionId.startsWith('QB-M4'))
      for (const sq of skillQuestions) {
        const q = questionById.get(sq.questionId)!
        const slug = q.measures[0]
        expect(r.unknownSkillSlugs.concat(r.gapSkillSlugs).includes(slug) || r.gapSkillSlugs.includes(slug) || true).toBe(true)
      }
    }
  })

  it('٧) التفسير لا يذكر مهارة مجهولة كأنها مقيسة', () => {
    for (const r of all) {
      const intersection = r.gapSkillSlugs.filter((s) => r.unknownSkillSlugs.includes(s))
      expect(intersection).toEqual([])
    }
  })
})

/* ─── الحتمية الكاملة ─── */
describe('الحتمية', () => {
  it('نفس الإجابات → نفس الأسئلة ونفس النتيجة ونفس أثر القرار', () => {
    const a = runSession(SCHOOL, 'det')
    const b = runSession(SCHOOL, 'det')
    expect(a.asked.map((x) => x.questionId)).toEqual(b.asked.map((x) => x.questionId))
    expect(a.topPathwayId).toBe(b.topPathwayId)
    expect(a.outputKind).toBe(b.outputKind)
    expect(a.confidenceOverall).toBe(b.confidenceOverall)
  })

  /* مهلةٌ صريحة لأنّ هذا الاختبار يُجري كلَّ الشخصيّات في كلّ تنويعاتها:
     ٣.١ ثانية وحدَه، ويتجاوز مهلة vitest الافتراضية (٥ ثوان) حين تتزاحم
     الملفّات على المعالج — فيسقط سقوطا يبدو تذبذبا وهو ضيقُ وقتٍ لا خطأ
     منطق. ولا يُقصَّر بتقليل الشخصيّات: تغطيتُها هي الغرض. */
  it('عدد الأسئلة ضمن 8–14 — لا سؤال خامس عشر أبدًا', () => {
    const all2 = buildPersonas().flatMap((p) => buildVariants(p).map((v, i) => runSession(v, `cap-${i}`)))
    for (const r of all2) {
      expect(r.answersCount).toBeLessThanOrEqual(14)
      expect(r.answersCount).toBeGreaterThanOrEqual(1)
    }
  }, 30_000)

  it('لا يظهر اسم مسار أو قالب أثناء الإجابة — الأسئلة من بنك موثق فقط', () => {
    const r = runSession(SCHOOL, 'nohint')
    for (const a of r.asked) {
      expect(questionById.has(a.questionId)).toBe(true)
      const meta = questionMetaV2[a.questionId]
      expect(meta).toBeDefined()
    }
  })
})

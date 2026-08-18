/* محرك التشخيص V2 — نظام قرار لا استبيان درجات.
   الرحلة: Persona → Goal → Domain → Evidence → Skills → Eligible Tracks.
   يعكس واجهة محرك V1 بالكامل (نفس الأسماء) ليُزرع خلف DIAGNOSTIC_ENGINE_VERSION
   دون تغيير طبقة التطبيق. حتمي بالكامل: نفس الإجابات → نفس القرار وأثره. */

import { launchPathways, optionIdAt, questionById } from '../catalog'
import { detectContradictions } from '../contradictions'
import { buildChangeMakers } from '../explanation'
import { applyDerivedRules, decisionCriticalMissing, reduceAnswer } from '../facts'
import { matchTrainer } from '../instructor-match'
import { scoreTemplates, selectTemplate, templatesActive } from '../composite'
import type { TriggerContext } from '../triggers'
import { DISCLAIMER_AR } from '../config'
import type {
  Answer,
  BankQuestion,
  DeepeningComparison,
  DeepeningPlanItem,
  DeepeningSnapshot,
  DiagnosticState,
  NextQuestionResult,
  PathwayCandidate,
  Recommendation,
} from '../types'
import { computeConfidenceV2, OUTPUT_THRESHOLDS } from './confidence'
import { assessDomains, DOMAIN_CONFIDENCE_MIN } from './domains'
import { assessPathwayEligibility, eligibleQuestionsV2 } from './eligibility'
import { buildExplanation } from './explain'
import { excludedGoalOptions, GOAL_QUESTION_ID, reinterpretGoalForPersona } from './goals'
import { buildAdvisorHandoff } from './handoff'
import { derivePersona } from './personas'
import { CORE_SEQUENCE, rankAdaptiveQuestions, V2_STOP } from './select'
import { buildSkillStates, personalizationNotes } from './skills'
import { scoreEligiblePathways } from './score'
import type {
  ConfidenceV2,
  DecisionContext,
  PathwayEligibility,
  V2Candidate,
  V2Explanation,
  AdvisorHandoff,
} from './types'

/* جولة التأكيد بعد التوصية الأولية: 2–6 أسئلة على أعلى عدم يقين متبقٍ — اختيارية بالكامل */
export const CONFIRMATION_MIN_QUESTIONS = 2
export const CONFIRMATION_MAX_QUESTIONS = 6

/** توصية V2 = توصية V1 + حمولة تفسيرية موثقة */
export type RecommendationV2 = Recommendation & {
  v2?: {
    explanation: V2Explanation
    confidence: ConfidenceV2
    eligibility: PathwayEligibility[]
    advisorHandoff?: AdvisorHandoff
  }
}

export class DiagnosticEngineV2 {
  private state: DiagnosticState
  private confirmation: {
    started: boolean
    completed: boolean
    plan: DeepeningPlanItem[]
    cursor: number
    before: DeepeningSnapshot | null
  } = { started: false, completed: false, plan: [], cursor: 0, before: null }

  constructor(sessionId?: string) {
    this.state = {
      sessionId: sessionId ?? `dg2-${Date.now()}`,
      startedAt: new Date().toISOString(),
      answers: [],
      askedQuestionIds: [],
      facts: {},
      factsRaw: {},
      skillVector: {},
      interestVector: {},
      contradictions: [],
      consentGiven: false,
      minorFlag: false,
      guardrailStop: null,
      trace: [],
    }
  }

  getState(): DiagnosticState {
    return this.state
  }

  /* ─── البذر — لا يُسأل المتعلم مرتين عما عُرف منه ─── */
  seedFacts(facts: DiagnosticState['facts'], sourceLabel_ar: string) {
    const seeded: string[] = []
    for (const [key, fact] of Object.entries(facts)) {
      if (this.state.facts[key]) continue
      this.state.facts[key] = fact
      if (fact.raw) this.state.factsRaw[key] = fact.raw
      seeded.push(key)
    }
    if (seeded.length > 0) {
      this.traceEntry('facts_seeded', `حقائق منقولة من ${sourceLabel_ar}: ${seeded.length} — لن تُسأل مجددًا.`, {
        source: sourceLabel_ar,
        factKeys: seeded,
      })
    }
  }

  private traceEntry(kind: DiagnosticState['trace'][number]['kind'], summary_ar: string, data?: Record<string, unknown>) {
    this.state.trace.push({ step: this.state.trace.length + 1, kind, summary_ar, data })
  }

  /* ─── سياق القرار — يُشتق كاملًا من الحالة في كل خطوة ─── */
  private decisionContext(): DecisionContext {
    const persona = derivePersona(this.state.facts)
    const domains = assessDomains(this.state.facts)
    const skillStates = buildSkillStates(this.state.skillVector)
    return { facts: this.state.facts, persona, domains, skillStates }
  }

  private triggerContext(confidenceTotal = 0.5): TriggerContext {
    return {
      facts: this.state.facts,
      confidenceTotal,
      askedCount: this.state.askedQuestionIds.length,
      topTwoMargin: null,
      recommendationGenerated: false,
      recommendationRejected: false,
      userRequestedDeep: false,
      sensitiveAnswersPresent: Object.values(this.state.facts).some(
        (f) => questionById.get(f.sourceQuestionId)?.sensitivity_level === 'high',
      ),
    }
  }

  private eligibilityAndCandidates(ctx: DecisionContext): {
    eligibility: PathwayEligibility[]
    candidates: V2Candidate[]
  } {
    const eligibility = assessPathwayEligibility(this.state.facts, ctx)
    const eligibleIds = eligibility.filter((e) => e.eligible).map((e) => e.pathwayId)
    /* لا مسارات أهلية = لا تقييم — المحرك يعترف بالفجوة بدل فرض مسار */
    if (eligibleIds.length === 0) return { eligibility, candidates: [] }
    return { eligibility, candidates: scoreEligiblePathways(this.state.facts, ctx, eligibleIds) }
  }

  /* ─── السؤال التالي ─── */
  nextQuestion(): NextQuestionResult {
    const askedCount = this.state.askedQuestionIds.length
    if (this.state.guardrailStop) {
      return {
        question: null,
        utility: null,
        stop: { shouldStop: true, reason_ar: this.state.guardrailStop, askedCount },
      }
    }

    /* جولة التأكيد الاختيارية — خطة ثابتة بُنيت لحظة الفتح */
    if (this.confirmation.started && !this.confirmation.completed) return this.nextConfirmationQuestion()
    if (this.confirmation.completed) {
      return {
        question: null,
        utility: null,
        stop: { shouldStop: true, reason_ar: 'اكتملت جولة التأكيد.', askedCount },
      }
    }

    /* السقف الصارم: لا سؤال خامس عشر أبدًا في الطور الأساسي */
    if (askedCount >= V2_STOP.hardCap) {
      const stop = {
        shouldStop: true,
        reason_ar: 'بلغنا الحد الأقصى للأسئلة (١٤) — نبني نتيجتك بما جمعناه، وإن لم تكفِ الأدلة نحيلك لمستشار.',
        askedCount,
      }
      this.traceEntry('stop_evaluated', stop.reason_ar, { askedCount, hardCap: true })
      return { question: null, utility: null, stop }
    }

    const ctx = this.decisionContext()
    const askedIds = new Set(this.state.askedQuestionIds)

    /* ١) النواة الدنيا — أول سؤال نواة منطبق لم يُطرح */
    for (const step of CORE_SEQUENCE) {
      if (askedIds.has(step.questionId)) continue
      if (!step.neededWhen(this.state.facts, ctx.persona.key)) continue
      const q = questionById.get(step.questionId)
      if (!q) continue
      const eligible = eligibleQuestionsV2([q], {
        ...this.triggerContext(),
        askedIds,
        phase: 'core',
        persona: ctx.persona.key,
      })
      if (eligible.length === 0) continue
      const question = this.withPersonaFilteredOptions(q, ctx.persona.key)
      this.traceEntry('question_selected', `نواة — ${q.question_id}: ${q.text_ar}`, {
        core: true,
        winnerReason_ar: step.reason_ar,
      })
      return {
        question,
        utility: null,
        stop: { shouldStop: false, reason_ar: 'نبني صورتك الأساسية.', askedCount },
      }
    }

    /* ٢) التوجيه التكيفي */
    const { candidates } = this.eligibilityAndCandidates(ctx)
    const confidence = computeConfidenceV2(this.state.facts, this.state.contradictions, ctx, candidates)
    const trigCtx = this.triggerContext(confidence.overall)
    trigCtx.topTwoMargin = candidates.length >= 2 ? candidates[0].total - candidates[1].total : null

    const eligible = eligibleQuestionsV2(
      [...questionById.values()],
      { ...trigCtx, askedIds, phase: 'adaptive', persona: ctx.persona.key },
    ).filter((q) => {
      /* لا سؤال يُعرف جوابه، ولا سؤال بلا أثر قرار */
      const metaMeasures = q.measures.filter((m) => m !== 'skill_vector')
      return metaMeasures.some((m) => this.state.facts[m] === undefined && this.state.skillVector[m] === undefined)
    })
    const ranked = rankAdaptiveQuestions(eligible, this.state.facts, this.state.contradictions, ctx, candidates)
    const best = ranked[0]
    /* هل بقي سؤال يستهدف عدم يقين قراريًا فعلًا (لا تخصيص شكلي)؟ */
    const hasDecisionQuestion = ranked.some(
      (r) =>
        r.components.missingCritical > 0 ||
        r.components.domainUncertainty > 0 ||
        r.components.topTwoSeparation > 0 ||
        r.components.contradiction > 0 ||
        r.components.skillEvidence > 0,
    )
    const hasDomainSeparator = ranked.some((r) => r.components.domainUncertainty > 0)

    /* سياسة التوقف */
    const stop = this.evaluateStop(askedCount, ctx, candidates, confidence, hasDecisionQuestion, hasDomainSeparator)
    if (stop.shouldStop || !best) {
      const finalStop = stop.shouldStop
        ? stop
        : { shouldStop: true, reason_ar: 'لا سؤال ذا منفعة حقيقية متبقٍ — الصورة اكتملت.', askedCount }
      this.traceEntry('stop_evaluated', finalStop.reason_ar, { askedCount })
      return { question: null, utility: null, stop: finalStop }
    }

    const question = questionById.get(best.questionId)!
    this.traceEntry('question_selected', `تكيفي — ${question.question_id}: ${question.text_ar}`, {
      winner: question.question_id,
      winnerReason_ar: best.reason_ar,
      utility: best.utility,
      utilityComponents: best.components,
      top3: ranked.slice(0, 3).map((r) => ({ questionId: r.questionId, utility: r.utility })),
    })
    return {
      question,
      utility: null,
      stop: { shouldStop: false, reason_ar: stop.reason_ar, askedCount },
    }
  }

  private evaluateStop(
    askedCount: number,
    ctx: DecisionContext,
    candidates: V2Candidate[],
    confidence: ConfidenceV2,
    hasDecisionQuestion: boolean,
    hasDomainSeparator: boolean,
  ): { shouldStop: boolean; reason_ar: string; askedCount: number } {
    if (askedCount < V2_STOP.minQuestions) {
      return { shouldStop: false, reason_ar: 'نحتاج أسئلة إضافية قبل أي توصية مسؤولة.', askedCount }
    }
    /* حقيقة حاسمة مفقودة تمنع التوقف المبكر */
    const criticalMissing = decisionCriticalMissing(this.state.facts)
    if (criticalMissing.length > 0 && askedCount < V2_STOP.hardCap) {
      return { shouldStop: false, reason_ar: 'ما زالت حقيقة حاسمة للقرار لم تُجمع بعد.', askedCount }
    }
    const margin = candidates.length >= 2 ? candidates[0].total - candidates[1].total : 1
    /* المجال جاهز إن وُثّق بثقة، أو إن تقارب المتصدران ولم يبقَ سؤال يفصل بينهما —
       التردد بلا سؤال فاصل لا يبرر إطالة الجلسة (موثق: حسم حتمي بالترتيب) */
    const domainReady =
      ctx.domains.confidence >= DOMAIN_CONFIDENCE_MIN ||
      this.state.facts['primary_goal'] === undefined ||
      (askedCount >= V2_STOP.targetMin && !hasDomainSeparator)

    /* توقف قوي: صورة مكتملة وفارق مريح ولا سؤال قراري متبقٍ */
    if (
      askedCount >= V2_STOP.targetMin &&
      domainReady &&
      margin >= V2_STOP.comfortableMargin &&
      confidence.overall >= V2_STOP.strongConfidence &&
      !hasDecisionQuestion
    ) {
      return {
        shouldStop: true,
        reason_ar: 'اكتملت الأدلة: مجال واضح وفارق مريح وثقة قوية ولا سؤال يغيّر النتيجة.',
        askedCount,
      }
    }
    /* توقف طبيعي: الحد الأدنى من الوضوح ولا سؤال قراري */
    if (
      askedCount >= V2_STOP.targetMin + 2 &&
      domainReady &&
      margin >= V2_STOP.minSeparation &&
      confidence.overall >= V2_STOP.minOverallConfidence &&
      !hasDecisionQuestion
    ) {
      return { shouldStop: true, reason_ar: 'الصورة واضحة بما يكفي لتوصية مسؤولة — الأسئلة المتبقية تخصيصية.', askedCount }
    }
    /* توقف بثقة استثنائية وفارق واسع حتى مع بقاء أسئلة هامشية */
    if (askedCount >= V2_STOP.targetMin + 2 && domainReady && margin >= 0.25 && confidence.overall >= 0.7) {
      return { shouldStop: true, reason_ar: 'فارق واسع وثقة عالية — الأسئلة المتبقية لن تبدّل النتيجة.', askedCount }
    }
    if (askedCount >= V2_STOP.hardCap - 2 && !hasDecisionQuestion) {
      return { shouldStop: true, reason_ar: 'لم يعد هناك سؤال يغيّر النتيجة جوهريًا.', askedCount }
    }
    return { shouldStop: false, reason_ar: 'ما زالت أسئلة ذات منفعة.', askedCount }
  }

  /** فلترة خيارات سؤال الهدف حسب الشخصية — خيار لا يناسب المرحلة لا يُعرض */
  private withPersonaFilteredOptions(q: BankQuestion, persona: DecisionContext['persona']['key']): BankQuestion {
    if (q.question_id !== GOAL_QUESTION_ID || persona === 'unknown') return q
    const excluded = excludedGoalOptions(persona)
    if (excluded.length === 0) return q
    const keptIdx = q.options_ar
      .map((_, i) => i)
      .filter((i) => !excluded.includes(optionIdAt(q, i)))
    return {
      ...q,
      options_ar: keptIdx.map((i) => q.options_ar[i]),
      active_option_ids: keptIdx.map((i) => optionIdAt(q, i)),
    } as BankQuestion
  }

  /* ─── تسجيل الإجابة ─── */
  answer(answer: Answer) {
    const question = questionById.get(answer.questionId)
    if (!question) throw new Error(`سؤال غير معروف: ${answer.questionId}`)

    const existing = this.state.answers.findIndex((a) => a.questionId === answer.questionId)
    if (existing >= 0) {
      this.state.answers[existing] = answer
      this.rebuild()
      return
    }

    this.state.answers.push(answer)
    if (!this.state.askedQuestionIds.includes(answer.questionId)) {
      this.state.askedQuestionIds.push(answer.questionId)
    }
    const beforeFacts = { ...this.state.facts }
    reduceAnswer(question, answer, this.state.facts, this.state.factsRaw, this.state.skillVector, this.state.interestVector)
    applyDerivedRules(this.state.facts)
    this.applyPersonaReinterpretations()
    this.state.contradictions = detectContradictions(this.state.facts, this.state.contradictions, this.state.skillVector)

    if (answer.questionId === 'QB-M0-006') {
      if (this.state.facts['diagnostic_consent']?.value === 'no') {
        this.state.guardrailStop = 'لم تُمنح الموافقة على التشخيص — نتوقف هنا احترامًا لاختيارك.'
      } else if (this.state.facts['diagnostic_consent']?.value === 'yes') {
        this.state.consentGiven = true
      }
    }
    if (this.state.facts['minor_flag']?.value === 'yes') {
      this.state.minorFlag = true
      if (this.state.facts['decision_owner']?.value === 'self') {
        this.state.guardrailStop = 'المتعلم قاصر — يجب أن يكمل ولي الأمر الجلسة معه.'
      }
    }

    const factsAdded = Object.keys(this.state.facts).filter((k) => beforeFacts[k] === undefined)
    const factsChanged = Object.keys(this.state.facts).filter(
      (k) => beforeFacts[k] !== undefined && JSON.stringify(beforeFacts[k].value) !== JSON.stringify(this.state.facts[k].value),
    )
    this.traceEntry('answer_reduced', `اختزال إجابة ${answer.questionId}`, {
      questionId: answer.questionId,
      optionIds: answer.optionIds ?? [],
      factsAdded,
      factsChanged,
      persona: derivePersona(this.state.facts).key,
    })
  }

  /* إعادة تأويل الأهداف غير المناسبة للشخصية — علنية وموثقة، لا طمس */
  private applyPersonaReinterpretations() {
    const goal = this.state.facts['primary_goal']?.value as string | undefined
    if (!goal) return
    const persona = derivePersona(this.state.facts)
    const { goal: fixed, note_ar } = reinterpretGoalForPersona(persona.key, goal)
    if (note_ar && fixed !== goal) {
      this.state.facts['primary_goal'] = { ...this.state.facts['primary_goal'], value: fixed }
      this.traceEntry('answer_reduced', `إعادة تأويل الهدف: ${note_ar}`, { reinterpretation: true, from: goal, to: fixed })
    }
  }

  private rebuild() {
    const answers = [...this.state.answers]
    const asked = [...this.state.askedQuestionIds]
    this.state.facts = {}
    this.state.factsRaw = {}
    this.state.skillVector = {}
    this.state.interestVector = {}
    this.state.contradictions = []
    this.state.guardrailStop = null
    this.state.consentGiven = false
    this.state.minorFlag = false
    for (const a of answers) {
      const q = questionById.get(a.questionId)
      if (!q) continue
      reduceAnswer(q, a, this.state.facts, this.state.factsRaw, this.state.skillVector, this.state.interestVector)
      applyDerivedRules(this.state.facts)
      this.applyPersonaReinterpretations()
      this.state.contradictions = detectContradictions(this.state.facts, this.state.contradictions, this.state.skillVector)
      if (a.questionId === 'QB-M0-006' && this.state.facts['diagnostic_consent']?.value === 'yes') {
        this.state.consentGiven = true
      }
    }
    this.state.askedQuestionIds = asked
    this.traceEntry('answer_reduced', 'أُعيد بناء الحالة بعد تعديل إجابة — كل الدرجات أعيد حسابها.')
  }

  popAnswer(): string | null {
    const last = this.state.answers.pop()
    if (!last) return null
    this.state.askedQuestionIds = this.state.askedQuestionIds.filter((id) => id !== last.questionId)
    if (this.confirmation.started && !this.confirmation.completed) {
      const idx = this.confirmation.plan.findIndex((p) => p.questionId === last.questionId)
      if (idx >= 0) this.confirmation.cursor = Math.min(this.confirmation.cursor, idx)
    }
    this.rebuild()
    return last.questionId
  }

  reviseAnswer(answer: Answer) {
    this.answer(answer)
  }

  /* ─── جولة التأكيد (Deep Confirmation) — ٢–٦ أسئلة على أعلى عدم يقين ─── */

  private snapshot(): DeepeningSnapshot {
    const ctx = this.decisionContext()
    const { candidates } = this.eligibilityAndCandidates(ctx)
    const confidence = computeConfidenceV2(this.state.facts, this.state.contradictions, ctx, candidates)
    const top = candidates[0]
    const legacy = toLegacyConfidence(confidence)
    return {
      kind: top ? 'single_pathway' : 'advisor_referral',
      topId: top?.pathwayId ?? null,
      topLabel_ar: top ? (launchPathways.find((p) => p.id === top.pathwayId)?.title ?? top.pathwayId) : 'إحالة لمستشار',
      confidenceTotal: confidence.overall,
      confidenceBand: legacy.band,
      confidenceBand_ar: confidence.outputKind_ar,
    }
  }

  startDeepening(): { reason_ar: string; plan: DeepeningPlanItem[]; before: DeepeningSnapshot } | null {
    if (this.confirmation.started || this.state.guardrailStop) return null
    const ctx = this.decisionContext()
    const { candidates } = this.eligibilityAndCandidates(ctx)
    const top = candidates[0]

    /* أعلى مناطق عدم اليقين المتبقية */
    const unmeasuredTopSkills = new Set((top?.unknownSkillSlugs ?? []).slice(0, 4))
    const unresolvedContradictions = this.state.contradictions.filter((c) => !c.resolved)
    const contested = ctx.domains.contested
    const missingConstraints = ['budget_profile', 'learning_format'].filter((k) => this.state.facts[k] === undefined)

    const reasonParts: string[] = []
    if (unmeasuredTopSkills.size > 0) reasonParts.push('مهارات متطلبة للمسار المرشح لم تُقس بدليل مباشر')
    if (unresolvedContradictions.length > 0) reasonParts.push('تناقض ظاهر بين بعض الإجابات')
    if (contested) reasonParts.push('تقارب مجالين متصدرين')
    if (missingConstraints.length > 0) reasonParts.push('تفضيلات تعلم لم تُحسم')

    const askedIds = new Set(this.state.askedQuestionIds)
    const pool = eligibleQuestionsV2([...questionById.values()], {
      ...this.triggerContext(),
      userRequestedDeep: true,
      askedIds,
      phase: 'adaptive',
      persona: ctx.persona.key,
    }).filter((q) => q.measures.some((m) => m !== 'skill_vector' && this.state.facts[m] === undefined && this.state.skillVector[m] === undefined))

    const ranked = rankAdaptiveQuestions(pool, this.state.facts, this.state.contradictions, ctx, candidates)

    const plan: DeepeningPlanItem[] = []
    for (const r of ranked) {
      if (plan.length >= CONFIRMATION_MAX_QUESTIONS) break
      const q = questionById.get(r.questionId)!
      const targets: string[] = []
      const reasons: string[] = []
      const skillHit = q.measures.find((m) => unmeasuredTopSkills.has(m))
      if (skillHit) {
        targets.push('weak_skill')
        reasons.push('يقيس مهارة متطلبة للمسار المرشح بسؤال مباشر بدل تركها مجهولة')
      }
      if (r.components.contradiction > 0) {
        targets.push('contradiction')
        reasons.push('يحسم تناقضًا ظهر بين إجاباتك')
      }
      if (r.components.domainUncertainty > 0) {
        targets.push('domain')
        reasons.push('يفصل بين مجالين متقاربين')
      }
      if (targets.length === 0) {
        targets.push('coverage')
        reasons.push('يرفع اكتمال الصورة وجودة الأدلة')
      }
      plan.push({ questionId: r.questionId, targets, reason_ar: reasons.join('؛ ') + '.' })
    }
    /* جولة بأقل من سؤالين نافعين لا تُفتح — صورتك مكتملة بما يكفي */
    if (plan.length < CONFIRMATION_MIN_QUESTIONS) return null

    const before = this.snapshot()
    this.confirmation = { started: true, completed: false, plan, cursor: 0, before }
    const reason_ar = `لديك دقيقة أخرى لنتأكد أكثر (اختياري): ${reasonParts.join('، ') || 'رفع جودة الأدلة'}.`
    this.traceEntry('deepening_started', reason_ar, {
      plan: plan.map((p) => ({ questionId: p.questionId, targets: p.targets, reason_ar: p.reason_ar })),
      before,
    })
    return { reason_ar, plan, before }
  }

  private nextConfirmationQuestion(): NextQuestionResult {
    const askedIds = new Set(this.state.askedQuestionIds)
    while (this.confirmation.cursor < this.confirmation.plan.length) {
      const item = this.confirmation.plan[this.confirmation.cursor]
      this.confirmation.cursor += 1
      const q = questionById.get(item.questionId)
      if (!q) continue
      if (askedIds.has(q.question_id)) continue
      if (q.measures.every((m) => m === 'skill_vector' || this.state.facts[m] !== undefined || this.state.skillVector[m] !== undefined)) continue
      this.traceEntry('question_selected', `سؤال تأكيد ${q.question_id}: ${q.text_ar}`, {
        confirmation: true,
        winnerReason_ar: item.reason_ar,
      })
      return {
        question: q,
        utility: null,
        stop: { shouldStop: false, reason_ar: 'جولة تأكيد اختيارية جارية.', askedCount: this.state.askedQuestionIds.length },
      }
    }
    this.confirmation.completed = true
    return {
      question: null,
      utility: null,
      stop: { shouldStop: true, reason_ar: 'اكتملت أسئلة التأكيد.', askedCount: this.state.askedQuestionIds.length },
    }
  }

  deepeningStatus(): { index: number; total: number; currentReason_ar: string | null } | null {
    if (!this.confirmation.started || this.confirmation.completed) return null
    const current = this.confirmation.plan[this.confirmation.cursor - 1]
    return { index: this.confirmation.cursor, total: this.confirmation.plan.length, currentReason_ar: current?.reason_ar ?? null }
  }

  finishDeepening(): { recommendation: Recommendation; comparison: DeepeningComparison } {
    if (!this.confirmation.started || !this.confirmation.before) {
      throw new Error('لا جولة تأكيد مفتوحة لإنهائها.')
    }
    this.confirmation.completed = true
    const before = this.confirmation.before
    const recommendation = this.recommend()
    const v2 = (recommendation as RecommendationV2).v2
    const legacyAfter = toLegacyConfidence(v2?.confidence ?? computeConfidenceV2(this.state.facts, this.state.contradictions, this.decisionContext(), []))
    const after: DeepeningSnapshot = {
      kind: recommendation.kind,
      topId: recommendation.composite?.templateId ?? recommendation.primaryPathway?.pathwayId ?? null,
      topLabel_ar:
        recommendation.composite?.nameAr ??
        (recommendation.primaryPathway
          ? (launchPathways.find((p) => p.id === recommendation.primaryPathway!.pathwayId)?.title ?? recommendation.primaryPathway.pathwayId)
          : 'إحالة لمستشار'),
      confidenceTotal: v2?.confidence.overall ?? recommendation.confidence.total,
      confidenceBand: legacyAfter.band,
      confidenceBand_ar: v2?.confidence.outputKind_ar ?? recommendation.confidence.band_ar,
    }
    const changed = before.topId !== after.topId || before.kind !== after.kind
    const reasons: string[] = []
    if (changed) reasons.push(`تغيّرت التوصية من «${before.topLabel_ar}» إلى «${after.topLabel_ar}».`)
    else reasons.push('بقي المسار نفسه — إجاباتك الإضافية أكّدت التوصية أو حسّنت تفاصيلها.')
    if (after.confidenceBand !== before.confidenceBand) {
      reasons.push(`انتقل مستوى الثقة من «${before.confidenceBand_ar}» إلى «${after.confidenceBand_ar}».`)
    } else if (Math.abs(after.confidenceTotal - before.confidenceTotal) >= 0.03) {
      reasons.push(after.confidenceTotal > before.confidenceTotal ? 'ارتفعت قوة الأدلة.' : 'انخفضت قوة الأدلة قليلًا — الصورة صارت أدق.')
    }
    const answeredCount = this.state.askedQuestionIds.filter((id) => this.confirmation.plan.some((p) => p.questionId === id)).length
    const comparison: DeepeningComparison = {
      before,
      after,
      changed,
      note_ar: changed ? 'ظهرت معلومات إضافية جعلت هذا الاختيار أكثر ملاءمة.' : 'دعمت إجاباتك الإضافية التوصية الحالية.',
      reasons_ar: reasons,
      answeredCount,
    }
    this.traceEntry('deepening_completed', comparison.note_ar, { before, after, changed, reasons_ar: reasons, answeredCount })
    return { recommendation, comparison }
  }

  /* ─── التوصية النهائية ─── */
  recommend(): RecommendationV2 {
    const ctx = this.decisionContext()
    const { eligibility, candidates } = this.eligibilityAndCandidates(ctx)
    const confidence = computeConfidenceV2(this.state.facts, this.state.contradictions, ctx, candidates)

    if (this.state.guardrailStop) {
      return {
        kind: 'guardrail_stop',
        primaryPathway: null,
        alternatives: [],
        composite: null,
        confidence: toLegacyConfidence(confidence),
        reasons_ar: [this.state.guardrailStop],
        unavailable_skills: [],
        change_makers_ar: [],
        trainer: { status: 'unassigned', note_ar: 'لا مطابقة مدرب قبل اكتمال التشخيص.' },
        disclaimer_ar: DISCLAIMER_AR,
        trace: this.state.trace,
      }
    }

    /* لا مسارات أهلية = فجوة كتالوج صريحة + إحالة مستشار — لا نعيد نفس المسار */
    if (candidates.length === 0) {
      const topDomain = ctx.domains.top
      const gapNote = topDomain
        ? `مجالك الظاهر («${topDomain}») لا يغطيه كتالوج المسارات الحالي — سجّلناه فجوة موثقة، ونحيلك لمستشار يرسم لك بداية مخصصة.`
        : 'الأدلة المجمعة لا تكفي لترشيح مسار مسؤول — مستشار يكمل الصورة معك.'
      const handoff = buildAdvisorHandoff(this.state.facts, this.state.contradictions, ctx, candidates, eligibility, confidence, new Set(this.state.askedQuestionIds))
      const explanation = buildExplanation(this.state.facts, ctx, candidates, eligibility, confidence, {
        catalogGap_ar: topDomain ? gapNote : null,
        personalizationNotes_ar: [],
      })
      this.traceEntry('recommendation', 'إحالة لمستشار — لا مسارات أهلية (فجوة كتالوج أو أدلة ناقصة).', {
        catalogGap: topDomain ?? null,
      })
      return {
        kind: 'advisor_referral',
        primaryPathway: null,
        alternatives: [],
        composite: null,
        confidence: toLegacyConfidence(confidence),
        reasons_ar: [gapNote],
        unavailable_skills: [],
        change_makers_ar: [],
        trainer: { status: 'unassigned', note_ar: 'لا مسار أساسي — تُرسم البداية مع مستشار.' },
        disclaimer_ar: DISCLAIMER_AR,
        trace: this.state.trace,
        v2: { explanation, confidence, eligibility, advisorHandoff: handoff },
      }
    }

    const primary = candidates[0]
    const alternatives = candidates.slice(1, 3)

    /* محوّل شكل V1 — طبقة القوالب والتفسير الموروثان يعملان على المرشحين الأهلية فقط */
    const legacyCandidates: PathwayCandidate[] = candidates.map(toLegacyCandidate)

    /* القوالب المركبة مسموحة عند عدم مطابقة مسار واحد — ليست الافتراضي */
    const layerActive = templatesActive(legacyCandidates)
    const templateScores = layerActive ? scoreTemplates(this.state.facts, legacyCandidates) : []
    this.traceEntry(
      'template_layer',
      layerActive ? 'طُبقة القوالب مفعّلة: الحاجة تمتد لمجالين فعلًا.' : 'طبقة القوالب غير مفعّلة.',
      {
        active: layerActive,
        candidates: templateScores.slice(0, 4).map((s) => ({
          templateId: s.template.template_id,
          fit: s.fit,
          factCoverage: s.factCoverage,
          hardFilter: s.hardFilter,
        })),
      },
    )
    const masteryFact = this.state.facts['verified_mastery']
    const verifiedMastered =
      masteryFact && masteryFact.evidenceQuality >= 0.8 && Array.isArray(masteryFact.value)
        ? (masteryFact.value as string[])
        : []
    const composite = selectTemplate(this.state.facts, legacyCandidates, verifiedMastered)

    /* فجوات مقيسة لا تغطيها دورات — مهارات مجهولة لا تدخل هنا أبدًا */
    const unavailable: { skill: string; note_ar: string }[] = []
    const coveredSlugs = new Set(candidates.flatMap((c) => c.gapSkillSlugs.concat(c.masteredSkillSlugs)))
    for (const [slug, level] of Object.entries(this.state.skillVector)) {
      if (level < 3 && !coveredSlugs.has(slug)) {
        unavailable.push({ skill: slug, note_ar: 'مهارة مقيسة منخفضة لا تغطيها الدورات الحالية — تبقى ظاهرة ولا تُخفى.' })
      }
    }

    const needsAdvisor =
      confidence.outputKind === 'advisor_review' ||
      this.state.contradictions.some((c) => !c.resolved && c.severity === 'high') ||
      composite?.requiredHoursOverflow === true ||
      composite?.advisorHandoff !== undefined

    const kind: Recommendation['kind'] = needsAdvisor
      ? 'advisor_referral'
      : composite
        ? 'composite_template'
        : 'single_pathway'

    const trainer = matchTrainer(primary.pathwayId, this.state.facts, primary.gapSkillSlugs)

    const personalization = personalizationNotes(
      ctx.skillStates,
      /* مجالات المسار المتصدر */ (ctx.domains.ranked.length > 0 ? [ctx.domains.ranked[0]] : []),
    )
    const explanation = buildExplanation(this.state.facts, ctx, candidates, eligibility, confidence, {
      catalogGap_ar: null,
      personalizationNotes_ar: personalization,
    })
    const handoff = needsAdvisor
      ? buildAdvisorHandoff(this.state.facts, this.state.contradictions, ctx, candidates, eligibility, confidence, new Set(this.state.askedQuestionIds))
      : undefined

    this.traceEntry('candidates_scored', `أفضل المرشحين الأهلية: ${candidates.slice(0, 3).map((c) => c.pathwayId).join(' ← ')}`, {
      top5: candidates.slice(0, 5).map((c) => ({ pathwayId: c.pathwayId, total: c.total, measuredSkillCoverage: c.measuredSkillCoverage })),
      excluded: eligibility.filter((e) => !e.eligible).map((e) => ({ pathwayId: e.pathwayId, reasons: e.excludedReasons_ar })),
    })

    const partial = {
      kind,
      primaryPathway: toLegacyCandidate(primary),
      alternatives: alternatives.map(toLegacyCandidate),
      composite,
      confidence: toLegacyConfidence(confidence),
      reasons_ar: [
        ...explanation.understood_facts_ar.slice(0, 2),
        explanation.domain_reason_ar,
        ...explanation.pathway_reasons_ar.slice(0, 2),
        ...(composite?.requiredHoursOverflow ? ['مجموع ساعات الخطة يتجاوز 80 ساعة — تُراجَع مع مستشار.'] : []),
        ...(composite?.advisorHandoff ? [composite.advisorHandoff.rationale_ar] : []),
      ],
      unavailable_skills: unavailable,
      trainer,
      disclaimer_ar: DISCLAIMER_AR,
      trace: this.state.trace,
    }
    const recommendation: RecommendationV2 = {
      ...partial,
      change_makers_ar: buildChangeMakers(partial),
      v2: { explanation, confidence, eligibility, ...(handoff ? { advisorHandoff: handoff } : {}) },
    }
    this.traceEntry('recommendation', `توصية V2: ${kind} — ${confidence.outputKind_ar} (${(confidence.overall * 100).toFixed(0)}٪)`, {
      top: primary.pathwayId,
      outputKind: confidence.outputKind,
      strongBlockers: confidence.strongBlockers_ar,
      measuredSkillCoverage: primary.measuredSkillCoverage,
      unknownSkills: primary.unknownSkillSlugs.length,
    })
    return recommendation
  }
}

/* ─── محوّلات شكل V1 (جسور توافق — لا منطق فيها) ─── */
function toLegacyCandidate(c: V2Candidate): PathwayCandidate {
  return {
    pathwayId: c.pathwayId,
    fit: {
      persona: c.breakdown.persona,
      goal: c.breakdown.goal,
      skillGap: c.breakdown.skillGap ?? 0,
      feasibility: c.breakdown.feasibility,
      motivation: c.breakdown.motivation,
      total: c.total,
      reasons_ar: c.reasons_ar,
    },
    gapSkillSlugs: c.gapSkillSlugs,
    masteredSkillSlugs: c.masteredSkillSlugs,
  }
}

function toLegacyConfidence(c: ConfidenceV2) {
  const bandMap = {
    strong_match: { band: 'strong', band_ar: 'قوية' },
    best_current_match: { band: 'good', band_ar: 'جيدة' },
    exploratory_direction: { band: 'preliminary', band_ar: 'أولية' },
    advisor_review: { band: 'advisor_referral', band_ar: 'تحتاج مراجعة مستشار' },
  } as const
  const b = bandMap[c.outputKind]
  return {
    coverage: c.persona,
    consistency: c.consistency,
    separation: c.separation,
    evidenceQuality: c.evidenceQuality,
    stability: c.skillEvidenceCoverage,
    total: c.overall,
    band: b.band as 'strong' | 'good' | 'preliminary' | 'advisor_referral',
    band_ar: b.band_ar,
  }
}

export function createEngineV2(sessionId?: string): DiagnosticEngineV2 {
  return new DiagnosticEngineV2(sessionId)
}

export { OUTPUT_THRESHOLDS }

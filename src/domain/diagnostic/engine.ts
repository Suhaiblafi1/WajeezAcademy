/* محرك التشخيص التكيفي — المنسق الرئيسي.
   حتمي: نفس الإجابات → نفس السؤال التالي ونفس التوصية ونفس أثر القرار. */

import { computeConfidence } from './confidence'
import { detectContradictions } from './contradictions'
import { pendingDifferentiator, scoreTemplates, selectTemplate, templatesActive } from './composite'
import { buildChangeMakers, buildReasons } from './explanation'
import { applyDerivedRules, decisionCriticalMissing, reduceAnswer } from './facts'
import { matchTrainer } from './instructor-match'
import { scorePathways } from './pathway-score'
import { eligibleQuestions, rankQuestions } from './questions'
import { evaluateStop } from './stop-policy'
import { launchPathways, pathwaySkills, questionById } from './catalog'
import { DISCLAIMER_AR, STOP_RULES, TEMPLATE_THRESHOLDS } from './config'
import type {
  Answer,
  DeepeningComparison,
  DeepeningPlanItem,
  DeepeningSnapshot,
  DiagnosticState,
  FactBag,
  NextQuestionResult,
  PathwayCandidate,
  Recommendation,
} from './types'

/** سقف أسئلة جولة التدقيق — حتمي ولا يُتجاوز أبدا */
export const DEEPENING_MAX_QUESTIONS = 8

export class DiagnosticEngine {
  private state: DiagnosticState
  private mode: 'quick' | 'deep' = 'quick'
  private recommendationGenerated = false
  /* جولة تدقيق الخطة: خطة أسئلة ثابتة تُبنى مرة واحدة من الحالة لحظة الفتح — حتمية كاملة */
  private deepening: {
    started: boolean
    completed: boolean
    plan: DeepeningPlanItem[]
    cursor: number
    before: DeepeningSnapshot | null
  } = { started: false, completed: false, plan: [], cursor: 0, before: null }

  constructor(sessionId?: string) {
    this.state = {
      sessionId: sessionId ?? `dg-${Date.now()}`,
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

  /** بذر حقائق من مصدر خارجي موثق (مؤشر وجيز التمهيدي) قبل بدء الأسئلة —
      الحقائق المزروعة تمنع إعادة سؤال ما أجاب عنه المتعلم سلفا، وتُوثق في أثر القرار */
  seedFacts(facts: FactBag, sourceLabel_ar: string) {
    const seeded: string[] = []
    for (const [key, fact] of Object.entries(facts)) {
      if (this.state.facts[key]) continue // لا نطمس حقيقة موجودة
      this.state.facts[key] = fact
      if (fact.raw) this.state.factsRaw[key] = fact.raw
      seeded.push(key)
    }
    if (seeded.length > 0) {
      this.traceEntry('facts_seeded', `حقائق منقولة من ${sourceLabel_ar}: ${seeded.length} — لن تُسأل مجددا.`, {
        source: sourceLabel_ar,
        factKeys: seeded,
      })
    }
  }

  private traceEntry(kind: DiagnosticState['trace'][number]['kind'], summary_ar: string, data?: Record<string, unknown>) {
    this.state.trace.push({ step: this.state.trace.length + 1, kind, summary_ar, data })
  }

  private triggerContext() {
    return {
      facts: this.state.facts,
      confidenceTotal: this.currentConfidence(),
      askedCount: this.state.askedQuestionIds.length,
      topTwoMargin: this.currentMargin(),
      recommendationGenerated: this.recommendationGenerated,
      recommendationRejected: false,
      userRequestedDeep: this.mode === 'deep',
      sensitiveAnswersPresent: Object.values(this.state.facts).some(
        (f) => questionById.get(f.sourceQuestionId)?.sensitivity_level === 'high',
      ),
    }
  }

  private currentCandidates(): PathwayCandidate[] {
    return scorePathways(this.state.facts, this.state.skillVector)
  }

  private currentConfidence() {
    return computeConfidence(this.state.facts, this.state.contradictions, this.currentCandidates()).total
  }

  private currentMargin(): number | null {
    const c = this.currentCandidates()
    return c.length >= 2 ? c[0].fit.total - c[1].fit.total : null
  }

  /** يختار السؤال التالي ويعيد قرار التوقف — لا يسجل إجابة */
  nextQuestion(): NextQuestionResult {
    if (this.state.guardrailStop) {
      return {
        question: null,
        utility: null,
        stop: { shouldStop: true, reason_ar: this.state.guardrailStop, askedCount: this.state.askedQuestionIds.length },
      }
    }

    /* جولة تدقيق الخطة: أسئلة مخططة سلفا، تُتخطى إن صارت محسومة بأدلة كافية، وتتوقف عند سقفها */
    if (this.deepening.started && !this.deepening.completed) {
      return this.nextDeepeningQuestion()
    }
    if (this.deepening.completed) {
      return {
        question: null,
        utility: null,
        stop: { shouldStop: true, reason_ar: 'اكتملت جولة تدقيق الخطة.', askedCount: this.state.askedQuestionIds.length },
      }
    }

    const candidates = this.currentCandidates()

    /* سؤال فاصل بين خطتين مركبتين متقاربتين (< 0.08): يُطرح قبل أي توقف،
       وبعد إجابته يُعاد حساب القرار كاملا — لا حسم بالترتيب الأبجدي */
    const diff = pendingDifferentiator(
      this.state.facts,
      candidates,
      new Set(this.state.askedQuestionIds),
      new Set(questionById.keys()),
    )
    if (diff) {
      const dq = questionById.get(diff.questionId)!
      this.traceEntry('question_selected', `سؤال فاصل بين خطتين مركبتين متقاربتين: ${dq.text_ar}`, {
        differentiator: true,
        betweenTemplates: diff.between,
        margin: diff.margin,
        winnerReason_ar: 'تقارب خطتين مركبتين دون 8٪ — هذا السؤال الموثق يفصل بينهما.',
      })
      return {
        question: dq,
        utility: null,
        stop: { shouldStop: false, reason_ar: 'سؤال فاصل بين خطتين متقاربتين — لا نتوقف قبل إجابته.', askedCount: this.state.askedQuestionIds.length },
      }
    }

    const confidence = computeConfidence(this.state.facts, this.state.contradictions, candidates)
    // أسئلة المهارات المستهدفة: مهارات المرشحين الثلاثة الأوائل فقط تُقاس في الوضع السريع
    const boostSkillSlugs = new Set(
      candidates.slice(0, 3).flatMap((c) => pathwaySkills(c.pathwayId).map((s) => s.slug)),
    )
    // عند تفعيل طبقة القوالب: حقائقها المطلوبة تصبح ذات أولوية تغطية
    const templateFacts = templatesActive(candidates)
      ? [...new Set(scoreTemplates(this.state.facts, candidates).slice(0, 2).flatMap((s) =>
          s.template.diagnostic.required_facts.map((rf) => rf.fact_key),
        ))]
      : []
    // الحقائق الحاسمة للقرار (مثل حالة العمل لخريج يطلب «وظيفة أو ترقية») أولوية تغطية أيضا
    const criticalMissing = decisionCriticalMissing(this.state.facts)
    const extraRequiredFacts = [...new Set([...templateFacts, ...criticalMissing])]
    const eligible = eligibleQuestions({
      ...this.triggerContext(),
      askedIds: new Set(this.state.askedQuestionIds),
      mode: this.mode,
      boostSkillSlugs,
    })
    const ranked = rankQuestions(eligible, this.state.facts, this.state.contradictions, candidates, extraRequiredFacts)
    const stop = evaluateStop({
      askedCount: this.state.askedQuestionIds.length,
      mode: this.mode,
      candidates,
      confidence,
      rankedUtilities: ranked,
      missingDecisionCritical: criticalMissing,
    })
    if (stop.shouldStop || ranked.length === 0) {
      const finalStop: NextQuestionResult['stop'] = stop.shouldStop
        ? stop
        : { shouldStop: true, reason_ar: 'لا أسئلة أهلية متبقية.', askedCount: this.state.askedQuestionIds.length }
      this.traceEntry('stop_evaluated', finalStop.reason_ar, { askedCount: finalStop.askedCount })
      return { question: null, utility: null, stop: finalStop }
    }
    const best = ranked[0]
    const question = questionById.get(best.questionId)!
    /* أثر القرار: أفضل ثلاثة أسئلة بمكونات المنفعة كاملة، وسبب فوز السؤال المختار */
    const uc = best.utility
    const components: [string, number][] = [
      ['أثره في القرار', uc.decisionImpact * 0.3],
      ['تقليل الغموض', uc.uncertaintyReduction * 0.2],
      ['قدرته على فصل المتصدرين', uc.tieBreakPower * 0.15],
      ['حسم تناقض قائم', uc.contradictionResolution * 0.15],
      ['تغطية حقيقة مطلوبة', uc.requiredCoverage * 0.1],
      ['خفض مخاطرة', uc.riskReduction * 0.1],
    ]
    const winnerReason = components.sort((x, y) => y[1] - x[1])[0][0]
    this.traceEntry('question_selected', `اختيار ${question.question_id}: ${question.text_ar}`, {
      winner: question.question_id,
      winnerReason_ar: `فاز أساسا بسبب: ${winnerReason}.`,
      utility: best.utility.total,
      utilityComponents: best.utility,
      top3: ranked.slice(0, 3).map((r) => ({ questionId: r.questionId, utility: r.utility })),
    })
    return { question, utility: best.utility, stop }
  }

  /** يسجل إجابة ويعيد حساب الحالة كاملة */
  answer(answer: Answer) {
    const question = questionById.get(answer.questionId)
    if (!question) throw new Error(`سؤال غير معروف: ${answer.questionId}`)

    // تعديل إجابة سابقة: إزالة القديمة وإعادة بناء الحالة من الصفر (حتمية كاملة)
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
    /* لقطة قبل الاختزال — لتوثيق الحقائق المضافة والمتغيرة والتناقضات */
    const beforeFacts = { ...this.state.facts }
    const beforeContradictions = new Map(this.state.contradictions.map((c) => [c.id, c.resolved]))
    reduceAnswer(question, answer, this.state.facts, this.state.factsRaw, this.state.skillVector, this.state.interestVector)
    applyDerivedRules(this.state.facts)
    this.state.contradictions = detectContradictions(this.state.facts, this.state.contradictions, this.state.skillVector)

    // حواجز حماية
    if (answer.questionId === 'QB-M0-006') {
      if (this.state.facts['diagnostic_consent']?.value === 'no') {
        this.state.guardrailStop = 'لم تُمنح الموافقة على التشخيص — نتوقف هنا احتراما لاختيارك.'
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
    /* توثيق ما تغير بعد الإجابة: حقائق أضيفت أو تغيرت، وتناقضات ظهرت أو حُسمت */
    const factsAdded = Object.keys(this.state.facts).filter((k) => beforeFacts[k] === undefined)
    const factsChanged = Object.keys(this.state.facts).filter(
      (k) => beforeFacts[k] !== undefined && JSON.stringify(beforeFacts[k].value) !== JSON.stringify(this.state.facts[k].value),
    )
    const contradictionsDetected = this.state.contradictions
      .filter((c) => !beforeContradictions.has(c.id))
      .map((c) => c.id)
    const contradictionsResolved = this.state.contradictions
      .filter((c) => c.resolved && beforeContradictions.get(c.id) === false)
      .map((c) => c.id)
    this.traceEntry('answer_reduced', `اختزال إجابة ${answer.questionId}`, {
      questionId: answer.questionId,
      optionIds: answer.optionIds ?? [],
      factsAdded,
      factsChanged,
      contradictionsDetected,
      contradictionsResolved,
      factsCount: Object.keys(this.state.facts).length,
    })
  }

  /** إعادة بناء كاملة من الإجابات — تضمن الحتمية عند التعديل */
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
      this.state.contradictions = detectContradictions(this.state.facts, this.state.contradictions, this.state.skillVector)
      if (a.questionId === 'QB-M0-006' && this.state.facts['diagnostic_consent']?.value === 'yes') {
        this.state.consentGiven = true
      }
    }
    this.state.askedQuestionIds = asked
    this.traceEntry('answer_reduced', 'أعيد بناء الحالة بعد تعديل إجابة — كل الدرجات أعيد حسابها.')
  }

  /** يحذف آخر إجابة (زر الرجوع) ويعيد بناء الحالة */
  popAnswer(): string | null {
    const last = this.state.answers.pop()
    if (!last) return null
    this.state.askedQuestionIds = this.state.askedQuestionIds.filter((id) => id !== last.questionId)
    /* داخل جولة التدقيق: أعد المؤشر إلى موضع السؤال المتراجع عنه ليُعاد طرحه */
    if (this.deepening.started && !this.deepening.completed) {
      const idx = this.deepening.plan.findIndex((p) => p.questionId === last.questionId)
      if (idx >= 0) this.deepening.cursor = Math.min(this.deepening.cursor, idx)
    }
    this.rebuild()
    return last.questionId
  }

  reviseAnswer(answer: Answer) {
    this.answer(answer)
  }

  setMode(mode: 'quick' | 'deep') {
    this.mode = mode
  }

  /* ═══════════ جولة تدقيق الخطة — «دقّق خطتك أكثر» ═══════════
     اختيارية بالكامل، حتمية، مرتبطة بالجلسة الأصلية: نفس الحقائق والمتجهات،
     والخطة تُبنى مرة واحدة من مناطق عدم اليقين لحظة الفتح. */

  /** لقطة التوصية الحالية دون آثار جانبية — أساس المقارنة قبل/بعد */
  private snapshotRecommendation(): DeepeningSnapshot {
    const candidates = this.currentCandidates()
    const confidence = computeConfidence(this.state.facts, this.state.contradictions, candidates)
    const masteryFact = this.state.facts['verified_mastery']
    const verifiedMastered =
      masteryFact && masteryFact.evidenceQuality >= 0.8 && Array.isArray(masteryFact.value)
        ? (masteryFact.value as string[])
        : []
    const composite = selectTemplate(this.state.facts, candidates, verifiedMastered)
    const primary = candidates[0]
    const pathwayTitle = (id: string) => launchPathways.find((p) => p.id === id)?.title ?? id
    return {
      kind: composite ? 'composite_template' : primary ? 'single_pathway' : 'advisor_referral',
      topId: composite?.templateId ?? primary?.pathwayId ?? null,
      topLabel_ar: composite?.nameAr ?? (primary ? pathwayTitle(primary.pathwayId) : 'إحالة لمستشار'),
      confidenceTotal: confidence.total,
      confidenceBand: confidence.band,
      confidenceBand_ar: confidence.band_ar,
    }
  }

  /**
   * يفتح جولة التدقيق: يحدد مناطق عدم اليقين، يبني خطة أسئلة (بحد أقصى 8) من الأسئلة
   * غير المطروحة، ويسجل سبب الفتح وسبب كل سؤال في أثر القرار.
   * يعيد null إن كانت الجولة مفتوحة سلفا أو لا أسئلة نافعة متبقية.
   */
  startDeepening(): { reason_ar: string; plan: DeepeningPlanItem[]; before: DeepeningSnapshot } | null {
    if (this.deepening.started || this.state.guardrailStop) return null

    const candidates = this.currentCandidates()
    const margin = this.currentMargin()

    /* مناطق عدم اليقين — المعايير السبعة الموثقة في المواصفة */
    const unmeasuredGapSkills = new Set(
      (candidates[0]?.gapSkillSlugs ?? []).filter((s) => this.state.skillVector[s] === undefined),
    )
    const missingConstraints = ['weekly_load', 'budget_profile', 'learning_format'].filter(
      (k) => this.state.facts[k] === undefined,
    )
    const unresolvedContradictions = this.state.contradictions.filter((c) => !c.resolved)
    const goalUnclear =
      this.state.facts['primary_goal'] === undefined || this.state.facts['goal_clarity']?.value === 'low'

    const reasonParts: string[] = []
    if (margin !== null && margin < 0.12) reasonParts.push('تقارب المسارين المتصدرين')
    if (unmeasuredGapSkills.size > 0) reasonParts.push('مهارات فجوة لم تُقس بدليل مباشر')
    if (missingConstraints.length > 0) reasonParts.push('قيود لم تُحسم بعد')
    if (goalUnclear) reasonParts.push('وضوح الهدف يحتاج تدقيقا')
    if (unresolvedContradictions.length > 0) reasonParts.push('تناقض ظاهر بين بعض الإجابات')
    if (reasonParts.length === 0) reasonParts.push('رفع جودة الأدلة واكتمال الصورة')

    /* الأسئلة الأهلية في الوضع العميق — باستثناء ما طُرح وما صارت حقائقه محسومة */
    const askedSet = new Set(this.state.askedQuestionIds)
    const eligible = eligibleQuestions({
      ...this.triggerContext(),
      userRequestedDeep: true,
      askedIds: askedSet,
      mode: 'deep',
      boostSkillSlugs: unmeasuredGapSkills,
    }).filter((q) => q.measures.some((m) => this.state.facts[m] === undefined))

    const criticalMissing = decisionCriticalMissing(this.state.facts)
    const ranked = rankQuestions(eligible, this.state.facts, this.state.contradictions, candidates, criticalMissing)

    const skillNameAr = (slug: string) =>
      pathwaySkills(candidates[0]?.pathwayId ?? '').find((s) => s.slug === slug)?.nameAr ?? slug
    const CONSTRAINT_AR: Record<string, string> = {
      weekly_load: 'وقتك الأسبوعي المتاح',
      budget_profile: 'ميزانيتك',
      learning_format: 'طريقة التعلم الأنسب لك',
    }

    const plan: DeepeningPlanItem[] = []
    for (const r of ranked) {
      if (plan.length >= DEEPENING_MAX_QUESTIONS) break
      const q = questionById.get(r.questionId)!
      const targets: string[] = []
      const reasons: string[] = []
      if (r.utility.tieBreakPower > 0) {
        targets.push('tie')
        reasons.push('يفصل بين المسارين المتصدرين المتقاربين — إجابتك قد تبدّل التوصية الأولى')
      }
      const skillHit = q.measures.find((m) => unmeasuredGapSkills.has(m))
      if (skillHit) {
        targets.push('weak_skill')
        reasons.push(`يقيس مهارة «${skillNameAr(skillHit)}» بسؤال مباشر بدل افتراضها فجوة`)
      }
      const constraintHit = q.measures.find((m) => missingConstraints.includes(m))
      if (constraintHit) {
        targets.push('missing_constraint')
        reasons.push(`يحسم قيد «${CONSTRAINT_AR[constraintHit] ?? constraintHit}» المؤثر في جدوى خطتك`)
      }
      if (goalUnclear && q.measures.some((m) => m === 'primary_goal' || m === 'goal_clarity')) {
        targets.push('goal_unclear')
        reasons.push('يوضح هدفك المهني — أساس اختيار المسار كله')
      }
      if (r.utility.contradictionResolution > 0) {
        targets.push('contradiction')
        reasons.push('يحسم تناقضا ظهر بين إجاباتك السابقة')
      }
      if (targets.length === 0) {
        targets.push('coverage')
        reasons.push('يرفع اكتمال صورتك وجودة الأدلة — فتثبت التوصية أكثر')
      }
      plan.push({ questionId: r.questionId, targets, reason_ar: reasons.join('؛ ') + '.' })
    }
    if (plan.length === 0) return null

    const before = this.snapshotRecommendation()
    this.deepening = { started: true, completed: false, plan, cursor: 0, before }
    this.traceEntry('deepening_started', `فتح جولة تدقيق الخطة: ${reasonParts.join('، ')}.`, {
      reason_ar: `فُتحت الجولة بسبب: ${reasonParts.join('، ')}.`,
      plan: plan.map((p) => ({ questionId: p.questionId, targets: p.targets, reason_ar: p.reason_ar })),
      maxQuestions: DEEPENING_MAX_QUESTIONS,
      before,
    })
    return { reason_ar: `فتحنا هذه الجولة بسبب: ${reasonParts.join('، ')}.`, plan, before }
  }

  /** السؤال التالي داخل جولة التدقيق — يتخطى ما صار محسوما ويتوقف عند السقف */
  private nextDeepeningQuestion(): NextQuestionResult {
    const askedSet = new Set(this.state.askedQuestionIds)
    while (this.deepening.cursor < this.deepening.plan.length) {
      const item = this.deepening.plan[this.deepening.cursor]
      this.deepening.cursor += 1
      const q = questionById.get(item.questionId)
      if (!q) continue
      if (askedSet.has(q.question_id)) continue // لا تكرار أبدا
      if (q.measures.every((m) => this.state.facts[m] !== undefined)) continue // صارت محسومة بأدلة كافية
      this.traceEntry('question_selected', `سؤال تدقيق ${q.question_id}: ${q.text_ar}`, {
        deepening: true,
        targets: item.targets,
        winnerReason_ar: item.reason_ar,
      })
      return {
        question: q,
        utility: null,
        stop: { shouldStop: false, reason_ar: 'جولة تدقيق الخطة جارية.', askedCount: this.state.askedQuestionIds.length },
      }
    }
    this.deepening.completed = true
    return {
      question: null,
      utility: null,
      stop: { shouldStop: true, reason_ar: 'اكتملت أسئلة تدقيق الخطة.', askedCount: this.state.askedQuestionIds.length },
    }
  }

  /** حالة الجولة للواجهة: رقم السؤال الحالي وسقف الجولة وسبب السؤال المعروض */
  deepeningStatus(): { index: number; total: number; currentReason_ar: string | null } | null {
    if (!this.deepening.started || this.deepening.completed) return null
    const current = this.deepening.plan[this.deepening.cursor - 1]
    return {
      index: this.deepening.cursor,
      total: this.deepening.plan.length,
      currentReason_ar: current?.reason_ar ?? null,
    }
  }

  /**
   * يختم جولة التدقيق: يعيد توليد التوصية من الحالة المحدثة،
   * ويقارن قبل/بعد، ويسجل كل ذلك في أثر القرار.
   */
  finishDeepening(): { recommendation: Recommendation; comparison: DeepeningComparison } {
    if (!this.deepening.started || !this.deepening.before) {
      throw new Error('لا جولة تدقيق مفتوحة لإنهائها.')
    }
    this.deepening.completed = true
    const before = this.deepening.before
    const recommendation = this.recommend()
    const after: DeepeningSnapshot = {
      kind: recommendation.kind,
      topId: recommendation.composite?.templateId ?? recommendation.primaryPathway?.pathwayId ?? null,
      topLabel_ar:
        recommendation.composite?.nameAr ??
        (recommendation.primaryPathway
          ? (launchPathways.find((p) => p.id === recommendation.primaryPathway!.pathwayId)?.title ??
            recommendation.primaryPathway.pathwayId)
          : 'إحالة لمستشار'),
      confidenceTotal: recommendation.confidence.total,
      confidenceBand: recommendation.confidence.band,
      confidenceBand_ar: recommendation.confidence.band_ar,
    }

    const changed = before.topId !== after.topId || before.kind !== after.kind
    const reasons: string[] = []
    if (changed) {
      reasons.push(`تغيرت التوصية من «${before.topLabel_ar}» إلى «${after.topLabel_ar}».`)
    } else {
      reasons.push('بقيت التوصية نفسها بعد إجاباتك الإضافية.')
    }
    if (after.confidenceBand !== before.confidenceBand) {
      reasons.push(`انتقل مستوى الثبات من «${before.confidenceBand_ar}» إلى «${after.confidenceBand_ar}».`)
    } else if (Math.abs(after.confidenceTotal - before.confidenceTotal) >= 0.03) {
      reasons.push(
        after.confidenceTotal > before.confidenceTotal
          ? 'ارتفعت قوة الأدلة بعد إجاباتك الإضافية.'
          : 'انخفضت قوة الأدلة قليلا — ظهرت تفاصيل جعلت الصورة أدق.',
      )
    }
    const answeredInRound = this.state.askedQuestionIds.filter((id) =>
      this.deepening.plan.some((p) => p.questionId === id),
    ).length

    const comparison: DeepeningComparison = {
      before,
      after,
      changed,
      note_ar: changed
        ? 'ظهرت معلومات إضافية جعلت هذا الاختيار أكثر ملاءمة.'
        : 'دعمت إجاباتك الإضافية التوصية الحالية.',
      reasons_ar: reasons,
      answeredCount: answeredInRound,
    }
    this.traceEntry('deepening_completed', comparison.note_ar, {
      before,
      after,
      changed,
      reasons_ar: reasons,
      answeredCount: answeredInRound,
    })
    return { recommendation, comparison }
  }

  /** يولد التوصية النهائية */
  recommend(): Recommendation {
    const candidates = this.currentCandidates()
    const confidence = computeConfidence(this.state.facts, this.state.contradictions, candidates)
    this.recommendationGenerated = true

    if (this.state.guardrailStop) {
      return {
        kind: 'guardrail_stop',
        primaryPathway: null,
        alternatives: [],
        composite: null,
        confidence,
        reasons_ar: [this.state.guardrailStop],
        unavailable_skills: [],
        change_makers_ar: [],
        trainer: { status: 'unassigned', note_ar: 'لا مطابقة مدرب قبل اكتمال التشخيص.' },
        disclaimer_ar: DISCLAIMER_AR,
        trace: this.state.trace,
      }
    }

    const primary = candidates[0]
    const alternatives = candidates.slice(1, 3)

    /* أثر القرار: أفضل المسارات المرشحة بمكونات الملاءمة الخمسة */
    this.traceEntry('candidates_scored', `أفضل المرشحين: ${candidates.slice(0, 3).map((c) => c.pathwayId).join(' ← ')}`, {
      top5: candidates.slice(0, 5).map((c) => ({
        pathwayId: c.pathwayId,
        fit: { persona: c.fit.persona, goal: c.fit.goal, skillGap: c.fit.skillGap, feasibility: c.fit.feasibility, motivation: c.fit.motivation, total: c.fit.total },
      })),
    })

    /* طبقة القوالب المركبة — توثيق سبب التفعيل أو عدمه والمرشحين ونقاطهم وتغطيتهم */
    const layerActive = templatesActive(candidates)
    const templateScores = layerActive ? scoreTemplates(this.state.facts, candidates) : []
    this.traceEntry(
      'template_layer',
      layerActive
        ? 'طُبقة القوالب مفعلة: الحاجة تمتد إلى مجالين مختلفين فعلا.'
        : 'طبقة القوالب غير مفعلة: لا يوجد مساران قويان من مجالين مختلفين.',
      {
        active: layerActive,
        activationThreshold: TEMPLATE_THRESHOLDS.dual_pathway_activation_fit,
        candidates: templateScores.slice(0, 4).map((s) => ({
          templateId: s.template.template_id,
          fit: s.fit,
          factCoverage: s.factCoverage,
          missingRequiredFacts: s.missingRequiredFacts,
          hardFilter: s.hardFilter,
        })),
        excludedByHardFilter: templateScores
          .filter((s) => s.hardFilter && s.hardFilter.action !== 'advisor_handoff')
          .map((s) => ({ templateId: s.template.template_id, ...s.hardFilter! })),
      },
    )

    /* الإتقان الموثق فقط (دليل قوي بجودة ≥ 0.8) يبيح حذف دورة — التقييم الذاتي لا يكفي */
    const masteryFact = this.state.facts['verified_mastery']
    const verifiedMastered =
      masteryFact && masteryFact.evidenceQuality >= 0.8 && Array.isArray(masteryFact.value)
        ? (masteryFact.value as string[])
        : []
    const composite = selectTemplate(this.state.facts, candidates, verifiedMastered)
    if (composite) {
      this.traceEntry('template_selected', `قالب مركب: ${composite.nameAr} (ملاءمة ${(composite.fit * 100).toFixed(0)}٪)`, {
        variant: composite.variant,
        courses: composite.courses.map((c) => ({ courseId: c.courseId, type: c.type, reason_ar: c.reason_ar })),
        removedCourses: composite.removedCourses,
        requiredHoursOverflow: composite.requiredHoursOverflow,
        nearestAlternative: composite.nearestAlternative,
      })
    }

    // فجوات غير متاحة تجاريا: مهارات فجوة لا تغطيها دورات المسار الأول
    const unavailable: { skill: string; note_ar: string }[] = []
    if (primary) {
      const coveredSlugs = new Set(
        candidates.flatMap((c) => c.gapSkillSlugs.concat(c.masteredSkillSlugs)),
      )
      for (const [slug, level] of Object.entries(this.state.skillVector)) {
        if (level < 3 && !coveredSlugs.has(slug)) {
          unavailable.push({ skill: slug, note_ar: 'مهارة مطلوبة لا تغطيها الدورات الحالية — تبقى ظاهرة ولا تُخفى.' })
        }
      }
    }

    const needsAdvisor =
      confidence.total < 0.5 ||
      this.state.contradictions.some((c) => !c.resolved && c.severity === 'high') ||
      composite?.requiredHoursOverflow === true ||
      composite?.advisorHandoff !== undefined

    const kind: Recommendation['kind'] = needsAdvisor
      ? 'advisor_referral'
      : composite
        ? 'composite_template'
        : 'single_pathway'

    const trainer = primary
      ? matchTrainer(primary.pathwayId, this.state.facts, primary.gapSkillSlugs)
      : { status: 'unassigned' as const, note_ar: 'لا مسار أساسي بعد.' }
    /* توثيق نتيجة مطابقة المدرب أو سبب عدم التعيين */
    this.traceEntry('trainer_match', trainer.status === 'assigned' ? `مدرب مرشح: ${trainer.nameAr}` : 'مدرب غير معين', {
      status: trainer.status,
      trainerId: trainer.trainerId ?? null,
      note_ar: trainer.note_ar,
    })

    const partial = {
      kind,
      primaryPathway: primary ?? null,
      alternatives,
      composite,
      confidence,
      reasons_ar: [
        ...(primary ? buildReasons(primary, confidence, this.state.facts) : []),
        ...(composite?.requiredHoursOverflow
          ? ['مجموع ساعات الدورات الأساسية في هذه الخطة يتجاوز 80 ساعة — تُراجَع مع مستشار قبل اعتمادها.']
          : []),
        ...(composite?.advisorHandoff ? [composite.advisorHandoff.rationale_ar] : []),
      ],
      unavailable_skills: unavailable,
      trainer,
      disclaimer_ar: DISCLAIMER_AR,
      trace: this.state.trace,
    }
    const recommendation: Recommendation = {
      ...partial,
      change_makers_ar: buildChangeMakers(partial),
    }
    this.traceEntry('recommendation', `توصية: ${kind} — قوة الأدلة ${(confidence.total * 100).toFixed(0)}٪ (${confidence.band_ar})`, {
      top: primary?.pathwayId,
      separation: confidence.separation,
      evidenceComponents: {
        coverage: confidence.coverage,
        consistency: confidence.consistency,
        separation: confidence.separation,
        evidenceQuality: confidence.evidenceQuality,
        stability: confidence.stability,
      },
      advisorReasons: needsAdvisor
        ? [
            ...(confidence.total < 0.5 ? ['قوة الأدلة دون 50٪'] : []),
            ...(this.state.contradictions.some((c) => !c.resolved && c.severity === 'high') ? ['تناقض عالي الخطورة غير محسوم'] : []),
            ...(composite?.requiredHoursOverflow ? ['الدورات الأساسية تتجاوز 80 ساعة'] : []),
            ...(composite?.advisorHandoff ? [`مرشح صارم ${composite.advisorHandoff.filterId}: ${composite.advisorHandoff.rationale_ar}`] : []),
          ]
        : [],
      stopRules: { quickMax: STOP_RULES.quickTargetMax },
    })
    return recommendation
  }
}

export function createEngine(sessionId?: string): DiagnosticEngine {
  return new DiagnosticEngine(sessionId)
}

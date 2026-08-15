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
import { pathwaySkills, questionById } from './catalog'
import { DISCLAIMER_AR, STOP_RULES, TEMPLATE_THRESHOLDS } from './config'
import type {
  Answer,
  DiagnosticState,
  FactBag,
  NextQuestionResult,
  PathwayCandidate,
  Recommendation,
} from './types'

export class DiagnosticEngine {
  private state: DiagnosticState
  private mode: 'quick' | 'deep' = 'quick'
  private recommendationGenerated = false

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
    this.rebuild()
    return last.questionId
  }

  reviseAnswer(answer: Answer) {
    this.answer(answer)
  }

  setMode(mode: 'quick' | 'deep') {
    this.mode = mode
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

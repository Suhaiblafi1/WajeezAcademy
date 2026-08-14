/* محرك التشخيص التكيفي — المنسق الرئيسي.
   حتمي: نفس الإجابات → نفس السؤال التالي ونفس التوصية ونفس أثر القرار. */

import { computeConfidence } from './confidence'
import { detectContradictions } from './contradictions'
import { selectTemplate } from './composite'
import { buildChangeMakers, buildReasons } from './explanation'
import { applyDerivedRules, reduceAnswer } from './facts'
import { matchTrainer } from './instructor-match'
import { scorePathways } from './pathway-score'
import { eligibleQuestions, rankQuestions } from './questions'
import { evaluateStop } from './stop-policy'
import { questionById } from './catalog'
import { DISCLAIMER_AR, STOP_RULES } from './config'
import type {
  Answer,
  DiagnosticState,
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
    const confidence = computeConfidence(this.state.facts, this.state.contradictions, candidates)
    const eligible = eligibleQuestions({
      ...this.triggerContext(),
      askedIds: new Set(this.state.askedQuestionIds),
      mode: this.mode,
    })
    const ranked = rankQuestions(eligible, this.state.facts, this.state.contradictions, candidates)
    const stop = evaluateStop({
      askedCount: this.state.askedQuestionIds.length,
      mode: this.mode,
      candidates,
      confidence,
      rankedUtilities: ranked,
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
    this.traceEntry('question_selected', `اختيار ${question.question_id}: ${question.text_ar}`, {
      utility: best.utility.total,
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
    reduceAnswer(question, answer, this.state.facts, this.state.factsRaw, this.state.skillVector, this.state.interestVector)
    applyDerivedRules(this.state.facts)
    this.state.contradictions = detectContradictions(this.state.facts, this.state.contradictions)

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
    this.traceEntry('answer_reduced', `اختزال إجابة ${answer.questionId}`, {
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
      this.state.contradictions = detectContradictions(this.state.facts, this.state.contradictions)
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

    // طبقة القوالب المركبة
    const mastered = primary?.masteredSkillSlugs ?? []
    const composite = selectTemplate(this.state.facts, candidates, mastered)
    if (composite) {
      this.traceEntry('template_selected', `قالب مركب: ${composite.nameAr} (ملاءمة ${(composite.fit * 100).toFixed(0)}٪)`, {
        variant: composite.variant,
        courses: composite.courses.length,
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
      this.state.contradictions.some((c) => !c.resolved && c.severity === 'high')

    const kind: Recommendation['kind'] = needsAdvisor
      ? 'advisor_referral'
      : composite
        ? 'composite_template'
        : 'single_pathway'

    const trainer = primary
      ? matchTrainer(primary.pathwayId, this.state.facts, primary.gapSkillSlugs)
      : { status: 'unassigned' as const, note_ar: 'لا مسار أساسي بعد.' }

    const partial = {
      kind,
      primaryPathway: primary ?? null,
      alternatives,
      composite,
      confidence,
      reasons_ar: primary ? buildReasons(primary, confidence, this.state.facts) : [],
      unavailable_skills: unavailable,
      trainer,
      disclaimer_ar: DISCLAIMER_AR,
      trace: this.state.trace,
    }
    const recommendation: Recommendation = {
      ...partial,
      change_makers_ar: buildChangeMakers(partial),
    }
    this.traceEntry('recommendation', `توصية: ${kind} — ثقة ${(confidence.total * 100).toFixed(0)}٪ (${confidence.band_ar})`, {
      top: primary?.pathwayId,
      separation: confidence.separation,
      stopRules: { quickMax: STOP_RULES.quickTargetMax },
    })
    return recommendation
  }
}

export function createEngine(sessionId?: string): DiagnosticEngine {
  return new DiagnosticEngine(sessionId)
}

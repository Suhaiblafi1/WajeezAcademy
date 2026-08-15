/* خدمة التقييم — طبقة التطبيق بين المحرك والواجهة.
   الواجهة لا تلمس domain مباشرة؛ كل شيء يمر من هنا. */

import { optionIdAt, questionById } from '../../domain/diagnostic/catalog'
import { createEngine, type DiagnosticEngine } from '../../domain/diagnostic/engine'
import { scorePathways } from '../../domain/diagnostic/pathway-score'
import { loadMirrorAnswers, mirrorAnswersToFacts } from '../../domain/diagnostic/teaser-bridge'
import type { BankQuestion, Recommendation } from '../../domain/diagnostic/types'
import type { DiagQuestion } from '../../data/diagnostic'
import { factsToLegacyAnswers, recommendationToDiagResult } from './view-model'
import { clearSession, loadSession, saveResult, saveSession } from './session-store'
import {
  createSessionRepository,
  type DiagnosticSessionRepository,
  type StoredSession,
} from './session-repository'
import type { DiagResult } from '../../data/diagnostic'

function toDiagQuestion(q: BankQuestion): DiagQuestion {
  const type: DiagQuestion['type'] =
    q.answer_type === 'multi_choice' || q.answer_type === 'rank_top3'
      ? 'multi'
      : q.answer_type === 'short_text' || q.answer_type === 'single_choice_or_text'
        ? 'text'
        : 'single'
  return {
    id: q.question_id,
    module: q.module_id,
    moduleLabel: q.module_name ?? q.module_id,
    text: q.text_ar,
    source: undefined,
    type,
    options: q.options_ar.length > 0 ? q.options_ar.map((o, i) => ({ label: o, value: o, optionId: optionIdAt(q, i) })) : undefined,
    maxSelect: q.answer_type === 'rank_top3' ? 3 : undefined,
    measures: [],
    weight: q.weight ?? 1,
    level: q.required_level === 'core' ? 'core' : 'deep',
  }
}

export interface NextStep {
  question: DiagQuestion | null
  askedCount: number
  stopReasonAr: string | null
}

export class AssessmentSession {
  private engine: DiagnosticEngine
  private repo: DiagnosticSessionRepository
  private sessionRecord: StoredSession | null = null

  constructor(sessionId?: string, repo?: DiagnosticSessionRepository) {
    this.engine = createEngine(sessionId)
    this.repo = repo ?? createSessionRepository()
    /* بذر حقائق «مؤشر وجيز» إن وُجدت — المتعلم لا يُسأل مرتين عما أجاب عنه في الصفحة الرئيسية */
    const mirror = typeof window !== 'undefined' ? loadMirrorAnswers(window.localStorage) : null
    if (mirror) this.engine.seedFacts(mirrorAnswersToFacts(mirror), 'مؤشر وجيز التمهيدي')
  }

  /** إنشاء سجل الجلسة في المستودع كسوليا — أول عملية حفظ تُنشئه */
  private ensureRepoSession(): Promise<StoredSession> {
    if (this.sessionRecord) return Promise.resolve(this.sessionRecord)
    return this.repo.createSession().then((s) => {
      this.sessionRecord = s
      return s
    })
  }

  /** حفظ غير حاجز — فشل المستودع لا يوقف التشخيص، والتخزين المحلي التقليدي يبقى خط رجعة */
  private persistQuietly(op: (s: StoredSession) => Promise<void>) {
    this.ensureRepoSession()
      .then((s) => op(s))
      .catch(() => {
        /* الحفظ التجريبي المحلي قد يفشل (خصوصية صارمة) — لا نعطّل رحلة المتعلم */
      })
  }

  /** معرف جلسة المستودع إن أُنشئ — للتدقيق */
  get repositorySessionId(): string | null {
    return this.sessionRecord?.sessionId ?? null
  }

  /** موافقة تسويقية منفصلة — تُستدعى فقط بفعل صريح من المستخدم */
  setMarketingConsent(consent: boolean) {
    this.persistQuietly((s) => this.repo.setMarketingConsent(s.sessionId, consent))
  }

  /** يستأنف جلسة محفوظة محليا إن وجدت */
  static resume(): AssessmentSession | null {
    const saved = loadSession()
    if (!saved) return null
    const session = new AssessmentSession()
    for (const a of saved.answers) session.engine.answer({ questionId: a.questionId, value: a.value, optionIds: a.optionIds })
    return session
  }

  get askedCount(): number {
    return this.engine.getState().askedQuestionIds.length
  }

  get answersSnapshot(): { questionId: string; value: string | string[]; optionIds?: string[] }[] {
    return this.engine.getState().answers.map((a) => ({ questionId: a.questionId, value: a.value, optionIds: a.optionIds }))
  }

  next(): NextStep {
    const r = this.engine.nextQuestion()
    return {
      question: r.question ? toDiagQuestion(r.question) : null,
      askedCount: this.askedCount,
      stopReasonAr: r.stop.shouldStop ? r.stop.reason_ar : null,
    }
  }

  /** يسجل إجابة ويحفظ تلقائيا، ثم يعيد الخطوة التالية — optionIds أساس القرار والنص للعرض */
  submit(questionId: string, value: string | string[], optionIds?: string[]): NextStep {
    this.engine.answer({ questionId, value, optionIds })
    saveSession({ answers: this.answersSnapshot, savedAt: new Date().toISOString() })
    this.persistQuietly((s) => this.repo.saveAnswer(s.sessionId, { questionId, value, optionIds }))
    return this.next()
  }

  /** تعديل إجابة سابقة — يعيد بناء الحالة كاملة */
  revise(questionId: string, value: string | string[], optionIds?: string[]): NextStep {
    this.engine.reviseAnswer({ questionId, value, optionIds })
    saveSession({ answers: this.answersSnapshot, savedAt: new Date().toISOString() })
    this.persistQuietly((s) => this.repo.reviseAnswer(s.sessionId, { questionId, value, optionIds }))
    return this.next()
  }

  /** التوصية النهائية + حفظ النتيجة بالمفاتيح التي تقرأها الصفحات */
  finish(): { result: DiagResult; recommendation: Recommendation } {
    const recommendation = this.engine.recommend()
    const state = this.engine.getState()
    const result = recommendationToDiagResult(
      recommendation,
      state.skillVector,
      state.facts as unknown as Record<string, { value: unknown }>,
      state.factsRaw,
    )
    const legacyAnswers = factsToLegacyAnswers(
      recommendation,
      state.facts as unknown as Record<string, { value: unknown }>,
      state.factsRaw,
    )
    saveResult(result.resultJson, legacyAnswers, result.top?.id ?? null)
    this.persistQuietly((s) => this.repo.saveDecision(s.sessionId, result.resultJson))
    return { result, recommendation }
  }

  /** حالة الفهم الحية للواجهة — أبعاد مألوفة + ترتيب أولي للمسارات */
  liveState(): {
    dims: Record<'persona' | 'goal' | 'branch' | 'skills' | 'interest' | 'constraints', number>
    overall: number
    rankedPathwayIds: { id: string; score: number }[]
  } {
    const s = this.engine.getState()
    const f = s.facts
    const skillsCount = Object.keys(s.skillVector).length
    const interestCount = Object.keys(s.interestVector).length
    const dims = {
      persona: f['persona_type'] ? 1 : f['persona_branch'] ? 0.4 : 0,
      goal: !f['primary_goal'] ? 0 : f['goal_clarity']?.value === 'high' ? 1 : f['goal_clarity']?.value === 'medium' ? 0.7 : 0.45,
      branch:
        f['employment_state'] || f['education_state'] || f['business_stage'] || f['sector'] ? 0.85 : 0,
      skills: skillsCount >= 3 ? 1 : skillsCount > 0 ? 0.6 : 0,
      interest: interestCount >= 3 ? 1 : interestCount > 0 ? 0.7 : 0,
      constraints:
        (f['weekly_load'] ? 0.5 : 0) + (f['budget_profile'] ? 0.25 : 0) + (f['learning_format'] ? 0.25 : 0),
    }
    const overall = Object.values(dims).reduce((a, b) => a + b, 0) / 6
    const rankedPathwayIds = scorePathways(s.facts, s.skillVector)
      .slice(0, 4)
      .map((c) => ({ id: c.pathwayId, score: c.fit.total }))
    return { dims, overall, rankedPathwayIds }
  }

  /** حذف آخر إجابة (رجوع) — يعيد البناء حتميا */
  popAnswer(): NextStep {
    this.engine.popAnswer()
    saveSession({ answers: this.answersSnapshot, savedAt: new Date().toISOString() })
    return this.next()
  }

  abandon() {
    this.persistQuietly((s) => this.repo.abandonSession(s.sessionId))
    clearSession()
  }
}

export function createAssessment(): AssessmentSession {
  return new AssessmentSession()
}

/** سؤال بمعرفه — لإعادة بناء سجل العرض عند الاستئناف */
export function diagQuestionById(id: string): DiagQuestion | null {
  const q = questionById.get(id)
  return q ? toDiagQuestion(q) : null
}

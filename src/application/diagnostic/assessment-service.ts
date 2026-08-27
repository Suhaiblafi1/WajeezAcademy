/* خدمة التقييم — طبقة التطبيق بين المحرك والواجهة.
   الواجهة لا تلمس domain مباشرة؛ كل شيء يمر من هنا. */

import { optionIdAt, questionById } from '../../domain/diagnostic/catalog'
import { createEngine, type DiagnosticEngine } from '../../domain/diagnostic/engine'
import { createEngineV2, type DiagnosticEngineV2 } from '../../domain/diagnostic/v2'
import { createEngineV21, type DiagnosticEngineV21 } from '../../domain/diagnostic/v2_1'
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

/** إصدار محرك التشخيص — V2.1 (بنية أسئلة B2C النهائية) هو الافتراضي؛
    V2 وV1 يبقيان خلف العلم للتراجع والمقارنة: VITE_DIAGNOSTIC_ENGINE_VERSION=v1|v2 */
export const DIAGNOSTIC_ENGINE_VERSION: 'v1' | 'v2' | 'v2_1' =
  (import.meta.env?.VITE_DIAGNOSTIC_ENGINE_VERSION as string | undefined) === 'v1'
    ? 'v1'
    : (import.meta.env?.VITE_DIAGNOSTIC_ENGINE_VERSION as string | undefined) === 'v2'
      ? 'v2'
      : 'v2_1'

function toDiagQuestion(q: BankQuestion): DiagQuestion {
  const type: DiagQuestion['type'] =
    q.answer_type === 'multi_choice' || q.answer_type === 'rank_top3'
      ? 'multi'
      : q.answer_type === 'short_text' || q.answer_type === 'single_choice_or_text'
        ? 'text'
        : 'single'
  /* V2 قد يفلتر خيارات السؤال حسب شخصية المتعلم — active_option_ids تحفظ هوية الخيار الأصلية */
  const activeIds = q.active_option_ids
  return {
    id: q.question_id,
    module: q.module_id,
    moduleLabel: q.module_name ?? q.module_id,
    text: q.text_ar,
    source: undefined,
    type,
    options: q.options_ar.length > 0 ? q.options_ar.map((o, i) => ({ label: o, value: o, optionId: activeIds?.[i] ?? optionIdAt(q, i) })) : undefined,
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
  /** حالة جولة تدقيق الخطة إن كانت جارية — رقم السؤال، سقف الجولة، وسبب اختيار السؤال */
  deepening?: { index: number; total: number; reasonAr: string | null } | null
  /** لماذا اختار المحرك هذا السؤال بالذات — للعرض تحته حين يكون سببا حقيقيا */
  whyAr?: string | null
  /* تناقض قائم بين إجابتين — نصّه مكتوب للمتعلم أصلا وينتهي بسؤال، وكان
     يُحسب ويُخزَّن ويُخفَّض به مكوّن «اتساق إجاباتك» ولا يُعرض له أثر.
     يُرفع أشدّها لا كلّها: التنبيهات المتراكمة تُقرأ لوما لا مساعدة. */
  contradictionAr?: string | null
}

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const

function topContradiction(
  list: { detail_ar: string; severity: 'low' | 'medium' | 'high'; resolved: boolean }[],
): string | null {
  const open = list.filter((c) => !c.resolved)
  if (open.length === 0) return null
  return [...open].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])[0].detail_ar
}

/* ─────────── لماذا هذا السؤال؟ — ترجمة أثر المحرك إلى لغة المتعلم ───────────

   المحرك يسجل سبب اختيار كل سؤال، لكن عباراته كُتبت لأثر تدقيقي لا لقارئ: يتحدث
   عن «المرشح المتصدر» و«سباق حي» و«فاز أساسًا بسبب»، وهي مفردات بطولته الداخلية.
   وعرضها كما هي يكشف للمتعلم أنه ينظر إلى مخرجات نظام لا إلى جملة كُتبت له.

   فالترجمة هنا عند حدّ العرض لا في المحرك: مفردات التدقيق تبقى كما هي للتقارير
   والبوابات، والمتعلم يقرأ ما يخصه. والقاعدة الأخيرة هي الحارس: أي عبارة تحمل
   مفردات البطولة ولم تُترجَم بعد تُحجب ولا تُعرض خامًا — فالصمت أسلم من الجرگون،
   وأي سبب جديد يضيفه المحرك مستقبلا يسقط إلى الحجب حتى تُكتب ترجمته. */

/** عبارات عامة لا تشرح شيئا — عرضها تحت نصف الأسئلة يعلّم المتعلم تجاهل الصندوق كله */
const GENERIC_WHY = /^(يكمل الصورة العامة|يستكمل سياقك العام|سؤال إضافي|—)\.?$/

/** مفردات البطولة الداخلية — وجودها في عبارة غير مترجمة يعني: احجبها */
const ENGINE_JARGON = /مرشح|المتصدر|الصدارة|سباق|المتحدين|الكيان|entity_id|الاكتفاء|فاز أساسًا/

/** تذييل «فاز أساسًا بسبب: X.» → ترجمة X، وما لا ترجمة له يُحجب */
const WHY_AR: Record<string, string> = {
  'يكمل سياقًا حاسمًا للقرار': 'يكمل سياقًا يؤثّر في ترشيحك مباشرة.',
  'يفصل غموض المجال': 'مجالك ما زال غير محسوم — إجابتك توضّحه.',
  'يفصل بين المرشحين المتصدرين بدليل مهارة': 'مساران يناسبانك حتى الآن — إجابتك ترجّح أحدهما.',
  'يقيس مهارة حاسمة للمتصدر قبل أي اكتفاء': 'نقيس مهارة أساسية في المسار الأقرب لك قبل أن نرشّحه.',
  'يحسم تناقضًا قائمًا': 'إجابتان سابقتان لا تتفقان — وهذا يحسم أيّهما نعتمد.',
  'يستكشف ميولك لأن الهدف غير محسوم': 'هدفك غير محسوم بعد — نستكشف ميلك بدل أن نخمّنه.',
  'يقيس مهارة يتطلبها المرشح المتصدر': 'نقيس مهارة يتطلبها المسار الأقرب لك.',
}

/** العبارات الخاصة التي يكتبها المحرك كاملة بدل التذييل */
const SPECIAL_AR: [RegExp, string][] = [
  [/مهارة حاسمة لأحد مرشحي الصدارة ما زالت مجهولة/,
    'مهارة أساسية في أحد المسارين المرشّحين لك ما زالت غير مقيسة — نقيسها قبل الترشيح.'],
  [/خطة مركبة منافسة .* تنقصها حقيقة مطلوبة/,
    'خطة مركّبة قد تناسبك أكثر — تنقصها معلومة واحدة قبل أن نُنصفها.'],
  [/مهارة حاسمة للمرشح المتصدر ما زالت مجهولة/,
    'لا نرشّح مسارًا بلا دليل مهاري واحد على الأقل — وهذا هو.'],
]

export function learnerWhy(raw: string): string | null {
  const s = raw.trim()
  if (s.length === 0 || GENERIC_WHY.test(s)) return null

  const framed = s.match(/^فاز أساسًا بسبب:\s*(.+?)\.?$/)
  if (framed) return WHY_AR[framed[1].trim()] ?? null

  for (const [re, ar] of SPECIAL_AR) if (re.test(s)) return ar

  /* عبارات النواة مكتوبة للمتعلم أصلا («وقتك الأسبوعي الواقعي يحدد جدوى الخطة»)
     فتمر كما هي — إلا أن تحمل مفردات البطولة، فتُحجب حتى تُترجَم. */
  return ENGINE_JARGON.test(s) ? null : s
}

function whyOfLastQuestion(trace: { kind: string; data?: Record<string, unknown> }[]): string | null {
  const entry = trace.filter((t) => t.kind === 'question_selected').at(-1)
  const reason = entry?.data?.winnerReason_ar
  return typeof reason === 'string' ? learnerWhy(reason) : null
}

export class AssessmentSession {
  private engine: DiagnosticEngine | DiagnosticEngineV2 | DiagnosticEngineV21
  private repo: DiagnosticSessionRepository
  private sessionRecord: StoredSession | null = null

  constructor(sessionId?: string, repo?: DiagnosticSessionRepository) {
    this.engine =
      DIAGNOSTIC_ENGINE_VERSION === 'v2_1'
        ? createEngineV21(sessionId)
        : DIAGNOSTIC_ENGINE_VERSION === 'v2'
          ? createEngineV2(sessionId)
          : createEngine(sessionId)
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
    const ds = this.engine.deepeningStatus()
    return {
      question: r.question ? toDiagQuestion(r.question) : null,
      askedCount: this.askedCount,
      stopReasonAr: r.stop.shouldStop ? r.stop.reason_ar : null,
      deepening: ds ? { index: ds.index, total: ds.total, reasonAr: ds.currentReason_ar } : null,
      whyAr: r.question ? whyOfLastQuestion(this.engine.getState().trace) : null,
      contradictionAr: r.question ? topContradiction(this.engine.getState().contradictions) : null,
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
  /** العائلات التي يستحق أن يُسأل عنها هذا المتعلم — فارغة على المحركات الأقدم */
  familiesToRate(): { family: string; label_ar: string; skills: string[]; courseCount: number }[] {
    const e = this.engine as { familiesToRate?: () => { family: string; label_ar: string; skills: string[]; courseCount: number }[] }
    return e.familiesToRate ? e.familiesToRate() : []
  }

  /** تقييم المتعلم لعائلاته — يُمرَّر للمحرك قبل الحساب النهائي */
  setFamilyRatings(ratings: Record<string, number>): void {
    const e = this.engine as { setFamilyRatings?: (r: Record<string, number>) => void }
    e.setFamilyRatings?.(ratings)
  }

  finish(): { result: DiagResult; recommendation: Recommendation } {
    const recommendation = this.engine.recommend()
    const state = this.engine.getState()
    const result = recommendationToDiagResult(
      recommendation,
      state.skillVector,
      state.facts as unknown as Record<string, { value: unknown }>,
      state.factsRaw,
      state.interestVector,
    )
    result.resultJson.session_id = state.sessionId
    const legacyAnswers = factsToLegacyAnswers(
      recommendation,
      state.facts as unknown as Record<string, { value: unknown }>,
      state.factsRaw,
    )
    saveResult(result.resultJson, legacyAnswers, result.top?.id ?? null)
    this.persistQuietly((s) => this.repo.saveDecision(s.sessionId, result.resultJson))
    return { result, recommendation }
  }

  /** يفتح جولة تدقيق الخطة — يعيد null إن كانت مفتوحة سلفا أو لا أسئلة نافعة متبقية */
  startDeepening(): { step: NextStep; reasonAr: string } | null {
    const opened = this.engine.startDeepening()
    if (!opened) return null
    return { step: this.next(), reasonAr: opened.reason_ar }
  }

  /** يختم جولة التدقيق ويعيد توليد النتيجة مع مقارنة قبل/بعد موثقة */
  finishDeepening(): { result: DiagResult; recommendation: Recommendation; comparison: unknown } {
    const { recommendation, comparison } = this.engine.finishDeepening()
    const state = this.engine.getState()
    const result = recommendationToDiagResult(
      recommendation,
      state.skillVector,
      state.facts as unknown as Record<string, { value: unknown }>,
      state.factsRaw,
      state.interestVector,
      comparison,
    )
    result.resultJson.session_id = state.sessionId
    const legacyAnswers = factsToLegacyAnswers(
      recommendation,
      state.facts as unknown as Record<string, { value: unknown }>,
      state.factsRaw,
    )
    saveResult(result.resultJson, legacyAnswers, result.top?.id ?? null)
    this.persistQuietly((s) => this.repo.saveDecision(s.sessionId, result.resultJson))
    return { result, recommendation, comparison }
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

export type { DeepeningComparison } from '../../domain/diagnostic/types'

/* طبقة حفظ جلسات التشخيص — Repository.
   الواجهة موحدة أمام خدمة التقييم؛ الخلفية قابلة للتبديل:
   - LocalDiagnosticSessionRepository: تخزين محلي على جهاز المستخدم — تجريبي (demo-only) موسوم بوضوح.
   - HttpDiagnosticSessionRepository: عقد API خادمي واضح — غير موصول افتراضيا.
     تمرير baseUrl يفعّله؛ بدونه يبقى معطلا برسالة صريحة.

   ⚠ مانع إنتاج موثق: الحفظ الخادمي الحقيقي شرط لإطلاق عام فعلي —
   التخزين المحلي الحالي لا يصلح لأكثر من العرض التجريبي. */

import { CATALOG_VERSION, DECISION_VERSION, RULES_VERSION } from '../../domain/diagnostic/config'

export interface StoredAnswer {
  questionId: string
  value: string | string[]
  optionIds?: string[]
}

export type SessionStatus = 'active' | 'completed' | 'abandoned'

export interface StoredSession {
  sessionId: string
  status: SessionStatus
  startedAt: string
  updatedAt: string
  answers: StoredAnswer[]
  /** إصدارات القرار وقت الجلسة — قابلية مراجعة وتدقيق */
  catalogVersion: string
  rulesVersion: string
  decisionVersion: string
  /** موافقة تسويقية منفصلة عن موافقة التشخيص — لا تُفترض أبدا */
  marketingConsent: boolean
}

export interface StoredDecision {
  sessionId: string
  decidedAt: string
  resultJson: Record<string, unknown>
  catalogVersion: string
  rulesVersion: string
  decisionVersion: string
}

export interface DiagnosticSessionRepository {
  readonly mode: 'local-demo' | 'http'
  createSession(): Promise<StoredSession>
  loadSession(sessionId: string): Promise<StoredSession | null>
  saveAnswer(sessionId: string, answer: StoredAnswer): Promise<void>
  reviseAnswer(sessionId: string, answer: StoredAnswer): Promise<void>
  saveDecision(sessionId: string, resultJson: Record<string, unknown>): Promise<void>
  loadDecision(sessionId: string): Promise<StoredDecision | null>
  abandonSession(sessionId: string): Promise<void>
  setMarketingConsent(sessionId: string, consent: boolean): Promise<void>
}

const versions = () => ({
  catalogVersion: CATALOG_VERSION,
  rulesVersion: RULES_VERSION,
  decisionVersion: DECISION_VERSION,
})

/* ─────────── التخزين المحلي التجريبي ─────────── */

const REPO_SESSION_KEY = 'wajeez_diag_repo_session'
const REPO_DECISION_KEY = 'wajeez_diag_repo_decision'

/** مستودع محلي تجريبي (demo-only) — جلسة واحدة على جهاز المستخدم، بلا إرسال لأي خادم.
    التخزين قابل للحقن للاختبار؛ الافتراضي localStorage المتصفح */
export class LocalDiagnosticSessionRepository implements DiagnosticSessionRepository {
  readonly mode = 'local-demo' as const
  private storage: Pick<Storage, 'getItem' | 'setItem'> | null

  constructor(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
    this.storage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
  }

  async createSession(): Promise<StoredSession> {
    const now = new Date().toISOString()
    const session: StoredSession = {
      sessionId: `local-${Date.now()}`,
      status: 'active',
      startedAt: now,
      updatedAt: now,
      answers: [],
      marketingConsent: false,
      ...versions(),
    }
    this.persist(session)
    return session
  }

  async loadSession(sessionId: string): Promise<StoredSession | null> {
    const s = this.read()
    return s && s.sessionId === sessionId ? s : null
  }

  async saveAnswer(sessionId: string, answer: StoredAnswer): Promise<void> {
    const s = await this.requireSession(sessionId)
    const i = s.answers.findIndex((a) => a.questionId === answer.questionId)
    if (i >= 0) s.answers[i] = answer
    else s.answers.push(answer)
    s.updatedAt = new Date().toISOString()
    this.persist(s)
  }

  async reviseAnswer(sessionId: string, answer: StoredAnswer): Promise<void> {
    await this.saveAnswer(sessionId, answer)
  }

  async saveDecision(sessionId: string, resultJson: Record<string, unknown>): Promise<void> {
    const s = await this.requireSession(sessionId)
    s.status = 'completed'
    s.updatedAt = new Date().toISOString()
    this.persist(s)
    const decision: StoredDecision = {
      sessionId,
      decidedAt: s.updatedAt,
      resultJson,
      ...versions(),
    }
    if (!this.storage) return
    try {
      this.storage.setItem(REPO_DECISION_KEY, JSON.stringify(decision))
    } catch {
      /* مساحة ممتلئة — نتجاهل بهدوء */
    }
  }

  async loadDecision(sessionId: string): Promise<StoredDecision | null> {
    if (!this.storage) return null
    try {
      const raw = this.storage.getItem(REPO_DECISION_KEY)
      if (!raw) return null
      const d = JSON.parse(raw) as StoredDecision
      return d.sessionId === sessionId ? d : null
    } catch {
      return null
    }
  }

  async abandonSession(sessionId: string): Promise<void> {
    const s = this.read()
    if (s && s.sessionId === sessionId) {
      s.status = 'abandoned'
      s.updatedAt = new Date().toISOString()
      this.persist(s)
    }
  }

  async setMarketingConsent(sessionId: string, consent: boolean): Promise<void> {
    const s = await this.requireSession(sessionId)
    s.marketingConsent = consent
    s.updatedAt = new Date().toISOString()
    this.persist(s)
  }

  private read(): StoredSession | null {
    if (!this.storage) return null
    try {
      const raw = this.storage.getItem(REPO_SESSION_KEY)
      return raw ? (JSON.parse(raw) as StoredSession) : null
    } catch {
      return null
    }
  }

  private persist(s: StoredSession) {
    if (!this.storage) return
    try {
      this.storage.setItem(REPO_SESSION_KEY, JSON.stringify(s))
    } catch {
      /* لا شيء */
    }
  }

  private async requireSession(sessionId: string): Promise<StoredSession> {
    const s = await this.loadSession(sessionId)
    if (!s) throw new Error(`جلسة غير موجودة محليا: ${sessionId}`)
    return s
  }
}

/* ─────────── عقد API الخادمي — غير موصول افتراضيا ─────────── */

/**
 * مستودع خادمي بعقد REST واضح:
 *   POST   /api/diagnostic/sessions                    → StoredSession
 *   GET    /api/diagnostic/sessions/:id                → StoredSession | 404
 *   POST   /api/diagnostic/sessions/:id/answers        → 204  (إجابة جديدة أو معدلة)
 *   PUT    /api/diagnostic/sessions/:id/decision       → 204  (التوصية النهائية + أثر القرار)
 *   GET    /api/diagnostic/sessions/:id/decision       → StoredDecision | 404
 *   POST   /api/diagnostic/sessions/:id/abandon        → 204
 *   PUT    /api/diagnostic/sessions/:id/consent        → 204  (موافقة تسويقية منفصلة)
 *
 * لا يُفعَّل إلا بتمرير baseUrl صريح — وإلا يبقى معطلا برسالة واضحة.
 * ترويسة Authorization اختيارية عبر getAuthToken.
 */
export class HttpDiagnosticSessionRepository implements DiagnosticSessionRepository {
  readonly mode = 'http' as const
  private baseUrl: string | null
  private getAuthToken?: () => string | null

  constructor(baseUrl: string | null, getAuthToken?: () => string | null) {
    this.baseUrl = baseUrl
    this.getAuthToken = getAuthToken
  }

  private assertConnected(): string {
    if (!this.baseUrl) {
      throw new Error('مستودع الجلسات الخادمي غير موصول — مرّر baseUrl صريحا لتفعيله. الحفظ الخادمي مانع إنتاج موثق.')
    }
    return this.baseUrl.replace(/\/$/, '')
  }

  private headers(): HeadersInit {
    const token = this.getAuthToken?.()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    const base = this.assertConnected()
    const res = await fetch(`${base}/api/diagnostic${path}`, {
      method,
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`فشل طلب الحفظ الخادمي: ${res.status}`)
    return res.status === 204 ? null : ((await res.json()) as T)
  }

  async createSession(): Promise<StoredSession> {
    const s = await this.req<StoredSession>('POST', '/sessions', { ...versions() })
    if (!s) throw new Error('استجابة إنشاء الجلسة فارغة')
    return s
  }

  loadSession(sessionId: string) {
    return this.req<StoredSession>('GET', `/sessions/${sessionId}`)
  }

  async saveAnswer(sessionId: string, answer: StoredAnswer) {
    await this.req('POST', `/sessions/${sessionId}/answers`, answer)
  }

  async reviseAnswer(sessionId: string, answer: StoredAnswer) {
    await this.req('POST', `/sessions/${sessionId}/answers`, { ...answer, revised: true })
  }

  async saveDecision(sessionId: string, resultJson: Record<string, unknown>) {
    await this.req('PUT', `/sessions/${sessionId}/decision`, { resultJson, ...versions() })
  }

  loadDecision(sessionId: string) {
    return this.req<StoredDecision>('GET', `/sessions/${sessionId}/decision`)
  }

  async abandonSession(sessionId: string) {
    await this.req('POST', `/sessions/${sessionId}/abandon`)
  }

  async setMarketingConsent(sessionId: string, consent: boolean) {
    await this.req('PUT', `/sessions/${sessionId}/consent`, { marketingConsent: consent })
  }
}

/** الافتراضي: محلي تجريبي موسوم. عند جاهزية الخادم يُحقن HttpDiagnosticSessionRepository هنا فقط. */
export function createSessionRepository(): DiagnosticSessionRepository {
  return new LocalDiagnosticSessionRepository()
}

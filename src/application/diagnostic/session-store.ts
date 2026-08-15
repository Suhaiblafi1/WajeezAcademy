/* مستودع الجلسات المحلي — تجريبي (demo-only) على جهاز المستخدم.
   عند الانتقال للخادم يُستبدل بـ API دون تغيير واجهة الخدمة. */

const PROGRESS_KEY = 'wajeez_diag_v2_progress'
const RESULT_KEY = 'wajeez_diag_v2_result'
const LEGACY_ANSWERS_KEY = 'wajeez_diag_answers'
const LEGACY_TOP_KEY = 'wajeez_diag_top'
const LEGACY_JSON_KEY = 'wajeez_result_json'

export interface SavedSession {
  answers: { questionId: string; value: string | string[]; optionIds?: string[] }[]
  savedAt: string
}

export function saveSession(session: SavedSession) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(session))
  } catch {
    /* مساحة ممتلئة أو خصوصية صارمة — نتجاهل بهدوء */
  }
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedSession
    return Array.isArray(parsed.answers) && parsed.answers.length > 0 ? parsed : null
  } catch {
    return null
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(PROGRESS_KEY)
  } catch {
    /* لا شيء */
  }
}

export function saveResult(resultJson: Record<string, unknown>, legacyAnswers: Record<string, string>, topPathwayId: string | null) {
  for (const store of [sessionStorage, localStorage]) {
    try {
      store.setItem(LEGACY_ANSWERS_KEY, JSON.stringify(legacyAnswers))
      if (topPathwayId) store.setItem(LEGACY_TOP_KEY, topPathwayId)
      store.setItem(LEGACY_JSON_KEY, JSON.stringify(resultJson))
    } catch {
      /* لا شيء */
    }
  }
  try {
    localStorage.setItem(RESULT_KEY, JSON.stringify({ resultJson, savedAt: new Date().toISOString() }))
    localStorage.removeItem(PROGRESS_KEY)
  } catch {
    /* لا شيء */
  }
}

const LAST_RESULT_KEY = 'wajeez_diag_v2_last_full'

/** يحفظ نتيجة العرض كاملة (تسلسلية) لتستعيدها الصفحة دون إعادة حساب */
export function saveLastResult(result: unknown) {
  try {
    localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(result))
  } catch {
    /* لا شيء */
  }
}

export function loadLastResult<T>(): T | null {
  try {
    const raw = localStorage.getItem(LAST_RESULT_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function clearAllSessionData() {
  for (const store of [sessionStorage, localStorage]) {
    try {
      store.removeItem(LEGACY_ANSWERS_KEY)
      store.removeItem(LEGACY_TOP_KEY)
      store.removeItem(LEGACY_JSON_KEY)
      store.removeItem(PROGRESS_KEY)
      store.removeItem(RESULT_KEY)
      store.removeItem(LAST_RESULT_KEY)
    } catch {
      /* لا شيء */
    }
  }
}

export function loadSavedResult(): { resultJson: Record<string, unknown>; topPathwayId: string | null } | null {
  try {
    const raw = localStorage.getItem(RESULT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { resultJson: Record<string, unknown> }
    return { resultJson: parsed.resultJson, topPathwayId: sessionStorage.getItem(LEGACY_TOP_KEY) ?? localStorage.getItem(LEGACY_TOP_KEY) }
  } catch {
    return null
  }
}

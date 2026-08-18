/* مستودع الجلسات المحلي — تجريبي (demo-only) على جهاز المستخدم.
   عند الانتقال للخادم يُستبدل بـ API دون تغيير واجهة الخدمة. */

import type { DiagResult } from '../../data/diagnostic'
import { readStoredResult, wrapResultForStorage, type StoredResultRead } from './result-schema'

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

/** يحفظ نتيجة العرض كاملة مغلفة بإصدار المخطط — لتستعيدها الصفحة بأمان */
export function saveLastResult(result: unknown) {
  try {
    localStorage.setItem(LAST_RESULT_KEY, wrapResultForStorage(result as DiagResult))
  } catch {
    /* لا شيء */
  }
}

/** يقرأ النتيجة المحفوظة مع تحقق المخطط والترحيل — يحذف الفاسد بأمان */
export function loadLastResultSafe(): StoredResultRead {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(LAST_RESULT_KEY)
  } catch {
    return { status: 'none' }
  }
  const read = readStoredResult(raw)
  if (read.status === 'discarded') {
    /* نتيجة لم يمكن ترحيلها — حذف آمن حتى لا تتعطل الصفحة عند كل زيارة */
    try {
      localStorage.removeItem(LAST_RESULT_KEY)
    } catch {
      /* لا شيء */
    }
  }
  return read
}

/** توافق خلفي للاستدعاءات القديمة — يعيد النتيجة أو null */
export function loadLastResult<T>(): T | null {
  const read = loadLastResultSafe()
  return read.status === 'ok' || read.status === 'migrated' ? (read.result as T) : null
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
      /* مفاتيح التخصيص والخطة المركبة — تُمسح مع الجلسة حتى لا تتسرب لنتيجة جديدة */
      store.removeItem('wajeez_custom')
      store.removeItem('wajeez_diag_composite')
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

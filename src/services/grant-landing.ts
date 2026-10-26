/* ما أخذه الزائرُ من نموذج المنحة — يُحفظ على جهازه ليعود إليه (٢٠ أكتوبر ٢٠٢٦، `MemberGrantPage`).

   من عبّأ النموذجَ ثمّ خرج ليوثّق بريده، أو أغلق الصفحةَ وعاد غدا، يجد كودَه ومساراته — لا نموذجا
   يُعبّأ ثانيةً فيُقال له «أرسلنا كودك إلى بريدك». والتخزينُ المحلّيّ لا الجلسيّ: رابطُ التوثيق يُفتح
   في تبويبٍ جديد. وما يُقرأ يُفحص: مرجعٌ بشكله، وكودٌ بشكله، وعمرٌ لا يتجاوز ستّين يوما. ومعه ما قال إنّه
   يريد تطويرَه ومجالُ عمله، فبهما تُختار له دوراتُه الأربع سلفا (`suggestCourses`). */

import { safeGet, safeRemove, safeSet } from '@/services/safe-storage'
import { GRANT_MAX_INTERESTS } from '@/application/commerce/grant-landing'
import { INFLUENCER_CODE_RE } from '@/application/commerce/influencer'

export const GRANT_STORE_KEY = 'wajeez_grant'
/** وما أخذه من «منحة مؤثرين وجيز» في مفتاحٍ وحدَه — فلا تعرض إحدى الصفحتين كودَ الأخرى (٢٦ أكتوبر ٢٠٢٦) */
export const INFLUENCER_GRANT_STORE_KEY = 'wajeez_grant_influencer'
const TTL_MS = 60 * 86_400_000

export interface StoredGrant {
  ref: string
  code: string | null
  sentTo: string | null
  name: string
  email: string
  /** ما يريد تطويرَه — مجالاتُ دوراتٍ اختارها في النموذج */
  interests: string[]
  /** مجالُ عمله كما اختاره — وما حُفظ قبله فارغ */
  workField: string
  /** كودُ المؤثّر الذي حُسب له — في منحة المؤثّرين وحدَها */
  influencer?: string | null
  at: number
}

const UUID_RE = /^[0-9a-f-]{36}$/i
const CODE_RE = /^WG-[A-Z0-9]{8}$/

export function parseStoredGrant(raw: string | null, now = Date.now()): StoredGrant | null {
  if (!raw) return null
  let v: unknown
  try { v = JSON.parse(raw) } catch { return null }
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.ref !== 'string' || !UUID_RE.test(o.ref)) return null
  if (typeof o.at !== 'number' || now - o.at > TTL_MS || o.at - now > 60_000) return null
  const code = typeof o.code === 'string' && CODE_RE.test(o.code) ? o.code : null
  return {
    ref: o.ref, code, at: o.at,
    sentTo: typeof o.sentTo === 'string' ? o.sentTo.slice(0, 200) : null,
    name: typeof o.name === 'string' ? o.name.slice(0, 120) : '',
    email: typeof o.email === 'string' ? o.email.slice(0, 200) : '',
    workField: typeof o.workField === 'string' ? o.workField.slice(0, 60) : '',
    influencer: typeof o.influencer === 'string' && INFLUENCER_CODE_RE.test(o.influencer) ? o.influencer : null,
    interests: Array.isArray(o.interests)
      ? o.interests.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 80)).slice(0, GRANT_MAX_INTERESTS)
      : [],
  }
}

export const readStoredGrant = (key = GRANT_STORE_KEY): StoredGrant | null => parseStoredGrant(safeGet(key))
export const saveStoredGrant = (g: Omit<StoredGrant, 'at'>, key = GRANT_STORE_KEY): void => { safeSet(key, JSON.stringify({ ...g, at: Date.now() })) }
export const clearStoredGrant = (key = GRANT_STORE_KEY): void => safeRemove(key)

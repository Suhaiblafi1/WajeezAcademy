/* ما أخذه الزائرُ من نموذج المنحة — يُحفظ على جهازه ليعود إليه (٢٠ أكتوبر ٢٠٢٦، `MemberGrantPage`).

   من عبّأ النموذجَ ثمّ خرج ليوثّق بريده، أو أغلق الصفحةَ وعاد غدا، يجد كودَه ومساراته — لا نموذجا
   يُعبّأ ثانيةً فيُقال له «أرسلنا كودك إلى بريدك». والتخزينُ المحلّيّ لا الجلسيّ: رابطُ التوثيق يُفتح
   في تبويبٍ جديد. وما يُقرأ يُفحص: مرجعٌ بشكله، وكودٌ بشكله، وعمرٌ لا يتجاوز ستّين يوما. */

import { safeGet, safeRemove, safeSet } from '@/services/safe-storage'

export const GRANT_STORE_KEY = 'wajeez_grant'
const TTL_MS = 60 * 86_400_000

export interface StoredGrant {
  ref: string
  code: string | null
  sentTo: string | null
  name: string
  email: string
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
  }
}

export const readStoredGrant = (): StoredGrant | null => parseStoredGrant(safeGet(GRANT_STORE_KEY))
export const saveStoredGrant = (g: Omit<StoredGrant, 'at'>): void => { safeSet(GRANT_STORE_KEY, JSON.stringify({ ...g, at: Date.now() })) }
export const clearStoredGrant = (): void => safeRemove(GRANT_STORE_KEY)

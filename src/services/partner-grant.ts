/* ما أخذه صاحبُ منحة الشريك يُحفظ على جهازه (١٥ نوفمبر ٢٠٢٦) — فمن عاد إلى صفحة شريكه وجد كودَه ودوراتِه، كصفحات المنح
   (`grant-landing.ts`). ولكلّ شريكٍ مفتاحُه. ولا يُحفظ الرمزُ الذي في رابط البريد: يُستعمل مرّةً ويُمحى من العنوان. */

import { safeGet, safeRemove, safeSet } from '@/services/safe-storage'

const PREFIX = 'wajeez_grant_partner_'
const TTL_MS = 60 * 86_400_000
const PICKS_MAX = 20
const UUID_RE = /^[0-9a-f-]{36}$/i
const CODE_RE = /^WG-[A-Z0-9]{8}$/

export interface StoredPartnerGrant {
  ref: string
  code: string | null
  percentOff: number | null
  name: string
  email: string
  picks: string[]
  at: number
}

export const partnerStoreKey = (slug: string) => `${PREFIX}${slug}`

/** ما حُفظ إن صلح شكلُه ولم يتقادم — وإلّا لا شيء */
export function parseStoredPartnerGrant(raw: string | null, now = Date.now()): StoredPartnerGrant | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<StoredPartnerGrant>
    if (typeof v.ref !== 'string' || !UUID_RE.test(v.ref)) return null
    if (typeof v.at !== 'number' || now - v.at > TTL_MS) return null
    return {
      ref: v.ref,
      code: typeof v.code === 'string' && CODE_RE.test(v.code) ? v.code : null,
      percentOff: typeof v.percentOff === 'number' ? v.percentOff : null,
      name: typeof v.name === 'string' ? v.name.slice(0, 120) : '',
      email: typeof v.email === 'string' ? v.email.slice(0, 200) : '',
      picks: Array.isArray(v.picks) ? v.picks.filter((x): x is string => typeof x === 'string').slice(0, PICKS_MAX) : [],
      at: v.at,
    }
  } catch {
    return null
  }
}

export function readStoredPartnerGrant(slug: string): StoredPartnerGrant | null {
  return parseStoredPartnerGrant(safeGet(partnerStoreKey(slug)))
}

export function saveStoredPartnerGrant(slug: string, g: Omit<StoredPartnerGrant, 'at'>): StoredPartnerGrant {
  const row = { ...g, picks: g.picks.slice(0, PICKS_MAX), at: Date.now() }
  safeSet(partnerStoreKey(slug), JSON.stringify(row))
  return row
}

export function forgetStoredPartnerGrant(slug: string): void {
  safeRemove(partnerStoreKey(slug))
}

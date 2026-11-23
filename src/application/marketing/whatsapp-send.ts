/* ═══ الإرسالُ على واتساب — ما تقرؤه الشاشةُ والخادمُ معا (٢٤ نوفمبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: «ابنه لي في الادمن لارسل واتس اب براحتي». وحدودُ Meta لا حدودُنا: من لم يراسلنا في آخر أربعٍ
   وعشرين ساعةً لا يصله إلّا قالبٌ معتمد، ومن لم يوافق لا يصله شيء. والخادمُ في `server/services/whatsapp/`. */

export type WaCategory = 'UTILITY' | 'MARKETING'
export type WaConsentKind = 'utility' | 'marketing'
export type WaCampaignStatus = 'sending' | 'sent' | 'stopped'
export type WaMessageStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled' | 'received'

export const WA_CATEGORY_AR: Record<WaCategory, string> = { UTILITY: 'خدمة وتذكير', MARKETING: 'تسويق' }
export const WA_CAMPAIGN_AR: Record<WaCampaignStatus, string> = { sending: 'يرسل الآن', sent: 'أرسلت', stopped: 'أوقفت' }
export const WA_MESSAGE_AR: Record<WaMessageStatus, string> = {
  queued: 'تنتظر', sending: 'ترسل', sent: 'أرسلت', delivered: 'وصلت', read: 'قرئت', failed: 'لم تصل', cancelled: 'ألغيت', received: 'واردة',
}

export const WA_WINDOW_MS = 24 * 3_600_000
/** حدُّ Meta الأوّل لمن لم يوثّق نشاطَه — أشخاصٌ في أربعٍ وعشرين ساعة */
export const WA_DEFAULT_DAILY_CAP = 250
export const WA_REPLY_MAX = 4_000
export const WA_PARAM_MAX = 200
export const WA_IMPORT_MAX = 2_000
/** خانةٌ تُملأ باسم الشخص الأوّل */
export const WA_NAME_PARAM = '{{name}}'
export const WA_NAME_FALLBACK = 'صديقنا'

const clean = (s: string) => s
  .replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/[^\p{L}\p{N} ]/gu, '')
  .replace(/\s+/g, ' ').trim().toLowerCase()

const STOP = new Set(['توقف', 'ايقاف', 'اوقف', 'الغاء', 'الغاء الاشتراك', 'stop', 'unsubscribe'].map(clean))
const JOIN = new Set(['اشترك', 'اشتراك', 'subscribe'].map(clean))

/** الكلمةُ وحدَها لا ورودُها في جملة — «لا أريد أن أتوقف» ليست إيقافا */
export const isStopWord = (body: string) => STOP.has(clean(body))
export const isJoinWord = (body: string) => JOIN.has(clean(body))

/** ما يُحفظ دليلا على موافقة من كتب «اشترك» */
export const joinConsentAr = (body: string) => `كتب في واتساب: «${body.trim().slice(0, 100)}»`

export const windowOpen = (lastInbound: Date | string | null, now = Date.now()) =>
  !!lastInbound && now - new Date(lastInbound).getTime() < WA_WINDOW_MS

/** من تصله رسالةُ هذا الصنف: التسويقُ بموافقة تسويقٍ وحدَها، والخدمةُ بأيّ موافقة */
export const consentCovers = (category: WaCategory, kinds: ReadonlySet<WaConsentKind>) =>
  category === 'MARKETING' ? kinds.has('marketing') : kinds.size > 0

/** عددُ خانات `{{1}}` في نصّ القالب، أو `null` لما لا نملؤه (خاناتٌ بأسماء أو غيرُ متتالية) */
export function templateSlots(body: string): number | null {
  const found = [...body.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1])
  if (found.some((v) => !/^\d+$/.test(v))) return null
  const n = new Set(found.map(Number))
  for (let i = 1; i <= n.size; i += 1) if (!n.has(i)) return null
  return n.size
}

export function fillTemplate(body: string, params: readonly string[]): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, d: string) => params[Number(d) - 1] ?? '')
}

export function paramsFor(params: readonly string[], name: string | null): string[] {
  const first = name?.trim().split(/\s+/)[0] || WA_NAME_FALLBACK
  return params.map((p) => (p === WA_NAME_PARAM ? first : p))
}

export interface WaCheck {
  recipients: number
  audienceAr: string
  noConsent: number
  optedOut: number
  invalid: number
  duplicate: number
}

export function waSkippedAr(c: WaCheck): string | null {
  const parts = [
    c.noConsent > 0 ? `${c.noConsent} بلا موافقة` : null,
    c.optedOut > 0 ? `${c.optedOut} طلبوا الإيقاف` : null,
    c.invalid > 0 ? `${c.invalid} رقم بلا مفتاح دولة` : null,
    c.duplicate > 0 ? `${c.duplicate} مكرر` : null,
  ].filter(Boolean)
  return parts.length ? `لا تصل: ${parts.join(' · ')}` : null
}

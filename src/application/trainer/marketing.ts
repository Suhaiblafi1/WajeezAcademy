/* «التسويق» — ما تشترك فيه شاشةُ المدرّب وشاشةُ الإدارة والخادم.

   والعلّةُ كاملةً في رأس `server/services/trainer-marketing.service.ts`. */

export const MARKETING_TARGET_KINDS = ['bio', 'course', 'path'] as const
export type MarketingTargetKind = (typeof MARKETING_TARGET_KINDS)[number]

export const MAX_MARKETING_NOTE = 500
export const MAX_MARKETING_URL = 500
/** صورٌ تكفي ليُختار منها — لا ألبومٌ يُدار */
export const MAX_MARKETING_PHOTOS = 8

/** حالُ الملصق بلغة من يقرؤه — ولكلّ طرفٍ صيغتُه */
export const POSTER_STATUS_AR: Record<string, { trainerAr: string; staffAr: string; tone: 'warn' | 'positive' | 'danger' | 'neutral' }> = {
  draft: { trainerAr: 'مسوّدة', staffAr: 'مسوّدةٌ لم تُرسَل', tone: 'neutral' },
  pending: { trainerAr: 'ينتظر موافقتك', staffAr: 'عند المدرّب', tone: 'warn' },
  approved: { trainerAr: 'وافقتَ عليه', staffAr: 'وافق — صالحٌ للاستعمال العامّ', tone: 'positive' },
  changes_requested: { trainerAr: 'طلبتَ تعديله', staffAr: 'طلب تعديلا', tone: 'danger' },
  superseded: { trainerAr: 'نسخةٌ سابقة', staffAr: 'أزاحتها نسخةٌ أحدث', tone: 'neutral' },
}

/** رابطٌ يُحفظ: https وحدَه، بلا مسافات، وبطولٍ معقول — و`null` لما سواه */
export function cleanMarketingUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim()
  if (!v || v.length > MAX_MARKETING_URL || /\s/.test(v)) return null
  try {
    const u = new URL(v)
    return u.protocol === 'https:' && u.hostname.includes('.') ? u.toString() : null
  } catch {
    return null
  }
}

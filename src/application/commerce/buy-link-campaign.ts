/* حملةُ واتساب للمبيعات — وسمُها في الرابط، وكيف يُعرف طلبُها (٥ نوفمبر ٢٠٢٦).

   الوسمُ `utm_source=whatsapp&utm_campaign=wajeez-sales` لا يغيّر سعرا. ويُقرأ في أثر الطلب (`touch`) فيُعرف أنّه جاء منها،
   ولا عمولةَ مستشارٍ عليه — قرارُ صاحب المنصّة («Hybrid»، `server/services/buy-link.service.ts`). */

export const WHATSAPP_CAMPAIGN_TRACKING = { utm_source: 'whatsapp', utm_campaign: 'wajeez-sales' } as const

/** أطلبٌ من حملة واتساب؟ — من مصدر زيارته كما كُتب في أثره (`FirstTouch`) */
export function isWhatsappCampaign(touch: unknown): boolean {
  if (!touch || typeof touch !== 'object') return false
  const t = touch as { utmSource?: unknown; utmCampaign?: unknown }
  return t.utmSource === WHATSAPP_CAMPAIGN_TRACKING.utm_source && t.utmCampaign === WHATSAPP_CAMPAIGN_TRACKING.utm_campaign
}

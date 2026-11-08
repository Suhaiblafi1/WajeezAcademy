/* حملةُ واتساب للمبيعات — وسمُها في الرابط، وكيف يُعرف طلبُها (٥ نوفمبر ٢٠٢٦).

   الوسمُ `utm_source=whatsapp&utm_campaign=wajeez-sales` لا يغيّر سعرا. ويُقرأ في أثر الطلب (`touch`) فيُعرف أنّه جاء منها،
   ولا عمولةَ مستشارٍ عليه — قرارُ صاحب المنصّة («Hybrid»، `server/services/buy-link.service.ts`). */

export const WHATSAPP_CAMPAIGN_TRACKING = { utm_source: 'whatsapp', utm_campaign: 'wajeez-sales' } as const

/** من أين جاء طلبٌ — من أثره (`order.checkout`): حملةُ واتساب، أو رابطٌ ولّده السوبر أدمن أو المستشار. وما سواها لا يُسمّى
    هنا (مصدرُ الزيارة الأوّل في عمود «المصدر») — ٥ نوفمبر ٢٠٢٦ */
export function orderViaAr(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object') return null
  const m = meta as { touch?: unknown; buyLink?: { kind?: unknown; whatsapp?: unknown } }
  /* ═══ والرابطُ الذي اشترى منه يغلب زيارةً قديمة (٨ نوفمبر ٢٠٢٦) ═══
     مصدرُ الزيارة آخرُ زيارةٍ بإشارةٍ يحفظها المتصفّح، فمن نقر حملةَ واتساب مرّةً ثمّ اشترى من رابط مستشاره بعد أسابيع كان
     يُسمّى «حملة واتساب» — والعمولةُ تحسبه للمستشار (`commissionExcludedOrders`). فالتسميةُ تتبع الرابطَ أوّلا كما تتبعه العمولة */
  if (m.buyLink?.kind === 'advisor') return 'رابط من المستشار'
  if (m.buyLink?.kind === 'admin') return m.buyLink.whatsapp === true ? 'حملة واتساب' : 'رابط من الإدارة'
  if (isWhatsappCampaign(m.touch)) return 'حملة واتساب'
  return null
}

/** أطلبٌ من حملة واتساب؟ — من مصدر زيارته كما كُتب في أثره (`FirstTouch`) */
export function isWhatsappCampaign(touch: unknown): boolean {
  if (!touch || typeof touch !== 'object') return false
  const t = touch as { utmSource?: unknown; utmCampaign?: unknown }
  return t.utmSource === WHATSAPP_CAMPAIGN_TRACKING.utm_source && t.utmCampaign === WHATSAPP_CAMPAIGN_TRACKING.utm_campaign
}

/* حملةُ واتساب للمبيعات — وسمُها في الرابط، وكيف يُعرف طلبُها (٥ نوفمبر ٢٠٢٦).

   الوسمُ `utm_source=whatsapp&utm_campaign=wajeez-sales` لا يغيّر سعرا. ويُقرأ في أثر الطلب (`touch`) فيُعرف أنّه جاء منها،
   ولا عمولةَ مستشارٍ عليه — قرارُ صاحب المنصّة («Hybrid»، `server/services/buy-link.service.ts`). */

export const WHATSAPP_CAMPAIGN_TRACKING = { utm_source: 'whatsapp', utm_campaign: 'wajeez-sales' } as const

/* ═══ وزيارةُ الحملة تُحسب سبعةَ أيّام (٨ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة («7 days»): كان المتصفّحُ يحفظ آخرَ زيارةٍ بإشارةٍ بلا أجل، فمن نقر الحملةَ مرّةً ثمّ اشترى وحدَه بعد
   أشهرٍ عُدّ «حملة واتساب» وسقطت عمولةُ مستشاره. فالزيارةُ تُحسب إن وقعت في الأيّام السبعة قبل الشراء — كعمر رمز رابط الشراء */
export const WHATSAPP_CAMPAIGN_TTL_MS = 7 * 86_400_000

/** من أين جاء طلبٌ — من أثره (`order.checkout`): حملةُ واتساب، أو رابطٌ ولّده السوبر أدمن أو المستشار. وما سواها لا يُسمّى
    هنا (مصدرُ الزيارة الأوّل في عمود «المصدر») — ٥ نوفمبر ٢٠٢٦ */
export function orderViaAr(meta: unknown, orderedAt?: Date): string | null {
  if (!meta || typeof meta !== 'object') return null
  const m = meta as { touch?: unknown; buyLink?: { kind?: unknown; whatsapp?: unknown } }
  /* ═══ والرابطُ الذي اشترى منه يغلب زيارةً قديمة (٨ نوفمبر ٢٠٢٦) ═══
     مصدرُ الزيارة آخرُ زيارةٍ بإشارةٍ يحفظها المتصفّح، فمن نقر حملةَ واتساب مرّةً ثمّ اشترى من رابط مستشاره بعد أسابيع كان
     يُسمّى «حملة واتساب» — والعمولةُ تحسبه للمستشار (`commissionExcludedOrders`). فالتسميةُ تتبع الرابطَ أوّلا كما تتبعه العمولة */
  if (m.buyLink?.kind === 'advisor') return 'رابط من المستشار'
  if (m.buyLink?.kind === 'admin') return m.buyLink.whatsapp === true ? 'حملة واتساب' : 'رابط من الإدارة'
  if (isWhatsappCampaign(m.touch, orderedAt)) return 'حملة واتساب'
  return null
}

/** أطلبٌ من حملة واتساب؟ — من مصدر زيارته كما كُتب في أثره (`FirstTouch`). ومع وقت الشراء (`orderedAt`) لا تُحسب
    زيارةٌ أقدمُ من سبعة أيّام قبله، ولا زيارةٌ بلا وقتٍ يُقرأ */
export function isWhatsappCampaign(touch: unknown, orderedAt?: Date): boolean {
  if (!touch || typeof touch !== 'object') return false
  const t = touch as { utmSource?: unknown; utmCampaign?: unknown; at?: unknown }
  if (t.utmSource !== WHATSAPP_CAMPAIGN_TRACKING.utm_source || t.utmCampaign !== WHATSAPP_CAMPAIGN_TRACKING.utm_campaign) return false
  if (!orderedAt) return true
  const at = typeof t.at === 'string' ? new Date(t.at).getTime() : NaN
  if (Number.isNaN(at)) return false
  return orderedAt.getTime() - at <= WHATSAPP_CAMPAIGN_TTL_MS
}

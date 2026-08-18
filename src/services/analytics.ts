/* طبقة تحليلات تراعي الخصوصية — Privacy-first Analytics
   --------------------------------------------------------------
   المبدأ: نتتبع «أحداث الرحلة» فقط (بدأ، أكمل، اشترى)، ولا تُرسَل
   أي إجابة تشخيص أو محتوى شخصي كقيمة للحدث إطلاقا.

   الآن: تسجيل صامت في وحدة التحكم أثناء التطوير فقط.
   عند النقل إلى Replit: اربط track() بمزودك (PostHog/Plausible/GA4)
   مع الحفاظ على القاعدة الذهبية: لا بيانات شخصية في الأحداث.
*/
export type AnalyticsEvent =
  | 'hero_cta_clicked'
  | 'mirror_started'
  | 'mirror_completed'
  | 'diagnostic_started'
  | 'diagnostic_question_completed'
  | 'diagnostic_abandoned'
  | 'diagnostic_completed'
  | 'recommendation_viewed'
  | 'account_started'
  | 'account_created'
  | 'account_failed'
  | 'pathway_viewed'
  | 'course_viewed'
  | 'checkout_started'
  | 'payment_completed'
  | 'payment_failed'
  | 'refund_requested'
  | 'contact_submitted'
  | 'deepening_started'
  | 'deepening_completed'
  | 'composite_adopted'

/** سمات وصفية غير شخصية فقط: أرقام أسئلة، مجالات، أنواع شراء */
type Meta = Record<string, string | number | boolean>

export function track(event: AnalyticsEvent, meta?: Meta) {
  if (import.meta.env.DEV) {
     
    console.debug(`[analytics] ${event}`, meta ?? {})
  }
  // نقطة الربط الإنتاجي: أرسل (event, meta) إلى المزود هنا — بلا أي محتوى شخصي
}

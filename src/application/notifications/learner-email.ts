/* ═══ ما يصل المتعلّمَ بالبريد مع الجرس — قرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦) ═══

   كان كلُّ ما يصل المتعلّمَ جرسا في بوّابته وحدَه: لا يراه حتّى يدخل. فشعبةٌ أُلغي لقاؤها
   أو حجزٌ ينقضي بعد ساعة يمرّان ولا يعلم. وخُيّر صاحبُ المنصّة بين ثلاث: الجرسُ وحدَه كما
   كان، أو البريدُ لكلّ خبرٍ مهمّ، أو البريدُ لما يضرّ فواتُه وحدَه — فاختار الثالث:
   «المالُ وتغيّرُ الشعبة». وما سواهما يبقى جرسا.

   والقائمةُ هنا لا في كلّ نداء: `NotificationService.notify` يقرؤها فيكتب صفَّ بريدٍ بجانب صفّ
   الجرس. فمن أضاف خبرا من هذين الصنفين أضافه هنا مرّةً، ولا يتذكّر حلقةَ قناتين في كلّ موضع. */

export const LEARNER_EMAIL_KEYS: ReadonlySet<string> = new Set([
  /* المال: قبضٌ وردٌّ وردُّ طلبه، ومقعدٌ محجوزٌ ينتظر الدفع، وطلبٌ أُلغي لأنّه لم يُدفع */
  'payment.succeeded', 'payment.refunded', 'payment.refund_rejected',
  'order.seats_held', 'plan.seats_held', 'order.cancelled_abandoned',
  /* تغيّرُ الشعبة: موعدٌ تحرّك أو أُلغي، وشعبةٌ أُلغيت، وتسجيلٌ أُسقط، ومدرّبٌ رحل */
  'cohort.schedule_changed', 'cohort.cancelled', 'enrollment.dropped',
  'departure.choice', 'departure.resolved',
])

/** أيُكتب مع صفّ الجرس صفُّ بريد؟ للمتعلّم وحدَه، وفي القائمة وحدَها، وما لم يمنعه المُنادي */
export function alsoByEmail(p: {
  channel: string; audience?: string | null; templateKey?: string | null; skipEmail?: boolean
}): boolean {
  return p.channel === 'in_app'
    && (p.audience ?? 'learner') === 'learner'
    && !p.skipEmail
    && !!p.templateKey && LEARNER_EMAIL_KEYS.has(p.templateKey)
}

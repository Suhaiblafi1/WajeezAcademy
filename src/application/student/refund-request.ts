/* طلبُ الاسترداد من «فواتيري» (٢٠ أكتوبر ٢٠٢٦، الخطوة ك من خطّة تبسيط جهة المتعلّم).

   كان الطلبُ المدفوعُ في «فواتيري» بلا بابٍ للاسترداد: سياسةُ الاسترداد تقول «أرسل طلبك عبر صفحة
   التواصل»، وصفحةُ الدعم لا تعرف أيَّ دفعةٍ يقصد. فلكلّ طلبٍ مدفوعٍ زرٌّ يفتح تذكرةَ دعمٍ حقيقيّةً
   برقم فاتورته — والاستردادُ نفسُه يقرّره فريقُ الماليّة كما كان (`finance.refund.process`).
   ومن فتح طلبا لم يُغلق لا يُعرض عليه زرٌّ ثانٍ: يُقال له إنّ طلبه مفتوح، ويُفتح له. */

/** رقمُ فاتورةٍ بشكله — حروفٌ لاتينيّةٌ وأرقامٌ وشُرَط — أو لا شيء (يأتي من الرابط) */
export function refundInvoiceOf(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  return /^[A-Z0-9][A-Z0-9-]{2,39}$/i.test(v) ? v : null
}

/** مسودّةُ تذكرة الاسترداد — «الفواتير والدفع»، ورقمُ الفاتورة في موضوعها إن عُرف، والسببُ يكتبه هو */
export function refundTicketDraft(invoiceNumber: string | null): { subject: string; category: 'billing'; body: string } {
  return { subject: invoiceNumber ? `طلب استرداد — ${invoiceNumber}` : 'طلب استرداد', category: 'billing', body: '' }
}

/** بابُ الطلب: تذكرةٌ مصنّفةٌ «الفواتير والدفع» برقم الفاتورة في موضوعها */
export function refundRequestHref(invoiceNumber: string): string {
  return `/student/support?topic=refund&invoice=${encodeURIComponent(invoiceNumber)}`
}

/** ما يُستردّ منه: مدفوعٌ، أو رُدّ بعضُه وبقي بعض */
export function refundable(orderStatus: string): boolean {
  return orderStatus === 'paid' || orderStatus === 'partially_refunded'
}

const CLOSED = new Set(['resolved', 'closed'])

/** تذكرةُ استردادٍ مفتوحةٌ لهذه الفاتورة — رقمُها في موضوعها ولم تُحلّ */
export function openRefundTicket<T extends { subject: string; status: string }>(invoiceNumber: string, tickets: readonly T[]): T | null {
  return tickets.find((t) => !CLOSED.has(t.status) && t.subject.includes(invoiceNumber)) ?? null
}

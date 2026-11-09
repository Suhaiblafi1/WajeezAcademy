/* حالاتُ المال كما تقرؤها شاشةُ «المالية» — بالأسماء التي يكتبها الخادم لا بأسماءٍ تُظنّ.

   كانت حالاتُ الاسترداد في الشاشة requested/approved، والخادمُ يكتب pending/processed
   (`Refund.status` و`requestRefund`). فلا يطابق طلبٌ «requested» أبدا: يُطلب الاستردادُ ثمّ لا
   يظهر زرُّ «تنفيذ» ولا «رفض»، ولا يُعدّ في اللسان (٢٦ أكتوبر ٢٠٢٦). فصارت هنا في موضعٍ واحد
   يقرؤه اختبارُ الخادم (`server/tests/commerce/finance-status.test.ts`) على صفٍّ حقيقيّ. */

/** الاستردادُ الذي ينتظر من ينفّذه أو يرفضه — كما يكتبه `requestRefund` */
export const REFUND_AWAITING = 'pending'

export const RF_STATUS: Record<string, string> = { pending: 'ينتظر التنفيذ', processed: 'نفذ', rejected: 'مرفوض' }

/** الدفعاتُ التي وصل مالُها — وما رُدّ منها يبقى ظاهرا بحاله */
export const PAY_STATUS: Record<string, string> = { succeeded: 'دفعة ناجحة', partially_refunded: 'رد بعضها', refunded: 'ردت كلها' }

/* الأرشيف: ما انتهى بلا مال — طلبٌ أُلغي أو رُفض أو انقضى، وفاتورةٌ أُبطلت. كانت تُعرض كلُّها بين
   ما ينتظر عملا، فيضيع المعلَّقُ بين عشرين «ملغى». تُخفى ولا تُحذف: زرٌّ يُظهرها. */
export const ARCHIVED_REQ: ReadonlySet<string> = new Set(['cancelled', 'rejected', 'expired'])
export const ARCHIVED_INV: ReadonlySet<string> = new Set(['void'])

/** أدفعةٌ زائدة؟ ما وصل مالُه بعد دفعةٍ أخرى على الفاتورة نفسِها — صفحةُ دفعٍ ثانيةٌ دُفعت لطلبٍ مدفوع (٩ نوفمبر ٢٠٢٦).
    والأولى هي التي سوّت الطلب. والخادمُ يحكم بالقاعدة نفسِها في الردّ (`isExtraPayment` في `commerce.service.ts`). */
export function isExtraPayment(
  p: { id: string; status: string; succeededAt?: string | null },
  all: readonly { id: string; status: string; succeededAt?: string | null }[],
): boolean {
  if (!(p.status in PAY_STATUS) || !p.succeededAt) return false
  return all.some((o) => o.id !== p.id && o.status in PAY_STATUS && !!o.succeededAt
    && (o.succeededAt < p.succeededAt! || (o.succeededAt === p.succeededAt && o.id < p.id)))
}

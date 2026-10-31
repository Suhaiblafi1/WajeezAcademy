/* «فواتيري وطلباتي»: الملغى يُطوى ولا يُمحى (٣١ أكتوبر ٢٠٢٦).

   قال صاحبُ المنصّة وقد رأى طلبين ملغيَّين يتصدّران الشاشة: «الغِ الفواتيرَ الملغاة أو أخفِها للترتيب».
   فتُطوى ولا تُحذف: الفاتورةُ قيدٌ ماليٌّ برقمٍ متسلسل (`WJ-INV-…`)، ومحوُها يخرم التسلسلَ والأثر. فالقائمُ
   أوّلا، والملغى خلف زرٍّ بعدده يفتحه من أراده. */

/** طلبٌ أُلغي — بيد صاحبه، أو بانقضاء مهلة دفعه فيُفرَج عن مقعده (`Order.status`) */
export const isCancelledOrder = (status: string): boolean => status === 'cancelled'

/** القائمُ والملغى — كلٌّ بترتيبه كما جاء من الخادم */
export function splitOrders<T extends { status: string }>(rows: readonly T[]): { live: T[]; cancelled: T[] } {
  return {
    live: rows.filter((o) => !isCancelledOrder(o.status)),
    cancelled: rows.filter((o) => isCancelledOrder(o.status)),
  }
}

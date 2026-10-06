/* «جديد» — متى يُعلَّم ما أُضيف إلى الدليل (٥ أكتوبر ٢٠٢٦).

   كانت القاعدةُ في `toc.ts`، وهو يستورد محتوى الدليل كلَّه. ثمّ صارت الملاحظةُ
   (`callout`) تحمل «جديد» كالقسم، وعُدّتُها `components/guide/GuideKit.tsx` مشتركةٌ مع
   صفحة «التدريبُ معنا» — فلو قرأت القاعدةَ من `toc.ts` لحُمّل الدليلُ كلُّه في تلك
   الصفحة. فالقاعدةُ هنا وحدَها، ويُعيد `toc.ts` تصديرَها. */

/** كم يبقى القسمُ «جديدا» بعد إضافته — شهرٌ يكفي من قرأ الإعلانَ ليجده، ثمّ تسقط العلامةُ وحدَها */
export const NEW_FOR_DAYS = 30

const DAY = 86_400_000

/** أُضيف في آخر `NEW_FOR_DAYS` يوما؟ — واليومُ يبدأ بتوقيت عمّان (+03:00) */
export function isNewSince(added: string | undefined, now: Date): boolean {
  if (!added || !/^\d{4}-\d{2}-\d{2}$/.test(added)) return false
  const age = now.getTime() - Date.parse(`${added}T00:00:00+03:00`)
  return age >= 0 && age < NEW_FOR_DAYS * DAY
}

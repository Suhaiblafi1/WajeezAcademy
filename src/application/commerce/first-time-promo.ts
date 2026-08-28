/* كود التشجيع لأول عملية شراء — مصدر واحد للرقم والنص.

   الكود يُعرض في ثلاثة أماكن على الأقل (نتيجة التشخيص، صفحة المسار، نافذة
   الدفع)، ونسبته قرار تسعير لا تفصيل واجهة. فلو تفرّقت في ثلاثة ملفات لتغيّرت
   في اثنين وبقيت في الثالث — ورقمٌ معروض لا يُطبَّق عند الدفع وعدٌ مكسور.

   ⚠ حين تُوصَل المدفوعات الحقيقية: يجب أن يوجد صفّ Coupon بهذا الرمز نفسه في
   القاعدة (percentOff = PERCENT_OFF) وإلا صار الخصم معروضا في الواجهة وغائبا
   عن الفاتورة. الترحيل 20260828120000_first_time_coupon ينشئه. */

export const FIRST_TIME_PROMO = {
  code: 'WA2026',
  percentOff: 10,
  /** لمن لم يشترِ من قبل — القيد يُطبَّق عند الفوترة لا في العرض */
  labelAr: 'لأول عملية شراء',
} as const

/** السعر بعد الكود — تقريب إلى أقرب صحيح كما تفعل الفوترة */
export function priceAfterPromo(amount: number): number {
  return Math.round(amount * (1 - FIRST_TIME_PROMO.percentOff / 100))
}

/** هل الرمز الذي كتبه المستخدم هو رمز التشجيع؟ — بلا حساسية لحالة الأحرف ولا للفراغات */
export function isFirstTimePromo(input: string): boolean {
  return input.trim().toUpperCase() === FIRST_TIME_PROMO.code
}

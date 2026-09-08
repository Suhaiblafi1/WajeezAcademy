/* رمزُ دعوة المدرّب في المتصفّح.

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): للمدرّب رابطٌ لكلّ شعبة، ومن سجّل منه
   يُحسب له. الرابطُ يهبط على صفحة الدورة بـ`?ref=`، والدفعُ يقع بعدها بخطواتٍ
   — وقد يسجّل الزائرُ حسابا بينهما — فيُحفظ الرمزُ في الجلسة لا في العنوان.
   والخادمُ هو من يقرّر: رمزٌ لا يخصّ الشعبةَ المشتراةَ يُهمَل هناك بلا خطأ. */
export const REFERRAL_KEY = 'wajeez.ref'

export function readReferral(): string | null {
  try { return sessionStorage.getItem(REFERRAL_KEY)?.trim() || null } catch { return null }
}

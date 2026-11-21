/* «سجّل معي» — بعد الحجز (٢١ نوفمبر ٢٠٢٦). من يبحث عن عمل يعرف غيرَه يبحث، فرسالةٌ جاهزةٌ على واتساب برابط
   الصفحة و`?src=share`، فيظهر في اللوحة من جاء منها. وزرٌّ ثانويّ: لا ينافس خطوةَ الدفع على الانتباه. */

import { shareInviteText } from '@/application/private-course/ai-jobs'
import { waShare } from '@/application/site/whatsapp'

export default function ShareInvite() {
  return (
    <div className="aij-share">
      <b>تعرف أحدا يبحث عن عمل؟</b>
      <span>أرسل له رابط الدورة ليسجل معك.</span>
      <a className="aij-copy" href={waShare(shareInviteText(window.location.origin))} target="_blank" rel="noopener noreferrer">أرسل له الرابط على واتساب</a>
    </div>
  )
}

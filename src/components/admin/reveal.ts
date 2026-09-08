/* بلوغُ صفٍّ بعينه داخل الصفحة — انزلاقٌ **وتركيزٌ** معا.
 *
 * ── لماذا لا يكفي `scrollIntoView` ──
 *
 * زرُّ الرأس يقول «ابدأ بأوّلها»، فينزلق المشهدُ إلى الصفّ. ومن يتنقّل بلوحة
 * المفاتيح لم ينتقل معه شيء: تركيزُه ما يزال على الزرّ في أعلى الصفحة،
 * فضغطةُ Tab التالية تعيده إلى حيث كان لا إلى ما ذهب إليه بصرُه. ومن يقرأ
 * بقارئ شاشةٍ لا يعلم أنّ شيئا وقع أصلا — الانزلاقُ حدثٌ بصريٌّ بحت.
 *
 * فالتركيزُ جزءٌ من الفعل لا زينةٌ بعده. والصفُّ الهدفُ يحمل `tabIndex={-1}`
 * ليقبله بلا أن يدخل ترتيبَ التنقّل.
 *
 * ── والحركةُ تُلغى لمن طلب ──
 *
 * `prefers-reduced-motion` قرارُ صاحب الجهاز لا اقتراح: من طلب تقليلَ الحركة
 * ينتقل إلى الصفّ فورا بلا انزلاق. والوجهةُ واحدةٌ في الحالين.
 *
 * ── وموضعُه في ملفٍّ لا في `WorkHeader.tsx` ──
 *
 * حاجزُ التلويم يردّ تصديرَ ما ليس مكوّنا من ملفِّ مكوّن
 * (`react-refresh/only-export-components`) — وهو ما ردَّ تصديرَ ألسنةِ
 * الشعبة قبله.
 */

export function revealRow(id: string): void {
  const el = document.getElementById(id)
  if (!el) return
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' })
  el.focus({ preventScroll: true })
}

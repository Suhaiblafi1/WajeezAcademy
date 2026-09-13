/* أيُّ بوّابةٍ هذا المسار؟ — قرارٌ يُفحص، لا شرطٌ في JSX.

   «حسابي» كانت صفحةً بإطارٍ واحدٍ هو إطارُ بوّابة المتعلّم، فمديرُ النظام
   يفتحها من ترويسة الإدارة فتنقلب الشاشةُ إلى بوّابة طالب (شكوى صاحب
   المنصّة، ١٣ سبتمبر ٢٠٢٦: «أتحوّل لمنصّة طالب علما أنّ دوري سوبر أدمن»).
   وليس عطبَ صلاحيّات — `super_admin` يمرّ حارسَ بوّابة المتعلّم عمدا — بل
   عطبُ إطارٍ لا يعرف من أين جاء صاحبُه.

   والبادئةُ تقول من أين جاء بلا تخمين، وهي هنا خالصةً من React لتُختبر في
   Node كسائر قرارات هذا المستودَع. */

/** بوّاباتُ العاملين ببوادئ مساراتها — وما عداها بوّابةُ المتعلّم */
export const PORTAL_PREFIXES = ['/admin', '/trainer', '/advisor'] as const

/** بادئةُ بوّابةِ هذا المسار، و`null` لما ليس بوّابةَ عاملين.

    والمطابقةُ على **مقاطع المسار** لا على حروفه: `/trainers` صفحةُ
    المدرّبين للزوّار لا بوّابةَ المدرّب، و`startsWith` وحدَها تخلطهما
    فتُصيَّر صفحةٌ عامّةٌ بإطار بوّابة. */
export function portalPrefixFor(pathname: string): string | null {
  return PORTAL_PREFIXES.find((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? null
}

/** المسارُ الذي تُفتح عليه «حسابي» من داخل هذه البوّابة */
export function accountPathForPortal(pathname: string): string {
  const prefix = portalPrefixFor(pathname)
  return prefix ? `${prefix}/account` : '/student/account'
}

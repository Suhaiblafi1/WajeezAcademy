/* عناوينُ الأكاديميّة — مصدرٌ واحدٌ لا يُكتب بالأيدي.

   ── قرارُ صاحب المنصّة (٢٣ سبتمبر ٢٠٢٦): عنوانٌ ظاهرٌ واحد ──

   «كلُّ بريدٍ قد يراه المستخدمُ في الموقع هو Academy@wajeez.co وحدَه — لا
   support ولا غيره». نسخا لتقسيمٍ سابقٍ كان يعطي كلَّ غايةٍ عنوانا
   (`support@` · `privacy@` · `legal@` · `billing@` · `calendar@`). فالغاياتُ
   باقيةٌ مفاتيحَ في `ACADEMY_EMAILS` — ليبقى في الشيفرة سببُ ذكرِ العنوان في
   كلِّ موضع — لكنّها تشير جميعا إلى العنوان الواحد.

   ── والمُرسِلُ وحدَه يبقى على نطاق الموقع، والردُّ يُوجَّه ──

   Resend يرفض كلَّ رسالةٍ من نطاقٍ لم يُوثَّق عنده، والموثَّقُ اليومَ
   `wajeezacademy.com` وحدَه. فلو خرجت الرسائلُ الآليّةُ من `Academy@wajeez.co`
   لسقطت كلُّها بصمت. فتبقى من `no-reply@` على النطاق الموثَّق، وتُضبط ترويسةُ
   `Reply-To` على العنوان الواحد — وهي لا تحتاج توثيقا — فمن يضغط «ردّ» يصل
   إلى Academy@wajeez.co. ومتى وُثِّق `wajeez.co` في Resend أمكن نقلُ المُرسِل
   إليه من هنا.

   وللخادم نسخةٌ ثانيةٌ لازمة (`server/services/integrations.service.ts`) لأنّه
   لا يستورد من `src/`. ويحرس تطابقَهما `src/tests/academy-email.test.ts`، ومعه
   حارسٌ يمنع أن يُكتب عنوانٌ حرفا في أيّ ملفٍّ آخر. */

/** العنوانُ الوحيدُ الذي يراه المستخدم — قرارُ صاحب المنصّة */
export const ACADEMY_CONTACT_EMAIL = 'Academy@wajeez.co'

/** نطاقُ الإرسال الموثَّق في Resend — للمُرسِل الآليّ وحدَه */
export const ACADEMY_EMAIL_DOMAIN = 'wajeezacademy.com'

/** الاسمُ الظاهرُ في صندوق الوارد */
export const ACADEMY_EMAIL_NAME = 'أكاديمية وجيز'

export const ACADEMY_EMAILS = {
  /** المُرسِلُ الآليّ — توثيقُ البريد والاستعادةُ والفواتيرُ والتذكيرات.
      لا يُقرأ ما يصله، ويُوجَّه الردُّ إلى العنوان الواحد. */
  noReply: `no-reply@${ACADEMY_EMAIL_DOMAIN}`,

  /** التواصلُ العامّ — صفحةُ التواصل، وسؤالُ الزائر، و`Reply-To` لكلّ رسالةٍ آليّة */
  support: ACADEMY_CONTACT_EMAIL,

  /** الخصوصيّةُ وطلباتُ البيانات */
  privacy: ACADEMY_CONTACT_EMAIL,

  /** الشروطُ والنزاعات */
  legal: ACADEMY_CONTACT_EMAIL,

  /** الماليّة — الاستردادُ والفواتير */
  billing: ACADEMY_CONTACT_EMAIL,

  /** منظِّمُ دعوات التقويم في ملفّات `.ics` */
  calendar: ACADEMY_CONTACT_EMAIL,
} as const

/** العنوانُ العامُّ حين لا تكون الغايةُ محدَّدة */
export const ACADEMY_EMAIL = ACADEMY_CONTACT_EMAIL

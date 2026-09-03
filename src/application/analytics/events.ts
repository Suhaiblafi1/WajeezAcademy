/* قائمةُ أحداث التحليلات — مصدرٌ واحد للواجهة والخادم.

   كانت قائمتين: اتّحادُ نوعٍ في `src/services/analytics.ts`، ومجموعةٌ بيضاء
   في `server/http/routes/analytics.routes.ts` تعليقُها يقول إنّها «مرآة»
   للأولى. والمرايا تشيخ: كانت الواجهةُ تطلق أحد عشر حدثا لا يعرفها الخادم
   — منها `offer_signup_clicked` و`promo_applied` و`course_path_*` وأحداثُ
   مشغّل الدروس كلُّها — فتعود ٤٢٢ ولا يُسجَّل شيء.

   والعطبُ من أسوأ نوعٍ في القياس: **لا يُرى**. الحدثُ يُطلق، والصفحةُ لا
   تتعطّل، والرقمُ في اللوحة صفرٌ — فيُقرأ «لا أحد يفعل هذا» بينما الحقيقة
   «لا أحد يسجّله». وقد اتُّخذت قرارات على أرقامٍ من هذا الباب.

   فصارت القائمةُ هنا، ويشتقّ منها الاثنان: الاتّحادُ في الواجهة
   (`typeof ANALYTICS_EVENTS[number]`) والمجموعةُ في الخادم. فحدثٌ يُضاف
   يُقبَل في الطرفين معا، أو لا يُترجم أصلا. */

export const ANALYTICS_EVENTS = [
  /* ح-٣: إجابة على تمرين استرجاع — رقم الوحدة والسؤال وصوابه، بلا نص حرّ */
  'module_check_answered',
  /* ح-٢: فتح فصل فيديو — رقم الوحدة والفصل */
  'module_video_chapter_opened',
  /* خطوةٌ في مشغّل دروس الوحدة — يقيس أين يتوقّف المتعلّمون فعلا */
  'module_step',
  'hero_cta_clicked',
  'mirror_started',
  'mirror_completed',
  'diagnostic_started',
  'diagnostic_question_completed',
  'diagnostic_abandoned',
  'diagnostic_completed',
  'recommendation_viewed',
  'result_full_viewed',
  'account_started',
  'account_created',
  'account_failed',
  'feedback_submitted',
  'pathway_viewed',
  'course_viewed',
  /* حُذف 'payment_completed': كان يُطلق بعد مؤقّت نافذة دفعٍ وهمية، فيصير
     في التحليلات «مبيعات» لا وجود لها. والدفعُ الحقيقيّ يُسوّى بـwebhook
     موقَّع على الخادم — فمن هناك يُسجَّل إن سُجّل، لا من المتصفّح. */
  'checkout_started',
  /* حلّ محلّ 'enroll_request_opened': لم تعد نافذةً تطلب مراجعةً بشريّة بل
     لوحَ شراءٍ يُسعّر ويدفع. والاسمُ القديم يبقى مقبولا في السجلّ التاريخيّ
     فلا يُعاد استعمالُه لشيءٍ آخر — قياسان مختلفان باسمٍ واحد يُقرآن واحدا. */
  'buy_panel_opened',
  'enroll_request_opened',
  'payment_failed',
  'refund_requested',
  'contact_submitted',
  'deepening_started',
  'deepening_completed',
  'composite_adopted',
  /* اعتماد مسار جاهز — كان <Link> بلا حدث، فلا نعرف كم اعتمد جاهزا مقابل مركَّب */
  'pathway_adopted',
  /* شبكة تقييم الجوانب — تُقاس لأننا نحتاج أن نعرف كم يملؤها وكم يتخطاها */
  'skills_rated',
  'skills_skipped',
  /* بناء مسار من دورة واحدة — الفتح والإضافة والتسمية.
     تُقاس لأنها تجيب سؤالا لا نملك جوابه: هل يبني الناس تركيباتهم فعلا،
     وأين يتوقفون — عند الدورة الواحدة أم عند حدّ الحزمة؟ */
  'course_path_opened',
  'course_path_added',
  /* اختيارٌ تجاوز سقف البناء فحُفظ للمرحلة التالية — لا رفض صامت */
  'course_path_deferred',
  'promo_applied',
  'course_path_named',
  /* تبديلُ موعد الشعبة في صفحة الدورة — يقيس كم يكفيه أقربُ موعدٍ وكم يبحث
     عن غيره؛ وهو ما يقول لنا هل نفتح شعبا أكثر أم نُقرّب مواعيدها. */
  'cohort_chosen',
] as const

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number]

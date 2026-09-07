/* أصنافُ الإشعارات — وما يجوز كتمُه منها وما لا يجوز (المهمّة ٧٢).

   ─────────── لمَ صنفٌ لا مفتاحُ قالبٍ ───────────

   المفاتيحُ في المنصّة عشرون (`session.reminder.24h` و`enrollment.waitlist.promoted`…)
   وستزيد. وشاشةُ تفضيلاتٍ بعشرين مفتاحا تُقرأ صفّا صفّا فتُترك كما هي —
   والافتراضيُّ يصير هو التفضيلَ الوحيد. فالأصنافُ ستّةٌ يفهمها صاحبُ الحساب،
   وكلُّ مفتاحٍ جديد ينضمّ إلى صنفه فلا تكبر الشاشةُ بكبر المنصّة.

   ─────────── ولمَ ليس كلُّ شيءٍ قابلا للكتم ───────────

   شاشةُ تفضيلاتٍ تُتيح كتمَ **إيصال دفعٍ** أو **إصدار شهادة** ليست خدمةً
   للمستخدم: هي بابُ نزاعٍ لاحق — «لم يخبرني أحد» وقد أُخبِر وكتَمَه هو.
   وكذلك تكليفُ الموظّف: النموذجُ نفسُه يقول «تكليفٌ لا يعلم به صاحبُه ليس
   تكليفا».

   فالكتمُ محصورٌ في ما لا يترتّب عليه حقٌّ ولا واجب: التذكيرُ والتقدّمُ
   والإعلانات. وما عداه يُعرَض في الشاشة **مقفلا ومعه سببُه** — لا يُخفى ولا
   يُعطى مفتاحا كاذبا. */

export interface NotificationCategory {
  key: string
  labelAr: string
  /** ما يقع في هذا الصنف — بلغةِ صاحب الحساب لا بلغةِ المفاتيح */
  whatAr: string
  /** هل يجوز كتمُه؟ */
  silenceable: boolean
  /** سببُ المنع — يُعرض في الشاشة، فلا قفلٌ بلا تفسير */
  lockedWhyAr?: string
  /** مفاتيحُ القوالب التي تنضمّ إليه */
  templateKeys: readonly string[]
}

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  {
    key: 'sessions',
    labelAr: 'تذكيرُ الجلسات',
    whatAr: 'قبل الجلسة بيومٍ وقبلها بساعة',
    silenceable: true,
    /* ── ثغرةٌ كانت هنا: `session.reminder.1h` بلا صنف ──

       المفتاحان اللذان تُرسلهما الوظيفةُ فعلا هما `.24h` و`.1h`. وكان
       المسجَّل `session.reminder` (لا تستعمله إلّا بذرةُ الديمو) و`.24h`
       وحدَهما — فتذكيرُ الساعة بلا صنف، و`isSilenceable` تردّ عليه
       `false`. أي أنّ من كتم «تذكيرَ الجلسات» كان يكتم تذكيرَ اليوم
       ويبقى تذكيرُ الساعة يصله. صمتٌ نصفيٌّ يبدو عطلا. */
    templateKeys: ['session.reminder', 'session.reminder.24h', 'session.reminder.1h'],
  },
  {
    key: 'progress',
    labelAr: 'تقدّمي في المسار',
    whatAr: 'قبولُ تسجيلٍ · انتقالٌ من قائمة الانتظار · قرارٌ في طلبٍ رفعتَه',
    silenceable: true,
    templateKeys: [
      'enrollment.approved', 'enrollment.confirmed', 'enrollment.rejected',
      'enrollment.waitlist.promoted', 'learner.request_decided', 'plan.requested', 'plan.seats_held',
    ],
  },
  {
    /* ── ستّةُ مفاتيحَ كانت تُرسَل ولا صنفَ لها ──

       «وصلت درجتك» و«مدرّبُك يطلب إعادةَ التسليم» لم يكونا في أيّ صنف. وأثرُه
       أنّهما **لا يظهران في الشاشة إطلاقا** — لا مفتوحَين ولا مقفلَين. وهو
       نقضٌ للقاعدة المكتوبة في رأس هذا الملفّ: ما لا يُكتَم يُعرَض مقفلا
       ومعه سببُه، لا يُخفى.

       وسببُ خفائها أنّها تُبنى وقتَ التنفيذ (`` `submission.${action}` ``)
       فلا يراها مسحٌ يقرأ الحرف. والحارسُ يرفض اليوم كلَّ مفتاحٍ يُبنى هكذا
       حتّى تُسمَّى توسّعاتُه. */
    key: 'grading',
    labelAr: 'تصحيحُ عملي',
    whatAr: 'بدءُ مراجعةِ تسليمك · طلبُ إعادته · قبولُه أو رفضُه · وصولُ درجتك أو تعديلُها',
    silenceable: false,
    lockedWhyAr: '«أعد التسليم» يحمل مهلةً — وكتمُه يُضيّع مهلةً لا خبرا. والدرجةُ يُبنى عليها إكمالُ المسار، فبلوغُها شرطُ أن تُراجَع.',
    templateKeys: [
      'submission.start_review', 'submission.request_resubmit',
      'submission.accept', 'submission.reject',
      'grade.create', 'grade.update',
    ],
  },
  {
    key: 'announcements',
    labelAr: 'إعلاناتُ الأكاديمية',
    whatAr: 'ما تُرسله الإدارةُ للعموم أو لشعبتك',
    silenceable: true,
    templateKeys: ['staff.announce'],
  },
  {
    key: 'money',
    labelAr: 'المال',
    whatAr: 'إيصالُ دفعٍ · مستحقّاتُ مدرّب',
    silenceable: false,
    lockedWhyAr: 'إيصالُ دفعٍ لا يُكتَم: هو سجلُّك عند الخلاف، وكتمُه يجعل «لم يخبرني أحد» صحيحا في الظاهر.',
    templateKeys: ['payment.succeeded', 'trainer_payout'],
  },
  {
    key: 'certificates',
    labelAr: 'الشهادات',
    whatAr: 'إصدارُ شهادةٍ باسمك',
    silenceable: false,
    lockedWhyAr: 'الشهادةُ تُنسب إليك برقمٍ يُتحقَّق منه علنا — فإصدارُها خبرٌ يجب أن يبلغك.',
    templateKeys: ['certificate.issued'],
  },
  {
    key: 'work',
    labelAr: 'عملي في الأكاديمية',
    whatAr: 'مهمّةٌ كُلِّفتَ بها · طلبٌ ينتظر قرارك · شعبةٌ أُسنِدت إليك · تذكرةُ دعمٍ أو طلبُ انضمامٍ جديد',
    silenceable: false,
    lockedWhyAr: 'تكليفٌ لا يعلم به صاحبُه ليس تكليفا — ولذلك لا يُكتَم عملُ الموظّف.',
    templateKeys: [
      'staff.task.assigned', 'staff.task.done', 'admin.support.ticket', 'admin.support_ticket',
      'admin.trainer_application', 'admin.learner_request', 'trainer.qualify.request',
      /* التأهيلُ والإسنادُ خبرا عملٍ لا مجاملة: من أُسنِد إلى شعبةٍ عليه أن
         يحضر، ومن أُهِّل لدورةٍ صار يُنتظَر منه تدريسُها. */
      'trainer.qualified', 'trainer.qualify.rejected', 'trainer.assigned',
      /* والمستشارُ مثلُه: حالةٌ أُسنِدت إليه عملٌ ينتظره، وكان يكتشفها بإعادة التحميل */
      'advisor.case.assigned',
      /* وتذكيرُ المدرّب بحصّتِه هنا لا في «الجلسات»: حصّةُ المتعلّم موعدٌ
         له، وحصّةُ المدرّب موعدٌ عليه. ومن يكتمها يُغيّب صفّا دفع مقاعدَه. */
      'session.reminder.trainer.24h', 'session.reminder.trainer.1h',
      /* وأنّ عملا دخل طابورَ تصحيحه: المتعلّمُ ينتظر جوابا، والصمتُ يُقرأ
         إهمالا وهو جهل. */
      'submission.queued',
    ],
  },
]

/** الصنفُ الذي ينتمي إليه مفتاحُ قالب — أو `null` لمفتاحٍ لا صنفَ له بعد */
export function categoryForTemplate(templateKey: string | null | undefined): NotificationCategory | null {
  if (!templateKey) return null
  return NOTIFICATION_CATEGORIES.find((c) => c.templateKeys.includes(templateKey)) ?? null
}

/** هل يجوز كتمُ إشعارِ هذا المفتاح؟ ما لا صنفَ له لا يُكتَم — السهو لا يُسكِت خبرا */
export function isSilenceable(templateKey: string | null | undefined): boolean {
  return categoryForTemplate(templateKey)?.silenceable ?? false
}

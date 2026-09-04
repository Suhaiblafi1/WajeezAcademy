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
    templateKeys: ['session.reminder', 'session.reminder.24h'],
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
    whatAr: 'مهمّةٌ كُلِّفتَ بها · طلبٌ ينتظر قرارك · تذكرةُ دعمٍ أو طلبُ انضمامٍ جديد',
    silenceable: false,
    lockedWhyAr: 'تكليفٌ لا يعلم به صاحبُه ليس تكليفا — ولذلك لا يُكتَم عملُ الموظّف.',
    templateKeys: [
      'staff.task.assigned', 'staff.task.done', 'admin.support.ticket', 'admin.support_ticket',
      'admin.trainer_application', 'admin.learner_request', 'trainer.qualify.request',
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

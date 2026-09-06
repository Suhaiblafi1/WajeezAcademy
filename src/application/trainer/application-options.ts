/* خياراتُ طلب الانضمام المشتركة بين النموذج والخادم ولوحة الإدارة.

   مصدرٌ واحد للقيم وأسمائها: القيمةُ تُخزَّن والاسمُ يُقرأ، ولو تفرّقا في
   ثلاثة ملفّات لاختلف ما يراه المتقدّم عمّا يراه المراجع عمّا يفحصه
   الخادم. والوحدةُ نقيّة — لا React ولا Prisma — فتُستورد من الطرفين. */

/** مواسمُ التدريب — أربعةُ أرباعٍ تبدأ بنوفمبر لا بيناير، لأنّ موسمَ
    التدريب العربيّ يبدأ بعد الصيف ويقف في رمضان والصيف لا عند رأس السنة. */
export const TRAINING_SEASONS = [
  { value: 'nov_jan', label: 'موسم الشتاء', months: 'نوفمبر – يناير', monthNums: '١١ – ١' },
  { value: 'feb_apr', label: 'موسم الربيع', months: 'فبراير – أبريل', monthNums: '٢ – ٤' },
  { value: 'may_jul', label: 'موسم الصيف', months: 'مايو – يوليو', monthNums: '٥ – ٧' },
  { value: 'aug_oct', label: 'موسم الخريف', months: 'أغسطس – أكتوبر', monthNums: '٨ – ١٠' },
] as const

export type TrainingSeason = (typeof TRAINING_SEASONS)[number]['value']
export const TRAINING_SEASON_VALUES = TRAINING_SEASONS.map((s) => s.value) as [TrainingSeason, ...TrainingSeason[]]

/** الاسمُ الكامل كما يُقرأ في الملفّ والبريد: «موسم الشتاء (نوفمبر – يناير)» */
export function seasonLabel(value: string): string {
  const s = TRAINING_SEASONS.find((x) => x.value === value)
  return s ? `${s.label} (${s.months})` : value
}

/** كيف نتواصل معه للاجتماع التعريفيّ — أربعُ قنوات، واحدةٌ تُختار */
export const CONTACT_CHANNELS = [
  { value: 'phone', label: 'مكالمة هاتفية', needsPhone: true, needsAltEmail: false },
  { value: 'whatsapp', label: 'واتساب', needsPhone: true, needsAltEmail: false },
  { value: 'email', label: 'البريد الإلكتروني المسجّل', needsPhone: false, needsAltEmail: false },
  { value: 'other_email', label: 'بريد إلكتروني آخر', needsPhone: false, needsAltEmail: true },
] as const

export type ContactChannel = (typeof CONTACT_CHANNELS)[number]['value']
export const CONTACT_CHANNEL_VALUES = CONTACT_CHANNELS.map((c) => c.value) as [ContactChannel, ...ContactChannel[]]

export function contactChannelLabel(value: string): string {
  return CONTACT_CHANNELS.find((c) => c.value === value)?.label ?? value
}

/* ═══════════ حجزُ المقابلة — قرارُ صاحب المنصّة (٦ سبتمبر ٢٠٢٦) ═══════════

   المقابلةُ تجري **خارج** المنصّة منذ صار الاعتمادُ بنقرةٍ واحدة. وكانت شاشةُ
   «وصل طلبك» تَعِد المتقدّمَ وعدا سلبيّا: «نتواصل معك… لتحديد موعد» — فيقف
   ينتظر مكالمةً قد تتأخّر، ولا شيءَ بيده. فصار الموعدُ يُحجَز بيده هو.

   ولماذا أداةٌ خارجيّة لا شاشةٌ عندنا: جدولةُ المواعيد المتاحة تحتاج تقويمَ
   المُقابِل وحجبَ ما حُجز ودعوةَ Zoom ورسالةَ تأكيد — وثلاثتُها لا تملكها
   المنصّةُ اليوم (لا قناةَ بريدٍ فعّالة أصلا). فتُستعمل الأداةُ لما تحسنه،
   ولا يُبنى نصفُ مُجدوِلٍ لا يُرسل شيئا.

   ورابطٌ لا وحدةٌ مضمَّنة: سياسةُ المحتوى `default-src 'self'` تحجب إطارَ
   Calendly وسكربتَه حجبا تامّا — فالتضمينُ يُنتج مستطيلا أبيضَ بلا خطأٍ ظاهر. */
export const TRAINER_INTERVIEW = {
  /** يُغيَّر من هنا وحدَه — تقرؤه الشاشتان معا */
  url: 'https://calendly.com/hadeel-7/wajeez-academy',
  minutes: 30,
  platformAr: 'Zoom',
} as const

/** الرابطُ معبَّأً سلفا باسم المتقدّم وبريده ورقم طلبه.

    ولماذا التعبئة: من يفتح صفحةَ الحجز بعد نموذجٍ من أربعة أقسام لا يكتب
    اسمَه وبريدَه مرّةً ثالثة. و`a1` أوّلُ سؤالٍ مخصّصٍ في Calendly — يُملأ
    برقم الطلب إن وُجد السؤال، ويُتجاهَل بلا ضررٍ إن لم يوجد. */
export function trainerInterviewUrl(input: { name?: string; email?: string; reference?: string }): string {
  const q = new URLSearchParams()
  if (input.name?.trim()) q.set('name', input.name.trim())
  if (input.email?.trim()) q.set('email', input.email.trim())
  if (input.reference?.trim()) q.set('a1', input.reference.trim())
  const s = q.toString()
  return s ? `${TRAINER_INTERVIEW.url}?${s}` : TRAINER_INTERVIEW.url
}

/** حالاتُ الطلب كما تُقال لصاحبه — لا كما تُقال للمراجع.
    الاسمُ قصير، والشرحُ يقول ما يجري الآن وما الذي يليه. */
export const APPLICANT_STATUS: Record<string, { label: string; explain: string; tone: 'neutral' | 'progress' | 'good' | 'warn' | 'bad' }> = {
  draft: {
    label: 'لم يُكمَل بعد',
    explain: 'حفظنا القسم الأول من طلبك. أكمل مستنداتك ووسيلة التواصل ليصل الطلب إلى فريق المراجعة.',
    tone: 'warn',
  },
  email_verification_pending: {
    label: 'بانتظار تأكيد البريد',
    explain: 'افتح رابط التأكيد الذي أرسلناه إلى بريدك ليصبح طلبك مُقدَّما رسميا.',
    tone: 'warn',
  },
  submitted: {
    label: 'وصل طلبك — بانتظار المراجعة',
    explain: 'طلبك كامل عند فريقنا. احجز موعدَ اجتماعك التعريفيّ من الزرّ أدناه — ونقرأ طلبك قبله.',
    tone: 'progress',
  },
  under_review: {
    label: 'قيد المراجعة',
    explain: 'يقرأ فريقنا الأكاديمي طلبك ومستنداتك الآن.',
    tone: 'progress',
  },
  information_requested: {
    label: 'نحتاج معلومات إضافية',
    explain: 'راجع بريدك: طلبنا منك استكمال شيء في ملفك، وبعده يعود طلبك إلى المراجعة.',
    tone: 'warn',
  },
  shortlisted: {
    label: 'اختيار أولي',
    explain: 'اجتاز طلبك الفرز الأوّليّ. الخطوةُ التالية مقابلةٌ قصيرة — احجز موعدَها من الزرّ أدناه.',
    tone: 'progress',
  },
  interview_scheduled: {
    label: 'مقابلة مجدولة',
    explain: 'لديك موعد مقابلة. راجع بريدك لتفاصيله.',
    tone: 'progress',
  },
  demo_requested: {
    label: 'بانتظار الدرس التجريبي',
    explain: 'نطلب منك درسا تجريبيا قصيرا تقيّمه لجنتنا الأكاديمية.',
    tone: 'progress',
  },
  academic_review: {
    label: 'مراجعة أكاديمية نهائية',
    explain: 'تكتب اللجنة الأكاديمية تقييمها النهائي بعد المقابلة والدرس التجريبي.',
    tone: 'progress',
  },
  conditionally_approved: {
    label: 'قبول مشروط',
    explain: 'قُبل طلبك مبدئيا. الخطوة التالية عقدٌ نرسله إليك للتوقيع.',
    tone: 'good',
  },
  contract_pending: {
    label: 'العقد قيد التوقيع',
    explain: 'أرسلنا لك العقد. بعد توقيعه تبدأ تهيئة انضمامك.',
    tone: 'good',
  },
  onboarding: {
    label: 'تهيئة الانضمام',
    explain: 'نجهّز حسابك وموادك. عند اكتمالها تُفتح لك بوابة المدربين من هذا الحساب نفسه.',
    tone: 'good',
  },
  active: {
    label: 'مدرب نشط',
    explain: 'اكتمل اعتمادك. بوابة المدربين مفتوحة لك من هذا الحساب.',
    tone: 'good',
  },
  waitlisted: {
    label: 'قائمة الانتظار',
    explain: 'طلبك مقبول للانتظار: نعود إليه حين تُفتح شعبة في تخصصك.',
    tone: 'neutral',
  },
  rejected: {
    label: 'اعتذرنا هذه المرة',
    explain: 'لم نستطع المضيّ في طلبك حاليا. يمكنك التقديم مجددا بعد ستة أشهر بخبرة أو أدلة جديدة.',
    tone: 'bad',
  },
  withdrawn: {
    label: 'مسحوب',
    explain: 'سحبتَ طلبك. أهلا بك متى ما عدت — يمكنك التقديم من جديد.',
    tone: 'neutral',
  },
  suspended: {
    label: 'موقوف',
    explain: 'حسابك كمدرب موقوف حاليا. تواصل مع الإدارة للتفاصيل.',
    tone: 'bad',
  },
}

/** الحالاتُ التي ما زال فيها الطلبُ حيّا ويجوز لصاحبه سحبُه */
export const WITHDRAWABLE_STATUSES = [
  'draft', 'email_verification_pending', 'submitted', 'under_review', 'information_requested',
  'shortlisted', 'interview_scheduled', 'demo_requested', 'academic_review',
  'conditionally_approved', 'contract_pending', 'waitlisted',
] as const

/** الحالاتُ التي يُعرض فيها حجزُ المقابلة — والحدُّ من طرفَيه مقصود.

    لا قبلها: `draft` و`email_verification_pending` طلبٌ لم يصل بعد، فيُكمله
    أوّلا ولا يحجز موعدا لما لا يُقرأ.

    ولا بعدها: `interview_scheduled` موعدُه محجوزٌ فعلا — وزرُّ «احجز» فوقه
    يدعوه إلى حجزٍ ثانٍ. وما بعده (ديمو · مراجعة · عقد · نشط) مرّ المقابلةَ،
    و`rejected` و`withdrawn` انتهيا. */
export const BOOKABLE_STATUSES: readonly string[] = [
  'submitted', 'under_review', 'information_requested', 'shortlisted',
]

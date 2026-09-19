/* أين يذهب من قرأ الإشعار — وجهةُ كلِّ مفتاحِ قالب (ط-١).

   ═══ لماذا هذا ملفٌّ أصلا ═══

   رسائلُ الإشعارات كانت تخرج **نصّا خاما بلا رابطٍ واحد**: «وصلت درجتك»،
   ثمّ لا شيء. فيبقى على صاحبها أن يتذكّر عنوانَ المنصّة، ويفتحها، ويبحث عن
   الشاشة التي فيها خبرُه. والرسالةُ التي لا يُعمَل بها لا تُقرأ مرّتَين.

   ═══ وما يُشترط في الوجهة ═══

   ① **أن تكون مسارا قائما** — لا مخترَعا. وحارسٌ يقابل هذه المسارات بما في
      `App.tsx` فيسقط على وجهةٍ لا وجودَ لها. (وقد أُخترعت مساراتٌ في هذه
      المنصّة من قبلُ ومُرّرت لأنّ أحدا لم يقابلها بالمسارات الحقيقيّة.)
   ② **وأن تحمل الخبرَ نفسَه** — لا الصفحةَ الرئيسيّة. من أُصدرت شهادتُه
      يُفتح له «شهاداتي» لا لوحةُ حسابه.
   ③ **ونصُّ الزرِّ فعلٌ يقول ما سيجد** — لا «اضغط هنا»: من يقرأ في بريده
      لا يرى ما وراء الزرّ، فاسمُ الزرِّ هو كلُّ ما يعرفه قبل أن يضغط.

   ═══ ولمَ الجمهورُ جزءٌ من المفتاح ═══

   الجلسةُ الواحدةُ تُذكِّر المتعلّمَ والمدرّبَ، ولا تصلح وجهةٌ واحدةٌ لهما:
   المتعلّمُ يُفتح له «رحلتي» والمدرّبُ «جدولي». فلو كانت الوجهةُ بالمفتاح
   وحدَه لذهب أحدُهما إلى بوّابةٍ لا يملكها.

   و`staff.announce` أوضحُ: مفتاحٌ **واحدٌ** يصل الجمهورَين فعلا، ولكلٍّ
   شاشةُ إشعاراتِ بوّابته. */

/** جمهورُ الإشعار — نسخةٌ من `NotificationAudience` في الخادم */
export type MailAudience = 'learner' | 'trainer' | 'staff'

export interface MailDestination {
  /** مسارٌ نسبيٌّ في التطبيق — يبني الخادمُ المطلقَ منه */
  path: string
  /** نصُّ الزرّ: فعلٌ يقول ماذا سيجد */
  ctaAr: string
}

/** وجهةُ الجمهور الواحد لمفاتيحَ بعينها */
type Table = Record<string, MailDestination>

const LEARNER: Table = {
  /* رحلتي — جدولُ شعبه ووحداتُه وتسليماتُه وطلباتُه، كلُّها في شاشةٍ واحدة */
  'cohort.session.scheduled': { path: '/student/learning', ctaAr: 'افتح جدولَ شعبتك' },
  /* ي-٤: والرابطُ يُقرأ من الصفحة نفسِها التي فيها الموعد */
  'cohort.meeting.linked': { path: '/student/learning', ctaAr: 'افتح جدولَ شعبتك' },
  'cohort.schedule_changed': { path: '/student/learning', ctaAr: 'راجِع مواعيدَك' },
  'session.reminder': { path: '/student/learning', ctaAr: 'افتح جدولَ شعبتك' },
  'session.reminder.24h': { path: '/student/learning', ctaAr: 'افتح جدولَ شعبتك' },
  'session.reminder.1h': { path: '/student/learning', ctaAr: 'افتح جدولَ شعبتك' },
  'enrollment.approved': { path: '/student/learning', ctaAr: 'افتح رحلتك' },
  'enrollment.confirmed': { path: '/student/learning', ctaAr: 'افتح رحلتك' },
  'enrollment.rejected': { path: '/student/learning', ctaAr: 'افتح رحلتك' },
  'enrollment.waitlisted': { path: '/student/learning', ctaAr: 'افتح رحلتك' },
  'enrollment.switched': { path: '/student/learning', ctaAr: 'افتح جدولَ شعبتك الجديدة' },
  'enrollment.waitlist.promoted': { path: '/student/learning', ctaAr: 'افتح رحلتك' },
  'learner.request_decided': { path: '/student/learning', ctaAr: 'اقرأ قرارَ طلبك' },
  'plan.requested': { path: '/student/billing', ctaAr: 'افتح طلبَك' },
  'plan.seats_held': { path: '/student/billing', ctaAr: 'أكمِل حجزَ مقعدك' },
  /* التصحيحُ والدرجات — في «رحلتي» مع التسليم الذي صُحِّح */
  'submission.start_review': { path: '/student/learning', ctaAr: 'افتح تسليمك' },
  'submission.request_resubmit': { path: '/student/learning', ctaAr: 'أعِد تسليمك' },
  'submission.accept': { path: '/student/learning', ctaAr: 'افتح تسليمك' },
  'submission.reject': { path: '/student/learning', ctaAr: 'افتح تسليمك' },
  'grade.create': { path: '/student/learning', ctaAr: 'اقرأ درجتَك وملحوظاتِ مدرّبك' },
  'grade.update': { path: '/student/learning', ctaAr: 'اقرأ درجتَك المعدَّلة' },
  'payment.succeeded': { path: '/student/billing', ctaAr: 'افتح فاتورتك' },
  /* ي-٤: الردُّ وردُّ طلبِه كلاهما في «الفواتير» — الصفُّ نفسُه يحمل الخبر */
  'order.seats_held': { path: '/student/billing', ctaAr: 'أتمم الدفع' },
  'payment.refunded': { path: '/student/billing', ctaAr: 'افتح كشفَ فواتيرك' },
  'payment.refund_rejected': { path: '/student/billing', ctaAr: 'افتح فاتورتك' },
  'certificate.issued': { path: '/student/certificates', ctaAr: 'افتح شهادتك' },
  /* والملغاةُ تبقى معروضةً هناك بحالتها — فالوجهةُ تحمل الخبرَ لا تخفيه */
  'certificate.revoked': { path: '/student/certificates', ctaAr: 'افتح شهاداتك' },
  'staff.announce': { path: '/student/notifications', ctaAr: 'اقرأ الإعلان' },
  /* ن-٩: الخبرُ يحمل ما يجري بعده، و«رحلتي» فيها جدولُه وشعبتُه الجديدة */
  'departure.resolved': { path: '/student/learning', ctaAr: 'افتح رحلتك' },
  /* ي-٤: ومن أُسقط تسجيلُه — الوجهةُ «رحلتي»، وغيابُ الشعبة منها هو الخبر.
     وصنفُ `enrollment_change` لا يقبل مفتاحا بلا وجهة (حارسُ ن-١٠): تغييرٌ
     يمسّ مقعدَه يُفتح له بابٌ يرى فيه ما بقي له، لا رسالةٌ تُغلق عليه. */
  'enrollment.dropped': { path: '/student/learning', ctaAr: 'افتح رحلتك' },
  /* والاختيارُ يُنقر في بوّابته لا في البريد: البلاغُ يحمل الخيارَين ليُقرآ،
     والقرارُ يُكتب حيث تُعرف هويّةُ صاحبه. */
  'departure.choice': { path: '/student/learning', ctaAr: 'اختر ما يناسبك' },
}

const TRAINER: Table = {
  'trainer_payout': { path: '/trainer/earnings', ctaAr: 'افتح كشفَ مستحقّاتك' },
  'trainer.qualified': { path: '/trainer/qualifications', ctaAr: 'افتح مؤهّلاتك' },
  /* ي-٤: ملفُّه العامُّ يُحرَّر من صفحة حسابه — وهي ما يحمل الخبرَ نفسَه */
  'trainer.publish.approved': { path: '/trainer/account', ctaAr: 'راجِع ملفَّك العامّ' },
  /* والنطاقُ يُقرأ أثرُه في اقتراحاته: ما يجوز أن يمسَّه الاقتراح */
  'trainer.scope.granted': { path: '/trainer/course-proposals', ctaAr: 'افتح اقتراحاتك' },
  'trainer.scope.revoked': { path: '/trainer/course-proposals', ctaAr: 'افتح اقتراحاتك' },
  /* وسؤالُ الإدارة عن اقتراحه: الاقتراحُ واقفٌ على جوابه، وموضعُ الجواب هو
     موضعُ الخبر نفسُه — فالزرُّ يضعه حيث يجيب لا حيث يقرأ فيبحث. */
  'trainer.course_proposal.question': { path: '/trainer/course-proposals', ctaAr: 'أجِبْ عن السؤال' },
  'trainer.qualify.rejected': { path: '/trainer/qualifications', ctaAr: 'افتح مؤهّلاتك' },
  'trainer.assigned': { path: '/trainer/board', ctaAr: 'افتح شعبتك الجديدة' },
  'cohort.plan.submitted': { path: '/trainer/board', ctaAr: 'افتح خطّةَ شعبتك' },
  'cohort.plan.decision': { path: '/trainer/board', ctaAr: 'اقرأ قرارَ الخطّة' },
  /* ولقاءاتُ المدرّب المنتظِرةُ وقرارُها — وجهتُها لوحُه لا لوحُ الإدارة:
     `cohort.session.pending` يصل الإدارةَ، وشاشتُها شعبةُ اللقاء نفسِها. */
  'cohort.session.pending': { path: '/admin/cohorts', ctaAr: 'راجِع اللقاءَ واعتمِده' },
  'cohort.session.approved': { path: '/trainer/board', ctaAr: 'افتح لقاءاتِ شعبتك' },
  'cohort.session.rejected': { path: '/trainer/board', ctaAr: 'اقرأ الملاحظةَ وأعِد جدولتَه' },
  /* ومفاتيحُ تذكيرِ المدرّب غيرُ مفاتيحِ المتعلّم — `session.reminder.trainer.*`
     في `worker/jobs.ts`. وكنتُ كتبتُ هنا مفاتيحَ المتعلّم للمدرّب، فكانت
     أسطرا ميّتةً: لا يصل المدرّبَ `session.reminder.24h` أبدا، ولا وجهةَ
     لما يصله فعلا. وأمسكه الحارسُ ② حين قابل السجلَّ بالجداول. */
  'cohort.meeting.linked.trainer': { path: '/trainer/schedule', ctaAr: 'افتح جدولك' },
  'session.reminder.trainer.24h': { path: '/trainer/schedule', ctaAr: 'افتح جدولك' },
  'session.reminder.trainer.1h': { path: '/trainer/schedule', ctaAr: 'افتح جدولك' },
  'submission.queued': { path: '/trainer/grading', ctaAr: 'افتح طابورَ التصحيح' },
  /* عروضُ الإسناد — والوجهةُ حيث يُجاب لا حيث يُقرأ الخبر ثانيةً */
  'trainer.offer.received': { path: '/trainer/offers', ctaAr: 'اقرأ العرضَ وأجِبْ' },
  'trainer.offer.withdrawn': { path: '/trainer/offers', ctaAr: 'افتح عروضَك' },
  'trainer.offer.lapsed': { path: '/trainer/offers', ctaAr: 'افتح عروضَك' },
  'trainer.prep.reminder': { path: '/trainer/offers', ctaAr: 'أقِرّ بجاهزيّتك' },
}

const STAFF: Table = {
  'staff.task.assigned': { path: '/admin/tasks', ctaAr: 'افتح مهمّتك' },
  'staff.task.done': { path: '/admin/tasks', ctaAr: 'افتح المهامّ' },
  'admin.support.ticket': { path: '/admin/support', ctaAr: 'افتح التذكرة' },
  'admin.support_ticket': { path: '/admin/support', ctaAr: 'افتح التذكرة' },
  'admin.trainer_application': { path: '/admin/trainers', ctaAr: 'افتح طلبَ الانضمام' },
  /* وملخّصُ من لم يحجز — الشاشةُ نفسُها، وفيها مرشّحُ «لم يحجز موعدا» وزرُّ
     التذكير. فالزرُّ يضع قارئَه حيث يعمل لا حيث يقرأ الخبرَ ثانيةً. */
  'admin.trainer_unbooked': { path: '/admin/trainers', ctaAr: 'افتح طابورَ الطلبات' },
  'admin.learner_request': { path: '/admin/learner-requests', ctaAr: 'افتح طلبَ المتعلّم' },
  'trainer.qualify.request': { path: '/admin/trainers', ctaAr: 'افتح طلبَ التأهيل' },
  /* والعقدُ وُقّع أو اعتُذر عنه — وكلاهما ينتظر عملا في شاشة العقود:
     الموقَّعُ يُراجَع توقيعُه ويُفعَّل حسابُه، والمعتذَرُ عنه يُبحَث سببُه. */
  'trainer.contract.signed': { path: '/admin/trainer-contracts', ctaAr: 'راجِع التوقيعَ وفعّلْ حسابَه' },
  'trainer.contract.declined': { path: '/admin/trainer-contracts', ctaAr: 'اقرأ سببَ الاعتذار' },
  /* والعروضُ في شاشة العقود نفسِها: العرضُ فرعٌ عن عقدٍ نافذ، ومن يتابع
     الواحدَ يتابع الآخر — فلا تُفرَّق شاشتان لمسارٍ واحد. */
  'trainer.offer.accepted': { path: '/admin/trainer-contracts', ctaAr: 'افتح العروض' },
  'trainer.offer.declined': { path: '/admin/trainer-contracts', ctaAr: 'اقرأ سببَ الاعتذار' },
  'trainer.prep.lapsed': { path: '/admin/trainer-contracts', ctaAr: 'انظرْ وقرّر' },
  'advisor.case.assigned': { path: '/advisor/cases', ctaAr: 'افتح الحالة' },
  /* ي-٤: وشاشةُ الرحيل فيها زرُّ «نفِّذ ما اختاره» — الوجهةُ تحمل الفعلَ لا الخبرَ وحدَه */
  'departure.chosen': { path: '/admin/trainer-departures', ctaAr: 'نفِّذ ما اختاره' },
  'staff.announce': { path: '/admin/notifications', ctaAr: 'اقرأ الإعلان' },
  'cohort.plan.submitted': { path: '/admin/cohorts', ctaAr: 'راجِع خطّةَ الشعبة' },
}

const BY_AUDIENCE: Record<MailAudience, Table> = {
  learner: LEARNER,
  trainer: TRAINER,
  staff: STAFF,
}

/** كلُّ ما تحمله الجداولُ من مسارات — يقابلها الحارسُ بمسارات `App.tsx` */
export function allDestinationPaths(): string[] {
  return [...new Set(Object.values(BY_AUDIENCE).flatMap((t) => Object.values(t).map((d) => d.path)))]
}

/** وجهةُ هذا الإشعار لهذا الجمهور — أو `null` فتخرج الرسالةُ بلا زرّ.
 *
 *  ولا وجهةَ مخترَعةٌ عند الجهل: زرٌّ يُفتح على شاشةٍ لا خبرَ فيها أسوأُ من
 *  رسالةٍ بلا زرّ — الأوّلُ يُضيّع وقتَ صاحبه ويُفقده الثقةَ بالأزرار. */
export function destinationFor(
  templateKey: string | null | undefined,
  audience: MailAudience,
): MailDestination | null {
  if (!templateKey) return null
  return BY_AUDIENCE[audience][templateKey] ?? null
}

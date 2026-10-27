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
  'cohort.session.scheduled': { path: '/student/learning', ctaAr: 'افتح جدول شعبتك' },
  /* ي-٤: والرابطُ يُقرأ من الصفحة نفسِها التي فيها الموعد */
  'cohort.meeting.linked': { path: '/student/learning', ctaAr: 'افتح جدول شعبتك' },
  'cohort.schedule_changed': { path: '/student/learning', ctaAr: 'راجع مواعيدك' },
  'session.reminder': { path: '/student/learning', ctaAr: 'افتح جدول شعبتك' },
  'session.reminder.24h': { path: '/student/learning', ctaAr: 'افتح جدول شعبتك' },
  'session.reminder.1h': { path: '/student/learning', ctaAr: 'افتح جدول شعبتك' },
  /* ٢(ب-٣): ما يُفتح على خطّ المحاور — والخطُّ نفسُه في «الدروس» من رحلتي */
  'timeline.slot_opened': { path: '/student/learning', ctaAr: 'افتح موعدك' },
  'timeline.tasks_opened': { path: '/student/learning', ctaAr: 'افتح الواجبات' },
  'timeline.due_soon': { path: '/student/learning', ctaAr: 'سلّم قبل موعده' },
  'enrollment.approved': { path: '/student/learning', ctaAr: 'افتح رحلتك' },
  'enrollment.confirmed': { path: '/student/learning', ctaAr: 'افتح رحلتك' },
  'enrollment.rejected': { path: '/student/learning', ctaAr: 'افتح رحلتك' },
  'enrollment.waitlisted': { path: '/student/learning', ctaAr: 'افتح رحلتك' },
  'enrollment.switched': { path: '/student/learning', ctaAr: 'افتح جدول شعبتك الجديدة' },
  'enrollment.waitlist.promoted': { path: '/student/learning', ctaAr: 'افتح رحلتك' },
  'learner.request_decided': { path: '/student/learning', ctaAr: 'اقرأ قرار طلبك' },
  /* وكان هنا `plan.requested` إلى «فواتيري» بـ«افتح طلبك» — ولا فاتورةَ قبل أن تُحجز المقاعد، فيفتح
     المتعلّمُ صفحةً تقول «لا طلبات بعد». فلا بابَ له حتّى يُحجز (`plan.seats_held`) — ١٩ أكتوبر ٢٠٢٦ */
  'plan.seats_held': { path: '/student/billing', ctaAr: 'أكمل حجز مقعدك' },
  /* التصحيحُ والدرجات — في «رحلتي» مع التسليم الذي صُحِّح */
  'submission.start_review': { path: '/student/learning', ctaAr: 'افتح تسليمك' },
  'submission.request_resubmit': { path: '/student/learning', ctaAr: 'أعد تسليمك' },
  'submission.accept': { path: '/student/learning', ctaAr: 'افتح تسليمك' },
  'submission.reject': { path: '/student/learning', ctaAr: 'افتح تسليمك' },
  'grade.create': { path: '/student/learning', ctaAr: 'اقرأ درجتك وملحوظات مدرّبك' },
  'grade.update': { path: '/student/learning', ctaAr: 'اقرأ درجتك المعدّلة' },
  'payment.succeeded': { path: '/student/billing', ctaAr: 'افتح فاتورتك' },
  /* ي-٤: الردُّ وردُّ طلبِه كلاهما في «الفواتير» — الصفُّ نفسُه يحمل الخبر */
  'order.seats_held': { path: '/student/billing', ctaAr: 'أتمم الدفع' },
  'payment.refunded': { path: '/student/billing', ctaAr: 'افتح كشف فواتيرك' },
  /* والخبرُ يقول «راسل الدعم إن كان لديك ما تضيفه» — فبابُه الدعمُ لا الفاتورة (١٩ أكتوبر ٢٠٢٦) */
  'payment.refund_rejected': { path: '/student/support', ctaAr: 'راسل الدعم' },
  /* وردُّ الدعم يفتح تذكرتَه — والردُّ كاملا هناك (٢٠ أكتوبر ٢٠٢٦) */
  'support.reply': { path: '/student/support', ctaAr: 'اقرأ الرد' },
  'certificate.issued': { path: '/student/certificates', ctaAr: 'افتح شهادتك' },
  /* وخطابُ التوصية تحت شهادته هناك، ومنه يفتحه ويطبعه (٢٢ أكتوبر ٢٠٢٦) */
  'certificate.endorsed': { path: '/student/certificates', ctaAr: 'افتح خطابك' },
  /* والملغاةُ تبقى معروضةً هناك بحالتها — فالوجهةُ تحمل الخبرَ لا تخفيه */
  'certificate.revoked': { path: '/student/certificates', ctaAr: 'افتح شهاداتك' },
  'staff.announce': { path: '/student/inbox', ctaAr: 'اقرأ الإعلان' },
  /* ن-٩: الخبرُ يحمل ما يجري بعده، و«رحلتي» فيها جدولُه وشعبتُه الجديدة */
  'departure.resolved': { path: '/student/learning', ctaAr: 'افتح رحلتك' },
  /* ي-٤: ومن أُسقط تسجيلُه — الوجهةُ «رحلتي»، وغيابُ الشعبة منها هو الخبر.
     وصنفُ `enrollment_change` لا يقبل مفتاحا بلا وجهة (حارسُ ن-١٠): تغييرٌ
     يمسّ مقعدَه يُفتح له بابٌ يرى فيه ما بقي له، لا رسالةٌ تُغلق عليه. */
  'enrollment.dropped': { path: '/student/learning', ctaAr: 'افتح رحلتك' },
  /* والشعبةُ الملغاةُ بابُها الدعم: النقلُ أو الردُّ يقرّره إنسان (١٩ أكتوبر ٢٠٢٦) */
  'cohort.cancelled': { path: '/student/support', ctaAr: 'راسل الدعم' },
  /* وعادت بعد إلغائها — موعدُها في «رحلتي» (٢٤ أكتوبر ٢٠٢٦) */
  'cohort.reopened': { path: '/student/learning', ctaAr: 'افتح رحلتك' },
  /* والاختيارُ يُنقر في بوّابته لا في البريد: البلاغُ يحمل الخيارَين ليُقرآ،
     والقرارُ يُكتب حيث تُعرف هويّةُ صاحبه. */
  'departure.choice': { path: '/student/learning', ctaAr: 'اختر ما يناسبك' },
}

const TRAINER: Table = {
  'trainer_payout': { path: '/trainer/earnings', ctaAr: 'افتح كشف مستحقّاتك' },
  'trainer.qualified': { path: '/trainer/qualifications', ctaAr: 'افتح دوراتك' },
  /* وتفعيلُه — بوّابتُه كاملةً، ومنها «عقدي» و«مستحقّاتي» (٣ أكتوبر ٢٠٢٦) */
  'trainer.activated': { path: '/trainer', ctaAr: 'افتح بوّابتك' },
  /* ي-٤: ملفُّه العامُّ يُحرَّر من صفحة حسابه — وهي ما يحمل الخبرَ نفسَه */
  'trainer.publish.approved': { path: '/trainer/account', ctaAr: 'راجع ملفّك العامّ' },
  /* والنطاقُ يُقرأ أثرُه في اقتراحاته: ما يجوز أن يمسَّه الاقتراح */
  'trainer.scope.granted': { path: '/trainer/course-proposals', ctaAr: 'افتح اقتراحاتك' },
  'trainer.scope.revoked': { path: '/trainer/course-proposals', ctaAr: 'افتح اقتراحاتك' },
  /* وسؤالُ الإدارة عن اقتراحه: الاقتراحُ واقفٌ على جوابه، وموضعُ الجواب هو
     موضعُ الخبر نفسُه — فالزرُّ يضعه حيث يجيب لا حيث يقرأ فيبحث. */
  'trainer.course_proposal.question': { path: '/trainer/course-proposals', ctaAr: 'أجب عن السؤال' },
  'trainer.qualify.rejected': { path: '/trainer/qualifications', ctaAr: 'افتح دوراتك' },
  'trainer.assigned': { path: '/trainer/board', ctaAr: 'افتح شعبتك الجديدة' },
  /* والملغاةُ تسقط من «شعبي» — فالوجهةُ ما بقي له من شعب (٢٢ أكتوبر ٢٠٢٦) */
  'cohort.cancelled.trainer': { path: '/trainer/board', ctaAr: 'افتح شعبك' },
  'cohort.reopened.trainer': { path: '/trainer/board', ctaAr: 'افتح شعبك' },
  /* واقتراحُ التأجيل بطاقةٌ في «شعبي» يقبلها أو لا (٢٤ أكتوبر ٢٠٢٦) */
  'cohort.postpone.proposed': { path: '/trainer/board', ctaAr: 'افتح الاقتراح' },
  'cohort.plan.submitted': { path: '/trainer/board', ctaAr: 'افتح خطّة شعبتك' },
  'cohort.plan.decision': { path: '/trainer/board', ctaAr: 'اقرأ قرار الخطّة' },
  'cohort.schedule.proposed': { path: '/trainer/board', ctaAr: 'افتح الاقتراح' },
  /* وقرارُ الإدارة في لقاءاته — وجهتُه لوحُه لا لوحُ الإدارة. و`cohort.session.pending` يصل الإدارةَ، فوجهتُه في
     جدول الفريق أدناه (كانت هنا فخرج إليها بلا زرّ — ١٩ أكتوبر ٢٠٢٦). */
  'cohort.session.approved': { path: '/trainer/board', ctaAr: 'افتح لقاءات شعبتك' },
  'cohort.session.rejected': { path: '/trainer/board', ctaAr: 'اقرأ الملاحظة وأعد جدولته' },
  /* وقرارُ الإدارة في مهمّته بعد الاعتماد (٣ج-٣) — مهامُّه في شعبته من لوحه */
  'cohort.assessment.decision': { path: '/trainer/board', ctaAr: 'افتح مهامّ شعبتك' },
  /* ومفاتيحُ تذكيرِ المدرّب غيرُ مفاتيحِ المتعلّم — `session.reminder.trainer.*`
     في `worker/jobs.ts`. وكنتُ كتبتُ هنا مفاتيحَ المتعلّم للمدرّب، فكانت
     أسطرا ميّتةً: لا يصل المدرّبَ `session.reminder.24h` أبدا، ولا وجهةَ
     لما يصله فعلا. وأمسكه الحارسُ ② حين قابل السجلَّ بالجداول. */
  'cohort.meeting.linked.trainer': { path: '/trainer/schedule', ctaAr: 'افتح جدولك' },
  'session.reminder.trainer.24h': { path: '/trainer/schedule', ctaAr: 'افتح جدولك' },
  'session.reminder.trainer.1h': { path: '/trainer/schedule', ctaAr: 'افتح جدولك' },
  'submission.queued': { path: '/trainer/grading', ctaAr: 'افتح طابور التصحيح' },
  /* عروضُ الإسناد — والوجهةُ حيث يُجاب لا حيث يُقرأ الخبر ثانيةً */
  'trainer.offer.received': { path: '/trainer/qualifications', ctaAr: 'اقرأ العرض وأجب' },
  'trainer.offer.withdrawn': { path: '/trainer/qualifications', ctaAr: 'افتح دوراتك' },
  'trainer.offer.lapsed': { path: '/trainer/qualifications', ctaAr: 'افتح دوراتك' },
  'trainer.prep.reminder': { path: '/trainer/qualifications', ctaAr: 'أقرّ بجاهزيّتك' },
  /* والملصقُ يُوافَق عليه حيث يُرى — قسمُ التسويق */
  'trainer.poster.submitted': { path: '/trainer/marketing', ctaAr: 'راجع الملصق ووافق عليه' },
  /* وإعلانُ الإدارة (٤ أكتوبر ٢٠٢٦) — كان يُفتح في نافذته فوق بوّابته (`?announcement=`). وصار يُفتح في
     لسان «الرسائل» من «الرسائل والتنبيهات» (٢١ أكتوبر ٢٠٢٦): يُقرأ كاملا ويُردّ عليه (`?m=` أدناه) */
  'trainer.announcement': { path: '/trainer/inbox', ctaAr: 'اقرأ الإعلان' },
  /* وما نقترحه على بطاقته — يُقرَّر في إعدادات حسابه، ويُرى في صفحة المدرّبين حين نعتمد تعديله */
  'trainer.suggestion.proposed': { path: '/trainer/account', ctaAr: 'افتح الاقتراح' },
  'trainer.suggestion.edit_approved': { path: '/trainers', ctaAr: 'شاهد بطاقتك' },
  /* ═══ وخمسةٌ كانت في جدول الفريق (١٩ أكتوبر ٢٠٢٦) ═══
     تُرسَل إلى المدرّب (`audience: 'trainer'`)، ووجهاتُها في جدول `STAFF` — فخرجت إليه بلا زرّ: الوجهةُ تُقرأ
     من جدول جمهورها وحدَه (`destinationFor`). */
  'trainer.public_text.approved': { path: '/trainer/account', ctaAr: 'افتح إعدادات الحساب' },
  'trainer.public_text.rejected': { path: '/trainer/account', ctaAr: 'عدّل نبذتك' },
  'trainer.contract.materials_returned': { path: '/trainer', ctaAr: 'اقرأ الملاحظات وعدّل' },
  'trainer.contract.condition_extended': { path: '/trainer', ctaAr: 'افتح بوّابتك' },
  'trainer.contract.condition_days_granted': { path: '/trainer/board', ctaAr: 'افتح «شعبي»' },
}

const STAFF: Table = {
  'staff.task.assigned': { path: '/admin/tasks', ctaAr: 'افتح مهمّتك' },
  'trainer.poster.decided': { path: '/admin/trainer-marketing', ctaAr: 'افتح ملصقات المدرّب' },
  'staff.task.done': { path: '/admin/tasks', ctaAr: 'افتح المهامّ' },
  'admin.support.ticket': { path: '/admin/support', ctaAr: 'افتح التذكرة' },
  'admin.support_ticket': { path: '/admin/support', ctaAr: 'افتح التذكرة' },
  'admin.contact_message': { path: '/admin/support', ctaAr: 'افتح رسائل الموقع' },
  'admin.trainer_application': { path: '/admin/trainers', ctaAr: 'افتح طلب الانضمام' },
  /* وطلبُ الانضمام مستشارا (٢٧ أكتوبر ٢٠٢٦) — طابورُه حيث يُقبل بنسبته أو يُعتذر له */
  'admin.advisor_application': { path: '/admin/advisor-applications', ctaAr: 'افتح طلبات الانضمام' },
  /* وملخّصُ من لم يحجز — الشاشةُ نفسُها، وفيها مرشّحُ «لم يحجز موعدا» وزرُّ
     التذكير. فالزرُّ يضع قارئَه حيث يعمل لا حيث يقرأ الخبرَ ثانيةً. */
  'admin.trainer_unbooked': { path: '/admin/trainers', ctaAr: 'افتح طابور الطلبات' },
  /* والمؤجَّلُ إلى الفصول القادمة — حلّ موعدُه أو أجاب: الطابورُ وفيه شارتُه */
  'admin.trainer_deferral': { path: '/admin/trainers', ctaAr: 'افتح طابور الطلبات' },
  'admin.learner_request': { path: '/admin/learner-requests', ctaAr: 'افتح طلب المتعلّم' },
  /* وطلبُ التأهيل يُبتّ فيه في «المدربون» (`TrainerRunOps`) — لا في «الطلبات» التي كان يفتحها (٢٤ أكتوبر ٢٠٢٦) */
  'trainer.qualify.request': { path: '/admin/trainer-run', ctaAr: 'افتح طلب التأهيل' },
  /* والعقدُ وُقّع أو اعتُذر عنه — وكلاهما ينتظر عملا في شاشة العقود:
     الموقَّعُ يُراجَع توقيعُه ويُفعَّل حسابُه، والمعتذَرُ عنه يُبحَث سببُه. */
  'trainer.contract.signed': { path: '/admin/trainer-contracts', ctaAr: 'راجع التوقيع وفعّل حسابه' },
  'trainer.contract.declined': { path: '/admin/trainer-contracts', ctaAr: 'اقرأ سبب الاعتذار' },
  'trainer.contract.materials_declared': { path: '/admin/trainer-contracts', ctaAr: 'قيّم موادّه' },
  'trainer.prep.declined': { path: '/admin/trainer-contracts', ctaAr: 'افتح عقود المدرّبين' },
  'trainer.prep.nothing_pending': { path: '/admin/trainer-contracts', ctaAr: 'افتح عقود المدرّبين' },
  'trainer.prep.activation_blocked': { path: '/admin/trainer-contracts', ctaAr: 'افتح عقود المدرّبين' },
  'trainer.prep.seal_blocked': { path: '/admin/trainer-contracts', ctaAr: 'افتح عقود المدرّبين' },
  'trainer.public_text.submitted': { path: '/admin/trainer-run', ctaAr: 'اقرأ النبذة واعتمدها' },
  'trainer.suggestion.edited': { path: '/admin/trainer-run', ctaAr: 'راجع التعديل واعتمده' },
  'trainer.suggestion.accepted': { path: '/admin/trainer-run', ctaAr: 'افتح تشغيل المدربين' },
  'trainer.suggestion.rejected': { path: '/admin/trainer-run', ctaAr: 'اقرأ سبب الرفض' },
  'trainer.data_choice.made': { path: '/admin/trainer-contracts', ctaAr: 'افتح عقود المدرّبين' },
  'trainer.contract.amendment_requested': { path: '/admin/trainer-contracts', ctaAr: 'اقرأ ما طلب تعديله' },
  'trainer.contract.name_correction_requested': { path: '/admin/trainer-contracts', ctaAr: 'طابق هويّته وأعده مصحّحا' },
  /* والمحذوفُ لا صفَّ له يُفتح — فالوجهةُ القائمةُ نفسُها */
  'trainer.contract.deleted': { path: '/admin/trainer-contracts', ctaAr: 'افتح العقود' },
  /* والعروضُ في شاشة العقود نفسِها: العرضُ فرعٌ عن عقدٍ نافذ، ومن يتابع
     الواحدَ يتابع الآخر — فلا تُفرَّق شاشتان لمسارٍ واحد. */
  'trainer.offer.accepted': { path: '/admin/trainer-contracts', ctaAr: 'افتح العروض' },
  'trainer.offer.declined': { path: '/admin/trainer-contracts', ctaAr: 'اقرأ سبب الاعتذار' },
  'trainer.prep.lapsed': { path: '/admin/trainer-contracts', ctaAr: 'انظر وقرّر' },
  'advisor.case.assigned': { path: '/advisor/cases', ctaAr: 'افتح الحالة' },
  /* وعميلُه أنشأ حسابه — في الحالة نفسِها يُقرأ تقدّمُه (١٨ أكتوبر ٢٠٢٦) */
  'advisor.case.client_linked': { path: '/advisor/cases', ctaAr: 'افتح الحالة' },
  /* وعميلُه دفع — الحالةُ نفسُها، وقد صارت «سجّل» (١٩ أكتوبر ٢٠٢٦) */
  'advisor.case.client_paid': { path: '/advisor/cases', ctaAr: 'افتح الحالة' },
  /* وحالةٌ لا مستشارَ نشطا يستلمها — في طابورها حيث تُسند (١٩ أكتوبر ٢٠٢٦) */
  'advisor.case.no_advisor': { path: '/admin/exceptions', ctaAr: 'افتح حالات بلا مستشار' },
  /* وحالةٌ لم يسجّل مستشارُها تواصلا: يومٌ فتذكيرُه، ويومان فخبرُ من يُسند — ومتابعةٌ حلّ موعدُها (١٩ أكتوبر ٢٠٢٦) */
  'advisor.case.no_contact': { path: '/advisor/cases', ctaAr: 'افتح الحالة' },
  'advisor.case.uncontacted': { path: '/admin/exceptions', ctaAr: 'افتح القائمة' },
  'advisor.followup.due': { path: '/advisor/cases', ctaAr: 'افتح الحالة' },
  /* وحالتان لطالبٍ واحد — في «حالات بلا مستشار» حيث تُدمجان (`mergeCases`) */
  'advisor.case.duplicate': { path: '/admin/exceptions', ctaAr: 'ادمج الحالتين' },
  /* وكشفُ عمولته — في «عمولتي» حيث يُقرأ ببنوده (`advisor-payout.service.ts`) */
  'advisor_payout': { path: '/advisor/earnings', ctaAr: 'افتح كشف عمولتك' },
  /* ي-٤: وشاشةُ الرحيل فيها زرُّ «نفِّذ ما اختاره» — الوجهةُ تحمل الفعلَ لا الخبرَ وحدَه */
  'departure.chosen': { path: '/admin/trainer-departures', ctaAr: 'نفّذ ما اختاره' },
  'staff.announce': { path: '/admin/notifications', ctaAr: 'اقرأ الإعلان' },
  /* وخطّةٌ أُرسلت — في «خططٌ تنتظر اعتمادك» حيث تُقرأ كاملةً ويُقرَّر فيها، لا في
     قائمة الشعب يُبحث فيها عن بطاقتها (٣ أكتوبر ٢٠٢٦). والجرسُ يفتحها مبسوطةً
     بشعبتها (`notificationHref`) */
  'cohort.plan.submitted': { path: '/admin/pending-plans', ctaAr: 'اقرأ الخطّة وقرّر' },
  /* ومهامُّ ما بعد الاعتماد تنتظر في بطاقة الشعبة نفسِها (٣ج-٣) */
  'cohort.assessment.pending': { path: '/admin/cohorts', ctaAr: 'راجع المهامّ واعتمدها' },
  /* ولقاءُ مدرّبٍ ينتظر الاعتماد — شاشتُه شعبةُ اللقاء نفسِها (`notifyAdminsOfPendingSession`) */
  'cohort.session.pending': { path: '/admin/cohorts', ctaAr: 'راجع اللقاء واعتمده' },
}

const BY_AUDIENCE: Record<MailAudience, Table> = {
  learner: LEARNER,
  trainer: TRAINER,
  staff: STAFF,
}

/* ═══ وقرارُ الخطّة يفتح شعبتَها نفسَها (١١ أكتوبر ٢٠٢٦) ═══

   كان جرسُ القرار يفتح «شعبي» فيبحث المدرّبُ عن شعبته بيده — وقال صاحبُ المنصّة: «اجعلها…
   تقود للصفحة المسؤولة». فالجرسُ يفتح صفحةَ الشعبة (`/trainer/cohort/:id` بمعرّفها من بيانات
   الإشعار)، وعلى خطوتها إن حملت البياناتُ خطوة (`step`: الردُّ على «المراجعة»). والجدولُ أعلاه
   باقٍ وجهةً للبريد ولما لا معرّفَ فيه. */
const ROUTE_FROM_DATA: Partial<Record<MailAudience, Record<string, { route: string; field: string; ctaAr: string }>>> = {
  /* ═══ وخبرُ طلب الانضمام يفتح ملفَّ صاحبه (٢٤ أكتوبر ٢٠٢٦) ═══
     «طلبُ انضمامٍ جديد» و«حلّ موعدُ التواصل مع مؤجَّل» يحملان معرّفَ الطلب — فالجرسُ يفتح ملفَّه
     (`/admin/trainers/:id`) لا أوّلَ الطابور. والبريدُ على الجدول كما كان. */
  staff: {
    'admin.trainer_application': { route: '/admin/trainers/:id', field: 'applicationId', ctaAr: 'افتح ملفه' },
    'admin.trainer_deferral': { route: '/admin/trainers/:id', field: 'applicationId', ctaAr: 'افتح ملفه' },
  },
  trainer: {
    'cohort.plan.decision': { route: '/trainer/cohort/:id', field: 'cohortId', ctaAr: 'افتح شعبتك' },
    /* والموعدُ المقترحُ بلا تعارض بطاقةٌ في «المراجعة» — والخطوةُ في بياناته (`term-clash.service.ts`) */
    'cohort.schedule.proposed': { route: '/trainer/cohort/:id', field: 'cohortId', ctaAr: 'افتح الاقتراح' },
  },
}
/** اسمُ الزرّ حين يفتح خطوةً بعينها — يقول ما سيجد */
const STEP_CTA_AR: Record<string, string> = { review: 'افتح «المراجعة»' }
const STEP_RE = /^[a-z]+$/

const field = (data: unknown, key: string): string | null => {
  const v = data && typeof data === 'object' ? (data as Record<string, unknown>)[key] : null
  return typeof v === 'string' && v ? v : null
}

/** كلُّ ما تحمله الجداولُ من مسارات — يقابلها الحارسُ بمسارات `App.tsx` */
export function allDestinationPaths(): string[] {
  return [...new Set([
    ...Object.values(BY_AUDIENCE).flatMap((t) => Object.values(t).map((d) => d.path)),
    ...Object.values(ROUTE_FROM_DATA).flatMap((t) => Object.values(t ?? {}).map((d) => d.route)),
  ])]
}

/* ═══ والجرسُ يفتح الخبرَ نفسَه لا قائمتَه (٣ أكتوبر ٢٠٢٦) ═══

   كانت بنودُ الجرس نصّا يُعلَّم مقروءا ولا يُفتح — والوجهاتُ هنا للبريد وحدَه.
   فمن قرأ «خطّةُ شعبةٍ بانتظار اعتمادك» بحث عنها بيده. فصار البندُ رابطا إلى
   وجهته، ولمفاتيحَ بعينها تحمل في بياناتها **أيَّ شيءٍ** هي: الخطّةُ تُفتح
   مبسوطةً في طابورها (`?cohort=`، `PendingPlans.tsx`) لا أوّلَ الطابور.

   والمسارُ هو هو من الجدول — فحارسُ «لا وجهةَ مخترَعة» يقرؤه كما كان، وما
   يُضاف هنا معاملٌ لا مسار. */
const QUERY_FROM_DATA: Partial<Record<MailAudience, Record<string, { param: string; field: string }>>> = {
  staff: { 'cohort.plan.submitted': { param: 'cohort', field: 'cohortId' } },
  trainer: { 'trainer.announcement': { param: 'm', field: 'announcementId' } },
}

export function notificationHref(
  templateKey: string | null | undefined,
  audience: MailAudience,
  data: unknown,
): string | null {
  const dest = destinationFor(templateKey, audience)
  if (!dest) return null
  const r = ROUTE_FROM_DATA[audience]?.[templateKey ?? '']
  const id = r ? field(data, r.field) : null
  if (r && id) {
    const step = field(data, 'step')
    return `${r.route.replace(':id', encodeURIComponent(id))}${step && STEP_RE.test(step) ? `?step=${step}` : ''}`
  }
  const q = QUERY_FROM_DATA[audience]?.[templateKey ?? '']
  const v = q && data && typeof data === 'object' ? (data as Record<string, unknown>)[q.field] : null
  return q && typeof v === 'string' && v ? `${dest.path}?${q.param}=${encodeURIComponent(v)}` : dest.path
}

/** اسمُ باب البند في الجرس — كاسم زرّ البريد، إلّا أن يفتح شعبةً بعينها أو خطوةً منها */
export function notificationCtaAr(templateKey: string | null | undefined, audience: MailAudience, data: unknown): string | null {
  const dest = destinationFor(templateKey, audience)
  if (!dest) return null
  const r = ROUTE_FROM_DATA[audience]?.[templateKey ?? '']
  if (!r || !field(data, r.field)) return dest.ctaAr
  const step = field(data, 'step')
  return (step && STEP_CTA_AR[step]) || r.ctaAr
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

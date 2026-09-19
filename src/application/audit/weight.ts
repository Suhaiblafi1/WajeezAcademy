/* وزنُ الفعل — أيستحقّ أن يصل صاحبَه في بريده؟ (ي-١)

   ═══ لماذا صفةٌ في الفعل لا قائمةٌ إلى جانبه ═══

   لو كُتبت قائمةٌ بما يُرسَل بريدا، لَأُضيف الفعلُ الحادي والأربعون بعد
   المئتين في شهرٍ قادمٍ **ولم يُرسل لأحد** — ولا شيءَ يُنبّه: القائمةُ لا
   تعرف أنّها نقصت. فالوزنُ صفةٌ يحملها الفعلُ نفسُه، وحارسٌ يُحمّر البوّابةَ
   على فعلٍ بلا وزن.

   وهو الدرسُ نفسُه الذي دفعته هذه المنصّةُ في معجم الأسماء: حارسٌ يقرأ موضعا
   خطأً مرّ تحته أربعةٌ وعشرون فعلا بلا اسمٍ عربيّ.

   ═══ والقسمةُ قرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦) ═══

   • `high` — تغيّر وصولُه أو مكانتُه أو مالُه أو سجلُّه. **يُرسَل دائما ولا
     يُكتَم**: لا يُعقل أن يُمنع إنسانٌ من أن يُخبَر بإيقاف حسابه.

   • `medium` — يُرسَل ويحترم تفضيلاتِه، ويصحّ جمعُه في خبرٍ يوميّ.

   • `low` — في المنتَج وحدَه. عملٌ يغيّر النظامَ لا الإنسان: حفظُ خطّةٍ،
     ومزامنةُ حالات، وإعدادُ تكامل.

   ═══ وما لا يقوله هذا الملفّ ═══

   **لمن يصل الخبر.** وهو سؤالٌ لا جوابَ له في بيانات الأثر اليوم: `actorId`
   هو الفاعلُ لا المعنيّ (من أوقف الحسابَ غيرُ صاحبه)، و`entityType: 'user'`
   لا يقع إلّا في اثنَين وعشرين موضعا من نحو مئتَين وثلاثين — وفيها ما يكتب
   في `entityId` معرّفَ **دفعةٍ** لا معرّفَ إنسان.

   فالمرسَلُ إليه بندٌ قائمٌ بذاته (ي-٣) يحتاج بيانا جديدا، ولا يُخمَّن هنا:
   وزنٌ صادقٌ ومرسَلٌ إليه مخمَّنٌ يوصل خبرَ إيقافِ حسابٍ إلى الشخص الخطأ. */

export type AuditWeight = 'high' | 'medium' | 'low'

/* ═══ يُخبَر صاحبُه دائما — ولا يملك كتمَه ═══

   تغيّر وصولُه أو مكانتُه أو مالُه أو سجلُّه. */
const HIGH: readonly string[] = [
  /* الحساب: وجودُه ودخولُه */
  'admin.user.create', 'admin.user.suspend', 'admin.user.reinstate',
  'admin.user.archive', 'admin.user.unarchive',
  'admin.user.purge', 'admin.user.purge_with_history', 'admin.users.purge_bulk',
  'accounts.reset_purge', 'accounts.reset_archive',
  /* ما يملكه من صلاحيّة */
  'roles.set', 'admin.permission.grant', 'admin.permission.deny', 'admin.permission.clear',
  'auth.founder.promoted',
  /* مكانتُه مدرّبا */
  'trainer.suspend', 'trainer.reinstate', 'trainer.publish_approve',
  'trainer.qualify', 'trainer.qualify.reject',
  'trainer.approved.notify', 'trainer.info_requested.notify',
  'trainer.status.transition', 'trainer.contract.sign',
  'trainer.account.activate', 'trainer.invitation.create',
  'trainer.scope.grant', 'trainer.scope.revoke',
  /* شعبةٌ أُسندت إليه */
  'cohort.trainer.assign', 'cohort.trainer_update',
  /* تسجيلُه: دخولُه شعبةً أو خروجُه منها */
  'enrollment.create', 'enrollment.drop', 'enrollment.switch_cohort',
  'enrollment.waitlist.promote',
  'enrollment_request.approve', 'enrollment_request.reject',
  /* مالُه — يُقبض منه أو يُردّ إليه */
  'payment.charge', 'payment.record_manual',
  'refund.process', 'refund.reject',
  'order.checkout', 'order.cancel', 'order.settle_partial',
  'trainer_payout.create', 'trainer_payout.generate',
  'trainer_payout.approve', 'trainer_payout.pay', 'trainer_payout.cancel',
  /* شهادتُه — دعوى مستقلّةٌ على صاحبها */
  'certificate.issue', 'certificate.revoke',
  /* خطّةُ شعبته: اعتُمدت أو رُدّت */
  'cohort.plan.approve', 'cohort.plan.changes_requested',
  /* رابطُ اللقاء نُشر، والجلسةُ تحرّكت */
  'zoom.create_api', 'zoom.attach_manual',
  'session.reschedule.approve', 'session.reschedule.reject',
  /* ═══ وعملُه قُرئ وقُوّم — والمنصّةُ قرّرت هذا قبلنا ═══

     قسمةُ صاحب المنصّة لم تسمّ التصحيحَ في العالية، وكنتُ صنّفتُه متوسّطا
     على ظاهر اللفظ. ثمّ تبيّن أنّ صنفَ «تصحيحُ عملي» في الإشعارات
     `silenceable: false` **بسببٍ مكتوب**: «أعد التسليم» يحمل مهلةً —
     وكتمُه يُضيّع مهلةً لا خبرا. والدرجةُ يُبنى عليها إكمالُ المسار.

     فمتوسّطٌ هنا يعني «يحترم تفضيلاتِه»، وهناك لا يملك كتمَه — تناقضٌ يُشحَن.
     والقسمةُ نفسُها تقول «أو سجلُّه»، والدرجةُ سجلُّه. فرُفعت، وهذا قرارٌ
     قائمٌ في المنتَج لا اجتهادٌ عليه. */
  'grade.create', 'grade.update',
  'submission.start_review', 'submission.accept',
  'submission.reject', 'submission.request_resubmit',

  /* وكذلك «عملي في الأكاديمية» — لا يُكتم، فالمهمّةُ المسنَدةُ واجبٌ لا خبر */
  'staff.task.assign', 'staff.notify',
  'trainer.qualify.request',

  /* رحيلُ مدرّبه — وهو ما يمسّ ما اشتراه */
  'trainer.departure.offer_choice', 'trainer.departure.learner_choice',
  'trainer.departure.substitute', 'trainer.departure.move',
  'trainer.departure.credit', 'trainer.departure.refund_requested',
  'trainer.departure.notify',
]

/* ═══ يُرسَل ويحترم تفضيلاتِه — ويصحّ جمعُه في خبرٍ يوميّ ═══ */
const MEDIUM: readonly string[] = [
  /* مؤهّلٌ أُضيف، وإتاحةٌ تغيّرت */
  'trainer.qualify.auto',
  'trainer.availability.set', 'trainer.blackout.add', 'trainer.blackout.remove',
  /* جلسةٌ أُضيفت أو نُقلت، ونافذةُ الجدولة */
  'cohort.session.add', 'cohort.session.move', 'cohort.sessions.generate',
  'cohort.session.propose', 'cohort.session.approve', 'cohort.session.reject',
  /* وحذفُ لقاءٍ وزنُه وزنُ نقله: كلاهما يُخرج موعدا من تقويم من كان
     ينتظره، ولا يمسّ وصولَه ولا مالَه ولا سجلَّه. والمسجَّلون يُبلَّغون
     بمفتاح `cohort.schedule_changed` لا بهذا — هذا أثرٌ لا إشعار. */
  'cohort.session.delete',
  'cohort.schedule_window.open', 'cohort.schedule_window.close',
  'cohort.term.set', 'cohort.term.assign',
  /* وفتحُ شعبةٍ لمدرّب: إسنادٌ يصله خبرُه، ووزنُه وزنُ الإسناد */
  'cohort.open_for_trainer',
  'cohort.remind_trainer',
  /* اقتراحُ تأجيلٍ ينتظر قرارا */
  'session.reschedule.propose',
  /* بريدُه وُثّق بيدِ موظّف */
  'admin.user.verify_email', 'trainer.application.verify_email',
  /* طلبُه بُتّ فيه */
  'learner.request.fulfilled', 'learner.request.declined', 'learner.request.in_review',
  'advisor.request.approved', 'advisor.request.rejected',
  /* اقتراحُ دورته */
  'trainer.course_proposal.link', 'trainer.course_proposal.become_course',
  'trainer.course_proposal.reject',
  /* مسارُه باسمه */
  'trainer.path.publish', 'trainer.path.reject', 'trainer.path.retire',
  /* صورتُه ومراجعتُه */
  'trainer.photo.approve', 'trainer.photo.reject',
  'rating.approve', 'rating.reject',
  /* تذكرتُه */
  'support.ticket.assign', 'support.ticket.status',
]

/* ═══ في المنتَج وحدَه — عملٌ يغيّر النظامَ لا الإنسان ═══

   وتُكتب عائلاتٍ لا أفعالا مفردة: `worker.*` كلُّها آلةٌ تعمل، و`integration.*`
   كلُّها إعداد. فمن أضاف فعلا في عائلةٍ منها ورث وزنَها بحقّ — ومن أضاف
   **عائلةً** جديدةً حمِرت عنده البوّابة. */
const LOW_FAMILIES: readonly string[] = [
  'worker', 'integration', 'catalog', 'module', 'assessment', 'rubric',
  'material', 'recording', 'content', 'diagnostic', 'skill', 'term',
  'coupon', 'completion_rule', 'notification', 'cv', 'account', 'checkout',
  /* ط-٣: سكُّ رابطٍ قصيرٍ وإبطالُه — عنوانٌ يُختصر، لا وصولُ إنسانٍ يتغيّر */
  'short_link',
  'attempt', 'attendance', 'feedback', 'referral', 'plan', 'zoom',
  'trainer_compensation', 'advisor', 'learner', 'session',
  /* وبابُ الموسم: قرارٌ يغيّر ما تفعله المنصّةُ لا ما يملكه إنسانٌ بعينه.
     ومن يُبلَّغ بفتحه يصله بريدُه من `OutboxMail` لا من وزن الأثر. */
  'registration',
]

/* وأفعالٌ مفردةٌ وزنُها منخفضٌ وإن كانت عائلتُها أثقل */
const LOW: readonly string[] = [
  'cohort.create', 'cohort.update', 'cohort.duplicate', 'cohort.publish',
  'cohort.status', 'cohort.status.sync', 'cohort.delivery_plan.set',
  'cohort.plan.save', 'cohort.plan.submit', 'cohort.message.send',
  'cohort.file.upload', 'cohort.file.remove',
  'admin.user.invite_resend',
  'enrollment_request.create',
  'order.cancel_stale',
  'payment.webhook', 'refund.request', 'refund.provider_failed',
  'trainer_payout.generate_skipped',
  'rating.submit', 'submission.create',
  'support.ticket.create', 'support.ticket.priority',
  'staff.task.complete',
  'roles.sync',
  'trainer.assign', 'trainer.create_direct', 'trainer.profile.create',
  'trainer.account.link', 'trainer.demo.evaluate', 'trainer.document.register',
  'trainer.public_profile.save', 'trainer.photo.upload',
  'trainer.review.add', 'trainer.review.update',
  'trainer.application.submit', 'trainer.application.resume', 'trainer.application.reapply',
  'trainer.application.purge', 'trainer.application.proposals_edit',
  'trainer.application.phase2_complete',
  'trainer.application.account_created', 'trainer.application.account_linked',
  'trainer.interview.invite', 'trainer.interview.remind', 'trainer.interview.outcome',
  'trainer.interview.dossier_sent', 'trainer.interview.self_booked',
  'trainer.interview.self_canceled',
  'trainer.dossier_link.create', 'trainer.dossier_link.revoke',
  'trainer.dossier_link.rotate', 'trainer.dossier_link.send',
  'trainer.change.submit', 'trainer.change.decide',
  'trainer.change.publish', 'trainer.change.apply_catalog',
  'trainer.course_proposal.create', 'trainer.course_proposal.update',
  'trainer.course_proposal.delete',
  /* والسؤالُ عن اقتراحٍ وجوابُه: خبرُ عملٍ في الطابور لا خبرُ إنسان. ويصل
     صاحبَه إشعارا في بوّابته على كلّ حال (`trainer.course_proposal.question`
     في صنفٍ لا يُكتم) — وهذا وزنُ الأثر لا وزنُ الإشعار. */
  'trainer.course_proposal.ask', 'trainer.course_proposal.answer',
  'trainer.path.create', 'trainer.path.update',
  'trainer.path.submit', 'trainer.path.delete',
  'trainer.departure.open', 'trainer.departure.close',
]

const EXPLICIT = new Map<string, AuditWeight>([
  ...HIGH.map((a) => [a, 'high'] as const),
  ...MEDIUM.map((a) => [a, 'medium'] as const),
  ...LOW.map((a) => [a, 'low'] as const),
])

/** وزنُ الفعل — أو `null` لفعلٍ لم يُصنَّف بعدُ، وهو ما يُحمّر البوّابة */
export function auditWeightOf(action: string): AuditWeight | null {
  const exact = EXPLICIT.get(action)
  if (exact) return exact
  const family = action.split('.')[0]
  return LOW_FAMILIES.includes(family) ? 'low' : null
}

/** أيصل صاحبَه بريدا؟ — `medium` فما فوق (ي-١) */
export function auditReachesPerson(action: string): boolean {
  const w = auditWeightOf(action)
  return w === 'high' || w === 'medium'
}

/** وما لا يملك صاحبُه كتمَه */
export function auditCannotBeMuted(action: string): boolean {
  return auditWeightOf(action) === 'high'
}

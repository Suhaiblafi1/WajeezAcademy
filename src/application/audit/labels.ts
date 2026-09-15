/* أسماءُ ما وقع، بالعربيّة — لا مفاتيحُ نظامٍ في وجه صاحب المنصّة.

   سجلُّ الأثر كان يعرض `cohort.session.add` و`refund.provider_failed` نصّا
   لاتينيّا في خطٍّ أحاديٍّ لمن يقرأ الصفحة (`AuditLog.tsx`). وهو العطبُ نفسُه
   الذي أُصلح في لوحة المدير (T5 في التدقيق): مفرداتُ القاعدة تُعرض حقيقةً
   للمستخدم، فيُقرأ السجلُّ كسجلِّ مبرمجٍ لا كسجلّ عمل.

   والترجمةُ **تركيبيّةٌ لا جدولُ ١٢٧ سطرا**: الفعلُ مفاتيحُه مقاطعُ مفصولةٌ
   بنقاط (`نطاق.شيء.فعل`)، وكلُّ مقطعٍ كلمةٌ في معجمٍ واحد. فما يُضاف غدا
   يُترجَم نفسُه إن كانت مقاطعُه معروفة، ولا يسقط في «غير معروف». والقلّةُ
   التي لا يصحّ فيها التركيبُ لها عباراتُها الكاملة في `PHRASES` — وهي التي
   يقرؤها المستخدمُ أكثرَ من غيرها.

   وما لا يُعرف يُعرض كما هو: مفتاحٌ ظاهرٌ خيرٌ من ترجمةٍ مختلَقة. */

/** عباراتٌ كاملةٌ للأفعال التي يقرؤها الموظّف كثيرا — وللتي لا يستقيم تركيبُها */
const PHRASES: Record<string, string> = {
  'admin.user.create': 'إنشاءُ حساب',
  'admin.user.suspend': 'إيقافُ حساب',
  'admin.user.verify_email': 'توثيقُ بريدٍ بيدِ موظّف',
  'admin.user.reinstate': 'رفعُ إيقافٍ عن حساب',
  'admin.user.archive': 'أرشفةُ حساب',
  'admin.user.unarchive': 'إعادةُ تنشيطِ حساب',
  'admin.user.purge': 'حذفُ حسابٍ نهائيّا',
  'admin.user.purge_with_history': 'محوُ حسابٍ بسجلّه كلّه',
  /* ل-٦: صفٌّ واحدٌ يجمع الدفعةَ — فلا تُقرأ حذوفا متفرّقةً في ثانية */
  'admin.users.purge_bulk': 'حذفُ حساباتٍ جملةً',
  /* البند ٦٦ — أخطرُ فعلين في السجلّ، ولذلك يُسمَّيان بما يفعلانه لا برمزهما */
  'accounts.reset_purge': 'إعادةُ ضبط الحسابات — محوٌ نهائيّ',
  'accounts.reset_archive': 'إعادةُ ضبط الحسابات — أرشفة',
  'admin.user.invite_resend': 'إعادةُ إرسال دعوة',
  'admin.permission.grant': 'منحُ صلاحيّةٍ لشخص',
  'admin.permission.deny': 'نزعُ صلاحيّةٍ عن شخص',
  'admin.permission.clear': 'إلغاءُ استثناءِ صلاحيّة',
  'roles.set': 'تعيينُ أدوارِ حساب',
  /* ترقيةٌ بلا فاعلٍ بشريّ — يكتبها الخادمُ عند الإقلاع من `FOUNDER_EMAILS`.
     واسمُها يقول «تلقائيّا» صراحةً: من يقرأ السجلَّ يجب أن يعرف أنّ أعلى
     رتبةٍ في النظام مُنحت بلا أن يمنحها أحد. */
  'auth.founder.promoted': 'ترقيةُ مؤسِّسٍ إلى مديرِ نظامٍ تلقائيّا',
  'payment.record_manual': 'تسجيلُ دفعةٍ يدويّة',
  'payment.charge': 'استيفاءُ دفعة',
  'payment.webhook': 'إشعارُ دفعٍ من المزوّد',
  'refund.request': 'طلبُ استرداد',
  'refund.process': 'تنفيذُ استرداد',
  'refund.reject': 'رفضُ استرداد',
  'refund.provider_failed': 'إخفاقُ الاسترداد عند المزوّد',
  'order.checkout': 'إنشاءُ طلبِ شراء',
  'order.cancel': 'إلغاءُ طلبِ شراء',
  'order.settle_partial': 'تسويةٌ جزئيّةٌ لطلب',
  'cohort.create': 'إنشاءُ شعبة',
  'cohort.update': 'تعديلُ شعبة',
  'cohort.duplicate': 'تكرارُ شعبة',
  'cohort.publish': 'فتحُ شعبةٍ للتسجيل',
  'cohort.status': 'تغييرُ حالةِ شعبة',
  'cohort.status.sync': 'مواءمةُ حالاتِ الشعب بالتواريخ',
  /* ع-٢ · د-٣: ملفُّ شعبةٍ — متنُ محورٍ أو مصدرٌ في الخطّة */
  'cohort.file.upload': 'إرفاقُ ملفٍّ إلى شعبة',
  'cohort.file.remove': 'حذفُ ملفٍّ من شعبة',
  'cohort.session.add': 'إضافةُ جلسةٍ إلى شعبة',
  /* نقلُ المدرّب لقاءَه داخلَ نافذته — لا اقتراحٌ يُرفع إلى الإدارة.
     ويُفرَّق عن `session.reschedule.*` عمدا: ذاك طلبٌ يُبَتّ، وهذا فعلٌ وقع. */
  'cohort.session.move': 'نقلُ موعدِ لقاءٍ داخلَ نافذة الجدولة',
  'cohort.schedule_window.open': 'فتحُ نافذةِ جدولةٍ للمدرّب',
  'cohort.schedule_window.close': 'إغلاقُ نافذةِ جدولةِ المدرّب',
  'cohort.sessions.generate': 'توليدُ جلساتِ شعبةٍ من الجدول',
  'cohort.trainer.assign': 'إسنادُ مدرّبٍ إلى شعبة',
  'cohort.message.send': 'رسالةٌ إلى شعبة',
  'session.reschedule.propose': 'اقتراحُ تأجيلِ جلسة',
  'session.reschedule.decide': 'قرارٌ على اقتراح تأجيل',
  'zoom.attach_manual': 'ربطُ رابطِ اجتماعٍ يدويّا',
  'zoom.create_api': 'إنشاءُ اجتماعِ Zoom من المنصّة',
  'zoom.create_failed': 'تعذّر إنشاءُ اجتماعِ Zoom — وأُلغيت جلستُه',
  'zoom.attendance_sync': 'احتُسب الحضورُ من تقرير Zoom',
  'attendance.mark': 'تسجيلُ حضور',
  'certificate.issue': 'إصدارُ شهادة',
  'certificate.revoke': 'إلغاءُ شهادة',
  'enrollment.create': 'تسجيلُ متعلّمٍ في شعبة',
  'enrollment.drop': 'إسقاطُ تسجيل',
  'enrollment.switch_cohort': 'نقلُ متعلّمٍ إلى شعبةٍ أخرى',
  'enrollment.waitlist.promote': 'ترقيةٌ من قائمة الانتظار',
  'enrollment_request.create': 'طلبُ تسجيل',
  'enrollment_request.approve': 'قبولُ طلبِ تسجيل',
  'enrollment_request.reject': 'رفضُ طلبِ تسجيل',
  'learner.enroll.manual': 'تسجيلٌ يدويٌّ لمتعلّم',
  'trainer.application.submit': 'تقديمُ طلبِ انضمامٍ للتدريب',
  'trainer.invitation.create': 'دعوةُ مدرّبٍ لإنشاء حسابه',
  'trainer.approved.notify': 'إشعارُ مدرّبٍ باعتماده',
  'trainer.info_requested.notify': 'إشعارُ متقدّمٍ بطلبِ معلوماتٍ إضافية',
  'trainer.interview.self_booked': 'حجزُ متقدّمٍ موعدَ مقابلته بنفسه',
  'trainer.interview.self_canceled': 'إلغاءُ متقدّمٍ موعدَ مقابلته',
  'trainer.interview.dossier_sent': 'إرسالُ ملفِّ المتقدّم إلى لجنة المراجعة',
  /* لا يُركَّب اسمُهما من المعجم: «dossier_link» ليست كلمةً فيه، والتركيبُ
     الناقصُ يُظهر المفتاحَ اللاتينيَّ في شاشةِ صاحب المنصّة. */
  'trainer.dossier_link.create': 'إنشاءُ رابطِ سجلٍّ باسمِ قارئ',
  'trainer.dossier_link.send': 'إرسالُ رابط سجلِّ المتقدّم بالبريد',
  'trainer.dossier_link.rotate': 'تجديدُ رابطِ سجلٍّ — يبطل القديم',
  'trainer.dossier_link.revoke': 'إلغاءُ رابطِ سجلٍّ',
  'trainer.interview.invite': 'دعوةُ متقدّمٍ إلى حجزِ موعدِ مقابلة',
  'trainer.create_direct': 'تعيينُ مدرّبٍ داخليّا — بلا نموذجِ تقدّم',
  'advisor.case.create_own': 'إدخالُ المستشارِ عميلا وفتحُ حالته',
  'term.create': 'إنشاءُ فصلٍ دراسيّ',
  'term.registration_window': 'ضبطُ نافذةِ التسجيل للفصل',
  'term.trainer_availability': 'إتاحةُ مدرّبٍ في فصل',
  'term.plan_open': 'توزيعُ شعب الفصل وفتحُ ما استوفى',
  'term.calendar_publish': 'نشرُ تقويم الفصل',
  'term.delete': 'حذفُ فصلٍ لم يُنشر ولا شعبَ فيه',
  'trainer.qualify': 'تأهيلُ مدرّبٍ لدورة',
  /* ح-٤: قراراتُ تصنيفِ دورةٍ اقترحها مدرّبٌ وليست في الكتالوج. وثلاثتُها
     عباراتٌ كاملة لا تركيب: «ربطُ اقتراحِ دورة» وحدَه لا يقول بماذا رُبط. */
  'trainer.course_proposal.link': 'ربطُ اقتراحِ دورةٍ برمزٍ قائمٍ في الكتالوج',
  'trainer.course_proposal.become_course': 'دخولُ اقتراحِ دورةٍ الكتالوجَ دورةً جديدة',
  'trainer.course_proposal.reject': 'رفضُ اقتراحِ دورة',
  /* ن-١: مسارٌ يبنيه مدرّبٌ ويُعرض على الرفّ العامّ. والثلاثةُ عباراتٌ كاملة:
     «نشرُ مسارِ مدرّب» وحدَه لا يقول أين نُشر، والرفُّ هو الخبر. */
  'trainer.path.publish': 'نشرُ مسارِ مدرّبٍ على الرفّ العامّ',
  'trainer.path.retire': 'سحبُ مسارِ مدرّبٍ من الرفّ العامّ',
  'trainer.path.reject': 'ردُّ مسارِ مدرّبٍ بسبب',
  /* ن-٩ · ن-١٠: رحيلُ مدرّبٍ وما يترتّب عليه. وعباراتٌ كاملةٌ لا تركيب:
     «نقلُ مدرّب» لا يقول ما جرى للمتعلّمين، وهم الخبر. */
  'trainer.departure.open': 'فتحُ ملفِّ رحيلِ مدرّب',
  'trainer.departure.substitute': 'إسنادُ بديلٍ لشعبةٍ فقدت مدرّبَها',
  'trainer.departure.move': 'نقلُ متعلّمٍ إلى شعبةٍ نظيرةٍ بعد رحيلِ مدرّبه',
  'trainer.departure.offer_choice': 'عرضُ الاختيار على متعلّمٍ — ردٌّ أو رصيد',
  'trainer.departure.learner_choice': 'اختيارُ المتعلّم بين الردّ والرصيد',
  'trainer.departure.refund_requested': 'رفعُ طلبِ ردٍّ باختيار المتعلّم',
  'trainer.departure.credit': 'صرفُ رصيدٍ باسم متعلّمٍ باختياره',
  'trainer.departure.notify': 'إبلاغُ متعلّمٍ بما جرى لشعبته',
  'trainer.departure.close': 'إغلاقُ ملفِّ رحيلِ مدرّب',
  'trainer.qualify.auto': 'تأهيلُ مدرّبٍ تلقائيّا لما ذكره في طلبه',
  'cohort.plan.save': 'حفظُ مدرّبٍ خطّةَ شعبته',
  'cohort.plan.submit': 'إرسالُ مدرّبٍ خطّةَ شعبته للاعتماد',
  'cohort.plan.approve': 'اعتمادُ خطّة شعبة',
  'cohort.plan.changes_requested': 'ردُّ خطّة شعبةٍ بتعديلات',
  /* فعلٌ لم يعد يُكتب — واسمُه يبقى (١٤ سبتمبر ٢٠٢٦). حُذف صندوقُ «اقتراحٌ
     للإدارة» (د-٦) وصارت التسميةُ إصدارا جديدا (ح-٣)، فلا حدثَ جديدٌ بهذا
     الفعل. والمكتوبُ قبلَه في `AuditEvent` باقٍ، والمعجمُ هو ما يُقرأ به —
     فحذفُ السطرِ يجعل أحداثا حقيقيّةً بلا اسمٍ في سجلّ الشعبة. */
  'cohort.plan.proposal_applied': 'تطبيقُ اقتراح مدرّبٍ على اسم دورةٍ أو مسار',
  'cohort.trainer_update': 'تعديلُ مدرّبٍ بياناتِ شعبته',
  'cohort.remind_trainer': 'تذكيرُ مدرّبٍ بتجهيز شعبته',
  'session.recording.link': 'إضافةُ تسجيلِ جلسةٍ من رابط',
  'referral.link.create': 'إنشاءُ رابطِ دعوةِ مدرّبٍ لشعبة',
  /* ط-٣: الرابطُ القصيرُ يُسَكّ ويُبطَل — ولا يُحذف صفُّه */
  'short_link.create': 'سكُّ رابطٍ قصير',
  'short_link.revoke': 'إبطالُ رابطٍ قصير',
  'checkout.referral_ignored': 'إهمالُ رمزِ دعوةٍ لا يخصّ الشراء',
  'trainer.suspend': 'إيقافُ مدرّب',
  'trainer.reinstate': 'رفعُ إيقافٍ عن مدرّب',
  'catalog.cohorts.open_all': 'تهيئةُ الشعب جملةً',
  'cohort.delivery_plan.set': 'كتابةُ خطّةِ تقديمِ شعبة',
  'catalog.cohorts.align_prices': 'محاذاةُ أسعار الشعب',
  'integration.payment.save': 'حفظُ إعدادِ مزوّد الدفع',
  'integration.email.save': 'حفظُ إعدادِ البريد',
  'integration.email.test': 'اختبارُ إرسالِ بريد',
  'integration.zoom.save': 'حفظُ إعدادِ Zoom',
  'integration.calendly.save': 'حفظُ مفتاحِ توقيع Calendly',
  'integration.calendly.register': 'تسجيلُ اشتراك Calendly للمقابلات',
  'integration.zoom.test': 'اختبارُ اتّصالِ Zoom',
  'integration.whatsapp.save': 'حفظُ أرقامِ واتساب لمواضع الموقع',
  'staff.task.assign': 'تكليفُ موظّفٍ بمهمّة',
  'staff.task.complete': 'إغلاقُ مهمّة',
  'staff.notify': 'إشعارُ موظّف',
  'cv.upload': 'رفعُ سيرةٍ ذاتيّة',
  'cv.view': 'مشاهدةُ سيرةٍ ذاتيّة',
  'cv.view_own': 'مشاهدةُ سيرته الذاتيّة',
  'cv.delete': 'حذفُ سيرةٍ ذاتيّة',
  /* ═══ وسبعةُ أسماءٍ كانت هنا لأشياءَ ليست أفعالَ أثرٍ أصلا ═══

     `rollback` · `publish` · `approve` · `reject` · `create` · `desc` ·
     `start_review` — كان الحارسُ يمسح كلَّ `action: '…'` في `server/`،
     فالتقط ترتيبَ استعلامٍ (`orderBy: { _count: { action: 'desc' } }`)،
     وسجلَّ إصدارٍ آخرَ (`catalogVersionEvent`)، ووسمَ Zod لمُدخَل.

     **فاختُلقت لها عباراتٌ عربيّةٌ لتُسكِته**: «`desc` — تعديلُ وصف»،
     واسمُها في الحقيقة اتّجاهُ فرزٍ في SQL. ومعجمٌ يكذب أسوأُ من معجمٍ
     ناقص: من قرأه صدّقه.

     فصار المسحُ على نافذة `recordAudit` وحدَها، وسقطت السبعةُ لأنّها لم
     تكن هناك قطّ. */
  'catalog.version.delete_draft': 'حذفُ مسودّةِ إصدار',
  /* ك-٣: ربطُ المهارات بابٌ قائمٌ بذاته — فالدورةُ تُولد بلا مهارةٍ وتُصلَح بعدُ */
  'catalog.course.skills_set': 'ربطُ مهاراتٍ بدورة',
  'diagnostic.attach': 'إرفاقُ نتيجةِ تشخيصٍ بحساب',
  'plan.approve_requests': 'اعتمادُ طلباتِ خطّة',
  'plan.request_enrollment': 'طلبُ تسجيلٍ من خطّة',
  'support.ticket.priority': 'تغييرُ أولويّةِ تذكرة',
  'trainer.application.account_created': 'إنشاءُ حسابٍ من طلبِ انضمام',
  'trainer.application.account_linked': 'ربطُ طلبِ انضمامٍ بحسابٍ قائم',
  'trainer.application.verify_email': 'توثيقُ بريدِ متقدّم',
  'trainer.application.phase2_complete': 'إتمامُ القسم الثاني من طلبِ انضمام',
  'trainer.application.proposals_edit': 'تحريرُ اقتراحاتِ دوراتِ المتقدّم',
  /* يُبنى المفتاحُ بشرطٍ في الشيفرة (`result.ok ? 'notification.sent' : …`)
     فلا يُقرأ بمسحِ نصٍّ حرفيّ — ولذلك يُكتب هنا صراحةً. */
  'notification.sent': 'إشعارٌ أُرسل',
  'notification.failed': 'إشعارٌ فشل إرسالُه',
  'trainer.change.apply_catalog': 'تطبيقُ اقتراحِ مدرّبٍ على الكتالوج',
  'trainer.publish_approve': 'اعتمادُ ظهورِ المدرّبِ للعامّة',
  'trainer.public_profile.save': 'حفظُ ملفِّ المدرّب العامّ',
  'trainer.photo.upload': 'رفعُ صورةِ المدرّب',
  'trainer.photo.approve': 'اعتمادُ صورةِ المدرّب للعرض العامّ',
  'trainer.photo.reject': 'ردُّ صورةِ المدرّب قبل عرضها',
  'account.avatar.upload': 'رفعُ صاحبِ الحسابِ صورتَه',
  /* إتاحةُ المدرّب (المهمّة ٧١) — تُسجَّل لأنّ الغيابَ **يردُّ إسنادا**:
     فمن سأل «لماذا لم يُسنَد؟» يجد الجوابَ في الأثر لا في واتساب. */
  'notification.pref.mute': 'كتمُ صنفِ إشعاراتٍ بطلب صاحبه',
  'notification.pref.enable': 'إعادةُ صنفِ إشعاراتٍ بطلب صاحبه',
  'trainer.availability.set': 'إعلانُ المدرّبِ ساعاتِه الأسبوعيّة',
  'trainer.blackout.add': 'تسجيلُ المدرّبِ فترةَ غياب',
  'trainer.blackout.remove': 'حذفُ المدرّبِ فترةَ غياب',
  'trainer_compensation.set_rule': 'تعيينُ قاعدةِ تعويضِ مدرّب',
  'trainer_payout.generate_skipped': 'تخطّي توليدِ مستحقّ',

  /* ═══ وأربعةٌ وعشرون فعلا تُبنى ولا تُكتب حرفا ═══

     منها ما يُركَّب بقالبٍ نصّيّ ومنها ما يُنتقى بشرط. وكان المسحُ الحرفيُّ
     أعمى عنها، **فمرّت تُعرض مفاتيحَ لاتينيّةً في سجلٍّ عربيّ** ولم يحمرّ
     شيء. وتُكتب هنا بعباراتٍ كاملةٍ لا بالتركيب: «نشِط · متن» ليست اسما
     لإتاحةِ مادّة. */

  /* مراجعةُ متنِ الوحدة — `module-authoring.service.ts` */
  'module.content.academic_approve': 'اعتمادٌ أكاديميٌّ لمتنِ وحدة',
  'module.content.request_changes': 'طلبُ تعديلاتٍ على متنِ وحدة',
  'module.content.return_to_academic': 'إعادةُ متنِ وحدةٍ للمراجعة الأكاديميّة',

  /* تسليمُ المتعلّم — `assessment.service.ts:251` */
  'submission.start_review': 'بدءُ مراجعةِ تسليم',
  'submission.request_resubmit': 'طلبُ إعادةِ تسليم',
  'submission.accept': 'قبولُ تسليم',

  /* تأجيلُ جلسة — `cohort-message.service.ts:228` */
  'session.reschedule.approve': 'اعتمادُ تأجيلِ جلسة',
  'session.reschedule.reject': 'ردُّ اقتراحِ تأجيلِ جلسة',

  /* طلبُ مستشار — `advisor-request.service.ts:165` */
  'advisor.request.approved': 'اعتمادُ طلبِ مستشار',
  'advisor.request.rejected': 'ردُّ طلبِ مستشار',

  /* طلبُ متعلّم — `learner-request.service.ts:247` */
  'learner.request.in_review': 'بدءُ النظرِ في طلبِ متعلّم',
  'learner.request.fulfilled': 'تلبيةُ طلبِ متعلّم',
  'learner.request.declined': 'ردُّ طلبِ متعلّم',

  /* موادُّ الشعبة وتسجيلاتُها — `cohort.service.ts:1284` */
  'content.active': 'إتاحةُ مادّةٍ أو تسجيل',
  'content.archived': 'أرشفةُ مادّةٍ أو تسجيل',
  'content.disabled': 'تعطيلُ مادّةٍ أو تسجيل',

  /* وظائفُ العامل الثماني — `worker/jobs.ts`. وفاعلُها النظامُ لا إنسان */
  'worker.calendly_interview_sync': 'مزامنةُ مقابلاتِ Calendly',
  'worker.cleanup_expired': 'تنظيفُ ما انتهت صلاحيّتُه',
  'worker.cohort_status_sync': 'مزامنةُ حالاتِ الشعب',
  'worker.dispatch_notifications': 'إرسالُ الإشعاراتِ المنتظِرة',
  'worker.enforce_retention': 'تطبيقُ مددِ الحفظ',
  'worker.publish_scheduled_changes': 'نشرُ التغييراتِ المجدولة',
  'worker.reclaim_abandoned_orders': 'استرجاعُ الطلباتِ المهجورة',
  'worker.session_reminders': 'تذكيراتُ الجلسات',
}

/** معجمُ المقاطع — نطاقاتٌ وأشياءٌ وأفعال */
const WORDS: Record<string, string> = {
  /* نطاقاتٌ وأشياء */
  admin: 'الإدارة', user: 'حساب', users: 'حسابات', permission: 'صلاحيّة', permissions: 'صلاحيّات',
  roles: 'أدوار', role: 'دور', advisor: 'مستشار', case: 'حالة', commission: 'عمولة',
  request: 'طلب', catalog: 'كتالوج', cohort: 'شعبة', cohorts: 'شعب', session: 'جلسة', sessions: 'جلسات',
  term: 'فصل دراسيّ', accounts: 'حسابات', platform: 'المنصّة',
  version: 'إصدار', certificate: 'شهادة', trainer: 'مدرّب', trainer_compensation: 'تعويضُ مدرّب',
  trainer_payout: 'مستحقُّ مدرّب', application: 'طلبُ انضمام', contract: 'عقد', invitation: 'دعوة',
  profile: 'ملفّ', document: 'وثيقة', interview: 'مقابلة', demo: 'حصّةٌ تجريبيّة', review: 'مراجعة',
  change: 'اقتراحُ تعديل', course_proposal: 'اقتراحُ دورة', path: 'مسار', account: 'حساب', enrollment: 'تسجيل', enrollment_request: 'طلبُ تسجيل',
  waitlist: 'قائمةُ انتظار', order: 'طلبُ شراء', payment: 'دفعة', refund: 'استرداد', coupon: 'كوبون',
  invoice: 'فاتورة', plan: 'خطّة', item: 'بند', module: 'وحدة', content: 'متن', material: 'مادّة',
  recording: 'تسجيلٌ مرئيّ', assessment: 'تقييم', attempt: 'محاولة', grade: 'درجة', rubric: 'روبرك',
  submission: 'تسليم', feedback: 'تغذيةٌ راجعة', attendance: 'حضور', completion_rule: 'قاعدةُ إكمال',
  diagnostic: 'تشخيص', skill: 'مهارة', rating: 'تقييم', support: 'دعم', ticket: 'تذكرة',
  notification: 'إشعار', template: 'قالب', integration: 'تكامل', email: 'بريد', staff: 'موظّف',
  task: 'مهمّة', learner: 'متعلّم', cv: 'سيرةٌ ذاتيّة', zoom: 'اجتماع', message: 'رسالة',
  /* أفعال */
  create: 'إنشاء', update: 'تعديل', delete: 'حذف', remove: 'إزالة', replace: 'إبدال',
  add: 'إضافة', set: 'تعيين', save: 'حفظ', send: 'إرسال', submit: 'تقديم', decide: 'قرار',
  approve: 'اعتماد', reject: 'رفض', cancel: 'إلغاء', publish: 'نشر', unpublish: 'إيقافُ نشر',
  assign: 'إسناد', promote: 'ترقية', drop: 'إسقاط', mark: 'تسجيل', issue: 'إصدار',
  revoke: 'إلغاء', suspend: 'إيقاف', reinstate: 'رفعُ إيقاف', archive: 'أرشفة', unarchive: 'إعادةُ تنشيط',
  purge: 'محو', invite: 'دعوة', resend: 'إعادةُ إرسال', activate: 'تفعيل', link: 'ربط',
  verify: 'توثيق', generate: 'توليد', sync: 'مواءمة', duplicate: 'تكرار', adopt: 'تبنّي',
  charge: 'استيفاء', settle: 'تسوية', process: 'تنفيذ', test: 'اختبار', upsert: 'حفظ',
  upload: 'رفع', view: 'مشاهدة', register: 'تسجيل', qualify: 'تأهيل', remeasure: 'إعادةُ قياس',
  complete: 'إغلاق', status: 'حالة', outcome: 'نتيجة', transition: 'انتقال', resume: 'استئناف',
  checkout: 'شراء', webhook: 'إشعارٌ من المزوّد', apply: 'تطبيق', sign: 'توقيع', evaluate: 'تقويم',
  simulate: 'محاكاة', rollback: 'رجوع', align: 'محاذاة', open: 'فتح', switch: 'نقل',
  grant: 'منح', deny: 'نزع', clear: 'إلغاءُ استثناء', withdraw: 'سحب', retry: 'إعادةُ محاولة',
  moderate: 'مراجعةُ نشر', read: 'قراءة', reply: 'ردّ', reopen: 'إعادةُ فتح', pay: 'دفع',
  final: 'موافقةٌ نهائيّة', validate: 'تحقّق', impact: 'تحليلُ أثر', scope: 'نطاق',
}

/** ما وقع، بالعربيّة — أو المفتاحُ كما هو إن كان مقطعٌ منه مجهولا */
export function auditActionAr(action: string): string {
  const exact = PHRASES[action]
  if (exact) return exact
  const parts = action.split('.')
  const words = parts.map((p) => WORDS[p])
  /* ولا تُخلَق ترجمةٌ من نصفِ معجم: مفتاحٌ ظاهرٌ أصدقُ من عبارةٍ ناقصة */
  if (words.some((w) => !w)) return action
  /* الفعلُ أوّلا ثمّ موضعُه: «إضافة · شعبة · جلسة» تُقرأ من اليمين كما تُكتب */
  return [...words].reverse().join(' · ')
}

/** نوعُ الكيان بالعربيّة — للعناوين والمرشّحات */
export function entityTypeAr(entityType: string): string {
  return WORDS[entityType] ?? entityType.split('_').map((p) => WORDS[p] ?? p).join(' ')
}

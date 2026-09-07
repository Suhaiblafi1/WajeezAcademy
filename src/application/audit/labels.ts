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
  'cohort.session.add': 'إضافةُ جلسةٍ إلى شعبة',
  'cohort.sessions.generate': 'توليدُ جلساتِ شعبةٍ من الجدول',
  'cohort.trainer.assign': 'إسنادُ مدرّبٍ إلى شعبة',
  'cohort.message.send': 'رسالةٌ إلى شعبة',
  'session.reschedule.propose': 'اقتراحُ تأجيلِ جلسة',
  'session.reschedule.decide': 'قرارٌ على اقتراح تأجيل',
  'zoom.attach_manual': 'ربطُ رابطِ اجتماعٍ يدويّا',
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
  'trainer.create_direct': 'تعيينُ مدرّبٍ داخليّا — بلا نموذجِ تقدّم',
  'advisor.case.create_own': 'إدخالُ المستشارِ عميلا وفتحُ حالته',
  'term.create': 'إنشاءُ فصلٍ دراسيّ',
  'term.registration_window': 'ضبطُ نافذةِ التسجيل للفصل',
  'term.trainer_availability': 'إتاحةُ مدرّبٍ في فصل',
  'term.plan_open': 'توزيعُ شعب الفصل وفتحُ ما استوفى',
  'term.calendar_publish': 'نشرُ تقويم الفصل',
  'trainer.qualify': 'تأهيلُ مدرّبٍ لدورة',
  'trainer.suspend': 'إيقافُ مدرّب',
  'trainer.reinstate': 'رفعُ إيقافٍ عن مدرّب',
  'catalog.cohorts.open_all': 'تهيئةُ الشعب جملةً',
  'cohort.delivery_plan.set': 'كتابةُ خطّةِ تقديمِ شعبة',
  'catalog.cohorts.align_prices': 'محاذاةُ أسعار الشعب',
  'integration.payment.save': 'حفظُ إعدادِ مزوّد الدفع',
  'integration.email.save': 'حفظُ إعدادِ البريد',
  'integration.email.test': 'اختبارُ إرسالِ بريد',
  'staff.task.assign': 'تكليفُ موظّفٍ بمهمّة',
  'staff.task.complete': 'إغلاقُ مهمّة',
  'staff.notify': 'إشعارُ موظّف',
  'cv.upload': 'رفعُ سيرةٍ ذاتيّة',
  'cv.view': 'مشاهدةُ سيرةٍ ذاتيّة',
  'cv.view_own': 'مشاهدةُ سيرته الذاتيّة',
  'cv.delete': 'حذفُ سيرةٍ ذاتيّة',
  'rollback': 'الرجوعُ إلى إصدارٍ سابق',
  'publish': 'نشر',
  'approve': 'اعتماد',
  'reject': 'رفض',
  'create': 'إنشاء',
  'desc': 'تعديلُ وصف',
  'start_review': 'بدءُ مراجعة',
  'catalog.version.delete_draft': 'حذفُ مسودّةِ إصدار',
  'diagnostic.attach': 'إرفاقُ نتيجةِ تشخيصٍ بحساب',
  'plan.approve_requests': 'اعتمادُ طلباتِ خطّة',
  'plan.request_enrollment': 'طلبُ تسجيلٍ من خطّة',
  'support.ticket.priority': 'تغييرُ أولويّةِ تذكرة',
  'trainer.application.account_created': 'إنشاءُ حسابٍ من طلبِ انضمام',
  'trainer.application.account_linked': 'ربطُ طلبِ انضمامٍ بحسابٍ قائم',
  'trainer.application.verify_email': 'توثيقُ بريدِ متقدّم',
  'trainer.application.phase2_complete': 'إتمامُ القسم الثاني من طلبِ انضمام',
  /* يُبنى المفتاحُ بشرطٍ في الشيفرة (`result.ok ? 'notification.sent' : …`)
     فلا يُقرأ بمسحِ نصٍّ حرفيّ — ولذلك يُكتب هنا صراحةً. */
  'notification.sent': 'إشعارٌ أُرسل',
  'notification.failed': 'إشعارٌ فشل إرسالُه',
  'trainer.change.apply_catalog': 'تطبيقُ اقتراحِ مدرّبٍ على الكتالوج',
  'trainer.publish_approve': 'اعتمادُ ظهورِ المدرّبِ للعامّة',
  /* إتاحةُ المدرّب (المهمّة ٧١) — تُسجَّل لأنّ الغيابَ **يردُّ إسنادا**:
     فمن سأل «لماذا لم يُسنَد؟» يجد الجوابَ في الأثر لا في واتساب. */
  'notification.pref.mute': 'كتمُ صنفِ إشعاراتٍ بطلب صاحبه',
  'notification.pref.enable': 'إعادةُ صنفِ إشعاراتٍ بطلب صاحبه',
  'trainer.availability.set': 'إعلانُ المدرّبِ ساعاتِه الأسبوعيّة',
  'trainer.blackout.add': 'تسجيلُ المدرّبِ فترةَ غياب',
  'trainer.blackout.remove': 'حذفُ المدرّبِ فترةَ غياب',
  'trainer_compensation.set_rule': 'تعيينُ قاعدةِ تعويضِ مدرّب',
  'trainer_payout.generate_skipped': 'تخطّي توليدِ مستحقّ',
  'request_resubmit': 'طلبُ إعادةِ تقديم',
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
  change: 'اقتراحُ تعديل', account: 'حساب', enrollment: 'تسجيل', enrollment_request: 'طلبُ تسجيل',
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

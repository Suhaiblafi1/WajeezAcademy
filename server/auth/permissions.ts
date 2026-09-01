/* سجل الصلاحيات الدقيقة — مصدر الحقيقة الوحيد للصلاحيات على الخادم.
   لا قرار صلاحية يعتمد على اسم الدور وحده؛ الدور مجرد حزمة صلاحيات. */

export const PERMISSIONS = [
  // الكتالوج — عرض
  { key: 'catalog.view', description: 'عرض الكتالوج والمسودات' },
  // الدورات
  { key: 'catalog.course.create', description: 'إنشاء دورة' },
  { key: 'catalog.course.edit', description: 'تعديل دورة' },
  { key: 'catalog.course.review', description: 'مراجعة دورة (maker-checker)' },
  { key: 'catalog.course.approve', description: 'اعتماد دورة' },
  { key: 'catalog.course.publish', description: 'نشر دورة' },
  // المسارات
  { key: 'catalog.pathway.create', description: 'إنشاء مسار' },
  { key: 'catalog.pathway.edit', description: 'تعديل مسار وربطه بالدورات والمهارات' },
  { key: 'catalog.pathway.review', description: 'مراجعة مسار' },
  { key: 'catalog.pathway.approve', description: 'اعتماد مسار' },
  { key: 'catalog.pathway.publish', description: 'نشر مسار أو جدولته أو إيقافه' },
  // المهارات
  { key: 'catalog.skill.edit', description: 'تعديل مهارة' },
  { key: 'catalog.skill.approve', description: 'اعتماد مهارة' },
  // التشخيص
  { key: 'diagnostic.profile.edit', description: 'تحرير الملف التشخيصي لمرشح' },
  { key: 'diagnostic.profile.review', description: 'مراجعة ملف تشخيصي' },
  { key: 'diagnostic.profile.publish', description: 'نشر ملف تشخيصي' },
  { key: 'diagnostic.question.edit', description: 'تحرير سؤال وخياراته وآثارها' },
  { key: 'diagnostic.scoring.edit', description: 'تحرير أوزان التقييم' },
  { key: 'diagnostic.scoring.publish', description: 'نشر إصدار تقييم' },
  { key: 'diagnostic.simulate', description: 'تشغيل المحاكي ولوحة الجودة' },
  // الأثر والنشر
  /* الموافقةُ النهائيّة على متن الوحدة — آخرُ حلقةٍ في سلسلة الثلاث.

     ولم تكن حبّةً مستقلّة: القرارُ كلُّه كان على `catalog.course.publish`،
     والمديرُ الأكاديميّ يملكها والسوبر يملكها — فأيُّهما نشر انتهى الأمر،
     ولا حلقةَ وسطى. وحبّةٌ منفصلة هي ما يجعل «ثلاث خطوات» ثلاثا. */
  { key: 'catalog.content.final_approve', description: 'الموافقة النهائية على متن الوحدة بعد الاعتماد الأكاديميّ' },
  { key: 'catalog.impact.view', description: 'عرض تحليل الأثر قبل النشر' },
  { key: 'catalog.rollback', description: 'الرجوع إلى إصدار سابق منشور' },
  // الإدارة
  /* ثلاثُ حبّاتٍ لا حبّةٌ واحدة: من يفوّض لمرؤوسيه يحتاج أن يراهم، ولا يلزم
     أن يملك تعيينَ الأدوار ولا إيقافَ الحسابات — وهما أوسعُ أثرا منه. */
  { key: 'admin.users.view', description: 'عرض قائمة المستخدمين وأدوارهم' },
  { key: 'admin.users.manage', description: 'تعيين الأدوار وإيقاف الحسابات' },
  /* سجل التدقيق مكتوبٌ من كل شاشة حساسة أصلا (recordAudit) — هذه صلاحية
     رؤيته مجموعا في مكان واحد، لا صلاحية إنشائه. */
  { key: 'audit.view', description: 'عرض سجل التدقيق الموحّد لكل المنصّة' },
  /* التكليفُ والإشعار — حبّتان لا واحدة.

     من يوزّع المهامّ ليس بالضرورة من يبثّ الإعلانات: الأولى تُتابَع وتُغلَق،
     والثانية تصل جمهورا ولا تُغلَق. وجمعُهما في حبّةٍ يجعل منحَ إحداهما
     منحا للأخرى. */
  { key: 'staff.task.assign', description: 'تكليف موظّف بمهمّة ومتابعتها' },
  { key: 'staff.notify', description: 'إرسال إشعار إلى موظّف أو أكثر' },
  { key: 'admin.permissions.delegate', description: 'منح صلاحية لشخص أو منعها عنه — في حدود رتبته ومهامّه' },
  // منظومة المدربين — الإدارة
  /* صلاحية المتقدّم على طلبه هو — لا على طلبات غيره. تفصل حساب «متقدّم مدرب»
     عن حساب المتعلم: الأول يرى طلبه ومسودته وملفاته وحالة مراجعته ولا شيء
     سواها، ولا يملك بوابة المتعلم ولا بوابة المدرب. */
  { key: 'trainer.application.own', description: 'عرض طلب الانضمام الخاص بصاحبه ومتابعة حالته' },
  { key: 'trainer.applications.view', description: 'عرض طلبات انضمام المدربين' },
  { key: 'trainer.applications.review', description: 'مراجعة الطلبات وتسجيل الروبرك والمقابلات والديمو' },
  { key: 'trainer.applications.decide', description: 'قرار القبول المشروط أو الرفض أو الانتظار' },
  { key: 'trainer.applications.purge', description: 'حذفُ طلبٍ نهائيّا — لا تعطيلا. للمنتهية غير المتعاقَد عليها وحدها' },
  { key: 'trainer.invite', description: 'إرسال دعوة إنشاء الحساب الآمنة بعد الاعتماد والعقد' },
  { key: 'trainer.qualify', description: 'تأهيل مدرب لدورة' },
  { key: 'trainer.assign', description: 'إسناد مدرب إلى شعبة' },
  { key: 'trainer.publish', description: 'الموافقة على ظهور المدرب للعامة' },
  { key: 'trainer.suspend', description: 'إيقاف مدرب ومنع وصوله' },
  { key: 'trainer.change.review', description: 'مراجعة اقتراحات تعديل الدورات من المدربين (checker)' },
  { key: 'trainer.compensation.manage', description: 'إدارة العقود وقواعد التعويض والمستحقات' },
  // منظومة المدربين — بوابة المدرب
  { key: 'trainer.portal', description: 'دخول بوابة المدرب وعرض تأهيله وإسناداته' },
  { key: 'trainer.change.submit', description: 'اقتراح تعديل على دورة مؤهل لها أو مسندة إليه' },
  // التشغيل الأكاديمي — الإدارة
  { key: 'cohort.manage', description: 'إنشاء الشعب وجدولتها وإدارة جلساتها وروابطها' },
  { key: 'cohort.open', description: 'فتح شعبة بعد تحقق شروط الفتح' },
  { key: 'cohort.override_capacity', description: 'تجاوز سعة شعبة بشكل موثق' },
  { key: 'enrollment.manage', description: 'تسجيل المتعلمين في الشعب وإدارة تسجيلهم' },
  { key: 'material.manage', description: 'إدارة المواد والتسجيلات الخاصة' },
  { key: 'certificate.issue', description: 'إصدار شهادة بعد تحقق قواعد الإكمال' },
  { key: 'certificate.revoke', description: 'إلغاء شهادة مع سبب موثق' },
  // التشغيل الأكاديمي — المدرب على شعبه فقط
  { key: 'trainer.cohort.operate', description: 'تشغيل شعبه: حضور وتقييم وتغذية وتسجيلات' },
  // المتعلم
  { key: 'learner.portal', description: 'دخول بوابة المتعلم وعرض مساره وتقدمه' },
  { key: 'learner.submit', description: 'تسليم الواجبات ومحاولات التقييم' },
  // المستشارون — الحالات المسندة فقط
  { key: 'advisor.cases.view', description: 'عرض حالات العملاء المسندة إلى المستشار فقط' },
  { key: 'advisor.cases.operate', description: 'تشغيل الحالة المسندة: ملاحظات ومهام ومتابعات وتواصل وحالة' },
  { key: 'advisor.assign', description: 'إسناد حالة إلى مستشار' },
  /* دورُ المستشار مبيعاتٌ ومتابعةٌ أكاديمية معا — وكانت له خمسُ صلاحيات
     لا تكفي إلّا للأولى. فمن يتابع طالبا لا يرى تقدّمه ولا مواعيد شعبه،
     ومن يبيع لا يملك أن يطلب خصما فيخرج بالطلب من المنصّة كلّها. */
  { key: 'advisor.learner.view', description: 'رؤية تقدّم عميلٍ مسند وتسجيلاته ومواعيد جلساته وتقييماته' },
  { key: 'advisor.request.submit', description: 'رفع طلب خصم أو تعديل خطّة لعميلٍ مسند — يبتّ فيه غيرُه' },
  { key: 'advisor.request.review', description: 'البتّ في طلبات المستشارين: خصمٌ أو تعديل خطّة' },
  /* ملفُّ المستشار — عمولتُه وملاحظاتُ الإدارة عليه؛ غيرُ حالاته المسندة */
  { key: 'advisor.manage', description: 'عرض أداء المستشارين وتحديد نسبة عمولة كلٍّ منهم' },
  // السير الذاتية
  { key: 'cv.upload', description: 'رفع سيرة ذاتية بموافقة صريحة' },
  { key: 'cv.view', description: 'عرض سيرة عميل مسند — كل مشاهدة مسجلة' },
  { key: 'cv.manage', description: 'إدارة السير وحذفها وفق السياسة' },
  // التسجيل والتجارة
  { key: 'enrollment.request', description: 'طلب تسجيل في شعبة' },
  { key: 'enrollment.request.review', description: 'مراجعة طلبات التسجيل وحجز المقاعد' },
  { key: 'commerce.manage', description: 'إدارة الطلبات والكوبونات وخطط الاشتراك' },
  { key: 'finance.view', description: 'عرض الفواتير والمدفوعات والاستردادات' },
  { key: 'finance.payment.record', description: 'تسجيل دفعة يدوية موثقة' },
  { key: 'finance.refund.process', description: 'اعتماد وتنفيذ الاسترداد' },
  // التقارير
  { key: 'reports.view', description: 'عرض التقارير التشغيلية' },
  { key: 'reports.export', description: 'تصدير التقارير CSV/XLSX' },
  // الإشعارات والدعم والإعدادات
  { key: 'notifications.manage', description: 'إدارة قوالب الإشعارات وسجلها' },
  { key: 'support.operate', description: 'تشغيل تذاكر الدعم المسندة' },
  { key: 'support.assign', description: 'إسناد تذاكر الدعم لوكلاء' },
  { key: 'settings.manage', description: 'إدارة إعدادات النظام والتكاملات غير السرية' },
  /* التقييم (١و) — مفاتيح مستقلّة عن حزم الأدوار العريضة: trainer.portal يفتح
     البوابة كلها، وقراءةُ ما يُقال عنك حبّةٌ أدقّ من ذلك. */
  { key: 'rating.submit', description: 'إرسال تقييم للمدرب أو المستشار أو الدورة' },
  { key: 'rating.view.subject', description: 'رؤية التقييمات الواردة عنك مجهولةَ المُقيِّم' },
  { key: 'rating.moderate', description: 'مراجعة تعليقات التقييم واعتماد نشرها' },
] as const

export type PermissionKey = (typeof PERMISSIONS)[number]['key']

/** حزم الأدوار — أقل صلاحية لازمة لكل دور */
export const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  super_admin: PERMISSIONS.map((p) => p.key),
  academic_manager: [
    'catalog.view',
    'catalog.pathway.create', 'catalog.pathway.edit', 'catalog.pathway.review', 'catalog.pathway.approve', 'catalog.pathway.publish',
    'catalog.course.create', 'catalog.course.edit', 'catalog.course.review', 'catalog.course.approve', 'catalog.course.publish',
    'catalog.skill.edit', 'catalog.skill.approve',
    'catalog.impact.view', 'catalog.rollback',
    'trainer.applications.view', 'trainer.applications.review', 'trainer.applications.decide',
    'trainer.applications.purge',
    'trainer.invite', 'trainer.qualify', 'trainer.assign', 'trainer.publish', 'trainer.suspend',
    'trainer.change.review',
    'cohort.manage', 'cohort.open', 'cohort.override_capacity', 'enrollment.manage',
    'material.manage', 'certificate.issue', 'certificate.revoke',
    'advisor.assign', 'advisor.request.review', 'advisor.learner.view', 'advisor.manage', 'cv.manage', 'cv.view',
    'enrollment.request.review', 'commerce.manage',
    'finance.view', 'finance.payment.record', 'finance.refund.process',
    'reports.view', 'reports.export',
    'notifications.manage', 'support.operate', 'support.assign', 'settings.manage',
    'rating.moderate',
    /* يرى مرؤوسيه ويفوّض لهم — ولا يعيّن الأدوار ولا يوقف الحسابات */
    'admin.users.view', 'admin.permissions.delegate',
    'audit.view',
  ],
  diagnostic_manager: [
    'catalog.view',
    'diagnostic.profile.edit', 'diagnostic.profile.review', 'diagnostic.profile.publish',
    'diagnostic.question.edit', 'diagnostic.scoring.edit', 'diagnostic.scoring.publish',
    'diagnostic.simulate', 'catalog.impact.view',
    'reports.view', 'reports.export',
  ],
  operations_manager: [
    'catalog.view', 'catalog.impact.view', 'trainer.applications.view', 'trainer.assign',
    'cohort.manage', 'enrollment.manage',
    'advisor.assign', 'enrollment.request.review', 'support.assign',
    'reports.view', 'reports.export',
  ],
  advisor: ['catalog.view', 'advisor.cases.view', 'advisor.cases.operate', 'advisor.learner.view', 'advisor.request.submit', 'cv.view', 'rating.view.subject'],
  trainer: ['trainer.portal', 'trainer.change.submit', 'trainer.cohort.operate', 'rating.view.subject'],
  /* حساب التقديم — لا بوابة متعلم ولا بوابة مدرب. يصير مدربا بالدعوة بعد
     الاعتماد (trainer.invite)، وحتى ذلك الحين لا يملك إلا رؤية طلبه. */
  trainer_applicant: ['trainer.application.own'],
  finance: ['trainer.compensation.manage', 'finance.view', 'finance.payment.record', 'finance.refund.process', 'reports.view', 'reports.export'],
  support: ['catalog.view', 'support.operate'],
  learner: ['learner.portal', 'learner.submit', 'cv.upload', 'enrollment.request', 'rating.submit'],
}

/* ═══════════ تفويض الصلاحيات — من يمنح لمن، وماذا ═══════════

   القرار: «يعطي صلاحيات للمدرب والطالب — أي أنّه يدير من هو أقلّ منه، وأيضا
   التحكّم بالمسارات والدورات وكلّ ما يتعلّق بمهامّه».

   فثلاث قواعد تجتمع، ولا يكفي واحدةٌ منها:

   أ) لا يمنح أحدٌ ما لا يملك. من لا يملك «نشر دورة» لا يمنحها لغيره — وإلّا
      صار التفويض بابا يرفع به الموظّفُ نفسَه بأيدي غيره.
   ب) ولا يمسّ إلّا من هو أقلّ منه رتبةً. والمساواة لا تكفي: زميلان في الرتبة
      نفسها لا يتنازعان صلاحيات بعضهما، ومديرُ نظامٍ لا ينزع عن مدير نظام.
   ج) وفي حدود مهامّه وحدها. فالمدير الأكاديميّ يملك «عرض المالية» بحكم عمله
      ولا يفوّضها: عائلةُ الصلاحية تقول لمن تخصّ. */

/** رتبةُ الدور — الأعلى يدير الأدنى، ولا مساواةَ تُدير */
export const ROLE_RANK: Record<string, number> = {
  super_admin: 100,
  academic_manager: 80,
  operations_manager: 70,
  diagnostic_manager: 70,
  finance: 70,
  support: 60,
  advisor: 40,
  trainer: 30,
  trainer_applicant: 20,
  learner: 10,
}

/** عائلاتُ الصلاحيات التي يفوّضها كلُّ دور — مهامُّه لا كلُّ ما يملك */
export const DELEGATABLE_FAMILIES: Record<string, string[]> = {
  /* مديرُ النظام: كلّ شيء — ولا يستثنيه إلّا قيدُ الرتبة */
  super_admin: ['*'],
  /* المدير الأكاديميّ: المسارات والدورات والمدربون والشعب وما يتصل بالتعلّم */
  academic_manager: [
    'catalog', 'trainer', 'cohort', 'enrollment', 'material',
    'certificate', 'learner', 'rating', 'cv',
  ],
}

export function rankOf(roles: readonly string[]): number {
  return roles.reduce((max, r) => Math.max(max, ROLE_RANK[r] ?? 0), 0)
}

/* ─────────── قيدُ الرتبة على تعيين الأدوار ───────────

   كان `POST /users/:id/roles` بلا قيدِ رتبةٍ إطلاقا: من يملك
   `admin.users.manage` يُسند أيَّ دورٍ لأيّ أحد — بما فيه `super_admin`
   لنفسه.

   ولم يكن ذلك مفتوحا اليوم لأنّ الحبّة لا يملكها إلّا مديرُ النظام. لكنّ
   التفويضَ يجعلها قابلةً للمنح (`admin.permissions.delegate`)، فمن مُنحها
   مرّةً لغرضٍ ضيّق صار يستطيع أن يرقّي نفسه — وهو تصعيدٌ صامت لا يظهر في
   أيّ شاشة.

   والقاعدة: لا يُعيَّن دورٌ أعلى من رتبة المعيِّن. والمساواةُ مقبولة، وإلّا
   لم يستطع مديرُ نظامٍ أن يعيّن مديرَ نظامٍ آخر أبدا. */
export function refuseRoleAssignment(
  actorRoles: readonly string[],
  roleIds: readonly string[],
): DelegationRefusal | null {
  const actorRank = rankOf(actorRoles)
  const tooHigh = roleIds.filter((r) => (ROLE_RANK[r] ?? 0) > actorRank)
  if (tooHigh.length > 0) {
    const names = tooHigh.map((r) => ROLE_NAMES_AR[r] ?? r).join('، ')
    return {
      code: 'rank_exceeded',
      message_ar: `لا تعيّن دورا أعلى من رتبتك: ${names}`,
    }
  }
  const unknown = roleIds.filter((r) => !(r in ROLE_RANK))
  if (unknown.length > 0) {
    return { code: 'unknown_role', message_ar: `دورٌ غير معروف: ${unknown.join('، ')}` }
  }
  return null
}

export interface DelegationRefusal { code: string; message_ar: string }

/** أيجوز لهذا أن يمنح تلك الصلاحية لذاك؟ — أو لماذا لا يجوز */
export function refuseDelegation(actor: {
  roles: readonly string[]
  permissions: readonly string[]
}, target: { roles: readonly string[] }, permissionKey: string): DelegationRefusal | null {
  const families = actor.roles.flatMap((r) => DELEGATABLE_FAMILIES[r] ?? [])
  if (families.length === 0) {
    return { code: 'not_delegator', message_ar: 'حسابك لا يفوّض الصلاحيات' }
  }
  if (rankOf(actor.roles) <= rankOf(target.roles)) {
    return { code: 'rank_too_low', message_ar: 'لا تُدار إلّا صلاحياتُ من هو أقلّ منك رتبة' }
  }
  const family = permissionKey.split('.')[0]
  if (!families.includes('*') && !families.includes(family)) {
    return { code: 'out_of_scope', message_ar: 'هذه الصلاحية خارج مهامّك — راجع مدير النظام' }
  }
  /* ولا يمنح ما لا يملك: يُفحص أخيرا كي تسبقه الرسائلُ الأوضح */
  if (!families.includes('*') && !actor.permissions.includes(permissionKey)) {
    return { code: 'not_held', message_ar: 'لا تُفوَّض صلاحيةٌ لا تملكها أنت' }
  }
  return null
}

export const ROLE_NAMES_AR: Record<string, string> = {
  super_admin: 'مدير النظام الأعلى',
  academic_manager: 'المدير الأكاديمي',
  diagnostic_manager: 'مدير التشخيص',
  operations_manager: 'مدير العمليات',
  advisor: 'مستشار',
  trainer: 'مدرب',
  trainer_applicant: 'متقدّم لعضوية التدريب',
  finance: 'المالية',
  support: 'الدعم',
  learner: 'متعلم',
}

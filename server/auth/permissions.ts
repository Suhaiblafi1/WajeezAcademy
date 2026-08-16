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
  { key: 'catalog.impact.view', description: 'عرض تحليل الأثر قبل النشر' },
  { key: 'catalog.rollback', description: 'الرجوع إلى إصدار سابق منشور' },
  // الإدارة
  { key: 'admin.users.manage', description: 'إدارة المستخدمين والأدوار وإيقاف الحسابات' },
  // منظومة المدربين — الإدارة
  { key: 'trainer.applications.view', description: 'عرض طلبات انضمام المدربين' },
  { key: 'trainer.applications.review', description: 'مراجعة الطلبات وتسجيل الروبرك والمقابلات والديمو' },
  { key: 'trainer.applications.decide', description: 'قرار القبول المشروط أو الرفض أو الانتظار' },
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
    'trainer.invite', 'trainer.qualify', 'trainer.assign', 'trainer.publish', 'trainer.suspend',
    'trainer.change.review',
    'cohort.manage', 'cohort.open', 'cohort.override_capacity', 'enrollment.manage',
    'material.manage', 'certificate.issue', 'certificate.revoke',
  ],
  diagnostic_manager: [
    'catalog.view',
    'diagnostic.profile.edit', 'diagnostic.profile.review', 'diagnostic.profile.publish',
    'diagnostic.question.edit', 'diagnostic.scoring.edit', 'diagnostic.scoring.publish',
    'diagnostic.simulate', 'catalog.impact.view',
  ],
  operations_manager: ['catalog.view', 'catalog.impact.view', 'trainer.applications.view', 'trainer.assign', 'cohort.manage', 'enrollment.manage'],
  advisor: ['catalog.view'],
  trainer: ['trainer.portal', 'trainer.change.submit', 'trainer.cohort.operate'],
  finance: ['trainer.compensation.manage'],
  support: ['catalog.view'],
  learner: ['learner.portal', 'learner.submit'],
}

export const ROLE_NAMES_AR: Record<string, string> = {
  super_admin: 'مدير النظام الأعلى',
  academic_manager: 'المدير الأكاديمي',
  diagnostic_manager: 'مدير التشخيص',
  operations_manager: 'مدير العمليات',
  advisor: 'مستشار',
  trainer: 'مدرب',
  finance: 'المالية',
  support: 'الدعم',
  learner: 'متعلم',
}

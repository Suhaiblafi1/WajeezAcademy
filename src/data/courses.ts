/* كتالوج الدورات — مستخرج آليا من wajeez_ready_pathway_map_v1 (فتحات كل مسار) */

export interface Course {
  id: string
  name: string
  pathwayId: string
  pathwayName: string
  category: string
  weeks: number
  skill: string
}

export const courses: Course[] = [
  { id: 'CRS-BIZ-001-01', name: 'فكرة وعميل', pathwayId: 'PW-BIZ-001', pathwayName: 'تأسيس مشروع من الفكرة إلى أول بيع', category: 'أعمال', weeks: 2, skill: 'نموذج العمل' },
  { id: 'CRS-BIZ-001-02', name: 'عرض قيمة', pathwayId: 'PW-BIZ-001', pathwayName: 'تأسيس مشروع من الفكرة إلى أول بيع', category: 'أعمال', weeks: 2, skill: 'عرض القيمة' },
  { id: 'CRS-BIZ-001-03', name: 'بحث وتجارب', pathwayId: 'PW-BIZ-001', pathwayName: 'تأسيس مشروع من الفكرة إلى أول بيع', category: 'أعمال', weeks: 2, skill: 'اكتشاف العملاء' },
  { id: 'CRS-BIZ-001-04', name: 'تسعير وبيع أول', pathwayId: 'PW-BIZ-001', pathwayName: 'تأسيس مشروع من الفكرة إلى أول بيع', category: 'أعمال', weeks: 2, skill: 'بحث السوق' },
  { id: 'CRS-BIZ-001-05', name: 'خطة 90 يوم', pathwayId: 'PW-BIZ-001', pathwayName: 'تأسيس مشروع من الفكرة إلى أول بيع', category: 'أعمال', weeks: 2, skill: 'أساسيات المبيعات' },
  { id: 'CRS-BIZ-002-01', name: 'تشخيص عنق الزجاجة', pathwayId: 'PW-BIZ-002', pathwayName: 'نمو مشروع قائم', category: 'أعمال', weeks: 2, skill: 'تحليل المنافسين' },
  { id: 'CRS-BIZ-002-02', name: 'سوق ومنافسة', pathwayId: 'PW-BIZ-002', pathwayName: 'نمو مشروع قائم', category: 'أعمال', weeks: 2, skill: 'إدارة خط المبيعات' },
  { id: 'CRS-BIZ-002-03', name: 'مبيعات واحتفاظ', pathwayId: 'PW-BIZ-002', pathwayName: 'نمو مشروع قائم', category: 'أعمال', weeks: 2, skill: 'تجارب النمو' },
  { id: 'CRS-BIZ-002-04', name: 'تشغيل وتدفق نقدي', pathwayId: 'PW-BIZ-002', pathwayName: 'نمو مشروع قائم', category: 'أعمال', weeks: 2, skill: 'أساسيات العمليات' },
  { id: 'CRS-BIZ-002-05', name: 'تجارب نمو', pathwayId: 'PW-BIZ-002', pathwayName: 'نمو مشروع قائم', category: 'أعمال', weeks: 2, skill: 'إدارة التدفق النقدي' },
  { id: 'CRS-BIZ-003-01', name: 'فهم القيمة', pathwayId: 'PW-BIZ-003', pathwayName: 'التسعير والمبيعات', category: 'أعمال', weeks: 2, skill: 'استراتيجية التسعير' },
  { id: 'CRS-BIZ-003-02', name: 'نماذج التسعير', pathwayId: 'PW-BIZ-003', pathwayName: 'التسعير والمبيعات', category: 'أعمال', weeks: 2, skill: 'أساسيات المبيعات' },
  { id: 'CRS-BIZ-003-03', name: 'حوار بيع', pathwayId: 'PW-BIZ-003', pathwayName: 'التسعير والمبيعات', category: 'أعمال', weeks: 2, skill: 'إدارة خط المبيعات' },
  { id: 'CRS-BIZ-003-04', name: 'قمع ومتابعة', pathwayId: 'PW-BIZ-003', pathwayName: 'التسعير والمبيعات', category: 'أعمال', weeks: 2, skill: 'التفاوض التجاري' },
  { id: 'CRS-BIZ-003-05', name: 'تجربة تسعير', pathwayId: 'PW-BIZ-003', pathwayName: 'التسعير والمبيعات', category: 'أعمال', weeks: 2, skill: 'عرض القيمة' },
  { id: 'CRS-BIZ-004-01', name: 'عميل ورسالة', pathwayId: 'PW-BIZ-004', pathwayName: 'التسويق الرقمي لصاحب المشروع', category: 'أعمال', weeks: 2, skill: 'التسويق الرقمي' },
  { id: 'CRS-BIZ-004-02', name: 'اختيار القناة', pathwayId: 'PW-BIZ-004', pathwayName: 'التسويق الرقمي لصاحب المشروع', category: 'أعمال', weeks: 2, skill: 'تسويق المحتوى' },
  { id: 'CRS-BIZ-004-03', name: 'خطة محتوى', pathwayId: 'PW-BIZ-004', pathwayName: 'التسويق الرقمي لصاحب المشروع', category: 'أعمال', weeks: 2, skill: 'استراتيجية الشبكات الاجتماعية' },
  { id: 'CRS-BIZ-004-04', name: 'قياس وتحسين', pathwayId: 'PW-BIZ-004', pathwayName: 'التسويق الرقمي لصاحب المشروع', category: 'أعمال', weeks: 2, skill: 'استراتيجية العلامة' },
  { id: 'CRS-BIZ-004-05', name: 'حملة صغيرة', pathwayId: 'PW-BIZ-004', pathwayName: 'التسويق الرقمي لصاحب المشروع', category: 'أعمال', weeks: 2, skill: 'بحث السوق' },
  { id: 'CRS-BIZ-005-01', name: 'خريطة عمليات', pathwayId: 'PW-BIZ-005', pathwayName: 'العمليات والتدفق النقدي', category: 'أعمال', weeks: 2, skill: 'أساسيات العمليات' },
  { id: 'CRS-BIZ-005-02', name: 'تكلفة وتدفق نقدي', pathwayId: 'PW-BIZ-005', pathwayName: 'العمليات والتدفق النقدي', category: 'أعمال', weeks: 2, skill: 'تصميم الإجراءات' },
  { id: 'CRS-BIZ-005-03', name: 'موردون ومخاطر', pathwayId: 'PW-BIZ-005', pathwayName: 'العمليات والتدفق النقدي', category: 'أعمال', weeks: 2, skill: 'إدارة التدفق النقدي' },
  { id: 'CRS-BIZ-005-04', name: 'مؤشرات تشغيل', pathwayId: 'PW-BIZ-005', pathwayName: 'العمليات والتدفق النقدي', category: 'أعمال', weeks: 2, skill: 'مالية المشروع' },
  { id: 'CRS-BIZ-005-05', name: 'تحسين إجراء', pathwayId: 'PW-BIZ-005', pathwayName: 'العمليات والتدفق النقدي', category: 'أعمال', weeks: 2, skill: 'إدارة الموردين' },
  { id: 'CRS-CAREER-001-01', name: 'تدقيق دوافع التغيير', pathwayId: 'PW-CAREER-001', pathwayName: 'تغيير مسار مهني منظم', category: 'طلاب ومهنة', weeks: 2, skill: 'تغيير المسار المهني' },
  { id: 'CRS-CAREER-001-02', name: 'خريطة مهارات قابلة للنقل', pathwayId: 'PW-CAREER-001', pathwayName: 'تغيير مسار مهني منظم', category: 'طلاب ومهنة', weeks: 2, skill: 'الاحتراف في بيئة العمل' },
  { id: 'CRS-CAREER-001-03', name: 'بحث السوق', pathwayId: 'PW-CAREER-001', pathwayName: 'تغيير مسار مهني منظم', category: 'طلاب ومهنة', weeks: 2, skill: 'تخطيط المسار المهني' },
  { id: 'CRS-CAREER-001-04', name: 'تجربة انتقال صغيرة', pathwayId: 'PW-CAREER-001', pathwayName: 'تغيير مسار مهني منظم', category: 'طلاب ومهنة', weeks: 2, skill: 'بناء ملف الأعمال' },
  { id: 'CRS-CAREER-001-05', name: 'خطة 180 يوما', pathwayId: 'PW-CAREER-001', pathwayName: 'تغيير مسار مهني منظم', category: 'طلاب ومهنة', weeks: 2, skill: 'اتخاذ القرار' },
  { id: 'CRS-CAREER-002-01', name: 'تموضع مهني', pathwayId: 'PW-CAREER-002', pathwayName: 'ملف مهني ومحفظة أعمال', category: 'طلاب ومهنة', weeks: 1, skill: 'بناء ملف الأعمال' },
  { id: 'CRS-CAREER-002-02', name: 'سيرة', pathwayId: 'PW-CAREER-002', pathwayName: 'ملف مهني ومحفظة أعمال', category: 'طلاب ومهنة', weeks: 1, skill: 'العلامة المهنية الشخصية' },
  { id: 'CRS-CAREER-002-03', name: 'نبذة', pathwayId: 'PW-CAREER-002', pathwayName: 'ملف مهني ومحفظة أعمال', category: 'طلاب ومهنة', weeks: 1, skill: 'كتابة السيرة الذاتية' },
  { id: 'CRS-CAREER-002-04', name: 'اختيار مخرجات', pathwayId: 'PW-CAREER-002', pathwayName: 'ملف مهني ومحفظة أعمال', category: 'طلاب ومهنة', weeks: 1, skill: 'بناء ملف LinkedIn' },
  { id: 'CRS-CAREER-002-05', name: 'تصميم محفظة', pathwayId: 'PW-CAREER-002', pathwayName: 'ملف مهني ومحفظة أعمال', category: 'طلاب ومهنة', weeks: 1, skill: 'تصميم المستندات المهنية' },
  { id: 'CRS-CAREER-002-06', name: 'مراجعة ونشر', pathwayId: 'PW-CAREER-002', pathwayName: 'ملف مهني ومحفظة أعمال', category: 'طلاب ومهنة', weeks: 1, skill: 'بناء ملف الأعمال' },
  { id: 'CRS-CAREER-003-01', name: 'قصة مهنية', pathwayId: 'PW-CAREER-003', pathwayName: 'مقابلات وعرض ذات احترافي', category: 'طلاب ومهنة', weeks: 1, skill: 'مهارات المقابلات' },
  { id: 'CRS-CAREER-003-02', name: 'أسئلة سلوكية', pathwayId: 'PW-CAREER-003', pathwayName: 'مقابلات وعرض ذات احترافي', category: 'طلاب ومهنة', weeks: 1, skill: 'التعبير الواضح' },
  { id: 'CRS-CAREER-003-03', name: 'محاكاة مقابلة', pathwayId: 'PW-CAREER-003', pathwayName: 'مقابلات وعرض ذات احترافي', category: 'طلاب ومهنة', weeks: 1, skill: 'السرد القصصي' },
  { id: 'CRS-CAREER-003-04', name: 'تفاوض أولي', pathwayId: 'PW-CAREER-003', pathwayName: 'مقابلات وعرض ذات احترافي', category: 'طلاب ومهنة', weeks: 1, skill: 'الإصغاء الفعال' },
  { id: 'CRS-CAREER-003-05', name: 'تحسين نهائي', pathwayId: 'PW-CAREER-003', pathwayName: 'مقابلات وعرض ذات احترافي', category: 'طلاب ومهنة', weeks: 1, skill: 'التفاوض على العرض الوظيفي' },
  { id: 'CRS-EMP-001-01', name: 'سلوك مهني وتوقعات', pathwayId: 'PW-EMP-001', pathwayName: 'الموظف المحترف في القطاع الخاص', category: 'موظفون', weeks: 2, skill: 'الاحتراف في بيئة العمل' },
  { id: 'CRS-EMP-001-02', name: 'أولويات وإدارة وقت', pathwayId: 'PW-EMP-001', pathwayName: 'الموظف المحترف في القطاع الخاص', category: 'موظفون', weeks: 2, skill: 'ترتيب الأولويات' },
  { id: 'CRS-EMP-001-03', name: 'تواصل وتقارير', pathwayId: 'PW-EMP-001', pathwayName: 'الموظف المحترف في القطاع الخاص', category: 'موظفون', weeks: 2, skill: 'التعبير الواضح' },
  { id: 'CRS-EMP-001-04', name: 'إنتاجية رقمية', pathwayId: 'PW-EMP-001', pathwayName: 'الموظف المحترف في القطاع الخاص', category: 'موظفون', weeks: 2, skill: 'الإنتاجية الرقمية' },
  { id: 'CRS-EMP-001-05', name: 'خطة أثر وظيفي', pathwayId: 'PW-EMP-001', pathwayName: 'الموظف المحترف في القطاع الخاص', category: 'موظفون', weeks: 2, skill: 'استقبال الملاحظات' },
  { id: 'CRS-EMP-002-01', name: 'من سؤال إلى تقرير', pathwayId: 'PW-EMP-002', pathwayName: 'كتابة التقارير والعروض المهنية', category: 'موظفون', weeks: 1, skill: 'كتابة التقارير' },
  { id: 'CRS-EMP-002-02', name: 'ملخص تنفيذي', pathwayId: 'PW-EMP-002', pathwayName: 'كتابة التقارير والعروض المهنية', category: 'موظفون', weeks: 1, skill: 'كتابة الملخص التنفيذي' },
  { id: 'CRS-EMP-002-03', name: 'تصميم مستند', pathwayId: 'PW-EMP-002', pathwayName: 'كتابة التقارير والعروض المهنية', category: 'موظفون', weeks: 1, skill: 'تصميم المستندات المهنية' },
  { id: 'CRS-EMP-002-04', name: 'عرض قرار', pathwayId: 'PW-EMP-002', pathwayName: 'كتابة التقارير والعروض المهنية', category: 'موظفون', weeks: 1, skill: 'أدوات العروض التقديمية' },
  { id: 'CRS-EMP-002-05', name: 'مراجعة مدير', pathwayId: 'PW-EMP-002', pathwayName: 'كتابة التقارير والعروض المهنية', category: 'موظفون', weeks: 1, skill: 'مهارة الإيجاز والإحاطة' },
  { id: 'CRS-EMP-003-01', name: 'تعريف المشروع', pathwayId: 'PW-EMP-003', pathwayName: 'إدارة المشاريع للموظفين', category: 'موظفون', weeks: 2, skill: 'إدارة المشاريع' },
  { id: 'CRS-EMP-003-02', name: 'نطاق وجدول', pathwayId: 'PW-EMP-003', pathwayName: 'إدارة المشاريع للموظفين', category: 'موظفون', weeks: 2, skill: 'تحديد الأهداف وOKRs' },
  { id: 'CRS-EMP-003-03', name: 'أصحاب مصلحة', pathwayId: 'PW-EMP-003', pathwayName: 'إدارة المشاريع للموظفين', category: 'موظفون', weeks: 2, skill: 'إدارة أصحاب المصلحة' },
  { id: 'CRS-EMP-003-04', name: 'مخاطر ومتابعة', pathwayId: 'PW-EMP-003', pathwayName: 'إدارة المشاريع للموظفين', category: 'موظفون', weeks: 2, skill: 'إدارة المخاطر' },
  { id: 'CRS-EMP-003-05', name: 'تقرير إغلاق', pathwayId: 'PW-EMP-003', pathwayName: 'إدارة المشاريع للموظفين', category: 'موظفون', weeks: 2, skill: 'إيقاع الاجتماعات والمتابعة' },
  { id: 'CRS-EMP-004-01', name: 'أساسيات البيانات', pathwayId: 'PW-EMP-004', pathwayName: 'الموظف المعتمد على البيانات', category: 'موظفون', weeks: 2, skill: 'الثقافة البيانية' },
  { id: 'CRS-EMP-004-02', name: 'جداول وتحليل بسيط', pathwayId: 'PW-EMP-004', pathwayName: 'الموظف المعتمد على البيانات', category: 'موظفون', weeks: 2, skill: 'أساسيات الجداول الإلكترونية' },
  { id: 'CRS-EMP-004-03', name: 'تصميم KPI', pathwayId: 'PW-EMP-004', pathwayName: 'الموظف المعتمد على البيانات', category: 'موظفون', weeks: 2, skill: 'تصميم مؤشرات الأداء' },
  { id: 'CRS-EMP-004-04', name: 'قراءة لوحة مؤشرات', pathwayId: 'PW-EMP-004', pathwayName: 'الموظف المعتمد على البيانات', category: 'موظفون', weeks: 2, skill: 'قراءة لوحات المؤشرات' },
  { id: 'CRS-EMP-004-05', name: 'قصة بيانات', pathwayId: 'PW-EMP-004', pathwayName: 'الموظف المعتمد على البيانات', category: 'موظفون', weeks: 2, skill: 'سرد القصة بالبيانات' },
  { id: 'CRS-EMP-005-01', name: 'تغيير الدور', pathwayId: 'PW-EMP-005', pathwayName: 'مدير جديد في أول 90 يوم', category: 'موظفون', weeks: 2, skill: 'قيادة الفريق' },
  { id: 'CRS-EMP-005-02', name: 'توقعات الفريق', pathwayId: 'PW-EMP-005', pathwayName: 'مدير جديد في أول 90 يوم', category: 'موظفون', weeks: 2, skill: 'التفويض' },
  { id: 'CRS-EMP-005-03', name: 'تفويض ومتابعة', pathwayId: 'PW-EMP-005', pathwayName: 'مدير جديد في أول 90 يوم', category: 'موظفون', weeks: 2, skill: 'إعطاء الملاحظات' },
  { id: 'CRS-EMP-005-04', name: 'تغذية راجعة وأداء', pathwayId: 'PW-EMP-005', pathwayName: 'مدير جديد في أول 90 يوم', category: 'موظفون', weeks: 2, skill: 'إدارة الأداء' },
  { id: 'CRS-EMP-005-05', name: 'خطة 90 يوم', pathwayId: 'PW-EMP-005', pathwayName: 'مدير جديد في أول 90 يوم', category: 'موظفون', weeks: 2, skill: 'إيقاع الاجتماعات والمتابعة' },
  { id: 'CRS-EMP-006-01', name: 'فهم العميل', pathwayId: 'PW-EMP-006', pathwayName: 'خدمة العملاء ونجاح العملاء', category: 'موظفون', weeks: 1, skill: 'التواصل مع العملاء أو الجمهور' },
  { id: 'CRS-EMP-006-02', name: 'حوار وشكوى', pathwayId: 'PW-EMP-006', pathwayName: 'خدمة العملاء ونجاح العملاء', category: 'موظفون', weeks: 1, skill: 'الإصغاء الفعال' },
  { id: 'CRS-EMP-006-03', name: 'رحلة خدمة', pathwayId: 'PW-EMP-006', pathwayName: 'خدمة العملاء ونجاح العملاء', category: 'موظفون', weeks: 1, skill: 'التعامل مع الشكاوى' },
  { id: 'CRS-EMP-006-04', name: 'مؤشرات رضا', pathwayId: 'PW-EMP-006', pathwayName: 'خدمة العملاء ونجاح العملاء', category: 'موظفون', weeks: 1, skill: 'نجاح العملاء' },
  { id: 'CRS-EMP-006-05', name: 'تحسين تجربة', pathwayId: 'PW-EMP-006', pathwayName: 'خدمة العملاء ونجاح العملاء', category: 'موظفون', weeks: 1, skill: 'حل النزاعات' },
  { id: 'CRS-FAM-001-01', name: 'رؤية أسرية', pathwayId: 'PW-FAM-001', pathwayName: 'الأب/الأم كقائد تعلم داخل الأسرة', category: 'أسرة ورفاه', weeks: 1, skill: 'التواصل مع الأبناء' },
  { id: 'CRS-FAM-001-02', name: 'حوار مع الأبناء', pathwayId: 'PW-FAM-001', pathwayName: 'الأب/الأم كقائد تعلم داخل الأسرة', category: 'أسرة ورفاه', weeks: 1, skill: 'دعم تعلم الأبناء' },
  { id: 'CRS-FAM-001-03', name: 'روتين تعلم', pathwayId: 'PW-FAM-001', pathwayName: 'الأب/الأم كقائد تعلم داخل الأسرة', category: 'أسرة ورفاه', weeks: 1, skill: 'ثقافة القراءة في الأسرة' },
  { id: 'CRS-FAM-001-04', name: 'قدوة ومتابعة', pathwayId: 'PW-FAM-001', pathwayName: 'الأب/الأم كقائد تعلم داخل الأسرة', category: 'أسرة ورفاه', weeks: 1, skill: 'تحديد أهداف عائلية' },
  { id: 'CRS-FAM-001-05', name: 'نشاط أسري', pathwayId: 'PW-FAM-001', pathwayName: 'الأب/الأم كقائد تعلم داخل الأسرة', category: 'أسرة ورفاه', weeks: 1, skill: 'القدوة العملية' },
  { id: 'CRS-FAM-002-01', name: 'المال بلغة الطفل', pathwayId: 'PW-FAM-002', pathwayName: 'الثقافة المالية والرقمية للأبناء', category: 'أسرة ورفاه', weeks: 1, skill: 'الثقافة المالية للأطفال' },
  { id: 'CRS-FAM-002-02', name: 'ادخار واختيار', pathwayId: 'PW-FAM-002', pathwayName: 'الثقافة المالية والرقمية للأبناء', category: 'أسرة ورفاه', weeks: 1, skill: 'السلامة الرقمية للأطفال' },
  { id: 'CRS-FAM-002-03', name: 'سلامة رقمية', pathwayId: 'PW-FAM-002', pathwayName: 'الثقافة المالية والرقمية للأبناء', category: 'أسرة ورفاه', weeks: 1, skill: 'إدارة الحوار العائلي' },
  { id: 'CRS-FAM-002-04', name: 'حوار وقواعد', pathwayId: 'PW-FAM-002', pathwayName: 'الثقافة المالية والرقمية للأبناء', category: 'أسرة ورفاه', weeks: 1, skill: 'الوعي الاستهلاكي' },
  { id: 'CRS-FAM-002-05', name: 'نشاط عائلي', pathwayId: 'PW-FAM-002', pathwayName: 'الثقافة المالية والرقمية للأبناء', category: 'أسرة ورفاه', weeks: 1, skill: 'عادات الادخار' },
  { id: 'CRS-FAM-003-01', name: 'نمط الحوار', pathwayId: 'PW-FAM-003', pathwayName: 'حوار عائلي وتربية واعية', category: 'أسرة ورفاه', weeks: 1, skill: 'إدارة الحوار العائلي' },
  { id: 'CRS-FAM-003-02', name: 'إصغاء وحدود', pathwayId: 'PW-FAM-003', pathwayName: 'حوار عائلي وتربية واعية', category: 'أسرة ورفاه', weeks: 1, skill: 'التواصل مع الأبناء' },
  { id: 'CRS-FAM-003-03', name: 'انضباط إيجابي', pathwayId: 'PW-FAM-003', pathwayName: 'حوار عائلي وتربية واعية', category: 'أسرة ورفاه', weeks: 1, skill: 'الانضباط الإيجابي' },
  { id: 'CRS-FAM-003-04', name: 'ثقة ومسؤولية', pathwayId: 'PW-FAM-003', pathwayName: 'حوار عائلي وتربية واعية', category: 'أسرة ورفاه', weeks: 1, skill: 'دعم ثقة اليافعين' },
  { id: 'CRS-FAM-003-05', name: 'خطة بيتية', pathwayId: 'PW-FAM-003', pathwayName: 'حوار عائلي وتربية واعية', category: 'أسرة ورفاه', weeks: 1, skill: 'القدوة العملية' },
  { id: 'CRS-FND-001-01', name: 'تشخيص الهدف وسجل التعلم', pathwayId: 'PW-FND-001', pathwayName: 'أساسيات الإنسان المتعلم في وجيز', category: 'أساسيات', weeks: 1, skill: 'بناء خطة تعلم' },
  { id: 'CRS-FND-001-02', name: 'خطة تعلم شخصية', pathwayId: 'PW-FND-001', pathwayName: 'أساسيات الإنسان المتعلم في وجيز', category: 'أساسيات', weeks: 1, skill: 'التعلم الذاتي' },
  { id: 'CRS-FND-001-03', name: 'نظام تركيز أسبوعي', pathwayId: 'PW-FND-001', pathwayName: 'أساسيات الإنسان المتعلم في وجيز', category: 'أساسيات', weeks: 1, skill: 'إكمال الدورات' },
  { id: 'CRS-FND-001-04', name: 'إكمال دورة بمخرج', pathwayId: 'PW-FND-001', pathwayName: 'أساسيات الإنسان المتعلم في وجيز', category: 'أساسيات', weeks: 1, skill: 'إدارة التركيز' },
  { id: 'CRS-FND-001-05', name: 'محفظة تعلم أولية', pathwayId: 'PW-FND-001', pathwayName: 'أساسيات الإنسان المتعلم في وجيز', category: 'أساسيات', weeks: 1, skill: 'ثبات الهدف' },
  { id: 'CRS-FND-002-01', name: 'أساسيات التعامل الرقمي', pathwayId: 'PW-FND-002', pathwayName: 'الكفاءة الرقمية للحياة والعمل', category: 'أساسيات', weeks: 1, skill: 'الثقافة الرقمية العامة' },
  { id: 'CRS-FND-002-02', name: 'بحث وتحقق من المعلومات', pathwayId: 'PW-FND-002', pathwayName: 'الكفاءة الرقمية للحياة والعمل', category: 'أساسيات', weeks: 1, skill: 'البحث الرقمي الفعال' },
  { id: 'CRS-FND-002-03', name: 'تنظيم ملفات وسحابة', pathwayId: 'PW-FND-002', pathwayName: 'الكفاءة الرقمية للحياة والعمل', category: 'أساسيات', weeks: 1, skill: 'تقييم موثوقية المعلومات' },
  { id: 'CRS-FND-002-04', name: 'أمان وخصوصية', pathwayId: 'PW-FND-002', pathwayName: 'الكفاءة الرقمية للحياة والعمل', category: 'أساسيات', weeks: 1, skill: 'إدارة الملفات الرقمية' },
  { id: 'CRS-FND-002-05', name: 'إنتاجية رقمية وتطبيق نهائي', pathwayId: 'PW-FND-002', pathwayName: 'الكفاءة الرقمية للحياة والعمل', category: 'أساسيات', weeks: 1, skill: 'الإنتاجية الرقمية' },
  { id: 'CRS-FND-003-01', name: 'فهم قدرات وحدود AI', pathwayId: 'PW-FND-003', pathwayName: 'الذكاء الاصطناعي لكل متعلم', category: 'أساسيات', weeks: 1, skill: 'الثقافة العامة في الذكاء الاصطناعي' },
  { id: 'CRS-FND-003-02', name: 'كتابة الطلبات', pathwayId: 'PW-FND-003', pathwayName: 'الذكاء الاصطناعي لكل متعلم', category: 'أساسيات', weeks: 1, skill: 'أساسيات التوجيه وكتابة الطلبات' },
  { id: 'CRS-FND-003-03', name: 'تحسين الطلبات', pathwayId: 'PW-FND-003', pathwayName: 'الذكاء الاصطناعي لكل متعلم', category: 'أساسيات', weeks: 1, skill: 'تحسين الطلبات بالتكرار' },
  { id: 'CRS-FND-003-04', name: 'التحقق من المخرجات', pathwayId: 'PW-FND-003', pathwayName: 'الذكاء الاصطناعي لكل متعلم', category: 'أساسيات', weeks: 1, skill: 'تقييم مخرجات الذكاء الاصطناعي' },
  { id: 'CRS-FND-003-05', name: 'تطبيق تعلم أو عمل', pathwayId: 'PW-FND-003', pathwayName: 'الذكاء الاصطناعي لكل متعلم', category: 'أساسيات', weeks: 1, skill: 'التحقق من حقائق مخرجات AI' },
  { id: 'CRS-FND-004-01', name: 'صورة مالية حالية', pathwayId: 'PW-FND-004', pathwayName: 'الثقافة المالية الشخصية', category: 'أساسيات', weeks: 1, skill: 'إعداد الميزانية الشخصية' },
  { id: 'CRS-FND-004-02', name: 'ميزانية وسلوك إنفاق', pathwayId: 'PW-FND-004', pathwayName: 'الثقافة المالية الشخصية', category: 'أساسيات', weeks: 1, skill: 'عادات الادخار' },
  { id: 'CRS-FND-004-03', name: 'ادخار وطوارئ', pathwayId: 'PW-FND-004', pathwayName: 'الثقافة المالية الشخصية', category: 'أساسيات', weeks: 1, skill: 'إدارة الديون' },
  { id: 'CRS-FND-004-04', name: 'الدين والمخاطر', pathwayId: 'PW-FND-004', pathwayName: 'الثقافة المالية الشخصية', category: 'أساسيات', weeks: 1, skill: 'صندوق الطوارئ' },
  { id: 'CRS-FND-004-05', name: 'أهداف مالية وخطة متابعة', pathwayId: 'PW-FND-004', pathwayName: 'الثقافة المالية الشخصية', category: 'أساسيات', weeks: 1, skill: 'تحديد الأهداف المالية' },
  { id: 'CRS-FND-005-01', name: 'وضوح الفكرة', pathwayId: 'PW-FND-005', pathwayName: 'التواصل والخطابة الأساسية', category: 'أساسيات', weeks: 1, skill: 'الإصغاء الفعال' },
  { id: 'CRS-FND-005-02', name: 'إصغاء وحوار', pathwayId: 'PW-FND-005', pathwayName: 'التواصل والخطابة الأساسية', category: 'أساسيات', weeks: 1, skill: 'التعبير الواضح' },
  { id: 'CRS-FND-005-03', name: 'بناء عرض قصير', pathwayId: 'PW-FND-005', pathwayName: 'التواصل والخطابة الأساسية', category: 'أساسيات', weeks: 1, skill: 'الإلقاء والعرض' },
  { id: 'CRS-FND-005-04', name: 'تدريب إلقاء', pathwayId: 'PW-FND-005', pathwayName: 'التواصل والخطابة الأساسية', category: 'أساسيات', weeks: 1, skill: 'الخطابة والتحدث العام' },
  { id: 'CRS-FND-005-05', name: 'تغذية راجعة وتحسين', pathwayId: 'PW-FND-005', pathwayName: 'التواصل والخطابة الأساسية', category: 'أساسيات', weeks: 1, skill: 'الحضور والصوت' },
  { id: 'CRS-FND-006-01', name: 'تدقيق التشتت', pathwayId: 'PW-FND-006', pathwayName: 'التركيز وإدارة التعلم', category: 'أساسيات', weeks: 1, skill: 'إدارة التركيز' },
  { id: 'CRS-FND-006-02', name: 'نظام أسبوعي', pathwayId: 'PW-FND-006', pathwayName: 'التركيز وإدارة التعلم', category: 'أساسيات', weeks: 1, skill: 'إدارة الوقت' },
  { id: 'CRS-FND-006-03', name: 'عادة تعلم صغيرة', pathwayId: 'PW-FND-006', pathwayName: 'التركيز وإدارة التعلم', category: 'أساسيات', weeks: 1, skill: 'تقليل التشتت' },
  { id: 'CRS-FND-006-04', name: 'إكمال وحدة بمخرج', pathwayId: 'PW-FND-006', pathwayName: 'التركيز وإدارة التعلم', category: 'أساسيات', weeks: 1, skill: 'بناء العادات' },
  { id: 'CRS-FND-006-05', name: 'مراجعة وتثبيت', pathwayId: 'PW-FND-006', pathwayName: 'التركيز وإدارة التعلم', category: 'أساسيات', weeks: 1, skill: 'إكمال الدورات' },
  { id: 'CRS-FND-007-01', name: 'تشخيص اللغة العملية', pathwayId: 'PW-FND-007', pathwayName: 'الإنجليزية المهنية الأولى', category: 'أساسيات', weeks: 2, skill: 'الإنجليزية للعمل والتعلم' },
  { id: 'CRS-FND-007-02', name: 'مراسلات ومفردات عمل', pathwayId: 'PW-FND-007', pathwayName: 'الإنجليزية المهنية الأولى', category: 'أساسيات', weeks: 2, skill: 'الإصغاء الفعال' },
  { id: 'CRS-FND-007-03', name: 'محادثة واجتماعات', pathwayId: 'PW-FND-007', pathwayName: 'الإنجليزية المهنية الأولى', category: 'أساسيات', weeks: 2, skill: 'التعبير الواضح' },
  { id: 'CRS-FND-007-04', name: 'مقابلات وتقديم ذاتي', pathwayId: 'PW-FND-007', pathwayName: 'الإنجليزية المهنية الأولى', category: 'أساسيات', weeks: 2, skill: 'مهارات المقابلات' },
  { id: 'CRS-FND-007-05', name: 'تطبيق مهني', pathwayId: 'PW-FND-007', pathwayName: 'الإنجليزية المهنية الأولى', category: 'أساسيات', weeks: 2, skill: 'الاحتراف في بيئة العمل' },
  { id: 'CRS-FREE-001-01', name: 'اختيار خدمة', pathwayId: 'PW-FREE-001', pathwayName: 'المستقل المحترف', category: 'أعمال', weeks: 2, skill: 'عرض القيمة' },
  { id: 'CRS-FREE-001-02', name: 'تموضع ومحفظة', pathwayId: 'PW-FREE-001', pathwayName: 'المستقل المحترف', category: 'أعمال', weeks: 2, skill: 'بناء ملف الأعمال' },
  { id: 'CRS-FREE-001-03', name: 'تسعير وعرض', pathwayId: 'PW-FREE-001', pathwayName: 'المستقل المحترف', category: 'أعمال', weeks: 2, skill: 'استراتيجية التسعير' },
  { id: 'CRS-FREE-001-04', name: 'إدارة عميل', pathwayId: 'PW-FREE-001', pathwayName: 'المستقل المحترف', category: 'أعمال', weeks: 2, skill: 'التواصل مع العملاء أو الجمهور' },
  { id: 'CRS-FREE-001-05', name: 'خطة جذب عملاء', pathwayId: 'PW-FREE-001', pathwayName: 'المستقل المحترف', category: 'أعمال', weeks: 2, skill: 'إدارة المشاريع' },
  { id: 'CRS-GOV-001-01', name: 'معنى الخدمة العامة', pathwayId: 'PW-GOV-001', pathwayName: 'الموظف الحكومي الأساسي', category: 'حكومي', weeks: 2, skill: 'عقلية الخدمة العامة' },
  { id: 'CRS-GOV-001-02', name: 'مراسلات حكومية', pathwayId: 'PW-GOV-001', pathwayName: 'الموظف الحكومي الأساسي', category: 'حكومي', weeks: 2, skill: 'المراسلات الحكومية' },
  { id: 'CRS-GOV-001-03', name: 'أخلاقيات وامتثال', pathwayId: 'PW-GOV-001', pathwayName: 'الموظف الحكومي الأساسي', category: 'حكومي', weeks: 2, skill: 'أخلاقيات الوظيفة العامة' },
  { id: 'CRS-GOV-001-04', name: 'تجربة المواطن', pathwayId: 'PW-GOV-001', pathwayName: 'الموظف الحكومي الأساسي', category: 'حكومي', weeks: 2, skill: 'تجربة المواطن أو المراجع' },
  { id: 'CRS-GOV-001-05', name: 'تحسين إجراء صغير', pathwayId: 'PW-GOV-001', pathwayName: 'الموظف الحكومي الأساسي', category: 'حكومي', weeks: 2, skill: 'الثقافة الرقمية العامة' },
  { id: 'CRS-GOV-002-01', name: 'سلوك الواجهة', pathwayId: 'PW-GOV-002', pathwayName: 'موظف خدمة الجمهور', category: 'حكومي', weeks: 1, skill: 'خدمة الجمهور في الصف الأمامي' },
  { id: 'CRS-GOV-002-02', name: 'استماع وشكوى', pathwayId: 'PW-GOV-002', pathwayName: 'موظف خدمة الجمهور', category: 'حكومي', weeks: 1, skill: 'تجربة المواطن أو المراجع' },
  { id: 'CRS-GOV-002-03', name: 'تهدئة وحل نزاع', pathwayId: 'PW-GOV-002', pathwayName: 'موظف خدمة الجمهور', category: 'حكومي', weeks: 1, skill: 'التعامل مع الشكاوى' },
  { id: 'CRS-GOV-002-04', name: 'رحلة المواطن', pathwayId: 'PW-GOV-002', pathwayName: 'موظف خدمة الجمهور', category: 'حكومي', weeks: 1, skill: 'الإصغاء الفعال' },
  { id: 'CRS-GOV-002-05', name: 'سيناريوهات تطبيق', pathwayId: 'PW-GOV-002', pathwayName: 'موظف خدمة الجمهور', category: 'حكومي', weeks: 1, skill: 'المرونة تحت الضغط غير السريرية' },
  { id: 'CRS-GOV-003-01', name: 'دورة الشراء', pathwayId: 'PW-GOV-003', pathwayName: 'المشتريات والعطاءات الحكومية', category: 'حكومي', weeks: 2, skill: 'المشتريات والعطاءات الحكومية' },
  { id: 'CRS-GOV-003-02', name: 'وثائق وعطاءات', pathwayId: 'PW-GOV-003', pathwayName: 'المشتريات والعطاءات الحكومية', category: 'حكومي', weeks: 2, skill: 'الامتثال والتنظيم' },
  { id: 'CRS-GOV-003-03', name: 'امتثال وأخلاقيات', pathwayId: 'PW-GOV-003', pathwayName: 'المشتريات والعطاءات الحكومية', category: 'حكومي', weeks: 2, skill: 'إدارة الموردين' },
  { id: 'CRS-GOV-003-04', name: 'موردون ومخاطر', pathwayId: 'PW-GOV-003', pathwayName: 'المشتريات والعطاءات الحكومية', category: 'حكومي', weeks: 2, skill: 'إدارة المخاطر' },
  { id: 'CRS-GOV-003-05', name: 'حالة تطبيقية', pathwayId: 'PW-GOV-003', pathwayName: 'المشتريات والعطاءات الحكومية', category: 'حكومي', weeks: 2, skill: 'المراسلات الحكومية' },
  { id: 'CRS-GOV-004-01', name: 'مفاهيم مالية عامة', pathwayId: 'PW-GOV-004', pathwayName: 'المالية العامة والموازنة', category: 'حكومي', weeks: 2, skill: 'أساسيات المالية العامة' },
  { id: 'CRS-GOV-004-02', name: 'موازنة وبنود', pathwayId: 'PW-GOV-004', pathwayName: 'المالية العامة والموازنة', category: 'حكومي', weeks: 2, skill: 'أساسيات الاقتصاد العام' },
  { id: 'CRS-GOV-004-03', name: 'تقارير ورقابة', pathwayId: 'PW-GOV-004', pathwayName: 'المالية العامة والموازنة', category: 'حكومي', weeks: 2, skill: 'قراءة القوائم المالية' },
  { id: 'CRS-GOV-004-04', name: 'مؤشرات مالية', pathwayId: 'PW-GOV-004', pathwayName: 'المالية العامة والموازنة', category: 'حكومي', weeks: 2, skill: 'اتخاذ القرار المالي' },
  { id: 'CRS-GOV-004-05', name: 'حالة قرار مالي', pathwayId: 'PW-GOV-004', pathwayName: 'المالية العامة والموازنة', category: 'حكومي', weeks: 2, skill: 'التقارير الحكومية' },
  { id: 'CRS-GOV-005-01', name: 'مفهوم الحكومة الرقمية', pathwayId: 'PW-GOV-005', pathwayName: 'التحول الرقمي الحكومي', category: 'حكومي', weeks: 2, skill: 'التحول الرقمي الحكومي' },
  { id: 'CRS-GOV-005-02', name: 'تصميم خدمة', pathwayId: 'PW-GOV-005', pathwayName: 'التحول الرقمي الحكومي', category: 'حكومي', weeks: 2, skill: 'تصميم الخدمات الحكومية' },
  { id: 'CRS-GOV-005-03', name: 'بيانات وخصوصية', pathwayId: 'PW-GOV-005', pathwayName: 'التحول الرقمي الحكومي', category: 'حكومي', weeks: 2, skill: 'تجربة المواطن أو المراجع' },
  { id: 'CRS-GOV-005-04', name: 'تغيير واعتماد', pathwayId: 'PW-GOV-005', pathwayName: 'التحول الرقمي الحكومي', category: 'حكومي', weeks: 2, skill: 'حوكمة البيانات' },
  { id: 'CRS-GOV-005-05', name: 'نموذج خدمة رقمية', pathwayId: 'PW-GOV-005', pathwayName: 'التحول الرقمي الحكومي', category: 'حكومي', weeks: 2, skill: 'إدارة التغيير' },
  { id: 'CRS-GOV-006-01', name: 'دور القائد الحكومي', pathwayId: 'PW-GOV-006', pathwayName: 'القيادة الحكومية الوسطى', category: 'حكومي', weeks: 2, skill: 'قيادة الفريق' },
  { id: 'CRS-GOV-006-02', name: 'أهداف ومؤشرات', pathwayId: 'PW-GOV-006', pathwayName: 'القيادة الحكومية الوسطى', category: 'حكومي', weeks: 2, skill: 'إدارة الأداء' },
  { id: 'CRS-GOV-006-03', name: 'أداء وفريق', pathwayId: 'PW-GOV-006', pathwayName: 'القيادة الحكومية الوسطى', category: 'حكومي', weeks: 2, skill: 'التنسيق بين الجهات' },
  { id: 'CRS-GOV-006-04', name: 'أصحاب مصلحة ومخاطر', pathwayId: 'PW-GOV-006', pathwayName: 'القيادة الحكومية الوسطى', category: 'حكومي', weeks: 2, skill: 'حوكمة القرار' },
  { id: 'CRS-GOV-006-05', name: 'مشروع تحسين خدمة', pathwayId: 'PW-GOV-006', pathwayName: 'القيادة الحكومية الوسطى', category: 'حكومي', weeks: 2, skill: 'عقلية الخدمة العامة' },
  { id: 'CRS-GOV-007-01', name: 'مبادئ حوكمة البيانات', pathwayId: 'PW-GOV-007', pathwayName: 'حوكمة البيانات الحكومية', category: 'حكومي', weeks: 2, skill: 'حوكمة البيانات الحكومية' },
  { id: 'CRS-GOV-007-02', name: 'جودة وتصنيف', pathwayId: 'PW-GOV-007', pathwayName: 'حوكمة البيانات الحكومية', category: 'حكومي', weeks: 2, skill: 'حوكمة البيانات' },
  { id: 'CRS-GOV-007-03', name: 'خصوصية ومشاركة', pathwayId: 'PW-GOV-007', pathwayName: 'حوكمة البيانات الحكومية', category: 'حكومي', weeks: 2, skill: 'إدارة الخصوصية الرقمية' },
  { id: 'CRS-GOV-007-04', name: 'مؤشرات ولوحات', pathwayId: 'PW-GOV-007', pathwayName: 'حوكمة البيانات الحكومية', category: 'حكومي', weeks: 2, skill: 'تنظيف البيانات' },
  { id: 'CRS-GOV-007-05', name: 'سياسة بيانات مصغرة', pathwayId: 'PW-GOV-007', pathwayName: 'حوكمة البيانات الحكومية', category: 'حكومي', weeks: 2, skill: 'تصميم مؤشرات الأداء' },
  { id: 'CRS-GOV-008-01', name: 'مدخل AI حكومي', pathwayId: 'PW-GOV-008', pathwayName: 'جاهزية الذكاء الاصطناعي في الحكومة', category: 'حكومي', weeks: 2, skill: 'جاهزية AI في الحكومة' },
  { id: 'CRS-GOV-008-02', name: 'حالات استخدام', pathwayId: 'PW-GOV-008', pathwayName: 'جاهزية الذكاء الاصطناعي في الحكومة', category: 'حكومي', weeks: 2, skill: 'الثقافة العامة في الذكاء الاصطناعي' },
  { id: 'CRS-GOV-008-03', name: 'خصوصية وأخلاقيات', pathwayId: 'PW-GOV-008', pathwayName: 'جاهزية الذكاء الاصطناعي في الحكومة', category: 'حكومي', weeks: 2, skill: 'تحديد حالات استخدام AI' },
  { id: 'CRS-GOV-008-04', name: 'مخاطر واعتماد', pathwayId: 'PW-GOV-008', pathwayName: 'جاهزية الذكاء الاصطناعي في الحكومة', category: 'حكومي', weeks: 2, skill: 'إدارة مخاطر AI' },
  { id: 'CRS-GOV-008-05', name: 'خطة تجربة آمنة', pathwayId: 'PW-GOV-008', pathwayName: 'جاهزية الذكاء الاصطناعي في الحكومة', category: 'حكومي', weeks: 2, skill: 'خصوصية البيانات مع AI' },
  { id: 'CRS-LEAD-001-01', name: 'قيادة الذات', pathwayId: 'PW-LEAD-001', pathwayName: 'القيادة والتأثير الاجتماعي', category: 'قيادة', weeks: 2, skill: 'قيادة الذات' },
  { id: 'CRS-LEAD-001-02', name: 'رسالة وتأثير', pathwayId: 'PW-LEAD-001', pathwayName: 'القيادة والتأثير الاجتماعي', category: 'قيادة', weeks: 2, skill: 'التواصل القيادي الاستراتيجي' },
  { id: 'CRS-LEAD-001-03', name: 'خطابة وسرد', pathwayId: 'PW-LEAD-001', pathwayName: 'القيادة والتأثير الاجتماعي', category: 'قيادة', weeks: 2, skill: 'الخطابة والتحدث العام' },
  { id: 'CRS-LEAD-001-04', name: 'أخلاقيات وثقة', pathwayId: 'PW-LEAD-001', pathwayName: 'القيادة والتأثير الاجتماعي', category: 'قيادة', weeks: 2, skill: 'التفكير الأخلاقي' },
  { id: 'CRS-LEAD-001-05', name: 'مبادرة تأثير', pathwayId: 'PW-LEAD-001', pathwayName: 'القيادة والتأثير الاجتماعي', category: 'قيادة', weeks: 2, skill: 'إدارة أصحاب المصلحة' },
  { id: 'CRS-LEAD-002-01', name: 'تشخيص التغيير', pathwayId: 'PW-LEAD-002', pathwayName: 'إدارة التغيير والفرق', category: 'قيادة', weeks: 2, skill: 'إدارة التغيير' },
  { id: 'CRS-LEAD-002-02', name: 'أصحاب مصلحة ومقاومة', pathwayId: 'PW-LEAD-002', pathwayName: 'إدارة التغيير والفرق', category: 'قيادة', weeks: 2, skill: 'قيادة الفريق' },
  { id: 'CRS-LEAD-002-03', name: 'نظام فريق', pathwayId: 'PW-LEAD-002', pathwayName: 'إدارة التغيير والفرق', category: 'قيادة', weeks: 2, skill: 'بناء الثقافة المؤسسية' },
  { id: 'CRS-LEAD-002-04', name: 'أداء ومتابعة', pathwayId: 'PW-LEAD-002', pathwayName: 'إدارة التغيير والفرق', category: 'قيادة', weeks: 2, skill: 'تصميم الدافعية' },
  { id: 'CRS-LEAD-002-05', name: 'خطة تغيير', pathwayId: 'PW-LEAD-002', pathwayName: 'إدارة التغيير والفرق', category: 'قيادة', weeks: 2, skill: 'إدارة الأداء' },
  { id: 'CRS-LEAD-003-01', name: 'أطر القرار', pathwayId: 'PW-LEAD-003', pathwayName: 'اتخاذ القرار وإدارة المخاطر', category: 'قيادة', weeks: 2, skill: 'اتخاذ القرار' },
  { id: 'CRS-LEAD-003-02', name: 'أدلة وافتراضات', pathwayId: 'PW-LEAD-003', pathwayName: 'اتخاذ القرار وإدارة المخاطر', category: 'قيادة', weeks: 2, skill: 'التفكير النقدي' },
  { id: 'CRS-LEAD-003-03', name: 'سيناريوهات ومخاطر', pathwayId: 'PW-LEAD-003', pathwayName: 'اتخاذ القرار وإدارة المخاطر', category: 'قيادة', weeks: 2, skill: 'إدارة المخاطر' },
  { id: 'CRS-LEAD-003-04', name: 'حوكمة قرار', pathwayId: 'PW-LEAD-003', pathwayName: 'اتخاذ القرار وإدارة المخاطر', category: 'قيادة', weeks: 2, skill: 'تخطيط السيناريوهات' },
  { id: 'CRS-LEAD-003-05', name: 'حالة تطبيقية', pathwayId: 'PW-LEAD-003', pathwayName: 'اتخاذ القرار وإدارة المخاطر', category: 'قيادة', weeks: 2, skill: 'حوكمة القرار' },
  { id: 'CRS-STU-001-01', name: 'تحديد اتجاه أول', pathwayId: 'PW-STU-001', pathwayName: 'طالب جامعة إلى أول فرصة', category: 'طلاب ومهنة', weeks: 2, skill: 'تخطيط المسار المهني' },
  { id: 'CRS-STU-001-02', name: 'سيرة وLinkedIn', pathwayId: 'PW-STU-001', pathwayName: 'طالب جامعة إلى أول فرصة', category: 'طلاب ومهنة', weeks: 2, skill: 'الجاهزية للتدريب العملي' },
  { id: 'CRS-STU-001-03', name: 'مشروع محفظة صغير', pathwayId: 'PW-STU-001', pathwayName: 'طالب جامعة إلى أول فرصة', category: 'طلاب ومهنة', weeks: 2, skill: 'بناء ملف الأعمال' },
  { id: 'CRS-STU-001-04', name: 'بحث فرص وتواصل', pathwayId: 'PW-STU-001', pathwayName: 'طالب جامعة إلى أول فرصة', category: 'طلاب ومهنة', weeks: 2, skill: 'كتابة السيرة الذاتية' },
  { id: 'CRS-STU-001-05', name: 'محاكاة مقابلة', pathwayId: 'PW-STU-001', pathwayName: 'طالب جامعة إلى أول فرصة', category: 'طلاب ومهنة', weeks: 2, skill: 'استراتيجية البحث عن عمل' },
  { id: 'CRS-STU-002-01', name: 'تموضع مهني', pathwayId: 'PW-STU-002', pathwayName: 'خريج جديد جاهز للعمل', category: 'طلاب ومهنة', weeks: 2, skill: 'كتابة السيرة الذاتية' },
  { id: 'CRS-STU-002-02', name: 'تجهيز الملف', pathwayId: 'PW-STU-002', pathwayName: 'خريج جديد جاهز للعمل', category: 'طلاب ومهنة', weeks: 2, skill: 'بناء ملف LinkedIn' },
  { id: 'CRS-STU-002-03', name: 'إثبات المهارة', pathwayId: 'PW-STU-002', pathwayName: 'خريج جديد جاهز للعمل', category: 'طلاب ومهنة', weeks: 2, skill: 'مهارات المقابلات' },
  { id: 'CRS-STU-002-04', name: 'مقابلات وسلوك مهني', pathwayId: 'PW-STU-002', pathwayName: 'خريج جديد جاهز للعمل', category: 'طلاب ومهنة', weeks: 2, skill: 'الاحتراف في بيئة العمل' },
  { id: 'CRS-STU-002-05', name: 'خطة بحث عمل', pathwayId: 'PW-STU-002', pathwayName: 'خريج جديد جاهز للعمل', category: 'طلاب ومهنة', weeks: 2, skill: 'بناء ملف الأعمال' },
  { id: 'CRS-STU-003-01', name: 'خريطة ميول وقيم', pathwayId: 'PW-STU-003', pathwayName: 'طالب لا يعرف مساره', category: 'طلاب ومهنة', weeks: 1, skill: 'تخطيط المسار المهني' },
  { id: 'CRS-STU-003-02', name: 'بحث ثلاث مهن', pathwayId: 'PW-STU-003', pathwayName: 'طالب لا يعرف مساره', category: 'طلاب ومهنة', weeks: 1, skill: 'الفضول المهني' },
  { id: 'CRS-STU-003-03', name: 'تجارب قصيرة', pathwayId: 'PW-STU-003', pathwayName: 'طالب لا يعرف مساره', category: 'طلاب ومهنة', weeks: 1, skill: 'مهارة البحث والتحقق' },
  { id: 'CRS-STU-003-04', name: 'مقارنة فرضيات', pathwayId: 'PW-STU-003', pathwayName: 'طالب لا يعرف مساره', category: 'طلاب ومهنة', weeks: 1, skill: 'التعلم الذاتي' },
  { id: 'CRS-STU-003-05', name: 'قرار مسار مؤقت', pathwayId: 'PW-STU-003', pathwayName: 'طالب لا يعرف مساره', category: 'طلاب ومهنة', weeks: 1, skill: 'التأمل والمراجعة الذاتية' },
  { id: 'CRS-WELL-001-01', name: 'خريطة طاقة وتركيز', pathwayId: 'PW-WELL-001', pathwayName: 'التركيز والرفاه غير الطبي', category: 'أسرة ورفاه', weeks: 1, skill: 'إدارة التركيز' },
  { id: 'CRS-WELL-001-02', name: 'تقليل مشتتات', pathwayId: 'PW-WELL-001', pathwayName: 'التركيز والرفاه غير الطبي', category: 'أسرة ورفاه', weeks: 1, skill: 'إدارة الطاقة' },
  { id: 'CRS-WELL-001-03', name: 'عادات صغيرة', pathwayId: 'PW-WELL-001', pathwayName: 'التركيز والرفاه غير الطبي', category: 'أسرة ورفاه', weeks: 1, skill: 'بناء العادات' },
  { id: 'CRS-WELL-001-04', name: 'حدود واستراحة', pathwayId: 'PW-WELL-001', pathwayName: 'التركيز والرفاه غير الطبي', category: 'أسرة ورفاه', weeks: 1, skill: 'الرفاه الرقمي' },
  { id: 'CRS-WELL-001-05', name: 'نظام أسبوعي', pathwayId: 'PW-WELL-001', pathwayName: 'التركيز والرفاه غير الطبي', category: 'أسرة ورفاه', weeks: 1, skill: 'تخطيط الاستراحة والتعافي' },
]

export const courseById = (id: string) => courses.find((c) => c.id === id)

export const pathwayCourses: Record<string, string[]> = {
  'PW-BIZ-001': ['CRS-BIZ-001-01', 'CRS-BIZ-001-02', 'CRS-BIZ-001-03', 'CRS-BIZ-001-04', 'CRS-BIZ-001-05'],
  'PW-BIZ-002': ['CRS-BIZ-002-01', 'CRS-BIZ-002-02', 'CRS-BIZ-002-03', 'CRS-BIZ-002-04', 'CRS-BIZ-002-05'],
  'PW-BIZ-003': ['CRS-BIZ-003-01', 'CRS-BIZ-003-02', 'CRS-BIZ-003-03', 'CRS-BIZ-003-04', 'CRS-BIZ-003-05'],
  'PW-BIZ-004': ['CRS-BIZ-004-01', 'CRS-BIZ-004-02', 'CRS-BIZ-004-03', 'CRS-BIZ-004-04', 'CRS-BIZ-004-05'],
  'PW-BIZ-005': ['CRS-BIZ-005-01', 'CRS-BIZ-005-02', 'CRS-BIZ-005-03', 'CRS-BIZ-005-04', 'CRS-BIZ-005-05'],
  'PW-CAREER-001': ['CRS-CAREER-001-01', 'CRS-CAREER-001-02', 'CRS-CAREER-001-03', 'CRS-CAREER-001-04', 'CRS-CAREER-001-05'],
  'PW-CAREER-002': ['CRS-CAREER-002-01', 'CRS-CAREER-002-02', 'CRS-CAREER-002-03', 'CRS-CAREER-002-04', 'CRS-CAREER-002-05', 'CRS-CAREER-002-06'],
  'PW-CAREER-003': ['CRS-CAREER-003-01', 'CRS-CAREER-003-02', 'CRS-CAREER-003-03', 'CRS-CAREER-003-04', 'CRS-CAREER-003-05'],
  'PW-EMP-001': ['CRS-EMP-001-01', 'CRS-EMP-001-02', 'CRS-EMP-001-03', 'CRS-EMP-001-04', 'CRS-EMP-001-05'],
  'PW-EMP-002': ['CRS-EMP-002-01', 'CRS-EMP-002-02', 'CRS-EMP-002-03', 'CRS-EMP-002-04', 'CRS-EMP-002-05'],
  'PW-EMP-003': ['CRS-EMP-003-01', 'CRS-EMP-003-02', 'CRS-EMP-003-03', 'CRS-EMP-003-04', 'CRS-EMP-003-05'],
  'PW-EMP-004': ['CRS-EMP-004-01', 'CRS-EMP-004-02', 'CRS-EMP-004-03', 'CRS-EMP-004-04', 'CRS-EMP-004-05'],
  'PW-EMP-005': ['CRS-EMP-005-01', 'CRS-EMP-005-02', 'CRS-EMP-005-03', 'CRS-EMP-005-04', 'CRS-EMP-005-05'],
  'PW-EMP-006': ['CRS-EMP-006-01', 'CRS-EMP-006-02', 'CRS-EMP-006-03', 'CRS-EMP-006-04', 'CRS-EMP-006-05'],
  'PW-FAM-001': ['CRS-FAM-001-01', 'CRS-FAM-001-02', 'CRS-FAM-001-03', 'CRS-FAM-001-04', 'CRS-FAM-001-05'],
  'PW-FAM-002': ['CRS-FAM-002-01', 'CRS-FAM-002-02', 'CRS-FAM-002-03', 'CRS-FAM-002-04', 'CRS-FAM-002-05'],
  'PW-FAM-003': ['CRS-FAM-003-01', 'CRS-FAM-003-02', 'CRS-FAM-003-03', 'CRS-FAM-003-04', 'CRS-FAM-003-05'],
  'PW-FND-001': ['CRS-FND-001-01', 'CRS-FND-001-02', 'CRS-FND-001-03', 'CRS-FND-001-04', 'CRS-FND-001-05'],
  'PW-FND-002': ['CRS-FND-002-01', 'CRS-FND-002-02', 'CRS-FND-002-03', 'CRS-FND-002-04', 'CRS-FND-002-05'],
  'PW-FND-003': ['CRS-FND-003-01', 'CRS-FND-003-02', 'CRS-FND-003-03', 'CRS-FND-003-04', 'CRS-FND-003-05'],
  'PW-FND-004': ['CRS-FND-004-01', 'CRS-FND-004-02', 'CRS-FND-004-03', 'CRS-FND-004-04', 'CRS-FND-004-05'],
  'PW-FND-005': ['CRS-FND-005-01', 'CRS-FND-005-02', 'CRS-FND-005-03', 'CRS-FND-005-04', 'CRS-FND-005-05'],
  'PW-FND-006': ['CRS-FND-006-01', 'CRS-FND-006-02', 'CRS-FND-006-03', 'CRS-FND-006-04', 'CRS-FND-006-05'],
  'PW-FND-007': ['CRS-FND-007-01', 'CRS-FND-007-02', 'CRS-FND-007-03', 'CRS-FND-007-04', 'CRS-FND-007-05'],
  'PW-FREE-001': ['CRS-FREE-001-01', 'CRS-FREE-001-02', 'CRS-FREE-001-03', 'CRS-FREE-001-04', 'CRS-FREE-001-05'],
  'PW-GOV-001': ['CRS-GOV-001-01', 'CRS-GOV-001-02', 'CRS-GOV-001-03', 'CRS-GOV-001-04', 'CRS-GOV-001-05'],
  'PW-GOV-002': ['CRS-GOV-002-01', 'CRS-GOV-002-02', 'CRS-GOV-002-03', 'CRS-GOV-002-04', 'CRS-GOV-002-05'],
  'PW-GOV-003': ['CRS-GOV-003-01', 'CRS-GOV-003-02', 'CRS-GOV-003-03', 'CRS-GOV-003-04', 'CRS-GOV-003-05'],
  'PW-GOV-004': ['CRS-GOV-004-01', 'CRS-GOV-004-02', 'CRS-GOV-004-03', 'CRS-GOV-004-04', 'CRS-GOV-004-05'],
  'PW-GOV-005': ['CRS-GOV-005-01', 'CRS-GOV-005-02', 'CRS-GOV-005-03', 'CRS-GOV-005-04', 'CRS-GOV-005-05'],
  'PW-GOV-006': ['CRS-GOV-006-01', 'CRS-GOV-006-02', 'CRS-GOV-006-03', 'CRS-GOV-006-04', 'CRS-GOV-006-05'],
  'PW-GOV-007': ['CRS-GOV-007-01', 'CRS-GOV-007-02', 'CRS-GOV-007-03', 'CRS-GOV-007-04', 'CRS-GOV-007-05'],
  'PW-GOV-008': ['CRS-GOV-008-01', 'CRS-GOV-008-02', 'CRS-GOV-008-03', 'CRS-GOV-008-04', 'CRS-GOV-008-05'],
  'PW-LEAD-001': ['CRS-LEAD-001-01', 'CRS-LEAD-001-02', 'CRS-LEAD-001-03', 'CRS-LEAD-001-04', 'CRS-LEAD-001-05'],
  'PW-LEAD-002': ['CRS-LEAD-002-01', 'CRS-LEAD-002-02', 'CRS-LEAD-002-03', 'CRS-LEAD-002-04', 'CRS-LEAD-002-05'],
  'PW-LEAD-003': ['CRS-LEAD-003-01', 'CRS-LEAD-003-02', 'CRS-LEAD-003-03', 'CRS-LEAD-003-04', 'CRS-LEAD-003-05'],
  'PW-STU-001': ['CRS-STU-001-01', 'CRS-STU-001-02', 'CRS-STU-001-03', 'CRS-STU-001-04', 'CRS-STU-001-05'],
  'PW-STU-002': ['CRS-STU-002-01', 'CRS-STU-002-02', 'CRS-STU-002-03', 'CRS-STU-002-04', 'CRS-STU-002-05'],
  'PW-STU-003': ['CRS-STU-003-01', 'CRS-STU-003-02', 'CRS-STU-003-03', 'CRS-STU-003-04', 'CRS-STU-003-05'],
  'PW-WELL-001': ['CRS-WELL-001-01', 'CRS-WELL-001-02', 'CRS-WELL-001-03', 'CRS-WELL-001-04', 'CRS-WELL-001-05'],
}

/* الدورات الأكثر مبيعا — 2-3 دورات لكل مجال */
export const bestsellerCourses: { id: string; note: string }[] = [
  /* أساسيات */
  { id: 'CRS-FND-003-02', note: 'الأكثر مبيعا' },
  { id: 'CRS-FND-005-03', note: 'مهارة سريعة' },
  /* طلاب ومهنة */
  { id: 'CRS-STU-002-02', note: 'الأكثر مبيعا للخريجين' },
  { id: 'CRS-CAREER-003-03', note: 'تجربة عملية فورية' },
  /* موظفون */
  { id: 'CRS-EMP-004-01', note: 'الأكثر طلبا للموظفين' },
  { id: 'CRS-EMP-002-02', note: 'الأعلى تقييما' },
  { id: 'CRS-EMP-003-01', note: 'بداية صحيحة' },
  /* حكومي */
  { id: 'CRS-GOV-001-02', note: 'الأكثر مبيعا للحكومي' },
  { id: 'CRS-GOV-002-03', note: 'الأقوى أثرا' },
  /* أعمال */
  { id: 'CRS-BIZ-001-02', note: 'لرواد الأعمال' },
  { id: 'CRS-BIZ-004-03', note: 'صاعدة بسرعة' },
  { id: 'CRS-FREE-001-03', note: 'تحسم سعرك' },
  /* قيادة */
  { id: 'CRS-EMP-005-05', note: 'خطة جاهزة' },
  { id: 'CRS-LEAD-001-02', note: 'للتأثير' },
  /* أسرة ورفاه */
  { id: 'CRS-FAM-003-01', note: 'تبدأ من البيت' },
  { id: 'CRS-WELL-001-02', note: 'الأخف والأسرع' },
]

export const courseCategories = ['الكل', 'أساسيات', 'طلاب ومهنة', 'موظفون', 'حكومي', 'أعمال', 'قيادة', 'أسرة ورفاه']

/* سعر الدورة المنفردة: 130–180 دولارا حسب مدتها */
export const coursePrice = (weeks: number) => Math.min(180, 105 + weeks * 25)

/* سعر المسار الكامل التفضيلي الموحد */
export const PATHWAY_PRICE = 600

/* سعر المسار حسب عدد دوراته (الهدية المجانية لا تُحتسب):
   4 دورات = 500$ · 5 = 550$ · 6 أو أكثر = 600$ */
export const MIN_PATHWAY_COURSES = 4
export const MAX_PATHWAY_COURSES = 6
export const pathwayPriceFor = (courseCount: number) =>
  courseCount <= 4 ? 500 : courseCount === 5 ? 550 : 600

/* ─────────── سعر الدورة التقديري 130–180$ حسب عنوانها ومحتواها ─────────── */
/* عناوين ذات طلب وعمق أعلى تستحق شريحة سعرية أعلى */
const PREMIUM_KEYWORDS = [
  'ذكاء اصطناعي', 'AI', 'بيانات', 'تحليل', 'قيادة', 'تفاوض', 'مشاريع',
  'استراتيجية', 'مالية', 'مشتريات', 'عقود', 'حوكمة', 'تحول رقمي', 'إدارة المخاطر',
]
export function coursePriceOf(c: Course): number {
  const base = c.weeks <= 1 ? 130 : c.weeks === 2 ? 145 : c.weeks === 3 ? 160 : 170
  const premium = PREMIUM_KEYWORDS.some((k) => c.name.includes(k) || c.skill.includes(k)) ? 10 : 0
  return Math.min(180, base + premium)
}

/* ─────────── مدربو المسارات — أكثر من مدرب للمسار الواحد ─────────── */
export interface Trainer {
  name: string
  role: string
}
const TRAINER_POOLS: Record<string, Trainer[]> = {
  FND: [
    { name: 'أ. ريم القحطاني', role: 'مدربة التعلم الذاتي وبناء العادات' },
    { name: 'أ. محمد الشهري', role: 'مدرب الكفاءة الرقمية' },
    { name: 'د. نورة السبيعي', role: 'مدربة تطبيقات الذكاء الاصطناعي' },
  ],
  STU: [
    { name: 'أ. ريم القحطاني', role: 'مدربة الجاهزية المهنية' },
    { name: 'أ. عبدالله المطيري', role: 'مدرب التخطيط المهني للطلاب' },
  ],
  CAREER: [
    { name: 'د. فيصل العتيبي', role: 'مدرب التحول المهني' },
    { name: 'أ. ريم القحطاني', role: 'مدربة بناء الملف المهني' },
  ],
  EMP: [
    { name: 'د. فيصل العتيبي', role: 'مدرب تطوير الموظفين' },
    { name: 'أ. سارة الدوسري', role: 'مدربة الكتابة والعروض المهنية' },
    { name: 'م. خالد العنزي', role: 'مدرب إدارة المشاريع والبيانات' },
  ],
  GOV: [
    { name: 'م. سلطان الدوسري', role: 'مدرب التطوير الحكومي' },
    { name: 'أ. هند العمري', role: 'مدربة خدمة الجمهور والمراسلات' },
    { name: 'د. بدر القحطاني', role: 'مدرب المشتريات والمالية العامة' },
  ],
  BIZ: [
    { name: 'م. لينا الحربي', role: 'مدربة ريادة الأعمال' },
    { name: 'أ. فهد الغامدي', role: 'مدرب التسويق والمبيعات' },
  ],
  FREE: [
    { name: 'م. لينا الحربي', role: 'مدربة العمل الحر' },
    { name: 'أ. فهد الغامدي', role: 'مدرب التسويق الشخصي' },
  ],
  LEAD: [
    { name: 'م. سلطان الدوسري', role: 'مدرب القيادة' },
    { name: 'د. منيرة الزهراني', role: 'مدربة الحوار والتغذية الراجعة' },
  ],
  FAM: [
    { name: 'أ. ريم القحطاني', role: 'مدربة المسارات الأسرية' },
    { name: 'د. منيرة الزهراني', role: 'مدربة التواصل الأسري' },
  ],
  WELL: [
    { name: 'أ. ريم القحطاني', role: 'مدربة التركيز والرفاه' },
    { name: 'أ. محمد الشهري', role: 'مدرب إدارة الطاقة والوقت' },
  ],
}
/** مدربو مسار معين — 2–3 مدربين مشاركين، يظهرون في تفاصيل المسار */
export function pathwayTrainers(pathwayId: string): Trainer[] {
  const family = pathwayId.split('-')[1] ?? 'FND'
  const pool = TRAINER_POOLS[family] ?? TRAINER_POOLS.FND
  const num = parseInt(pathwayId.split('-')[2] ?? '1', 10) || 1
  // تناوب ثابت ليكون لكل مسار تشكيلة مدربين مختلفة قليلا
  const rotated = [...pool.slice(num % pool.length), ...pool.slice(0, num % pool.length)]
  return rotated.slice(0, Math.min(3, pool.length))
}
/** مدرب الدورة — أحد مدربي مسارها بالتناوب */
export function courseTrainer(c: Course): Trainer {
  const trainers = pathwayTrainers(c.pathwayId)
  const idx = parseInt(c.id.split('-').pop() ?? '1', 10) || 1
  return trainers[(idx - 1) % trainers.length]
}

/* ─────────── تفاصيل الدورة للنوافذ: محاور ومخرج ─────────── */
const TOPIC_TEMPLATES: Record<string, string[]> = {
  'أساسيات': ['المفاهيم الجوهرية خطوة بخطوة', 'تطبيق عملي على واقعك اليومي', 'أخطاء شائعة وكيف تتجنبها', 'بناء عادة مستدامة بعد الدورة'],
  'طلاب ومهنة': ['قراءة واقع سوق العمل الحالي', 'بناء ملفك خطوة بخطوة', 'تدريب على مواقف حقيقية', 'مراجعة فردية لمخرجك النهائي'],
  'موظفون': ['تشخيص وضعك الحالي', 'أدوات وقوالب جاهزة للعمل', 'تطبيق على مهامك الفعلية', 'مراجعة المدرب لمخرجك'],
  'حكومي': ['الإطار التنظيمي للعمل الحكومي', 'نماذج وخطابات من واقع الجهات', 'تطبيق على حالات حقيقية', 'مراجعة فردية وتغذية راجعة'],
  'أعمال': ['تشخيص وضع مشروعك الحالي', 'أدوات ونماذج جاهزة', 'تطبيق مباشر على مشروعك', 'مراجعة المدرب للمخرج'],
  'قيادة': ['تقييم أسلوبك القيادي الحالي', 'أدوات الحوار والمتابعة', 'تطبيق مع فريقك الحقيقي', 'خطة قيادة فردية مراجَعة'],
  'أسرة ورفاه': ['فهم أنماطك الحالية', 'أدوات عملية بسيطة', 'تطبيق تدريجي في يومك', 'مراجعة وضبط الخطة'],
}
const OUTCOME_BY_CATEGORY: Record<string, string> = {
  'أساسيات': 'نظام شخصي موثق تستخدمه يوميا',
  'طلاب ومهنة': 'مخرج جاهز تقدمه لأي جهة توظيف',
  'موظفون': 'قالب عملي تطبقه في عملك من الأسبوع الأول',
  'حكومي': 'نموذج عمل حكومي جاهز للاستخدام الفوري',
  'أعمال': 'أداة تستخدمها في مشروعك مباشرة',
  'قيادة': 'خطة قيادة فردية قيّمها المدرب معك',
  'أسرة ورفاه': 'روتين عملي مستدام يناسب ظروفك',
}
export function courseDetails(c: Course): { trainer: Trainer; topics: string[]; outcome: string } {
  return {
    trainer: courseTrainer(c),
    topics: TOPIC_TEMPLATES[c.category] ?? TOPIC_TEMPLATES['أساسيات'],
    outcome: `${OUTCOME_BY_CATEGORY[c.category] ?? OUTCOME_BY_CATEGORY['أساسيات']} — في ${c.skill}`,
  }
}

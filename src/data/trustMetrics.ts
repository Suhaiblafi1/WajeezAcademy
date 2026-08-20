/* ─────────────────────────────────────────────────────────────────────────
   Trust Metrics — المصدر المركزي الوحيد لأرقام الإثبات الاجتماعي

   قواعد صارمة (بقرار المالك، 2026-08-20):
   1) شريط الثقة في الصفحة الرئيسية يقرأ source_scope === 'wajeez_skills' حصراً.
   2) ممنوع أي رقم من تطبيق وجيز العام (B2C) مهما كان أكبر أو أجمل.
   3) لا رقم يُعرض بلا source_url + source_context + last_verified_at.
   4) approved_for_display = false ⇒ لا يظهر في Production إطلاقاً.
   5) الأرقام تُنسب لـ«وجيز مهارات» لا للأكاديمية — لا خلط بين
      wajeez_skills / wajeez_academy / wajeez_app في رقم واحد.
   6) المستقبل: يمكن إضافة سجلات بـ scope آخر (wajeez_academy مثلاً) —
      لن تظهر في الشريط الحالي ما لم يتغير مرشّح المكوّن بقرار صريح.
   ───────────────────────────────────────────────────────────────────────── */

export type TrustScope = 'wajeez_skills' | 'wajeez_academy' | 'wajeez_app'

export interface TrustMetric {
  key: string
  /** القيمة الرقمية الخام للفرز والمقارنة — لا تُعرض مباشرة */
  value: number
  /** القيمة كما تُعرض للزائر (تشمل + أو % إن وُجدت في المصدر) */
  display_value: string
  label_ar: string
  source_scope: TrustScope
  source_url: string
  /** السياق الحرفي الذي ظهر فيه الرقم على الصفحة المرجعية */
  source_context: string
  /** تاريخ آخر تحقق يدوي من المصدر (YYYY-MM-DD) */
  last_verified_at: string
  approved_for_display: boolean
  /** من بين الموثقة: هل اختيرت للعرض في شريط الرئيسية (3–5 كحد أقصى)؟ */
  selected_for_home: boolean
}

const SKILLS_BUSINESS_URL = 'https://wajeez.com/business'
const VERIFIED = '2026-08-20'

export const wajeezSkillsStats: TrustMetric[] = [
  /* ══ معروضة في الشريط (5 — الحد الأعلى المعتمد) ══ */
  {
    key: 'organizations',
    value: 100,
    display_value: '+100',
    label_ar: 'مؤسسة رائدة وثقت بأساليبنا',
    source_scope: 'wajeez_skills',
    source_url: SKILLS_BUSINESS_URL,
    source_context: '«انضم لأكثر من 100 مؤسسة رائدة وثقت بأساليبنا المبتكرة في تطوير موظفيها» — شريط شعارات العملاء',
    last_verified_at: VERIFIED,
    approved_for_display: true,
    selected_for_home: true,
  },
  {
    key: 'employees',
    value: 30000,
    display_value: '+30,000',
    label_ar: 'موظف يبنون مهاراتهم ويطوّرونها',
    source_scope: 'wajeez_skills',
    source_url: SKILLS_BUSINESS_URL,
    source_context: '«تأثير عالمي — 30,000 موظف يستخدمون وجيز لبناء مهاراتهم وتطويرها» — بلوك الإحصاءات في صفحة الأعمال',
    last_verified_at: VERIFIED,
    approved_for_display: true,
    selected_for_home: true,
  },
  {
    key: 'book_summaries',
    value: 3500,
    display_value: '+3,500',
    label_ar: 'ملخص كتاب في مكتبة المنصة',
    source_scope: 'wajeez_skills',
    source_url: SKILLS_BUSINESS_URL,
    source_context: '«منصة واحدة لكل أدوات نجاح فريقك — 3,500 ملخص كتاب» — قسم محتوى المنتج المؤسسي',
    last_verified_at: VERIFIED,
    approved_for_display: true,
    selected_for_home: true,
  },
  {
    key: 'career_tracks',
    value: 80,
    display_value: '80',
    label_ar: 'مساراً مهنياً جاهزاً',
    source_scope: 'wajeez_skills',
    source_url: SKILLS_BUSINESS_URL,
    source_context: '«80 مسار مهني جاهز — خطط تعليمية موجهة تساعد كل موظف على التعلّم وفق هدفه» — قسم محتوى المنتج المؤسسي',
    last_verified_at: VERIFIED,
    approved_for_display: true,
    selected_for_home: true,
  },
  {
    key: 'annual_renewal',
    value: 94,
    display_value: '94%',
    label_ar: 'من العملاء يجددون اشتراكاتهم سنوياً',
    source_scope: 'wajeez_skills',
    source_url: SKILLS_BUSINESS_URL,
    source_context: '«موثوق من الشركات — 94% من عملائنا يجددون اشتراكاتهم سنويًا» — بلوك الإحصاءات في صفحة الأعمال',
    last_verified_at: VERIFIED,
    approved_for_display: true,
    selected_for_home: true,
  },

  /* ══ موثقة في المصدر لكنها خارج الاختيار (سقف الخمسة / أولوية الوضوح) ══ */
  {
    key: 'podcast_episodes',
    value: 30000,
    display_value: '+30,000',
    label_ar: 'حلقة بودكاست',
    source_scope: 'wajeez_skills',
    source_url: SKILLS_BUSINESS_URL,
    source_context: '«30,000 حلقة بودكاست — محتوى متنوع يغطي مجالات العمل والتفكير» — قسم محتوى المنتج المؤسسي',
    last_verified_at: VERIFIED,
    approved_for_display: true,
    selected_for_home: false, // موثق، لكن «ملخصات الكتب» أوضح للزائر العام — احتياطي جاهز
  },
  {
    key: 'learning_habits',
    value: 91,
    display_value: '91%',
    label_ar: 'من المستخدمين يطوّرون عادات تعلّم مستدامة',
    source_scope: 'wajeez_skills',
    source_url: SKILLS_BUSINESS_URL,
    source_context: '«تغيير سلوكي فعلي — 91% من المستخدمين يطوّرون عادات تعلّم مستدامة» — بلوك الإحصاءات',
    last_verified_at: VERIFIED,
    approved_for_display: true,
    selected_for_home: false, // موثق، لكن نسبة التجديد 94% دليل مؤسسي أقوى
  },

  /* ══ مرفوضة — لا تُعرض إطلاقاً ما دام السبب قائماً ══ */
  {
    key: 'user_rating',
    value: 4.8,
    display_value: '4.8/5',
    label_ar: 'متوسط تقييم المستخدمين',
    source_scope: 'wajeez_skills',
    source_url: SKILLS_BUSINESS_URL,
    source_context: '«محبوب من المستخدمين 5/4.8 — متوسط تقييم أكثر من 30,000 ألف موظف» — بلوك الإحصاءات',
    last_verified_at: VERIFIED,
    approved_for_display: false, // مرفوض: صياغة المصدر متضاربة («30,000 ألف» = 30 مليوناً) — لا يُعرض حتى تصحيح المصدر
    selected_for_home: false,
  },
  {
    key: 'content_titles',
    value: 3000,
    display_value: '+3,000',
    label_ar: 'عنوان من مصادر عالمية',
    source_scope: 'wajeez_skills',
    source_url: SKILLS_BUSINESS_URL,
    source_context: '«محتوى متجدد وموثوق — +3,000 عنوان من مصادر رائدة عالميًا» — بلوك الإحصاءات',
    last_verified_at: VERIFIED,
    approved_for_display: false, // مرفوض: يتعارض عددياً مع «3,500 ملخص كتاب» في الصفحة نفسها — لا يُعرض قبل توحيد المصدر
    selected_for_home: false,
  },
  {
    key: 'professional_skills',
    value: 80,
    display_value: '+80',
    label_ar: 'مهارة مهنية',
    source_scope: 'wajeez_skills',
    source_url: SKILLS_BUSINESS_URL,
    source_context: '«تنوّع يلبي طموحاتك — +80 مهارة مهنية تغطي مختلف التخصصات» — بلوك الإحصاءات',
    last_verified_at: VERIFIED,
    approved_for_display: false, // مرفوض: يلتبس مع «80 مساراً مهنياً» بنفس القيمة — عرضهما معاً يوحي بتضخيم الرقم
    selected_for_home: false,
  },
]

/** المرشّح الوحيد المسموح لمكوّن شريط الثقة في الصفحة الرئيسية */
export function homeTrustMetrics(): TrustMetric[] {
  return wajeezSkillsStats.filter(
    (m) => m.source_scope === 'wajeez_skills' && m.approved_for_display && m.selected_for_home,
  )
}

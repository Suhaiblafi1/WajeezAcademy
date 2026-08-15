/* عقود نموذج «انضم كمدرب» — مرحلتان منفصلتان.
   المرحلة 1 (الطلب الأولي): يعبئها أي خبير مهتم — لا تمنح أي اعتماد.
   المرحلة 2 (الاستكمال المهني): تُفتح بعد مراجعة الإدارة للطلب الأولي فقط.
   لا يُنفَّذ أي اعتماد حقيقي قبل قاعدة البيانات؛ هذه العقود هي الواجهة
   التي لن تتغير عند الربط الإنتاجي. */

/** التخصصات التدريبية الحقيقية — مشتقة من عائلات كتالوج المسارات العشرين */
export const TRAINING_SPECIALIZATIONS = [
  'القيادة وتطوير المدراء',
  'إدارة المشاريع والعمليات',
  'تحليل البيانات والمالية',
  'التسويق والمبيعات وخدمة العملاء',
  'التفاوض والتواصل المؤسسي',
  'الموارد البشرية وتجربة الموظف',
  'ريادة الأعمال وتطوير المشاريع',
  'الذكاء الاصطناعي والأتمتة والأمن الرقمي',
  'إدارة المنتج وتجربة المستخدم',
  'التطوير الحكومي والمشتريات العامة',
  'التعلم الذاتي والجاهزية المهنية',
  'سلاسل الإمداد واللوجستيات',
] as const

export type TrainingSpecialization = (typeof TRAINING_SPECIALIZATIONS)[number]

/* ═══════════ المرحلة 1: الطلب الأولي ═══════════ */

export interface TrainerApplicationInitial {
  /* الهوية والتواصل */
  full_name: string
  email: string
  phone_whatsapp: string | null
  linkedin_or_portfolio: string | null

  /* خبرة المجال — ماذا أتقن في عمله الفعلي */
  domain_specialization: TrainingSpecialization
  domain_years: '1-3' | '4-7' | '8-12' | '12+'
  current_role: string | null
  domain_evidence: string | null /* مشاريع/مناصب تثبت عمق المجال */

  /* خبرة التدريب — منفصلة عن خبرة المجال */
  training_experience: 'none' | 'informal' | 'workshops' | 'formal_teaching'
  training_evidence: string | null /* دورات/ورش قدّمها فعلا */

  /* الدافع */
  topics_to_teach: string | null
  motivation: string

  /* التشغيل */
  status: 'new' | 'interview' | 'accepted' | 'rejected'
  created_at: string /* ISO */
  source: 'join-trainer-page'
}

/* ═══════════ المرحلة 2: الاستكمال المهني — بعد مراجعة الطلب الأولي ═══════════ */

export interface TrainerProfessionalProfile {
  application_id: string /* يربط بالطلب الأولي */

  /* المنهجية */
  teaches_with_projects: boolean /* يلتزم بمبدأ «الإثبات بالمخرج» */
  sample_outline: string /* مخطط مقترح لدورة واحدة يتقنها */
  assessment_approach: string /* كيف يقيّم مخرجات المتعلمين */

  /* التوفر التشغيلي */
  weekly_availability_hours: number
  preferred_formats: ('live_cohort' | 'recorded' | 'review_only')[]
  languages: ('ar' | 'en')[]

  /* الاتفاق */
  agreed_to_methodology: boolean
  agreed_to_review_process: boolean

  completed_at: string | null
}

/* ═══════════ حدود المرحلة التجريبية الحالية ═══════════
   الآن (قبل المنصة): الطلب الأولي يُحفظ محليا على جهاز المستخدم كنسخة
   تجريبية، ولا يصل الإدارة آليا — القناة الحقيقية الحالية هي واتساب.
   عند بناء المنصة: أول مسار إنتاجي كامل سيكون استقبال الطلب الأولي
   في قاعدة البيانات ثم فتح المرحلة الثانية بعد قرار الإدارة. */
export const TRAINER_PIPELINE_NOTE_AR =
  'طلبك محفوظ الآن في هذه النسخة التجريبية على جهازك. القناة المباشرة اليوم هي واتساب فريقنا — وعند إطلاق المنصة سيصبح استقبال الطلبات آليا بالكامل.'

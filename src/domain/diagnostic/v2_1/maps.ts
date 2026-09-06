/* خرائط بنية تشخيص B2C — V2.1 Final Architecture.
   الفصل الجوهري: Career Stage ≠ Employment State ≠ Goal ≠ Need ≠ Domain ≠ Track.
   كل ربط هنا حتمي وموثق — لا LLM ولا ارتجال.
   مصدر الحقيقة الوحيد لهذه الرموز: هذا الملف + question-plan.v2_1.json المولّد منه. */

import type { DomainId, PersonaKey } from '../v2/types'

/* ─── المرحلة المهنية (Career Stage) — منفصلة عن حالة العمل ─── */
export type CareerStage =
  | 'university_student'
  | 'fresh_graduate'
  | 'early_career'
  | 'experienced'
  | 'manager'
  | 'senior_manager'
  | 'founder'
  | 'freelancer'
  | 'trainer_ld'
  | 'other_unsure'

export type EmploymentStateV21 = 'not_working' | 'job_seeking' | 'employed' | 'self_employed' | 'business_owner'

export const CAREER_STAGE_LABELS_AR: Record<CareerStage, string> = {
  university_student: 'طالب جامعي',
  fresh_graduate: 'خريج حديث',
  early_career: 'موظف في بداية مساره',
  experienced: 'موظف ذو خبرة',
  manager: 'مدير / قائد فريق',
  senior_manager: 'مدير أول / تنفيذي',
  founder: 'مؤسس / صاحب عمل',
  freelancer: 'مستقل (عمل حر)',
  trainer_ld: 'مدرب / معلم / مختص تعلم وتطوير',
  other_unsure: 'غير ذلك / غير متأكد',
}

/* المراحل التي تُسأل عن حالة العمل.
 *
 * ── لماذا خرجت منها ثلاث، وبقيت خمسٌ بلا نقاش (البند ٣٧) ──
 *
 * قِيس هذا السؤال مضادّا للواقع على ٣٠٠ جلسة، **مفصَّلا بالمرحلة** — والتفصيلُ
 * يقلب الحكمَ الإجماليّ رأسا على عقب. الرقمُ الكلّيُّ «٢٧٪ هدر» يُغري بتقاعده،
 * وهو خطأ: الهدرُ ليس موزّعا، بل **محصورٌ في مرحلتين ونصف**:
 *
 *   early_career · experienced · manager · senior_manager · trainer_ld
 *     ← ١٤٨ مقعدا، **صفرٌ ميّت**. كلُّ جوابٍ فيها يغيّر شيئا.
 *   other_unsure        ← ٢٧ مقعدا، **٢٧ ميّتا (١٠٠٪)**
 *   fresh_graduate      ← ٣٨ مقعدا، ٢٣ ميّتا (٦١٪)
 *   university_student  ← ٢٨ مقعدا، ١٤ ميّتا (٥٠٪)
 *
 * فتقاعدُه جملةً كان سيُتلف ١٤٨ مقعدا حيّا ليوفّر ٦٤. وهذا بعينه ما يخفيه
 * المتوسّط: سؤالٌ حاسمٌ لخمسِ مراحلَ وميّتٌ لواحدة يُقرأ «متوسّطَ الفائدة».
 *
 * ── ولماذا يبقى حيّا حيث يبقى ──
 *
 * ليس لأنّه يغيّر الشخصيّة — لا يغيّرها إلّا لـ`fresh_graduate`. بل لأنّ
 * `contradictions.ts` يقرؤه للمراحل الخمس: من وصف نفسه موظّفا ثمّ قال إنّه لا
 * يعمل **بينهما**، وذاك أصدقُ ما في جلسته. فحذفُ السؤال يُعمي المنصّةَ عن
 * حالةِ من هو بين وظيفتين — وهو من أحوجِ الناس إلى توصيةٍ صادقة.
 *
 * والمؤسّسُ والمستقلُّ خارجَها أصلا: حالتُهما تُشتقّ من مرحلتهما. */
export const STAGE_NEEDS_EMPLOYMENT_QUESTION: CareerStage[] = [
  'university_student',
  'fresh_graduate',
  'early_career',
  'experienced',
  'manager',
  'senior_manager',
  'trainer_ld',
]

/* الأهدافُ التي تجعل حالةَ العمل حاسمةً لطالبٍ جامعيّ — وهي الثلاثةُ التي
   تقرؤها قاعدةُ حسم الهدف في `facts.ts` («أوّلُ وظيفة» أم «ترقية»). وما عداها
   لا يقرأ حالتَه أحد، فلا يُسأل عنها. */
export const GOALS_NEEDING_EMPLOYMENT: readonly string[] = [
  'first_job',
  'promotion',
  'improve_performance',
]

/* حالةُ العمل حين لا تُسأل — تُشتقّ من المرحلة كما يُشتقّ `education_state`.
   والغرضُ أن يبقى سطرُ «وضعك العمليّ» في التفسير قائما: البندُ ٣٧ يوفّر مقعدا
   ولا يُسقط سطرا شخصيّا من شرحِ ما فُهم عن المتعلّم. */
export function stageToEmploymentState(stage: CareerStage): EmploymentStateV21 | null {
  switch (stage) {
    case 'founder':
      return 'business_owner'
    case 'freelancer':
      return 'self_employed'
    case 'university_student':
      return 'not_working'
    /* والمراحلُ الخمسُ العاملةُ **لا تُشتقّ**، وهذا شرطُ صحّةٍ لا تفصيلَ ذوق.
       اشتقاقُ «موظّف» منها يبدو بديهيّا، وهو يُبطل البندَ الذي وُضع له
       السؤال: `contradictions.ts` يقارن ما **قاله** المتعلّم بمرحلته، فمن
       وصف نفسه موظّفا ثمّ قال إنّه لا يعمل يُسأل أيُّ الوصفين أقربُ إليه.
       والاشتقاقُ يملأ الحقلَ بـ«موظّف» فلا يبقى شيءٌ يناقضه — فيصمت النظامُ
       عمّن هو بين وظيفتين. وقد وقعتُ في هذا فعلا في أوّل صياغة، وأمسكه
       القياس: هبطت مقاعدُ السؤال من ٢٤١ إلى ٣٨، أي أنّه صمت في الخمس
       العاملة التي هدرُها **صفر**.

       و«غير متأكّد» و«خرّيج حديث» لا يُشتقّان كذلك: الأوّلُ لا يقول شيئا عن
       عمله (ويُملأ من مرحلته لا يصحّ)، والثاني يُسأل فعلا لأنّ جوابَه يفصل
       الباحثَ عن العمل عن الخرّيج. */
    default:
      return null
  }
}

/* مرحلة → رمز شخصية V2 (للأهلية والتفسير) */
export function stageToPersonaKey(stage: CareerStage, facts: { employment_state?: string; business_stage?: string; sector?: string }): PersonaKey {
  switch (stage) {
    case 'university_student':
      return 'university_student'
    case 'fresh_graduate':
      return facts.employment_state === 'job_seeking' || facts.employment_state === 'not_working' ? 'job_seeker' : 'graduate'
    case 'early_career':
      return facts.sector === 'public' ? 'gov_employee' : 'junior_employee'
    case 'experienced':
      return facts.sector === 'public' ? 'gov_employee' : 'experienced_employee'
    case 'manager':
      return facts.sector === 'public' ? 'gov_manager' : 'new_manager'
    case 'senior_manager':
      return facts.sector === 'public' ? 'gov_manager' : 'leader'
    case 'founder':
      return facts.business_stage && !['idea', 'validation', 'pre_revenue'].includes(facts.business_stage)
        ? 'founder_operating'
        : 'founder_idea'
    case 'freelancer':
      return 'freelancer'
    case 'trainer_ld':
      return 'ld_professional'
    case 'other_unsure':
      return 'unsure_explorer'
  }
}

/* ─── الأهداف (Goal ≠ Domain ≠ Track) ─── */
export interface GoalDefV21 {
  code: string
  label_ar: string
  /** المراحل التي يُعرض عليها هذا الهدف — خيار لا يناسب المرحلة لا يُعرض أصلًا */
  stages: CareerStage[] | 'all'
  /** رمز الهدف القديم المكافئ — جسر لبروفايلات المسارات (لا اختراع ملاءمة) */
  legacy_goal: string
  /** إسهام مجالي ضعيف متعمد — المجال يُحسم من الاحتياج والدليل لا من الهدف */
  domains: DomainId[]
}

export const GOALS_V21: GoalDefV21[] = [
  { code: 'first_job', label_ar: 'الحصول على أول وظيفة', stages: ['university_student', 'fresh_graduate'], legacy_goal: 'first_job', domains: ['employment_readiness'] },
  { code: 'choose_field', label_ar: 'تحديد المجال الأنسب لي', stages: ['university_student', 'fresh_graduate', 'other_unsure'], legacy_goal: 'career_direction', domains: ['career_direction'] },
  { code: 'practical_skills', label_ar: 'بناء مهارات عملية يطلبها سوق العمل', stages: ['university_student', 'fresh_graduate', 'early_career'], legacy_goal: 'employment_advancement', domains: ['employment_readiness'] },
  { code: 'build_portfolio', label_ar: 'بناء ملف أعمال يثبت قدراتي', stages: ['university_student', 'fresh_graduate', 'early_career', 'freelancer'], legacy_goal: 'personal_brand', domains: ['employment_readiness', 'communication_influence'] },
  { code: 'start_business', label_ar: 'بدء مشروع أو مصدر دخل مستقل', stages: ['fresh_graduate', 'early_career', 'experienced', 'manager', 'senior_manager', 'freelancer', 'other_unsure'], legacy_goal: 'business_launch', domains: ['entrepreneurship'] },
  { code: 'specific_skill', label_ar: 'تطوير مهارة محددة أعرفها', stages: 'all', legacy_goal: 'personal_growth', domains: [] },
  { code: 'promotion', label_ar: 'التقدم أو الترقية في عملي', stages: ['early_career', 'experienced', 'manager', 'senior_manager'], legacy_goal: 'promotion', domains: [] },
  { code: 'improve_performance', label_ar: 'تحسين أدائي في عملي الحالي', stages: ['early_career', 'experienced', 'manager', 'senior_manager', 'trainer_ld'], legacy_goal: 'employment_advancement', domains: [] },
  { code: 'career_change', label_ar: 'الانتقال إلى مجال جديد', stages: ['early_career', 'experienced', 'manager', 'senior_manager', 'freelancer', 'trainer_ld'], legacy_goal: 'career_direction', domains: ['career_direction'] },
  { code: 'leadership_prep', label_ar: 'الاستعداد لدور قيادي', stages: ['experienced', 'manager', 'senior_manager'], legacy_goal: 'lead_team', domains: ['people_leadership'] },
  { code: 'ai_better', label_ar: 'استخدام الذكاء الاصطناعي بفعالية أكبر', stages: 'all', legacy_goal: 'digital_transformation', domains: ['ai_productivity'] },
  { code: 'grow_business', label_ar: 'تنمية مشروعي القائم وزيادة إيراداته', stages: ['founder'], legacy_goal: 'revenue_growth', domains: ['entrepreneurship'] },
  { code: 'grow_freelance', label_ar: 'زيادة دخلي وعملائي في العمل الحر', stages: ['freelancer'], legacy_goal: 'revenue_growth', domains: ['entrepreneurship', 'marketing_growth'] },
  { code: 'design_training', label_ar: 'تصميم تدريب أو برامج تعليمية', stages: ['trainer_ld', 'manager', 'senior_manager'], legacy_goal: 'design_training', domains: ['learning_design'] },
  { code: 'unsure_goal', label_ar: 'غير متأكد — أريد أن يساعدني التشخيص', stages: 'all', legacy_goal: 'explore', domains: [] },
]

export function goalByCode(code: string): GoalDefV21 | undefined {
  return GOALS_V21.find((g) => g.code === code)
}

/** أهداف مرحلة بعينها — بترتيبها الثابت في القائمة الأم */
export function goalsForStage(stage: CareerStage): GoalDefV21[] {
  return GOALS_V21.filter((g) => g.stages === 'all' || g.stages.includes(stage))
}

/* ─── الاحتياجات (Real Need → Domain Discovery) ─── */
export interface NeedDefV21 {
  code: string
  label_ar: string
  stages: CareerStage[] | 'all'
  /** الاحتياج هو المحرك الرئيس لاكتشاف المجال */
  domains: DomainId[]
}

const EMPLOYED_LIKE: CareerStage[] = ['early_career', 'experienced', 'manager', 'senior_manager']

export const NEEDS_V21: NeedDefV21[] = [
  { code: 'need_employability', label_ar: 'الجاهزية لسوق العمل — سيرة ومقابلات وملف أعمال', stages: ['university_student', 'fresh_graduate', 'early_career'], domains: ['employment_readiness'] },
  { code: 'need_direction', label_ar: 'تحديد اتجاهي المهني أصلًا', stages: ['university_student', 'fresh_graduate', 'early_career', 'other_unsure'], domains: ['career_direction'] },
  { code: 'need_data', label_ar: 'تحليل البيانات واتخاذ القرار', stages: [...EMPLOYED_LIKE, 'founder', 'freelancer'], domains: ['data_decision'] },
  { code: 'need_projects', label_ar: 'إدارة المشاريع', stages: 'all', domains: ['project_management'] },
  { code: 'need_leadership', label_ar: 'القيادة وإدارة الفرق', stages: ['experienced', 'manager', 'senior_manager', 'founder'], domains: ['people_leadership'] },
  { code: 'need_communication', label_ar: 'التواصل والعرض والتأثير', stages: 'all', domains: ['communication_influence'] },
  { code: 'need_ai', label_ar: 'الذكاء الاصطناعي وتطبيقاته العملية', stages: 'all', domains: ['ai_productivity'] },
  { code: 'need_operations', label_ar: 'العمليات وتحسين الإجراءات', stages: [...EMPLOYED_LIKE, 'founder'], domains: ['operations'] },
  /* مدخل قالب تجربة العميل (TPL-CX-001): الاحتياج ينتج حقيقة current_pain القابلة للاستخدام
     عبر قاعدة اشتقاق موثقة (facts.ts) — لا سؤال «ما ألمك؟» نصي عام */
  /* ── «المستفيد» في العنوان، و«gov_services» لا يصل إليه أحد (البند ٣٩) ──

     هذا الاحتياجُ يقول «تجربة العميل / **المستفيد**» — و«المستفيد» كلمةُ
     القطاع العامّ بعينها. ومجالُ `gov_services` كان يصل إليه **صفرُ
     احتياجات**، فبقي `PW-GOV-002` الكيانَ الوحيدَ في الفضاء النشط الذي لا
     تفوز له توليفةٌ واحدة: جرّبت حزمةُ الذهب ٢٨ توليفةً فردّته كلَّها
     بـ«الكيان خارج مجال حاجتك».

     والخريطةُ القديمةُ (`pathway-domains.v2.json`) تقول الصوابَ منذ البداية:
     `improve_customer_experience` ← `['gov_services', 'communication_influence']`.
     فالسطرُ هنا كان يُسقط ما تقوله الخريطةُ نفسُها.

     والعلاجُ توجيهُ إشارةٍ لا محتوًى جديد: المسارُ مؤلَّفٌ ودوراتُه قائمة،
     وينقصه طريقٌ يصل إليه. ولا يُفتح لغير أهله: بوّابةُ `sector: public`
     تبقى كما هي، فلا يراه إلّا من قال إنّه في القطاع العامّ. */
  { code: 'need_customer_experience', label_ar: 'تجربة العميل / المستفيد وجودة الخدمة', stages: [...EMPLOYED_LIKE, 'founder'], domains: ['operations', 'gov_services'] },
  { code: 'need_sales', label_ar: 'المبيعات والتعامل مع العملاء', stages: [...EMPLOYED_LIKE, 'founder', 'freelancer'], domains: ['sales'] },
  { code: 'need_marketing', label_ar: 'التسويق والنمو', stages: ['early_career', 'experienced', 'manager', 'founder', 'freelancer', 'other_unsure'], domains: ['marketing_growth'] },
  { code: 'need_negotiation', label_ar: 'التفاوض وإغلاق الصفقات', stages: ['experienced', 'manager', 'senior_manager', 'founder', 'freelancer'], domains: ['sales', 'communication_influence'] },
  { code: 'need_product', label_ar: 'إدارة المنتج وتجربة المستخدم', stages: ['early_career', 'experienced', 'manager', 'founder', 'freelancer'], domains: ['product_mgmt'] },
  { code: 'need_cyber', label_ar: 'الأمن السيبراني وحماية البيانات', stages: ['experienced', 'manager', 'senior_manager', 'founder'], domains: ['cyber_risk'] },
  { code: 'need_supply', label_ar: 'سلسلة الإمداد والمشتريات', stages: ['experienced', 'manager', 'senior_manager', 'founder'], domains: ['operations'] },
  { code: 'need_finance', label_ar: 'المالية وفهم الأرقام', stages: [...EMPLOYED_LIKE, 'founder', 'freelancer'], domains: ['finance_mgmt'] },
  { code: 'need_learning_design', label_ar: 'تصميم التعلم والتدريب', stages: ['trainer_ld', 'manager', 'senior_manager'], domains: ['learning_design'] },
  { code: 'need_business', label_ar: 'بناء مشروعي من الصفر', stages: ['founder', 'freelancer', 'other_unsure', 'experienced'], domains: ['entrepreneurship'] },
  { code: 'need_unsure', label_ar: 'غير متأكد — أريد اقتراحًا مبنيًا على إجاباتي', stages: 'all', domains: [] },
]

export function needByCode(code: string): NeedDefV21 | undefined {
  return NEEDS_V21.find((n) => n.code === code)
}

export function needsForStage(stage: CareerStage): NeedDefV21[] {
  return NEEDS_V21.filter((n) => n.stages === 'all' || n.stages.includes(stage))
}

/* ─── الطبقات الست الوحيدة لأسئلة B2C ─── */
export type QuestionLayerV21 =
  | 'orientation'
  | 'goal_need'
  | 'domain_differentiation'
  | 'evidence_skill'
  | 'feasibility'
  | 'confirmation_deep'

export const LAYER_LABELS_AR: Record<QuestionLayerV21, string> = {
  orientation: 'التوجيه — أين أنت الآن',
  goal_need: 'الهدف والاحتياج الحقيقي',
  domain_differentiation: 'تمييز المجال',
  evidence_skill: 'الدليل والمهارة',
  feasibility: 'الجدوى الواقعية',
  confirmation_deep: 'تأكيد وتعميق',
}

/* سطح السؤال — أين يعيش */
export type QuestionSurface =
  | 'b2c' // تشخيص المتعلم على الموقع
  | 'b2b_b2g' // مسار المؤسسات المستقل (خارج رحلة B2C)
  | 'ui_ack' // إقرار واجهة قبل البدء — ليس سؤالًا تشخيصيًا
  | 'post_recommendation' // تخصيص ما بعد التوصية (متابعة والتزام) — لا يؤثر على المسار
  | 'retired_b2c' // خارج B2C (لغة/ميزانية/أسري…) — موثق بسبب

/* معرفات الأسئلة الجديدة */
export const Q = {
  STAGE: 'QC-S1-001',
  EMPLOYMENT: 'QC-S1-002',
  GOAL: 'QC-G2-001',
  NEED: 'QC-N3-001',
  TIME: 'QC-F7-001',
  MASTERY: 'QC-C8-001',
} as const

/* أسئلة متقاعدة في الكود — تُرفض مهما قالت اللقطة المنشورة.
   خطة الأسئلة تُبنى وقت النشر لا وقت البناء، فلقطة إنتاج سابقة للتقاعد تبقى
   تصف السؤال بأنه b2c/core فتعيده جولةُ التأكيد. هذه القائمة تجعل التقاعد
   نافذًا بالنشر البرمجي وحده.

   QC-F7-001 (الساعات الأسبوعية): قِيس أثره على أربع شخصيات بأربع إجابات لكلٍّ
   منها مع تثبيت كل ما عداه — فأنتجت الستة عشر تشغيلًا ناتجًا واحدًا: نفس المسار،
   نفس الدورات، نفس الساعات، سواء قال المتعلم «أقل من ساعتين» أو «ثمانٍ فأكثر».
   وحيث قلب النتيجة في بوابة الهدر (14 مقعدًا من 300) كان القلب باستبعاد كيانات
   بحدٍّ زمني أو بتقليص الخطة إلى ثلاث دورات — لا بمطابقة أفضل. التفصيل الكامل
   في question-plan.ts عند [Q.TIME].

   QB-M2-015 (الاستعداد للتطبيق العملي): أثره الوحيد المبرمج عقوبة. راجعتُ
   كل شرط يذكر application_readiness في القوالب الستة عشر: «عالٍ» يضيف وزنًا
   صغيرًا (0.06–0.12)، و«منخفض» يضيف وزن خطر (0.16–0.20) — ولا قالب واحد
   يفضّل خطة نظرية لمن قال إن استعداده منخفض، لأن لا خطة نظرية عندنا أصلًا:
   كل مسار مشروعٌ وواجبات. فوعد السؤال المكتوب («يفضل المسارات العملية أو
   النظرية») لا مقابل له في المحرك.

   والقياس المضاد للواقع يوافق البنية: 207 مقاعد، أربعة منها فقط يستطيع أيّ
   جواب بديل أن يقلب فيها المسار (1.9٪)، وفي 93 مقعدًا كان أثره الوحيد خفض
   الثقة. أي أن السؤال كان يعاقب من يصدُق في جوابه ولا يعطيه خطة أنسب.
   التفصيل في question-plan.ts عند 'QB-M2-015'.

   QB-M3A-005 (ملف الأعمال): ميت في مقاعده كلها في بوابة الهدر، وسببه بنيوي لا
   إحصائي. حقيقته portfolio_evidence لا يقرؤها سطر واحد في المحرك، وشروطها
   الأربعة الوحيدة في TPL-PERSONAL-BRAND-001 تقارنها بأعداد (lte/gte/lt)
   بينما السؤال اختيارٌ يُنتج نصا — وevalCondition تشترط typeof === 'number'
   فتردّ false دائما، بل إن 'lt' ليست في مفاتيحها أصلا فتسقط إلى default.
   وليست حقيقةً مطلوبة في أي قالب، فتقاعدها لا يُسقط شيئا من فضاء التوصيات. */
export const RETIRED_IN_CODE: ReadonlySet<string> = new Set([Q.TIME, 'QB-M2-015', 'QB-M3A-005'])

/** حقائق محظورة في B2C — ظهور أي منها في جلسة B2C = تسرب مؤسسي (تفشل الاختبارات) */
export const B2C_BANNED_FACTS = [
  /* الوقت الأسبوعي: متقاعد — لم يعد يُجمع في B2C (انظر RETIRED_IN_CODE) */
  'weekly_load',
  'decision_owner',
  'payer_type',
  'budget_context',
  'budget_profile',
  'language',
  'content_language',
  'org_context',
  'organization_sector',
  'target_job_family',
  'job_level',
  'strategic_priority',
  'org_kpi',
  'management_hypothesis',
  'org_sensitivity',
  'cohort_size',
  'manager_involvement',
  'data_sharing_policy',
  'previous_training',
] as const

/** أسئلة محظورة في B2C (M0 المؤسسي + M9 كاملًا) */
export const B2C_BANNED_QUESTION_PREFIXES = ['QB-M0-001', 'QB-M0-009', 'QB-M9-'] as const

/* ─── الميول المهنية (RIASEC) → المجالات ─── */

/** أبعاد هولاند الستة كما تقيسها أسئلة M5 (ثلاثة أسئلة لكل بعد) */
export type RiasecDim =
  | 'riasec_realistic'
  | 'riasec_investigative'
  | 'riasec_artistic'
  | 'riasec_social'
  | 'riasec_enterprising'
  | 'riasec_conventional'

/** بعد الميل → المجالات التي يرجّحها.
    مخطَّط أكاديمي ثابت (هولاند) لا بيانات كتالوج، فموضعه هنا لا في اللقطة.
    الميل دليل غير مباشر: يرجّح ولا يحسم — والاحتياج يبقى محرّك اكتشاف المجال. */
export const RIASEC_DOMAINS: Record<RiasecDim, DomainId[]> = {
  /* أدوات وأجهزة ونتائج ملموسة، إصلاح وتحسين، مهام عملية واضحة */
  riasec_realistic: ['operations'],
  /* تحليل معلومات معقدة، بحث عميق، أسئلة بلا إجابة مباشرة */
  riasec_investigative: ['data_decision', 'cyber_risk'],
  /* صناعة محتوى وتصميم وسرد، مهام مفتوحة، لغة وصورة */
  riasec_artistic: ['marketing_growth', 'communication_influence'],
  /* مساعدة الآخرين على الفهم، الشرح والتدريب، التعاون */
  riasec_social: ['learning_design', 'people_leadership'],
  /* قيادة مبادرة وإقناع، بيع وتفاوض، منافسة ونتائج */
  riasec_enterprising: ['sales', 'entrepreneurship'],
  /* تنظيم المعلومات والملفات والخطوات بدقة */
  riasec_conventional: ['project_management', 'finance_mgmt'],
}

export const RIASEC_DIMS = Object.keys(RIASEC_DOMAINS) as RiasecDim[]

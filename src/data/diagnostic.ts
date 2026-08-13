/* محرك التشخيص التكيفي v4 — حلقة تحكم مغلقة وفق مواصفة وجيز v2 وPRD
   حالة فهم → أفضل سؤال تالٍ → إجابة → تحديث الحالة → شرط إيقاف
   - 6 أبعاد فهم + أعلام + ترتيب softmax (×8)
   - قواعد إيقاف: حسم مبكر ≥12 · إشباع ≥26 · سقف 40
   - سؤال مهارات واحد جماعي يستبعد ما ذكره الموظف في «ما يبطئك» + تقدير المستوى بمواقف سلوكية لا بتقييم ذاتي
   - لا سؤال عن الساعات الأسبوعية — الموعد المستهدف وطريقة التعلم واللغة هي القيود
   - تعارض «طموح كبير + موعد قريب» يُحل بسؤال واقعي (إيقاع مكثف / مسار أخف / تمديد)
   - قصة الموظف الواقعية تُبنى على دوره وتُضمَّن في تقريره
   - رصيد الدورات السابقة يُقاطَع آليا مع دورات التوصية — لا يدفع ثمن ما يعرفه
   - تعميق ≤2 لكل وحدة · تحقق M8 عند الغموض أو التقارب أو التناقض */

import { pathways, type Pathway } from './pathways'
import { courses, pathwayCourses, pathwayPriceFor } from './courses'

export type Dim = 'persona' | 'goal' | 'branch' | 'skills' | 'interest' | 'constraints'
type Answers = Record<string, string>

export interface DiagOption {
  label: string
  value: string
}

export type Trigger =
  | 'always'
  | 'goal_unclear'      // الهدف مجاب لكن الوضوح متوسط/غامض
  | 'goal_changed'      // إجابة التأكيد غيّرت الهدف → استنكاري
  | 'urgent_ambitious'  // طموح كبير + موعد قريب → سؤال الواقعية
  | 'close_margin'      // المساران المتصدران متقاربان → كسر تعادل
  | 'uncertainty'       // علم الغموض العام → تعميق
  | 'uns_none'          // «كلها تبدو متشابهة» → تعميق الاستكشاف

export interface DiagQuestion {
  id: string
  module: string
  moduleLabel: string
  text: string | ((a: Answers) => string)
  hint?: string | ((a: Answers) => string)
  /** المرجع العلمي الذي بُني عليه السؤال — يظهر للمستخدم */
  source?: string
  type: 'single' | 'multi' | 'text' | 'ratings'
  options?: DiagOption[] | ((a: Answers) => DiagOption[])
  /** لأسئلة التقييم الجماعي: مهارات تُقيَّم كلها في سؤال واحد من 1 إلى 5 */
  items?: { key: string; label: string }[]
  maxSelect?: number
  measures: Dim[]
  weight: number
  level: 'core' | 'deep' | 'conditional' | 'optional'
  trigger?: Trigger
}

export const GOAL_LABELS: Record<string, string> = {
  job: 'وظيفة أولى أو ترقية',
  project: 'إطلاق مشروع أو دخل إضافي',
  change: 'تغيير مسارك المهني بالكامل',
  skill: 'إتقان مهارة محددة تحتاجها الآن',
  performance: 'تحسين أدائك في وظيفتك الحالية',
  family: 'هدف أسري أو تركيز ورفاه',
}

export const GAP_LABELS: Record<string, string> = {
  data: 'التعامل مع البيانات والجداول',
  writing: 'الكتابة المهنية والتقارير',
  communication: 'التواصل والعرض',
  projects: 'تنظيم المشاريع والمتابعة',
  ai: 'استخدام أدوات الذكاء الاصطناعي',
}

/** ما يعيق الموظف في يومه → مقابله في خريطة المهارات (يُستبعد من سؤال المهارات ويُدمج في الفجوات) */
export const OBSTACLE_TO_GAP: Record<string, string> = {
  writing: 'writing',
  data: 'data',
  digital_ai: 'ai',
  projects: 'projects',
  communication: 'communication',
}

/* ═══════════════ بنك الأسئلة الموسوم ═══════════════ */

const baseQuestions: DiagQuestion[] = [
  {
    id: 'persona', module: 'M1', moduleLabel: 'من أنت الآن',
    text: 'لنبدأ ببساطة — أي وصف يشبهك اليوم أكثر من غيره؟',
    type: 'single', measures: ['persona'], weight: 2, level: 'core', trigger: 'always',
    options: [
      { label: 'طالب أو طالبة', value: 'student' },
      { label: 'خريج جديد أبحث عن أول فرصة', value: 'graduate' },
      { label: 'موظف أو موظفة', value: 'employee' },
      { label: 'رائد أعمال أو مستقل', value: 'entrepreneur' },
      { label: 'والد/والدة — هدفي أسري أو رفاه شخصي', value: 'family' },
      { label: 'بصراحة؟ ما زلت لا أعرف اتجاهي', value: 'unsure' },
    ],
  },
  {
    id: 'goal', module: 'M2', moduleLabel: 'هدفك',
    text: 'وما الذي تتمنى أن يختلف في حياتك بعد أشهر من الآن؟',
    hint: 'اختر الأقرب لقلبك — قد نتأكد منه لاحقا إن احتجنا',
    type: 'single', measures: ['goal'], weight: 2, level: 'core', trigger: 'always',
    options: [
      { label: 'وظيفة أولى أو ترقية', value: 'job' },
      { label: 'إطلاق مشروع أو دخل إضافي', value: 'project' },
      { label: 'تغيير مساري المهني بالكامل', value: 'change' },
      { label: 'إتقان مهارة محددة أحتاجها الآن', value: 'skill' },
      { label: 'تحسين أدائي في وظيفتي الحالية', value: 'performance' },
      { label: 'هدف أسري أو تركيز ورفاه', value: 'family' },
    ],
  },
  {
    id: 'day_story', module: 'M2', moduleLabel: 'قصة يومك',
    text: 'قبل التفاصيل — أي جملة تشبه يومك المعتاد هذه الفترة؟',
    hint: 'هذا السؤال يساعدنا أن نرسم مسارا يناسب إيقاع حياتك، لا حياة شخص آخر',
    type: 'single', measures: ['interest'], weight: 1.2, level: 'core', trigger: 'always',
    options: [
      { label: 'اجتماعات ومهام وراء بعضها — أنهي اليوم منهكا', value: 'meetings' },
      { label: 'محاضرات وواجبات واختبارات', value: 'studying' },
      { label: 'أرسل طلبات توظيف وأنتظر الردود', value: 'job_hunting' },
      { label: 'أطارد عملاء ومبيعات وأدير كل شيء بنفسي', value: 'clients' },
      { label: 'بيت وأطفال والتزامات لا تنتهي', value: 'home_kids' },
      { label: 'أيام متشابهة — وأشعر أنني أريد شيئا أكبر', value: 'routine_meaning' },
    ],
  },
  {
    id: 'clarity', module: 'M2', moduleLabel: 'هدفك',
    text: 'لو سألك صديق مقرب: ماذا تريد فعلا؟ — ماذا ستجيبه؟',
    hint: 'صدقك هنا يحميك من توصية خاطئة',
    type: 'single', measures: ['goal'], weight: 1.5, level: 'core', trigger: 'always',
    options: [
      { label: 'سأجيبه فورا وبثقة — أعرف ماذا أريد', value: 'very_clear' },
      { label: 'سأجيب باتجاه عام واضح', value: 'clear' },
      { label: 'سأتردد بين خيارين أو ثلاثة', value: 'medium' },
      { label: 'سأصمت قليلا... الحيرة أغلب عليّ', value: 'vague' },
    ],
  },
]

const branchQuestions: Record<string, DiagQuestion[]> = {
  student: [
    {
      id: 'stu_first_job', module: 'M3A', moduleLabel: 'جاهزيتك المهنية',
      text: 'هل لديك تصور واضح لأول وظيفة أو تدريب تريده؟',
      type: 'single', measures: ['branch'], weight: 1.5, level: 'core', trigger: 'always',
      options: [
        { label: 'نعم — أعرف الوظيفة التي أريدها', value: 'yes' },
        { label: 'لدي اتجاه عام فقط', value: 'partial' },
        { label: 'لا — وهذا ما يقلقني', value: 'no' },
      ],
    },
    {
      id: 'stu_gap', module: 'M3A', moduleLabel: 'جاهزيتك المهنية',
      text: 'ما أكبر فجوة تفصلك عن أول فرصة؟',
      type: 'single', measures: ['branch', 'skills'], weight: 1.5, level: 'core', trigger: 'always',
      options: [
        { label: 'سيرة ذاتية وملف مهني مقنع', value: 'assets' },
        { label: 'ثقة في المقابلات وعرض نفسي', value: 'interviews' },
        { label: 'خبرة عملية أو مشروع أعرضه', value: 'portfolio' },
        { label: 'اللغة الإنجليزية المهنية', value: 'english' },
        { label: 'لا أعرف المجال المناسب أصلا', value: 'direction' },
      ],
    },
    {
      id: 'stu_interests', module: 'M3A', moduleLabel: 'ميولك المهنية',
      text: 'لو خُيّرت بين نشاطين تتعلمهما هذا الفصل، أيهما أقرب لقلبك؟ اختر اثنين.',
      hint: 'أجب بما يمتعك فعلا لا بما «يُفترض» أن تختاره',
      source: 'نموذج RIASEC (هولاند) للميول المهنية — المرجع الأوسع استخداما عالميا في الإرشاد المهني',
      type: 'multi', maxSelect: 2, measures: ['interest', 'branch'], weight: 1.6, level: 'core', trigger: 'always',
      options: [
        { label: 'تحليل أرقام واكتشاف أنماط خلفها', value: 'investigative' },
        { label: 'مساعدة ناس وحل مشكلاتهم وجها لوجه', value: 'social' },
        { label: 'بناء شيء عملي بيديّ وتشغيله', value: 'realistic' },
        { label: 'تصميم وإبداع محتوى يعبّر عني', value: 'artistic' },
        { label: 'تنظيم جداول وأنظمة وترتيب فوضى', value: 'conventional' },
        { label: 'إقناع وعرض أفكار وقيادة دفة', value: 'enterprising' },
      ],
    },
  ],
  graduate: [
    {
      id: 'grad_assets', module: 'M3A', moduleLabel: 'جاهزيتك المهنية',
      text: 'هل لديك سيرة ذاتية أو ملف LinkedIn جاهز اليوم؟',
      type: 'single', measures: ['branch'], weight: 1.5, level: 'core', trigger: 'always',
      options: [
        { label: 'نعم — جاهز ومحدّث', value: 'yes' },
        { label: 'يوجد لكنه ضعيف أو قديم', value: 'weak' },
        { label: 'لا — سأبدأ من الصفر', value: 'no' },
      ],
    },
    {
      id: 'grad_gap', module: 'M3A', moduleLabel: 'جاهزيتك المهنية',
      text: 'ما أكثر ما يعطلك عن سوق العمل الآن؟',
      type: 'single', measures: ['branch', 'skills'], weight: 1.5, level: 'core', trigger: 'always',
      options: [
        { label: 'المقابلات وعرض الذات', value: 'interviews' },
        { label: 'غياب ملف أعمال أو مشاريع', value: 'portfolio' },
        { label: 'ضعف اللغة الإنجليزية', value: 'english' },
        { label: 'لا أعرف أي اتجاه أختار', value: 'direction' },
        { label: 'أحتاج مهارات عملية عامة للوظيفة الأولى', value: 'readiness' },
      ],
    },
  ],
  employee: [
    {
      id: 'emp_sector', module: 'M3B', moduleLabel: 'بيئة عملك',
      text: 'هل تعمل في القطاع الخاص أم الحكومي؟',
      type: 'single', measures: ['branch'], weight: 2, level: 'core', trigger: 'always',
      options: [
        { label: 'قطاع خاص', value: 'private' },
        { label: 'قطاع حكومي', value: 'government' },
      ],
    },
    {
      id: 'emp_goal', module: 'M3B', moduleLabel: 'بيئة عملك',
      text: 'ما الأقرب لطموحك في عملك الحالي؟',
      type: 'single', measures: ['branch'], weight: 1.5, level: 'core', trigger: 'always',
      options: [
        { label: 'أداء أفضل في دوري الحالي', value: 'performance' },
        { label: 'ترقية أو انتقال داخلي', value: 'promotion' },
        { label: 'أصبحت — أو سأصبح — مديرا لفريق', value: 'manager' },
        { label: 'أتعامل مع الجمهور والعملاء وأريد التميز', value: 'service' },
      ],
    },
    {
      id: 'emp_role', module: 'M3B', moduleLabel: 'قصتك الوظيفية',
      text: 'لو وصفت دورك اليومي بجملة واحدة، أيها أصدق؟',
      type: 'single', measures: ['branch'], weight: 1.5, level: 'core', trigger: 'always',
      options: [
        { label: 'تنفيذي مكتبي — معاملات وتقارير ومراسلات', value: 'desk' },
        { label: 'ميداني — أتعامل مع جمهور أو عملاء وجها لوجه', value: 'frontline' },
        { label: 'إشرافي — فريق يعتمد على متابعتي', value: 'supervisor' },
        { label: 'فني متخصص — أتقن تخصصا وأريد تطويره', value: 'specialist' },
        { label: 'إداري قيادي — قرارات وخطط واجتماعات', value: 'executive' },
      ],
    },
    {
      id: 'emp_obstacle', module: 'M3B', moduleLabel: 'قصتك الوظيفية',
      text: 'وما الذي يبطئك فعلا في يومك الوظيفي؟',
      hint: 'تخيل آخر مرة تأخرت فيها عن تسليم شيء — ما السبب الحقيقي؟ يمكنك اختيار سببين',
      type: 'multi', maxSelect: 2, measures: ['branch', 'skills'], weight: 1.5, level: 'core', trigger: 'always',
      options: [
        { label: 'التقارير والكتابة المهنية', value: 'writing' },
        { label: 'البيانات والجداول والمؤشرات', value: 'data' },
        { label: 'إدارة المشاريع والمتابعة', value: 'projects' },
        { label: 'قيادة الفريق والتفويض', value: 'leadership' },
        { label: 'التواصل والعرض أمام الآخرين', value: 'communication' },
        { label: 'الأدوات الرقمية والذكاء الاصطناعي', value: 'digital_ai' },
        { label: 'التعامل مع الشكاوى والضغط', value: 'complaints' },
      ],
    },
    {
      id: 'emp_years', module: 'M3B', moduleLabel: 'قصتك الوظيفية',
      text: 'كم سنة قضيت في العمل الوظيفي حتى اليوم؟',
      type: 'single', measures: ['branch'], weight: 1, level: 'deep', trigger: 'always',
      options: [
        { label: 'أقل من سنتين — ما زلت في البداية', value: 'junior' },
        { label: 'من سنتين إلى خمس', value: 'mid' },
        { label: 'من ست إلى عشر سنوات', value: 'senior' },
        { label: 'أكثر من عشر سنوات', value: 'veteran' },
      ],
    },
    {
      id: 'emp_moment', module: 'M3B', moduleLabel: 'قصتك الوظيفية',
      text: (a) => {
        const ctx: Record<string, string> = {
          desk: 'في معاملاتك وتقاريرك', frontline: 'في تعاملك مع الجمهور',
          supervisor: 'في إشرافك على فريقك', specialist: 'في عملك المتخصص', executive: 'في اجتماعاتك وقراراتك',
        }
        const where = ctx[a['emp_role'] ?? '']
        return `قصة قصيرة من واقعك${where ? ` ${where}` : ''}: آخر موقف تمنيت فيه لو كنت أقوى — ماذا حدث؟`
      },
      hint: 'جملة أو جملتان تكفيان — هذه التفاصيل هي ما يجعل مسارك مسارك أنت، لا مسار أي أحد',
      type: 'text', measures: [], weight: 0.9, level: 'deep', trigger: 'always',
    },
  ],
  entrepreneur: [
    {
      id: 'biz_stage', module: 'M3C', moduleLabel: 'مشروعك',
      text: 'في أي مرحلة مشروعك أو عملك الحر الآن؟',
      type: 'single', measures: ['branch'], weight: 1.8, level: 'core', trigger: 'always',
      options: [
        { label: 'فكرة — لم أبدأ البيع بعد', value: 'idea' },
        { label: 'بدأت — عندي عملاء أو مبيعات أولى', value: 'started' },
        { label: 'مشروع قائم — أريد نموا أكبر', value: 'existing' },
        { label: 'أعمل مستقلا (Freelance) وأريد احتراف السوق', value: 'freelance' },
      ],
    },
    {
      id: 'biz_bottleneck', module: 'M3C', moduleLabel: 'مشروعك',
      text: 'ما أكبر عنق زجاجة حاليا؟',
      type: 'single', measures: ['branch', 'skills'], weight: 1.8, level: 'core', trigger: 'always',
      options: [
        { label: 'وضوح الفكرة والعرض والقيمة', value: 'offer' },
        { label: 'التسويق والوصول للعملاء', value: 'marketing' },
        { label: 'المبيعات والتسعير والتفاوض', value: 'sales_pricing' },
        { label: 'التشغيل والتدفق النقدي', value: 'operations' },
        { label: 'أريد أساسا متكاملا قبل كل شيء', value: 'foundation' },
      ],
    },
  ],
  family: [
    {
      id: 'fam_priority', module: 'M3D', moduleLabel: 'هدفك الأسري',
      text: 'ما أكثر جانب تريد تحسينه؟',
      type: 'single', measures: ['branch'], weight: 1.8, level: 'core', trigger: 'always',
      options: [
        { label: 'الحوار والتربية الواعية مع الأبناء', value: 'parenting' },
        { label: 'تعليم الأبناء المال والسلامة الرقمية', value: 'kids_finance_digital' },
        { label: 'قيادة تعلم الأبناء وبناء عاداتهم', value: 'kids_learning' },
        { label: 'تركيزي الشخصي ورفاهي وتقليل تشتتي', value: 'wellbeing' },
      ],
    },
    {
      id: 'fam_beneficiary', module: 'M3D', moduleLabel: 'هدفك الأسري',
      text: 'لمن تريد هذا المسار؟',
      type: 'single', measures: ['branch'], weight: 1, level: 'deep', trigger: 'always',
      options: [
        { label: 'لي أنا شخصيا', value: 'self' },
        { label: 'لي ولأبنائي معا', value: 'family_all' },
      ],
    },
  ],
  unsure: [
    {
      id: 'uns_interests', module: 'M3E', moduleLabel: 'استكشاف اتجاهك',
      text: 'أي المجالات تجذبك ولو قليلا؟',
      type: 'single', measures: ['branch', 'interest'], weight: 1.8, level: 'core', trigger: 'always',
      options: [
        { label: 'الأعمال وريادة المشاريع', value: 'business' },
        { label: 'البيانات والتحليل والتقنية', value: 'data' },
        { label: 'التسويق وصناعة المحتوى', value: 'marketing' },
        { label: 'القيادة والتأثير في الناس', value: 'leadership' },
        { label: 'لا أعرف — كلها تبدو متشابهة', value: 'none' },
      ],
    },
    {
      id: 'uns_experiment', module: 'M3E', moduleLabel: 'استكشاف اتجاهك',
      text: 'هل تقبل تجربة قصيرة (أسبوعين) قبل الالتزام بمسار طويل؟',
      type: 'single', measures: ['branch'], weight: 1.2, level: 'core', trigger: 'always',
      options: [
        { label: 'نعم — أريد أن أجرب أولا', value: 'yes' },
        { label: 'لا — أريد مسارا حاسما من البداية', value: 'no' },
        { label: 'أفضّل أن يساعدني مستشار في القرار', value: 'advisor' },
      ],
    },
  ],
}

/* أسئلة الموظف الحكومي — gov_audience نواة، والباقي تعميقي */
const govJobQuestions: DiagQuestion[] = [
  {
    id: 'gov_audience', module: 'M3B+', moduleLabel: 'وظيفتك الحكومية',
    text: 'مع من يدور عملك أغلب اليوم؟',
    type: 'single', measures: ['branch'], weight: 1.8, level: 'core', trigger: 'always',
    options: [
      { label: 'مراجعون ومواطنون — أنا الواجهة', value: 'citizens' },
      { label: 'موظفون وإدارات داخلية', value: 'internal' },
      { label: 'قيادات — أجهّز قرارات ومذكرات', value: 'leadership' },
      { label: 'عقود ومشتريات وموردون', value: 'procurement' },
      { label: 'بيانات وتقارير ومؤشرات', value: 'data' },
    ],
  },
  {
    id: 'gov_level', module: 'M3B+', moduleLabel: 'وظيفتك الحكومية',
    text: 'ما مستواك الوظيفي الحالي في الجهة الحكومية؟',
    type: 'single', measures: ['branch'], weight: 1.1, level: 'deep', trigger: 'always',
    options: [
      { label: 'موظف ممارس — أنفذ العمل اليومي', value: 'practitioner' },
      { label: 'موظف متمرس — مرجع لزملائي في تخصصي', value: 'senior' },
      { label: 'رئيس قسم أو مشرف', value: 'supervisor' },
      { label: 'مدير إدارة أو أعلى', value: 'director' },
    ],
  },
  {
    id: 'gov_system', module: 'M3B+', moduleLabel: 'وظيفتك الحكومية',
    text: 'وكيف حال العمل الرقمي في جهتك؟',
    hint: 'إجابتك تحدد إن كنت تحتاج تأسيسا رقميا أم قفزة متقدمة',
    type: 'single', measures: ['branch'], weight: 1.1, level: 'deep', trigger: 'always',
    options: [
      { label: 'ورقي غالبا — الأنظمة عندنا شكلية', value: 'paper' },
      { label: 'رقمي جزئيا — نتنقل بين الورق والنظام', value: 'partial' },
      { label: 'رقمي متقدم — وأريد استغلاله أكثر', value: 'advanced' },
    ],
  },
]

/* خيارات خريطة المهارات — تُصفّى ديناميكيا لمن ذكر عوائقه في سؤال الموظف */
const SK_GAP_OPTIONS: DiagOption[] = [
  { label: 'البيانات والجداول والأدوات الرقمية', value: 'data' },
  { label: 'الكتابة المهنية: تقارير وعروض ومذكرات', value: 'writing' },
  { label: 'التواصل والعرض والتحدث بثقة', value: 'communication' },
  { label: 'تنظيم المشاريع والمهام والمواعيد', value: 'projects' },
  { label: 'استخدام أدوات الذكاء الاصطناعي', value: 'ai' },
]

/* سؤال المهارات الجماعي — سؤال واحد بسياسة المنتج، يكمل ما بدأه الموظف لا يكرره */
const skillsQuestion: DiagQuestion = {
  id: 'sk_gaps', module: 'M4', moduleLabel: 'خريطة مهاراتك',
  text: (a) =>
    (a['emp_obstacle'] ?? '').split(',').some((o) => OBSTACLE_TO_GAP[o])
      ? 'ما ذكرته عن عوائق يومك محفوظ ومحسوب — فهل تعيقك مهارات أخرى لم تُذكر بعد؟'
      : 'بدلا من تقييم كل مهارة على حدة — أي هذه المهارات تشعر أنها تعيقك اليوم فعلا؟',
  hint: (a) =>
    (a['emp_obstacle'] ?? '').split(',').some((o) => OBSTACLE_TO_GAP[o])
      ? 'أكمل الصورة هنا (حتى ٣) — أو اختر «لا شيء» إن كان ما قلته يكفي'
      : 'اختر كل ما ينطبق بصدق (حتى ٣) — وإن لم يعيقك شيء فهذا خبر جيد أيضا',
  type: 'multi', maxSelect: 3, measures: ['skills'], weight: 2, level: 'core', trigger: 'always',
  options: (a) => {
    const covered = (a['emp_obstacle'] ?? '').split(',').map((o) => OBSTACLE_TO_GAP[o]).filter(Boolean)
    return [
      ...SK_GAP_OPTIONS.filter((o) => !covered.includes(o.value)),
      { label: 'بصراحة — لا شيء منها يعيقني', value: 'none' },
    ]
  },
}

/* أسئلة المواقف السلوكية — لا تقييم ذاتي أبدا: كل خيار يصف موقفا حقيقيا ويخفي مستوى (1–5)
   يستنتجه المحرك، فيشعر المستخدم أنه يحكي يومه لا أنه يُختبر */
const SCENARIOS: Record<string, DiagQuestion> = {
  data: {
    id: 'sc_data', module: 'M4', moduleLabel: 'خريطة مهاراتك',
    text: 'آخر مرة احتجت فيها جدول بيانات أو أرقاما لعملك أو دراستك — ماذا حدث فعلا؟',
    hint: 'أجب بما حدث فعلا لا بما تتمناه — إجابتك تترجم لمستوى دون أن تشعر',
    source: 'تقدير المستوى بالأدلة السلوكية — البديل المعتمد عن التقييم الذاتي في أدبيات القياس المهني',
    type: 'single', measures: ['skills'], weight: 1.8, level: 'core', trigger: 'always',
    options: [
      { label: 'تجنبت الموضوع أو اعتمدت على غيري تماما', value: '1' },
      { label: 'قرأت الأرقام واستخرجت معلومات بسيطة', value: '2' },
      { label: 'نظمت البيانات بمعادلات وجداول جاهزة', value: '3' },
      { label: 'حللت الأرقام وخرجت باستنتاج أو توصية', value: '4' },
      { label: 'بنيت لوحات ومؤشرات يعتمد عليها غيري', value: '5' },
    ],
  },
  writing: {
    id: 'sc_writing', module: 'M4', moduleLabel: 'خريطة مهاراتك',
    text: 'لو طُلب منك غدا تقرير أو مذكرة رسمية — كيف تكون الصورة؟',
    hint: 'تخيل الموقف بصدق — إجابتك تترجم لمستوى دون أن تشعر',
    source: 'تقدير المستوى بالأدلة السلوكية — البديل المعتمد عن التقييم الذاتي في أدبيات القياس المهني',
    type: 'single', measures: ['skills'], weight: 1.8, level: 'core', trigger: 'always',
    options: [
      { label: 'سأتوتر — لا أعرف من أين أبدأ', value: '1' },
      { label: 'سأكتب بصعوبة وأحتاج مراجعة كثيرة', value: '2' },
      { label: 'سأكتب تقريرا مقبولا يؤدي الغرض', value: '3' },
      { label: 'سأكتب بثقة وأعرف قوالب العمل الرسمية', value: '4' },
      { label: 'كتابتي مرجع — يراجعها زملائي قبل الإرسال', value: '5' },
    ],
  },
  communication: {
    id: 'sc_communication', module: 'M4', moduleLabel: 'خريطة مهاراتك',
    text: 'تخيل أنك ستقف غدا لتعرض فكرتك أمام مجموعة — ماذا يجري بداخلك؟',
    hint: 'لا توجد إجابة تخجلك — إجابتك تترجم لمستوى دون أن تشعر',
    source: 'تقدير المستوى بالأدلة السلوكية — البديل المعتمد عن التقييم الذاتي في أدبيات القياس المهني',
    type: 'single', measures: ['skills'], weight: 1.8, level: 'core', trigger: 'always',
    options: [
      { label: 'قلق حقيقي — سأبحث عن أي مخرج', value: '1' },
      { label: 'أتوتر وصوتي يرتجف لكني أنجو', value: '2' },
      { label: 'أعرض وأجيب إن حضرت جيدا', value: '3' },
      { label: 'مرتاح — أعرض وأقنع وأدير الأسئلة', value: '4' },
      { label: 'أستمتع — والناس تطلب مني العرض نيابة عنها', value: '5' },
    ],
  },
  projects: {
    id: 'sc_projects', module: 'M4', moduleLabel: 'خريطة مهاراتك',
    text: 'كيف تدير مهامك ومواعيدك اليوم فعلا؟',
    hint: 'صف واقعك كما هو — إجابتك تترجم لمستوى دون أن تشعر',
    source: 'تقدير المستوى بالأدلة السلوكية — البديل المعتمد عن التقييم الذاتي في أدبيات القياس المهني',
    type: 'single', measures: ['skills'], weight: 1.8, level: 'core', trigger: 'always',
    options: [
      { label: 'في رأسي — وأنسى وأتفاجأ بالمواعيد', value: '1' },
      { label: 'قوائم متفرقة — تنجح أحيانا', value: '2' },
      { label: 'نظام واحد يناسبني وألتزم به غالبا', value: '3' },
      { label: 'أخطط مسبقا وأتابع مهامي ومهام غيري', value: '4' },
      { label: 'أدير مشاريع كاملة بأدوات ومنهجية واضحة', value: '5' },
    ],
  },
  ai: {
    id: 'sc_ai', module: 'M4', moduleLabel: 'خريطة مهاراتك',
    text: 'وأدوات الذكاء الاصطناعي — ما قصتك معها حتى اليوم؟',
    hint: 'من «لم أجربها» إلى «أعلّمها» — إجابتك تترجم لمستوى دون أن تشعر',
    source: 'تقدير المستوى بالأدلة السلوكية — البديل المعتمد عن التقييم الذاتي في أدبيات القياس المهني',
    type: 'single', measures: ['skills'], weight: 1.8, level: 'core', trigger: 'always',
    options: [
      { label: 'لم أجربها فعليا بعد', value: '1' },
      { label: 'جربتها فضولا — أسئلة بسيطة هنا وهناك', value: '2' },
      { label: 'أستخدمها أسبوعيا لمهام محددة', value: '3' },
      { label: 'جزء من عملي اليومي وأعرف حدودها', value: '4' },
      { label: 'أبني بها حلولا وأعلّم زملائي استخدامها', value: '5' },
    ],
  },
}

/** المواقف المستحقة لهذا المستخدم: مهارات فجواته المعلنة فقط (بحد أقصى ٣) — لا استجواب شاملا لكل مهارة */
function scenariosFor(a: Answers): DiagQuestion[] {
  const fromObstacles = (a['emp_obstacle'] ?? '').split(',').map((o) => OBSTACLE_TO_GAP[o]).filter(Boolean)
  const declared = [...new Set([...(a['sk_gaps'] ?? '').split(',').filter((g) => g && g !== 'none'), ...fromObstacles])]
  return declared.slice(0, 3).map((g) => SCENARIOS[g]).filter(Boolean)
}

/** المستويات المستنتجة من المواقف — مفتاحها sc_<مهارة> بقيمة 1..5 */
export function scenarioLevels(a: Answers): Record<string, string> {
  return Object.fromEntries(
    ['data', 'writing', 'communication', 'projects', 'ai']
      .filter((s) => a[`sc_${s}`])
      .map((s) => [s, a[`sc_${s}`]])
  )
}

/* الدورات السابقة — نص مفتوح يمنع تكرار ما تعلمه فعلا، ويُقاطَع آليا مع دورات التوصية */
const prevCoursesQuestion: DiagQuestion = {
  id: 'prev_courses', module: 'M4B', moduleLabel: 'رصيدك السابق',
  text: 'هل أخذت دورات أو شهادات من قبل؟ اكتبها لنا — حتى لا نرشح لك ما تعرفه أصلا.',
  hint: 'اسم الدورة أو الجهة يكفي — مثال: دورة إكسل من معهد، شهادة PMP، برنامج إعداد المدربين',
  type: 'text', measures: ['skills'], weight: 1.2, level: 'core', trigger: 'always',
}

const constraintQuestions: DiagQuestion[] = [
  {
    id: 'target_date', module: 'M7', moduleLabel: 'ظروفك',
    text: 'ومتى تحب أن ترى نتيجة ملموسة في حياتك؟',
    hint: 'موعدك يقود طول مسارك وإيقاعه — كن صادقا مع نفسك',
    type: 'single', measures: ['constraints'], weight: 1.5, level: 'core', trigger: 'always',
    options: [
      { label: 'خلال شهر إلى 3 أشهر — أستعجل', value: 'soon' },
      { label: 'خلال 3 إلى 6 أشهر', value: 'mid' },
      { label: 'خلال سنة — لا أستعجل', value: 'year' },
    ],
  },
  {
    id: 'format', module: 'M7', moduleLabel: 'ظروفك',
    text: 'ما الصيغة التي تتعلم بها أفضل؟',
    type: 'single', measures: ['constraints'], weight: 1, level: 'core', trigger: 'always',
    options: [
      { label: 'مباشر مع مدرب ومواعيد', value: 'live' },
      { label: 'مسجل أتعلم بوتيرتي', value: 'recorded' },
      { label: 'مختلط — الاثنان معا', value: 'mixed' },
      { label: 'تطبيق ومشاريع أكثر من المشاهدة', value: 'applied' },
    ],
  },
  {
    id: 'learn_lang', module: 'M7', moduleLabel: 'ظروفك',
    text: 'وبأي لغة ترتاح أن تتعلم؟',
    hint: 'بعض أقوى المحتوى العالمي بالإنجليزية — صدقك هنا يريحك لاحقا',
    type: 'single', measures: ['constraints'], weight: 1.2, level: 'core', trigger: 'always',
    options: [
      { label: 'العربية — أريح لي وأتعلم أسرع', value: 'arabic' },
      { label: 'الإنجليزية مريحة لي أيضا', value: 'english_ok' },
      { label: 'لا فرق — المهم المحتوى', value: 'either' },
    ],
  },
  {
    id: 'commit_pref', module: 'M7', moduleLabel: 'خطتك',
    text: 'لو وجدت ما يناسبك تماما — أيهما أقرب لخطتك؟',
    hint: 'إجابتك تجعلنا نقدم لك المقارنة الصحيحة — وتقدر تغير رأيك عند النتيجة',
    type: 'single', measures: ['constraints'], weight: 1.05, level: 'deep', trigger: 'always',
    options: [
      { label: 'دورة واحدة أجرب بها أولا', value: 'single_course' },
      { label: 'مسار كامل — أريد التحول الجاد', value: 'full_path' },
      { label: 'غير متأكد — أروني الخيارين', value: 'unsure' },
    ],
  },
]

/* ═══ أسئلة M8 — شرطية: لا تظهر إلا عند الحاجة ═══ */

const confirmQuestion: DiagQuestion = {
  id: 'confirm_goal', module: 'M8', moduleLabel: 'نتأكد معا',
  text: (a) =>
    `سجلت أن هدفك «${GOAL_LABELS[a['goal']] ?? 'التطوير'}»، لكن إجاباتك تقول إن الصورة لم تكتمل بعد. لو نجحنا معك تماما بعد ستة أشهر، أي نتيجة ستجعلك تقول: نعم، هذا ما كنت أريده فعلا؟`,
  hint: 'لا تفكر في الإجابة «الصحيحة» — فكر فيما سيفرحك حقا',
  type: 'single', measures: ['goal'], weight: 1.8, level: 'conditional', trigger: 'goal_unclear',
  options: [
    { label: 'أوقّع عرض وظيفة أو أستلم مهام دور أعلى', value: 'job' },
    { label: 'أطلق مشروعي أو أقبض أول دخل إضافي', value: 'project' },
    { label: 'أبدأ فعليا في مجال جديد مختلف عن مجالي', value: 'change' },
    { label: 'أستخدم المهارة التي أحتاجها بثقة في عملي', value: 'skill' },
    { label: 'يلاحظ مديري وفريقي فرقا واضحا في أدائي', value: 'performance' },
    { label: 'يتغير جو بيتي أو روتيني الشخصي للأفضل', value: 'family' },
  ],
}

const reconcileQuestion: DiagQuestion = {
  id: 'reconcile_goal', module: 'M8', moduleLabel: 'لحظة صدق',
  text: (a) =>
    `لحظة جميلة — في البداية قلت «${GOAL_LABELS[a['goal']]}»، والآن اخترت «${GOAL_LABELS[a['confirm_goal']]}». هذا يحدث كثيرا حين نصدق مع أنفسنا. لو خيرناك بواحدة فقط، أيهما أقرب إلى قلبك؟`,
  hint: 'لا توجد إجابة خاطئة — نبني على اختيارك الأخير',
  type: 'single', measures: ['goal'], weight: 2, level: 'conditional', trigger: 'goal_changed',
  options: (a) => [
    { label: `الأولى: ${GOAL_LABELS[a['goal']]}`, value: a['goal'] },
    { label: `الثانية: ${GOAL_LABELS[a['confirm_goal']]}`, value: a['confirm_goal'] },
  ],
}

const conflictQuestion: DiagQuestion = {
  id: 'conflict_resolve', module: 'M8', moduleLabel: 'لنكن واقعيين',
  text: (a) =>
    `لاحظت تحديا جميلا: هدفك «${GOAL_LABELS[a['reconcile_goal'] ?? a['confirm_goal'] ?? a['fup_goal_vague'] ?? a['goal']] ?? 'التطوير'}» وتريد نتيجة خلال أشهر قليلة. ليكون مسارك واقعيا — أيهما أقرب لك؟`,
  hint: 'الصدق هنا يحميك من مسار تتوقف عنه في الأسبوع الثالث',
  type: 'single', measures: ['constraints'], weight: 1.8, level: 'conditional', trigger: 'urgent_ambitious',
  options: [
    { label: 'ألتزم بإيقاع مكثف — هذا الهدف أولوية الآن', value: 'intensive' },
    { label: 'أعطني مسارا أخف وأقصر يوصلني للبداية الصحيحة', value: 'lighter' },
    { label: 'نمدد الموعد قليلا — المهم ألا أنقطع', value: 'extend' },
  ],
}

const tieBreakQuestion: DiagQuestion = {
  id: 'tie_break', module: 'M8', moduleLabel: 'الحسم الأخير',
  text: 'مساران متقاربان جدا عندي الآن — واحدة منك تحسم: أيهما يشدك أكثر لو بدأت غدا؟',
  type: 'single', measures: ['goal'], weight: 2, level: 'conditional', trigger: 'close_margin',
  options: (a) => topTwo(a).map((p) => ({ label: p.name, value: p.id })),
}

const vagueGoalFollowup: DiagQuestion = {
  id: 'fup_goal_vague', module: 'M2', moduleLabel: 'نتعمق قليلا',
  text: 'حيرتك مفهومة — دعنا نجرب من زاوية أخرى: ما أكثر شيء يشغل بالك عندما تفكر في مستقبلك قبل النوم؟',
  type: 'single', measures: ['goal', 'interest'], weight: 1.6, level: 'deep', trigger: 'uncertainty',
  options: [
    { label: 'الأمان الوظيفي والاستقرار', value: 'job' },
    { label: 'الدخل وحرية المال والمشروع', value: 'project' },
    { label: 'المعنى — أريد عملا يشبهني', value: 'change' },
    { label: 'أن أصبح متمكنا لا متفرجا', value: 'skill' },
    { label: 'أسرتي وتوازني النفسي', value: 'family' },
  ],
}

const unsNoneFollowup: DiagQuestion = {
  id: 'fup_uns_none', module: 'M3E', moduleLabel: 'نتعمق قليلا',
  text: 'طبيعي أن تتشابه الخيارات من بعيد. تخيل يوما مثاليا بعد ثلاث سنوات — ماذا تفعل فيه؟',
  type: 'single', measures: ['branch', 'interest'], weight: 1.6, level: 'deep', trigger: 'uns_none',
  options: [
    { label: 'أدير اجتماعا لفريقي الخاص', value: 'leadership' },
    { label: 'أحلل أرقاما وأكتشف قصة خلفها', value: 'data' },
    { label: 'أطلق حملة لمشروعي وأراقب تفاعل الناس', value: 'business' },
    { label: 'أصمم محتوى يصل لآلاف الناس', value: 'marketing' },
    { label: 'بصراحة ما زالت الصورة ضبابية', value: 'none' },
  ],
}

const secondGoalQuestion: DiagQuestion = {
  id: 'second_goal', module: 'M2B', moduleLabel: 'هدفك الثاني',
  text: 'بعض الناس هدفهم واحد، وبعضهم خليط — هل يشدك هدف ثانٍ أيضا؟',
  hint: 'اختياري تماما — إن اخترت هدفين سنقترح لك مسارين متكاملين لا مسارا واحدا',
  type: 'single', measures: ['goal'], weight: 0.8, level: 'optional', trigger: 'always',
  options: (a) => [
    { label: 'لا — هدفي واحد واضح', value: 'none' },
    ...Object.entries(GOAL_LABELS)
      .filter(([v]) => v !== (a['reconcile_goal'] ?? a['confirm_goal'] ?? a['goal']))
      .map(([v, l]) => ({ label: `نعم — ${l}`, value: v })),
  ],
}

const notesQuestion: DiagQuestion = {
  id: 'notes', module: 'M9', moduleLabel: 'كلمتك الأخيرة',
  text: 'قبل أن نرسم مسارك — هل في بالك شيء لم تقله بعد؟',
  hint: 'ظرف خاص، حلم بعيد، تجربة سابقة فاشلة، أي شيء — سطر واحد منك يغير دقة التوصية كثيرا',
  type: 'text', measures: [], weight: 0.5, level: 'optional', trigger: 'always',
}

/* ═══════════════ تجميع البنك حسب الحالة ═══════════════ */

function bankFor(a: Answers): DiagQuestion[] {
  const bank: DiagQuestion[] = [...baseQuestions]
  const persona = a['persona']
  if (persona && branchQuestions[persona]) {
    bank.push(...branchQuestions[persona])
    if (persona === 'employee' && a['emp_sector'] === 'government') bank.push(...govJobQuestions)
  }
  bank.push(skillsQuestion, ...scenariosFor(a), ...constraintQuestions)
  bank.push(confirmQuestion, reconcileQuestion, conflictQuestion, tieBreakQuestion, vagueGoalFollowup, unsNoneFollowup)
  bank.push(prevCoursesQuestion)
  if (a['goal']) bank.push(secondGoalQuestion)
  bank.push(notesQuestion)
  return bank
}

/* ═══════════════ محرك النقاط (خام) ═══════════════ */

function rawScore(a: Answers): Record<string, number> {
  const score: Record<string, number> = {}
  const add = (id: string, pts: number) => { score[id] = (score[id] || 0) + pts }

  const persona = a['persona']
  if (persona === 'student') { add('PW-STU-001', 12); add('PW-STU-003', 8); add('PW-FND-001', 4) }
  if (persona === 'graduate') { add('PW-STU-002', 12); add('PW-CAREER-002', 6); add('PW-CAREER-003', 5) }
  if (persona === 'employee') { add('PW-EMP-001', 10); add('PW-FND-001', 3) }
  if (persona === 'entrepreneur') { add('PW-BIZ-001', 8); add('PW-FREE-001', 6) }
  if (persona === 'family') { add('PW-FAM-001', 8); add('PW-WELL-001', 6) }
  if (persona === 'unsure') { add('PW-STU-003', 10); add('PW-CAREER-001', 6); add('PW-FND-001', 5) }

  const goal = a['reconcile_goal'] ?? a['confirm_goal'] ?? a['fup_goal_vague'] ?? a['goal']
  if (goal === 'job') { add('PW-STU-002', 10); add('PW-CAREER-003', 8); add('PW-STU-001', 6); add('PW-EMP-001', 4) }
  if (goal === 'project') { add('PW-BIZ-001', 12); add('PW-FREE-001', 8); add('PW-BIZ-004', 5) }
  if (goal === 'change') { add('PW-CAREER-001', 14); add('PW-STU-003', 5) }
  if (goal === 'skill') { add('PW-FND-003', 6); add('PW-FND-005', 5); add('PW-EMP-004', 5) }
  if (goal === 'performance') { add('PW-EMP-001', 8); add('PW-EMP-003', 5); add('PW-EMP-004', 5) }
  if (goal === 'family') { add('PW-FAM-003', 10); add('PW-FAM-001', 8); add('PW-WELL-001', 6) }

  const goal2 = a['second_goal'] && a['second_goal'] !== 'none' ? a['second_goal'] : null
  if (goal2 === 'job') { add('PW-STU-002', 5); add('PW-CAREER-003', 4); add('PW-EMP-001', 2) }
  if (goal2 === 'project') { add('PW-BIZ-001', 6); add('PW-FREE-001', 4); add('PW-BIZ-004', 3) }
  if (goal2 === 'change') { add('PW-CAREER-001', 7); add('PW-STU-003', 3) }
  if (goal2 === 'skill') { add('PW-FND-003', 4); add('PW-FND-005', 3); add('PW-EMP-004', 3) }
  if (goal2 === 'performance') { add('PW-EMP-001', 4); add('PW-EMP-003', 3); add('PW-EMP-004', 3) }
  if (goal2 === 'family') { add('PW-FAM-003', 5); add('PW-FAM-001', 4); add('PW-WELL-001', 3) }

  const day = a['day_story']
  if (day === 'meetings') { add('PW-EMP-001', 4); add('PW-FND-006', 3) }
  if (day === 'studying') { add('PW-STU-001', 4) }
  if (day === 'job_hunting') { add('PW-STU-002', 5); add('PW-CAREER-003', 4) }
  if (day === 'clients') { add('PW-BIZ-001', 4); add('PW-FREE-001', 3) }
  if (day === 'home_kids') { add('PW-FAM-003', 4); add('PW-WELL-001', 3) }
  if (day === 'routine_meaning') { add('PW-CAREER-001', 5); add('PW-STU-003', 4) }

  if (a['stu_first_job'] === 'no' || a['stu_gap'] === 'direction') add('PW-STU-003', 18)

  /* ميول الطالب — RIASEC توجه نقاط المسارات */
  for (const riasec of (a['stu_interests'] ?? '').split(',')) {
    if (riasec === 'investigative') { add('PW-EMP-004', 8); add('PW-GOV-007', 6); add('PW-FND-003', 4) }
    if (riasec === 'social') { add('PW-GOV-002', 8); add('PW-EMP-006', 6); add('PW-FND-005', 4) }
    if (riasec === 'realistic') { add('PW-BIZ-001', 8); add('PW-FREE-001', 6) }
    if (riasec === 'artistic') { add('PW-FREE-001', 8); add('PW-FND-005', 5) }
    if (riasec === 'conventional') { add('PW-EMP-003', 8); add('PW-STU-001', 5); add('PW-GOV-001', 4) }
    if (riasec === 'enterprising') { add('PW-BIZ-001', 6); add('PW-BIZ-003', 6); add('PW-LEAD-001', 5) }
  }
  if (a['stu_gap'] === 'assets') { add('PW-STU-001', 16); add('PW-CAREER-002', 10) }
  if (a['stu_gap'] === 'interviews') { add('PW-CAREER-003', 16); add('PW-FND-005', 6) }
  if (a['stu_gap'] === 'portfolio') { add('PW-CAREER-002', 14); add('PW-STU-001', 10) }
  if (a['stu_gap'] === 'english') add('PW-FND-007', 20)
  if (a['grad_assets'] === 'no') add('PW-STU-002', 10)
  if (a['grad_gap'] === 'interviews') add('PW-CAREER-003', 18)
  if (a['grad_gap'] === 'portfolio') { add('PW-CAREER-002', 16); add('PW-STU-002', 8) }
  if (a['grad_gap'] === 'english') add('PW-FND-007', 20)
  if (a['grad_gap'] === 'direction') add('PW-STU-003', 18)
  if (a['grad_gap'] === 'readiness') add('PW-STU-002', 14)

  const isGov = a['emp_sector'] === 'government'
  if (isGov) {
    add('PW-GOV-001', 14)
    if (a['emp_goal'] === 'service') add('PW-GOV-002', 16)
    if (a['emp_goal'] === 'manager') add('PW-GOV-006', 16)
    for (const ob of (a['emp_obstacle'] ?? '').split(',')) {
      if (ob === 'writing') add('PW-GOV-001', 10)
      if (ob === 'data') add('PW-GOV-007', 16)
      if (ob === 'digital_ai') { add('PW-GOV-008', 14); add('PW-GOV-005', 10) }
      if (ob === 'complaints') add('PW-GOV-002', 16)
      if (ob === 'leadership') add('PW-GOV-006', 16)
      if (ob === 'projects') add('PW-GOV-005', 10)
      if (ob === 'communication') add('PW-GOV-002', 8)
    }
    const aud = a['gov_audience']
    if (aud === 'citizens') add('PW-GOV-002', 12)
    if (aud === 'procurement') add('PW-GOV-003', 14)
    if (aud === 'data') add('PW-GOV-007', 12)
    if (aud === 'leadership') { add('PW-GOV-006', 6); add('PW-GOV-004', 10) }
    if (aud === 'internal') add('PW-GOV-004', 8)
    const lvl = a['gov_level']
    if (lvl === 'supervisor' || lvl === 'director') add('PW-GOV-006', 10)
    if (lvl === 'practitioner') add('PW-GOV-001', 6)
    const sys = a['gov_system']
    if (sys === 'paper') { add('PW-GOV-008', 10); add('PW-GOV-005', 6) }
    if (sys === 'advanced') { add('PW-GOV-007', 4); add('PW-LEAD-001', 3) }
  } else if (a['emp_sector'] === 'private') {
    if (a['emp_goal'] === 'manager') add('PW-EMP-005', 18)
    if (a['emp_goal'] === 'service') add('PW-EMP-006', 16)
    if (a['emp_goal'] === 'promotion') { add('PW-EMP-001', 8); add('PW-EMP-003', 6) }
    for (const ob of (a['emp_obstacle'] ?? '').split(',')) {
      if (ob === 'writing') add('PW-EMP-002', 18)
      if (ob === 'data') add('PW-EMP-004', 18)
      if (ob === 'projects') add('PW-EMP-003', 18)
      if (ob === 'leadership') add('PW-EMP-005', 18)
      if (ob === 'communication') { add('PW-FND-005', 16); add('PW-EMP-001', 6) }
      if (ob === 'digital_ai') { add('PW-FND-003', 16); add('PW-EMP-004', 6) }
      if (ob === 'complaints') add('PW-EMP-006', 16)
    }
  }
  const role = a['emp_role']
  if (role === 'supervisor' || role === 'executive') { add(isGov ? 'PW-GOV-006' : 'PW-EMP-005', 8); add('PW-LEAD-001', 4) }
  if (role === 'frontline') add(isGov ? 'PW-GOV-002' : 'PW-EMP-006', 8)
  if (role === 'desk') add(isGov ? 'PW-GOV-001' : 'PW-EMP-002', 6)
  if (role === 'specialist') add('PW-EMP-004', 4)
  if (a['emp_years'] === 'junior') add(isGov ? 'PW-GOV-001' : 'PW-EMP-001', 5)
  if (a['emp_years'] === 'veteran') add('PW-LEAD-002', 4)

  const stage = a['biz_stage']
  if (stage === 'idea') add('PW-BIZ-001', 18)
  if (stage === 'started') { add('PW-BIZ-001', 8); add('PW-BIZ-004', 8) }
  if (stage === 'existing') add('PW-BIZ-002', 16)
  if (stage === 'freelance') add('PW-FREE-001', 18)
  const bk = a['biz_bottleneck']
  if (bk === 'offer') add('PW-BIZ-001', 14)
  if (bk === 'marketing') add('PW-BIZ-004', 18)
  if (bk === 'sales_pricing') add('PW-BIZ-003', 18)
  if (bk === 'operations') add('PW-BIZ-005', 18)
  if (bk === 'foundation') add('PW-BIZ-001', 10)

  const fp = a['fam_priority']
  if (fp === 'parenting') add('PW-FAM-003', 20)
  if (fp === 'kids_finance_digital') add('PW-FAM-002', 20)
  if (fp === 'kids_learning') add('PW-FAM-001', 20)
  if (fp === 'wellbeing') { add('PW-WELL-001', 18); add('PW-FND-006', 10) }

  const ui = a['fup_uns_none'] && a['fup_uns_none'] !== 'none' ? a['fup_uns_none'] : a['uns_interests']
  if (ui === 'business') add('PW-BIZ-001', 12)
  if (ui === 'data') add('PW-EMP-004', 12)
  if (ui === 'marketing') add('PW-BIZ-004', 12)
  if (ui === 'leadership') add('PW-LEAD-001', 12)
  if (ui === 'none') add('PW-STU-003', 14)

  const selected = (a['sk_gaps'] ?? '').split(',').filter((g) => g && g !== 'none')
  for (const g of selected) {
    if (g === 'data') { add('PW-EMP-004', 8); if (isGov) add('PW-GOV-007', 6) }
    if (g === 'writing') { add('PW-EMP-002', 8); if (isGov) add('PW-GOV-001', 5) }
    if (g === 'communication') add('PW-FND-005', 8)
    if (g === 'projects') add('PW-EMP-003', 8)
    if (g === 'ai') { add('PW-FND-003', 8); if (isGov) add('PW-GOV-008', 5) }
  }

  /* الموعد المستهدف — الاستعجال يرجّح الأقصر، والتروي يفتح الباب للأعمق، وقرار التعارض يحسم */
  const td = a['target_date']
  const lighter = a['conflict_resolve'] === 'lighter'
  if (td === 'soon' || lighter) {
    const boost = lighter ? 6 : 3
    for (const p of pathways) if (p.durationWeeks <= 8) add(p.id, boost)
    if (a['conflict_resolve'] !== 'intensive') {
      for (const p of pathways) if (p.durationWeeks >= 14) add(p.id, lighter ? -6 : -3)
    }
    add('PW-CAREER-003', lighter ? 6 : 4)
  }
  if (td === 'year') {
    for (const p of pathways) if (p.durationWeeks >= 12) add(p.id, 2)
  }
  if (a['conflict_resolve'] === 'intensive') { add('PW-BIZ-002', 3); add('PW-EMP-005', 3); add('PW-GOV-006', 3) }

  /* اللغة — الكتالوج يُدرَّس بالعربية؛ الراحة في الإنجليزية تعزز مسار الإنجليزية المهنية لمن فجوته لغوية */
  if ((a['learn_lang'] === 'english_ok' || a['learn_lang'] === 'either') &&
      (a['stu_gap'] === 'english' || a['grad_gap'] === 'english')) add('PW-FND-007', 4)

  /* كسر التعادل الصريح */
  if (a['tie_break']) add(a['tie_break'], 10)

  return score
}

/* ═══════════════ حالة الفهم ═══════════════ */

export interface RankedPathway {
  p: Pathway
  s: number
  prob: number
}

export interface DiagState {
  dims: Record<Dim, number>
  flags: { uncertainty: boolean; urgentAmbitious: boolean }
  ranked: RankedPathway[]
  topP: number
  margin: number
  overall: number
}

export function rankPathways(a: Answers): RankedPathway[] {
  const score = rawScore(a)
  const entries = Object.entries(score)
    .map(([id, s]) => ({ p: pathways.find((x) => x.id === id)!, s }))
    .filter((r) => r.p && r.s > 0)
    .sort((x, y) => y.s - x.s)
  const max = entries[0]?.s ?? 1
  const exps = entries.map((r) => Math.exp((r.s / max) * 8))
  const sum = exps.reduce((x, y) => x + y, 0)
  return entries.map((r, i) => ({ ...r, prob: exps[i] / sum }))
}

function topTwo(a: Answers): Pathway[] {
  return rankPathways(a).slice(0, 2).map((r) => r.p)
}

export function buildState(a: Answers, answeredCount: number): DiagState {
  const dims: Record<Dim, number> = {
    persona: !a['persona'] ? 0 : a['persona'] === 'unsure' ? 0.4 : 1,
    goal: !a['goal']
      ? 0
      : !a['clarity']
        ? 0.4
        : a['clarity'] === 'very_clear'
        ? 1
        : a['clarity'] === 'clear'
          ? 0.8
          : a['clarity'] === 'medium'
            ? a['confirm_goal'] || a['fup_goal_vague'] ? 0.75 : 0.5
            : a['clarity'] === 'vague'
              ? a['fup_goal_vague'] || a['confirm_goal'] ? 0.65 : 0.25
              : 0.6,
    branch: 0,
    skills: (() => {
      const scCount = ['data', 'writing', 'communication', 'projects', 'ai'].filter((s) => a[`sc_${s}`]).length
      if (a['sk_gaps'] && scCount >= 1) return 1
      if (a['sk_gaps']) return 0.75
      return a['stu_gap'] || a['grad_gap'] || a['emp_obstacle'] ? 0.55 : 0
    })(),
    interest: a['uns_interests'] || a['fup_uns_none'] ? 1 : a['day_story'] ? 0.8 : 0,
    constraints: (a['format'] ? 0.4 : 0) + (a['target_date'] ? 0.4 : 0) + (a['learn_lang'] ? 0.15 : 0),
  }

  /* بُعد الفرع: نواة الفئة */
  const persona = a['persona']
  const coreByPersona: Record<string, string[]> = {
    student: ['stu_first_job', 'stu_gap'],
    graduate: ['grad_assets', 'grad_gap'],
    employee: ['emp_sector', 'emp_goal', 'emp_role', 'emp_obstacle'],
    entrepreneur: ['biz_stage', 'biz_bottleneck'],
    family: ['fam_priority'],
    unsure: ['uns_interests', 'uns_experiment'],
  }
  let core = coreByPersona[persona ?? ''] ?? []
  if (persona === 'employee' && a['emp_sector'] === 'government') core = [...core, 'gov_audience']
  const coreAnswered = core.filter((id) => a[id]).length
  const deepAnswered = ['emp_years', 'gov_level', 'gov_system', 'fam_beneficiary'].filter((id) => a[id]).length
  dims.branch = core.length ? Math.min(1, coreAnswered / core.length + deepAnswered * 0.05) : 0

  const resolvedGoal = a['reconcile_goal'] ?? a['confirm_goal'] ?? a['fup_goal_vague'] ?? a['goal']
  const flags = {
    uncertainty:
      a['clarity'] === 'vague' ||
      a['persona'] === 'unsure' ||
      a['uns_interests'] === 'none' ||
      a['stu_first_job'] === 'no' ||
      a['grad_gap'] === 'direction',
    /* طموح كبير (تحول/مشروع/وظيفة) مع موعد قريب — سؤال الواقعية يستحق */
    urgentAmbitious:
      a['target_date'] === 'soon' &&
      (resolvedGoal === 'change' || resolvedGoal === 'project' || resolvedGoal === 'job') &&
      !a['conflict_resolve'],
  }

  const ranked = rankPathways(a)
  const topP = ranked[0]?.prob ?? 0
  const margin = ranked.length > 1 ? ranked[0].prob - ranked[1].prob : 1
  const overall =
    dims.persona * 0.2 + dims.goal * 0.2 + dims.skills * 0.2 +
    dims.constraints * 0.15 + dims.branch * 0.1 + dims.interest * 0.1 +
    (answeredCount > 0 ? 0.05 : 0)

  return { dims, flags, ranked, topP, margin, overall }
}

/* ═══════════════ محرك الاختيار ═══════════════ */

const DIM_ORDER: Dim[] = ['persona', 'goal', 'branch', 'skills', 'interest', 'constraints']
const DIM_THRESHOLD: Record<Dim, number> = { persona: 0.6, goal: 0.6, branch: 0.75, skills: 0.6, interest: 0.6, constraints: 0.6 }

export function nextQuestion(a: Answers, asked: string[]): DiagQuestion | null {
  const bank = bankFor(a)
  const askedSet = new Set(asked)
  const eligible = bank.filter((q) => !askedSet.has(q.id))
  const state = buildState(a, asked.length)
  const notes = eligible.find((q) => q.id === 'notes')
  const finishOrNotes = () => notes ?? null

  if (asked.length >= 40) return null

  /* قصة الموظف الواقعية — تُبنى على دوره الذي اختاره للتو وتُضمَّن في تقريره؛ مضمونة لكل موظف قبل الحسم */
  if (a['persona'] === 'employee' && a['emp_role'] && !askedSet.has('emp_moment')) {
    const em = eligible.find((q) => q.id === 'emp_moment')
    if (em) return em
  }

  /* 1) قواعد الإيقاف — الحسم والإشباع فقط؛ «نفاد الأسئلة» يُترك للسقوط الطبيعي
     حتى لا يقطع سؤالا شرطيا مستحقا (حل تعارض، تأكد، كسر تعادل) */
  const criticalDone = (['persona', 'goal', 'branch', 'skills', 'constraints'] as Dim[]).every(
    (d) => state.dims[d] >= DIM_THRESHOLD[d]
  )
  const allDone = DIM_ORDER.every((d) => state.dims[d] >= DIM_THRESHOLD[d])
  const decided = asked.length >= 12 && criticalDone && state.topP >= 0.22 && state.margin >= 0.06
  const saturated = asked.length >= 26 && allDone
  if (decided || saturated) return finishOrNotes()

  /* 2) التناقض أولا */
  const changed = a['confirm_goal'] && a['goal'] && a['confirm_goal'] !== a['goal']
  if (changed && !askedSet.has('reconcile_goal')) return eligible.find((q) => q.id === 'reconcile_goal') ?? null

  /* 3) تعميق الغموض — بميزانية سؤالين لكل وحدة */
  const deepBudgetUsed = (module: string) =>
    asked.filter((id) => {
      const q = bank.find((x) => x.id === id)
      return q && q.module === module && (q.level === 'deep' || q.level === 'conditional')
    }).length
  if (state.flags.uncertainty) {
    const fup = eligible.find(
      (q) =>
        (q.id === 'fup_goal_vague' && (a['clarity'] === 'vague' || a['clarity'] === 'medium') && deepBudgetUsed('M2') < 2) ||
        (q.id === 'fup_uns_none' && a['uns_interests'] === 'none' && deepBudgetUsed('M3E') < 2)
    )
    if (fup) return fup
  }

  /* 4) طموح كبير بموعد قريب — سؤال الواقعية */
  if (state.flags.urgentAmbitious && !askedSet.has('conflict_resolve')) {
    return eligible.find((q) => q.id === 'conflict_resolve') ?? null
  }

  /* 5) كسر التعادل — بعد اكتمال المهارات وبعض الأسئلة */
  if (state.margin < 0.06 && state.dims.skills >= 0.6 && asked.length >= 8 && !askedSet.has('tie_break')) {
    const tb = eligible.find((q) => q.id === 'tie_break')
    if (tb && topTwo(a).length === 2) return tb
  }

  /* 6) تحقق الهدف — فقط عندما يكون الوضوح متوسطا أو غامضا (FR-022: لا تأكيد لما قيل بثقة) */
  const goalUnclear = a['goal'] && (a['clarity'] === 'medium' || a['clarity'] === 'vague')
  if (goalUnclear && !askedSet.has('confirm_goal') && !changed) {
    return eligible.find((q) => q.id === 'confirm_goal') ?? null
  }

  /* 7) أضعف بُعد بالترتيب السردي — ونُكمل أسئلة النواة حتى لو بلغ البُعد عتبته
     (يضمن ألا يفوت «ما يبطئك» أو «جمهور الحكومي» أو سؤال اللغة بسبب حسم مبكر) */
  for (const dim of DIM_ORDER) {
    const candidates = eligible
      .filter((q) => q.measures.includes(dim) && q.level !== 'optional' && q.trigger === 'always')
      .sort((x, y) => y.weight - x.weight || (x.level === 'core' ? -1 : 1))
    const core = candidates.find((q) => q.level === 'core')
    if (state.dims[dim] < DIM_THRESHOLD[dim]) {
      if (core) return core
      if (candidates[0] && dim === 'branch') return candidates[0]
    } else if (core) {
      return core
    }
  }

  /* 8) أعلى سؤال متبقٍ قيمة — الشرطية لا تُقدَّم إلا من فروعها المخصصة */
  const rest = eligible
    .filter((q) => q.id !== 'notes' && q.level !== 'optional' && (q.trigger ?? 'always') === 'always')
    .sort((x, y) => y.weight - x.weight)
  if (rest[0]) return rest[0]

  /* 9) الأسئلة الاختيارية قبل الختام — الهدف الثاني */
  const sg = eligible.find((q) => q.id === 'second_goal')
  if (sg && state.dims.goal >= 0.6) return sg

  return finishOrNotes()
}

/* تقدير العدد المتبقي — لشريط التقدم المتنفس */
export function estimateTotal(a: Answers, asked: string[]): number {
  const state = buildState(a, asked.length)
  let remaining = 0
  for (const dim of DIM_ORDER) if (state.dims[dim] < DIM_THRESHOLD[dim]) remaining += dim === 'branch' ? 2 : 1
  if (state.flags.uncertainty) remaining += 2
  if (state.flags.urgentAmbitious) remaining += 1
  if (state.margin < 0.06) remaining += 1
  remaining += 1 // الملاحظات الختامية
  return Math.min(40, asked.length + Math.max(1, remaining))
}

/* ═══════════════ توليد النتيجة ═══════════════ */

export interface GapDetail {
  skill: string
  current: string
  target: string
  priority: 'عالية' | 'متوسطة'
  coveredBy: string[]
}

export interface DiagResult {
  top: Pathway
  faster: Pathway | null
  cheaper: { p: Pathway; price: number } | null
  confidence: number
  confidenceBand: string
  needsAdvisor: boolean
  reasons: string[]
  gaps: string[]
  gapDetails: GapDetail[]
  unavailableSkills: string[]
  priorOverlap: string[]
  changeMakers: string[]
  reconciled: boolean
  secondGoal: string | null
  resultJson: Record<string, unknown>
}

const norm = (s: string) => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
/** تجزئة عربية عملية: توحيد الحروف + إزالة «ال» التعريف لمطابقة أدق */
const tokenize = (s: string, min = 4) =>
  norm(s).split(/[\s،و]+/).map((t) => t.replace(/^ال/, '')).filter((t) => t.length >= min)
const tokens = (s: string) => tokenize(s, 4)

function coverageFor(skillLabel: string, pathwayId?: string): string[] {
  const tk = tokens(skillLabel)
  return courses
    .filter((c) => (!pathwayId || c.pathwayId === pathwayId) && c.skill && tokens(c.skill).some((t) => tk.includes(t)))
    .map((c) => c.name)
    .slice(0, 2)
}

export function computeResult(a: Answers): DiagResult {
  const ranked = rankPathways(a)
  const top = ranked[0]?.p ?? pathways.find((p) => p.id === 'PW-FND-001')!

  /* البديلان: أسرع + أقل تكلفة */
  const rest = ranked.filter((r) => r.p.id !== top.id)
  const faster = rest.filter((r) => r.p.durationWeeks < top.durationWeeks)[0]?.p ?? rest[0]?.p ?? null
  const cheaperEntry = rest
    .filter((r) => r.p.id !== faster?.id)
    .map((r) => ({ p: r.p, price: pathwayPriceFor((pathwayCourses[r.p.id] ?? []).length || 6) }))
    .sort((x, y) => x.price - y.price)[0] ?? null

  /* الفجوات = ما اختاره في خريطة المهارات + ما ذكر أنه يبطئه في عمله (مدموجا بلا تكرار) */
  const fromObstacles = (a['emp_obstacle'] ?? '').split(',').map((o) => OBSTACLE_TO_GAP[o]).filter(Boolean)
  const selected = [...new Set([...(a['sk_gaps'] ?? '').split(',').filter((g) => g && g !== 'none'), ...fromObstacles])]
  const gaps = selected.map((g) => GAP_LABELS[g] ?? g)
  /* المستويات تُستنتج من المواقف السلوكية — لا تقييم ذاتي مباشر */
  const selfRatings = scenarioLevels(a)

  /* كشف التناقض: قال إن المهارة تبطئه ثم قيّم نفسه فيها 4 أو أكثر — لا نخفيه ولا نجلده */
  const contradictions: string[] = []
  for (const g of fromObstacles) {
    const r = parseInt(selfRatings[g] ?? '')
    if (r >= 4) contradictions.push(GAP_LABELS[g] ?? g)
  }

  /* خريطة الفجوات — المستوى الحالي من التقييم أو من الدليل، ولا نفترض «مبتدئ» بلا دليل */
  const gapDetails: GapDetail[] = selected.slice(0, 3).map((g, i) => {
    const rated = selfRatings[g]
    const isObstacle = fromObstacles.includes(g)
    let current: string
    if (rated) current = `مستوى ${rated} من 5 — استنتاجا من موقفك الحقيقي الذي حكيته`
    else if (isObstacle) current = 'لم تقيّمه — لكنك ذكرت أنه يبطئك فعلا في يومك'
    else if (a['emp_years'] === 'veteran' || a['emp_years'] === 'senior') current = 'لم يُقيَّم — وخبرتك ترجّح أن الأساس موجود ويحتاج تحديثا'
    else current = 'لم يُقيَّم بعد — نحدده عمليا في أول أسبوع من المسار'
    return {
      skill: GAP_LABELS[g] ?? g,
      current,
      target: 'جيد عمليا (مستوى 3 من 5)',
      priority: rated && parseInt(rated) >= 3 ? 'متوسطة' : i === 0 || isObstacle ? 'عالية' : 'متوسطة',
      coveredBy: coverageFor(GAP_LABELS[g] ?? g, top.id),
    }
  })

  /* المهارات غير المتوفرة — لا نخفي فجوة لأنها غير متوفرة تجاريا */
  const unavailableSkills = selected
    .map((g) => GAP_LABELS[g] ?? g)
    .filter((label) => coverageFor(label).length === 0)

  /* تقاطع رصيده السابق مع دورات التوصية — حتى لا يدفع ثمن ما يعرفه أصلا */
  const priorText = a['prev_courses']?.trim() ?? ''
  const priorTokens = tokenize(priorText, 3)
  const topCourseIds = pathwayCourses[top.id] ?? []
  const priorOverlap: string[] = priorTokens.length
    ? topCourseIds
        .map((cid) => courses.find((c) => c.id === cid))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .filter((c) => tokenize(c.name, 3).some((t) => priorTokens.includes(t)))
        .map((c) => c.name)
        .slice(0, 2)
    : []

  /* الهدف والثقة */
  const goal = a['reconcile_goal'] ?? a['confirm_goal'] ?? a['fup_goal_vague'] ?? a['goal']
  const reconciled = Boolean(a['reconcile_goal'])
  const goal2 = a['second_goal'] && a['second_goal'] !== 'none' ? a['second_goal'] : null
  const state = buildState(a, 0)
  const clarity = a['clarity']
  let confidence = 55
  if (clarity === 'very_clear') confidence += 20
  if (clarity === 'clear') confidence += 14
  if (clarity === 'medium') confidence += 4
  if (clarity === 'vague') confidence -= 15
  if (state.margin >= 0.12) confidence += 10
  else if (state.margin >= 0.06) confidence += 5
  else confidence -= 8
  if (a['uns_experiment'] === 'advisor') confidence -= 15
  if (reconciled) confidence += 4
  if (a['tie_break']) confidence += 5
  if (a['sk_gaps']) confidence += 4
  if (contradictions.length) confidence -= 6
  confidence = Math.max(30, Math.min(96, confidence))
  const confidenceBand =
    confidence >= 85 ? 'توصية حاسمة — عرض مباشر'
    : confidence >= 70 ? 'توصية واثقة — مع بدائل مدروسة'
    : confidence >= 55 ? 'توصية أولية — تتقوى بجلسة مستشار'
    : 'غير حاسمة — القرار يحتاج مستشارا بشريا'
  /* إحالة للمستشار: ثقة منخفضة، أو طلبه بنفسه، أو تناقض متكرر بين أقواله (قاعدة 16) */
  const needsAdvisor = confidence < 55 || a['uns_experiment'] === 'advisor' || contradictions.length >= 2

  /* الأسباب */
  const isGov = a['emp_sector'] === 'government'
  const reasons: string[] = []
  if (reconciled) {
    reasons.push(`أثناء الأسئلة نضجت فكرتك عن هدفك من «${GOAL_LABELS[a['goal']]}» إلى «${GOAL_LABELS[goal]}» — وبنينا التوصية على اختيارك الأخير الأصدق.`)
  } else {
    reasons.push(`لأن هدفك هو ${GOAL_LABELS[goal] ?? 'التطوير المهني'}، ونتيجة التشخيص أظهرت أن ${top.name} هو الأقرب لهذا الهدف تحديدا.`)
  }
  if (isGov && a['gov_audience']) {
    const audText: Record<string, string> = {
      citizens: 'عملك واجهة مع المراجعين والمواطنين', internal: 'عملك مع الإدارات الداخلية',
      leadership: 'تجهيزك للقرارات والمذكرات للقيادات', procurement: 'طبيعة عملك في العقود والمشتريات',
      data: 'اعتمادك اليومي على البيانات والتقارير',
    }
    reasons.push(`لأن ${audText[a['gov_audience']]} في جهتك الحكومية، رشحنا مسارا يعالج واقعك اليومي لا مسارا عاما.`)
  } else if (gaps.length > 0) {
    reasons.push(`فجوتك الواضحة في ${gaps.slice(0, 2).join(' و')} هي ما يعالجه هذا المسار في نواته مباشرة.`)
  } else {
    reasons.push('إجاباتك أظهرت اتساقا بين وضعك الحالي وما يغطيه هذا المسار من مهارات محورية.')
  }
  reasons.push(`ستنتهي منه بمخرج حقيقي يمكنك عرضه: ${top.output}.`)
  if (a['learn_lang'] === 'arabic') {
    reasons.push('ولأن راحتك في العربية، كل دورات هذا المسار تُقدَّم بالعربية — لن يضيع جهدك في ترجمة المصطلحات.')
  } else if (a['learn_lang'] === 'english_ok') {
    reasons.push('وراحتك في الإنجليزية ميزة — ستفتح لك المصادر العالمية الإضافية في هذا المسار بلا حاجز.')
  }
  if (priorOverlap.length > 0) {
    reasons.push(`رصيدك السابق يتقاطع مع «${priorOverlap.join('» و«')}» في مسارك — راجعها قبل الدفع أو اطلب من مستشارك استبدالها؛ لن تدفع ثمن ما تعرفه أصلا.`)
  } else if (priorText) {
    reasons.push(`رصيدك السابق («${priorText.slice(0, 80)}») وضعناه في الحسبان — لن تدفع ثمن ما تعرفه أصلا.`)
  }
  if (contradictions.length) {
    reasons.push(`ملاحظة صدق من المحرك: ذكرت أن ${contradictions.join(' و')} يبطئك في يومك، ثم قيّمت نفسك فيها 4 أو أكثر — سنتحقق منها عمليا في أول أسبوع بدلا من افتراض أي جهة.`)
  }
  if (goal2) {
    reasons.push(`ولأن هدفك خليط — ${GOAL_LABELS[goal]} مع ${GOAL_LABELS[goal2]} — عرضنا لك مسارا ثانيا متكاملا في البدائل، لا مسارا واحدا جامدا.`)
  }

  /* ما قد يغير النتيجة */
  const changeMakers: string[] = []
  if (a['target_date'] !== 'year') changeMakers.push('لو أصبح موعدك أوسع (سنة مثلا)، قد تناسبك مسارات أعمق وأطول يستبعدها استعجالك اليوم.')
  if (!goal2) changeMakers.push('لو كان عندك هدف ثانٍ لم تذكره، قد يتغير الخليط المقترح.')
  if (!a['sk_gaps'] || a['sk_gaps'] === 'none') changeMakers.push('لو اكتشفت لاحقا مهارة تعيقك فعلا، أعد التشخيص — سيتغير الترتيب.')
  if (changeMakers.length === 0) changeMakers.push('إجاباتك مكتملة — ما قد يغير النتيجة هو تغير واقعك نفسه: وظيفة جديدة أو ظرف عائلي.')

  /* ملف قرار ثابت قابل للحفظ والمراجعة */
  const resultJson = {
    recommendation_id: `REC-${Date.now()}`,
    rules_version: 'v4.0',
    created_at: new Date().toISOString(),
    profile: {
      persona_type: a['persona'] ?? null,
      primary_goal: goal ?? null,
      secondary_goal: goal2,
      gap_vector: selected,
      skill_levels: selfRatings,
      constraints: {
        format: a['format'] ?? null,
        target_date: a['target_date'] ?? null,
        language: a['learn_lang'] ?? null,
        commitment: a['commit_pref'] ?? null,
      },
      prior_courses: priorText || null,
      prior_overlap: priorOverlap,
      work_story: a['emp_moment'] ?? null,
      notes: a['notes'] ?? null,
    },
    decision: needsAdvisor ? 'advisor' : 'ready',
    primary_pathway_id: top.id,
    fit_score: Math.round((ranked[0]?.prob ?? 0) * 100) / 100,
    confidence_score: confidence,
    alternatives: {
      faster: faster?.id ?? null,
      cheaper: cheaperEntry?.p.id ?? null,
    },
    unavailable_skills: unavailableSkills,
    advisor_handoff: needsAdvisor,
    disclaimer: 'توصية تعليمية مفسرة — ليست اختبارا نفسيا ولا وعدا بوظيفة أو دخل.',
  }

  return {
    top, faster, cheaper: cheaperEntry, confidence, confidenceBand, needsAdvisor,
    reasons, gaps, gapDetails, unavailableSkills, priorOverlap, changeMakers, reconciled, secondGoal: goal2, resultJson,
  }
}

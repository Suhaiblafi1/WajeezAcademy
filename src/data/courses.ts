/* كتالوج الدورات — محوّل يقرأ من مصدر الكتالوج الجوهري (core-catalog-source)
   الافتراضي: الحزمة المضمنة الموثقة (مئة دورة ضمن عشرين مسارا)؛ وعند توفر
   خادم API تُستبدل المحتويات باللقطة المنشورة عبر المحوّل نفسه. */

import {
  getCoreCatalogRaw,
  onCoreCatalogInstalled,
  type CoreCatalogModule,
  type CoreCatalogRaw,
} from './core-catalog-source'
import { pathwayCategory } from './pathways'

export interface Course {
  id: string
  name: string
  /** المصطلح المهنيّ بالإنجليزية — سطرٌ ثانويّ تحت العنوان، لا جزءٌ منه */
  termEn?: string | null
  legacyName?: string
  pathwayId: string
  pathwayName: string
  category: string
  weeks: number
  skill: string
  /** ما يخرج به المتعلّم — وعدُ الدورة كما في الكتالوج، لا موضعُها في مسار */
  promise: string
  /** لمن هذه الدورة (`target_audience_ar`) — مؤلَّفٌ ولا يُبحَث فيه */
  audience: string
  /** مهاراتُها كلُّها لا أوّلُها — البحثُ كان يرى واحدةً من ستّ */
  skills: string[]
  /** سعر القائمة وعملته — معلنان في الكتالوج، ترثهما الشعبة عند فتحها */
  listPrice?: number | null
  listCurrency?: string
}

/* تفاصيل الدورة الكاملة لعرض الرحلة التعليمية — مشتقة من الكتالوج الموثق */
export interface CourseFull {
  id: string
  title: string
  legacyTitle?: string
  shortPromise: string
  description: string
  targetAudience: string
  prerequisites: string
  level: string
  totalHours: number
  learningObjectives: string[]
  learningOutcomes: string[]
  modules: { id: string; title: string; outcome: string; activity: string; artifact: string; hours: number; body: string | null; checks: string | null; video: string | null; scenario: string | null; practice: string | null; rubric: string | null }[]
  practicalProject: string
  relatedSkills: string[]
  referenceIds: string[]
}

/* فهارس مشتقة تُبنى من المصدر الفعال وتُعاد تعبئتها عند تثبيت لقطة API */
let pathwayTitle = new Map<string, string>()
let modulesByCourse = new Map<string, CoreCatalogModule[]>()

function rebuildIndexes(raw: CoreCatalogRaw): void {
  pathwayTitle = new Map(raw.launch_pathways.map((p) => [p.id, p.title]))
  const grouped = new Map<string, CoreCatalogModule[]>()
  for (const m of raw.modules) {
    const list = grouped.get(m.course_id) ?? []
    list.push(m)
    grouped.set(m.course_id, list)
  }
  for (const list of grouped.values()) list.sort((a, b) => a.sequence - b.sequence)
  modulesByCourse = grouped
}

rebuildIndexes(getCoreCatalogRaw())

function buildCourses(raw: CoreCatalogRaw): Course[] {
  return raw.courses.map((c) => ({
    id: c.course_id,
    name: c.title_ar,
    /** المصطلح المهنيّ بالإنجليزية — يُعرض سطرا ثانويا لا داخل العنوان */
    termEn: c.title_term_en ?? null,
    legacyName: c.legacy_title_ar,
    pathwayId: c.pathway_id,
    pathwayName: pathwayTitle.get(c.pathway_id) ?? '',
    category: pathwayCategory(c.pathway_id),
    weeks: Math.max(1, Math.ceil(c.total_hours / 7)),
    skill: c.skill_names_ar[0] ?? '',
    promise: c.short_promise_ar ?? '',
    audience: c.target_audience_ar ?? '',
    skills: c.skill_names_ar ?? [],
    listPrice: c.list_price ?? null,
    listCurrency: c.list_currency ?? 'USD',
  }))
}

export const courses: Course[] = buildCourses(getCoreCatalogRaw())

/** تفاصيل الدورة الكاملة بمعرفها — للرحلة التعليمية والأكورديون */
export function courseFullById(id: string): CourseFull | null {
  const c = getCoreCatalogRaw().courses.find((x) => x.course_id === id)
  if (!c) return null
  return {
    id: c.course_id,
    title: c.title_ar,
    legacyTitle: c.legacy_title_ar,
    shortPromise: c.short_promise_ar ?? c.subtitle_ar ?? '',
    description: c.description_ar ?? '',
    targetAudience: c.target_audience_ar ?? '',
    prerequisites: c.prerequisites_ar ?? '',
    level: c.level_ar ?? '',
    totalHours: c.total_hours,
    learningObjectives: c.learning_objectives_ar ?? [],
    learningOutcomes: c.learning_outcomes_ar ?? [],
    modules: (modulesByCourse.get(id) ?? []).map((m) => ({
      id: m.module_id,
      title: m.title_ar,
      outcome: m.module_outcome_ar,
      activity: m.practice_activity_ar,
      artifact: m.evidence_artifact_ar,
      hours: m.expected_hours,
      /* متن الدرس (ح-١) — null صريح حين لا درس، فلا يُقرأ الفراغ نصا فارغا */
      body: m.module_body_ar?.trim() ? m.module_body_ar : null,
      /* تمرين الاسترجاع (ح-٣) — نصّه الخام؛ يُحلَّل عند العرض */
      checks: m.module_checks_ar?.trim() ? m.module_checks_ar : null,
      /* فيديو الوحدة (ح-٢) — نصّه الخام */
      video: m.module_video_ar?.trim() ? m.module_video_ar : null,
      /* سيناريو القرار (ح-٥) — نصّه الخام؛ يُحلَّل عند العرض */
      scenario: m.module_scenario_ar?.trim() ? m.module_scenario_ar : null,
      /* النشاط التطبيقيّ (ح-٦) — نصّه الخام؛ يُحلَّل عند العرض */
      practice: m.module_practice_ar?.trim() ? m.module_practice_ar : null,
      /* الروبرك (ح-٧) — نصّه الخام؛ يُحلَّل عند العرض */
      rubric: m.module_rubric_ar?.trim() ? m.module_rubric_ar : null,
    })),
    practicalProject: c.summative_assessment_ar ?? '',
    relatedSkills: c.skill_names_ar,
    referenceIds: c.source_codes ?? [],
  }
}

export const courseById = (id: string) => courses.find((c) => c.id === id)

export const pathwayCourses: Record<string, string[]> = Object.fromEntries(
  getCoreCatalogRaw().launch_pathways.map((p) => [p.id, p.course_ids]),
)

/** الدورات المساندة لكلّ مسار جاهز — ثلاث، كلٌّ بسبب وجودها.

    فُصلت عن `pathwayCourses` عمدا لا تنظيما: `pathwayCourses` نسخةُ
    `course_ids`، وهي القائمة التي يقرؤها `pathwaySkills` فتُشتقّ منها فجوةُ
    المهارات التي يرتّب بها التشخيص المسارات. فدمجُ المساندة فيها يغيّر ترتيب
    المسارات لكلّ متعلّم — والمساندة عرضٌ في المسار الجاهز لا قياس. وصفحةُ
    التشخيص تبقى على `pathwayCourses` وحدها: هناك تظهر الدورات حسب الحاجة. */
export interface SupportCourse { courseId: string; reasonAr: string }
const buildSupports = (): Record<string, SupportCourse[]> =>
  Object.fromEntries(
    getCoreCatalogRaw().launch_pathways.map((p) => [
      p.id,
      (p.support_courses ?? []).map((s) => ({ courseId: s.course_id, reasonAr: s.reason_ar })),
    ]),
  )
export const pathwaySupportCourses: Record<string, SupportCourse[]> = buildSupports()

/** دورات المسار الجاهز كما تُعرض وتُسعَّر: أربعُ أساسيات ثمّ ثلاثُ مساندات.
    لا يستعملها التشخيص — هناك تُبنى القائمة من نتيجة القياس لا من حزمة. */
export const readyPathwayCourseIds = (pathwayId: string): string[] => [
  ...(pathwayCourses[pathwayId] ?? []),
  ...(pathwaySupportCourses[pathwayId] ?? []).map((s) => s.courseId),
]

/** طريقة تقديم المسار من الكتالوج الموثق — تُعرض ضمن تفاصيل دورات الرحلة */
export const pathwayDelivery = (pathwayId: string): string | undefined =>
  getCoreCatalogRaw().launch_pathways.find((p) => p.id === pathwayId)?.delivery

/* مختارات وجيز من الدورات — منتقاة تحريريا، الدورة الثانية من كل مسار مختار */
function pickCourse(pathwayId: string, index: number): string | null {
  const ids = pathwayCourses[pathwayId]
  return ids && ids.length > index ? ids[index] : null
}
const bestsellerPicks: { pathway: string; index: number; note: string }[] = [
  { pathway: 'PW-FND-003', index: 1, note: 'اختيار وجيز' },
  { pathway: 'PW-STU-002', index: 1, note: 'الأنسب للخريجين' },
  { pathway: 'PW-STU-003', index: 0, note: 'بداية واضحة' },
  { pathway: 'PW-EMP-004', index: 0, note: 'الأنسب للموظفين' },
  { pathway: 'PW-EMP-003', index: 0, note: 'بداية صحيحة' },
  { pathway: 'PW-COM-001', index: 1, note: 'مهارة سريعة' },
  { pathway: 'PW-GOV-002', index: 1, note: 'أثر مباشر' },
  { pathway: 'PW-BIZ-001', index: 1, note: 'لرواد الأعمال' },
  { pathway: 'PW-AUT-001', index: 1, note: 'من مختارات وجيز' },
  { pathway: 'PW-MKT-001', index: 1, note: 'تجربة عملية فورية' },
  { pathway: 'PW-EMP-005', index: 0, note: 'خطة جاهزة' },
  { pathway: 'PW-LND-001', index: 1, note: 'للتأثير' },
]
function buildBestsellerCourses(): { id: string; note: string }[] {
  return bestsellerPicks.flatMap((p) => {
    const id = pickCourse(p.pathway, p.index)
    return id ? [{ id, note: p.note }] : []
  })
}
export const bestsellerCourses: { id: string; note: string }[] = buildBestsellerCourses()

/* عند تثبيت لقطة API المنشورة: إعادة بناء الفهارس وإعادة ملء المصفوفات
   والسجلات المصدَّرة في مكانها — المراجع تبقى صالحة والمشتركون يعيدون الرسم */
onCoreCatalogInstalled(() => {
  const raw = getCoreCatalogRaw()
  rebuildIndexes(raw)
  courses.splice(0, courses.length, ...buildCourses(raw))
  for (const k of Object.keys(pathwayCourses)) delete pathwayCourses[k]
  Object.assign(pathwayCourses, Object.fromEntries(raw.launch_pathways.map((p) => [p.id, p.course_ids])))
  for (const k of Object.keys(pathwaySupportCourses)) delete pathwaySupportCourses[k]
  Object.assign(pathwaySupportCourses, buildSupports())
  bestsellerCourses.splice(0, bestsellerCourses.length, ...buildBestsellerCourses())
})

export const courseCategories = ['الكل', 'أفراد ومهن ناشئة', 'موظفون ومختصون', 'قيادة وريادة الأعمال', 'حكومي']

/* سعر الدورة المنفردة: 130–180 دولارا حسب مدتها */
export const coursePrice = (weeks: number) => Math.min(180, 105 + weeks * 25)

/** جمع الأسابيع بالعربية السليمة: «4 أسابيع» و«12 أسبوعا» */
export const weeksLabel = (n: number) =>
  n === 1 ? 'أسبوع واحد' : n === 2 ? 'أسبوعان' : n >= 3 && n <= 10 ? `${n} أسابيع` : `${n} أسبوعا`

/* ملخّصُ حجم المسار — «4 دورات · 40 ساعة · 8 أسابيع».
   حلّ محلَّ سطر المدرّبين: كانت البطاقة تعرض «يُعلن المدرب بعد اعتماد الشعبة»
   مكرّرةً ثلاث مرّات (اسمُ كلّ مدرّبٍ لم يُعيَّن بعد)، فتُنفق أثمنَ سطرٍ في
   أوّل ما تراه عينُ المشتري على معلومةٍ لا يسأل عنها الآن ولا تخصّ الدورة. */
export function pathwaySizeAr(p: { courseCount: number; totalHours: number; durationWeeks: number }): string {
  const courses = p.courseCount === 1 ? 'دورة واحدة' : p.courseCount === 2 ? 'دورتان' : `${p.courseCount} دورات`
  const parts = [courses]
  if (p.totalHours > 0) parts.push(`${p.totalHours} ساعة`)
  parts.push(weeksLabel(p.durationWeeks))
  return parts.join(' · ')
}

/* حدّا عدد دورات المسار — بنيةٌ لا سعر */
export const MIN_PATHWAY_COURSES = 4

/** مساندتان فوق الأساسيات الأربع — والمجموع ستّ */
export const SUPPORT_PER_PATHWAY = 2

/* ستّة: أربعُ دوراتِ المسار الأساسية ومساندتان. كان سبعة بثلاث مساندات،
   فصار المسار أثقل ممّا اتُّفق عليه — فحُذفت الأخيرة من كلّ مسار، وهي آخر
   ترتيب الأهميّة فيه. والرقم هنا مصدرٌ واحد يقرؤه المدقّق والحارس معا، فلا
   يفترق ملفُّ البيانات عن القاعدة التي تحرسه. */
export const MAX_PATHWAY_COURSES = MIN_PATHWAY_COURSES + SUPPORT_PER_PATHWAY

/* ─────────── ولا سعر هنا ───────────
   كان في هذا الموضع `PATHWAY_PRICE` و`pathwayPriceFor(العدد)`
   (٥٠٠/٥٥٠/٦٠٠) و`coursePriceOf(الدورة)` التي تقدّر ١٣٠–١٨٠ دولارا بمطابقة
   كلماتٍ في عنوان الدورة. وكانت هذه الأرقام تُعرض على المتعلم في صفحة المسار
   وصفحة النتيجة وبناء المسار، **والفاتورة تُصدر بسعر الشعبة وبعملتها** — فالرقم
   الذي وعدنا به ليس الرقم الذي نُطالب به.

   فالسعر الآن من مصدر واحد: `Cohort.price` عبر `src/services/cohort-prices.ts`.
   وحيث لا شعبة مسعَّرة يُقال ذلك نصّا ولا يُعرض رقم — وهو معيار هذا المستودع
   نفسه في صفحة المدرّبين: «لا أرقام توضيحية».

   وسلّمُ أسعارٍ صناعيّ بقي لاختبار حوارس التسعير وحدها في
   `src/tests/pricing-scale.ts` — لا يدخل حزمةَ الإنتاج ولا تراه عين متعلم. */

/* ─────────── مدربو المسارات — لا أسماء غير معتمدة ───────────
   نزاهة تسويقية: لا يُعرض اسم مدرب إلا بعد اعتماد الشعبة وحصوله على
   public_visibility. حتى ذلك الحين يظهر التخصص التدريبي + العبارة الموحدة. */
export const TRAINER_PENDING_AR = 'يُعلن المدرب بعد اعتماد الشعبة'
export interface Trainer {
  name: string
  role: string
}
export const TRAINER_POOLS: Record<string, Trainer[]> = {
  FND: [
    { name: TRAINER_PENDING_AR, role: 'مدربة التعلم الذاتي وبناء العادات' },
    { name: TRAINER_PENDING_AR, role: 'مدرب الكفاءة الرقمية' },
    { name: TRAINER_PENDING_AR, role: 'مدربة تطبيقات الذكاء الاصطناعي' },
  ],
  STU: [
    { name: TRAINER_PENDING_AR, role: 'مدربة الجاهزية المهنية' },
    { name: TRAINER_PENDING_AR, role: 'مدرب التخطيط المهني للطلاب' },
  ],
  EMP: [
    { name: TRAINER_PENDING_AR, role: 'مدرب تطوير الموظفين' },
    { name: TRAINER_PENDING_AR, role: 'مدربة الكتابة والعروض المهنية' },
    { name: TRAINER_PENDING_AR, role: 'مدرب إدارة المشاريع والبيانات' },
  ],
  COM: [
    /* خمسة مقاعد — مدرب لكل دورة من دورات مسار الخطابة والتواصل التنفيذي الخمس */
    { name: TRAINER_PENDING_AR, role: 'مدربة بناء الرسالة والسرد القصصي' },
    { name: TRAINER_PENDING_AR, role: 'مدرب تصميم العروض التنفيذية والشرائح' },
    { name: TRAINER_PENDING_AR, role: 'مدرب الحضور والصوت وإدارة رهبة الإلقاء' },
    { name: TRAINER_PENDING_AR, role: 'مدربة الحوار والإقناع' },
    { name: TRAINER_PENDING_AR, role: 'مدربة العروض والخطابة أمام اللجان' },
  ],
  NEG: [
    { name: TRAINER_PENDING_AR, role: 'مدرب التفاوض' },
    { name: TRAINER_PENDING_AR, role: 'مدرب إدارة النزاعات' },
  ],
  GOV: [
    { name: TRAINER_PENDING_AR, role: 'مدرب التطوير الحكومي' },
    { name: TRAINER_PENDING_AR, role: 'مدربة خدمة الجمهور والمراسلات' },
    { name: TRAINER_PENDING_AR, role: 'مدرب المشتريات والمالية العامة' },
  ],
  BIZ: [
    { name: TRAINER_PENDING_AR, role: 'مدربة ريادة الأعمال' },
    { name: TRAINER_PENDING_AR, role: 'مدرب التسويق والمبيعات' },
  ],
  AUT: [
    { name: TRAINER_PENDING_AR, role: 'مدربة الذكاء الاصطناعي التطبيقي' },
    { name: TRAINER_PENDING_AR, role: 'مدرب الأتمتة والإنتاجية' },
  ],
  MKT: [
    { name: TRAINER_PENDING_AR, role: 'مدرب التسويق الرقمي' },
    { name: TRAINER_PENDING_AR, role: 'مدربة النمو' },
  ],
  SAL: [
    { name: TRAINER_PENDING_AR, role: 'مدرب المبيعات الاستشارية' },
    { name: TRAINER_PENDING_AR, role: 'مدرب تطوير الأعمال' },
  ],
  HR: [
    { name: TRAINER_PENDING_AR, role: 'مدربة الموارد البشرية' },
    { name: TRAINER_PENDING_AR, role: 'مدربة تجربة الموظف' },
  ],
  FIN: [
    { name: TRAINER_PENDING_AR, role: 'مدرب المالية للمديرين' },
    { name: TRAINER_PENDING_AR, role: 'مدرب التحليل المالي' },
  ],
  PRD: [
    { name: TRAINER_PENDING_AR, role: 'مدرب إدارة المنتج' },
    { name: TRAINER_PENDING_AR, role: 'مدربة تجربة المستخدم' },
  ],
  OPS: [
    { name: TRAINER_PENDING_AR, role: 'مدرب التميز التشغيلي' },
    { name: TRAINER_PENDING_AR, role: 'مدرب تحسين العمليات' },
  ],
  CYB: [
    { name: TRAINER_PENDING_AR, role: 'مدرب إدارة المخاطر السيبرانية' },
    { name: TRAINER_PENDING_AR, role: 'مدرب الأمن الرقمي' },
  ],
  SCM: [
    { name: TRAINER_PENDING_AR, role: 'مدرب المشتريات وسلاسل الإمداد' },
    { name: TRAINER_PENDING_AR, role: 'مدرب العمليات' },
  ],
  LND: [
    { name: TRAINER_PENDING_AR, role: 'مدرب القيادة' },
    { name: TRAINER_PENDING_AR, role: 'مدربة الحوار والتغذية الراجعة' },
  ],
}
/** مدربو مسار معين — مقاعد التخصصات التدريبية المشاركة كلها وبترتيب ثابت؛ الاسم يُعلن بعد اعتماد الشعبة.
    الترتيب الثابت يجعل courseTrainer يعيّن لكل دورة مدرب مقعدها المطابق لموضوعها */
export function pathwayTrainers(pathwayId: string): Trainer[] {
  const family = pathwayId.split('-')[1] ?? 'FND'
  return TRAINER_POOLS[family] ?? TRAINER_POOLS.FND
}
/** مدرب الدورة — أحد مدربي مسارها بالتناوب */
export function courseTrainer(c: Course): Trainer {
  const trainers = pathwayTrainers(c.pathwayId)
  const idx = parseInt(c.id.split('-').pop() ?? '1', 10) || 1
  return trainers[(idx - 1) % trainers.length]
}

/* ─────────── تفاصيل الدورة للنوافذ: محاور ومخرج ─────────── */
const TOPIC_TEMPLATES: Record<string, string[]> = {
  'أفراد ومهن ناشئة': ['المفاهيم الجوهرية خطوة بخطوة', 'بناء ملفك ومهاراتك للانطلاقة المهنية', 'تدريب على مواقف حقيقية', 'مراجعة فردية لمخرجك النهائي'],
  'موظفون ومختصون': ['تشخيص وضعك الحالي', 'أدوات وقوالب جاهزة للعمل', 'تطبيق على مهامك الفعلية', 'مراجعة المدرب لمخرجك'],
  'قيادة وريادة الأعمال': ['تشخيص وضعك أو مشروعك الحالي', 'أدوات القيادة والنمو', 'تطبيق مباشر على فريقك أو مشروعك', 'مراجعة المدرب للمخرج'],
  'حكومي': ['الإطار التنظيمي للعمل الحكومي', 'نماذج وخطابات من واقع الجهات', 'تطبيق على حالات حقيقية', 'مراجعة فردية وتغذية راجعة'],
}
const OUTCOME_BY_CATEGORY: Record<string, string> = {
  'أفراد ومهن ناشئة': 'مخرج جاهز تقدمه لأي جهة توظيف',
  'موظفون ومختصون': 'قالب عملي تطبقه في عملك من الأسبوع الأول',
  'قيادة وريادة الأعمال': 'خطة قيادة أو أداة عمل تستخدمها في مشروعك مباشرة',
  'حكومي': 'نموذج عمل حكومي جاهز للاستخدام الفوري',
}
export function courseDetails(c: Course): { trainer: Trainer; topics: string[]; outcome: string } {
  return {
    trainer: courseTrainer(c),
    topics: TOPIC_TEMPLATES[c.category] ?? TOPIC_TEMPLATES['أفراد ومهن ناشئة'],
    outcome: `${OUTCOME_BY_CATEGORY[c.category] ?? OUTCOME_BY_CATEGORY['أفراد ومهن ناشئة']} — في ${c.skill}`,
  }
}

/* ─────────── مجالُ الدورة المعرفيّ — لا فئتُها المستهدفة ───────────

   كان `TeachableCoursePicker` يسمّي الحقل «المجال» ويملؤه بـ`pathwayCategory`
   — وتلك تُعيد **الفئة المستهدفة**: «موظفون» · «طلاب ومهنة» · «حكومي» ·
   «أساسيات». فيُسأل المدرّب عن مجاله فيُعرض عليه جمهور.

   والأثر ليس تسميةً خاطئة وحدها: من يُتقن الأمن السيبرانيّ لا يجد «أمنا
   سيبرانيّا» في القائمة، فيختار «موظفون» فتُعرض عليه دوراتٌ من عشرين مجالا
   مختلطة — وهو بالضبط التشتّت الذي وُضع الحقل ليمنعه.

   والمجال يُقرأ من معرّف الدورة نفسِه (`C-CYB-101` ← الأمن السيبراني)، لأنّ
   المعرّف ثابتٌ في الكتالوج بينما الجمهور يتغيّر بتغيّر المسار. وما لا نعرف
   عائلتَه يقع في «أخرى» — فلا يختفي من القائمة بصمت. */
const COURSE_DOMAIN_AR: Record<string, string> = {
  AI: 'الذكاء الاصطناعي',
  DAT: 'تحليل البيانات',
  AUT: 'الأتمتة والربط',
  CYB: 'الأمن السيبراني',
  PRD: 'إدارة المنتج',
  PM: 'إدارة المشاريع',
  MGR: 'الإدارة وقيادة الفرق',
  OPS: 'العمليات والجودة',
  SCM: 'سلاسل الإمداد',
  HR: 'الموارد البشرية',
  FINM: 'المالية والمحاسبة',
  MKT: 'التسويق',
  SAL: 'المبيعات',
  SVC: 'خدمة العملاء',
  BIZ: 'ريادة الأعمال',
  NEG: 'التفاوض',
  COMX: 'التواصل والعرض',
  LND: 'التدريب والتصميم التعليمي',
  CAR: 'المسار المهني',
  JOB: 'البحث عن عمل',
}

/** مجالُ الدورة المعرفيّ من معرّفها — «أخرى» لعائلةٍ لم تُسمَّ بعد */
export function courseDomain(courseId: string): string {
  const family = courseId.split('-')[1] ?? ''
  return COURSE_DOMAIN_AR[family] ?? 'أخرى'
}

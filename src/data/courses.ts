/* كتالوج الدورات — محوّل يقرأ من core-catalog.v2.json (مئة دورة ضمن عشرين مسارا) */

import coreCatalog from './catalog/core-catalog.v2.json'
import { pathwayCategory } from './pathways'

export interface Course {
  id: string
  name: string
  legacyName?: string
  pathwayId: string
  pathwayName: string
  category: string
  weeks: number
  skill: string
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
  modules: { id: string; title: string; outcome: string; activity: string; artifact: string; hours: number }[]
  practicalProject: string
  relatedSkills: string[]
  referenceIds: string[]
}

interface RawModule {
  module_id: string
  course_id: string
  sequence: number
  title_ar: string
  module_outcome_ar: string
  practice_activity_ar: string
  evidence_artifact_ar: string
  expected_hours: number
}

interface RawCourse {
  course_id: string
  pathway_id: string
  sequence: number
  title_ar: string
  legacy_title_ar?: string
  subtitle_ar?: string
  short_promise_ar?: string
  description_ar?: string
  target_audience_ar?: string
  prerequisites_ar?: string
  level_ar?: string
  total_hours: number
  skill_slugs?: string[]
  skill_names_ar: string[]
  learning_objectives_ar?: string[]
  learning_outcomes_ar?: string[]
  summative_assessment_ar?: string
  source_codes?: string[]
}
interface RawPathway {
  id: string
  title: string
  course_ids: string[]
  delivery?: string
}

const raw = coreCatalog as unknown as {
  launch_pathways: RawPathway[]
  courses: RawCourse[]
  modules: RawModule[]
}

const pathwayTitle = new Map(raw.launch_pathways.map((p) => [p.id, p.title]))

const modulesByCourse = new Map<string, RawModule[]>()
for (const m of raw.modules) {
  const list = modulesByCourse.get(m.course_id) ?? []
  list.push(m)
  modulesByCourse.set(m.course_id, list)
}
for (const list of modulesByCourse.values()) list.sort((a, b) => a.sequence - b.sequence)

export const courses: Course[] = raw.courses.map((c) => ({
  id: c.course_id,
  name: c.title_ar,
  legacyName: c.legacy_title_ar,
  pathwayId: c.pathway_id,
  pathwayName: pathwayTitle.get(c.pathway_id) ?? '',
  category: pathwayCategory(c.pathway_id),
  weeks: Math.max(1, Math.ceil(c.total_hours / 7)),
  skill: c.skill_names_ar[0] ?? '',
}))

/** تفاصيل الدورة الكاملة بمعرفها — للرحلة التعليمية والأكورديون */
export function courseFullById(id: string): CourseFull | null {
  const c = raw.courses.find((x) => x.course_id === id)
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
    })),
    practicalProject: c.summative_assessment_ar ?? '',
    relatedSkills: c.skill_names_ar,
    referenceIds: c.source_codes ?? [],
  }
}

export const courseById = (id: string) => courses.find((c) => c.id === id)

export const pathwayCourses: Record<string, string[]> = Object.fromEntries(
  raw.launch_pathways.map((p) => [p.id, p.course_ids]),
)

/** طريقة تقديم المسار من الكتالوج الموثق — تُعرض ضمن تفاصيل دورات الرحلة */
export const pathwayDelivery = (pathwayId: string): string | undefined =>
  raw.launch_pathways.find((p) => p.id === pathwayId)?.delivery

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
export const bestsellerCourses: { id: string; note: string }[] = bestsellerPicks.flatMap((p) => {
  const id = pickCourse(p.pathway, p.index)
  return id ? [{ id, note: p.note }] : []
})

export const courseCategories = ['الكل', 'أساسيات', 'طلاب ومهنة', 'موظفون', 'حكومي', 'أعمال', 'تخصصات وظيفية', 'قيادة']

/* سعر الدورة المنفردة: 130–180 دولارا حسب مدتها */
export const coursePrice = (weeks: number) => Math.min(180, 105 + weeks * 25)

/** جمع الأسابيع بالعربية السليمة: «4 أسابيع» و«12 أسبوعا» */
export const weeksLabel = (n: number) =>
  n === 1 ? 'أسبوع واحد' : n === 2 ? 'أسبوعان' : n >= 3 && n <= 10 ? `${n} أسابيع` : `${n} أسبوعا`

/* سعر المسار الكامل التفضيلي الموحد */
export const PATHWAY_PRICE = 600

/* سعر المسار حسب عدد دوراته (الهدية المجانية لا تُحتسب):
   4 دورات = 500$ · 5 = 550$ · 6 أو أكثر = 600$ */
export const MIN_PATHWAY_COURSES = 4
export const MAX_PATHWAY_COURSES = 6
export const pathwayPriceFor = (courseCount: number) =>
  courseCount <= 4 ? 500 : courseCount === 5 ? 550 : 600

/* ─────────── سعر الدورة التقديري 130–180$ حسب عنوانها ومحتواها ─────────── */
const PREMIUM_KEYWORDS = [
  'ذكاء اصطناعي', 'AI', 'بيانات', 'تحليل', 'قيادة', 'تفاوض', 'مشاريع',
  'استراتيجية', 'مالية', 'مشتريات', 'عقود', 'حوكمة', 'تحول رقمي', 'إدارة المخاطر',
]
export function coursePriceOf(c: Course): number {
  const base = c.weeks <= 1 ? 130 : c.weeks === 2 ? 145 : c.weeks === 3 ? 160 : 170
  const premium = PREMIUM_KEYWORDS.some((k) => c.name.includes(k) || c.skill.includes(k)) ? 10 : 0
  return Math.min(180, base + premium)
}

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
    { name: TRAINER_PENDING_AR, role: 'مدربة العروض والخطابة' },
    { name: TRAINER_PENDING_AR, role: 'مدربة الحوار والإقناع' },
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
/** مدربو مسار معين — مقاعد التخصصات التدريبية المشاركة (2–3)؛ الاسم يُعلن بعد اعتماد الشعبة */
export function pathwayTrainers(pathwayId: string): Trainer[] {
  const family = pathwayId.split('-')[1] ?? 'FND'
  const pool = TRAINER_POOLS[family] ?? TRAINER_POOLS.FND
  const num = parseInt(pathwayId.split('-')[2] ?? '1', 10) || 1
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
  'تخصصات وظيفية': ['أساسيات التخصص بمنهج عملي', 'أدوات وقوالب الممارسين', 'تطبيق على حالة حقيقية من مجالك', 'مراجعة المدرب لمخرجك'],
  'قيادة': ['تقييم أسلوبك القيادي الحالي', 'أدوات الحوار والمتابعة', 'تطبيق مع فريقك الحقيقي', 'خطة قيادة فردية مراجَعة'],
}
const OUTCOME_BY_CATEGORY: Record<string, string> = {
  'أساسيات': 'نظام شخصي موثق تستخدمه يوميا',
  'طلاب ومهنة': 'مخرج جاهز تقدمه لأي جهة توظيف',
  'موظفون': 'قالب عملي تطبقه في عملك من الأسبوع الأول',
  'حكومي': 'نموذج عمل حكومي جاهز للاستخدام الفوري',
  'أعمال': 'أداة تستخدمها في مشروعك مباشرة',
  'تخصصات وظيفية': 'مخرج مهني موثق في تخصصك',
  'قيادة': 'خطة قيادة فردية قيّمها المدرب معك',
}
export function courseDetails(c: Course): { trainer: Trainer; topics: string[]; outcome: string } {
  return {
    trainer: courseTrainer(c),
    topics: TOPIC_TEMPLATES[c.category] ?? TOPIC_TEMPLATES['أساسيات'],
    outcome: `${OUTCOME_BY_CATEGORY[c.category] ?? OUTCOME_BY_CATEGORY['أساسيات']} — في ${c.skill}`,
  }
}

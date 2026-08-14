/* كتالوج الدورات — محوّل يقرأ من core-catalog.v2.json (مئة دورة ضمن عشرين مسارا) */

import coreCatalog from './catalog/core-catalog.v2.json'
import { pathwayCategory } from './pathways'

export interface Course {
  id: string
  name: string
  pathwayId: string
  pathwayName: string
  category: string
  weeks: number
  skill: string
}

interface RawCourse {
  course_id: string
  pathway_id: string
  sequence: number
  title_ar: string
  subtitle_ar?: string
  total_hours: number
  skill_names_ar: string[]
}
interface RawPathway {
  id: string
  title: string
  course_ids: string[]
}

const raw = coreCatalog as unknown as { launch_pathways: RawPathway[]; courses: RawCourse[] }

const pathwayTitle = new Map(raw.launch_pathways.map((p) => [p.id, p.title]))

export const courses: Course[] = raw.courses.map((c) => ({
  id: c.course_id,
  name: c.title_ar,
  pathwayId: c.pathway_id,
  pathwayName: pathwayTitle.get(c.pathway_id) ?? '',
  category: pathwayCategory(c.pathway_id),
  weeks: Math.max(1, Math.ceil(c.total_hours / 7)),
  skill: c.skill_names_ar[0] ?? '',
}))

export const courseById = (id: string) => courses.find((c) => c.id === id)

export const pathwayCourses: Record<string, string[]> = Object.fromEntries(
  raw.launch_pathways.map((p) => [p.id, p.course_ids]),
)

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

/* ─────────── مدربو المسارات — تشكيلة توضيحية بانتظار قائمة موثقة ─────────── */
export interface Trainer {
  name: string
  role: string
}
export const TRAINER_POOLS: Record<string, Trainer[]> = {
  FND: [
    { name: 'أ. ريم القحطاني', role: 'مدربة التعلم الذاتي وبناء العادات' },
    { name: 'أ. محمد الشهري', role: 'مدرب الكفاءة الرقمية' },
    { name: 'د. نورة السبيعي', role: 'مدربة تطبيقات الذكاء الاصطناعي' },
  ],
  STU: [
    { name: 'أ. ريم القحطاني', role: 'مدربة الجاهزية المهنية' },
    { name: 'أ. عبدالله المطيري', role: 'مدرب التخطيط المهني للطلاب' },
  ],
  EMP: [
    { name: 'د. فيصل العتيبي', role: 'مدرب تطوير الموظفين' },
    { name: 'أ. سارة الدوسري', role: 'مدربة الكتابة والعروض المهنية' },
    { name: 'م. خالد العنزي', role: 'مدرب إدارة المشاريع والبيانات' },
  ],
  COM: [
    { name: 'أ. سارة الدوسري', role: 'مدربة العروض والخطابة' },
    { name: 'د. منيرة الزهراني', role: 'مدربة الحوار والإقناع' },
  ],
  NEG: [
    { name: 'د. فيصل العتيبي', role: 'مدرب التفاوض' },
    { name: 'م. سلطان الدوسري', role: 'مدرب إدارة النزاعات' },
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
  AUT: [
    { name: 'د. نورة السبيعي', role: 'مدربة الذكاء الاصطناعي التطبيقي' },
    { name: 'أ. محمد الشهري', role: 'مدرب الأتمتة والإنتاجية' },
  ],
  MKT: [
    { name: 'أ. فهد الغامدي', role: 'مدرب التسويق الرقمي' },
    { name: 'م. لينا الحربي', role: 'مدربة النمو' },
  ],
  SAL: [
    { name: 'أ. فهد الغامدي', role: 'مدرب المبيعات الاستشارية' },
    { name: 'د. فيصل العتيبي', role: 'مدرب تطوير الأعمال' },
  ],
  HR: [
    { name: 'د. منيرة الزهراني', role: 'مدربة الموارد البشرية' },
    { name: 'أ. هند العمري', role: 'مدربة تجربة الموظف' },
  ],
  FIN: [
    { name: 'د. بدر القحطاني', role: 'مدرب المالية للمديرين' },
    { name: 'م. خالد العنزي', role: 'مدرب التحليل المالي' },
  ],
  PRD: [
    { name: 'م. خالد العنزي', role: 'مدرب إدارة المنتج' },
    { name: 'د. نورة السبيعي', role: 'مدربة تجربة المستخدم' },
  ],
  OPS: [
    { name: 'م. سلطان الدوسري', role: 'مدرب التميز التشغيلي' },
    { name: 'م. خالد العنزي', role: 'مدرب تحسين العمليات' },
  ],
  CYB: [
    { name: 'م. خالد العنزي', role: 'مدرب إدارة المخاطر السيبرانية' },
    { name: 'أ. محمد الشهري', role: 'مدرب الأمن الرقمي' },
  ],
  SCM: [
    { name: 'د. بدر القحطاني', role: 'مدرب المشتريات وسلاسل الإمداد' },
    { name: 'م. سلطان الدوسري', role: 'مدرب العمليات' },
  ],
  LND: [
    { name: 'م. سلطان الدوسري', role: 'مدرب القيادة' },
    { name: 'د. منيرة الزهراني', role: 'مدربة الحوار والتغذية الراجعة' },
  ],
}
/** مدربو مسار معين — 2–3 مدربين مشاركين (تشكيلة توضيحية؛ يُؤكَّد التعيين بعد اعتماد الشعبة) */
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

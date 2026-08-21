/* محمّل الكتالوج — يقرأ لقطة catalog_version المنشورة الفعالة وقت التشغيل.
   الافتراضي (تطوير/اختبارات/انقطاع API): الحزمة المضمنة من ملفات JSON الموثقة.
   installCatalogSnapshot() يستبدل كل البنى دفعة واحدة — روابط ES الحية تجعل
   كل مستورد يرى اللقطة الجديدة دون إعادة بناء، والمحرك لا يقرأ arrays ثابتة
   وقت build عندما تتوفر لقطة منشورة من الخادم. */

import questionsJson from '../../data/catalog/questions.v1.ar.json'
import skillsJson from '../../data/catalog/skills.v1.ar.json'
import coreCatalogJson from '../../data/catalog/core-catalog.v2.json'
import templatesJson from '../../data/catalog/composite-templates.v1.json'
import optionEffectsJson from '../../data/overlays/option-effects.v2.json'
import optionEffectsV21Json from '../../data/overlays/option-effects.v2_1.json'
import b2cQuestionsV21Json from '../../data/catalog/v2_1/questions-b2c.v2_1.ar.json'
import pathwayProfilesJson from '../../data/overlays/pathway-profiles.v1.json'
import { installPathwayDomains, installQuestionMeta, installSkillLayers } from './v2/data'
import { installQuestionPlan } from './v2_1/data'
import type {
  BankQuestion,
  CatalogCourse,
  CatalogPathway,
  PathwayProfile,
  SkillEntry,
  TrainerProfile,
} from './types'

interface OptionEffectsFile {
  /* قيمة التأثير نص أو قائمة نصوص (مثل interest_domains متعددة المجالات) */
  option_effects: Record<string, Record<string, Record<string, string | string[]>>>
  keyword_classifiers: Record<
    string,
    { fact_key: string; rules: { code: string; any: string[] }[] }
  >
}

export interface CompositeTemplate {
  template_id: string
  name_ar: string
  short_name_ar?: string
  intent_ar?: string
  persona?: { best_for_ar?: string; not_for_ar?: string }
  transformation?: { before_ar?: string; after_ar?: string; capstone_ar?: string; success_metric_ar?: string }
  required_courses: { sequence: number; course_type: string; course_id: string; course_title_ar?: string; pathway_id?: string; hours?: number }[]
  conditional_courses?: { course_id: string; course_title_ar?: string; hours?: number; condition_ar?: string }[]
  bridge_courses?: { course_id: string; course_title_ar?: string; hours?: number }[]
  starter_courses?: { sequence: number; course_id: string; course_title_ar?: string; hours?: number }[]
  diagnostic: {
    primary_goal_codes?: string[]
    required_facts: { fact_key: string; question_ids: string[]; importance: string; minimum_confidence: number }[]
    positive_signals: { fact_key: string; operator: string; values: (string | number)[]; weight: number; rationale_ar?: string }[]
    negative_signals?: { fact_key: string; operator: string; values: (string | number)[]; weight: number; rationale_ar?: string }[]
    /** مرشحات صارمة من ملف القوالب — exclude/recommend_bridge يستبعدان القالب، advisor_handoff يوجّه للمستشار */
    hard_filters?: {
      filter_id: string
      condition: { fact_key: string; operator: string; values: (string | number)[] }
      action: 'exclude' | 'recommend_bridge' | 'advisor_handoff'
      rationale_ar?: string
    }[]
    /** أسئلة فاصلة موثقة تُطرح عند تقارب قالبين — لا حسم بالترتيب الأبجدي */
    differentiators?: {
      against_template_ids: string[]
      question_id: string
      question_ar?: string
      interpretation_if_positive_ar?: string
      interpretation_if_negative_ar?: string
    }[]
  }
  plan?: {
    starter_course_count?: number
    full_required_course_count?: number
    recommended_duration_weeks?: number
    minimum_weekly_hours?: number
    represented_pathway_ids?: string[]
  }
  entity_type?: string
  not_counted_as_pathway?: boolean
  status?: string
}

/** شكل لقطة الكتالوج المنشورة كما يقدمها API (وكما يخزنها CatalogSnapshot) */
export interface CatalogSnapshotPayload {
  questions: { questions: BankQuestion[] }
  skills: { skills: SkillEntry[] }
  coreCatalog: {
    launch_pathways: CatalogPathway[]
    courses: CatalogCourse[]
    skill_extensions?: SkillEntry[]
  }
  templates: { templates: CompositeTemplate[] }
  optionEffects: OptionEffectsFile
  pathwayProfiles: { profiles: Record<string, PathwayProfile> }
  /** مجالات المسارات (ج-١) — اختيارية: اللقطات المنشورة قبل هذا البند لا تحملها،
      وحينها يبقى ملف pathway-domains.v2.json المضمن هو المصدر. */
  pathwayDomains?: { pathway_domains: Record<string, string[]> }
  /** التراكبات المولّدة (ج-٢) — اختيارية للسبب نفسه. تُولَّد وقت بناء اللقطة من
      الصفوف المنشورة، فسؤال يُضاف بعد النشر يدخلها ويصبح مرئيا للمحرك. */
  overlays?: {
    questionMeta?: { questions: Record<string, unknown> }
    skillLayers?: { skills: Record<string, unknown> }
    questionPlan?: { plan: Record<string, unknown> }
  }
}

export let questionBank: BankQuestion[] = []
export let questionById = new Map<string, BankQuestion>()
export let skillsCatalog: SkillEntry[] = []
export let skillSlugs = new Set<string>()
export let launchPathways: CatalogPathway[] = []
export let catalogCourses: CatalogCourse[] = []
export let courseById = new Map<string, CatalogCourse>()
export let compositeTemplates: CompositeTemplate[] = []
export let optionEffects: OptionEffectsFile['option_effects'] = {}
export let keywordClassifiers: OptionEffectsFile['keyword_classifiers'] = {}
export let pathwayProfiles: Record<string, PathwayProfile> = {}
export let trainerProfiles: TrainerProfile[] = []
/** إصدار الكتالوج الفعال حاليا — «bundled» يعني الحزمة المضمنة (لا لقطة خادم) */
export let activeCatalogLabel = 'bundled'

function install(payload: CatalogSnapshotPayload, label: string): void {
  /* أسئلة V2.1 تعيش في حزمة موثقة مرافقة للمحرك: تُطبق إعادة الصياغة على البنك
     ثم تُلحق أسئلة القرار الجديدة — مع أي لقطة خادم أيضًا حتى لا تختفي QC */
  const v21 = b2cQuestionsV21Json as unknown as { questions: BankQuestion[]; overrides: BankQuestion[] }
  const overrideById = new Map(v21.overrides.map((o) => [o.question_id, o]))
  const base = payload.questions.questions
    .filter((q) => q.active !== false)
    .map((q) => overrideById.get(q.question_id) ?? q)
  const questions = [...base, ...v21.questions.filter((q) => !base.some((b) => b.question_id === q.question_id))]
  questionBank = questions
  questionById = new Map(questions.map((q) => [q.question_id, q]))
  skillsCatalog = [...payload.skills.skills, ...(payload.coreCatalog.skill_extensions ?? [])]
  skillSlugs = new Set(skillsCatalog.map((s) => s.slug))
  launchPathways = payload.coreCatalog.launch_pathways
  catalogCourses = payload.coreCatalog.courses
  courseById = new Map(catalogCourses.map((c) => [c.course_id, c]))
  compositeTemplates = payload.templates.templates
  optionEffects = {
    ...payload.optionEffects.option_effects,
    ...(optionEffectsV21Json as unknown as OptionEffectsFile).option_effects,
  }
  keywordClassifiers = payload.optionEffects.keyword_classifiers
  pathwayProfiles = payload.pathwayProfiles.profiles
  /* مجالات المسارات من اللقطة إن حملتها — وإلا الملف المضمن (لقطة أقدم من ج-١) */
  installPathwayDomains(payload.pathwayDomains?.pathway_domains ?? null)
  /* التراكبات المولّدة (ج-٢) — كلٌّ مستقل: لقطة تحمل بعضها تُثبِّت ما تحمله
     ويبقى الباقي من الملف المضمن، بلا خلط بين مصدرين لتراكب واحد. */
  installQuestionMeta(payload.overlays?.questionMeta?.questions ?? null)
  installSkillLayers(payload.overlays?.skillLayers?.skills ?? null)
  installQuestionPlan(payload.overlays?.questionPlan?.plan ?? null)
  trainerProfiles = [] // لا مدربين موثقين بعد — مطابقة المدرب ترجع unassigned دائما
  activeCatalogLabel = label
  for (const fn of installListeners) fn()
}

/* ─── مستمعو التثبيت ───
   الحاجة: كيانات المحرك مخزَّنة في ذاكرات مؤقتة على مستوى الوحدة
   (resetUniverseCache في v2_1/universe). universe يستورد هذا الملف، فاستيراده
   من هنا يصنع حلقة — والسجل يقلب الاتجاه بلا حلقة: universe يسجّل نفسه.

   عيبٌ قائم كُشف في ج-٢: `resetUniverseCache` كان موجودا وموثقا بـ«إعادة البناء
   عند استبدال لقطة الكتالوج» **ولا يناديه أحد**. فأي لقطة تُثبَّت كانت تترك
   فضاء التوصية وقائمة المهارات المقيسة على حساب اللقطة السابقة.

   المستمعون يُنادون **بعد** استبدال الحالة كاملة: عندها الحالة متسقة، ومستمع
   يرمي يجب أن يُسمَع لا أن يُكتم. */
const installListeners = new Set<() => void>()

/** تسجيل عمل يجري بعد كل تثبيت لقطة (أو الحزمة المضمنة). يعيد دالة إلغاء. */
export function onCatalogInstalled(fn: () => void): () => void {
  installListeners.add(fn)
  return () => installListeners.delete(fn)
}

/** تثبيت لقطة منشورة من الخادم — العملية ذرية: إما تُقبل اللقطة كاملة أو يبقى الحال */
export function installCatalogSnapshot(payload: CatalogSnapshotPayload, label: string): void {
  /* تحقق بنيوي قبل القبول — لقطة ناقصة لا تُثبَّت أبدا */
  if (!payload?.questions?.questions?.length) throw new Error('لقطة كتالوج بلا أسئلة')
  if (!payload?.coreCatalog?.launch_pathways?.length) throw new Error('لقطة كتالوج بلا مسارات')
  if (!payload?.coreCatalog?.courses?.length) throw new Error('لقطة كتالوج بلا دورات')
  if (!payload?.templates?.templates) throw new Error('لقطة كتالوج بلا قوالب')
  install(payload, label)
}

/* التهيئة الافتراضية من الحزمة المضمنة — نفس مسار التحقق */
install(
  {
    questions: questionsJson as unknown as { questions: BankQuestion[] },
    skills: skillsJson as unknown as { skills: SkillEntry[] },
    coreCatalog: coreCatalogJson as unknown as CatalogSnapshotPayload['coreCatalog'],
    templates: templatesJson as unknown as { templates: CompositeTemplate[] },
    optionEffects: optionEffectsJson as unknown as OptionEffectsFile,
    pathwayProfiles: pathwayProfilesJson as unknown as { profiles: Record<string, PathwayProfile> },
  },
  'bundled',
)

/** معرف خيار ثابت من ترتيبه (1-based) — النص العربي قابل للتعديل دون تغيير النتيجة */
export function optionIdAt(question: BankQuestion, index: number): string {
  if (index < 0 || index >= question.options_ar.length) {
    throw new RangeError(`ترتيب خيار خارج النطاق في ${question.question_id}: ${index}`)
  }
  return `o${index + 1}`
}

/** ترتيب الخيار (0-based) من معرفه الثابت؛ -1 إن لم يطابق النمط */
export function optionIndexOfId(optionId: string): number {
  const m = /^o(\d+)$/.exec(optionId)
  return m ? Number(m[1]) - 1 : -1
}

/** تحويل نص خيار قديم إلى معرفه الثابت — جسر ترحيل الجلسات المحلية القديمة */
export function optionIdFromText(question: BankQuestion, text: string): string | null {
  const idx = question.options_ar.indexOf(text)
  return idx >= 0 ? optionIdAt(question, idx) : null
}

export function pathwaySkills(pathwayId: string): { slug: string; nameAr: string }[] {
  const p = launchPathways.find((x) => x.id === pathwayId)
  if (!p) return []
  const seen = new Map<string, string>()
  for (const cid of p.course_ids) {
    const c = courseById.get(cid)
    if (!c) continue
    c.skill_slugs.forEach((slug, i) => {
      if (!seen.has(slug)) seen.set(slug, c.skill_names_ar[i] ?? slug)
    })
  }
  return [...seen.entries()].map(([slug, nameAr]) => ({ slug, nameAr }))
}

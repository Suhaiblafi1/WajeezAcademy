/* محمّل الكتالوج — يقرأ ملفات JSON الأصلية والتراكيب ويقدمها بأنواع محكمة */

import questionsJson from '../../data/catalog/questions.v1.ar.json'
import skillsJson from '../../data/catalog/skills.v1.ar.json'
import coreCatalogJson from '../../data/catalog/core-catalog.v2.json'
import templatesJson from '../../data/catalog/composite-templates.v1.json'
import optionEffectsJson from '../../data/overlays/option-effects.v2.json'
import pathwayProfilesJson from '../../data/overlays/pathway-profiles.v1.json'
import trainerProfilesJson from '../../data/overlays/trainer-profiles.v1.json'
import type {
  BankQuestion,
  CatalogCourse,
  CatalogPathway,
  PathwayProfile,
  SkillEntry,
  TrainerProfile,
} from './types'

interface OptionEffectsFile {
  option_effects: Record<string, Record<string, Record<string, string>>>
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

const qFile = questionsJson as unknown as { questions: BankQuestion[] }
const sFile = skillsJson as unknown as { skills: SkillEntry[] }
const cFile = coreCatalogJson as unknown as {
  launch_pathways: CatalogPathway[]
  courses: CatalogCourse[]
  skill_extensions?: SkillEntry[]
}
const tFile = templatesJson as unknown as { templates: CompositeTemplate[] }
const oeFile = optionEffectsJson as unknown as OptionEffectsFile
const ppFile = pathwayProfilesJson as unknown as { profiles: Record<string, PathwayProfile> }
const trFile = trainerProfilesJson as unknown as { profiles: TrainerProfile[] }

export const questionBank: BankQuestion[] = qFile.questions.filter((q) => q.active !== false)
export const questionById = new Map(questionBank.map((q) => [q.question_id, q]))
export const skillsCatalog: SkillEntry[] = [...sFile.skills, ...(cFile.skill_extensions ?? [])]
export const skillSlugs = new Set(skillsCatalog.map((s) => s.slug))
export const launchPathways: CatalogPathway[] = cFile.launch_pathways
export const catalogCourses: CatalogCourse[] = cFile.courses
export const courseById = new Map(catalogCourses.map((c) => [c.course_id, c]))
export const compositeTemplates: CompositeTemplate[] = tFile.templates
export const optionEffects = oeFile.option_effects
export const keywordClassifiers = oeFile.keyword_classifiers
export const pathwayProfiles: Record<string, PathwayProfile> = ppFile.profiles
export const trainerProfiles: TrainerProfile[] = trFile.profiles

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

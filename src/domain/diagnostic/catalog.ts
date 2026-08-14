/* محمّل الكتالوج — يقرأ ملفات JSON الأصلية والتراكيب ويقدمها بأنواع محكمة */

import questionsJson from '../../data/catalog/questions.v1.ar.json'
import skillsJson from '../../data/catalog/skills.v1.ar.json'
import coreCatalogJson from '../../data/catalog/core-catalog.v2.json'
import templatesJson from '../../data/catalog/composite-templates.v1.json'
import optionEffectsJson from '../../data/overlays/option-effects.v1.json'
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
}
const tFile = templatesJson as unknown as { templates: CompositeTemplate[] }
const oeFile = optionEffectsJson as unknown as OptionEffectsFile
const ppFile = pathwayProfilesJson as unknown as { profiles: Record<string, PathwayProfile> }
const trFile = trainerProfilesJson as unknown as { profiles: TrainerProfile[] }

export const questionBank: BankQuestion[] = qFile.questions.filter((q) => q.active !== false)
export const questionById = new Map(questionBank.map((q) => [q.question_id, q]))
export const skillsCatalog: SkillEntry[] = sFile.skills
export const skillSlugs = new Set(skillsCatalog.map((s) => s.slug))
export const launchPathways: CatalogPathway[] = cFile.launch_pathways
export const catalogCourses: CatalogCourse[] = cFile.courses
export const courseById = new Map(catalogCourses.map((c) => [c.course_id, c]))
export const compositeTemplates: CompositeTemplate[] = tFile.templates
export const optionEffects = oeFile.option_effects
export const keywordClassifiers = oeFile.keyword_classifiers
export const pathwayProfiles: Record<string, PathwayProfile> = ppFile.profiles
export const trainerProfiles: TrainerProfile[] = trFile.profiles

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

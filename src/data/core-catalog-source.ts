/* مصدر الكتالوج الجوهري القابل للتبديل — الحزمة المضمنة الموثقة هي الافتراضي،
   وتُستبدل المحتويات (لا المراجع) بلقطة API المنشورة عند توفرها.
   المحولات في pathways.ts وcourses.ts تعمل على هذا المصدر الوحيد أيًا كان:
   لا نسخة ثانية متعارضة داخل المكونات. */

import bundled from './catalog/core-catalog.v2.json'

export interface CoreCatalogPathway {
  id: string
  title: string
  audience: string
  after: string
  capstone: string
  duration_weeks: number
  weekly_hours: string
  level: string
  delivery?: string
  course_ids: string[]
}

export interface CoreCatalogCourse {
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

export interface CoreCatalogModule {
  module_id: string
  course_id: string
  sequence: number
  title_ar: string
  module_outcome_ar: string
  practice_activity_ar: string
  evidence_artifact_ar: string
  expected_hours: number
}

export interface CoreCatalogRaw {
  launch_pathways: CoreCatalogPathway[]
  courses: CoreCatalogCourse[]
  modules: CoreCatalogModule[]
}

let active: CoreCatalogRaw = bundled as unknown as CoreCatalogRaw
let version = 0
const listeners = new Set<() => void>()

export function getCoreCatalogRaw(): CoreCatalogRaw {
  return active
}

export function getCatalogVersion(): number {
  return version
}

/** اشتراك إعادة البناء — تعيد المحولات ملء مصفوفاتها المصدَّرة في مكانها */
export function onCoreCatalogInstalled(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** تثبيت لقطة API المنشورة — يخطر المحولات ثم المشتركين (React) */
export function installCoreCatalogRaw(next: CoreCatalogRaw): void {
  active = next
  version += 1
  for (const cb of listeners) cb()
}

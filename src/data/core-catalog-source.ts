/* مصدر الكتالوج الجوهري القابل للتبديل — الحزمة المضمنة الموثقة هي الافتراضي،
   وتُستبدل المحتويات (لا المراجع) بلقطة API المنشورة عند توفرها.
   المحولات في pathways.ts وcourses.ts تعمل على هذا المصدر الوحيد أيًا كان:
   لا نسخة ثانية متعارضة داخل المكونات. */


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
  /** الدورات المساندة للمسار الجاهز — **خارج** course_ids بقصد.
      course_ids وحدها يقرؤها pathwaySkills، ومنها تُحسب فجوة المهارات التي
      يرتّب بها التشخيص المسارات؛ فالمساندة وعدُ عرضٍ في المسار الجاهز لا
      إشارةُ تشخيص. الحارس: src/tests/catalog/support-courses.test.ts */
  support_courses?: { course_id: string; reason_ar: string }[]
}

export interface CoreCatalogCourse {
  course_id: string
  pathway_id: string
  sequence: number
  title_ar: string
  /** المصطلح المهنيّ المعروف بالإنجليزية — اختياريّ، ولا يُذكر إلا حيث يكون
      المصطلح الإنجليزي أشهر من العربي في سوق العمل */
  title_term_en?: string
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
  /** سعر القائمة وعملته — الرقم المُعلن قبل فتح الشعبة، وترثه الشعبة */
  list_price?: number
  list_currency?: string
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
  /** متن الدرس (ح-١) — Markdown مقيّد؛ غائب حين لا درس */
  module_body_ar?: string
  /** تمرين الاسترجاع (ح-٣) — صيغة «س:/-/+/ش:»؛ غائب حين لا تمرين */
  module_checks_ar?: string
  /** فيديو الوحدة وفصوله (ح-٢) — رابط ثم أسطر «د:ث عنوان»؛ غائب حين لا فيديو */
  module_video_ar?: string
  module_scenario_ar?: string
}

/** مورد مكتبة — مادّة خارج الدورة، من المصدر إلى الشاشة بسلسلة الكتالوج */
export interface CoreCatalogLibraryResource {
  id: string
  kind: 'video' | 'article' | 'template' | 'post' | 'pdf' | 'text' | 'book'
  title_ar: string
  description_ar?: string
  url: string
  source_ar?: string
  minutes?: number
  skill_slugs?: string[]
  sort_order?: number
}

export interface CoreCatalogRaw {
  launch_pathways: CoreCatalogPathway[]
  courses: CoreCatalogCourse[]
  modules: CoreCatalogModule[]
  /** اختياريّ: مكتبة فارغة لا تُعطّل شيئا، وتبويبها لا يظهر أصلا */
  library_resources?: CoreCatalogLibraryResource[]
}

/* البند ع-١: الحزمة المضمنة كانت تُستورد ثابتا فتهبط في حزمة الدخول
   (720 كيلوبايت من JSON على كل زائر قبل أول بكسل) رغم أنها نسخة احتياطية
   فقط — المصدر الأساسي هو لقطة API المنشورة. صارت تُحمَّل كسولا عند فشل
   الجلب وحده، والمحولات تعيد ملء مصفوفاتها عبر onCoreCatalogInstalled. */
const EMPTY: CoreCatalogRaw = { launch_pathways: [], courses: [], modules: [], library_resources: [] }
let active: CoreCatalogRaw = EMPTY
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

/** الاحتياطي المضمن — يُحمَّل كسولا عند تعذّر جلب اللقطة المنشورة فقط */
let fallbackInflight: Promise<void> | null = null
export function loadBundledCoreCatalog(): Promise<void> {
  if (fallbackInflight) return fallbackInflight
  fallbackInflight = import('./catalog/core-catalog.v2.json')
    .then((m) => {
      const raw = (m.default ?? m) as unknown as CoreCatalogRaw
      if (Array.isArray(raw?.launch_pathways) && raw.launch_pathways.length > 0) {
        installCoreCatalogRaw(raw)
      }
    })
    .catch(() => {
      /* لا احتياطي متاح — الصفحات تعرض حالة الفراغ الموجِّهة */
    })
  return fallbackInflight
}

/** موارد المكتبة المنشورة — مرتّبة بترتيب النشر ثم المعرّف.
    فارغة حتى تُضاف موادّ إلى مصدر الكتالوج، وتبويب المكتبة لا يظهر حينها. */
export function getLibraryResources(): CoreCatalogLibraryResource[] {
  const rows = active.library_resources ?? []
  return [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
}

/** هل توجد بيانات كتالوج فعالة؟ — للصفحات كي تعرض حالة تحميل لا صفرا مضلّلا */
export function hasCoreCatalog(): boolean {
  return active.launch_pathways.length > 0
}

/* نمو المهارة المقيس (البند ح-٧) — إعادة قياس المهارة بعد إتمام الدورة، وعرض الفرق.
   هذا ما يغلق الدائرة: المنصة تقيس المهارة قبل التعلم (مؤشر وجيز)، وتقيسها بعده،
   فتتحول الشهادة من ورقة إتمام إلى دليل نمو مقيس.

   قواعد الصدق التي يفرضها هذا الملف — وهي سبب وجوده:
   ١) لا قياس بعديّ قبل إتمام حقيقي: بلا شهادة ولا حالة «مكتمل» ولا قواعد إكمال
      متحققة، لا يُفتح القياس أصلا. الفرق بلا إتمام لا يدل على شيء.
   ٢) المستوى «قبل» لقطةٌ تُخزَّن وقت القياس البعدي، لا تُشتق لاحقا: لو أعاد
      المتعلم التشخيص بعد سنة، لا يتغير فرقٌ سُجّل قبلها.
   ٣) ما لم يُقس قبل الدورة لا يُعطى صفرا ولا يُدخل في حساب الفرق — يُعدّ «قياسا
      أولا» في مجموعة منفصلة. اختلاق بسطٍ هنا هو أسهل كذبة في المنصة.
   ٤) التراجع يُعرض كما هو. مؤشرٌ لا يستطيع أن ينزل ليس قياسا بل تصفيق.
   ٥) القياس مرة واحدة لكل تسجيل: الفرق سجلٌ لا مقبض يُحرَّك حتى يُرضي صاحبه. */

import { catalogCourses, skillsCatalog } from '../../domain/diagnostic/catalog'
import { TARGET_LEVEL } from '../../domain/diagnostic/v2/skills'
import { LEVEL_MAX } from './skills-profile'

/** أدنى وأعلى درجة — سلّم skill_level_5 نفسه المستعمل في التشخيص، لا سلّم موازيا */
export const REMEASURE_MIN = 1
export const REMEASURE_MAX = LEVEL_MAX

/* ══════════ بوابة الأهلية ══════════ */

export interface CompletionFacts {
  /** enrolled | completed | dropped | waitlisted */
  enrollmentStatus: string
  hasCertificate: boolean
  /** عدد قواعد الإكمال المطبَّقة — صفر يعني أن الدورة بلا قواعد معتمدة */
  rulesChecked: number
  rulesMet: boolean
  percent: number
}

export interface RemeasureGate {
  open: boolean
  reasonAr: string
}

/**
 * هل يُفتح القياس البعدي لهذا التسجيل؟
 * لا يُفتح بالتقدم وحده: نسبة ٩٩٪ ليست إتماما، و«بلا قواعد» ليس إتماما.
 */
export function remeasureGate(f: CompletionFacts): RemeasureGate {
  if (f.enrollmentStatus === 'dropped') return { open: false, reasonAr: 'تسجيلك في هذه الدورة منسحب — لا قياس بعديّ عليه' }
  if (f.enrollmentStatus === 'waitlisted') return { open: false, reasonAr: 'أنت في قائمة الانتظار — يُفتح القياس بعد الالتحاق والإتمام' }
  if (f.hasCertificate) return { open: true, reasonAr: 'صدرت شهادتك في هذه الدورة' }
  if (f.enrollmentStatus === 'completed') return { open: true, reasonAr: 'تسجيلك مكتمل' }
  if (f.rulesChecked > 0 && f.rulesMet) return { open: true, reasonAr: 'تحققت قواعد إكمال الدورة' }
  if (f.rulesChecked === 0) {
    return { open: false, reasonAr: 'لم تُعتمد بعد قواعد إكمال لهذه الدورة — يُفتح القياس عند اعتماد إتمامك رسميا' }
  }
  return { open: false, reasonAr: `أكمل متطلبات الدورة أولا — تقدمك الآن ${f.percent}٪` }
}

/* ══════════ استمارة القياس البعدي ══════════ */

export interface RemeasureRow {
  slug: string
  nameAr: string
  /** مستواك قبل الدورة كما قِيس — null يعني أن المؤشر لم يسألك عنها */
  beforeLevel: number | null
}

export interface RemeasureForm {
  courseId: string
  courseTitleAr: string | null
  rows: RemeasureRow[]
  /** false يعني أن الدورة بلا مهارات مصنّفة — فلا قياس بعديّ لها */
  measurable: boolean
}

/** اسم المهارة من كتالوج المهارات، ثم من أسماء الدورة، ثم الشريحة مقروءة */
function nameOf(slug: string, fromCourse: Map<string, string>): string {
  const entry = skillsCatalog.find((s) => s.slug === slug)
  if (entry?.name_ar) return entry.name_ar
  return fromCourse.get(slug) ?? slug.replace(/_/g, ' ')
}

/**
 * يبني الاستمارة من مهارات الدورة في الكتالوج المنشور ومن متجه القياس السابق.
 * @param courseId معرّف الدورة الثابت (C-…)
 * @param baseline متجه القياس قبل الدورة — المفتاح شريحة المهارة والقيمة ١..٥
 */
export function buildRemeasureForm(courseId: string, baseline: Record<string, number>): RemeasureForm {
  const course = catalogCourses.find((c) => c.course_id === courseId) ?? null
  const slugs = course?.skill_slugs ?? []
  const namesFromCourse = new Map<string, string>(
    slugs.map((slug, i) => [slug, course?.skill_names_ar?.[i] ?? '']).filter(([, n]) => n !== '') as [string, string][],
  )
  const rows: RemeasureRow[] = slugs.map((slug) => {
    const before = baseline[slug]
    return {
      slug,
      nameAr: nameOf(slug, namesFromCourse),
      beforeLevel: typeof before === 'number' && Number.isFinite(before) && before >= REMEASURE_MIN
        ? Math.min(REMEASURE_MAX, Math.round(before))
        : null,
    }
  })
  return {
    courseId,
    courseTitleAr: course?.title_ar ?? null,
    rows,
    measurable: rows.length > 0,
  }
}

/** يتحقق من إجابات القياس قبل كتابتها — يُستدعى في المتصفح وفي الخادم على السواء */
export function validateRemeasure(
  levels: Record<string, unknown>,
  allowedSlugs: string[],
): { ok: boolean; errorsAr: string[]; clean: Record<string, number> } {
  const allowed = new Set(allowedSlugs)
  const errorsAr: string[] = []
  const clean: Record<string, number> = {}
  const entries = Object.entries(levels ?? {})
  if (entries.length === 0) errorsAr.push('لا إجابات في القياس')
  for (const [slug, raw] of entries) {
    if (!allowed.has(slug)) {
      errorsAr.push(`المهارة «${slug}» ليست من مهارات هذه الدورة`)
      continue
    }
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < REMEASURE_MIN || raw > REMEASURE_MAX) {
      errorsAr.push(`مستوى غير مقبول للمهارة «${slug}» — المطلوب عدد من ${REMEASURE_MIN} إلى ${REMEASURE_MAX}`)
      continue
    }
    clean[slug] = raw
  }
  return { ok: errorsAr.length === 0, errorsAr, clean }
}

/* ══════════ ملخص النمو ══════════ */

/** up ارتفع · same ثبت · down تراجع · first قياس أول بلا مرجع قبليّ */
export type GrowthDirection = 'up' | 'same' | 'down' | 'first'

export interface SkillGrowth {
  slug: string
  nameAr: string
  beforeLevel: number | null
  afterLevel: number
  /** الفرق — null بلا قياس قبليّ، فلا نفترض صفرا ولا نحتسبه في المجاميع */
  delta: number | null
  direction: GrowthDirection
  /** بلغ المستهدف (٤) بعدما كان دونه — الحدث الذي يستحق أن يُذكر في الشهادة */
  crossedTarget: boolean
}

export interface CourseGrowth {
  courseId: string
  courseTitleAr: string | null
  /** ISO — وقت القياس البعدي */
  measuredAt: string
  skills: SkillGrowth[]
  improved: number
  unchanged: number
  declined: number
  firstMeasured: number
  crossedTarget: number
  /** مجموع الفروق على المهارات ذات قياس قبليّ فقط — يشمل التراجع سالبا */
  netPoints: number
}

export interface GrowthSummary {
  hasData: boolean
  courses: CourseGrowth[]
  netPoints: number
  improved: number
  declined: number
  firstMeasured: number
  crossedTarget: number
}

export interface RemeasureRecord {
  courseId: string
  skillSlug: string
  beforeLevel: number | null
  afterLevel: number
  /** ISO */
  measuredAt: string
}

const EMPTY_SUMMARY: GrowthSummary = {
  hasData: false, courses: [], netPoints: 0, improved: 0, declined: 0, firstMeasured: 0, crossedTarget: 0,
}

function growthOf(r: RemeasureRecord, nameAr: string): SkillGrowth {
  const before = r.beforeLevel
  const after = Math.min(REMEASURE_MAX, Math.max(REMEASURE_MIN, Math.round(r.afterLevel)))
  if (before === null) {
    return { slug: r.skillSlug, nameAr, beforeLevel: null, afterLevel: after, delta: null, direction: 'first', crossedTarget: false }
  }
  const delta = after - before
  return {
    slug: r.skillSlug,
    nameAr,
    beforeLevel: before,
    afterLevel: after,
    delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
    crossedTarget: before < TARGET_LEVEL && after >= TARGET_LEVEL,
  }
}

/** الأكبر نموا أولا؛ والتراجع في الذيل حيث يُقرأ ولا يُدفن */
function byGrowth(a: SkillGrowth, b: SkillGrowth): number {
  const rank = (g: SkillGrowth) => (g.direction === 'up' ? 0 : g.direction === 'first' ? 1 : g.direction === 'same' ? 2 : 3)
  if (rank(a) !== rank(b)) return rank(a) - rank(b)
  if ((b.delta ?? 0) !== (a.delta ?? 0)) return (b.delta ?? 0) - (a.delta ?? 0)
  return a.nameAr.localeCompare(b.nameAr, 'ar')
}

/**
 * يجمع سجلات القياس البعدي في ملخص نمو، مجموعة بالدورات، الأحدث أولا.
 * @param records سجلات مخزّنة — كل سجل مهارة واحدة في تسجيل واحد
 * @param nameBySlug أسماء المهارات إن توفرت من الخادم؛ وإلا يُستكمل من الكتالوج
 */
export function buildGrowthSummary(
  records: RemeasureRecord[],
  nameBySlug: Record<string, string> = {},
): GrowthSummary {
  if (records.length === 0) return EMPTY_SUMMARY

  const byCourse = new Map<string, RemeasureRecord[]>()
  for (const r of records) {
    const bucket = byCourse.get(r.courseId)
    if (bucket) bucket.push(r)
    else byCourse.set(r.courseId, [r])
  }

  const courses: CourseGrowth[] = []
  for (const [courseId, rows] of byCourse) {
    const course = catalogCourses.find((c) => c.course_id === courseId) ?? null
    const namesFromCourse = new Map<string, string>(
      (course?.skill_slugs ?? []).map((slug, i) => [slug, course?.skill_names_ar?.[i] ?? '']),
    )
    const skills = rows
      .map((r) => growthOf(r, nameBySlug[r.skillSlug] || nameOf(r.skillSlug, namesFromCourse)))
      .sort(byGrowth)
    /* وقت الدورة = أحدث قياس فيها؛ القياس دفعة واحدة فتتساوى عادة */
    const measuredAt = rows.map((r) => r.measuredAt).sort().at(-1) ?? ''
    courses.push({
      courseId,
      courseTitleAr: course?.title_ar ?? null,
      measuredAt,
      skills,
      improved: skills.filter((s) => s.direction === 'up').length,
      unchanged: skills.filter((s) => s.direction === 'same').length,
      declined: skills.filter((s) => s.direction === 'down').length,
      firstMeasured: skills.filter((s) => s.direction === 'first').length,
      crossedTarget: skills.filter((s) => s.crossedTarget).length,
      netPoints: skills.reduce((sum, s) => sum + (s.delta ?? 0), 0),
    })
  }

  courses.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt) || a.courseId.localeCompare(b.courseId))
  return {
    hasData: true,
    courses,
    netPoints: courses.reduce((s, c) => s + c.netPoints, 0),
    improved: courses.reduce((s, c) => s + c.improved, 0),
    declined: courses.reduce((s, c) => s + c.declined, 0),
    firstMeasured: courses.reduce((s, c) => s + c.firstMeasured, 0),
    crossedTarget: courses.reduce((s, c) => s + c.crossedTarget, 0),
  }
}

/**
 * أحدث مستوى مقيس لكل مهارة من القياسات البعدية — لتحديث ما يراه المتعلم في ملف
 * مهاراته. لا يُعاد كتابة لقطة التشخيص: تلك سجل تاريخي، وهذا عرض للحالة الآن.
 */
export function latestLevels(records: RemeasureRecord[]): Record<string, number> {
  const at = new Map<string, string>()
  const out: Record<string, number> = {}
  for (const r of records) {
    const seen = at.get(r.skillSlug)
    if (seen !== undefined && seen > r.measuredAt) continue
    at.set(r.skillSlug, r.measuredAt)
    out[r.skillSlug] = Math.min(REMEASURE_MAX, Math.max(REMEASURE_MIN, Math.round(r.afterLevel)))
  }
  return out
}

/** يدمج القياس البعدي فوق متجه التشخيص — البعديّ أحدث فيغلب، وغير المقيس يبقى غير مقيس */
export function mergeMeasured(
  baseline: Record<string, number>,
  records: RemeasureRecord[],
): Record<string, number> {
  return { ...baseline, ...latestLevels(records) }
}

/** خريطة النمو بالشريحة — تُمرَّر لملف المهارات ليضع شارة «كنت س صرت ص» على الصف */
export function growthBySlug(summary: GrowthSummary): Map<string, { beforeLevel: number | null; delta: number | null; courseTitleAr: string | null }> {
  const map = new Map<string, { beforeLevel: number | null; delta: number | null; courseTitleAr: string | null }>()
  /* الدورات مرتّبة بالأحدث أولا، فأول ما يُكتب هو الأحدث ولا يُستبدل */
  for (const c of summary.courses) {
    for (const s of c.skills) {
      if (map.has(s.slug)) continue
      map.set(s.slug, { beforeLevel: s.beforeLevel, delta: s.delta, courseTitleAr: c.courseTitleAr })
    }
  }
  return map
}

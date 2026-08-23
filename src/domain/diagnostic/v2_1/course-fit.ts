/* ملاءمة المقرر — V2.1
   العلّة التي يعالجها: المحرك كان يقيس المهارات على **اتحاد** مهارات المسار كله
   (assessEntitySkills على entity.skill_slugs)، فيخرج رقمٌ واحد لخمسة مقررات
   مختلفة. والمسار خمسة مقررات لكل واحد أربع مهارات خاصة به — فمتوسطٌ واحد
   يخفي أن المتعلم متقن للمقرر الأول ومحتاج للرابع، ويعطيه الخمسة سواء.

   هنا يُقاس كل مقرر على مهاراته الأربع وحدها، ثم تُجمَع المقررات إلى المسار.
   وثلاثة مكوّنات تحكم الملاءمة:
     • حاجة المهارة — هل يسدّ هذا المقرر فجوة مقيسة فعلا؟ والمقرر الذي يعلّم
       ما أتقنه المتعلم أصلا ملاءمته صفر: زيادةٌ لا قيمة لها.
     • تطابق المجال — يمنع «خريج مهتم بالذكاء الاصطناعي» من تلقّي خطة جاهزية
       توظيف لا صلة لها باهتمامه.
     • تطابق المستوى — يمنع إعطاءه ما هو أكبر أو أصغر من مستواه.

   حتمي بالكامل: نفس الحقائق → نفس الترتيب. لا LLM ولا عشوائية.
   طبقةٌ مضافة: لا تلغي منافسة المسارات ولا تستبدلها — تُشخصِن داخل الفائز. */

import { courseById, catalogCourses } from '../catalog'
import { TARGET_LEVEL } from '../v2/skills'
import { pathwayDomainsV2 } from '../v2/data'
import type { CatalogCourse } from '../types'
import type { DecisionContext, DomainId, SkillState } from '../v2/types'

/** مستوى المقرر — مشتق من level_ar الحرّ إلى سلّم مرتّب */
export type CourseLevel = 'foundational' | 'foundational_applied' | 'applied' | 'practitioner'

/* نصوص المستوى في الكتالوج — أربع صيغ، منها واحدة بشرطة مختلفة (–) */
const LEVEL_FROM_AR: Record<string, CourseLevel> = {
  'تأسيسي': 'foundational',
  'تأسيسي–تطبيقي': 'foundational_applied',
  'تأسيسي-تطبيقي': 'foundational_applied',
  'تأسيسي إلى ممارس': 'foundational_applied',
  'تطبيقي': 'applied',
  'ممارس': 'practitioner',
}
const LEVEL_ORDINAL: Record<CourseLevel, number> = {
  foundational: 0,
  foundational_applied: 1,
  applied: 2,
  practitioner: 3,
}
export const LEVEL_LABEL_AR: Record<CourseLevel, string> = {
  foundational: 'تأسيسي',
  foundational_applied: 'تأسيسي إلى تطبيقي',
  applied: 'تطبيقي',
  practitioner: 'ممارس',
}

export function courseLevelOf(course: CatalogCourse): CourseLevel {
  return LEVEL_FROM_AR[(course.level_ar ?? '').trim()] ?? 'applied'
}

/* أوزان ملاءمة المقرر — حاجة المهارة أثقل لأنها الدليل المباشر الوحيد */
const CW = {
  skillNeed: 0.4,
  domain: 0.35,
  level: 0.25,
} as const

/** مهارة غير مقيسة: لا حاجة مُثبتة ولا إتقان مُثبت — منتصف صادق لا يخترع يقينا */
const UNKNOWN_NEED = 0.5

/** مرحلة المتعلم → موضعه على سلّم المستوى (نفس ترتيب LEVEL_ORDINAL) */
const STAGE_LEVEL: Record<string, number> = {
  university_student: 0,
  fresh_graduate: 0,
  other_unsure: 0,
  early_career: 1,
  experienced: 2,
  freelancer: 2,
  trainer_ld: 2,
  founder: 2,
  manager: 3,
  senior_manager: 3,
}

/** موضع المتعلم على سلّم المستوى — من المرحلة، ويعدّله الدليل المقيس صعودا فقط.
    الرفع بالدليل ولا خفض به: مديرٌ لم تُقس مهاراته يبقى في موضع مرحلته. */
export function learnerLevel(facts: DecisionContext['facts'], skillStates: Map<string, SkillState>): number {
  const stage = facts['career_stage']?.value as string | undefined
  const base = stage !== undefined ? (STAGE_LEVEL[stage] ?? 1) : 1
  const measured = [...skillStates.values()].filter((s) => s.state === 'measured' && s.level !== undefined)
  if (measured.length === 0) return base
  const avg = measured.reduce((s, m) => s + (m.level ?? 0), 0) / measured.length
  /* متوسط مقيس مرتفع (4 فأعلى من 5) يرفع درجة واحدة — دليلٌ يعلو على الافتراض */
  return avg >= TARGET_LEVEL ? Math.min(3, base + 1) : base
}

export interface CourseFit {
  courseId: string
  pathwayId: string
  title_ar: string
  sequence: number
  hours: number
  level: CourseLevel
  /** 0..1 — كم يسدّ هذا المقرر فجوة حقيقية عند المتعلم */
  skillNeed: number
  domainMatch: number
  levelMatch: number
  total: number
  /** مهارات هذا المقرر التي المتعلم دونها بدليل مقيس */
  gapSkills: string[]
  /** مهاراته التي أتقنها أصلا — كل واحدة تخفض قيمة المقرر */
  masteredSkills: string[]
  /** مهاراته غير المقيسة */
  unknownSkills: string[]
  reason_ar: string
}

/** درجات المجال مطبَّعة على أعلاها — النسبة هي المعنى لا القيمة الخام.
    مصدَّرة لأن انتقاء البديل في المحرك يقيس بها نقاء مجال الكيان. */
export function normalizedDomains(ctx: DecisionContext): Map<DomainId, number> {
  const out = new Map<DomainId, number>()
  const entries = Object.entries(ctx.domains.scores) as [DomainId, number][]
  const max = entries.reduce((m, [, v]) => Math.max(m, v), 0)
  if (max <= 0) return out
  for (const [d, v] of entries) out.set(d, Math.max(0, v) / max)
  return out
}

function domainsOfCourse(course: CatalogCourse): DomainId[] {
  return (pathwayDomainsV2[course.pathway_id] ?? []) as DomainId[]
}

/** ملاءمة مقرر واحد — على مهاراته الأربع وحدها لا على اتحاد المسار */
export function assessCourseFit(course: CatalogCourse, ctx: DecisionContext, domainScores?: Map<DomainId, number>): CourseFit {
  const scores = domainScores ?? normalizedDomains(ctx)

  const gapSkills: string[] = []
  const masteredSkills: string[] = []
  const unknownSkills: string[] = []
  let needSum = 0
  for (const slug of course.skill_slugs) {
    const st = ctx.skillStates.get(slug)
    if (st?.state === 'measured' && st.level !== undefined) {
      if (st.level >= TARGET_LEVEL) {
        masteredSkills.push(slug)
        /* أتقنها: المقرر لا يضيف له شيئا — حاجة صفر */
      } else {
        gapSkills.push(slug)
        needSum += Math.max(0, TARGET_LEVEL - st.level) / TARGET_LEVEL
      }
    } else {
      unknownSkills.push(slug)
      needSum += UNKNOWN_NEED
    }
  }
  const skillNeed = course.skill_slugs.length === 0 ? UNKNOWN_NEED : needSum / course.skill_slugs.length

  const ds = domainsOfCourse(course)
  const domainMatch = ds.length === 0 ? 0 : Math.max(...ds.map((d) => scores.get(d) ?? 0))

  const level = courseLevelOf(course)
  const distance = Math.abs(LEVEL_ORDINAL[level] - learnerLevel(ctx.facts, ctx.skillStates))
  /* المسافة القصوى على السلّم ثلاث درجات — تطابق تام عند صفر، وانعدام عند ثلاث */
  const levelMatch = Math.max(0, 1 - distance / 3)

  const total = CW.skillNeed * skillNeed + CW.domain * domainMatch + CW.level * levelMatch

  const bits: string[] = []
  if (gapSkills.length > 0) bits.push(`يسدّ ${gapSkills.length} فجوة مقيسة`)
  if (masteredSkills.length > 0) bits.push(`${masteredSkills.length} من مهاراته أتقنتها أصلا`)
  if (domainMatch >= 0.8) bits.push('في صميم مجالك')
  else if (domainMatch <= 0.2) bits.push('خارج مجالك الأقرب')
  if (levelMatch >= 0.9) bits.push('بمستواك')
  else if (LEVEL_ORDINAL[level] > learnerLevel(ctx.facts, ctx.skillStates)) bits.push('فوق مستواك الحالي')
  else if (LEVEL_ORDINAL[level] < learnerLevel(ctx.facts, ctx.skillStates)) bits.push('دون مستواك الحالي')

  return {
    courseId: course.course_id,
    pathwayId: course.pathway_id,
    title_ar: course.title_ar,
    sequence: course.sequence,
    hours: course.total_hours,
    level,
    skillNeed,
    domainMatch,
    levelMatch,
    total,
    gapSkills,
    masteredSkills,
    unknownSkills,
    reason_ar: bits.join(' · ') || 'ملاءمة متوسطة بلا إشارة قوية',
  }
}

/** ملاءمة مسار محسوبة من مقرراته لا من اتحاد مهاراته */
export interface PathwayCourseFit {
  pathwayId: string
  courses: CourseFit[]
  /** متوسط ملاءمة المقررات — قلب التقييم الجديد */
  meanFit: number
  /** أضعف مقرر — مرشح الاستبدال */
  weakest: CourseFit | null
  totalHours: number
}

export function assessPathwayByCourses(pathwayId: string, ctx: DecisionContext, domainScores?: Map<DomainId, number>): PathwayCourseFit {
  const scores = domainScores ?? normalizedDomains(ctx)
  const courses = catalogCourses
    .filter((c) => c.pathway_id === pathwayId)
    .map((c) => assessCourseFit(c, ctx, scores))
    .sort((a, b) => a.sequence - b.sequence)
  const meanFit = courses.length === 0 ? 0 : courses.reduce((s, c) => s + c.total, 0) / courses.length
  const weakest = courses.length === 0 ? null : courses.reduce((w, c) => (c.total < w.total ? c : w), courses[0])
  return {
    pathwayId,
    courses,
    meanFit,
    weakest,
    totalHours: courses.reduce((s, c) => s + c.hours, 0),
  }
}

/* ─── الاستبدال المشخصَن ─── */

/** أقصى استبدال في خطة من خمسة — ثلاثة فأكثر يمحو هوية المسار وشهادته */
export const MAX_SUBSTITUTIONS = 2
/** أدنى مكسب يبرّر الاستبدال — دونه تغييرٌ بلا فرق محسوس */
export const MIN_SUBSTITUTION_GAIN = 0.08
/** أدنى ملاءمة يجب أن يبلغها البديل — لا نستبدل ضعيفا بضعيف */
export const MIN_REPLACEMENT_FIT = 0.5

/** المقرر الختامي (أعلى sequence) لا يُستبدل: هو المشروع الذي تُبنى عليه الشهادة،
    واستبداله يغيّر ما يشهد به المسار لا ترتيب مقرراته. التشخيص يشخصن الطريق
    ولا يمسّ ما يُشهد به في نهايته. */
function isCapstone(c: CourseFit, plan: PathwayCourseFit): boolean {
  const maxSeq = plan.courses.reduce((m, x) => Math.max(m, x.sequence), 0)
  return c.sequence === maxSeq
}

export interface Substitution {
  replaced: CourseFit
  replacement: CourseFit
  /** لماذا هذا البديل قريب وليس عشوائيا */
  affinity_ar: string
  gain: number
}

/** هل البديل قريب فعلا؟ قرابةٌ مُثبتة: مهارة مشتركة أو نفس مجال المتعلم الأول.
    بلا هذا الشرط يصير الاستبدال عشوائيا — وهو أسوأ من عدمه. */
function affinityOf(from: CourseFit, to: CatalogCourse, topDomain: DomainId | null): string | null {
  const fromCourse = courseById.get(from.courseId)
  if (!fromCourse) return null
  const shared = to.skill_slugs.filter((s) => fromCourse.skill_slugs.includes(s))
  if (shared.length > 0) return `يشترك معه في ${shared.length} مهارة`
  const ds = domainsOfCourse(to)
  if (topDomain && ds.includes(topDomain)) return 'في مجالك الأول'
  return null
}

/** بدائل مقترحة لخطة مسار — مقيّدة بالقرابة والمكسب والعدد */
export function substitutionsFor(plan: PathwayCourseFit, ctx: DecisionContext, domainScores?: Map<DomainId, number>): Substitution[] {
  const scores = domainScores ?? normalizedDomains(ctx)
  const topDomain = ctx.domains.top
  const inPlan = new Set(plan.courses.map((c) => c.courseId))
  /* الأضعف أولا — الاستبدال يبدأ من حيث الألم أشد */
  const ordered = [...plan.courses].sort((a, b) => a.total - b.total)
  const out: Substitution[] = []
  const claimed = new Set<string>()

  for (const weak of ordered) {
    if (out.length >= MAX_SUBSTITUTIONS) break
    if (isCapstone(weak, plan)) continue
    let best: { fit: CourseFit; affinity: string } | null = null
    for (const cand of catalogCourses) {
      if (inPlan.has(cand.course_id) || claimed.has(cand.course_id)) continue
      const affinity = affinityOf(weak, cand, topDomain)
      if (!affinity) continue
      const fit = assessCourseFit(cand, ctx, scores)
      if (fit.total < MIN_REPLACEMENT_FIT) continue
      if (fit.total - weak.total < MIN_SUBSTITUTION_GAIN) continue
      if (best === null || fit.total > best.fit.total) best = { fit, affinity }
    }
    if (best) {
      claimed.add(best.fit.courseId)
      out.push({ replaced: weak, replacement: best.fit, affinity_ar: best.affinity, gain: best.fit.total - weak.total })
    }
  }
  return out
}

/** الخطة النهائية بعد التشخيص: مقررات المسار مع ما استُبدل منها */
export interface PersonalPlan {
  pathwayId: string
  courses: CourseFit[]
  substitutions: Substitution[]
  meanFit: number
  totalHours: number
  personalized: boolean
}

export function personalizePlan(pathwayId: string, ctx: DecisionContext): PersonalPlan {
  const scores = normalizedDomains(ctx)
  const base = assessPathwayByCourses(pathwayId, ctx, scores)
  const subs = substitutionsFor(base, ctx, scores)
  const swapped = new Map(subs.map((s) => [s.replaced.courseId, s.replacement]))
  const courses = base.courses.map((c) => swapped.get(c.courseId) ?? c)
  const meanFit = courses.length === 0 ? 0 : courses.reduce((s, c) => s + c.total, 0) / courses.length
  return {
    pathwayId,
    courses,
    substitutions: subs,
    meanFit,
    totalHours: courses.reduce((s, c) => s + c.hours, 0),
    personalized: subs.length > 0,
  }
}

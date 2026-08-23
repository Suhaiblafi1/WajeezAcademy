/* تركيب المسار من المقررات — V2.1

   قلبُ المعمار: الفجوة تقود إلى **مقرر**، والمقررات المختارة تُركَّب مسارا.
   لا العكس. كان الترتيب: اختر مسارا ثم شخصن مقرراته — فالمتعلم يأخذ خطةً
   صُمّمت لغيره ثم تُعدَّل له. وهنا: قِس مهاراته، رتّب المقررات المئة كلها
   بما تسدّه من فجواته، ثم ابنِ منها خطة متماسكة.

   والتماسك شرطٌ لا زينة: خمسة مقررات من خمسة مجالات ليست مسارا بل سلة.
   لذلك يقود الاختيارَ **مجال مرساة** (أعلى مجالات المتعلم)، ولا يدخل مقرر
   من خارجه إلا إذا سدّ فجوة كبيرة، وبحدٍّ أقصى معلن.

   حتمي بالكامل: نفس الحقائق → نفس الخطة. */

import { catalogCourses, courseById } from '../catalog'
import { pathwayDomainsV2 } from '../v2/data'
import { TARGET_LEVEL } from '../v2/skills'
import type { DecisionContext, DomainId } from '../v2/types'
import { assessCourseFit, courseLevelOf, normalizedDomains, type CourseFit } from './course-fit'
import { resolveSkillLevels, type ResolvedSkill } from './skill-families'

/** حجم الخطة — نفس حجم مسارات الكتالوج كي تبقى الشهادة والوعد متسقين */
export const COMPOSED_MIN_COURSES = 5
export const COMPOSED_MAX_COURSES = 6
/** أقصى ما يُقبل من خارج مجال المرساة — فوقه تفقد الخطة هويتها */
export const MAX_OFF_ANCHOR = 2
/** فجوة تُبرّر الخروج عن المرساة: المهارة دون هذا المستوى بدليل */
const STRONG_GAP_LEVEL = 2

export interface ComposedCourse extends CourseFit {
  /** المهارات التي يسدّها هذا المقرر من فجوات المتعلم المعروفة */
  closesGaps: string[]
  /** داخل مجال المرساة أم خارجه */
  onAnchor: boolean
  why_ar: string
}

export interface ComposedPath {
  anchorDomain: DomainId | null
  courses: ComposedCourse[]
  totalHours: number
  /** متوسط ملاءمة المقررات المختارة */
  meanFit: number
  /** فجوات المتعلم التي غطّتها الخطة، والتي بقيت بلا تغطية */
  coveredGaps: string[]
  uncoveredGaps: string[]
  /** المسار الأقرب في الكتالوج إن كانت الخطة تطابقه فعليا */
  matchesPathwayId: string | null
  reasons_ar: string[]
}

function domainsOfCourse(courseId: string): DomainId[] {
  const c = courseById.get(courseId)
  return c ? ((pathwayDomainsV2[c.pathway_id] ?? []) as DomainId[]) : []
}

/** فجوات المتعلم: كل مهارة حُلّ مستواها ووقع دون الهدف — مقيسة كانت أو مستدَلة */
export function learnerGaps(resolved: Map<string, ResolvedSkill>): Map<string, number> {
  const gaps = new Map<string, number>()
  for (const r of resolved.values()) {
    if (r.level === null) continue
    if (r.level < TARGET_LEVEL) gaps.set(r.slug, (TARGET_LEVEL - r.level) / TARGET_LEVEL)
  }
  return gaps
}

/** يركّب خطة من المقررات المئة كلها بناء على فجوات المتعلم */
export function composePath(ctx: DecisionContext, familyRatings: Record<string, number> = {}): ComposedPath {
  const domainScores = normalizedDomains(ctx)
  const anchor = ctx.domains.top
  const allSlugs = [...new Set(catalogCourses.flatMap((c) => c.skill_slugs))]
  const resolved = resolveSkillLevels(allSlugs, ctx.skillStates, familyRatings)
  const gaps = learnerGaps(resolved)

  /* قيمة المقرر = ملاءمته (مهارة/مجال/مستوى) + ما يسدّه من فجوات معروفة */
  const scored = catalogCourses.map((c) => {
    const fit = assessCourseFit(c, ctx, domainScores)
    const closes = c.skill_slugs.filter((s) => gaps.has(s))
    const gapValue = closes.reduce((sum, s) => sum + (gaps.get(s) ?? 0), 0) / Math.max(1, c.skill_slugs.length)
    const ds = domainsOfCourse(c.course_id)
    const onAnchor = anchor !== null && ds.includes(anchor)
    return { c, fit, closes, gapValue, onAnchor, score: fit.total + gapValue }
  })

  scored.sort((a, b) => b.score - a.score || a.c.course_id.localeCompare(b.c.course_id))

  const picked: typeof scored = []
  const usedSkills = new Set<string>()
  let offAnchor = 0
  for (const cand of scored) {
    if (picked.length >= COMPOSED_MAX_COURSES) break
    if (!cand.onAnchor) {
      if (offAnchor >= MAX_OFF_ANCHOR) continue
      /* الخروج عن المرساة يحتاج مبررا: فجوة قوية بدليل لا مجرد ملاءمة */
      const strong = cand.closes.some((s) => {
        const r = resolved.get(s)
        return r?.level !== null && r?.level !== undefined && r.level <= STRONG_GAP_LEVEL
      })
      if (!strong) continue
    }
    /* لا تكرار: مقرر كل مهاراته مغطاة بما اخترناه لا يضيف */
    const fresh = cand.c.skill_slugs.filter((s) => !usedSkills.has(s))
    if (picked.length > 0 && fresh.length === 0) continue
    picked.push(cand)
    cand.c.skill_slugs.forEach((s) => usedSkills.add(s))
    if (!cand.onAnchor) offAnchor++
  }

  /* ترتيب التقديم: التأسيسي قبل التطبيقي قبل الممارس، ثم تسلسل مقرره الأصلي */
  const ORD: Record<string, number> = { foundational: 0, foundational_applied: 1, applied: 2, practitioner: 3 }
  picked.sort((a, b) => ORD[courseLevelOf(a.c)] - ORD[courseLevelOf(b.c)] || a.c.sequence - b.c.sequence)

  const courses: ComposedCourse[] = picked.map((p) => {
    const bits: string[] = []
    if (p.closes.length > 0) bits.push(`يسدّ ${p.closes.length} من فجواتك`)
    if (p.onAnchor) bits.push('في صميم مجالك')
    else bits.push('خارج مجالك الأول — أُدرج لفجوة قوية')
    return { ...p.fit, closesGaps: p.closes, onAnchor: p.onAnchor, why_ar: bits.join(' · ') }
  })

  const covered = [...new Set(courses.flatMap((c) => c.closesGaps))].sort()
  const uncovered = [...gaps.keys()].filter((s) => !covered.includes(s)).sort()

  /* هل الخطة تطابق مسارا قائما؟ حينها نسمّيه بدل ادّعاء تركيب جديد */
  const byPathway = new Map<string, number>()
  for (const c of courses) byPathway.set(c.pathwayId, (byPathway.get(c.pathwayId) ?? 0) + 1)
  let matches: string | null = null
  for (const [pid, n] of byPathway) {
    if (n === courses.length && courses.length >= COMPOSED_MIN_COURSES) matches = pid
  }

  const reasons: string[] = []
  if (anchor) reasons.push(`مجالك الأول هو مرساة الخطة، و${courses.filter((c) => c.onAnchor).length} من مقرراتها فيه.`)
  if (covered.length > 0) reasons.push(`تغطي ${covered.length} من فجوات مهاراتك المعروفة.`)
  if (uncovered.length > 0) reasons.push(`وتبقى ${uncovered.length} فجوة خارج هذه الخطة — تُعالج لاحقا أو مع مستشار.`)
  if (matches) reasons.push('وهذه المقررات تطابق مسارا قائما في الكتالوج، فتأخذ شهادته كاملة.')

  return {
    anchorDomain: anchor,
    courses,
    totalHours: courses.reduce((s, c) => s + c.hours, 0),
    meanFit: courses.length === 0 ? 0 : courses.reduce((s, c) => s + c.total, 0) / courses.length,
    coveredGaps: covered,
    uncoveredGaps: uncovered,
    matchesPathwayId: matches,
    reasons_ar: reasons,
  }
}

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
import { GOALS_V21, NEEDS_V21 } from './maps'
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
/* أقل ما تحمله الخطة من مقررات في مجال الهدف المعلن نفسه.

   العلّة التي يعالجها: الترتيب كان بـ(ملاءمة + قيمة الفجوة) وحده، والفجوة
   المقيسة تُثقل بقوة. فمن هدفه «أول وظيفة» وقِيست له فجوةٌ حادّة في مهارة
   جانبية، تصعد مقررات تلك المهارة وتُزيح مقرر البحث عن وظيفة نفسه — أي أن
   الخطة تعالج نقصا وتُسقط الهدف. والفجوة خادمة للهدف لا بديلة عنه.

   اثنان لا واحد: مقرر واحد لا يبني هدفا، وثلاثة تجعل الفجوات بلا مكان في خطة
   من خمسة. */
const MIN_GOAL_DOMAIN_COURSES = 2

/** مجالات الهدف المعلن — لا المرساة المشتقّة من كل الإشارات.

   والاحتياج لا يُضمّ إلى الهدف إلا حين لا مجال للهدف أصلا (مثل «تطوير مهارة
   محددة» — هدفٌ بلا مجال). وضمُّهما معا يُبطل الحماية من حيث أراد حفظها:
   قِيس على 380 تركيبة (هدف × احتياج × مرحلة) فوُجد أن «أول وظيفة + احتياج
   قيادي» يُخرج مقررات الجاهزية للتوظيف كلها — لأن مقاعد الحجز تملؤها مقررات
   الاحتياج القيادي وهي «في المجال» بحساب الاتحاد. الهدف هو المحمي. */
function declaredGoalDomains(facts: DecisionContext['facts']): DomainId[] {
  const goal = facts['primary_goal']?.value
  if (typeof goal === 'string') {
    const gd = GOALS_V21.find((g) => g.code === goal)?.domains ?? []
    if (gd.length > 0) return [...gd]
  }
  const need = facts['need_id']?.value
  if (typeof need === 'string') return [...(NEEDS_V21.find((n) => n.code === need)?.domains ?? [])]
  return []
}

/** دور المقرر في الخطة — يُعرض للمتعلم كي يعرف لماذا هو هنا */
export type ComposedRole =
  /** في مجال هدفه المعلن — يحقّق الهدف نفسه */
  | 'goal'
  /** أُدرج لأنه يسدّ فجوة مقيسة */
  | 'gap'
  /** يدعم الخطة بلا فجوة مقيسة ولا مجال هدف */
  | 'support'

export interface ComposedCourse extends CourseFit {
  /** المهارات التي يسدّها هذا المقرر من فجوات المتعلم المعروفة */
  closesGaps: string[]
  /** داخل مجال المرساة أم خارجه */
  onAnchor: boolean
  /** داخل مجال الهدف أو الاحتياج المعلن */
  onGoal: boolean
  role: ComposedRole
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
  /* مقررات كانت التالية في الترتيب ولم يتّسع لها حجم الخطة. تُعرض «لمرحلة
     لاحقة» بدل أن تختفي: المتعلم يرى ما لم يدخل خطته ولماذا، فلا يظن أن ما
     عُرض عليه هو كل ما يخصه. */
  deferred: ComposedCourse[]
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
  const goalDomains = declaredGoalDomains(ctx.facts)
  const scored = catalogCourses.map((c) => {
    const fit = assessCourseFit(c, ctx, domainScores)
    const closes = c.skill_slugs.filter((s) => gaps.has(s))
    const gapValue = closes.reduce((sum, s) => sum + (gaps.get(s) ?? 0), 0) / Math.max(1, c.skill_slugs.length)
    const ds = domainsOfCourse(c.course_id)
    const onAnchor = anchor !== null && ds.includes(anchor)
    const onGoal = ds.some((d) => goalDomains.includes(d))
    return { c, fit, closes, gapValue, onAnchor, onGoal, score: fit.total + gapValue }
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

  /* حجز مقعدَين لمجال الهدف المعلن.

     الترتيب أعلاه بـ(ملاءمة + قيمة فجوة)، والفجوة المقيسة تُثقل بقوة — فمن
     هدفه «أول وظيفة» وقِيست له فجوة حادّة في مهارة جانبية تصعد مقررات تلك
     المهارة وتُزيح مقرر البحث عن وظيفة نفسه. أي أن الخطة تعالج نقصا وتُسقط
     الهدف، والفجوة خادمةٌ للهدف لا بديلة عنه.

     فيُستبدل أضعفُ المقررات خارج مجال الهدف بأقوى مرشح داخله — ولا يُمسّ ما
     كان داخله أصلا، ولا يُدخَل مرشح لا يضيف مهارة جديدة. وحين لا مجال هدف
     معلن (لم يُسأل بعد أو «أستكشف») لا حجز: لا نحمي هدفا لا نعرفه. */
  if (goalDomains.length > 0 && picked.length > 0) {
    const usedIds = new Set(picked.map((p) => p.c.course_id))
    const goalPool = scored.filter((c) => c.onGoal && !usedIds.has(c.c.course_id))
    let need = MIN_GOAL_DOMAIN_COURSES - picked.filter((p) => p.onGoal).length
    while (need > 0 && goalPool.length > 0) {
      /* الأضعف خارج مجال الهدف هو الذي يخرج — ولو لم يوجد فالخطة كلها في
         مجال الهدف أصلا ولا شيء يُستبدل. */
      let weakestIdx = -1
      for (let i = 0; i < picked.length; i++) {
        if (picked[i].onGoal) continue
        if (weakestIdx === -1 || picked[i].score < picked[weakestIdx].score) weakestIdx = i
      }
      if (weakestIdx === -1) break
      const covered = new Set(picked.flatMap((p, i) => (i === weakestIdx ? [] : p.c.skill_slugs)))
      const idx = goalPool.findIndex((cand) => cand.c.skill_slugs.some((sl) => !covered.has(sl)))
      if (idx === -1) break
      picked[weakestIdx] = goalPool.splice(idx, 1)[0]
      need--
    }
  }

  /* ترتيب التقديم: التأسيسي قبل التطبيقي قبل الممارس، ثم تسلسل مقرره الأصلي */
  const ORD: Record<string, number> = { foundational: 0, foundational_applied: 1, applied: 2, practitioner: 3 }
  picked.sort((a, b) => ORD[courseLevelOf(a.c)] - ORD[courseLevelOf(b.c)] || a.c.sequence - b.c.sequence)

  /* الدور يُشتقّ مرة واحدة ويُعرض: المتعلم يسأل عن كل مقرر «لماذا هذا؟»،
     والجواب أحد ثلاثة لا خليط: هدفُك، أو فجوةٌ قِسناها، أو دعمٌ للخطة. */
  const toComposed = (p: (typeof scored)[number]): ComposedCourse => {
    const role: ComposedRole = p.onGoal ? 'goal' : p.closes.length > 0 ? 'gap' : 'support'
    const bits: string[] = []
    if (role === 'goal') bits.push('في صميم هدفك المعلن')
    if (p.closes.length > 0) bits.push(`يسدّ ${p.closes.length} من فجواتك`)
    if (role !== 'goal') bits.push(p.onAnchor ? 'في مجالك الأول' : 'خارج مجالك الأول — أُدرج لفجوة قوية')
    return { ...p.fit, closesGaps: p.closes, onAnchor: p.onAnchor, onGoal: p.onGoal, role, why_ar: bits.join(' · ') }
  }
  const courses: ComposedCourse[] = picked.map(toComposed)
  /* المؤجَّل: التاليان في الترتيب مما لم يتّسع له الحجم، ويضيفان مهارة جديدة.
     يُعرضان «لمرحلة لاحقة» لا يختفيان — فلا يظن المتعلم أن ما رآه كل ما يخصه. */
  const inPlan = new Set(picked.map((p) => p.c.course_id))
  const planSkills = new Set(picked.flatMap((p) => p.c.skill_slugs))
  const deferred: ComposedCourse[] = scored
    .filter((c) => !inPlan.has(c.c.course_id) && c.c.skill_slugs.some((sl) => !planSkills.has(sl)))
    .filter((c) => c.onAnchor || c.onGoal || c.closes.length > 0)
    .slice(0, 2)
    .map(toComposed)

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
    deferred,
    reasons_ar: reasons,
  }
}

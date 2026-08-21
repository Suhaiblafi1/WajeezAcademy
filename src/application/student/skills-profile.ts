/* ملف المهارات للمتعلم (البند ط-١) — اشتقاق نقي من متجه القياس ومتطلبات المسار.
   لا يخترع شيئا: ما لم يُقس يبقى «غير مقاس» في مجموعة منفصلة، ولا يُرسم مستوى صفرا.
   المصدر الوحيد للحقيقة هو محرك التشخيص — نستدعي assessPathwaySkills نفسها التي
   يستدعيها المحرك، فلا يتباعد ما يراه المتعلم عما احتُسب في الترشيح. */

import { assessPathwaySkills, buildSkillStates } from '../../domain/diagnostic/v2'
import { TARGET_LEVEL } from '../../domain/diagnostic/v2/skills'
import { catalogCourses, launchPathways, skillsCatalog } from '../../domain/diagnostic/catalog'

/** سلّم الإجابة خمس درجات (answer_type: skill_level_5) — لا صفر ولا كسور */
export const LEVEL_MAX = 5
export const LEVEL_LABELS_AR = ['لا يعرفها', 'مبتدئ', 'يستخدمها أحيانا', 'جيد عمليا', 'متقدم'] as const

export function levelLabelAr(level: number): string {
  return LEVEL_LABELS_AR[Math.min(LEVEL_MAX - 1, Math.max(0, level - 1))]
}

/** ثلاث حالات مرتّبة: فجوة (١-٢) · في الطريق (٣) · متقنة (٤-٥) — الحدّ نفسه المستعمل في المحرك */
export type SkillBand = 'gap' | 'on_track' | 'mastered'

export function bandOf(level: number): SkillBand {
  if (level < 3) return 'gap'
  if (level < TARGET_LEVEL) return 'on_track'
  return 'mastered'
}

export interface CoveringCourse {
  id: string
  titleAr: string
  sequence: number
}

export interface SkillGrowthBadge {
  /** المستوى قبل الدورة كما كان مقيسا — null إن لم يكن مقيسا قبلها */
  beforeLevel: number | null
  /** الفرق — null بلا قياس قبليّ */
  delta: number | null
  courseTitleAr: string | null
}

export interface MeasuredSkill {
  slug: string
  nameAr: string
  level: number
  band: SkillBand
  /** كم درجة تفصله عن المستهدف — صفر لمن بلغه */
  toTarget: number
  coveredBy: CoveringCourse[]
  /** أثر قياس بعديّ بعد إتمام دورة (ح-٧) — غائب لمن لم يُعد قياسه */
  growth?: SkillGrowthBadge
}

export interface UnmeasuredSkill {
  slug: string
  nameAr: string
  coveredBy: CoveringCourse[]
}

export interface SkillsProfile {
  /** لا بيانات = لا تشخيص مرفق أو تشخيص بلا قياس مهارات */
  hasData: boolean
  pathwayId: string | null
  pathwayTitleAr: string | null
  /** كل ما قِيس فعلا — حتى ما هو خارج متطلبات المسار */
  measuredCount: number
  /** متطلبات المسار النشطة تشخيصيا */
  requiredCount: number
  /** المقاس من المتطلبات ÷ المتطلبات — null بلا مسار (لا نصطنع بسطا ولا مقاما) */
  coverage: number | null
  gap: MeasuredSkill[]
  onTrack: MeasuredSkill[]
  mastered: MeasuredSkill[]
  unmeasured: UnmeasuredSkill[]
  /** مقاسة لكنها ليست من متطلبات هذا المسار — رصيد لا يُهمَل ولا يُحسب في التغطية */
  outsidePathway: MeasuredSkill[]
}

const EMPTY: SkillsProfile = {
  hasData: false,
  pathwayId: null,
  pathwayTitleAr: null,
  measuredCount: 0,
  requiredCount: 0,
  coverage: null,
  gap: [],
  onTrack: [],
  mastered: [],
  unmeasured: [],
  outsidePathway: [],
}

/** اسم المهارة: من كتالوج المهارات أولا، ثم من أسماء دورات المسار، ثم الشريحة مقروءة */
function nameOf(slug: string, fromPathway: Map<string, string>): string {
  const entry = skillsCatalog.find((s) => s.slug === slug)
  if (entry?.name_ar) return entry.name_ar
  const viaPathway = fromPathway.get(slug)
  if (viaPathway) return viaPathway
  return slug.replace(/_/g, ' ')
}

/** دورات المسار التي تُدرّس هذه المهارة — مرتّبة بتسلسل المسار حتى يُقرأ «أيها أولا» */
function coveringCourses(slug: string, courseIds: string[]): CoveringCourse[] {
  const out: CoveringCourse[] = []
  for (const cid of courseIds) {
    const c = catalogCourses.find((x) => x.course_id === cid)
    if (!c) continue
    if (c.skill_slugs.includes(slug)) out.push({ id: c.course_id, titleAr: c.title_ar, sequence: c.sequence })
  }
  return out.sort((a, b) => a.sequence - b.sequence)
}

/** الأشد فجوة أولا؛ وعند التساوي الأكثر تغطية بدورات المسار (أقرب للتنفيذ) */
function byUrgency(a: MeasuredSkill, b: MeasuredSkill): number {
  if (a.level !== b.level) return a.level - b.level
  if (a.coveredBy.length !== b.coveredBy.length) return b.coveredBy.length - a.coveredBy.length
  return a.nameAr.localeCompare(b.nameAr, 'ar')
}

/**
 * يبني ملف المهارات من متجه القياس ومسار التوصية.
 * @param skillVector ما قِيس فعلا — المفتاح شريحة المهارة والقيمة ١..٥
 * @param pathwayId مسار التوصية أو التسجيل — بدونه لا تُحسب تغطية ولا فجوات مسار
 * @param growth شارات القياس البعديّ بالشريحة (ح-٧) — اختيارية، ولا تغيّر تصنيفا ولا تغطية
 */
export function buildSkillsProfile(
  skillVector: Record<string, number>,
  pathwayId: string | null,
  growth?: Map<string, SkillGrowthBadge>,
): SkillsProfile {
  const measuredEntries = Object.entries(skillVector).filter(([, level]) => Number.isFinite(level) && level >= 1)
  if (measuredEntries.length === 0 && !pathwayId) return EMPTY

  const pathway = pathwayId ? (launchPathways.find((p) => p.id === pathwayId) ?? null) : null
  const courseIds = pathway?.course_ids ?? []
  const skillStates = buildSkillStates(Object.fromEntries(measuredEntries))
  const assessment = pathway ? assessPathwaySkills(pathway.id, skillStates) : null
  const namesFromPathway = new Map<string, string>((assessment?.required ?? []).map((s) => [s.slug, s.nameAr]))
  const requiredSlugs = new Set((assessment?.required ?? []).map((s) => s.slug))

  const toRow = (slug: string, level: number): MeasuredSkill => {
    const row: MeasuredSkill = {
      slug,
      nameAr: nameOf(slug, namesFromPathway),
      level,
      band: bandOf(level),
      toTarget: Math.max(0, TARGET_LEVEL - level),
      coveredBy: coveringCourses(slug, courseIds),
    }
    /* الشارة تُضاف ولا تُصطنع: ما لم يُعد قياسه يبقى بلا حقل growth أصلا */
    const badge = growth?.get(slug)
    if (badge) row.growth = badge
    return row
  }

  const gap: MeasuredSkill[] = []
  const onTrack: MeasuredSkill[] = []
  const mastered: MeasuredSkill[] = []
  const outsidePathway: MeasuredSkill[] = []

  for (const [slug, level] of measuredEntries) {
    const row = toRow(slug, level)
    /* بلا مسار: كل ما قِيس يُصنَّف بحالته — التصنيف خاصية المستوى لا خاصية المسار */
    if (pathway && !requiredSlugs.has(slug)) {
      outsidePathway.push(row)
      continue
    }
    if (row.band === 'gap') gap.push(row)
    else if (row.band === 'on_track') onTrack.push(row)
    else mastered.push(row)
  }

  const unmeasured: UnmeasuredSkill[] = (assessment?.unknown ?? []).map((s) => ({
    slug: s.slug,
    nameAr: nameOf(s.slug, namesFromPathway),
    coveredBy: coveringCourses(s.slug, courseIds),
  }))

  return {
    hasData: measuredEntries.length > 0,
    pathwayId: pathway?.id ?? null,
    pathwayTitleAr: pathway?.title ?? null,
    measuredCount: measuredEntries.length,
    requiredCount: assessment?.required.length ?? 0,
    coverage: assessment ? assessment.measuredCoverage : null,
    gap: gap.sort(byUrgency),
    onTrack: onTrack.sort(byUrgency),
    mastered: mastered.sort(byUrgency),
    unmeasured: unmeasured.sort((a, b) => b.coveredBy.length - a.coveredBy.length),
    outsidePathway: outsidePathway.sort(byUrgency),
  }
}

/** يستخرج متجه القياس من لقطة نتيجة محفوظة (محليا أو مرفقة بالحساب) — بلا افتراضات على الشكل */
export function skillVectorFromSnapshot(snapshot: unknown): Record<string, number> {
  if (!snapshot || typeof snapshot !== 'object') return {}
  const rj = (snapshot as { resultJson?: unknown }).resultJson
  const bag = rj && typeof rj === 'object' ? (rj as Record<string, unknown>) : (snapshot as Record<string, unknown>)
  const raw = bag['skill_vector']
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [slug, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 1) out[slug] = Math.min(LEVEL_MAX, Math.round(value))
  }
  return out
}

/** معرّف المسار من لقطة — top.id للنتيجة الكاملة، وpathwayId للقطة الخادم المختصرة */
export function pathwayIdFromSnapshot(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const s = snapshot as Record<string, unknown>
  const top = s['top']
  if (top && typeof top === 'object' && typeof (top as { id?: unknown }).id === 'string') return (top as { id: string }).id
  if (typeof s['pathwayId'] === 'string') return s['pathwayId'] as string
  const rj = s['resultJson']
  if (rj && typeof rj === 'object') {
    const inner = (rj as Record<string, unknown>)['pathway_id']
    if (typeof inner === 'string') return inner
  }
  return null
}

/* عائلات المهارات — قياس كل مهارة بلا سؤال لكل مهارة (V2.1)

   المشكلة: مقررات الكتالوج تغطي 225 مهارة، وبنك الأسئلة يقيس 13 منها
   مباشرة (4.9٪). فوزن فجوة المهارة — أثقل أوزان الملاءمة (0.25) — خامل
   في أغلب الجلسات، وجولة التأكيد لا تجد سؤال مهارة تطرحه.
   وسؤالٌ لكل مهارة مستحيل: 225 سؤالا ليست تشخيصا بل استجوابا.

   المخرج: المهارات مجمّعة أصلا في **عائلات** (family_id في الكتالوج).
   24 عائلة تغطي الـ225، ووسيط المسار الواحد 5 عائلات فقط. فتقييمٌ واحد
   لكل عائلة يمنح كل مهاراتها مستوى.

   والعقيدة تبقى: «المقاس فقط، والمجهول مجهول». لذلك المستوى المستدَل
   **يُوسَم مستدَلا لا مقيسا** (provenance)، والقياس المباشر يعلو عليه
   دائما، ومن يقرأ الأرقام يعرف أيّها دليل وأيّها ترجيح.

   حتمي بالكامل: لا LLM ولا عشوائية. */

import { catalogCourses, launchPathways, skillsCatalog } from '../catalog'
import type { SkillState } from '../v2/types'

/** من أين جاء مستوى المهارة — الفرق بين دليل وترجيح لا يُطمس */
export type SkillProvenance = 'measured' | 'inferred' | 'unknown'

export interface ResolvedSkill {
  slug: string
  level: number | null
  provenance: SkillProvenance
  /** العائلة التي استُدل منها — فارغة للمقاس مباشرة */
  viaFamily?: string
}

interface FamilyIndex {
  /** slug المهارة → معرّف عائلتها */
  familyOf: Map<string, string>
  /** عائلة → مهاراتها التي تظهر في مقررات فعلية */
  skillsOf: Map<string, string[]>
  /** عائلة → المقررات التي تلمسها */
  coursesOf: Map<string, Set<string>>
  /** عائلة → اسمها العربي إن وُجد */
  labelOf: Map<string, string>
}

let cache: FamilyIndex | null = null

/** يُبطل الفهرس عند تركيب لقطة جديدة — نفس علّة resetUniverseCache الموثقة */
export function resetFamilyIndex(): void {
  cache = null
}

export function familyIndex(): FamilyIndex {
  if (cache) return cache
  const familyOf = new Map<string, string>()
  const labelOf = new Map<string, string>()
  for (const s of skillsCatalog) {
    if (!s.family_id) continue
    familyOf.set(s.slug, s.family_id)
    const label = (s as { family_ar?: string }).family_ar
    if (label && !labelOf.has(s.family_id)) labelOf.set(s.family_id, label)
  }
  const skillsOf = new Map<string, string[]>()
  const coursesOf = new Map<string, Set<string>>()
  for (const c of catalogCourses) {
    for (const slug of c.skill_slugs) {
      const fam = familyOf.get(slug)
      if (!fam) continue
      const list = skillsOf.get(fam)
      if (list) { if (!list.includes(slug)) list.push(slug) } else skillsOf.set(fam, [slug])
      const set = coursesOf.get(fam)
      if (set) set.add(c.course_id)
      else coursesOf.set(fam, new Set([c.course_id]))
    }
  }
  for (const list of skillsOf.values()) list.sort()

  /* عائلات الامتدادات (SCM · PRD · NEG …) بلا family_ar في الكتالوج — تسميتها
     قرار أكاديمي للمالك. وحتى يُحسم لا نعرض على المتعلم رمزا (NEG)، بل نشتقّ
     الاسم من عنوان المسار الأغلب في العائلة: نصٌّ معتمد من المالك أصلا لا
     تأليف. ويُبلَّغ النقص في التدقيق فلا يُنسى. */
  const titleOf = new Map(launchPathways.map((p) => [p.id, p.short_title ?? p.title]))
  for (const [fam, courseIds] of coursesOf) {
    if (labelOf.has(fam)) continue
    const tally = new Map<string, number>()
    for (const cid of courseIds) {
      const pid = catalogCourses.find((c) => c.course_id === cid)?.pathway_id
      if (pid) tally.set(pid, (tally.get(pid) ?? 0) + 1)
    }
    const dominant = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
    const derived = dominant ? titleOf.get(dominant[0]) : undefined
    if (derived) labelOf.set(fam, derived)
  }

  cache = { familyOf, skillsOf, coursesOf, labelOf }
  return cache
}

/** عائلات بلا اسم عربي معتمد — اسمها الظاهر مشتقٌّ من عنوان مسارها.
    تُعرض في التدقيق كي تُسمّى أكاديميا ولا تبقى مشتقّة إلى الأبد. */
export function familiesWithDerivedLabel(): string[] {
  const named = new Set<string>()
  for (const s of skillsCatalog) {
    const label = (s as { family_ar?: string }).family_ar
    if (s.family_id && label) named.add(s.family_id)
  }
  return [...familyIndex().skillsOf.keys()].filter((f) => !named.has(f)).sort()
}

/** العائلات التي تلزم مقررات مجموعة مسارات — مرتّبة بعدد المقررات التي تمسّها.
    هذه هي قائمة ما يستحق أن يُسأل عنه المتعلم: لا كل العائلات، بل ما يمسّ خطته. */
export function familiesForCourses(courseIds: string[]): { family: string; skills: string[]; courseCount: number }[] {
  const idx = familyIndex()
  const wanted = new Set(courseIds)
  const hits = new Map<string, { skills: Set<string>; courses: Set<string> }>()
  for (const c of catalogCourses) {
    if (!wanted.has(c.course_id)) continue
    for (const slug of c.skill_slugs) {
      const fam = idx.familyOf.get(slug)
      if (!fam) continue
      const e = hits.get(fam) ?? { skills: new Set<string>(), courses: new Set<string>() }
      e.skills.add(slug)
      e.courses.add(c.course_id)
      hits.set(fam, e)
    }
  }
  return [...hits.entries()]
    .map(([family, e]) => ({ family, skills: [...e.skills].sort(), courseCount: e.courses.size }))
    .sort((a, b) => b.courseCount - a.courseCount || a.family.localeCompare(b.family))
}

/** يحل مستوى كل مهارة في القائمة: المقاس مباشرة أولا، ثم المستدَل من عائلته.
    القياس المباشر يعلو دائما — تقييم العائلة ترجيحٌ لا يلغي دليلا. */
export function resolveSkillLevels(
  slugs: string[],
  measured: Map<string, SkillState>,
  familyRatings: Record<string, number>,
): Map<string, ResolvedSkill> {
  const idx = familyIndex()
  const out = new Map<string, ResolvedSkill>()
  for (const slug of slugs) {
    const m = measured.get(slug)
    if (m?.state === 'measured' && m.level !== undefined) {
      out.set(slug, { slug, level: m.level, provenance: 'measured' })
      continue
    }
    const fam = idx.familyOf.get(slug)
    const rating = fam ? familyRatings[fam] : undefined
    if (fam && rating !== undefined) {
      out.set(slug, { slug, level: rating, provenance: 'inferred', viaFamily: fam })
      continue
    }
    out.set(slug, { slug, level: null, provenance: 'unknown' })
  }
  return out
}

/** وزن الدليل المستدَل في حساب التغطية — نصف المقاس.
    ليس رقما اعتباطيا بل إعلانُ أن الترجيح لا يساوي القياس: تغطيةٌ مبنية
    على تقييم ذاتي لعائلة لا تُدّعى كتغطيةٍ بسؤال مباشر عن المهارة. */
export const INFERRED_EVIDENCE_WEIGHT = 0.5

/** تغطية الدليل لمجموعة مهارات — المقاس بوزن كامل والمستدَل بنصفه */
export function evidenceCoverage(resolved: Map<string, ResolvedSkill>): number {
  const all = [...resolved.values()]
  if (all.length === 0) return 1
  let sum = 0
  for (const r of all) {
    if (r.provenance === 'measured') sum += 1
    else if (r.provenance === 'inferred') sum += INFERRED_EVIDENCE_WEIGHT
  }
  return sum / all.length
}

/* موجة ٦ · أ-١ — تغطية القياس بثمنها لا بعددها.

   الواقع المقيس: ٨ مهارات مقيسة من ٣٠٥، و١٠ مسارات من ٢٠ بلا مهارة مقيسة
   واحدة. ومعنى ذلك أن **وزن فجوة المهارة (٢٥٪) خامل في نصف الكتالوج** — لا
   أنه ضعيف، بل لا أثر له: المسار الذي لا تُقاس فيه مهارة واحدة يدخل الترشيح
   بثلاثة أرباع الوزن فقط، ولا يستطيع سؤالٌ واحد أن يفصله عن منافسه.

   وقبل هذه الموجة كان الرقم يُبلَّغ ولا يُعالج، لأن إضافة سؤال قياس كانت تحتاج
   نشر كود (خطة الأسئلة مولَّدة وقت البناء). بعد ج-٢ لم تعد كذلك — فصار الترتيب
   بالأثر عملا لا معلومة.

   الترتيب هو الفكرة: مهارةٌ يتطلبها أربعة مسارات بلا تغطية، قياسُها بسؤال واحد
   يفتح الأربعة. فالتقرير يرتّب الفجوات بعدد المسارات التي **يفتحها** إغلاقها،
   لا بعدد المسارات التي تستعملها. الفرق بينهما هو الفرق بين «معلومة» و«خطة». */

import { courseById, launchPathways, questionBank, skillsCatalog } from '../../domain/diagnostic/catalog'
import { measurableSkills } from '../../domain/diagnostic/v2_1/universe'
import { planOf } from '../../domain/diagnostic/v2_1/data'
import { skillStateOf, type SkillMeasureState } from './skill-measurement'

export interface PathwayCoverage {
  pathwayId: string
  titleAr: string
  /** مهارات المسار النشطة تشخيصيا (المقام) */
  activeSkills: number
  /** المقيس منها فعلا */
  measured: number
  /** المقيس ÷ النشط — 0 يعني وزن المهارات خامل تماما */
  coverage: number
  /** ثمن الفراغ بلغة القرار، لا نسبة مجردة */
  costAr: string
}

export interface SkillGap {
  slug: string
  nameAr: string
  state: SkillMeasureState
  /** المسارات التي تتطلب هذه المهارة */
  pathwayIds: string[]
  /** المسارات التي ستنتقل من «صفر تغطية» إلى «مقيسة» لو قيست هذه المهارة وحدها */
  unlocks: string[]
}

export interface OrphanMeasureQuestion {
  questionId: string
  /** المفتاح الذي يقيسه ولا يقابله مهارة مسجَّلة */
  measuredKey: string
  textAr: string
  /** هل هو على سطح B2C فعلا؟ (خارجه لا يُسأل ولا يُهدر وقت المتعلم) */
  onB2cSurface: boolean
}

export interface CoverageReport {
  pathways: PathwayCoverage[]
  /** الفجوات مرتبة بالأثر: ما يفتح أكثر أولا، ثم ما يستعمله أكثر */
  gaps: SkillGap[]
  orphanQuestions: OrphanMeasureQuestion[]
  totals: {
    pathways: number
    /** مسارات وزن المهارات فيها خامل تماما */
    pathwaysZeroCoverage: number
    activeSkills: number
    /** مهارات **مسجَّلة ونشطة** يقيسها سؤال — لا يُخلط بها مفتاحٌ يُقاس بلا تسجيل */
    measuredSkills: number
    /** مفاتيح يقيسها سؤال ولا تقابلها مهارة مسجَّلة — تُعدّ منفصلة قصدا:
        خلطها بالمقيس يرفع الرقم ويخفي أن قياسها لا يدخل أي ترشيح */
    measuredKeysUnregistered: number
    /** لو قيست أعلى ثلاث فجوات: كم مسارا يخرج من الصفر؟ */
    topThreeUnlock: number
  }
}

/** مهارات المسار من دوراته المركزية — بلا تكرار */
function skillsOfPathway(pathwayId: string): string[] {
  const p = launchPathways.find((x) => x.id === pathwayId)
  if (!p) return []
  const out = new Set<string>()
  for (const cid of p.course_ids) for (const s of courseById.get(cid)?.skill_slugs ?? []) out.add(s)
  return [...out]
}

export function buildCoverageReport(): CoverageReport {
  const measured = measurableSkills()
  const registeredSlugs = new Set(skillsCatalog.map((s) => s.slug))

  /* تغطية كل مسار + المسارات صفرية التغطية */
  const pathways: PathwayCoverage[] = []
  const zeroCoverage = new Set<string>()
  const activeByPathway = new Map<string, string[]>()

  for (const p of launchPathways) {
    const active = skillsOfPathway(p.id).filter((s) => skillStateOf(s).state !== 'inactive')
    activeByPathway.set(p.id, active)
    const hit = active.filter((s) => measured.has(s))
    const coverage = active.length === 0 ? 0 : hit.length / active.length
    if (hit.length === 0) zeroCoverage.add(p.id)
    pathways.push({
      pathwayId: p.id,
      titleAr: p.title,
      activeSkills: active.length,
      measured: hit.length,
      coverage,
      costAr: hit.length === 0
        ? 'وزن فجوة المهارة (٢٥٪) خامل تماما — لا سؤال واحد يستطيع فصل هذا المسار عن منافسه'
        : hit.length === active.length
          ? 'كل مهاراته النشطة مقيسة — الوزن كامل'
          : `${hit.length} من ${active.length} مقيسة — الوزن يعمل بجزءٍ منه، وباقي المهارات تدخل المقام مجهولةً`,
    })
  }

  /* الفجوات: مهارة نشطة غير مقيسة يتطلبها مسار واحد على الأقل */
  const gapMap = new Map<string, SkillGap>()
  for (const [pid, active] of activeByPathway) {
    for (const slug of active) {
      if (measured.has(slug)) continue
      const st = skillStateOf(slug)
      const row = gapMap.get(slug) ?? { slug, nameAr: st.nameAr, state: st.state, pathwayIds: [], unlocks: [] }
      row.pathwayIds.push(pid)
      if (zeroCoverage.has(pid)) row.unlocks.push(pid)
      gapMap.set(slug, row)
    }
  }
  const gaps = [...gapMap.values()]
    .map((g) => ({ ...g, pathwayIds: g.pathwayIds.sort(), unlocks: g.unlocks.sort() }))
    /* الأثر أولا: ما يخرج مسارات من الصفر، ثم ما يستعمله أكثر، ثم الاسم لثبات الترتيب */
    .sort((a, b) => b.unlocks.length - a.unlocks.length
      || b.pathwayIds.length - a.pathwayIds.length
      || a.slug.localeCompare(b.slug))

  /* أسئلة القياس المعلّقة: تقيس مفتاحا ليس مهارة مسجَّلة */
  const orphanQuestions: OrphanMeasureQuestion[] = []
  for (const q of questionBank) {
    if (q.answer_type !== 'skill_level_5') continue
    const key = q.measures?.[0]
    if (!key || registeredSlugs.has(key)) continue
    orphanQuestions.push({
      questionId: q.question_id,
      measuredKey: key,
      textAr: q.text_ar,
      onB2cSurface: planOf(q.question_id)?.surface === 'b2c',
    })
  }
  orphanQuestions.sort((a, b) => a.questionId.localeCompare(b.questionId))

  /* أثر أعلى ثلاث فجوات — مسارات لا تتكرر */
  const topThree = new Set<string>()
  for (const g of gaps.slice(0, 3)) for (const pid of g.unlocks) topThree.add(pid)

  return {
    pathways: pathways.sort((a, b) => a.coverage - b.coverage || a.pathwayId.localeCompare(b.pathwayId)),
    gaps,
    orphanQuestions,
    totals: {
      pathways: launchPathways.length,
      pathwaysZeroCoverage: zeroCoverage.size,
      activeSkills: [...registeredSlugs].filter((s) => skillStateOf(s).state !== 'inactive').length,
      measuredSkills: [...measured].filter((k) => registeredSlugs.has(k)).length,
      measuredKeysUnregistered: [...measured].filter((k) => !registeredSlugs.has(k)).length,
      topThreeUnlock: topThree.size,
    },
  }
}

/** جملة واحدة تصف حال التغطية — تُعرض فوق الجدول وفي تقرير السطر الواحد */
export function coverageHeadlineAr(r: CoverageReport): string {
  const { pathwaysZeroCoverage, pathways, measuredSkills, activeSkills, topThreeUnlock } = r.totals
  if (pathwaysZeroCoverage === 0) {
    return `كل المسارات (${pathways}) فيها مهارة مقيسة واحدة على الأقل — وزن فجوة المهارة يعمل في كلها.`
  }
  return (
    `${pathwaysZeroCoverage} من ${pathways} مسارا بلا مهارة مقيسة واحدة — وزن فجوة المهارة (٢٥٪) خامل فيها. ` +
    `والمقيس ${measuredSkills} من ${activeSkills} مهارة نشطة. ` +
    (topThreeUnlock > 0
      ? `وقياس أعلى ثلاث فجوات وحدها يُخرج ${topThreeUnlock} مسارا من الصفر.`
      : 'ولا فجوة واحدة تُخرج مسارا من الصفر — الفجوات كلها في مسارات مغطّاة أصلا.')
  )
}

/* مخطِّطُ توزيع الشعب على الفصل — بلا تعارضِ محتوى (البند ٤٨).

   ─────────── ما يحلّه ───────────

   ثمانون دورةً منشورةً مسعَّرة، وفصلٌ من ثلاثة أشهر. والتوزيعُ اليومَ يدويّ:
   من يفتح الشعبَ يفتحها بالترتيب الذي يخطر له، فتقع دورتان من مسارٍ واحدٍ
   في أسبوعٍ واحد، أو تتزاحم دورتا تسويقٍ متقاربتان بينما لا تُفتح دورةُ
   قيادةٍ واحدةٌ في الشهر كلِّه.

   ─────────── ولمَ حسابٌ نقيٌّ لا استعلامٌ في الخدمة ───────────

   المخطِّطُ قرارٌ يُراجَع: يُعرض على إنسانٍ قبل أن يُطبَّق، ويُشرح له لماذا
   وقعت هذه الدورةُ هنا. وحسابٌ نقيٌّ يُختبَر بمدخلاتٍ مصنوعة أصدقُ من
   استعلامٍ يُختبَر بقاعدةٍ مبذورة — ويُعاد تشغيلُه ألفَ مرّةٍ في ثانية.

   ─────────── والحتميّة شرطٌ لا تحسين ───────────

   المعاينةُ التي تعطي نتيجةً مختلفةً في كلّ تشغيلٍ ليست معاينة. فلا عشوائيّةَ
   هنا: الترتيبُ الأوّليُّ مشتقٌّ من البيانات، والبحثُ المحلّيُّ يمرّ على
   الأزواج بترتيبٍ ثابت، والتعادلُ يُحسم بالمعرِّف. */

/** دورةٌ تُجدوَل */
export interface PlannableCourse {
  courseId: string
  /** مسارُها الأمّ وترتيبُها فيه — أساسُ الترتيب الأوّليّ وقيدِ الفجوة */
  pathwayId: string | null
  sequence: number | null
  /** مجالُها — من العمود لا من نصّ المعرِّف */
  domainAr: string | null
  /** مجموعةُ التزاحم إن حُدِّدت يدويّا */
  collisionGroup: string | null
  /** معرِّفاتُ مهاراتها — الإشارةُ الأحدّ على التزاحم */
  skillSlugs: string[]
  /** عائلاتُ مهاراتها — أخشنُ فأقلُّ وزنا */
  skillFamilies: string[]
  /** أسابيعُها — يحتاجها حسابُ النهاية */
  weeks: number
}

/** موعدٌ ممكن: أسبوعٌ داخل الفصل */
export interface PlannerSlot {
  /** رقمُ الأسبوع من بداية الفصل (٠ فأعلى) */
  week: number
  /** تاريخُ بدايته */
  startsAt: Date
  /** الشهرُ داخل الفصل: ١ أو ٢ أو ٣ */
  monthWithinTerm: number
}

export interface PlannerInput {
  courses: PlannableCourse[]
  slots: PlannerSlot[]
  /** شعبٌ ثبّتها إنسانٌ — تُحترَم ولا تُزحزَح */
  pinned?: Record<string, number>
  /** أقصى ما يُفتح في الأسبوع الواحد — يُشتقّ من الحمل إن لم يُمرَّر */
  weeklyCap?: number
  /** نافذةُ التزاحم بالأسابيع — دورتان تبدآن داخلها تتزاحمان */
  collisionWindowWeeks?: number
}

export interface PlannedRow {
  courseId: string
  week: number
  startsAt: Date
  monthWithinTerm: number
  /** أعلى تزاحمٍ قبِله المخطِّط لهذا الصفّ — ومع من */
  worstCollision: { withCourseId: string; penalty: number; whyAr: string } | null
  pinned: boolean
  /** أثرُ تثبيتٍ بشريٍّ كسر ترتيبَ المسار — يُقال ولا يُمنع */
  orderBreachAr: string | null
}

export interface PlannerResult {
  rows: PlannedRow[]
  /** مجموعُ العقوبات — كلّما قلّ كان التوزيعُ أنظف */
  totalPenalty: number
  /** ما تعذّر جدولتُه ولماذا — لا يُحذف صامتا */
  unplaced: { courseId: string; whyAr: string }[]
  /** حملُ كلّ شهر — يُعرض ليُرى الاتّزان */
  loadByMonth: Record<number, number>
}

/* ─────────── أوزانُ العقوبة ───────────

   الاشتراكُ في **معرِّفات** المهارات إشارةٌ حادّةٌ قليلةُ الضجيج: من ٣٢٤٠ زوجَ
   دوراتٍ تشترك ٣٢٤ في واحدةٍ على الأقلّ، **وصفرُ أزواجٍ تشترك في أربع**.
   والاشتراكُ في **العائلات** خشنٌ جدّا وحدَه (١٠٢٤ زوجا) — فأقلُّ وزنا. */
export const PENALTY = {
  sharedSkill: 1.5,
  samePathway: 1.2,
  sameCollisionGroup: 1.0,
  sharedFamily: 0.5,
  sameDomain: 0.8,
} as const

/** أقلُّ فجوةٍ بين دورتين متتاليتين في مسارٍ واحد — أسبوعان */
export const MIN_PATHWAY_GAP_WEEKS = 2
const DEFAULT_COLLISION_WINDOW = 3

/* ─────────── السقفُ الأسبوعيُّ يُشتقّ ولا يُفترَض ───────────

   سقفٌ ثابتٌ (ثمانية) بدا معقولا وأسقط ستَّ عشرةَ دورةً من إحدى وثمانين:
   ٨١ دورةً في ١٣ أسبوعا متوسّطُها ٦٫٢ أسبوعيّا، لكنّ وضعَ السلاسلِ بخطوةٍ
   ثابتةٍ يكدّس أوساطَها فيتجاوز المتوسّطَ في الأسابيع الوسطى.

   فالافتراضيُّ يُشتقّ من الحمل نفسِه بهامشٍ للتكدّس. **وهو افتراضيٌّ لا
   حكم**: من يعرف طاقةَ الأكاديمية الأسبوعيّةَ يمرّرها، وما تعذّر عندها
   يُقال في `unplaced` بسببه لا يسقط صامتا. */
const CAP_SLACK = 3
const derivedCap = (courses: number, weeks: number): number =>
  Math.max(2, Math.ceil(courses / Math.max(1, weeks)) + CAP_SLACK)

function overlap(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const set = new Set(a)
  let n = 0
  for (const x of b) if (set.has(x)) n++
  return n
}

/** عقوبةُ وقوع دورتين متقاربتين — والسببُ يُقال لا يُخمَّن */
export function pairPenalty(a: PlannableCourse, b: PlannableCourse): { penalty: number; whyAr: string } {
  const reasons: string[] = []
  let penalty = 0

  const skills = overlap(a.skillSlugs, b.skillSlugs)
  if (skills > 0) {
    penalty += PENALTY.sharedSkill * skills
    reasons.push(`${skills} مهارةً مشتركة`)
  }
  if (a.pathwayId && a.pathwayId === b.pathwayId) {
    penalty += PENALTY.samePathway
    reasons.push('المسارُ نفسُه')
  }
  if (a.collisionGroup && a.collisionGroup === b.collisionGroup) {
    penalty += PENALTY.sameCollisionGroup
    reasons.push('مجموعةُ التزاحم نفسُها')
  }
  if (a.domainAr && a.domainAr === b.domainAr) {
    penalty += PENALTY.sameDomain
    reasons.push(`المجالُ نفسُه (${a.domainAr})`)
  }
  const families = overlap(a.skillFamilies, b.skillFamilies)
  if (families > 0) {
    penalty += PENALTY.sharedFamily * families
    reasons.push(`${families} عائلةَ مهاراتٍ مشتركة`)
  }
  return { penalty: Math.round(penalty * 1000) / 1000, whyAr: reasons.join(' · ') }
}

/* ─────────── قيدُ المسار: يُوفَّى بالبناء، ويُفحَص للمثبَّت ───────────

   السلسلةُ تُوضع بخطوةٍ ثابتةٍ من أسبوع بدايتها (`w, w+٢, w+٤…`)، فالترتيبُ
   والفجوةُ **مُوفَّيانِ بالإنشاء** لا بفحصٍ بعده — وهذا خيرٌ من قيدٍ يُفحَص
   ويُخفق أحيانا.

   والاستثناءُ الوحيدُ **التثبيتُ البشريّ**: من ثبّت شعبةً في أسبوعٍ بعينه
   تجاوز البناءَ كلَّه. وقرارُه يُحترَم — «يخطّط المخطِّطُ حولها» — لكنّ
   **أثرَه يُقال**: إن كسر تثبيتُه ترتيبَ مساره ظهر ذلك في صفّه، فيرى
   المقايضةَ التي اختارها لا يكتشفها بعد شهر. */
function pathwayOrderBreach(
  course: PlannableCourse, week: number, placed: Map<string, number>, byCourse: Map<string, PlannableCourse>,
): string | null {
  if (!course.pathwayId || course.sequence === null) return null
  for (const [otherId, otherWeek] of placed) {
    if (otherId === course.courseId) continue
    const other = byCourse.get(otherId)
    if (!other || other.pathwayId !== course.pathwayId || other.sequence === null) continue
    const later = course.sequence > other.sequence
    const gap = later ? week - otherWeek : otherWeek - week
    if (gap <= 0) {
      return `ترتيبُ المسار مكسور: تقع ${later ? 'قبل' : 'بعد'} «${otherId}» وتسلسلُها يقتضي العكس`
    }
    if (Math.abs(course.sequence - other.sequence) === 1 && gap < MIN_PATHWAY_GAP_WEEKS) {
      return `الفجوةُ عن «${otherId}» ${gap} أسبوعٍ والحدُّ ${MIN_PATHWAY_GAP_WEEKS}`
    }
  }
  return null
}

/** توزيعُ الفصل — حتميٌّ بالكامل، ويُعاد تشغيلُه فيعطي النتيجةَ نفسَها */
export function planTerm(input: PlannerInput): PlannerResult {
  const window = input.collisionWindowWeeks ?? DEFAULT_COLLISION_WINDOW
  const cap = input.weeklyCap ?? derivedCap(input.courses.length, input.slots.length)
  const pinned = input.pinned ?? {}
  const byCourse = new Map(input.courses.map((c) => [c.courseId, c]))
  const slotByWeek = new Map(input.slots.map((s) => [s.week, s]))

  /* ─────────── الترتيبُ الأوّليّ: سلسلةً سلسلة لا صفّا صفّا ───────────

     المسارُ سلسلةٌ مترابطة: دوراتُه الأربعُ يجب أن تقع بالترتيب وبفجوةٍ
     بينها. فوضعُها **معا** يحلّ السلسلةَ كلَّها مرّةً واحدة.

     وترتيبُ الدورات صفّا صفّا (كلُّ أوائل المسارات أوّلا، ثمّ كلُّ ثوانيها…)
     يبدو منطقيّا ويُخفق: تتكدّس العشرون أوّليّةً في أوائل الأسابيع، فتُدفَع
     ثوانيها وثوالثها إلى آخر الفصل، ويمتلئ آخرُه ويخلو أوّلُه — وقِيس:
     ثلاثون دورةً تسقط بلا موعد، وأسبوعان في الشهر الأوّل فارغان تماما.

     فالوحدةُ هنا **المسار**: يُجرَّب لكلّ مسارٍ أسبوعُ بدايةٍ ممكن، وتُحسب
     كلفةُ سلسلته كاملةً، ويُؤخذ أرخصُها. */
  const chains = new Map<string, PlannableCourse[]>()
  for (const c of input.courses) {
    const key = c.pathwayId ?? `~solo:${c.courseId}`
    const list = chains.get(key) ?? []
    list.push(c)
    chains.set(key, list)
  }
  for (const list of chains.values()) {
    list.sort((a, b) => (a.sequence ?? 99) - (b.sequence ?? 99) || a.courseId.localeCompare(b.courseId))
  }
  /* والمساراتُ الأطولُ أوّلا: أصعبُها إرضاءً يُوضع وللمكان سعة */
  const chainOrder = [...chains.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  )

  const placed = new Map<string, number>()
  const perWeek = new Map<number, number>()
  const unplaced: PlannerResult['unplaced'] = []

  /* المثبَّتُ أوّلا — يخطّط المخطِّطُ حولَه لا عليه */
  for (const [courseId, week] of Object.entries(pinned)) {
    if (!byCourse.has(courseId) || !slotByWeek.has(week)) continue
    placed.set(courseId, week)
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1)
  }

  const costAt = (
    course: PlannableCourse, week: number,
    against: Map<string, number> = placed, load: Map<number, number> = perWeek,
  ): number => {
    let cost = 0
    for (const [otherId, otherWeek] of against) {
      if (Math.abs(otherWeek - week) >= window) continue
      const other = byCourse.get(otherId)
      if (!other) continue
      cost += pairPenalty(course, other).penalty
    }
    /* اتّزانُ الحمل: الأسبوعُ المزدحمُ يُكلِّف أكثر — بلا منعٍ ما دام دون السقف.
       والوزنُ تصاعديٌّ لا خطّيّ: أسبوعٌ فيه ستّةٌ أثقلُ من ضعف أسبوعٍ فيه ثلاثة،
       وإلّا تكدّست الدوراتُ في أوّل الفصل وخلا آخرُه. */
    const busy = load.get(week) ?? 0
    cost += busy * busy * 0.25
    /* وأوائلُ المسارات تُفضَّل في الشهر الأوّل */
    const slot = slotByWeek.get(week)
    if (course.sequence === 1 && slot && slot.monthWithinTerm > 1) cost += 0.6 * (slot.monthWithinTerm - 1)
    return cost
  }

  /* ─────────── السلسلةُ تُوضع بخطوةٍ ثابتة، لا كلُّ دورةٍ تختار لنفسها ───────────

     المحاولةُ الأولى تركت كلَّ دورةٍ في السلسلة تختار أرخصَ أسبوعٍ بعد سابقتها.
     وهي تُخفق إخفاقا صامتا: الدورةُ الأولى تجد أرخصَ أسبوعٍ في آخر الفصل
     (الأسابيعُ الأولى مشغولةٌ بمسارٍ سابق)، فتُدفَع الثانيةُ بعدها، فتخرج
     الرابعةُ من الفصل كلِّه — **فتسقط السلسلةُ كاملةً وقد كان لها موضع**.
     قِيس: من ثمانين دورةً وُضعت إحدى وعشرون.

     فالسلسلةُ تُوضع **بخطوةٍ ثابتة** من أسبوع بدايتها: `w, w+فجوة, w+2فجوة…`.
     والبحثُ على أسبوع البداية وحدَه — ثلاثةَ عشرَ احتمالا لكلّ مسار. فيُضمَن
     أنّ السلسلةَ التي تسع الفصلَ توضع فيه، ويبقى القرارُ الوحيدُ «من أين
     تبدأ» — وهو القرارُ الذي يهمّ فعلا. */
  const tryChain = (
    chain: PlannableCourse[], firstWeek: number, commit: boolean,
  ): number | null => {
    const pending = chain.filter((c) => !placed.has(c.courseId))
    if (pending.length === 0) return null
    const trialWeek = new Map(perWeek)
    const chosen: [string, number][] = []
    let cost = 0
    for (let i = 0; i < pending.length; i++) {
      const week = firstWeek + i * MIN_PATHWAY_GAP_WEEKS
      const slot = slotByWeek.get(week)
      /* خرجت السلسلةُ من الفصل — بدايةٌ أخرى، أو لا موضعَ لها */
      if (!slot) return null
      if ((trialWeek.get(week) ?? 0) >= cap) return null
      trialWeek.set(week, (trialWeek.get(week) ?? 0) + 1)
      chosen.push([pending[i].courseId, week])
      cost += costAt(pending[i], week, placed, trialWeek)
    }
    if (commit) {
      for (const [id, w] of chosen) {
        placed.set(id, w)
        perWeek.set(w, (perWeek.get(w) ?? 0) + 1)
      }
    }
    return cost
  }

  for (const [, chain] of chainOrder) {
    let best: { week: number; cost: number } | null = null
    for (const slot of input.slots) {
      const cost = tryChain(chain, slot.week, false)
      if (cost === null) continue
      if (!best || cost < best.cost - 1e-9) best = { week: slot.week, cost }
    }
    if (best === null) {
      const span = (chain.length - 1) * MIN_PATHWAY_GAP_WEEKS + 1
      for (const course of chain) {
        if (!placed.has(course.courseId)) {
          unplaced.push({
            courseId: course.courseId,
            whyAr:
              span > input.slots.length
                ? `سلسلةُ مسارها تحتاج ${span} أسبوعا والفصلُ ${input.slots.length}`
                : 'السقفُ الأسبوعيُّ ممتلئٌ في كلّ بدايةٍ تسعها',
          })
        }
      }
      continue
    }
    tryChain(chain, best.week, true)
  }

  /* أعلى تزاحمٍ قُبِل لكلّ صفّ — فيرى الإنسانُ المقايضةَ لا صندوقا أسود */
  const rows: PlannedRow[] = []
  let totalPenalty = 0
  for (const [courseId, week] of [...placed].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))) {
    const course = byCourse.get(courseId)!
    const slot = slotByWeek.get(week)!
    let worst: PlannedRow['worstCollision'] = null
    for (const [otherId, otherWeek] of placed) {
      if (otherId === courseId || Math.abs(otherWeek - week) >= window) continue
      const other = byCourse.get(otherId)
      if (!other) continue
      const p = pairPenalty(course, other)
      if (p.penalty > 0) {
        totalPenalty += p.penalty
        if (!worst || p.penalty > worst.penalty) {
          worst = { withCourseId: otherId, penalty: p.penalty, whyAr: p.whyAr }
        }
      }
    }
    rows.push({
      courseId, week, startsAt: slot.startsAt, monthWithinTerm: slot.monthWithinTerm,
      worstCollision: worst, pinned: courseId in pinned,
      orderBreachAr: pathwayOrderBreach(course, week, placed, byCourse),
    })
  }

  const loadByMonth: Record<number, number> = {}
  for (const r of rows) loadByMonth[r.monthWithinTerm] = (loadByMonth[r.monthWithinTerm] ?? 0) + 1

  return {
    rows,
    /* كلُّ زوجٍ عُدّ مرّتين في الجمع أعلاه */
    totalPenalty: Math.round((totalPenalty / 2) * 1000) / 1000,
    unplaced,
    loadByMonth,
  }
}

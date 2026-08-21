/* مؤشر زخم صادق (البند ط-٥) — لا سلسلة أيام ولا نقاط ولا لوحة صدارة.

   الموقف من الدليل: أثر التلعيب الإجمالي صغير، وبعض الدراسات وجدت حلقاته
   (السلاسل والنقاط والمنافسة) ترفع التسرب. لكن الشعور بالكفاءة والتقدم أثره
   مثبت. فالمطلوب مؤشر يقول للمتعلم ما فعله فعلا — لا مؤشر يخترع له هدفا ثم
   يعاقبه على تفويته.

   ولهذا يفرض هذا الملف أربعة حدود:
   ١) كل رقم يسنده صفٌّ بتاريخ: وحدة أُقرّت، تسليم قُبل، جلسة حُضرت، بطاقة
      استُرجعت، جولة سيناريو انتهت، قياس بعديّ سُجّل، شهادة صدرت. «فتح صفحة»
      ليس أثرا، ولا يُحتسب هنا ولا في أي مكان.
   ٢) لا سلسلة أيام: العدّاد الذي ينكسر يدفع للانسحاب. نقول «آخر أثر قبل ١٢
      يوما» — واقعة بلا حكم — ولا نقول «انكسرت سلسلتك».
   ٣) لا هدف نضعه نحن: «٣ من ٤ هذا الأسبوع» رقم مخترع. الهدف الحقيقي الوحيد
      المعروض هو إيقاع الشعبة (جلسة كذا من كذا) لأن الشعبة وضعته لا نحن.
   ٤) الصفر يُقال صفرا: «لا أثر مسجَّل في آخر ٣٠ يوما» أصدق من رقم مجمَّل.

   والوقت يُمرَّر لا يُقرأ — فالوحدة نقية ونتائجها ثابتة في الاختبار. */

export type EvidenceKind = 'module' | 'submission' | 'session' | 'retrieval' | 'scenario' | 'remeasure' | 'certificate'

export const KIND_LABEL_AR: Record<EvidenceKind, string> = {
  module: 'وحدة أُقرّ إكمالها',
  submission: 'تسليم قُبل',
  session: 'جلسة حضرتها',
  retrieval: 'بطاقة استرجاع',
  scenario: 'جولة سيناريو',
  remeasure: 'قياس بعديّ',
  certificate: 'شهادة صدرت',
}

export const WINDOW_DAYS = 30
const DAY_MS = 86_400_000

export const NO_STREAK_NOTE =
  'لا سلسلة أيام هنا ولا نقاط ولا ترتيب بين المتعلمين. الانقطاع يوما لا يمحو ما تعلمته، ' +
  'والعدّاد الذي ينكسر يدفع للانسحاب أكثر مما يدفع للعودة. ما تراه هنا آثارك المسجَّلة بتواريخها.'

export interface EvidenceEvent {
  kind: EvidenceKind
  /** ISO — وقت الأثر نفسه لا وقت تسجيله حيث يختلفان (الحضور بتاريخ جلسته) */
  at: string
  labelAr: string
}

export interface CohortPace {
  cohortTitle: string
  /** جلسات انتهت فعلا (status = done) */
  done: number
  total: number
}

export interface MomentumFacts {
  events: EvidenceEvent[]
  /** إيقاع الشعبة — هدف وضعته الشعبة لا نحن؛ null بلا شعبة نشطة */
  cohortPace: CohortPace | null
}

export interface Momentum {
  hasEvidence: boolean
  /** أحدث أثر — null إن لم يُسجَّل شيء بعد */
  last: EvidenceEvent | null
  /** أيام كاملة منذ آخر أثر — null بلا أثر */
  daysSince: number | null
  windowDays: number
  /** ما تحقق داخل النافذة بالنوع — الأنواع الصفرية تبقى صفرا معلنا */
  counted: Record<EvidenceKind, number>
  countedTotal: number
  cohortPace: CohortPace | null
  /** أحدث ثلاثة آثار داخل النافذة — سطور بتواريخها لا رسم بياني */
  recent: EvidenceEvent[]
}

const ZERO: Record<EvidenceKind, number> = {
  module: 0, submission: 0, session: 0, retrieval: 0, scenario: 0, remeasure: 0, certificate: 0,
}

function parseAt(iso: string): number {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : NaN
}

/**
 * يبني المؤشر من آثار مؤرَّخة.
 * الآثار المستقبلية تُهمَل: جلسة لم تُعقد بعد ليست أثرا، وتاريخ معطوب يُطرح.
 */
export function buildMomentum(facts: MomentumFacts, now: Date): Momentum {
  const t = now.getTime()
  const clean = facts.events
    .map((e) => ({ e, at: parseAt(e.at) }))
    .filter((x) => Number.isFinite(x.at) && x.at <= t)
    .sort((a, b) => b.at - a.at)

  const last = clean[0]?.e ?? null
  const counted = { ...ZERO }
  const windowStart = t - WINDOW_DAYS * DAY_MS
  const inWindow = clean.filter((x) => x.at >= windowStart)
  for (const x of inWindow) counted[x.e.kind] += 1

  return {
    hasEvidence: clean.length > 0,
    last,
    daysSince: last ? Math.floor((t - parseAt(last.at)) / DAY_MS) : null,
    windowDays: WINDOW_DAYS,
    counted,
    countedTotal: inWindow.length,
    cohortPace: facts.cohortPace,
    recent: inWindow.slice(0, 3).map((x) => x.e),
  }
}

/** «قبل يومين» بالعربية — واقعة بلا حكم ولا تحفيز */
export function sinceLabelAr(days: number | null): string {
  if (days === null) return 'لا أثر مسجَّل بعد'
  if (days <= 0) return 'اليوم'
  if (days === 1) return 'أمس'
  if (days === 2) return 'قبل يومين'
  if (days < 11) return `قبل ${days} أيام`
  return `قبل ${days} يوما`
}

/* ══════════ استخراج الآثار من ردود الخادم القائمة ══════════
   بلا نقطة نهاية جديدة ولا جدول جديد: كل ما يلزم موجود في ردود بوابة المتعلم.
   الأشكال مبنيوية (structural) فتقبل الردّ كما هو بلا تعريف موازٍ يتباعد عنه. */

export interface EnrollmentEvidence {
  cohort?: {
    title?: string
    sessions?: { id: string; title?: string; startsAt?: string; status?: string }[]
  } | null
  attendance?: { sessionId: string; status: string; createdAt?: string }[] | null
  moduleProgress?: { moduleId: string; status: string; completedAt?: string | null }[] | null
  submissions?: { status: string; submittedAt?: string; assessment?: { title?: string } | null }[] | null
  certificates?: { status: string; issuedAt?: string; courseId?: string }[] | null
}

export interface ExtraEvidence {
  /** بطاقات الاسترجاع (ح-٤) — يُحتسب آخر استرجاع لكل بطاقة */
  retrievalCards?: { lastAnswerAt?: string | null; skillSlug?: string | null }[]
  /** جولات السيناريو (ح-٥) */
  scenarioRuns?: { endedAt?: string | null }[]
  /** القياس البعديّ (ح-٧) */
  remeasures?: { measuredAt: string; courseId?: string }[]
}

/**
 * يجمع الآثار من تفاصيل التسجيلات وما يرافقها.
 * قاعدة التأريخ: الأثر بتاريخ حدوثه لا بتاريخ تسجيله — فالحضور يؤرَّخ بجلسته
 * (المدرب قد يسجّله بعد أيام)، والوحدة بـcompletedAt، والتسليم بـsubmittedAt.
 */
export function momentumFactsFrom(
  enrollments: EnrollmentEvidence[],
  extra: ExtraEvidence = {},
): MomentumFacts {
  const events: EvidenceEvent[] = []

  for (const e of enrollments) {
    const sessions = e.cohort?.sessions ?? []
    const byId = new Map(sessions.map((s) => [s.id, s]))

    for (const a of e.attendance ?? []) {
      if (!['present', 'late'].includes(a.status)) continue
      const s = byId.get(a.sessionId)
      const at = s?.startsAt ?? a.createdAt
      if (!at) continue
      events.push({ kind: 'session', at, labelAr: s?.title ? `حضرت «${s.title}»` : 'حضرت جلسة' })
    }

    for (const m of e.moduleProgress ?? []) {
      if (m.status !== 'completed' || !m.completedAt) continue
      events.push({ kind: 'module', at: m.completedAt, labelAr: `أُقرّ إكمال وحدة «${m.moduleId}»` })
    }

    for (const s of e.submissions ?? []) {
      if (s.status !== 'accepted' || !s.submittedAt) continue
      events.push({
        kind: 'submission',
        at: s.submittedAt,
        labelAr: s.assessment?.title ? `قُبل تسليمك في «${s.assessment.title}»` : 'قُبل تسليمك',
      })
    }

    for (const c of e.certificates ?? []) {
      if (c.status !== 'active' || !c.issuedAt) continue
      events.push({ kind: 'certificate', at: c.issuedAt, labelAr: 'صدرت شهادتك' })
    }
  }

  for (const c of extra.retrievalCards ?? []) {
    if (!c.lastAnswerAt) continue
    events.push({ kind: 'retrieval', at: c.lastAnswerAt, labelAr: 'استرجعت بطاقة مهارة' })
  }
  for (const r of extra.scenarioRuns ?? []) {
    if (!r.endedAt) continue
    events.push({ kind: 'scenario', at: r.endedAt, labelAr: 'أنهيت جولة سيناريو قرار' })
  }
  /* القياس البعديّ يُسجَّل دفعة واحدة لمهارات الدورة — فيُعدّ أثرا واحدا لا أثرا
     لكل مهارة. أربع مهارات في جلسة قياس واحدة ليست أربعة آثار. */
  const remeasureKeys = new Set<string>()
  for (const r of extra.remeasures ?? []) {
    const key = `${r.courseId ?? ''}#${r.measuredAt}`
    if (remeasureKeys.has(key)) continue
    remeasureKeys.add(key)
    events.push({ kind: 'remeasure', at: r.measuredAt, labelAr: 'سُجّل قياس نموك بعد دورة' })
  }

  /* إيقاع الشعبة: الهدف الذي وضعته الشعبة لا نحن.
     ⚠ الشعبة الجارية تُقدَّم على المنتهية: «انتهت ٤ من ٤» في شعبة أُغلقت ليست
     إيقاعا بل تاريخا، وعرضها يوهم المتعلم أنه بلغ نهاية ما هو في وسطه. */
  const paceOf = (e: EnrollmentEvidence): CohortPace | null => {
    const sessions = e.cohort?.sessions ?? []
    if (sessions.length === 0) return null
    return {
      cohortTitle: e.cohort?.title ?? '',
      done: sessions.filter((s) => s.status === 'done').length,
      total: sessions.length,
    }
  }
  let cohortPace: CohortPace | null = null
  for (const e of enrollments) {
    const p = paceOf(e)
    if (p && p.done < p.total) { cohortPace = p; break }
  }
  if (!cohortPace) {
    for (const e of enrollments) {
      const p = paceOf(e)
      if (p) { cohortPace = p; break }
    }
  }

  return { events, cohortPace }
}

/* خريطة المسار (البند ط-٢) — «أين أنا من رحلتي؟» اشتقاقا من الكتالوج والتسجيلات.
   قواعد الصدق:
   - الترتيب من الكتالوج (course_ids) لا من ترتيب التسجيلات: المسار له تسلسل مقصود.
   - دورة بلا تسجيل تُعرض percent = null لا صفرا: الصفر يعني «سجّلتُ ولم أبدأ»،
     وnull يعني «لم أسجّل بعد» — والفرق يهم المتعلم.
   - لا قاعدة إقفال مخترعة: النظام الحقيقي لا يقفل دورة بإكمال سابقتها، فلا
     نعرض «مقفلة» على بيانات حقيقية. الصفحة المحاكاة تمرّر تسمياتها بنفسها. */

import { courseById, launchPathways } from '../../domain/diagnostic/catalog'

export type NodeState = 'completed' | 'in_progress' | 'enrolled' | 'not_enrolled'

export const NODE_LABEL_AR: Record<NodeState, string> = {
  completed: 'مكتملة',
  in_progress: 'قيد التنفيذ',
  enrolled: 'مسجّلة — لم تبدأ',
  not_enrolled: 'لم تُسجّل بعد',
}

export interface CourseNode {
  id: string
  titleAr: string
  sequence: number
  state: NodeState
  /** نسبة التقدم إن وُجد تسجيل — null لغير المسجّل */
  percent: number | null
  hours: number
  /** تسمية يفرضها المصدر — المحاكاة تعرف حالات لا يعرفها الخادم («مقفلة») */
  labelAr?: string
}

export interface PathwayMapModel {
  pathwayId: string
  pathwayTitleAr: string
  nodes: CourseNode[]
  /** مشروع التخرّج — **خارج** المسار لا عقدةً فيه: لا يُعدّ دورةً في
      totalCount ولا ساعةً في totalHours، ولا يقع على سكّة الرحلة. مهمّةٌ
      إضافية بعد الدورات. */
  capstoneAr: string | null
  /** فهرس أول دورة غير مكتملة — -1 إذا اكتمل المسار كله */
  currentIndex: number
  completedCount: number
  totalCount: number
  totalHours: number
  doneHours: number
}

/** ما نحتاجه من التسجيل — مستخلص من الخادم أو من المحاكاة */
export interface EnrollmentFact {
  courseId: string
  /** هل يوجد تسجيل فعلا؟ صريح كي لا يُقرأ غياب التقدم تسجيلا بلا بداية */
  enrolled: boolean
  /** null = لا سجل تقدم بعد */
  percent: number | null
  completed: boolean
  /** تسمية بديلة من المصدر — تمرّرها المحاكاة لحالاتها الخاصة */
  labelAr?: string
}

function stateOf(fact: EnrollmentFact | undefined): NodeState {
  if (!fact || !fact.enrolled) return 'not_enrolled'
  if (fact.completed || (fact.percent ?? 0) >= 100) return 'completed'
  if ((fact.percent ?? 0) > 0) return 'in_progress'
  return 'enrolled'
}

export function buildPathwayMap(pathwayId: string | null, facts: EnrollmentFact[]): PathwayMapModel | null {
  if (!pathwayId) return null
  const pathway = launchPathways.find((p) => p.id === pathwayId)
  if (!pathway) return null

  const byCourse = new Map<string, EnrollmentFact>()
  for (const f of facts) {
    /* أكثر من تسجيل لنفس الدورة (إعادة شعبة): نُبقي الأعلى تقدما */
    const prev = byCourse.get(f.courseId)
    if (!prev || (f.completed && !prev.completed) || (f.percent ?? 0) > (prev.percent ?? 0)) byCourse.set(f.courseId, f)
  }

  const nodes: CourseNode[] = []
  pathway.course_ids.forEach((cid) => {
    const c = courseById.get(cid)
    if (!c) return /* دورة غير موجودة في الكتالوج الحي — لا نخترع لها عنوانا */
    const fact = byCourse.get(cid)
    nodes.push({
      id: cid,
      titleAr: c.title_ar,
      sequence: c.sequence,
      state: stateOf(fact),
      percent: fact?.enrolled ? (fact.percent ?? 0) : null,
      hours: c.total_hours,
      ...(fact?.labelAr ? { labelAr: fact.labelAr } : {}),
    })
  })
  nodes.sort((a, b) => a.sequence - b.sequence)

  const completedCount = nodes.filter((n) => n.state === 'completed').length
  const currentIndex = nodes.findIndex((n) => n.state !== 'completed')
  return {
    pathwayId: pathway.id,
    pathwayTitleAr: pathway.title,
    nodes,
    capstoneAr: pathway.capstone || null,
    currentIndex,
    completedCount,
    totalCount: nodes.length,
    totalHours: nodes.reduce((s, n) => s + n.hours, 0),
    doneHours: nodes.filter((n) => n.state === 'completed').reduce((s, n) => s + n.hours, 0),
  }
}

/** شكل صف «تعلّمي» من الخادم — نقرأ منه ما نحتاج فقط ولا نفترض الباقي */
export interface MyLearningRow {
  status?: string
  cohort?: { course?: { id?: string } | null } | null
  courseProgress?: { percent?: number } | null
  certificates?: unknown[] | null
}

/** يستخلص وقائع التسجيل من رد /api/learner/my-learning بلا افتراضات على الشكل */
export function enrollmentFactsFromApi(rows: unknown): EnrollmentFact[] {
  if (!Array.isArray(rows)) return []
  const out: EnrollmentFact[] = []
  for (const raw of rows as MyLearningRow[]) {
    const courseId = raw?.cohort?.course?.id
    if (typeof courseId !== 'string' || courseId.length === 0) continue
    const rawPct = raw?.courseProgress?.percent
    const percent = typeof rawPct === 'number' && Number.isFinite(rawPct) ? Math.max(0, Math.min(100, Math.round(rawPct))) : null
    const certs = Array.isArray(raw?.certificates) ? raw!.certificates!.length : 0
    out.push({
      courseId,
      enrolled: true, /* صفٌّ في تعلّمي = تسجيل قائم */
      percent,
      completed: raw?.status === 'completed' || certs > 0 || (percent ?? 0) >= 100,
    })
  }
  return out
}

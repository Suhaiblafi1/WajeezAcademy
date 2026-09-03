/* رحلةُ التعلّم — طريقٌ واحدٌ يُقرأ، لا خانتان تتنازعان.

   المشكلة التي حلّها هذا الملفّ بكلام صاحب المنصّة: «حاول أن تجد حلا للتشتّت
   الذي يصيب الطلبة بوجود خانة دورات وخانة مسارات؟؟ وماذا لو كان لديه
   مسارين؟».

   وكان في البوابة ثلاثُ شاشاتٍ تجيب عن سؤالٍ واحد — «ما الذي أفعله الآن؟»:
     • «دوراتي»  — قائمةٌ مسطّحة بشعبه، فيها الجلساتُ والواجباتُ والموادّ.
     • «مساري»   — خطّتُه المعتمَدة، فيها ما لم يشترِه بعد وما لا شعبةَ له.
     • «محطات الدورة» — وحداتُ الكتالوج وتقدّمُها.
   فمن أراد أن يعرف خطوته التالية لزمه أن يجمعها بنفسه من ثلاثة أمكنة، وأن
   يفهم فرقا بين «دورة» و«مسار» لا يخصّه: هو يريد أن يتعلّم لا أن يصنّف.

   فصار المصدرُ واحدا: **مسارات** (tracks) لكلٍّ **مراحل** (stages). والمرحلة
   دورةٌ بحالتها الحقيقية، والمسارُ يُبنى من ثلاثة أصولٍ بهذا الترتيب:

     ١) خطّتُه المعتمَدة إن كانت — فهي ما اختاره هو، وقد تكون مركَّبةً من
        أكثر من مسار، فتُعرض باسمها الذي اعتمده لا باسمِ مسارٍ لم يختره.
     ٢) ثمّ ما يملكه خارج الخطّة، مجموعا بمساره — **بشرط دورتين على الأقلّ**.
        فمن اشترى دورتين من مسارٍ فهو يسلكه، ومن اشترى واحدة فقد أخذ دورة.
     ٣) وما بقي فرداً يُجمَع في «دورات مستقلّة» — لا يُنسَب إلى مسارٍ لم
        يسلكه، ولا يُخفى.

   وهذا وحدَه جوابُ «ماذا لو كان لديه مسارين»: مسارانِ = مسارانِ في القائمة،
   يبدّل بينهما، ولكلٍّ شريطُه ومراحلُه ومشروعُه الختاميّ.

   والوحدةُ نقيّة — لا React ولا نداءَ شبكة — كي تُفحَص بالحساب لا بالنقر. */

import { courseById, courseFullById, pathwayCourses } from '../../data/courses'
import { pathwayById } from '../../data/pathways'

/** حالةُ المرحلة — ستٌّ لا ثلاث، لأنّ «لا أملكها» ثلاثُ حالاتٍ مختلفةُ الفعل */
export type StageState =
  | 'completed' /** أُنجزت: شهادةٌ أو ١٠٠٪ أو حالةُ تسجيلٍ مكتملة */
  | 'in_progress' /** مسجَّلٌ وبدأ */
  | 'enrolled' /** مسجَّلٌ ولم يبدأ */
  | 'schedulable' /** في خطّته ولها شعبةٌ مفتوحة — لم يُسجَّل بعد */
  | 'awaiting_cohort' /** في خطّته ولا شعبةَ لها بعد */
  | 'not_owned' /** من دورات المسار، وليست في خطّته ولا يملكها */

export const STAGE_LABEL_AR: Record<StageState, string> = {
  completed: 'أنجزتها',
  in_progress: 'تسير فيها',
  enrolled: 'مسجَّلة — لم تبدأ',
  schedulable: 'شعبة مفتوحة',
  awaiting_cohort: 'بانتظار شعبة',
  not_owned: 'لم تُضَف بعد',
}

/** ما تعنيه الحالةُ للمتعلّم: أيَعمل فيها الآن أم يشتريها أم ينتظر؟ */
export const STAGE_IS_OPEN: Record<StageState, boolean> = {
  completed: true,
  in_progress: true,
  enrolled: true,
  schedulable: false,
  awaiting_cohort: false,
  not_owned: false,
}

/* ── ما يصل من الخادم: نُعلن ما نقرأه فقط، ولا نفترض بقيّةَ الشكل ── */

/** صفٌّ من `/api/learner/my-learning` */
export interface JourneyRow {
  id: string
  status?: string
  cohort?: {
    id?: string
    title?: string
    startsAt?: string | null
    course?: { id?: string } | null
  } | null
  courseProgress?: { percent?: number } | null
  certificates?: { id: string; number: string; status: string }[] | null
}

/** بندٌ من `/api/learner/plan` */
export interface JourneyPlanItem {
  courseId: string
  sequence: number
  isGift?: boolean
  state: 'enrolled' | 'schedulable' | 'awaiting_cohort'
  requestPending?: boolean
  cohort?: { id: string; title: string; startsAt: string | null; seatsLeft: number | null } | null
}

export interface JourneyPlan {
  id: string
  nameAr: string
  composed?: boolean
  items: JourneyPlanItem[]
}

/* ── ما نُخرجه ── */

export interface JourneyStage {
  courseId: string
  titleAr: string
  termEn: string | null
  /** ساعاتُ الدورة من الكتالوج — صفرٌ إن لم تُكتب بعد، ولا تُقدَّر */
  hours: number
  weeks: number
  state: StageState
  /** نسبةُ التقدّم — `null` لمن لا تسجيلَ له: الصفرُ يعني «سجّلتُ ولم أبدأ» */
  percent: number | null
  enrollmentId: string | null
  cohortTitle: string | null
  certificate: { id: string; number: string; status: string } | null
  isGift: boolean
  inPlan: boolean
  requestPending: boolean
  planCohort: JourneyPlanItem['cohort']
}

export interface JourneyTrack {
  kind: 'plan' | 'pathway' | 'standalone'
  id: string
  titleAr: string
  subtitleAr: string | null
  /** مسارُ الكتالوج إن كان للمسار واحدٌ بعينه — عليه يقوم المشروعُ الختاميّ
      وشهادةُ المسار كاملا. وخطّةٌ مركَّبةٌ من مسارين لا مشروعَ لها يُختلق. */
  pathwayId: string | null
  capstoneAr: string | null
  stages: JourneyStage[]
  /** فهرسُ «أنت هنا»: أوّلُ مرحلةٍ يملكها ولم يُنجزها، و-١ إن أنجز ما يملك */
  currentIndex: number
  counts: { total: number; owned: number; completed: number }
  hours: { total: number; done: number }
}

interface Fact {
  enrollmentId: string
  percent: number | null
  completed: boolean
  started: boolean
  cohortTitle: string | null
  certificate: { id: string; number: string; status: string } | null
}

function pct(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null
}

/** وقائعُ التسجيل لكلّ دورة — وأكثرُ تقدّمٍ يفوز حين تتعدّد الشعب لدورةٍ واحدة */
function factsOf(rows: readonly JourneyRow[]): Map<string, Fact> {
  const out = new Map<string, Fact>()
  for (const r of rows) {
    const courseId = r?.cohort?.course?.id
    if (typeof courseId !== 'string' || courseId.length === 0) continue
    const certs = Array.isArray(r.certificates) ? r.certificates : []
    /* الشهادةُ الفعّالة أوّلا: ملغاةٌ ليست دليلَ إنجاز */
    const certificate = certs.find((c) => c.status === 'active') ?? certs[0] ?? null
    const percent = pct(r.courseProgress?.percent)
    const fact: Fact = {
      enrollmentId: r.id,
      percent,
      completed: r.status === 'completed' || (certificate?.status === 'active') || (percent ?? 0) >= 100,
      started: (percent ?? 0) > 0,
      cohortTitle: r.cohort?.title ?? null,
      certificate,
    }
    const prev = out.get(courseId)
    if (!prev || (fact.completed && !prev.completed) || (fact.percent ?? 0) > (prev.percent ?? 0)) {
      out.set(courseId, fact)
    }
  }
  return out
}

function stateOf(fact: Fact | undefined, item: JourneyPlanItem | null): StageState {
  if (fact) {
    if (fact.completed) return 'completed'
    return fact.started ? 'in_progress' : 'enrolled'
  }
  if (!item) return 'not_owned'
  /* الخطّةُ تقول `enrolled` عن دورةٍ لا صفَّ لها في «تعلّمي»: مقعدٌ حُجز ولم
     يصر تسجيلا بعد. فهي بانتظار الشعبة عملا، لا مرحلةً يُفتح عملُها. */
  return item.state === 'enrolled' ? 'awaiting_cohort' : item.state
}

function stageOf(courseId: string, fact: Fact | undefined, item: JourneyPlanItem | null): JourneyStage | null {
  const c = courseById(courseId)
  /* دورةٌ خارج الكتالوج المنشور: لا عنوانَ يُختلق لها ولا مرحلةَ تُعرض */
  if (!c) return null
  const full = courseFullById(courseId)
  return {
    courseId,
    titleAr: c.name,
    termEn: c.termEn ?? null,
    hours: full?.totalHours ?? 0,
    weeks: c.weeks,
    state: stateOf(fact, item),
    percent: fact ? (fact.percent ?? 0) : null,
    enrollmentId: fact?.enrollmentId ?? null,
    cohortTitle: fact?.cohortTitle ?? null,
    certificate: fact?.certificate ?? null,
    isGift: item?.isGift === true,
    inPlan: item !== null,
    requestPending: item?.requestPending === true,
    planCohort: item?.cohort ?? null,
  }
}

/** المسارُ الواحد إن كانت مراحلُه كلُّها منه — وإلّا فلا مسارَ يُنسب إليه */
function soloPathwayOf(stages: readonly JourneyStage[]): string | null {
  const ids = new Set<string>()
  for (const s of stages) {
    const p = courseById(s.courseId)?.pathwayId
    if (p) ids.add(p)
  }
  return ids.size === 1 ? [...ids][0] : null
}

function trackOf(
  kind: JourneyTrack['kind'],
  id: string,
  titleAr: string,
  subtitleAr: string | null,
  stages: JourneyStage[],
  pathwayId: string | null,
): JourneyTrack {
  const owned = stages.filter((s) => STAGE_IS_OPEN[s.state])
  const completed = stages.filter((s) => s.state === 'completed')
  /* «أنت هنا» على ما يستطيع العملَ فيه الآن — لا على أوّل ما لم يُنجَز.
     فمن أنجز الأولى ولم يشترِ الثانية، موضعُه ثالثةٌ يملكها لا ثانيةٌ لا
     يملكها: سهمٌ يشير إلى بابٍ مغلق يُقرأ عطبا. */
  const workable = stages.findIndex((s) => s.state === 'in_progress' || s.state === 'enrolled')
  const currentIndex = workable !== -1 ? workable : stages.findIndex((s) => s.state !== 'completed')
  return {
    kind,
    id,
    titleAr,
    subtitleAr,
    pathwayId,
    capstoneAr: pathwayId ? (pathwayById(pathwayId)?.output ?? null) : null,
    stages,
    currentIndex,
    counts: { total: stages.length, owned: owned.length, completed: completed.length },
    hours: {
      total: stages.reduce((s, n) => s + n.hours, 0),
      done: completed.reduce((s, n) => s + n.hours, 0),
    },
  }
}

/** الرحلةُ كلُّها: مسارٌ أو أكثر، وكلُّ ما يملكه المتعلّم داخلَ واحدٍ منها */
export function buildJourney(rows: readonly JourneyRow[], plan: JourneyPlan | null): JourneyTrack[] {
  const facts = factsOf(rows)
  const tracks: JourneyTrack[] = []
  const claimed = new Set<string>()

  /* ١) خطّتُه المعتمَدة — باسمها الذي اعتمده */
  if (plan && plan.items.length > 0) {
    const items = [...plan.items].sort((a, b) => a.sequence - b.sequence)
    const stages: JourneyStage[] = []
    for (const it of items) {
      const s = stageOf(it.courseId, facts.get(it.courseId), it)
      if (!s) continue
      stages.push(s)
      claimed.add(it.courseId)
    }
    if (stages.length > 0) {
      tracks.push(trackOf('plan', plan.id, plan.nameAr, 'خطّتك كما اعتمدتها', stages, soloPathwayOf(stages)))
    }
  }

  /* ٢) ما يملكه خارج الخطّة، مجموعا بمساره — ودورتان شرطُ أن يُسمَّى مسارا */
  const byPathway = new Map<string, string[]>()
  const loners: string[] = []
  for (const courseId of facts.keys()) {
    if (claimed.has(courseId)) continue
    const pathwayId = courseById(courseId)?.pathwayId
    if (!pathwayId) { loners.push(courseId); continue }
    const list = byPathway.get(pathwayId) ?? []
    list.push(courseId)
    byPathway.set(pathwayId, list)
  }

  for (const [pathwayId, ownedIds] of byPathway) {
    if (ownedIds.length < 2) { loners.push(...ownedIds); continue }
    /* ترتيبُ الكتالوج لا ترتيبُ الشراء: للمسار تسلسلٌ مقصود. وما يملكه خارج
       قائمته (دورةٌ مساندة) يُلحَق آخرا — يُعرض ولا يُدَسّ في التسلسل. */
    const designed = pathwayCourses[pathwayId] ?? []
    const extra = ownedIds.filter((id) => !designed.includes(id))
    const stages: JourneyStage[] = []
    for (const courseId of [...designed, ...extra]) {
      const s = stageOf(courseId, facts.get(courseId), null)
      if (s) stages.push(s)
    }
    if (stages.length === 0) continue
    tracks.push(trackOf('pathway', pathwayId, pathwayById(pathwayId)?.name ?? pathwayId, 'مسار كامل', stages, pathwayId))
  }

  /* ٣) الفرادى — «دورات مستقلّة»، لا تُنسَب إلى مسارٍ لم يسلكه */
  if (loners.length > 0) {
    const stages: JourneyStage[] = []
    for (const courseId of loners) {
      const s = stageOf(courseId, facts.get(courseId), null)
      if (s) stages.push(s)
    }
    if (stages.length > 0) {
      tracks.push(trackOf('standalone', 'standalone', 'دورات مستقلّة', 'دورات اخترتها وحدها', stages, null))
    }
  }

  return tracks
}

/** أيُّ مسارٍ يُفتح أوّلا: ما فيه عملٌ قائم، وإلّا أوّلُ ما في القائمة */
export function defaultTrackId(tracks: readonly JourneyTrack[]): string | null {
  if (tracks.length === 0) return null
  const busy = tracks.find((t) => t.stages.some((s) => s.state === 'in_progress' || s.state === 'enrolled'))
  return (busy ?? tracks[0]).id
}

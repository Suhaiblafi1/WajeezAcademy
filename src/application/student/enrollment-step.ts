/* خطوةُ التسجيل التالية — حسابٌ واحدٌ لصفحة الدورة وشاشة الدراسة والرئيسيّة (٢٧ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «C both» — شاشةُ الدراسة ثمّ الرئيسيّةُ تفتح على «خطوتك
   التالية» عبر دوراته كلِّها. فكانت الخطوةُ تُحسب داخل `StageWork` وحدَه؛ ولو
   حسبتها الرئيسيّةُ لنفسها لقالت «سلّم كذا» والدورةُ تقول «اقرأ كذا». فصارت هنا
   على طبقتين:
     • `cohortPath` — الطريقُ والمقروءُ والأثر. لا يتغيّر بالساعة، فيُحفظ ما دام
       التسجيلُ نفسَه (وكان يُعاد كلَّ دقيقةٍ مع نبضة الساعة: تحليلُ كلِّ متنٍ من جديد).
     • `stepFor` — الخطوةُ وحدَها، وهي التي تتبع الساعة.
   وشاشةُ الدراسة تقرأ الطريقَ نفسَه (`cohortModules` و`cohortPath`) — فلا تُبنى قائمةُ
   محاورها ولا طريقُها في موضعٍ ثالث.

   ثمّ **أيُّ خطوةٍ تُقدَّم حين تتعدّد الدورات** (`pickNextStep`): الأشدُّ إلحاحا
   بالترتيب نفسِه الذي تختار به الدورةُ خطوتَها (جلسةٌ الآن ← إعادةٌ مطلوبة ←
   تسليم ← قراءة ← جلسةٌ قادمة ← عملٌ عند مدرّبه ← محطّةٌ تفتح ← الشهادة)، وفي
   النوع الواحد الأقربُ موعدا. */

import { canSubmitNow, type EnrollmentDetail } from '@/services/enrollment-detail'
import { overlayModules, type CatalogModuleLike } from '../trainer/plan-overlay'
import {
  buildStagePath, evidenceOf, inPlanOnly, nextStep, readableModules,
  type NextStep, type StagePath,
} from './stage-path'

/** محاورُ الشعبة كما يراها متعلّمُها: الكتالوجُ تعلوه الخطّة، وما ليس فيها لا يُعرض */
export function cohortModules<T extends CatalogModuleLike>(catalog: readonly T[], detail: Pick<EnrollmentDetail, 'cohort'>) {
  return inPlanOnly(overlayModules(catalog, detail.cohort.trainerPlan), detail.cohort.trainerPlan)
}

type PathModuleIn = { id: string; title: string; locked?: boolean; opensAt?: string | null; body?: string | null; bodyFileKey?: string | null }

export interface CohortPath {
  path: StagePath
  readable: Set<string>
  evidence: ReturnType<typeof evidenceOf>
}

/** الطريقُ من التسجيل — بلا ساعة */
export function cohortPath(detail: EnrollmentDetail, modules: readonly PathModuleIn[]): CohortPath {
  const evidence = evidenceOf(detail)
  const readable = readableModules(modules)
  const path = buildStagePath({
    modules,
    slots: detail.cohort.trainerPlan?.slots ?? [],
    sessions: detail.cohort.sessions,
    assessments: detail.cohort.assessments,
    doneModules: evidence.doneModules,
    attended: evidence.attended,
    accepted: evidence.accepted,
  })
  return { path, readable, evidence }
}

/** والخطوةُ على الطريق — وهي التي تتبع الساعة */
export function stepFor(detail: EnrollmentDetail, modules: readonly PathModuleIn[], cp: CohortPath, now: number): NextStep | null {
  const { latest } = cp.evidence
  const when = new Date(now)
  const submittable = new Set(detail.cohort.assessments.filter((a) => canSubmitNow(detail, a, when)).map((a) => a.id))
  return nextStep({
    path: cp.path,
    modules,
    sessions: detail.cohort.sessions,
    assessments: detail.cohort.assessments,
    submittable,
    resubmit: new Set([...submittable].filter((id) => latest.get(id)?.status === 'resubmit_requested')),
    inReview: new Set([...latest].filter(([, s]) => s.status === 'submitted' || s.status === 'under_review').map(([id]) => id)),
    readable: cp.readable,
    doneModules: cp.evidence.doneModules,
    now,
  })
}

export interface EnrollmentStep {
  path: StagePath
  step: NextStep | null
}

/** الاثنان معا — للرئيسيّة، وهي لا تحفظ الطريقَ بين نبضات الساعة */
export function enrollmentStep(detail: EnrollmentDetail, modules: readonly PathModuleIn[], now: number): EnrollmentStep {
  const cp = cohortPath(detail, modules)
  return { path: cp.path, step: stepFor(detail, modules, cp, now) }
}

/* ═══ أيُّ دورةٍ تُقدَّم خطوتُها ═══ */
const RANK: Record<NextStep['kind'], number> = {
  live: 0, resubmit: 1, submit: 2, read: 3, session: 4, review: 5, wait: 6, finish: 7,
}

/** موعدُ الخطوة إن كان لها موعد — بها يُفاضَل بين خطوتين من نوعٍ واحد */
function dueOf(s: NextStep): string | null {
  if (s.kind === 'submit') return s.dueAt
  if (s.kind === 'session') return s.startsAt
  if (s.kind === 'wait') return s.opensAt
  return null
}

export function pickNextStep<T extends { step: NextStep | null }>(candidates: readonly T[]): T | null {
  let best: T | null = null
  for (const c of candidates) {
    if (!c.step) continue
    if (!best || !best.step) { best = c; continue }
    const r = RANK[c.step.kind] - RANK[best.step.kind]
    if (r < 0) { best = c; continue }
    if (r > 0) continue
    /* النوعُ نفسُه: الأقربُ موعدا، وما لا موعدَ له بعد ما له موعد */
    const a = dueOf(c.step)
    const b = dueOf(best.step)
    if (a && (!b || a < b)) best = c
  }
  return best
}

/* ═══ موضعُ الجلسة المسجّلة — محورُها ويومُ فتحها — يسري بلا اعتماد، ولو بعد اعتماد الخطّة ═══

   سُئل صاحبُ المنصّة (٢٨ سبتمبر ٢٠٢٦): أيحتاج تغييرُ محاور لقاءٍ بعد اعتماد
   الخطّة اعتمادَ الإدارة؟ فقال: «no need for admin approval for links… access
   to whatever». واللقاءُ المباشرُ كان يفعل ذلك من قبل: محاورُه على صفّه، وربطُه
   لا يمسّ اعتمادَه (`cohort.service` `trainerSetSessionAxes`). أمّا الجلسةُ
   المسجّلة فموضعُها في محتوى الخطّة نفسِه، فكان تغييرُه بعد الاعتماد مراجعةً
   تنتظر الإدارة. فسُئل عنها فقال: «no need for approval for this!» — فسرى محورُها
   وبقي يومُ فتحها في المراجعة، كموعد اللقاء المباشر الذي يُعتمَد نقلُه. ثمّ قال:
   «free the recording's opening day too».

   والفرقُ بينها وبين اللقاء المباشر أنّ المسجّلةَ لا يحضرها أحدٌ في ساعتها: تُفتح
   من لحظتها وتبقى، فنقلُ يومها لا يُخلي موعدا في تقويم أحد. ونقلُ المباشر باقٍ
   على قاعدته (`postpone.ts`).

   فحفظُ الخطّة يقرأ ما تغيّر من موضع الجلسات المسجّلة عن الخطّة التي يراها
   المتعلّمون، ويكتبه فيها لحظتَه (`CohortPlanService.savePlan`). وما سواه في
   الحفظ نفسِه — اسمُها ورابطُها، وما يُضاف منها أو يُزال، وكلُّ ما في الخطّة
   غيرُها — مراجعةٌ تنتظر كما كانت.

   ─────────── ومتى تُعرف أنّها هي ───────────

   لا مُعرِّفَ للمصدر في الخطّة. فالجلسةُ تُعرف برابطها (أو ملفّها) بين
   النسختين: رابطٌ واحدٌ هنا وواحدٌ هناك. وما تكرّر رابطُه، أو تغيّر رابطُه مع
   موضعه، لا يُخمَّن — يبقى في المراجعة.

   ─────────── وأيُّ موضعٍ يسري ───────────

   الموضعُ كلُّه أو لا شيء منه: محورُها ويومُ فتحها كما جاءا في الحفظ، إن كانا معا
   موضعا صحيحا في الخطّة المعتمَدة نفسِها —

   · **محورٌ له موعدٌ فيها**: فمحورٌ جديدٌ في المراجعة لم يُعتمَد بعد لا تُربط به
     جلسةٌ في خطّةٍ لا تعرفه — يسري ربطُها إليه حين تُعتمَد. ولا تُفكّ جلسةٌ من
     محورها هنا: الشاشةُ لا تفعله.
   · **ويومٌ داخلَ موعد ذلك المحور**: بالقاعدة التي يحجب بها الإرسالُ نفسِها
     (`opensInsideSlot`). فالمعتمَدةُ لا تصير بحفظٍ واحدٍ خطّةً كان إرسالُها سيُردّ.

   وما ليس كذلك يبقى في المراجعة كلُّه. والشاشةُ لا تُنتج غيرَ الصحيح: تغييرُ المحور
   في بطاقة موعده بين محاوره هو، ونقلُ جلسةٍ إلى موعدٍ آخرَ يضع يومَها داخله.
   والخطّةُ قبل المواعيد لا موعدَ فيها يُقاس به: يكفي محورٌ منها ويومٌ صحيح أو لا يوم. */

import { resourceCategory } from './plan-overlay'
import { opensInsideSlot } from './axis-timeline'

interface PlaceableResource {
  title: string
  url?: string | null
  bodyFileKey?: string | null
  category?: string | null
  kind?: string | null
  moduleId?: string | null
  opensAt?: string | null
}

interface PlaceablePlan {
  modules?: readonly { moduleId: string }[] | null
  slots?: readonly { startsOn: string; endsOn: string; moduleIds: readonly string[] }[] | null
  resources?: readonly PlaceableResource[] | null
}

/** جلسةٌ مسجّلةٌ تغيّر موضعُها — وموضعُها في مصادر الخطّة المعتمَدة، وما تغيّر منه وحدَه */
export interface RecordedPlacement {
  index: number
  title: string
  /** محورُها قبلُ وبعدُ — إن تغيّر */
  moduleId?: { from: string | null; to: string }
  /** لحظةُ فتحها قبلُ وبعدُ — إن تغيّرت */
  opensAt?: { from: string | null; to: string | null }
}

/** ما تُعرف به الجلسةُ بين نسختين — رابطُها أو ملفُّها */
const identityOf = (r: PlaceableResource): string | null => r.url?.trim() || r.bodyFileKey?.trim() || null

function recordedByIdentity(plan: PlaceablePlan): Map<string, number[]> {
  const out = new Map<string, number[]>()
  ;(plan.resources ?? []).forEach((r, i) => {
    if (resourceCategory(r) !== 'recorded') return
    const id = identityOf(r)
    if (id) out.set(id, [...(out.get(id) ?? []), i])
  })
  return out
}

/** اللحظةُ رقما — فالصيغتان للحظةٍ واحدةٍ لحظةٌ واحدة، وما لا يُقرأ لا لحظة */
function instant(v: string | null | undefined): number | null {
  if (!v) return null
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? null : t
}

/** أموضعٌ صحيحٌ في الخطّة المعتمَدة؟ — محورٌ له موعدٌ فيها ويومٌ داخله، أو قبل المواعيد محورٌ منها */
function placeable(plan: PlaceablePlan, axis: string | null, opensAt: string | null): boolean {
  if (!axis) return false
  const slots = plan.slots ?? []
  if (slots.length === 0) {
    return (plan.modules ?? []).some((m) => m.moduleId === axis) && (opensAt === null || instant(opensAt) !== null)
  }
  const slot = slots.find((s) => s.moduleIds.includes(axis))
  return slot !== undefined && opensInsideSlot(opensAt, slot)
}

/** ما تغيّر من موضع الجلسات المسجّلة بين المعتمَدة وما يُحفظ الآن — وكان موضعا صحيحا فيها */
export function recordedPlacements(approved: PlaceablePlan, incoming: PlaceablePlan): RecordedPlacement[] {
  const after = recordedByIdentity(incoming)
  const out: RecordedPlacement[] = []
  for (const [id, at] of recordedByIdentity(approved)) {
    const there = after.get(id)
    if (at.length !== 1 || there?.length !== 1) continue
    const was = approved.resources![at[0]]
    const now = incoming.resources![there[0]]
    const fromAxis = was.moduleId ?? null
    const toAxis = now.moduleId?.trim() || null
    const fromOpens = was.opensAt ?? null
    const toOpens = now.opensAt ?? null
    const axisMoved = toAxis !== fromAxis
    const dayMoved = instant(toOpens) !== instant(fromOpens)
    if (!axisMoved && !dayMoved) continue
    if (!placeable(approved, toAxis, toOpens)) continue
    out.push({
      index: at[0], title: was.title,
      ...(axisMoved ? { moduleId: { from: fromAxis, to: toAxis! } } : {}),
      ...(dayMoved ? { opensAt: { from: fromOpens, to: toOpens } } : {}),
    })
  }
  return out
}

/** الخطّةُ المعتمَدةُ وقد سرى فيها ما تغيّر من موضع جلساتها المسجّلة — وما سواه كما كان */
export function applyRecordedPlacements<T extends PlaceablePlan>(plan: T, placements: readonly RecordedPlacement[]): T {
  if (placements.length === 0) return plan
  const resources = [...(plan.resources ?? [])]
  for (const p of placements) {
    resources[p.index] = {
      ...resources[p.index],
      ...(p.moduleId ? { moduleId: p.moduleId.to } : {}),
      ...(p.opensAt ? { opensAt: p.opensAt.to } : {}),
    }
  }
  return { ...plan, resources }
}

/** أهما المحتوى نفسُه؟ — بلا اعتبارٍ لترتيب المفاتيح، ولا لمفتاحٍ قيمتُه `undefined`
    (كما يحفظه JSON). فحفظٌ لم يغيّر غيرَ موضع الجلسات لا يفتح مراجعةً فارغة */
export function samePlanContent(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b)
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>
    const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v) ?? 'null'
}

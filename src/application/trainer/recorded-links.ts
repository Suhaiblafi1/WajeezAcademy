/* ═══ محورُ الجلسة المسجّلة — يسري بلا اعتماد، ولو بعد اعتماد الخطّة (٢٨ سبتمبر ٢٠٢٦) ═══

   سُئل صاحبُ المنصّة: أيحتاج تغييرُ محاور لقاءٍ بعد اعتماد الخطّة اعتمادَ
   الإدارة؟ فقال: «no need for admin approval for links… access to whatever».
   واللقاءُ المباشرُ كان يفعل ذلك من قبل: محاورُه على صفّه، وربطُه لا يمسّ
   اعتمادَه (`cohort.service` `trainerSetSessionAxes`). أمّا الجلسةُ المسجّلة
   فمحورُها في محتوى الخطّة نفسِه، فكان تغييرُه بعد الاعتماد مراجعةً تنتظر
   الإدارة. فسُئل عنها فقال: «no need for approval for this!».

   فحفظُ الخطّة يقرأ ما تغيّر من محاور الجلسات المسجّلة عن الخطّة التي يراها
   المتعلّمون، ويكتبه فيها لحظتَه (`CohortPlanService.savePlan`). وما سواه في
   الحفظ نفسِه — اسمُها ورابطُها ويومُ فتحها، وما يُضاف منها أو يُزال، وكلُّ ما
   في الخطّة غيرُها — مراجعةٌ تنتظر كما كانت.

   ويومُ الفتح منها عمدا: هو موعدُ الجلسة، كموعد اللقاء المباشر الذي يُعتمَد
   نقلُه. والقرارُ في الربط؛ واللقاءان «نفسُ الأثر» (صاحبُ المنصّة، ٢٧ سبتمبر
   ٢٠٢٦) فحكمُهما واحد: الربطُ بلا اعتماد، والموعدُ باعتماده.

   ─────────── ومتى تُعرف أنّها هي ───────────

   لا مُعرِّفَ للمصدر في الخطّة. فالجلسةُ تُعرف برابطها (أو ملفّها) بين
   النسختين: رابطٌ واحدٌ هنا وواحدٌ هناك. وما تكرّر رابطُه، أو تغيّر رابطُه مع
   محوره، لا يُخمَّن — يبقى في المراجعة.

   ─────────── وإلى أيّ محور ───────────

   إلى محورٍ في الخطّة المعتمَدة نفسِها، له موعدٌ فيها. فمحورٌ جديدٌ في المراجعة
   لم يُعتمَد بعد لا تُربط به جلسةٌ في خطّةٍ لا تعرفه — يسري ربطُها إليه حين
   تُعتمَد المراجعة. ولا تُفكّ جلسةٌ من محورها هنا: الشاشةُ لا تفعله، وجلسةٌ بلا
   محورٍ تُفتح بيومها وحده في خطّةٍ لها مواعيد. */

import { resourceCategory } from './plan-overlay'

interface LinkableResource {
  title: string
  url?: string | null
  bodyFileKey?: string | null
  category?: string | null
  kind?: string | null
  moduleId?: string | null
}

interface LinkablePlan {
  modules?: readonly { moduleId: string }[] | null
  slots?: readonly { moduleIds: readonly string[] }[] | null
  resources?: readonly LinkableResource[] | null
}

/** جلسةٌ مسجّلةٌ تغيّر محورُها — وموضعُها في مصادر الخطّة المعتمَدة */
export interface RecordedRelink {
  index: number
  title: string
  from: string | null
  to: string
}

/** ما تُعرف به الجلسةُ بين نسختين — رابطُها أو ملفُّها */
const identityOf = (r: LinkableResource): string | null => r.url?.trim() || r.bodyFileKey?.trim() || null

function recordedByIdentity(plan: LinkablePlan): Map<string, number[]> {
  const out = new Map<string, number[]>()
  ;(plan.resources ?? []).forEach((r, i) => {
    if (resourceCategory(r) !== 'recorded') return
    const id = identityOf(r)
    if (id) out.set(id, [...(out.get(id) ?? []), i])
  })
  return out
}

/** محاورُ الخطّة التي تُربط بها جلسة — ما له موعدٌ فيها، أو محاورُها إن لم تكن لها مواعيد */
function linkableAxes(plan: LinkablePlan): Set<string> {
  const slots = plan.slots ?? []
  return new Set(slots.length > 0 ? slots.flatMap((s) => s.moduleIds) : (plan.modules ?? []).map((m) => m.moduleId))
}

/** ما تغيّر من محاور الجلسات المسجّلة بين المعتمَدة وما يُحفظ الآن */
export function recordedRelinks(approved: LinkablePlan, incoming: LinkablePlan): RecordedRelink[] {
  const axes = linkableAxes(approved)
  const after = recordedByIdentity(incoming)
  const out: RecordedRelink[] = []
  for (const [id, at] of recordedByIdentity(approved)) {
    const there = after.get(id)
    if (at.length !== 1 || there?.length !== 1) continue
    const was = approved.resources![at[0]]
    const to = incoming.resources![there[0]].moduleId?.trim() || null
    const from = was.moduleId ?? null
    if (!to || to === from || !axes.has(to)) continue
    out.push({ index: at[0], title: was.title, from, to })
  }
  return out
}

/** الخطّةُ المعتمَدةُ وقد سرى فيها ما تغيّر من محاور جلساتها المسجّلة — وما سواه كما كان */
export function applyRecordedRelinks<T extends LinkablePlan>(plan: T, relinks: readonly RecordedRelink[]): T {
  if (relinks.length === 0) return plan
  const resources = [...(plan.resources ?? [])]
  for (const r of relinks) resources[r.index] = { ...resources[r.index], moduleId: r.to }
  return { ...plan, resources }
}

/** أهما المحتوى نفسُه؟ — بلا اعتبارٍ لترتيب المفاتيح، ولا لمفتاحٍ قيمتُه `undefined`
    (كما يحفظه JSON). فحفظٌ لم يغيّر غيرَ المحاور لا يفتح مراجعةً فارغة */
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

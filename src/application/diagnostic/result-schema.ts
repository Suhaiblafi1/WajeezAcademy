/* مخطط النتيجة المحفوظة — نسخة وتحقق وترحيل آمن.
   القاعدة: نتيجة قديمة لا نفهم بنيتها أو تشير لمسار/قالب غير موجود في الكتالوج الحالي
   تُحذف بأمان وتُستبدل برسالة تطلب إعادة التشخيص — لا صفحة فارغة أبدا. */

import type { DiagResult } from '../../data/diagnostic'
import { pathways } from '../../data/pathways'
import templatesJson from '../../data/catalog/composite-templates.v1.json'

export const RESULT_SCHEMA_VERSION = 2

/* ⚠ تُحسب عند كل نداء لا مرة واحدة عند تحميل الوحدة.
   السبب (انحدار كشفه البند ط-١ بعد ع-١): الكتالوج صار يُثبَّت كسولا، فمصفوفة
   pathways تكون فارغة لحظة تحميل هذه الوحدة. لقطة عند التحميل كانت تجعل
   referencesAlive ترفض كل نتيجة محفوظة، وreadStoredResult تعيد discarded،
   فتُحذف نتيجة المتعلم من جهازه بلا سبب. القراءة الحيّة تمنع ذلك. */
const validPathwayIds = () => new Set(pathways.map((p) => p.id))
const validTemplateIds = () =>
  new Set((templatesJson as { templates: { template_id: string }[] }).templates.map((t) => t.template_id))

export type StoredResultRead =
  | { status: 'ok'; result: DiagResult }
  | { status: 'migrated'; result: DiagResult }
  | { status: 'discarded'; reason_ar: string }
  | { status: 'none' }

const DISCARD_REASON_AR =
  'نتيجتك السابقة أصبحت غير صالحة بعد تحديث نظام التشخيص — أعد المؤشر من جديد، لن يأخذ أكثر من دقائق.'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

/** يتحقق أن القيمة تصلح نتيجة عرض كاملة وفق المخطط الحالي */
function validateShape(r: unknown): r is DiagResult {
  if (!isObj(r)) return false
  /* top قد يكون null عمدًا (اتجاه استكشافي / إحالة مستشار بلا مرشح) —
     referencesAlive يفرض وجوده لنتائج المسار والخطة المركبة */
  if (r.top !== null && (!isObj(r.top) || typeof r.top.id !== 'string' || typeof r.top.name !== 'string')) return false
  if (typeof r.confidence !== 'number' || typeof r.confidenceBand !== 'string') return false
  if (!isStrArray(r.reasons) || !isStrArray(r.gaps) || !isStrArray(r.changeMakers)) return false
  if (!Array.isArray(r.gapDetails)) return false
  if (!isObj(r.resultJson) || typeof r.resultJson.kind !== 'string') return false
  return true
}

/** يتحقق أن مراجع النتيجة (مسار/قالب) موجودة في الكتالوج الحي الحالي */
function referencesAlive(r: DiagResult): boolean {
  const kind = r.resultJson.kind
  if (kind === 'composite_template') {
    const comp = r.resultJson.composite
    if (!isObj(comp) || typeof comp.template_id !== 'string' || !validTemplateIds().has(comp.template_id)) return false
  }
  /* نتائج بلا مسار مفروض — المسار حينها غير إلزامي */
  if (kind === 'advisor_referral' || kind === 'guardrail_stop' || kind === 'exploratory_direction') return true
  return r.top !== null && validPathwayIds().has(r.top.id)
}

/** يملأ الحقول الاختيارية الناقصة بقيم آمنة — ترحيل لا يخترع محتوى */
function fillDefaults(r: DiagResult): DiagResult {
  return {
    ...r,
    faster: r.faster ?? null,
    cheaper: r.cheaper ?? null,
    needsAdvisor: Boolean(r.needsAdvisor),
    unavailableSkills: isStrArray(r.unavailableSkills) ? r.unavailableSkills : [],
    priorOverlap: isStrArray(r.priorOverlap) ? r.priorOverlap : [],
    reconciled: r.reconciled ?? true,
    secondGoal: r.secondGoal ?? null,
  }
}

/**
 * يقرأ نتيجة محفوظة من أي إصدار:
 * - v2 مغلفة بـ schema_version → تحقق صارم.
 * - v1 عارية (بلا غلاف) → ترحيل إن كانت البنية سليمة والمراجع حية.
 * - غير ذلك → discard بأمان.
 */
export function readStoredResult(raw: string | null): StoredResultRead {
  if (!raw) return { status: 'none' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'discarded', reason_ar: DISCARD_REASON_AR }
  }
  if (!isObj(parsed)) return { status: 'discarded', reason_ar: DISCARD_REASON_AR }

  /* الغلاف الحديث */
  if (parsed.schema_version === RESULT_SCHEMA_VERSION && isObj(parsed.result)) {
    const candidate: unknown = parsed.result
    if (validateShape(candidate) && referencesAlive(candidate)) return { status: 'ok', result: candidate }
    return { status: 'discarded', reason_ar: DISCARD_REASON_AR }
  }

  /* نتيجة عارية قديمة (v1 بلا غلاف) — نرحّلها إن كان آمنا */
  if (isObj(parsed.top)) {
    if (validateShape(parsed) && referencesAlive(parsed)) {
      return { status: 'migrated', result: fillDefaults(parsed) }
    }
    return { status: 'discarded', reason_ar: DISCARD_REASON_AR }
  }

  return { status: 'discarded', reason_ar: DISCARD_REASON_AR }
}

/** يغلف النتيجة للحفظ بإصدار المخطط الحالي */
export function wrapResultForStorage(result: DiagResult): string {
  return JSON.stringify({
    schema_version: RESULT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    result,
  })
}

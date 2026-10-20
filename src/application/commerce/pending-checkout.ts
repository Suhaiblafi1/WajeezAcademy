/* الشراءُ الذي بدأه ولم يتمّه — يُحفظ على الجهاز ليعود إليه (٢٠ أكتوبر ٢٠٢٦، الخطوة ل).

   كان الاختيارُ يعيش في حالة الصفحة وحدَها: زائرٌ اختار دورةً وشعبتَها، فسجّل، فطُلب منه توثيقُ بريده
   — ورابطُ التوثيق يُفتح في تبويبٍ جديدٍ ينتهي إلى «منصّتي». فيضيع ما اختاره، ويعود يختاره من جديد
   (و«رحلتي» تقترح عليه أقربَ شعبةٍ لا ما اختار). فيُحفظ هنا ما يُعاد به اللوحُ كما تركه: الصفحةُ،
   ونيّةُ الشراء، والشعبةُ لكلّ دورة. ويُمحى حين يُنشأ طلبُه.

   وما يُقرأ من التخزين يُفحص هنا: مسارٌ من صفحتَي الشراء وحدَهما، ومعرّفاتٌ بشكلها، وعمرٌ لا يتجاوز
   أسبوعا — فلا يصير التخزينُ بابا يُوجَّه منه أحدٌ إلى غير ما بدأه. */

export const PENDING_CHECKOUT_KEY = 'wajeez_pending_checkout'
/** أسبوعٌ ثمّ يُنسى — من عاد بعده يبدأ من صفحته لا من نيّةٍ قديمة */
export const PENDING_CHECKOUT_TTL_MS = 7 * 86_400_000

export interface PendingIntent {
  title: string
  amount: number
  kind: 'pathway' | 'course' | 'courses'
  courseIds: string[]
}

export interface PendingCheckout {
  /** صفحةُ القرار — `/pathways/:id` أو `/build/:courseId` أو `/grant/:pathwayId` */
  path: string
  intent: PendingIntent
  /** الشعبةُ التي اختارها لكلّ دورة */
  cohortByCourse: Record<string, string>
  at: number
}

/* و`/grant/:id` مسارُ منحةٍ اختاره من صفحة الحملة (٢٠ أكتوبر ٢٠٢٦، `MemberGrantPage`) */
const PATH_RE = /^\/(pathways|build|grant)\/[A-Za-z0-9_-]{1,80}$/
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/
const KINDS = new Set(['pathway', 'course', 'courses'])

/** يقرأ المحفوظَ ويفحصه — أو `null` إن لم يصحّ أو شاخ */
export function parsePendingCheckout(raw: string | null, now: number): PendingCheckout | null {
  if (!raw) return null
  let v: unknown
  try { v = JSON.parse(raw) } catch { return null }
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const i = (o.intent ?? {}) as Record<string, unknown>
  if (typeof o.path !== 'string' || !PATH_RE.test(o.path)) return null
  if (typeof o.at !== 'number' || now - o.at > PENDING_CHECKOUT_TTL_MS || o.at - now > 60_000) return null
  if (typeof i.title !== 'string' || i.title.length > 200 || typeof i.kind !== 'string' || !KINDS.has(i.kind)) return null
  const courseIds = Array.isArray(i.courseIds) ? i.courseIds.filter((c): c is string => typeof c === 'string' && ID_RE.test(c)) : []
  if (courseIds.length === 0) return null
  const cohortByCourse: Record<string, string> = {}
  for (const [k, c] of Object.entries((o.cohortByCourse ?? {}) as Record<string, unknown>)) {
    if (ID_RE.test(k) && typeof c === 'string' && ID_RE.test(c)) cohortByCourse[k] = c
  }
  return {
    path: o.path,
    intent: { title: i.title, amount: typeof i.amount === 'number' ? i.amount : 0, kind: i.kind as PendingIntent['kind'], courseIds },
    cohortByCourse,
    at: o.at,
  }
}

/** رابطُ العودة إلى اللوح كما تُرك */
export function resumeHref(p: PendingCheckout): string {
  return `${p.path}?resume=1`
}

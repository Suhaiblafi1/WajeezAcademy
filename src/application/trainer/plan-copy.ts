/* ═══ «انسخ من شعبةٍ أخرى» — المحاورُ والمهامُّ والمصادر، والتواريخُ وحدَها تتبدّل (١١ أكتوبر ٢٠٢٦) ═══

   من ملفّ صاحب المنصّة «تحسينات بوابة مدرّب وجيز»: «المدرّبُ صاحبُ عدّة شعبٍ لنفس
   الدورة يعيد المحاورَ والمهامَّ والمصادرَ يدويّا. النسخُ مع تعديل التواريخ فقط يوفّر
   ساعات».

   فهنا المحضُ: إزاحةُ كلّ تاريخٍ في الخطّة بالفرق بين بدءِ المنسوخ منها وبدءٍ جديد
   يختاره المدرّب — المدّةُ ومواعيدُ المحاور ولحظاتُ فتح الجلسات المسجّلة ومواعيدُ
   المهامّ — فيبقى الإيقاعُ كما بناه، أسبوعا بأسبوع. والملفّاتُ تُنسخ في الخادم بمفاتيحَ
   جديدة (`cohort-copy.service.ts`): ملفُّ الشعبة يُقرأ بصلاحيّة شعبته، فلا يُشار من
   شعبةٍ إلى ملفّ أخرى. واللقاءاتُ المباشرةُ لا تُنسخ: لها اعتمادٌ واجتماعٌ وموعدٌ في
   تقويم المدرّب — تُضاف من «اللقاءات»، والتكرارُ الأسبوعيُّ يجعلها دقيقة. */

const DAY = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

/** الفرقُ بالأيّام بين يومين `YYYY-MM-DD` — أو `null` */
export function daysBetween(from: string, to: string): number | null {
  if (!DAY.test(from) || !DAY.test(to)) return null
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

/** يومٌ مُزاحٌ بعدد أيّام */
export function shiftDay(day: string, days: number): string {
  if (!DAY.test(day)) return day
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** لحظةٌ مُزاحةٌ بعدد أيّام — الساعةُ كما هي */
export function shiftInstant(at: string | Date | null | undefined, days: number): string | null {
  if (!at) return null
  const t = new Date(at).getTime()
  return Number.isNaN(t) ? null : new Date(t + days * DAY_MS).toISOString()
}

/* ═══ وكلُّ موعدٍ في بنيةٍ لا يُعرف شكلُها — بطاقاتُ التعديل ولقطاتُها (٢٠ أكتوبر ٢٠٢٦) ═══
   بطاقةُ «قبل/بعد» تحمل مواعيدَ في ثمانية عشر شكلا (`plan-edits.ts`): لقاءٌ يُنقل، ومهمّةٌ بموعدها، وجدولٌ
   بسلسلته — ولقطةُ ما كان في موضعها مسطّحة. فحين تنتقل الشعبةُ إلى فصلٍ آخر (`cohort-move.service.ts`)
   يُزاح كلُّ نصٍّ هو **تاريخٌ كاملٌ لا غيرُه** — يومٌ `YYYY-MM-DD` أو لحظةٌ ISO — وما سواه كما هو: عنوانٌ فيه
   تاريخٌ نصٌّ لا موعد. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/

/** البنيةُ نفسُها بكلّ يومٍ ولحظةٍ فيها مُزاحا أيّاما */
export function shiftDatesIn<T>(value: T, days: number): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return DAY.test(v) ? shiftDay(v, days) : INSTANT.test(v) ? (shiftInstant(v, days) ?? v) : v
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
    return v
  }
  return walk(value) as T
}

interface CopyableSlot { startsOn: string; endsOn: string; moduleIds: string[]; [k: string]: unknown }
interface CopyableResource { opensAt?: string | null; [k: string]: unknown }
export interface CopyablePlan {
  startsOn?: string | null
  endsOn?: string | null
  slots?: CopyableSlot[] | null
  resources: CopyableResource[]
  [k: string]: unknown
}

/**
 * الخطّةُ بتواريخَ تبدأ من `startsOn` — وما سوى التواريخ كما هو.
 * و`null` حين لا مدّةَ للمنسوخ منها: لا يُعرف من أين تُزاح.
 */
export function shiftPlan<T extends CopyablePlan>(plan: T, startsOn: string): { plan: T; days: number } | null {
  if (!plan.startsOn || !plan.endsOn) return null
  const days = daysBetween(plan.startsOn, startsOn)
  if (days === null) return null
  return {
    days,
    plan: {
      ...plan,
      startsOn: shiftDay(plan.startsOn, days),
      endsOn: shiftDay(plan.endsOn, days),
      slots: plan.slots ? plan.slots.map((s) => ({ ...s, startsOn: shiftDay(s.startsOn, days), endsOn: shiftDay(s.endsOn, days) })) : plan.slots,
      resources: plan.resources.map((r) => (r.opensAt ? { ...r, opensAt: shiftInstant(r.opensAt, days) } : r)),
    },
  }
}

/** مفاتيحُ الملفّات في الخطّة كلِّها — متنُ المحور، والمصادر، والكرّاسات — لتُنسخ */
export function planFileKeys(plan: Record<string, unknown>): string[] {
  const out = new Set<string>()
  const visit = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(visit); return }
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      if (typeof o.bodyFileKey === 'string' && o.bodyFileKey.trim()) out.add(o.bodyFileKey.trim())
      Object.values(o).forEach(visit)
    }
  }
  visit(plan)
  return [...out]
}

/** يستبدل مفاتيحَ الملفّات بنُسخها — وما لم يُنسخ (غاب عن المخزن) يسقط ملفُّه ويبقى صفُّه */
export function remapFileKeys<T>(value: T, map: ReadonlyMap<string, string>): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const o = { ...(v as Record<string, unknown>) }
      for (const [k, x] of Object.entries(o)) o[k] = walk(x)
      if (typeof o.bodyFileKey === 'string' && o.bodyFileKey.trim()) {
        const next = map.get(o.bodyFileKey.trim())
        if (next) o.bodyFileKey = next
        else { o.bodyFileKey = null; o.bodyFileName = null; o.bodyFileMime = null }
      }
      return o
    }
    return v
  }
  return walk(value) as T
}

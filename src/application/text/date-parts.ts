/* تاريخٌ يُختار جزءا جزءا — يومٌ وشهرٌ وسنة، لا تقويمَ متصفّحٍ يُتنقّل فيه.

   ═══ لماذا فُصل المنطقُ عن المكوّن ═══

   الحسابُ هنا كلُّه حالاتٌ حدّيّة: ٢٩ فبراير في سنةٍ كبيسة، ويومٌ ٣١ يبقى
   معلَّقا حين يُبدَّل الشهرُ إلى فبراير، وسنةٌ تُكتب ولم يُختر شهرُها بعد.
   ولو سكن ذلك في المكوّن لم يُختبر إلّا بمتصفّح — وهذا المستودَع يختبر
   الوحدات في Node. فالمنطقُ دالّاتٌ خالصة، والمكوّنُ يناديها.

   والصيغةُ الواحدةُ في المنصّة كلِّها `yyyy-mm-dd` — هي ما يقبله
   `<input type="date">` وما يخزّنه الخادم، فلا يُترجَم شيءٌ عند الحدود. */

import { fmtDateWith } from '@/application/text/format-ar'

/** أجزاءُ التاريخ كما تُعرض في القوائم — نصوصٌ لأنّ `<option>` نصّيّة، و`''` = لم يُختر */
export interface DateParts {
  year: string
  month: string
  day: string
}

export const EMPTY_PARTS: DateParts = { year: '', month: '', day: '' }

/** كم يوما في هذا الشهر — و٣١ حين لا يُعرف الشهرُ بعد، فلا تُحجب أيّامٌ بلا سبب */
export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) return 31
  /* اليومُ صفرٌ من الشهر التالي = آخرُ أيّام هذا الشهر. وفبراير يحتاج السنةَ
     (الكبيسة ٢٩)، فإن لم تُختر بعد فُرض ٢٠٢٤ الكبيسة: الأوسعُ أسلمُ — يومٌ
     يُعرض ثمّ يُقصّ خيرٌ من يومٍ لا يُعرض أصلا. */
  const y = Number.isInteger(year) && year > 0 ? year : 2024
  return new Date(Date.UTC(y, month, 0)).getUTCDate()
}

/** `1985-07-09` ← أجزاؤه. وما ليس تاريخا يُردّ فارغا لا يُخمَّن */
export function splitIsoDay(value: string | null | undefined): DateParts {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? '').trim())
  if (!m) return EMPTY_PARTS
  return { year: m[1], month: String(Number(m[2])), day: String(Number(m[3])) }
}

/** أجزاؤه ← `1985-07-09`. وناقصٌ يُردّ `''`: نصفُ تاريخٍ ليس تاريخا */
export function joinIsoDay(parts: DateParts): string {
  const year = Number(parts.year)
  const month = Number(parts.month)
  const day = Number(parts.day)
  /* الفارغُ يصير صفرا عند `Number`، والحرفُ يصير `NaN` — فالفحصان أدناه
     يسعان الثلاثةَ معا، ولا يُزاد عليهما فحصُ فراغٍ ثالثٌ لا يردّ شيئا. */
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return ''
  if (year < 1 || month < 1 || month > 12 || day < 1) return ''
  /* ٣١ يناير ثمّ يُبدَّل الشهرُ إلى فبراير: يُقصّ إلى آخر يومٍ فيه ولا يُلغى
     الاختيارُ كلُّه — من بدّل الشهرَ لم يقصد أن يمحوَ ما اختار. */
  const clamped = Math.min(day, daysInMonth(year, month))
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`
}

/** أسماءُ الشهور كما تُطبع في الشاشات كلِّها — من المنسّق نفسِه فلا تفترق */
export const MONTHS_AR: readonly string[] = Array.from({ length: 12 }, (_, i) =>
  fmtDateWith(new Date(Date.UTC(2024, i, 15)), { month: 'long', timeZone: 'UTC' }),
)

/** سنواتُ القائمة بين حدَّين — والأحدثُ أوّلا لتاريخ ميلادٍ، والأقدمُ أوّلا لموعدٍ قادم */
export function yearChoices(from: number, to: number, order: 'asc' | 'desc' = 'desc'): number[] {
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const years: number[] = []
  for (let y = lo; y <= hi; y += 1) years.push(y)
  return order === 'desc' ? years.reverse() : years
}

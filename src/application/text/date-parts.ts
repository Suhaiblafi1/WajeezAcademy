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

/* ═══════════ التاريخُ يُكتب أرقاما — لا يُنتقى وحدَه (أ-٢) ═══════════

   القوائمُ الثلاثُ حلّت القفزَ إلى ١٩٨٥ في ضغطتَين، وبقيت الشكوى الثانية:
   «كتابةُ التاريخ أرقاما ما زالت صعبة… أريد نمطا عالميّا معتادا».

   ومن كتب `13/09/2026` كتب أربعةَ عشرَ محرفا في حقلٍ واحد — وهو أسرعُ من
   ثلاث قوائمَ لتاريخٍ يعرفه صاحبُه عن ظهر قلب. والقفزُ البعيدُ يُحلّ بالكتابة
   نفسِها: أربعةُ أرقامٍ للسنة، لا أربعُمئةِ ضغطةٍ ولا قائمةٌ تُمرَّر.

   ═══ ما يُقبل ═══

   اليومُ أوّلا كما يُكتب ويُقرأ في المنطقة: `13/09/2026`. والفاصلُ أيُّها
   كان (`/` أو `-` أو `.` أو مسافة) — فمن نسخ تاريخا من رسالةٍ لا يُعاقَب على
   فاصلٍ لم يخترْه. والأرقامُ العربيّةُ الهنديّة (٢٠٢٦) تُقرأ كالغربيّة:
   لوحةُ مفاتيحٍ عربيّةٌ تكتبها، ورفضُها رفضٌ للغة الشاشة نفسِها.

   ولا يُخمَّن الناقص: `13/09` بلا سنةٍ ليس تاريخا، و«السنةُ الحاليّة» تخمينٌ
   يُرسَل إلى الخادم باسم من لم يكتبه. */

/** الأرقامُ العربيّةُ الهنديّة ← الغربيّة، وما عداها يمرّ كما هو */
export function westernDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0)
    const base = code >= 0x06F0 ? 0x06F0 : 0x0660
    return String(code - base)
  })
}

export interface TypedDate {
  /** `yyyy-mm-dd` حين يكتمل ويصحّ — و`''` حين لا */
  iso: string
  /** سببُ الرفض بالعربيّة — و`null` حين لا رفضَ (ومنه الفارغُ والناقص) */
  errorAr: string | null
}

/**
 * قراءةُ ما كتبه إنسانٌ في حقل تاريخ — يومٌ فشهرٌ فسنة.
 *
 * الفارغُ والناقصُ ليسا خطأً: من يكتب لم يفرغ بعد، ورسالةُ خطأٍ عند كلّ
 * محرفٍ تُقاطعه وهو في منتصف الرقم. والخطأُ ما اكتمل شكلا وبطَل معنى —
 * «٣١/٠٢/٢٠٢٦» أو شهرٌ ثالثَ عشر.
 */
export function parseTypedDate(raw: string): TypedDate {
  const text = westernDigits((raw ?? '').trim())
  if (!text) return { iso: '', errorAr: null }

  const m = /^(\d{1,2})\s*[/\-.\s]\s*(\d{1,2})\s*[/\-.\s]\s*(\d{1,4})$/.exec(text)
  if (!m) return { iso: '', errorAr: null }

  const day = Number(m[1])
  const month = Number(m[2])
  /* السنةُ لا تكتمل إلّا بأربعة أرقام: `202` ليست ٢٠٢٠ ولا ٢٠٢٦ — ومن يكتب
     ما زال يكتب. ولا تُمدّ سنةٌ من رقمَين: «٢٦» أهي ١٩٢٦ أم ٢٠٢٦؟ */
  if (m[3].length < 4) return { iso: '', errorAr: null }
  const year = Number(m[3])

  if (month < 1 || month > 12) return { iso: '', errorAr: 'الشهرُ بين ١ و١٢' }
  if (day < 1) return { iso: '', errorAr: 'اليومُ يبدأ من ١' }
  const max = daysInMonth(year, month)
  if (day > max) {
    return { iso: '', errorAr: `${MONTHS_AR[month - 1]} ${year} فيه ${max} يوما` }
  }
  return { iso: joinIsoDay({ year: String(year), month: String(month), day: String(day) }), errorAr: null }
}

/** `1985-07-09` ← `09/07/1985` — وما ليس تاريخا يُعرض كما هو */
export function formatTypedDate(iso: string | null | undefined): string {
  const p = splitIsoDay(iso)
  if (!p.year) return ''
  return `${p.day.padStart(2, '0')}/${p.month.padStart(2, '0')}/${p.year}`
}

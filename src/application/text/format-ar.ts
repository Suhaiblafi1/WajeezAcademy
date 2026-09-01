/* تنسيقُ الأرقام والتواريخ — لغةٌ واحدة للرقم في الواجهة كلِّها.

   كانت الشاشةُ الواحدة تعرض نظامَي أرقام معا: بطاقةُ القِمع تقول «99» و«64»
   لأنّها تُصيّر الرقمَ خامًا، والبطاقةُ المجاورة تقول «٢ متعلم» لأنّها تمرّ
   بـ`toLocaleString("ar-JO")`. وفي رأس المدرّب «١ افتح شعبتك» فوق «1 شعبة».
   ولا معنى لهذا الاختلاف: هو أثرُ ستّة خيارات لغةٍ متفرّقة (`ar`, `ar-JO`,
   `ar-SA`, `ar-EG`, `ar-u-ca-gregory`, وخامٌ بلا لغة) اتُّخذ كلٌّ منها في
   ملفّه وحدَه. والقارئ لا يرى ستّةَ خيارات؛ يرى واجهةً مجموعةً من قطع.

   والقرار: **الرقمُ في الواجهة لاتينيّ**. لأنّ أكثرَه لاتينيٌّ أصلا (كلُّ
   `{n}` مباشرة)، ولأنّ ٥ العربيّة تُقرأ صفرا لاتينيّا عند كثيرين، ولأنّ
   `tabular-nums` — وهي تحاذي أعمدةَ الأرقام في اللوحات — مبنيّةٌ عليه.

   والتقويمُ ميلاديٌّ صراحةً: `ar` وحدَها تُعطي هجريّا في بعض البيئات، فيقرأ
   المستخدم تاريخا غيرَ الذي في قاعدة البيانات.

   والنثرُ المؤلَّف مستثنى: أرقامُ المتون والصفحات التسويقيّة عربيّةُ الرسم
   لأنّها كلامٌ يُقرأ لا بياناتٌ تُقارَن، ولا تجاور رقما لاتينيّا في بطاقة. */

/** اللغةُ الوحيدة: عربيّةٌ بأرقامٍ لاتينيّة وتقويمٍ ميلاديّ */
export const UI_LOCALE = 'ar-u-nu-latn-ca-gregory'

type DateLike = string | number | Date

function toDate(v: DateLike): Date | null {
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** عدد: «12,346» */
export function fmtNum(n: number, opts: Intl.NumberFormatOptions = { maximumFractionDigits: 0 }): string {
  return Number.isFinite(n) ? n.toLocaleString(UI_LOCALE, opts) : '—'
}

/** مبلغ بعملته: «120.00 USD» — الرمزُ بعد الرقم لا قبله في RTL */
export function fmtMoney(n: number, currency = 'USD'): string {
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString(UI_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

/** تاريخٌ مختصر: «31‏/8‏/2026» */
export function fmtDate(v: DateLike): string {
  const d = toDate(v)
  return d ? d.toLocaleDateString(UI_LOCALE) : '—'
}

/** تاريخٌ مطوّل: «31 أغسطس 2026» */
export function fmtDateLong(v: DateLike): string {
  const d = toDate(v)
  return d ? d.toLocaleDateString(UI_LOCALE, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'
}

/** يومٌ وشهر بلا سنة: «31 أغسطس» */
export function fmtDayMonth(v: DateLike): string {
  const d = toDate(v)
  return d ? d.toLocaleDateString(UI_LOCALE, { day: 'numeric', month: 'long' }) : '—'
}

/** تاريخٌ ووقت: «31‏/8‏/2026، 6:30 م» */
export function fmtDateTime(v: DateLike): string {
  const d = toDate(v)
  return d ? d.toLocaleString(UI_LOCALE) : '—'
}

/** وقتٌ وحده: «06:30 م» */
export function fmtTime(v: DateLike): string {
  const d = toDate(v)
  return d ? d.toLocaleTimeString(UI_LOCALE, { hour: '2-digit', minute: '2-digit' }) : '—'
}

/** موعدُ جلسة: «الاثنين، 31 أغسطس، 6:30 م» */
export function fmtSession(v: DateLike): string {
  const d = toDate(v)
  return d
    ? d.toLocaleString(UI_LOCALE, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—'
}

/** تنسيقٌ حرّ حين لا يكفي ما سبق — واللغةُ فيه مثبَّتة */
export function fmtDateWith(v: DateLike, opts: Intl.DateTimeFormatOptions): string {
  const d = toDate(v)
  return d ? d.toLocaleString(UI_LOCALE, opts) : '—'
}

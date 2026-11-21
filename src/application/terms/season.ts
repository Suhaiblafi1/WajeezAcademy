/* حدودُ الفصل من موسمه — حسابٌ نقيٌّ يُشترك فيه الخادمُ والواجهة.

   المواسمُ الأربعةُ معرَّفةٌ منذ زمنٍ في `application-options` وتُعرض على
   المتقدّم ويتحقّق منها الخادم. الجديدُ أنّها صارت **فصولا لها تواريخ**،
   فيلزم مكانٌ واحدٌ يحسب «متى يبدأ موسمُ الشتاء ٢٠٢٦ ومتى ينتهي».

   وموسمُ الشتاء يعبر رأسَ السنة (نوفمبر ← يناير) — فسنةُ الفصل هي سنةُ
   **بدايته**، ونهايتُه في التي تليها. وهذا مكتوبٌ هنا مرّةً لا في كلّ
   استعلامٍ يعيد اشتقاقَه. */

import { TRAINING_SEASONS, type TrainingSeason } from '../trainer/application-options'

/** فصلٌ بعينه: موسمُه وسنتُه */
export interface SeasonRef { year: number; season: TrainingSeason }

/** أشهرُ كلّ موسم — البدايةُ والنهايةُ بالأرقام (١ = يناير) */
export const SEASON_MONTHS: Record<TrainingSeason, { start: number; end: number }> = {
  nov_jan: { start: 11, end: 1 },
  feb_apr: { start: 2, end: 4 },
  may_jul: { start: 5, end: 7 },
  aug_oct: { start: 8, end: 10 },
  apr_may: { start: 4, end: 5 },
  jul_aug: { start: 7, end: 8 },
  oct_nov: { start: 10, end: 11 },
  jan_feb: { start: 1, end: 2 },
}

/* ═══ إيقاعان: الأرباعُ قبل فبراير ٢٠٢٧، وشهران وشهرٌ بعده (٢١ نوفمبر ٢٠٢٦) ═══

   القرارُ وعلّتُه في رأس `TRAINING_SEASONS`. وهنا حدُّه: ما قبل أوّل فبراير ٢٠٢٧ يُقرأ بالأرباع القديمة —
   فيبقى شتاءُ ٢٠٢٦/٢٠٢٧ (نوفمبر–يناير) كما هو وكلُّ ما مضى — وما بعده بالمواسم الجديدة. فبراير ومارس ٢٠٢٧
   فراغٌ، وأوّلُ موسمٍ جديدٍ ربيعُ ٢٠٢٧ (١ أبريل – ٣١ مايو). والفراغُ ليس عطبا: `termOf` يقول فيه `null`. */
export const NEW_RHYTHM_FROM = new Date(Date.UTC(2027, 1, 1))

const OLD_RHYTHM = TRAINING_SEASONS.filter((s) => s.retired).map((s) => s.value)
const NEW_RHYTHM = TRAINING_SEASONS.filter((s) => !s.retired).map((s) => s.value)

/** أيعبر هذا الموسمُ رأسَ السنة؟ */
export const crossesYearEnd = (season: TrainingSeason): boolean =>
  SEASON_MONTHS[season].end < SEASON_MONTHS[season].start

/** كم شهرا في الموسم — ثلاثةٌ للأرباع القديمة، واثنان للجديدة */
export function termMonthCount(season: TrainingSeason): number {
  const { start, end } = SEASON_MONTHS[season]
  return ((end - start + 12) % 12) + 1
}

/** حدودُ الفصل — بدايةُ أوّلِ شهرٍ ونهايةُ آخرِه، بتوقيت UTC */
export function termBounds(year: number, season: TrainingSeason): { startsOn: Date; endsOn: Date } {
  const { start, end } = SEASON_MONTHS[season]
  const endYear = crossesYearEnd(season) ? year + 1 : year
  return {
    startsOn: new Date(Date.UTC(year, start - 1, 1)),
    /* اليومُ الأخيرُ من شهر النهاية: أوّلُ الشهر التالي ناقصَ يوم */
    endsOn: new Date(Date.UTC(endYear, end, 0)),
  }
}

/** عنوانُ الفصل كما يُقرأ: «موسم الربيع 2027»، والشتاءُ بسنتيه «موسم الشتاء 2026/2027».

    ═══ الشتاءُ بسنتيه (١٩ أكتوبر ٢٠٢٦) ═══
    كان «موسم الشتاء 2027» — وسنتُه سنةُ بدايته — يعني نوفمبر 2027 إلى يناير 2028، ويُقرأ «الشتاءَ الذي
    في أوّل 2027». فنُقلت شعبةٌ إلى «موسم الشتاء 2027» على أنّه الشتاءُ القادم، فصار أوّلُ لقائها بعد سنة،
    وكتبتها بطاقةُ المدرّب كذلك. فالموسمُ الذي يعبر رأسَ السنة يُسمّى بسنتيه، ولا يُقرأ إلّا على وجهه.
    والشتاءُ الجديدُ (يناير–فبراير) لا يعبرها، فسنتُه واحدة: «موسم الشتاء 2028». */
export function termTitleAr(year: number, season: TrainingSeason): string {
  const s = TRAINING_SEASONS.find((x) => x.value === season)
  return `${s?.label ?? season} ${crossesYearEnd(season) ? `${year}/${year + 1}` : year}`
}

/** أشهرُ الفصل بترتيبها — ثلاثةٌ أو اثنان — يقرؤها التقويمُ والمخطِّط */
export function termMonths(year: number, season: TrainingSeason): { month: number; year: number }[] {
  const { start } = SEASON_MONTHS[season]
  return Array.from({ length: termMonthCount(season) }, (_, i) => {
    const m = ((start - 1 + i) % 12) + 1
    return { month: m, year: m < start ? year + 1 : year }
  })
}

/** أيُّ شهرٍ من الفصل يقع فيه هذا التاريخ (١ إلى عدد أشهره)، أو `null` خارجه */
export function monthWithinTerm(date: Date, year: number, season: TrainingSeason): number | null {
  const months = termMonths(year, season)
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  const at = months.findIndex((x) => x.year === y && x.month === m)
  return at === -1 ? null : at + 1
}

/** أيصحّ هذا الشهرُ من الفصل؟ — ١ إلى ٣ للأرباع القديمة، و١ أو ٢ للمواسم الجديدة (`Cohort.plannedMonth`) */
export function plannedMonthOk(season: TrainingSeason, month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= termMonthCount(season)
}

/** الفصلُ الذي يقع فيه تاريخٌ ما — موسمُه وسنتُه. و`null` لشهر راحةٍ في الإيقاع الجديد
    (يونيو وسبتمبر وديسمبر ومارس، وفبراير ٢٠٢٧ معها) */
export function termOf(date: Date): SeasonRef | null {
  const m = date.getUTCMonth() + 1
  const y = date.getUTCFullYear()
  const fresh = date.getTime() >= NEW_RHYTHM_FROM.getTime()
  for (const season of fresh ? NEW_RHYTHM : OLD_RHYTHM) {
    const { start, end } = SEASON_MONTHS[season]
    let found: SeasonRef | null = null
    if (crossesYearEnd(season)) {
      if (m >= start) found = { year: y, season }
      else if (m <= end) found = { year: y - 1, season }
    } else if (m >= start && m <= end) {
      found = { year: y, season }
    }
    if (!found) continue
    /* وموسمٌ جديدٌ بدأ قبل الحدّ لم يكن: يناير ٢٠٢٧ شتاءٌ قديم، فـ«شتاء 2027» (يناير–فبراير) لا يوجد وفبراير ٢٠٢٧ راحة */
    if (fresh && termBounds(found.year, found.season).startsOn.getTime() < NEW_RHYTHM_FROM.getTime()) return null
    return found
  }
  return null
}

/** أوّلُ يومٍ من الشهر — بتوقيت UTC */
const monthStart = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1))

/** أوّلُ فصلٍ يبدأ في شهرٍ بعد شهر هذا التاريخ — «القادم» ولو كنّا في فراغ */
export function seasonAfter(date: Date): SeasonRef {
  let y = date.getUTCFullYear()
  let m = date.getUTCMonth() + 1
  for (let guard = 0; guard < 24; guard += 1) {
    m += 1
    if (m > 12) { m = 1; y += 1 }
    const t = termOf(monthStart(y, m))
    if (t && SEASON_MONTHS[t.season].start === m) return t
  }
  /* لا يقع: في كلّ أربعة أشهرٍ موسمٌ يبدأ. والحارسُ يُثبت ذلك */
  throw new Error('لا موسم يبدأ في السنتين التاليتين')
}

/** الفصلُ الذي يلي هذا — بالإيقاع الساري عند انتهائه: شتاءُ ٢٠٢٦/٢٠٢٧ يتلوه ربيعُ ٢٠٢٧ (أبريل) */
export function nextSeason(t: SeasonRef): SeasonRef {
  return seasonAfter(termBounds(t.year, t.season).endsOn)
}

/** فصلُ يومٍ بعينه، وفي شهر الراحة الفصلُ الذي بعده — لشعبةٍ تبدأ فيه: تُعدّ للقادم */
export function termAtOrAfter(date: Date): SeasonRef {
  return termOf(date) ?? seasonAfter(date)
}

/** فصلُ يومٍ بعينه، وفي شهر الراحة آخرُ فصلٍ بدأ قبله — «الفصلُ الجاري» ولو كنّا في فراغ */
export function latestStartedTerm(date: Date): SeasonRef {
  const now = termOf(date)
  if (now) return now
  let y = date.getUTCFullYear()
  let m = date.getUTCMonth() + 1
  for (let guard = 0; guard < 24; guard += 1) {
    m -= 1
    if (m < 1) { m = 12; y -= 1 }
    const t = termOf(monthStart(y, m))
    if (t) return t
  }
  throw new Error('لا موسم في السنتين السابقتين')
}

/** الفصلُ الذي يبدأ في هذا اليوم بالضبط — أو `null`.
    يقرأ أوّلَ يومٍ حُفظ لموسمٍ (تأجيلٌ أو موعدُ تواصل) باسمه يومَ حُفظ: «١ فبراير ٢٠٢٧» حُفظ أوّلَ «موسم الربيع
    2027» القديم (فبراير–أبريل)، وصار شهرَ راحة — فيُقرأ باسمه القديم لا «لا موسم». وما سوى ذلك بالإيقاع الساري. */
export function termStartingOn(date: Date): SeasonRef | null {
  if (date.getUTCDate() !== 1) return null
  const m = date.getUTCMonth() + 1
  const now = termOf(date)
  if (now && SEASON_MONTHS[now.season].start === m) return now
  if (date.getTime() < NEW_RHYTHM_FROM.getTime()) return null
  const old = OLD_RHYTHM.find((s) => SEASON_MONTHS[s].start === m)
  return old ? { year: date.getUTCFullYear(), season: old } : null
}

/** أفصلٌ من الإيقاع الساري يومَ بدايته؟ — `apr_may 2027` نعم، و`feb_apr 2027` و`apr_may 2026` لا */
export function inRhythm(t: SeasonRef): boolean {
  const at = termOf(termBounds(t.year, t.season).startsOn)
  return at !== null && at.year === t.year && at.season === t.season
}

/** عنوانُ الفصل من مفتاحه — «2026-nov_jan» ← «موسم الشتاء 2026/2027». وما لا يُقرأ `null` */
export function termTitleOfKey(key: string): string | null {
  const m = /^(\d{4})-([a-z]{3}_[a-z]{3})$/.exec(key)
  if (!m || !TRAINING_SEASONS.some((s) => s.value === m[2])) return null
  return termTitleAr(Number(m[1]), m[2] as TrainingSeason)
}

/** مفتاحُ الفصل نصّا — «2026-nov_jan» — يقرؤه الخادمُ والواجهةُ معا (موسمُ المسارات العامّة) */
export const termKey = (year: number, season: TrainingSeason): string => `${year}-${season}`

/* ═══ أفقُ العرض: الموسمُ الجاري وما يليه ═══

   شكا صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦) من شاشة «المواسم والتقويم»: «ضع
   الموسمَ القادمَ والذي يليه فقط، وأنا أنشئ البقيةَ لاحقا». وكانت تعرض
   ثمانيةً دفعةً واحدة — سنتَين كاملتَين من بطاقاتٍ لكلٍّ منها نافذةُ تسجيلٍ
   وتوزيعُ شعبٍ وزرُّ نشر.

   ولا تُخفى الجاريةُ مع المخفيّ: فيها الشعبُ التي تعمل اليومَ، ومن أخفاها
   أخفى عملَه القائم. فالمعروضُ افتراضا: ما نحن فيه، ثمّ ما بعده بعددٍ
   معلوم — وما سواه يبقى موجودا خلفَ إفصاح، لا يُحذف.

   والحسابُ على `startsOn` لا على الحالة: حالةُ الفصل يضبطها الإنسانُ
   فتتأخّر عن الواقع، وتاريخُ بدايته لا يكذب. */

/** فصلٌ كما يكفي لترتيبه — التاريخُ نصّا كان أو `Date` */
export interface HasTermSpan { startsOn: string | Date; endsOn: string | Date }

const ms = (d: string | Date): number => (d instanceof Date ? d : new Date(d)).getTime()

/**
 * يقسم الفصولَ إلى ما يُعرض افتراضا وما يُطوى خلفَ إفصاح.
 *
 * `ahead` عددُ المواسم المستقبليّة المعروضة بعد الجاري (٢ افتراضا:
 * «القادم والذي يليه»). والجاري — إن وُجد — يُعرض معها دائما.
 */
export function termHorizon<T extends HasTermSpan>(
  terms: readonly T[], now: Date, ahead = 2,
): { shown: T[]; hidden: T[] } {
  const t = now.getTime()
  const byStart = [...terms].sort((a, b) => ms(a.startsOn) - ms(b.startsOn))
  const shown: T[] = []
  let taken = 0
  for (const term of byStart) {
    /* الجاري: بدأ ولم ينته — يُعرض ولا يُعدّ من نصيب المستقبل */
    if (ms(term.startsOn) <= t && t <= ms(term.endsOn)) { shown.push(term); continue }
    if (ms(term.startsOn) > t && taken < ahead) { shown.push(term); taken += 1 }
  }
  const keep = new Set(shown)
  return { shown, hidden: byStart.filter((x) => !keep.has(x)) }
}

/* حدودُ الفصل من موسمه — حسابٌ نقيٌّ يُشترك فيه الخادمُ والواجهة.

   المواسمُ الأربعةُ معرَّفةٌ منذ زمنٍ في `application-options` وتُعرض على
   المتقدّم ويتحقّق منها الخادم. الجديدُ أنّها صارت **فصولا لها تواريخ**،
   فيلزم مكانٌ واحدٌ يحسب «متى يبدأ موسمُ الشتاء ٢٠٢٦ ومتى ينتهي».

   وموسمُ الشتاء يعبر رأسَ السنة (نوفمبر ← يناير) — فسنةُ الفصل هي سنةُ
   **بدايته**، ونهايتُه في التي تليها. وهذا مكتوبٌ هنا مرّةً لا في كلّ
   استعلامٍ يعيد اشتقاقَه. */

import { TRAINING_SEASONS, type TrainingSeason } from '../trainer/application-options'

/** أشهرُ كلّ موسم — البدايةُ والنهايةُ بالأرقام (١ = يناير) */
export const SEASON_MONTHS: Record<TrainingSeason, { start: number; end: number }> = {
  nov_jan: { start: 11, end: 1 },
  feb_apr: { start: 2, end: 4 },
  may_jul: { start: 5, end: 7 },
  aug_oct: { start: 8, end: 10 },
}

/** أيعبر هذا الموسمُ رأسَ السنة؟ */
export const crossesYearEnd = (season: TrainingSeason): boolean =>
  SEASON_MONTHS[season].end < SEASON_MONTHS[season].start

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

/** عنوانُ الفصل كما يُقرأ: «موسم الربيع ٢٠٢٦» */
export function termTitleAr(year: number, season: TrainingSeason): string {
  const s = TRAINING_SEASONS.find((x) => x.value === season)
  return `${s?.label ?? season} ${year}`
}

/** الأشهرُ الثلاثةُ بترتيبها — يقرؤها التقويمُ والمخطِّط */
export function termMonths(year: number, season: TrainingSeason): { month: number; year: number }[] {
  const { start } = SEASON_MONTHS[season]
  return [0, 1, 2].map((i) => {
    const m = ((start - 1 + i) % 12) + 1
    return { month: m, year: m < start ? year + 1 : year }
  })
}

/** أيُّ شهرٍ من الفصل يقع فيه هذا التاريخ (١ أو ٢ أو ٣)، أو `null` خارجه */
export function monthWithinTerm(date: Date, year: number, season: TrainingSeason): number | null {
  const months = termMonths(year, season)
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  const at = months.findIndex((x) => x.year === y && x.month === m)
  return at === -1 ? null : at + 1
}

/** الفصلُ الذي يقع فيه تاريخٌ ما — موسمُه وسنتُه */
export function termOf(date: Date): { year: number; season: TrainingSeason } {
  const m = date.getUTCMonth() + 1
  const y = date.getUTCFullYear()
  for (const s of TRAINING_SEASONS) {
    const season = s.value
    const { start, end } = SEASON_MONTHS[season]
    if (crossesYearEnd(season)) {
      if (m >= start) return { year: y, season }
      if (m <= end) return { year: y - 1, season }
    } else if (m >= start && m <= end) {
      return { year: y, season }
    }
  }
  /* لا يقع — الأربعةُ تغطّي الاثني عشر شهرا. والحارسُ يُثبت ذلك. */
  return { year: y, season: 'nov_jan' }
}

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

/* مواسمُ ٢٠٢٧ في الرئيسة — بدلَ «كيف تسير رحلتك» (٢١ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «غيّر هذا التصميم ليعطي انطباعا عن الفصول ومتى يبدأ التسجيل لكلّ موسم لعام ٢٠٢٧ حسب الخطّة
   الجديدة. أمّا الفصلُ الحاليّ يُغلَق اليوم، والفصلُ الآتي الذي تجاوزناه اجعله مغلقا للتسجيل ليكون الفصلُ الربيعُ هو
   القادم.. تصميمٌ ناعمٌ يتوافق مع الموقع ككلّ».

   ═══ ما يُحسب هنا ═══
   · أربعُ بطاقاتٍ لسنة ٢٠٢٧: الشتاءُ (يناير – فبراير) الذي تجاوزناه — «التسجيل مغلق» دائما، فلا موسمَ له في الإيقاع
     الجديد (`termOf` يردّه راحة) — ثمّ الربيعُ والصيفُ والخريفُ بحدودها من `termBounds` لا بأرقامٍ تُكتب ثانية.
   · **والتسجيلُ يفتح في شهر الراحة الذي قبل الموسم** (مارس للربيع، يونيو للصيف، سبتمبر للخريف) — شهرٌ قبله، كما في
     الخطّة. وحالُ كلّ بطاقةٍ من التاريخ لا من نصٍّ ثابت: يفتح في كذا ← مفتوح ← يجري الآن ← انتهى.
   · و«القادم» أوّلُ موسمٍ لم يبدأ بعدُ — فيكون الربيعَ الآن، ويتقدّم وحدَه.
   · وسطرُ الموسم الجاري: يُغلق تسجيلُه آخرَ يوم ٢١ نوفمبر ٢٠٢٦ بتوقيت عمّان، فيُقال «يغلق اليوم» ذلك اليوم، و«مغلق»
     بعده حتى ينتهي الموسم. ولا يُقال «مكتمل»: لم يمتلئ، والكلمةُ تقول للزائر ما لم يقع. */

import { termBounds } from './season'
import { zonedInstant } from '../trainer/cohort-period'

export type SeasonCardState = 'closed' | 'upcoming' | 'open' | 'running' | 'ended'

export interface SeasonCard {
  key: 'jan_feb' | 'apr_may' | 'jul_aug' | 'oct_nov'
  nameAr: string
  monthsAr: string
  state: SeasonCardState
  noteAr: string
  /** أوّلُ موسمٍ لم يبدأ — شارةُ «القادم» */
  next: boolean
}

export const CALENDAR_YEAR = 2027
/** آخرُ لحظةٍ في التسجيل للموسم الجاري: نهايةُ ٢١ نوفمبر ٢٠٢٦ بتوقيت عمّان */
export const CURRENT_REG_CLOSES_AT = zonedInstant('2026-11-22', [0, 0, 0, 0])
/** ونهايةُ الموسم الجاري (الشتاء ٢٠٢٦/٢٠٢٧) — بعدها لا سطرَ له */
export const CURRENT_SEASON_ENDS_AT = zonedInstant('2027-02-01', [0, 0, 0, 0])

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

const SEASONS: { key: Exclude<SeasonCard['key'], 'jan_feb'>; nameAr: string; monthsAr: string }[] = [
  { key: 'apr_may', nameAr: 'موسم الربيع', monthsAr: 'أبريل – مايو' },
  { key: 'jul_aug', nameAr: 'موسم الصيف', monthsAr: 'يوليو – أغسطس' },
  { key: 'oct_nov', nameAr: 'موسم الخريف', monthsAr: 'أكتوبر – نوفمبر' },
]

/** بطاقاتُ مواسم ٢٠٢٧ بحالها يومَ `now` */
export function seasonCards(now: Date): SeasonCard[] {
  const t = now.getTime()
  const cards: SeasonCard[] = [
    { key: 'jan_feb', nameAr: 'موسم الشتاء', monthsAr: 'يناير – فبراير', state: 'closed', noteAr: 'التسجيل مغلق', next: false },
  ]
  for (const s of SEASONS) {
    const { startsOn, endsOn } = termBounds(CALENDAR_YEAR, s.key)
    const startMonth = startsOn.getUTCMonth()
    /* يفتح التسجيلُ أوّلَ الشهر الذي قبله — شهرُ الراحة — بتوقيت عمّان */
    const opensMonth = (startMonth + 11) % 12
    const opensAt = zonedInstant(`${CALENDAR_YEAR}-${String(opensMonth + 1).padStart(2, '0')}-01`, [0, 0, 0, 0])
    const startsAt = zonedInstant(startsOn.toISOString().slice(0, 10), [0, 0, 0, 0])
    const endsAt = zonedInstant(endsOn.toISOString().slice(0, 10), [23, 59, 59, 999])
    const state: SeasonCardState = t < opensAt.getTime() ? 'upcoming'
      : t < startsAt.getTime() ? 'open'
      : t <= endsAt.getTime() ? 'running' : 'ended'
    const noteAr = state === 'upcoming' ? `التسجيل في ${MONTHS_AR[opensMonth]}`
      : state === 'open' ? 'التسجيل مفتوح'
      : state === 'running' ? 'يجري الآن' : 'انتهى'
    cards.push({ key: s.key, nameAr: s.nameAr, monthsAr: s.monthsAr, state, noteAr, next: false })
  }
  const next = cards.find((c) => c.state === 'upcoming' || c.state === 'open')
  if (next) next.next = true
  return cards
}

/** سطرُ الموسم الجاري تحت العنوان — أو `null` بعد انتهائه */
export function currentSeasonLineAr(now: Date): string | null {
  const t = now.getTime()
  if (t >= CURRENT_SEASON_ENDS_AT.getTime()) return null
  const closesDay = CURRENT_REG_CLOSES_AT.getTime() - 86_400_000
  if (t < closesDay) return 'التسجيل في الموسم الحالي يغلق 21 نوفمبر'
  if (t < CURRENT_REG_CLOSES_AT.getTime()) return 'التسجيل في الموسم الحالي يغلق اليوم'
  return 'التسجيل في الموسم الحالي مغلق'
}

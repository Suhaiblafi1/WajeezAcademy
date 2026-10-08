/* ═══ تأجيلُ الشعبة إلى موسمٍ قادم — قرارٌ ثالثٌ بجانب الاعتماد وطلبِ التعديلات (٨ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «بعضُ المدرّبين عندهم ستُّ دورات، وهذا كثيرٌ على الفصل القادم.
   فأختار أفضلَ اثنتين أو ثلاثٍ على الأكثر — أجهزَها — وأقول لهم أن يؤجّلوا الباقيةَ إلى
   الفصل الذي يليه… ويجب أن يعرفوا أنّي لا أقبلها لهذا الفصل». ثمّ اختار من خيارين «زرّا
   ثالثا» على «اطلب تعديلات بكلمة تأجيل»: الفرقُ أنّ المنصّةَ **تعرف** أنّها مؤجّلة،
   فلا يُعيد المدرّبُ إرسالَها لهذا الفصل فتُردّ ثانيةً.

   ── وما يقع به ──

   · الخطّةُ تعود إلى يد المدرّب (`changes_requested`) ويُكتب عليها الموسمُ الذي أُجّلت
     إليه: أوّلُ يومٍ فيه (`postponedTo`). فيعدّلها متى شاء كما يعدّل المردودة.
   · ولا تُرسَل حتّى تبدأ في ذلك الموسم أو بعده (`postponeProblem`) — يقرؤها حاجزُ
     الإرسال في الخادم (`buildChecklist`) وشاشتُه معا.
   · ويُقال له بالجرس والبريد إنّها **لم تُقبل لهذا الفصل** وإلى أيّ موسمٍ أُجّلت
     (`postponeMessageAr`)، ومعها تقريرُ المراجعة إن رُفع.

   ── والمواسمُ أربعةٌ تدور ──

   الشتاءُ (نوفمبر–يناير) يعبر رأسَ السنة فسنتُه سنةُ بدايته، فما بعده الربيعُ من السنة
   التالية. والحسابُ كلُّه على `application/terms/season.ts` لا بيدٍ هنا. */

import { termBounds, termOf, termTitleAr } from '../terms/season'
import type { TrainingSeason } from './application-options'
import { cohortDayAr } from '../learning/cohort-gate'
import type { CohortPeriod } from './cohort-period'

export interface Season { year: number; season: TrainingSeason }

/** الموسمُ الذي يلي هذا — والشتاءُ يتلوه ربيعُ السنة التالية */
export function nextSeason(s: Season): Season {
  switch (s.season) {
    case 'nov_jan': return { year: s.year + 1, season: 'feb_apr' }
    case 'feb_apr': return { year: s.year, season: 'may_jul' }
    case 'may_jul': return { year: s.year, season: 'aug_oct' }
    case 'aug_oct': return { year: s.year, season: 'nov_jan' }
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** أوّلُ يومٍ في الموسم — `YYYY-MM-DD` */
export const seasonStart = (s: Season): string => iso(termBounds(s.year, s.season).startsOn)

/** الموسمُ الذي يقع فيه يومٌ ما */
export const seasonOfDay = (day: string): Season => termOf(new Date(`${day}T12:00:00.000Z`))

/** «موسم الربيع 2027» */
export const seasonAr = (s: Season): string => termTitleAr(s.year, s.season)

/** موسمُ الشعبة كما خطّط لها مدرّبُها — أو موسمُ اليوم إن لم يحدّد مدّتها بعد */
export function plannedSeason(period: { startsOn?: string | null } | null, today: string): Season {
  return seasonOfDay(period?.startsOn || today)
}

/** ما يُختار منه في زرّ التأجيل: الموسمان التاليان لموسمها — والأوّلُ هو المقترَح */
export function postponeChoices(period: { startsOn?: string | null } | null, today: string, n = 2): Season[] {
  const out: Season[] = []
  let s = plannedSeason(period, today)
  for (let i = 0; i < n; i++) { s = nextSeason(s); out.push(s) }
  return out
}

/** أيصحّ التأجيلُ إلى هذا الموسم؟ — بعد موسمها لا فيه ولا قبله */
export function validPostponeTarget(target: Season, period: { startsOn?: string | null } | null, today: string): boolean {
  return seasonStart(target) > seasonStart(plannedSeason(period, today))
}

/** ما يمنع إرسالَ مؤجَّلةٍ — بلغة من يصحّحه، أو `null`.
    وبلا مدّةٍ لا يُحكم هنا: صفُّ المعلومات الأساسيّة يطلبها أوّلا */
export function postponeProblem(postponedTo: string | null | undefined, period: CohortPeriod | null): string | null {
  if (!postponedTo || !period?.startsOn) return null
  if (period.startsOn >= postponedTo) return null
  return `مؤجّلةٌ إلى ${seasonAr(seasonOfDay(postponedTo))} — اجعل بدايتَها في ${cohortDayAr(postponedTo)} أو بعده ثمّ أرسلها`
}

/** سطرُ الحال: «مؤجّلةٌ إلى موسم الربيع 2027» */
export const postponedLineAr = (postponedTo: string): string => `مؤجّلةٌ إلى ${seasonAr(seasonOfDay(postponedTo))}`

/** ما يُقال للمدرّب بالجرس والبريد — صريحا: لم تُقبل لهذا الفصل، وإلى أيّ موسمٍ أُجّلت */
export function postponeMessageAr(input: {
  cohortTitle: string
  from: Season
  to: Season
  /** كلمةُ الإدارة — اختياريّة */
  note?: string | null
}): { title: string; heading: string; body: string; cta: string } {
  const fromAr = seasonAr(input.from)
  const toAr = seasonAr(input.to)
  const day = cohortDayAr(seasonStart(input.to))
  const note = input.note?.trim()
  return {
    title: `«${input.cohortTitle}» مؤجّلةٌ إلى ${toAr}`,
    heading: `لم تُقبل هذه الشعبةُ ل${fromAr} — وأُجّلت إلى ${toAr}`,
    body: `لم تُقبل «${input.cohortTitle}» ل${fromAr}، وأُجّلت إلى ${toAr}. وليس هذا رفضا للدورة: `
      + `تبقى خطّتُك في صفحة شعبتك كما هي، تعدّلها متى شئت، وترسلها حين تجعل بدايتَها في ${day} أو بعده.`
      + (note ? ` وكلمةُ الإدارة: ${note}` : ''),
    cta: 'افتح الشعبة',
  }
}

/* ═══ شعبتان يختارهما الطالبُ نفسُه في ساعةٍ واحدة — يُقال له قبل أن يدفع (٢٤ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «ابنِ تحذيرَ الطالب عند اختيار دورتين متعارضتين». وصلتنا على واتساب حالاتُ طلبةٍ اشتروا
   دورتين ثمّ وجدوا لقاءاتهما في الساعة نفسِها. فحين يختار شعبةً تقع لقاءاتُها على لقاءات شعبةٍ أخرى — اختارها
   معها في الطلب نفسِه، أو سجّل فيها من قبل — يُقال له: مع أيّها، وكم لقاءً، ومتى أوّلُها. وإن كانت لدورته شعبةٌ
   أخرى لا تتعارض دُلّ عليها.

   والتحذيرُ لا يمنع («لا إجبار»): قد يحضر واحدةً ويشاهد تسجيلَ الأخرى. وهنا لا قاعدةَ ربطٍ كما في جدولة الفصل
   (`schedule-clash.ts`) — الطالبُ نفسُه لا يحضر لقاءين في ساعةٍ واحدةٍ أيًّا كانت الدورتان. */

import { cohortDayAr } from './cohort-gate'
import { zonedDay } from '../trainer/cohort-period'
import { WEEKDAYS_AR as WEEKDAY_AR } from '../calendar/month-grid'

/** لقاءٌ بموعده — والنهايةُ المجهولةُ ساعتان، كما يقيسها الفحصُ في بقيّة المنصّة */
export interface TimedSession { startsAt: string; endsAt: string | null }

/** شعبةٌ بلقاءاتها — في الطلب، أو ممّا سجّل فيه */
export interface TimedCohort {
  cohortId: string
  courseId: string
  titleAr: string
  sessions: readonly TimedSession[]
}

const DEFAULT_MS = 2 * 3_600_000
const endOf = (s: TimedSession) => {
  const a = Date.parse(s.startsAt)
  const b = s.endsAt ? Date.parse(s.endsAt) : NaN
  return Number.isFinite(b) && b > a ? b : a + DEFAULT_MS
}

/** كم لقاءً يتداخل بين الشعبتين، ومتى أوّلُها — أو `null` */
export function sessionsOverlap(a: readonly TimedSession[], b: readonly TimedSession[]): { count: number; firstAt: string } | null {
  let count = 0
  let first = Infinity
  for (const x of a) {
    const xa = Date.parse(x.startsAt)
    const xb = endOf(x)
    for (const y of b) {
      const ya = Date.parse(y.startsAt)
      if (xa < endOf(y) && ya < xb) { count += 1; first = Math.min(first, Math.max(xa, ya)) }
    }
  }
  return count === 0 ? null : { count, firstAt: new Date(first).toISOString() }
}

export interface CohortClash { with: TimedCohort; count: number; firstAt: string }

/** مع أيّ شعبةٍ تتعارض هذه — ولا تُعدّ شعبةٌ من الدورة نفسِها: هي بديلٌ لا دورةٌ ثانية */
export function clashesOf(cohort: TimedCohort, others: readonly TimedCohort[]): CohortClash[] {
  const out: CohortClash[] = []
  for (const o of others) {
    if (o.cohortId === cohort.cohortId || o.courseId === cohort.courseId) continue
    const hit = sessionsOverlap(cohort.sessions, o.sessions)
    if (hit) out.push({ with: o, ...hit })
  }
  return out.sort((x, y) => x.firstAt.localeCompare(y.firstAt))
}

/** «الأحد 6 ديسمبر» بتوقيت عمّان — اليومُ من جدولنا لا من صياغة المتصفّح، فلا تختلف فاصلتُه بين نسخة وأخرى */
const dayAr = (iso: string) => {
  const day = zonedDay(new Date(iso))
  return `${WEEKDAY_AR[new Date(`${day}T12:00:00Z`).getUTCDay()]} ${cohortDayAr(iso, { day: 'numeric', month: 'long' })}`
}

/** والعددُ بعد «في» مجرور: «في لقاءين» لا «في لقاءان» */
const meetingsAr = (n: number) => (n === 1 ? 'لقاء واحد' : n === 2 ? 'لقاءين' : n <= 10 ? `${n} لقاءات` : `${n} لقاء`)

/** «تتعارض مع «دورة X» في 3 لقاءات، أولها الأحد 6 ديسمبر» */
export function clashLineAr(c: CohortClash): string {
  return `تتعارض مع «${c.with.titleAr}» في ${meetingsAr(c.count)}، أولها ${dayAr(c.firstAt)}`
}

/** سطرُ التنبيه كاملا: مع من، ثمّ الخيار — والقرارُ له */
export function clashWarnAr(clashes: readonly CohortClash[], hasAlternative: boolean): string | null {
  if (clashes.length === 0) return null
  const tail = hasAlternative
    ? 'ولهذه الدورة موعد آخر لا يتعارض.'
    : 'لن تستطيع حضور الاثنين مباشرة. ولك أن تكمل إن أردت.'
  return `${clashes.map(clashLineAr).join('، و')}. ${tail}`
}

/** أوّلُ شعبةٍ من الدورة نفسِها لا تتعارض مع ما معها — بترتيبها كما عُرضت. والمختارةُ تتعارض، فلا تكون هي.
    وشعبةٌ لم يُعتمد جدولُها بعدُ لا لقاءاتِ لها تُقاس — فلا يُقال إنّها لا تتعارض */
export function freeAlternative<T extends TimedCohort>(options: readonly T[], others: readonly TimedCohort[]): T | null {
  return options.find((o) => o.sessions.length > 0 && clashesOf(o, others).length === 0) ?? null
}

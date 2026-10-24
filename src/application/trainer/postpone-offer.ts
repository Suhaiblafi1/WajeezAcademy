/* ═══ اقتراحُ تأجيل الشعبة إلى الشهر التالي — نقترحه نحن، ويقبله المدرّبُ أو تتوقّف (٢٤ أكتوبر ٢٠٢٦) ═══

   قولُ صاحب المنصّة: «دوراتُ نوّار يجب أن تؤجَّل لشهر ١٢ وهو لم يقم بتأجيلها سابقا.. افحص كلَّ الدورات التي
   تبدأ بشهر ١١ واقترح تأجيلا لها وأرسلها للمدرّب مع إعلامه بأنّه سيتمّ توقيفُ الشعبة تلقائيّا.. هذا شيءٌ يخصّ
   هذا الفصل لأنّنا بدأنا متأخّرين نوعا ما بالتسويق».

   ═══ ولمَ ليس «نقلا إلى فصلٍ آخر» ═══

   نوفمبر وديسمبر في فصلٍ واحد (الشتاءُ يبدأ في نوفمبر، `SEASON_MONTHS`)، والنقلُ القائمُ بين الفصول وحدَها
   (`cohort-move.ts`). فهذا تأجيلٌ داخلَ الفصل بأسابيعَ كاملة — يومُ الأسبوع والساعةُ كما اختارهما المدرّب — حتّى
   يقع أوّلُ لقاءٍ في أوّل الشهر التالي أو بعده. والأثرُ عند القبول أثرُ النقل نفسُه (`CohortMoveService.applyShift`).

   ═══ وبطاقةُ «قبل/بعد» لا طلبٌ يعمله ═══

   قاعدةُ المستودَع: ما يُطلب من المدرّب بطاقةٌ يقبلها أو يرفضها. فالبطاقةُ تقول أوّلَ لقاءٍ الآن وبعد التأجيل،
   وما يقع بكلّ خيار: يقبل فتنتقل مواعيدُها كلُّها، أو لا يقبل فتتوقّف، أو يسكت حتّى الموعد فتتوقّف تلقائيّا. */

import { ACADEMY_ZONE, zonedInstant } from './cohort-period'

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

/** السنةُ والشهرُ بتوقيت الأكاديميّة — `month` من ١ إلى ١٢ */
export function academyMonth(at: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ACADEMY_ZONE, year: 'numeric', month: '2-digit' }).formatToParts(at)
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { year: n('year'), month: n('month') }
}

/** أوّلُ لحظةٍ في الشهر بتوقيت الأكاديميّة (عمّان) — منتصفُ ليل يومه الأوّل */
export function academyMonthStart(year: number, month: number): Date {
  return zonedInstant(`${year}-${String(month).padStart(2, '0')}-01`, [0, 0, 0, 0])
}

export const nextMonth = (m: { year: number; month: number }) =>
  m.month === 12 ? { year: m.year + 1, month: 1 } : { year: m.year, month: m.month + 1 }

/** كم أسبوعا كاملا يُزاح أوّلُ لقاءٍ حتّى يقع في الشهر التالي لشهره أو بعده */
export function weeksToNextMonth(firstAt: Date): number {
  const next = nextMonth(academyMonth(firstAt))
  const target = academyMonthStart(next.year, next.month)
  return Math.max(1, Math.ceil((target.getTime() - firstAt.getTime()) / WEEK_MS))
}

export const shiftByWeeks = (d: Date, weeks: number) => new Date(d.getTime() + weeks * WEEK_MS)

/** المهلةُ الافتراضيّة: بعد ثلاثة أيّام — ولا تتجاوز يومين قبل أوّل لقاء، ولا تقع قبل الآن بساعة */
export const DEFAULT_DECIDE_DAYS = 3
export function defaultDeadline(now: Date, firstAt: Date): Date {
  const byDays = now.getTime() + DEFAULT_DECIDE_DAYS * DAY_MS
  const beforeStart = firstAt.getTime() - 2 * DAY_MS
  return new Date(Math.max(now.getTime() + 3600_000, Math.min(byDays, beforeStart)))
}

/** ما يمنع المهلة — جملةٌ تُعرض، أو `null` */
export function deadlineProblemAr(deadline: Date, now: Date, firstAt: Date): string | null {
  if (deadline.getTime() <= now.getTime()) return 'المهلة مضت — اختر موعدا قادما'
  if (deadline.getTime() >= firstAt.getTime()) return 'المهلة بعد أول لقاء — اختر موعدا قبله'
  return null
}

export const POSTPONE_STATUSES = ['pending', 'accepted', 'declined', 'expired', 'withdrawn'] as const
export type PostponeStatus = (typeof POSTPONE_STATUSES)[number]

export const POSTPONE_STATUS_AR: Record<PostponeStatus, string> = {
  pending: 'ينتظر رد المدرب',
  accepted: 'قبل التأجيل',
  declined: 'رفض — أوقفت الشعبة',
  expired: 'لم يرد — أوقفت الشعبة',
  withdrawn: 'سحبنا الاقتراح',
}

/** السببُ الافتراضيّ — يُحرَّر قبل الإرسال */
export const DEFAULT_POSTPONE_REASON_AR = 'بدأنا التسويق لهذا الفصل متأخرين، ونحتاج وقتا أطول لتسجيل المتعلمين'

/** سببُ الإيقاف الذي يصل المدرّبَ والمتعلّمين */
export const declinedReasonAr = 'لم يقبل المدرب تأجيلها'
export const expiredReasonAr = 'لم يقبل المدرب تأجيلها قبل الموعد المحدد'

/* ═══ والمسوّدةُ ليست على الموقع — تُوسَم ولا تُختار سلفا (٢٤ أكتوبر ٢٠٢٦) ═══
   سؤالُ صاحب المنصّة عن شعبةٍ في القائمة: «لم أنشر هذه الدورة.. أما زالت موجودةً في الموقع؟». والموقعُ لا يعرض
   إلّا المفتوحةَ والممتلئة، والقائمةُ تجمع معهما المسوّدة بلا فرق. فاختار: تبقى فيها موسومةً «غير منشورة»، ولا
   تُختار سلفا — فلا يصل مدرّبَها اقتراحٌ إلّا إن اختارها هو. */
export const ON_SITE_STATUSES = ['open', 'full'] as const
export const NOT_ON_SITE_AR = 'غير منشورة'
export const isOnSite = (status: string) => (ON_SITE_STATUSES as readonly string[]).includes(status)

/** ما يُختار سلفا: ما يُرسل له وهو على الموقع */
export function prePicked(rows: readonly { cohortId: string; status: string; blockedAr: string | null }[]): string[] {
  return rows.filter((c) => !c.blockedAr && isOnSite(c.status)).map((c) => c.cohortId)
}

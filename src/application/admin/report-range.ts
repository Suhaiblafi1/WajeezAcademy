/* مدّةُ التقرير بتوقيت عمّان (٨ نوفمبر ٢٠٢٦).

   كانت شاشةُ التقارير ترسل «من ١ نوفمبر إلى ٣٠ نوفمبر» لحظتين: منتصفَ ليل كلٍّ منهما **بتوقيت غرينتش**. فسقط اليومُ الأخيرُ
   كلُّه (حدُّه أوّلُه لا آخرُه)، وبدأ كلُّ يومٍ في الثالثة فجرا بتوقيت عمّان — فدفعةُ الواحدة ليلا تُحسب في اليوم الذي قبله. وكانت
   الأشهرُ تُجمع بغرينتش كذلك: دفعةُ أوّل ديسمبر فجرا في نوفمبر. فهنا اليومُ يومُ عمّان كاملا، والشهرُ شهرُها.

   والحارس: `server/tests/reports/report-range.test.ts`. */

import { ACADEMY_ZONE, zonedDay, zonedInstant } from '../trainer/cohort-period'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** أوّلُ المدّة: يومٌ (`YYYY-MM-DD`) يبدأ من منتصف ليله بتوقيت عمّان — ولحظةٌ كاملةٌ تؤخذ كما هي */
export function reportFrom(value: string): Date {
  return DAY_RE.test(value) ? zonedInstant(value, [0, 0, 0, 0], ACADEMY_ZONE) : new Date(value)
}

/** آخرُ المدّة: اليومُ كلُّه حتّى آخر جزءٍ من ثانيته بتوقيت عمّان — ولحظةٌ كاملةٌ تؤخذ كما هي */
export function reportTo(value: string): Date {
  return DAY_RE.test(value) ? zonedInstant(value, [23, 59, 59, 999], ACADEMY_ZONE) : new Date(value)
}

/** يومُ لحظةٍ في التقرير — `YYYY-MM-DD` بتوقيت عمّان */
export const reportDay = (at: Date): string => zonedDay(at, ACADEMY_ZONE)

/** شهرُ لحظةٍ في التقرير — `YYYY-MM` بتوقيت عمّان */
export const reportMonth = (at: Date): string => zonedDay(at, ACADEMY_ZONE).slice(0, 7)

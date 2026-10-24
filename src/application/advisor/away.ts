/* إجازةُ المستشار — من خانتي تاريخ إلى لحظتين، واسمُه في قوائم الإسناد (١٩ أكتوبر ٢٠٢٦). والعلّةُ في
   `server/services/advisor-away.service.ts`.

   اليومان كاملان بتوقيت جهاز من يكتب: البدايةُ من أوّل يومها، والنهايةُ إلى آخر يومها — فمن كتب
   «إلى الخميس» لا يعود إليه الإسنادُ صباحَ الخميس. */

import { fmtDate } from '../text/format-ar'

/** «2026-11-01» و«2026-11-05» → أوّلُ الأوّل وآخرُ الثاني، بتوقيت الجهاز */
export function awayRange(fromDay: string, untilDay: string): { from: string; until: string } {
  const from = new Date(`${fromDay}T00:00:00`)
  const until = new Date(`${untilDay}T00:00:00`)
  until.setDate(until.getDate() + 1)
  return { from: from.toISOString(), until: until.toISOString() }
}

/** آخرُ يومٍ في الإجازة — النهايةُ تُحفظ أوّلَ اليوم الذي بعده، فيُقال اليومُ الذي قبلها */
export const awayLastDay = (until: string | Date): Date => new Date(new Date(until).getTime() - 1)

/** من تُسند إليه حالة: له ملفُّ مستشار — بلاه لا تُفتح بوّابتُه، والخادمُ يردّ الإسناد (`assign`، ٢٤ أكتوبر ٢٠٢٦).
    والملفُّ يولد حين تُحفَظ عمولتُه في «المستشارون والعمولة». وغيابُ الخبر لا يمنع: الخادمُ يقرّر */
export const canTakeCases = (a: { hasProfile?: boolean }): boolean => a.hasProfile !== false

/** اسمُ المستشار في قوائم الإسناد — ومن في إجازته يُقال، فيُختار عن علم. ومن لا ملفَّ له يُقال لماذا لا يُختار */
export function advisorOptionAr(a: { displayName: string; email: string; awayUntil?: string | null; hasProfile?: boolean }): string {
  const note = !canTakeCases(a)
    ? ' — بلا ملف مستشار، احفظ عمولته أولا'
    : a.awayUntil ? ` — في إجازة حتى ${fmtDate(awayLastDay(a.awayUntil))}` : ''
  return `${a.displayName} (${a.email})${note}`
}

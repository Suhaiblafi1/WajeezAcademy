/* نصُّ «الفصل القادم» — بلا JSX ليُقاس بالاستدعاء لا بقراءة ملفّ (البند ٥٢).

   وُلد هذا الملفّ من قطعِ المكوّن لسببين: أنّ `tsconfig.node.json` يشمل
   `src/tests` بلا `--jsx` فلا يستورد اختبارٌ مكوّنا، وأنّ منطقَ العدّ
   والصياغة يُقاس بمدخلاته ومخرجاته لا بأنّه ظهر على شاشة. */

import type { UpcomingTerm } from '@/services/upcoming-term'
import { fmtDateAr } from '@/utils/format'

/* ─────────── عدُّ الأيّام — «خلال ٩ أيّام» أوقعُ من تاريخٍ يُطرَح ───────────

   ودعواتُ الرئيسة الثمانِ كلُّها بلا تاريخ. والمؤرَّخُ منها يُقرأ نداءً،
   وغيرُ المؤرَّخِ يُقرأ لافتة. */

/** أيّامٌ كاملةٌ حتّى التاريخ — سالبةٌ إن مضى */
export function daysUntil(iso: string, now = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000)
}

/** «٩ أيّام» بصيغتها — لا «9 يوم» ولا «1 أيام» */
function daysAr(n: number): string {
  if (n === 1) return 'يومٍ واحد'
  if (n === 2) return 'يومين'
  if (n <= 10) return `${n} أيّام`
  return `${n} يوما`
}

/** الجملةُ الحاسمة: ماذا يفعل الزائرُ الآن، ومتى — أو `null` إن لا شيءَ يُقال */
export function termUrgencyAr(term: UpcomingTerm, now = new Date()): string | null {
  if (term.registrationOpen) {
    if (!term.registrationClosesAt) return 'والتسجيل مفتوح'
    const left = daysUntil(term.registrationClosesAt, now)
    if (left <= 0) return 'والتسجيل مفتوح'
    return left <= 21
      ? `والتسجيل يُغلق خلال ${daysAr(left)}`
      : `والتسجيل مفتوح حتّى ${fmtDateAr(term.registrationClosesAt)}`
  }
  if (!term.registrationOpensAt) return null
  const until = daysUntil(term.registrationOpensAt, now)
  if (until <= 0) return null
  return until <= 21
    ? `والتسجيل يفتح خلال ${daysAr(until)}`
    : `والتسجيل يبدأ ${fmtDateAr(term.registrationOpensAt)}`
}

/** «فصل الربيع (فبراير — أبريل)» — الاسمُ وأشهرُه */
export function termMonthsAr(term: UpcomingTerm): string {
  return `${fmtDateAr(term.startsOn)} — ${fmtDateAr(term.endsOn)}`
}

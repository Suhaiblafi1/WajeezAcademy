/* ═══ متى تبدأ الشعبة — وما لم تبدأ ليست «جارية» (٢٤ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة وهو ينظر في بطاقة مدرّبٍ ظاهرٍ في صفحة المدرّبين: «لماذا لا تظهر شعبته هنا؟». وكانت
   شعبتُه الوحيدةُ موسومةً «جارية» وأوّلُ لقاءٍ فيها بعد أسابيع: زرُّ «ابدأ التقديم» في الإدارة يُجريها بضغطة،
   ولم يكن طريقٌ من «جارية» إلى «مفتوحة». فالبوّابةُ تُظهره (تعدّ الجارية) والبطاقةُ تُسقطها (لا تعدّ إلّا المفتوحة
   والممتلئة) — فيُكتب تحت اسمه «لا دورة منشورة له».

   والقاعدةُ القائمةُ «الحالةُ تتبع التواريخَ لا الضغطات» (`CohortService.syncStatusesByDate`). فبدءُ الشعبة
   أسبقُ اثنين: بدءُ مدّتها (`startsAt`) أو أوّلُ لقاءٍ قائمٍ فيها — والملغى ليس موعدا. وما لا تاريخَ له لا
   حكمَ له. والصيغتان هنا تقولان الشيءَ نفسَه: دالّةٌ لما بين اليدين، وشرطُ استعلامٍ لما في الجدول. */

import type { Prisma } from '@prisma/client'

/** أوّلُ ما تبدأ به الشعبة — أو لا شيء إن لم يكن لها تاريخ */
export function cohortBeginsAt(startsAt: Date | null, sessions: { startsAt: Date; status?: string }[]): Date | null {
  const times = [startsAt, ...sessions.filter((s) => s.status !== 'cancelled').map((s) => s.startsAt)]
    .filter((d): d is Date => d !== null)
  return times.length ? new Date(Math.min(...times.map((d) => d.getTime()))) : null
}

/** لم تبدأ بعد: لها تاريخٌ، وكلُّ تواريخها بعد الآن */
export function notStartedCohortWhere(now: Date): Prisma.CohortWhereInput {
  const live: Prisma.CohortSessionWhereInput = { status: { not: 'cancelled' } }
  return {
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { gt: now } }] },
      { sessions: { none: { ...live, startsAt: { lte: now } } } },
      { OR: [{ startsAt: { not: null } }, { sessions: { some: live } }] },
    ],
  }
}

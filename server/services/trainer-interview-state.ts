/* حالُ الطلب حين لا يبقى له موعدٌ قائم — موضعٌ واحدٌ لا موضعان.

   ═══ لمَ يُجمَع هنا ═══

   بابان يُفضيان إلى الحال نفسِها: من **ألغى** موعدَه من Calendly، ومن **لم
   يحضره** فسُجّل غيابُه. وفي الحالَين: لم يقع لقاء، والطلبُ واقفٌ في
   «حُدّد موعدُه» وهي حالةٌ تصف موعدا لم يعد قائما — فيُعاد إلى حيث كان
   قبل الحجز ليحجز من جديد.

   وكان المنطقُ مكتوبا في مسار Calendly وحدَه. ولو نُسخ للغياب لَصار للقرار
   موضعان يفترقان أوّلَ تعديل: يُشدَّد شرطٌ هنا ويُترك هناك، فيعود المتقدّمُ
   في بابٍ ويقف في الآخر بلا أن يُحمِّر شيئا.

   ═══ و«إلى حيث كان» تُقرأ من السجلّ لا تُخمَّن ═══

   الحالةُ السابقةُ مكتوبةٌ في `TrainerStatusHistory`: آخرُ انتقالٍ إلى
   «حُدّد موعدُه» يحمل ما جاء منه. فمن كان في «قائمةٍ قصيرة» يعود إليها،
   ومن كان في «مقدَّم» يعود إليه — ولا يُفترض للجميع مبدأٌ واحد. وإن لم
   يُقرأ شيءٌ أو لم تسمح خريطةُ الانتقالات، بقي كما هو: حالةٌ واقفةٌ يراها
   المراجعُ خيرٌ من انتقالٍ مخترَع. */

import type { Prisma } from '@prisma/client'
import { NO_SHOW } from '../../src/application/trainer/interview-outcome'
import { ALLOWED_TRANSITIONS, type TrainerApplicationService, type TrainerStatus } from './trainer-application.service'

/** موعدٌ قائم في لغة القاعدة — نظيرُ `isLiveInterview` في الوحدة النقيّة.
 *
 *  والشرطُ يُكتب `OR` لا `not` وحدَها: `outcome` عمودٌ يقبل الفراغ، وأكثرُ
 *  المواعيد بلا نتيجةٍ بعد — فشرطٌ يقارن الفراغَ بنصٍّ قد يُسقطها كلَّها. */
export const LIVE_INTERVIEW = {
  canceledAt: null,
  OR: [{ outcome: null }, { outcome: { not: NO_SHOW } }],
} satisfies Prisma.TrainerInterviewWhereInput

/* ═══ الموعدُ المعلَّق — ما ينتظر أن يقع أو أن تُسجَّل نتيجتُه ═══

   طلب صاحبُ المنصّة (٢١ سبتمبر ٢٠٢٦): «للأشخاص الذين حجزوا موعدا ضع في
   الليبل موعدَ مقابلتهم القادمة، ومن لم يحجز يكون ليبلُه أنّه لم يحجز
   موعدا بعد». وكان الصفُّ يعرض عددا لا تاريخا: `interviewsCount` يقول
   «١» ولا يقول متى — فمن أراد أن يعرف متى يلقاه فتح ملفَّه.

   ── ولمَ موعدان في حقلٍ واحد ──

   القادمُ أولى بالعرض ما دام قادما. فإن مضى ولم تُسجَّل نتيجتُه فهو
   **ما زال معلَّقا**: لقاءٌ جرى وينتظر من يكتب قولَه فيه، وإخفاؤه يترك
   الصفَّ صامتا عمّن هو أحوجُ ما يكون إلى نظرة. فالحقلُ واحدٌ ويقول
   «الموعدُ الذي ينتظر»، والشاشةُ تقرأ تاريخَه فتعرف أمضى أم لم يأتِ.

   ── وما لا يُعَدّ معلَّقا ──

   الملغى (لا موعدَ له)، والمسجَّلةُ نتيجتُه (انتهى أمرُه)، والغيابُ
   (`no_show` نتيجةٌ سُجّلت، والطلبُ عاد إلى ما قبل الحجز فصاحبُه في
   «لم يحجز» لا في «له موعد»). */
export interface ScheduledInterview {
  scheduledAt: Date
  outcome: string | null
  canceledAt?: Date | null
}

/**
 * الموعدُ الذي ينتظر — أقربُ قادمٍ بلا نتيجة، وإلّا فآخرُ ماضٍ بلا نتيجة.
 *
 * `rows` تُقرأ بأيّ ترتيبٍ كانت: الاختيارُ بالمقارنة لا بموضعٍ في مصفوفة،
 * فلا يتبدّل الجوابُ لو تبدّل `orderBy` في نداءٍ بعيد.
 */
export function pendingInterview(rows: readonly ScheduledInterview[], now: Date): Date | null {
  const open = rows.filter((iv) => !iv.canceledAt && iv.outcome === null)
  const upcoming = open.filter((iv) => iv.scheduledAt.getTime() > now.getTime())
  /* أقربُ القادم؛ فإن لم يكن فأحدثُ ما مضى — وهو آخرُ ما جرى ولم يُسجَّل */
  const pick = upcoming.length > 0
    ? upcoming.reduce((a, b) => (a.scheduledAt <= b.scheduledAt ? a : b))
    : open.reduce<ScheduledInterview | null>((a, b) => (a && a.scheduledAt >= b.scheduledAt ? a : b), null)
  return pick?.scheduledAt ?? null
}

/** يعيد الطلبَ إلى ما قبل الحجز إن لم يبقَ له موعدٌ قائم — ويردّ ما عاد إليه */
export async function revertWhenNoLiveInterview(
  tx: Prisma.TransactionClient,
  apps: TrainerApplicationService,
  applicationId: string,
  actorId: string | null,
  reasonAr: string,
): Promise<TrainerStatus | null> {
  const app = await tx.trainerApplication.findUnique({
    where: { id: applicationId }, select: { status: true },
  })
  /* ولا يُمَسّ طلبٌ في غيرها: من مضى إلى «ديمو» أو «مراجعة أكاديميّة» بعد
     لقائه لا يُردّ إلى الوراء بإلغاء موعدٍ ثانٍ أو غيابٍ عنه. */
  if (app?.status !== 'interview_scheduled') return null

  const live = await tx.trainerInterview.count({ where: { applicationId, ...LIVE_INTERVIEW } })
  if (live > 0) return null

  const previous = await tx.trainerStatusHistory.findFirst({
    where: { applicationId, toStatus: 'interview_scheduled' },
    orderBy: { createdAt: 'desc' },
    select: { fromStatus: true },
  })
  const backTo = previous?.fromStatus as TrainerStatus | undefined
  if (!backTo || !ALLOWED_TRANSITIONS.interview_scheduled.includes(backTo)) return null

  await apps.transition(applicationId, backTo, actorId, reasonAr, tx)
  return backTo
}

/* جاهزيّةُ العرض — محاذاةُ أسعار الشعب، وإعلامُ من ينتظر شعبةً فُتحت.

   والسعرُ لا يُقرأ من الكتالوج بل من الشعب، وهذا مقصود: رقمٌ لا تسنده
   شعبةٌ قابلة للتسجيل وعدٌ يفترق عن الفاتورة. فما لا شعبةَ له لا سعرَ له.

   ─────────── وكان هنا «فتحُ شعبةٍ لكلّ دورة» — وتقاعد (١٢ أكتوبر ٢٠٢٦) ───────────

   `openAllCohorts` كان يُنشئ لكلّ دورةٍ منشورةٍ شعبةً بجلساتٍ وخطّةٍ أساسيّة
   ويفتحها، على قرارٍ قديم: «تُفتح الشعبُ كلُّها الآن، ويُسنَد المدرّبون دفعةً
   واحدةً لاحقا». فعُرضت للعموم شعبٌ بموعدٍ وسعرٍ ولا مدرّبَ وراءها.

   وقرارُ صاحب المنصّة اليوم: «أريد أن يظهر للعوامّ فقط الدورات التي لها مدرّبٌ
   واعتمدتُها أنا، والباقي يظهر بلا شعبٍ مفتوحة». فصار من شروط الفتح خطّةُ مدرّبٍ
   معتمَدة (`CohortService.openChecklist`)، وصار الكتالوجُ والدفعُ يردّان ما
   سواها (`registration-window.ts`). وبقاءُ الزرّ بعدها يُنشئ مسوّداتٍ لا تُفتح
   أبدا — بلا مدرّبٍ ولا من ينتظرها — فخرج هو وسكربتُه ومسارُه.

   والشعبةُ تُفتح اليوم من بطاقتها بعد اعتماد خطّة مدرّبها، واحدةً واحدة. */

import type { PrismaClient } from '@prisma/client'
import { recordAudit } from './audit'
import { safeNotify } from './notification.service'
import { cohortAcceptsRegistration, PLAN_GATE_SELECT, TERM_WINDOW_SELECT } from './registration-window'

/** السعةُ المقترحةُ لشعبةٍ تُفتح — يملؤها لوحُ ما بعد الاعتماد (`TrainerNextSteps`) */
export const DEFAULT_CAPACITY = 20

export interface AlignPricesResult {
  applied: boolean
  cohorts: number
  changed: number
  alreadyAligned: number
  skippedNoListPrice: number
  skippedCommitted: number
  rows: { cohortId: string; courseId: string; title: string; from: string; to: string; blocked?: string }[]
}

/**
 * يُعلم من ينتظر دورةً بأنّ شعبتَها فُتحت.
 *
 * الوعد كان مكتوبا في بوابة المتعلّم — «نُعلمك عند فتحها» — ولم يكن له
 * منفّذ. فمن أبقى دورةً بلا شعبة في خطّته كان ينتظر إشعارا لا يأتي، ولا
 * يعرف أنّ شعبتَها فُتحت إلّا إن عاد وفحص بنفسه.
 *
 * ولا يُلاحَق من لم يطلب: `notifyOnCohort` قد يُطفأ. ولا يُكرَّر الإشعار:
 * `notifiedAt` يُختم بعد الإرسال، وما خُتم لا يُرسَل له ثانيةً (١٢ أكتوبر
 * ٢٠٢٦). وكان التعليقُ يقول ذلك والاستعلامُ لا يقرؤه — فكلُّ شعبةٍ تُفتح
 * للدورة نفسِها كانت تُعيد الإشعارَ لكلّ من انتظرها.
 *
 * ولا يُعلَم من اشترى الدورةَ أصلا: سُجّل فيها أو دُفع ثمنُ مقعده.
 */
export async function notifyPlanWaiters(
  prisma: PrismaClient,
  courseIds: string[],
): Promise<{ notified: number }> {
  if (courseIds.length === 0) return { notified: 0 }

  const items = await prisma.learnerPlanItem.findMany({
    where: {
      courseId: { in: courseIds },
      notifyOnCohort: true,
      notifiedAt: null,
      plan: { status: 'active' },
    },
    include: {
      plan: { select: { userId: true } },
    },
  })
  if (items.length === 0) return { notified: 0 }

  /* من اشترى الدورة — مسجَّلٌ فيها، أو حُجز مقعدُه بطلبٍ مدفوع */
  const users = [...new Set(items.map((i) => i.plan.userId))]
  const [enrolled, held] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId: { in: users }, status: { in: ['enrolled', 'completed', 'waitlisted'] }, cohort: { courseId: { in: courseIds } } },
      select: { userId: true, cohort: { select: { courseId: true } } },
    }),
    prisma.enrollmentRequest.findMany({
      where: { userId: { in: users }, status: { in: ['seat_held', 'converted'] }, cohort: { courseId: { in: courseIds } } },
      select: { userId: true, cohort: { select: { courseId: true } } },
    }),
  ])
  const owns = new Set([...enrolled, ...held].map((r) => `${r.userId}:${r.cohort.courseId}`))

  const titles = new Map<string, string>()
  const courses = await prisma.course.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.courseId))] } },
    include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } },
  })
  for (const c of courses) titles.set(c.id, c.versions[0]?.titleAr ?? c.id)

  let notified = 0
  for (const item of items) {
    if (owns.has(`${item.plan.userId}:${item.courseId}`)) continue
    const titleAr = titles.get(item.courseId) ?? item.courseId
    await safeNotify(prisma, {
      userId: item.plan.userId,
      channel: 'in_app',
      title: 'فتحت شعبة دورة كنت تنتظرها',
      body: `«${titleAr}» صار لها موعد وسعر. افتح خطّتك لتحجز مقعدك.`,
      data: { courseId: item.courseId },
    })
    await prisma.learnerPlanItem.update({
      where: { id: item.id }, data: { notifiedAt: new Date() },
    })
    notified++
  }
  return { notified }
}

/**
 * يُعلم المنتظرين **حين تصير الشعبةُ قابلةً للشراء فعلا** — لا حين يُرفع علمُها وحدَه.
 *
 * كان الإعلامُ يقع في موضعٍ واحد: رفعُ علم التسجيل من بطاقة الشعبة. وزرُّ «افتح
 * الشعبة» — وهو الطريقُ المعتاد — لا يُعلم أحدا، ولا اعتمادُ خطّةٍ يرفع آخرَ
 * مانعٍ عن شعبةٍ مفتوحة. فيُقال للمتعلّم «نُعلمك فور فتح شعبتها» ولا يُعلَم.
 *
 * ومنذ ١٢ أكتوبر ٢٠٢٦ لا تُعرض شعبةٌ ولا تُباع إلّا باعتماد خطّة مدرّبها، فالعلمُ
 * المرفوعُ وحدَه لا يعني شيئا. فالسؤالُ واحدٌ في المواضع الثلاثة — الفتحُ ورفعُ
 * العلم والاعتماد: أتقبل الشعبةُ الآن تسجيلا؟ بقاعدة التسجيل نفسِها.
 */
export async function notifyIfPurchasable(prisma: PrismaClient, cohortId: string): Promise<{ notified: number }> {
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    include: { term: TERM_WINDOW_SELECT, plans: PLAN_GATE_SELECT },
  })
  if (!cohort || !['open', 'full'].includes(cohort.status)) return { notified: 0 }
  if (!cohortAcceptsRegistration(cohort).open) return { notified: 0 }
  return notifyPlanWaiters(prisma, [cohort.courseId])
}

/**
 * يوحّد أسعار الشعب على سعر قائمة دورتها — ويرفض شعبةً دفع فيها أحد.
 *
 * إعادةُ تسعير مقعدٍ محجوزٍ أو مدفوع تغيّر ما اتُّفق عليه بعد الاتّفاق.
 * فتُترك ويُقال ذلك صراحةً بدل أن تُعدَّل بصمت.
 */
export async function alignCohortPrices(
  prisma: PrismaClient,
  opts: { apply: boolean; actorId?: string } = { apply: false },
): Promise<AlignPricesResult> {
  const cohorts = await prisma.cohort.findMany({
    include: {
      course: { select: { id: true, listPrice: true, listCurrency: true } },
      enrollmentRequests: { select: { status: true, orderId: true } },
    },
    orderBy: { id: 'asc' },
  })

  const rows: AlignPricesResult['rows'] = []
  let changed = 0, alreadyAligned = 0, skippedNoListPrice = 0, skippedCommitted = 0

  for (const c of cohorts) {
    const list = c.course?.listPrice
    if (list === null || list === undefined) { skippedNoListPrice++; continue }

    const target = Number(list)
    const targetCur = c.course?.listCurrency ?? 'USD'
    const current = c.price === null ? null : Number(c.price)
    if (current === target && c.currency === targetCur) { alreadyAligned++; continue }

    const committed = c.enrollmentRequests.filter(
      (r) => r.status === 'seat_held' || r.status === 'converted' || r.orderId)
    if (committed.length > 0) {
      skippedCommitted++
      rows.push({
        cohortId: c.id, courseId: c.courseId, title: c.title,
        from: `${current ?? '—'} ${c.currency}`, to: `${target} ${targetCur}`,
        blocked: `${committed.length} مقعدا محجوزا أو مدفوعا — لا يعاد تسعيرها`,
      })
      continue
    }

    rows.push({
      cohortId: c.id, courseId: c.courseId, title: c.title,
      from: `${current ?? 'بلا سعر'} ${c.currency}`, to: `${target} ${targetCur}`,
    })
    if (opts.apply) {
      await prisma.cohort.update({
        where: { id: c.id }, data: { price: target, currency: targetCur, financialReady: true },
      })
    }
    changed++
  }

  if (opts.apply && changed > 0) {
    await recordAudit(prisma, {
      actorId: opts.actorId ?? null, action: 'catalog.cohorts.align_prices',
      entityType: 'catalog', entityId: 'all',
      meta: { changed, alreadyAligned, skippedCommitted, skippedNoListPrice },
    })
  }

  return { applied: opts.apply, cohorts: cohorts.length, changed, alreadyAligned, skippedNoListPrice, skippedCommitted, rows }
}

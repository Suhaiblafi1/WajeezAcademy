/* جاهزيّةُ العرض — فتحُ الشعب ومحاذاةُ أسعارها، من اللوحة لا من الطرفيّة.

   لماذا خدمةٌ لا سكربتٌ فقط: العمليّتان كانتا في `scripts/` وحدهما، فلا
   تُنفَّذان إلّا من طرفيّةٍ تملك `DATABASE_URL` الإنتاج. فبقيت ٨١ دورةً
   معروضةً بلا سعر شهورا لأنّ أحدا لم يفتح طرفيّة — وهو ثمنٌ باهظ لعمليّةٍ
   تستغرق ثانية.

   والسعرُ لا يُقرأ من الكتالوج بل من الشعب، وهذا مقصود: رقمٌ لا تسنده
   شعبةٌ قابلة للتسجيل وعدٌ يفترق عن الفاتورة. فما لا شعبةَ له لا سعرَ له —
   والعلاج فتحُ الشعب لا اختلاقُ الأسعار.

   والمنطق هنا هو مصدرُ الحقيقة، والسكربتان يستدعيانه — فلا يفترق ما تفعله
   اللوحة عمّا يفعله السطر. */

import type { PrismaClient } from '@prisma/client'
import { recordAudit } from './audit'
import { safeNotify } from './notification.service'

export const DEFAULT_WEEKS_AHEAD = 6
export const DEFAULT_CAPACITY = 20

/** حالاتُ شعبةٍ تُعدّ «حيّة» فلا تُفتح لها أخرى */
const LIVE = ['open', 'full', 'active']

export interface OpenCohortsResult {
  applied: boolean
  publishedCourses: number
  opened: number
  alreadyLive: number
  skippedNoListPrice: number
  startsAt: string
  rows: { courseId: string; titleAr: string; price: number; currency: string; reason?: string }[]
}

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
 * ولا يُلاحَق من لم يطلب: `notifyOnCohort` قد يُطفأ. ولا يُكرَّر الإشعار
 * على الفتح نفسه: `notifiedAt` يُختم بعد الإرسال.
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
      plan: { status: 'active' },
    },
    include: {
      plan: { select: { userId: true } },
    },
  })
  if (items.length === 0) return { notified: 0 }

  const titles = new Map<string, string>()
  const courses = await prisma.course.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.courseId))] } },
    include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } },
  })
  for (const c of courses) titles.set(c.id, c.versions[0]?.titleAr ?? c.id)

  let notified = 0
  for (const item of items) {
    const titleAr = titles.get(item.courseId) ?? item.courseId
    await safeNotify(prisma, {
      userId: item.plan.userId,
      channel: 'in_app',
      title: 'فُتحت شعبة دورةٍ كنت تنتظرها',
      body: `«${titleAr}» صار لها موعدٌ وسعر. افتح خطّتك لتحجز مقعدك.`,
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
 * يفتح شعبةً لكلّ دورةٍ منشورة لا شعبةَ حيّةَ لها.
 *
 * ولا تُفتح دورةٌ بلا سعرِ قائمة: فتحُها يوجب اختلاق سعر، والسعرُ المختلَق
 * أسوأ من غياب السعر — لأنّ الأوّل يُطالَب به في الفاتورة.
 */
export async function openAllCohorts(
  prisma: PrismaClient,
  opts: { apply: boolean; weeks?: number; capacity?: number; actorId?: string } = { apply: false },
): Promise<OpenCohortsResult> {
  const weeks = Math.min(Math.max(opts.weeks ?? DEFAULT_WEEKS_AHEAD, 1), 52)
  const capacity = Math.min(Math.max(opts.capacity ?? DEFAULT_CAPACITY, 1), 500)

  const courses = await prisma.course.findMany({
    where: { status: 'published' },
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 },
      cohorts: { select: { id: true, status: true, registrationOpen: true } },
    },
    orderBy: { id: 'asc' },
  })

  const startsAt = new Date(Date.now() + weeks * 7 * 86_400_000)
  startsAt.setUTCHours(15, 0, 0, 0) /* ١٨:٠٠ بتوقيت عمّان */

  const rows: OpenCohortsResult['rows'] = []
  let opened = 0, alreadyLive = 0, skippedNoListPrice = 0

  for (const c of courses) {
    const live = c.cohorts.some((h) => LIVE.includes(h.status) && h.registrationOpen)
    if (live) { alreadyLive++; continue }
    if (c.listPrice === null) {
      skippedNoListPrice++
      rows.push({ courseId: c.id, titleAr: c.versions[0]?.titleAr ?? c.id, price: 0, currency: '—', reason: 'بلا سعر قائمة — لا تُفتح بسعرٍ مُختلَق' })
      continue
    }
    const titleAr = c.versions[0]?.titleAr ?? c.id
    const price = Number(c.listPrice)
    const currency = c.listCurrency ?? 'USD'
    rows.push({ courseId: c.id, titleAr, price, currency })
    if (opts.apply) {
      await prisma.cohort.create({
        data: {
          courseId: c.id, title: `${titleAr} — الدفعة الأولى`, status: 'open', startsAt,
          daysOfWeek: ['tue', 'thu'], startTime: '18:00', timezone: 'Asia/Amman',
          capacity, price, currency, language: 'العربية', deliveryMode: 'remote',
          registrationOpen: true, financialReady: true,
        },
      })
    }
    opened++
  }

  if (opts.apply && opened > 0) {
    await recordAudit(prisma, {
      actorId: opts.actorId ?? null, action: 'catalog.cohorts.open_all',
      entityType: 'catalog', entityId: 'all',
      meta: { opened, alreadyLive, skippedNoListPrice, weeks, capacity },
    })
    /* من انتظر يُعلَم — وإلّا بقي الوعد في الشاشة بلا منفّذ */
    await notifyPlanWaiters(prisma, rows.filter((r) => !r.reason).map((r) => r.courseId))
  }

  return {
    applied: opts.apply, publishedCourses: courses.length, opened, alreadyLive,
    skippedNoListPrice, startsAt: startsAt.toISOString(), rows,
  }
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
        blocked: `${committed.length} مقعدا محجوزا أو مدفوعا — لا يُعاد تسعيرها`,
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

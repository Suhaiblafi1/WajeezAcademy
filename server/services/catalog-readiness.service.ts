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
import { CohortService } from './cohort.service'

export const DEFAULT_WEEKS_AHEAD = 6
export const DEFAULT_CAPACITY = 20
/** أسابيعُ الجلسات المولَّدة مع الشعبة — تُحرَّر من بطاقتها بعدُ */
export const DEFAULT_SESSION_WEEKS = 6

/** حالاتُ شعبةٍ تُعدّ «حيّة» فلا تُفتح لها أخرى */
const LIVE = ['open', 'full', 'active']

/* حالاتٌ تعني «لهذه الدورة شعبةٌ قائمةٌ فلا تُنشأ ثانية».

   كانت الشعبةُ تُنشأ مفتوحةً، فكفى فحصُ `LIVE` لمنع التكرار. ولمّا صارت
   تُنشأ مسوّدةً (تنتظر مدرّبا) خرجت المسوّدةُ من الفحص — فكلُّ نداءٍ ثانٍ
   يُنشئ نسخةً أخرى، وتتراكم المسوّداتُ بعدد الضغطات. فالمسوّدةُ تُعدّ قائمة:
   هي شعبةٌ تنتظر شرطا، لا فراغٌ يُملأ. */
const EXISTING = [...LIVE, 'draft']

export interface OpenCohortsResult {
  applied: boolean
  publishedCourses: number
  /** شعبٌ أُنشئت **وفُتحت** فعلا — استوفت شروط الفتح الستّة */
  opened: number
  /** شعبٌ أُنشئت وبقيت مسوّدةً لأنّ شرطا نقص — والسببُ في صفّها */
  prepared: number
  alreadyLive: number
  skippedNoListPrice: number
  startsAt: string
  rows: { courseId: string; titleAr: string; price: number; currency: string; reason?: string; blocked?: string[] }[]
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
 * يهيّئ شعبةً لكلّ دورةٍ منشورة لا شعبةَ حيّةَ لها، **ويفتح ما استوفى شروطَه**.
 *
 * ولا تُفتح دورةٌ بلا سعرِ قائمة: فتحُها يوجب اختلاق سعر، والسعرُ المختلَق
 * أسوأ من غياب السعر — لأنّ الأوّل يُطالَب به في الفاتورة.
 *
 * ── ولماذا لم يعد يفتح كلَّ شيء ──
 *
 * كان يُنشئ الصفَّ بـ`status: 'open'` و`registrationOpen: true` **مباشرةً**،
 * فيتخطّى شروطَ الفتح الستّة كلَّها (`CohortService.openChecklist`). والنتيجةُ
 * أنّ زرّا واحدا يفتح للبيع **شعبا بلا مدرّبٍ ولا جدولٍ ولا خطّةِ تقديم** —
 * فيدفع متعلّمٌ ثمنَ مقعدٍ لا أحدَ يدرّس فيه ولا موعدَ له. وهو أسوأُ ما قد
 * يفعله زرٌّ في هذه المنصّة: لا يفشل، ولا يشتكي أحد، حتّى يأتي أوّلُ موعد.
 *
 * فصار يهيّئ ما يستطيع تهيئتَه: يُنشئ الشعبةَ مسوّدةً بسعرها وسعتها، **ويولّد
 * جلساتِها** من نمطها، **ويكتب خطّةَ تقديمٍ أساسيّة** — ثمّ يستدعي `open()`
 * نفسَها التي يستدعيها الزرُّ المفرد. فما استوفى فُتح، وما نقصه شيءٌ بقي
 * مسوّدةً **ونقصُه مكتوبٌ في صفّه** لا مخفيّا.
 *
 * والباقي في الغالب مدرّب — وهو ما لا يُختلق: يُسنَد من شاشة «التأهيل
 * والإسناد».
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
      cohorts: { select: { id: true, status: true } },
    },
    orderBy: { id: 'asc' },
  })

  const startsAt = new Date(Date.now() + weeks * 7 * 86_400_000)
  startsAt.setUTCHours(15, 0, 0, 0) /* ١٨:٠٠ بتوقيت عمّان */

  const rows: OpenCohortsResult['rows'] = []
  let opened = 0, prepared = 0, alreadyLive = 0, skippedNoListPrice = 0
  const service = new CohortService(prisma)

  for (const c of courses) {
    const exists = c.cohorts.some((h) => EXISTING.includes(h.status))
    if (exists) { alreadyLive++; continue }
    if (c.listPrice === null) {
      skippedNoListPrice++
      rows.push({ courseId: c.id, titleAr: c.versions[0]?.titleAr ?? c.id, price: 0, currency: '—', reason: 'بلا سعر قائمة — لا تُفتح بسعرٍ مُختلَق' })
      continue
    }
    const titleAr = c.versions[0]?.titleAr ?? c.id
    const price = Number(c.listPrice)
    const currency = c.listCurrency ?? 'USD'
    const row: OpenCohortsResult['rows'][number] = { courseId: c.id, titleAr, price, currency }
    rows.push(row)
    if (!opts.apply) { opened++; continue }

    const cohort = await prisma.cohort.create({
      data: {
        /* مسوّدةٌ حتّى تستوفي شروطَها — والفتحُ أدناه بالبوّابة نفسِها */
        courseId: c.id, title: `${titleAr} — الدفعة الأولى`, status: 'draft', startsAt,
        daysOfWeek: ['tue', 'thu'], startTime: '18:00', timezone: 'Asia/Amman',
        capacity, price, currency, language: 'العربية', deliveryMode: 'remote',
        registrationOpen: false, financialReady: true,
      },
    })

    /* جلساتٌ من نمط الشعبة، وخطّةُ تقديمٍ أساسيّة — شرطان من الستّة يُوفَّيان
       هنا بلا اختلاق: النمطُ معلَنٌ في الصفّ نفسِه، والخطّةُ تصف ما يقع فعلا. */
    const actor = opts.actorId ?? null
    await service.generateSessions(actor, cohort.id, {
      weeks: DEFAULT_SESSION_WEEKS, apply: true,
    }).catch(() => undefined)
    await service.setDeliveryPlan(cohort.id, actor, {
      notesAr: `تقديمٌ عن بُعد بجلساتٍ أسبوعيّةٍ يومَي الثلاثاء والخميس ٦ مساءً بتوقيت عمّان، ${DEFAULT_SESSION_WEEKS} أسابيع. خطّةٌ أساسيّةٌ أُنشئت مع الشعبة، وتُحرَّر من بطاقتها.`,
      deliveryMode: 'remote',
    }).catch(() => undefined)

    /* البوّابةُ نفسُها التي يمرّ بها الزرُّ المفرد — لا بابَ خلفيّ */
    const check = await service.openChecklist(cohort.id)
    if (check.ready) {
      await service.open(cohort.id, actor)
      opened++
    } else {
      row.blocked = check.missing
      prepared++
    }
  }

  if (opts.apply && opened > 0) {
    await recordAudit(prisma, {
      actorId: opts.actorId ?? null, action: 'catalog.cohorts.open_all',
      entityType: 'catalog', entityId: 'all',
      meta: { opened, prepared, alreadyLive, skippedNoListPrice, weeks, capacity },
    })
    /* من انتظر يُعلَم — **بما فُتح فعلا** لا بما هُيّئ.
       إشعارُ منتظرٍ بشعبةٍ مسوّدةٍ يرسله إلى صفحةٍ لا زرَّ شراءٍ فيها. */
    await notifyPlanWaiters(prisma, rows.filter((r) => !r.reason && !r.blocked).map((r) => r.courseId))
  }

  return {
    applied: opts.apply, publishedCourses: courses.length, opened, prepared, alreadyLive,
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

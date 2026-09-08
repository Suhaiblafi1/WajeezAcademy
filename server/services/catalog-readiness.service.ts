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

/* ═════════ توزيعُ الفصل الأوّل ═════════

   ٨١ دورةً لا تبدأ كلُّها في يومٍ واحد: مدرّبٌ واحدٌ لا يغطّيها، ومتعلّمٌ
   يريد دورتين يجدهما في الساعة نفسِها، ولوحةُ «جدولي» تصير جدارا. فالفتحُ
   واحدٌ (تُفتح كلُّها للتسجيل الآن) والبدءُ موزَّع على الفصل.

   وثلاثةُ قراراتٍ في التوزيع، وكلُّها تُغيَّر يدويّا من بطاقة الشعبة:

   ١) **الأسبقيّةُ لما يُدرَّس اليوم.** الدوراتُ التي اكتملت متونُها تبدأ في
      الموجات الأولى، والتي تنتظر التأليفَ تبدأ بعدها — فيصير فارقُ الأسابيع
      مهلةَ تأليفٍ لا وعدا مؤجَّلا. وداخل كلّ مجموعة: ترتيبُ المسار ثمّ الدورة.

   ٢) **ستّةُ مواعيدَ تتناوب** (يومٌ واحدٌ لكلّ شعبة، ٦ أو ٨ مساءً بتوقيت
      عمّان، من الأحد إلى الخميس). فما بدأ في الموجة نفسِها لا يتزاحم. ويومٌ
      واحدٌ لأنّ الشعبةَ تلتقي كلَّ أسبوعين — فحجزُ يومَين أسبوعيّا بلا معنى.

   ٣) **ثلاثُ جلساتٍ أو أربع، بينها أسبوعان**: أربعٌ لما تجاوز أربعَ وحدات
      وثلاثٌ لما دونها، فلا يزيد اللقاءُ بزيادة الوحدات. والتفصيل عند
      `LIVE_SESSIONS_DEEP` أسفلَه.

   وتاريخُ البدء لا يقع في الماضي ولا غدا: مبدأُ الفصل أو أسبوعان من اليوم،
   أيّهما أبعد — كي يبقى للتسجيل والدفع متّسع. */

/** مبدأُ الفصل الأوّل — أوّلُ أحدٍ من أكتوبر ٢٠٢٦ */
export const SEMESTER_FIRST_DAY = '2026-10-04'
/** أقلُّ مهلةٍ بين الفتح وأوّل جلسة — أسبوعان للتسجيل والدفع */
const MIN_LEAD_DAYS = 14
/** كم دورةً تبدأ في الأسبوع الواحد */
const COURSES_PER_WAVE = 6
/* ─────────── إيقاعُ الجلسات المباشرة — قرارُ صاحب المنصّة (٨ سبتمبر) ───────────
 *
 * كان الحسابُ «جلستان لكلّ وحدة»، فدورةٌ بستّ وحداتٍ تأخذ اثنتَي عشرةَ جلسةً
 * مباشرة، أسبوعيّا بيومَين. **وهذا يقلب ترتيبَ التعلّم**: اللقاءُ يسبق العمل،
 * فيحضر المتدرّبُ ولم يقرأ المادّةَ ولا ملخّصاتِ وجيز ولا شاهد المسجَّل ولا
 * أدّى مهامَّه — فتصير الجلسةُ محاضرةً تُعاد لا لقاءً يُبنى على ما سبقه.
 *
 * فصارت **ثلاثا أو أربعا لا أكثر**، بينها أسبوعان. والأسبوعان ليسا فراغا: هما
 * موضعُ المادّة والملخّصات والمسجَّل والمهامّ. واللقاءُ المباشر لما لا يُغني
 * عنه تسجيل — سؤالٌ يُجاب، وعملٌ يُراجَع، وتصويبٌ يُرى.
 *
 * والعددُ يتبع عمقَ الدورة لا طولَها: أربعٌ لما تجاوزت أربعَ وحدات، وثلاثٌ لما
 * دونها. ولا تُزاد بزيادة الوحدات — فما لا يُغطّى في أربعٍ يُغطّى في المادّة.
 */
const LIVE_SESSIONS_DEEP = 4
const LIVE_SESSIONS_SHORT = 3
/** حدُّ الوحدات الذي يرفع الدورةَ من ثلاث جلساتٍ إلى أربع */
const DEEP_COURSE_MODULES = 5
/** أسبوعان بين جلسةٍ وأخرى — مساحةُ العمل لا فراغ */
const SESSION_INTERVAL_WEEKS = 2

/** المواعيدُ الستّةُ المتناوبة — يومٌ واحدٌ وساعةٌ لكلّ شعبة.
 *
 *  ويومٌ واحدٌ لا يومان: الجلساتُ ثلاثٌ أو أربعٌ متباعدةٌ بأسبوعين، فلا معنى
 *  لحجز يومَين في الأسبوع لشعبةٍ لا تلتقي فيه. والستّةُ تفرّق الشعبَ على
 *  الأسبوع فلا تتكدّس على مساء واحد. */
const SLOTS: { daysOfWeek: string[]; startTime: string }[] = [
  { daysOfWeek: ['sun'], startTime: '18:00' },
  { daysOfWeek: ['mon'], startTime: '18:00' },
  { daysOfWeek: ['tue'], startTime: '18:00' },
  { daysOfWeek: ['wed'], startTime: '20:00' },
  { daysOfWeek: ['mon'], startTime: '20:00' },
  { daysOfWeek: ['thu'], startTime: '20:00' },
]

/** أوّلُ أحدٍ في أو بعد التاريخ المعطى، عند ٠٠:٠٠ عالميّا */
function firstSunday(at: Date): Date {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7))
  return d
}

/** مبدأُ الموجة الأولى: مبدأُ الفصل أو أسبوعان من اليوم، أيّهما أبعد */
export function semesterAnchor(now: Date = new Date(), leadDays: number = MIN_LEAD_DAYS): Date {
  const declared = new Date(`${SEMESTER_FIRST_DAY}T00:00:00Z`)
  const earliest = new Date(now.getTime() + leadDays * 86_400_000)
  return firstSunday(declared > earliest ? declared : earliest)
}

/** أسماءُ الأيّام عربيّةً — لخطّة التقديم التي يقرؤها المتعلّم */
const DAY_AR: Record<string, string> = {
  sun: 'الأحد', mon: 'الإثنين', tue: 'الثلاثاء', wed: 'الأربعاء',
  thu: 'الخميس', fri: 'الجمعة', sat: 'السبت',
}
function dayNames(days: string[]): string {
  return days.map((d) => DAY_AR[d] ?? d).join(' و')
}
/** ١٨:٠٠ ← «٦ مساءً» */
function amman(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2))
  const suffix = h >= 12 ? 'مساءً' : 'صباحا'
  const twelve = h % 12 === 0 ? 12 : h % 12
  return `${twelve} ${suffix}`
}

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
  /** شعبٌ أُنشئت **وفُتحت** فعلا — استوفت شروط الفتح الخمسة */
  opened: number
  /** شعبٌ أُنشئت وبقيت مسوّدةً لأنّ شرطا نقص — والسببُ في صفّها */
  prepared: number
  alreadyLive: number
  skippedNoListPrice: number
  startsAt: string
  rows: { courseId: string; titleAr: string; price: number; currency: string; startsAt?: string; reason?: string; blocked?: string[] }[]
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
 * فيتخطّى شروطَ الفتح الخمسة كلَّها (`CohortService.openChecklist`). والنتيجةُ
 * أنّ زرّا واحدا يفتح للبيع **شعبا بلا مدرّبٍ ولا جدولٍ ولا خطّةِ تقديم** —
 * فيدفع متعلّمٌ ثمنَ مقعدٍ لا أحدَ يدرّس فيه ولا موعدَ له. وهو أسوأُ ما قد
 * يفعله زرٌّ في هذه المنصّة: لا يفشل، ولا يشتكي أحد، حتّى يأتي أوّلُ موعد.
 *
 * فصار يهيّئ ما يستطيع تهيئتَه: يُنشئ الشعبةَ مسوّدةً بسعرها وسعتها، **ويولّد
 * جلساتِها** من نمطها، **ويكتب خطّةَ تقديمٍ أساسيّة** — ثمّ يستدعي `open()`
 * نفسَها التي يستدعيها الزرُّ المفرد. فما استوفى فُتح، وما نقصه شيءٌ بقي
 * مسوّدةً **ونقصُه مكتوبٌ في صفّه** لا مخفيّا.
 *
 * وبعد أن خرج المدرّبُ من شروط الفتح (`openChecklist`) صارت الخمسةُ الباقيةُ
 * كلُّها ممّا يُوفّى هنا — فالمتوقَّع أن تُفتح كلُّها، ويبقى `prepared` لما
 * يعجز عنه شيءٌ غيرُ متوقَّع فيُقال سببُه في صفّه.
 */
export async function openAllCohorts(
  prisma: PrismaClient,
  opts: { apply: boolean; weeks?: number; capacity?: number; actorId?: string } = { apply: false },
): Promise<OpenCohortsResult> {
  /* `weeks` صار مهلةَ التسجيل قبل أوّل جلسة لا موعدَ البدء: الموعدُ من
     توزيع الفصل أعلاه، وهذا حدُّه الأدنى. */
  const leadDays = opts.weeks === undefined ? MIN_LEAD_DAYS : Math.min(Math.max(opts.weeks, 1), 52) * 7
  const capacity = Math.min(Math.max(opts.capacity ?? DEFAULT_CAPACITY, 1), 500)

  const courses = await prisma.course.findMany({
    where: { status: 'published' },
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 },
      cohorts: { select: { id: true, status: true } },
      modules: {
        where: { status: 'published' },
        select: { id: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { bodyAr: true } } },
      },
    },
    orderBy: { id: 'asc' },
  })

  /* ترتيبُ الموجات: ما اكتمل متنُه أوّلا، ثمّ الباقي على ترتيب معرّفه.
     ومن لا وحدةَ له يُعدّ غيرَ مكتمل — لا يُقدَّم على من له متن. */
  const readiness = new Map<string, { modules: number; authored: number }>()
  for (const c of courses) {
    const modules = c.modules.length
    const authored = c.modules.filter((m) => (m.versions[0]?.bodyAr ?? '').trim().length > 0).length
    readiness.set(c.id, { modules, authored })
  }
  const ordered = [...courses].sort((a, b) => {
    const ra = readiness.get(a.id)!, rb = readiness.get(b.id)!
    const fa = ra.modules > 0 && ra.authored === ra.modules ? 0 : 1
    const fb = rb.modules > 0 && rb.authored === rb.modules ? 0 : 1
    return fa - fb || a.id.localeCompare(b.id)
  })

  const anchor = semesterAnchor(new Date(), leadDays)

  const rows: OpenCohortsResult['rows'] = []
  let opened = 0, prepared = 0, alreadyLive = 0, skippedNoListPrice = 0
  const service = new CohortService(prisma)

  /* موضعُ الدورة في التوزيع يُحسب على المُنشأ فعلا لا على القائمة كلِّها،
     وإلّا تركت الدوراتُ التي لها شعبةٌ قائمةٌ ثقوبا في الجدول. */
  let placed = 0

  for (const c of ordered) {
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

    /* الموجةُ والموعد — وأسابيعُ الجلسات بعدد وحدات الدورة */
    const wave = Math.floor(placed / COURSES_PER_WAVE)
    const slot = SLOTS[placed % SLOTS.length]
    placed++
    const startsAt = new Date(anchor.getTime() + wave * 7 * 86_400_000)
    const moduleCount = readiness.get(c.id)!.modules
    /* عددُ اللقاءات يتبع عمقَ الدورة، ثمّ يقف عند أربع. والمدى يتبعه:
       ثلاثٌ بتباعد أسبوعين تمتدّ خمسةَ أسابيع، وأربعٌ سبعة. */
    const liveSessions = moduleCount >= DEEP_COURSE_MODULES ? LIVE_SESSIONS_DEEP : LIVE_SESSIONS_SHORT
    const spanWeeks = (liveSessions - 1) * SESSION_INTERVAL_WEEKS + 1

    const row: OpenCohortsResult['rows'][number] = {
      courseId: c.id, titleAr, price, currency, startsAt: startsAt.toISOString(),
    }
    rows.push(row)
    if (!opts.apply) { opened++; continue }

    const cohort = await prisma.cohort.create({
      data: {
        /* مسوّدةٌ حتّى تستوفي شروطَها — والفتحُ أدناه بالبوّابة نفسِها */
        courseId: c.id, title: `${titleAr} — الدفعة الأولى`, status: 'draft', startsAt,
        daysOfWeek: slot.daysOfWeek, startTime: slot.startTime, timezone: 'Asia/Amman',
        capacity, price, currency, language: 'العربية', deliveryMode: 'remote',
        registrationOpen: false, financialReady: true,
      },
    })

    /* جلساتٌ من نمط الشعبة، وخطّةُ تقديمٍ أساسيّة — شرطان من الخمسة يُوفَّيان
       هنا بلا اختلاق: النمطُ معلَنٌ في الصفّ نفسِه، والخطّةُ تصف ما يقع فعلا. */
    const actor = opts.actorId ?? null
    await service.generateSessions(actor, cohort.id, {
      weeks: liveSessions, intervalWeeks: SESSION_INTERVAL_WEEKS, from: startsAt, apply: true,
    }).catch(() => undefined)
    await service.setDeliveryPlan(cohort.id, actor, {
      notesAr: `تقديمٌ عن بُعد عبر زوم. ${liveSessions} جلساتٍ مباشرة، ${dayNames(slot.daysOfWeek)} الساعة ${amman(slot.startTime)} بتوقيت عمّان، بين كلِّ جلستين أسبوعان — تمتدّ ${spanWeeks} أسابيع. أوّلُ جلسةٍ ${startsAt.toISOString().slice(0, 10)}. وما بين اللقاءات مقصود: فيه المادّةُ وملخّصاتُ وجيز والجلساتُ المسجَّلة والمهامّ. المدرّبُ يُعيَّن قريبا، ويُعدَّل الجدولُ من بطاقة الشعبة بموافقة الإدارة.`,
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
      meta: { opened, prepared, alreadyLive, skippedNoListPrice, leadDays, capacity, anchor: anchor.toISOString() },
    })
    /* من انتظر يُعلَم — **بما فُتح فعلا** لا بما هُيّئ.
       إشعارُ منتظرٍ بشعبةٍ مسوّدةٍ يرسله إلى صفحةٍ لا زرَّ شراءٍ فيها. */
    await notifyPlanWaiters(prisma, rows.filter((r) => !r.reason && !r.blocked).map((r) => r.courseId))
  }

  return {
    applied: opts.apply, publishedCourses: courses.length, opened, prepared, alreadyLive,
    skippedNoListPrice, startsAt: anchor.toISOString(), rows,
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

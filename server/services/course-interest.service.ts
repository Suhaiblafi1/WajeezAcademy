/* «أبلغني حين تفتح شعبتها» لكلّ دورة — والطلبُ على الدورات بلا شعبة (١٢ أكتوبر ٢٠٢٦).

   ═══ لماذا ═══

   منذ صار لا يُعرض للعموم إلّا ما اعتُمدت خطّةُ مدرّبه (#508)، صارت أكثرُ الدورات
   تُعرض بلا شعبة. ومن جاء يريد دورةً بعينها كان له بابان لا يناسبانه: «أبلغوني» بفتح
   باب الموسم للمنصّة كلِّها، أو خطّةٌ في حسابٍ لم يُنشئه بعد. فيغادر ولا يعود.

   وقرارُ صاحب المنصّة: «أبلغني» لكلّ دورةٍ في صفحتها — بريدٌ واحدٌ ولا حساب. ومعه
   تقريرٌ له: كم ينتظر كلَّ دورةٍ بلا شعبة — في خطّته أو ببريده — فيعرف لأيّها يبحث
   عن مدرّبٍ أوّلا.

   ═══ ولا يُجمع إلّا ما يوصَلُ به ═══

   عنوانٌ ودورةٌ ونصُّ ما وُعد به. والوعدُ رسالةٌ واحدةٌ حين تفتح لها شعبةٌ تُشترى.

   ═══ ومتى تُرسَل ═══

   حين تصير الشعبةُ قابلةً للشراء (`notifyIfPurchasable`) **وبابُ الموسم مفتوح**: رسالةُ
   «احجز مقعدك» والبابُ مغلقٌ تعيد صاحبَها إلى جملة «لم يفتح باب التسجيل». فإن كان
   مغلقا بقي ينتظر، ويُبلَّغ يومَ يُفتح البابُ (`notifyAllPurchasable`). */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { enqueueMail } from './outbox.service'
import { renderMail } from './mail-template'
import { publicSiteUrl } from './site-url'
import { recordAudit } from './audit'
import { APPROVED_PLAN_STATUSES, openRegistrationWhere, readSeasonGate } from './registration-window'

/** نصُّ الوعد — يُعرض على الشاشة ويُحفظ مع الصفّ، فلا يفترق ما قيل عمّا حُفظ */
export const COURSE_INTEREST_CONSENT_AR =
  'أوافق أن تصلني رسالة واحدة على هذا البريد حين تفتح شعبة لهذه الدورة — ولا شيء غيرها.'

/** حالُ الدورة في التقرير — ما يقف بينها وبين شعبةٍ تُباع */
export type DemandState = 'no_trainer' | 'trainer_preparing' | 'plan_submitted' | 'approved_draft'

export interface DemandRow {
  courseId: string
  titleAr: string
  /** متعلّمون في خطّتهم ولم يشتروها */
  planWaiting: number
  /** زوّارٌ تركوا بريدَهم لها ولم يُبلَّغوا */
  visitorWaiting: number
  total: number
  state: DemandState
}

/** شعبةٌ تُباع الآن لهذه الدورات — بقاعدة التسجيل نفسِها */
async function purchasableCourses(prisma: PrismaClient, courseIds?: string[]): Promise<Set<string>> {
  const rows = await prisma.cohort.findMany({
    where: {
      ...(courseIds ? { courseId: { in: courseIds } } : {}),
      status: { in: ['open', 'full'] }, ...openRegistrationWhere(),
    },
    select: { courseId: true },
  })
  return new Set(rows.map((r) => r.courseId))
}

async function titlesOf(prisma: PrismaClient, courseIds: string[]): Promise<Map<string, string>> {
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } },
  })
  return new Map(courses.map((c) => [c.id, c.versions[0]?.titleAr ?? c.id]))
}

export class CourseInterestService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** يسجّل انتظارَ عنوانٍ لدورةٍ لا شعبةَ تُباع لها الآن.

      ولا يُقبل ولها شعبةٌ تُباع: لا معنى لانتظار ما يُشترى الآن — يُقال له ذلك. */
  async record(email: string, courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, select: { status: true } })
    if (!course || course.status !== 'published') throw new AuthError('not_found', 'الدورة غير موجودة', 404)
    if ((await purchasableCourses(this.prisma, [courseId])).has(courseId)) {
      throw new AuthError('cohort_open', 'لهذه الدورة شعبة مفتوحة الآن — احجز مقعدك', 409)
    }
    const normalized = email.trim().toLowerCase()
    const key = { email_courseId: { email: normalized, courseId } }
    const existing = await this.prisma.courseInterest.findUnique({ where: key })
    await this.prisma.courseInterest.upsert({
      where: key,
      /* ومن أُبلغ ثمّ عاد يطلبها يعود منتظرا — طلبُه الثاني طلبٌ جديد */
      update: { lastSeenAt: new Date(), notifiedAt: null, consentAr: COURSE_INTEREST_CONSENT_AR },
      create: { email: normalized, courseId, consentAr: COURSE_INTEREST_CONSENT_AR },
    })
    return { alreadyWaiting: existing !== null && existing.notifiedAt === null }
  }

  /** يُبلغ من ترك بريدَه لهذه الدورة — حين تُباع شعبتُها وبابُ الموسم مفتوح.

      والرسائلُ تُكتب في الطابور لا تُرسَل هنا (العلّةُ في `outbox.service`)، و`notifiedAt`
      تُوسَم مع الكتابة: ما يُحرَس ألّا يُبلَّغ أحدٌ مرّتين. */
  async notifyCourse(courseId: string): Promise<{ queued: number }> {
    if (!(await readSeasonGate(this.prisma)).open) return { queued: 0 }
    const rows = await this.prisma.courseInterest.findMany({
      where: { courseId, notifiedAt: null }, select: { id: true, email: true },
    })
    if (rows.length === 0) return { queued: 0 }
    const titleAr = (await titlesOf(this.prisma, [courseId])).get(courseId) ?? courseId
    const url = `${publicSiteUrl()}/build/${encodeURIComponent(courseId)}`
    for (const row of rows) {
      await enqueueMail(this.prisma, {
        to: row.email,
        subject: `فتحت شعبة «${titleAr}»`,
        purpose: 'course.interest.open',
        ...renderMail({
          preheader: `«${titleAr}» صار لها موعد وسعر — والمقاعد بالأسبقيّة.`,
          heading: `فتحت شعبة «${titleAr}»`,
          blocks: [
            { kind: 'p', text: 'تركت بريدك لنعلمك حين تفتح شعبة لهذه الدورة، وهذه هي الرسالة.' },
            { kind: 'cta', label: 'اختر موعدك واحجز مقعدك', href: url },
            { kind: 'note', text: 'وصلتك هذه لأنّك طلبت أن نعلمك — وهي الرسالة الوحيدة، فلا شيء بعدها.' },
          ],
        }),
      })
    }
    await this.prisma.courseInterest.updateMany({
      where: { id: { in: rows.map((r) => r.id) } }, data: { notifiedAt: new Date() },
    })
    await recordAudit(this.prisma, {
      actorId: null, action: 'course.interest.notify', entityType: 'course', entityId: courseId,
      meta: { queued: rows.length },
    })
    return { queued: rows.length }
  }

  /** يومَ يُفتح بابُ الموسم: كلُّ دورةٍ تُباع شعبتُها يُبلَّغ منتظروها.

      كانوا ينتظرون والبابُ مغلق — فلم يُرسَل لهم شيءٌ حين فُتحت شعبتُها. */
  async notifyAllPurchasable(): Promise<{ queued: number; courses: number }> {
    const waiting = await this.prisma.courseInterest.findMany({
      where: { notifiedAt: null }, select: { courseId: true }, distinct: ['courseId'],
    })
    const open = await purchasableCourses(this.prisma, waiting.map((w) => w.courseId))
    let queued = 0
    for (const courseId of open) queued += (await this.notifyCourse(courseId)).queued
    return { queued, courses: open.size }
  }

  /* ═══ الطلبُ على الدورات بلا شعبة — لصاحب المنصّة ═══

     لكلّ دورةٍ لا شعبةَ تُباع لها: كم متعلّما في خطّته ينتظرها ولم يشترها، وكم زائرا
     ترك بريدَه لها ولم يُبلَّغ — وما يقف بينها وبين شعبةٍ تُباع. والأكثرُ طلبا أوّلا. */
  async demand(): Promise<{ rows: DemandRow[] }> {
    const [items, visitors] = await Promise.all([
      this.prisma.learnerPlanItem.findMany({
        where: { plan: { status: 'active' } },
        select: { courseId: true, plan: { select: { userId: true } } },
      }),
      this.prisma.courseInterest.findMany({ where: { notifiedAt: null }, select: { courseId: true } }),
    ])
    const courseIds = [...new Set([...items.map((i) => i.courseId), ...visitors.map((v) => v.courseId)])]
    if (courseIds.length === 0) return { rows: [] }
    const open = await purchasableCourses(this.prisma, courseIds)
    const wanted = courseIds.filter((id) => !open.has(id))
    if (wanted.length === 0) return { rows: [] }

    /* من اشترى الدورةَ لا ينتظرها — مسجَّلٌ فيها أو حُجز مقعدُه */
    const users = [...new Set(items.map((i) => i.plan.userId))]
    const [enrolled, held] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { userId: { in: users }, status: { in: ['enrolled', 'completed', 'waitlisted'] }, cohort: { courseId: { in: wanted } } },
        select: { userId: true, cohort: { select: { courseId: true } } },
      }),
      this.prisma.enrollmentRequest.findMany({
        where: { userId: { in: users }, status: { in: ['seat_held', 'converted'] }, cohort: { courseId: { in: wanted } } },
        select: { userId: true, cohort: { select: { courseId: true } } },
      }),
    ])
    const owns = new Set([...enrolled, ...held].map((r) => `${r.userId}:${r.cohort.courseId}`))

    const planWaiting = new Map<string, Set<string>>()
    for (const i of items) {
      if (!wanted.includes(i.courseId) || owns.has(`${i.plan.userId}:${i.courseId}`)) continue
      if (!planWaiting.has(i.courseId)) planWaiting.set(i.courseId, new Set())
      planWaiting.get(i.courseId)!.add(i.plan.userId)
    }
    const visitorWaiting = new Map<string, number>()
    for (const v of visitors) {
      if (wanted.includes(v.courseId)) visitorWaiting.set(v.courseId, (visitorWaiting.get(v.courseId) ?? 0) + 1)
    }

    /* ما يقف بين الدورة وشعبةٍ تُباع — من خطط مدرّبي شعبها القائمة */
    const cohorts = await this.prisma.cohort.findMany({
      where: { courseId: { in: wanted }, status: { notIn: ['completed', 'cancelled'] } },
      select: { courseId: true, status: true, plans: { where: { trainerId: { not: null } }, select: { status: true } } },
    })
    const approved = APPROVED_PLAN_STATUSES as readonly string[]
    const stateOf = (courseId: string): DemandState => {
      const mine = cohorts.filter((c) => c.courseId === courseId)
      if (mine.some((c) => c.status === 'draft' && c.plans.some((p) => approved.includes(p.status)))) return 'approved_draft'
      if (mine.some((c) => c.plans.some((p) => p.status === 'submitted'))) return 'plan_submitted'
      if (mine.some((c) => c.plans.length > 0)) return 'trainer_preparing'
      return 'no_trainer'
    }

    const titles = await titlesOf(this.prisma, wanted)
    const rows: DemandRow[] = wanted.map((courseId) => {
      const plan = planWaiting.get(courseId)?.size ?? 0
      const visitor = visitorWaiting.get(courseId) ?? 0
      return {
        courseId, titleAr: titles.get(courseId) ?? courseId,
        planWaiting: plan, visitorWaiting: visitor, total: plan + visitor, state: stateOf(courseId),
      }
    }).filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total || a.titleAr.localeCompare(b.titleAr, 'ar'))
    return { rows }
  }
}

/* خطّة المتعلّم — التوصية ١.

   المبدأ الحاكم: **القصد يُخزَّن، والحالة تُشتقّ.** الجدول يحفظ أيّ دورات
   اختار وبأيّ ترتيب وأيّها الهديّة. أمّا «أمسجَّل هو؟ ألها شعبة مفتوحة؟» فتُقرأ
   عند كل نداء من التسجيلات والشعب نفسها. حالةٌ مخزَّنة تنحرف عن الواقع بصمت:
   تُفتح شعبة أو تُغلق أو يُسجَّل المتعلّم، فيبقى العمود على قوله القديم.

   وبهذا الاشتقاق يصير الجواب عن سؤال المالك ممكنا قبل الشراء: أيّ دورةٍ في
   الخطّة بلا شعبة تُعرَف باسمها، فتُستبدَل أو تُعلَن مؤجَّلةً — لا أن يكتشفها
   المتعلّم بعد أن دفع. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

/** حالة الدورة داخل الخطّة — مشتقّة لا مخزَّنة */
export type PlanItemState = 'enrolled' | 'schedulable' | 'awaiting_cohort'

export interface PlanItemView {
  courseId: string
  sequence: number
  isGift: boolean
  state: PlanItemState
  /** الشعبة التي يستطيع طلبها الآن — حين state = schedulable */
  cohort: { id: string; title: string; startsAt: Date | null; seatsLeft: number | null; price: unknown; currency: string } | null
  /** له طلبٌ قائم على هذه الدورة؟ يمنع «اطلب» مكرّرا ثم رفضا بـ409 */
  requestPending: boolean
}

export interface PlanView {
  id: string
  nameAr: string
  composed: boolean
  hostPathwayId: string | null
  giftCourseId: string | null
  items: PlanItemView[]
  /** عدّادات جاهزة للواجهة — تُحسب هنا فلا تختلف بين شاشتين */
  counts: { total: number; enrolled: number; schedulable: number; awaitingCohort: number }
}

const MAX_ITEMS = 12

export class PlanService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** يعتمد خطّة جديدة — وتُؤرشَف السابقة. المتعلّم له خطّةٌ فعّالة واحدة. */
  async adopt(
    userId: string,
    input: { nameAr: string; composed: boolean; hostPathwayId?: string | null; giftCourseId?: string | null; courseIds: string[] },
  ): Promise<PlanView> {
    const name = input.nameAr.trim()
    if (!name) throw new AuthError('bad_name', 'الخطّة بلا اسم')
    /* التكرار يُزال بالترتيب: أوّل ظهور يبقى — لا نرفض الطلب على تكرارٍ لا ضرر فيه */
    const ids = [...new Set(input.courseIds.map((c) => c.trim()).filter(Boolean))]
    if (ids.length === 0) throw new AuthError('empty_plan', 'الخطّة بلا دورات')
    if (ids.length > MAX_ITEMS) throw new AuthError('too_many', `الخطّة أكثر من ${MAX_ITEMS} دورة`)
    /* الهديّة من دورات الخطّة نفسها — ضمن السقف لا فوقه، كما اختار المالك */
    const gift = input.giftCourseId && ids.includes(input.giftCourseId) ? input.giftCourseId : null

    const plan = await this.prisma.$transaction(async (tx) => {
      await tx.learnerPlan.updateMany({ where: { userId, status: 'active' }, data: { status: 'archived' } })
      return tx.learnerPlan.create({
        data: {
          userId, nameAr: name, composed: input.composed,
          hostPathwayId: input.hostPathwayId ?? null, giftCourseId: gift,
          items: { create: ids.map((courseId, i) => ({ courseId, sequence: i + 1 })) },
        },
      })
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'plan.adopt', entityType: 'learner_plan', entityId: plan.id,
      meta: { courses: ids.length, composed: input.composed },
    })
    return this.viewOf(userId, plan.id)
  }

  /** يبدّل دورات الخطّة الفعّالة — الاسم والهوية يبقيان */
  async replaceCourses(userId: string, courseIds: string[], giftCourseId?: string | null): Promise<PlanView> {
    const plan = await this.prisma.learnerPlan.findFirst({ where: { userId, status: 'active' } })
    if (!plan) throw new AuthError('no_plan', 'لا خطّة فعّالة لتعديلها', 404)
    const ids = [...new Set(courseIds.map((c) => c.trim()).filter(Boolean))]
    if (ids.length === 0) throw new AuthError('empty_plan', 'الخطّة بلا دورات')
    if (ids.length > MAX_ITEMS) throw new AuthError('too_many', `الخطّة أكثر من ${MAX_ITEMS} دورة`)
    const gift = giftCourseId && ids.includes(giftCourseId) ? giftCourseId : null

    await this.prisma.$transaction(async (tx) => {
      await tx.learnerPlanItem.deleteMany({ where: { planId: plan.id } })
      await tx.learnerPlanItem.createMany({ data: ids.map((courseId, i) => ({ planId: plan.id, courseId, sequence: i + 1 })) })
      await tx.learnerPlan.update({ where: { id: plan.id }, data: { giftCourseId: gift } })
    })
    return this.viewOf(userId, plan.id)
  }

  /** الخطّة الفعّالة — أو null لمن لا خطّة له */
  async active(userId: string): Promise<PlanView | null> {
    const plan = await this.prisma.learnerPlan.findFirst({
      where: { userId, status: 'active' }, orderBy: { createdAt: 'desc' },
    })
    return plan ? this.viewOf(userId, plan.id) : null
  }

  /** يبني العرض: القصد من الجدول، والحالة من الواقع */
  private async viewOf(userId: string, planId: string): Promise<PlanView> {
    const plan = await this.prisma.learnerPlan.findUnique({
      where: { id: planId }, include: { items: { orderBy: { sequence: 'asc' } } },
    })
    if (!plan) throw new AuthError('not_found', 'الخطّة غير موجودة', 404)
    const courseIds = plan.items.map((i) => i.courseId)

    /* ثلاث قراءات لا حلقة استعلامات: تسجيلاته، والشعب المتاحة، وطلباته القائمة */
    const [enrollments, cohorts, requests] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { userId, status: { in: ['enrolled', 'waitlisted', 'completed'] }, cohort: { courseId: { in: courseIds } } },
        select: { cohort: { select: { courseId: true } } },
      }),
      this.prisma.cohort.findMany({
        where: { courseId: { in: courseIds }, status: { in: ['open', 'full'] }, registrationOpen: true },
        orderBy: { startsAt: 'asc' },
        select: {
          id: true, title: true, courseId: true, startsAt: true, capacity: true, price: true, currency: true,
          _count: { select: { enrollments: { where: { status: 'enrolled' } } } },
        },
      }),
      this.prisma.enrollmentRequest.findMany({
        where: { userId, status: { in: ['pending', 'seat_held'] }, cohort: { courseId: { in: courseIds } } },
        select: { cohort: { select: { courseId: true } } },
      }),
    ])

    const enrolledIn = new Set(enrollments.map((e) => e.cohort.courseId))
    const pendingOn = new Set(requests.map((r) => r.cohort.courseId))
    /* أقرب شعبة لكل دورة — القائمة مرتّبة بالبدء فأوّل ظهور هو الأقرب */
    const soonest = new Map<string, (typeof cohorts)[number]>()
    for (const c of cohorts) if (!soonest.has(c.courseId)) soonest.set(c.courseId, c)

    const items: PlanItemView[] = plan.items.map((item) => {
      const c = soonest.get(item.courseId) ?? null
      const state: PlanItemState = enrolledIn.has(item.courseId)
        ? 'enrolled'
        : c
          ? 'schedulable'
          : 'awaiting_cohort'
      return {
        courseId: item.courseId,
        sequence: item.sequence,
        isGift: plan.giftCourseId === item.courseId,
        state,
        cohort: c
          ? {
              id: c.id, title: c.title, startsAt: c.startsAt,
              seatsLeft: c.capacity ? Math.max(0, c.capacity - c._count.enrollments) : null,
              price: c.price, currency: c.currency,
            }
          : null,
        requestPending: pendingOn.has(item.courseId),
      }
    })

    return {
      id: plan.id, nameAr: plan.nameAr, composed: plan.composed,
      hostPathwayId: plan.hostPathwayId, giftCourseId: plan.giftCourseId,
      items,
      counts: {
        total: items.length,
        enrolled: items.filter((i) => i.state === 'enrolled').length,
        schedulable: items.filter((i) => i.state === 'schedulable').length,
        awaitingCohort: items.filter((i) => i.state === 'awaiting_cohort').length,
      },
    }
  }
}

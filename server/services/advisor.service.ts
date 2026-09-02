/* خدمة المستشارين — حالات العملاء من لحظة التشخيص حتى التسجيل أو الإغلاق.
   القاعدة: المستشار يرى الحالات المسندة إليه فقط، والملاحظات الداخلية لا تظهر للعميل. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

export const CASE_STATUSES = [
  'new', 'contacted', 'needs_review', 'follow_up', 'recommended', 'enrolled', 'not_interested', 'closed',
] as const

export class AdvisorService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /* ── ربط التشخيص بالحساب — الجسر بين الضيف والمنظومة ── */

  /** يرفق نتيجة التشخيص بالحساب: ملف متعلم + عميل محتمل + حالة مستشار جديدة */
  async attachDiagnostic(userId: string, snapshot: unknown, ip?: string) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new AuthError('bad_snapshot', 'نتيجة التشخيص غير صالحة')
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new AuthError('unknown_user', 'المستخدم غير موجود', 404)

    await this.prisma.learnerProfile.upsert({
      where: { userId },
      update: { diagnosticSnapshot: snapshot as object, attachedAt: new Date() },
      create: { userId, diagnosticSnapshot: snapshot as object, attachedAt: new Date() },
    })

    /* عميل محتمل أو تحديث القائم */
    let lead = await this.prisma.lead.findFirst({ where: { userId } })
    lead ??= await this.prisma.lead.create({
      data: { fullName: user.displayName, email: user.email, source: 'diagnostic', userId, diagnosticSnapshot: snapshot as object },
    })

    /* حالة مستشار — لا تكرار لحالة مفتوحة لنفس العميل */
    let kase = await this.prisma.advisorCase.findFirst({
      where: { leadId: lead.id, status: { notIn: ['closed', 'enrolled', 'not_interested'] } },
    })
    kase ??= await this.prisma.advisorCase.create({
      data: { leadId: lead.id, clientId: userId, diagnosticSnapshot: snapshot as object, nextAction: 'تواصل أول مع العميل' },
    })

    await recordAudit(this.prisma, {
      actorId: userId, action: 'diagnostic.attach', entityType: 'advisor_case', entityId: kase.id, ip,
      meta: { leadId: lead.id },
    })
    return { lead, case: kase }
  }

  /* ── الإدارة: الإسناد ── */

  async assign(caseId: string, advisorId: string, actorId: string) {
    const kase = await this.prisma.advisorCase.findUnique({ where: { id: caseId } })
    if (!kase) throw new AuthError('not_found', 'الحالة غير موجودة', 404)
    const advisor = await this.prisma.user.findUnique({ where: { id: advisorId }, include: { roles: true } })
    if (!advisor || !advisor.roles.some((r) => r.roleId === 'advisor')) {
      throw new AuthError('not_advisor', 'المستخدم ليس مستشارا', 409)
    }
    /* إلغاء الإسنادات السابقة ثم إسناد جديد — تاريخ الإسناد يبقى */
    await this.prisma.advisorAssignment.updateMany({
      where: { caseId, unassignedAt: null }, data: { unassignedAt: new Date() },
    })
    const link = await this.prisma.advisorAssignment.create({
      data: { caseId, advisorId, assignedBy: actorId },
    })
    await recordAudit(this.prisma, { actorId, action: 'advisor.case.assign', entityType: 'advisor_case', entityId: caseId, meta: { advisorId } })
    return link
  }

  async listUnassigned() {
    return this.prisma.advisorCase.findMany({
      where: { assignments: { none: { unassignedAt: null } }, status: { notIn: ['closed', 'enrolled', 'not_interested'] } },
      include: { lead: true, client: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    })
  }

  /* ── بوابة المستشار — المسند إليه فقط ── */

  /** حارس: هل هذه الحالة مسندة لهذا المستشار الآن؟ */
  async assertAssigned(advisorId: string, caseId: string) {
    const link = await this.prisma.advisorAssignment.findFirst({
      where: { caseId, advisorId, unassignedAt: null },
    })
    if (!link) throw new AuthError('not_assigned', 'هذه الحالة ليست مسندة إليك', 403)
    return link
  }

  async myCases(advisorId: string, status?: string) {
    const links = await this.prisma.advisorAssignment.findMany({
      where: { advisorId, unassignedAt: null },
      select: { caseId: true },
    })
    return this.prisma.advisorCase.findMany({
      where: { id: { in: links.map((l) => l.caseId) }, ...(status ? { status } : {}) },
      include: {
        lead: true,
        client: { select: { displayName: true, email: true } },
        followUps: { where: { doneAt: null }, orderBy: { scheduledAt: 'asc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  /** عمولتي المستحقّة فعلا من عملائي الدافعين — نفس حساب ملفّه عند الإدارة،
      لكن للمستشار نفسه لا لمن يديره. كانت الإدارة وحدها ترى هذا الرقم. */
  async myEarnings(advisorId: string) {
    const [profile, assignments] = await Promise.all([
      this.prisma.advisorProfile.findUnique({ where: { userId: advisorId } }),
      this.prisma.advisorAssignment.findMany({
        where: { advisorId, unassignedAt: null },
        select: { caseId: true, case: { select: { clientId: true } } },
      }),
    ])
    const clientIds = [...new Set(
      assignments.map((a) => a.case.clientId).filter((id): id is string => Boolean(id)),
    )]

    const MIN_RATINGS_TO_SHOW = 3
    const [paidOrders, ratingAgg] = await Promise.all([
      clientIds.length > 0
        ? this.prisma.order.findMany({ where: { userId: { in: clientIds }, status: 'paid' }, select: { total: true } })
        : Promise.resolve([]),
      this.prisma.rating.aggregate({
        where: { subjectType: 'advisor', subjectId: advisorId, publishStatus: 'approved' },
        _avg: { score: true }, _count: true,
      }),
    ])

    const revenueFromReferrals = paidOrders.reduce((sum, o) => sum + Number(o.total), 0)
    /* لا عمولةَ بلا نسبةٍ اتّفقت عليها الإدارة صراحة — «لم تُحدَّد بعد» غير «صفر» */
    const commissionPct = profile ? Number(profile.commissionPct) : null
    const commissionOwed = commissionPct !== null ? Math.round(revenueFromReferrals * commissionPct) / 100 : null

    return {
      commissionPct, commissionOwed, revenueFromReferrals, currency: 'USD',
      activeCases: assignments.length,
      ratingAvg: ratingAgg._count >= MIN_RATINGS_TO_SHOW ? Number(ratingAgg._avg.score) : null,
      ratingCount: ratingAgg._count,
    }
  }

  /** ملف الحالة الكامل للمستشار — العميل والتشخيص والنتيجة وأثر القرار والتواصل والملاحظات والمهام */
  async caseDetail(advisorId: string, caseId: string) {
    await this.assertAssigned(advisorId, caseId)
    const kase = await this.prisma.advisorCase.findUnique({
      where: { id: caseId },
      include: {
        lead: true,
        client: {
          select: {
            displayName: true, email: true,
            learnerProfile: true,
            cvSubmissions: {
              where: { status: 'active' },
              select: { id: true, originalName: true, mime: true, sizeBytes: true, createdAt: true },
            },
          },
        },
        notes: { orderBy: { createdAt: 'desc' } },
        tasks: { orderBy: { createdAt: 'desc' } },
        followUps: { orderBy: { scheduledAt: 'desc' } },
        contactEvents: { orderBy: { createdAt: 'desc' } },
        assignments: { orderBy: { assignedAt: 'desc' } },
      },
    })
    if (!kase) throw new AuthError('not_found', 'الحالة غير موجودة', 404)
    return kase
  }

  /* ── الوجه الثاني: المتابعة الأكاديمية ──

     المستشار ليس بائعا ينصرف بعد الإغلاق. دورُه المعلَن استشاريّ: يبقى
     يتابع تقدّم من أسندناهم إليه، ويرى تقييماتهم ومواعيد شعبهم، فيتدخّل
     قبل أن يتعثّروا لا بعد أن يتركوا.

     وكان لا يرى شيئا من ذلك: خمسُ صلاحيّاتٍ تكفي للبيع وحده. فمن سأله
     عميلُه «أين وصلت؟» لم يجد جوابا في المنصّة. */

  /** الصورة الأكاديمية لعميلٍ مسند — تسجيلاته وتقدّمها وجلساتُه القادمة وخطّته */
  async learnerSnapshot(advisorId: string, caseId: string) {
    await this.assertAssigned(advisorId, caseId)
    const kase = await this.prisma.advisorCase.findUnique({
      where: { id: caseId },
      select: { clientId: true },
    })
    if (!kase) throw new AuthError('not_found', 'الحالة غير موجودة', 404)
    /* لا حساب للعميل بعد — حالةٌ مشروعة لا خطأ: عميلٌ محتمل لم يسجّل */
    if (!kase.clientId) return { hasAccount: false as const, enrollments: [], upcomingSessions: [], plan: null }

    const userId = kase.clientId
    const now = new Date()

    const [enrollments, upcoming, plan] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { userId },
        select: {
          id: true, status: true, createdAt: true,
          courseProgress: { select: { percent: true } },
          cohort: {
            select: {
              id: true, title: true, status: true, startsAt: true,
              course: { select: { id: true, status: true } },
            },
          },
          moduleProgress: { select: { moduleId: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cohortSession.findMany({
        where: {
          startsAt: { gte: now },
          cohort: { enrollments: { some: { userId, status: 'enrolled' } } },
        },
        select: {
          id: true, title: true, startsAt: true, endsAt: true, status: true,
          cohort: { select: { id: true, title: true } },
        },
        orderBy: { startsAt: 'asc' },
        take: 5,
      }),
      this.prisma.learnerPlan.findFirst({
        where: { userId, status: 'active' },
        select: {
          id: true, nameAr: true, hostPathwayId: true, giftCourseId: true,
          items: { select: { courseId: true, sequence: true }, orderBy: { sequence: 'asc' } },
        },
      }),
    ])

    return { hasAccount: true as const, enrollments, upcomingSessions: upcoming, plan }
  }

  /* ── التشغيل على الحالة — كلها محروسة بالإسناد ── */

  async setStatus(advisorId: string, caseId: string, status: string, note?: string) {
    if (!CASE_STATUSES.includes(status as (typeof CASE_STATUSES)[number])) {
      throw new AuthError('bad_status', 'حالة غير معروفة')
    }
    await this.assertAssigned(advisorId, caseId)
    const before = await this.prisma.advisorCase.findUnique({ where: { id: caseId } })
    const updated = await this.prisma.advisorCase.update({ where: { id: caseId }, data: { status } })
    await recordAudit(this.prisma, {
      actorId: advisorId, action: 'advisor.case.status', entityType: 'advisor_case', entityId: caseId,
      before: { status: before?.status }, after: { status }, reason: note,
    })
    return updated
  }

  async setNextAction(advisorId: string, caseId: string, nextAction: string, nextFollowUpAt?: Date) {
    await this.assertAssigned(advisorId, caseId)
    return this.prisma.advisorCase.update({ where: { id: caseId }, data: { nextAction, nextFollowUpAt } })
  }

  async addNote(advisorId: string, caseId: string, body: string) {
    if (body.trim().length < 3) throw new AuthError('empty_note', 'الملاحظة فارغة')
    await this.assertAssigned(advisorId, caseId)
    return this.prisma.advisorNote.create({ data: { caseId, authorId: advisorId, body } })
  }

  async addTask(advisorId: string, caseId: string, title: string, dueAt?: Date) {
    if (title.trim().length < 3) throw new AuthError('empty_task', 'عنوان المهمة فارغ')
    await this.assertAssigned(advisorId, caseId)
    return this.prisma.advisorTask.create({ data: { caseId, title, dueAt, createdBy: advisorId } })
  }

  async completeTask(advisorId: string, taskId: string) {
    const task = await this.prisma.advisorTask.findUnique({ where: { id: taskId } })
    if (!task) throw new AuthError('not_found', 'المهمة غير موجودة', 404)
    await this.assertAssigned(advisorId, task.caseId)
    return this.prisma.advisorTask.update({ where: { id: taskId }, data: { status: 'done', doneAt: new Date() } })
  }

  async addFollowUp(advisorId: string, caseId: string, input: { scheduledAt: Date; channel?: string; note?: string }) {
    await this.assertAssigned(advisorId, caseId)
    const fu = await this.prisma.followUp.create({
      data: { caseId, scheduledAt: input.scheduledAt, channel: input.channel ?? 'whatsapp', note: input.note, createdBy: advisorId },
    })
    /* المتابعة القادمة تنعكس على الحالة */
    await this.prisma.advisorCase.update({ where: { id: caseId }, data: { nextFollowUpAt: input.scheduledAt } })
    return fu
  }

  async completeFollowUp(advisorId: string, followUpId: string, outcome: string, note?: string) {
    const fu = await this.prisma.followUp.findUnique({ where: { id: followUpId } })
    if (!fu) throw new AuthError('not_found', 'المتابعة غير موجودة', 404)
    await this.assertAssigned(advisorId, fu.caseId)
    return this.prisma.followUp.update({
      where: { id: followUpId }, data: { doneAt: new Date(), outcome, note: note ?? fu.note },
    })
  }

  async addContactEvent(advisorId: string, caseId: string, input: { channel: string; direction?: 'out' | 'in'; summary: string }) {
    if (input.summary.trim().length < 3) throw new AuthError('empty_summary', 'ملخص التواصل فارغ')
    await this.assertAssigned(advisorId, caseId)
    const event = await this.prisma.contactEvent.create({
      data: { caseId, channel: input.channel, direction: input.direction ?? 'out', summary: input.summary, createdBy: advisorId },
    })
    /* أول تواصل ينقل الحالة من new تلقائيا */
    const kase = await this.prisma.advisorCase.findUnique({ where: { id: caseId } })
    if (kase?.status === 'new') {
      await this.prisma.advisorCase.update({ where: { id: caseId }, data: { status: 'contacted' } })
    }
    return event
  }
}

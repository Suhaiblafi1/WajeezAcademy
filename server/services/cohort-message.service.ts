/* مخاطبة المدرب لشعبته، واقتراحه تأجيل جلسة.

   كان المدرب يرى المتعثّر ولا يملك أن يخاطبه: التغذية الراجعة تُكتب على تسليم،
   ومن لم يُسلّم شيئا لا يبلغه شيء. وكانت الجدولة بيد الإدارة وحدها، وهو من
   يعرف انقطاعه. فصار له فعلان — بقاعدة واحدة تحكمهما:

   • الرسالة تُسجَّل ثم تُوصَّل. السجلّ هو الأثر الباقي يُقرأ عند المراجعة،
     والإشعار وسيلةُ بلوغٍ لا سجلّ: من مسحه لم يمسح الرسالة.
   • والموعد يُقترح ولا يُغيَّر. لا يتبدّل عند المتعلّمين إلا باعتماد الإدارة،
     والاقتراحُ المرفوض يبقى بسببه مكتوبا. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { safeNotify } from './notification.service'

const MAX_BODY = 2000

export class CohortMessageService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** رسالةٌ إلى الشعبة كلّها أو إلى متعلّم بعينه — تُسجَّل ثم تُوصَّل */
  async send(authorId: string, cohortId: string, input: {
    audience: 'cohort' | 'learner'
    enrollmentId?: string
    body: string
  }) {
    const body = input.body.trim()
    if (body.length < 2) throw new AuthError('empty_message', 'اكتب رسالتك أولا')
    if (body.length > MAX_BODY) throw new AuthError('message_too_long', `الرسالة ${MAX_BODY} حرفا كحد أقصى`)

    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { id: true, title: true },
    })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)

    /* المستقبلون يُحسبون من الشعبة نفسها لا ممّا يُرسله المُنادي — ورسالةٌ
       إلى متعلّم تُتحقَّق من كونه في هذه الشعبة، وإلّا خاطب مدرّبٌ متعلّم
       شعبةٍ ليست له بمعرّفٍ يُخمَّن. */
    const where = input.audience === 'learner'
      ? { id: input.enrollmentId, cohortId, status: { not: 'dropped' } }
      : { cohortId, status: { not: 'dropped' } }
    if (input.audience === 'learner' && !input.enrollmentId) {
      throw new AuthError('no_recipient', 'حدّد المتعلّم المقصود')
    }
    const recipients = await this.prisma.enrollment.findMany({
      where, select: { id: true, userId: true },
    })
    if (recipients.length === 0) {
      throw new AuthError(
        input.audience === 'learner' ? 'not_in_cohort' : 'no_learners',
        input.audience === 'learner' ? 'هذا المتعلّم ليس في شعبتك' : 'لا مسجَّلين في هذه الشعبة بعد',
        input.audience === 'learner' ? 403 : 409,
      )
    }

    const message = await this.prisma.cohortMessage.create({
      data: {
        cohortId, authorId, audience: input.audience,
        enrollmentId: input.audience === 'learner' ? input.enrollmentId : null,
        body, recipients: recipients.length,
      },
    })

    const author = await this.prisma.user.findUnique({ where: { id: authorId }, select: { displayName: true } })
    const title = input.audience === 'cohort'
      ? `إعلان من مدرّبك — ${cohort.title}`
      : `رسالة من مدرّبك — ${cohort.title}`
    for (const r of recipients) {
      await safeNotify(this.prisma, {
        userId: r.userId, channel: 'in_app', audience: 'learner',
        title, body: `${author?.displayName ?? 'مدرّبك'}: ${body.slice(0, 240)}`,
        data: { cohortId, messageId: message.id },
      })
    }

    await recordAudit(this.prisma, {
      actorId: authorId, action: 'cohort.message.send', entityType: 'cohort', entityId: cohortId,
      meta: { messageId: message.id, audience: input.audience, recipients: recipients.length },
    })
    return message
  }

  /** سجلّ ما أُرسل في الشعبة — الأحدث أولا */
  async list(cohortId: string) {
    return this.prisma.cohortMessage.findMany({
      where: { cohortId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        author: { select: { displayName: true } },
        enrollment: { select: { user: { select: { displayName: true } } } },
      },
    })
  }

  /** يقترح المدرب موعدا — ولا يغيّره */
  async propose(userId: string, sessionId: string, input: { proposedStartsAt: Date; reason: string }) {
    const reason = input.reason.trim()
    if (reason.length < 10) throw new AuthError('reason_required', 'اكتب سبب التأجيل — الإدارة تقرأه لتقرّر')

    const session = await this.prisma.cohortSession.findUnique({
      where: { id: sessionId }, select: { id: true, cohortId: true, startsAt: true, status: true },
    })
    if (!session) throw new AuthError('not_found', 'الجلسة غير موجودة', 404)
    if (session.status === 'done' || session.status === 'cancelled') {
      throw new AuthError('session_closed', 'الجلسة انتهت أو أُلغيت — لا يُقترح لها موعد')
    }
    if (input.proposedStartsAt.getTime() <= Date.now()) {
      throw new AuthError('past_date', 'الموعد المقترح في الماضي')
    }
    /* اقتراحٌ معلّقٌ واحدٌ للجلسة: اثنان يجعلان الإدارة تعتمد أحدهما ولا تدري
       أيّهما الأحدث، والمدرب يسحب ثم يقترح. */
    const open = await this.prisma.sessionRescheduleRequest.findFirst({
      where: { sessionId, status: 'pending' }, select: { id: true },
    })
    if (open) throw new AuthError('already_pending', 'لك اقتراحٌ معلّق لهذه الجلسة — اسحبه أولا', 409)

    const request = await this.prisma.sessionRescheduleRequest.create({
      data: {
        sessionId, requestedBy: userId,
        currentStartsAt: session.startsAt, proposedStartsAt: input.proposedStartsAt, reason,
      },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'session.reschedule.propose', entityType: 'cohort_session', entityId: sessionId,
      meta: { requestId: request.id, proposedStartsAt: input.proposedStartsAt.toISOString() },
    })
    return request
  }

  /** اقتراحات المدرب نفسه — ليرى أين وقفت */
  async mine(userId: string) {
    return this.prisma.sessionRescheduleRequest.findMany({
      where: { requestedBy: userId },
      orderBy: { createdAt: 'desc' }, take: 50,
      include: { session: { select: { title: true, cohort: { select: { title: true } } } } },
    })
  }

  async withdraw(userId: string, id: string) {
    const req = await this.prisma.sessionRescheduleRequest.findUnique({ where: { id } })
    if (!req || req.requestedBy !== userId) throw new AuthError('not_found', 'الاقتراح غير موجود', 404)
    if (req.status !== 'pending') throw new AuthError('not_pending', 'لا يُسحب اقتراحٌ حُسم')
    return this.prisma.sessionRescheduleRequest.update({ where: { id }, data: { status: 'withdrawn' } })
  }

  /** ما ينتظر قرار الإدارة */
  async pending() {
    return this.prisma.sessionRescheduleRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: {
        requester: { select: { displayName: true } },
        session: { select: { id: true, title: true, startsAt: true, cohort: { select: { id: true, title: true } } } },
      },
    })
  }

  /** قرار الإدارة — والاعتماد وحده يحرّك الموعد عند المتعلّمين */
  async review(reviewerId: string, id: string, input: { action: 'approve' | 'reject'; comment?: string }) {
    const req = await this.prisma.sessionRescheduleRequest.findUnique({
      where: { id },
      include: { session: { select: { id: true, title: true, endsAt: true, startsAt: true, cohortId: true } } },
    })
    if (!req) throw new AuthError('not_found', 'الاقتراح غير موجود', 404)
    if (req.status !== 'pending') throw new AuthError('not_pending', 'حُسم هذا الاقتراح من قبل', 409)

    const decided = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.sessionRescheduleRequest.update({
        where: { id },
        data: {
          status: input.action === 'approve' ? 'approved' : 'rejected',
          reviewedBy: reviewerId, reviewedAt: new Date(), reviewerComment: input.comment?.trim() || null,
        },
      })
      if (input.action === 'approve') {
        /* مدّة الجلسة تُحفظ كما هي: تأجيلٌ لا تقصير */
        const span = req.session.endsAt
          ? req.session.endsAt.getTime() - req.session.startsAt.getTime()
          : null
        await tx.cohortSession.update({
          where: { id: req.sessionId },
          data: {
            startsAt: req.proposedStartsAt,
            endsAt: span === null ? null : new Date(req.proposedStartsAt.getTime() + span),
          },
        })
      }
      return updated
    })

    await recordAudit(this.prisma, {
      actorId: reviewerId, action: `session.reschedule.${input.action}`,
      entityType: 'cohort_session', entityId: req.sessionId,
      meta: { requestId: id, proposedStartsAt: req.proposedStartsAt.toISOString() },
    })

    /* المتعلّمون يُخبَرون بالاعتماد وحده — والرفضُ شأنُ المدرب والإدارة */
    if (input.action === 'approve') {
      const learners = await this.prisma.enrollment.findMany({
        where: { cohortId: req.session.cohortId, status: { not: 'dropped' } },
        select: { userId: true },
      })
      for (const l of learners) {
        await safeNotify(this.prisma, {
          userId: l.userId, channel: 'in_app', audience: 'learner',
          title: `تغيّر موعد «${req.session.title}»`,
          body: 'اعتُمد موعدٌ جديد لهذه الجلسة — راجع جدولك.',
          data: { sessionId: req.sessionId },
        })
      }
    }
    await safeNotify(this.prisma, {
      userId: req.requestedBy, channel: 'in_app', audience: 'trainer',
      title: input.action === 'approve' ? 'اعتُمد اقتراح التأجيل' : 'لم يُعتمد اقتراح التأجيل',
      body: input.comment?.trim() || `الجلسة: ${req.session.title}`,
      data: { requestId: id },
    })
    return decided
  }
}

/* خدمة الدعم — تذاكر بإنشاء وتصنيف وأولوية وتعيين ورسائل وحالات وسجل تغييرات.
   دور support يرى ما يحتاجه فقط: التذكرة ورسائلها، لا بيانات مالية ولا تشخيصية. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { notifyRole } from './notification.service'

const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed', 'reopened'] as const
const TICKET_TRANSITIONS: Record<string, string[]> = {
  open: ['pending', 'resolved', 'closed'],
  pending: ['open', 'resolved', 'closed'],
  resolved: ['closed', 'reopened'],
  closed: ['reopened'],
  reopened: ['pending', 'resolved', 'closed'],
}

export class SupportService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /* ── المتعلم ── */

  async createTicket(userId: string, input: { subject: string; category?: string; body: string }) {
    if (input.subject.trim().length < 3) throw new AuthError('empty_subject', 'عنوان التذكرة قصير')
    if (input.body.trim().length < 5) throw new AuthError('empty_body', 'صف المشكلة بجملة واضحة')
    const ticket = await this.prisma.$transaction(async (tx) => {
      const t = await tx.supportTicket.create({
        data: { userId, subject: input.subject, category: input.category ?? 'other' },
      })
      await tx.supportMessage.create({ data: { ticketId: t.id, authorId: userId, body: input.body } })
      await tx.ticketStatusHistory.create({ data: { ticketId: t.id, toStatus: 'open', changedBy: userId } })
      return t
    })
    await recordAudit(this.prisma, { actorId: userId, action: 'support.ticket.create', entityType: 'support_ticket', entityId: ticket.id })
    /* تذكرة جديدة تُشعِر فريق الدعم فوراً — لا تنتظر من يفتح الشاشة صدفة */
    await notifyRole(this.prisma, ['super_admin', 'support'], {
      channel: 'in_app',
      title: 'تذكرة دعم جديدة',
      body: `فُتحت تذكرة «${input.subject}» (${input.category ?? 'other'}) — بانتظار من يلتقطها في «تذاكر الدعم».`,
      templateKey: 'admin.support_ticket',
      data: { ticketId: ticket.id },
    })
    return ticket
  }

  async myTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      include: {
        messages: { where: { internal: false }, orderBy: { createdAt: 'asc' } }, // الداخلية لا تظهر لمقدم التذكرة
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async replyAsOwner(userId: string, ticketId: string, body: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } })
    if (!ticket || ticket.userId !== userId) throw new AuthError('not_found', 'التذكرة غير موجودة', 404)
    if (ticket.status === 'closed') throw new AuthError('closed', 'التذكرة مغلقة — أعد فتحها أولا', 409)
    return this.prisma.supportMessage.create({ data: { ticketId, authorId: userId, body } })
  }

  /** إعادة فتح من المالك — المحلولة أو المغلقة فقط */
  async reopenAsOwner(userId: string, ticketId: string, note: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } })
    if (!ticket || ticket.userId !== userId) throw new AuthError('not_found', 'التذكرة غير موجودة', 404)
    if (!['resolved', 'closed'].includes(ticket.status)) throw new AuthError('bad_state', 'إعادة الفتح للمحلولة أو المغلقة فقط', 409)
    return this.transition(ticketId, 'reopened', userId, note)
  }

  /* ── وكلاء الدعم والإدارة ── */

  async listTickets(filter: { status?: string; agentId?: string } = {}) {
    return this.prisma.supportTicket.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.agentId ? { assignments: { some: { agentId: filter.agentId, unassignedAt: null } } } : {}),
      },
      include: {
        user: { select: { displayName: true, email: true } },
        assignments: { where: { unassignedAt: null } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    })
  }

  async ticketDetail(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: { select: { displayName: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        assignments: { orderBy: { assignedAt: 'desc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!ticket) throw new AuthError('not_found', 'التذكرة غير موجودة', 404)
    return ticket
  }

  async assign(ticketId: string, agentId: string, actorId: string) {
    const agent = await this.prisma.user.findUnique({ where: { id: agentId }, include: { roles: true } })
    if (!agent || !agent.roles.some((r) => r.roleId === 'support')) {
      throw new AuthError('not_agent', 'المستخدم ليس وكيل دعم', 409)
    }
    await this.prisma.ticketAssignment.updateMany({ where: { ticketId, unassignedAt: null }, data: { unassignedAt: new Date() } })
    const link = await this.prisma.ticketAssignment.create({ data: { ticketId, agentId, assignedBy: actorId } })
    await recordAudit(this.prisma, { actorId, action: 'support.ticket.assign', entityType: 'support_ticket', entityId: ticketId, meta: { agentId } })
    return link
  }

  async replyAsAgent(agentId: string, ticketId: string, body: string, internal = false) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } })
    if (!ticket) throw new AuthError('not_found', 'التذكرة غير موجودة', 404)
    if (ticket.status === 'closed') throw new AuthError('closed', 'التذكرة مغلقة', 409)
    return this.prisma.supportMessage.create({ data: { ticketId, authorId: agentId, body, internal } })
  }

  /** انتقال حالة موثق — سجل التغييرات إلزامي */
  async transition(ticketId: string, to: string, actorId: string, note?: string) {
    if (!TICKET_STATUSES.includes(to as (typeof TICKET_STATUSES)[number])) throw new AuthError('bad_status', 'حالة غير معروفة')
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } })
    if (!ticket) throw new AuthError('not_found', 'التذكرة غير موجودة', 404)
    if (!TICKET_TRANSITIONS[ticket.status]?.includes(to)) {
      throw new AuthError('bad_transition', `لا يمكن الانتقال من «${ticket.status}» إلى «${to}»`, 409)
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const t = await tx.supportTicket.update({
        where: { id: ticketId },
        data: { status: to, closedAt: to === 'closed' ? new Date() : null },
      })
      await tx.ticketStatusHistory.create({
        data: { ticketId, fromStatus: ticket.status, toStatus: to, changedBy: actorId, note },
      })
      return t
    })
    await recordAudit(this.prisma, {
      actorId, action: 'support.ticket.status', entityType: 'support_ticket', entityId: ticketId,
      before: { status: ticket.status }, after: { status: to }, reason: note,
    })
    return updated
  }

  async setPriority(ticketId: string, priority: string, actorId: string) {
    if (!['low', 'normal', 'high', 'urgent'].includes(priority)) throw new AuthError('bad_priority', 'أولوية غير معروفة')
    const before = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } })
    if (!before) throw new AuthError('not_found', 'التذكرة غير موجودة', 404)
    const updated = await this.prisma.supportTicket.update({ where: { id: ticketId }, data: { priority } })
    await recordAudit(this.prisma, {
      actorId, action: 'support.ticket.priority', entityType: 'support_ticket', entityId: ticketId,
      before: { priority: before.priority }, after: { priority },
    })
    return updated
  }
}

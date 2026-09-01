/* المهامّ والإشعارات — تكليفٌ يعلم به صاحبُه.

   وحبّتان لا واحدة: `staff.task.assign` توزّع المهامّ و`staff.notify` تبثّ
   الإعلانات. ومن يوزّع ليس بالضرورة من يبثّ.

   و«مهامّي» و«إغلاقُها» بلا حبّة: كلُّ صاحبِ جلسةٍ يرى ما كُلّف به ويُغلقه —
   ولو حُرست بصلاحيةٍ لصار المكلَّفُ عاجزا عن رؤية تكليفه. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requireAuth, requirePermission } from '../auth-plugin'
import { StaffTaskService } from '../../services/staff-task.service'

export function registerStaffTaskRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const svc = new StaffTaskService(prisma)
  const canAssign = requirePermission('staff.task.assign')
  const canNotify = requirePermission('staff.notify')

  app.post('/api/staff/tasks', {
    preHandler: canAssign,
    schema: { tags: ['staff-tasks'], summary: 'تكليفُ موظّفٍ بمهمّة — ويصله إشعارٌ بها' },
  }, async (req, reply) => {
    const body = z.object({
      assigneeId: z.string().uuid(),
      title: z.string().trim().min(3).max(160),
      bodyAr: z.string().trim().max(2000).optional(),
      dueAt: z.string().datetime().optional(),
      priority: z.enum(['normal', 'high']).optional(),
    }).parse(req.body)
    return reply.status(201).send(await svc.assign(
      { userId: req.auth!.userId, roles: req.auth!.roles },
      { ...body, dueAt: body.dueAt ? new Date(body.dueAt) : undefined },
    ))
  })

  app.get('/api/staff/tasks/mine', {
    preHandler: requireAuth,
    schema: { tags: ['staff-tasks'], summary: 'مهامّي — ما كُلّفتُ به' },
  }, async (req) => {
    const q = z.object({ status: z.enum(['open', 'done']).optional() }).parse(req.query)
    return svc.mine(req.auth!.userId, q.status)
  })

  app.get('/api/staff/tasks/assigned', {
    preHandler: canAssign,
    schema: { tags: ['staff-tasks'], summary: 'ما كلّفتُ به غيري — للمتابعة' },
  }, async (req) => svc.assignedByMe(req.auth!.userId))

  app.post('/api/staff/tasks/:id/complete', {
    preHandler: requireAuth,
    schema: { tags: ['staff-tasks'], summary: 'إغلاقُ مهمّة — لمكلَّفها أو مكلِّفها' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ noteAr: z.string().trim().max(1000).optional() }).parse(req.body ?? {})
    return svc.complete(req.auth!.userId, id, body.noteAr)
  })

  app.post('/api/staff/notify', {
    preHandler: canNotify,
    schema: { tags: ['staff-tasks'], summary: 'إشعارٌ إلى موظّف أو أكثر — بلا مهمّة تُتابَع' },
  }, async (req, reply) => {
    const body = z.object({
      userIds: z.array(z.string().uuid()).min(1).max(200),
      title: z.string().trim().min(3).max(160),
      bodyAr: z.string().trim().min(3).max(2000),
    }).parse(req.body)
    return reply.status(201).send(
      await svc.notify({ userId: req.auth!.userId, roles: req.auth!.roles }, body),
    )
  })
}

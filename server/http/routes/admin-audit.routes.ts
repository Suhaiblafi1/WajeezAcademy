/* سجل التدقيق الموحّد — شاشة واحدة تجمع كل ما يكتبه recordAudit() من أي
   خدمة، بدل أثرٍ مبعثر يظهر كل جزء منه في شاشته وحدها. صلاحية audit.view. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient, Prisma } from '@prisma/client'
import { requirePermission } from '../auth-plugin'

const QUERY = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  actorEmail: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  action: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export function registerAdminAuditRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const guard = requirePermission('audit.view')

  app.get('/api/admin/audit-log', {
    preHandler: guard,
    schema: { tags: ['admin-audit'], summary: 'سجل التدقيق الموحّد — بحث وترقيم صفحات' },
  }, async (req) => {
    const q = QUERY.parse(req.query)

    let actorIds: string[] | undefined
    if (q.actorEmail) {
      const matches = await prisma.user.findMany({
        where: { email: { contains: q.actorEmail, mode: 'insensitive' } },
        select: { id: true },
      })
      /* بريدٌ لا يطابق أحدا — نتيجةٌ فارغة صريحة لا كل السجل */
      actorIds = matches.length > 0 ? matches.map((m) => m.id) : ['00000000-0000-0000-0000-000000000000']
    }

    const where: Prisma.AuditEventWhereInput = {
      ...(actorIds ? { actorId: { in: actorIds } } : {}),
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.action ? { action: { contains: q.action, mode: 'insensitive' } } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
    }

    const [total, rows] = await Promise.all([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where, orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize, take: q.pageSize,
      }),
    ])

    const actors = await prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.actorId).filter((id): id is string => !!id))] } },
      select: { id: true, displayName: true, email: true },
    })
    const actorById = new Map(actors.map((a) => [a.id, a]))

    return {
      page: q.page, pageSize: q.pageSize, total,
      items: rows.map((r) => ({
        id: r.id, action: r.action, entityType: r.entityType, entityId: r.entityId,
        reason: r.reason, meta: r.meta, createdAt: r.createdAt,
        actor: r.actorId ? (actorById.get(r.actorId) ?? { id: r.actorId, displayName: 'مستخدم محذوف', email: '' }) : null,
      })),
    }
  })

  /* قوائم القيم المتاحة للفلترة — لا تُخترع، تُقرأ مما وقع فعلا */
  app.get('/api/admin/audit-log/facets', {
    preHandler: guard,
    schema: { tags: ['admin-audit'], summary: 'أنواع الكيانات والإجراءات التي ظهرت فعلا في السجل' },
  }, async () => {
    const [entityTypes, actions] = await Promise.all([
      prisma.auditEvent.findMany({ distinct: ['entityType'], select: { entityType: true }, orderBy: { entityType: 'asc' } }),
      prisma.auditEvent.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
    ])
    return { entityTypes: entityTypes.map((e) => e.entityType), actions: actions.map((a) => a.action) }
  })
}

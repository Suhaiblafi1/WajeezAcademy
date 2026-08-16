/* مسارات إدارة المستخدمين — قائمة، أدوار، إيقاف (صلاحية admin.users.manage) */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { AuthService } from '../../services/auth.service'
import { requirePermission } from '../auth-plugin'
import { ROLE_NAMES_AR } from '../../auth/permissions'

export function registerAdminUserRoutes(app: FastifyInstance, prisma: PrismaClient, auth: AuthService) {
  const guard = requirePermission('admin.users.manage')

  app.get('/api/admin/users', { preHandler: guard, schema: { tags: ['admin-users'], summary: 'قائمة المستخدمين وأدوارهم وحالاتهم' } },
    async () => {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: { roles: true },
      })
      return users.map((u) => ({
        id: u.id, email: u.email, displayName: u.displayName, status: u.status,
        createdAt: u.createdAt, roles: u.roles.map((r) => ({ id: r.roleId, nameAr: ROLE_NAMES_AR[r.roleId] ?? r.roleId })),
      }))
    })

  app.post('/api/admin/users/:id/roles', {
    preHandler: guard,
    schema: {
      tags: ['admin-users'], summary: 'تعيين أدوار مستخدم — يستبدل القائمة كاملة',
      body: { type: 'object', required: ['roleIds'], properties: { roleIds: { type: 'array', items: { type: 'string' } } } },
    },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const { roleIds } = z.object({ roleIds: z.array(z.string()).min(1) }).parse(req.body)
    /* ممنوع سحب دور super_admin من نفسك — حماية من الإغلاق الذاتي */
    if (id === req.auth!.userId && !roleIds.includes('super_admin') && req.auth!.roles.includes('super_admin')) {
      return { error: { code: 'self_lockout', message_ar: 'لا يمكنك سحب دور مدير النظام من حسابك بنفسك' } }
    }
    await auth.setRoles(id, roleIds)
    return { ok: true }
  })

  app.post('/api/admin/users/:id/suspend', { preHandler: guard, schema: { tags: ['admin-users'], summary: 'إيقاف حساب — يبطل جلساته فورا' } },
    async (req) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
      if (id === req.auth!.userId) {
        return { error: { code: 'self_suspend', message_ar: 'استخدم إيقاف الحساب الذاتي من ملفك — لا توقف نفسك من هنا' } }
      }
      await auth.suspend(id)
      return { ok: true }
    })
}

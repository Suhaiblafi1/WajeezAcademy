/* مسارات إدارة المستخدمين — قائمة، أدوار، إيقاف (صلاحية admin.users.manage) */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { AuthService } from '../../services/auth.service'
import { requirePermission } from '../auth-plugin'
import { recordAudit } from '../../services/audit'
import { PERMISSIONS, ROLE_NAMES_AR, ROLE_PERMISSIONS, type PermissionKey } from '../../auth/permissions'

export function registerAdminUserRoutes(app: FastifyInstance, prisma: PrismaClient, auth: AuthService) {
  const guard = requirePermission('admin.users.manage')

  app.get('/api/admin/users', { preHandler: guard, schema: { tags: ['admin-users'], summary: 'قائمة المستخدمين وأدوارهم وحالاتهم' } },
    async () => {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: { roles: true, permissionOverrides: true },
      })
      return users.map((u) => ({
        id: u.id, email: u.email, displayName: u.displayName, status: u.status,
        createdAt: u.createdAt, roles: u.roles.map((r) => ({ id: r.roleId, nameAr: ROLE_NAMES_AR[r.roleId] ?? r.roleId })),
        /* عددُ استثناءاته يُقرأ من القائمة: من له استثناءٌ يُعرف قبل فتحه */
        grants: u.permissionOverrides.filter((o) => o.effect === 'grant').length,
        denies: u.permissionOverrides.filter((o) => o.effect === 'deny').length,
      }))
    })

  /* ── صلاحيّاتُ شخصٍ بعينه ──

     مديرُ النظام وحده: من يملك admin.users.manage يعيّن الأدوار، وهذا أبعد —
     يفتح صلاحيةً بعينها خارج أيّ دور. فحارسُه أضيق. */
  const superOnly = requirePermission('admin.users.manage')

  app.get('/api/admin/users/:id/permissions', {
    preHandler: superOnly,
    schema: { tags: ['admin-users'], summary: 'صلاحيات مستخدم: من دوره، وما مُنح له، وما مُنع عنه' },
  }, async (req, reply) => {
    if (!req.auth!.roles.includes('super_admin')) {
      return reply.status(403).send({ error: { code: 'super_admin_only', message_ar: 'صلاحيات الأشخاص لمدير النظام وحده' } })
    }
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const user = await prisma.user.findUnique({
      where: { id },
      include: { roles: true, permissionOverrides: true },
    })
    if (!user) return reply.status(404).send({ error: { code: 'not_found', message_ar: 'المستخدم غير موجود' } })

    const fromRoles = new Set<string>()
    for (const r of user.roles) for (const k of ROLE_PERMISSIONS[r.roleId] ?? []) fromRoles.add(k)
    const override = new Map(user.permissionOverrides.map((o) => [o.permissionKey, o]))

    return {
      user: { id: user.id, displayName: user.displayName, email: user.email },
      roles: user.roles.map((r) => ({ id: r.roleId, nameAr: ROLE_NAMES_AR[r.roleId] ?? r.roleId })),
      permissions: PERMISSIONS.map((p) => {
        const o = override.get(p.key)
        return {
          key: p.key, description: p.description,
          fromRole: fromRoles.has(p.key),
          effect: o?.effect ?? null,
          reason: o?.reason ?? null,
          /* المحصّلة تُحسب هنا بالقاعدة نفسها التي يحسبها بها الخادم عند كل
             طلب — فما تراه الشاشة هو ما يقع، لا تقديرٌ يوازيه */
          effective: o?.effect === 'deny' ? false : (o?.effect === 'grant' ? true : fromRoles.has(p.key)),
        }
      }),
    }
  })

  app.post('/api/admin/users/:id/permissions', {
    preHandler: superOnly,
    schema: { tags: ['admin-users'], summary: 'منح صلاحية لشخص أو منعها عنه أو إزالة الاستثناء' },
  }, async (req, reply) => {
    if (!req.auth!.roles.includes('super_admin')) {
      return reply.status(403).send({ error: { code: 'super_admin_only', message_ar: 'صلاحيات الأشخاص لمدير النظام وحده' } })
    }
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      permissionKey: z.string().min(3),
      effect: z.enum(['grant', 'deny', 'clear']),
      reason: z.string().trim().max(500).optional(),
    }).parse(req.body)

    const known = PERMISSIONS.some((p) => p.key === body.permissionKey)
    if (!known) {
      return reply.status(400).send({ error: { code: 'unknown_permission', message_ar: 'صلاحية غير معروفة' } })
    }
    /* بابٌ لا يُغلق على صاحبه: من منع عن نفسه إدارةَ المستخدمين لم يعد يملك
       رفعَ المنع — ولا سبيل إلى الإصلاح إلا من القاعدة مباشرة. */
    if (id === req.auth!.userId && body.effect === 'deny' && body.permissionKey === 'admin.users.manage') {
      return reply.status(409).send({ error: { code: 'self_lockout', message_ar: 'لا تمنع عن نفسك إدارة المستخدمين — لن تستطيع رفع المنع' } })
    }
    const reason = body.reason?.trim() ?? ''
    if (body.effect !== 'clear' && reason.length < 5) {
      return reply.status(400).send({ error: { code: 'reason_required', message_ar: 'اكتب سبب الاستثناء — يُقرأ عند المراجعة' } })
    }

    if (body.effect === 'clear') {
      await prisma.userPermission.deleteMany({ where: { userId: id, permissionKey: body.permissionKey } })
    } else {
      await prisma.userPermission.upsert({
        where: { userId_permissionKey: { userId: id, permissionKey: body.permissionKey } },
        create: {
          userId: id, permissionKey: body.permissionKey as PermissionKey,
          effect: body.effect, reason, grantedBy: req.auth!.userId,
        },
        update: { effect: body.effect, reason, grantedBy: req.auth!.userId },
      })
    }
    /* لا يعمل أحدٌ بصلاحيةٍ نُزعت عنه: الجلسة تحمل الصلاحيات وقت حلّها، فتُبطَل */
    await auth.revokeAllSessions(id)
    await recordAudit(prisma, {
      actorId: req.auth!.userId, action: `admin.permission.${body.effect}`,
      entityType: 'user', entityId: id, reason: reason || undefined,
      meta: { permissionKey: body.permissionKey },
    })
    return { ok: true }
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

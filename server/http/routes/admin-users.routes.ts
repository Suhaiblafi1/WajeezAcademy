/* مسارات إدارة المستخدمين — قائمة، أدوار، إيقاف (صلاحية admin.users.manage) */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { AuthService } from '../../services/auth.service'
import { requirePermission } from '../auth-plugin'
import { recordAudit } from '../../services/audit'
import { randomBytes } from 'node:crypto'
import {
  PERMISSIONS, ROLE_NAMES_AR, ROLE_PERMISSIONS, ROLE_RANK, refuseDelegation, refuseRoleAssignment, rankOf,
  DELEGATABLE_FAMILIES, type PermissionKey,
} from '../../auth/permissions'
import { sendStaffInviteEmail } from '../../services/account-mail'
import { accountFootprint, footprintBlockersAr, purgeAccountWithHistory } from '../../services/account-purge.service'

export function registerAdminUserRoutes(app: FastifyInstance, prisma: PrismaClient, auth: AuthService) {
  /* ثلاثُ حبّات: الرؤية · تعيين الأدوار والإيقاف · التفويض. والمدير
     الأكاديميّ يملك الأولى والثالثة لا الثانية. */
  const canView = requirePermission('admin.users.view')
  const guard = requirePermission('admin.users.manage')
  const canDelegate = requirePermission('admin.permissions.delegate')

  app.get('/api/admin/users', { preHandler: canView, schema: { tags: ['admin-users'], summary: 'قائمة المستخدمين وأدوارهم وحالاتهم' } },
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

     ثلاث قواعد تجتمع في `refuseDelegation`: لا يمنح أحدٌ ما لا يملك · ولا
     يمسّ إلّا من هو أقلّ منه رتبة · وفي حدود مهامّه وحدها. وهي في وحدةٍ نقيّة
     تُختبر بمعزل، لا شروطٌ مبعثرة في المسار. */

  app.get('/api/admin/users/:id/permissions', {
    preHandler: canDelegate,
    schema: { tags: ['admin-users'], summary: 'صلاحيات مستخدم: من دوره، وما مُنح له، وما مُنع عنه' },
  }, async (req, reply) => {
    /* من لا يفوّض شيئا لا يفتح الشاشة أصلا */
    if (!req.auth!.roles.some((r) => DELEGATABLE_FAMILIES[r])) {
      return reply.status(403).send({ error: { code: 'not_delegator', message_ar: 'حسابك لا يفوّض الصلاحيات' } })
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
      /* رتبةُ الطرفين تُعرض: من يُردّ يعرف لماذا قبل أن يضغط */
      rank: { actor: rankOf(req.auth!.roles), target: rankOf(user.roles.map((r) => r.roleId)) },
      permissions: PERMISSIONS.map((p) => {
        const o = override.get(p.key)
        const refusal = refuseDelegation(
          { roles: req.auth!.roles, permissions: req.auth!.permissions },
          { roles: user.roles.map((r) => r.roleId) },
          p.key,
        )
        return {
          key: p.key, description: p.description,
          fromRole: fromRoles.has(p.key),
          effect: o?.effect ?? null,
          reason: o?.reason ?? null,
          /* ما لا تستطيع تفويضه يُعرض ولا يُمكَّن — والسبب معه */
          delegatable: refusal === null,
          refusal: refusal?.message_ar ?? null,
          /* المحصّلة تُحسب هنا بالقاعدة نفسها التي يحسبها بها الخادم عند كل
             طلب — فما تراه الشاشة هو ما يقع، لا تقديرٌ يوازيه */
          effective: o?.effect === 'deny' ? false : (o?.effect === 'grant' ? true : fromRoles.has(p.key)),
        }
      }),
    }
  })

  app.post('/api/admin/users/:id/permissions', {
    preHandler: canDelegate,
    schema: { tags: ['admin-users'], summary: 'منح صلاحية لشخص أو منعها عنه أو إزالة الاستثناء' },
  }, async (req, reply) => {
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
    /* القواعد الثلاث — والحكم من الوحدة النقيّة لا من شروطٍ هنا */
    const target = await prisma.user.findUnique({ where: { id }, include: { roles: true } })
    if (!target) return reply.status(404).send({ error: { code: 'not_found', message_ar: 'المستخدم غير موجود' } })
    const refusal = refuseDelegation(
      { roles: req.auth!.roles, permissions: req.auth!.permissions },
      { roles: target.roles.map((r) => r.roleId) },
      body.permissionKey,
    )
    if (refusal) return reply.status(403).send({ error: refusal })

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

  /* ─────────── إنشاءُ حسابٍ إداريّ ───────────

     قرارُ صاحب المنصّة: «ما فيه أي مسار لإنشاء مستخدم جديد — الموجود فقط:
     عرض القائمة، وتعيين أدوارٍ لمستخدمٍ موجودٍ مسبقا، وإيقاف. أضف مسارا
     ينشئ حسابا جديدا مباشرة (بريد + دور)، ويرسل بريدا تلقائيا للمستخدم
     الجديد يوضّح دوره ووظيفته على المنصّة وخطوة تفعيل حسابه».

     ولا كلمةَ مرورٍ تُختار هنا ولا تُرسَل: يُنشأ الحسابُ بعشوائيّةٍ لا يعرفها
     أحد، ويعيّن صاحبُه كلمتَه من رابطٍ مؤقّت. فكلمةٌ تمرّ في بريدٍ تبقى فيه.

     وتعذُّرُ الإرسال لا يُسقط الإنشاء: الحسابُ أُنشئ فعلا، وردٌّ بخطأٍ يجعل
     المنشِئ يعيد المحاولة فيصطدم بـ«هذا البريد مسجل». تُعاد حالةُ الإرسال
     ليقرّر ما يقول. */
  app.post('/api/admin/users', {
    preHandler: guard,
    schema: { tags: ['admin-users'], summary: 'إنشاء حساب إداريّ بدوره — ويصله بريدٌ يشرح دوره ويفعّل حسابه' },
  }, async (req, reply) => {
    const body = z.object({
      email: z.string().trim().toLowerCase().email('صيغة البريد غير صحيحة'),
      displayName: z.string().trim().min(2).max(80),
      roleIds: z.array(z.string()).min(1),
    }).parse(req.body)

    const refusal = refuseRoleAssignment(req.auth!.roles, body.roleIds)
    if (refusal) return reply.status(403).send({ error: refusal })

    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) {
      return reply.status(409).send({
        error: { code: 'email_taken', message_ar: 'لهذا البريد حسابٌ بالفعل — عيّن دورَه من قائمة المستخدمين' },
      })
    }

    /* كلمةٌ عشوائيّة لا يعرفها أحد — الدخولُ يبدأ بتعيينِ صاحبه كلمتَه */
    const { userId } = await auth.register(body.email, randomBytes(24).toString('hex'), body.displayName)
    await auth.setRoles(userId, body.roleIds)

    const { tokenForDelivery } = await auth.requestPasswordReset(body.email)
    const actor = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { displayName: true } })
    const mail = tokenForDelivery
      ? await sendStaffInviteEmail(prisma, {
          to: body.email,
          displayName: body.displayName,
          token: tokenForDelivery,
          roleNamesAr: body.roleIds.map((r) => ROLE_NAMES_AR[r] ?? r),
          invitedByAr: actor?.displayName ?? 'مدير المنصّة',
          /* وظيفتُه على المنصّة بلغته — من وصف الصلاحيات نفسِها لا من نصٍّ
             ثانٍ يشيخ. وستٌّ تكفي للتعريف، والباقي يراه في لوحته. */
          dutiesAr: [...new Set(body.roleIds.flatMap((r) => ROLE_PERMISSIONS[r] ?? []))]
            .flatMap((k) => {
              const found = PERMISSIONS.find((p) => p.key === k)
              return found ? [found.description as string] : []
            })
            .slice(0, 6),
        })
      : null

    await recordAudit(prisma, {
      actorId: req.auth!.userId, action: 'admin.user.create', entityType: 'user', entityId: userId,
      meta: { email: body.email, roles: body.roleIds, inviteSent: mail?.status === 'sent' },
    })
    return reply.status(201).send({
      userId,
      inviteSent: mail?.status === 'sent',
      /* لا يُقال «أُرسلت» حين لا بريد — انتظارُ رسالةٍ لن تصل أسوأ من معرفة ذلك */
      inviteNote: mail?.status === 'sent'
        ? 'أُنشئ الحساب، ووصلته دعوةٌ تشرح دوره وتفعّل حسابه.'
        : 'أُنشئ الحساب، ولم تُرسل الدعوة — قناةُ البريد غير مفعّلة. اطلب منه «نسيت كلمة المرور» ببريده.',
    })
  })

  app.post('/api/admin/users/:id/roles', {
    preHandler: guard,
    schema: {
      tags: ['admin-users'], summary: 'تعيين أدوار مستخدم — يستبدل القائمة كاملة',
      body: { type: 'object', required: ['roleIds'], properties: { roleIds: { type: 'array', items: { type: 'string' } } } },
    },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const { roleIds } = z.object({ roleIds: z.array(z.string()).min(1) }).parse(req.body)
    /* ممنوع سحب دور super_admin من نفسك — حماية من الإغلاق الذاتي */
    if (id === req.auth!.userId && !roleIds.includes('super_admin') && req.auth!.roles.includes('super_admin')) {
      return { error: { code: 'self_lockout', message_ar: 'لا يمكنك سحب دور مدير النظام من حسابك بنفسك' } }
    }
    /* ولا يُعيَّن دورٌ أعلى من رتبة المعيِّن — وكان هذا الباب مفتوحا: من مُنح
       `admin.users.manage` بالتفويض صار يستطيع أن يرقّي نفسه مديرَ نظام. */
    const rankRefusal = refuseRoleAssignment(req.auth!.roles, roleIds)
    if (rankRefusal) return reply.status(403).send({ error: rankRefusal })
    await auth.setRoles(id, roleIds)
    return { ok: true }
  })

  /* حارسُ الرتبة على ما يمسّ حسابَ غيرِك: لا يُوقَف ولا يُحذَف من هو في
     رتبتك أو فوقها. وإلّا صار مَن مُنح «إدارة المستخدمين» استثناءً قادرا على
     إيقاف مدير النظام الأعلى. */
  const isTopAdmin = (roles: readonly string[]) => rankOf(roles) >= ROLE_RANK.super_admin
  /* المحوُ بالسجلّ حبّةٌ مستقلّة لا رتبةٌ تُفحَص: الرتبةُ تحرس «من تمسّ»،
     والحبّةُ تحرس «أيَّ محوٍ تملك». ومديرُ النظام الأعلى يملكها وحدَه لأنّ
     `ROLE_PERMISSIONS` تمنحه كلَّ الحبّات، ويفوّضها لغيره إن أراد. */
  const canForcePurge = (req: { auth: { permissions: string[] } | null }) =>
    req.auth?.permissions.includes('admin.users.purge_history') ?? false
  const refuseRank = async (targetId: string, actorRoles: string[], verbAr: string) => {
    const target = await prisma.user.findUnique({ where: { id: targetId }, include: { roles: true } })
    if (!target) return { error: { code: 'not_found', message_ar: 'لا حسابَ بهذا المعرّف' } }
    /* مديرُ النظام الأعلى يدير كلَّ حسابٍ سوى حسابه (والذاتُ محروسةٌ قبل هذا):
       كان القيدُ «رتبتك أو فوقها» يمنعه من إيقاف مديرِ نظامٍ آخر أو حذفِ
       حسابِ ديمو بدوره — فلا أحدٌ فوقَ الأعلى يفكّه. */
    if (isTopAdmin(actorRoles)) return { target }
    const targetRank = rankOf(target.roles.map((r) => r.roleId))
    if (targetRank >= rankOf(actorRoles)) {
      return { error: { code: 'rank_exceeded', message_ar: `لا تستطيع ${verbAr} حسابا في رتبتك أو فوقها` } }
    }
    return { target }
  }

  app.post('/api/admin/users/:id/suspend', { preHandler: guard, schema: { tags: ['admin-users'], summary: 'إيقاف حساب — يبطل جلساته فورا' } },
    async (req) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
      if (id === req.auth!.userId) {
        return { error: { code: 'self_suspend', message_ar: 'استخدم إيقاف الحساب الذاتي من ملفك — لا توقف نفسك من هنا' } }
      }
      const check = await refuseRank(id, req.auth!.roles, 'إيقاف')
      if ('error' in check) return check
      await auth.suspend(id)
      await recordAudit(prisma, {
        actorId: req.auth!.userId, action: 'admin.user.suspend', entityType: 'user', entityId: id,
        meta: { email: check.target.email },
      })
      return { ok: true }
    })

  app.post('/api/admin/users/:id/reinstate', { preHandler: guard, schema: { tags: ['admin-users'], summary: 'رفعُ الإيقاف — يعيد الحساب نشطا' } },
    async (req) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
      const check = await refuseRank(id, req.auth!.roles, 'رفعَ الإيقاف عن')
      if ('error' in check) return check
      if (check.target.status !== 'suspended') {
        return { error: { code: 'not_suspended', message_ar: 'هذا الحساب ليس موقوفا' } }
      }
      await auth.reinstate(id)
      await recordAudit(prisma, {
        actorId: req.auth!.userId, action: 'admin.user.reinstate', entityType: 'user', entityId: id,
        meta: { email: check.target.email },
      })
      return { ok: true }
    })

  /* ─────────── الحذفُ النهائيّ ───────────

     قرارُ صاحب المنصّة: «الحذفُ يكون إزالةَ الحساب كليّا من القاعدة، أو
     إيقافَه فقط ويوضع في خانةٍ منفصلة: الحسابات الموقوفة».

     والإزالةُ الكاملة تُقبل حيث لا تُتلف سجلّا. فالقاعدةُ تُسلسل الحذفَ إلى
     `Order` و`Subscription` — أي أنّ حذفَ مشترٍ يمحو فواتيرَه ودفعاتِه معه،
     بلا سؤال. ودفترُ المال لا يُمحى بنقرةٍ في شاشة مستخدمين.

     فالقاعدة: يُحذف من لم يترك أثرا (حسابٌ أُنشئ خطأ، دعوةٌ لم تُقبل،
     تجربة)، ويُوقَف من ترك. والرفضُ يقول ما يمنعه بالعدد لا «تعذّر الحذف»،
     ويدلّ على البديل. */
  app.delete('/api/admin/users/:id', {
    preHandler: requirePermission('admin.users.purge'),
    schema: { tags: ['admin-users'], summary: 'حذفُ حسابٍ نهائيّا — يُرفض إن كان له سجلٌّ إلّا قسرا من مدير النظام الأعلى بسبب' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const { force } = z.object({ force: z.enum(['1', 'true']).optional() }).parse(req.query ?? {})
    const { reason } = z.object({ reason: z.string().trim().max(500).optional() }).parse(req.body ?? {})
    if (id === req.auth!.userId) {
      return { error: { code: 'self_purge', message_ar: 'لا تحذف حسابك من هنا' } }
    }
    const check = await refuseRank(id, req.auth!.roles, 'حذفَ')
    if ('error' in check) return check

    const footprint = await accountFootprint(prisma, id)
    const blockers = footprintBlockersAr(footprint)
    if (blockers.length > 0 && !force) {
      return {
        error: {
          code: 'has_history',
          message_ar: `لا يُحذف هذا الحساب: له ${blockers.join('، و')} — وحذفُه يمحوها معه. أوقفه بدل ذلك، فيبقى السجلّ ويُمنع الدخول.`,
          blockers,
          /* لمدير النظام الأعلى بابٌ ثانٍ: المحوُ بالسجلّ، بسبب */
          forceAllowed: canForcePurge(req),
        },
      }
    }

    /* المحوُ بالسجلّ: للأعلى وحده، وبسببٍ يُقرأ — حسابُ ديمو أو تجربةٍ لا دفترُ عميل */
    if (blockers.length > 0) {
      if (!canForcePurge(req)) {
        return { error: { code: 'force_forbidden', message_ar: 'المحوُ بالسجلّ لمن يملك حبّته وحده — أوقف الحساب بدل ذلك' } }
      }
      if (!reason || reason.length < 5) {
        return { error: { code: 'reason_required', message_ar: 'اكتب سببَ المحو بالسجلّ — يُحفظ في الأثر بعد أن يذهب الحساب' } }
      }
    }

    /* الأثرُ يُكتب قبل المحو: بعده لا يبقى ما يُشار إليه */
    await recordAudit(prisma, {
      actorId: req.auth!.userId, action: blockers.length > 0 ? 'admin.user.purge_with_history' : 'admin.user.purge',
      entityType: 'user', entityId: id,
      reason: reason || undefined,
      meta: {
        email: check.target.email, displayName: check.target.displayName, roles: check.target.roles.map((r) => r.roleId),
        ...(blockers.length > 0 ? { footprint } : {}),
      },
    })
    if (blockers.length > 0) await purgeAccountWithHistory(prisma, id)
    else await prisma.user.delete({ where: { id } })
    return { ok: true, purged: check.target.email, withHistory: blockers.length > 0 }
  })
}


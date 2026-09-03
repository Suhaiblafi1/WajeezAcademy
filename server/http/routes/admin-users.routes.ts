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
import { inviteLink, sendStaffInviteEmail } from '../../services/account-mail'
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
        include: {
          roles: true,
          permissionOverrides: true,
          /* حالُ دعوته يُقرأ في الصفّ: «دعوةٌ سارية» أو «انتهت» فرقٌ يقرّر
             هل يُعاد الإرسالُ أم يُنتظر (جولة ٢٠٢٦-٠٩: الدعوةُ كانت ساعةً
             واحدةً فتنتهي قبل أن يفتح المدعوُّ بريدَه). */
          resetTokens: {
            where: { purpose: 'invite', usedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { expiresAt: true },
          },
        },
      })
      const now = new Date()
      return users.map((u) => {
        const invite = u.resetTokens[0]
        return {
          id: u.id, email: u.email, displayName: u.displayName, status: u.status,
          createdAt: u.createdAt, roles: u.roles.map((r) => ({ id: r.roleId, nameAr: ROLE_NAMES_AR[r.roleId] ?? r.roleId })),
          /* عددُ استثناءاته يُقرأ من القائمة: من له استثناءٌ يُعرف قبل فتحه */
          grants: u.permissionOverrides.filter((o) => o.effect === 'grant').length,
          denies: u.permissionOverrides.filter((o) => o.effect === 'deny').length,
          invite: invite
            ? { state: invite.expiresAt > now ? 'pending' as const : 'expired' as const, expiresAt: invite.expiresAt }
            : { state: 'none' as const, expiresAt: null },
        }
      })
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
    /* «مدعوّ» لا «نشط»: الحسابُ موجودٌ ولم يدخله صاحبُه بعد، وهذا فرقٌ
       يُقرأ في القائمة — فمن أُنشئ حسابُه ولم يُفعّله لا يُحسب فريقا عاملا. */
    await prisma.user.update({ where: { id: userId }, data: { status: 'invited' } })

    const { token: tokenForDelivery } = await auth.issueInvite(userId)
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

  /* إعادةُ إرسال الدعوة — لمن انتهت دعوتُه أو لم تصله.

     كان البديلُ الوحيدُ أن يطلب المدعوُّ «نسيت كلمة المرور» بنفسه، أي أن
     يصنع لنفسه ما كان يجب أن يصله — وهذا يفترض أنّه يعرف أنّ له حسابا. */
  app.post('/api/admin/users/:id/resend-invite', {
    preHandler: guard,
    schema: { tags: ['admin-users'], summary: 'يُصدر دعوةً جديدةً (٧ أيّام) ويُبطل ما قبلها' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const user = await prisma.user.findUnique({
      where: { id }, include: { roles: true },
    })
    if (!user) return reply.status(404).send({ error: { code: 'not_found', message_ar: 'الحساب غير موجود' } })
    if (user.status === 'archived') {
      return reply.status(409).send({ error: { code: 'archived', message_ar: 'حسابٌ مؤرشَف — أعِد تنشيطَه أوّلا' } })
    }

    const { token, expiresAt } = await auth.issueInvite(id)
    const roleIds = user.roles.map((r) => r.roleId)
    const actor = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { displayName: true } })
    const mail = await sendStaffInviteEmail(prisma, {
      to: user.email,
      displayName: user.displayName,
      token,
      roleNamesAr: roleIds.map((r) => ROLE_NAMES_AR[r] ?? r),
      invitedByAr: actor?.displayName ?? 'مدير المنصّة',
      dutiesAr: [...new Set(roleIds.flatMap((r) => ROLE_PERMISSIONS[r] ?? []))]
        .flatMap((k) => {
          const found = PERMISSIONS.find((p) => p.key === k)
          return found ? [found.description as string] : []
        })
        .slice(0, 6),
    })
    await recordAudit(prisma, {
      actorId: req.auth!.userId, action: 'admin.user.invite_resend', entityType: 'user', entityId: id,
      meta: { email: user.email, sent: mail.status === 'sent' },
    })
    return {
      sent: mail.status === 'sent',
      expiresAt,
      note: mail.status === 'sent'
        ? 'أُرسلت دعوةٌ جديدةٌ صالحةٌ سبعةَ أيّام — والقديمةُ أُبطلت.'
        : 'أُصدرت دعوةٌ جديدةٌ ولم تُرسل — قناةُ البريد غير مفعّلة. سلّمه الرابطَ بنفسك أو فعّل البريد.',
      /* الرابطُ يُعاد لمن يملك إدارةَ المستخدمين وحدَه، وحين لا بريد: فهو
         السبيلُ الوحيدُ لتسليم الدعوة يدويّا — ولا يُسجَّل في الأثر. */
      link: mail.status === 'sent' ? undefined : inviteLink(token),
    }
  })

  /* دعوةُ دفعةٍ من صفوفٍ ملصوقة: «بريد, اسم» في كلّ سطر.

     تأهيلُ فريقٍ من ستّة أشخاصٍ كان ستَّ رحلاتٍ في النموذج نفسِه. والدفعةُ
     لا تتوقّف عند أوّل خطأ: كلُّ سطرٍ يُجاب عنه بحاله، فيُعاد ما فشل وحدَه. */
  app.post('/api/admin/users/bulk-invite', {
    preHandler: guard,
    schema: { tags: ['admin-users'], summary: 'دعوةُ عدّةِ حساباتٍ بدورٍ واحد — سطرٌ لكلّ شخص' },
  }, async (req) => {
    const body = z.object({
      roleIds: z.array(z.string()).min(1),
      rows: z.array(z.object({
        email: z.string().email(),
        displayName: z.string().trim().min(2).max(120),
      })).min(1).max(50),
    }).parse(req.body)

    const actor = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { displayName: true } })
    const dutiesAr = [...new Set(body.roleIds.flatMap((r) => ROLE_PERMISSIONS[r] ?? []))]
      .flatMap((k) => {
        const found = PERMISSIONS.find((p) => p.key === k)
        return found ? [found.description as string] : []
      })
      .slice(0, 6)

    const results: { email: string; ok: boolean; sent: boolean; reasonAr?: string }[] = []
    for (const row of body.rows) {
      const email = row.email.trim().toLowerCase()
      try {
        if (await prisma.user.findUnique({ where: { email } })) {
          results.push({ email, ok: false, sent: false, reasonAr: 'لهذا البريد حسابٌ بالفعل' })
          continue
        }
        const { userId } = await auth.register(email, randomBytes(24).toString('hex'), row.displayName)
        await auth.setRoles(userId, body.roleIds)
        await prisma.user.update({ where: { id: userId }, data: { status: 'invited' } })
        const { token } = await auth.issueInvite(userId)
        const mail = await sendStaffInviteEmail(prisma, {
          to: email, displayName: row.displayName, token,
          roleNamesAr: body.roleIds.map((r) => ROLE_NAMES_AR[r] ?? r),
          invitedByAr: actor?.displayName ?? 'مدير المنصّة',
          dutiesAr,
        })
        await recordAudit(prisma, {
          actorId: req.auth!.userId, action: 'admin.user.create', entityType: 'user', entityId: userId,
          meta: { email, roles: body.roleIds, bulk: true, inviteSent: mail.status === 'sent' },
        })
        results.push({ email, ok: true, sent: mail.status === 'sent' })
      } catch (e) {
        results.push({ email, ok: false, sent: false, reasonAr: e instanceof Error ? e.message : 'تعذّر الإنشاء' })
      }
    }
    return {
      created: results.filter((r) => r.ok).length,
      sent: results.filter((r) => r.sent).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    }
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
      return reply.status(409).send({ error: { code: 'self_lockout', message_ar: 'لا يمكنك سحب دور مدير النظام من حسابك بنفسك' } })
    }
    /* ولا يُعيَّن دورٌ أعلى من رتبة المعيِّن — وكان هذا الباب مفتوحا: من مُنح
       `admin.users.manage` بالتفويض صار يستطيع أن يرقّي نفسه مديرَ نظام. */
    /* وأدوارُه الحاليّة تُقرأ قبل الحكم: أدوارُ الحالة (`LIFECYCLE_ROLES`)
       تُفحَص على ما تغيّر لا على ما في القائمة، فتُعدَّل أدوارُ متقدّمٍ
       الأخرى بلا أن تُمسّ حالتُه. */
    const before = await prisma.user.findUnique({ where: { id }, select: { roles: { select: { roleId: true } } } })
    const rankRefusal = refuseRoleAssignment(req.auth!.roles, roleIds, before?.roles.map((r) => r.roleId) ?? [])
    if (rankRefusal) return reply.status(403).send({ error: rankRefusal })
    await auth.setRoles(id, roleIds)
    /* ═══ وتعيينُ الأدوار يُسجَّل ═══

       لم يكن يُسجَّل. وهو **أعلى فعلٍ سلطةً على المنصّة**: به يصير حسابٌ
       مديرَ نظامٍ أعلى، وبه تُنزع بوّابةُ التعلّم عن متعلّمٍ له تسجيلات.
       وكلُّ ما هو أدنى منه مسجَّل — الإيقافُ والأرشفةُ ومنحُ حبّةٍ واحدةٍ
       باستثناء — فكان الأثرُ يحفظ الفروعَ ويترك الأصل.

       و«قبل» و«بعد» هما جوهرُ الفائدة هنا: «صار مديرَ نظام» جوابٌ، و«غُيّرت
       أدوارُه» ليس جوابا. والقائمتان مرتّبتان كي يُقرأ الفرقُ لا ترتيبُ
       الإدخال. */
    await recordAudit(prisma, {
      actorId: req.auth!.userId, action: 'roles.set', entityType: 'user', entityId: id,
      before: { roles: (before?.roles.map((r) => r.roleId) ?? []).sort() },
      after: { roles: [...roleIds].sort() },
    })
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
  /* ═══ ورمزُ الحالة يقول ما قاله الجسم ═══

     كانت هذه المساراتُ ترجع رفضَها بـ**٢٠٠** وجسمٍ فيه `error`: «لا حسابَ
     بهذا المعرّف» و«لا تستطيع إيقافَ من فوقك» تصل كلُّها بحالةِ نجاح. فأيُّ
     مستهلكٍ يفحص `res.ok` — وهو الفحصُ الطبيعيُّ في `fetch` — يقرأ الرفضَ
     نجاحا. وشاشاتُنا نجت لأنّها تفحص `res.error` بالاسم، وهو عقدٌ هشٌّ يخصّها
     ولا يُلزم غيرَها.

     فصار لكلّ رفضٍ رمزُه: ٤٠٤ لما لا وجودَ له، و٤٠٣ لما لا صلاحيّةَ عليه،
     و٤٠٩ لتضاربِ الحالة (ومنها ما يمسّ حسابَ الفاعل نفسِه). */
  const refuseRank = async (
    targetId: string, actorRoles: string[], verbAr: string,
  ): Promise<
    | { status: number; error: { code: string; message_ar: string } }
    | { target: { id: string; email: string; displayName: string; status: string; roles: { roleId: string }[] } }
  > => {
    const target = await prisma.user.findUnique({ where: { id: targetId }, include: { roles: true } })
    if (!target) return { status: 404, error: { code: 'not_found', message_ar: 'لا حسابَ بهذا المعرّف' } }
    /* مديرُ النظام الأعلى يدير كلَّ حسابٍ سوى حسابه (والذاتُ محروسةٌ قبل هذا):
       كان القيدُ «رتبتك أو فوقها» يمنعه من إيقاف مديرِ نظامٍ آخر أو حذفِ
       حسابِ ديمو بدوره — فلا أحدٌ فوقَ الأعلى يفكّه. */
    if (isTopAdmin(actorRoles)) return { target }
    const targetRank = rankOf(target.roles.map((r) => r.roleId))
    if (targetRank >= rankOf(actorRoles)) {
      return { status: 403, error: { code: 'rank_exceeded', message_ar: `لا تستطيع ${verbAr} حسابا في رتبتك أو فوقها` } }
    }
    return { target }
  }

  app.post('/api/admin/users/:id/suspend', { preHandler: guard, schema: { tags: ['admin-users'], summary: 'إيقاف حساب — يبطل جلساته فورا' } },
    async (req, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
      if (id === req.auth!.userId) {
        return reply.status(409).send({ error: { code: 'self_suspend', message_ar: 'استخدم إيقاف الحساب الذاتي من ملفك — لا توقف نفسك من هنا' } })
      }
      const check = await refuseRank(id, req.auth!.roles, 'إيقاف')
      if ('error' in check) return reply.status(check.status).send({ error: check.error })
      await auth.suspend(id)
      await recordAudit(prisma, {
        actorId: req.auth!.userId, action: 'admin.user.suspend', entityType: 'user', entityId: id,
        meta: { email: check.target.email },
      })
      return { ok: true }
    })

  /* الأرشفةُ قبل الحذف — وهي الفعلُ الموصى به لمن غادر */
  app.post('/api/admin/users/:id/archive', {
    preHandler: guard,
    schema: {
      tags: ['admin-users'], summary: 'أرشفةُ حساب — يُغلق وتُبطل جلساتُه وتبقى سجلّاتُه',
      body: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } },
    },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const { reason } = z.object({ reason: z.string().trim().min(10).max(500) }).parse(req.body)
    if (id === req.auth!.userId) {
      return reply.status(409).send({ error: { code: 'self_archive', message_ar: 'لا تؤرشف حسابك — استعمل إيقافَ الحساب الذاتيّ' } })
    }
    const check = await refuseRank(id, req.auth!.roles, 'أرشفةَ')
    if ('error' in check) return reply.status(check.status).send({ error: check.error })
    await auth.archive(id, req.auth!.userId, reason)
    /* السببُ في عمودِه `reason` لا في `meta`: الشاشةُ تقرأ «السببُ المكتوب»
       من العمود، والمرشّحاتُ تعمل عليه. وإلزامُ سببٍ ثمّ إخفاؤه في حمولةٍ
       لا تُعرض يُبطل الغرضَ من إلزامه. */
    await recordAudit(prisma, {
      actorId: req.auth!.userId, action: 'admin.user.archive', entityType: 'user', entityId: id,
      reason, meta: { email: check.target.email },
    })
    return { ok: true }
  })

  app.post('/api/admin/users/:id/unarchive', {
    preHandler: guard,
    schema: { tags: ['admin-users'], summary: 'إعادةُ تنشيطِ حسابٍ مؤرشَف' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const check = await refuseRank(id, req.auth!.roles, 'إعادةَ تنشيطِ')
    if ('error' in check) return reply.status(check.status).send({ error: check.error })
    await auth.unarchive(id)
    await recordAudit(prisma, {
      actorId: req.auth!.userId, action: 'admin.user.unarchive', entityType: 'user', entityId: id,
      meta: { email: check.target.email },
    })
    return { ok: true }
  })

  app.post('/api/admin/users/:id/reinstate', { preHandler: guard, schema: { tags: ['admin-users'], summary: 'رفعُ الإيقاف — يعيد الحساب نشطا' } },
    async (req, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
      const check = await refuseRank(id, req.auth!.roles, 'رفعَ الإيقاف عن')
      if ('error' in check) return reply.status(check.status).send({ error: check.error })
      if (check.target.status !== 'suspended') {
        return reply.status(409).send({ error: { code: 'not_suspended', message_ar: 'هذا الحساب ليس موقوفا' } })
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
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const { force } = z.object({ force: z.enum(['1', 'true']).optional() }).parse(req.query ?? {})
    const { reason } = z.object({ reason: z.string().trim().max(500).optional() }).parse(req.body ?? {})
    if (id === req.auth!.userId) {
      return reply.status(409).send({ error: { code: 'self_purge', message_ar: 'لا تحذف حسابك من هنا' } })
    }
    const check = await refuseRank(id, req.auth!.roles, 'حذفَ')
    if ('error' in check) return reply.status(check.status).send({ error: check.error })

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
        return reply.status(403).send({ error: { code: 'force_forbidden', message_ar: 'المحوُ بالسجلّ لمن يملك حبّته وحده — أوقف الحساب بدل ذلك' } })
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


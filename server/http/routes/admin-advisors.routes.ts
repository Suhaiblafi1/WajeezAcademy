/* المستشارون وسجلُّ الأثر — شاشتان تقرآن ما لم يكن له باب.

   الأولى: المستشارُ كان دورا على حسابٍ لا غير — تُسنَد إليه الحالات ولا موضعَ
   يُكتب فيه ما يستحقّه عليها. والثانية: كلُّ خدمةٍ في المنصّة تكتب في
   `AuditEvent`، ولا شاشةَ تقرؤه — فالسجلُّ يُكتب لأحدٍ لا يراه. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient, Prisma } from '@prisma/client'
import { requirePermission } from '../auth-plugin'
import { recordAudit } from '../../services/audit'

export function registerAdminAdvisorRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const canManage = requirePermission('advisor.manage')

  app.get('/api/admin/advisors', {
    preHandler: canManage,
    schema: { tags: ['admin-advisors'], summary: 'المستشارون: عمولةُ كلٍّ وحالاتُه المسندة' },
  }, async () => {
    const users = await prisma.user.findMany({
      where: { roles: { some: { roleId: 'advisor' } } },
      include: { advisorProfile: true },
      orderBy: { displayName: 'asc' },
    })
    /* عدُّ الحالات النشطة لكلٍّ في استعلامٍ واحد لا في حلقة */
    const counts = await prisma.advisorAssignment.groupBy({
      by: ['advisorId'],
      where: { unassignedAt: null, advisorId: { in: users.map((u) => u.id) } },
      _count: { _all: true },
    })
    const byAdvisor = new Map(counts.map((c) => [c.advisorId, c._count._all]))
    return users.map((u) => ({
      userId: u.id,
      displayName: u.displayName,
      email: u.email,
      status: u.status,
      /* «لم تُتّفق بعد» غيرُ «صفر»: الأولى تُنتظر والثانية قرار */
      commissionPct: u.advisorProfile ? Number(u.advisorProfile.commissionPct) : null,
      notesAr: u.advisorProfile?.notesAr ?? '',
      activeCases: byAdvisor.get(u.id) ?? 0,
    }))
  })

  /* ملفّ مستشارٍ واحد — ما لا تحمله قائمتُهم: عمولتُه المستحقّة فعلا من
     عملائه الذين دفعوا، وتقييمُ عملائه له، وسجلُّ طلباته على حالاته.

     قرارُ صاحب المنصّة: «مجموع العمولة المستحقة/المدفوعة، تقييمات الطلبة
     له، وسجل طلباته». والقائمةُ (فوق) عرضٌ سريع بلا هذا الحساب — فتحُ
     الملفّ هو ما يستحقّ استعلاماتِه الإضافية. */
  app.get('/api/admin/advisors/:userId', {
    preHandler: canManage,
    schema: { tags: ['admin-advisors'], summary: 'ملفّ مستشار: عمولتُه المستحقّة من عملائه الدافعين، تقييمُه، وطلباتُه' },
  }, async (req, reply) => {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.params)
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { roles: true, advisorProfile: true } })
    if (!user || !user.roles.some((r) => r.roleId === 'advisor')) {
      return reply.status(404).send({ error: { code: 'not_advisor', message_ar: 'لا مستشارَ بهذا المعرّف' } })
    }

    const assignments = await prisma.advisorAssignment.findMany({
      where: { advisorId: userId, unassignedAt: null },
      include: { case: { include: { client: { select: { id: true, displayName: true, email: true } }, lead: true } } },
      orderBy: { assignedAt: 'desc' },
    })
    const clientIds = [...new Set(
      assignments.map((a) => a.case.clientId).filter((id): id is string => Boolean(id)),
    )]

    /* لا تقييمٌ يُنسب لصاحبه ولا معدَّلٌ يُعرض تحت ثلاثة — نفس قاعدة تقييم المدرّب */
    const MIN_RATINGS_TO_SHOW = 3
    const [paidOrders, ratingAgg, requests] = await Promise.all([
      clientIds.length > 0
        ? prisma.order.findMany({ where: { userId: { in: clientIds }, status: 'paid' }, select: { total: true } })
        : Promise.resolve([]),
      prisma.rating.aggregate({
        where: { subjectType: 'advisor', subjectId: userId, publishStatus: 'approved' },
        _avg: { score: true }, _count: true,
      }),
      prisma.advisorRequest.findMany({ where: { advisorId: userId }, orderBy: { createdAt: 'desc' } }),
    ])

    const revenueFromReferrals = paidOrders.reduce((sum, o) => sum + Number(o.total), 0)
    /* لا عمولةَ بلا نسبةٍ مُتَّفَقٍ عليها صراحة — «لم تُحدَّد» تُحسب صفرا هنا،
       والقائمةُ تُميّزها بصريّا («لم تُتّفق بعد» لا «صفر بالمئة») */
    const commissionPct = user.advisorProfile ? Number(user.advisorProfile.commissionPct) : 0
    const commissionOwed = Math.round(revenueFromReferrals * commissionPct) / 100

    return {
      userId: user.id, displayName: user.displayName, email: user.email, status: user.status,
      commissionPct: user.advisorProfile ? Number(user.advisorProfile.commissionPct) : null,
      notesAr: user.advisorProfile?.notesAr ?? '',
      revenueFromReferrals, commissionOwed, currency: 'USD',
      ratingAvg: ratingAgg._count >= MIN_RATINGS_TO_SHOW ? Number(ratingAgg._avg.score) : null,
      ratingCount: ratingAgg._count,
      cases: assignments.map((a) => ({
        caseId: a.caseId, status: a.case.status,
        clientName: a.case.client?.displayName ?? a.case.lead?.fullName ?? 'بلا اسم',
        clientEmail: a.case.client?.email ?? a.case.lead?.email ?? null,
        assignedAt: a.assignedAt,
      })),
      requests: requests.map((r) => ({
        id: r.id, kind: r.kind, status: r.status, reasonAr: r.reasonAr,
        createdAt: r.createdAt, decidedAt: r.decidedAt,
      })),
    }
  })

  app.patch('/api/admin/advisors/:userId', {
    preHandler: canManage,
    schema: { tags: ['admin-advisors'], summary: 'تعيينُ نسبة عمولة المستشار وملاحظاتِه' },
  }, async (req) => {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      commissionPct: z.number().min(0).max(100),
      notesAr: z.string().max(2000).optional(),
    }).parse(req.body)

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { roles: true, advisorProfile: true } })
    if (!user) return { error: { code: 'not_found', message_ar: 'لا حسابَ بهذا المعرّف' } }
    if (!user.roles.some((r) => r.roleId === 'advisor')) {
      return { error: { code: 'not_advisor', message_ar: 'هذا الحساب ليس مستشارا — أسند الدورَ أوّلا من شاشة المستخدمين' } }
    }

    const before = user.advisorProfile ? Number(user.advisorProfile.commissionPct) : null
    const saved = await prisma.advisorProfile.upsert({
      where: { userId },
      update: { commissionPct: body.commissionPct, notesAr: body.notesAr ?? null },
      create: { userId, commissionPct: body.commissionPct, notesAr: body.notesAr ?? null },
    })
    /* النسبةُ بندٌ ماليّ: يُكتب من غيّرها ومن أيّ رقمٍ إلى أيّ رقم */
    await recordAudit(prisma, {
      actorId: req.auth!.userId, action: 'advisor.commission.set', entityType: 'user', entityId: userId,
      before: { commissionPct: before }, after: { commissionPct: Number(saved.commissionPct) },
    })
    return { ok: true, commissionPct: Number(saved.commissionPct) }
  })

  /* ─────────── سجلُّ الأثر الموحَّد ───────────

     الترقيمُ في الخادم لا في المتصفّح: هذا الجدولُ ينمو بلا سقفٍ مع كلّ فعلٍ
     يقع على المنصّة — فلا يُنقل كاملا لتُرشَّح صفوفُه في الصفحة. */
  app.get('/api/admin/audit', {
    preHandler: requirePermission('audit.view'),
    schema: { tags: ['admin-audit'], summary: 'سجلُّ الأثر — من فعل ماذا ومتى، مرشَّحا ومرقَّما' },
  }, async (req) => {
    const qs = z.object({
      action: z.string().optional(),
      entityType: z.string().optional(),
      actorId: z.string().uuid().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    }).parse(req.query)

    const where: Prisma.AuditEventWhereInput = {}
    if (qs.action) where.action = { contains: qs.action }
    if (qs.entityType) where.entityType = qs.entityType
    if (qs.actorId) where.actorId = qs.actorId
    if (qs.from || qs.to) {
      where.createdAt = {}
      if (qs.from) where.createdAt.gte = new Date(qs.from)
      /* «إلى» يومٌ كامل لا لحظتُه: من رشّح بيومٍ يريد ما وقع فيه كلَّه */
      if (qs.to) where.createdAt.lte = new Date(`${qs.to}T23:59:59.999Z`)
    }

    const [total, rows, actions, entityTypes] = await Promise.all([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where, orderBy: { createdAt: 'desc' },
        skip: (qs.page - 1) * qs.pageSize, take: qs.pageSize,
      }),
      prisma.auditEvent.groupBy({ by: ['action'], _count: { _all: true }, orderBy: { _count: { action: 'desc' } }, take: 60 }),
      prisma.auditEvent.groupBy({ by: ['entityType'], _count: { _all: true } }),
    ])

    /* أسماءُ الفاعلين في استعلامٍ واحد — لا نداءٌ لكلّ صفّ */
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => Boolean(x)))]
    const actors = actorIds.length === 0 ? [] : await prisma.user.findMany({
      where: { id: { in: actorIds } }, select: { id: true, displayName: true, email: true },
    })
    const byId = new Map(actors.map((a) => [a.id, a]))

    return {
      total, page: qs.page, pageSize: qs.pageSize,
      pages: Math.max(1, Math.ceil(total / qs.pageSize)),
      /* الفاعلُ المحذوفُ حسابُه لا يُخفى: يُقال «حسابٌ محذوف» لا يُترك فارغا */
      rows: rows.map((r) => ({
        id: r.id, action: r.action, entityType: r.entityType, entityId: r.entityId,
        createdAt: r.createdAt, reason: r.reason, ip: r.ip,
        actor: r.actorId ? (byId.get(r.actorId) ?? { id: r.actorId, displayName: 'حسابٌ محذوف', email: '' }) : null,
        meta: r.meta, before: r.before, after: r.after,
      })),
      facets: {
        actions: actions.map((a) => ({ value: a.action, count: a._count._all })),
        entityTypes: entityTypes.map((e) => ({ value: e.entityType, count: e._count._all })),
      },
    }
  })
}

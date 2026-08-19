/* بحث الإدارة الشامل (Cmd+K) — نقطة واحدة تجمع كل الكيانات.
   كل مجموعة نتائج تُرشَّح بصلاحيتها الخاصة: من لا يملك صلاحية مجموعة لا تظهر له أصلاً —
   البحث لا يوسّع صلاحيات أحد، بل يسرّع وصوله لما يملك أصلاً. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requireAuth, requirePermission } from '../auth-plugin'

export function registerSearchRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get('/api/admin/search', {
    preHandler: requireAuth,
    schema: { tags: ['admin-search'], summary: 'بحث شامل — كل مجموعة بصلاحيتها' },
  }, async (req) => {
    const { q } = z.object({ q: z.string().min(1).max(80) }).parse(req.query)
    const perms = req.auth?.permissions ?? []
    const can = (p: string) => perms.includes(p)
    const like = { contains: q, mode: 'insensitive' as const }
    const take = 5

    const [applications, users, cohorts, courses, tickets, payouts] = await Promise.all([
      can('trainer.applications.view')
        ? prisma.trainerApplication.findMany({
            where: { OR: [{ fullName: like }, { email: like }, { reference: like }] },
            select: { id: true, fullName: true, reference: true, status: true }, take,
          }) : [],
      can('admin.users.manage')
        ? prisma.user.findMany({
            where: { OR: [{ displayName: like }, { email: like }] },
            select: { id: true, displayName: true, email: true, status: true }, take,
          }) : [],
      can('cohort.manage')
        ? prisma.cohort.findMany({
            where: { title: like },
            select: { id: true, title: true, status: true }, take,
          }) : [],
      can('catalog.view')
        ? prisma.courseVersion.findMany({
            where: { titleAr: like },
            select: { courseId: true, titleAr: true, status: true },
            orderBy: { version: 'desc' }, take,
          }) : [],
      can('support.operate')
        ? prisma.supportTicket.findMany({
            where: { subject: like },
            select: { id: true, subject: true, status: true }, take,
          }) : [],
      can('trainer.compensation.manage')
        ? prisma.trainerPayout.findMany({
            where: { OR: [{ period: like }, { profile: { application: { fullName: like } } }] },
            select: { id: true, period: true, status: true, total: true, currency: true,
              profile: { select: { application: { select: { fullName: true } } } } }, take,
          }) : [],
    ])

    return {
      q,
      groups: {
        applications: applications.map((a) => ({
          id: a.id, title: a.fullName, sub: `${a.reference} · ${a.status}`, to: '/admin/trainers',
        })),
        users: users.map((u) => ({
          id: u.id, title: u.displayName, sub: u.email, to: '/admin/users',
        })),
        cohorts: cohorts.map((c) => ({
          id: c.id, title: c.title, sub: `شعبة · ${c.status}`, to: '/admin/cohorts',
        })),
        courses: courses.map((c) => ({
          id: c.courseId, title: c.titleAr, sub: `دورة · ${c.status}`, to: '/admin/catalog',
        })),
        tickets: tickets.map((t) => ({
          id: t.id, title: t.subject, sub: `تذكرة · ${t.status}`, to: '/admin/support',
        })),
        payouts: payouts.map((p) => ({
          id: p.id, title: `${p.profile.application?.fullName ?? 'مدرب'} — ${p.period}`,
          sub: `كشف · ${p.status} · ${Number(p.total)} ${p.currency}`, to: '/admin/trainers',
        })),
      },
    }
  })

  /* بحث المدرب (Ctrl+K) — شعبي وطلابي فقط: لا يرى المدرب شيئا خارج إسناداته */
  app.get('/api/trainer/search', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'بحث المدرب — شعبه وطلابه المسندون فقط' },
  }, async (req) => {
    const { q } = z.object({ q: z.string().min(1).max(80) }).parse(req.query)
    const like = { contains: q, mode: 'insensitive' as const }
    const profile = await prisma.trainerProfile.findUnique({ where: { userId: req.auth!.userId } })
    if (!profile) return { q, groups: { cohorts: [], students: [] } }
    const myCohortIds = (await prisma.cohortTrainer.findMany({
      where: { profileId: profile.id }, select: { cohortId: true },
    })).map((c) => c.cohortId)

    const [cohorts, students] = await Promise.all([
      prisma.cohort.findMany({
        where: { id: { in: myCohortIds }, title: like },
        select: { id: true, title: true, status: true }, take: 5,
      }),
      prisma.enrollment.findMany({
        where: { cohortId: { in: myCohortIds }, user: { OR: [{ displayName: like }, { email: like }] } },
        select: { id: true, status: true, user: { select: { displayName: true } }, cohort: { select: { title: true } } },
        take: 5,
      }),
    ])

    return {
      q,
      groups: {
        cohorts: cohorts.map((c) => ({
          id: c.id, title: c.title, sub: `شعبة · ${c.status}`, to: '/trainer/board',
        })),
        students: students.map((e) => ({
          id: e.id, title: e.user.displayName, sub: `${e.cohort.title} · ${e.status}`, to: '/trainer/board',
        })),
      },
    }
  })

  /* بحث المستشار (Ctrl+K) — حالاته المسندة فقط: البحث لا يتجاوز نطاق الإسناد */
  app.get('/api/advisor/search', {
    preHandler: requirePermission('advisor.cases.view'),
    schema: { tags: ['advisor-portal'], summary: 'بحث المستشار — حالاته المسندة فقط' },
  }, async (req) => {
    const { q } = z.object({ q: z.string().min(1).max(80) }).parse(req.query)
    const like = { contains: q, mode: 'insensitive' as const }
    const cases = await prisma.advisorCase.findMany({
      where: {
        assignments: { some: { advisorId: req.auth!.userId, unassignedAt: null } },
        OR: [{ lead: { fullName: like } }, { client: { displayName: like } }, { client: { email: like } }],
      },
      select: {
        id: true, status: true, nextAction: true,
        lead: { select: { fullName: true } }, client: { select: { displayName: true } },
      },
      take: 8,
    })

    return {
      q,
      groups: {
        cases: cases.map((c) => ({
          id: c.id,
          title: c.lead?.fullName ?? c.client?.displayName ?? 'عميل بلا اسم',
          sub: `حالة · ${c.status}${c.nextAction ? ` · ${c.nextAction}` : ''}`,
          to: '/advisor/cases',
        })),
      },
    }
  })
}

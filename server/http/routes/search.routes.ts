/* بحث الإدارة الشامل (Cmd+K) — نقطة واحدة تجمع كل الكيانات.
   كل مجموعة نتائج تُرشَّح بصلاحيتها الخاصة: من لا يملك صلاحية مجموعة لا تظهر له أصلاً —
   البحث لا يوسّع صلاحيات أحد، بل يسرّع وصوله لما يملك أصلاً. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requireAuth } from '../auth-plugin'

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
}

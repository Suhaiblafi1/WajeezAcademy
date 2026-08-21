/* مسارات الكتالوج — العامة (لقطة فعالة للمحرك) والإدارية (مسودات + طلبات تغيير) */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { getActiveSnapshot } from '../../catalog/snapshot-builder'
import { CatalogAdminService } from '../../services/catalog-admin.service'
import { validateChecks } from '../../../src/application/content/module-checks'
import { validateVideo } from '../../../src/application/content/module-video'
import { requirePermission } from '../auth-plugin'

export function registerCatalogRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const admin = new CatalogAdminService(prisma)

  /* عام — اللقطة المنشورة الفعالة التي يقرأها محرك التشخيص */
  app.get('/api/catalog/active-snapshot', {
    schema: { tags: ['catalog'], summary: 'اللقطة المنشورة الفعالة — يستهلكها محرك التشخيص في الواجهة' },
  }, async (_req, reply) => {
    const snap = await getActiveSnapshot(prisma)
    if (!snap) {
      return reply.status(404).send({ error: { code: 'no_snapshot', message_ar: 'لا لقطة منشورة بعد — الواجهة تستخدم الحزمة المضمنة' } })
    }
    return snap
  })

  /* ── إدارة الكتالوج ── */
  app.get('/api/admin/catalog/overview', { preHandler: requirePermission('catalog.view'), schema: { tags: ['admin-catalog'], summary: 'عدادات حالات الكيانات وطلبات التغيير' } },
    () => admin.overview())

  app.get('/api/admin/catalog/pathways', { preHandler: requirePermission('catalog.view'), schema: { tags: ['admin-catalog'], summary: 'كل المسارات وحالاتها' } },
    () => admin.listPathways())
  app.get('/api/admin/catalog/courses', { preHandler: requirePermission('catalog.view'), schema: { tags: ['admin-catalog'], summary: 'كل الدورات وحالاتها' } },
    () => admin.listCourses())
  app.get('/api/admin/catalog/skills', { preHandler: requirePermission('catalog.view'), schema: { tags: ['admin-catalog'], summary: 'كل المهارات وحالاتها' } },
    () => admin.listSkills())
  app.get('/api/admin/catalog/templates', { preHandler: requirePermission('catalog.view'), schema: { tags: ['admin-catalog'], summary: 'كل قوالب التوصية المركبة' } },
    () => admin.listTemplates())
  app.get('/api/admin/catalog/questions', { preHandler: requirePermission('catalog.view'), schema: { tags: ['admin-catalog'], summary: 'بنك الأسئلة وحالاته' } },
    () => admin.listQuestions())

  app.post('/api/admin/catalog/skills', {
    preHandler: requirePermission('catalog.skill.edit'),
    schema: {
      tags: ['admin-catalog'], summary: 'إنشاء مهارة كمسودة',
      body: {
        type: 'object', required: ['id', 'slug', 'nameAr'],
        properties: { id: { type: 'string' }, slug: { type: 'string' }, nameAr: { type: 'string' }, familyId: { type: 'string' } },
      },
    },
  }, async (req, reply) => {
    const body = z.object({
      id: z.string(), slug: z.string().regex(/^[a-z0-9_]+$/), nameAr: z.string().min(2), familyId: z.string().optional(),
    }).parse(req.body)
    const skill = await admin.createSkill(body, req.auth!.userId)
    return reply.status(201).send({ id: skill.id, status: skill.status })
  })

  app.post('/api/admin/catalog/courses', {
    preHandler: requirePermission('catalog.course.create'),
    schema: { tags: ['admin-catalog'], summary: 'إنشاء دورة كمسودة مع وحداتها ومهاراتها' },
  }, async (req, reply) => {
    const body = z.object({
      id: z.string(), pathwayId: z.string(), sequence: z.number().int().min(1),
      titleAr: z.string().min(3), shortPromiseAr: z.string().optional(), levelAr: z.string().optional(),
      totalHours: z.number().int().min(1), skillIds: z.array(z.string()).default([]),
      modules: z.array(z.object({
        sequence: z.number().int().min(1), titleAr: z.string().min(3),
        outcomeAr: z.string().optional(), activityAr: z.string().optional(), artifactAr: z.string().optional(),
        /* متن الدرس (ح-١) — Markdown مقيّد، بحدّ أعلى يمنع حمولة غير معقولة */
        bodyAr: z.string().max(40_000).optional(),
        /* تمرين الاسترجاع (ح-٣) — يُتحقَّق من صيغته هنا لا عند العرض:
           تمرين لا يُفهم يُرفض عند الحفظ بخطأ عربي مقروء، فلا يصل للمتعلم صامتا */
        checksAr: z.string().max(8_000).optional().superRefine((v, ctx) => {
          if (!v || !v.trim()) return
          const r = validateChecks(v)
          if (!r.ok) {
            ctx.addIssue({
              code: 'custom',
              message: `تمرين الاسترجاع غير مفهوم: ${r.errorsAr.join(' · ')}`,
            })
          }
        }),
        /* فيديو الوحدة (ح-٢) — المضيف بقائمة بيضاء والفصول بصيغة «د:ث عنوان» */
        videoAr: z.string().max(4_000).optional().superRefine((v, ctx) => {
          if (!v || !v.trim()) return
          const r = validateVideo(v)
          if (!r.ok) ctx.addIssue({ code: 'custom', message: `فيديو الوحدة غير مقبول: ${r.errorsAr.join(' · ')}` })
        }),
        hours: z.number().int().min(1),
      })).min(1),
    }).parse(req.body)
    const course = await admin.createCourse(body, req.auth!.userId)
    return reply.status(201).send({ id: course.id, status: course.status })
  })

  app.post('/api/admin/catalog/pathways', {
    preHandler: requirePermission('catalog.pathway.create'),
    schema: { tags: ['admin-catalog'], summary: 'إنشاء مسار كمسودة مرتبط بدورات موجودة' },
  }, async (req, reply) => {
    const body = z.object({
      id: z.string(), title: z.string().min(3), shortTitle: z.string().optional(), audience: z.string().optional(),
      beforeText: z.string().optional(), afterText: z.string().optional(),
      durationWeeks: z.number().int().optional(), weeklyHours: z.string().optional(), level: z.string().optional(),
      capstone: z.string().optional(), courseIds: z.array(z.string()).min(1),
    }).parse(req.body)
    const pathway = await admin.createPathway(body, req.auth!.userId)
    return reply.status(201).send({ id: pathway.id, status: pathway.status })
  })

  /* طلبات التغيير — maker-checker */
  app.get('/api/admin/catalog/change-requests', { preHandler: requirePermission('catalog.view'), schema: { tags: ['admin-catalog'], summary: 'طلبات التغيير وقراراتها' } },
    async (req) => {
      const { status } = z.object({ status: z.string().optional() }).parse(req.query)
      return admin.listChangeRequests(status)
    })

  app.post('/api/admin/catalog/change-requests', {
    preHandler: requirePermission('catalog.view'),
    schema: { tags: ['admin-catalog'], summary: 'تقديم طلب تغيير (maker) — لا يطبق شيء قبل الاعتماد' },
  }, async (req, reply) => {
    const body = z.object({
      entityType: z.enum(['pathway', 'course', 'skill', 'question', 'template']),
      entityId: z.string(), payload: z.record(z.string(), z.unknown()).default({}),
    }).parse(req.body)
    const cr = await admin.submitChangeRequest(body.entityType, body.entityId, body.payload, req.auth!.userId)
    return reply.status(201).send(cr)
  })

  app.post('/api/admin/catalog/change-requests/:id/decision', {
    preHandler: requirePermission('catalog.pathway.review'),
    schema: { tags: ['admin-catalog'], summary: 'قرار مراجعة (checker) — ممنوع اعتماد الذات' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      decision: z.enum(['approve', 'request_changes', 'reject']), noteAr: z.string().optional(),
    }).parse(req.body)
    return admin.decide(id, body.decision, body.noteAr, req.auth!.userId)
  })
}

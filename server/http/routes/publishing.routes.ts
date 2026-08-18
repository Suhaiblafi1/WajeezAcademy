/* مسارات النشر والجودة — إصدارات، تحقق، تحليل أثر، نشر ذري، رجوع، سجلات */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { PublishingService } from '../../services/publishing.service'
import { analyzeImpact, runRegressionAgainstBundled } from '../../services/impact.service'
import { requirePermission } from '../auth-plugin'

export function registerPublishingRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const pub = new PublishingService(prisma)

  app.get('/api/admin/publishing/versions', { preHandler: requirePermission('catalog.impact.view'), schema: { tags: ['publishing'], summary: 'إصدارات الكتالوج ولقطاتها وأحداثها' } },
    () => pub.listVersions())

  app.post('/api/admin/publishing/versions', {
    preHandler: requirePermission('catalog.pathway.publish'),
    schema: {
      tags: ['publishing'], summary: 'إنشاء إصدار مسودة جديد',
      body: { type: 'object', required: ['label'], properties: { label: { type: 'string' } } },
    },
  }, async (req, reply) => {
    const { label } = z.object({ label: z.string() }).parse(req.body)
    const v = await pub.createDraftVersion(label, req.auth!.userId)
    return reply.status(201).send(v)
  })

  app.post('/api/admin/publishing/validate', { preHandler: requirePermission('catalog.impact.view'), schema: { tags: ['publishing'], summary: 'تحقق بنيوي من الكيانات المعتمدة قبل النشر' } },
    () => pub.validateDrafts())

  app.post('/api/admin/publishing/impact', {
    preHandler: requirePermission('catalog.impact.view'),
    schema: { tags: ['publishing'], summary: 'تحليل أثر: 12 شخصية على المنشور مقابل المرشح' },
  }, async (req) => {
    const { changeRef } = z.object({ changeRef: z.string().default('تحليل يدوي') }).parse(req.body ?? {})
    return analyzeImpact(prisma, changeRef, req.auth!.userId)
  })

  app.post('/api/admin/publishing/versions/:id/publish', {
    preHandler: requirePermission('catalog.pathway.publish'),
    schema: { tags: ['publishing'], summary: 'نشر ذري — يرفض عند أي نقص، بلا نشر جزئي' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return pub.publish(id, req.auth!.userId)
  })

  app.post('/api/admin/publishing/rollback', {
    preHandler: requirePermission('catalog.rollback'),
    schema: {
      tags: ['publishing'], summary: 'الرجوع إلى لقطة إصدار سابق كنشر جديد — بلا أثر رجعي',
      body: {
        type: 'object', required: ['targetVersionId'],
        properties: { targetVersionId: { type: 'string' }, reasonAr: { type: 'string' } },
      },
    },
  }, async (req) => {
    const body = z.object({ targetVersionId: z.string().uuid(), reasonAr: z.string().optional() }).parse(req.body)
    return pub.rollback(body.targetVersionId, req.auth!.userId, body.reasonAr)
  })

  /* ── الجودة والمحاكي ── */
  app.get('/api/admin/quality/regression-runs', { preHandler: requirePermission('diagnostic.simulate'), schema: { tags: ['quality'], summary: 'سجل تشغيلات اختبار الارتداد' } },
    () => prisma.diagnosticRegressionRun.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }))

  app.get('/api/admin/quality/impact-runs', { preHandler: requirePermission('diagnostic.simulate'), schema: { tags: ['quality'], summary: 'سجل تحليلات الأثر' } },
    () => prisma.impactAnalysisRun.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }))

  app.post('/api/admin/quality/simulate', { preHandler: requirePermission('diagnostic.simulate'), schema: { tags: ['quality'], summary: 'محاكاة الشخصيات الـ12 على اللقطة المنشورة ومقارنتها بالمضمن' } },
    async () => {
      const active = await prisma.catalogVersion.findFirst({ where: { status: 'published' } })
      return runRegressionAgainstBundled(prisma, active?.id)
    })
}

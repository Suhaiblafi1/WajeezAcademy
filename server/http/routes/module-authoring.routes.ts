/* مسارات تأليف متن الوحدة — الكتابةُ ثم المراجعةُ ثم النشر.

   لا حبّةَ صلاحيّةٍ جديدة: الكتابةُ `catalog.course.edit` والقرارُ
   `catalog.course.publish`، وكلتاهما بيد المدير الأكاديميّ أصلا. وإضافةُ
   مفتاحٍ جديدٍ لكلِّ شاشةٍ تُبنى تُضخّم الجدول بلا أن تزيد ضبطا.

   والفصلُ بين الحبّتين هو ما يجعل التفويض ممكنا: يستطيع المديرُ الأكاديميّ
   أن يمنح كاتبا `catalog.course.edit` وحدها — فيكتب ولا ينشر. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requirePermission } from '../auth-plugin'
import { ModuleAuthoringService } from '../../services/module-authoring.service'

const contentSchema = z.object({
  bodyAr: z.string().nullish(),
  checksAr: z.string().nullish(),
  videoAr: z.string().nullish(),
  scenarioAr: z.string().nullish(),
})

const decisionSchema = z.object({
  decision: z.enum(['publish', 'request_changes']),
  noteAr: z.string().optional(),
})

export function registerModuleAuthoringRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const svc = new ModuleAuthoringService(prisma)
  const canWrite = requirePermission('catalog.course.edit')
  const canDecide = requirePermission('catalog.course.publish')

  app.get('/api/admin/authoring/worklist', {
    preHandler: canWrite,
    schema: { tags: ['authoring'], summary: 'طابور التأليف — الوحدات وحالة متونها' },
  }, async (req) => {
    const q = req.query as { missing?: string; limit?: string }
    return svc.worklist({
      onlyMissing: q.missing === '1' || q.missing === 'true',
      limit: q.limit ? Number(q.limit) : undefined,
    })
  })

  app.get('/api/admin/authoring/review-queue', {
    preHandler: canDecide,
    schema: { tags: ['authoring'], summary: 'ما رُفع وينتظر قرارا' },
  }, async () => svc.pendingReview())

  app.get('/api/admin/authoring/:moduleId', {
    preHandler: canWrite,
    schema: { tags: ['authoring'], summary: 'سجلّ إصدارات الوحدة ومسوّدتها الجارية' },
  }, async (req) => {
    const { moduleId } = req.params as { moduleId: string }
    return { moduleId, history: await svc.history(moduleId) }
  })

  app.post('/api/admin/authoring/:moduleId/draft', {
    preHandler: canWrite,
    schema: { tags: ['authoring'], summary: 'يفتح المسوّدة — أو يعيد المفتوحة' },
  }, async (req) => {
    const { moduleId } = req.params as { moduleId: string }
    const v = await svc.openDraft(moduleId, req.auth!.userId)
    return { version: v.version, status: v.status, bodyAr: v.bodyAr, checksAr: v.checksAr, videoAr: v.videoAr, scenarioAr: v.scenarioAr }
  })

  app.put('/api/admin/authoring/:moduleId/draft', {
    preHandler: canWrite,
    schema: { tags: ['authoring'], summary: 'يحفظ في المسوّدة بعد التحقّق من الصيغة' },
  }, async (req) => {
    const { moduleId } = req.params as { moduleId: string }
    const body = contentSchema.parse(req.body)
    const v = await svc.save(moduleId, body, req.auth!.userId)
    return { version: v.version, status: v.status }
  })

  app.post('/api/admin/authoring/:moduleId/submit', {
    preHandler: canWrite,
    schema: { tags: ['authoring'], summary: 'يرفع المسوّدة للمراجعة' },
  }, async (req) => {
    const { moduleId } = req.params as { moduleId: string }
    const v = await svc.submit(moduleId, req.auth!.userId)
    return { version: v.version, status: v.status }
  })

  app.post('/api/admin/authoring/:moduleId/withdraw', {
    preHandler: canWrite,
    schema: { tags: ['authoring'], summary: 'يسحبها من المراجعة ليعدّلها كاتبُها' },
  }, async (req) => {
    const { moduleId } = req.params as { moduleId: string }
    const v = await svc.withdraw(moduleId, req.auth!.userId)
    return { version: v.version, status: v.status }
  })

  app.post('/api/admin/authoring/:moduleId/review', {
    preHandler: canDecide,
    schema: { tags: ['authoring'], summary: 'قرارُ المراجع — ولا يعتمد أحدٌ ما كتبه' },
  }, async (req) => {
    const { moduleId } = req.params as { moduleId: string }
    const body = decisionSchema.parse(req.body)
    const v = await svc.review(moduleId, body, req.auth!.userId)
    return { version: v.version, status: v.status }
  })
}

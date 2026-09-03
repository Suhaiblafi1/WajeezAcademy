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
  practiceAr: z.string().nullish(),
  rubricAr: z.string().nullish(),
})

const academicSchema = z.object({
  decision: z.enum(['approve', 'request_changes']),
  noteAr: z.string().optional(),
})

const finalSchema = z.object({
  decision: z.enum(['publish', 'return_to_academic']),
  noteAr: z.string().optional(),
})

export function registerModuleAuthoringRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const svc = new ModuleAuthoringService(prisma)
  const canWrite = requirePermission('catalog.course.edit')
  /* حلقتان لا واحدة: الاعتمادُ الأكاديميّ بصلاحية النشر (يملكها المدير
     الأكاديميّ)، والموافقةُ النهائية بحبّةٍ لا يملكها إلّا السوبر. */
  const canDecide = requirePermission('catalog.course.publish')
  const canFinalApprove = requirePermission('catalog.content.final_approve')

  app.get('/api/admin/authoring/worklist', {
    preHandler: canWrite,
    schema: { tags: ['authoring'], summary: 'طابور التأليف — الوحدات وحالة متونها' },
  }, async (req) => {
    const q = req.query as { body?: string; courseId?: string; missing?: string; limit?: string }
    /* `missing=1` تبقى مقبولةً: روابطُ محفوظةٌ ومفضّلاتٌ لا تُكسر بتغيير اسم مرشِّح */
    const body = q.body === 'missing' || q.body === 'written' || q.body === 'all'
      ? q.body
      : (q.missing === '1' || q.missing === 'true') ? 'missing' : 'all'
    return svc.worklist({
      body,
      courseId: q.courseId || undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    })
  })

  app.get('/api/admin/authoring/review-queue', {
    preHandler: canDecide,
    schema: { tags: ['authoring'], summary: 'ما رُفع وينتظر الاعتماد الأكاديميّ' },
  }, async () => svc.pendingReview('academic'))

  app.get('/api/admin/authoring/final-queue', {
    preHandler: canFinalApprove,
    schema: { tags: ['authoring'], summary: 'ما اعتُمد أكاديميّا وينتظر الموافقة النهائية' },
  }, async () => svc.pendingReview('final'))

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
    return {
      version: v.version, status: v.status, bodyAr: v.bodyAr, checksAr: v.checksAr,
      videoAr: v.videoAr, scenarioAr: v.scenarioAr, practiceAr: v.practiceAr, rubricAr: v.rubricAr,
    }
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
    schema: { tags: ['authoring'], summary: 'الاعتماد الأكاديميّ — يرفعه للموافقة النهائية أو يعيده للكاتب بملاحظة' },
  }, async (req) => {
    const { moduleId } = req.params as { moduleId: string }
    const body = academicSchema.parse(req.body)
    const v = await svc.reviewAcademic(moduleId, body, req.auth!.userId)
    return { version: v.version, status: v.status }
  })

  app.post('/api/admin/authoring/:moduleId/final', {
    preHandler: canFinalApprove,
    schema: { tags: ['authoring'], summary: 'الموافقة النهائية — نشرٌ أو إعادةٌ إلى المدير الأكاديميّ بملاحظة' },
  }, async (req) => {
    const { moduleId } = req.params as { moduleId: string }
    const body = finalSchema.parse(req.body)
    const v = await svc.reviewFinal(moduleId, body, req.auth!.userId)
    return { version: v.version, status: v.status }
  })
}

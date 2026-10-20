/* «منحة أعضاء وجيز» — بابُ صاحب المنصّة إلى إعداداتها (٢٠ أكتوبر ٢٠٢٦). والعلّةُ في `grant.service.ts`.

   بصلاحيّة الكوبونات (`commerce.manage`): المنحةُ كوبونٌ بحملة، ومن يُصدر الكوبونات يملك نسبتَها
   وعددَها ونهايتَها وتشغيلَها. وفحصُ الهامش يُقرأ بالنسبة المحفوظة أو بنسبةٍ تُجرَّب قبل الحفظ. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requirePermission } from '../auth-plugin'
import { GrantService } from '../../services/grant.service'
import { GrantPathwayService } from '../../services/grant-pathway.service'
import { grantResults } from '../../services/grant-landing.service'

export function registerAdminGrantRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const grants = new GrantService(prisma)
  const pathways = new GrantPathwayService(prisma)
  const canManage = requirePermission('commerce.manage')

  app.get('/api/admin/member-grant', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'إعدادات منحة أعضاء وجيز وما جرى بها' },
  }, async () => grants.settings())

  app.put('/api/admin/member-grant', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'تغيير نسبة المنحة أو عددها أو نهايتها أو تشغيلها' },
  }, async (req) => {
    const body = z.object({
      percentOff: z.number().int().min(1).max(100).optional(),
      maxCodes: z.number().int().min(1).nullable().optional(),
      maxCourses: z.number().int().min(1).max(20).optional(),
      closesAt: z.coerce.date().nullable().optional(),
      active: z.boolean().optional(),
    }).parse(req.body ?? {})
    return grants.update(body, req.auth!.userId)
  })

  app.get('/api/admin/member-grant/margins', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'سعر كل شعبة مفتوحة بعد المنحة مقابل أجر مقعدها' },
  }, async (req) => {
    const { percentOff } = z.object({ percentOff: z.coerce.number().int().min(1).max(100).optional() }).parse(req.query)
    return grants.margins(percentOff)
  })

  app.get('/api/admin/member-grant/results', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'نتائج الحملة: من عبأ ومن أخذ كودا ومن اشترى، بالقناة والدفعة ومجال العمل' },
  }, async () => grantResults(prisma))

  /* ═══ مساراتُ المنحة — يُعدّها صاحبُ المنصّة من هنا (`grant-pathway.service.ts`) ═══ */
  const pathwayBody = z.object({
    titleAr: z.string().trim().min(3).max(120),
    blurbAr: z.string().trim().max(300).nullable().optional(),
    courseIds: z.array(z.string().min(1)).min(1).max(20),
    sortOrder: z.number().int().optional(),
    active: z.boolean().optional(),
  })

  app.get('/api/admin/member-grant/pathways', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'مسارات المنحة بدوراتها وهامش كل مسار' },
  }, async (req) => {
    const { percentOff } = z.object({ percentOff: z.coerce.number().int().min(1).max(100).optional() }).parse(req.query)
    return pathways.list({ percentOff })
  })

  app.get('/api/admin/member-grant/open-courses', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'الدورات التي لها شعبة تشترى اليوم — منها تختار دورات المسار' },
  }, async () => pathways.openCourses())

  app.post('/api/admin/member-grant/pathways', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'مسار منحة جديد' },
  }, async (req, reply) => reply.status(201).send(await pathways.save(null, pathwayBody.parse(req.body), req.auth!.userId)))

  app.put('/api/admin/member-grant/pathways/:id', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'تعديل مسار منحة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return pathways.save(id, pathwayBody.parse(req.body), req.auth!.userId)
  })

  app.delete('/api/admin/member-grant/pathways/:id', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'حذف مسار منحة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    await pathways.remove(id, req.auth!.userId)
    return { ok: true }
  })
}

/* «منحة أعضاء وجيز» — بابُ صاحب المنصّة إلى إعداداتها (٢٠ أكتوبر ٢٠٢٦). والعلّةُ في `grant.service.ts`.

   بصلاحيّة الكوبونات (`commerce.manage`): المنحةُ كوبونٌ بحملة، ومن يُصدر الكوبونات يملك نسبتَها
   وعددَها ونهايتَها وتشغيلَها. وفحصُ الهامش يُقرأ بالنسبة المحفوظة أو بنسبةٍ تُجرَّب قبل الحفظ. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requirePermission } from '../auth-plugin'
import { GrantService } from '../../services/grant.service'
import { GrantCoursesService } from '../../services/grant-courses.service'
import { grantResults } from '../../services/grant-landing.service'
import { grantRegistrants } from '../../services/grant-followup.service'

export function registerAdminGrantRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const grants = new GrantService(prisma)
  const courses = new GrantCoursesService(prisma)
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

  app.get('/api/admin/member-grant/registrants', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'من عبأ نموذج المنحة: بياناته وما فعل ومستشاره' },
  }, async () => grantRegistrants(prisma))

  /* ═══ دوراتُ المنحة — ما يختار منه صاحبُ المنحة (`grant-courses.service.ts`) ═══ */
  app.get('/api/admin/member-grant/open-courses', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'دورات المنحة: ما له شعبة تشترى في الفصل القادم القريب، وفصله' },
  }, async () => courses.openCourses())
}

/* «منحة أعضاء وجيز» — بابُ صاحب المنصّة إلى إعداداتها (٢٠ أكتوبر ٢٠٢٦). والعلّةُ في `grant.service.ts`.

   بصلاحيّة الكوبونات (`commerce.manage`): المنحةُ كوبونٌ بحملة، ومن يُصدر الكوبونات يملك نسبتَها
   وعددَها ونهايتَها وتشغيلَها. وفحصُ الهامش يُقرأ بالنسبة المحفوظة أو بنسبةٍ تُجرَّب قبل الحفظ. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requirePermission } from '../auth-plugin'
import { GrantService } from '../../services/grant.service'
import { GrantCoursesService } from '../../services/grant-courses.service'
import { eraseRegistrant, messageRegistrants, registrantsFull, registrantsXlsx, setRegistrantWhatsapp } from '../../services/grant-registrants.service'
import { GRANT_MESSAGE_BODY_MAX, GRANT_MESSAGE_MAX_TO, GRANT_MESSAGE_SUBJECT_MAX } from '../../../src/application/commerce/grant-registrants'
import { zonedDay } from '../../../src/application/trainer/cohort-period'
import { signedUpXlsx } from '../../services/signed-up-export'
import { OPEN_GRANT_SLUG } from '../../../src/application/commerce/grant'

const settingsBody = z.object({
  percentOff: z.number().int().min(1).max(100).optional(),
  maxCodes: z.number().int().min(1).nullable().optional(),
  maxCourses: z.number().int().min(1).max(20).optional(),
  closesAt: z.coerce.date().nullable().optional(),
  active: z.boolean().optional(),
})

export function registerAdminGrantRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const grants = new GrantService(prisma)
  const courses = new GrantCoursesService(prisma)
  const canManage = requirePermission('commerce.manage')

  app.get('/api/admin/member-grant', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'إعدادات منحة وجيز وما جرى بها' },
  }, async () => grants.settings())

  app.put('/api/admin/member-grant', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'تغيير نسبة المنحة أو عددها أو نهايتها أو تشغيلها' },
  }, async (req) => {
    const body = settingsBody.parse(req.body ?? {})
    return grants.update(body, req.auth!.userId)
  })

  app.get('/api/admin/member-grant/margins', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'سعر كل شعبة مفتوحة بعد المنحة مقابل أجر مقعدها' },
  }, async (req) => {
    const { percentOff } = z.object({ percentOff: z.coerce.number().int().min(1).max(100).optional() }).parse(req.query)
    return grants.margins(percentOff)
  })

  /* ═══ من عبّأ النموذج — مصدرُه ورسائلُه ومواعيدُه، وExcel، والحذف، ورسالةٌ يكتبها صاحبُ المنصّة (`grant-registrants.service.ts`) ═══ */
  app.get('/api/admin/member-grant/registrants', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'من عبأ نموذج المنحة: بياناته ومصدره وما فعل ومستشاره ورسائله ومواعيده' },
  }, async () => registrantsFull(prisma))

  app.get('/api/admin/member-grant/registrants.xlsx', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'من عبأ نموذج المنحة في ملف Excel: الأشخاص والرسائل والإحصاءات' },
  }, async (_req, reply) => {
    const buf = await registrantsXlsx(prisma)
    const name = `من عبأ نموذج المنحة ${zonedDay(new Date())}.xlsx`
    return reply
      .header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('content-disposition', `attachment; filename="grant-registrants.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`)
      .send(buf)
  })

  /* ═══ ومن أنشأ حسابَه ولم يسجّل في شعبةٍ بعد — ملفُّه هنا بجوار ملفّ المنحة (٩ نوفمبر ٢٠٢٦) ═══
     طلبُ صاحب المنصّة: «so for me i get leads all from one place». فالحارسُ حارسُ ملفّ المنحة نفسُه (`signed-up-export.ts`) */
  app.get('/api/admin/member-grant/signed-up.xlsx', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'من أنشأ حسابه ولم يسجل في شعبة بعد في ملف Excel' },
  }, async (_req, reply) => {
    const buf = await signedUpXlsx(prisma)
    const name = `لم يسجلوا في شعبة ${zonedDay(new Date())}.xlsx`
    return reply
      .header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('content-disposition', `attachment; filename="signed-up-not-enrolled.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`)
      .send(buf)
  })

  app.delete('/api/admin/member-grant/registrants/:id', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'حذف من عبأ النموذج: تمحى بياناته وحالاته، وكوده يبطل أو يبقى بخياره' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const { disableCode } = z.object({ disableCode: z.boolean() }).parse(req.body ?? {})
    return eraseRegistrant(prisma, id, { disableCode }, req.auth!.userId, req.ip)
  })

  /* من ردّ «توقف» على واتساب — يسجّله من قرأ الردّ، أو يرجع عنه (١١ نوفمبر ٢٠٢٦) */
  app.put('/api/admin/member-grant/registrants/:id/whatsapp', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'تسجيل من رد «توقف» على واتساب، أو الرجوع عنه' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const { stopped } = z.object({ stopped: z.boolean() }).parse(req.body ?? {})
    return setRegistrantWhatsapp(prisma, id, stopped, req.auth!.userId, req.ip)
  })

  app.post('/api/admin/member-grant/registrants/mail', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'رسالة بريد يكتبها المدير لمن يختارهم ممن عبأ النموذج — للجميع أو لواحد' },
  }, async (req) => {
    const body = z.object({
      ids: z.array(z.string().uuid()).min(1, 'اختر من تصله الرسالة').max(GRANT_MESSAGE_MAX_TO),
      subject: z.string().trim().min(1, 'اكتب عنوان الرسالة').max(GRANT_MESSAGE_SUBJECT_MAX),
      body: z.string().trim().min(1, 'اكتب نص الرسالة').max(GRANT_MESSAGE_BODY_MAX),
    }).parse(req.body ?? {})
    return messageRegistrants(prisma, body, req.auth!.userId, req.ip)
  })

  /* ═══ «منحة وجيز العامة» — إعداداتُها وهامشُها ونتائجُها بصفّها هي (١ نوفمبر ٢٠٢٦) ═══
     ومن عبّأ نموذجَها في قائمة من عبّأ أعلاه، مع الحملات كلِّها، ودوراتُها دوراتُ الأولى نفسُها */
  const open = new GrantService(prisma, OPEN_GRANT_SLUG)

  app.get('/api/admin/open-grant', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'إعدادات منحة وجيز العامة وما جرى بها' },
  }, async () => open.settings())

  app.put('/api/admin/open-grant', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'تغيير نسبة المنحة العامة أو عددها أو نهايتها أو تشغيلها' },
  }, async (req) => open.update(settingsBody.parse(req.body ?? {}), req.auth!.userId))

  app.get('/api/admin/open-grant/margins', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'سعر كل شعبة مفتوحة بعد المنحة العامة مقابل أجر مقعدها' },
  }, async (req) => {
    const { percentOff } = z.object({ percentOff: z.coerce.number().int().min(1).max(100).optional() }).parse(req.query)
    return open.margins(percentOff)
  })

  /* ═══ دوراتُ المنحة — ما يختار منه صاحبُ المنحة (`grant-courses.service.ts`) ═══ */
  app.get('/api/admin/member-grant/open-courses', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'دورات المنحة: ما له شعبة تشترى في الفصل القادم القريب، وفصله' },
  }, async () => courses.openCourses())
}

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
import { GRANT_KINDS, GRANT_KIND_SLUG, OPEN_GRANT_SLUG } from '../../../src/application/commerce/grant'
import { GrantCourseChoiceService, campaignScope } from '../../services/grant-scope.service'
import { marginOptions, marginsFor } from '../../services/grant-margins.service'
import { AuthError } from '../../services/auth.service'
import { grantMailHold, setGrantMailHold } from '../../services/grant-mail-hold.service'

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

  /* ═══ بريدُ الحملات ممسوكٌ حتى يأمر صاحبُ المنصّة (١٧ نوفمبر ٢٠٢٦، `grant-mail-hold.service.ts`) ═══
     «then i order to send» — فالإطلاقُ والإمساكُ بصلاحيّة إعدادات المنحة، والأثرُ يسمّي من فعل */
  app.get('/api/admin/grants/mail-hold', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'هل بريد حملات المنح ممسوك، ومن غيره آخر مرة' },
  }, async () => grantMailHold(prisma))

  app.put('/api/admin/grants/mail-hold', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'إطلاق بريد حملات المنح أو إمساكه' },
  }, async (req) => {
    const { held } = z.object({ held: z.boolean() }).parse(req.body ?? {})
    return setGrantMailHold(prisma, held, req.auth!.userId)
  })

  /* ═══ «فحص الهامش» لأيّ منحة — يُختار فوق جدوله (١٦ نوفمبر ٢٠٢٦، `grant-margins.service.ts`) ═══
     قرارُ صاحب المنصّة: «أريد فوق هذا الجدول أن أختار المنحةَ التي أرى جدولَها». بصلاحيّة إعدادات المنحة نفسِها */
  app.get('/api/admin/grants/margin-options', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'ما يختار منه فحص الهامش: المنح، ثم كل مؤثر نشط، ثم كل شريك' },
  }, async () => ({ options: await marginOptions(prisma) }))

  app.get('/api/admin/grants/margins', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'سعر كل شعبة بعد منحة مختارة مقابل أجر مقعدها وعمولة المؤثر وحصة الشريك' },
  }, async (req) => {
    const { key, percentOff } = z.object({
      key: z.string().min(1).max(200),
      percentOff: z.coerce.number().int().min(1).max(100).optional(),
    }).parse(req.query)
    const r = await marginsFor(prisma, key, percentOff)
    if (!r) throw new AuthError('not_found', 'لا منحة بهذا الاسم', 404)
    return r
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

  /* ═══ دوراتُ المنحة — ما يختار منه صاحبُ المنحة (`grant-courses.service.ts`) ═══
     ولكلّ حملةٍ دوراتُها إن اختارها المدير (`?grant=`، ١٥ نوفمبر ٢٠٢٦) — وبلا حملةٍ «منحة وجيز» كما كان */
  const grantKind = z.object({ grant: z.enum(GRANT_KINDS).default('member') })
  app.get('/api/admin/member-grant/open-courses', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'دورات المنحة: ما له شعبة تشترى في الفصل القادم القريب، وفصله' },
  }, async (req) => {
    const { grant } = grantKind.parse(req.query ?? {})
    return courses.openCourses(new Date(), await campaignScope(prisma, GRANT_KIND_SLUG[grant]))
  })

  /* ═══ واختيارُ دورات كلّ حملة (١٥ نوفمبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة: يختار المديرُ دوراتِ كلّ منحة، فلا تُعرض في صفحتها إلّا هي، والكودُ يخصم على أيّ دورةٍ حتى حدّه. والفارغةُ تلقائيّة.
     بصلاحيّة إعدادات المنحة نفسِها، والأثرُ يقول من غيّر وما كان وما صار (`grant-scope.service.ts`) */
  const choice = new GrantCourseChoiceService(prisma)
  app.get('/api/admin/grant-courses/:grant', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'دورات حملة منحة: ما اختاره المدير، وما يختار منه' },
  }, async (req) => choice.campaignChoice(GRANT_KIND_SLUG[grantKind.parse(req.params).grant]))

  app.put('/api/admin/grant-courses/:grant', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'اختيار دورات حملة منحة — والقائمة الفارغة تعيدها تلقائية' },
  }, async (req) => {
    const { courseIds } = z.object({ courseIds: z.array(z.string().trim().min(1).max(64)).max(500) }).parse(req.body ?? {})
    return choice.setCampaignCourses(GRANT_KIND_SLUG[grantKind.parse(req.params).grant], courseIds, req.auth!.userId)
  })
}

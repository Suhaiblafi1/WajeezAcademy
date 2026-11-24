/* «البريد الجماعي» — حملاتٌ وقوائمُ في مكانٍ واحد (٢٢ نوفمبر ٢٠٢٦). والعلّةُ في `server/services/bulk-mail/bulk-mail.service.ts`.

   بصلاحيّة الكوبونات (`commerce.manage`) كرسالة المنحة لمن عبّأ نموذجها: من يراسل الليداتِ هناك يراسلهم هنا.
   والملفُّ يُرفع بايتاتٍ خامّا واسمُه في الاستعلام — كملفّ الدورة الخاصّة — ولا يُحفظ. */

import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requirePermission } from '../auth-plugin'
import {
  audiences, campaignCheck, createCampaign, createList, deleteCampaign, deleteList, duplicateCampaign, listCampaigns,
  previewHtml, previewUpload, renameList, sendCampaign, sendTest, stopCampaign, updateCampaign,
} from '../../services/bulk-mail/bulk-mail.service'
import { bulkSender, setBulkSender } from '../../services/bulk-mail/sender'
import {
  BULK_BODY_MAX, BULK_BUTTON_LABEL_MAX, BULK_LIST_NAME_MAX, BULK_SUBJECT_MAX, MAX_STAGES, SKIP_RECENT_DAYS, type SkipRecentDays,
} from '../../../src/application/marketing/bulk-mail'

/** ستّون ألفَ صفٍّ في Excel نحوُ ثلاثة ميغابايت — والسقفُ فوقه بهامش */
const UPLOAD_MAX_BYTES = 15 * 1024 * 1024

const idParam = z.object({ id: z.string().uuid() })

/** أيّامُ تخطّي من وصلته حملةٌ قريبا — ٠ بلا تخطٍّ (`SKIP_RECENT_DAYS`) */
const skipRecent = z.coerce.number().int()
  .refine((n): n is SkipRecentDays => (SKIP_RECENT_DAYS as readonly number[]).includes(n), 'اختر 0 أو 3 أو 7 أو 14 يوما')
  .optional().transform((n) => (n ?? 0) as SkipRecentDays)

/** خيارٌ في رابط التأكيد: `1` أو `true` نعم، وغيرُه لا */
const flag = z.string().optional().transform((v) => v === '1' || v === 'true')

const content = z.object({
  subject: z.string().max(BULK_SUBJECT_MAX),
  body: z.string().max(BULK_BODY_MAX),
  buttonLabel: z.string().max(BULK_BUTTON_LABEL_MAX).nullable().optional(),
  buttonUrl: z.string().max(600).nullable().optional(),
})

const draft = z.object({
  subject: z.string().max(BULK_SUBJECT_MAX).optional(),
  body: z.string().max(BULK_BODY_MAX).optional(),
  buttonLabel: z.string().max(BULK_BUTTON_LABEL_MAX).nullable().optional(),
  buttonUrl: z.string().max(600).nullable().optional(),
  audience: z.string().max(200).nullable().optional(),
})

const bytes = (body: unknown) => (Buffer.isBuffer(body) ? body : Buffer.alloc(0))

export function registerAdminBulkMailRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const can = requirePermission('commerce.manage')
  const tags = ['admin-commerce']

  /* ═══ القوائم ═══ */
  app.get('/api/admin/bulk-mail/audiences', {
    preHandler: can, schema: { tags, summary: 'قوائم الموقع والقوائم المرفوعة بأعدادها' },
  }, async () => audiences(prisma))

  app.post('/api/admin/bulk-mail/lists/preview', {
    preHandler: can, bodyLimit: UPLOAD_MAX_BYTES,
    schema: { tags, summary: 'قراءة ملف Excel أو CSV قبل حفظه: الأعداد وأول عشرين صفا' },
  }, async (req) => previewUpload(prisma, bytes(req.body)))

  app.post('/api/admin/bulk-mail/lists', {
    preHandler: can, bodyLimit: UPLOAD_MAX_BYTES,
    schema: { tags, summary: 'حفظ ملف Excel أو CSV قائمة — صفوفه لا الملف' },
  }, async (req, reply) => {
    const q = z.object({ name: z.string().max(BULK_LIST_NAME_MAX).default(''), file: z.string().max(200).optional() }).parse(req.query)
    const out = await createList(prisma, bytes(req.body), { name: q.name, fileName: q.file ?? null }, req.auth!.userId, req.ip)
    return reply.status(201).send(out)
  })

  app.put('/api/admin/bulk-mail/lists/:id', {
    preHandler: can, schema: { tags, summary: 'تغيير اسم قائمة' },
  }, async (req) => {
    const { id } = idParam.parse(req.params)
    const { name } = z.object({ name: z.string().max(BULK_LIST_NAME_MAX) }).parse(req.body ?? {})
    return renameList(prisma, id, name, req.auth!.userId, req.ip)
  })

  app.delete('/api/admin/bulk-mail/lists/:id', {
    preHandler: can, schema: { tags, summary: 'حذف قائمة — والحملات التي أرسلت إليها تبقى' },
  }, async (req) => deleteList(prisma, idParam.parse(req.params).id, req.auth!.userId, req.ip))

  /* ═══ الحملات ═══ */
  app.get('/api/admin/bulk-mail/campaigns', {
    preHandler: can, schema: { tags, summary: 'الحملات كلها بحالها وأرقامها' },
  }, async () => listCampaigns(prisma))

  app.post('/api/admin/bulk-mail/campaigns', {
    preHandler: can, schema: { tags, summary: 'حملة جديدة مسودة' },
  }, async (req, reply) => reply.status(201).send(await createCampaign(prisma, draft.parse(req.body ?? {}), req.auth!.userId)))

  app.put('/api/admin/bulk-mail/campaigns/:id', {
    preHandler: can, schema: { tags, summary: 'حفظ مسودة حملة' },
  }, async (req) => updateCampaign(prisma, idParam.parse(req.params).id, draft.parse(req.body ?? {})))

  app.delete('/api/admin/bulk-mail/campaigns/:id', {
    preHandler: can, schema: { tags, summary: 'حذف مسودة، أو حملة لم تصل أحدا' },
  }, async (req) => deleteCampaign(prisma, idParam.parse(req.params).id, req.auth!.userId, req.ip))

  app.post('/api/admin/bulk-mail/campaigns/:id/duplicate', {
    preHandler: can, schema: { tags, summary: 'نسخ حملة مسودة جديدة لقائمة أخرى' },
  }, async (req, reply) => reply.status(201).send(await duplicateCampaign(prisma, idParam.parse(req.params).id, req.auth!.userId)))

  app.get('/api/admin/bulk-mail/campaigns/:id/check', {
    preHandler: can, schema: { tags, summary: 'من تصله الحملة لو أرسلت الآن ومن لا تصله ولماذا' },
  }, async (req) => {
    /* وتخطّي من وصلته حملةٌ قريبا — ٠ أو ٣ أو ٧ أو ١٤ يوما (`SKIP_RECENT_DAYS`) */
    /* وتخطّي من هو في المنصّة أو في قائمةٍ أخرى — `1` نعم، وغيرُه لا (٢٣ نوفمبر ٢٠٢٦) */
    const q = z.object({ skipRecentDays: skipRecent, skipPlatform: flag, skipOtherLists: flag }).parse(req.query ?? {})
    return campaignCheck(prisma, idParam.parse(req.params).id, q)
  })

  app.post('/api/admin/bulk-mail/campaigns/:id/send', {
    preHandler: can, schema: { tags, summary: 'إرسال الحملة — بالعدد الذي رآه المرسل' },
  }, async (req) => {
    const { confirmCount, stages, skipRecentDays, skipPlatform, skipOtherLists } = z.object({
      confirmCount: z.number().int().min(1),
      skipRecentDays: skipRecent,
      skipPlatform: z.boolean().optional(),
      skipOtherLists: z.boolean().optional(),
      /* حدودُ الأيّام الأولى إن أُرسلت على مراحل — والباقي في اليوم الذي بعدها */
      stages: z.array(z.number().int().min(1).max(100_000)).max(MAX_STAGES - 1).nullable().optional(),
    }).parse(req.body ?? {})
    return sendCampaign(prisma, idParam.parse(req.params).id, confirmCount, req.auth!.userId, req.ip, { stages: stages ?? null, skipRecentDays, skipPlatform, skipOtherLists })
  })

  app.post('/api/admin/bulk-mail/campaigns/:id/stop', {
    preHandler: can, schema: { tags, summary: 'إيقاف حملة ترسل — ما لم يخرج يلغى' },
  }, async (req) => stopCampaign(prisma, idParam.parse(req.params).id, req.auth!.userId, req.ip))

  /* ═══ مُرسِلُ الحملات — نطاقٌ فرعيّ (`sender.ts`) ═══ */
  app.get('/api/admin/bulk-mail/sender', {
    preHandler: can, schema: { tags, summary: 'مرسل الحملات: الاسم والبريد على النطاق الفرعي' },
  }, async () => bulkSender(prisma))

  app.put('/api/admin/bulk-mail/sender', {
    preHandler: can, schema: { tags, summary: 'تغيير مرسل الحملات — رسائل الحساب تبقى من مرسلها' },
  }, async (req) => {
    const body = z.object({ name: z.string().min(1).max(60), email: z.string().min(3).max(254) }).parse(req.body ?? {})
    return setBulkSender(prisma, body, req.auth!.userId, req.ip)
  })

  /* ═══ المعاينة والتجربة ═══ */
  app.post('/api/admin/bulk-mail/preview', {
    preHandler: can, schema: { tags, summary: 'الرسالة كما تصل — بقالب الأكاديمية' },
  }, async (req) => previewHtml(prisma, content.parse(req.body ?? {}), req.auth!.userId))

  app.post('/api/admin/bulk-mail/test', {
    preHandler: can, schema: { tags, summary: 'تجربة الرسالة على بريد المرسل وحده' },
  }, async (req) => sendTest(prisma, content.parse(req.body ?? {}), req.auth!.userId, req.ip))
}

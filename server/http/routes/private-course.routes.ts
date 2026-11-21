/* ═══ مساراتُ الدورة الخاصّة — صفحتُها العامّة ولوحةُ صاحبها (١٩ نوفمبر ٢٠٢٦) ═══

   بابان لا ثالثَ لهما:
   · **عامٌّ** بلا جلسة: حالةُ التسجيل، وإرسالُ التسجيل بصورة الحوالة — بسقفٍ لكلّ عنوانٍ وحقلِ فخّ.
   · **خاصٌّ** بحارس `requirePrivateOwner`: `super_admin` وبريدُ صاحب المنصّة معا. وما سواه يُجاب ٤٠٤.

   والقرارُ والطريقُ في `services/private-course/registration.service.ts`. */

import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { assertNotBot } from '../honeypot'
import { requirePrivateOwner } from '../../services/private-course/owner'
import { saveGmailConfig } from '../../services/private-course/mailer'
import {
  clearCourseFile, confirmRegistration, courseFile, deleteRegistration, exportXlsx, moveSection, ownerOverview,
  chooseCard, payInfo, proofOf, publicCourseState, submitProof, registerPublic, rejectRegistration, reopenRegistration, sendConfirmation, sendTestMail,
  setCourseFile, updateCourse,
} from '../../services/private-course/registration.service'
import { COURSE_FILE_MAX_BYTES, PROOF_MAX_BYTES } from '../../../src/application/private-course/ai-jobs'

/* الصورةُ تصل base64 داخل JSON — ثلثٌ أكبرُ من بايتاتها، وهامشٌ للحقول */
const REGISTER_BODY_LIMIT = Math.ceil(PROOF_MAX_BYTES * 1.4) + 64 * 1024

const slugParam = z.object({ slug: z.string().min(1).max(60) })
const proofSchema = z.object({
  name: z.string().max(300),
  base64: z.string().min(10, 'ارفع صورة الحوالة'),
}, { message: 'ارفع صورة الحوالة' })
const idParam = z.object({ id: z.string().uuid() })

/** الملفُّ يُعرض في المتصفّح نفسِه — صورةً أو PDF — لا يُنزَّل */
function inline(name: string): string {
  return `inline; filename="file"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export function registerPrivateCourseRoutes(app: FastifyInstance, prisma: PrismaClient) {
  /* ═══ العامّ ═══ */

  app.get('/api/v1/public/private-courses/:slug', {
    schema: { tags: ['private-course'], summary: 'هل التسجيل في الدورة الخاصة مفتوح' },
  }, async (req) => {
    const { slug } = slugParam.parse(req.params)
    return publicCourseState(prisma, slug)
  })

  app.post('/api/v1/public/private-courses/:slug/registrations', {
    bodyLimit: REGISTER_BODY_LIMIT,
    config: { rateLimit: { max: 8, timeWindow: '15 minutes' } },
    schema: { tags: ['private-course'], summary: 'تسجيل في الدورة الخاصة مع صورة الحوالة' },
  }, async (req, reply) => {
    assertNotBot(req.body)
    const { slug } = slugParam.parse(req.params)
    const body = z.object({
      fullName: z.string().trim().min(3, 'اكتب اسمك الكامل').max(120, 'الاسم أطول من المعتاد'),
      email: z.string().trim().email('البريد الإلكتروني غير صحيح').max(200),
      phoneCountry: z.string().length(2, 'اختر الدولة'),
      phone: z.string().min(4, 'اكتب رقم الهاتف').max(30, 'رقم الهاتف غير صحيح'),
      sectionKey: z.string().min(1, 'اختر الشعبة').max(20),
      note: z.string().max(500, 'الملاحظة أطول من 500 حرف').optional(),
      /* اختياريّةٌ منذ «احجز أوّلا وادفع بعد» — تُرفع من رابط الدفع */
      proof: proofSchema.optional(),
      source: z.string().max(300).optional(),
    }).parse(req.body)
    const r = await registerPublic(prisma, slug, body)
    return reply.status(201).send(r)
  })

  /* ═══ رابطُ الدفع باسمه — يرفع منه الحوالةَ متى حوّل (٢٠ نوفمبر ٢٠٢٦) ═══ */

  app.get('/api/v1/public/private-courses/:slug/pay/:token', {
    config: { rateLimit: { max: 30, timeWindow: '15 minutes' } },
    schema: { tags: ['private-course'], summary: 'حال الحجز من رابط الدفع: الاسم الأول والشعبة وهل وصلت الحوالة' },
  }, async (req) => {
    const { slug, token } = z.object({ slug: z.string().min(1).max(60), token: z.string().min(1).max(200) }).parse(req.params)
    return payInfo(prisma, slug, token)
  })

  app.post('/api/v1/public/private-courses/:slug/pay/:token', {
    bodyLimit: REGISTER_BODY_LIMIT,
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    schema: { tags: ['private-course'], summary: 'رفع صورة الحوالة من رابط الدفع' },
  }, async (req) => {
    const { slug, token } = z.object({ slug: z.string().min(1).max(60), token: z.string().min(1).max(200) }).parse(req.params)
    const body = z.object({
      proof: proofSchema,
      note: z.string().max(500, 'الملاحظة أطول من 500 حرف').optional(),
    }).parse(req.body)
    return submitProof(prisma, slug, token, body)
  })

  /* ضغط «ادفع بالبطاقة» — لا إيصالَ يُرفع لها، فيُكتب أنّه ذهب إليها (٢١ نوفمبر ٢٠٢٦) */
  app.post('/api/v1/public/private-courses/:slug/pay/:token/card', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    schema: { tags: ['private-course'], summary: 'اختار الدفع بالبطاقة من رابط الدفع' },
  }, async (req) => {
    const { slug, token } = z.object({ slug: z.string().min(1).max(60), token: z.string().min(1).max(200) }).parse(req.params)
    return chooseCard(prisma, slug, token)
  })

  /* ═══ الخاصّ — صاحبُ المنصّة وحدَه ═══ */

  app.get('/api/v1/private/me', {
    preHandler: requirePrivateOwner,
    schema: { tags: ['private-course'], summary: 'هل الداخل صاحب اللوحة الخاصة' },
  }, async () => ({ owner: true }))

  app.get('/api/v1/private/courses/:slug', {
    preHandler: requirePrivateOwner,
    schema: { tags: ['private-course'], summary: 'الدورة الخاصة: إعداداتها ومسجلوها' },
  }, async (req) => ownerOverview(prisma, slugParam.parse(req.params).slug))

  app.patch('/api/v1/private/courses/:slug', {
    preHandler: requirePrivateOwner,
    schema: { tags: ['private-course'], summary: 'فتح التسجيل وروابط Zoom للشعب' },
  }, async (req) => {
    const { slug } = slugParam.parse(req.params)
    const body = z.object({
      open: z.boolean().optional(),
      zoom: z.record(z.string(), z.object({ url: z.string().max(600), passcode: z.string().max(40).optional() }).nullable()).optional(),
      /* رابطُ الدفع بالبطاقة لمن هو خارج الأردن — وفارغُه يُخفي الخيار */
      cardUrl: z.string().max(600).optional(),
    }).parse(req.body)
    return updateCourse(prisma, slug, body)
  })

  app.put('/api/v1/private/courses/:slug/file', {
    preHandler: requirePrivateOwner,
    bodyLimit: COURSE_FILE_MAX_BYTES + 1024,
    schema: { tags: ['private-course'], summary: 'رفع ملف الدورة المرفق ببريد التأكيد — بايتات خام واسمه في الاستعلام' },
  }, async (req) => {
    const { slug } = slugParam.parse(req.params)
    const { name } = z.object({ name: z.string().min(1).max(200) }).parse(req.query)
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    return setCourseFile(prisma, slug, buffer, name)
  })

  app.delete('/api/v1/private/courses/:slug/file', {
    preHandler: requirePrivateOwner,
    schema: { tags: ['private-course'], summary: 'العودة إلى ملف الدورة الأصلي' },
  }, async (req) => clearCourseFile(prisma, slugParam.parse(req.params).slug))

  app.get('/api/v1/private/courses/:slug/file', {
    preHandler: requirePrivateOwner,
    schema: { tags: ['private-course'], summary: 'ملف الدورة كما يصل المتعلم' },
  }, async (req, reply) => {
    const f = await courseFile(prisma, slugParam.parse(req.params).slug)
    if (!f) return reply.status(404).send({ error: { code: 'not_found', message_ar: 'لا ملف للدورة' } })
    return reply.header('content-type', f.mime).header('content-disposition', inline(f.name))
      .header('cache-control', 'private, no-store').send(f.content)
  })

  app.get('/api/v1/private/courses/:slug/export.xlsx', {
    preHandler: requirePrivateOwner,
    schema: { tags: ['private-course'], summary: 'المسجلون في ملف Excel — الكل أو شعبة أو حالة' },
  }, async (req, reply) => {
    const { slug } = slugParam.parse(req.params)
    const q = z.object({
      status: z.enum(['pending', 'confirmed', 'rejected']).optional(),
      section: z.string().max(20).optional(),
    }).parse(req.query)
    const { buffer, fileName } = await exportXlsx(prisma, slug, q)
    return reply
      .header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('content-disposition', `attachment; filename="registrations.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`)
      .header('cache-control', 'private, no-store')
      .send(buffer)
  })

  app.get('/api/v1/private/registrations/:id/proof', {
    preHandler: requirePrivateOwner,
    schema: { tags: ['private-course'], summary: 'صورة الحوالة' },
  }, async (req, reply) => {
    const f = await proofOf(prisma, idParam.parse(req.params).id)
    /* النوعُ ممّا ثبت من البايتات عند الرفع (صورةٌ أو PDF)، ولا يُخمِّن المتصفّحُ غيرَه */
    return reply.header('content-type', f.mime).header('content-disposition', inline(f.name))
      .header('x-content-type-options', 'nosniff').header('cache-control', 'private, no-store').send(f.content)
  })

  app.post('/api/v1/private/registrations/:id/confirm', {
    preHandler: requirePrivateOwner,
    schema: { tags: ['private-course'], summary: 'تأكيد التسجيل — مع بريد التأكيد أو بدونه' },
  }, async (req) => {
    const { id } = idParam.parse(req.params)
    const { sendMail } = z.object({ sendMail: z.boolean().default(true) }).parse(req.body ?? {})
    return confirmRegistration(prisma, id, { sendMail })
  })

  app.post('/api/v1/private/registrations/:id/send', {
    preHandler: requirePrivateOwner,
    schema: { tags: ['private-course'], summary: 'إرسال بريد التأكيد ورابط Zoom من جديد' },
  }, async (req) => sendConfirmation(prisma, idParam.parse(req.params).id))

  app.post('/api/v1/private/registrations/:id/reject', {
    preHandler: requirePrivateOwner,
    schema: { tags: ['private-course'], summary: 'رفض التسجيل — بلا بريد' },
  }, async (req) => rejectRegistration(prisma, idParam.parse(req.params).id))

  app.post('/api/v1/private/registrations/:id/reopen', {
    preHandler: requirePrivateOwner,
    schema: { tags: ['private-course'], summary: 'إعادة التسجيل إلى قيد المراجعة' },
  }, async (req) => reopenRegistration(prisma, idParam.parse(req.params).id))

  app.patch('/api/v1/private/registrations/:id', {
    preHandler: requirePrivateOwner,
    schema: { tags: ['private-course'], summary: 'نقل المتعلم إلى الشعبة الأخرى' },
  }, async (req) => {
    const { id } = idParam.parse(req.params)
    const { sectionKey } = z.object({ sectionKey: z.string().min(1).max(20) }).parse(req.body)
    return moveSection(prisma, id, sectionKey)
  })

  app.delete('/api/v1/private/registrations/:id', {
    preHandler: requirePrivateOwner,
    schema: { tags: ['private-course'], summary: 'حذف التسجيل وصورة حوالته' },
  }, async (req) => deleteRegistration(prisma, idParam.parse(req.params).id))

  /* ═══ بريدُ Gmail ═══ */

  app.put('/api/v1/private/mail', {
    preHandler: requirePrivateOwner,
    schema: { tags: ['private-course'], summary: 'بريد Gmail المرسل وكلمة مرور التطبيق — لا تعاد إلا مقنعة' },
  }, async (req) => {
    const body = z.object({
      user: z.string().trim().email('البريد غير صحيح').max(200).optional(),
      appPassword: z.string().max(64).optional(),
    }).parse(req.body)
    return saveGmailConfig(prisma, body)
  })

  app.post('/api/v1/private/mail/test', {
    preHandler: requirePrivateOwner,
    schema: { tags: ['private-course'], summary: 'رسالة تجربة إلى بريد مختار' },
  }, async (req) => {
    const { to } = z.object({ to: z.string().trim().email('البريد غير صحيح') }).parse(req.body)
    return sendTestMail(prisma, to)
  })
}

/* مسارات طلبات المدربين العامة — تقديم، تحقق بريد، حالة آمنة، مرحلة ثانية، وثائق.
   رموز التحقق/الوصول تُعاد في الاستجابة في التطوير فقط (لا قناة بريد فعلية بعد). */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { verifySignature, writeStreamToKey, MAX_UPLOAD_BYTES } from '../../services/storage.service'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { filePathFor } from '../../services/storage.service'
import { requirePermission } from '../auth-plugin'

const IS_PROD = process.env.NODE_ENV === 'production'

export function registerTrainerApplicationRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const svc = new TrainerApplicationService(prisma)
  const review = new TrainerReviewService(prisma)

  /* استهلاك دعوة إنشاء الحساب — عام لأن المدعو بلا جلسة بعد */
  app.post('/api/v1/trainer-invitations/consume', {
    schema: { tags: ['trainer-applications'], summary: 'إنشاء حساب المدرب عبر الدعوة الآمنة — مرة واحدة' },
  }, async (req, reply) => {
    const body = z.object({
      token: z.string().min(10), password: z.string().min(8), displayName: z.string().max(120).optional(),
    }).parse(req.body)
    const result = await review.consumeInvitation(body.token, body.password, body.displayName)
    return reply.status(201).send(result)
  })

  /* رفع الوثائق الخام — جسم octet-stream بحجم كبير مسموح للفيديو */
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) => done(null, body))

  app.post('/api/v1/trainer-applications', {
    schema: { tags: ['trainer-applications'], summary: 'تقديم طلب انضمام مدرب — المرحلة الأولى' },
  }, async (req, reply) => {
    const body = z.object({
      fullName: z.string().min(3), email: z.string().email(),
      phoneCountryCode: z.string().max(6).optional(), phone: z.string().max(20).optional(),
      country: z.string().max(80).optional(), timezone: z.string().max(60).optional(),
      employmentStatus: z.enum(['employed', 'own_business', 'full_time_training']).optional(),
      jobTitle: z.string().max(120).optional(),
      specialties: z.array(z.string().min(2)).min(1).max(12),
      domainYears: z.enum(['1-3', '4-7', '8-12', '12+']),
      trainingYears: z.string().min(1),
      bio: z.string().max(2000).optional(), linkedinUrl: z.string().url().max(300).optional().or(z.literal('')),
      youtubeUrl: z.string().url().max(300).optional().or(z.literal('')),
      instagramUrl: z.string().url().max(300).optional().or(z.literal('')),
      hasAccreditation: z.boolean().optional(),
      accreditationDetails: z.string().max(300).optional(),
      targetCountries: z.array(z.string().min(2)).max(25).optional(),
      targetAudiences: z.array(z.string().min(2)).max(12).optional(),
      trainingLanguages: z.array(z.string().min(2)).min(1),
      deliveryMode: z.enum(['in_person', 'remote', 'both']),
      /* ١٥٠–٥٠٠: عشرةُ أحرف كانت تقبل «أحب التدريب» — سطرٌ لا يُقرأ منه شيء
         ولا يُفاضَل به بين طلبين. والسقف يمنع سيرةً ذاتية ثانية في حقل نصّ. */
      motivation: z.string().trim().min(150).max(500),
      privacyConsent: z.literal(true),
    }).parse(req.body)
    const result = await svc.submitPhase1({
      ...body,
      linkedinUrl: body.linkedinUrl || undefined,
      youtubeUrl: body.youtubeUrl || undefined,
      instagramUrl: body.instagramUrl || undefined,
    })
    /* رمز التحقق يُرسَل بالبريد فعليا الآن. وحين تتعذّر القناة يمضي الطلب بلا
       بوابة بريدية (بأثر صريح في سجل الحالة) ويعود رمز وصول المرشح هنا — وإلا
       بقي المتقدم عند «بانتظار التحقق» أبدا، وهو ما كان يقع في الإنتاج. */
    return reply.status(201).send({
      reference: result.reference,
      status: result.candidateToken ? 'submitted' : 'email_verification_pending',
      emailDelivery: result.emailDelivery,
      ...(result.candidateToken ? { candidateToken: result.candidateToken } : {}),
      ...(IS_PROD ? {} : { devVerificationToken: result.verificationTokenForDelivery }),
    })
  })

  app.post('/api/v1/trainer-applications/verify-email', {
    schema: { tags: ['trainer-applications'], summary: 'تحقق البريد — يصدر رمز وصول المرشح' },
  }, async (req) => {
    const body = z.object({ reference: z.string().min(5), token: z.string().min(10) }).parse(req.body)
    const result = await svc.verifyEmail(body.reference, body.token)
    return result
  })

  app.post('/api/v1/trainer-applications/resend-verification', {
    schema: { tags: ['trainer-applications'], summary: 'إعادة إرسال رمز التحقق — لا يكشف وجود الطلب' },
  }, async (req) => {
    const body = z.object({ email: z.string().email() }).parse(req.body)
    const result = await svc.resendVerification(body.email)
    /* الحالة تُعاد دائما بلا كشف وجود الطلب: null تعني «لا طلب معلّق بهذا البريد» */
    return { ok: true, emailDelivery: result.emailDelivery, ...(IS_PROD ? {} : { devVerificationToken: result.tokenForDelivery }) }
  })

  app.get('/api/v1/trainer-applications/:reference/status', {
    schema: { tags: ['trainer-applications'], summary: 'حالة الطلب بأمان — يتطلب البريد مطابقا' },
  }, async (req) => {
    const { reference } = z.object({ reference: z.string().min(5) }).parse(req.params)
    const { email } = z.object({ email: z.string().email() }).parse(req.query)
    return svc.getPublicStatus(reference, email)
  })

  /* حساب «متقدّم مدرب» — يحفظ الطلب لصاحبه بدل رمزٍ يُنسخ ويُفقد.
     الرمز شرطٌ لإنشائه: بدونه يستطيع من عرف رقما مرجعيا أن يربط طلب غيره
     بحسابه. والبريد يأتي من الطلب لا من الطلبِ الوارد. */
  app.post('/api/v1/trainer-applications/:reference/account', {
    schema: { tags: ['trainer-applications'], summary: 'إنشاء حساب متقدّم مدرب — برمز المرشح' },
  }, async (req, reply) => {
    const { reference } = z.object({ reference: z.string().min(5) }).parse(req.params)
    const { candidateToken, password } = z.object({
      candidateToken: z.string().min(10),
      password: z.string().min(8).max(200),
    }).parse(req.body)
    return reply.status(201).send(await svc.createApplicantAccount(reference, candidateToken, password))
  })

  /* طلبُ صاحب الحساب هو — الصلاحية trainer.application.own، ولا تُعطى إلا
     لدور المتقدّم. فلا يقرأ متعلمٌ طلبا ولا يقرأ متقدّمٌ طلب غيره. */
  app.get('/api/v1/trainer-applications/mine', {
    preHandler: requirePermission('trainer.application.own'),
    schema: { tags: ['trainer-applications'], summary: 'طلب الانضمام الخاص بصاحب الحساب' },
  }, async (req) => svc.myApplication(req.auth!.userId))

  app.post('/api/v1/trainer-applications/:reference/phase-2', {
    schema: { tags: ['trainer-applications'], summary: 'استكمال المرحلة الثانية — للمرشحين برمز الوصول' },
  }, async (req) => {
    const { reference } = z.object({ reference: z.string().min(5) }).parse(req.params)
    const body = z.object({
      candidateToken: z.string().min(10),
      /* «أبرز ثلاث دورات قدمتها عبر الإنترنت»: العنوان والجهة والسنة ورابط
         اختياري. وسقط learnersCount معها — عددٌ يكتبه المتقدم عن نفسه ولا
         يُتحقق منه لا يفاضل بين طلبين. */
      previousCourses: z.array(z.object({
        title: z.string().min(2), org: z.string().optional(),
        year: z.number().int().min(1980).max(2100).optional(),
        link: z.string().max(500).optional(),
      })).max(3),
      teachableCourseIds: z.array(z.string()).min(1),
      availability: z.object({
        days: z.array(z.string()).optional(), hoursPerWeek: z.number().min(1).max(80).optional(),
        startFrom: z.string().optional(),
      }),
      demoConsent: z.literal(true),
    }).parse(req.body)
    const { candidateToken, ...input } = body
    return svc.completePhase2(reference, candidateToken, input)
  })

  app.post('/api/v1/trainer-applications/:reference/withdraw', {
    schema: { tags: ['trainer-applications'], summary: 'سحب الطلب — فعل المرشح نفسه' },
  }, async (req) => {
    const { reference } = z.object({ reference: z.string().min(5) }).parse(req.params)
    const body = z.object({ candidateToken: z.string().min(10), reason: z.string().max(500).optional() }).parse(req.body)
    await svc.withdraw(reference, body.candidateToken, body.reason)
    return { ok: true }
  })

  /* وثائق خاصة: تسجيل ثم رفع برابط موقع، وقراءة برابط موقع */
  app.post('/api/v1/trainer-applications/:reference/documents', {
    schema: { tags: ['trainer-applications'], summary: 'تسجيل وثيقة وإصدار رابط رفع موقع مؤقت' },
  }, async (req, reply) => {
    const { reference } = z.object({ reference: z.string().min(5) }).parse(req.params)
    const body = z.object({
      candidateToken: z.string().min(10),
      kind: z.enum(['cv', 'training_video', 'certificate', 'evidence', 'reference_letter', 'other']),
      originalName: z.string().min(1).max(200), mime: z.string().min(3).max(100),
      sizeBytes: z.number().int().positive(),
    }).parse(req.body)
    const { candidateToken, ...doc } = body
    const result = await svc.requestDocumentUpload(reference, candidateToken, doc)
    return reply.status(201).send(result)
  })

  app.put('/api/v1/uploads/:storageKey', {
    bodyLimit: MAX_UPLOAD_BYTES.training_video,
    schema: { tags: ['trainer-applications'], summary: 'رفع الملف الخام عبر رابط موقع — داخلي' },
  }, async (req, reply) => {
    const { storageKey } = z.object({ storageKey: z.string().min(10) }).parse(req.params)
    const { exp, sig } = z.object({ exp: z.coerce.number(), sig: z.string() }).parse(req.query)
    if (!verifySignature(storageKey, exp, sig, 'write')) {
      return reply.status(403).send({ error: { code: 'bad_signature', message_ar: 'رابط الرفع غير صالح أو منتهي' } })
    }
    /* الوثيقة المسجلة تحدد سقف الحجم */
    const doc = await prisma.trainerApplicationDocument.findUnique({ where: { storageKey } })
    if (!doc) return reply.status(404).send({ error: { code: 'not_found', message_ar: 'الوثيقة غير مسجلة' } })
    const max = MAX_UPLOAD_BYTES[doc.kind] ?? MAX_UPLOAD_BYTES.other
    const buffer = req.body as Buffer
    if (!buffer || !buffer.length) return reply.status(400).send({ error: { code: 'empty', message_ar: 'الملف فارغ' } })
    if (buffer.length > max) return reply.status(413).send({ error: { code: 'too_large', message_ar: 'الملف يتجاوز الحد المسموح' } })
    const { Readable } = await import('node:stream')
    await writeStreamToKey(storageKey, Readable.from(buffer), max)
    return { ok: true, storageKey, sizeBytes: buffer.length }
  })

  app.get('/api/v1/documents/:storageKey', {
    schema: { tags: ['trainer-applications'], summary: 'قراءة وثيقة برابط موقع مؤقت' },
  }, async (req, reply) => {
    const { storageKey } = z.object({ storageKey: z.string().min(10) }).parse(req.params)
    const { exp, sig } = z.object({ exp: z.coerce.number(), sig: z.string() }).parse(req.query)
    if (!verifySignature(storageKey, exp, sig, 'read')) {
      return reply.status(403).send({ error: { code: 'bad_signature', message_ar: 'الرابط غير صالح أو منتهي' } })
    }
    const doc = await prisma.trainerApplicationDocument.findUnique({ where: { storageKey } })
    if (!doc) return reply.status(404).send({ error: { code: 'not_found', message_ar: 'الوثيقة غير موجودة' } })
    const path = filePathFor(storageKey)
    if (!existsSync(path) || !statSync(path).isFile()) {
      return reply.status(404).send({ error: { code: 'not_uploaded', message_ar: 'الملف لم يرفع بعد' } })
    }
    reply.header('content-type', doc.mime)
    reply.header('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`)
    return reply.send(createReadStream(path))
  })
}

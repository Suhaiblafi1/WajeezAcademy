/* ما يبقى من «العمليّات» بعد قطعِها بحسب المجال: ربطُ التشخيص بالحساب،
   وبوّاباتُ المستخدم، والسيرُ الذاتيّة.

   وكان الملفُّ خمسَ مئةٍ وسبعةَ عشرَ سطرا يجمع أربعةَ مجالاتٍ لا يجمعها إلّا
   اسمُ «العمليّات» — واسمٌ كهذا لا يقول لقارئه أين يبحث. فانتقل المستشارون
   إلى `advisor.routes`، والتقويمُ إلى `calendar.routes`، والتجارةُ وخطّافُ
   الدفع إلى `commerce.routes`. والقطعُ نقلُ موضعٍ لا تغييرُ سلوك: لا مسارٌ
   تغيّر، ولا حارسٌ تبدّل. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { AdvisorService } from '../../services/advisor.service'
import { CvService } from '../../services/cv.service'
import { requireAuth, requirePermission } from '../auth-plugin'

export function registerOperationsRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const advisors = new AdvisorService(prisma)
  const cvs = new CvService(prisma)

  /* ════ ربط التشخيص بالحساب — أي مستخدم موثق ════ */
  app.post('/api/learner/diagnostic-attach', {
    preHandler: requireAuth,
    schema: { tags: ['operations'], summary: 'إرفاق نتيجة التشخيص بالحساب — ينشئ ملف متعلم وعميلا محتملا وحالة مستشار' },
  }, async (req) => {
    const body = z.object({ snapshot: z.record(z.string(), z.unknown()) }).parse(req.body)
    return advisors.attachDiagnostic(req.auth!.userId, body.snapshot, req.ip)
  })


  /* ════ بوّاباتي ════

     مديرُ النظام يملك صلاحيّاتِ المدرّب والمستشار، فيدخل بوّابتيهما — ثمّ
     تقول له كلُّ شاشةٍ «لا ملف مدرب مرتبطا بهذا الحساب». والصلاحيّةُ ليست
     الجواب: السؤالُ هل لهذا الحساب ملفٌّ في تلك البوّابة. فيُسأل مرّةً
     واحدةً في الإطار بدل أن تسقط كلُّ شاشةٍ على حدة. */
  app.get('/api/me/portals', {
    preHandler: requireAuth,
    schema: { tags: ['portal'], summary: 'هل لحسابي ملفُّ مدرّبٍ أو مستشار؟ — يقرؤه إطارُ البوّابة' },
  }, async (req) => {
    const userId = req.auth!.userId
    const [trainer, advisor] = await Promise.all([
      prisma.trainerProfile.findFirst({ where: { userId }, select: { id: true } }),
      prisma.advisorProfile.findUnique({ where: { userId }, select: { id: true } }),
    ])
    return { trainer: trainer !== null, advisor: advisor !== null }
  })

  /* ════ السير الذاتية ════ */
  app.post('/api/learner/cv', {
    preHandler: requirePermission('cv.upload'),
    schema: { tags: ['cv'], summary: 'رفع سيرة — موافقة صريحة إلزامية، تحقق نوع وحجم، رابط رفع موقع' },
  }, async (req, reply) => {
    const body = z.object({
      originalName: z.string().min(1).max(200), mime: z.string(),
      sizeBytes: z.number().int().positive(), consent: z.literal(true),
    }).parse(req.body)
    return reply.status(201).send(await cvs.upload(req.auth!.userId, body, req.ip))
  })

  app.get('/api/learner/cv', {
    preHandler: requireAuth,
    schema: { tags: ['cv'], summary: 'سيري الذاتية الفعالة' },
  }, async (req) => cvs.listMine(req.auth!.userId))

  app.get('/api/cv/:id/read-url', {
    preHandler: requireAuth,
    schema: { tags: ['cv'], summary: 'رابط قراءة موقع — مالك أو مستشار مسند أو إدارة؛ كل مشاهدة مسجلة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const url = await cvs.readUrl(id, req.auth!.userId, req.auth!.permissions, req.ip)
    return { url }
  })

  app.post('/api/cv/:id/delete', {
    preHandler: requireAuth,
    schema: { tags: ['cv'], summary: 'حذف سيرة وفق السياسة — سبب موثق، حذف منطقي' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ reason: z.string().min(5) }).parse(req.body)
    return cvs.remove(id, req.auth!.userId, req.auth!.permissions, body.reason)
  })
}

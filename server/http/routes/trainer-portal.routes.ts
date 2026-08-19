/* مسارات بوابة المدرب — ملفي، تأهيلي وإسناداتي، مخطط دورة مؤهل لها،
   اقتراح تعديل، وسحب اقتراح. كلها تتطلب صلاحيات دور trainer الفعلية. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { TrainerChangeService } from '../../services/trainer-change.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { EarningsService } from '../../services/earnings.service'
import { requirePermission } from '../auth-plugin'

export function registerTrainerPortalRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const changes = new TrainerChangeService(prisma)
  const review = new TrainerReviewService(prisma)
  const earnings = new EarningsService(prisma)

  app.get('/api/trainer/earnings', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'كشوف مستحقاتي وبنودها وملخصها — للمدرب نفسه فقط' },
  }, async (req) => earnings.listForTrainer(req.auth!.userId))

  app.get('/api/trainer/me', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'ملف المدرب الحالي — تأهيله وإسناداته ومهام التهيئة' },
  }, async (req) => {
    const profile = await changes.profileForUser(req.auth!.userId)
    const full = await prisma.trainerProfile.findUnique({
      where: { id: profile.id },
      include: {
        application: { select: { fullName: true, email: true, status: true, reference: true } },
        qualifications: true, assignments: { include: { cohort: true } }, onboardingTasks: true,
        contracts: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    return full
  })

  app.get('/api/trainer/me/qualifications', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'الدورات المؤهل لها مع عناوينها' },
  }, async (req) => {
    const profile = await changes.profileForUser(req.auth!.userId)
    const quals = await prisma.trainerCourseQualification.findMany({
      where: { profileId: profile.id, status: 'qualified' },
      include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } },
    })
    return quals.map((q) => ({
      courseId: q.courseId, title: q.course.versions[0]?.titleAr ?? '',
      currentVersion: q.course.currentVersion, qualifiedAt: q.createdAt,
    }))
  })

  app.get('/api/trainer/courses/:courseId/blueprint', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'المخطط الأساسي (Blueprint) لدورة مؤهل لها — للقراءة والاقتراح' },
  }, async (req) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params)
    const profile = await changes.profileForUser(req.auth!.userId)
    /* لا قراءة لمخطط دورة غير مؤهل لها ولا مسندة إليه */
    const [qual, assignment] = await Promise.all([
      prisma.trainerCourseQualification.findUnique({ where: { profileId_courseId: { profileId: profile.id, courseId } } }),
      prisma.trainerCourseAssignment.findFirst({ where: { profileId: profile.id, courseId, status: 'active' } }),
    ])
    if (qual?.status !== 'qualified' && !assignment) {
      return { error: { code: 'not_qualified', message_ar: 'لا يمكنك عرض مخطط دورة غير مؤهل لها' } }
    }
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        versions: { where: { version: { not: undefined } }, orderBy: { version: 'desc' }, take: 1,
          include: { objectives: true, outcomes: true, project: true, assessments: true } },
        modules: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } },
        skillLinks: true, pathwayLinks: true,
      },
    })
    return course
  })

  app.post('/api/trainer/change-requests', {
    preHandler: requirePermission('trainer.change.submit'),
    schema: { tags: ['trainer-portal'], summary: 'اقتراح تعديل على دورة — لا يطبق قبل الاعتماد والنشر' },
  }, async (req, reply) => {
    const body = z.object({
      courseId: z.string(), scope: z.enum(['cohort', 'catalog']), cohortId: z.string().uuid().optional(),
      reason: z.string().min(10), evidence: z.string().max(3000).optional(),
      items: z.array(z.object({
        changeType: z.string(), /* يُتحقق منه داخل الخدمة مقابل CHANGE_TYPES */
        targetKey: z.string().optional(),
        beforeValue: z.unknown().optional(), afterValue: z.unknown().optional(),
        note: z.string().optional(),
      })).min(1),
    }).parse(req.body)
    const request = await changes.submit(req.auth!.userId, body as never)
    return reply.status(201).send(request)
  })

  app.get('/api/trainer/change-requests', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'اقتراحاتي وحالاتها وتعليقات المراجعين' },
  }, async (req) => changes.listMine(req.auth!.userId))

  app.post('/api/trainer/change-requests/:id/withdraw', {
    preHandler: requirePermission('trainer.change.submit'),
    schema: { tags: ['trainer-portal'], summary: 'سحب اقتراح لم يُبت فيه' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return changes.withdraw(req.auth!.userId, id)
  })

  /* عام: صفحة المدربين بالموقع واسم مدرب الدورة */
  app.get('/api/trainers/public', {
    schema: { tags: ['trainer-portal'], summary: 'المدربون الظاهرون للعامة — موثقون وبموافقة نشر فقط' },
  }, async () => review.listPublicTrainers())

  app.get('/api/courses/:courseId/trainer', {
    schema: { tags: ['trainer-portal'], summary: 'مدرب الدورة المعلن — أو عبارة «يُعلن عند اعتماد الشعبة»' },
  }, async (req) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params)
    return review.publicCourseTrainer(courseId)
  })
}

/* مسارات بوابة المدرب — ملفي، تأهيلي وإسناداتي، مخطط دورة مؤهل لها،
   اقتراح تعديل، وسحب اقتراح. كلها تتطلب صلاحيات دور trainer الفعلية. */

import { readableModuleVersion } from '../../catalog/module-version-visibility'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { TrainerChangeService } from '../../services/trainer-change.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { EarningsService } from '../../services/earnings.service'
import { TrainerAvailabilityService } from '../../services/trainer-availability.service'
import { TermService } from '../../services/term.service'
import { requirePermission } from '../auth-plugin'
import { AuthError } from '../../services/auth.service'

export function registerTrainerPortalRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const changes = new TrainerChangeService(prisma)
  const review = new TrainerReviewService(prisma)
  const earnings = new EarningsService(prisma)
  const availability = new TrainerAvailabilityService(prisma)
  const terms = new TermService(prisma)

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

  /* مهام التهيئة تُكمَل من صاحبها.

     أربع مهام تُزرع عند القبول المشروط، ويُغلَق «توقيع العقد» تلقائيا عند
     التوقيع — والثلاث الباقية لم يكن لها طريق إغلاق في الشيفرة كلها: لا مسار
     ولا زر ولا حتى نداء إداري. فتبقى معلّقة في ملف كل مدرب إلى الأبد.
     الإغلاق هنا للمدرب على مهامّه هو وحدها؛ و«توقيع العقد» مستثنى لأنه يُغلَق
     بواقعة موثقة لا بإقرار صاحبه. */
  app.post('/api/trainer/me/onboarding-tasks/:key/complete', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'إتمام مهمة تهيئة من مهامي' },
  }, async (req) => {
    const { key } = z.object({ key: z.string().min(2).max(64) }).parse(req.params)
    if (key === 'sign_contract') {
      throw new AuthError('not_self_completable', 'توقيع العقد يُغلق بتوقيعه لا بإقرارك', 409)
    }
    const profile = await changes.profileForUser(req.auth!.userId)
    const task = await prisma.trainerOnboardingTask.findUnique({
      where: { profileId_key: { profileId: profile.id, key } },
    })
    if (!task) throw new AuthError('not_found', 'لا مهمة بهذا المفتاح في ملفك', 404)
    if (task.doneAt) return task
    return prisma.trainerOnboardingTask.update({
      where: { profileId_key: { profileId: profile.id, key } },
      data: { doneAt: new Date() },
    })
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
        modules: { include: { versions: { ...readableModuleVersion(), take: 1 } } },
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

  app.get('/api/trainer/catalog-scope', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'أهليتي لنطاق الكتالوج — تُقرأ قبل كتابة اقتراح (هـ-١)' },
  }, async (req) => changes.myCatalogScope(req.auth!.userId))

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

  /* ═══ إتاحتي: ساعاتٌ أسبوعيّةٌ وغياب (المهمّة ٧١) ═══
     الصلاحيّةُ `trainer.portal` نفسُها: هذا إعلانُ المدرّبِ عن وقتِه، لا
     تصرّفٌ في شعبةٍ ولا في مال. والحكمُ على ما يُعلنه في `cohort.service.ts`:
     الغيابُ يردّ الإسناد، والساعاتُ تُعَدُّ للمُسنِد ولا تمنعه. */
  app.get('/api/trainer/me/availability', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'ساعاتي المعلنة وفترات غيابي' },
  }, async (req) => availability.mine(req.auth!.userId))

  app.put('/api/trainer/me/availability', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'إعلانُ ساعات الأسبوع — استبدالٌ كامل لا إضافة' },
  }, async (req) => {
    const body = z.object({
      windows: z.array(z.object({
        weekday: z.number().int().min(0).max(6),
        startMinute: z.number().int().min(0).max(1440),
        endMinute: z.number().int().min(0).max(1440),
      })).max(21),
    }).parse(req.body)
    return availability.replaceWindows(req.auth!.userId, body.windows)
  })

  app.post('/api/trainer/me/blackouts', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'تسجيلُ فترة غياب — تردُّ إسنادَ أيّ جلسةٍ تقع فيها' },
  }, async (req, reply) => {
    const body = z.object({
      startsAt: z.coerce.date(), endsAt: z.coerce.date(),
      reason: z.string().trim().max(120).optional(),
    }).parse(req.body)
    const created = await availability.addBlackout(req.auth!.userId, body)
    return reply.status(201).send(created)
  })

  app.delete('/api/trainer/me/blackouts/:id', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'حذفُ فترة غياب سجّلها المدرّب' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return availability.removeBlackout(req.auth!.userId, id)
  })

  /* ═══ فصولي — الطرفُ الغائبُ من الجدول (البند ٥٣) ═══

     `TrainerTermAvailability` لها ثلاثُ حالاتٍ منذ أُنشئت، والمسلكُ الوحيدُ
     الذي يكتبها محروسٌ بـ`trainer.assign`: **الإدارةُ تُعلن نيابةً عن
     المدرّب**، وهو لا يملك أن يؤكّد ولا أن يعتذر. فبقيت القائمةُ ما ورّثه
     الترحيلُ من مواسمَ أعلنها في طلبه قبل شهور.

     والصلاحيّةُ هنا `trainer.portal` كإعلان ساعاته وغيابه: هذا قولُ المدرّب
     عن وقتِه، لا تصرّفٌ في شعبةٍ ولا في مال. **والملفُّ يُشتقّ من الجلسة لا
     من الطلب** — فلا يُعلن أحدٌ نيابةً عن غيره من هنا. */
  app.get('/api/trainer/me/terms', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'فصولي — موقفي من كلّ فصلٍ حيّ وما خُطِّط لي فيه' },
  }, async (req) => {
    const profile = await changes.profileForUser(req.auth!.userId)
    return terms.trainerTerms(profile.id)
  })

  app.post('/api/trainer/me/terms/:termId', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'أتاحُ في هذا الفصل — أو أعتذر عنه' },
  }, async (req) => {
    const { termId } = z.object({ termId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      /* و`declared` ليست خيارا هنا: هي ما يكتبه الترحيلُ والإدارة. وما يقوله
         المدرّبُ بنفسه تأكيدٌ أو اعتذار — لا حالةٌ ثالثةٌ ملتبسة. */
      status: z.enum(['confirmed', 'declined']),
      maxCohorts: z.number().int().min(1).max(20).nullable().optional(),
      note: z.string().trim().max(500).nullable().optional(),
    }).parse(req.body)
    const profile = await changes.profileForUser(req.auth!.userId)
    return terms.setTrainerAvailability(profile.id, termId, req.auth!.userId, body)
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

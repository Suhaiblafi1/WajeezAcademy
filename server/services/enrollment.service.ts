/* خدمة التسجيل — إلحاق المتعلمين بالشعب مع حراسة السعة والوصول.
   القاعدة الذهبية: لا يرى المتعلم محتوى شعبة غير مسجل فيها. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

export class EnrollmentService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** تسجيل متعلم — يملأ السعة ثم يحوّل الفائض لقائمة انتظار؛ التجاوز يتطلب override موثقا */
  async enroll(cohortId: string, userId: string, actorId: string | null, opts: { overrideCapacity?: boolean } = {}) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    if (!['open', 'full', 'active'].includes(cohort.status) || !cohort.registrationOpen) {
      throw new AuthError('closed', 'التسجيل في هذه الشعبة غير مفتوح', 409)
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { roles: true } })
    if (!user || user.status !== 'active') throw new AuthError('unknown_user', 'المستخدم غير موجود أو موقوف', 404)

    const existing = await this.prisma.enrollment.findUnique({ where: { cohortId_userId: { cohortId, userId } } })
    if (existing && existing.status !== 'dropped') throw new AuthError('already_enrolled', 'المتعلم مسجل في هذه الشعبة مسبقا', 409)

    const enrolledCount = await this.prisma.enrollment.count({ where: { cohortId, status: 'enrolled' } })
    const capacity = cohort.capacity ?? 0
    let status: 'enrolled' | 'waitlisted' = 'enrolled'
    let override = false
    if (capacity > 0 && enrolledCount >= capacity) {
      if (!opts.overrideCapacity) status = 'waitlisted'
      else override = true
    }

    const enrollment = existing
      ? await this.prisma.enrollment.update({ where: { id: existing.id }, data: { status, overrideCapacity: override, enrolledBy: actorId } })
      : await this.prisma.enrollment.create({
          data: { cohortId, userId, status, overrideCapacity: override, enrolledBy: actorId },
        })

    /* امتلاء السعة يقلب حالة الشعبة إلى full */
    const nowEnrolled = await this.prisma.enrollment.count({ where: { cohortId, status: 'enrolled' } })
    if (capacity > 0 && nowEnrolled >= capacity && cohort.status === 'open') {
      await this.prisma.cohort.update({ where: { id: cohortId }, data: { status: 'full' } })
    }

    /* تجهيز سجل التقدم الفارغ */
    await this.prisma.courseProgress.upsert({
      where: { enrollmentId: enrollment.id },
      update: {},
      create: { enrollmentId: enrollment.id, percent: 0, evidence: {} },
    })

    await recordAudit(this.prisma, {
      actorId, action: 'enrollment.create', entityType: 'enrollment', entityId: enrollment.id,
      meta: { cohortId, userId, status, overrideCapacity: override },
    })
    return enrollment
  }

  async drop(enrollmentId: string, actorId: string | null, note?: string) {
    const e = await this.prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: 'dropped' } })
    await recordAudit(this.prisma, { actorId, action: 'enrollment.drop', entityType: 'enrollment', entityId: enrollmentId, meta: { note } })
    return e
  }

  /** حارس الوصول: هل هذا المستخدم مسجل (وليس منسحبا) في شعبة هذا المحتوى؟ */
  async assertEnrolled(userId: string, cohortId: string) {
    const e = await this.prisma.enrollment.findUnique({ where: { cohortId_userId: { cohortId, userId } } })
    if (!e || e.status === 'dropped' || e.status === 'waitlisted') {
      throw new AuthError('not_enrolled', 'لا تملك وصولا لهذا المحتوى — أنت غير مسجل في هذه الشعبة', 403)
    }
    return e
  }

  /** هل المستخدم مدرب لهذه الشعبة؟ — حارس بوابة المدرب التشغيلية */
  async assertCohortTrainer(userId: string, cohortId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId } })
    if (!profile || profile.suspendedAt) throw new AuthError('not_trainer', 'لا ملف مدرب نشطا لهذا الحساب', 403)
    const link = await this.prisma.cohortTrainer.findUnique({
      where: { cohortId_profileId: { cohortId, profileId: profile.id } },
    })
    if (!link) throw new AuthError('not_cohort_trainer', 'هذه الشعبة ليست من شعبك', 403)
    return { profile, link }
  }

  /** محتوى المتعلم لشعبة — جلسات + روابط zoom + تسجيلات ومواد بروابط موقعة + حضوره */
  async learnerCohortView(enrollmentId: string) {
    const e = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        cohort: {
          include: {
            course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } },
            sessions: {
              orderBy: { startsAt: 'asc' },
              include: { zoom: true, recordings: { where: { status: 'active' } } },
            },
            materials: { where: { status: 'active' } },
            assessments: { where: { status: 'published' }, include: { items: true, rubric: { include: { criteria: true } } } },
            trainers: { include: { profile: { include: { application: { select: { fullName: true } } } } } },
          },
        },
        attendance: true,
        courseProgress: true,
        moduleProgress: true,
        submissions: { include: { grades: { include: { history: true } }, feedback: true, assessment: true } },
        attempts: { include: { grades: true, assessment: true } },
        certificates: { include: { revocation: true } },
      },
    })
    if (!e) throw new AuthError('not_found', 'التسجيل غير موجود', 404)
    return e
  }

  async myEnrollments(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId, status: { not: 'dropped' } },
      include: {
        cohort: {
          include: {
            course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } },
            trainers: { include: { profile: { include: { application: { select: { fullName: true } } } } } },
          },
        },
        courseProgress: true,
        certificates: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /** شعب المدرب — لا يرى شعب غيره أبدا */
  async trainerCohorts(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId } })
    if (!profile || profile.suspendedAt) throw new AuthError('not_trainer', 'لا ملف مدرب نشطا لهذا الحساب', 403)
    const links = await this.prisma.cohortTrainer.findMany({
      where: { profileId: profile.id },
      include: {
        cohort: {
          include: {
            course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } },
            sessions: { orderBy: { startsAt: 'asc' }, include: { zoom: true, recordings: true } },
            enrollments: {
              where: { status: { not: 'dropped' } },
              include: {
                courseProgress: true, attendance: true,
                user: { select: { displayName: true, email: true } },
              },
            },
            materials: true,
            assessments: { include: { submissions: true, items: true } },
          },
        },
      },
    })
    return links.map((l) => ({ role: l.role, cohort: l.cohort }))
  }
}

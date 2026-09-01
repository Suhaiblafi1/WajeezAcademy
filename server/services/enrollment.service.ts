/* خدمة التسجيل — إلحاق المتعلمين بالشعب مع حراسة السعة والوصول.
   القاعدة الذهبية: لا يرى المتعلم محتوى شعبة غير مسجل فيها. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { safeNotify } from './notification.service'

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

  /* تبديلُ الشعبة قبل أن تبدأ — الدورةُ نفسُها، والمقعدُ يُنقل لا يُشترى.

     قرارُ صاحب المنصّة: «لا يحقّ له تغيير مساره بعد الدفع. فقط التنقّل بين
     الشعب ما دامت لم تبدأ بالفعل».

     وقيدُ **الدورة نفسِها** هو تطبيقُ الشقّ الأوّل: لو جاز الانتقال إلى شعبة
     دورةٍ أخرى لصار «تبديلُ شعبة» بابا خلفيّا لتبديل المسار كلِّه، دورةً
     دورة، بلا فاتورةٍ ولا فرقِ سعر.

     وقيدُ **قبل البدء** هو الشقّ الثاني، ويُقاس بموعد الشعبة **المغادَرة**
     أيضا: من حضر جلستين ثمّ انتقل يأخذ محتوى شعبةٍ لم يبدأها ويترك أثرَه في
     أخرى — والحضورُ والتسليماتُ معلَّقةٌ بالتسجيل لا بالشعبة، فتنتقل معه إلى
     شعبةٍ لم تُعقد جلساتُها.

     والسعرُ لا يُتجاوَز صامتا: شعبةٌ أغلى تُرفض برسالةٍ تقول لماذا، لا
     تُقبَل فتُؤخذ قيمةٌ لم تُدفع. والأرخصُ يُقبَل — فالدورةُ هي هي، والفرقُ
     تاريخُ تسعير الشعبة لا ما يناله المتعلّم. */
  async switchCohort(userId: string, enrollmentId: string, toCohortId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { cohort: true, _count: { select: { attendance: true, submissions: true, attempts: true } } },
    })
    if (!enrollment || enrollment.userId !== userId) {
      throw new AuthError('not_found', 'هذا التسجيل ليس لك', 404)
    }
    if (enrollment.status !== 'enrolled') {
      throw new AuthError('not_switchable', 'لا يُبدَّل إلا تسجيلٌ قائم', 409)
    }
    if (enrollment.cohortId === toCohortId) {
      throw new AuthError('same_cohort', 'هذه شعبتك الحالية', 409)
    }

    const now = new Date()
    if (enrollment.cohort.startsAt && enrollment.cohort.startsAt <= now) {
      throw new AuthError('already_started', 'شعبتك بدأت — راسلنا لترتيب نقلك', 409)
    }
    const { attendance, submissions, attempts } = enrollment._count
    if (attendance + submissions + attempts > 0) {
      /* أثرٌ في شعبةٍ «لم تبدأ» بحسب التقويم: جلسةٌ قُدّمت أو تسليمٌ مبكّر.
         والأثرُ معلَّقٌ بالتسجيل، فينتقل معه إلى شعبةٍ لم تُعقد جلساتُها. */
      throw new AuthError('has_activity', 'لك نشاطٌ مسجَّل في هذه الشعبة — راسلنا لترتيب نقلك', 409)
    }

    const to = await this.prisma.cohort.findUnique({ where: { id: toCohortId } })
    if (!to) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    if (to.courseId !== enrollment.cohort.courseId) {
      throw new AuthError('other_course', 'التبديل بين شعب الدورة نفسها — ولا يُغيَّر المسار بعد الدفع', 409)
    }
    if (!['open', 'full'].includes(to.status) || !to.registrationOpen) {
      throw new AuthError('closed', `التسجيل مغلق في «${to.title}»`, 409)
    }
    if (to.startsAt && to.startsAt <= now) {
      throw new AuthError('already_started', `«${to.title}» بدأت — اختر شعبةً لم تبدأ`, 409)
    }
    if (to.price !== null && enrollment.cohort.price !== null && Number(to.price) > Number(enrollment.cohort.price)) {
      throw new AuthError('price_higher', `«${to.title}» أعلى سعرا ممّا دفعت — راسلنا لتسوية الفرق`, 409)
    }
    if (to.capacity) {
      const [enrolled, held] = await Promise.all([
        this.prisma.enrollment.count({ where: { cohortId: to.id, status: 'enrolled' } }),
        this.prisma.enrollmentRequest.count({ where: { cohortId: to.id, status: 'seat_held' } }),
      ])
      if (enrolled + held >= to.capacity) throw new AuthError('capacity_full', `لا مقاعد متاحة في «${to.title}»`, 409)
    }
    /* مقعدٌ في الوجهة من قبل — لا يُنشأ تسجيلان لدورةٍ واحدة */
    const clash = await this.prisma.enrollment.findUnique({
      where: { cohortId_userId: { cohortId: to.id, userId } },
    })
    if (clash && clash.status !== 'dropped') {
      throw new AuthError('already_enrolled', `أنت مسجّل في «${to.title}» بالفعل`, 409)
    }

    const from = enrollment.cohort
    const moved = await this.prisma.$transaction(async (tx) => {
      if (clash) await tx.enrollment.delete({ where: { id: clash.id } })
      const e = await tx.enrollment.update({ where: { id: enrollmentId }, data: { cohortId: to.id } })
      /* سجلُّ حجز المقعد ينتقل معه: تركُه على الشعبة المغادَرة يُبقيها تُحسب
         ممتلئةً بمقعدٍ لا أحد فيه، ويُخرج الوجهةَ من عدّ المقاعد. */
      const req = await tx.enrollmentRequest.findUnique({
        where: { userId_cohortId: { userId, cohortId: from.id } },
      })
      if (req) {
        const atTarget = await tx.enrollmentRequest.findUnique({
          where: { userId_cohortId: { userId, cohortId: to.id } },
        })
        if (atTarget) await tx.enrollmentRequest.delete({ where: { id: atTarget.id } })
        await tx.enrollmentRequest.update({ where: { id: req.id }, data: { cohortId: to.id } })
      }
      /* الشعبةُ المغادَرة تعود مفتوحةً إن كانت أُغلقت بالامتلاء وحدَه */
      if (from.status === 'full' && from.capacity) {
        const left = await tx.enrollment.count({ where: { cohortId: from.id, status: 'enrolled' } })
        if (left < from.capacity) await tx.cohort.update({ where: { id: from.id }, data: { status: 'open' } })
      }
      if (to.status === 'open' && to.capacity) {
        const filled = await tx.enrollment.count({ where: { cohortId: to.id, status: 'enrolled' } })
        if (filled >= to.capacity) await tx.cohort.update({ where: { id: to.id }, data: { status: 'full' } })
      }
      return e
    })

    await recordAudit(this.prisma, {
      actorId: userId, action: 'enrollment.switch_cohort', entityType: 'enrollment', entityId: enrollmentId,
      meta: {
        courseId: from.courseId,
        from: from.id, fromTitle: from.title, fromStartsAt: from.startsAt,
        to: to.id, toTitle: to.title, toStartsAt: to.startsAt,
      },
    })
    /* مقعدٌ في الشعبة المغادَرة ربما تحرّر — أول من في قائمة انتظارها يُرقّى */
    await this.freeSeat(from.id)
    return moved
  }

  async drop(enrollmentId: string, actorId: string | null, note?: string) {
    const existing = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId } })
    if (!existing) throw new AuthError('not_found', 'التسجيل غير موجود', 404)
    const e = await this.prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: 'dropped' } })
    await recordAudit(this.prisma, { actorId, action: 'enrollment.drop', entityType: 'enrollment', entityId: enrollmentId, meta: { note } })
    /* من انسحب مسجَّلا من شعبة ممتلئة يفتح مقعدا — لا يبقى شاغرا بلا من يشغله */
    if (existing.status === 'enrolled') await this.freeSeat(existing.cohortId)
    return e
  }

  /** مقعدٌ تحرّر في شعبة — تعود «مفتوحة» إن كانت أُغلقت بالامتلاء وحده، وأوّل
      من في قائمة انتظارها يُرقّى مكانه تلقائيا فيصير «مسجَّلا» ويُشعَر بذلك.
      حارسٌ صامتٌ لا يفعل شيئا إن لم يتحرّر مقعدٌ فعلا أو لم تكن الشعبة محدودة
      السعة أصلا — فيصحّ استدعاؤه من أيّ مسارٍ يُحتمل أن يُخلي مقعدا. */
  private async freeSeat(cohortId: string): Promise<void> {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } })
    if (!cohort || !cohort.capacity) return

    const enrolledCount = await this.prisma.enrollment.count({ where: { cohortId, status: 'enrolled' } })
    if (enrolledCount >= cohort.capacity) return

    if (cohort.status === 'full') {
      await this.prisma.cohort.update({ where: { id: cohortId }, data: { status: 'open' } })
    }

    const next = await this.prisma.enrollment.findFirst({
      where: { cohortId, status: 'waitlisted' },
      orderBy: { createdAt: 'asc' },
    })
    if (!next) return

    const promoted = await this.prisma.enrollment.update({ where: { id: next.id }, data: { status: 'enrolled' } })
    await this.prisma.courseProgress.upsert({
      where: { enrollmentId: promoted.id }, update: {},
      create: { enrollmentId: promoted.id, percent: 0, evidence: {} },
    })
    if (enrolledCount + 1 >= cohort.capacity) {
      await this.prisma.cohort.update({ where: { id: cohortId }, data: { status: 'full' } })
    }
    await recordAudit(this.prisma, {
      actorId: null, action: 'enrollment.auto_promote', entityType: 'enrollment', entityId: promoted.id,
      meta: { cohortId },
    })
    await safeNotify(this.prisma, {
      userId: promoted.userId, channel: 'in_app',
      title: 'تأكد مقعدك — صرت مسجَّلا',
      body: `فتح مقعدٌ في «${cohort.title}» وكنت أوّل قائمة الانتظار، فسجَّلناك تلقائيا.`,
      templateKey: 'enrollment.auto_promoted',
      data: { cohortId },
    })
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

  /** نواتج المتعلم — كلُّ ما سلّمه عبر تسجيلاته، مرتّبا بالأحدث.
      خزانةُ النواتج تُبنى عليها، وهي قراءةٌ محضة لما حدث فعلا: لا يظهر فيها
      ناتجٌ لم يُسلَّم، ولا يُوصف بالاعتماد ما لم يعتمده مدرّب. */
  async myArtifacts(userId: string) {
    const rows = await this.prisma.assignmentSubmission.findMany({
      where: { enrollment: { userId } },
      orderBy: { submittedAt: 'desc' },
      include: {
        assessment: {
          include: {
            cohort: { include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } } },
          },
        },
        grades: { orderBy: { createdAt: 'desc' }, take: 1 },
        feedback: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    /* لا مفاتيح تخزين إلى المتصفّح — الملف يُقرأ برابط موقّع عند طلبه */
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      submittedAt: r.submittedAt,
      reviewedAt: r.reviewedAt,
      hasFile: !!r.storageKey,
      textAnswer: r.textAnswer,
      reviewNote: r.reviewNote,
      moduleId: r.assessment.moduleId,
      assessmentTitle: r.assessment.title,
      assessmentType: r.assessment.type,
      cohortTitle: r.assessment.cohort.title,
      courseId: r.assessment.cohort.courseId,
      courseTitleAr: r.assessment.cohort.course.versions[0]?.titleAr ?? '',
      grade: r.grades[0] ? { score: Number(r.grades[0].score), maxScore: Number(r.grades[0].maxScore) } : null,
      feedbackAr: r.feedback[0]?.body ?? null,
    }))
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

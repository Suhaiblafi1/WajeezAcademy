/* خدمة مراجعة واعتماد المدربين — قرارات بشرية بالكامل:
   روبرك تسعة محاور، مقابلات، تقييم Demo، مراجع، قبول مشروط، عقد،
   دعوة آمنة لإنشاء الحساب، تأهيل لدورة، إسناد لشعبة، نشر عام، إيقاف.
   مبدأ الفصل: قبول الطلب ≠ إنشاء الحساب ≠ تفعيل الدور ≠ التأهيل ≠ التعيين ≠ النشر.
   المتقدم لا يمنح نفسه دور trainer أبدا — الحساب يُنشأ فقط عبر دعوة إدارية. */

import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { TrainerApplicationService } from './trainer-application.service'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')

/* محاور الروبرك البشري التسعة — كل محور من 1 إلى 5 */
export const RUBRIC_CRITERIA = [
  'domain_expertise', 'evidence_of_expertise', 'explanation_facilitation', 'demo_quality',
  'activity_assessment_design', 'feedback_skill', 'digital_training', 'values_fit', 'availability',
] as const
export type RubricKey = (typeof RUBRIC_CRITERIA)[number]

const INVITATION_TTL_MS = 72 * 3600_000 // 72 ساعة

function assertRubric(scores: Record<string, number>) {
  for (const key of RUBRIC_CRITERIA) {
    const v = scores[key]
    if (!Number.isInteger(v) || v < 1 || v > 5) {
      throw new AuthError('bad_rubric', `محور «${key}» يجب أن يكون تقييما صحيحا من 1 إلى 5`)
    }
  }
}

export class TrainerReviewService {
  private prisma: PrismaClient
  private apps: TrainerApplicationService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.apps = new TrainerApplicationService(prisma)
  }

  /* ─────────── عرض الإدارة ─────────── */

  async listApplications(status?: string) {
    const rows = await this.prisma.trainerApplication.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { specialties: true, _count: { select: { documents: true, reviews: true, interviews: true } } },
    })
    return rows.map((a) => ({
      id: a.id, reference: a.reference, status: a.status, fullName: a.fullName, email: a.email,
      country: a.country, jobTitle: a.jobTitle, domainYears: a.domainYears, trainingYears: a.trainingYears,
      specialties: a.specialties.map((s) => s.specialty), createdAt: a.createdAt,
      emailVerified: !!a.emailVerifiedAt, phase2Done: !!a.phase2CompletedAt,
      documentsCount: a._count.documents, reviewsCount: a._count.reviews, interviewsCount: a._count.interviews,
    }))
  }

  async getApplication(id: string) {
    const app = await this.prisma.trainerApplication.findUnique({
      where: { id },
      include: {
        specialties: true, documents: true, reviews: true, interviews: true,
        demoEvaluations: true, references: true, invitations: { select: { id: true, sentTo: true, expiresAt: true, usedAt: true, createdAt: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        profile: { include: { qualifications: true, assignments: true, contracts: true } },
      },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    return {
      ...app,
      accessTokenHash: undefined, emailVerifyTokenHash: undefined,
      documentUrls: this.apps.signedDocumentUrls(app.documents),
    }
  }

  /* ─────────── أدوات المراجعة البشرية ─────────── */

  async addReview(applicationId: string, reviewerId: string, scores: Record<string, number>, overallNote?: string) {
    assertRubric(scores)
    await this.requireStatus(applicationId, ['under_review', 'academic_review', 'shortlisted', 'interview_scheduled', 'demo_requested', 'information_requested'])
    const review = await this.prisma.trainerApplicationReview.create({
      data: { applicationId, reviewerId, scores: scores as unknown as Prisma.InputJsonValue, overallNote },
    })
    await recordAudit(this.prisma, {
      actorId: reviewerId, action: 'trainer.review.add', entityType: 'trainer_application', entityId: applicationId,
      meta: { reviewId: review.id, scores },
    })
    return review
  }

  async scheduleInterview(applicationId: string, actorId: string, input: { scheduledAt: Date; mode?: string; notes?: string }) {
    await this.requireStatus(applicationId, ['shortlisted', 'under_review'])
    const interview = await this.prisma.trainerInterview.create({
      data: { applicationId, scheduledAt: input.scheduledAt, mode: input.mode ?? 'remote', interviewerId: actorId, notes: input.notes },
    })
    await this.apps.transition(applicationId, 'interview_scheduled', actorId, 'جدولة مقابلة')
    return interview
  }

  async recordInterviewOutcome(interviewId: string, actorId: string, outcome: 'passed' | 'hold' | 'failed', notes?: string) {
    const interview = await this.prisma.trainerInterview.findUnique({ where: { id: interviewId } })
    if (!interview) throw new AuthError('not_found', 'المقابلة غير موجودة', 404)
    const updated = await this.prisma.trainerInterview.update({ where: { id: interviewId }, data: { outcome, notes } })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.interview.outcome', entityType: 'trainer_application', entityId: interview.applicationId,
      meta: { interviewId, outcome },
    })
    return updated
  }

  async recordDemoEvaluation(applicationId: string, evaluatorId: string, scores: Record<string, number>, decision: 'pass' | 'retry' | 'fail', notes?: string) {
    assertRubric(scores)
    await this.requireStatus(applicationId, ['demo_requested', 'academic_review', 'interview_scheduled'])
    const demo = await this.prisma.trainerDemoEvaluation.create({
      data: { applicationId, evaluatorId, scores: scores as unknown as Prisma.InputJsonValue, decision, notes },
    })
    await recordAudit(this.prisma, {
      actorId: evaluatorId, action: 'trainer.demo.evaluate', entityType: 'trainer_application', entityId: applicationId,
      meta: { demoId: demo.id, decision },
    })
    return demo
  }

  async addReference(applicationId: string, input: { name: string; relation?: string; contact?: string; note?: string }) {
    return this.prisma.trainerReference.create({ data: { applicationId, ...input } })
  }

  async verifyReference(referenceId: string, actorId: string) {
    return this.prisma.trainerReference.update({
      where: { id: referenceId }, data: { verifiedAt: new Date(), verifiedBy: actorId },
    })
  }

  /* ─────────── القرارات ───────────
     قرار بشري موثق — لا قرار آلي في هذه المنظومة. */

  async decide(applicationId: string, actorId: string, action:
    | 'move_to_review' | 'request_info' | 'shortlist' | 'request_demo' | 'academic_review'
    | 'conditionally_approve' | 'waitlist' | 'reject', note?: string) {
    /* حارس التضارب: لا يجوز لأحد اتخاذ قرار في طلب بريده هو */
    const app = await this.prisma.trainerApplication.findUnique({ where: { id: applicationId } })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    const actor = await this.prisma.user.findUnique({ where: { id: actorId } })
    if (actor && actor.email === app.email) {
      throw new AuthError('self_decision', 'لا يجوز اتخاذ قرار في طلب مرتبط ببريدك', 403)
    }

    const targets: Record<typeof action, Parameters<TrainerApplicationService['transition']>[1]> = {
      move_to_review: 'under_review',
      request_info: 'information_requested',
      shortlist: 'shortlisted',
      request_demo: 'demo_requested',
      academic_review: 'academic_review',
      conditionally_approve: 'conditionally_approved',
      waitlist: 'waitlisted',
      reject: 'rejected',
    }
    await this.apps.transition(applicationId, targets[action], actorId, note)

    /* القبول المشروط ينشئ ملف المدرب — قبل الحساب وقبل الدور */
    if (action === 'conditionally_approve') {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.trainerProfile.findUnique({ where: { applicationId } })
        if (!existing) {
          const profile = await tx.trainerProfile.create({
            data: { applicationId, headline: app.jobTitle ?? null, bioPublic: app.bio ?? null },
          })
          const taskSeeds = [
            { key: 'sign_contract', title: 'توقيع العقد' },
            { key: 'academy_orientation', title: 'التعريف بمنهجية الأكاديمية' },
            { key: 'lms_setup', title: 'تهيئة حساب منصة التدريب' },
            { key: 'first_cohort_brief', title: 'موجز الشعبة الأولى' },
          ]
          for (const t of taskSeeds) {
            await tx.trainerOnboardingTask.create({ data: { profileId: profile.id, key: t.key, title: t.title } })
          }
          await recordAudit(tx, {
            actorId, action: 'trainer.profile.create', entityType: 'trainer_profile', entityId: profile.id,
            meta: { applicationId },
          })
        }
      })
    }
  }

  /* ─────────── العقد ─────────── */

  async createContract(applicationId: string, actorId: string, input: { title: string; terms?: unknown }) {
    const profile = await this.profileFor(applicationId)
    const contract = await this.prisma.trainerContract.create({
      data: { profileId: profile.id, title: input.title, terms: input.terms as Prisma.InputJsonValue, createdBy: actorId, status: 'sent', sentAt: new Date() },
    })
    await this.apps.transition(applicationId, 'contract_pending', actorId, 'إرسال العقد')
    return contract
  }

  async signContract(contractId: string, actorId: string) {
    const contract = await this.prisma.trainerContract.findUnique({ where: { id: contractId }, include: { profile: true } })
    if (!contract || contract.status !== 'sent') throw new AuthError('bad_state', 'العقد ليس بانتظار التوقيع', 409)
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerContract.update({ where: { id: contractId }, data: { status: 'signed', signedAt: new Date() } })
      await tx.trainerOnboardingTask.updateMany({
        where: { profileId: contract.profileId, key: 'sign_contract' }, data: { doneAt: new Date() },
      })
      await recordAudit(tx, {
        actorId, action: 'trainer.contract.sign', entityType: 'trainer_contract', entityId: contractId,
      })
    })
    await this.apps.transition(contract.profile.applicationId, 'onboarding', actorId, 'توقيع العقد')
  }

  /* ─────────── الدعوة الآمنة وإنشاء الحساب ───────────
     تُرسل بعد الاعتماد والعقد فقط. الرمز يُحفظ هاش، صالح 72 ساعة، يُستخدم مرة. */

  async createInvitation(applicationId: string, actorId: string): Promise<{ tokenForDelivery: string; expiresAt: Date }> {
    const app = await this.prisma.trainerApplication.findUnique({ where: { id: applicationId }, include: { profile: true } })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (!['onboarding', 'contract_pending'].includes(app.status)) {
      throw new AuthError('bad_state', 'الدعوة تُرسل بعد الاعتماد المشروط ومرحلة العقد فقط', 409)
    }
    if (!app.profile) throw new AuthError('no_profile', 'لا ملف مدرب لهذا الطلب', 409)
    if (app.profile.userId) throw new AuthError('already_linked', 'الحساب أُنشئ وربط مسبقا', 409)

    const token = newToken()
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS)
    await this.prisma.trainerInvitation.create({
      data: { applicationId, tokenHash: sha256(token), sentTo: app.email, expiresAt, createdBy: actorId },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.invitation.create', entityType: 'trainer_application', entityId: applicationId,
      meta: { sentTo: app.email, expiresAt },
    })
    return { tokenForDelivery: token, expiresAt }
  }

  /** استهلاك الدعوة — ينشئ الحساب بدور trainer ويربط الملف ويفعّل الحالة */
  async consumeInvitation(token: string, password: string, displayName?: string): Promise<{ userId: string }> {
    if (password.length < 8) throw new AuthError('weak_password', 'كلمة المرور 8 أحرف على الأقل')
    const inv = await this.prisma.trainerInvitation.findUnique({
      where: { tokenHash: sha256(token) }, include: { application: { include: { profile: true } } },
    })
    if (!inv || inv.usedAt) throw new AuthError('invalid_token', 'الدعوة غير صالحة أو مستخدمة', 400)
    if (inv.expiresAt < new Date()) throw new AuthError('expired_token', 'الدعوة منتهية — اطلب إعادة إرسالها', 410)
    const app = inv.application
    if (!app.profile) throw new AuthError('no_profile', 'لا ملف مدرب لهذه الدعوة', 409)

    const email = app.email
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) throw new AuthError('email_taken', 'يوجد حساب بهذا البريد — سجّل الدخول واطلب ربط الملف من الإدارة', 409)

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email, displayName: displayName?.trim() || app.fullName,
          passwordHash: await bcrypt.hash(password, 10),
          roles: { create: { roleId: 'trainer' } },
        },
      })
      await tx.trainerProfile.update({ where: { id: app.profile!.id }, data: { userId: user.id } })
      await tx.trainerInvitation.update({ where: { id: inv.id }, data: { usedAt: new Date() } })
      await recordAudit(tx, {
        actorId: user.id, action: 'trainer.account.activate', entityType: 'trainer_profile', entityId: app.profile!.id,
        meta: { applicationId: app.id },
      })
      /* تفعيل الحالة — من onboarding أو contract_pending إلى active */
      const from = app.status
      await tx.trainerApplication.update({ where: { id: app.id }, data: { status: 'active' } })
      await tx.trainerStatusHistory.create({
        data: { applicationId: app.id, fromStatus: from, toStatus: 'active', actorId: user.id, note: 'إنشاء الحساب عبر الدعوة الآمنة' },
      })
      return { userId: user.id }
    })
  }

  /* ─────────── التأهيل والإسناد والنشر العام والإيقاف ─────────── */

  async qualifyForCourse(profileId: string, courseId: string, actorId: string, note?: string) {
    const profile = await this.requireActiveProfile(profileId)
    const course = await this.prisma.course.findUnique({ where: { id: courseId } })
    if (!course) throw new AuthError('unknown_course', 'الدورة غير موجودة في الكتالوج')
    const q = await this.prisma.trainerCourseQualification.upsert({
      where: { profileId_courseId: { profileId, courseId } },
      update: { status: 'qualified', qualifiedBy: actorId, note },
      create: { profileId, courseId, status: 'qualified', qualifiedBy: actorId, note },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.qualify', entityType: 'trainer_profile', entityId: profile.id,
      meta: { courseId },
    })
    return q
  }

  async assignToCohort(profileId: string, courseId: string, cohortId: string | undefined, actorId: string) {
    const profile = await this.requireActiveProfile(profileId)
    /* الإسناد يتطلب تأهيلا قائما للدورة */
    const qual = await this.prisma.trainerCourseQualification.findUnique({
      where: { profileId_courseId: { profileId, courseId } },
    })
    if (!qual || qual.status !== 'qualified') {
      throw new AuthError('not_qualified', 'المدرب غير مؤهل لهذه الدورة — أهّله أولا', 409)
    }
    if (cohortId) {
      const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } })
      if (!cohort) throw new AuthError('unknown_cohort', 'الشعبة غير موجودة', 404)
    }
    const assignment = await this.prisma.trainerCourseAssignment.create({
      data: { profileId, courseId, cohortId, assignedBy: actorId },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.assign', entityType: 'trainer_profile', entityId: profile.id,
      meta: { courseId, cohortId },
    })
    return assignment
  }

  /** الموافقة على الظهور العام — لا ظهور إلا بملف موثق وموافقة نشر */
  async approvePublicVisibility(profileId: string, actorId: string) {
    const profile = await this.requireActiveProfile(profileId)
    await this.prisma.trainerProfile.update({
      where: { id: profile.id },
      data: { isVerified: true, publicVisibility: true, publishApprovedBy: actorId, publishApprovedAt: new Date() },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.publish_approve', entityType: 'trainer_profile', entityId: profile.id,
    })
  }

  async suspendTrainer(profileId: string, actorId: string, note?: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { id: profileId }, include: { application: true } })
    if (!profile) throw new AuthError('not_found', 'ملف المدرب غير موجود', 404)
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerProfile.update({
        where: { id: profileId }, data: { suspendedAt: new Date(), suspendedBy: actorId, publicVisibility: false },
      })
      if (profile.userId) {
        await tx.user.update({ where: { id: profile.userId }, data: { status: 'suspended', suspendedAt: new Date() } })
        await tx.session.updateMany({ where: { userId: profile.userId, revokedAt: null }, data: { revokedAt: new Date() } })
      }
      await recordAudit(tx, {
        actorId, action: 'trainer.suspend', entityType: 'trainer_profile', entityId: profileId, meta: { note },
      })
    })
    if (profile.application.status === 'active') {
      await this.apps.transition(profile.applicationId, 'suspended', actorId, note ?? 'إيقاف المدرب')
    }
  }

  /** القائمة العامة — active + موثق + publicVisibility + موافقة نشر، أو معيّن بشعبة منشورة */
  async listPublicTrainers() {
    const profiles = await this.prisma.trainerProfile.findMany({
      where: {
        publicVisibility: true, isVerified: true, publishApprovedAt: { not: null }, suspendedAt: null,
        application: { status: 'active' },
      },
      include: {
        application: { select: { fullName: true, country: true, specialties: true } },
        assignments: { where: { status: 'active' }, select: { courseId: true, cohortId: true } },
      },
    })
    return profiles.map((p) => ({
      id: p.id, name: p.application.fullName, headline: p.headline, bio: p.bioPublic,
      country: p.application.country,
      specialties: p.application.specialties.map((s) => s.specialty),
      assignedCourseIds: p.assignments.map((a) => a.courseId),
    }))
  }

  /** مدربو دورة معينة للعرض العام — أو عبارة الإعلان عند غياب معتمد */
  async publicCourseTrainer(courseId: string) {
    const assignments = await this.prisma.trainerCourseAssignment.findMany({
      where: { courseId, status: 'active', cohort: { status: { in: ['open', 'full', 'active'] } } },
      include: {
        profile: {
          include: { application: { select: { fullName: true } } },
        },
      },
    })
    const visible = assignments.filter((a) =>
      a.profile.publicVisibility && a.profile.isVerified && !a.profile.suspendedAt)
    if (!visible.length) return { announced: false, messageAr: 'يُعلن المدرب عند اعتماد الشعبة', trainers: [] }
    return {
      announced: true,
      trainers: visible.map((a) => ({ id: a.profile.id, name: a.profile.application.fullName, headline: a.profile.headline })),
    }
  }

  /* ─────────── الشعب وخطط التنفيذ ─────────── */

  async createCohort(actorId: string, input: { courseId: string; pathwayId?: string; title: string; startsAt?: Date; endsAt?: Date }) {
    const course = await this.prisma.course.findUnique({ where: { id: input.courseId } })
    if (!course) throw new AuthError('unknown_course', 'الدورة غير موجودة', 404)
    const cohort = await this.prisma.cohort.create({
      data: { courseId: input.courseId, pathwayId: input.pathwayId, title: input.title, startsAt: input.startsAt, endsAt: input.endsAt },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.create', entityType: 'cohort', entityId: cohort.id, meta: { courseId: input.courseId, title: input.title },
    })
    return cohort
  }

  async publishCohort(cohortId: string, actorId: string) {
    const cohort = await this.prisma.cohort.update({ where: { id: cohortId }, data: { status: 'open' } })
    await recordAudit(this.prisma, { actorId, action: 'cohort.publish', entityType: 'cohort', entityId: cohortId })
    return cohort
  }

  /* ─────────── أدوات داخلية ─────────── */

  private async requireStatus(applicationId: string, allowed: string[]) {
    const app = await this.prisma.trainerApplication.findUnique({ where: { id: applicationId }, select: { status: true } })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (!allowed.includes(app.status)) {
      throw new AuthError('bad_state', `حالة الطلب «${app.status}» لا تسمح بهذا الإجراء`, 409)
    }
  }

  private async profileFor(applicationId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { applicationId } })
    if (!profile) throw new AuthError('no_profile', 'لا ملف مدرب لهذا الطلب — القبول المشروط أولا', 409)
    return profile
  }

  private async requireActiveProfile(profileId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { id: profileId }, include: { application: true } })
    if (!profile) throw new AuthError('not_found', 'ملف المدرب غير موجود', 404)
    if (profile.suspendedAt || profile.application.status !== 'active') {
      throw new AuthError('not_active', 'المدرب ليس في حالة active', 409)
    }
    return profile
  }
}

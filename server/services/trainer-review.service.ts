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
import { buildIcs } from './calendar/ics'
import { TrainerApplicationService } from './trainer-application.service'
import { sendDirectEmail, notifyRole, publicSiteUrl, type DirectMailStatus } from './notification.service'
import { CohortService } from './cohort.service'
import { fmtDateWith } from '../../src/application/text/format-ar'

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
        profile: {
          include: {
            qualifications: {
              include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } } },
            },
            assignments: true,
            contracts: true,
            /* شعبُه الحالية وجلساتُها — لوحُ الملخّص يقرؤها ولا يستنتجها */
            cohortTrainers: {
              include: {
                cohort: {
                  include: {
                    course: { include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
                    sessions: { where: { status: { not: 'cancelled' } }, orderBy: { startsAt: 'asc' } },
                    _count: { select: { enrollments: true } },
                  },
                },
              },
            },
          },
        },
      },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)

    /* لوحُ الملخّص — ما يحتاجه من يقرّر في سطرٍ واحد، محسوبا هنا لا في الشاشة.

       قرارُ صاحب المنصّة: «أضف لوحةَ ملخّص على ملفّ المدرب تعرض: الدورات
       المحالة له، تقييمات الطلبة له، شعبه الحالية، وأقرب جلسة قادمة».
       ومن يبتّ في حالةٍ ينظر إلى أثرها: من له ثلاثُ شعبٍ جارية ليس كمن لا
       شعبةَ له، والقرارُ فيهما ليس واحدا. */
    const now = new Date()
    const cohortLinks = app.profile?.cohortTrainers ?? []
    const upcoming = cohortLinks
      .flatMap((t) => t.cohort.sessions.map((sn) => ({ ...sn, cohortTitle: t.cohort.title })))
      .filter((sn) => sn.startsAt > now)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0] ?? null

    return {
      ...app,
      accessTokenHash: undefined, emailVerifyTokenHash: undefined,
      documentUrls: this.apps.signedDocumentUrls(app.documents),
      summary: {
        qualifiedCourses: (app.profile?.qualifications ?? [])
          .filter((q) => q.status === 'qualified')
          .map((q) => ({ courseId: q.courseId, titleAr: q.course.versions[0]?.titleAr ?? q.courseId })),
        pendingQualifications: (app.profile?.qualifications ?? []).filter((q) => q.status === 'pending').length,
        cohorts: cohortLinks.map((t) => ({
          id: t.cohort.id, title: t.cohort.title, role: t.role, status: t.cohort.status,
          courseTitle: t.cohort.course.versions[0]?.titleAr ?? t.cohort.courseId,
          enrolled: t.cohort._count.enrollments,
          startsAt: t.cohort.startsAt,
        })),
        nextSession: upcoming
          ? { title: upcoming.title, startsAt: upcoming.startsAt, cohortTitle: upcoming.cohortTitle }
          : null,
        /* التقييمُ من خرّيجين حقيقيّين — و`null` يعني «لا تقييم بعد» لا صفرا */
        rating: app.profile?.ratingAvg ?? null,
        ratingCount: app.profile?.ratingCount ?? 0,
        publicVisibility: app.profile?.publicVisibility ?? false,
        suspendedAt: app.profile?.suspendedAt ?? null,
      },
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

  /* المقابلةُ كانت تُجدوَل في القاعدة ولا يُخبَر بها صاحبُها: لا رسالةَ
     ولا دعوةَ تقويم. فيُنتظَر متقدّمٌ لا يعرف أنّ له موعدا.

     فصار يصله بريدٌ فيه الموعدُ نصّا **ودعوةُ تقويم مرفَقة** يفتحها قوقل
     وآبل وأوتلوك. والإرسالُ لا يُعيق: تعذُّرُ البريد لا يُلغي الجدولة،
     ويعود حالُه في الردّ فيراه من جدول. */
  async scheduleInterview(applicationId: string, actorId: string, input: { scheduledAt: Date; mode?: string; notes?: string }) {
    await this.requireStatus(applicationId, ['shortlisted', 'under_review'])
    const interview = await this.prisma.trainerInterview.create({
      data: { applicationId, scheduledAt: input.scheduledAt, mode: input.mode ?? 'remote', interviewerId: actorId, notes: input.notes },
    })
    await this.apps.transition(applicationId, 'interview_scheduled', actorId, 'جدولة مقابلة')

    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: applicationId },
      select: { fullName: true, email: true, reference: true },
    })
    let emailDelivery: DirectMailStatus = 'not_configured'
    if (app) {
      const when = fmtDateWith(input.scheduledAt, {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Amman',
      })
      const remote = (input.mode ?? 'remote') !== 'in_person'
      const ics = buildIcs({
        uid: `interview-${interview.id}@wajeez-academy`,
        title: 'مقابلة انضمام إلى نخبة مدرّبي وجيز',
        startsAt: input.scheduledAt,
        durationMinutes: 45,
        description: `مقابلةٌ بشأن طلبك رقم ${app.reference}. ${remote ? 'عن بُعد — يصلك الرابط قبل الموعد.' : 'حضوريّة.'}`,
        url: `${publicSiteUrl()}/join-trainer`,
        organizer: { name: 'أكاديمية وجيز', email: 'Academy@wajeez.co' },
        attendee: { name: app.fullName, email: app.email },
      })
      const res = await sendDirectEmail(this.prisma, {
        to: app.email,
        subject: 'موعد مقابلتك مع أكاديمية وجيز',
        text: [
          `مرحبا ${app.fullName}،`,
          '',
          `حدّدنا موعد مقابلتك بشأن طلبك رقم ${app.reference}:`,
          `${when} (بتوقيت عمّان)`,
          remote ? 'المقابلة عن بُعد، ويصلك رابطها قبل الموعد.' : 'المقابلة حضوريّة.',
          '',
          'أرفقنا دعوة تقويم — افتحها لتُضاف إلى تقويمك مباشرة.',
          '',
          'وإن لم يناسبك الموعد فأخبرنا بالردّ على هذه الرسالة.',
        ].join('\n'),
        icsContent: ics,
        icsFilename: `wajeez-interview-${interview.id}.ics`,
      })
      emailDelivery = res.status
    }

    return { ...interview, emailDelivery }
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
    | 'conditionally_approve' | 'waitlist' | 'reject'
    | 'start_onboarding' | 'activate' | 'reinstate', note?: string) {
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
      /* ─────────── آخرُ السلسلة ───────────

         كانت السلسلةُ تنتهي عند «قبول مشروط»، ولا زرَّ بعده. فمن اجتاز
         المراجعةَ الأكاديميّة يبقى `conditionally_approved` أو
         `contract_pending` إلى الأبد ما لم يُنشئ حسابَه بنفسه من رابط
         الدعوة — أي أنّ آخرَ قرارٍ في مسار المدرّب لم يكن بيد الإدارة أصلا.

         والقرارُ الآن مكتمل: العقدُ يُرسَل، ثمّ `start_onboarding`، ثمّ
         `activate` — وهو الاعتمادُ النهائيّ الذي يجعله مدرّبا نشطا. */
      start_onboarding: 'onboarding',
      activate: 'active',
      reinstate: 'active',
    }

    /* التفعيلُ يشترط حسابا: مدرّبٌ «نشط» بلا حسابٍ لا يفتح بوابتَه ولا يُسنَد
       إليه شيء، وحالتُه في الشاشة تقول غيرَ الحقيقة. ولا يُقال هذا بعد
       الضغط بل يُمنع قبله. */
    if (action === 'activate') {
      const profile = await this.prisma.trainerProfile.findUnique({ where: { applicationId } })
      if (!profile) throw new AuthError('no_profile', 'لا ملف مدرب لهذا الطلب', 409)
      if (!profile.userId) {
        /* للمتقدّم حسابٌ منذ تقديمه: التفعيلُ يربطه بالملفّ ويمنحه دورَ المدرّب
           — فتُفتح له بوّابتُه من الحساب نفسه الذي تابع به طلبه. */
        if (app.userId) {
          await this.linkApplicantAsTrainer(profile.id, app.userId, actorId)
        } else {
          throw new AuthError(
            'no_account',
            'لا حساب لهذا المدرّب بعد — أرسل دعوة إنشاء الحساب أوّلا، فالتفعيل بلا حساب يجعله نشطا ولا يستطيع الدخول',
            409,
          )
        }
      }
    }

    await this.apps.transition(applicationId, targets[action], actorId, note)

    /* رفعُ الإيقاف يُعيد الملفَّ والحساب معا — وإلّا بقي «نشطا» وحسابُه موقوف */
    if (action === 'reinstate') {
      const profile = await this.prisma.trainerProfile.findUnique({ where: { applicationId } })
      if (profile) {
        await this.prisma.trainerProfile.update({
          where: { id: profile.id }, data: { suspendedAt: null, suspendedBy: null },
        })
        if (profile.userId) {
          await this.prisma.user.update({ where: { id: profile.userId }, data: { status: 'active', suspendedAt: null } })
        }
        await recordAudit(this.prisma, {
          actorId, action: 'trainer.reinstate', entityType: 'trainer_profile', entityId: profile.id, meta: { note },
        })
      }
    }

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

  /** ربطُ حساب المتقدّم بملفّ المدرّب ومنحُه دورَ المدرّب — دورُ التقديم يسقط */
  private async linkApplicantAsTrainer(profileId: string, userId: string, actorId: string | null): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerProfile.update({ where: { id: profileId }, data: { userId } })
      await tx.userRole.upsert({
        where: { userId_roleId: { userId, roleId: 'trainer' } },
        update: {}, create: { userId, roleId: 'trainer' },
      })
      await tx.userRole.deleteMany({ where: { userId, roleId: 'trainer_applicant' } })
      await recordAudit(tx, {
        actorId, action: 'trainer.account.link', entityType: 'trainer_profile', entityId: profileId,
        meta: { userId },
      })
    })
  }

  async createInvitation(applicationId: string, actorId: string): Promise<{
    tokenForDelivery: string
    expiresAt: Date
    acceptUrl: string
    emailDelivery: DirectMailStatus
  }> {
    const app = await this.prisma.trainerApplication.findUnique({ where: { id: applicationId }, include: { profile: true } })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (!['onboarding', 'contract_pending'].includes(app.status)) {
      throw new AuthError('bad_state', 'الدعوة تُرسل بعد الاعتماد المشروط ومرحلة العقد فقط', 409)
    }
    if (!app.profile) throw new AuthError('no_profile', 'لا ملف مدرب لهذا الطلب', 409)
    if (app.profile.userId) throw new AuthError('already_linked', 'الحساب أُنشئ وربط مسبقا', 409)
    if (app.userId) {
      throw new AuthError('has_account', 'للمتقدّم حسابٌ منذ تقديمه — لا دعوةَ تلزمه؛ زرّ التفعيل يربطه بملفّه ويفتح له بوّابته', 409)
    }

    const token = newToken()
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS)
    await this.prisma.trainerInvitation.create({
      data: { applicationId, tokenHash: sha256(token), sentTo: app.email, expiresAt, createdBy: actorId },
    })
    const acceptUrl = `${publicSiteUrl()}/trainer/accept-invite?token=${encodeURIComponent(token)}`
    const mail = await sendDirectEmail(this.prisma, {
      to: app.email,
      subject: 'دعوتك لإنشاء حساب مدرب — أكاديمية وجيز',
      text:
        `مرحبا ${app.fullName},\n\n` +
        `اكتمل اعتماد طلبك (${app.reference}) — وهذه دعوتك لإنشاء حسابك على منصة المدربين.\n` +
        `افتح الرابط واختر كلمة مرورك خلال 72 ساعة:\n${acceptUrl}\n\n` +
        `الرابط يُستخدم مرة واحدة. إن انتهى فاطلب من فريقنا إعادة إرساله.\n— أكاديمية وجيز`,
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.invitation.create', entityType: 'trainer_application', entityId: applicationId,
      meta: { sentTo: app.email, expiresAt, emailDelivery: mail.status },
    })
    return { tokenForDelivery: token, expiresAt, acceptUrl, emailDelivery: mail.status }
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
    /* حسابُ المتقدّم نفسِه (أُنشئ عند التقديم) يُربَط لا يُرفض — وحسابُ غيرِه يُردّ */
    if (existing && existing.id !== app.userId) {
      throw new AuthError('email_taken', 'يوجد حساب بهذا البريد — سجّل الدخول واطلب ربط الملف من الإدارة', 409)
    }

    return this.prisma.$transaction(async (tx) => {
      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              passwordHash: await bcrypt.hash(password, 10),
              roles: {
                deleteMany: { roleId: 'trainer_applicant' },
                connectOrCreate: { where: { userId_roleId: { userId: existing.id, roleId: 'trainer' } }, create: { roleId: 'trainer' } },
              },
            },
          })
        : await tx.user.create({
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

  /* ─────────── طلبُ التأهيل من الشعبة ───────────

     كان التأهيلُ والإسنادُ فعلين منفصلين في شاشتين: يُؤهَّل المدرّب من
     «عمليات المدربين»، ثمّ يُسنَد من «عمليات الشعبة». فمن أراد مدرّبا لشعبةٍ
     بعينها مشى ثلاث خطوات في مكانين، وأوّلُها لا يعرف شيئا عن آخرها — ولو
     نسي الثانية بقي المدرّب مؤهَّلا بلا شعبة والشعبةُ بلا مدرّب.

     وقرارُ صاحب المنصّة: «لو المدرب مؤهَّل مسبقا، الإسنادُ من الشعبة يكفي
     وحدَه. ولو غيرَ مؤهَّل، زرٌّ واحد "أهّله وأسنده الآن" يرسل طلبَ تأهيلٍ
     لموافقة المدير الأكاديميّ، وعند الموافقة يُضاف تلقائيا لتأهيلاته
     ويُسنَد».

     فالطلبُ يحمل شعبتَه، وبوّابةُ نزاهة التأهيل تبقى كما هي: من يطلب
     (`cohort.manage`) ليس من يقرّر (`trainer.qualify`). ولو جاز للطالب أن
     يقرّر لصارت الموافقةُ ختما لا مراجعة. */
  async requestQualification(
    profileId: string, courseId: string, cohortId: string, actorId: string, note?: string,
  ) {
    const profile = await this.requireActiveProfile(profileId)
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } })
    if (!cohort) throw new AuthError('unknown_cohort', 'الشعبة غير موجودة', 404)
    if (cohort.courseId !== courseId) {
      throw new AuthError('course_mismatch', 'الدورة لا تطابق دورة الشعبة', 409)
    }
    const existing = await this.prisma.trainerCourseQualification.findUnique({
      where: { profileId_courseId: { profileId, courseId } },
    })
    if (existing?.status === 'qualified') {
      throw new AuthError('already_qualified', 'المدرب مؤهَّل لهذه الدورة — أسنده مباشرة', 409)
    }

    /* تعارضُ الجدول يُفحص عند الطلب لا عند الموافقة وحدَها: من يقرأ الطلب
       يستحقّ أن يعرف أنّه غيرُ قابلٍ للتنفيذ قبل أن يوقّعه، ومن يطلب يستحقّ
       أن يُردّ الآن لا بعد يومين. ويُفحص عند الموافقة أيضا — فالجدولُ يتحرّك
       بينهما. */
    await new CohortService(this.prisma).assertTrainerFreeFor(profileId, cohortId)

    const row = await this.prisma.trainerCourseQualification.upsert({
      where: { profileId_courseId: { profileId, courseId } },
      update: {
        status: 'pending', note, requestedCohortId: cohortId,
        requestedBy: actorId, requestedAt: new Date(), decidedAt: null, qualifiedBy: null,
      },
      create: {
        profileId, courseId, status: 'pending', note, requestedCohortId: cohortId,
        requestedBy: actorId, requestedAt: new Date(),
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.qualify.request', entityType: 'trainer_profile', entityId: profile.id,
      meta: { courseId, cohortId },
    })
    /* من يبتّ يُعلَم — وإلّا بقي الطلبُ في طابورٍ لا أحد يعرف أنّه امتلأ */
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app',
      title: 'طلب تأهيل مدرّب — بانتظار قرارك',
      body: `طُلب تأهيلُ «${profile.application.fullName}» لدورة شعبة «${cohort.title}»، والموافقةُ تؤهّله وتُسنده معا.`,
      templateKey: 'trainer.qualify.request',
      data: { profileId: profile.id, courseId, cohortId },
    })
    return row
  }

  /** طلباتُ التأهيل المعلّقة — لمن يملك البتّ فيها */
  async pendingQualifications() {
    return this.prisma.trainerCourseQualification.findMany({
      where: { status: 'pending' },
      include: {
        profile: { include: { application: { select: { fullName: true, status: true } } } },
        course: { include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
      },
      orderBy: { requestedAt: 'asc' },
    })
  }

  /* البتُّ في الطلب — والموافقةُ تؤهّل وتُسند في فعلٍ واحد.

     ولو تعذّر الإسناد (تغيّر الجدول، أو أُغلقت الشعبة بين الطلب والقرار)
     بقي التأهيلُ قائما ورجع سببُ التعذُّر: التأهيلُ حكمٌ على كفاءة المدرّب
     في الدورة، ولا يبطله أنّ شعبةً بعينها لم تعد تقبله. */
  async decideQualification(
    qualificationId: string, approve: boolean, actorId: string, note?: string,
  ) {
    const q = await this.prisma.trainerCourseQualification.findUnique({
      where: { id: qualificationId },
      include: { profile: true },
    })
    if (!q) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (q.status !== 'pending') throw new AuthError('not_pending', 'بُتَّ في هذا الطلب من قبل', 409)

    if (!approve) {
      /* لا رفضَ صامت: السببُ يُخزَّن ويُقرأ في ملفّ المدرّب */
      if (!note?.trim()) throw new AuthError('reason_required', 'الرفض يحتاج سببا يُقرأ', 400)
      const row = await this.prisma.trainerCourseQualification.update({
        where: { id: qualificationId },
        data: { status: 'rejected', note, qualifiedBy: actorId, decidedAt: new Date() },
      })
      await recordAudit(this.prisma, {
        actorId, action: 'trainer.qualify.reject', entityType: 'trainer_profile', entityId: q.profileId,
        meta: { courseId: q.courseId, note },
      })
      return { qualification: row, assigned: false, assignNote: null as string | null }
    }

    const row = await this.prisma.trainerCourseQualification.update({
      where: { id: qualificationId },
      data: { status: 'qualified', qualifiedBy: actorId, decidedAt: new Date(), note },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.qualify', entityType: 'trainer_profile', entityId: q.profileId,
      meta: { courseId: q.courseId, viaRequest: true, cohortId: q.requestedCohortId },
    })

    let assigned = false
    let assignNote: string | null = null
    if (q.requestedCohortId) {
      try {
        await this.assignToCohort(q.profileId, q.courseId, q.requestedCohortId, actorId)
        assigned = true
      } catch (e) {
        /* التأهيلُ تمّ ولم يقع الإسناد — يُقال لا يُبتلع */
        assignNote = e instanceof Error ? e.message : 'تعذّر الإسناد'
      }
    }
    return { qualification: row, assigned, assignNote }
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
    /* الربط التشغيلي بالشعبة — CohortTrainer.

       كان الإسناد من شاشة «عمليات المدربين» يكتب TrainerCourseAssignment وحده،
       بينما كل سطح المدرب يقرأ CohortTrainer: شعبي، وطابور التصحيح، والحضور،
       والتسجيلات، وحارس assertCohortTrainer. فالمدرب يُسنَد ثم يفتح منصته
       فيجدها فارغة — ولا رسالة خطأ، لأن لا خطأ وقع في نظر أيٍّ من الطرفين.
       الجدولان مفهومان مختلفان (تأهيل وإسناد إداري مقابل تشغيل شعبة) فلا يُدمجان،
       لكن إسنادا إلى شعبة بعينها يجب أن يُنتج الاثنين معا.

       ويمرّ عبر CohortService لا بكتابة مباشرة: هناك حارس تعارض الجدول — مدرب
       في شعبتين جلستاهما متداخلتان — وتخطّيه هنا يفتح بابا خلفيا لما يمنعه
       الباب الأمامي. */
    if (cohortId) {
      await new CohortService(this.prisma).assignTrainer(cohortId, profileId, actorId, 'lead')
    }
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.assign', entityType: 'trainer_profile', entityId: profile.id,
      meta: { courseId, cohortId, cohortLinked: Boolean(cohortId) },
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
    /* التعليقات المعتمَدة للنشر (١و) — نداءٌ واحد لكل المدرّبين المعروضين ثم
       تجميع، لا استعلامٌ داخل حلقة. والدرجة والعدد يأتيان من عمودَي الملفّ
       اللذين يكتبهما RatingService بعد بلوغ عتبة إخفاء الهوية. */
    const approved = profiles.length
      ? await this.prisma.rating.findMany({
          where: { subjectType: 'trainer', subjectId: { in: profiles.map((p) => p.id) }, publishStatus: 'approved', commentAr: { not: null } },
          orderBy: { createdAt: 'desc' },
          /* لا raterId ولا enrollmentId: ما يخرج للعامّة لا يدلّ على قائله */
          select: { subjectId: true, score: true, commentAr: true },
        })
      : []
    const bySubject = new Map<string, { score: number; commentAr: string }[]>()
    for (const r of approved) {
      const list = bySubject.get(r.subjectId) ?? []
      if (list.length < 5) list.push({ score: r.score, commentAr: r.commentAr as string })
      bySubject.set(r.subjectId, list)
    }

    return profiles.map((p) => ({
      id: p.id, name: p.application.fullName, headline: p.headline, bio: p.bioPublic,
      country: p.application.country,
      specialties: p.application.specialties.map((s) => s.specialty),
      photoUrl: p.photoUrl,
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
      /* التعليق لا يُعرض إلا مع متوسّط معروض: تعليقٌ بلا رقم يُقرأ انتقاءً */
      testimonials: p.ratingAvg != null ? bySubject.get(p.id) ?? [] : [],
      hoursTaught: p.hoursTaught,
      graduatesCount: p.graduatesCount,
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

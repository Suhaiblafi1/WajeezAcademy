/* خدمة مراجعة واعتماد المدربين — قرارات بشرية بالكامل:
   روبرك تسعة محاور، مقابلات، تقييم Demo، مراجع، قبول مشروط، عقد،
   دعوة آمنة لإنشاء الحساب، تأهيل لدورة، إسناد لشعبة، نشر عام، إيقاف.
   مبدأ الفصل: قبول الطلب ≠ إنشاء الحساب ≠ تفعيل الدور ≠ التأهيل ≠ التعيين ≠ النشر.
   المتقدم لا يمنح نفسه دور trainer أبدا — الحساب يُنشأ فقط عبر دعوة إدارية. */

import { ACADEMY_EMAILS } from './integrations.service'
import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError, AuthService } from './auth.service'
import { recordAudit } from './audit'
import { seedProposalsFromApplication } from './course-proposal.service'
import { renderMail } from './mail-template'
import { TRAINER_INTERVIEW, trainerInterviewUrl } from '../../src/application/trainer/application-options'
import { buildIcs } from './calendar/ics'
import { TrainerApplicationService } from './trainer-application.service'
import { nextTrainerApplicationReference } from './trainer-application-reference'
import { sendDirectEmail, notifyRole, safeNotify, publicSiteUrl, type DirectMailStatus } from './notification.service'
import { sendStaffInviteEmail } from './account-mail'
import { CohortService } from './cohort.service'
import { fmtDateWith } from '../../src/application/text/format-ar'
import { PUBLIC_TRAINER_WHERE, trainerPubliclyVisible } from './trainer-visibility'
import { cleanProposals, readProposals } from '../../src/application/trainer/teachable-proposals'
import {
  MAX_PHOTO_BYTES, PHOTO_KEY_PREFIX, PHOTO_MIMES, SIGNED_URL_TTL_MS,
  assertFileUploadsEnabled, newStorageKey, photoPublicUrl, photoStorageKey, signKey,
} from './storage.service'
import { deleteObject } from './object-store'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')

/* محاور الروبرك البشري التسعة — كل محور من 1 إلى 5 */
export const RUBRIC_CRITERIA = [
  'domain_expertise', 'evidence_of_expertise', 'explanation_facilitation', 'demo_quality',
  'activity_assessment_design', 'feedback_skill', 'digital_training', 'values_fit', 'availability',
] as const
export type RubricKey = (typeof RUBRIC_CRITERIA)[number]

/** الناقصُ جائز — فالقيمةُ قد تغيب، ونوعُها يقول ذلك بدل أن يُكتَم بتحويل */
export type RubricScores = Record<string, number | undefined>

const INVITATION_TTL_MS = 72 * 3600_000 // 72 ساعة

/* ═══ الناقصُ يُقبل، والمجهولُ يُرَدّ ═══

   كان يشترط المحاورَ التسعةَ كلَّها من ١ إلى ٥. وفيه خطآن ظهرا حين صار
   التقييمُ يُملأ في صفحةٍ مشتركةٍ تُحفَظ مرّاتٍ، لا في نموذجٍ يُرسَل دفعةً:

   ١) `demo_quality` **لا يُقاس في المقابلة** — و`rubric.ts` يقول ذلك صراحةً
      في `laterAr`. فكان المُقابِلُ يخترع له درجةً ليمرّ حفظُه، فتدخل القاعدةَ
      درجةٌ لا أصلَ لها.

   ٢) ومن حفظ نصفَ الورقة ليُتمّها بعد ساعةٍ رُدَّ حفظُه كلُّه.

   فصار: ما أُرسل يُتحقَّق منه، والنقصُ جائز.

   **والمفتاحُ المجهولُ يُرَدّ ولا يُتجاهَل** — وهذا مقصود: خطأٌ مطبعيٌّ في
   اسم محورٍ يُقبل صامتا يضيع، فيظنّ القارئُ أنّه قيّم وهو لم يفعل. */
export function assertRubric(scores: RubricScores) {
  for (const [key, v] of Object.entries(scores)) {
    /* المفتاحُ يُفحص قبل قيمته: مجهولٌ بلا قيمةٍ مجهولٌ كذلك */
    if (!(RUBRIC_CRITERIA as readonly string[]).includes(key)) {
      throw new AuthError('bad_rubric', `لا محورَ في الروبرك اسمُه «${key}»`)
    }
    /* ومفتاحٌ حاضرٌ بلا قيمةٍ = محورٌ لم يُقيَّم، لا محورٌ قيمتُه خاطئة */
    if (v === undefined) continue
    if (!Number.isInteger(v) || v < 1 || v > 5) {
      throw new AuthError('bad_rubric', `محور «${key}» يجب أن يكون تقييما صحيحا من 1 إلى 5`)
    }
  }
}

/** يُسقَط ما لم يُقيَّم — فلا يدخل القاعدةَ مفتاحٌ بلا درجة */
export function cleanRubric(scores: RubricScores): Record<string, number> {
  return Object.fromEntries(
    Object.entries(scores).filter((e): e is [string, number] => e[1] !== undefined),
  )
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
      /* الملغاةُ لا تُعَدّ مقابلةً: ترويسةُ الطابور تقول «أُجريت مقابلتُه» عن
         هذا العدد، ومن ألغى موعدَه عبر Calendly لم يجلس إليه أحد. */
      include: {
        specialties: true,
        _count: { select: { documents: true, reviews: true, interviews: { where: { canceledAt: null } } } },
      },
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

  async addReview(applicationId: string, reviewerId: string, input: RubricScores, overallNote?: string) {
    assertRubric(input)
    const scores = cleanRubric(input)
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
        organizer: { name: 'أكاديمية وجيز', email: ACADEMY_EMAILS.calendar },
        attendee: { name: app.fullName, email: app.email },
      })
      const res = await sendDirectEmail(this.prisma, {
        to: app.email,
        subject: 'موعد مقابلتك مع أكاديمية وجيز',
        ...renderMail({
          greetingName: app.fullName,
          heading: 'حدّدنا موعد مقابلتك',
          blocks: [
            { kind: 'facts', rows: [
              { label: 'رقم الطلب', value: app.reference },
              { label: 'الموعد', value: `${when} (بتوقيت عمّان)` },
              { label: 'المكان', value: remote ? 'عن بُعد — يصلك الرابط قبل الموعد' : 'حضوريّة' },
            ] },
            { kind: 'p', text: 'أرفقنا دعوةَ تقويمٍ مع هذه الرسالة — افتحها لتُضاف إلى تقويمك مباشرة.' },
            { kind: 'note', text: 'وإن لم يناسبك الموعد فأخبرنا بالردّ على هذه الرسالة.' },
          ],
        }),
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

  async recordDemoEvaluation(applicationId: string, evaluatorId: string, input: RubricScores, decision: 'pass' | 'retry' | 'fail', notes?: string) {
    assertRubric(input)
    const scores = cleanRubric(input)
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
    | 'approve'
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
      /* ─────────── النقرةُ الواحدة ───────────

         بقرار صاحب المنصّة: الاعتمادُ نقرةٌ واحدة، وما عداه يجري خارج المنصّة.
         فـ`approve` تفعل في خطوةٍ ما كانت تفعله ثمانٍ: تُنشئ ملفَّ المدرّب،
         وتربط حسابَه وتمنحه دورَه، وتنقله إلى «نشط»، وتُعلمه.

         والسلسلةُ التفصيليّةُ باقيةٌ لمن أرادها — لم يُحذف زرٌّ واحد. */
      approve: 'active',
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
    if (action === 'activate' || action === 'approve') {
      /* النقرةُ الواحدة تُنشئ الملفَّ إن لم يكن — فهي تختصر «القبولَ المشروط»
         الذي كان ينشئه. و`activate` تبقى على شرطها: ملفٌّ موجودٌ مسبقا. */
      const profile = action === 'approve'
        ? await this.ensureProfile(applicationId, app, actorId)
        : await this.prisma.trainerProfile.findUnique({ where: { applicationId } })
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
      /* ═══ ويُؤهَّل لما قال إنّه يُتقنه ═══

         كان الاعتمادُ يُنشئ ملفّا بلا تأهيلٍ واحد، فيفتح المدرّبُ بوّابتَه
         ويقرأ: «لا تأهيلَ بعد — التأهيلُ يقع من الإدارة». وهو قد كتب في طلبه
         الدوراتِ التي يستطيع تدريسَها، وقرأها المراجعُ واعتمده عليها. فسؤالُه
         عنها مرّةً ثانيةً في طابورِ طلباتٍ تكرارٌ لقرارٍ وقع.

         قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): المعتمَدُ مؤهَّلٌ لكلّ ما ذكره في
         طلبه، وتضيف الإدارةُ فوقَه ما تراه. */
      await this.syncQualificationsFromApplication(profile.id, actorId)
    }

    await this.apps.transition(applicationId, targets[action], actorId, note)

    /* رفعُ الإيقاف يُعيد الملفَّ والحساب معا — وإلّا بقي «نشطا» وحسابُه موقوف */
    if (action === 'reinstate') {
      const profile = await this.prisma.trainerProfile.findUnique({ where: { applicationId } })
      if (profile) {
        /* الإيقافُ يطفئ `publicVisibility` (suspendTrainer أدناه) ورفعُه لم يكن
           يعيدها — فيعود المدرّبُ «نشطا» ويبقى مخفيّا من الصفحة العامّة
           والتقويم حتّى يُضغط «اعتمِد ظهورَه العامّ» ثانيةً، ولا أحدَ يعلم أنّ
           ذلك مطلوب. فيعود إلى ما كان عليه: ظاهرا إن كان نشرُه معتمَدا. */
        await this.prisma.trainerProfile.update({
          where: { id: profile.id },
          data: { suspendedAt: null, suspendedBy: null, publicVisibility: profile.publishApprovedAt !== null },
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
      await this.ensureProfile(applicationId, app, actorId)
    }

    /* ولا يُعتمَد أحدٌ في صمت: النقرةُ الواحدة تُنهي المسارَ كلَّه، فلو لم
       تُعلمه لَبقي ينتظر ردّا وصل ولا يعلم. وإخفاقُ البريد لا يُسقط الاعتماد
       — هو حقيقةٌ في القاعدة، والرسالةُ إشعارٌ بها؛ فيُسجَّل الإخفاقُ ويُكمَل. */
    if (action === 'approve') {
      await this.notifyApproved(app.email, app.fullName, app.reference, actorId, applicationId)
    }

    /* ═══ ولا يُطلب من أحدٍ شيءٌ في صمت ═══

       «اطلب معلومات إضافية» كانت تنقل الحالةَ ولا ترسل شيئا. فالمتقدّمُ يقف
       في `information_requested` لا يعلم أنّ شيئا طُلب منه — إلّا أن يفتح
       صفحةَ حالته من تلقاء نفسه ويقرأ اسمَ الحالة. وقد وقع ذلك فعلا.

       والرسالةُ تحمل **نصَّ ما نريده** لا اسمَ الحالة: الملاحظةُ التي يكتبها
       المراجعُ هي السؤال، وبدونها الرسالةُ «نحتاج معلوماتٍ إضافية» — وهي لا
       تقول شيئا. ولذلك تُطلب الملاحظةُ في الشاشة قبل الضغط. */
    if (action === 'request_info') {
      await this.notifyInfoRequested(app.email, app.fullName, app.reference, note, actorId, applicationId)
    }

    /* ═══ ولا يُردّ أحدٌ في صمت، ولا يُترك منتظِرا بلا خبر (ي-٤) ═══

       كان `decide` يفرّق ثلاثةَ قراراتٍ في الإبلاغ: الاعتمادُ يُرسَل، وطلبُ
       المعلومات يُرسَل، و**الردُّ والانتظارُ لا رسالةَ لهما أصلا**. فمن رُدّ
       طلبُه يبقى يتفقّد صفحةَ حالته شهرا، ومن وُضع في الانتظار يظنّ أنّه
       رُدّ — والاثنان أعطيانا وقتَهما وسيرتَهما.

       وهذه هي الثغرةُ التي كان `trainer.status.transition` يخفيها: ذاك
       مَخنقُ ستّةَ عشرَ حالة، والإبلاغُ عنده يوقظ الناسَ على تنقّلاتٍ
       داخليّةٍ لا تعنيهم. وموضعُ الإصلاح هنا، حيث يقع القرارُ ويُعرف.

       والسببُ يصل صاحبَه كما وصل السجلَّ حين كُتب: ردٌّ بلا سببٍ يُقرأ حكما
       على الشخص لا على الطلب. */
    if (action === 'reject') {
      await this.notifyDecision(app.email, app.fullName, app.reference, {
        heading: 'قرارُنا في طلبك للانضمام مدرّبا',
        bodyAr: 'شكرا لوقتك ولما شاركتَه معنا. ولم نتمكّن هذه المرّةَ من المضيّ في طلبك.',
        noteAr: note,
        closingAr: 'ولك أن تتقدّم إلينا من جديدٍ حين يتغيّر ما تعرضه — فالبابُ يبقى مفتوحا.',
      })
    }

    if (action === 'waitlist') {
      await this.notifyDecision(app.email, app.fullName, app.reference, {
        heading: 'طلبُك في قائمة الانتظار',
        bodyAr: 'راجعنا طلبك ولم نُغلقه: وُضع في قائمة الانتظار حتّى تُفتح حاجةٌ تناسب ما تدرّسه.',
        noteAr: note,
        closingAr: 'ونعود إليك على هذا العنوان حين يجدّ ما يناسبك. ولا يلزمك شيءٌ الآن.',
      })
    }
  }

  /** قرارٌ يصل صاحبَه — ولا يُسقط القرارَ إن أخفق البريد */
  private async notifyDecision(
    to: string, fullName: string, reference: string,
    copy: { heading: string; bodyAr: string; noteAr?: string; closingAr: string },
  ): Promise<void> {
    await sendDirectEmail(this.prisma, {
      to,
      subject: `${copy.heading} (${reference})`,
      ...renderMail({
        greetingName: fullName,
        heading: copy.heading,
        blocks: [
          { kind: 'p', text: copy.bodyAr },
          ...(copy.noteAr?.trim()
            ? [{ kind: 'facts' as const, rows: [{ label: 'وممّا كُتب في المراجعة', value: copy.noteAr.trim() }] }]
            : []),
          { kind: 'p', text: copy.closingAr },
        ],
      }),
    })
  }

  /* ═══ دعوةٌ إلى حجزِ موعدٍ آخر — بنقرةٍ واحدة ═══

     الجدولةُ اليدويّةُ فوقَها تفرض موعدا وترسله. وهي تصلح للأوّل، ولا تصلح
     حين نريد لقاءً ثانيا: فالمُقابِلُ لا يعرف فراغَ المتقدّم، والمتقدّمُ لا
     يعرف فراغَنا — فتذهب رسالتان أو ثلاث قبل أن يُتّفق على ساعة.

     فهذه تدعوه ليختار هو من التقويم نفسِه الذي يحجب ما حُجز. ولا تنقل حالةَ
     الطلب: هي دعوةٌ لا قرار، والحالةُ تتغيّر حين يُحجَز فعلا. */
  async inviteToBookInterview(applicationId: string, actorId: string): Promise<{ emailDelivery: string }> {
    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: applicationId },
      select: { email: true, fullName: true, reference: true },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)

    const link = trainerInterviewUrl({ name: app.fullName, email: app.email, reference: app.reference })
    const mail = await sendDirectEmail(this.prisma, {
      to: app.email,
      subject: `موعدٌ آخر معنا — اختر ما يناسبك (${app.reference})`,
      ...renderMail({
        greetingName: app.fullName,
        heading: 'نودّ أن نلتقيك مرّةً أخرى',
        blocks: [
          { kind: 'p', text: 'اخترْ من التقويم الوقتَ الذي يناسبك — تظهر لك الأوقاتُ المتاحةُ وحدَها، ويصلك التأكيدُ ودعوةُ التقويم فورَ اختيارك.' },
          { kind: 'cta', label: 'اختر موعدك', href: link },
          { kind: 'facts', rows: [
            { label: 'رقم الطلب', value: app.reference },
            { label: 'المدّة', value: `${TRAINER_INTERVIEW.minutes} دقيقة` },
            { label: 'المكان', value: `عن بُعد عبر ${TRAINER_INTERVIEW.platformAr}` },
          ] },
          { kind: 'note', text: 'ولو لم يناسبك أيُّ وقتٍ معروض، ردَّ على هذه الرسالة وسنرتّب غيرَه.' },
        ],
      }),
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.interview.invite', entityType: 'trainer_application', entityId: applicationId,
      meta: { sentTo: app.email, emailDelivery: mail.status },
    })
    return { emailDelivery: mail.status }
  }

  /** بريدُ «نحتاج منك» — يحمل السؤالَ نفسَه ورابطَ التعديل */
  private async notifyInfoRequested(
    to: string, fullName: string, reference: string, note: string | undefined,
    actorId: string, applicationId: string,
  ): Promise<void> {
    const statusUrl = `${publicSiteUrl()}/join-trainer`
    const asked = note?.trim()
    const mail = await sendDirectEmail(this.prisma, {
      to,
      subject: `نحتاج منك إضافةً على طلبك — ${reference}`,
      ...renderMail({
        greetingName: fullName,
        heading: 'قرأنا طلبك، ونحتاج منك إضافةً قبل أن نُكمل',
        blocks: [
          ...(asked
            ? ([{ kind: 'h', text: 'وهذا ما نحتاجه' }, { kind: 'callout', text: asked }] as const)
            : ([{ kind: 'p', text: 'راجعْ طلبك وأكمل ما تراه ناقصا فيه — ومستنداتُك أوّلُ ما يُنظَر فيه.' }] as const)),
          { kind: 'p', text: 'طلبك ما زال مفتوحا للتعديل: افتح صفحة حالتك، عدّل ما يلزم، ثمّ أرسله من جديد. ولا يلزمك تعبئتُه من أوّله — يُفتح على ما كتبتَه.' },
          { kind: 'cta', label: 'عدّل طلبك الآن', href: statusUrl },
          { kind: 'facts', rows: [{ label: 'رقم الطلب', value: reference }] },
          { kind: 'note', text: 'ولو كان في السؤال ما يحتاج توضيحا، ردَّ على هذه الرسالة.' },
        ],
      }),
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.info_requested.notify', entityType: 'trainer_application', entityId: applicationId,
      meta: { sentTo: to, emailDelivery: mail.status, asked: asked ?? null },
    })
  }

  /* ═══ مطابقةُ التأهيل بما في الطلب — تُنادى عند الاعتماد وعند كلّ قراءة ═══

     تعمل على ما يُقبل: `skipDuplicates` على القيد `(profileId, courseId)`،
     فمن أُهِّل يدويّا لا يُكرَّر، ومن رُدّ تأهيلُه لدورةٍ يبقى مردودا — الصفُّ
     موجودٌ فلا يُلمَس. ودورةٌ ذكرها ولم تعد في الكتالوج تُهمَل بصمت.

     ولا أثرَ يُكتب إلّا حين يُضاف شيءٌ فعلا: تُنادى مع كلّ فتحٍ لصفحة
     المؤهّلات كي يلحق من اعتُمد قبل هذا التغيير، فلو كُتب أثرٌ في كلّ نداء
     لامتلأ السجلّ بـ«لا شيء». */
  async syncQualificationsFromApplication(profileId: string, actorId: string | null): Promise<{ added: string[] }> {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId },
      select: { application: { select: { teachableCourseIds: true } } },
    })
    const wanted = profile?.application.teachableCourseIds ?? []
    if (wanted.length === 0) return { added: [] }
    const known = await this.prisma.course.findMany({ where: { id: { in: wanted } }, select: { id: true } })
    const existing = await this.prisma.trainerCourseQualification.findMany({
      where: { profileId, courseId: { in: known.map((c) => c.id) } }, select: { courseId: true },
    })
    const have = new Set(existing.map((q) => q.courseId))
    const added = known.map((c) => c.id).filter((id) => !have.has(id))
    if (added.length === 0) return { added: [] }
    await this.prisma.trainerCourseQualification.createMany({
      data: added.map((courseId) => ({
        profileId, courseId, status: 'qualified', qualifiedBy: actorId,
        note: 'من طلب الانضمام — الدوراتُ التي قال إنّه يستطيع تدريسَها', decidedAt: new Date(),
      })),
      skipDuplicates: true,
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.qualify.auto', entityType: 'trainer_profile', entityId: profileId,
      meta: { courseIds: added },
    })
    return { added }
  }

  /** ملفُّ المدرّب — يُنشأ مرّةً بمهامّ تهيئته، ويُعاد إن كان موجودا */
  private async ensureProfile(
    applicationId: string,
    app: { jobTitle: string | null; bio: string | null },
    actorId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.trainerProfile.findUnique({ where: { applicationId } })
      if (existing) return existing
      const profile = await tx.trainerProfile.create({
        data: { applicationId, headline: app.jobTitle ?? null, bioPublic: app.bio ?? null },
      })
      /* ح-٢: دوراتُه المقترحةُ تُبذَر من طلبه إلى جدولها، فيجدها في بوّابته.
         والعمودُ في الطلب يبقى كما هو — سجلُّ ما قدّمه يومَ تقدّم. */
      const submitted = await tx.trainerApplication.findUnique({
        where: { id: applicationId }, select: { teachableProposals: true },
      })
      await seedProposalsFromApplication(tx, profile.id, submitted?.teachableProposals, actorId)
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
      return profile
    })
  }

  /** بريدُ الاعتماد — يُرسَل ولا يُسقط الاعتمادَ إن أخفق */
  private async notifyApproved(
    to: string, fullName: string, reference: string, actorId: string, applicationId: string,
  ): Promise<void> {
    const portalUrl = `${publicSiteUrl()}/trainer`
    const mail = await sendDirectEmail(this.prisma, {
      to,
      subject: 'اعتُمدتَ مدرّبا في أكاديمية وجيز',
      ...renderMail({
        greetingName: fullName,
        heading: `اعتُمد طلبك (${reference}) — أهلا بك مدرّبا في أكاديمية وجيز`,
        blocks: [
          { kind: 'p', text: 'بوّابتك مفتوحةٌ الآن بالحساب نفسِه الذي تابعتَ به طلبك.' },
          { kind: 'cta', label: 'افتح بوّابة المدرّب', href: portalUrl },
          { kind: 'p', text: 'تجد فيها ملفَّك ومهامَّ التهيئة، وتصلك الشعبُ حين تُسنَد إليك.' },
        ],
      }),
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.approved.notify', entityType: 'trainer_application', entityId: applicationId,
      meta: { sentTo: to, emailDelivery: mail.status },
    })
  }

  /* ═══════════ جرسُ المدرّب — ولمَ كان فارغا ═══════════

     التعيينُ والتأهيلُ **لا يكتبان إشعارا**، وفي الخادم كلِّه مساران اثنان
     يكتبان إشعارا للمدرّب. فالمدرّبُ يُؤهَّل لدورةٍ ويُسنَد إلى شعبةٍ ولا
     يعلم — يكتشف شعبتَه حين يفتح بوّابتَه، إن فتحها.

     وهذان خبران يترتّب عليهما **عمل**: من أُسنِد إلى شعبةٍ عليه أن يحضر.
     فصنفُهما «عملي في الأكاديمية» ولا يُكتَم، وجمهورُهما `trainer` —
     يقع الخبرُ في بوّابته التي يعمل فيها لا في بوّابةِ متعلّم.

     ولا يُسقط إخفاقُ الإشعار الفعلَ: `safeNotify` يبتلع فشلَه، والتأهيلُ
     والإسنادُ حقيقتان في القاعدة قبله. */
  private async notifyTrainerUser(
    profileId: string,
    payload: { title: string; body: string; templateKey: string; data?: Record<string, unknown> },
  ): Promise<void> {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId }, select: { userId: true },
    })
    /* «نشطٌ» بلا حسابٍ لا جرسَ له — ولا يُخترع له صفٌّ لا يقرؤه أحد */
    if (!profile?.userId) return
    await safeNotify(this.prisma, {
      userId: profile.userId, channel: 'in_app', audience: 'trainer', ...payload,
    })
  }

  /** عنوانُ الدورة بالعربية — أو معرِّفُها إن لم يكن لها إصدار */
  private async courseTitleAr(courseId: string): Promise<string> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } },
    })
    return course?.versions[0]?.titleAr ?? courseId
  }

  /* ═══════════ تعيينُ مدرّبٍ داخليّا — نقرةٌ واحدة ═══════════

     كانت الخاصّيّةُ غيرَ موجودةٍ إطلاقا: **الموضعُ الوحيدُ** الذي يُنشأ فيه
     ملفُّ مدرّبٍ في الخادم كلِّه داخلَ البتّ في طلبٍ عامّ، و**الموضعُ الوحيدُ**
     الذي يُنشأ فيه طلبُ انضمامٍ هو النموذجُ العامُّ بلا مصادقة. فمن أراد
     المديرُ تعيينَه — زميلٌ في الأكاديمية، أو مدرّبٌ تعاقَد معه خارجها —
     لا طريقَ له إلّا أن يملأ نموذجَ التقدّم العامّ بنفسه.

     وما كان يستطيعه المديرُ طريقٌ مسدود: يُنشئ مستخدما بدور «مدرّب» فيرى
     صاحبُه جدارَ «حسابُك يحمل صلاحيّاتِ مدرّبٍ بلا ملفّ مدرّب» — ولا يُؤهَّل
     ولا يُسنَد لأنّ كليهما يطلب معرِّفَ ملفٍّ غيرِ موجود.

     فهذه معاملةٌ واحدةٌ تكتب الأربعةَ معا: الحسابَ، وطلبا بحالة «نشط»،
     والملفَّ، والدور. ثلاثةُ حقولٍ ونقرة.

     ── وثلاثةُ حدودٍ تُقال صراحةً ──

     ١) **لا ظهورَ عامّا**: `publicVisibility` و`publishApprovedAt` تبقيان على
        أصلهما — فلا اسمَ مدرّبٍ يُعرض للناس قبل موافقةِ نشرٍ صريحة.
     ٢) **ولا توثيقَ بريدٍ يُدَّعى**: `emailVerifiedAt` تبقى فارغةً — المديرُ
        يشهد بالشخص، لا بأنّ العنوانَ تحقّق من نفسه.
     ٣) **ولا يُطمَس طلبٌ قائم**: من له طلبٌ في الطابور يُعتمَد من هناك،
        فلا يُنشأ له ثانٍ يزاحمه. */
  async createTrainerDirectly(actorId: string, input: {
    fullName: string; email: string; headline?: string | null
  }): Promise<{
    applicationId: string; profileId: string; userId: string; reference: string
    accountCreated: boolean; inviteSent: boolean; noteAr: string
  }> {
    const email = input.email.trim().toLowerCase()
    const fullName = input.fullName.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AuthError('invalid_email', 'صيغة البريد غير صحيحة', 400)
    }
    if (fullName.length < 2) throw new AuthError('bad_name', 'الاسم حرفان على الأقلّ', 400)

    const existingApp = await this.prisma.trainerApplication.findFirst({ where: { email } })
    if (existingApp) {
      throw new AuthError(
        'application_exists',
        `لهذا البريد طلبٌ قائم (${existingApp.reference}) — اعتمِدْه من طابور الطلبات بدل إنشاء ثانٍ`,
        409,
      )
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } })
    /* كلمةٌ عشوائيّةٌ لا يعرفها أحد — كما في إنشاء الحساب الإداريّ:
       الدخولُ يبدأ بتعيينِ صاحبه كلمتَه من رابط الدعوة. */
    const passwordHash = existingUser ? null : await bcrypt.hash(randomBytes(24).toString('hex'), 10)

    const created = await this.prisma.$transaction(async (tx) => {
      const userId = existingUser
        ? existingUser.id
        : (await tx.user.create({
            data: { email, displayName: fullName, passwordHash: passwordHash!, status: 'invited' },
          })).id

      /* المرجعُ من المولّد المشترك لا من عدد الصفوف: العدُّ ينقص بالحذف
         النهائيّ فيتصادم — `trainer-application-reference.ts` */
      const reference = await nextTrainerApplicationReference(tx)

      const app = await tx.trainerApplication.create({
        data: {
          reference, email, fullName, userId,
          status: 'active',
          jobTitle: input.headline?.trim() || null,
          statusHistory: {
            create: { fromStatus: null, toStatus: 'active', note: 'تعيينٌ داخليٌّ من الإدارة — بلا نموذج تقدّم' },
          },
        },
      })

      const profile = await tx.trainerProfile.create({
        data: { applicationId: app.id, userId, headline: input.headline?.trim() || null },
      })
      /* مهامُّ التهيئةِ نفسُها التي يبذرها الاعتمادُ العاديّ — فمن عُيّن
         داخليّا يجد في بوّابته ما يجده المعتمَدُ من الطابور. */
      for (const t of [
        { key: 'sign_contract', title: 'توقيع العقد' },
        { key: 'academy_orientation', title: 'التعريف بمنهجية الأكاديمية' },
        { key: 'lms_setup', title: 'تهيئة حساب منصة التدريب' },
        { key: 'first_cohort_brief', title: 'موجز الشعبة الأولى' },
      ]) {
        await tx.trainerOnboardingTask.create({ data: { profileId: profile.id, key: t.key, title: t.title } })
      }

      await tx.userRole.upsert({
        where: { userId_roleId: { userId, roleId: 'trainer' } },
        update: {}, create: { userId, roleId: 'trainer' },
      })
      await tx.userRole.deleteMany({ where: { userId, roleId: 'trainer_applicant' } })

      await recordAudit(tx, {
        actorId, action: 'trainer.create_direct', entityType: 'trainer_profile', entityId: profile.id,
        meta: { applicationId: app.id, reference, email, userId, account: existingUser ? 'linked' : 'created' },
      })
      return { applicationId: app.id, profileId: profile.id, userId, reference }
    })

    /* الدعوةُ والبريدُ خارجَ المعاملة: المدرّبُ حقيقةٌ في القاعدة، والرسالةُ
       إشعارٌ بها — فإخفاقُ البريد لا يمحو تعيينا وقع. */
    let inviteSent = false
    if (!existingUser) {
      try {
        const { token } = await new AuthService(this.prisma).issueInvite(created.userId)
        const actor = await this.prisma.user.findUnique({
          where: { id: actorId }, select: { displayName: true },
        })
        const mail = await sendStaffInviteEmail(this.prisma, {
          to: email,
          displayName: fullName,
          token,
          roleNamesAr: ['مدرّب'],
          invitedByAr: actor?.displayName ?? 'مدير المنصّة',
          dutiesAr: [
            'شعبُك ومواعيدُ جلساتها',
            'حضورُ متعلّميك وموادُّ كلِّ لقاء',
            'طابورُ التصحيح وتقييماتُك',
            'مستحقّاتُك',
          ],
        })
        inviteSent = mail.status === 'sent'
      } catch { /* الدعوةُ رفاهية — التعيينُ وقع، وتُعاد من قائمة المستخدمين */ }
    }

    return {
      ...created,
      accountCreated: !existingUser,
      inviteSent,
      /* لا يُقال «وصلته دعوة» حين لا بريد — انتظارُ رسالةٍ لن تصل أسوأُ من معرفة ذلك */
      noteAr: existingUser
        ? 'عُيّن مدرّبا على حسابه القائم — يفتح بوّابتَه بكلمة سرّه نفسِها.'
        : inviteSent
          ? 'عُيّن مدرّبا، ووصلته دعوةٌ يعيّن بها كلمةَ سرّه ويفتح بوّابته.'
          : 'عُيّن مدرّبا، ولم تُرسَل الدعوة — قناةُ البريد غير مفعّلة. اطلب منه «نسيت كلمة المرور» ببريده.',
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
    /* ═══ ويعلم صاحبُ العقد أنّ توقيعَه سُجّل (ي-٤) ═══

       المعاملةُ فوقُ تُغلق مهمّةَ «توقيع العقد» في تهيئته وتنقل طلبَه إلى
       طورِ التهيئة — وكان يقع بلا خبر: يوقّع ثمّ ينتظر ولا يعرف أوصل توقيعُه
       أم لا.

       و**بريدٌ لا جرس**: `profile.userId` موجودٌ في المدى لكنّه فارغٌ عادةً
       في هذا الطور — الربطُ بين الملفّ والحساب يقع لاحقا بالدعوة الآمنة
       (`consumeInvitation`). فالعنوانُ يُقرأ من الطلب، وهو ما يملكه المتقدّمُ
       قبل أن يكون له حسابٌ أصلا. */
    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: contract.profile.applicationId },
      select: { email: true, fullName: true },
    })
    if (app) {
      await sendDirectEmail(this.prisma, {
        to: app.email,
        subject: 'سُجّل توقيعُ عقدك — أكاديمية وجيز',
        ...renderMail({
          greetingName: app.fullName,
          heading: 'سُجّل توقيعُ عقدك',
          blocks: [
            { kind: 'p', text: 'وانتقل طلبُك إلى طورِ التهيئة. تبقّت مهامُّ التهيئة، وتُفتح لك في بوّابتك حين يُنشأ حسابُك بدعوةٍ تصلك على هذا العنوان.' },
            { kind: 'note', text: 'وإن لم تكن أنت من وقّع فأبلغنا بردٍّ على هذه الرسالة.' },
          ],
        }),
      })
    }
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
      ...renderMail({
        greetingName: app.fullName,
        heading: `اكتمل اعتماد طلبك (${app.reference}) — وهذه دعوتك لإنشاء حسابك`,
        blocks: [
          { kind: 'cta', label: 'أنشئ حسابك واختر كلمتك', href: acceptUrl },
          { kind: 'callout', text: 'الرابط صالحٌ اثنتين وسبعين ساعة، ويُستخدم مرّةً واحدة.' },
          { kind: 'note', text: 'فإن انتهى فاطلب من فريقنا إعادةَ إرساله.' },
        ],
      }),
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

    const out = await this.prisma.$transaction(async (tx) => {
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
    /* والتأكيدُ خارجَ المعاملة على عرف هذا الملفّ («الدعوةُ والبريدُ خارجَ
       المعاملة»): بريدٌ يُخفق لا ينقض حسابا أُنشئ. */
    await this.confirmActivation(email, app.fullName)
    return out
  }

  /** تأكيدُ إنشاء الحساب — يخرج بعد المعاملة على عرف هذا الملفّ (ي-٤).

      وصاحبُه هو الفاعلُ وهو على الشاشة، فهذا أخفُّ ما في الباب. وقيمتُه
      الباقيةُ أمنيّة: هنا تُعيَّن كلمةُ المرور ويصير الحسابُ حيّا، ورابطُ
      الدعوة يُستهلك مرّةً واحدة. فمن لم يكن هو من فعلَه يعلم في حينه. */
  private async confirmActivation(email: string, fullName: string): Promise<void> {
    await sendDirectEmail(this.prisma, {
      to: email,
      subject: 'أُنشئ حسابُك في أكاديمية وجيز',
      ...renderMail({
        greetingName: fullName,
        heading: 'أُنشئ حسابُك وفُتحت بوّابتُك',
        blocks: [
          { kind: 'p', text: 'تدخلها ببريدك هذا وكلمتك الجديدة.' },
          { kind: 'note', text: 'وإن لم تكن أنت من أنشأه فتواصل معنا فورا بردٍّ على هذه الرسالة — فرابطُ الدعوة يُستخدم مرّةً واحدةً وقد استُهلك.' },
        ],
      }),
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
    await this.notifyTrainerUser(profileId, {
      templateKey: 'trainer.qualified',
      title: 'أُهِّلتَ لتدريس دورة',
      body: `صرتَ مؤهَّلا لتدريس «${await this.courseTitleAr(courseId)}» — وتصلك شعبُها حين تُسنَد إليك.`,
      data: { courseId },
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
    const rows = await this.prisma.trainerCourseQualification.findMany({
      where: { status: 'pending' },
      include: {
        profile: { include: { application: { select: { fullName: true, status: true } } } },
        course: { include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
      },
      orderBy: { requestedAt: 'asc' },
    })
    /* الشعبةُ المطلوبةُ تُقرأ باسمها لا بمعرّفها: الموافقةُ **تؤهّل وتُسند
       معا**، فمن يوقّع يستحقّ أن يرى في أيّ شعبةٍ يضع المدرّبَ وفي أيّ تاريخ
       — لا أن يوافق على معرّفٍ سداسيّ عشر. */
    const cohortIds = [...new Set(rows.map((r) => r.requestedCohortId).filter((id): id is string => Boolean(id)))]
    const cohorts = cohortIds.length
      ? await this.prisma.cohort.findMany({
          where: { id: { in: cohortIds } },
          select: { id: true, title: true, startsAt: true, status: true },
        })
      : []
    const byId = new Map(cohorts.map((c) => [c.id, c]))
    return rows.map((r) => ({
      ...r,
      requestedCohort: r.requestedCohortId ? byId.get(r.requestedCohortId) ?? null : null,
    }))
  }

  /* ─────────── لوحُ التشغيل ───────────

     خمسةُ مساراتٍ في هذا الملفّ كانت بلا شاشةٍ تصل إليها: البتُّ في طلبات
     التأهيل، والتأهيلُ المباشر، والإسنادُ لشعبة، واعتمادُ الظهور العامّ،
     والإيقاف. فالخادمُ يعرف كيف يفعلها كلَّها ولا أحدَ يستطيع أن يطلبها.

     وبناءُ الشاشة كشف عطبا ثانيا: **قائمةُ المدرّبين نفسُها كانت وراء صلاحيةِ
     المستحقّات** (`trainer-profiles` ← `trainer.compensation.manage`) — وهي
     ليست للمدير الأكاديميّ. فمن يملك التأهيلَ والإسنادَ والإيقاف **لا يستطيع
     أن يرى من يؤهّله**. وهو عطبُ «من يبدأ لا يستطيع أن ينهي» نفسُه في موضعٍ
     آخر.

     فهذه قائمةٌ بصلاحيةِ التأهيل، وحمولتُها ما يلزم القرارَ لا أكثر: لا
     مبالغَ ولا قواعدَ تعويض. */
  async listForOps() {
    const profiles = await this.prisma.trainerProfile.findMany({
      include: {
        application: { select: { fullName: true, email: true, status: true } },
        qualifications: {
          include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } } },
        },
        assignments: {
          where: { status: 'active' },
          include: {
            course: { include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
            cohort: { select: { id: true, title: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return profiles.map((p) => ({
      profileId: p.id,
      applicationId: p.applicationId,
      name: p.application.fullName,
      email: p.application.email,
      applicationStatus: p.application.status,
      /* حسابٌ مربوطٌ أم لا: «نشطٌ» بلا حسابٍ لا يفتح بوّابتَه ولا يُسنَد إليه */
      hasAccount: Boolean(p.userId),
      suspended: Boolean(p.suspendedAt),
      publiclyVisible: p.publicVisibility && Boolean(p.publishApprovedAt),
      isVerified: p.isVerified,
      /* ما تعرضه صفحةُ الفريق — يُقرأ هنا ليُحرَّر هنا */
      headline: p.headline,
      bioPublic: p.bioPublic,
      photoUrl: photoPublicUrl(p.photoUrl),
      /* وصورةٌ رفعها هو وتنتظر قرارَنا — تُقرأ من مسار صور الحسابات لا من
         مسار الصور العامّة، فالعامُّ لا يخدم ما لم يُعتمد بعد. */
      pendingPhotoUrl: p.photoPendingKey ? `/api/v1/avatars/${p.photoPendingKey}` : null,
      qualifications: p.qualifications.map((q) => ({
        courseId: q.courseId,
        courseTitle: q.course.versions[0]?.titleAr ?? q.courseId,
        status: q.status,
      })),
      assignments: p.assignments.map((a) => ({
        courseId: a.courseId,
        courseTitle: a.course.versions[0]?.titleAr ?? a.courseId,
        cohortId: a.cohortId,
        cohortTitle: a.cohort?.title ?? null,
        cohortStatus: a.cohort?.status ?? null,
      })),
    }))
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
      /* والرفضُ خبرٌ أيضا: من طُلب تأهيلُه ولم يُقبل كان يبقى ينتظر بلا ردّ */
      await this.notifyTrainerUser(q.profileId, {
        templateKey: 'trainer.qualify.rejected',
        title: 'لم يُقبل تأهيلُك لدورة',
        body: `لم يُقبل تأهيلُك لتدريس «${await this.courseTitleAr(q.courseId)}» — والسبب: ${note}`,
        data: { courseId: q.courseId },
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
    await this.notifyTrainerUser(q.profileId, {
      templateKey: 'trainer.qualified',
      title: 'أُهِّلتَ لتدريس دورة',
      body: `صرتَ مؤهَّلا لتدريس «${await this.courseTitleAr(q.courseId)}» — وتصلك شعبُها حين تُسنَد إليك.`,
      data: { courseId: q.courseId },
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
    const courseTitle = await this.courseTitleAr(courseId)
    const cohort = cohortId
      ? await this.prisma.cohort.findUnique({ where: { id: cohortId }, select: { title: true, startsAt: true } })
      : null
    /* ي-٤: وإسنادُ الشعبة صار يُبلَّغ به من `assignTrainer` نفسِها، فيغطّي
       البابَين معا — هذا البابَ وبابَ الإدارة المباشر. فلا يبقى هنا إلّا
       ما لا تعرفه تلك الطريقة: إسنادُ **دورةٍ بلا شعبة**. */
    if (!cohort) {
      await this.notifyTrainerUser(profileId, {
        templateKey: 'trainer.assigned',
        title: 'أُسنِدت إليك دورة',
        body: `أُسنِدت إليك دورة «${courseTitle}» — وتصلك شعبُها حين تُجدوَل.`,
        data: { courseId, cohortId },
      })
    }
    return assignment
  }

  /* ═══ الملفُّ العامُّ للمدرّب — عنوانُه ونبذتُه وصورتُه ═══

     كان `headline` و`bioPublic` يُبذران مرّةً من نصّ الطلب ثمّ **لا يُعدَّلان
     أبدا**: لا في الإدارة ولا في بوّابة المدرّب. وهما ما تعرضه صفحةُ الفريق
     للعامّة. فنبذةٌ كُتبت في نموذج تقديمٍ قبل أشهرٍ هي وجهُ المدرّب إلى
     الناس، ولا سبيلَ إلى تحسينها إلّا بيدٍ في القاعدة.

     و`photoUrl` أسوأ: عمودٌ في المخطَّط **لا يكتبه شيءٌ في الشيفرة كلِّها**.

     وقرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): صورةُ المدرّب تُرفع، وأمرُ التخزين
     يُضبط بيده — «اجعل الموقعَ مستعدّا لهذا فورا». */
  async savePublicProfile(
    profileId: string, actorId: string,
    input: { headline?: string | null; bioPublic?: string | null; photoUrl?: string | null },
  ) {
    const profile = await this.requireActiveProfile(profileId)
    const data: Prisma.TrainerProfileUpdateInput = {}
    if (input.headline !== undefined) data.headline = input.headline?.trim() || null
    if (input.bioPublic !== undefined) data.bioPublic = input.bioPublic?.trim() || null

    if (input.photoUrl !== undefined) {
      const next = input.photoUrl?.trim() || null
      /* لا يُلصق في العمود إلّا رابطٌ آمنٌ أو مفتاحُ مخزنٍ أصدرناه نحن.
         عمودٌ يخرج إلى `src` في صفحةٍ عامّةٍ يقبل `javascript:` لو تُرك. */
      if (next && !next.startsWith('https://') && !next.startsWith(PHOTO_KEY_PREFIX)) {
        throw new AuthError('bad_photo', 'رابطُ الصورة يجب أن يبدأ بـhttps://', 422)
      }
      /* والصورةُ القديمةُ تُمحى من القرص حين تُستبدل — وإلّا بقيت بايتاتٌ
         لا يشير إليها سجلٌّ، ولا يعرف أحدٌ أنّها هناك ليحذفها. */
      const oldKey = photoStorageKey(profile.photoUrl)
      if (oldKey && oldKey !== photoStorageKey(next)) {
        try { await deleteObject(oldKey) } catch { /* غيابُها ليس عطبا */ }
      }
      data.photoUrl = next
    }

    const saved = await this.prisma.trainerProfile.update({ where: { id: profile.id }, data })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.public_profile.save', entityType: 'trainer_profile', entityId: profile.id,
      meta: { fields: Object.keys(data) },
    })
    return {
      headline: saved.headline, bioPublic: saved.bioPublic, photoUrl: photoPublicUrl(saved.photoUrl),
    }
  }

  /* ═══ ورفعُ الصورة: المفتاحُ يُكتب في العمود قبل أن تُرفع البايتات ═══

     `resolveStorageOwner` تعرف المالكَ من القاعدة. فلو أُصدر الرابطُ ثمّ
     كُتب العمودُ بعد الرفع، لَردّ مسارُ الرفع «لا مالك» — والمفتاحُ الذي
     أصدرناه توّا لا يقبله خادمُنا.

     فالعمودُ يُكتب أوّلا، والصورةُ تظهر حين تصل بايتاتُها. ومن بدأ رفعا ثمّ
     تركه يبقى عمودُه يشير إلى كائنٍ لا وجودَ له — فيردّ مسارُ العرض ٤٠٤،
     وهو أهونُ من رفعٍ لا يُقبل. */
  async startPhotoUpload(profileId: string, actorId: string, mime: string) {
    assertFileUploadsEnabled('والبديلُ الآن: ألصِق رابطَ الصورة مباشرةً في الحقل.')
    if (!(PHOTO_MIMES as readonly string[]).includes(mime)) {
      throw new AuthError('bad_mime', 'الصورةُ JPEG أو PNG أو WebP', 422)
    }
    const profile = await this.requireActiveProfile(profileId)
    const oldKey = photoStorageKey(profile.photoUrl)
    const storageKey = newStorageKey()
    await this.prisma.trainerProfile.update({
      where: { id: profile.id }, data: { photoUrl: `${PHOTO_KEY_PREFIX}${storageKey}` },
    })
    if (oldKey) { try { await deleteObject(oldKey) } catch { /* غيابُها ليس عطبا */ } }

    const exp = Date.now() + SIGNED_URL_TTL_MS
    const sig = signKey(storageKey, exp, 'write')
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.photo.upload', entityType: 'trainer_profile', entityId: profile.id,
    })
    return {
      storageKey,
      uploadUrl: `/api/v1/uploads/${storageKey}?exp=${exp}&sig=${sig}`,
      maxBytes: MAX_PHOTO_BYTES,
      photoUrl: photoPublicUrl(`${PHOTO_KEY_PREFIX}${storageKey}`),
    }
  }

  /* ═══ اعتمادُ صورةٍ رفعها المدرّبُ لنفسه — أو ردُّها ═══

     قرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «everyone can put their picture and
     the admin approves it». فالمدرّبُ يرفع من حسابه، فتسكن صورتُه
     `photoPendingKey` — عمودا لا تقرؤه الصفحةُ العامّة — ولا تصير
     `photoUrl` إلّا بيدِ الإدارة.

     والاعتمادُ ينقل المفتاحَ ويحذف الصورةَ العامّةَ القديمةَ من القرص. والردُّ
     يخلي العمودَ **ولا يحذف البايتات**: هي صورةُ حسابه التي يراها في ترويسته،
     وليست ملكَ الإدارة لتُمحى. فالمردودُ عرضُها عامّةً لا وجودُها. */
  async approvePendingPhoto(profileId: string, actorId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId }, select: { id: true, photoUrl: true, photoPendingKey: true },
    })
    if (!profile) throw new AuthError('not_found', 'الملفُّ غيرُ موجود', 404)
    if (!profile.photoPendingKey) {
      throw new AuthError('no_pending_photo', 'لا صورةَ تنتظر الاعتماد', 409)
    }
    const oldKey = photoStorageKey(profile.photoUrl)
    const updated = await this.prisma.trainerProfile.update({
      where: { id: profile.id },
      data: { photoUrl: `${PHOTO_KEY_PREFIX}${profile.photoPendingKey}`, photoPendingKey: null },
    })
    /* والقديمةُ تُحذف بعد النقل لا قبله: لو انقطع شيءٌ بينهما بقيت الأولى */
    if (oldKey && oldKey !== profile.photoPendingKey) {
      try { await deleteObject(oldKey) } catch { /* غيابُها ليس عطبا */ }
    }
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.photo.approve', entityType: 'trainer_profile', entityId: profile.id,
    })
    return { photoUrl: photoPublicUrl(updated.photoUrl) }
  }

  async rejectPendingPhoto(profileId: string, actorId: string, reasonAr?: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId }, select: { id: true, photoPendingKey: true },
    })
    if (!profile) throw new AuthError('not_found', 'الملفُّ غيرُ موجود', 404)
    if (!profile.photoPendingKey) {
      throw new AuthError('no_pending_photo', 'لا صورةَ تنتظر الاعتماد', 409)
    }
    await this.prisma.trainerProfile.update({
      where: { id: profile.id }, data: { photoPendingKey: null },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.photo.reject', entityType: 'trainer_profile', entityId: profile.id,
      reason: reasonAr,
    })
    return { ok: true }
  }

  /* ═══ اقتراحاتُ الدورات يحرّرها الأدمن ═══

     ─────────── العطبُ الذي كُتبت له ───────────

     الطلباتُ التي سبقت أ-٣ (١٣ سبتمبر) تحمل **فقرةً حرّةً واحدة**
     (`teachableOther`) لا صفوفا. وأوّلُ مدرّبةٍ حقيقيّةٍ في المنصّة من
     هؤلاء: كتبت ثماني دوراتٍ في فقرةٍ واحدة، فلا صفَّ يُربط بالكتالوج ولا
     اسمَ يُصحَّح.

     وقرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «أعطني المجال في ملفّها أن أضع اسمَ
     الدورة المقترحة بنفسي لغايات الربط… لأنّي كأدمن قد أقوم بتغيير اسم
     الدورة أو تصحيحٍ إملائيّ — فهذا الخيار ليس فقط لحلّ مشكلة اليوم بل
     تفادٍ مستقبليّ».

     ─────────── ولماذا العمودُ نفسُه لا عمودٌ ثانٍ ───────────

     `teachableProposals` هو ما تقرؤه الشاشةُ وما يُربط بالكتالوج. فلو كُتب
     تصحيحُ الأدمن في عمودٍ ثانٍ لصار للطلب مصدران للحقيقة، ولاحتاج كلُّ
     قارئٍ أن يعرف أيَّهما يغلب. فالأدمنُ يكتب في العمود نفسِه.

     **والفقرةُ القديمةُ تبقى كما كتبها صاحبُها**: لا تُمحى ولا تُقسَّم أسطرا
     تخمينا — التخمينُ يبتر جملةً كتبها إنسانٌ عن نفسه. وتُعرض تحت الصفوف
     مرجعا يُقارَن به.

     ─────────── والأثرُ يقول من غيّر ماذا ───────────

     ما يكتبه الأدمنُ في ملفّ متقدّمٍ عن نفسه يجب أن يُعرف أنّه ليس بقلمه —
     وإلّا قُرئ بعد شهرٍ كأنّ المتقدّمَ قاله. */
  async saveTeachableProposals(
    applicationId: string, actorId: string, rows: readonly { titleAr: string; summaryAr: string }[],
  ) {
    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: applicationId }, select: { id: true, teachableProposals: true },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)

    /* التشذيبُ بالدالّة المشتركة لا بيدٍ هنا: الشاشةُ والخادمُ يناديان
       الواحدةَ، فلا يفترق ما يُعرض عمّا يُخزَّن. */
    const next = cleanProposals(rows as { titleAr: string; summaryAr: string }[])
    const before = readProposals(app.teachableProposals)

    await this.prisma.trainerApplication.update({
      where: { id: applicationId },
      data: { teachableProposals: next as unknown as Prisma.InputJsonValue },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.application.proposals_edit',
      entityType: 'trainer_application', entityId: applicationId,
      before: { count: before.length, titles: before.map((p) => p.titleAr) },
      after: { count: next.length, titles: next.map((p) => p.titleAr) },
    })
    return next
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
    /* ═══ ويعلم صاحبُ الاسم أنّ اسمَه صار يُعرض (ي-٤) ═══

       هذا السطرُ فوقُ يضع اسمَه وسيرتَه وصورتَه على الموقع العامّ وفي صفحته
       باسمه. وكان يقع بلا خبر: يُنشَر ملفُّ إنسانٍ للناس ولا يعلم متى نُشر
       ولا أنّ ما فيه صار يُقرأ. وقاعدةُ المستودَع نفسُها تقول «لا اسمَ
       مدرّبٍ يُعرض قبل اعتماد نشره» — فاللحظةُ التي يقع فيها الاعتمادُ
       أولى اللحظات بأن تبلغه. */
    await this.notifyTrainerUser(profile.id, {
      templateKey: 'trainer.publish.approved',
      title: 'اعتُمد ظهورُك للعامّة',
      body: 'صار ملفُّك — اسمُك وسيرتُك وما أُهِّلتَ له — يظهر في صفحة مدرّبي الأكاديمية وفي صفحتك باسمك. راجِعه، فما فيه هو ما يقرؤه الناس.',
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
    /* ═══ ولا يُترك يكتشف الإيقافَ عند الباب (ي-٤) ═══

       المعاملةُ فوقُ توقف حسابَه وتُبطل جلساتِه كلَّها، فيجد بوّابتَه مغلقةً
       بلا كلمة. و**البريدُ لا الجرس**: `auth.service` يمنع الدخولَ على غير
       `active`، فصفُّ إشعارٍ في القاعدة لا يقرؤه أحدٌ أبدا — وهو أسوأُ من
       الصمت لأنّه يُحسَب إخبارا وليس به.

       وبعد المعاملة لا داخلَها: بريدٌ يُخفق لا ينقض إيقافا وقع، والإيقافُ
       حقيقةٌ في القاعدة قبله. */
    const portalUrl = `${publicSiteUrl()}/trainer`
    await sendDirectEmail(this.prisma, {
      to: profile.application.email,
      subject: 'أُوقف حسابُك في أكاديمية وجيز',
      ...renderMail({
        greetingName: profile.application.fullName,
        heading: 'أُوقف حسابُك في أكاديمية وجيز',
        blocks: [
          { kind: 'p', text: 'لا تُفتح بوّابتُك ولا تُسنَد إليك شعبةٌ جديدة حتّى يُرفع الإيقاف، وشعبُك القائمةُ تبقى كما هي عند الأكاديمية.' },
          ...(note ? [{ kind: 'p' as const, text: `والسببُ الذي كُتب: ${note}` }] : []),
          { kind: 'p', text: [
            'وإن كان في الأمر لبسٌ فردَّ على هذه الرسالة. و',
            { text: 'بوّابتك', href: portalUrl }, ' تفتح من موضعها حين يُرفع الإيقاف.',
          ] },
        ],
      }),
    })

    if (profile.application.status === 'active') {
      await this.apps.transition(profile.applicationId, 'suspended', actorId, note ?? 'إيقاف المدرب')
    }
  }

  /** القائمة العامة — بوّابةُ الظهور الواحدة (`trainer-visibility.ts`) + طلبٌ نشط */
  async listPublicTrainers() {
    const profiles = await this.prisma.trainerProfile.findMany({
      where: { ...PUBLIC_TRAINER_WHERE, application: { status: 'active' } },
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
      photoUrl: photoPublicUrl(p.photoUrl),
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
    /* البوّابةُ نفسُها التي تحكم الصفحةَ العامّة — كانت هنا بلا شرط اعتمادِ
       النشر، فبطاقةُ الدورة تُظهر ما تخفيه الصفحةُ العامّة عند أوّل افتراق. */
    const visible = assignments.filter((a) => trainerPubliclyVisible(a.profile))
    if (!visible.length) return { announced: false, messageAr: 'سيتم تعيين المدرب قريبا', trainers: [] }
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

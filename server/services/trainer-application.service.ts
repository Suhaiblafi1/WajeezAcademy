/* خدمة طلبات انضمام المدربين — الدورة العامة:
   تقديم المرحلة الأولى، تحقق البريد، منع التكرار، رقم مرجعي،
   عرض حالة آمن، استكمال المرحلة الثانية للمرشحين، وثائق خاصة.
   كل انتقال حالة يُسجَّل في TrainerStatusHistory وAuditEvent. */

import { createHash, randomBytes } from 'node:crypto'
import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { notifyRole, sendDirectEmail, publicSiteUrl, type DirectMailStatus } from './notification.service'
import { newStorageKey, signKey, SIGNED_URL_TTL_MS, MAX_UPLOAD_BYTES } from './storage.service'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')

export const TRAINER_STATUSES = [
  'draft', 'email_verification_pending', 'submitted', 'under_review', 'information_requested',
  'shortlisted', 'interview_scheduled', 'demo_requested', 'academic_review',
  'conditionally_approved', 'contract_pending', 'onboarding', 'active',
  'waitlisted', 'rejected', 'withdrawn', 'suspended',
] as const
export type TrainerStatus = (typeof TRAINER_STATUSES)[number]

/* خريطة الانتقالات المشروعة — أي انتقال خارجها مرفوض */
export const ALLOWED_TRANSITIONS: Record<TrainerStatus, TrainerStatus[]> = {
  draft: ['email_verification_pending', 'withdrawn'],
  email_verification_pending: ['submitted', 'withdrawn'],
  submitted: ['under_review', 'waitlisted', 'rejected', 'withdrawn'],
  under_review: ['information_requested', 'shortlisted', 'waitlisted', 'rejected', 'withdrawn'],
  information_requested: ['under_review', 'rejected', 'withdrawn'],
  shortlisted: ['interview_scheduled', 'demo_requested', 'waitlisted', 'rejected', 'withdrawn'],
  interview_scheduled: ['demo_requested', 'waitlisted', 'rejected', 'withdrawn'],
  demo_requested: ['academic_review', 'rejected', 'withdrawn'],
  academic_review: ['conditionally_approved', 'waitlisted', 'rejected', 'withdrawn'],
  conditionally_approved: ['contract_pending', 'rejected', 'withdrawn'],
  contract_pending: ['onboarding', 'rejected', 'withdrawn'],
  onboarding: ['active', 'withdrawn'],
  active: ['suspended'],
  waitlisted: ['under_review', 'rejected', 'withdrawn'],
  rejected: [],
  withdrawn: [],
  suspended: ['active'],
}

/* حالات تُفتح فيها المرحلة الثانية للمرشح */
const PHASE2_OPEN_STATUSES: TrainerStatus[] = [
  'information_requested', 'shortlisted', 'interview_scheduled', 'demo_requested', 'academic_review',
]

/* حالات نهائية تسمح بطلب جديد لنفس البريد */
const TERMINAL_STATUSES: TrainerStatus[] = ['rejected', 'withdrawn']

const VERIFY_TTL_MS = 24 * 3600_000

export interface Phase1Input {
  fullName: string
  email: string
  phoneCountryCode?: string
  phone?: string
  country?: string
  timezone?: string
  employmentStatus?: 'employed' | 'own_business' | 'full_time_training'
  jobTitle?: string
  specialties: string[]
  domainYears: string
  trainingYears: string
  bio?: string
  linkedinUrl?: string
  youtubeUrl?: string
  instagramUrl?: string
  hasAccreditation?: boolean
  accreditationDetails?: string
  targetCountries?: string[]
  targetAudiences?: string[]
  trainingLanguages: string[]
  deliveryMode: 'in_person' | 'remote' | 'both'
  motivation: string
  privacyConsent: boolean
}

export class TrainerApplicationService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** تقديم المرحلة الأولى — ينشئ الطلب برقم مرجعي ويرسل رمز تحقق البريد */
  async submitPhase1(input: Phase1Input): Promise<{
    reference: string
    verificationTokenForDelivery: string
    /* حالة تسليم رمز التحقق — 'sent' وحدها تعني أن البريد بوابةٌ فعلية */
    emailDelivery: DirectMailStatus
    /* يُصدر فقط حين تعذّر البريد: الطلب يمضي بلا بوابة، فيحتاج المتقدم رمز وصوله */
    candidateToken?: string
  }> {
    const email = input.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError('invalid_email', 'صيغة البريد غير صحيحة')
    if (!input.privacyConsent) throw new AuthError('consent_required', 'موافقة الخصوصية إلزامية')
    if (!input.specialties.length) throw new AuthError('no_specialty', 'اختر تخصصا تدريبيا واحدا على الأقل')
    if (input.fullName.trim().length < 3) throw new AuthError('invalid_name', 'الاسم الكامل مطلوب')
    if (input.motivation.trim().length < 10) throw new AuthError('invalid_motivation', 'اكتب سبب انضمامك بوضوح')

    /* منع التكرار: بريد له طلب حي لا يقدم مرة أخرى */
    const existing = await this.prisma.trainerApplication.findFirst({
      where: { email, status: { notIn: TERMINAL_STATUSES } },
      select: { reference: true, status: true },
    })
    if (existing) {
      throw new AuthError('duplicate_application', `لديك طلب قائم برقم ${existing.reference} — تابع حالته بدل التقديم مجددا`, 409)
    }

    const reference = await this.nextReference()
    const verifyToken = newToken()
    const app = await this.prisma.trainerApplication.create({
      data: {
        reference,
        status: 'email_verification_pending',
        email,
        fullName: input.fullName.trim(),
        phoneCountryCode: input.phoneCountryCode, phone: input.phone,
        country: input.country, timezone: input.timezone,
        employmentStatus: input.employmentStatus, jobTitle: input.jobTitle,
        domainYears: input.domainYears, trainingYears: input.trainingYears,
        bio: input.bio, linkedinUrl: input.linkedinUrl,
        youtubeUrl: input.youtubeUrl, instagramUrl: input.instagramUrl,
        hasAccreditation: input.hasAccreditation, accreditationDetails: input.accreditationDetails,
        targetCountries: input.targetCountries ?? [], targetAudiences: input.targetAudiences ?? [],
        trainingLanguages: input.trainingLanguages, deliveryMode: input.deliveryMode,
        motivation: input.motivation,
        privacyConsentAt: new Date(),
        emailVerifyTokenHash: sha256(verifyToken),
        emailVerifyExpiresAt: new Date(Date.now() + VERIFY_TTL_MS),
        specialties: { create: input.specialties.map((specialty) => ({ specialty })) },
        statusHistory: { create: { fromStatus: null, toStatus: 'email_verification_pending', note: 'إنشاء الطلب' } },
      },
    })
    await recordAudit(this.prisma, {
      action: 'trainer.application.submit', entityType: 'trainer_application', entityId: app.id,
      meta: { reference, email },
    })

    /* إرسال رمز التحقق فعليا — لا في التطوير وحده */
    const link = `${publicSiteUrl()}/join-trainer?ref=${encodeURIComponent(reference)}&token=${encodeURIComponent(verifyToken)}`
    const mail = await sendDirectEmail(this.prisma, {
      to: email,
      subject: `تأكيد طلب الانضمام كمدرب — ${reference}`,
      text:
        `مرحبا ${input.fullName.trim()},\n\n` +
        `وصلنا طلبك للانضمام إلى نخبة مدربي أكاديمية وجيز برقم ${reference}.\n` +
        `أكّد بريدك من هذا الرابط خلال 24 ساعة:\n${link}\n\n` +
        `أو أدخل هذا الرمز في صفحة الطلب: ${verifyToken}\n\n` +
        `إن لم تكن أنت من قدّم الطلب فتجاهل هذه الرسالة.\n— أكاديمية وجيز`,
    })

    /* قناة البريد غير مفعّلة أصلا: البوابة لا تستطيع أن تعمل، وإبقاء الطلب عندها
       يعني أن أحدا لا يستطيع التقدم أبدا — وهو ما كان يقع في الإنتاج فعلا. فيمضي
       الطلب إلى «مقدَّم» بأثر صريح يقول إن البريد لم يُتحقَّق منه، فيرى المراجع
       أن دليله أضعف بدل أن يظن أنه تحقّق. وemailVerifiedAt يبقى فارغا.

       أما الإخفاق مع قناة مفعّلة (انقطاع، عنوان خاطئ، رفض الخادم) فلا يُسقط
       البوابة: هو عابر وله طريق إصلاح قائم — إعادة الإرسال. إسقاطها عنده يحوّل
       عطلا مؤقتا إلى طلب غير موثَّق للأبد. */
    if (mail.status === 'not_configured') {
      const candidateToken = await this.acceptWithoutEmailGate(app.id, reference, mail.status, mail.error)
      return { reference, verificationTokenForDelivery: verifyToken, emailDelivery: mail.status, candidateToken }
    }
    return { reference, verificationTokenForDelivery: verifyToken, emailDelivery: mail.status }
  }

  /** ينقل الطلب إلى «مقدَّم» بلا تحقق بريدي — يُستدعى فقط حين تتعذّر قناة البريد */
  private async acceptWithoutEmailGate(
    applicationId: string, reference: string, why: DirectMailStatus, error?: string,
  ): Promise<string> {
    const candidateToken = newToken()
    const note = why === 'not_configured'
      ? 'قناة البريد غير مفعّلة — قُبل الطلب بلا تحقق بريدي'
      : `تعذّر إرسال رمز التحقق (${error ?? 'سبب غير معروف'}) — قُبل الطلب بلا تحقق بريدي`
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerApplication.update({
        where: { id: applicationId },
        data: {
          status: 'submitted',
          /* emailVerifiedAt يبقى فارغا: لم يُتحقَّق منه فعلا، ولا نكتب ما لم يقع */
          emailVerifyTokenHash: null, emailVerifyExpiresAt: null,
          accessTokenHash: sha256(candidateToken),
        },
      })
      await tx.trainerStatusHistory.create({
        data: { applicationId, fromStatus: 'email_verification_pending', toStatus: 'submitted', note },
      })
      await recordAudit(tx, {
        action: 'trainer.application.email_gate_skipped', entityType: 'trainer_application', entityId: applicationId,
        meta: { reference, why },
      })
    })
    await notifyRole(this.prisma, ['super_admin', 'academic_manager', 'operations_manager'], {
      channel: 'in_app',
      title: 'طلب انضمام مدرب — بلا تحقق بريدي',
      body: `وصل طلب (${reference}) وقناة البريد لم تُسلّم رمز التحقق، فقُبل بلا تحقق. راجعه بدليل أضعف من المعتاد.`,
      templateKey: 'admin.trainer_application',
      data: { applicationId, reference },
    })
    return candidateToken
  }

  /** تحقق البريد — ينقل الطلب إلى submitted ويصدر رمز وصول المرشح */
  async verifyEmail(reference: string, token: string): Promise<{ candidateToken: string; status: TrainerStatus }> {
    const app = await this.prisma.trainerApplication.findUnique({ where: { reference } })
    if (!app) throw new AuthError('not_found', 'رقم مرجعي غير معروف', 404)
    if (app.status === 'submitted' && app.accessTokenHash) {
      /* إعادة نقر على الرابط — لا نصدر رمزا جديدا ولا نكشف شيئا */
      throw new AuthError('already_verified', 'بريدك متحقق منه مسبقا — رمز الوصول أُرسل عند التحقق الأول', 409)
    }
    if (app.status !== 'email_verification_pending') throw new AuthError('bad_state', 'حالة الطلب لا تسمح بالتحقق', 409)
    if (!app.emailVerifyTokenHash || app.emailVerifyTokenHash !== sha256(token)) {
      throw new AuthError('invalid_token', 'رابط التحقق غير صالح', 400)
    }
    if (app.emailVerifyExpiresAt && app.emailVerifyExpiresAt < new Date()) {
      throw new AuthError('expired_token', 'رابط التحقق منتهي — أعد تقديم الطلب', 410)
    }
    const candidateToken = newToken()
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerApplication.update({
        where: { id: app.id },
        data: {
          status: 'submitted', emailVerifiedAt: new Date(),
          emailVerifyTokenHash: null, emailVerifyExpiresAt: null,
          accessTokenHash: sha256(candidateToken),
        },
      })
      await tx.trainerStatusHistory.create({
        data: { applicationId: app.id, fromStatus: 'email_verification_pending', toStatus: 'submitted', note: 'تحقق البريد' },
      })
      await recordAudit(tx, {
        action: 'trainer.application.verify_email', entityType: 'trainer_application', entityId: app.id,
        meta: { reference },
      })
    })
    /* الطلب اكتمل تحققه وصار «مقدماً» — أشعر لجنة الاستقبال فوراً */
    await notifyRole(this.prisma, ['super_admin', 'academic_manager', 'operations_manager'], {
      channel: 'in_app',
      title: 'طلب انضمام مدرب جديد',
      body: `قدّم ${app.fullName} طلب انضمام (${reference}) وتحقق من بريده — بانتظار الفرز الأولي في «طلبات المدربين».`,
      templateKey: 'admin.trainer_application',
      data: { applicationId: app.id, reference },
    })
    return { candidateToken, status: 'submitted' }
  }

  /** إعادة إرسال رمز التحقق — نفس الرد سواء وُجد الطلب أم لا */
  async resendVerification(email: string): Promise<{ tokenForDelivery: string | null; emailDelivery: DirectMailStatus | null }> {
    const normalized = email.trim().toLowerCase()
    const app = await this.prisma.trainerApplication.findFirst({
      where: { email: normalized, status: 'email_verification_pending' },
    })
    if (!app) return { tokenForDelivery: null, emailDelivery: null }
    const token = newToken()
    await this.prisma.trainerApplication.update({
      where: { id: app.id },
      data: { emailVerifyTokenHash: sha256(token), emailVerifyExpiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
    })
    const link = `${publicSiteUrl()}/join-trainer?ref=${encodeURIComponent(app.reference)}&token=${encodeURIComponent(token)}`
    const mail = await sendDirectEmail(this.prisma, {
      to: normalized,
      subject: `رمز تحقق جديد — ${app.reference}`,
      text:
        `أعدنا إرسال رمز تحقق بريدك لطلب الانضمام ${app.reference}.\n` +
        `أكّده من هذا الرابط خلال 24 ساعة:\n${link}\n\nأو أدخل الرمز: ${token}\n\n— أكاديمية وجيز`,
    })
    return { tokenForDelivery: token, emailDelivery: mail.status }
  }

  /** عرض الحالة بأمان — يتطلب البريد مطابقا للرقم المرجعي ويكشف الحالة فقط */
  async getPublicStatus(reference: string, email: string): Promise<{ reference: string; status: TrainerStatus; createdAt: Date }> {
    const app = await this.prisma.trainerApplication.findUnique({ where: { reference } })
    const normalized = email.trim().toLowerCase()
    if (!app || app.email !== normalized) {
      throw new AuthError('not_found', 'لا يوجد طلب بهذا الرقم والبريد معا', 404)
    }
    return { reference: app.reference, status: app.status as TrainerStatus, createdAt: app.createdAt }
  }

  /** يحل رمز المرشح إلى الطلب — حارس المرحلة الثانية والوثائق */
  async resolveCandidate(reference: string, token: string) {
    const app = await this.prisma.trainerApplication.findUnique({ where: { reference } })
    if (!app || !app.accessTokenHash || app.accessTokenHash !== sha256(token)) {
      throw new AuthError('invalid_candidate_token', 'رابط المرشح غير صالح', 401)
    }
    return app
  }

  /** استكمال المرحلة الثانية — للمرشحين فقط وحين تكون الحالة تسمح */
  async completePhase2(reference: string, token: string, input: {
    previousCourses: { title: string; org?: string; year?: number; learnersCount?: number }[]
    totalLearners?: number
    previousOrgs?: string
    evidenceNotes?: string
    teachableCourseIds: string[]
    availability: { days?: string[]; hoursPerWeek?: number; startFrom?: string }
    demoConsent: boolean
  }): Promise<{ phase2CompletedAt: Date }> {
    const app = await this.resolveCandidate(reference, token)
    if (!PHASE2_OPEN_STATUSES.includes(app.status as TrainerStatus)) {
      throw new AuthError('phase2_closed', 'المرحلة الثانية تُفتح بعد اختصار طلبك من الإدارة', 409)
    }
    if (!input.demoConsent) throw new AuthError('demo_consent_required', 'الموافقة على درس تجريبي (Demo) إلزامية للاستكمال')
    if (input.previousCourses.length > 3) throw new AuthError('too_many_courses', 'ثلاث دورات سابقة كحد أقصى')
    if (!input.teachableCourseIds.length) throw new AuthError('no_teachable', 'اختر دورة واحدة على الأقل تستطيع تدريسها')

    /* التحقق من وجود الدورات المختارة في الكتالوج */
    const courses = await this.prisma.course.findMany({
      where: { id: { in: input.teachableCourseIds } }, select: { id: true },
    })
    if (courses.length !== input.teachableCourseIds.length) {
      throw new AuthError('unknown_course', 'دورة أو أكثر من المختارة غير موجودة في الكتالوج')
    }

    const done = new Date()
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerApplication.update({
        where: { id: app.id },
        data: {
          phase2CompletedAt: done,
          previousCourses: input.previousCourses as unknown as Prisma.InputJsonValue,
          totalLearners: input.totalLearners ?? null,
          previousOrgs: input.previousOrgs, evidenceNotes: input.evidenceNotes,
          teachableCourseIds: input.teachableCourseIds,
          availability: input.availability as unknown as Prisma.InputJsonValue,
          demoConsent: input.demoConsent,
        },
      })
      await recordAudit(tx, {
        action: 'trainer.application.phase2_complete', entityType: 'trainer_application', entityId: app.id,
        meta: { reference, teachableCourseIds: input.teachableCourseIds },
      })
      /* استكمال المرحلة الثانية بعد طلب معلومات يعيد الطلب للمراجعة تلقائيا */
      if (app.status === 'information_requested') {
        await tx.trainerApplication.update({ where: { id: app.id }, data: { status: 'under_review' } })
        await tx.trainerStatusHistory.create({
          data: { applicationId: app.id, fromStatus: 'information_requested', toStatus: 'under_review', note: 'استكمال المرحلة الثانية' },
        })
        await recordAudit(tx, {
          action: 'trainer.status.transition', entityType: 'trainer_application', entityId: app.id,
          meta: { from: 'information_requested', to: 'under_review', note: 'استكمال المرحلة الثانية' },
        })
      }
    })
    return { phase2CompletedAt: done }
  }

  /** تسجيل وثيقة وإصدار رابط رفع موقّع — الملف نفسه يُرفع عبر PUT لاحقا */
  async requestDocumentUpload(reference: string, token: string, input: {
    kind: string; originalName: string; mime: string; sizeBytes: number
  }): Promise<{ documentId: string; storageKey: string; uploadUrl: string }> {
    const app = await this.resolveCandidate(reference, token)
    const max = MAX_UPLOAD_BYTES[input.kind]
    if (!max) throw new AuthError('bad_kind', 'نوع وثيقة غير مدعوم')
    if (input.sizeBytes <= 0 || input.sizeBytes > max) {
      throw new AuthError('too_large', `حجم الملف يتجاوز الحد المسموح لهذا النوع (${Math.round(max / 1048576)}MB)`, 413)
    }
    const storageKey = newStorageKey()
    const doc = await this.prisma.trainerApplicationDocument.create({
      data: {
        applicationId: app.id, kind: input.kind, storageKey,
        originalName: input.originalName.slice(0, 200), mime: input.mime, sizeBytes: input.sizeBytes,
      },
    })
    const exp = Date.now() + SIGNED_URL_TTL_MS
    const sig = signKey(storageKey, exp, 'write')
    await recordAudit(this.prisma, {
      action: 'trainer.document.register', entityType: 'trainer_application', entityId: app.id,
      meta: { reference, kind: input.kind, storageKey },
    })
    return { documentId: doc.id, storageKey, uploadUrl: `/api/v1/uploads/${storageKey}?exp=${exp}&sig=${sig}` }
  }

  /** قائمة وثائق طلب مع روابط قراءة موقّعة قصيرة العمر — للإدارة */
  signedDocumentUrls(documents: { storageKey: string }[]): Record<string, string> {
    const out: Record<string, string> = {}
    for (const d of documents) {
      const exp = Date.now() + SIGNED_URL_TTL_MS
      out[d.storageKey] = `/api/v1/documents/${d.storageKey}?exp=${exp}&sig=${signKey(d.storageKey, exp, 'read')}`
    }
    return out
  }

  /** انتقال حالة موثق — القلب الوحيد الذي تمر منه كل التحولات */
  async transition(
    applicationId: string, to: TrainerStatus, actorId: string | null, note?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const run = async (db: Prisma.TransactionClient) => {
      const app = await db.trainerApplication.findUnique({ where: { id: applicationId } })
      if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)
      const from = app.status as TrainerStatus
      if (from === to) return
      if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
        throw new AuthError('bad_transition', `لا يمكن الانتقال من «${from}» إلى «${to}»`, 409)
      }
      await db.trainerApplication.update({ where: { id: applicationId }, data: { status: to } })
      await db.trainerStatusHistory.create({
        data: { applicationId, fromStatus: from, toStatus: to, actorId, note },
      })
      await recordAudit(db, {
        actorId, action: 'trainer.status.transition', entityType: 'trainer_application', entityId: applicationId,
        meta: { from, to, note },
      })
    }
    if (tx) await run(tx)
    else await this.prisma.$transaction(run)
  }

  /** سحب الطلب — فعل المرشح نفسه برمز وصوله */
  async withdraw(reference: string, token: string, reason?: string): Promise<void> {
    const app = await this.resolveCandidate(reference, token)
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerApplication.update({ where: { id: app.id }, data: { withdrawReason: reason ?? null } })
      await this.transition(app.id, 'withdrawn', null, 'سحب الطلب من المتقدم', tx)
    })
  }

  /** رقم مرجعي متسلسل — WJ-TR-YYYY-##### داخل عداد ذري */
  private async nextReference(): Promise<string> {
    const year = new Date().getFullYear()
    const count = await this.prisma.trainerApplication.count()
    return `WJ-TR-${year}-${String(count + 1).padStart(5, '0')}`
  }
}

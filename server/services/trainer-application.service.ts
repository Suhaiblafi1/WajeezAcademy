/* خدمة طلبات انضمام المدربين — الدورة العامة:
   القسمُ الأوّل ينشئ الطلبَ مسودّةً **وحسابَ صاحبه** بكلمةٍ يختارها، فيدخل
   بها ويرى حالته بلا رمزٍ يُنسخ. والقسمُ الأخير يُكمل الطلبَ ويُرسل بريدَ
   التأكيد بتفاصيله ورقمه — وهو بريدُ توثيق العنوان أيضا. ومنعُ التكرار،
   ورقمٌ مرجعيّ، وحالةٌ تُقرأ بالبريد، ووثائقُ خاصّة.
   كل انتقال حالة يُسجَّل في TrainerStatusHistory وAuditEvent. */

import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { notifyRole, sendDirectEmail, publicSiteUrl, type DirectMailStatus } from './notification.service'
import { newStorageKey, signKey, SIGNED_URL_TTL_MS, MAX_UPLOAD_BYTES } from './storage.service'
/* مُنسّقُ التاريخ من مصدرِ اللغة الواحد — لا `Intl` جديدٌ يُسمّي لغةً بنفسه:
   موضعان يسمّيانها يفترقان في التقويم أو الأرقام يوما ما. */
import { fmtDateLong } from '../../src/application/text/format-ar'
import {
  CONTACT_CHANNELS, contactChannelLabel,
  type ContactChannel, type TrainingSeason,
} from '../../src/application/trainer/application-options'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')

export const TRAINER_STATUSES = [
  'draft', 'email_verification_pending', 'submitted', 'under_review', 'information_requested',
  'shortlisted', 'interview_scheduled', 'demo_requested', 'academic_review',
  'conditionally_approved', 'contract_pending', 'onboarding', 'active',
  'waitlisted', 'rejected', 'withdrawn', 'suspended',
] as const
export type TrainerStatus = (typeof TRAINER_STATUSES)[number]

/** الحالات المنتهية التي يجوز حذفُ طلبها نهائيّا — وما عداها قيدُ نظرٍ أو تعاقد */
export const PURGEABLE_STATUSES: TrainerStatus[] = ['draft', 'email_verification_pending', 'rejected', 'withdrawn']

/* خريطة الانتقالات المشروعة — أي انتقال خارجها مرفوض */
export const ALLOWED_TRANSITIONS: Record<TrainerStatus, TrainerStatus[]> = {
  /* المسودّة: القسمُ الأوّل وصل ولم يُكمَل — تصير مقدَّمةً حين يُكمَل */
  draft: ['submitted', 'email_verification_pending', 'withdrawn'],
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

/* حالات يُقبل فيها استكمال الملف المهني.

   كانت تبدأ بـinformation_requested — أي أن الملف لا يُفتح إلا بقرار إدارة.
   وكان لذلك سبب: ألا نطلب من كل متقدّم رفع سيرة وفيديو قبل أن نقرأ طلبه.
   لكنه صار كلفةً أعلى من فائدته: كل متقدّم يعبر بابين، وبينهما رسالة بريد —
   ومن لم تصله توقّف طلبه عند نصفه، ولا يعلم أحد.

   والنموذج صار واحدا بأربعة أقسام (2026-08-28): يعطي المتقدّم كل شيء مرة
   واحدة، والإدارة تقرأ طلبا مكتملا لا نصفه. فأُضيف submitted إلى القائمة —
   والحالات القديمة باقية كي لا ينكسر طلبٌ في منتصف الدورة القديمة. */
const PHASE2_OPEN_STATUSES: TrainerStatus[] = [
  'draft', 'submitted',
  'information_requested', 'shortlisted', 'interview_scheduled', 'demo_requested', 'academic_review',
]

/* حالات نهائية تسمح بطلب جديد لنفس البريد */
const TERMINAL_STATUSES: TrainerStatus[] = ['rejected', 'withdrawn']

/* رابطُ التأكيد في بريدٍ يُقرأ بعد أيّام لا ساعات — سبعةُ أيّام */
const VERIFY_TTL_MS = 7 * 24 * 3600_000

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
  /** كلمةُ مرور حسابه — يدخل بها ببريده ليرى حالة طلبه */
  password: string
}

export interface ContactPreference {
  channel: ContactChannel
  altEmail?: string
}

export interface AvailabilityInput {
  days?: string[]
  hoursPerWeek?: number
  startFrom?: string
  periods?: string[]
  /** مواسمُ التدريب التي يستطيع فيها — أكثرُ من واحد */
  seasons?: TrainingSeason[]
}

export class TrainerApplicationService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** القسمُ الأوّل — ينشئ الطلبَ مسودّةً وحسابَ صاحبه، ويُعيد رمزَ المتابعة.

      لا بريدَ هنا: البريدُ يُرسَل حين يكتمل الطلب، بتفاصيله كلِّها. ومن أغلق
      النموذجَ بعد هذا القسم بقيت مسودّتُه عند الخادم وحسابُه يفتحها.

      والحسابُ ببريد الطلب وكلمةٍ يختارها. فإن كان للبريد حسابٌ قائم (متعلّمٌ
      مثلا) وجب أن تكون الكلمةُ كلمتَه: لا يُربَط طلبٌ بحساب غيرِك بمعرفة
      بريده وحده. ومسودّةٌ قائمة لنفس البريد تُستأنف لا تُرفض — بعد الكلمة. */
  async submitPhase1(input: Phase1Input): Promise<{
    reference: string
    candidateToken: string
    userId: string
    /** كانت مسودّةٌ سابقة فحُدِّثت بدل أن يُنشأ طلبٌ ثانٍ */
    resumed: boolean
  }> {
    const email = input.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError('invalid_email', 'صيغة البريد غير صحيحة')
    if (!input.privacyConsent) throw new AuthError('consent_required', 'موافقة الخصوصية إلزامية')
    if (!input.specialties.length) throw new AuthError('no_specialty', 'اختر تخصصا تدريبيا واحدا على الأقل')
    if (input.fullName.trim().length < 3) throw new AuthError('invalid_name', 'الاسم الكامل مطلوب')
    if (typeof input.password !== 'string' || input.password.length < 8) {
      throw new AuthError('weak_password', 'كلمة المرور 8 أحرف على الأقل')
    }
    /* الحدّ ٧٥ حرفا لا عشرة: «أحب التدريب» جوابٌ يمرّ ولا يُقرأ منه شيء،
       ولا يفاضل بين طلبين. والحدّ يُفحص هنا أيضا لا في المسار وحده — لا مسار
       تقديم يتخطّى القاعدة (لا من API ولا من اختبار). */
    const motivation = input.motivation.trim()
    if (motivation.length < 75) throw new AuthError('invalid_motivation', 'اكتب ٧٥ حرفا على الأقل — وأضف مثالا يوضّح القيمة التي ستقدّمها للمتعلمين')
    if (motivation.length > 500) throw new AuthError('invalid_motivation', 'خمسمائة حرف كحد أقصى — الاختصار جزء من المهارة')

    /* منع التكرار: بريد له طلب حي لا يقدم مرة أخرى — إلّا مسودّةً لم تُكمَل فتُستأنف */
    const existing = await this.prisma.trainerApplication.findFirst({
      where: { email, status: { notIn: TERMINAL_STATUSES } },
      orderBy: { createdAt: 'desc' },
    })
    if (existing && existing.status !== 'draft') {
      throw new AuthError(
        'duplicate_application',
        `لديك طلب قائم برقم ${existing.reference} — سجّل الدخول ببريدك لمتابعة حالته بدل التقديم مجددا`,
        409,
      )
    }

    /* الحساب: قائمٌ فكلمتُه، أو جديدٌ بكلمته */
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (user) {
      const ok = await bcrypt.compare(input.password, user.passwordHash)
      if (!ok) {
        throw new AuthError(
          'email_taken',
          'لهذا البريد حساب على المنصة — أدخل كلمة مروره الحالية ليُربط طلبك به، أو استعدها من «نسيت كلمة المرور»',
          409,
        )
      }
      if (user.status !== 'active') throw new AuthError('account_suspended', 'هذا الحساب موقوف — تواصل مع الدعم', 403)
    }

    const candidateToken = newToken()
    const phase1Data = {
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
      motivation,
      privacyConsentAt: new Date(),
      accessTokenHash: sha256(candidateToken),
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let userId: string
      if (user) {
        userId = user.id
        await tx.userRole.upsert({
          where: { userId_roleId: { userId, roleId: 'trainer_applicant' } },
          update: {}, create: { userId, roleId: 'trainer_applicant' },
        })
      } else {
        /* لا حسابَ متعلّم: من يتقدّم للتدريب ليس طالبا. الدورُ دورُ التقديم
           وحده، وصلاحيتُه رؤيةُ طلبه هو. */
        const created = await tx.user.create({
          data: {
            email,
            displayName: phase1Data.fullName,
            passwordHash: await bcrypt.hash(input.password, 10),
            roles: { create: { roleId: 'trainer_applicant' } },
          },
        })
        userId = created.id
      }

      if (existing) {
        /* مسودّةٌ تُستأنف: القسمُ الأوّل يُكتب من جديد، والرمزُ يُبدَّل */
        await tx.trainerApplicationSpecialty.deleteMany({ where: { applicationId: existing.id } })
        await tx.trainerApplication.update({
          where: { id: existing.id },
          data: {
            ...phase1Data, userId,
            specialties: { create: input.specialties.map((specialty) => ({ specialty })) },
          },
        })
        await recordAudit(tx, {
          actorId: userId, action: 'trainer.application.resume', entityType: 'trainer_application', entityId: existing.id,
          meta: { reference: existing.reference, email },
        })
        return { reference: existing.reference, userId, resumed: true }
      }

      const reference = await this.nextReference(tx)
      const app = await tx.trainerApplication.create({
        data: {
          ...phase1Data,
          reference,
          status: 'draft',
          userId,
          specialties: { create: input.specialties.map((specialty) => ({ specialty })) },
          statusHistory: { create: { fromStatus: null, toStatus: 'draft', note: 'إنشاء الطلب — القسم الأول' } },
        },
      })
      await recordAudit(tx, {
        actorId: userId, action: 'trainer.application.submit', entityType: 'trainer_application', entityId: app.id,
        meta: { reference, email, account: user ? 'linked' : 'created' },
      })
      return { reference, userId, resumed: false }
    })

    return { ...result, candidateToken }
  }

  /** بريدُ تأكيد التقديم — بالتفاصيل ورقم الطلب وما يليه، وهو بريدُ توثيق العنوان أيضا */
  private async sendConfirmationEmail(
    app: { id: string; reference: string; email: string; fullName: string; createdAt: Date; phone: string | null
      phoneCountryCode: string | null; deliveryMode: string | null; contactChannel: string | null
      contactAltEmail: string | null; specialties: { specialty: string }[] },
    verifyToken: string,
  ): Promise<DirectMailStatus> {
    const site = publicSiteUrl()
    const link = `${site}/join-trainer/verify?ref=${encodeURIComponent(app.reference)}&token=${encodeURIComponent(verifyToken)}`
    const channel = app.contactChannel ? contactChannelLabel(app.contactChannel) : 'البريد الإلكتروني'
    const channelValue = this.contactValue(app)
    const delivery = app.deliveryMode === 'remote' ? 'عن بُعد' : app.deliveryMode === 'in_person' ? 'حضوري' : 'حضوري وعن بُعد'
    const mail = await sendDirectEmail(this.prisma, {
      to: app.email,
      subject: `وصل طلب انضمامك — ${app.reference}`,
      text:
        `مرحبا ${app.fullName},\n\n` +
        `وصلنا طلبك للانضمام إلى نخبة مدربي أكاديمية وجيز — وهذه تفاصيله:\n` +
        `· رقم الطلب: ${app.reference}\n` +
        `· تاريخ التقديم: ${fmtDateLong(app.createdAt)}\n` +
        `· التخصصات: ${app.specialties.map((x) => x.specialty).join('، ') || '—'}\n` +
        `· نمط التدريب: ${delivery}\n` +
        `· وسيلة التواصل التي اختَرتها: ${channel}${channelValue ? ` — ${channelValue}` : ''}\n\n` +
        `ما التالي؟\n` +
        `سيقرأ فريقنا الأكاديمي طلبك ومستنداتك، ثم نتواصل معك عبر ${channel} لتحديد موعد اجتماع تعريفي قصير ` +
        `نعرّفك فيه بمنهجية الأكاديمية ونسمع منك.\n\n` +
        `تابع حالة طلبك في أي وقت:\n` +
        `· بالدخول إلى ${site}/auth ببريدك هذا وكلمة المرور التي اختَرتها عند التقديم.\n` +
        `· أو من صفحة الانضمام ${site}/join-trainer بإدخال بريدك.\n\n` +
        `هذه الرسالة تؤكد بريدك أيضا — افتح الرابط التالي مرة واحدة ليُوثَّق عنوانك:\n${link}\n` +
        `(الرابط صالح سبعة أيام.)\n\n` +
        `إن لم تكن أنت من قدّم الطلب فتجاهل هذه الرسالة.\n— أكاديمية وجيز`,
    })
    return mail.status
  }

  /** قيمةُ قناة التواصل كما تُقرأ: رقمٌ أو بريد */
  private contactValue(app: { email: string; phone: string | null; phoneCountryCode: string | null; contactChannel: string | null; contactAltEmail: string | null }): string {
    switch (app.contactChannel) {
      case 'phone':
      case 'whatsapp':
        return app.phone ? `${app.phoneCountryCode ?? ''}${app.phone}` : ''
      case 'other_email':
        return app.contactAltEmail ?? ''
      default:
        return app.email
    }
  }

  /** توثيق البريد من رابط رسالة التأكيد — لا يغيّر مسارَ الطلب، يثبت أنّ العنوان لصاحبه */
  async verifyEmail(reference: string, token: string): Promise<{ status: TrainerStatus; alreadyVerified: boolean }> {
    const app = await this.prisma.trainerApplication.findUnique({ where: { reference } })
    if (!app) throw new AuthError('not_found', 'رقم مرجعي غير معروف', 404)
    if (app.emailVerifiedAt) return { status: app.status as TrainerStatus, alreadyVerified: true }
    if (!app.emailVerifyTokenHash || app.emailVerifyTokenHash !== sha256(token)) {
      throw new AuthError('invalid_token', 'رابط التأكيد غير صالح', 400)
    }
    if (app.emailVerifyExpiresAt && app.emailVerifyExpiresAt < new Date()) {
      throw new AuthError('expired_token', 'رابط التأكيد منتهي — اطلب رسالة جديدة من صفحة الانضمام', 410)
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerApplication.update({
        where: { id: app.id },
        data: { emailVerifiedAt: new Date(), emailVerifyTokenHash: null, emailVerifyExpiresAt: null },
      })
      await recordAudit(tx, {
        action: 'trainer.application.verify_email', entityType: 'trainer_application', entityId: app.id,
        meta: { reference },
      })
      /* طلباتُ الدورة القديمة كانت تقف عند بوّابة البريد — تمضي الآن */
      if (app.status === 'email_verification_pending') {
        await this.transition(app.id, 'submitted', null, 'تحقق البريد', tx)
      }
    })
    const row = await this.prisma.trainerApplication.findUniqueOrThrow({ where: { id: app.id }, select: { status: true } })
    return { status: row.status as TrainerStatus, alreadyVerified: false }
  }

  /** إعادة إرسال بريد التأكيد — نفس الرد سواء وُجد الطلب أم لا */
  async resendVerification(email: string): Promise<{ tokenForDelivery: string | null; emailDelivery: DirectMailStatus | null }> {
    const normalized = email.trim().toLowerCase()
    const app = await this.prisma.trainerApplication.findFirst({
      where: { email: normalized, emailVerifiedAt: null, status: { notIn: [...TERMINAL_STATUSES, 'draft'] } },
      orderBy: { createdAt: 'desc' },
      include: { specialties: true },
    })
    if (!app) return { tokenForDelivery: null, emailDelivery: null }
    const token = newToken()
    await this.prisma.trainerApplication.update({
      where: { id: app.id },
      data: { emailVerifyTokenHash: sha256(token), emailVerifyExpiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
    })
    const status = await this.sendConfirmationEmail(app, token)
    return { tokenForDelivery: token, emailDelivery: status }
  }

  /** الحالةُ بالبريد — والرقمُ المرجعيّ اختياريّ يُطابَق إن أُعطي.

      يكشف الحالةَ ونصَّ الرقم لا غير، وآخرَ طلبٍ للبريد إن تعدّدت. */
  async getPublicStatus(email: string, reference?: string | null): Promise<{
    reference: string; status: TrainerStatus; createdAt: Date; completed: boolean
  }> {
    const normalized = email.trim().toLowerCase()
    const ref = reference?.trim().toUpperCase() || null
    const app = await this.prisma.trainerApplication.findFirst({
      where: ref ? { email: normalized, reference: ref } : { email: normalized },
      orderBy: { createdAt: 'desc' },
    })
    if (!app) {
      throw new AuthError('not_found', ref ? 'لا يوجد طلب بهذا الرقم والبريد معا' : 'لا يوجد طلب بهذا البريد', 404)
    }
    return { reference: app.reference, status: app.status as TrainerStatus, createdAt: app.createdAt, completed: !!app.phase2CompletedAt }
  }

  /** يحل رمز المرشح إلى الطلب — حارس المرحلة الثانية والوثائق */
  async resolveCandidate(reference: string, token: string) {
    const app = await this.prisma.trainerApplication.findUnique({ where: { reference } })
    if (!app || !app.accessTokenHash || app.accessTokenHash !== sha256(token)) {
      throw new AuthError('invalid_candidate_token', 'رابط المرشح غير صالح', 401)
    }
    return app
  }

  /** حساب «متقدّم مدرب» — يحفظ الطلب لصاحبه بدل رمزٍ يُنسخ ويُفقد.

      ولا يُنشئ حساب متعلم: AuthService.register تُسند دور learner دائما، وهو
      الصواب لبوابة التسجيل العامة والخطأ هنا — من يتقدّم للتدريب ليس طالبا.
      الدور trainer_applicant وحده، وصلاحيته الوحيدة رؤية طلبه هو.

      والبريد هو بريد الطلب لا بريدا يختاره: حسابٌ ببريد آخر يفصل صاحب الطلب
      عن طلبه، ويفتح بابا لربط طلب غيره بحسابه. */
  async createApplicantAccount(reference: string, token: string, password: string): Promise<{ userId: string; email: string }> {
    const app = await this.resolveCandidate(reference, token)
    if (app.userId) throw new AuthError('account_exists', 'لهذا الطلب حساب بالفعل — سجّل الدخول ببريدك', 409)
    if (password.length < 8) throw new AuthError('weak_password', 'كلمة المرور 8 أحرف على الأقل')

    const email = app.email.trim().toLowerCase()
    const taken = await this.prisma.user.findUnique({ where: { email } })
    /* بريدٌ له حساب أصلا: يُربَط لا يُرفض ولا يُنشأ ثانٍ. من كان متعلما ثم
       تقدّم للتدريب يبقى حسابه واحدا، ويُضاف إليه دور التقديم. */
    if (taken) {
      await this.prisma.$transaction(async (tx) => {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: taken.id, roleId: 'trainer_applicant' } },
          update: {}, create: { userId: taken.id, roleId: 'trainer_applicant' },
        })
        await tx.trainerApplication.update({ where: { id: app.id }, data: { userId: taken.id } })
        await recordAudit(tx, {
          actorId: taken.id, action: 'trainer.application.account_linked',
          entityType: 'trainer_application', entityId: app.id, meta: { reference },
        })
      })
      return { userId: taken.id, email }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          displayName: app.fullName.trim() || email.split('@')[0],
          passwordHash: await bcrypt.hash(password, 10),
          roles: { create: { roleId: 'trainer_applicant' } },
        },
      })
      await tx.trainerApplication.update({ where: { id: app.id }, data: { userId: user.id } })
      await recordAudit(tx, {
        actorId: user.id, action: 'trainer.application.account_created',
        entityType: 'trainer_application', entityId: app.id, meta: { reference },
      })
      return user
    })
    return { userId: created.id, email }
  }

  /** طلبُ صاحبِ الحساب هو — لا طلب غيره. السجلُّ بلا ملاحظات المراجعين. */
  async myApplication(userId: string) {
    const app = await this.prisma.trainerApplication.findUnique({
      where: { userId },
      select: {
        reference: true, status: true, fullName: true, email: true,
        phoneCountryCode: true, phone: true,
        contactChannel: true, contactAltEmail: true,
        createdAt: true, phase2CompletedAt: true, emailVerifiedAt: true, teachableCourseIds: true,
        documents: { select: { kind: true, originalName: true, uploadedAt: true } },
        statusHistory: { select: { toStatus: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
        profile: { select: { userId: true } },
      },
    })
    if (!app) throw new AuthError('no_application', 'لا طلب مرتبط بحسابك', 404)
    return app
  }

  /** مفتاحُ استئناف الطلب لصاحب الحساب — يُبدَّل الرمزُ ويُعاد، ما دام الطلبُ يقبل الاستكمال */
  async resumeAccess(userId: string): Promise<{ reference: string; candidateToken: string; status: TrainerStatus }> {
    const app = await this.prisma.trainerApplication.findUnique({ where: { userId } })
    if (!app) throw new AuthError('no_application', 'لا طلب مرتبط بحسابك', 404)
    if (!PHASE2_OPEN_STATUSES.includes(app.status as TrainerStatus)) {
      throw new AuthError('not_resumable', 'طلبك لا يقبل التعديل في حالته الحالية', 409)
    }
    const candidateToken = newToken()
    await this.prisma.trainerApplication.update({ where: { id: app.id }, data: { accessTokenHash: sha256(candidateToken) } })
    return { reference: app.reference, candidateToken, status: app.status as TrainerStatus }
  }

  /** سحبُ صاحب الحساب طلبَه — بلا رمز، فالجلسةُ هويّته */
  async withdrawMine(userId: string, reason?: string): Promise<void> {
    const app = await this.prisma.trainerApplication.findUnique({ where: { userId } })
    if (!app) throw new AuthError('no_application', 'لا طلب مرتبط بحسابك', 404)
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerApplication.update({ where: { id: app.id }, data: { withdrawReason: reason?.trim() || null } })
      await this.transition(app.id, 'withdrawn', userId, 'سحب الطلب من المتقدم', tx)
    })
  }

  /** القسمُ الأخير — يُكمل الطلبَ، فيصير مقدَّما ويُرسَل بريدُ التأكيد.

      ويبقى قابلا للتحديث ما دام الطلبُ في حالةٍ تقبله (طُلبت معلومات مثلا). */
  async completePhase2(reference: string, token: string, input: {
    previousCourses: { title: string; org?: string; year?: number; link?: string }[]
    teachableCourseIds: string[]
    teachableOther?: string
    availability: AvailabilityInput
    demoConsent: boolean
    contact?: ContactPreference
  }): Promise<{ phase2CompletedAt: Date; status: TrainerStatus; emailDelivery: DirectMailStatus | null }> {
    const app = await this.resolveCandidate(reference, token)
    if (!PHASE2_OPEN_STATUSES.includes(app.status as TrainerStatus)) {
      throw new AuthError('phase2_closed', 'طلبك لا يقبل التعديل في حالته الحالية', 409)
    }
    if (!input.demoConsent) throw new AuthError('demo_consent_required', 'الموافقة على درس تجريبي (Demo) إلزامية للاستكمال')
    if (input.previousCourses.length > 3) throw new AuthError('too_many_courses', 'ثلاث دورات سابقة كحد أقصى')

    /* وسيلةُ التواصل: مطلوبةٌ عند الإكمال الأوّل، ومحفوظةٌ بعده إن لم تُرسَل */
    const contact = input.contact
    if (!contact && !app.contactChannel) {
      throw new AuthError('contact_required', 'اختر كيف نتواصل معك للاجتماع التعريفي')
    }
    let contactAltEmail: string | null = app.contactAltEmail
    if (contact) {
      const def = CONTACT_CHANNELS.find((c) => c.value === contact.channel)
      if (!def) throw new AuthError('bad_contact', 'وسيلة تواصل غير معروفة')
      if (def.needsPhone && !app.phone) {
        throw new AuthError('phone_required', 'اختَرت الهاتف أو واتساب ولم تذكر رقمك في القسم الأول — عد وأضفه أو اختر البريد')
      }
      if (def.needsAltEmail) {
        const alt = contact.altEmail?.trim().toLowerCase() ?? ''
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alt)) throw new AuthError('invalid_alt_email', 'اكتب البريد الآخر بصيغة صحيحة')
        contactAltEmail = alt
      } else {
        contactAltEmail = null
      }
    }

    /* لا تُطلب دورات الكتالوج من المتقدّم بعد اليوم — والتحقق يبقى لما يصل:
       قائمةٌ فارغة تمرّ، وقائمةٌ فيها معرّفٌ لا وجود له تُردّ كما كانت. */
    const courses = await this.prisma.course.findMany({
      where: { id: { in: input.teachableCourseIds } }, select: { id: true },
    })
    if (courses.length !== input.teachableCourseIds.length) {
      throw new AuthError('unknown_course', 'دورة أو أكثر من المختارة غير موجودة في الكتالوج')
    }

    const done = new Date()
    const firstCompletion = app.status === 'draft'
    const verifyToken = newToken()
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerApplication.update({
        where: { id: app.id },
        data: {
          phase2CompletedAt: done,
          previousCourses: input.previousCourses as unknown as Prisma.InputJsonValue,
          /* حُذفت ثلاثة حقول من النموذج (2026-08-28): «إجمالي المتدربين» و«جهات
             عملت معها» و«أدلة وتوصيات — روابط أو وصف موجز». كلها يكتبها المتقدم
             عن نفسه بلا تحقق، فلا تفاضل بين طلبين، وتزيد النموذج طولا يزيد
             هجره. وأعمدتها تبقى في القاعدة لأن فيها بيانات طلبات سابقة —
             تُقرأ ولا تُكتب. */
          totalLearners: null, previousOrgs: null, evidenceNotes: null,
          teachableCourseIds: input.teachableCourseIds,
          teachableOther: input.teachableOther?.trim() || null,
          availability: input.availability as unknown as Prisma.InputJsonValue,
          demoConsent: input.demoConsent,
          ...(contact ? { contactChannel: contact.channel, contactAltEmail } : {}),
          /* رمزُ التأكيد يُصدَر مع أوّل إكمال — وبريدُه يحمله */
          ...(firstCompletion && !app.emailVerifiedAt
            ? { emailVerifyTokenHash: sha256(verifyToken), emailVerifyExpiresAt: new Date(Date.now() + VERIFY_TTL_MS) }
            : {}),
        },
      })
      await recordAudit(tx, {
        actorId: app.userId, action: 'trainer.application.phase2_complete', entityType: 'trainer_application', entityId: app.id,
        meta: { reference, teachableCourseIds: input.teachableCourseIds, contactChannel: contact?.channel ?? app.contactChannel },
      })
      if (firstCompletion) {
        await this.transition(app.id, 'submitted', app.userId, 'اكتمل التقديم', tx)
      }
      /* استكمال المرحلة الثانية بعد طلب معلومات يعيد الطلب للمراجعة تلقائيا */
      if (app.status === 'information_requested') {
        await this.transition(app.id, 'under_review', app.userId, 'استكمال المرحلة الثانية', tx)
      }
    })

    let emailDelivery: DirectMailStatus | null = null
    if (firstCompletion) {
      const full = await this.prisma.trainerApplication.findUniqueOrThrow({
        where: { id: app.id }, include: { specialties: true },
      })
      emailDelivery = await this.sendConfirmationEmail(full, verifyToken)
      /* الطلب اكتمل وصار «مقدماً» — أشعر لجنة الاستقبال فوراً */
      await notifyRole(this.prisma, ['super_admin', 'academic_manager', 'operations_manager'], {
        channel: 'in_app',
        title: 'طلب انضمام مدرب جديد',
        body: `قدّم ${full.fullName} طلب انضمام كاملا (${reference}) — بانتظار الفرز الأولي في «طلبات المدربين».`,
        templateKey: 'admin.trainer_application',
        data: { applicationId: app.id, reference },
      })
    }
    const status = firstCompletion ? 'submitted' : app.status === 'information_requested' ? 'under_review' : (app.status as TrainerStatus)
    return { phase2CompletedAt: done, status, emailDelivery }
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
  private async nextReference(db: Prisma.TransactionClient | PrismaClient = this.prisma): Promise<string> {
    const year = new Date().getFullYear()
    const count = await db.trainerApplication.count()
    return `WJ-TR-${year}-${String(count + 1).padStart(5, '0')}`
  }
  /* ─────────── الحذف النهائيّ — لا التعطيل ───────────

     كان الطلبُ المنتهي يُسحب أو يُرفض فيبقى في القاعدة أبدا. وهو صحيحٌ
     للطلبات الحقيقية — سجلُّ من تقدّم ولماذا رُفض له قيمة. لكنّه يترك
     أيضا كلَّ طلبِ اختبارٍ في قاعدة الإنتاج بلا سبيلٍ إلى إزالته.

     والحذفُ هنا حقيقيّ: الأبناء يذهبون بـ`Cascade` (المستندات والمراجعات
     والمقابلات والمراجع وسجلّ الحالات والدعوات والتخصّصات). وثلاثةُ حرّاس:

     ١) **من صار مدرّبا لا يُحذف طلبُه.** `TrainerProfile` بلا `Cascade`
        عمدا — والملفّ يرتبط بتأهيلاتٍ وإسنادٍ وعقود. فمن تعاقدنا معه له
        تاريخٌ لا يُمحى بضغطة.
     ٢) **ولا يُحذف طلبٌ حيّ.** المنتهيةُ وحدها: مسحوبةٌ أو مرفوضة أو
        مسوّدةٌ لم تكتمل. وما بينهما قيد نظر.
     ٣) **ولا حذفَ بلا سبب.** يُكتب في سجلّ التدقيق **قبل** الحذف — فيبقى
        الأثر بعد أن يذهب الصفّ. */

  async purge(
    /** فارغٌ أو null = فعلٌ نظاميّ من سكربت صيانة، لا إنسانٌ في اللوحة */
    reference: string, actorId: string | null, reasonAr: string,
  ): Promise<{ reference: string; deletedDocuments: number }> {
    const reason = (reasonAr ?? '').trim()
    if (reason.length < 5) {
      throw new AuthError('reason_required', 'اكتب سبب الحذف — الحذف النهائيّ لا يُترك بلا أثر', 422)
    }

    const app = await this.prisma.trainerApplication.findUnique({
      where: { reference },
      include: { profile: { select: { id: true } }, documents: { select: { id: true } } },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)

    if (app.profile) {
      throw new AuthError(
        'has_profile',
        'صاحب هذا الطلب صار مدرّبا — لا يُحذف طلبُه. أوقِف ملفّه إن أردت.',
        409,
      )
    }
    if (!PURGEABLE_STATUSES.includes(app.status as TrainerStatus)) {
      throw new AuthError(
        'not_terminal',
        'لا يُحذف إلّا الطلبُ المنتهي: مسحوبٌ أو مرفوضٌ أو مسوّدةٌ لم تُرسَل',
        409,
      )
    }

    /* الأثرُ يُكتب قبل الحذف — فيبقى بعد أن يذهب الصفّ */
    await recordAudit(this.prisma, {
      actorId: actorId || null, action: 'trainer.application.purge',
      entityType: 'trainer_application', entityId: app.id,
      reason,
      before: {
        reference: app.reference, status: app.status, fullName: app.fullName,
        email: app.email, createdAt: app.createdAt.toISOString(),
        documents: app.documents.length,
      },
    })

    await this.prisma.trainerApplication.delete({ where: { id: app.id } })
    return { reference: app.reference, deletedDocuments: app.documents.length }
  }

}

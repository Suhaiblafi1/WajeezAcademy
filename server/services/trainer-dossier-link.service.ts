/* رابطُ سجلِّ المتقدّم — يُقرأ ويُكتب فيه بلا حساب.

   ═══ لماذا وُجد ═══

   قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): «اجعله رابطا خارجيّا نرسله بين الفريق
   ليقرأه الجميعُ ويعدّل عليه، بدلا من ملفِّ طباعةٍ قد يساهم في تدمير البيئة».

   وطُلب أوّلا رابطٌ **عامٌّ** يفتحه ويكتب فيه كلُّ من وصله، فعُدل عنه لعطبَين:
   الملفُّ يحمل اسمَ إنسانٍ وسيرتَه ائتمنَنا عليها، وكتابةٌ بلا اسمٍ لا تصلح
   مرجعا يُرجَع إليه إن سأل مرفوضٌ عن سببِ رفضه.

   فصار الرابطُ **باسمِ قارئٍ بعينه**: يُفتح بنقرةٍ بلا تسجيل، والرابطُ نفسُه
   هو الهويّة. ولا يُحفظ الرمزُ بل هاشُه.

   ═══ والحجبُ بقائمةِ ما يُعطى لا بقائمةِ ما يُمنع ═══

   الحقولُ المسموحةُ تُسمّى واحدا واحدا في `SHARED_FIELDS`، ولا يُؤخذ الطلبُ
   كلُّه ثمّ يُحذف منه البريدُ والهاتف. والفرقُ ليس أسلوبا: عمودٌ جديدٌ يُضاف
   إلى `TrainerApplication` بعد سنةٍ **يخرج من تلقاء نفسه** مع قائمة المنع،
   ويبقى محجوبا حتّى يُسمَّى مع هذه. والتسريبُ الصامتُ أسوأُ ما يقع هنا.

   وهاتفُ المُزكّي كذلك: تُعطى أسماءُ المراجع وملاحظاتُها ولا تُعطى
   `contact` — فبياناتُ طرفٍ ثالثٍ لم يتقدّم إلينا أصلا أولى بالصون. */

import { createHash, randomBytes } from 'node:crypto'
import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { TrainerApplicationService } from './trainer-application.service'
import { assertRubric, cleanRubric, type RubricScores } from './trainer-review.service'
import { publicSiteUrl } from './notification.service'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')

/** ثلاثون يوما — والسجلُّ يبقى بعدها، وإنّما يُغلق البابُ الذي دخل منه */
export const DOSSIER_LINK_TTL_MS = 30 * 24 * 3600_000

/* ═══ ما يخرج إلى الصفحة المشتركة — يُسمّى ولا يُستثنى منه ═══

   ولا بريدَ هنا ولا هاتفَ ولا `contactAltEmail` ولا `contactChannel`:
   من تسرّب إليه الرابطُ يقرأ ولا يستطيع أن يتّصل بالمتقدّم.

   و`emailVerifiedAt` يبقى: يقول «تحقّق من بريده» ولا يقول ما هو. */
const SHARED_FIELDS = {
  id: true, reference: true, status: true, fullName: true,
  country: true, timezone: true, employmentStatus: true, jobTitle: true,
  domainYears: true, trainingYears: true, bio: true, motivation: true,
  linkedinUrl: true, youtubeUrl: true, instagramUrl: true, facebookUrl: true,
  hasAccreditation: true, accreditationDetails: true,
  targetCountries: true, targetAudiences: true, trainingLanguages: true,
  deliveryMode: true, teachableCourseIds: true, teachableOther: true,
  availability: true, demoConsent: true,
  previousCourses: true, totalLearners: true, previousOrgs: true, evidenceNotes: true,
  emailVerifiedAt: true, privacyConsentAt: true, phase2CompletedAt: true, createdAt: true,
} as const

/** والرسالةُ واحدةٌ للمنتهي والملغى والمجهول — فرقٌ فيها يخبر الفضوليَّ أنّ رمزَه كان صحيحا يوما */
const INVALID = () => new AuthError('invalid_dossier_link', 'هذا الرابط غير صالح أو انتهت صلاحيّته', 401)

export interface SavedReviewInput {
  scores?: RubricScores
  overallNote?: string | null
  verdict?: string | null
  coursesNote?: string | null
}

export class TrainerDossierLinkService {
  private prisma: PrismaClient
  private apps: TrainerApplicationService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.apps = new TrainerApplicationService(prisma)
  }

  /* ─────────── الإدارة: إنشاءٌ وسردٌ وإلغاء ─────────── */

  /** يُنشئ رابطا ويردّ الرمزَ **مرّةً واحدة** — لا يُقرأ بعدها أبدا، إذ لا يُحفظ */
  async create(
    applicationId: string, actorId: string,
    input: { reviewerName: string; reviewerEmail?: string | null; ttlMs?: number },
  ) {
    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: applicationId }, select: { id: true },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)

    const token = newToken()
    const link = await this.prisma.trainerDossierLink.create({
      data: {
        applicationId,
        tokenHash: sha256(token),
        reviewerName: input.reviewerName.trim(),
        reviewerEmail: input.reviewerEmail?.trim() || null,
        expiresAt: new Date(Date.now() + (input.ttlMs ?? DOSSIER_LINK_TTL_MS)),
        createdBy: actorId,
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.dossier_link.create',
      entityType: 'trainer_application', entityId: applicationId,
      /* الاسمُ يُسجَّل والرمزُ لا — و`sanitize` يمسح ما فيه «token» على كلّ حال */
      meta: { linkId: link.id, reviewerName: link.reviewerName, expiresAt: link.expiresAt },
    })
    return { link, url: `${publicSiteUrl()}/r/${token}` }
  }

  async list(applicationId: string) {
    return this.prisma.trainerDossierLink.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, reviewerName: true, reviewerEmail: true, expiresAt: true,
        revokedAt: true, firstOpenedAt: true, lastOpenedAt: true, createdAt: true,
      },
    })
  }

  /** يُلغى ولا يُحذف: التقييمُ المكتوبُ به معلَّقٌ باسم صاحبه */
  async revoke(applicationId: string, linkId: string, actorId: string) {
    const link = await this.prisma.trainerDossierLink.findFirst({ where: { id: linkId, applicationId } })
    if (!link) throw new AuthError('not_found', 'الرابط غير موجود', 404)
    if (link.revokedAt) return link

    const updated = await this.prisma.trainerDossierLink.update({
      where: { id: linkId }, data: { revokedAt: new Date() },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.dossier_link.revoke',
      entityType: 'trainer_application', entityId: applicationId,
      meta: { linkId, reviewerName: link.reviewerName },
    })
    return updated
  }

  /* ─────────── الصفحة المشتركة ─────────── */

  /** يحلّ الرمزَ إلى رابطه — والمنتهي والملغى والمجهولُ سواءٌ في الردّ */
  private async resolve(token: string) {
    if (!token || token.length < 10) throw INVALID()
    const link = await this.prisma.trainerDossierLink.findUnique({ where: { tokenHash: sha256(token) } })
    if (!link) throw INVALID()
    if (link.revokedAt) throw INVALID()
    if (link.expiresAt.getTime() <= Date.now()) throw INVALID()
    return link
  }

  /** ما يراه صاحبُ الرابط — ومعه تقييمُه هو وحدَه */
  async view(token: string) {
    const link = await this.resolve(token)

    const now = new Date()
    await this.prisma.trainerDossierLink.update({
      where: { id: link.id },
      data: { lastOpenedAt: now, ...(link.firstOpenedAt ? {} : { firstOpenedAt: now }) },
    })

    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: link.applicationId },
      select: {
        ...SHARED_FIELDS,
        specialties: { select: { specialty: true } },
        /* ولا `content` هنا البتّة: عمودُ الوثيقة يحمل **بايتات الملفّ نفسِه**،
           فـ`documents: true` يسحب السِّيَرَ كلَّها إلى الذاكرة ثمّ يصبّها في
           JSON. والوثيقةُ تُقرأ برابطها الموقَّع لا من هذا الردّ. */
        documents: {
          select: {
            id: true, kind: true, storageKey: true, originalName: true,
            mime: true, sizeBytes: true, uploadedAt: true,
          },
        },
        /* أسماءُ المراجع وصلتُهم وملاحظاتُهم — ولا `contact`: هاتفُ طرفٍ ثالث */
        references: { select: { id: true, name: true, relation: true, note: true, verifiedAt: true } },
      },
    })
    if (!app) throw INVALID()

    const { documents, ...rest } = app
    const mine = await this.prisma.trainerApplicationReview.findFirst({
      where: { applicationId: link.applicationId, linkId: link.id },
    })

    return {
      reviewer: { name: link.reviewerName, expiresAt: link.expiresAt },
      application: {
        ...rest,
        documents,
      },
      documentUrls: this.apps.signedDocumentUrls(documents),
      /* تقييمُه هو لا غير: من رأى أنّ زميله أعطى ٥ لم يعد رأيُه رأيَه */
      myReview: mine
        ? {
            scores: mine.scores, overallNote: mine.overallNote,
            verdict: mine.verdict, coursesNote: mine.coursesNote, updatedAt: mine.updatedAt,
          }
        : null,
    }
  }

  /** يحفظ تقييمَ صاحب الرابط — صفٌّ واحدٌ له يُراجَع، لا صفٌّ في كلّ حفظ */
  async saveReview(token: string, input: SavedReviewInput) {
    const link = await this.resolve(token)
    assertRubric(input.scores ?? {})
    const scores = cleanRubric(input.scores ?? {})

    const before = await this.prisma.trainerApplicationReview.findFirst({
      where: { applicationId: link.applicationId, linkId: link.id },
    })

    const data = {
      scores: scores as unknown as Prisma.InputJsonValue,
      overallNote: input.overallNote?.trim() || null,
      verdict: input.verdict || null,
      coursesNote: input.coursesNote?.trim() || null,
      reviewerName: link.reviewerName,
    }

    const saved = before
      ? await this.prisma.trainerApplicationReview.update({ where: { id: before.id }, data })
      : await this.prisma.trainerApplicationReview.create({
          data: { ...data, applicationId: link.applicationId, linkId: link.id },
        })

    /* الفاعلُ `null`: لا حسابَ له. والاسمُ في `meta` — وهو ما يجعله مرجعا.

       ═══ ولماذا فرعان لا `action: cond ? a : b` ═══

       حارسُ المعجم (`src/tests/audit-labels-coverage.test.ts`) يمسح الشيفرةَ
       بـ`/action: '([a-z0-9._]+)'/`. وفعلٌ يُكتب في شرطٍ ثلاثيٍّ **لا يراه
       الماسحُ أصلا**، فيمرّ بلا اسمٍ عربيٍّ ولا يحمرّ شيء. فيُكتب كلٌّ منهما
       حرفيّا في موضعه. */
    const trail = {
      actorId: null,
      entityType: 'trainer_application', entityId: link.applicationId,
      meta: { reviewId: saved.id, linkId: link.id, reviewerName: link.reviewerName },
      before: before ? { scores: before.scores, overallNote: before.overallNote, verdict: before.verdict, coursesNote: before.coursesNote } : undefined,
      after: { scores: data.scores, overallNote: data.overallNote, verdict: data.verdict, coursesNote: data.coursesNote },
    }
    await (before
      ? recordAudit(this.prisma, { ...trail, action: 'trainer.review.update' })
      : recordAudit(this.prisma, { ...trail, action: 'trainer.review.add' }))

    return { savedAt: saved.updatedAt }
  }
}

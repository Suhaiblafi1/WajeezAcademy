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
import { assertRubric, cleanRubric, TrainerReviewService, type RubricScores } from './trainer-review.service'
import { publicSiteUrl, sendDirectEmail, type DirectMailStatus } from './notification.service'
import { renderMail } from './mail-template'
import { fmtDateLong } from '../../src/application/text/format-ar'

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
  deliveryMode: true, teachableCourseIds: true, teachableOther: true, teachableProposals: true,
  availability: true, demoConsent: true,
  hasCourseRecordings: true, wantsToRecordCourses: true,
  previousCourses: true, totalLearners: true, previousOrgs: true, evidenceNotes: true,
  emailVerifiedAt: true, privacyConsentAt: true, phase2CompletedAt: true, createdAt: true,
} as const

/** والرسالةُ واحدةٌ للمنتهي والملغى والمجهول — فرقٌ فيها يخبر الفضوليَّ أنّ رمزَه كان صحيحا يوما */
const INVALID = () => new AuthError('invalid_dossier_link', 'هذا الرابط غير صالح أو انتهت صلاحيّته', 401)

export interface SavedReviewInput {
  scores?: RubricScores
  overallNote?: string | null
  verdict?: string | null
  /** المقابلةُ التي يحكم فيها — تلزم مع القرار، ولا قرارَ معلَّقٌ في الهواء */
  interviewId?: string | null
  coursesNote?: string | null
  /* الاتفاقُ الماليُّ إن جرى ذكرُه — نصّا لا رقما، ولا مالَ يتحرّك به */
  feeExpectationAr?: string | null
  feeProposalAr?: string | null
}

export class TrainerDossierLinkService {
  private prisma: PrismaClient
  private apps: TrainerApplicationService
  /* ولتسجيلِ النتيجة مسارُها الواحد: عكسُ قرارِ القارئ على الموعد يمرّ بما
     يمرّ به زرُّ الإدارة — فتقع انتقالاتُ الحالة وعودةُ الغائب إلى ما قبل
     الحجز كما تقع هناك، ولا يُكتب العمودُ من بابٍ ثانٍ لا يعرف ذلك. */
  private review: TrainerReviewService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.apps = new TrainerApplicationService(prisma)
    this.review = new TrainerReviewService(prisma)
  }

  /* ─────────── الإدارة: إنشاءٌ وسردٌ وإلغاء ─────────── */

  /** يُنشئ رابطا ويردّ الرمزَ **مرّةً واحدة** — لا يُقرأ بعدها أبدا، إذ لا يُحفظ */
  async create(
    applicationId: string, actorId: string,
    input: { reviewerName: string; reviewerEmail?: string | null; ttlMs?: number; sendEmail?: boolean },
  ) {
    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: applicationId }, select: { id: true, reference: true, fullName: true, email: true },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)

    /* ═══ ولا يصل الرابطُ المتقدّمَ أبدا ═══

       فيه تقييمُنا له، ورسالةٌ واحدةٌ تُوجَّه خطأً تُسلّمه أسبابَ رفضه بخطّ
       أيدينا. والمنعُ هنا لا في الشاشة: من أخطأ فلصق بريدَ المتقدّم في خانة
       القارئ لا يُنبَّه إلّا بردٍّ صريح. (مسجَّلةٌ مخاطرةً في التصميم.) */
    const readerEmail = input.reviewerEmail?.trim().toLowerCase() || null
    if (readerEmail && readerEmail === app.email.trim().toLowerCase()) {
      throw new AuthError('applicant_email', 'هذا بريدُ المتقدّم نفسِه — ولا يصل الرابطُ صاحبَ الملفّ', 422)
    }

    const token = newToken()
    const link = await this.prisma.trainerDossierLink.create({
      data: {
        applicationId,
        tokenHash: sha256(token),
        /* ═══ والرمزُ يُحفظ نصّا — قرارٌ لا سهو ═══

           كان `sha256` وحدَه، فلا نسخةَ من الرابط في مكان. وقرارُ صاحب
           المنصّة (١٤ سبتمبر ٢٠٢٦) أن يُخزَّن ليُنسَخ الرابطُ نفسُه بعد
           ضياعه، وأن يكون عاريا لا مشفَّرا. وثمنُه مكتوبٌ في هجرته
           `20260914200000_dossier_link_token_clear`. */
        tokenClear: token,
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
    /* ═══ والبريدُ يُرسَل هنا أو لا يُرسَل أبدا ═══

       الرمزُ لا يُحفظ — هاشُه وحدَه. فهذه اللحظةُ هي **الوحيدةُ** التي يُعرف
       فيها هذا الرابطُ بعينه. ومن أراده بعدها **جدّده** (`rotate`): رمزٌ
       جديدٌ على الصفّ نفسِه — لا صفٌّ ثانٍ للقارئ الواحد. */
    const url = `${publicSiteUrl()}/r/${token}`
    const emailDelivery = input.sendEmail
      ? await this.mailLink(link, app.reference, url, actorId, applicationId)
      : null
    return { link, url, emailDelivery }
  }

  /* رسالةُ الرابط — يتقاسمها الإنشاءُ والتجديد، فلا نصّان يفترقان يوما */
  private async mailLink(
    link: { id: string; reviewerName: string; reviewerEmail: string | null; expiresAt: Date },
    reference: string, url: string, actorId: string, applicationId: string,
  ): Promise<DirectMailStatus | null> {
    if (!link.reviewerEmail) return null
    const res = await sendDirectEmail(this.prisma, {
      to: link.reviewerEmail,
      subject: `ملفُّ متقدّمٍ لمراجعتك — ${reference}`,
      ...renderMail({
        greetingName: link.reviewerName,
        heading: 'ملفُّ متقدّمٍ ينتظر قراءتك',
        blocks: [
          { kind: 'facts', rows: [
            { label: 'رقم الطلب', value: reference },
            { label: 'ينتهي الرابط', value: fmtDateLong(link.expiresAt) },
          ] },
          { kind: 'cta', label: 'افتح الملفّ واكتب تقييمك', href: url,
            caption: 'يُفتح بنقرةٍ بلا تسجيلٍ ولا كلمة مرور.' },
          /* والتحذيرُ في المتن لا في تعليقِ شيفرة: من يقرأ الرسالةَ هو من
             قد يُعيد توجيهَها، فالتنبيهُ يبلغه حيث هو. */
          { kind: 'callout', text: 'هذا الرابطُ لك وحدَك ويقوم مقامَ توقيعك — فلا تُعِد توجيهَه، فما يُكتب به يُنسَب إليك.' },
          /* ومن جُدِّد رابطُه وصلته رسالتان، فيُقال له أيُّهما يعمل — وإلّا
             فتح الأوّلَ فرُدّ بـ«غير صالح» وظنّ العطبَ فينا. */
          { kind: 'note', text: 'وإن كان قد وصلك رابطٌ قبله فهذا يُبطله — افتح هذا وحدَه. وإن وصلك خطأً فأخبرنا بالردّ، ويُلغى.' },
        ],
      }),
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.dossier_link.send',
      entityType: 'trainer_application', entityId: applicationId,
      meta: { linkId: link.id, reviewerName: link.reviewerName, delivery: res.status },
    })
    return res.status
  }

  async list(applicationId: string) {
    const rows = await this.prisma.trainerDossierLink.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, reviewerName: true, reviewerEmail: true, expiresAt: true,
        revokedAt: true, firstOpenedAt: true, lastOpenedAt: true, createdAt: true,
        tokenClear: true,
      },
    })

    /* ═══ والعنوانُ يخرج للشاشة، لا الرمزُ مجرّدا ═══

       الشاشةُ تنسخ رابطا لا تركّبه، فلا تعرف صيغةَ `/r/` ولا تُصلحها يومَ
       تتغيّر. والرمزُ نفسُه لا يخرج في أيّ حقلٍ آخر.

       **ولا يخرج إلّا لرابطٍ حيّ.** الملغى والمنتهي رمزُهما موجودٌ في القاعدة
       لكنّه لا يفتح شيئا — فإخراجُه يُغري بنسخِ ما لا يعمل، ويوسّع انتشارَ
       رمزٍ قد يُعاد إحياؤه بتمديدٍ لاحق. فالحيُّ وحدَه يُنسَخ، وما عداه
       يُجدَّد. */
    const now = Date.now()
    return rows.map(({ tokenClear, ...row }) => ({
      ...row,
      copyUrl: tokenClear && !row.revokedAt && row.expiresAt.getTime() > now
        ? `${publicSiteUrl()}/r/${tokenClear}`
        : null,
    }))
  }

  /* ═══ التجديدُ: رمزٌ جديدٌ على الصفّ نفسِه ═══

     ─────────── الطلبُ وما يمنع حرفَه ───────────

     قال صاحبُ المنصّة (١٤ سبتمبر ٢٠٢٦): «أريد أن أتمكّن من إعادة نسخِ الرابط
     للمفعَّلين بدلا من إنشاء جديد».

     وكان نسخُ القديمِ مستحيلا بنيةً: في القاعدة `sha256(token)` وحدَه،
     والهاشُ طريقٌ واحد. **ثمّ تغيّر ذلك بقرارٍ لاحق** (١٤ سبتمبر ٢٠٢٦): صار
     الرمزُ يُحفظ نصّا في `tokenClear`، فالنسخُ ممكنٌ اليومَ من الشاشة.

     وثمنُه — أنّ كلَّ مَقلَبٍ ليليٍّ يصير دفترَ روابطَ حيّة — مكتوبٌ في هجرة
     `20260914200000_dossier_link_token_clear`، وقد عُرض على صاحب المنصّة
     مرّتَين فاختاره.

     ─────────── ويبقى التجديدُ لما لا يُنسَخ ───────────

     الروابطُ المنشأةُ **قبل** تلك الهجرة لا رمزَ لها ولا يُستخرج من هاشها،
     فتلك تُجدَّد ولا تُنسَخ. والمنتهيةُ أجلُها كذلك: النسخُ يعيد الحرفَ لا
     الصلاحية.

     ─────────── وما يصلحه التجديدُ أصلا ───────────

     الذي يزعجه ليس الحرفُ القديم بل **الصفُّ الثاني**: قارئٌ واحدٌ بسطرَين،
     وتقييمُه ينقسم بينهما. فالتجديدُ يُبدّل الرمزَ **على الصفّ نفسِه**:

       · يبقى معرّفُ الصفّ — ومعه **تقييمُه المكتوب**، إذ يُعلَّق بـ`linkId`
         لا بالرمز. وهذا هو بيتُ القصيد: لو أُنشئ صفٌّ جديدٌ لبدأ القارئُ من
         بياضٍ وبقي تقييمُه الأوّلُ معلَّقا بصفٍّ ميّت.
       · ويبقى اسمُه وسجلُّ فتحه — أوّلَ مرّةٍ وآخرَ مرّة. تاريخُه لا يُمحى
         لأنّ رابطَه بُدِّل.
       · ويُجدَّد الأجلُ — فالمنتهي يعود صالحا، وهو أكثرُ ما يُجدَّد له.

     ─────────── وثمنُه يُقال ولا يُخفى ───────────

     **القديمُ يموت في اللحظة.** فمن كان فاتحا الصفحةَ وضغط «احفظ» بعد
     التجديد رُدَّ بـ«الرابط غير صالح». وهو الصواب — رابطٌ حيٌّ واحدٌ لكلّ
     قارئ — لكنّه ليس بلا ثمن، فرسالةُ التجديد تقول له أن يترك ما قبلها.

     ─────────── والملغى لا يُجدَّد ───────────

     الإلغاءُ قرارٌ: «لا يقرأ هذا الملفَّ بعد اليوم». فلو أعاده التجديدُ
     صامتا لصار زرُّ «انسخ» بابا خلفيّا حول قرارٍ اتُّخذ. ومن أراد إعادتَه
     أنشأ رابطا جديدا — فعلٌ ظاهرٌ في الأثر باسمه. */
  async rotate(applicationId: string, linkId: string, actorId: string, opts?: { sendEmail?: boolean }) {
    const link = await this.prisma.trainerDossierLink.findFirst({ where: { id: linkId, applicationId } })
    if (!link) throw new AuthError('not_found', 'الرابط غير موجود', 404)
    if (link.revokedAt) {
      throw new AuthError(
        'link_revoked',
        'هذا الرابطُ ملغى — والإلغاءُ قرار. أنشئ رابطا جديدا باسمه إن أردتَ أن يقرأ ثانيةً.',
        409,
      )
    }
    const app = await this.prisma.trainerApplication.findUnique({
      where: { id: applicationId }, select: { reference: true },
    })
    if (!app) throw new AuthError('not_found', 'الطلب غير موجود', 404)

    const token = newToken()
    const updated = await this.prisma.trainerDossierLink.update({
      where: { id: linkId },
      data: {
        tokenHash: sha256(token), tokenClear: token,
        expiresAt: new Date(Date.now() + (DOSSIER_LINK_TTL_MS)),
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.dossier_link.rotate',
      entityType: 'trainer_application', entityId: applicationId,
      /* والرمزُ لا يُسجَّل — لا القديمُ ولا الجديد */
      meta: { linkId, reviewerName: updated.reviewerName, expiresAt: updated.expiresAt },
    })

    const url = `${publicSiteUrl()}/r/${token}`
    const emailDelivery = opts?.sendEmail
      ? await this.mailLink(updated, app.reference, url, actorId, applicationId)
      : null
    return { link: updated, url, emailDelivery }
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
        /* ═══ ومواعيدُ لقائه — ليُعلَّق الحكمُ بواحدٍ منها (٢١ سبتمبر ٢٠٢٦) ═══

           «لا أريد التقييمَ العامّ، أريده مرتبطا بالمقابلات المجدولة». فتصل
           القارئَ مواعيدُه ليختار أيَّها يحكم فيه.

           والملغاةُ تصل كذلك ولا تُخفى: من حكم في موعدٍ ثمّ أُلغي يبقى حكمُه
           منسوبا إليه ويُقرأ سببُه، وإخفاؤه يترك القارئَ أمام حكمٍ بلا موعد.
           والشاشةُ تمنع اختيارَها، والخادمُ يردّها. */
        interviews: {
          orderBy: { scheduledAt: 'desc' },
          select: { id: true, scheduledAt: true, mode: true, canceledAt: true, outcome: true },
        },
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
            verdict: mine.verdict, interviewId: mine.interviewId, coursesNote: mine.coursesNote,
            feeExpectationAr: mine.feeExpectationAr, feeProposalAr: mine.feeProposalAr,
            updatedAt: mine.updatedAt,
          }
        : null,
    }
  }

  /** يحفظ تقييمَ صاحب الرابط — صفٌّ واحدٌ له يُراجَع، لا صفٌّ في كلّ حفظ */
  async saveReview(token: string, input: SavedReviewInput) {
    const link = await this.resolve(token)
    assertRubric(input.scores ?? {})
    const scores = cleanRubric(input.scores ?? {})

    /* ═══ ولا قرارَ معلَّقٌ في الهواء (٢١ سبتمبر ٢٠٢٦) ═══

       «لا أريد التقييمَ العامّ، أريده مرتبطا بالمقابلات المجدولة». فالقرارُ
       يلزمه موعدٌ يحكم فيه — والموعدُ من مواعيد هذا الطلب وحدَه وغيرُ ملغًى.

       والحارسُ في الخادم لا في الشاشة: الشاشةُ تمنع الاختيارَ الخاطئ، وهذا
       يردّ من جاء من غيرها. ومعرّفُ موعدِ طلبٍ آخرَ يُردّ كذلك — فلا يُعلَّق
       حكمٌ بلقاء إنسانٍ لم يُقرأ ملفُّه. */
    const interviewId = input.interviewId || null
    if (input.verdict && !interviewId) {
      throw new AuthError('interview_required', 'اختر المقابلةَ التي تحكم فيها قبل حفظ القرار', 422)
    }
    if (interviewId) {
      const iv = await this.prisma.trainerInterview.findFirst({
        where: { id: interviewId, applicationId: link.applicationId },
        select: { canceledAt: true },
      })
      if (!iv) throw new AuthError('interview_not_found', 'لا مقابلةَ بهذا المعرّف في هذا الطلب', 404)
      if (iv.canceledAt) throw new AuthError('interview_canceled', 'هذه المقابلةُ ملغاة — لا يُحكَم في لقاءٍ لم يقع', 422)
    }

    const before = await this.prisma.trainerApplicationReview.findFirst({
      where: { applicationId: link.applicationId, linkId: link.id },
    })

    const data = {
      scores: scores as unknown as Prisma.InputJsonValue,
      overallNote: input.overallNote?.trim() || null,
      verdict: input.verdict || null,
      interviewId,
      coursesNote: input.coursesNote?.trim() || null,
      feeExpectationAr: input.feeExpectationAr?.trim() || null,
      feeProposalAr: input.feeProposalAr?.trim() || null,
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
      /* والمبلغُ لا يُنسَخ في الأثر: يُقال إن ذُكر، ويُقرأ من صفّه. سجلُّ
         التدقيق يُقرأ بعينٍ أوسعَ من عين من يقرّر في راتبِ إنسان. */
      meta: {
        reviewId: saved.id, linkId: link.id, reviewerName: link.reviewerName,
        feeDiscussed: Boolean(data.feeExpectationAr || data.feeProposalAr),
      },
      before: before ? { scores: before.scores, overallNote: before.overallNote, verdict: before.verdict, coursesNote: before.coursesNote } : undefined,
      after: { scores: data.scores, overallNote: data.overallNote, verdict: data.verdict, coursesNote: data.coursesNote },
    }
    await (before
      ? recordAudit(this.prisma, { ...trail, action: 'trainer.review.update' })
      : recordAudit(this.prisma, { ...trail, action: 'trainer.review.add' }))

    /* والموعدُ الذي حُكم فيه يأخذ قولَه — أو يفقده إن اختُلف عليه */
    const reflected = interviewId ? await this.reflectOnInterview(interviewId, link.reviewerName) : null
    /* والموعدُ السابقُ إن بُدّل: قولٌ خرج منه، فيُعاد حسابُه كذلك */
    if (before?.interviewId && before.interviewId !== interviewId) {
      await this.reflectOnInterview(before.interviewId, link.reviewerName)
    }

    return { savedAt: saved.updatedAt, interview: reflected }
  }

  /* ═══ عكسُ أحكام القرّاء على الموعد — وقاعدتُه الاتّفاق ═══

     «وإن وضعنا في التقييم أنّه اجتاز فليُعكَس على قسم المقابلة ويظهر في
     ملفّه. لا أريد شيئين: اجتاز واجتاز».

     والعمودُ لا يسع قولَين. فإن اتّفق من حكموا في هذا اللقاء كُتب قولُهم
     فيه — ويمرّ بمسار الإدارة نفسِه فتقع انتقالاتُ الحالة وعودةُ الغائب إلى
     ما قبل الحجز. وإن اختلفوا سُحب المكتوبُ وتُرك فارغا: لا قولَ متّفَقا
     علينا، والصفُّ يعرض القولَين باسمَي صاحبَيهما.

     **ولا يُكتب ما هو مكتوب**: `outcome` المطابقُ لا يُعاد تسجيلُه، وإلّا
     صار كلُّ حفظِ درجةٍ انتقالا جديدا في سجلّ الحالة وسطرا في الأثر. */
  private async reflectOnInterview(interviewId: string, byAr: string) {
    const verdicts = await this.prisma.trainerApplicationReview.findMany({
      where: { interviewId, NOT: { verdict: null } },
      select: { verdict: true },
    })
    const distinct = [...new Set(verdicts.map((v) => v.verdict!))]
    const current = await this.prisma.trainerInterview.findUnique({
      where: { id: interviewId }, select: { outcome: true },
    })
    if (!current) return null

    if (distinct.length === 1) {
      if (current.outcome === distinct[0]) return { outcome: current.outcome, agreed: true }
      await this.review.recordInterviewOutcome(interviewId, null, distinct[0], undefined, byAr)
      return { outcome: distinct[0], agreed: true }
    }

    if (distinct.length > 1) {
      await this.review.clearInterviewOutcome(
        interviewId, byAr, `اختلف القرّاء: ${distinct.join(' · ')}`,
      )
      return { outcome: null, agreed: false }
    }

    /* ولا حكمَ بقي: من سحب قرارَه سحب معه ما كُتب عنه في الموعد */
    await this.review.clearInterviewOutcome(interviewId, byAr, 'سُحب آخرُ قرارٍ في هذا اللقاء')
    return { outcome: null, agreed: true }
  }
}

/* خدمة الشهادات — لا إصدار قبل تحقق قواعد الإكمال.
   كل شهادة: رقم تحقق فريد، لقطة اسم متعلم، دورة وإصدارها، تاريخ، حالة، إلغاء بسبب.
   التحقق العام محدود البيانات ويُسجَّل في CertificateVerification. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { safeNotify } from './notification.service'
import { ProgressService } from './progress.service'

export class CertificateService {
  private prisma: PrismaClient
  private progress: ProgressService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.progress = new ProgressService(prisma)
  }

  /** يُنشئ الشهادةَ برقمٍ مسلسل، ويُعيد المحاولة على تصادم الترقيم وحدَه */
  private async issueWithNumber(data: {
    enrollmentId: string; learnerName: string; courseId: string; courseVersion: number; issuedBy: string | null
  }) {
    const year = new Date().getFullYear()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const count = await this.prisma.certificate.count()
      const number = `WJ-CERT-${year}-${String(count + 1 + attempt).padStart(5, '0')}`
      try {
        return await this.prisma.certificate.create({ data: { ...data, number } })
      } catch (err) {
        const code = (err as { code?: string }).code
        if (code !== 'P2002') throw err
        /* الرقمُ سُبق إليه — نجرّب الذي يليه */
      }
    }
    throw new AuthError('number_clash', 'تعذّر توليد رقم شهادة فريد — أعد المحاولة', 409)
  }

  /* مرشَّحو الشهادة في شعبة — مَن أنهى فعلا أوّلا.

     كانت الشاشةُ تطلب «معرّف التسجيل (UUID)» يُلصق يدا. فمن أراد أن يُصدر
     شهادةً لطالبٍ أنهى دورتَه احتاج أن يستخرج معرّفا من مكانٍ آخر — ولا
     شاشةَ تعرضه. وقرارُ صاحب المنصّة: «فلتر القائمة افتراضيا لمن أنهى فعلا
     وحصل على موافقة المدرب أو المدير الأكاديميّ فقط».

     والأهليّةُ تُحسب بالقواعد نفسِها التي يفحصها الإصدار (`evaluateCompletion`)
     لا بقاعدةٍ ثانية تُشبهها: قائمةٌ تقول «مؤهَّل» ثمّ يرفض الإصدارُ هي أسوأ
     من لا قائمة. ومن لم يستوفِ تُعرض أسبابُه لا حالتُه فقط. */
  async candidates(cohortId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { cohortId, status: { in: ['enrolled', 'completed'] } },
      include: {
        user: { select: { id: true, displayName: true, email: true, emailVerifiedAt: true } },
        certificates: { orderBy: { issuedAt: 'desc' } },
        courseProgress: { select: { percent: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const rows = await Promise.all(enrollments.map(async (e) => {
      const active = e.certificates.find((c) => c.status === 'active') ?? null
      let complete = false
      let failures: string[] = []
      let percent = e.courseProgress?.percent ?? 0
      try {
        const check = await this.progress.evaluateCompletion(e.id)
        complete = check.complete
        failures = check.failures
        percent = check.percent
      } catch {
        /* تعذّر التقييم لا يجعله مؤهَّلا — يُقال ولا يُخفى */
        failures = ['تعذّر تقييم قواعد الإكمال']
      }
      /* حاجزُ البريد صارمٌ في الإصدار، فيُعرض هنا سببا لا مفاجأةً بعد الضغط */
      if (!e.user.emailVerifiedAt) failures = [...failures, 'بريد المتعلّم غير موثَّق']
      return {
        enrollmentId: e.id,
        learnerName: e.user.displayName,
        email: e.user.email,
        percent,
        eligible: complete && Boolean(e.user.emailVerifiedAt),
        failures,
        certificate: active
          ? { id: active.id, number: active.number, issuedAt: active.issuedAt }
          : null,
      }
    }))

    /* المؤهَّلُ بلا شهادةٍ أوّلا — وهو من فُتحت الشاشةُ لأجله */
    return rows.sort((a, b) =>
      Number(Boolean(b.eligible && !b.certificate)) - Number(Boolean(a.eligible && !a.certificate)) ||
      Number(Boolean(b.certificate)) - Number(Boolean(a.certificate)) ||
      a.learnerName.localeCompare(b.learnerName, 'ar'))
  }

  /** إصدار شهادة — النظام أو الإدارة؛ يرفض بقائمة القواعد غير المحققة */
  async issue(enrollmentId: string, actorId: string | null) {
    const e = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { cohort: { include: { course: true } }, certificates: { where: { status: 'active' } } },
    })
    if (!e) throw new AuthError('not_found', 'التسجيل غير موجود', 404)
    if (e.certificates.length) throw new AuthError('already_issued', 'صدرت شهادة فعالة لهذا التسجيل مسبقا', 409)

    const check = await this.progress.evaluateCompletion(enrollmentId)
    if (!check.complete) {
      throw new AuthError('rules_unmet', `قواعد الإكمال غير محققة: ${check.failures.join(' — ')}`, 409)
    }

    /* حاجز توثيق البريد (١هـ) — صارم هنا بلا استثناء، بخلاف حاجز الشراء.
       الشهادة وثيقةٌ تُنسب إلى شخص وتُتحقَّق علنا بالرقم، فصدورُها لعنوان لم
       يثبت أنه يصل صاحبه يضع اسم الأكاديمية خلف نسبةٍ لا دليل عليها. ولا أحد
       يعلق هنا: الإصدار بيد الإدارة، فترى السبب وتطلب من المتعلم التوثيق. */
    const learner = await this.prisma.user.findUnique({ where: { id: e.userId } })
    if (!learner?.emailVerifiedAt) {
      throw new AuthError('email_unverified', 'بريد المتعلم غير موثَّق — الشهادة تُنسب إلى شخص، فلا تصدر قبل إثبات أن عنوانه يصله', 409)
    }
    /* الرقمُ يُولَّد هنا لا يُدخَل يدا — وهو كذلك منذ كُتبت الخدمة.

       لكنّ `count() + 1` ليس ذرّيّا: إصداران في اللحظة نفسِها يقرآن العدد
       نفسَه فيبنيان الرقمَ نفسَه، و`@unique` يُسقط الثاني برسالةِ قاعدةِ
       بيانات لا يفهمها من ضغط الزرّ. فيُعاد المحاولةُ على التصادم وحدَه —
       وهو نادرٌ، وأثرُه حين يقع مربكٌ بلا داعٍ. */
    const cert = await this.issueWithNumber({
      enrollmentId,
      learnerName: learner?.displayName ?? 'متعلم وجيز',
      courseId: e.cohort.courseId,
      courseVersion: e.cohort.course.currentVersion,
      issuedBy: actorId,
    })
    const number = cert.number
    /* إكمال التسجيل مع الشهادة */
    await this.prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: 'completed' } })
    await recordAudit(this.prisma, {
      actorId, action: 'certificate.issue', entityType: 'certificate', entityId: cert.id,
      meta: { number, enrollmentId, courseId: e.cohort.courseId },
    })
    await safeNotify(this.prisma, {
      userId: e.userId, channel: 'in_app',
      title: 'صدرت شهادتك 🎓',
      body: `مبروك الإتمام — شهادتك برقم ${number} جاهزة في «شهاداتي»، وتحققها العام متاح لأي جهة تشاركها الرقم.`,
      templateKey: 'certificate.issued',
      data: { certificateId: cert.id, number },
    })
    return cert
  }

  /** تحقق عام محدود البيانات — يُسجل كل تحقق */
  async verify(number: string, ip?: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { number: number.trim().toUpperCase() },
      include: {
        revocation: true,
        enrollment: { include: { cohort: { include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } } } } },
      },
    })
    if (!cert) throw new AuthError('not_found', 'لا شهادة بهذا الرقم', 404)
    await this.prisma.certificateVerification.create({ data: { certificateId: cert.id, ip } })
    return {
      number: cert.number,
      learnerName: cert.learnerName,
      courseTitle: cert.enrollment.cohort.course.versions[0]?.titleAr ?? cert.courseId,
      courseVersion: cert.courseVersion,
      issuedAt: cert.issuedAt,
      status: cert.status,
      revokedReason: cert.revocation?.reason ?? null,
    }
  }

  /** إلغاء شهادة — سبب إلزامي، أثر دائم، لا حذف */
  async revoke(certificateId: string, actorId: string, reason: string) {
    if (reason.trim().length < 5) throw new AuthError('no_reason', 'الإلغاء يتطلب سببا موثقا')
    const cert = await this.prisma.certificate.findUnique({ where: { id: certificateId } })
    if (!cert) throw new AuthError('not_found', 'الشهادة غير موجودة', 404)
    if (cert.status === 'revoked') throw new AuthError('bad_state', 'الشهادة ملغاة مسبقا', 409)
    const updated = await this.prisma.$transaction(async (tx) => {
      const c = await tx.certificate.update({ where: { id: certificateId }, data: { status: 'revoked' } })
      await tx.certificateRevocation.create({ data: { certificateId, reason, revokedBy: actorId } })
      /* السببُ في عمودِه لا في الحمولة — شاشةُ الأثر تقرؤه من هناك */
      await recordAudit(tx, { actorId, action: 'certificate.revoke', entityType: 'certificate', entityId: certificateId, reason })
      return c
    })
    return updated
  }

  async myCertificates(userId: string) {
    return this.prisma.certificate.findMany({
      where: { enrollment: { userId } },
      include: { revocation: true },
      orderBy: { issuedAt: 'desc' },
    })
  }
}

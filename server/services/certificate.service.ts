/* خدمة الشهادات — لا إصدار قبل تحقق قواعد الإكمال.
   كل شهادة: رقم تحقق فريد، لقطة اسم متعلم، دورة وإصدارها، تاريخ، حالة، إلغاء بسبب.
   التحقق العام محدود البيانات ويُسجَّل في CertificateVerification. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { ProgressService } from './progress.service'

export class CertificateService {
  private prisma: PrismaClient
  private progress: ProgressService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.progress = new ProgressService(prisma)
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

    const learner = await this.prisma.user.findUnique({ where: { id: e.userId } })
    const year = new Date().getFullYear()
    const count = await this.prisma.certificate.count()
    const number = `WJ-CERT-${year}-${String(count + 1).padStart(5, '0')}`

    const cert = await this.prisma.certificate.create({
      data: {
        number, enrollmentId,
        learnerName: learner?.displayName ?? 'متعلم وجيز',
        courseId: e.cohort.courseId, courseVersion: e.cohort.course.currentVersion,
        issuedBy: actorId,
      },
    })
    /* إكمال التسجيل مع الشهادة */
    await this.prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: 'completed' } })
    await recordAudit(this.prisma, {
      actorId, action: 'certificate.issue', entityType: 'certificate', entityId: cert.id,
      meta: { number, enrollmentId, courseId: e.cohort.courseId },
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
      await recordAudit(tx, { actorId, action: 'certificate.revoke', entityType: 'certificate', entityId: certificateId, meta: { reason } })
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

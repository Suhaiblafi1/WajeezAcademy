/* خطابُ توصيةٍ من الأكاديمية — يصدر مع الشهادة لمن استحقّه (٢٢ أكتوبر ٢٠٢٦).
   القرارُ وقاعدةُ الاستحقاق ونصُّ الخطاب في `src/application/learning/endorsement.ts`.

   · **يصدر مع الشهادة** (`CertificateService.issue`) — والشهادةُ قبله: خطابٌ يسقط لا يُسقط شهادة.
   · **وما صدر قبل الخطاب** يلحقه حين يفتح صاحبُه «شهاداتي» (`myCertificates`) — بالأرقام نفسِها التي فُحصت بها
     شهادتُه، فلا عاملَ يدور على من لم يستحقّه كلَّ ساعة.
   · **أرقامُه لقطة**: الحضورُ والمهامّ والمهاراتُ والساعات تُكتب يومَ الإصدار، فلا يتبدّل الخطابُ بعد تسليمه.
   · **والتحقّقُ منه تحقّقٌ من شهادته**: يُسجَّل في `CertificateVerification`، وشهادةٌ مسحوبةٌ تجعله ملغى. */

import { randomInt } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { safeNotify } from './notification.service'
import { ProgressService } from './progress.service'
import { SKILL_LINK_ORDER } from '../catalog/skill-link-order'
import {
  ENDORSEMENT_MAX_SKILLS, endorsementEarned, endorsementNumber, endorsementTally, type EndorsementEvidence,
} from '../../src/application/learning/endorsement'

const secureRandom = () => randomInt(0, 2 ** 32) / 2 ** 32

export class EndorsementService {
  private prisma: PrismaClient
  private progress: ProgressService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.progress = new ProgressService(prisma)
  }

  /** يُصدر الخطابَ إن استحقّه صاحبُ الشهادة — ويعيد رقمَه، أو `null` إن لم يستحقّه أو سُحبت شهادتُه */
  async issueIfEarned(certificateId: string): Promise<string | null> {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      select: {
        id: true, status: true, courseId: true, courseVersion: true, enrollmentId: true,
        endorsement: { select: { number: true } },
        enrollment: { select: { userId: true, courseProgress: { select: { evidence: true } } } },
      },
    })
    if (!cert || cert.status !== 'active') return null
    if (cert.endorsement) return cert.endorsement.number

    /* الدليلُ الذي فُحصت به الشهادة — `evaluateCompletion` يقرأ المحفوظَ ولا يعيد حسابه */
    const evidence = (cert.enrollment.courseProgress?.evidence
      ?? (await this.progress.recomputeProgress(cert.enrollmentId)).evidence) as EndorsementEvidence | null
    if (!evidence || !endorsementEarned(evidence)) return null
    const tally = endorsementTally(evidence)

    const [course, version] = await Promise.all([
      this.prisma.course.findUnique({
        where: { id: cert.courseId },
        select: { skillLinks: { include: { skill: { select: { nameAr: true } } }, orderBy: SKILL_LINK_ORDER } },
      }),
      this.prisma.courseVersion.findUnique({
        where: { courseId_version: { courseId: cert.courseId, version: cert.courseVersion } },
        select: { totalHours: true },
      }),
    ])
    const skills = (course?.skillLinks ?? []).map((l) => l.skill.nameAr).filter(Boolean).slice(0, ENDORSEMENT_MAX_SKILLS)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const number = endorsementNumber(secureRandom)
      try {
        const letter = await this.prisma.endorsementLetter.create({
          data: {
            number, certificateId: cert.id, skills,
            attendancePct: tally.attendancePct, tasksDone: tally.tasksDone, tasksTotal: tally.tasksTotal,
            totalHours: version?.totalHours ?? null,
          },
        })
        await recordAudit(this.prisma, {
          actorId: null, action: 'certificate.endorse', entityType: 'certificate', entityId: cert.id,
          meta: { number: letter.number, attendancePct: tally.attendancePct, tasksDone: tally.tasksDone, tasksTotal: tally.tasksTotal },
        })
        await safeNotify(this.prisma, {
          userId: cert.enrollment.userId, channel: 'in_app',
          title: 'خطاب توصية من الأكاديمية',
          body: 'استحققت خطاب توصية مع شهادتك لأنك حضرت وأنجزت مهامك كلها. افتحه من «شهاداتي» واطبعه أو أرسل رابطه لصاحب العمل.',
          templateKey: 'certificate.endorsed',
          data: { certificateId: cert.id, number: letter.number },
        })
        return letter.number
      } catch (err) {
        if ((err as { code?: string }).code !== 'P2002') throw err
        /* سبقه إصدارٌ آخر لهذه الشهادة؟ فرقمُه هو الجواب — وإلّا فرقمٌ تصادف، فنجرّب غيرَه */
        const had = await this.prisma.endorsementLetter.findUnique({ where: { certificateId: cert.id }, select: { number: true } })
        if (had) return had.number
      }
    }
    throw new AuthError('number_clash', 'تعذر توليد رقم خطاب فريد — أعد المحاولة', 409)
  }

  /** الخطابُ برقمه — صفحتُه العامّة. ويُسجَّل تحقّقا من شهادته */
  async view(number: string, ip?: string) {
    const letter = await this.prisma.endorsementLetter.findUnique({
      where: { number: number.trim().toUpperCase() },
      include: { certificate: { include: { revocation: { select: { reason: true } } } } },
    })
    if (!letter) throw new AuthError('not_found', 'لا خطاب بهذا الرقم', 404)
    const c = letter.certificate
    await this.prisma.certificateVerification.create({ data: { certificateId: c.id, ip } })
    const at = await this.prisma.courseVersion.findUnique({
      where: { courseId_version: { courseId: c.courseId, version: c.courseVersion } },
      select: { titleAr: true },
    })
    return {
      number: letter.number,
      issuedAt: letter.issuedAt,
      learnerName: c.learnerName,
      courseTitle: at?.titleAr ?? c.courseId,
      attendancePct: letter.attendancePct,
      tasksDone: letter.tasksDone,
      tasksTotal: letter.tasksTotal,
      skills: letter.skills,
      totalHours: letter.totalHours,
      certificateNumber: c.number,
      status: c.status,
      revokedReason: c.revocation?.reason ?? null,
    }
  }
}

/* نقلُ الشعبة إلى دورةٍ أخرى في الكتالوج — قبل أن يلتحق بها أحد (٢٦ أكتوبر ٢٠٢٦).

   ═══ العطبُ الذي وُلد منه ═══

   شعبةُ «علامتك الشخصية» للين كنعان فُتحت على دورة «كتابة المحتوى الاستراتيجي» (C-MKT-106)،
   والمدرّبةُ بنت دورةَ علامةٍ شخصيّة كاملة: محاورُها وكرّاستُها ومشروعُها كلُّها في بابٍ آخر. فصفحةُ
   الدورة تَعِد المشتري بركائز المحتوى ودليل النبرة، والشعبةُ تعلّمه التموضعَ وبروفايلَ LinkedIn.
   وعُرضت على صاحب المنصّة ثلاثةُ أبواب — دورةٌ جديدةٌ تُنقل إليها الشعبة، أو إعادةُ تسمية C-MKT-106،
   أو تغييرُ دورة المدرّبة لتطابق الكتالوج — فاختار الأوّل: «New catalog course»، ثمّ «Build the move
   action»: زرٌّ يُستعمل لكلّ شعبةٍ فُتحت على الدورة الخطأ، لا تعديلٌ في القاعدة بيدٍ لمرّةٍ واحدة.

   ═══ ما ينتقل معها ═══

   خمسةُ جداولَ تحمل الدورةَ والشعبةَ معا، فتتبع الشعبةَ ولا تبقى على دورتها القديمة:
   إسنادُ المدرّب (`TrainerCourseAssignment`)، وعروضُ الإسناد (`TrainerAssignmentOffer`)، وقاعدةُ
   أجرِ الشعبة (`TrainerCompensationRule`)، وقاعدةُ إتمامها (`CompletionRule`)، وطلباتُ تعديل المدرّب
   (`TrainerChangeRequest`). وتأهيلُ مدرّبها: من كان مؤهَّلا للقديمة ولا قرارَ له في الجديدة يُكتب له
   تأهيلٌ فيها بموادّه — فالإسنادُ يشترط التأهيل، وهو يعلّم المحتوى نفسَه. وتأهيلُه القديمُ يبقى:
   سحبُه قرارٌ آخرُ لم يُطلب. والعقدُ الموقَّع لا يُمسّ: قائمةُ دوراته لقطةٌ يومَ التوقيع
   (`qualifiedSnapshot`). وخطّتُه لا تُمسّ: معرّفاتُ محاورها (`C-MKT-106-T1`) مفاتيحُ لا عناوين،
   والجديدُ منها يأخذ بادئةَ دورته الجديدة بلا تصادم (`nextTrainerModuleId`).

   ═══ وما يمنع النقل ═══

   · أثرُ متعلّم: التحاقٌ أو طلبُ تسجيلٍ أو طلبُ شراءٍ للشعبة — من اشترى دورةً بعنوانها لا تُبدَّل
     تحته دورةٌ أخرى بضغطة.
   · بندٌ في كشف مستحقّات — مالٌ قُيّد على دورتها.
   · شعبةٌ منتهيةٌ أو ملغاة.
   · مدرّبٌ لها في الدورة الجديدة قرارٌ غيرُ التأهيل (رُفض أو سُحب أو ينتظر) — لا يُكتب فوقه.
   وما لا يمنع ويُقال: دورةٌ جديدةٌ لم تُنشر بعد — تُنقل إليها، ولا تظهر للمتعلّمين حتّى تُنشر. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

export interface CourseMoveTrainer {
  name: string
  /** ما يقع لتأهيله في الدورة الجديدة */
  qualification: 'has' | 'created' | 'blocked'
}

export interface CourseMovePreview {
  canMove: boolean
  /** لماذا لا تنتقل — أو `null` */
  blockedAr: string | null
  from: { id: string; titleAr: string }
  to: { id: string; titleAr: string; status: string }
  trainers: CourseMoveTrainer[]
  /** مسارُ الشعبة بعد النقل — يبقى إن كانت الدورةُ الجديدةُ فيه */
  pathwayAfter: string | null
  /** تنبيهٌ لا يمنع */
  noticeAr: string | null
}

const COURSE_STATUS_AR: Record<string, string> = {
  draft: 'مسودة', in_review: 'قيد المراجعة', approved: 'معتمدة', paused: 'موقوفة', archived: 'مؤرشفة',
}

export class CohortCourseMoveService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) { this.prisma = prisma }

  private async courseTitle(id: string): Promise<{ titleAr: string; status: string; pathways: string[] } | null> {
    const c = await this.prisma.course.findUnique({
      where: { id },
      select: {
        status: true,
        versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } },
        pathwayLinks: { select: { pathwayId: true } },
      },
    })
    if (!c) return null
    return { titleAr: c.versions[0]?.titleAr ?? id, status: c.status, pathways: c.pathwayLinks.map((l) => l.pathwayId) }
  }

  async preview(cohortId: string, toCourseId: string): Promise<CourseMovePreview> {
    const c = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: {
        status: true, courseId: true, pathwayId: true,
        trainers: { select: { profileId: true, profile: { select: { application: { select: { fullName: true } } } } } },
        _count: { select: { enrollments: true, enrollmentRequests: true } },
      },
    })
    if (!c) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    const from = await this.courseTitle(c.courseId)
    const to = await this.courseTitle(toCourseId)
    if (!to) throw new AuthError('unknown_course', 'الدورة غير موجودة في الكتالوج', 404)

    const [orders, payoutItems, quals] = await Promise.all([
      this.prisma.orderItem.count({ where: { kind: 'cohort', refId: cohortId } }),
      this.prisma.trainerPayoutItem.count({ where: { sourceRef: { startsWith: `cohort:${cohortId}` } } }),
      this.prisma.trainerCourseQualification.findMany({
        where: { profileId: { in: c.trainers.map((t) => t.profileId) }, courseId: { in: [c.courseId, toCourseId] } },
        select: { profileId: true, courseId: true, status: true },
      }),
    ])

    const blocked: string[] = []
    if (toCourseId === c.courseId) blocked.push('هي على هذه الدورة أصلا')
    if (['completed', 'cancelled'].includes(c.status)) blocked.push('منتهية أو ملغاة')
    if (c._count.enrollments > 0) blocked.push(`فيها ${c._count.enrollments} ملتحق`)
    if (c._count.enrollmentRequests > 0) blocked.push(`فيها ${c._count.enrollmentRequests} طلب تسجيل`)
    if (orders > 0) blocked.push(`لها ${orders} طلب شراء`)
    if (payoutItems > 0) blocked.push('لها بند في كشف مستحقات')

    const trainers: CourseMoveTrainer[] = c.trainers.map((t) => {
      const name = t.profile.application.fullName
      const onTarget = quals.find((q) => q.profileId === t.profileId && q.courseId === toCourseId)
      if (onTarget?.status === 'qualified') return { name, qualification: 'has' as const }
      if (onTarget) {
        blocked.push(`${name} له قرار في الدورة الجديدة غير التأهيل`)
        return { name, qualification: 'blocked' as const }
      }
      const onSource = quals.find((q) => q.profileId === t.profileId && q.courseId === c.courseId)
      if (onSource?.status !== 'qualified') {
        blocked.push(`${name} غير مؤهل لدورتها الحالية`)
        return { name, qualification: 'blocked' as const }
      }
      return { name, qualification: 'created' as const }
    })

    const pathwayAfter = c.pathwayId && to.pathways.includes(c.pathwayId)
      ? c.pathwayId
      : to.pathways.length === 1 ? to.pathways[0] : null

    return {
      canMove: blocked.length === 0,
      blockedAr: blocked.length ? `لا تنقل: ${blocked.join('، ')}` : null,
      from: { id: c.courseId, titleAr: from?.titleAr ?? c.courseId },
      to: { id: toCourseId, titleAr: to.titleAr, status: to.status },
      trainers,
      pathwayAfter,
      noticeAr: to.status === 'published'
        ? null
        : `الدورة الجديدة ${COURSE_STATUS_AR[to.status] ?? to.status} — لا تظهر الشعبة للمتعلمين حتى تنشرها`,
    }
  }

  async move(actorId: string, cohortId: string, toCourseId: string) {
    const p = await this.preview(cohortId, toCourseId)
    if (!p.canMove) throw new AuthError('cannot_move', p.blockedAr ?? 'لا تنقل', 409)

    return this.prisma.$transaction(async (tx) => {
      /* يُعاد الفحصُ في المعاملة: التحاقٌ أو شراءٌ وصل بين المعاينة والنقل يوقفه */
      const c = await tx.cohort.findUnique({
        where: { id: cohortId },
        select: {
          title: true, courseId: true, pathwayId: true, status: true,
          trainers: { select: { profileId: true } },
          _count: { select: { enrollments: true, enrollmentRequests: true } },
        },
      })
      const orders = await tx.orderItem.count({ where: { kind: 'cohort', refId: cohortId } })
      if (!c || c.courseId !== p.from.id || c._count.enrollments > 0 || c._count.enrollmentRequests > 0 || orders > 0
        || ['completed', 'cancelled'].includes(c.status)) {
        throw new AuthError('cannot_move', 'تغيرت الشعبة — أعد فتحها وحاول ثانية', 409)
      }
      const from = c.courseId
      const scoped = { cohortId, courseId: from }

      /* التأهيلُ أوّلا: الإسنادُ في الدورة الجديدة يقرؤه */
      const qualified: string[] = []
      for (const t of c.trainers) {
        const target = await tx.trainerCourseQualification.findUnique({
          where: { profileId_courseId: { profileId: t.profileId, courseId: toCourseId } },
        })
        if (target) continue
        const source = await tx.trainerCourseQualification.findUnique({
          where: { profileId_courseId: { profileId: t.profileId, courseId: from } },
        })
        await tx.trainerCourseQualification.create({
          data: {
            profileId: t.profileId, courseId: toCourseId, status: 'qualified', qualifiedBy: actorId,
            decidedAt: new Date(), requestedCohortId: cohortId,
            note: `نقلت شعبته «${c.title}» من ${from} إلى ${toCourseId}`,
            materials: source?.materials ?? undefined, materialsAt: source?.materialsAt ?? undefined,
          },
        })
        qualified.push(t.profileId)
      }

      const [assignments, offers, compensation, completion, changes] = await Promise.all([
        tx.trainerCourseAssignment.updateMany({ where: scoped, data: { courseId: toCourseId } }),
        tx.trainerAssignmentOffer.updateMany({ where: scoped, data: { courseId: toCourseId } }),
        tx.trainerCompensationRule.updateMany({ where: scoped, data: { courseId: toCourseId } }),
        tx.completionRule.updateMany({ where: scoped, data: { courseId: toCourseId } }),
        tx.trainerChangeRequest.updateMany({ where: scoped, data: { courseId: toCourseId } }),
      ])
      await tx.cohort.update({ where: { id: cohortId }, data: { courseId: toCourseId, pathwayId: p.pathwayAfter } })

      const carried = {
        assignments: assignments.count, offers: offers.count, compensationRules: compensation.count,
        completionRules: completion.count, changeRequests: changes.count, qualificationsCreated: qualified.length,
      }
      await recordAudit(tx, {
        actorId, action: 'cohort.course_move', entityType: 'cohort', entityId: cohortId,
        before: { courseId: from, pathwayId: c.pathwayId },
        after: { courseId: toCourseId, pathwayId: p.pathwayAfter },
        meta: { title: c.title, fromTitle: p.from.titleAr, toTitle: p.to.titleAr, ...carried },
      })
      return { moved: true as const, title: c.title, from: p.from, to: p.to, carried }
    })
  }
}

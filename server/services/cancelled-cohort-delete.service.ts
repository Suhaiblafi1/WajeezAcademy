/* حذفُ الشعبة الملغاة نهائيّا — ولو كان لها مدرّب، باختيارٍ صريح (٢٢ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «اجعل خيارَ الحذف واضحا جدّا». وكان زرُّ «احذفها» لا يظهر إلّا لملغاةٍ لا
   مدرّبَ لها (`trainerless-cohort-delete.service.ts`) — فالملغاةُ لقلّة التسجيل، وهي تقريبا كلُّ ما
   يُلغى، تبقى في القائمة بلا باب.

   ═══ ولمَ «مع خطّته» اختيارٌ لا افتراض ═══

   خطّةُ المدرّب — محاورُه وكرّاساتُه ولقاءاتُه — تسكن في الشعبة (`CohortDeliveryPlan` بقيدِ حذفٍ
   متسلسل). فحذفُ الشعبة يحذف عملَه فيها. وقاعدةُ المستودَع: «لا إجبارَ على فعل — الفرقُ والخياراتُ
   والقرارُ لصاحب المنصّة». فالشاشةُ تعرض الخيارين — إبقاؤها ملغاةً (تبقى خطّتُه، ويُنسخ منها لشعبةٍ
   جديدة) أو حذفُها بخطّتها — ولا يُحذف ما له مدرّبٌ إلّا بـ`withTrainerPlan: true`.

   ═══ وما لا يُحذف أبدا ═══

   · غيرُ الملغاة — الحذفُ بعد الإلغاء لا بدله، فالإلغاءُ هو ما يُبلغ المتعلّمين والمدرّب.
   · ما فيه أثرُ متعلّم: تسجيلٌ بأيّ حال أو طلبُ تسجيل — حقُّ إنسانٍ لا يُمحى بضغطة.
   · وما كُتب له بندٌ في كشف مستحقّات — مالٌ قُيّد لا يُترك يتيما. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

export interface CancelledDeletePreview {
  canDelete: boolean
  /** لماذا لا تُحذف — أو `null` */
  blockedAr: string | null
  trainerNames: string[]
  /** خططُ المدرّب التي تُحذف معها */
  plans: number
  sessions: number
}

export class CancelledCohortDeleteService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) { this.prisma = prisma }

  async preview(cohortId: string): Promise<CancelledDeletePreview> {
    const c = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: {
        status: true,
        trainers: { select: { profile: { select: { application: { select: { fullName: true } } } } } },
        _count: { select: { enrollments: true, enrollmentRequests: true, sessions: true, plans: true } },
      },
    })
    if (!c) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    const payoutItems = await this.prisma.trainerPayoutItem.count({ where: { sourceRef: { startsWith: `cohort:${cohortId}` } } })
    const blocked: string[] = []
    if (c.status !== 'cancelled') blocked.push('ألغها أولا — الإلغاء هو ما يبلغ المتعلمين والمدرب')
    if (c._count.enrollments > 0) blocked.push(`فيها ${c._count.enrollments} ملتحق`)
    if (c._count.enrollmentRequests > 0) blocked.push(`فيها ${c._count.enrollmentRequests} طلب تسجيل`)
    if (payoutItems > 0) blocked.push('لها بند في كشف مستحقات')
    return {
      canDelete: blocked.length === 0,
      blockedAr: blocked.length ? `لا تحذف: ${blocked.join('، ')}` : null,
      trainerNames: c.trainers.map((t) => t.profile.application.fullName),
      plans: c._count.plans,
      sessions: c._count.sessions,
    }
  }

  async delete(actorId: string, cohortId: string, opts: { withTrainerPlan: boolean }): Promise<{ deleted: true; title: string }> {
    const p = await this.preview(cohortId)
    if (!p.canDelete) throw new AuthError('cannot_delete', p.blockedAr ?? 'لا تحذف', 409)
    if (p.trainerNames.length > 0 && !opts.withTrainerPlan) {
      throw new AuthError('trainer_plan_choice', 'لها مدرب وخطته — اختر صراحة حذفها مع خطته، أو أبقها ملغاة', 409)
    }
    return this.prisma.$transaction(async (tx) => {
      /* يُعاد الفحصُ في المعاملة: تسجيلٌ وصل بين المعاينة والحذف يوقفه */
      const c = await tx.cohort.findUnique({
        where: { id: cohortId },
        select: { title: true, courseId: true, status: true, _count: { select: { enrollments: true, enrollmentRequests: true } } },
      })
      if (!c || c.status !== 'cancelled' || c._count.enrollments > 0 || c._count.enrollmentRequests > 0) {
        throw new AuthError('cannot_delete', 'تغيّرت الشعبة — أعد فتحها وحاول ثانية', 409)
      }
      const offers = await tx.trainerAssignmentOffer.updateMany({
        where: { cohortId, status: 'offered' },
        data: { status: 'withdrawn', withdrawnBy: actorId, withdrawReasonAr: 'حذفت الشعبة بعد إلغائها' },
      })
      await tx.trainerCompensationRule.deleteMany({ where: { cohortId } })
      await tx.cohort.delete({ where: { id: cohortId } })
      await recordAudit(tx, {
        actorId, action: 'cohort.delete_cancelled', entityType: 'cohort', entityId: cohortId,
        meta: {
          title: c.title, courseId: c.courseId, trainers: p.trainerNames, plans: p.plans,
          sessions: p.sessions, offersWithdrawn: offers.count,
        },
      })
      return { deleted: true as const, title: c.title }
    })
  }
}

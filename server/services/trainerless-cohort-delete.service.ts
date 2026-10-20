/* حذفُ الشعبة التي لا مدرّبَ لها — من الشاشة، لا بترحيل (٢٠ أكتوبر ٢٠٢٦).

   ═══ لماذا بقيت بعد ترحيلَين ═══

   قرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦): «كلُّ شعبةٍ بلا مدرّبٍ تُحذف — لا شعبةَ بلا مدرّب».
   فحذف `20261019090000_delete_all_trainerless_cohorts` ما قام منها يومَها، واستثنى ما تعلّق به
   أثرٌ — لمتعلّمٍ أو لمدرّبٍ في الطريق. فبقيت ستُّ شعبٍ بأسمائها القديمة («— الدفعة الأولى»)
   في «شعب تحتاج فصلا منك»، وقال (٢٠ أكتوبر): «لماذا ما زالت هنا! احذفها».

   والترحيلُ يجري مرّةً ولا يقول لماذا ترك. فصار الحذفُ زرّا في الصندوق نفسِه: يحذف ما يُحذف،
   ويقول لما لا يُحذف سببَه.

   ═══ ما يُحذف وما لا ═══

   · **لا يُحذف ما فيه أثرٌ لمتعلّم:** تسجيلٌ بأيّ حال، أو طلبُ تسجيلٍ بأيّ حال — حقُّ إنسانٍ لا
     يُمحى بضغطة. ويُقال عددُه.
   · **وما سواه آثارُ مدرّبٍ لم يأتِ، فتُزال مع الشعبة:** عرضُ تدريسٍ ينتظر جوابَه يُسحب (`withdrawn`)
     فلا يبقى عند مدرّبٍ عرضٌ لشعبةٍ لا وجودَ لها؛ وقاعدةُ أجرٍ خاصّةٌ بها تُحذف (عمودُها بلا قيد،
     فتبقى يتيمةً لو تُركت)؛ والباقي يتبع القيدَ — الجلساتُ والخططُ والموادُّ وروابطُ الإحالة تُحذف،
     والتكليفُ وطلبُ التغيير والعرضُ تُفرَغ شعبتُها.
   · **ولا يُحذف ما له مدرّب** — هذا الزرُّ لما لا مدرّبَ له وحدَه، ويُعاد فحصُه في المعاملة.

   وكلُّ حذفٍ أثرٌ `cohort.delete_trainerless` باسم من حذف، وفيه اسمُ الشعبة ودورتُها. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

export interface TrainerlessDeleteResult {
  deleted: { id: string; title: string }[]
  kept: { id: string; title: string; reasonAr: string }[]
}

/** لماذا لا تُحذف — أو `null` إن حُذفت */
function keptReasonAr(c: { trainers: number; enrollments: number; requests: number }): string | null {
  if (c.trainers > 0) return 'لها مدرب'
  const parts: string[] = []
  if (c.enrollments > 0) parts.push(`${c.enrollments} ملتحق`)
  if (c.requests > 0) parts.push(`${c.requests} طلب تسجيل`)
  return parts.length ? `فيها ${parts.join(' و')} — لا تحذف` : null
}

export class TrainerlessCohortDeleteService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) { this.prisma = prisma }

  /** يحذف ما يُحذف من هذه الشعب — ويقول لما لا يُحذف سببَه */
  async delete(actorId: string, cohortIds: readonly string[]): Promise<TrainerlessDeleteResult> {
    const ids = [...new Set(cohortIds)]
    if (ids.length === 0) throw new AuthError('bad_request', 'لا شعبة محددة', 400)
    const result: TrainerlessDeleteResult = { deleted: [], kept: [] }
    for (const id of ids) {
      const done = await this.prisma.$transaction(async (tx) => {
        const c = await tx.cohort.findUnique({
          where: { id },
          select: {
            id: true, title: true, courseId: true,
            _count: { select: { trainers: true, enrollments: true, enrollmentRequests: true, sessions: true } },
          },
        })
        if (!c) return { title: id, reasonAr: 'غير موجودة' }
        const reasonAr = keptReasonAr({
          trainers: c._count.trainers, enrollments: c._count.enrollments, requests: c._count.enrollmentRequests,
        })
        if (reasonAr) return { title: c.title, reasonAr }
        const offers = await tx.trainerAssignmentOffer.updateMany({
          where: { cohortId: id, status: 'offered' },
          data: { status: 'withdrawn', withdrawnBy: actorId, withdrawReasonAr: 'حذفت الشعبة لأن لا مدرب لها' },
        })
        await tx.trainerCompensationRule.deleteMany({ where: { cohortId: id } })
        await tx.cohort.delete({ where: { id } })
        await recordAudit(tx, {
          actorId, action: 'cohort.delete_trainerless', entityType: 'cohort', entityId: id,
          meta: { title: c.title, courseId: c.courseId, sessions: c._count.sessions, offersWithdrawn: offers.count },
        })
        return { title: c.title, reasonAr: null }
      }).catch(() => ({ title: id, reasonAr: 'تعذر حذفها — جرّب ثانية' }))
      if (done.reasonAr) result.kept.push({ id, title: done.title, reasonAr: done.reasonAr })
      else result.deleted.push({ id, title: done.title })
    }
    return result
  }
}

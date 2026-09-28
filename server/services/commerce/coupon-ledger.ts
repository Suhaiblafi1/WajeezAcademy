/* دفترُ استعمال الكوبون — يُحجز مع الطلب، ويُدفع معه، ويُفرَج عنه إن هُجر.

   ═══ العطبُ الذي كُتب له ═══

   `usedCount` كان يزيد عند **إنشاء** الطلب ولا ينقص أبدا: طلبٌ يُهجَر فيُلغيه
   `reclaim_abandoned_orders` بعد ساعة، أو يُلغيه صاحبُه، والاستعمالُ يبقى
   محسوبا. فكوبونٌ لمرّةٍ واحدةٍ يحترق بصفحة دفعٍ أُغلقت، وكودٌ بعشرة استعمالاتٍ
   ينفد بعشرِ نقراتٍ لم يدفع أحدٌ منها شيئا. وقرارُ صاحب المنصّة لكود المدرّب
   صريح: «الطلبُ المهجورُ لا يحرق الكود».

   وكان العدُّ يُفحص قبل المعاملة ويُكتب فيها بلا شرط — فشراءان متزامنان على
   آخر استعمالٍ يمرّان كلاهما.

   ═══ فصار الاستعمالُ حجزا له دورة ═══

   · **يُحجز** مع الطلب في معاملته: العدُّ يزيد بشرط ألّا يتجاوز الحدّ (فالثاني
     من المتزامنَين يُردّ)، ولكود المدرّب صفُّ استعمالٍ محجوز.
   · **ويُدفع** حين يُدفع الطلب (`settleOrder`): صفُّ الاستعمال يصير دَينا على
     المدرّب بقدر ما مُنح — وهي اللحظةُ التي يقول فيها البند 4-10 «شراء تم ودفع».
   · **ويُفرَج عنه** إن أُلغي الطلبُ قبل الدفع: العدُّ ينقص، والصفُّ يُفرَج عنه.
   · **ويُردّ** بقدر ما رُدّ من الثمن: ما عليه ينقص، وما حُسم زيادةً يُعاد إليه
     في الكشف التالي.

   وما يُنادى بعد وقوع المال (الدفعُ والردّ) **لا يرمي أبدا** — كما
   `markUsedForOrder` قبله: تسويةُ دفعةٍ أو ردُّها حدثٌ ماليٌّ وقع، وعطبٌ في قيد
   كودٍ لا يُسقطه. فما تعذّر يُقيَّد أثرا يُقرأ ويُصلَح بيد. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from '../auth.service'
import { recordAudit } from '../audit'
import { owedAfterRefund } from '../../../src/application/trainer/trainer-code'

type Tx = Prisma.TransactionClient

const num = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0)
const round2 = (n: number) => Math.round(n * 100) / 100

/** ما يُحتسب استعمالا للمتعلّم: المحجوزُ والمدفوع — وهو شرطُ القيد الجزئيّ
    `TrainerCodeRedemption_once_per_learner` في الترحيل بحروفه */
export const CODE_USE_COUNTS = ['held', 'paid'] as const

/** كودُ المدرّب في طلب — ما يلزم لحجز استعماله */
export interface TrainerCodeUse {
  id: string
  profileId: string
}

/** يُحجز استعمالُ الكوبون في معاملة الطلب نفسِها — أو تُردّ المعاملةُ كلُّها */
export async function reserveCouponUse(tx: Tx, input: {
  couponId: string
  maxUses: number | null
  orderId: string
  userId: string
  trainerCode: TrainerCodeUse | null
  /** ما مُنح بهذا الكوبون في الطلب — ولكود المدرّب هو ما يُحسم منه */
  discount: number
  currency: string
}): Promise<void> {
  /* العدُّ بشرطِ الحدّ في الكتابة نفسِها — لا فحصا قبلها. فمن قرأ «بقي
     استعمال» مع غيره في اللحظة نفسِها يُردّ أحدُهما هنا لا يمرّان معا. */
  const bumped = await tx.coupon.updateMany({
    where: { id: input.couponId, ...(input.maxUses ? { usedCount: { lt: input.maxUses } } : {}) },
    data: { usedCount: { increment: 1 } },
  })
  if (bumped.count === 0) throw new AuthError('bad_coupon', 'استنفد الكوبون عدد استخداماته', 409)

  if (!input.trainerCode || !(input.discount > 0)) return
  try {
    await tx.trainerCodeRedemption.create({
      data: {
        codeId: input.trainerCode.id, profileId: input.trainerCode.profileId,
        orderId: input.orderId, userId: input.userId,
        amount: round2(input.discount), currency: input.currency,
      },
    })
  } catch (e) {
    /* القيدُ الجزئيُّ ردّ نقرةً ثانيةً متزامنة — والجملةُ نفسُها التي يقولها
       الفحصُ المسبق في `couponFor`، فلا يقرأ المتعلّمُ جوابين لسؤالٍ واحد */
    if (isUniqueViolation(e)) throw new AuthError('code_used', CODE_USED_AR, 409)
    throw e
  }
}

export const CODE_USED_AR = 'استعملتَ هذا الكود من قبل — يُستعمل مرّةً واحدةً لكلّ متعلّم'

/** يُفرَج عن استعمال طلبٍ أُلغي قبل أن يُدفع — في معاملة الإلغاء نفسِها.

    ويُنادى **بعد** أن نقلت المعاملةُ الطلبَ من «بانتظار الدفع» إلى «ملغى» بشرطٍ
    على حالته: إلغاءان متزامنان (صاحبُه والمُشغِّلُ الخلفيّ) ينقل أحدُهما
    وحدَه، فلا ينقص العدُّ مرّتين. */
export async function releaseCouponUse(tx: Tx, order: { id: string; couponId: string | null }): Promise<boolean> {
  if (!order.couponId) return false
  await tx.coupon.updateMany({
    where: { id: order.couponId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  })
  await tx.trainerCodeRedemption.updateMany({
    where: { orderId: order.id, status: 'held' },
    data: { status: 'released', releasedAt: new Date() },
  })
  return true
}

/** دُفع الطلب: استعمالُ كود المدرّب يصير دَينا عليه بقدر ما مُنح.

    ومن `released` كذلك لا من `held` وحدَه: دفعٌ متأخّرٌ يصل بعد أن أُلغي الطلبُ
    آليّا (webhook تأخّر ساعةً) يُسوّي الفاتورةَ فعلا — والمشتري أخذ الخصم،
    فالاستعمالُ وقع ويعود محسوبا. */
export async function markCodeUsePaid(prisma: PrismaClient, orderId: string): Promise<void> {
  try {
    const r = await prisma.trainerCodeRedemption.findUnique({
      where: { orderId },
      include: { code: { select: { couponId: true } } },
    })
    if (!r || (r.status !== 'held' && r.status !== 'released')) return
    const moved = await prisma.$transaction(async (tx) => {
      const m = await tx.trainerCodeRedemption.updateMany({
        where: { id: r.id, status: r.status },
        data: { status: 'paid', paidAt: new Date(), owed: r.amount, pending: { increment: r.amount } },
      })
      if (m.count === 1 && r.status === 'released') {
        await tx.coupon.update({ where: { id: r.code.couponId }, data: { usedCount: { increment: 1 } } })
      }
      return m.count
    })
    if (moved === 0) return
    await recordAudit(prisma, {
      actorId: null, action: 'trainer_code.use',
      entityType: 'trainer_profile', entityId: r.profileId,
      meta: { redemptionId: r.id, codeId: r.codeId, orderId, amount: num(r.amount), currency: r.currency },
    })
  } catch (e) {
    await ledgerFailed(prisma, orderId, 'use', e)
  }
}

/** رُدّ من ثمن الطلب حصّةٌ: ما عليه ينقص بقدرها، وما حُسم زيادةً يُعاد إليه.

    والحصّةُ **مجموعُ** ما رُدّ من الدفعة لا الردُّ الأخير وحدَه — فالنداءُ يُعاد
    بعد كلّ ردٍّ ويصل إلى الرقم نفسِه، ولا يُطرح ردٌّ مرّتين. */
export async function applyCodeRefund(prisma: PrismaClient, orderId: string, share: number): Promise<void> {
  try {
    const r = await prisma.trainerCodeRedemption.findUnique({ where: { orderId } })
    if (!r || r.status !== 'paid') return
    const owedBefore = num(r.owed)
    const owedNow = owedAfterRefund(num(r.amount), share)
    const full = share >= 1
    const delta = round2(owedNow - owedBefore)
    if (delta === 0 && !full) return
    const moved = await prisma.$transaction(async (tx) => {
      /* بشرطِ ما قُرئ: ردّان متزامنان على طلبٍ واحد يقرأ كلاهما «عليه كذا»،
         فيُكتب أحدُهما ويُعاد الآخرُ من الإدارة لا يُطرح على رقمٍ قديم */
      const m = await tx.trainerCodeRedemption.updateMany({
        where: { id: r.id, status: 'paid', owed: r.owed },
        data: {
          owed: owedNow, pending: { increment: delta },
          ...(full ? { status: 'refunded', refundedAt: new Date() } : {}),
        },
      })
      /* وشراءٌ رُدّ ثمنُه كلُّه لم يكلّف المدرّبَ شيئا — فلا يأكل من حدّ
         استعمالات كوده. ولا يُمسّ عدُّ الكوبونات العامّة: لا دفترَ لها يقول
         ما رُدّ منها وما بقي. */
      if (m.count === 1 && full) {
        const code = await tx.trainerCode.findUnique({ where: { id: r.codeId }, select: { couponId: true } })
        if (code) {
          await tx.coupon.updateMany({
            where: { id: code.couponId, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          })
        }
      }
      return m.count
    })
    if (moved === 0) {
      await ledgerFailed(prisma, orderId, 'refund', new Error('تبدّل ما عليه بين القراءة والكتابة'))
      return
    }
    await recordAudit(prisma, {
      actorId: null, action: 'trainer_code.refund',
      entityType: 'trainer_profile', entityId: r.profileId,
      meta: {
        redemptionId: r.id, orderId, share: round2(share),
        owedBefore, owedNow, returned: round2(-delta), currency: r.currency,
      },
    })
  } catch (e) {
    await ledgerFailed(prisma, orderId, 'refund', e)
  }
}

async function ledgerFailed(prisma: PrismaClient, orderId: string, step: 'use' | 'refund', e: unknown) {
  await recordAudit(prisma, {
    actorId: null, action: 'trainer_code.ledger_failed',
    entityType: 'order', entityId: orderId,
    meta: { step, error: e instanceof Error ? e.message : String(e) },
    reason: 'استعمالُ كودِ مدرّبٍ لم يُقيَّد في دفتره — تسويةٌ يدويّةٌ مطلوبة',
  }).catch(() => { /* الأثرُ نفسُه لا يُسقط تسويةَ دفعةٍ ولا ردَّها */ })
}

/** خطأُ فرادةٍ من Prisma — بلا استيراد نوعٍ من زمن التشغيل */
function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2002'
}

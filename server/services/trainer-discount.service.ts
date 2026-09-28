/* خصومُ المدرّب القديمةُ بالمبلغ — قراءتُها وإلغاؤها وتسويتُها.

   ═══ ولا يُصدَر جديدٌ منها (٢٧ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة نسخَ «المبلغ» بـ«الكود بالنسبة»: «اصدار كود وليس خصم
   مباشر، والخصم يكون نسبة وليس رقما». فالإصدارُ هنا أُغلق وحلّ محلَّه
   `trainer-code.service.ts`. وما صدر قبل ذلك يبقى على شروطه حتّى يُستعمل أو
   ينتهي أو يُلغى — ذيلُ البند 4-10 بصيغته الجديدة — فبقي هنا ما يقرؤه
   ويُلغيه ويقيّد استعمالَه وردَّه. وما يلي من القرار الأوّل تاريخُه.

   ═══ القرار ═══

   قرارُ صاحب المنصّة (٢١ سبتمبر ٢٠٢٦): «لا يتحمّل أيّ خصوماتٍ تطرحها
   الأكاديميّةُ من نفسها، ولكن يتحمّل هو أيَّ خصوماتٍ قرّر إعطاءها لأشخاصٍ
   معيّنين من نفسه باستخدام الكود الخاصّ به… في قسم دعوتي… لتُخصم من حسابه
   في مستحقّاتي لاحقا».

   والقواعدُ (السقف · أدنى مبلغ · التسوية) في
   `src/application/trainer/issued-discount.ts` — تقرؤها الشاشةُ والخادمُ
   معا، فلا يقرأ المدرّبُ حدّا في الشاشة ويُردّ بحدٍّ آخرَ من الخادم.

   ═══ وأين تقع الأفعالُ الثلاثةُ في الزمن ═══

   ① **الإصدار** هنا، بفعله هو، تحت سقفِ ما له عندنا.
   ② **الاستعمالُ** في `settleOrder` — لحظةَ أن يصير الطلبُ مدفوعا لا لحظةَ
      أن يُنشأ. والفرقُ ليس تدقيقا: الطلبُ يُنشأ ثمّ يُهجَر فيُلغى، فمن عدّه
      مستعمَلا عند الإنشاء حسم من المدرّب مالا لم يُقبَض من أحد.
   ③ **والتسويةُ** في `earnings.service` عند توليد الكشف — بندٌ سالبٌ باسمه.

   ═══ ولمَ لا يُحسَب الاستعمالُ من الطلبات وقتَ الكشف ═══

   كان يمكن أن يُستغنى عن الحالة: يُبحث وقتَ التسوية عن طلبٍ مدفوعٍ يحمل
   الكوبون. ولا يصحّ لسببين: الأوّلُ أنّ المدرّبَ يحتاج أن يرى في «دعوتي»
   **الآن** أيُّ خصومه استُعملت، لا أن ينتظر كشفا. والثاني أنّ الاسترداد
   بعد الدفع يُعيد الحالةَ إلى `live`، وذلك حدثٌ يُؤرَّخ لا استنتاجٌ يُعاد
   حسابُه كلَّ مرّة. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { ISSUED_DISCOUNT_STATUS_AR } from '../../src/application/trainer/issued-discount'

const num = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0)

export class TrainerDiscountService {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  private async activeProfile(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId } })
    if (!profile || profile.suspendedAt) {
      throw new AuthError('not_trainer', 'لا ملف مدرب نشطا لهذا الحساب', 403)
    }
    return profile
  }

  /** ما أصدره قبل الكود — أحدثُ أوّلا. ولا رصيدَ معه: لا يُصدَر جديدٌ يُقاس عليه */
  async listFor(userId: string) {
    const profile = await this.activeProfile(userId)
    const rows = await this.prisma.trainerIssuedDiscount.findMany({
      where: { profileId: profile.id },
      include: { coupon: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return {
      discounts: rows.map((d) => ({
        id: d.id,
        code: d.coupon.code,
        status: d.status,
        statusAr: ISSUED_DISCOUNT_STATUS_AR[d.status] ?? d.status,
        amount: num(d.amount),
        currency: d.currency,
        forWhomAr: d.forWhomAr,
        noteAr: d.noteAr,
        expiresAt: d.expiresAt,
        usedAt: d.usedAt,
        settledAt: d.settledAt,
        revokedAt: d.revokedAt,
        createdAt: d.createdAt,
      })),
    }
  }

  /** الإلغاء — ما لم يُستعمَل وحدَه.

      ولمَ لا يُلغى المستعمَل: المتعلّمُ دفع ناقصا بالفعل، والمالُ نقص من
      حسابنا. وإلغاؤه بعد ذلك لا يستردّ شيئا — إنّما يُسقط بندَ الحسم، فتصير
      الأكاديميّةُ هي المتحمّلة، وذاك عكسُ القرار. */
  async revoke(userId: string, id: string) {
    const profile = await this.activeProfile(userId)
    const row = await this.prisma.trainerIssuedDiscount.findUnique({ where: { id } })
    if (!row || row.profileId !== profile.id) {
      throw new AuthError('not_found', 'لا خصمَ بهذا المعرّف بين ما أصدرتَه', 404)
    }
    if (row.status !== 'live') {
      throw new AuthError(
        'bad_state',
        row.status === 'revoked' ? 'ألغيتَه من قبل' : 'استُعمل هذا الخصمُ فعلا — ولا يُلغى ما استُعمل',
        409,
      )
    }
    await this.prisma.$transaction(async (tx) => {
      /* والكوبونُ يُطفأ معه: صفٌّ ملغىً وكوبونٌ يعمل يعني رمزا ما زال يخصم */
      await tx.coupon.update({ where: { id: row.couponId }, data: { active: false } })
      await tx.trainerIssuedDiscount.update({
        where: { id, status: 'live' },
        data: { status: 'revoked', revokedAt: new Date() },
      })
      await recordAudit(tx, {
        actorId: userId, action: 'trainer_discount.revoke',
        entityType: 'trainer_profile', entityId: profile.id,
        meta: { discountId: id, amount: num(row.amount) },
      })
    })
    return { ok: true }
  }

  /* ═══════════ ما ينادى من خارج بوّابة المدرّب ═══════════ */

  /* ═══ والطلبُ المهجورُ لم يعد يحرق الرمز (٢٧ سبتمبر ٢٠٢٦) ═══

     كان `usedCount` يزيد عند **إنشاء** الطلب ولا ينقص أبدا، فمن بدأ شراءً
     برمزِ مدرّبٍ ثمّ هجره احترق الرمزُ (`maxUses: 1`) والخصمُ ما زال `live`.
     وصار إلغاءُ الطلب — بيد صاحبه أو آليّا بعد ساعة — يُعيد الاستعمال
     (`commerce/coupon-ledger.ts`)، فيعود الرمزُ صالحا لمن أُعطيه. */

  /** استُعمل: يُنادى من `settleOrder` لحظةَ أن يصير الطلبُ مدفوعا.

      ولا يرمي أبدا: تسويةُ دفعةٍ حدثٌ ماليٌّ وقع، وعطبٌ في قيد خصمٍ لا يصحّ
      أن يُسقطها فيبقى المتعلّمُ بلا تسجيلٍ عن مالٍ قُبض. فما تعذّر يُقيَّد
      أثرا يُقرأ. */
  async markUsedForOrder(orderId: string, couponId: string | null) {
    if (!couponId) return
    try {
      const row = await this.prisma.trainerIssuedDiscount.findUnique({ where: { couponId } })
      if (!row || row.status !== 'live') return
      await this.prisma.trainerIssuedDiscount.updateMany({
        where: { id: row.id, status: 'live' },
        data: { status: 'used', usedAt: new Date(), usedOrderId: orderId },
      })
      await recordAudit(this.prisma, {
        actorId: null, action: 'trainer_discount.used',
        entityType: 'trainer_profile', entityId: row.profileId,
        meta: { discountId: row.id, orderId, amount: num(row.amount) },
      })
    } catch (e) {
      await recordAudit(this.prisma, {
        actorId: null, action: 'trainer_discount.used_failed',
        entityType: 'order', entityId: orderId,
        meta: { couponId, error: e instanceof Error ? e.message : String(e) },
        reason: 'خصمُ مدرّبٍ استُعمل ولم يُقيَّد — تسويةٌ يدويّةٌ مطلوبة',
      }).catch(() => { /* الأثرُ نفسُه لا يُسقط تسويةَ دفعة */ })
    }
  }

  /** رُدّ ثمنُ الطلب كلُّه: الخصمُ المستعمَلُ فيه لا يُحسم — البند 4-10.

      «ولا يحسم … ما استعمل في شراء استرد». وكان الردُّ لا يمسّ هذا الجدول،
      فيُحسم من المدرّب خصمٌ عن مالٍ أُعيد إلى صاحبه.

      وما حُسم قبل الردّ لا يُعاد هنا آليّا: الصفُّ خصمٌ واحدٌ لاستعمالٍ واحد،
      وإعادتُه بندٌ موجبٌ في كشفٍ لم يُولَّد بعد — ولا موضعَ لذلك في هذا الجدول
      (وكودُ المدرّب الجديد له دفترٌ يفعله: `coupon-ledger.ts`). فيُقيَّد أثرا
      يقرؤه المسؤولُ الماليّ فيُضيف البندَ بيده. وهو نادرٌ بطبعه: الحسمُ عند
      انتهاء الشعبة، والردُّ قلّما يتأخّر إليه.

      ولا يرمي — كأخيه `markUsedForOrder`: الردُّ وقع عند المزوّد. */
  async markRefundedForOrder(orderId: string) {
    try {
      const rows = await this.prisma.trainerIssuedDiscount.findMany({
        where: { usedOrderId: orderId, status: { in: ['used', 'settled'] } },
      })
      for (const row of rows) {
        if (row.status === 'used') {
          const moved = await this.prisma.trainerIssuedDiscount.updateMany({
            where: { id: row.id, status: 'used', settledItemId: null },
            data: { status: 'refunded' },
          })
          if (moved.count === 0) continue
          await recordAudit(this.prisma, {
            actorId: null, action: 'trainer_discount.refund',
            entityType: 'trainer_profile', entityId: row.profileId,
            meta: { discountId: row.id, orderId, amount: num(row.amount) },
          })
        } else {
          await recordAudit(this.prisma, {
            actorId: null, action: 'trainer_discount.refund_after_settlement',
            entityType: 'trainer_profile', entityId: row.profileId,
            meta: { discountId: row.id, orderId, amount: num(row.amount), settledItemId: row.settledItemId },
            reason: 'خصمُ مدرّبٍ حُسم ثمّ رُدّ ثمنُ شرائه — يُعاد إليه بندا موجبا بيد المسؤول الماليّ',
          })
        }
      }
    } catch (e) {
      await recordAudit(this.prisma, {
        actorId: null, action: 'trainer_discount.used_failed',
        entityType: 'order', entityId: orderId,
        meta: { step: 'refund', error: e instanceof Error ? e.message : String(e) },
        reason: 'خصمُ مدرّبٍ رُدّ ثمنُ شرائه ولم يُقيَّد — تسويةٌ يدويّةٌ مطلوبة',
      }).catch(() => { /* الأثرُ نفسُه لا يُسقط ردّا وقع */ })
    }
  }

  /** الخصومُ المنتظرةُ للحسم — أقدمُ استعمالا أوّلا (وعلّةُ الترتيب في القواعد) */
  pendingFor(profileId: string) {
    return this.prisma.trainerIssuedDiscount.findMany({
      where: { profileId, status: 'used', settledItemId: null },
      orderBy: { usedAt: 'asc' },
    })
  }
}

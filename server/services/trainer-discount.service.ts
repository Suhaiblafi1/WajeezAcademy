/* خصومُ المدرّب — إصدارُها وإلغاؤها وتسويتُها.

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
import { EarningsService } from './earnings.service'
import { LEDGER_CURRENCY } from '../../src/application/commerce/presentment'
import { randomUnambiguousCode } from '../../src/application/text/unambiguous-code'
import {
  discountBudget, issueBlockerAr, ISSUED_DISCOUNT_STATUS_AR, OUTSTANDING_STATUSES,
  type DiscountBudget,
} from '../../src/application/trainer/issued-discount'

/** رمزُ الخصم — `WD-` تمييزا عن رمز الدعوة `WJ-`.

    ولمَ بادئةٌ مختلفة: الرمزان يُنشران من الصفحة نفسِها («دعوتي»)، وأحدُهما
    رابطُ تسجيلٍ لا يخصم شيئا والآخرُ مالٌ من جيبه. فمن نسخ الخطأَ يراه في
    الحرف الثاني لا بعد أن يُردّ عند الدفع. و«D» من discount. */
function newDiscountCode(): string {
  return `WD-${randomUnambiguousCode(8)}`
}

const num = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0)

export class TrainerDiscountService {
  private prisma: PrismaClient
  private earnings: EarningsService

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.earnings = new EarningsService(prisma)
  }

  private async activeProfile(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId } })
    if (!profile || profile.suspendedAt) {
      throw new AuthError('not_trainer', 'لا ملف مدرب نشطا لهذا الحساب', 403)
    }
    return profile
  }

  /** رصيدُه القابل للخصم — ما له عندنا ناقصا ما أصدره ولم يُسوَّ.

      و«ما له عندنا» هو الأرقامُ المعروضةُ له في «مستحقّاتي» نفسِها: المنتظَرُ
      والمعتمَدُ والمتوقَّعُ من شعبه المفتوحة. ولا يُخترع هنا رقمٌ رابع —
      فرقمان لشيءٍ واحدٍ يفترقان يوما، ويقرأ المدرّبُ أحدَهما ويحسب على
      الآخر. والمدفوعُ ليس منه: مالٌ خرج إليه ولا يُحسم منه. */
  async budgetFor(userId: string): Promise<DiscountBudget> {
    const profile = await this.activeProfile(userId)
    const [mine, outstanding] = await Promise.all([
      this.earnings.listForTrainer(userId),
      this.prisma.trainerIssuedDiscount.aggregate({
        where: { profileId: profile.id, status: { in: [...OUTSTANDING_STATUSES] } },
        _sum: { amount: true },
      }),
    ])
    const projected = mine.cohorts.reduce((s, c) => s + (c.projected ?? 0), 0)
    return discountBudget({
      pending: mine.summary.pending,
      approved: mine.summary.approved,
      projected,
      outstanding: num(outstanding._sum.amount),
      currency: mine.summary.currency || LEDGER_CURRENCY,
    })
  }

  /** ما أصدره — أحدثُ أوّلا، ومعه رصيدُه فلا نداءان لشاشةٍ واحدة */
  async listFor(userId: string) {
    const profile = await this.activeProfile(userId)
    const [rows, budget] = await Promise.all([
      this.prisma.trainerIssuedDiscount.findMany({
        where: { profileId: profile.id },
        include: { coupon: { select: { code: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.budgetFor(userId),
    ])
    return {
      budget,
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

  /** الإصدار — كوبونٌ يفعل الخصمَ، وصفٌّ يقول من يتحمّله */
  async issue(userId: string, input: { amount: number; forWhomAr: string; noteAr?: string; expiresAt?: Date }) {
    const profile = await this.activeProfile(userId)
    const forWhom = input.forWhomAr.trim()
    if (forWhom.length < 2) {
      throw new AuthError('no_recipient', 'اكتب لمن هذا الخصم — يُطبع في كشفك لتعرف بعد شهرين عمّن حُسم', 400)
    }
    const budget = await this.budgetFor(userId)
    const blocker = issueBlockerAr(input.amount, budget)
    if (blocker) throw new AuthError('bad_amount', blocker, 400)
    if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
      throw new AuthError('bad_expiry', 'تاريخُ الانتهاء في الماضي', 400)
    }

    /* ═══ اصطدامُ الرمز يُعاد لا يُردّ ═══

       الرمزُ عشوائيٌّ من اثنين وثلاثين حرفا في ثمانية مواضع، والاصطدامُ
       بعيدٌ ولا يُعتمَد على بُعده: خطأُ فرادةٍ يصل المدرّبَ «تعذّر الحفظ»
       بلا سبب. ومحاولاتٌ ثلاثٌ تكفي لاحتمالٍ كهذا. */
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const code = newDiscountCode()
      try {
        return await this.prisma.$transaction(async (tx) => {
          const coupon = await tx.coupon.create({
            data: {
              code,
              amountOff: input.amount,
              currency: budget.currency,
              /* مرّةٌ واحدة: أصدره لشخصٍ بعينه، لا حملةً تُنشر */
              maxUses: 1,
              expiresAt: input.expiresAt ?? null,
              active: true,
            },
          })
          const row = await tx.trainerIssuedDiscount.create({
            data: {
              profileId: profile.id, couponId: coupon.id,
              amount: input.amount, currency: budget.currency,
              forWhomAr: forWhom, noteAr: input.noteAr?.trim() || null,
              expiresAt: input.expiresAt ?? null,
            },
          })
          await recordAudit(tx, {
            actorId: userId, action: 'trainer_discount.issue',
            entityType: 'trainer_profile', entityId: profile.id,
            meta: { discountId: row.id, code, amount: input.amount, currency: budget.currency, forWhom },
          })
          return { id: row.id, code, amount: input.amount, currency: budget.currency }
        })
      } catch (e) {
        if (attempt === 2 || !isUniqueViolation(e)) throw e
      }
    }
    throw new AuthError('code_conflict', 'تعذّر سكُّ رمزٍ فريد — أعِد المحاولة', 409)
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

  /* ═══ وطلبٌ هُجر يحرق الرمزَ ولا يحسم شيئا ═══

     `usedCount` على الكوبون يزيد عند **إنشاء** الطلب لا عند دفعه — وذاك
     سلوكُ الكوبونات القائمُ في هذه المنصّة، تشترك فيه أكوادُ الحملات
     وكوبوناتُ المستشارين. فمن بدأ شراءً برمزِ مدرّبٍ ثمّ هجره: الرمزُ
     استُنفد (`maxUses: 1`) والخصمُ ما زال `live`.

     والاتّجاهُ آمنٌ في الجهة التي تهمّ: **لا يُحسم من المدرّب شيء**. وما
     يخسره رمزٌ لا ينفع، وبابُه مفتوح — يُلغيه فيسترجع رصيدَه ويُصدر غيرَه.
     وتغييرُ لحظةِ العدّ يمسّ مسارَ الشراء كلَّه، وهو أوسعُ من هذا الباب. */

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

  /** الخصومُ المنتظرةُ للحسم — أقدمُ استعمالا أوّلا (وعلّةُ الترتيب في القواعد) */
  pendingFor(profileId: string) {
    return this.prisma.trainerIssuedDiscount.findMany({
      where: { profileId, status: 'used', settledItemId: null },
      orderBy: { usedAt: 'asc' },
    })
  }
}

/** خطأُ فرادةٍ من Prisma — بلا استيراد نوعٍ من زمن التشغيل */
function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2002'
}

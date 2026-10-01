/* أكوادُ المدرّب — إصدارُها وإيقافُها وإلغاؤها، وقبولُ البند 4-10 بصيغته الجديدة.

   ═══ القرار ═══

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «اصدار كود وليس خصم مباشر، والخصم
   يكون نسبة وليس رقما، ويعطي الخصم لمن يريد ليضعه في خانة الكودات» — وسقفُه
   ٣٠٪ على دوراته وحدَها. والقواعدُ في `src/application/trainer/trainer-code.ts`،
   ودفترُ الاستعمال (يُحجز · يُدفع · يُفرَج عنه · يُردّ) في
   `commerce/coupon-ledger.ts`، والحسمُ في `earnings.service`. وهنا البابُ وحدَه.

   ═══ ولا يُصدَر كودٌ بلا سندٍ في عقده ═══

   البند 4-6: «لا تجري الأكاديمية أي حسم من أتعاب استحقت للمدرب… إلا ما نص عليه
   البندان 4-10 و6-4». ومن وقّع قبل الجيل الثالث عشر وقّع 4-10 على «مبلغٍ معلومٍ
   لا نسبة» — فحسمُ نسبةٍ من مستحقّاته حسمٌ لا يسنده عقدُه. فيُعرض عليه البندُ
   بصيغته الجديدة، بنصّه كما في العقد، ويقبله مرّةً واحدة قبل أوّل كود.

   ═══ ولمَ لا رصيدَ على الكود كما كان على المبلغ ═══

   الخصمُ بالمبلغ كان يُحسب رصيدُه عند الإصدار: مبلغٌ معلومٌ مرّةً واحدة. والكودُ
   يُنشَر فلا يُعرف عند إصداره كم يُستعمل ولا على أيّ سعر. وما يحمي المدرّبَ
   هنا ثلاثة: حدُّ الاستعمالات الذي يختاره، والإيقافُ في أيّ لحظة، وسقفُ البند
   (لا يتجاوز الحسمُ كشفا، ولا يصير دَينا). */

import type { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { randomUnambiguousCode } from '../../src/application/text/unambiguous-code'
import {
  CODE_TERMS_VERSION, codeBlockerAr, codeStateAr, contractCarriesCodeTerms,
} from '../../src/application/trainer/trainer-code'
import { CLAUSE_4_10_AR } from '../../src/application/trainer/contract-body'
import { TrainerCodeBudgetService } from './trainer-code-budget'
import { LEDGER_CURRENCY } from '../../src/application/commerce/presentment'

/** رمزُ الكود — `WD-` كالخصم قبله: الرمزان يُنشران من «دعوتي» بجانب رابط الدعوة
    `WJ-`، وأحدُهما مالٌ من جيبه والآخرُ رابطُ تسجيل. فمن نسخ الخطأَ يراه في
    الحرف الثاني. */
function newCode(): string {
  return `WD-${randomUnambiguousCode(8)}`
}

const num = (d: unknown) => Number(d ?? 0)
const round2 = (n: number) => Math.round(n * 100) / 100

export class TrainerCodeService {
  private prisma: PrismaClient
  private budgets: TrainerCodeBudgetService

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.budgets = new TrainerCodeBudgetService(prisma)
  }

  private async activeProfile(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId } })
    if (!profile || profile.suspendedAt) {
      throw new AuthError('not_trainer', 'لا ملف مدرب نشطا لهذا الحساب', 403)
    }
    return profile
  }

  /** أقَبِل البندَ 4-10 بصيغته الجديدة؟ — بعقدٍ من الجيل الذي حمله، أو بقبولٍ مرّةً واحدة.

      ═══ وكلُّ عقدٍ قائمٍ عليه توقيعُه — لا `signed` وحدَها (١ أكتوبر ٢٠٢٦) ═══

      كان الشرطُ `status: 'signed'`: وقّع وينتظر اعتمادَنا. فمن اعتمدنا عقدَه
      (`countersigned`) — وهو كلُّ مدرّبٍ نشطٍ يُصدر كودا من «دعوتي» — لا يُعدّ
      عقدُه قبولا، ويُطلب منه أن يقبل البندَ ثانيةً وهو موقَّعٌ في عقده. والسؤالُ
      هنا «أوقّع نصّا يحمله؟»، وجوابُه في كلّ عقدٍ قائمٍ وقّعه: ينتظر اعتمادَنا،
      أو اعتمدنا توقيعَه، أو نفذ. والمنتهي (مفسوخٌ أو أُزيح) لا يُعدّ: بابُه أُغلق. */
  async termsFor(profileId: string, userId: string) {
    const [contracts, consent] = await Promise.all([
      this.prisma.trainerContract.findMany({
        where: { profileId, status: { in: ['signed', 'signature_approved', 'countersigned'] } },
        select: { bodyVersion: true },
      }),
      this.prisma.consentRecord.findFirst({
        where: { userId, kind: 'terms', textVersion: CODE_TERMS_VERSION, revokedAt: null },
        orderBy: { grantedAt: 'desc' },
      }),
    ])
    const viaContract = contracts.some((c) => contractCarriesCodeTerms(c.bodyVersion))
    return {
      accepted: viaContract || consent !== null,
      via: viaContract ? ('contract' as const) : consent ? ('consent' as const) : null,
      acceptedAt: consent?.grantedAt ?? null,
      version: CODE_TERMS_VERSION,
      /* البندُ بنصّه كما يُطبع في العقد — من الثابت نفسِه، فلا يقبل غيرَ ما يُطبع */
      clauseAr: CLAUSE_4_10_AR,
    }
  }

  /** يقبل البندَ بصيغته الجديدة — مرّةً واحدة، ويُحفظ الإصدارُ ونصُّه في الأثر */
  async acceptTerms(userId: string, ip?: string) {
    const profile = await this.activeProfile(userId)
    const terms = await this.termsFor(profile.id, userId)
    if (terms.accepted) return terms
    const consent = await this.prisma.consentRecord.create({
      data: { userId, kind: 'terms', textVersion: CODE_TERMS_VERSION, ip: ip ?? null },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer_code.terms_accept',
      entityType: 'trainer_profile', entityId: profile.id, ip,
      /* النصُّ نفسُه لا مفتاحُه: من سُئل «بأيّ نصٍّ أقرّ؟» يُجاب من هنا لا من تاريخ Git */
      meta: {
        consentId: consent.id, version: CODE_TERMS_VERSION,
        clauseSha256: createHash('sha256').update(CLAUSE_4_10_AR).digest('hex'),
        clauseAr: CLAUSE_4_10_AR,
      },
    })
    return this.termsFor(profile.id, userId)
  }

  /** أكوادُه — أحدثُ أوّلا، وما استُعمل منها وما حُسم، والبندُ وقبولُه */
  async listFor(userId: string) {
    const profile = await this.activeProfile(userId)
    const [rows, terms, budget, pricing] = await Promise.all([
      this.prisma.trainerCode.findMany({
        where: { profileId: profile.id },
        include: {
          coupon: { select: { code: true, maxUses: true, usedCount: true, expiresAt: true } },
          redemptions: { select: { status: true, amount: true, owed: true, pending: true, currency: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.termsFor(profile.id, userId),
      /* رصيدُه الذي تقع عليه أكوادُه — يُقرأ قبل أن يُفاجأ بكودٍ لم يقع */
      this.budgets.budgetFor(profile.id),
      /* ودوراتُه بأسعارها وأجرِ مقعده — ليرى قيمةَ كوده قبل أن يُصدره (البند 4-10) */
      this.budgets.pricingFor(profile.id),
    ])
    const now = new Date()
    return {
      terms,
      budget,
      pricing,
      codes: rows.map((c) => {
        const paid = c.redemptions.filter((r) => r.status === 'paid' || r.status === 'refunded')
        const state = codeStateAr({ status: c.status, expiresAt: c.coupon.expiresAt, maxUses: c.coupon.maxUses, usedCount: c.coupon.usedCount }, now)
        return {
          id: c.id,
          code: c.coupon.code,
          percentOff: c.percentOff,
          amountOff: c.amountOff === null ? null : num(c.amountOff),
          labelAr: c.labelAr,
          status: c.status,
          state: state.key,
          stateAr: state.labelAr,
          maxUses: c.coupon.maxUses,
          usedCount: c.coupon.usedCount,
          expiresAt: c.coupon.expiresAt,
          createdAt: c.createdAt,
          /* ما يُحسم منه بسببه: ما عليه كلُّه، وما لم يُحسم بعد منه */
          uses: {
            paid: c.redemptions.filter((r) => r.status === 'paid').length,
            held: c.redemptions.filter((r) => r.status === 'held').length,
            refunded: c.redemptions.filter((r) => r.status === 'refunded').length,
          },
          owed: round2(paid.reduce((s, r) => s + num(r.owed), 0)),
          pending: round2(paid.reduce((s, r) => s + num(r.pending), 0)),
          /* وبها يُطبع وجهُ الكود حين يكون مبلغا — وهو بعملة الدفتر أبدا */
          currency: c.redemptions[0]?.currency ?? LEDGER_CURRENCY,
        }
      }),
    }
  }

  /** الإصدار — كوبونٌ يفعل الخصم، وصفٌّ يقول من يتحمّله وبأيّ وجه: نسبةً أو مبلغا */
  async create(userId: string, input: {
    percentOff?: number | null; amountOff?: number | null
    labelAr: string; maxUses?: number | null; expiresAt?: Date | null
  }) {
    const profile = await this.activeProfile(userId)
    const terms = await this.termsFor(profile.id, userId)
    if (!terms.accepted) {
      throw new AuthError('terms_required', 'اقبل البندَ 4-10 بصيغته الجديدة أوّلا — به يُحسم من مستحقّاتك ما يمنحه كودُك', 403)
    }
    const blocker = codeBlockerAr(input)
    if (blocker) throw new AuthError('bad_code', blocker, 400)
    const labelAr = input.labelAr.trim()

    /* اصطدامُ الرمز يُعاد لا يُردّ — ثمانيةُ مواضعَ من اثنين وثلاثين حرفا */
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const code = newCode()
      try {
        return await this.prisma.$transaction(async (tx) => {
          /* والكوبونُ يحمل الوجهَ نفسَه كي لا يُقرأ بخلافه في شاشة الإدارة — والتسعيرُ
             يقرأ صفَّ الكود لا الكوبون، فالسقفُ هناك. والمبلغُ بعملة الدفتر. */
          const percentOff = input.percentOff ?? null
          const amountOff = input.amountOff ?? null
          const coupon = await tx.coupon.create({
            data: {
              code, percentOff, amountOff, currency: amountOff === null ? null : LEDGER_CURRENCY,
              maxUses: input.maxUses ?? null, expiresAt: input.expiresAt ?? null, active: true,
            },
          })
          const row = await tx.trainerCode.create({
            data: { profileId: profile.id, couponId: coupon.id, percentOff, amountOff, labelAr },
          })
          await recordAudit(tx, {
            actorId: userId, action: 'trainer_code.create',
            entityType: 'trainer_profile', entityId: profile.id,
            meta: { codeId: row.id, code, percentOff, amountOff, maxUses: input.maxUses ?? null, labelAr },
          })
          return { id: row.id, code, percentOff, amountOff }
        })
      } catch (e) {
        if (attempt === 2 || !isUniqueViolation(e)) throw e
      }
    }
    throw new AuthError('code_conflict', 'تعذّر سكُّ رمزٍ فريد — أعِد المحاولة', 409)
  }

  pause(userId: string, id: string) {
    return this.move(userId, id, ['live'], 'paused', 'trainer_code.pause', { active: false, stamp: 'pausedAt' })
  }

  resume(userId: string, id: string) {
    return this.move(userId, id, ['paused'], 'live', 'trainer_code.resume', { active: true, stamp: null })
  }

  /** الإلغاء — نهائيٌّ: لا يُستعمل بعده. وما دُفع بطلبٍ أُنشئ قبله يُحسب (البند 4-10):
      المشتري رأى السعرَ بالكود وضغط «ادفع»، فلا يُسحب منه بعد ذلك. */
  revoke(userId: string, id: string) {
    return this.move(userId, id, ['live', 'paused'], 'revoked', 'trainer_code.revoke', { active: false, stamp: 'revokedAt' })
  }

  private async move(
    userId: string, id: string, from: string[], to: string, action: string,
    effect: { active: boolean; stamp: 'pausedAt' | 'revokedAt' | null },
  ) {
    const profile = await this.activeProfile(userId)
    const row = await this.prisma.trainerCode.findUnique({ where: { id } })
    if (!row || row.profileId !== profile.id) throw new AuthError('not_found', 'لا كودَ بهذا المعرّف بين ما أصدرتَه', 404)
    if (!from.includes(row.status)) {
      throw new AuthError('bad_state', row.status === 'revoked' ? 'ألغيتَ هذا الكودَ من قبل' : 'لا يصحّ هذا على حاله الآن', 409)
    }
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.trainerCode.updateMany({
        where: { id, status: { in: from } },
        data: { status: to, ...(effect.stamp ? { [effect.stamp]: new Date() } : {}) },
      })
      if (moved.count === 0) throw new AuthError('bad_state', 'تبدّل حالُ الكود قبل هذا — حدّث الصفحة', 409)
      /* والكوبونُ يتبعه في المعاملة نفسِها: كودٌ «موقوفٌ» وكوبونٌ يعمل رمزٌ ما زال يخصم */
      await tx.coupon.update({ where: { id: row.couponId }, data: { active: effect.active } })
      await recordAudit(tx, {
        actorId: userId, action, entityType: 'trainer_profile', entityId: profile.id,
        meta: { codeId: id, from: row.status, to },
      })
    })
    return { ok: true, status: to }
  }
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2002'
}

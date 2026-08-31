/* ما لا يملكه المستشار وحده — خصمٌ وتعديلُ خطّة.

   دورُ المستشار مبيعاتٌ في وجهه الأوّل ومتابعةٌ أكاديمية في الثاني. وفي
   الوجهين يصطدم بحدٍّ: أن يُنزل سعرا ليُغلق بيعا، أو أن يضيف دورةً إلى
   خطّة طالبٍ أو يُلغيها. وكان ذلك يجري خارج المنصّة — برسالةٍ إلى الإدارة
   تُنسى ولا تُتتبَّع ولا تُدقَّق، ولا يُعرف بعد شهرٍ كم خصما أُعطي ولا لماذا.

   فصار طلبا: سببٌ إلزاميّ يُقرأ، وقرارٌ مسجَّل بصاحبه ووقته، وأثرٌ في
   سجلّ التدقيق. والخصمُ المعتمَد يُنتج كوبونا **مقصورا على ذلك العميل**
   ومرّةً واحدة — فلا يتسرّب رمزٌ أُعطي لواحدٍ فيستعمله مئة.

   وسقفُ النسبة خمسون: ما فوقها ليس خصما بل قرارُ تسعيرٍ تتّخذه الإدارة
   ابتداءً لا تعتمده لمستشار. */

import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

export const REQUEST_KINDS = ['discount', 'plan_add', 'plan_remove'] as const
export type RequestKind = (typeof REQUEST_KINDS)[number]

export const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const

/** أقلُّ سببٍ يُقرأ — أقصرُ منه لا يقول شيئا لمن يقرّر */
export const MIN_REASON_CHARS = 12
/** أعلى نسبةٍ يطلبها مستشار — ما فوقها قرارُ تسعير */
export const MAX_PERCENT_OFF = 50

export interface SubmitInput {
  kind: RequestKind
  percentOff?: number
  amountOff?: number
  currency?: string
  courseId?: string
  reasonAr: string
}

/** رمزُ كوبونٍ مقروء: حروفٌ لا تلتبس، ولا يُخمَّن */
function couponCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = 'ADV-'
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export class AdvisorRequestService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  private async assertAssigned(advisorId: string, caseId: string) {
    const link = await this.prisma.advisorAssignment.findFirst({
      where: { caseId, advisorId, unassignedAt: null },
    })
    if (!link) throw new AuthError('not_assigned', 'هذه الحالة ليست مسندة إليك', 403)
  }

  /* ─────────── الرفع ─────────── */

  async submit(advisorId: string, caseId: string, input: SubmitInput) {
    await this.assertAssigned(advisorId, caseId)

    if (!REQUEST_KINDS.includes(input.kind)) {
      throw new AuthError('bad_kind', 'نوع طلبٍ غير معروف')
    }
    const reason = (input.reasonAr ?? '').trim()
    if (reason.length < MIN_REASON_CHARS) {
      throw new AuthError('reason_required', `اكتب سبب الطلب — ${MIN_REASON_CHARS} حرفا على الأقل`)
    }

    if (input.kind === 'discount') {
      const hasPercent = typeof input.percentOff === 'number'
      const hasAmount = typeof input.amountOff === 'number'
      if (!hasPercent && !hasAmount) {
        throw new AuthError('amount_required', 'حدّد نسبة الخصم أو مبلغه')
      }
      if (hasPercent && hasAmount) {
        throw new AuthError('amount_ambiguous', 'نسبةٌ أو مبلغ — لا كلاهما')
      }
      if (hasPercent && (input.percentOff! < 1 || input.percentOff! > MAX_PERCENT_OFF)) {
        throw new AuthError('percent_out_of_range', `النسبة بين ١ و${MAX_PERCENT_OFF} — ما فوقها قرار إدارة لا طلب مستشار`)
      }
      if (hasAmount) {
        if (input.amountOff! <= 0) throw new AuthError('amount_out_of_range', 'المبلغ أكبر من صفر')
        if (!input.currency) throw new AuthError('currency_required', 'حدّد العملة مع المبلغ')
      }
    } else {
      if (!input.courseId?.trim()) {
        throw new AuthError('course_required', 'حدّد الدورة المطلوب إضافتها أو إلغاؤها')
      }
    }

    const created = await this.prisma.advisorRequest.create({
      data: {
        caseId, advisorId, kind: input.kind, reasonAr: reason,
        percentOff: input.kind === 'discount' ? input.percentOff ?? null : null,
        amountOff: input.kind === 'discount' && typeof input.amountOff === 'number'
          ? new Prisma.Decimal(input.amountOff) : null,
        currency: input.kind === 'discount' ? input.currency ?? null : null,
        courseId: input.kind === 'discount' ? null : input.courseId!.trim(),
      },
    })

    await recordAudit(this.prisma, {
      actorId: advisorId, action: 'advisor.request.submit',
      entityType: 'advisor_request', entityId: created.id,
      meta: { caseId, kind: input.kind },
    })
    return created
  }

  /** المستشار يسحب طلبه المعلّق — ولا يمسّ طلب غيره */
  async cancel(advisorId: string, requestId: string) {
    const r = await this.prisma.advisorRequest.findUnique({ where: { id: requestId } })
    if (!r) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (r.advisorId !== advisorId) throw new AuthError('not_owner', 'هذا ليس طلبك', 403)
    if (r.status !== 'pending') throw new AuthError('not_pending', 'الطلب بُتّ فيه فلا يُسحب')

    const out = await this.prisma.advisorRequest.update({
      where: { id: requestId }, data: { status: 'cancelled' },
    })
    await recordAudit(this.prisma, {
      actorId: advisorId, action: 'advisor.request.cancel',
      entityType: 'advisor_request', entityId: requestId, meta: {},
    })
    return out
  }

  /* ─────────── القراءة ─────────── */

  async byCase(advisorId: string, caseId: string) {
    await this.assertAssigned(advisorId, caseId)
    return this.prisma.advisorRequest.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      include: { decidedBy: { select: { displayName: true } }, coupon: { select: { code: true } } },
    })
  }

  /** طابورُ الإدارة — ما ينتظر قرارا، أقدمُه أوّلا */
  async pending() {
    return this.prisma.advisorRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: {
        advisor: { select: { displayName: true, email: true } },
        case: {
          select: {
            id: true, status: true,
            client: { select: { id: true, displayName: true, email: true } },
            lead: { select: { fullName: true, email: true } },
          },
        },
      },
    })
  }

  /* ─────────── القرار ─────────── */

  async decide(
    requestId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected',
    noteAr?: string,
  ) {
    const r = await this.prisma.advisorRequest.findUnique({
      where: { id: requestId },
      include: { case: { select: { clientId: true } } },
    })
    if (!r) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (r.status !== 'pending') throw new AuthError('not_pending', 'بُتّ في هذا الطلب من قبل')

    /* من رفع الطلب لا يعتمده — ولو ملك الصلاحيتين */
    if (r.advisorId === reviewerId) {
      throw new AuthError('self_review', 'لا تبتّ في طلبك — يعتمده غيرك', 403)
    }

    const note = (noteAr ?? '').trim()
    /* الرفضُ يلزمه سبب: المستشار يقرأ لماذا رُفض فلا يعيد الطلب نفسه */
    if (decision === 'rejected' && note.length < MIN_REASON_CHARS) {
      throw new AuthError('reason_required', `اكتب سبب الرفض — ${MIN_REASON_CHARS} حرفا على الأقل`)
    }

    let couponId: string | null = null
    if (decision === 'approved' && r.kind === 'discount') {
      /* الكوبون مقصورٌ على العميل ومرّةً واحدة — وبلا حسابٍ للعميل لا كوبون:
         الخصمُ يُطبَّق على فاتورةٍ لصاحب حساب، ومن لم يسجّل بعدُ يُعتمد له
         الطلبُ ويُولَّد كوبونُه حين يصير له حساب. */
      if (!r.case.clientId) {
        throw new AuthError('client_required', 'لا حساب للعميل بعد — لا يمكن إصدار كوبون مقصور عليه')
      }
      const coupon = await this.prisma.coupon.create({
        data: {
          code: couponCode(),
          percentOff: r.percentOff ?? null,
          amountOff: r.amountOff ?? null,
          currency: r.currency ?? null,
          maxUses: 1,
          restrictedToUserId: r.case.clientId,
          /* شهرٌ يكفي لإغلاق البيع، ولا يترك خصما مفتوحا إلى الأبد */
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
      couponId = coupon.id
    }

    const out = await this.prisma.advisorRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        decidedById: reviewerId,
        decidedAt: new Date(),
        decisionNoteAr: note || null,
        couponId,
      },
    })

    await recordAudit(this.prisma, {
      actorId: reviewerId, action: `advisor.request.${decision}`,
      entityType: 'advisor_request', entityId: requestId,
      meta: { kind: r.kind, couponId },
    })
    return out
  }
}

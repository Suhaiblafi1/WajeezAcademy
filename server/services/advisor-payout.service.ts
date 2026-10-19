/* كشوفُ عمولة المستشار الشهريّة (١٩ أكتوبر ٢٠٢٦).

   ═══ العطب ═══

   كانت «العمولة المستحقة» كلَّ ما كسبه المستشارُ منذ بدأ: لا يُكتب ما صُرف له، فلا ينقص
   الرقمُ بعد الدفع. والمدرّبُ له كشوفٌ تُعتمد ثمّ تُصرف، والمستشارُ لا شيء.

   ═══ القرار ═══

   قرارُ صاحب المنصّة بين ثلاثة (كشوفٌ شهريّةٌ كالمدرّبين · تسجيلُ ما يُدفع · يبقى كما هو):
   **«A» — كشوفٌ شهريّةٌ كالمدرّبين.**

   ═══ كيف يُبنى الكشف ═══

   ١) **لكلّ مستشارٍ كشفٌ للشهر** — بعد انتهائه، يولّده العاملُ كلَّ يوم (`advisor_payouts`)
      أو الماليّةُ بيدها. وكشفٌ حيٌّ واحدٌ للشهر (`AdvisorPayout_one_live_per_period`).
   ٢) **بندٌ لكلّ دفعةٍ دفعها طالبُه وهو عنده** — بحساب النوبات نفسِه (`attributedOrders`)،
      وبنسبته يومَ وُلّد الكشف. ولا تدخل دفعةٌ كشفين (`AdvisorPayoutItem_commission_once`).
   ٣) **وكلُّ ما لم يدخل كشفا بعدُ يدخل التالي** — فمن تأخّرت نسبتُه، أو أُلغي كشفُه، لا يضيع
      ما له: يُحسب في أوّل كشفٍ بعده.
   ٤) **والاستردادُ بندٌ سالبٌ بوقته** — لا يُعاد كشفٌ دُفع. ما رُدّ من دفعةٍ يُحسم بالنسبة التي
      قُبضت بها، في الكشف الذي يقع فيه الاسترداد.
   ٥) **وكشفٌ صافيه صفرٌ أو أقلّ لا يُولَّد** — حسمُه ينتظر عمولةً تغطّيه، كما يُحسم من المدرّب.

   ═══ ودورتُه كالمدرّب ═══

   ينتظر الاعتماد ← معتمد ← صرف، أو يُلغى قبل الصرف بسبب. والصرفُ نهائيّ. ومن ألغى كشفا
   عادت دفعاتُه إلى ما يُحسب، فيُولَّد من جديدٍ بالنسبة يومَها. ولا يعتمد أحدٌ كشفَه بنفسه.

   ولا مهلةَ اعتراضٍ ولا كشفَ حساب بنكيّ: تلك بنودُ عقد المدرّب، وليس للمستشار عقدٌ بها.
   فالمرجعُ عند الصرف نصٌّ يكتبه من صرف (رقمُ الحوالة)، والمستشارُ يرى الكشفَ من ساعة يولد.

   والحارس: `server/tests/advisors/advisor-payouts.test.ts`. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { attributedOrders } from './advisor.service'
import { safeNotify } from './notification.service'
import { LEDGER_CURRENCY } from '../../src/application/commerce/presentment'
import { fmtDate, fmtMoney } from '../../src/application/text/format-ar'
import { periodAr } from '../../src/application/advisor/payout'

type Tx = Prisma.TransactionClient

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const TEMPLATE = 'advisor_payout'
const round2 = (n: number) => Math.round(n * 100) / 100

/** أوّلُ لحظةٍ بعد الشهر — بتوقيت UTC كما تُحسب كشوفُ المدرّب */
export function periodEnd(period: string): Date {
  const [y, m] = period.split('-').map(Number)
  return new Date(Date.UTC(y!, m!, 1))
}

/** الشهرُ الذي انتهى قبل `now` */
export function lastClosedPeriod(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7)
}

export interface PlannedItem {
  kind: 'commission' | 'refund'
  orderId: string
  refundId: string | null
  base: number
  amount: number
  descriptionAr: string
}

/** ما وقع قبل `until` ولم يدخل كشفا حيّا بعدُ: عمولةُ كلّ دفعة، وحسمُ كلّ استردادٍ منها */
export async function planItems(prisma: PrismaClient, advisorId: string, pct: number, until: Date): Promise<PlannedItem[]> {
  const orders = (await attributedOrders(prisma, advisorId)).filter((o) => o.paidAt < until && o.total > 0)
  if (orders.length === 0) return []
  const live = await prisma.advisorPayoutItem.findMany({
    where: { advisorId, voidedAt: null }, select: { kind: true, orderId: true, refundId: true, base: true, amount: true },
  })
  const stated = new Map(live.filter((i) => i.kind === 'commission').map((i) => [i.orderId, i]))
  const statedRefunds = new Set(live.filter((i) => i.kind === 'refund').map((i) => i.refundId))
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(orders.map((o) => o.userId))] } }, select: { id: true, displayName: true },
  })
  const nameOf = (id: string) => users.find((u) => u.id === id)?.displayName ?? 'طالب'

  const items: PlannedItem[] = []
  for (const o of orders) {
    const prior = stated.get(o.id)
    /* الحسمُ بالنسبة التي قُبضت بها الدفعة، لا بنسبة اليوم */
    const rate = prior && Number(prior.base) > 0 ? Number(prior.amount) / Number(prior.base) : pct / 100
    if (!prior) {
      items.push({
        kind: 'commission', orderId: o.id, refundId: null, base: o.total, amount: round2(o.total * rate),
        descriptionAr: `دفعة ${nameOf(o.userId)} — ${fmtDate(o.paidAt)}`,
      })
    }
    for (const r of o.refunds) {
      if (r.processedAt >= until || statedRefunds.has(r.id)) continue
      items.push({
        kind: 'refund', orderId: o.id, refundId: r.id, base: -r.amount, amount: -round2(r.amount * rate),
        descriptionAr: `استرداد من دفعة ${nameOf(o.userId)} — ${fmtDate(r.processedAt)}`,
      })
    }
  }
  return items
}

const sum = (xs: { amount: number | Prisma.Decimal }[]) => round2(xs.reduce((s, x) => s + Number(x.amount), 0))

export class AdvisorPayoutService {
  private readonly prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** كشوفُ الشهر لكلّ من له نسبة — ومن له كشفٌ حيٌّ للشهر يُتخطّى، فالدورتان معا لا تكرّران */
  async generate(period: string, actorId: string | null, now = new Date()): Promise<{ created: number }> {
    if (!PERIOD_RE.test(period)) throw new AuthError('bad_period', 'الشهر بصيغة 2026-09', 400)
    const until = periodEnd(period)
    if (until > now) throw new AuthError('period_open', 'الشهر لم ينته بعد', 409)

    const profiles = await this.prisma.advisorProfile.findMany({
      where: { commissionPct: { gt: 0 } }, select: { userId: true, commissionPct: true },
    })
    let created = 0
    for (const { userId: advisorId, commissionPct } of profiles) {
      const live = await this.prisma.advisorPayout.findFirst({ where: { advisorId, period, status: { not: 'cancelled' } } })
      if (live) continue
      const pct = Number(commissionPct)
      const items = await planItems(this.prisma, advisorId, pct, until)
      const total = sum(items)
      if (items.length === 0 || total <= 0) continue
      let payoutId: string
      try {
        payoutId = await this.prisma.$transaction(async (tx) => {
          const p = await tx.advisorPayout.create({
            data: {
              advisorId, period, commissionPct: pct, total, currency: LEDGER_CURRENCY,
              items: { create: items.map((i) => ({ ...i, advisorId })) },
            },
          })
          await recordAudit(tx, {
            actorId, action: 'advisor_payout.generate', entityType: 'advisor_payout', entityId: p.id,
            meta: { advisorId, period, total, items: items.length },
          })
          return p.id
        })
      } catch (e) {
        /* دورةٌ أخرى سبقته إلى الكشف أو إلى دفعةٍ فيه — فالفهرسُ الفريدُ ردّه */
        if ((e as { code?: string }).code === 'P2002') continue
        throw e
      }
      created++
      await this.notify(advisorId, payoutId, 'كشف عمولة جديد', `كشف ${periodAr(period)}: ${fmtMoney(total)}. ينتظر الاعتماد.`)
    }
    return { created }
  }

  async approve(id: string, actorId: string) {
    const p = await this.transition(id, actorId, ['pending'], 'approved', { approvedBy: actorId, approvedAt: new Date() },
      (tx, before) => recordAudit(tx, {
        actorId, action: 'advisor_payout.approve', entityType: 'advisor_payout', entityId: id,
        meta: { from: before.status, to: 'approved', period: before.period, total: Number(before.total) },
      }))
    await this.notify(p.advisorId, id, 'اعتمد كشف عمولتك', `كشف ${periodAr(p.period)}: ${fmtMoney(Number(p.total))}. يصرف قريبا.`)
  }

  async markPaid(id: string, actorId: string, refAr?: string | null) {
    const ref = refAr?.trim() || null
    const p = await this.transition(id, actorId, ['approved'], 'paid', { paidBy: actorId, paidAt: new Date(), paidRefAr: ref },
      (tx, before) => recordAudit(tx, {
        actorId, action: 'advisor_payout.pay', entityType: 'advisor_payout', entityId: id,
        meta: { from: before.status, to: 'paid', period: before.period, total: Number(before.total), ref },
      }))
    await this.notify(p.advisorId, id, 'صرفت عمولتك',
      `كشف ${periodAr(p.period)}: ${fmtMoney(Number(p.total))}${ref ? ` — مرجع الحوالة ${ref}` : ''}.`)
  }

  /** يُلغى قبل الصرف وحدَه — وتعود دفعاتُه إلى ما يُحسب في الكشف التالي */
  async cancel(id: string, actorId: string, reasonAr: string) {
    const reason = reasonAr.trim()
    if (reason.length < 5) throw new AuthError('bad_reason', 'اكتب سبب الإلغاء — خمسة أحرف على الأقل', 400)
    const p = await this.transition(id, actorId, ['pending', 'approved'], 'cancelled', { cancelReasonAr: reason },
      async (tx, before) => {
        await tx.advisorPayoutItem.updateMany({ where: { payoutId: id, voidedAt: null }, data: { voidedAt: new Date() } })
        await recordAudit(tx, {
          actorId, action: 'advisor_payout.cancel', entityType: 'advisor_payout', entityId: id, reason,
          meta: { from: before.status, to: 'cancelled', period: before.period, total: Number(before.total) },
        })
      })
    await this.notify(p.advisorId, id, 'ألغي كشف عمولتك', `كشف ${periodAr(p.period)}: ${reason}. تعود دفعاته إلى الكشف التالي.`)
  }

  /** انتقالٌ مشروطٌ بحاله — فضغطتان معا لا تعتمدان مرّتين، ولا يُصرف ملغى */
  private async transition(
    id: string, actorId: string, from: string[], to: string, data: Prisma.AdvisorPayoutUpdateManyMutationInput,
    side: (tx: Tx, before: { status: string; period: string; total: Prisma.Decimal }) => Promise<unknown>,
  ) {
    const before = await this.prisma.advisorPayout.findUnique({ where: { id } })
    if (!before) throw new AuthError('unknown_payout', 'الكشف غير موجود', 404)
    if (before.advisorId === actorId) throw new AuthError('own_payout', 'لا تعتمد كشفك ولا تصرفه بنفسك', 403)
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.advisorPayout.updateMany({ where: { id, status: { in: from } }, data: { status: to, ...data } })
      if (count === 0) throw new AuthError('bad_transition', 'تغيرت حالة الكشف. أعد تحميل الصفحة', 409)
      await side(tx, before)
    })
    return before
  }

  private notify(advisorId: string, payoutId: string, title: string, body: string) {
    return safeNotify(this.prisma, {
      userId: advisorId, channel: 'in_app', audience: 'staff', templateKey: TEMPLATE, title, body, data: { payoutId },
    })
  }

  /** ما صُرف، وما ينتظر في كشف، وما لم يدخل كشفا بعدُ — لمستشارٍ واحد */
  async summaryFor(advisorId: string, now = new Date()) {
    const [profile, payouts] = await Promise.all([
      this.prisma.advisorProfile.findUnique({ where: { userId: advisorId }, select: { commissionPct: true } }),
      this.prisma.advisorPayout.findMany({ where: { advisorId, status: { not: 'cancelled' } }, select: { status: true, total: true } }),
    ])
    const pct = profile ? Number(profile.commissionPct) : 0
    const upcoming = pct > 0 ? sum(await planItems(this.prisma, advisorId, pct, now)) : 0
    const paid = sum(payouts.filter((p) => p.status === 'paid').map((p) => ({ amount: p.total })))
    const awaiting = sum(payouts.filter((p) => p.status !== 'paid').map((p) => ({ amount: p.total })))
    return { paid, awaiting, upcoming, owed: round2(awaiting + upcoming), currency: LEDGER_CURRENCY }
  }

  /** كشوفُه ببنودها — للمستشار نفسِه */
  async listForAdvisor(advisorId: string) {
    const payouts = await this.prisma.advisorPayout.findMany({
      where: { advisorId }, include: { items: { orderBy: { descriptionAr: 'asc' } } }, orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
    })
    return payouts.map(view)
  }

  /** كلُّ الكشوف — لمن يصرف */
  async listAll(filter: { status?: string } = {}) {
    if (filter.status && !['pending', 'approved', 'paid', 'cancelled'].includes(filter.status)) {
      throw new AuthError('bad_status', 'حالة غير معروفة', 400)
    }
    const payouts = await this.prisma.advisorPayout.findMany({
      where: filter.status ? { status: filter.status } : {},
      include: { items: { orderBy: { descriptionAr: 'asc' } }, advisor: { select: { displayName: true } } },
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    })
    return payouts.map((p) => ({ ...view(p), advisorName: p.advisor.displayName }))
  }

  /** صفٌّ لكلّ مستشارٍ له نسبةٌ أو كشف — ما صُرف وما ينتظر وما لم يدخل كشفا */
  async summaries(now = new Date()) {
    const advisors = await this.prisma.user.findMany({
      where: { OR: [{ advisorProfile: { commissionPct: { gt: 0 } } }, { advisorPayouts: { some: {} } }] },
      select: { id: true, displayName: true, advisorProfile: { select: { commissionPct: true } } },
      orderBy: { displayName: 'asc' },
    })
    return Promise.all(advisors.map(async (a) => ({
      advisorId: a.id, name: a.displayName,
      commissionPct: a.advisorProfile ? Number(a.advisorProfile.commissionPct) : null,
      ...(await this.summaryFor(a.id, now)),
    })))
  }
}

function view(p: Prisma.AdvisorPayoutGetPayload<{ include: { items: true } }>) {
  return {
    id: p.id, period: p.period, periodAr: periodAr(p.period), status: p.status,
    commissionPct: Number(p.commissionPct), total: Number(p.total), currency: p.currency,
    approvedAt: p.approvedAt, paidAt: p.paidAt, paidRefAr: p.paidRefAr, cancelReasonAr: p.cancelReasonAr, createdAt: p.createdAt,
    items: p.items.map((i) => ({ id: i.id, kind: i.kind, descriptionAr: i.descriptionAr, base: Number(i.base), amount: Number(i.amount), voided: i.voidedAt !== null })),
  }
}

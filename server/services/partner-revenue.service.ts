/* حصّةُ الشريك من الإيراد — كشفُه، ولوحةُ ممثّله، وما صُرف له (١٦ نوفمبر ٢٠٢٦).

   ═══ القرار ═══

   قال صاحبُ المنصّة: «نبني اتفاقيّةَ تقاسم إيرادٍ مع الجامعة: تنشر رابطَ منحتها لطلابها وموظّفيها ونتقاسم الربح، ولها لوحةٌ
   تُدقَّق فيها من سجّل ومن دفع وكم لها قبل أجور المدرّبين». وخُيّر في أساس الحصّة فاختار **«% of what the student paid»**:
   نسبةٌ ممّا دفعه المستفيدُ فعلا بعد المنحة — لا من سعر القائمة كعمولة المؤثّر، ولا من الربح بعد الأجور. والنسبةُ **٥٠٪**،
   والخصمُ **٥٠٪** لشريكٍ جديد (`PARTNER_DEFAULTS`)، وكلاهما يُعدَّل لكلّ شريك.

   ═══ ما يقع ═══

   ١) **الحصّةُ تُكتب في كود المنحة يومَ يُعطى** (`GrantService.issue`) — فتغييرُها يقع على ما بعده، كنسبة المنحة. والشريكُ
      بلا حصّةٍ مكتوبةٍ لا يُحسب له شيء: لا مالَ لم يُتّفق عليه.
   ٢) **وتُحسب من الطلب لا تُقيَّد بيد** (`partnerShare`): على كلّ طلبٍ دُفع بكود منحةٍ من هذا الشريك — ولو أهداه صاحبُه
      لغيره، فالشريكُ هو من جاء بالكود أصلا. وما رُدّ من الثمن ينقص منها بنسبته، والمردودُ كلُّه بلا حصّة.
   ٣) **والرصيدُ ما استحقّه ناقصا ما صُرف له** — والصرفُ يُسجَّل بمبلغه وتاريخه ومن سجّله، بأثرٍ يسمّيه، وتحت قفلٍ للشريك
      كدفعات المؤثّر: فضغطتان معا لا تقرآن الرصيدَ نفسَه.
   ٤) **ولوحةُ الشريك تُدقَّق ولا تكشف**: من أكّد بريدَه باسمه الأوّل وبريده مختصرا (`maskEmail`)، وكلُّ طلبٍ بتاريخه ودوراته
      وما دُفع وما رُدّ وحصّته — ويُنزَّل كشفا (`csv`). ولا بياناتِ دفع.
   ٥) **وحسابُ ممثّله كحساب المؤثّر** (`attachAccount`): بريدٌ له حسابٌ يُضاف له دورُ الشريك، وجديدٌ يُنشأ مدعوّا يعيّن كلمتَه.
      وحسابٌ واحدٌ لكلّ شريك.

   والحارس: `server/tests/commerce/partner-revenue.test.ts`. */

import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { AuthError, AuthService } from './auth.service'
import { recordAudit } from './audit'
import { maskEmail } from './grant-landing.service'
import { sendStaffInviteEmail } from './account-mail'
import { publicSiteUrl } from './site-url'
import { enqueueMail } from './outbox.service'
import { PERMISSIONS, ROLE_NAMES_AR, ROLE_PERMISSIONS } from '../auth/permissions'
import { refundedShare } from '../../src/application/trainer/trainer-code'
import { LEDGER_CURRENCY } from '../../src/application/commerce/presentment'
import { buyerNameAr } from '../../src/application/commerce/influencer'
import { fmtMoney } from '../../src/application/text/format-ar'
import {
  partnerPagePath, partnerShare, partnerShareStateAr, partnerSlugOf, partnerTypeOf, PARTNER_TYPE_AR,
} from '../../src/application/commerce/partner-grant'

export const PARTNER_ROLE = 'partner'

/** ما تُحسب له حصّة: طلبٌ دُفع، ولو رُدّ بعضُه أو كلُّه — فيُقال ما رُدّ ولا يختفي الصفّ */
const SHARE_ORDERS = ['paid', 'partially_refunded', 'refunded']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const num = (d: unknown) => Number(d ?? 0)
const round2 = (n: number) => Math.round(n * 100) / 100

export class PartnerRevenueService {
  private prisma: PrismaClient
  private auth: AuthService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.auth = new AuthService(prisma)
  }

  private async partner(id: string) {
    const c = await this.prisma.grantCampaign.findFirst({
      where: { id, kind: 'partner' },
      include: { partnerUser: { select: { id: true, email: true, status: true } } },
    })
    if (!c) throw new AuthError('not_found', 'الشريك غير موجود', 404)
    return c
  }

  /** كشفُه: من أكّد بريدَه، ومن دفع، وحصّتُه عن كلّ طلب، وما صُرف له، والرصيد */
  async statement(id: string) {
    const c = await this.partner(id)
    const [leads, codes, payouts] = await Promise.all([
      this.prisma.lead.findMany({
        where: { campaign: c.slug, erasedAt: null }, orderBy: { createdAt: 'desc' },
        select: { id: true, fullName: true, email: true, createdAt: true, grantCode: { select: { id: true } } },
      }),
      this.prisma.grantCode.findMany({
        where: { campaignId: c.id },
        select: {
          partnerSharePercent: true,
          coupon: {
            select: {
              code: true,
              orders: {
                where: { status: { in: SHARE_ORDERS } },
                select: {
                  id: true, status: true, total: true, currency: true, paidAt: true, createdAt: true, userId: true,
                  user: { select: { displayName: true } },
                  items: { select: { id: true } },
                  invoice: { select: { payments: { where: { extra: false }, select: { amount: true, status: true, refunds: { where: { status: 'processed' }, select: { amount: true } } } } } },
                },
              },
            },
          },
        },
      }),
      this.prisma.partnerPayout.findMany({ where: { campaignId: c.id }, orderBy: { paidAt: 'desc' } }),
    ])
    const rows = codes.flatMap((g) => g.coupon.orders.map((o) => {
      const paidRows = (o.invoice?.payments ?? []).filter((p) => p.status !== 'pending' && p.status !== 'failed')
      const refunded = o.status === 'refunded' ? 1 : refundedShare(
        paidRows.reduce((s, p) => s + p.refunds.reduce((t, r) => t + num(r.amount), 0), 0),
        paidRows.reduce((s, p) => s + num(p.amount), 0),
      )
      const paid = num(o.total)
      const percent = g.partnerSharePercent ?? 0
      return {
        orderId: o.id, at: o.paidAt ?? o.createdAt, buyerAr: buyerNameAr(o.user.displayName), courses: o.items.length,
        paid, refunded: round2(paid * refunded), percent, share: partnerShare(paid, percent, refunded),
        stateAr: partnerShareStateAr(o.status), currency: o.currency,
      }
    })).sort((a, b) => b.at.getTime() - a.at.getTime())
    const earned = round2(rows.reduce((s, r) => s + r.share, 0))
    const paidOut = round2(payouts.reduce((s, p) => s + num(p.amount), 0))
    const buyers = new Set(codes.flatMap((g) => g.coupon.orders.filter((o) => o.status !== 'refunded').map((o) => o.userId))).size
    return {
      id: c.id, nameAr: c.nameAr, slug: partnerSlugOf(c.slug), type: partnerTypeOf(c.partnerType),
      sharePercent: c.partnerSharePercent, percentOff: c.percentOff, maxCourses: c.maxCourses,
      link: `${publicSiteUrl()}${partnerPagePath(partnerSlugOf(c.slug))}`,
      account: c.partnerUser ? { email: c.partnerUser.email, active: c.partnerUser.status === 'active' } : null,
      currency: LEDGER_CURRENCY,
      totals: {
        signups: leads.length, codes: leads.filter((l) => l.grantCode).length, buyers,
        sales: round2(rows.reduce((s, r) => s + (r.paid - r.refunded), 0)), earned, paidOut, balance: round2(earned - paidOut),
      },
      signups: leads.map((l) => ({
        nameAr: buyerNameAr(l.fullName), email: maskEmail(l.email ?? ''), at: l.createdAt, hasCode: Boolean(l.grantCode),
      })),
      rows,
      payouts: payouts.map((p) => ({ id: p.id, amount: num(p.amount), currency: p.currency, noteAr: p.noteAr, paidAt: p.paidAt })),
    }
  }

  /** ما يراه ممثّلُ الشريك في لوحته — كشفُ شريكه وحدَه */
  async portal(userId: string) {
    const c = await this.prisma.grantCampaign.findUnique({ where: { partnerUserId: userId }, select: { id: true } })
    if (!c) throw new AuthError('not_partner', 'لا شريك مرتبط بهذا الحساب', 404)
    return this.statement(c.id)
  }

  /** الكشفُ ملفّا يُدقَّق — صفٌّ لكلّ طلب، ثمّ ما صُرف */
  async csv(userIdOrNull: string | null, campaignId?: string): Promise<{ text: string; nameAr: string }> {
    const st = campaignId ? await this.statement(campaignId) : await this.portal(userIdOrNull!)
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const day = (d: Date) => d.toISOString().slice(0, 10)
    const lines = [
      ['التاريخ', 'رقم الطلب', 'المستفيد', 'الدورات', 'المدفوع', 'المردود', 'النسبة', 'حصة الشريك', 'الحال', 'العملة'].map(esc).join(','),
      ...st.rows.map((r) => [day(r.at), r.orderId, r.buyerAr, r.courses, r.paid, r.refunded, `${r.percent}%`, r.share, r.stateAr, r.currency].map(esc).join(',')),
      '',
      ['ما صرف', 'المبلغ', 'ملاحظة'].map(esc).join(','),
      ...st.payouts.map((p) => [day(p.paidAt), p.amount, p.noteAr ?? ''].map(esc).join(',')),
      '',
      ['المستحق', st.totals.earned, 'المصروف', st.totals.paidOut, 'الرصيد', st.totals.balance].map(esc).join(','),
    ]
    return { text: '\uFEFF' + lines.join('\n'), nameAr: st.nameAr }
  }

  /** صرفُ دفعةٍ للشريك — تحت قفلٍ له، وبأثرٍ يسمّي من سجّلها. وما زاد على الرصيد يُسأل عنه أوّلا */
  async recordPayout(id: string, input: { amount: number; noteAr?: string | null; advance?: boolean }, actorId: string) {
    if (!(input.amount > 0)) throw new AuthError('bad_amount', 'المبلغ أكبر من صفر', 400)
    await this.partner(id)
    const amount = round2(input.amount)
    const { row, before } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`partner.payout:${id}`}))`
      const before = await this.statement(id)
      if (amount > before.totals.balance && input.advance !== true) {
        throw new AuthError(
          'payout_exceeds_balance',
          `رصيده ${fmtMoney(before.totals.balance, before.currency)} والمبلغ ${fmtMoney(amount, before.currency)}. إن سجلته فالزائد سلفة من حصته القادمة.`,
          409,
        )
      }
      const row = await tx.partnerPayout.create({
        data: { campaignId: id, amount, currency: LEDGER_CURRENCY, noteAr: input.noteAr?.trim().slice(0, 300) || null, recordedBy: actorId },
      })
      return { row, before }
    })
    await recordAudit(this.prisma, {
      actorId, action: 'partner.payout', entityType: 'grant_campaign', entityId: id,
      meta: { payoutId: row.id, amount, currency: row.currency, balanceBefore: before.totals.balance },
    })
    const st = await this.statement(id)
    /* وما يمسّ مالَه يصل ممثّلَه بريدا — إن كان له حساب. والكشفُ في لوحته يقول ما وقع كلَّه */
    const to = (await this.partner(id)).partnerUser?.email
    if (to) {
      await enqueueMail(this.prisma, {
        to, purpose: 'partner.notice', subject: 'سجلنا صرف جزء من حصتكم — أكاديمية وجيز',
        text: [
          `مرحبا ${st.nameAr}،`, '',
          `سجلنا صرف ${fmtMoney(amount, row.currency)} من حصتكم${row.noteAr ? ` (${row.noteAr})` : ''}.`,
          `الرصيد الآن: ${fmtMoney(st.totals.balance, st.currency)}.`, '',
          `التفاصيل في لوحتكم: ${publicSiteUrl()}/partner`,
        ].join('\n'),
      })
    }
    return st
  }

  /** حسابُ ممثّل الشريك — بريدٌ له حسابٌ يُضاف له الدور، وجديدٌ يُنشأ مدعوّا. وحسابٌ واحدٌ لكلّ شريك */
  async attachAccount(id: string, rawEmail: string, actorId: string) {
    const email = rawEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) throw new AuthError('invalid_email', 'صيغة البريد غير صحيحة', 400)
    const c = await this.partner(id)
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true, status: true } })
    if (existing?.status === 'archived') throw new AuthError('archived', 'لهذا البريد حساب مؤرشف — أعد تنشيطه من «المستخدمون» أولا', 409)
    if (existing) {
      const other = await this.prisma.grantCampaign.findUnique({ where: { partnerUserId: existing.id }, select: { id: true } })
      if (other && other.id !== id) throw new AuthError('account_taken', 'هذا الحساب لشريك آخر', 409)
    }
    let userId: string
    let created = false
    let inviteSent: boolean | null = null
    if (existing) {
      userId = existing.id
      await this.prisma.userRole.createMany({ data: [{ userId, roleId: PARTNER_ROLE }], skipDuplicates: true })
    } else {
      userId = (await this.auth.register(email, randomBytes(24).toString('hex'), c.nameAr)).userId
      await this.auth.recordSignupSource(userId, 'admin')
      await this.prisma.userRole.createMany({ data: [{ userId, roleId: PARTNER_ROLE }], skipDuplicates: true })
      await this.prisma.user.update({ where: { id: userId }, data: { status: 'invited' } })
      created = true
      const { token } = await this.auth.issueInvite(userId)
      const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { displayName: true } })
      const mail = await sendStaffInviteEmail(this.prisma, {
        to: email, displayName: c.nameAr, token,
        roleNamesAr: [ROLE_NAMES_AR[PARTNER_ROLE]],
        invitedByAr: actor?.displayName ?? 'مدير المنصّة',
        dutiesAr: (ROLE_PERMISSIONS[PARTNER_ROLE] ?? []).flatMap((k) => {
          const p = PERMISSIONS.find((x) => x.key === k)
          return p ? [p.description as string] : []
        }),
      })
      inviteSent = mail.status === 'sent'
    }
    const prev = c.partnerUser
    await this.prisma.grantCampaign.update({ where: { id }, data: { partnerUserId: userId } })
    /* والحسابُ القديمُ لا يرى اللوحةَ بعدُ — يُنزع دورُ الشريك وحدَه */
    if (prev && prev.id !== userId) await this.prisma.userRole.deleteMany({ where: { userId: prev.id, roleId: PARTNER_ROLE } })
    await recordAudit(this.prisma, {
      actorId, action: 'partner.account', entityType: 'grant_campaign', entityId: id,
      ...(prev && prev.id !== userId ? { before: { email: prev.email }, after: { email } } : {}),
      meta: { userId, email, created, inviteSent, type: PARTNER_TYPE_AR[partnerTypeOf(c.partnerType)].label },
    })
    return { userId, created, inviteSent }
  }
}

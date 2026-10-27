/* المؤثّرون — كودُ كلٍّ منهم في «منحة مؤثرين وجيز»، وحسابُه، وعمولتُه وما دُفع منها (٢٦ أكتوبر ٢٠٢٦).

   ═══ القرار ═══

   قرارُ صاحب المنصّة: منحةٌ ثانيةٌ «بنفس تفاصيل الأولى ولكن بخصمٍ أقلّ لأنّي سأعطي المؤثّر نسبة» — ٤٥٪ للمتابع،
   و١٥٪ للمؤثّر **من سعر الدورات العامّ** («A»: «لأنّه هو يعطي الخصمَ الأكبرَ منه»). ولكلّ مؤثّرٍ كودٌ يكتبه متابعُه
   في نموذج التسجيل، ورابطٌ يفتح الصفحةَ وكودُه مكتوب. وصفحتُها غيرُ `/grant` («A»)، فالأولى تبقى بنسبتها لأعضاء وجيز.
   وله حسابٌ يدخله فيرى من جاء بكوده وما له عن كلٍّ منهم.

   ═══ ما يقع ═══

   ١) **يُضيفه المدير** باسمه وكوده وعمولته، وببريده إن أراد له حسابا: بريدٌ له حسابٌ يُربط به ويُضاف له دورُ
      المؤثّر، وبريدٌ جديدٌ يُنشأ له حسابٌ بدعوةٍ يعيّن منها كلمتَه — كدعوة الموظّفين، بلا كلمةٍ تمرّ في بريد.
   ٢) **والكودُ لا يتغيّر** بعد إضافته: هو في رابطه المنشور، وتغييرُه يضيع ما نُشر. وإيقافُه يمنع أن يُعطى به كودُ
      منحةٍ جديد، وما أُعطي قبله يبقى له.
   ٣) **وعمولتُه تُكتب في كود المنحة يومَ يُعطى** (`grant.service.ts#issue`) — فتغييرُها يقع على ما بعده، كنسبة المنحة.
   ٤) **والعمولةُ تُحسب من الطلب لا تُقيَّد بيد**: نسبتُها من سعر الدورات قبل المنحة (`subtotal`)، على كلّ طلبٍ
      دُفع بكود منحةٍ جاء بكوده — ولو أهداه صاحبُه لغيره، فالمؤثّرُ هو من جاء بالكود أصلا. وما رُدّ من الثمن ينقص
      منها بنسبته، والمردودُ كلُّه لا عمولةَ له.
      **وشراؤه هو بكوده بلا عمولة** — قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦): «b»، خُيّر بين منعه وتركه ومنحِه الخصمَ
      بلا عمولة. فيأخذ المنحةَ كأيّ متابع، وطلبُه يبقى صفّا في كشفه بعمولةٍ صفر و«شراء صاحب الكود — بلا عمولة»، ولا يُعدّ
      في من اشترى ولا في المبيعات. و«هو» حسابُه المربوطُ بملفّه (`userId`).
   ٥) **والرصيدُ ما استحقّه ناقصا ما دُفع له** — والدفعُ يُسجَّل بمبلغه وتاريخه ومن سجّله. فطلبٌ يُردّ بعد أن دُفعت
      عمولتُه ينقص من رصيده التالي، ولا يُطلب منه مالٌ يردّه.
   ٦) **والمؤثّرُ يرى متابعيه بأسمائهم الأولى وحدَها** (`buyerNameAr`) — يعرف أنّهم جاؤوا منه ولا يُكشف له أكثر.
   ٧) **وما يمسّ مالَه يصله بريدا** (`tellInfluencer`): دفعةٌ سُجّلت له، وعمولتُه تغيّرت، وكودُه أُوقف أو عاد. ومن لا
      حسابَ له بعدُ لا بريدَ له عندنا، فيُقال له حين يُربط حسابُه — والكشفُ في حسابه يقول ما وقع كلَّه.

   والحارس: `server/tests/commerce/influencer-grant.test.ts`. */

import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { AuthError, AuthService } from './auth.service'
import { recordAudit } from './audit'
import { GrantService } from './grant.service'
import { GrantCoursesService } from './grant-courses.service'
import { sendStaffInviteEmail } from './account-mail'
import { publicSiteUrl } from './site-url'
import { photoStorageKey } from './storage.service'
import { enqueueMail } from './outbox.service'
import { fmtMoney } from '../../src/application/text/format-ar'
import { PERMISSIONS, ROLE_NAMES_AR, ROLE_PERMISSIONS } from '../auth/permissions'
import { INFLUENCER_GRANT_SLUG } from '../../src/application/commerce/grant'
import {
  INFLUENCER_CODE_FORMAT_AR, INFLUENCER_CODE_TAKEN_AR, OWN_PURCHASE_AR, buyerNameAr, commissionStateAr, influencerCommission,
  influencerLink, normalizeInfluencerCode,
} from '../../src/application/commerce/influencer'
import { refundedShare } from '../../src/application/trainer/trainer-code'
import { LEDGER_CURRENCY } from '../../src/application/commerce/presentment'

export const INFLUENCER_ROLE = 'influencer'

/** ما تُحسب له عمولة: طلبٌ دُفع، ولو رُدّ بعضُه أو كلُّه — فيُقال ما رُدّ ولا يختفي الصفّ */
const COMMISSION_ORDERS = ['paid', 'partially_refunded', 'refunded']

const num = (d: unknown) => Number(d ?? 0)
const round2 = (n: number) => Math.round(n * 100) / 100

export interface InfluencerInput {
  nameAr: string
  code: string
  commissionPercent: number
  email?: string | null
}

function assertPercent(n: number) {
  if (!(Number.isInteger(n) && n >= 0 && n <= 100)) throw new AuthError('bad_percent', 'العمولة عدد صحيح من 0 إلى 100', 400)
}

export class InfluencerService {
  private prisma: PrismaClient
  private auth: AuthService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.auth = new AuthService(prisma)
  }

  /** كلُّ المؤثّرين بأرقامهم — لشاشة صاحب المنصّة */
  async list() {
    const rows = await this.prisma.influencer.findMany({
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { email: true, status: true } } },
    })
    const site = publicSiteUrl()
    return Promise.all(rows.map(async (r) => {
      const st = await this.statement(r.id)
      return {
        id: r.id, nameAr: r.nameAr, code: r.code, commissionPercent: r.commissionPercent, active: r.active,
        link: influencerLink(site, r.code), email: r.user?.email ?? null, accountStatus: r.user?.status ?? null,
        createdAt: r.createdAt, totals: st.totals, currency: st.currency,
      }
    }))
  }

  /** يُضيفه المدير — وببريده حسابُه */
  async create(input: InfluencerInput, actorId: string) {
    const nameAr = input.nameAr.trim()
    if (nameAr.length < 2) throw new AuthError('bad_name', 'اكتب اسم المؤثر', 400)
    const code = normalizeInfluencerCode(input.code)
    if (!code) throw new AuthError('bad_code', INFLUENCER_CODE_FORMAT_AR, 400)
    assertPercent(input.commissionPercent)
    if (await this.prisma.influencer.findUnique({ where: { code }, select: { id: true } })) {
      throw new AuthError('code_taken', INFLUENCER_CODE_TAKEN_AR, 409)
    }
    const row = await this.prisma.influencer.create({
      data: { nameAr, code, commissionPercent: input.commissionPercent, createdBy: actorId },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'influencer.create', entityType: 'influencer', entityId: row.id,
      after: { nameAr, code, commissionPercent: row.commissionPercent },
    })
    const account = input.email?.trim() ? await this.attachAccount(row.id, input.email, actorId) : null
    return { id: row.id, code, account }
  }

  /** اسمُه وعمولتُه وإيقافُه — والكودُ لا يُغيَّر */
  async update(id: string, input: { nameAr?: string; commissionPercent?: number; active?: boolean }, actorId: string) {
    const before = await this.prisma.influencer.findUnique({ where: { id } })
    if (!before) throw new AuthError('not_found', 'المؤثر غير موجود', 404)
    const data: { nameAr?: string; commissionPercent?: number; active?: boolean } = {}
    if (input.nameAr !== undefined) {
      const n = input.nameAr.trim()
      if (n.length < 2) throw new AuthError('bad_name', 'اكتب اسم المؤثر', 400)
      data.nameAr = n
    }
    if (input.commissionPercent !== undefined) { assertPercent(input.commissionPercent); data.commissionPercent = input.commissionPercent }
    if (input.active !== undefined) data.active = input.active
    const after = await this.prisma.influencer.update({ where: { id }, data })
    const pick = (x: typeof before) => ({ nameAr: x.nameAr, commissionPercent: x.commissionPercent, active: x.active })
    await recordAudit(this.prisma, {
      actorId, action: 'influencer.update', entityType: 'influencer', entityId: id, before: pick(before), after: pick(after),
    })
    const told = [
      ...(after.commissionPercent !== before.commissionPercent
        ? [`عمولتك صارت ${after.commissionPercent}% من سعر الدورات، على من يأخذ كود المنحة بكودك من اليوم. ومن أخذه قبل ذلك تبقى عمولته ${before.commissionPercent}%.`]
        : []),
      ...(after.active !== before.active
        ? [after.active
            ? `عاد كودك ${after.code} يعمل، ويأخذ متابعوك كود المنحة به.`
            : `أوقفنا كودك ${after.code}: لا يأخذ أحد كود منحة جديدا به. وعمولة من أخذ كودا قبل ذلك محسوبة لك.`]
        : []),
    ]
    if (told.length > 0) await this.tellInfluencer(id, 'تغيير في كودك أو عمولتك — أكاديمية وجيز', told)
    return { ok: true as const }
  }

  /** حسابُه: يُربط بحسابٍ قائمٍ ببريده ويُضاف له دورُ المؤثّر، أو يُنشأ له حسابٌ بدعوة */
  async attachAccount(id: string, rawEmail: string, actorId: string): Promise<{ userId: string; created: boolean; inviteSent: boolean | null }> {
    const email = rawEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError('invalid_email', 'صيغة البريد غير صحيحة', 400)
    const inf = await this.prisma.influencer.findUnique({ where: { id } })
    if (!inf) throw new AuthError('not_found', 'المؤثر غير موجود', 404)
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) {
      const other = await this.prisma.influencer.findUnique({ where: { userId: existing.id }, select: { id: true } })
      if (other && other.id !== id) throw new AuthError('account_taken', 'هذا الحساب لمؤثر آخر', 409)
    }
    let userId: string
    let created = false
    let inviteSent: boolean | null = null
    if (existing) {
      userId = existing.id
      await this.prisma.userRole.createMany({ data: [{ userId, roleId: INFLUENCER_ROLE }], skipDuplicates: true })
    } else {
      /* كلمةٌ عشوائيّةٌ لا يعرفها أحد — والدخولُ يبدأ بتعيينِ صاحبه كلمتَه من الدعوة (`admin-users.routes.ts`) */
      userId = (await this.auth.register(email, randomBytes(24).toString('hex'), inf.nameAr)).userId
      await this.auth.recordSignupSource(userId, 'admin')
      await this.prisma.userRole.createMany({ data: [{ userId, roleId: INFLUENCER_ROLE }], skipDuplicates: true })
      await this.prisma.user.update({ where: { id: userId }, data: { status: 'invited' } })
      created = true
      const { token } = await this.auth.issueInvite(userId)
      const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { displayName: true } })
      const mail = await sendStaffInviteEmail(this.prisma, {
        to: email, displayName: inf.nameAr, token,
        roleNamesAr: [ROLE_NAMES_AR[INFLUENCER_ROLE]],
        invitedByAr: actor?.displayName ?? 'مدير المنصّة',
        dutiesAr: (ROLE_PERMISSIONS[INFLUENCER_ROLE] ?? []).flatMap((k) => {
          const p = PERMISSIONS.find((x) => x.key === k)
          return p ? [p.description as string] : []
        }),
      })
      inviteSent = mail.status === 'sent'
    }
    await this.prisma.influencer.update({ where: { id }, data: { userId } })
    await recordAudit(this.prisma, {
      actorId, action: 'influencer.account', entityType: 'influencer', entityId: id,
      meta: { userId, email, created, inviteSent },
    })
    return { userId, created, inviteSent }
  }

  /** دفعةٌ دُفعت له من عمولته */
  async recordPayout(id: string, input: { amount: number; noteAr?: string | null }, actorId: string) {
    if (!(input.amount > 0)) throw new AuthError('bad_amount', 'المبلغ أكبر من صفر', 400)
    const inf = await this.prisma.influencer.findUnique({ where: { id }, select: { id: true } })
    if (!inf) throw new AuthError('not_found', 'المؤثر غير موجود', 404)
    const amount = round2(input.amount)
    const row = await this.prisma.influencerPayout.create({
      data: { influencerId: id, amount, currency: LEDGER_CURRENCY, noteAr: input.noteAr?.trim().slice(0, 300) || null, recordedBy: actorId },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'influencer.payout', entityType: 'influencer', entityId: id,
      meta: { payoutId: row.id, amount, currency: row.currency },
    })
    const st = await this.statement(id)
    await this.tellInfluencer(id, 'سجلنا دفعة من عمولتك — أكاديمية وجيز', [
      `سجلنا دفعة ${fmtMoney(amount, row.currency)} من عمولتك${row.noteAr ? ` (${row.noteAr})` : ''}.`,
      `رصيدك الآن: ${fmtMoney(st.totals.balance, st.currency)}.`,
    ])
    return st
  }

  /** بريدٌ إلى المؤثّر بما يمسّ مالَه — إن كان له حساب، ويُكتب في الطابور فيُعاد حتّى يصل */
  private async tellInfluencer(id: string, subject: string, lines: string[]) {
    const inf = await this.prisma.influencer.findUnique({ where: { id }, select: { nameAr: true, user: { select: { email: true } } } })
    if (!inf?.user?.email) return
    await enqueueMail(this.prisma, {
      to: inf.user.email, purpose: 'influencer.notice', subject,
      text: [`مرحبا ${inf.nameAr}،`, '', ...lines, '', `التفاصيل في حسابك: ${publicSiteUrl()}/influencer`].join('\n'),
    })
  }

  /** كشفُه: من عبّأ النموذج بكوده، ومن اشترى، وعمولةُ كلّ طلب، وما دُفع له، والرصيد */
  async statement(id: string) {
    const [inf, signups, codes, payouts] = await Promise.all([
      this.prisma.influencer.findUnique({ where: { id }, select: { userId: true } }),
      this.prisma.lead.count({ where: { influencerId: id, campaign: INFLUENCER_GRANT_SLUG } }),
      this.prisma.grantCode.findMany({
        where: { influencerId: id },
        select: {
          commissionPercent: true,
          coupon: {
            select: {
              orders: {
                where: { status: { in: COMMISSION_ORDERS } },
                select: {
                  id: true, status: true, subtotal: true, currency: true, paidAt: true, createdAt: true, userId: true,
                  user: { select: { displayName: true } },
                  items: { select: { id: true } },
                  invoice: { select: { payments: { select: { amount: true, status: true, refunds: { where: { status: 'processed' }, select: { amount: true } } } } } },
                },
              },
            },
          },
        },
      }),
      this.prisma.influencerPayout.findMany({ where: { influencerId: id }, orderBy: { paidAt: 'desc' } }),
    ])
    const rows = codes.flatMap((g) => g.coupon.orders.map((o) => {
      const paid = (o.invoice?.payments ?? []).filter((p) => p.status !== 'pending' && p.status !== 'failed')
      const share = refundedShare(
        paid.reduce((s, p) => s + p.refunds.reduce((t, r) => t + num(r.amount), 0), 0),
        paid.reduce((s, p) => s + num(p.amount), 0),
      )
      const own = Boolean(inf?.userId) && o.userId === inf!.userId
      const percent = own ? 0 : g.commissionPercent ?? 0
      const listTotal = num(o.subtotal)
      return {
        orderId: o.id, at: o.paidAt ?? o.createdAt, buyerAr: buyerNameAr(o.user.displayName),
        courses: o.items.length, listTotal, percent,
        commission: own ? 0 : influencerCommission(listTotal, percent, o.status === 'refunded' ? 1 : share),
        stateAr: own ? OWN_PURCHASE_AR : commissionStateAr(o.status), refunded: o.status === 'refunded', own, currency: o.currency,
      }
    })).sort((a, b) => b.at.getTime() - a.at.getTime())
    const earned = round2(rows.reduce((s, r) => s + r.commission, 0))
    const paidOut = round2(payouts.reduce((s, p) => s + num(p.amount), 0))
    return {
      currency: LEDGER_CURRENCY,
      totals: {
        signups, codes: codes.length, buyers: rows.filter((r) => !r.refunded && !r.own).length,
        sales: round2(rows.reduce((s, r) => s + (r.own ? 0 : r.listTotal), 0)), earned, paid: paidOut, balance: round2(earned - paidOut),
      },
      rows,
      payouts: payouts.map((p) => ({ id: p.id, amount: num(p.amount), currency: p.currency, noteAr: p.noteAr, paidAt: p.paidAt })),
    }
  }

  /** ما يراه المؤثّرُ في حسابه */
  async portal(userId: string) {
    const inf = await this.prisma.influencer.findUnique({ where: { userId } })
    if (!inf) throw new AuthError('not_influencer', 'لا ملف مؤثر لهذا الحساب', 404)
    const [st, s, learner, designs] = await Promise.all([
      this.statement(inf.id),
      new GrantService(this.prisma, INFLUENCER_GRANT_SLUG).settings(),
      this.prisma.learnerProfile.findUnique({ where: { userId }, select: { avatarUrl: true } }),
      this.designMaterial(),
    ])
    /* صورةُ حسابه لـ«تصميمك الخاص» — المرفوعةُ عندنا وحدَها. ورابطٌ خارجيٌّ كتبه قديما في حسابه لا يُعطى: المتصفّحُ
       لا يرسمه في لوحةٍ تُنزَّل إلّا بإذن موقعه، فيرى صاحبُه تصميمه بـ«صورتك هنا» ولوحةَ التنزيل معه. وبلا صورةٍ يُطلب
       منه رفعُها (`InfluencerHome.tsx`) */
    const key = photoStorageKey(learner?.avatarUrl)
    return {
      nameAr: inf.nameAr, code: inf.code, active: inf.active, commissionPercent: inf.commissionPercent,
      link: influencerLink(publicSiteUrl(), inf.code),
      photoUrl: key ? `/api/v1/avatars/${key}` : null,
      grant: { nameAr: s.nameAr, open: s.open, percentOff: s.percentOff, maxCourses: s.maxCourses, closesAt: s.closesAt },
      designs,
      ...st,
    }
  }

  /** مادّةُ «صمم منشورك»: فصلُ الدورات ودوراتُه، وصورُ مدرّبيه بلا أسماء.

      ═══ ومدرّبٌ هو صاحبُ المنصّة لا يُعرض (٢٧ أكتوبر ٢٠٢٦) ═══

      قال صاحبُ المنصّة: «لا تضع صهيبَ من ضمنهم ولا داعيَ لأسمائهم». فالحكمُ بالدور لا بالاسم: من يحمل حسابُه
      دورَ مدير النظام الأعلى لا يُعدّ في مدرّبي التصاميم — ولو تغيّر اسمُه أو صورتُه. والدوراتُ ومدرّبوها من صفحة
      المنحة نفسِها ببوّابة النشر (`grant-courses.service.ts`). */
  async designMaterial(now = new Date()) {
    const { termAr, courses } = await new GrantCoursesService(this.prisma).openCourses(now)
    const byId = new Map<string, { id: string; photoUrl: string | null }>()
    for (const c of courses) if (c.trainer && !byId.has(c.trainer.id)) byId.set(c.trainer.id, c.trainer)
    const owners = new Set((await this.prisma.trainerProfile.findMany({
      where: { id: { in: [...byId.keys()] }, user: { roles: { some: { roleId: 'super_admin' } } } },
      select: { id: true },
    })).map((p) => p.id))
    const trainers = [...byId.values()].filter((t) => !owners.has(t.id))
    return {
      termAr,
      courses: courses.map((c) => ({ title: c.courseTitleAr, startsAt: c.startsAt })),
      photos: trainers.flatMap((t) => (t.photoUrl ? [t.photoUrl] : [])),
      trainerTotal: trainers.length,
    }
  }
}

/* طلبُ الانضمام مؤثّرا — من صفحة الاتّفاق إلى كودٍ وحسابٍ في خطوةٍ واحدة (٣١ أكتوبر ٢٠٢٦).

   ═══ طلبُ صاحب المنصّة ═══

   «جهّز رابطا لاتّفاقيّة المؤثّر بكلّ التفاصيل… والاتّفاقُ لكلّ فصل… ومنها يتقدّم، فيظهر في قائمة المتقدّمين
   باسمه وبريده وحسابٍ ينتظر تفعيلي». فالصفحةُ `/join-influencer` تقول الاتّفاقَ بأرقامه الحيّة
   (`src/application/commerce/influencer-application.ts`)، والنموذجُ تحتها، والطابورُ في «منحة مؤثرين وجيز».

   ═══ ما يقع — على صورة طلب المستشار (`advisor-application.service.ts`) ═══

   · **الطلبُ** يُحفظ برقمه (`WJ-IN-<سنة>-<أربعة أرقام>`) ووصولِه مجموعا، وبالشروط التي قبلها بنصّها وأرقامِ يومها
     (`termsAr`) — فإن تغيّرت النسبةُ بعده عُرف ما قبله هو. ويصله بريدُ استلامٍ بها، ويصل من يقرّر جرسُه.
   · **والقبولُ** يكتب كودَه وعمولتَه ويُنشئ المؤثّرَ بالخدمة نفسِها التي يُضاف بها من الشاشة (`InfluencerService.create`)
     ببريد طلبه: حسابٌ جديدٌ بدعوةٍ يختار منها كلمتَه، أو حسابٌ قائمٌ يُضاف له الدور (`attachAccount`). ويصله بريدُ
     القبول بكوده ورابطه وشروطه.
   · **والاعتذارُ** يحسم الطلبَ ويصله بريدا، بسببه إن كُتب.

   ═══ ما لا يقع ═══

   · لا طلبان قائمان لبريدٍ واحد: الثاني يُردّ برقم الأوّل. ولا طلبٌ ممّن له ملفُّ مؤثّرٍ بالفعل.
   · ولا يُحسم طلبٌ مرّتين: الحسمُ يُكتب ما دام «قيد المراجعة» (`updateMany`). وما سقط بعد الحسم — قبل أن يُنشأ
     حسابُه — يردّه قيدَ المراجعة ويرفع المؤثّرَ الذي أُنشئ له بلا حساب، فيُقبَل ثانيةً بالكود نفسِه.
   · ولا يُقبَل طلبٌ بريدُه لحسابٍ مؤرشف: يُعاد تنشيطُه من «المستخدمون» أوّلا. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError, AuthService } from './auth.service'
import { recordAudit } from './audit'
import { renderMail, type MailBlock } from './mail-template'
import { notifyRole, publicSiteUrl, sendDirectEmail, type DirectMailStatus } from './notification.service'
import { inviteLink } from './account-mail'
import { GrantService } from './grant.service'
import { InfluencerService } from './influencer.service'
import { ROLE_PERMISSIONS } from '../auth/permissions'
import { MAIL_LINK_WINDOW_AR } from '../../src/application/links/mail-link-window'
import { INFLUENCER_GRANT_SLUG } from '../../src/application/commerce/grant'
import {
  INFLUENCER_CODE_FORMAT_AR, INFLUENCER_CODE_TAKEN_AR, INFLUENCER_COMMISSION_DEFAULT, influencerLink, normalizeInfluencerCode,
} from '../../src/application/commerce/influencer'
import {
  INFLUENCER_PLATFORMS, influencerReach, influencerTermsAr, type InfluencerAccount, type InfluencerDealView,
} from '../../src/application/commerce/influencer-application'
import { fmtNum } from '../../src/application/text/format-ar'
import { labelOf } from '../../src/application/advisor/application'

type Db = PrismaClient | Prisma.TransactionClient

export interface InfluencerApplicationInput {
  fullName: string
  email: string
  phoneCountryCode?: string
  phone: string
  accounts: InfluencerAccount[]
  pitchAr: string
}

/* ═══ المرجع — `WJ-IN-<سنة>-<أربعة أرقام>` ═══
   أعلى رقمٍ صُرف هذه السنة + ١، لا عدُّ الصفوف — والعلّةُ في `advisor-application.service.ts`. */
const PREFIX = 'WJ-IN-'
const REFERENCE_ATTEMPTS = 3

async function nextReference(db: Db): Promise<string> {
  const prefix = `${PREFIX}${new Date().getFullYear()}-`
  const rows = await db.influencerApplication.findMany({ where: { reference: { startsWith: prefix } }, select: { reference: true } })
  let highest = 0
  for (const { reference } of rows) {
    const tail = reference.slice(prefix.length)
    if (/^\d+$/.test(tail)) highest = Math.max(highest, Number(tail))
  }
  return `${prefix}${String(highest + 1).padStart(4, '0')}`
}

function isReferenceCollision(err: unknown): boolean {
  const e = err as { code?: unknown; meta?: { target?: unknown } } | null
  if (!e || e.code !== 'P2002') return false
  const target = e.meta?.target
  return Array.isArray(target) ? target.includes('reference') : typeof target === 'string' && target.includes('reference')
}

/** من يملك المؤثّرين وعمولاتهم — يصله جرسُ كلّ طلبٍ جديد (`influencer.routes.ts`) */
const DECIDERS = Object.entries(ROLE_PERMISSIONS)
  .filter(([, keys]) => (keys as readonly string[]).includes('commerce.manage'))
  .map(([role]) => role)

const asAccounts = (v: Prisma.JsonValue): InfluencerAccount[] => (Array.isArray(v) ? (v as unknown as InfluencerAccount[]) : [])

/** «42,000 متابع · أكبرها إنستغرام 30,000» */
function reachLineAr(accounts: readonly InfluencerAccount[]): string {
  const top = accounts.reduce<InfluencerAccount | null>((best, a) => (!best || a.followers > best.followers ? a : best), null)
  const head = `${fmtNum(influencerReach(accounts))} متابع`
  return top && top.followers > 0 ? `${head} · أكبرها ${labelOf(INFLUENCER_PLATFORMS, top.platform)} ${fmtNum(top.followers)}` : head
}

export class InfluencerApplicationService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** أرقامُ الاتّفاق ساعتَها — من إعدادات منحة المؤثّرين، والعمولةُ المقترحة */
  async deal(): Promise<InfluencerDealView> {
    const s = await new GrantService(this.prisma, INFLUENCER_GRANT_SLUG).settings()
    return { percentOff: s.percentOff, maxCourses: s.maxCourses, commissionPercent: INFLUENCER_COMMISSION_DEFAULT, open: s.open }
  }

  /** طلبٌ جديدٌ من الصفحة العامّة — يعود برقمه وبحال بريد استلامه */
  async submit(input: InfluencerApplicationInput): Promise<{ reference: string; emailDelivery: DirectMailStatus }> {
    const email = input.email.trim().toLowerCase()
    const already = await this.prisma.influencer.findFirst({ where: { user: { email } }, select: { id: true } })
    if (already) throw new AuthError('already_influencer', 'لك حساب مؤثر بالفعل — ادخل ببريدك هذا', 409)
    const live = await this.prisma.influencerApplication.findFirst({
      where: { email, status: 'submitted' }, select: { reference: true },
    })
    if (live) {
      throw new AuthError('already_submitted', `لك طلب قيد المراجعة برقم ${live.reference} — نرد عليك بالبريد`, 409)
    }

    const terms = influencerTermsAr(await this.deal())
    const data = {
      fullName: input.fullName.trim(), email,
      phoneCountryCode: input.phoneCountryCode || null, phone: input.phone.trim(),
      accounts: input.accounts as unknown as Prisma.InputJsonValue,
      reachTotal: influencerReach(input.accounts),
      pitchAr: input.pitchAr.trim(), termsAr: terms, termsAcceptedAt: new Date(),
    }
    let created: { id: string; reference: string } | null = null
    for (let attempt = 1; !created; attempt += 1) {
      try {
        created = await this.prisma.influencerApplication.create({
          data: { ...data, reference: await nextReference(this.prisma) }, select: { id: true, reference: true },
        })
      } catch (e) {
        if (!isReferenceCollision(e) || attempt >= REFERENCE_ATTEMPTS) throw e
      }
    }

    const mail = await sendDirectEmail(this.prisma, {
      to: email,
      subject: `وصل طلبك لتكون مؤثرا في وجيز — ${created.reference}`,
      ...renderMail({
        greetingName: data.fullName,
        heading: 'وصل طلبك',
        preheader: `رقم طلبك ${created.reference}`,
        blocks: [
          { kind: 'p', text: 'شكرا لاهتمامك بمنحة مؤثرين وجيز. نراجع طلبك ونرد عليك بالبريد.' },
          { kind: 'facts', rows: [{ label: 'رقم الطلب', value: created.reference }] },
          { kind: 'h', text: 'الشروط التي وافقت عليها' },
          { kind: 'list', items: terms },
          { kind: 'note', text: 'إن لم تقدم هذا الطلب فتجاهل هذه الرسالة.' },
        ],
      }),
    })
    await notifyRole(this.prisma, DECIDERS, {
      channel: 'in_app',
      title: 'طلب انضمام مؤثر جديد',
      body: `قدم ${data.fullName} طلبا ليكون مؤثرا (${created.reference}) — ${reachLineAr(input.accounts)}.`,
      templateKey: 'admin.influencer_application',
      data: { applicationId: created.id, reference: created.reference },
    })
    return { reference: created.reference, emailDelivery: mail.status }
  }

  /** الطابورُ كلُّه — الأوسعُ وصولا أوّلا، والشاشةُ تصفّي بحاله */
  async list() {
    const rows = await this.prisma.influencerApplication.findMany({ orderBy: [{ reachTotal: 'desc' }, { createdAt: 'desc' }] })
    const people = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.flatMap((r) => (r.decidedBy ? [r.decidedBy] : [])))] } },
      select: { id: true, displayName: true },
    })
    const nameOf = new Map(people.map((u) => [u.id, u.displayName]))
    const influencers = await this.prisma.influencer.findMany({
      where: { id: { in: rows.flatMap((r) => (r.influencerId ? [r.influencerId] : [])) } },
      select: { id: true, code: true, commissionPercent: true },
    })
    const infOf = new Map(influencers.map((i) => [i.id, i]))
    return rows.map((r) => ({
      id: r.id, reference: r.reference, fullName: r.fullName, email: r.email,
      phone: [r.phoneCountryCode, r.phone].filter(Boolean).join(' '),
      accounts: asAccounts(r.accounts), reachTotal: r.reachTotal, pitchAr: r.pitchAr, termsAr: r.termsAr,
      status: r.status, createdAt: r.createdAt, decidedAt: r.decidedAt,
      decidedByName: r.decidedBy ? nameOf.get(r.decidedBy) ?? null : null,
      decisionNoteAr: r.decisionNoteAr,
      code: r.influencerId ? infOf.get(r.influencerId)?.code ?? null : null,
      commissionPercent: r.influencerId ? infOf.get(r.influencerId)?.commissionPercent ?? null : null,
    }))
  }

  /* ═══ القبول — خطوةٌ واحدة ═══
     يُحسم الطلبُ، ويُنشأ المؤثّرُ بكوده وعمولته وحسابِه ببريد طلبه، ويصله بريدُ قبوله. */
  async approve(actorId: string, id: string, input: { code: string; commissionPercent: number }) {
    const app = await this.prisma.influencerApplication.findUnique({ where: { id } })
    if (!app) throw new AuthError('not_found', 'لا طلب بهذا المعرّف', 404)
    if (app.status !== 'submitted') throw new AuthError('decided', 'حسم هذا الطلب من قبل', 409)
    const code = normalizeInfluencerCode(input.code)
    if (!code) throw new AuthError('bad_code', INFLUENCER_CODE_FORMAT_AR, 400)
    if (await this.prisma.influencer.findUnique({ where: { code }, select: { id: true } })) {
      throw new AuthError('code_taken', INFLUENCER_CODE_TAKEN_AR, 409)
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: app.email }, select: { id: true, status: true, influencer: { select: { id: true } } },
    })
    if (existing?.status === 'archived') {
      throw new AuthError('archived', 'لهذا البريد حساب مؤرشف — أعد تنشيطه من «المستخدمون» ثم اقبل الطلب', 409)
    }
    if (existing?.influencer) throw new AuthError('already_influencer', 'لهذا البريد ملف مؤثر بالفعل', 409)

    const claimedAt = new Date()
    const claimed = await this.prisma.influencerApplication.updateMany({
      where: { id, status: 'submitted' },
      data: { status: 'approved', decidedBy: actorId, decidedAt: claimedAt },
    })
    if (claimed.count === 0) throw new AuthError('decided', 'حسم هذا الطلب من قبل', 409)

    let influencerId: string | null = null
    let account: { userId: string; created: boolean; inviteSent: boolean | null }
    let inviteToken: string | null = null
    try {
      const made = await new InfluencerService(this.prisma).create(
        { nameAr: app.fullName, code, commissionPercent: input.commissionPercent, email: app.email }, actorId,
      )
      influencerId = made.id
      if (!made.account) throw new Error('لم يربط حساب المؤثر')
      account = made.account
      /* حسابٌ قائمٌ لم يدخله صاحبُه قطّ لا يُدَلّ على صفحته — لا كلمةَ له يدخل بها، فتصله دعوةٌ جديدة */
      if (!account.created && existing?.status === 'invited') inviteToken = (await new AuthService(this.prisma).issueInvite(account.userId)).token
      await this.prisma.influencerApplication.update({ where: { id }, data: { influencerId } })
    } catch (e) {
      /* لا يبقى طلبٌ «مقبولا» بلا حساب، ولا مؤثّرٌ بكودٍ بلا صاحب: ما سقط بعد الحسم يردّه قيدَ المراجعة،
         ويرفع المؤثّرَ الذي أُنشئ له الآن — ولا كودَ منحةٍ أُعطي به بعدُ — فيُقبَل ثانيةً بالكود نفسِه. والحسابُ إن أُنشئ
         يبقى مدعوّا، فالقبولُ الثاني يجده فيربطه ويدعوه */
      await this.prisma.influencer.deleteMany({
        where: { code, createdBy: actorId, createdAt: { gte: claimedAt }, grantCodes: { none: {} }, leads: { none: {} } },
      })
      await this.prisma.influencerApplication.update({
        where: { id }, data: { status: 'submitted', decidedBy: null, decidedAt: null, influencerId: null },
      })
      throw e
    }

    await recordAudit(this.prisma, {
      actorId, action: 'influencer.application.approve', entityType: 'influencer_application', entityId: id,
      meta: { reference: app.reference, influencerId, userId: account.userId, code, commissionPercent: input.commissionPercent, newAccount: account.created },
    })

    const terms = await this.deal()
    const link = influencerLink(publicSiteUrl(), code)
    const mail = await sendDirectEmail(this.prisma, {
      to: app.email,
      subject: 'قبلناك مؤثرا في منحة مؤثرين وجيز',
      ...renderMail({
        greetingName: app.fullName,
        heading: 'أهلا بك في منحة مؤثرين وجيز',
        preheader: `كودك ${code}`,
        blocks: [
          { kind: 'facts', rows: [
            { label: 'كودك', value: code },
            { label: 'رابطك', value: link },
            { label: 'عمولتك', value: `${input.commissionPercent}% من سعر الدورات قبل الخصم` },
            { label: 'رقم طلبك', value: app.reference },
          ] },
          ...(account.created
            ? ([
                { kind: 'p', text: 'وصلك بريد آخر فيه رابط تفعيل حسابك. فعله واختر كلمة مرورك، ثم يفتح حسابك على صفحة المؤثر.' },
              ] satisfies MailBlock[])
            : inviteToken
              ? ([
                  { kind: 'p', text: 'حسابك جاهز بدور المؤثر. فعله واختر كلمة مرورك من الرابط.' },
                  { kind: 'cta', label: 'فعّل حسابك', href: inviteLink(inviteToken) },
                  { kind: 'callout', text: `الرابط صالح ${MAIL_LINK_WINDOW_AR}. فإن انتهى فاستعمل «نسيت كلمة المرور» ببريدك هذا.` },
                ] satisfies MailBlock[])
              : ([
                  { kind: 'p', text: 'أضفنا دور المؤثر إلى حسابك. ادخل بحسابك المعتاد تجد صفحة المؤثر.' },
                  { kind: 'cta', label: 'افتح صفحتك', href: `${publicSiteUrl()}/influencer` },
                ] satisfies MailBlock[])),
          { kind: 'h', text: 'تذكير بالاتفاق' },
          { kind: 'list', items: influencerTermsAr({ ...terms, commissionPercent: input.commissionPercent }) },
        ],
      }),
    })
    return { influencerId, userId: account.userId, newAccount: account.created, inviteSent: account.inviteSent, emailDelivery: mail.status }
  }

  /** الاعتذار — وسببُه إن كُتب يصله في رسالته */
  async reject(actorId: string, id: string, noteAr?: string) {
    const app = await this.prisma.influencerApplication.findUnique({ where: { id } })
    if (!app) throw new AuthError('not_found', 'لا طلب بهذا المعرّف', 404)
    const note = noteAr?.trim() || null
    const claimed = await this.prisma.influencerApplication.updateMany({
      where: { id, status: 'submitted' },
      data: { status: 'rejected', decidedBy: actorId, decidedAt: new Date(), decisionNoteAr: note },
    })
    if (claimed.count === 0) throw new AuthError('decided', 'حسم هذا الطلب من قبل', 409)
    await recordAudit(this.prisma, {
      actorId, action: 'influencer.application.reject', entityType: 'influencer_application', entityId: id,
      meta: { reference: app.reference, withNote: note !== null },
    })
    const mail = await sendDirectEmail(this.prisma, {
      to: app.email,
      subject: 'طلبك لتكون مؤثرا في أكاديمية وجيز',
      ...renderMail({
        greetingName: app.fullName,
        heading: 'شكرا لاهتمامك',
        blocks: [
          { kind: 'p', text: 'راجعنا طلبك، ولن نتمكن من قبوله الآن.' },
          ...(note ? ([{ kind: 'p', text: note }] satisfies MailBlock[]) : []),
          { kind: 'p', text: 'يسعدنا أن تقدم مرة أخرى في فصل قادم.' },
          { kind: 'facts', rows: [{ label: 'رقم طلبك', value: app.reference }] },
        ],
      }),
    })
    return { ok: true, emailDelivery: mail.status }
  }
}

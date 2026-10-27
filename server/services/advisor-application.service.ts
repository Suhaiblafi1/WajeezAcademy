/* طلبُ الانضمام مستشارا — من يتقدّم، وكيف يُقبَل في خطوةٍ واحدة (٢٧ أكتوبر ٢٠٢٦، خطة لوحة الإدارة — المرحلة السابعة).

   ═══ قراراتُ صاحب المنصّة ═══

   · **لا اتّفاقيّة** («b»): القبولُ نفسُه هو التفعيل. يُكتب للمستشار نسبةُ عمولته، ويُنشأ حسابُه بدور «مستشار» —
     أو يُضاف الدورُ إلى حسابٍ له قائم — ويصله رابطُ تفعيله. والشروطُ قبلها في النموذج (`termsAcceptedAt`).
   · **والنسبةُ تُقترح ٥٪** («5%»، `ADVISOR_DEFAULT_COMMISSION_PCT`)، وتُعدَّل في شاشة القبول. وما تُكتب به هو ما
     يكتبه «المستشارون والعمولة»: `AdvisorProfile.commissionPct` وأثرُ `advisor.commission.set` باسم من كتبها.
   · **والنموذجُ يسأل عن الوصول الرقميّ** («A» مع المتابعين): حساباتُه بمتابعيها، ومجموعاتُه بأعضائها. ومجموعُها
     يُحفظ (`reachTotal`) فيُرتَّب به الطابور.

   ═══ ما لا يقع ═══

   · لا طلبان قائمان لبريدٍ واحد: الثاني يُردّ برقم الأوّل. ولا طلبٌ ممّن هو مستشارٌ بالفعل.
   · ولا يُحسم طلبٌ مرّتين: الحسمُ يُكتب على الصفّ ما دام «قيد المراجعة» (`updateMany`)، فقرارا موظّفَين في
     اللحظة نفسِها يمرّ أحدُهما ويُردّ الآخر. وما سقط بعد الحسم — قبل أن يُنشأ حسابُه — يردّه قيدَ المراجعة، فلا يبقى
     «مقبولا» بلا حسابٍ ولا بريدٍ ولا بابٍ يعيده.
   · ولا يُقبَل طلبٌ بريدُه لحسابٍ مؤرشف: يُعاد تنشيطُه من «المستخدمون» أوّلا — فلا يُفتح بابٌ أُغلق عمدا من باب آخر. */

import { randomBytes } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError, AuthService } from './auth.service'
import { recordAudit } from './audit'
import { renderMail, type MailBlock } from './mail-template'
import { notifyRole, publicSiteUrl, sendDirectEmail, type DirectMailStatus } from './notification.service'
import { inviteLink } from './account-mail'
import { ROLE_PERMISSIONS } from '../auth/permissions'
import { MAIL_LINK_WINDOW_AR } from '../../src/application/links/mail-link-window'
import {
  ADVISOR_TERMS_AR, pctAr, reachLineAr, reachTotal,
  type AdvisorAccount, type AdvisorAudience, type AdvisorCommunity, type AdvisorEmployment,
  type AdvisorExperience, type AdvisorHours,
} from '../../src/application/advisor/application'

type Db = PrismaClient | Prisma.TransactionClient

export interface AdvisorApplicationInput {
  fullName: string
  email: string
  phoneCountryCode?: string
  phone: string
  country?: string
  employment: AdvisorEmployment
  experienceYears: AdvisorExperience
  experienceAr: string
  hoursPerWeek: AdvisorHours
  audiences: AdvisorAudience[]
  accounts: AdvisorAccount[]
  communities: AdvisorCommunity[]
  promotedBefore: boolean
  promotedAr?: string
  motivationAr: string
}

/* ═══ المرجع — `WJ-AD-<سنة>-<أربعة أرقام>` ═══
   أعلى رقمٍ صُرف هذه السنة + ١، لا عدُّ الصفوف: العدُّ ينقص بالحذف فيصير رقمَ طلبٍ قائم. والعلّةُ كاملةً في
   `trainer-application-reference.ts`، وطلبان في اللحظة نفسِها يتصادمان فيُعاد الساقطُ (ثلاثا على الأكثر). */
const PREFIX = 'WJ-AD-'
const REFERENCE_ATTEMPTS = 3

async function nextReference(db: Db): Promise<string> {
  const prefix = `${PREFIX}${new Date().getFullYear()}-`
  const rows = await db.advisorApplication.findMany({ where: { reference: { startsWith: prefix } }, select: { reference: true } })
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

/** من يملك قبولَ المستشارين — يصله جرسُ كلّ طلبٍ جديد */
const DECIDERS = Object.entries(ROLE_PERMISSIONS)
  .filter(([, keys]) => (keys as readonly string[]).includes('advisor.manage'))
  .map(([role]) => role)

const asAccounts = (v: Prisma.JsonValue): AdvisorAccount[] => (Array.isArray(v) ? (v as unknown as AdvisorAccount[]) : [])
const asCommunities = (v: Prisma.JsonValue): AdvisorCommunity[] => (Array.isArray(v) ? (v as unknown as AdvisorCommunity[]) : [])

export class AdvisorApplicationService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** طلبٌ جديدٌ من النموذج العامّ — يعود برقمه وبحال بريد استلامه */
  async submit(input: AdvisorApplicationInput): Promise<{ reference: string; emailDelivery: DirectMailStatus }> {
    const email = input.email.trim().toLowerCase()
    const advisor = await this.prisma.user.findFirst({
      where: { email, roles: { some: { roleId: 'advisor' } } }, select: { id: true },
    })
    if (advisor) throw new AuthError('already_advisor', 'لك حساب مستشار بالفعل — ادخل ببريدك هذا', 409)
    const live = await this.prisma.advisorApplication.findFirst({
      where: { email, status: 'submitted' }, select: { reference: true },
    })
    if (live) {
      throw new AuthError('already_submitted', `لك طلب قيد المراجعة برقم ${live.reference} — نرد عليك بالبريد`, 409)
    }

    const data = {
      fullName: input.fullName.trim(), email,
      phoneCountryCode: input.phoneCountryCode || null, phone: input.phone.trim(), country: input.country || null,
      employment: input.employment, experienceYears: input.experienceYears, experienceAr: input.experienceAr.trim(),
      hoursPerWeek: input.hoursPerWeek, audiences: input.audiences,
      accounts: input.accounts as unknown as Prisma.InputJsonValue,
      communities: input.communities as unknown as Prisma.InputJsonValue,
      reachTotal: reachTotal(input.accounts, input.communities),
      promotedBefore: input.promotedBefore, promotedAr: input.promotedBefore ? input.promotedAr?.trim() || null : null,
      motivationAr: input.motivationAr.trim(), termsAcceptedAt: new Date(),
    }
    let created: { id: string; reference: string } | null = null
    for (let attempt = 1; !created; attempt += 1) {
      try {
        created = await this.prisma.advisorApplication.create({
          data: { ...data, reference: await nextReference(this.prisma) }, select: { id: true, reference: true },
        })
      } catch (e) {
        if (!isReferenceCollision(e) || attempt >= REFERENCE_ATTEMPTS) throw e
      }
    }

    const mail = await sendDirectEmail(this.prisma, {
      to: email,
      subject: `وصل طلبك لتكون مستشارا في وجيز — ${created.reference}`,
      ...renderMail({
        greetingName: data.fullName,
        heading: 'وصل طلبك',
        preheader: `رقم طلبك ${created.reference}`,
        blocks: [
          { kind: 'p', text: 'شكرا لاهتمامك بأن تكون مستشارا في أكاديمية وجيز. نراجع طلبك ونرد عليك بالبريد.' },
          { kind: 'facts', rows: [{ label: 'رقم الطلب', value: created.reference }] },
          { kind: 'h', text: 'الشروط التي وافقت عليها' },
          { kind: 'list', items: [...ADVISOR_TERMS_AR] },
          { kind: 'note', text: 'إن لم تقدم هذا الطلب فتجاهل هذه الرسالة.' },
        ],
      }),
    })
    await notifyRole(this.prisma, DECIDERS, {
      channel: 'in_app',
      title: 'طلب انضمام مستشار جديد',
      body: `قدم ${data.fullName} طلبا ليكون مستشارا (${created.reference}) — ${reachLineAr(input.accounts, input.communities)}.`,
      templateKey: 'admin.advisor_application',
      data: { applicationId: created.id, reference: created.reference },
    })
    return { reference: created.reference, emailDelivery: mail.status }
  }

  /** الطابور كلُّه — الأحدثُ أوّلا، والشاشةُ تبحث وتصفّي وترتّب */
  async list() {
    const rows = await this.prisma.advisorApplication.findMany({ orderBy: { createdAt: 'desc' } })
    const deciders = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.flatMap((r) => (r.decidedBy ? [r.decidedBy] : [])))] } },
      select: { id: true, displayName: true },
    })
    const nameOf = new Map(deciders.map((u) => [u.id, u.displayName]))
    return rows.map((r) => ({
      id: r.id, reference: r.reference, fullName: r.fullName, email: r.email,
      phone: [r.phoneCountryCode, r.phone].filter(Boolean).join(' '), country: r.country,
      employment: r.employment, experienceYears: r.experienceYears, experienceAr: r.experienceAr,
      hoursPerWeek: r.hoursPerWeek, audiences: r.audiences,
      accounts: asAccounts(r.accounts), communities: asCommunities(r.communities), reachTotal: r.reachTotal,
      promotedBefore: r.promotedBefore, promotedAr: r.promotedAr, motivationAr: r.motivationAr,
      status: r.status, createdAt: r.createdAt, decidedAt: r.decidedAt,
      decidedByName: r.decidedBy ? nameOf.get(r.decidedBy) ?? null : null,
      commissionPct: r.commissionPct === null ? null : Number(r.commissionPct),
      decisionNoteAr: r.decisionNoteAr, userId: r.userId,
    }))
  }

  /* ═══ القبول — خطوةٌ واحدة ═══
     يُحسم الطلبُ، ويُنشأ الحسابُ أو يُضاف الدور، وتُكتب النسبةُ بأثرها، ويصله بريدُه: برابط تفعيلٍ لحسابٍ جديد،
     وببابه إلى بوّابته لحسابٍ قائم. */
  async approve(actorId: string, id: string, commissionPct: number) {
    const app = await this.prisma.advisorApplication.findUnique({ where: { id } })
    if (!app) throw new AuthError('not_found', 'لا طلب بهذا المعرّف', 404)
    if (app.status !== 'submitted') throw new AuthError('decided', 'حسم هذا الطلب من قبل', 409)
    const existing = await this.prisma.user.findUnique({
      where: { email: app.email }, select: { id: true, status: true, advisorProfile: { select: { commissionPct: true } } },
    })
    if (existing?.status === 'archived') {
      throw new AuthError('archived', 'لهذا البريد حساب مؤرشف — أعد تنشيطه من «المستخدمون» ثم اقبل الطلب', 409)
    }
    const claimed = await this.prisma.advisorApplication.updateMany({
      where: { id, status: 'submitted' },
      data: { status: 'approved', decidedBy: actorId, decidedAt: new Date(), commissionPct },
    })
    if (claimed.count === 0) throw new AuthError('decided', 'حسم هذا الطلب من قبل', 409)

    const auth = new AuthService(this.prisma)
    const before = existing?.advisorProfile ? Number(existing.advisorProfile.commissionPct) : null
    let userId: string
    let inviteToken: string | null = null
    try {
      if (existing) {
        userId = existing.id
        await this.prisma.userRole.upsert({
          where: { userId_roleId: { userId, roleId: 'advisor' } }, create: { userId, roleId: 'advisor' }, update: {},
        })
        /* حسابٌ لم يدخله صاحبُه قطّ لا يُدَلّ على بوّابته — لا كلمةَ له يدخل بها، فتصله دعوةٌ جديدة */
        if (existing.status === 'invited') inviteToken = (await auth.issueInvite(userId)).token
      } else {
        /* كلمةٌ عشوائيّة لا يعرفها أحد — يختار كلمتَه من رابط الدعوة، كحسابات الفريق (`POST /api/admin/users`).
           و«مدعوٌّ» من أوّل لحظة: إن سقط ما بعدها فالقبولُ الثاني يجده مدعوّا فيدعوه */
        ;({ userId } = await auth.register(app.email, randomBytes(24).toString('hex'), app.fullName))
        await this.prisma.user.update({ where: { id: userId }, data: { status: 'invited' } })
        await auth.recordSignupSource(userId, 'advisor_application')
        await auth.setRoles(userId, ['advisor'])
        inviteToken = (await auth.issueInvite(userId)).token
      }
      await this.prisma.advisorProfile.upsert({ where: { userId }, update: { commissionPct }, create: { userId, commissionPct } })
      await this.prisma.advisorApplication.update({ where: { id }, data: { userId } })
    } catch (e) {
      /* لا يبقى طلبٌ «مقبولا» بلا حسابٍ ولا بريد ولا بابٍ يعيده: ما سقط بعد الحسم يردّه قيدَ المراجعة، فيُقبَل ثانيةً */
      await this.prisma.advisorApplication.update({
        where: { id }, data: { status: 'submitted', decidedBy: null, decidedAt: null, commissionPct: null, userId: null },
      })
      throw e
    }

    /* النسبةُ بندٌ ماليّ: يُكتب من كتبها ومن أيّ رقمٍ إلى أيّ رقم — كما في «المستشارون والعمولة» */
    await recordAudit(this.prisma, {
      actorId, action: 'advisor.commission.set', entityType: 'user', entityId: userId,
      before: { commissionPct: before }, after: { commissionPct },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'advisor.application.approve', entityType: 'advisor_application', entityId: id,
      meta: { reference: app.reference, userId, commissionPct, newAccount: !existing },
    })

    const mail = await sendDirectEmail(this.prisma, {
      to: app.email,
      subject: 'قبلناك مستشارا في أكاديمية وجيز',
      ...renderMail({
        greetingName: app.fullName,
        heading: 'أهلا بك مستشارا في وجيز',
        preheader: `نسبة عمولتك ${pctAr(commissionPct)}`,
        blocks: [
          { kind: 'facts', rows: [{ label: 'نسبة عمولتك', value: pctAr(commissionPct) }, { label: 'رقم طلبك', value: app.reference }] },
          ...(inviteToken
            ? ([
                { kind: 'p', text: 'حسابك بدور مستشار جاهز. فعله واختر كلمة مرورك من الرابط، ثم تجد عملاءك وعمولتك في بوابتك.' },
                { kind: 'cta', label: 'فعّل حسابك', href: inviteLink(inviteToken) },
                { kind: 'callout', text: `الرابط صالح ${MAIL_LINK_WINDOW_AR}. فإن انتهى فاستعمل «نسيت كلمة المرور» ببريدك هذا.` },
              ] satisfies MailBlock[])
            : ([
                { kind: 'p', text: 'أضفنا دور المستشار إلى حسابك. ادخل بحسابك المعتاد تجد بوابة المستشار.' },
                { kind: 'cta', label: 'افتح بوابتك', href: `${publicSiteUrl()}/advisor` },
              ] satisfies MailBlock[])),
          { kind: 'h', text: 'تذكير بالشروط' },
          { kind: 'list', items: [...ADVISOR_TERMS_AR] },
        ],
      }),
    })
    return { userId, newAccount: !existing, emailDelivery: mail.status }
  }

  /** الاعتذار — وسببُه إن كُتب يصله في رسالته */
  async reject(actorId: string, id: string, noteAr?: string) {
    const app = await this.prisma.advisorApplication.findUnique({ where: { id } })
    if (!app) throw new AuthError('not_found', 'لا طلب بهذا المعرّف', 404)
    const note = noteAr?.trim() || null
    const claimed = await this.prisma.advisorApplication.updateMany({
      where: { id, status: 'submitted' },
      data: { status: 'rejected', decidedBy: actorId, decidedAt: new Date(), decisionNoteAr: note },
    })
    if (claimed.count === 0) throw new AuthError('decided', 'حسم هذا الطلب من قبل', 409)
    await recordAudit(this.prisma, {
      actorId, action: 'advisor.application.reject', entityType: 'advisor_application', entityId: id,
      meta: { reference: app.reference, withNote: note !== null },
    })
    const mail = await sendDirectEmail(this.prisma, {
      to: app.email,
      subject: 'طلبك لتكون مستشارا في أكاديمية وجيز',
      ...renderMail({
        greetingName: app.fullName,
        heading: 'شكرا لاهتمامك',
        blocks: [
          { kind: 'p', text: 'راجعنا طلبك، ولن نتمكن من قبوله الآن.' },
          ...(note ? ([{ kind: 'p', text: note }] satisfies MailBlock[]) : []),
          { kind: 'p', text: 'يسعدنا أن تقدم مرة أخرى لاحقا.' },
          { kind: 'facts', rows: [{ label: 'رقم طلبك', value: app.reference }] },
        ],
      }),
    })
    return { ok: true, emailDelivery: mail.status }
  }
}

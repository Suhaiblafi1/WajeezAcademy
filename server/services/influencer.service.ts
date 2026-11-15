/* المؤثّرون — كودُ كلٍّ منهم في «منحة مؤثرين وجيز»، وحسابُه، وعمولتُه وما دُفع منها (٢٦ أكتوبر ٢٠٢٦).

   ═══ القرار ═══

   قرارُ صاحب المنصّة: منحةٌ ثانيةٌ «بنفس تفاصيل الأولى ولكن بخصمٍ أقلّ لأنّي سأعطي المؤثّر نسبة» — ٤٥٪ للمتابع،
   و١٥٪ للمؤثّر **من سعر الدورات العامّ** («A»: «لأنّه هو يعطي الخصمَ الأكبرَ منه»). ولكلّ مؤثّرٍ كودٌ يكتبه متابعُه
   في نموذج التسجيل، ورابطٌ يفتح الصفحةَ وكودُه مكتوب. وصفحتُها غيرُ `/grant` («A»)، فالأولى تبقى بنسبتها لأعضاء وجيز.
   وله حسابٌ يدخله فيرى من جاء بكوده وما له عن كلٍّ منهم.

   ═══ ما يقع ═══

   ١) **يُضيفه المدير** باسمه وكوده وعمولته وبريده: بريدٌ له حسابٌ يُربط به ويُضاف له دورُ المؤثّر، وبريدٌ جديدٌ
      يُنشأ له حسابٌ بدعوةٍ يعيّن منها كلمتَه — كدعوة الموظّفين، بلا كلمةٍ تمرّ في بريد.
      **والإضافةُ كقبول طلب الانضمام والبريدُ لازم** — قرارُ صاحب المنصّة (١٥ نوفمبر ٢٠٢٦): «Same + email required».
      فلكلّ مؤثّرٍ حسابٌ وصفحة: لا يُضاف بلا بريد، ولا ببريدِ حسابٍ مؤرشفٍ أو حسابِ مؤثّرٍ آخر (يُردّ قبل أن يُكتب شيء)،
      وحسابٌ قائمٌ لم يُفعَّل قطّ تصله دعوةٌ جديدة، ويصله بريدُ الترحيب نفسُه الذي يصل من قُبل طلبُه — بكوده ورابطه
      وعمولته وشروط الاتّفاق (`notifyInfluencerWelcome`، يناديها القبولُ أيضا بعنوانه ورقم طلبه).
   ٢) **والكودُ يتغيّر ورابطُه القديمُ يبقى يعمل** — قرارُ صاحب المنصّة (١٥ نوفمبر ٢٠٢٦): «اسمح لي تغيير الكود هناك»،
      نسخا لـ«الكودُ لا يتغيّر بعد إضافته» الذي كان قبله لأنّ الكودَ في رابطه المنشور وتغييرُه يضيع ما نُشر. فالقديمُ
      ينتقل إلى `formerCodes`، ويُقرأ كأنّه كودُه في الرابط والنموذج وعدّ الزيارات (`influencerCodeWhere`) — فما نُشر لا يضيع،
      والمتابعُ يرى الكودَ الجديد. ولا يأخذ مؤثّرٌ كودا هو لغيره اليومَ أو كان (`assertCodeFree`)، ويعود إلى صاحبه كودُه
      القديمُ إن أراده. ويُكتب بأثرٍ يقول من غيّره ومن أيّ كودٍ إلى أيّ (`influencer.code.change`). وإيقافُه يمنع أن يُعطى به
      كودُ منحةٍ جديد، وما أُعطي قبله يبقى له.
   ٢ب) **ولكلّ مؤثّرٍ خصمُه** — قرارُه (١٥ نوفمبر ٢٠٢٦): «وقيمة الخصم للمؤثر كلا على حدا». فارغٌ يأخذ متابعُه نسبةَ الحملة،
      ومكتوبٌ يأخذ خصمَه — في منحة المؤثّرين و«بلاك فرايدي وجيز» معا. ويُكتب في كوبون كلّ كودٍ يومَ يُعطى كالعمولة، فتغييرُه
      يقع على ما بعده (`grant.service.ts#issue`)، وبأثرٍ يسمّي من غيّره (`influencer.discount.set`).
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
import { pageCourses } from './grant-scope.service'
import { inviteLink, sendStaffInviteEmail } from './account-mail'
import { renderMail, type MailBlock } from './mail-template'
import { sendDirectEmail, type DirectMailStatus } from './notification.service'
import { MAIL_LINK_WINDOW_AR } from '../../src/application/links/mail-link-window'
import { influencerTermsAr, type InfluencerDealView } from '../../src/application/commerce/influencer-application'
import { publicSiteUrl } from './site-url'
import { photoStorageKey } from './storage.service'
import { enqueueMail } from './outbox.service'
import { fmtMoney } from '../../src/application/text/format-ar'
import { PERMISSIONS, ROLE_NAMES_AR, ROLE_PERMISSIONS } from '../auth/permissions'
import { BLACK_FRIDAY_GRANT_SLUG, INFLUENCER_GRANT_SLUG, INFLUENCER_GRANT_SLUGS } from '../../src/application/commerce/grant'
import {
  INFLUENCER_CODE_FORMAT_AR, INFLUENCER_CODE_TAKEN_AR, INFLUENCER_COMMISSION_DEFAULT, INFLUENCER_DISCOUNT_BAD_AR, OWN_PURCHASE_AR, buyerNameAr,
  commissionStateAr, influencerCommission, influencerLink, influencerPercentOff, normalizeInfluencerCode,
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
  /** خصمُ متابعيه — وفارغٌ بنسبة الحملة */
  percentOff?: number | null
  /** لازمٌ — لكلّ مؤثّرٍ حسابٌ وصفحة (١٥ نوفمبر ٢٠٢٦) */
  email: string
}

export interface InfluencerUpdate {
  nameAr?: string
  commissionPercent?: number
  /** خصمُ متابعيه — و`null` يعيده إلى نسبة الحملة */
  percentOff?: number | null
  /** كودُه الجديد — والقديمُ ينتقل إلى أكواده السابقة */
  code?: string
  active?: boolean
}

const ADMIN_WELCOME_SUBJECT_AR = 'أضفناك مؤثرا في منحة مؤثرين وجيز'

/** أرقامُ الاتّفاق ساعتَها — من إعدادات منحة المؤثّرين، والعمولةُ المقترحة. يقرؤها الاتّفاقُ العامّ وبريدُ الترحيب */
export async function influencerDeal(prisma: PrismaClient): Promise<InfluencerDealView> {
  const s = await new GrantService(prisma, INFLUENCER_GRANT_SLUG).settings()
  return { percentOff: s.percentOff, maxCourses: s.maxCourses, commissionPercent: INFLUENCER_COMMISSION_DEFAULT, open: s.open }
}

/** حسابُه يومَ يُرحَّب به: أُنشئ الآن (ودعوتُه في بريدٍ آخر)، أو قائمٌ لم يُفعَّل (فدعوةٌ جديدة)، أو قائمٌ يدخله */
export type WelcomeAccount = { kind: 'created' } | { kind: 'invited'; inviteToken: string } | { kind: 'active' }

/** ═══ بريدُ الترحيب — واحدٌ للإضافة من الشاشة ولقبول طلب الانضمام (١٥ نوفمبر ٢٠٢٦) ═══
    كودُه ورابطُه وعمولتُه ورقمُ طلبه إن كان، ثمّ ما يفعل بحسابه على وجوهه الثلاثة، ثمّ شروطُ الاتّفاق بعمولته. */
export async function notifyInfluencerWelcome(prisma: PrismaClient, input: {
  to: string; nameAr: string; code: string; commissionPercent: number; account: WelcomeAccount
  subjectAr: string; reference?: string | null
}): Promise<DirectMailStatus> {
  const terms = await influencerDeal(prisma)
  const accountBlocks: MailBlock[] = input.account.kind === 'created'
    ? [{ kind: 'p', text: 'وصلك بريد آخر فيه رابط تفعيل حسابك. فعله واختر كلمة مرورك، ثم يفتح حسابك على صفحة المؤثر.' }]
    : input.account.kind === 'invited'
      ? [
          { kind: 'p', text: 'حسابك جاهز بدور المؤثر. فعله واختر كلمة مرورك من الرابط.' },
          { kind: 'cta', label: 'فعّل حسابك', href: inviteLink(input.account.inviteToken) },
          { kind: 'callout', text: `الرابط صالح ${MAIL_LINK_WINDOW_AR}. فإن انتهى فاستعمل «نسيت كلمة المرور» ببريدك هذا.` },
        ]
      : [
          { kind: 'p', text: 'أضفنا دور المؤثر إلى حسابك. ادخل بحسابك المعتاد تجد صفحة المؤثر.' },
          { kind: 'cta', label: 'افتح صفحتك', href: `${publicSiteUrl()}/influencer` },
        ]
  const mail = await sendDirectEmail(prisma, {
    to: input.to,
    subject: input.subjectAr,
    ...renderMail({
      greetingName: input.nameAr,
      heading: 'أهلا بك في منحة مؤثرين وجيز',
      preheader: `كودك ${input.code}`,
      blocks: [
        { kind: 'facts', rows: [
          { label: 'كودك', value: input.code },
          { label: 'رابطك', value: influencerLink(publicSiteUrl(), input.code) },
          { label: 'عمولتك', value: `${input.commissionPercent}% من سعر الدورات قبل الخصم` },
          ...(input.reference ? [{ label: 'رقم طلبك', value: input.reference }] : []),
        ] },
        ...accountBlocks,
        { kind: 'h', text: 'تذكير بالاتفاق' },
        { kind: 'list', items: influencerTermsAr({ ...terms, commissionPercent: input.commissionPercent }) },
      ],
    }),
  })
  return mail.status
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function assertPercent(n: number) {
  if (!(Number.isInteger(n) && n >= 0 && n <= 100)) throw new AuthError('bad_percent', 'العمولة عدد صحيح من 0 إلى 100', 400)
}

function assertDiscount(n: number | null) {
  if (n !== null && !(Number.isInteger(n) && n >= 0 && n <= 100)) throw new AuthError('bad_discount', INFLUENCER_DISCOUNT_BAD_AR, 400)
}

/** المؤثّرُ بكوده اليومَ أو بكودٍ كان له — فرابطُه القديمُ يعمل (١٥ نوفمبر ٢٠٢٦). والكودُ مطبَّعٌ قبلها (`normalizeInfluencerCode`) */
export const influencerCodeWhere = (code: string) => ({ OR: [{ code }, { formerCodes: { has: code } }] })

type Db = Pick<PrismaClient, 'influencer'>

/** لا يأخذ مؤثّرٌ كودا هو لغيره — اليومَ أو كان. وكودُه القديمُ يعود إليه إن أراده */
export async function assertCodeFree(db: Db, code: string, exceptId: string | null = null) {
  const other = await db.influencer.findFirst({
    where: { ...influencerCodeWhere(code), ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true },
  })
  if (other) throw new AuthError('code_taken', INFLUENCER_CODE_TAKEN_AR, 409)
}

/** قفلُ أكواد المؤثّرين — إضافةٌ وتغييرٌ متزامنان لا يأخذان الكودَ نفسَه: القيدُ الفريدُ يحرس الكودَ الحاليَّ وحدَه */
const CODE_LOCK = 'influencer.code'

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
        id: r.id, nameAr: r.nameAr, code: r.code, formerCodes: r.formerCodes, commissionPercent: r.commissionPercent,
        percentOff: r.percentOff, active: r.active,
        link: influencerLink(site, r.code),
        /* ورابطاه في حملتَي المؤثّرين — منحةِ المؤثّرين و«بلاك فرايدي وجيز» (١٥ نوفمبر ٢٠٢٦) */
        links: { influencer: influencerLink(site, r.code), blackFriday: influencerLink(site, r.code, BLACK_FRIDAY_GRANT_SLUG) },
        email: r.user?.email ?? null, accountStatus: r.user?.status ?? null,
        createdAt: r.createdAt, totals: st.totals, currency: st.currency,
      }
    }))
  }

  /** يُضيفه المدير — بحسابه ببريده، وبريدِ ترحيبٍ كبريد من قُبل طلبُه (١٥ نوفمبر ٢٠٢٦) */
  async create(input: InfluencerInput, actorId: string) {
    const made = await this.addWithAccount(input, actorId)
    const emailDelivery = await notifyInfluencerWelcome(this.prisma, {
      to: made.email, nameAr: made.nameAr, code: made.code, commissionPercent: made.commissionPercent,
      account: made.welcome, subjectAr: ADMIN_WELCOME_SUBJECT_AR,
    })
    return { id: made.id, code: made.code, account: made.account, emailDelivery }
  }

  /** المؤثّرُ وحسابُه، بلا بريد ترحيب — تناديه الإضافةُ (`create`) وقبولُ الطلب (`influencer-application.service.ts#approve`)،
      وكلٌّ يرسل ترحيبَه بعنوانه. ولا يُردّ إلى باب: فيه رمزُ الدعوة.

      كقبول الطلب (١٥ نوفمبر ٢٠٢٦): البريدُ لازم، والمؤرشفُ وحسابُ مؤثّرٍ آخر يُردّان قبل أن يُكتب شيء، والحسابُ القائمُ
      الذي لم يُفعَّل تصله دعوةٌ جديدة. وما سقط بعد كتابة المؤثّر — قبل أن يُربط حسابُه — يرفعه، فلا يبقى مؤثّرٌ بلا حساب. */
  async addWithAccount(input: InfluencerInput, actorId: string) {
    const nameAr = input.nameAr.trim()
    if (nameAr.length < 2) throw new AuthError('bad_name', 'اكتب اسم المؤثر', 400)
    const code = normalizeInfluencerCode(input.code)
    if (!code) throw new AuthError('bad_code', INFLUENCER_CODE_FORMAT_AR, 400)
    assertPercent(input.commissionPercent)
    const percentOff = input.percentOff ?? null
    assertDiscount(percentOff)
    /* ولا كودا هو لمؤثّرٍ غيره اليومَ أو كان — رابطُه القديمُ ما زال يوصل إليه (`influencerCodeWhere`). يُسأل هنا قبل
       البريد والحساب فيُقال السببُ أوّلا، ثمّ ثانيةً تحت القفل عند الكتابة */
    await assertCodeFree(this.prisma, code)
    const email = (input.email ?? '').trim().toLowerCase()
    if (!email) throw new AuthError('email_required', 'اكتب بريد المؤثر، فله حساب وصفحة', 400)
    if (!EMAIL_RE.test(email)) throw new AuthError('invalid_email', 'صيغة البريد غير صحيحة', 400)
    const existing = await this.prisma.user.findUnique({
      where: { email }, select: { id: true, status: true, influencer: { select: { id: true } } },
    })
    if (existing?.status === 'archived') {
      throw new AuthError('archived', 'لهذا البريد حساب مؤرشف — أعد تنشيطه من «المستخدمون» ثم أضف المؤثر', 409)
    }
    if (existing?.influencer) throw new AuthError('account_taken', 'هذا الحساب لمؤثر آخر', 409)

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CODE_LOCK}))`
      await assertCodeFree(tx, code)
      return tx.influencer.create({
        data: { nameAr, code, commissionPercent: input.commissionPercent, percentOff, createdBy: actorId },
      })
    })
    let account: { userId: string; created: boolean; inviteSent: boolean | null }
    let inviteToken: string | null = null
    try {
      account = await this.attachAccount(row.id, email, actorId)
      /* حسابٌ قائمٌ لم يدخله صاحبُه قطّ لا يُدَلّ على صفحته — لا كلمةَ له يدخل بها، فتصله دعوةٌ جديدة */
      if (!account.created && existing?.status === 'invited') inviteToken = (await this.auth.issueInvite(account.userId)).token
    } catch (e) {
      /* ولا يبقى مؤثّرٌ بكودٍ بلا حساب — ولا كودَ منحةٍ أُعطي به بعدُ. والحسابُ إن أُنشئ يبقى مدعوّا، فالإضافةُ الثانيةُ تجده */
      await this.prisma.influencer.deleteMany({ where: { id: row.id, grantCodes: { none: {} }, leads: { none: {} } } })
      throw e
    }
    await recordAudit(this.prisma, {
      actorId, action: 'influencer.create', entityType: 'influencer', entityId: row.id,
      after: { nameAr, code, commissionPercent: row.commissionPercent, percentOff: row.percentOff },
    })
    const welcome: WelcomeAccount = account.created ? { kind: 'created' } : inviteToken ? { kind: 'invited', inviteToken } : { kind: 'active' }
    return { id: row.id, code, nameAr, email, commissionPercent: row.commissionPercent, account, welcome }
  }

  /** اسمُه وعمولتُه وخصمُ متابعيه وكودُه وإيقافُه — والكودُ القديمُ يبقى يوصل إليه (②) */
  async update(id: string, input: InfluencerUpdate, actorId: string) {
    const exists = await this.prisma.influencer.findUnique({ where: { id }, select: { id: true } })
    if (!exists) throw new AuthError('not_found', 'المؤثر غير موجود', 404)
    const data: { nameAr?: string; commissionPercent?: number; percentOff?: number | null; active?: boolean } = {}
    if (input.nameAr !== undefined) {
      const n = input.nameAr.trim()
      if (n.length < 2) throw new AuthError('bad_name', 'اكتب اسم المؤثر', 400)
      data.nameAr = n
    }
    if (input.commissionPercent !== undefined) { assertPercent(input.commissionPercent); data.commissionPercent = input.commissionPercent }
    if (input.percentOff !== undefined) { assertDiscount(input.percentOff); data.percentOff = input.percentOff }
    if (input.active !== undefined) data.active = input.active
    let code: string | null = null
    if (input.code !== undefined) {
      code = normalizeInfluencerCode(input.code)
      if (!code) throw new AuthError('bad_code', INFLUENCER_CODE_FORMAT_AR, 400)
    }
    /* والكودُ تحت قفل الأكواد: يُفحص أنّه ليس لغيره، وينتقل القديمُ إلى السابقة، ويخرج الجديدُ منها إن كان له قبلُ */
    const { before, after } = await this.prisma.$transaction(async (tx) => {
      if (code) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CODE_LOCK}))`
      const before = await tx.influencer.findUniqueOrThrow({ where: { id } })
      let codeData: { code?: string; formerCodes?: string[] } = {}
      if (code && code !== before.code) {
        await assertCodeFree(tx, code, id)
        codeData = { code, formerCodes: [...new Set([...before.formerCodes.filter((c) => c !== code), before.code])] }
      }
      const after = await tx.influencer.update({ where: { id }, data: { ...data, ...codeData } })
      return { before, after }
    })
    const pick = (x: typeof before) => ({ nameAr: x.nameAr, commissionPercent: x.commissionPercent, active: x.active })
    if (JSON.stringify(pick(before)) !== JSON.stringify(pick(after))) {
      await recordAudit(this.prisma, {
        actorId, action: 'influencer.update', entityType: 'influencer', entityId: id, before: pick(before), after: pick(after),
      })
    }
    if (after.percentOff !== before.percentOff) {
      await recordAudit(this.prisma, {
        actorId, action: 'influencer.discount.set', entityType: 'influencer', entityId: id,
        before: { percentOff: before.percentOff }, after: { percentOff: after.percentOff },
      })
    }
    if (after.code !== before.code) {
      await recordAudit(this.prisma, {
        actorId, action: 'influencer.code.change', entityType: 'influencer', entityId: id,
        before: { code: before.code }, after: { code: after.code }, meta: { from: before.code, to: after.code, formerCodes: after.formerCodes },
      })
    }
    const told = [
      ...(after.code !== before.code
        ? [`كودك صار ${after.code}، ورابطك الجديد: ${influencerLink(publicSiteUrl(), after.code)}. ورابطك القديم بكود ${before.code} يبقى يعمل.`]
        : []),
      ...(after.commissionPercent !== before.commissionPercent
        ? [`عمولتك صارت ${after.commissionPercent}% من سعر الدورات، على من يأخذ كود المنحة بكودك من اليوم. ومن أخذه قبل ذلك تبقى عمولته ${before.commissionPercent}%.`]
        : []),
      ...(after.percentOff !== before.percentOff
        ? [after.percentOff === null
            ? 'صار خصم متابعيك نسبة المنحة نفسها، على من يأخذ كود المنحة بكودك من اليوم.'
            : `صار خصم متابعيك ${after.percentOff}%، على من يأخذ كود المنحة بكودك من اليوم. ومن أخذه قبل ذلك يبقى خصمه كما هو.`]
        : []),
      ...(after.active !== before.active
        ? [after.active
            ? `عاد كودك ${after.code} يعمل، ويأخذ متابعوك كود المنحة به.`
            : `أوقفنا كودك ${after.code}: لا يأخذ أحد كود منحة جديدا به. وعمولة من أخذ كودا قبل ذلك محسوبة لك.`]
        : []),
    ]
    if (told.length > 0) await this.tellInfluencer(id, 'تغيير في كودك أو عمولتك — أكاديمية وجيز', told)
    return { ok: true as const, code: after.code }
  }

  /** حسابُه: يُربط بحسابٍ قائمٍ ببريده ويُضاف له دورُ المؤثّر، أو يُنشأ له حسابٌ بدعوة */
  async attachAccount(id: string, rawEmail: string, actorId: string): Promise<{ userId: string; created: boolean; inviteSent: boolean | null }> {
    const email = rawEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) throw new AuthError('invalid_email', 'صيغة البريد غير صحيحة', 400)
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

  /** دفعةٌ دُفعت له من عمولته.

      ═══ وما زاد على رصيده سلفةٌ تُختار، لا تُمنع ولا تقع سهوا (٣١ أكتوبر ٢٠٢٦) ═══

      كان المبلغُ يُقبل أيّا كان، فيصير الرصيدُ سالبا بخطأٍ في رقمٍ ولا يقول أحدٌ شيئا. ومنعُه يسدّ بابا قد يُقصد —
      دفعةٌ مقدّمةٌ قبل أن تُستحقّ — وقرارُ صاحب المنصّة «لا إجبارَ على فعل: الفرقُ والخياراتُ وأثرُ كلٍّ». فما زاد على
      الرصيد يُردّ بـ`payout_exceeds_balance` يقول الرصيدَ وأنّه يُسجَّل سلفة، والشاشةُ تعرض الخيارين: «سجلها سلفة»
      (`advance: true`) أو «عدل المبلغ». والسلفةُ تُكتب في الأثر، ويقال له في بريده إنّها سلفة. */
  async recordPayout(id: string, input: { amount: number; noteAr?: string | null; advance?: boolean }, actorId: string) {
    if (!(input.amount > 0)) throw new AuthError('bad_amount', 'المبلغ أكبر من صفر', 400)
    const inf = await this.prisma.influencer.findUnique({ where: { id }, select: { id: true } })
    if (!inf) throw new AuthError('not_found', 'المؤثر غير موجود', 404)
    const amount = round2(input.amount)
    /* ═══ دفعةٌ واحدةٌ في كلّ لحظةٍ للمؤثّر الواحد (٨ نوفمبر ٢٠٢٦) ═══
       كان الرصيدُ يُقرأ ثمّ تُكتب الدفعة بلا قفل: فضغطتان معا (أو موظّفا ماليّةٍ يسجّلان الحوالةَ نفسَها) تقرآن الرصيدَ
       نفسَه وتمضيان — استحقّ ١٥ فسُجّل له ٣٠، ورصيدُه −١٥ بلا «سلفة» في الأثر ولا في بريده. فالقراءةُ والكتابةُ تحت قفلٍ
       للمؤثّر، والثانيةُ ترى ما كتبته الأولى. والحارس: `server/tests/commerce/influencer-payout-once.test.ts`. */
    const { row, before, advance } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`influencer.payout:${id}`}))`
      const before = await this.statement(id)
      const advance = amount > before.totals.balance
      if (advance && input.advance !== true) {
        throw new AuthError(
          'payout_exceeds_balance',
          `رصيده ${fmtMoney(before.totals.balance, before.currency)} والمبلغ ${fmtMoney(amount, before.currency)}. إن سجلته فالزائد سلفة، ويصير رصيده ${fmtMoney(round2(before.totals.balance - amount), before.currency)}.`,
          409,
        )
      }
      const row = await tx.influencerPayout.create({
        data: { influencerId: id, amount, currency: LEDGER_CURRENCY, noteAr: input.noteAr?.trim().slice(0, 300) || null, recordedBy: actorId },
      })
      return { row, before, advance }
    })
    await recordAudit(this.prisma, {
      actorId, action: 'influencer.payout', entityType: 'influencer', entityId: id,
      meta: {
        payoutId: row.id, amount, currency: row.currency,
        ...(advance ? { advance: true, balanceBefore: before.totals.balance, advanceAmount: round2(amount - Math.max(0, before.totals.balance)) } : {}),
      },
    })
    const st = await this.statement(id)
    await this.tellInfluencer(id, 'سجلنا دفعة من عمولتك — أكاديمية وجيز', [
      advance
        ? `سجلنا دفعة ${fmtMoney(amount, row.currency)}${row.noteAr ? ` (${row.noteAr})` : ''}، وما زاد منها على رصيدك سلفة من عمولتك القادمة.`
        : `سجلنا دفعة ${fmtMoney(amount, row.currency)} من عمولتك${row.noteAr ? ` (${row.noteAr})` : ''}.`,
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
      /* ومن عبّأ بكوده في حملتَي المؤثّرين معا — والعمولةُ من أكواد المنحة كلِّها بكوده أدناه */
      this.prisma.lead.count({ where: { influencerId: id, campaign: { in: [...INFLUENCER_GRANT_SLUGS] } } }),
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
                  invoice: { select: { payments: { where: { extra: false }, select: { amount: true, status: true, refunds: { where: { status: 'processed' }, select: { amount: true } } } } } },
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
    const buyerCount = new Set(codes.flatMap((g) => g.coupon.orders
      .filter((o) => o.status !== 'refunded' && !(inf?.userId && o.userId === inf.userId))
      .map((o) => o.userId))).size
    const paidOut = round2(payouts.reduce((s, p) => s + num(p.amount), 0))
    return {
      currency: LEDGER_CURRENCY,
      totals: {
        /* «اشتروا» أناسٌ لا طلبات (٣١ أكتوبر ٢٠٢٦): الكودُ يُستعمل في أكثر من طلبٍ حتى حدّه، فمن اشترى مرّتين كان
           يُعدّ مشتريَين. و«المبيعات» بلا ما رُدّ كلُّه — كما «اشتروا» و«ما استحققت» — فلا يختلف رقمان في لوحٍ واحد */
        signups, codes: codes.length, buyers: buyerCount,
        sales: round2(rows.reduce((s, r) => s + (r.own || r.refunded ? 0 : r.listTotal), 0)), earned, paid: paidOut, balance: round2(earned - paidOut),
      },
      rows,
      payouts: payouts.map((p) => ({ id: p.id, amount: num(p.amount), currency: p.currency, noteAr: p.noteAr, paidAt: p.paidAt })),
    }
  }

  /** ما يراه المؤثّرُ في حسابه */
  async portal(userId: string) {
    const inf = await this.prisma.influencer.findUnique({ where: { userId } })
    if (!inf) throw new AuthError('not_influencer', 'لا ملف مؤثر لهذا الحساب', 404)
    const [st, s, bf, learner, designs] = await Promise.all([
      this.statement(inf.id),
      new GrantService(this.prisma, INFLUENCER_GRANT_SLUG).settings(),
      new GrantService(this.prisma, BLACK_FRIDAY_GRANT_SLUG).settings(),
      this.prisma.learnerProfile.findUnique({ where: { userId }, select: { avatarUrl: true } }),
      this.designMaterial(new Date(), inf.id),
    ])
    /* صورةُ حسابه لـ«تصميمك الخاص» — المرفوعةُ عندنا وحدَها. ورابطٌ خارجيٌّ كتبه قديما في حسابه لا يُعطى: المتصفّحُ
       لا يرسمه في لوحةٍ تُنزَّل إلّا بإذن موقعه، فيرى صاحبُه تصميمه بـ«صورتك هنا» ولوحةَ التنزيل معه. وبلا صورةٍ يُطلب
       منه رفعُها (`InfluencerHome.tsx`) */
    const key = photoStorageKey(learner?.avatarUrl)
    return {
      nameAr: inf.nameAr, code: inf.code, active: inf.active, commissionPercent: inf.commissionPercent,
      link: influencerLink(publicSiteUrl(), inf.code),
      photoUrl: key ? `/api/v1/avatars/${key}` : null,
      /* والنسبةُ ما يأخذه متابعُه هو — خصمُه إن كُتب له (١٥ نوفمبر ٢٠٢٦) */
      grant: { nameAr: s.nameAr, open: s.open, percentOff: influencerPercentOff(s.percentOff, inf.percentOff), maxCourses: s.maxCourses, closesAt: s.closesAt },
      /* و«بلاك فرايدي وجيز» برابطه هو — حين تُشغَّل */
      blackFriday: {
        nameAr: bf.nameAr, open: bf.open, percentOff: influencerPercentOff(bf.percentOff, inf.percentOff), maxCourses: bf.maxCourses,
        closesAt: bf.closesAt, link: influencerLink(publicSiteUrl(), inf.code, BLACK_FRIDAY_GRANT_SLUG),
      },
      designs,
      ...st,
    }
  }

  /** مادّةُ «صمم منشورك»: فصلُ الدورات ودوراتُه، وصورُ مدرّبيه بلا أسماء.

      ═══ ومدرّبٌ هو صاحبُ المنصّة لا يُعرض (٢٧ أكتوبر ٢٠٢٦) ═══

      قال صاحبُ المنصّة: «لا تضع صهيبَ من ضمنهم ولا داعيَ لأسمائهم». فالحكمُ بالدور لا بالاسم: من يحمل حسابُه
      دورَ مدير النظام الأعلى لا يُعدّ في مدرّبي التصاميم — ولو تغيّر اسمُه أو صورتُه. والدوراتُ ومدرّبوها من صفحة
      المنحة نفسِها ببوّابة النشر (`grant-courses.service.ts`) — ودوراتُه هو إن اختارها المدير (١٥ نوفمبر ٢٠٢٦، `grant-scope.ts`). */
  async designMaterial(now = new Date(), influencerId: string | null = null) {
    const { termAr, courses } = await pageCourses(this.prisma, INFLUENCER_GRANT_SLUG, influencerId, now)
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

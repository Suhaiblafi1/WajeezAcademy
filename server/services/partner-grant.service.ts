/* منحُ الشركاء — الجامعاتُ والشركات (١٥ نوفمبر ٢٠٢٦). والقراراتُ في رأس `src/application/commerce/partner-grant.ts`.

   ═══ الشريكُ صفٌّ في `GrantCampaign` ═══

   بنوع `partner` ومعرّف `partner-<رابطه>`. فكودُه كودُ منحةٍ كسائرها (`GrantService.issue`): بنسبته يومَ أُعطي، ويُستعمل حتى
   حدّ دوراته في كلّ المشتريات (`coursesLeft`)، و«منحةٌ واحدةٌ لكلّ متعلّم» على المنح كلِّها (`assertUsable`). ودوراتُ صفحته
   يختارها المدير (`GrantCourseChoiceService`)، والتذكيرُ قبل نهايته إن كُتبت له نهاية. **ولا عمولةَ ولا مؤثّر**.

   ═══ والتحقّقُ ببريد الشريك وحدَه ═══

   ١) **يكتب اسمَه وبريدَه** (`requestLink`) — والبريدُ على نطاقات الشريك بحدود المقاطع (`emailMatchesDomains`)، وإلّا رُدّ
      بسببه. فيُرسَل إليه رابطٌ برمزٍ عشوائيّ، **يُحفظ مجزّأً** (sha256) لا كما هو، ومهلتُه مهلةُ روابط البريد
      (`MAIL_LINK_TTL_MS`).
   ٢) **والجوابُ واحدٌ لكلّ بريد** — «أرسلنا رابطا إلى…» — أأخذ صاحبُه المنحةَ من قبل أم لم يأخذ. وثلاثةُ روابطَ في الساعة
      لكلّ بريدٍ ثمّ لا يُرسَل شيءٌ والجوابُ هو هو: فلا يُغرق أحدٌ صندوقَ غيره. وسقفُ الشبكة في المسار.
   ٣) **ويُستعمل الرابطُ مرّة** (`confirm`): يُعلَّم مستعملا في كتابةٍ مشروطة، فنقرتان لا تمرّان. ومن فتحه أخذ **عميلا محتملا
      واحدا لكلّ بريدٍ في الشريك** (`Lead` بحملة الشريك) — يراه المستشارُ والتقاريرُ كعملاء المنح — **وكودَه**: يُعطى أوّلَ
      مرّةٍ ويُرسَل إلى بريده، ومن أكّد ثانيةً يرى كودَه نفسَه. فبريدٌ واحدٌ لا يأخذ كودين.
   ٤) **ومن اشترى بمنحةٍ أخرى لا يُعطى كودا** — منحةٌ واحدةٌ لكلّ متعلّم، كما في نموذج المنح (`apply`).
   ٥) **والشريكُ الموقوفُ لا صفحةَ له ولا رابط** (٤٠٤)، والمنتهيةُ نهايتُه صفحتُه تقول إنّها مغلقة ولا يُعطى بها كود.

   ═══ وشعارُه ═══

   يرفعه المدير: يُكتب مفتاحٌ في `logoPendingKey` ويُعطى رابطَ رفعٍ موقّعا إلى مسار الرفع العامّ، وهناك تُسأل البايتاتُ أهي صورة
   (`kindRequiresImage`). ثمّ يُعتمد فيصير `logoKey` ويُمحى القديم. ويُخدَم للعامّة **ما دام الشريكُ مشغَّلا** (`publicLogo`).

   والحارس: `server/tests/commerce/partner-grant.test.ts`. */

import { createHash, randomBytes } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import ExcelJS from 'exceljs'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { GrantService, GRANT_HOLDS } from './grant.service'
import { GrantLandingService, maskEmail } from './grant-landing.service'
import { enqueueMail } from './outbox.service'
import { renderMail } from './mail-template'
import { publicSiteUrl } from './site-url'
import {
  assertFileUploadsEnabled, MAX_PHOTO_BYTES, newStorageKey, PHOTO_MIMES, signKey, SIGNED_URL_TTL_MS,
} from './storage.service'
import { deleteObject, objectExists } from './object-store'
import { normalizePhone } from '../../src/application/advisor/guest-contact'
import { campaignTag } from '../../src/application/commerce/grant-landing'
import { GRANT_ONCE_AR } from '../../src/application/commerce/grant'
import {
  emailMatchesDomains, normalizeDomain, normalizePartnerSlug, partnerBadEmailAr, partnerCampaignSlug, partnerHeadlineAr,
  partnerLinkSentAr, partnerPagePath, partnerSlugOf, partnerTypeOf, PARTNER_CONSENT_AR, PARTNER_LINK_BAD_AR,
  PARTNER_LINK_EXPIRED_AR, PARTNER_LINK_USED_AR, PARTNER_NOT_FOUND_AR, PARTNER_TYPES, PARTNER_TYPE_AR,
  HU_PARTNER, MEU_PARTNER, PARTNER_DEFAULTS, STUDENT_SUGGESTED_COURSES, builtInPartnerLogo, type PartnerType,
} from '../../src/application/commerce/partner-grant'
import { MAIL_LINK_TTL_MS, MAIL_LINK_WINDOW_AR } from '../../src/application/links/mail-link-window'
import { fmtDate } from '../../src/application/text/format-ar'
import { zonedClock, zonedDay } from '../../src/application/trainer/cohort-period'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')

/** كم رابطا يُرسَل لبريدٍ واحدٍ في الساعة — وما زاد لا يُرسَل، والجوابُ هو هو */
export const PARTNER_LINKS_PER_HOUR = 3
/** أقصى النطاقات لشريك */
const MAX_DOMAINS = 10
const HOUR = 3_600_000
/** ما يحسب «اشترى» في قائمة من أكّد — كقائمة من عبّأ (`grant-followup.service.ts`) */
const BOUGHT = ['paid', 'partially_refunded']

/** ما يكتبه المديرُ لشريك — والرابطُ عند الإنشاء وحدَه: لا يتغيّر بعده، فهو في كلّ رابطٍ نُشر */
export interface PartnerInput {
  slug?: string
  nameAr?: string
  nameEn?: string | null
  type?: string
  domains?: readonly string[]
  percentOff?: number
  maxCourses?: number
  maxCodes?: number | null
  closesAt?: Date | null
  active?: boolean
  /** حصّتُه ممّا يُدفع (١٦ نوفمبر ٢٠٢٦) — وفارغةٌ: بلا حصّة */
  sharePercent?: number | null
}

type PartnerRow = Prisma.GrantCampaignGetPayload<object>

const isOpen = (c: { active: boolean; closesAt: Date | null }, now: Date) => c.active && (c.closesAt === null || c.closesAt > now)

/** ما يُكتب في الأثر قبلُ وبعدُ — الإعداداتُ كلُّها بلا الشعار (له أثرُه) */
const pick = (c: PartnerRow) => ({
  nameAr: c.nameAr, nameEn: c.partnerNameEn, type: c.partnerType, domains: c.emailDomains, percentOff: c.percentOff,
  maxCourses: c.maxCourses, maxCodes: c.maxCodes, closesAt: c.closesAt?.toISOString() ?? null, active: c.active,
  sharePercent: c.partnerSharePercent,
})

/** رابطُ رفعٍ موقّعٌ إلى مسار الرفع العامّ — كصورة التسويق (`trainer-marketing.service.ts`) */
function writeUrl(storageKey: string): string {
  const exp = Date.now() + SIGNED_URL_TTL_MS
  return `/api/v1/uploads/${storageKey}?exp=${exp}&sig=${signKey(storageKey, exp, 'write')}`
}

/** شعارُه للعامّة — والمسارُ لا يخدمه إلّا والشريكُ مشغَّل */
export const partnerLogoUrl = (key: string | null | undefined): string | null => (key ? `/api/v1/partner-logos/${key}` : null)
/** شعارُ الشريك كما يُعرض: المرفوعُ إن رُفع، وإلّا المشحونُ مع الموقع (١٦ نوفمبر ٢٠٢٦)، وإلّا لا شيء */
export const partnerShownLogo = (c: { slug: string; logoKey: string | null }): string | null =>
  partnerLogoUrl(c.logoKey) ?? builtInPartnerLogo(partnerSlugOf(c.slug))

export class PartnerGrantService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /* ═══ القراءة ═══ */

  private async byId(id: string): Promise<PartnerRow> {
    const row = await this.prisma.grantCampaign.findFirst({ where: { id, kind: 'partner' } })
    if (!row) throw new AuthError('not_found', 'الشريك غير موجود', 404)
    return row
  }

  /** الشريكُ المشغَّلُ برابطه — والموقوفُ وغيرُ الموجود سواءٌ للزائر: ٤٠٤ */
  private async liveBySlug(raw: string): Promise<PartnerRow> {
    const slug = normalizePartnerSlug(raw)
    const row = slug ? await this.prisma.grantCampaign.findFirst({ where: { slug: partnerCampaignSlug(slug), kind: 'partner', active: true } }) : null
    if (!row) throw new AuthError('not_found', PARTNER_NOT_FOUND_AR, 404)
    return row
  }

  /** الشريكُ للمدير — بإعداداته وما جرى بها */
  private async shape(c: PartnerRow, now: Date) {
    const settings = await new GrantService(this.prisma, c.slug as `partner-${string}`).settings(now)
    const claims = await this.prisma.lead.count({ where: { campaign: c.slug, erasedAt: null } })
    const slug = partnerSlugOf(c.slug)
    return {
      id: c.id, slug, nameAr: c.nameAr, nameEn: c.partnerNameEn, type: partnerTypeOf(c.partnerType), domains: c.emailDomains,
      percentOff: c.percentOff, maxCourses: c.maxCourses, maxCodes: c.maxCodes, closesAt: c.closesAt, active: c.active,
      open: settings.open, issued: settings.issued, used: settings.used, pending: settings.pending, claims,
      /* وشعارُه المشحونُ مع الموقع يُعدّ شعارا — والمرفوعُ يعلوه، وإزالتُه تعيده إليه (`builtInLogo`) */
      hasLogo: c.logoKey !== null || builtInPartnerLogo(slug) !== null, uploadedLogo: c.logoKey !== null,
      builtInLogo: builtInPartnerLogo(slug), publicPath: partnerPagePath(slug), updatedAt: c.updatedAt,
      sharePercent: c.partnerSharePercent, hasAccount: c.partnerUserId !== null,
    }
  }

  async list(now = new Date()) {
    const rows = await this.prisma.grantCampaign.findMany({ where: { kind: 'partner' }, orderBy: { createdAt: 'asc' } })
    return Promise.all(rows.map((r) => this.shape(r, now)))
  }

  async get(id: string, now = new Date()) {
    return this.shape(await this.byId(id), now)
  }

  /* ═══ الكتابة — بأثرٍ يقول من غيّر وما كان وما صار ═══ */

  /** ما يُكتب في الصفّ من مدخلات المدير — بعد فحصها. و`issued` لئلّا يقلّ العددُ عمّا أُعطي */
  private parse(input: PartnerInput, issued = 0): Prisma.GrantCampaignUpdateInput {
    const data: Prisma.GrantCampaignUpdateInput = {}
    if (input.nameAr !== undefined) {
      const v = input.nameAr.trim()
      if (v.length < 2 || v.length > 120) throw new AuthError('bad_name', 'اكتب اسم الشريك بالعربية', 400)
      data.nameAr = v
    }
    if (input.nameEn !== undefined) data.partnerNameEn = input.nameEn?.trim().slice(0, 120) || null
    if (input.type !== undefined) {
      if (!(PARTNER_TYPES as readonly string[]).includes(input.type)) throw new AuthError('bad_type', 'اختر جامعة أو شركة', 400)
      data.partnerType = input.type
    }
    if (input.domains !== undefined) {
      const out: string[] = []
      for (const raw of input.domains) {
        if (!raw.trim()) continue
        const d = normalizeDomain(raw)
        if (!d) throw new AuthError('bad_domain', `النطاق ${raw.trim()} غير صحيح. اكتبه مثل hu.edu.jo`, 400)
        if (!out.includes(d)) out.push(d)
      }
      if (out.length === 0) throw new AuthError('bad_domain', 'اكتب نطاق بريد واحدا على الأقل', 400)
      if (out.length > MAX_DOMAINS) throw new AuthError('bad_domain', `${MAX_DOMAINS} نطاقات بحد أقصى`, 400)
      data.emailDomains = out
    }
    if (input.percentOff !== undefined) {
      if (!(Number.isInteger(input.percentOff) && input.percentOff >= 1 && input.percentOff <= 100)) {
        throw new AuthError('bad_percent', 'النسبة عدد صحيح من 1 إلى 100', 400)
      }
      data.percentOff = input.percentOff
    }
    if (input.maxCourses !== undefined) {
      if (!(Number.isInteger(input.maxCourses) && input.maxCourses >= 1 && input.maxCourses <= 20)) {
        throw new AuthError('bad_courses', 'عدد الدورات عدد صحيح من 1 إلى 20', 400)
      }
      data.maxCourses = input.maxCourses
    }
    if (input.maxCodes !== undefined) {
      if (input.maxCodes !== null && !(Number.isInteger(input.maxCodes) && input.maxCodes >= 1)) {
        throw new AuthError('bad_max', 'عدد المنح عدد صحيح موجب', 400)
      }
      if (input.maxCodes !== null && input.maxCodes < issued) throw new AuthError('below_issued', `أعطي ${issued} كودا، فلا يقل العدد عنه`, 409)
      data.maxCodes = input.maxCodes
    }
    if (input.sharePercent !== undefined) {
      if (input.sharePercent !== null && !(Number.isInteger(input.sharePercent) && input.sharePercent >= 0 && input.sharePercent <= 100)) {
        throw new AuthError('bad_share', 'حصة الشريك عدد صحيح من 0 إلى 100', 400)
      }
      data.partnerSharePercent = input.sharePercent
    }
    if (input.closesAt !== undefined) data.closesAt = input.closesAt
    if (input.active !== undefined) data.active = input.active
    return data
  }

  async create(input: PartnerInput, actorId: string | null, opts: { reason?: string; courseIds?: string[] } = {}, now = new Date()) {
    const slug = normalizePartnerSlug(input.slug)
    if (!slug) throw new AuthError('bad_slug', 'الرابط حروف إنجليزية صغيرة وأرقام وشرطة، من حرفين إلى ثلاثين', 400)
    if (input.nameAr === undefined || input.domains === undefined) throw new AuthError('bad_input', 'اكتب الاسم والنطاق', 400)
    /* والجديدُ موقوفٌ حتى يشغّله المدير، وبنسبة الشريك الأوّل وحدِّه ما لم يكتب غيرَهما */
    const data = this.parse({
      ...input, type: input.type ?? 'university', percentOff: input.percentOff ?? PARTNER_DEFAULTS.percentOff,
      maxCourses: input.maxCourses ?? PARTNER_DEFAULTS.maxCourses, active: input.active ?? false,
      sharePercent: input.sharePercent !== undefined ? input.sharePercent : PARTNER_DEFAULTS.sharePercent,
    })
    const campaignSlug = partnerCampaignSlug(slug)
    if (await this.prisma.grantCampaign.findUnique({ where: { slug: campaignSlug }, select: { id: true } })) {
      throw new AuthError('slug_taken', 'هذا الرابط لشريك آخر', 409)
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const c = await tx.grantCampaign.create({
        data: {
          ...(data as Prisma.GrantCampaignCreateInput), slug: campaignSlug, kind: 'partner', nameAr: data.nameAr as string,
          maxCodes: input.maxCodes ?? null, courseIds: opts.courseIds ?? [], updatedBy: actorId,
        },
      })
      await recordAudit(tx, {
        actorId, action: 'coupon.partner_create', entityType: 'grant_campaign', entityId: c.id,
        after: { slug, ...pick(c), courseIds: c.courseIds }, reason: opts.reason,
      })
      return c
    })
    return this.shape(row, now)
  }

  async update(id: string, input: PartnerInput, actorId: string, now = new Date()) {
    const before = await this.byId(id)
    if (input.slug !== undefined && normalizePartnerSlug(input.slug) !== partnerSlugOf(before.slug)) {
      throw new AuthError('slug_fixed', 'الرابط لا يتغير بعد إنشاء الشريك، فهو في كل رابط نشر', 400)
    }
    const data = this.parse({ ...input, slug: undefined }, before.issuedCount)
    const after = await this.prisma.grantCampaign.update({ where: { id }, data: { ...data, updatedBy: actorId } })
    const [b, a] = [pick(before), pick(after)]
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      await recordAudit(this.prisma, {
        actorId, action: 'coupon.partner_update', entityType: 'grant_campaign', entityId: id, before: b, after: a,
        meta: { slug: partnerSlugOf(before.slug) },
      })
    }
    return this.shape(after, now)
  }

  /* ═══ الشعار ═══ */

  async requestLogo(id: string, input: { mime: string; sizeBytes: number }, actorId: string) {
    const c = await this.byId(id)
    assertFileUploadsEnabled('ارفعه حين يفعل رفع الملفات.')
    if (!(PHOTO_MIMES as readonly string[]).includes(input.mime)) throw new AuthError('bad_mime', 'الشعار صورة JPEG أو PNG أو WebP', 422)
    if (!(input.sizeBytes > 0 && input.sizeBytes <= MAX_PHOTO_BYTES)) throw new AuthError('too_large', 'الشعار حتى 1MB', 413)
    const storageKey = newStorageKey()
    await this.prisma.grantCampaign.update({ where: { id: c.id }, data: { logoPendingKey: storageKey, updatedBy: actorId } })
    /* ورفعٌ سابقٌ لم يكتمل يُمحى — لا يبقى على القرص ما لا يشير إليه أحد */
    if (c.logoPendingKey) await deleteObject(c.logoPendingKey).catch(() => {})
    return { uploadUrl: writeUrl(storageKey), maxBytes: MAX_PHOTO_BYTES }
  }

  /** يعتمد ما رُفع — بعد أن يكون على القرص، فلا يشير الشريكُ إلى صورةٍ لم تصل */
  async commitLogo(id: string, actorId: string, now = new Date()) {
    const c = await this.byId(id)
    if (!c.logoPendingKey || !(await objectExists(c.logoPendingKey))) throw new AuthError('not_uploaded', 'ارفع الشعار أولا', 409)
    const after = await this.prisma.grantCampaign.update({
      where: { id: c.id }, data: { logoKey: c.logoPendingKey, logoPendingKey: null, updatedBy: actorId },
    })
    if (c.logoKey) await deleteObject(c.logoKey).catch(() => {})
    await recordAudit(this.prisma, {
      actorId, action: 'coupon.partner_logo', entityType: 'grant_campaign', entityId: c.id,
      before: { hasLogo: c.logoKey !== null }, after: { hasLogo: true }, meta: { slug: partnerSlugOf(c.slug) },
    })
    return this.shape(after, now)
  }

  async removeLogo(id: string, actorId: string, now = new Date()) {
    const c = await this.byId(id)
    if (!c.logoKey) return this.shape(c, now)
    const after = await this.prisma.grantCampaign.update({ where: { id: c.id }, data: { logoKey: null, updatedBy: actorId } })
    await deleteObject(c.logoKey).catch(() => {})
    await recordAudit(this.prisma, {
      actorId, action: 'coupon.partner_logo', entityType: 'grant_campaign', entityId: c.id,
      before: { hasLogo: true }, after: { hasLogo: false }, meta: { slug: partnerSlugOf(c.slug) },
    })
    return this.shape(after, now)
  }

  /** مفتاحُ شعاره للمدير — ولو كان الشريكُ موقوفا */
  async adminLogoKey(id: string): Promise<string | null> {
    return (await this.byId(id)).logoKey
  }

  /** أيُخدَم هذا الشعارُ للعامّة؟ — لشريكٍ مشغَّلٍ وحدَه، ولا يُفرَّق في الجواب بين «لا شعار» و«موقوف» */
  async publicLogo(key: string): Promise<boolean> {
    return (await this.prisma.grantCampaign.count({ where: { logoKey: key, kind: 'partner', active: true } })) > 0
  }

  /* ═══ الصفحةُ العامّة ═══ */

  /** ما تعرضه صفحةُ الشريك: هو وشعارُه، وحالُ منحته، ودوراتُها بسعرها — كصفحات المنح (`GrantLandingService.view`) */
  async view(rawSlug: string, now = new Date()) {
    const c = await this.liveBySlug(rawSlug)
    const v = await new GrantLandingService(this.prisma, c.slug as `partner-${string}`).view(now)
    return {
      partner: {
        slug: partnerSlugOf(c.slug), nameAr: c.nameAr, nameEn: c.partnerNameEn, type: partnerTypeOf(c.partnerType),
        domains: c.emailDomains, logoUrl: partnerShownLogo(c),
      },
      campaign: v.campaign, termAr: v.termAr, openCourses: v.openCourses,
    }
  }

  /** يكتب بريدَه فيصله رابط — والجوابُ واحدٌ لكلّ بريدٍ على النطاق */
  async requestLink(
    rawSlug: string,
    input: { fullName: string; email: string; phone?: string | null; channel?: string | null; wave?: string | null },
    ip?: string, now = new Date(),
  ): Promise<{ sentTo: string; messageAr: string }> {
    const c = await this.liveBySlug(rawSlug)
    const type = partnerTypeOf(c.partnerType)
    const fullName = input.fullName.trim()
    const email = input.email.trim().toLowerCase()
    if (fullName.length < 2) throw new AuthError('bad_name', 'اكتب اسمك', 400)
    if (!emailMatchesDomains(email, c.emailDomains)) throw new AuthError('bad_email_domain', partnerBadEmailAr(type, c.emailDomains), 400)
    const phoneRaw = input.phone?.trim() || null
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null
    if (phoneRaw && !phone) throw new AuthError('bad_phone', 'رقم واتساب غير صحيح، اكتبه بالأرقام', 400)
    if (!isOpen(c, now)) throw new AuthError('grant_closed', 'المنحة مغلقة الآن', 409)

    const sentTo = maskEmail(email)
    const out = { sentTo, messageAr: partnerLinkSentAr(sentTo) }
    const recent = await this.prisma.partnerEmailLink.count({
      where: { campaignId: c.id, email, createdAt: { gt: new Date(now.getTime() - HOUR) } },
    })
    if (recent >= PARTNER_LINKS_PER_HOUR) return out

    const token = newToken()
    const link = `${publicSiteUrl()}${partnerPagePath(partnerSlugOf(c.slug))}/confirm?token=${encodeURIComponent(token)}`
    const t = PARTNER_TYPE_AR[type]
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.partnerEmailLink.create({
        data: {
          campaignId: c.id, email, fullName, phone, channel: campaignTag(input.channel), wave: campaignTag(input.wave),
          tokenHash: sha256(token), expiresAt: new Date(now.getTime() + MAIL_LINK_TTL_MS),
        },
      })
      await recordAudit(tx, {
        action: 'coupon.partner_link', entityType: 'grant_campaign', entityId: c.id, ip,
        meta: { linkId: row.id, campaign: c.slug },
      })
      await enqueueMail(tx, {
        to: email, purpose: 'grant.partner_link',
        subject: `أكد ${t.email} لمنحة ${c.nameAr}`,
        ...renderMail({
          greetingName: fullName,
          preheader: `افتح الرابط لتأخذ كود منحتك من ${partnerHeadlineAr(c.nameAr)}.`,
          heading: `أكد ${t.email}`,
          blocks: [
            { kind: 'callout', text: partnerHeadlineAr(c.nameAr) },
            { kind: 'p', text: `طلبت منحة ${t.audience} في أكاديمية وجيز. افتح الرابط ليظهر لك كود منحتك.` },
            { kind: 'cta', label: 'أكد بريدي وخذ الكود', href: link },
            { kind: 'note', text: `الرابط صالح ${MAIL_LINK_WINDOW_AR}، ويستعمل مرة واحدة. وإن لم تطلبه فتجاهل هذه الرسالة.` },
          ],
        }),
      })
    })
    return out
  }

  /** فتحُ الرابط: يُعلَّم مستعملا، ويُعطى عميلا محتملا وكودَه — أو كودَه نفسَه إن أكّد قبلُ */
  async confirm(rawSlug: string, token: string, ip?: string, now = new Date()) {
    const c = await this.liveBySlug(rawSlug)
    const row = await this.prisma.partnerEmailLink.findUnique({ where: { tokenHash: sha256(token) } })
    if (!row || row.campaignId !== c.id) throw new AuthError('bad_link', PARTNER_LINK_BAD_AR, 400)
    if (row.usedAt) throw new AuthError('link_used', PARTNER_LINK_USED_AR, 410)
    if (row.expiresAt <= now) throw new AuthError('link_expired', PARTNER_LINK_EXPIRED_AR, 410)
    /* مرّةً واحدة: الكتابةُ مشروطةٌ بأنّه لم يُستعمل — فنقرتان متزامنتان تمرّ إحداهما */
    const took = await this.prisma.partnerEmailLink.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } })
    if (took.count === 0) throw new AuthError('link_used', PARTNER_LINK_USED_AR, 410)

    /* عميلٌ محتملٌ واحدٌ لكلّ بريدٍ في الشريك — والبريدُ مؤكَّدٌ الآن */
    const had = await this.prisma.lead.findFirst({
      where: { campaign: c.slug, email: row.email, erasedAt: null }, orderBy: { createdAt: 'asc' },
    })
    const lead = had ?? await this.prisma.lead.create({
      data: {
        fullName: row.fullName, email: row.email, phone: row.phone, source: 'campaign', campaign: c.slug,
        consentAr: PARTNER_CONSENT_AR, channel: row.channel, wave: row.wave,
      },
    })
    await this.prisma.partnerEmailLink.update({ where: { id: row.id }, data: { leadId: lead.id } })
    await recordAudit(this.prisma, {
      action: 'coupon.partner_verify', entityType: 'lead', entityId: lead.id, ip,
      meta: { leadId: lead.id, campaign: c.slug, first: !had },
    })

    let grant: { code: string; percentOff: number; closesAt: Date | null } | null = null
    let reasonAr: string | null = null
    /* منحةٌ واحدةٌ لكلّ متعلّم: من دفع بكود منحةٍ أخرى لا يُعطى هذا (`grant_once` عند الدفع) — كنموذج المنح */
    const usedOther = await this.prisma.order.findFirst({
      where: {
        user: { email: row.email }, status: { in: BOUGHT },
        coupon: { grantCode: { campaign: { slug: { not: c.slug } } } },
      },
      select: { id: true },
    })
    if (usedOther) reasonAr = GRANT_ONCE_AR
    else try {
      const g = await new GrantService(this.prisma, c.slug as `partner-${string}`).issue({ leadId: lead.id }, now)
      grant = { code: g.code, percentOff: g.percentOff, closesAt: g.closesAt }
      if (!g.reused) await this.mailCode(c, lead.email ?? row.email, lead.fullName, g.code, g.percentOff, g.closesAt)
    } catch (e) {
      if (!(e instanceof AuthError) || !['grant_closed', 'grant_sold_out'].includes(e.code)) throw e
      reasonAr = e.message
    }
    const v = await this.view(partnerSlugOf(c.slug), now)
    return { ref: lead.id, name: lead.fullName, email: row.email, grant, reasonAr, ...v }
  }

  /** بريدُ الكود — بقالب الأكاديمية، ويسمّي الشراكة */
  private async mailCode(c: PartnerRow, to: string, name: string, code: string, percentOff: number, closesAt: Date | null) {
    const type = partnerTypeOf(c.partnerType)
    const last = closesAt ? fmtDate(new Date(closesAt.getTime() - 1)) : null
    await enqueueMail(this.prisma, {
      to, purpose: 'grant.code',
      subject: `كود منحتك من ${partnerHeadlineAr(c.nameAr)}`,
      ...renderMail({
        greetingName: name,
        preheader: `منحتك تصل إلى ${percentOff}% من سعر دورات أكاديمية وجيز.`,
        heading: 'منحتك جاهزة',
        blocks: [
          { kind: 'callout', text: partnerHeadlineAr(c.nameAr) },
          { kind: 'p', text: `يسعدنا أن نقدم لك منحة ${PARTNER_TYPE_AR[type].audience} في أكاديمية وجيز.` },
          { kind: 'facts', rows: [
            { label: 'كود منحتك', value: code },
            { label: 'المنحة', value: `تصل إلى ${percentOff}% من سعر الدورات` },
            { label: 'الدورات', value: `حتى ${c.maxCourses} دورات` },
            ...(last ? [{ label: 'آخر يوم', value: last }] : []),
          ] },
          { kind: 'cta', label: 'اختر دوراتك', href: `${publicSiteUrl()}${partnerPagePath(partnerSlugOf(c.slug))}` },
          { kind: 'p', text: 'لقاءات مباشرة على Zoom مع مدربين معتمدين، وتطبيقات عملية، وشهادة ورسالة توصية لمن يلتزم.' },
          { kind: 'note', text: 'يمكنك أن تستعمل الكود في أكثر من طلب حتى حد دوراته.' },
        ],
      }),
    })
  }

  /* ═══ من أكّد بريدَه — للمدير ═══ */

  async claims(id: string) {
    const c = await this.byId(id)
    const leads = await this.prisma.lead.findMany({
      where: { campaign: c.slug, erasedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, fullName: true, email: true, phone: true, createdAt: true, channel: true,
        grantCode: { select: { coupon: { select: { code: true, orders: {
          where: { status: { in: GRANT_HOLDS } },
          select: { status: true, total: true, items: { where: { unitPrice: { gt: 0 } }, select: { id: true } } },
        } } } } },
      },
    })
    return leads.map((l) => {
      const orders = l.grantCode?.coupon.orders ?? []
      const paid = orders.filter((o) => BOUGHT.includes(o.status))
      return {
        id: l.id, fullName: l.fullName, email: l.email, phone: l.phone, verifiedAt: l.createdAt, channel: l.channel,
        code: l.grantCode?.coupon.code ?? null,
        courses: paid.reduce((n, o) => n + o.items.length, 0),
        pending: orders.some((o) => o.status === 'pending_payment'),
        paidTotal: Math.round(paid.reduce((s, o) => s + Number(o.total), 0) * 100) / 100,
      }
    })
  }

  async claimsXlsx(id: string): Promise<{ buf: Buffer; nameAr: string }> {
    const c = await this.byId(id)
    const rows = await this.claims(id)
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('من أكد بريده')
    ws.columns = [
      { header: 'الاسم', key: 'name', width: 26 },
      { header: 'البريد', key: 'email', width: 32 },
      { header: 'واتساب', key: 'phone', width: 18 },
      { header: 'أكد بريده', key: 'at', width: 18 },
      { header: 'الكود', key: 'code', width: 16 },
      { header: 'دورات اشتراها', key: 'courses', width: 14 },
      { header: 'دفع', key: 'paid', width: 12 },
      { header: 'ينتظر الدفع', key: 'pending', width: 12 },
    ]
    for (const r of rows) {
      ws.addRow({
        name: r.fullName, email: r.email ?? '', phone: r.phone ?? '', at: `${zonedDay(r.verifiedAt)} ${zonedClock(r.verifiedAt)}`,
        code: r.code ?? '', courses: r.courses, paid: r.paidTotal, pending: r.pending ? 'نعم' : 'لا',
      })
    }
    ws.getRow(1).font = { bold: true }
    ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
    return { buf: Buffer.from(await wb.xlsx.writeBuffer()), nameAr: c.nameAr }
  }
}

/* ═══ الشريكُ الأوّل: الجامعة الهاشمية — يُنشأ مرّةً عند بدء العامل (١٥ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «الجامعة الهاشمية» شريكُنا الأوّل، بخصمٍ ٧٥٪ على ٤ دوراتٍ بلا نهاية، وبريدُ الجامعة وحدَه للتحقّق
   (`hu.edu.jo` وما تحته). وقاعدةُ الإنتاج لا تُبلَغ من هنا، فيُنشأ بنمط التصحيحات المعروف (`applyOpenGrantLaunch`):
   · **مرّةً واحدةً بأثره** — فإن حذفه صاحبُ المنصّة أو غيّره من شاشته بقي ما فعل.
   · **ولا يُنشأ إن كان له صفٌّ** — من أنشأه من الشاشة قبلُ لم يُمسّ.
   · **ويُنشأ موقوفا**: الصفحةُ لا تُفتح حتى يرفع شعارَ الجامعة ويشغّلها هو.
   · **ودوراتُه المقترحةُ لطلاب الجامعة** (`STUDENT_SUGGESTED_COURSES`) — ما يوجد منها في الكتالوج وحدَه، فمعرّفٌ لا يعرفه
     الإنتاجُ يُترك ولا يُسقط شيئا. ويغيّرها هو من «الشركاء». */
export const HU_LAUNCH_REASON = 'قرار صاحب المنصة (15 نوفمبر 2026): شراكة الجامعة الهاشمية بمنحة 75% على 4 دورات'

/* ═══ والثاني: جامعة الشرق الأوسط — بالنمط نفسِه، مشغَّلةً بشعارها (١٦ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «افتح صفحة لشريكين جديدين.. جامعة الشرق الأوسط وكاسيت.. والنسبة للجامعة ٥٠٪ كما موضّح بالعقد»، ولكاسيت
   كودُ مؤثّرٍ لا صفحةُ شريك. فالشرقُ الأوسط **مشغَّلةٌ** من أوّل يوم: «افتح صفحة»، وشعارُها مع الموقع (`BUILT_IN_PARTNER_LOGOS`) —
   والهاشميّةُ بقيت موقوفةً لأنّها بلا شعار. وكلُّ شريكٍ مزروعٍ مرّةً واحدةً بأثره وسببه، كما كانت الهاشميّة. */
export const MEU_LAUNCH_REASON = 'قرار صاحب المنصة (16 نوفمبر 2026): شراكة جامعة الشرق الأوسط بمنحة 50% على 4 دورات'

/** الشركاءُ المزروعون — كلٌّ بسببه ومشغَّلٌ أو موقوف */
const SEEDED_PARTNERS: readonly { partner: typeof HU_PARTNER | typeof MEU_PARTNER; reason: string; active: boolean }[] = [
  { partner: HU_PARTNER, reason: HU_LAUNCH_REASON, active: false },
  { partner: MEU_PARTNER, reason: MEU_LAUNCH_REASON, active: true },
]

/** يزرع ما لم يُزرع من الشركاء — ويعيد أسماءَ ما زُرع الآن */
export async function applyPartnerLaunch(prisma: PrismaClient): Promise<string[]> {
  const made: string[] = []
  for (const { partner: p, reason, active } of SEEDED_PARTNERS) {
    if (await prisma.grantCampaign.findUnique({ where: { slug: partnerCampaignSlug(p.slug) }, select: { id: true } })) continue
    if ((await prisma.auditEvent.count({ where: { action: 'coupon.partner_create', actorId: null, reason } })) > 0) continue
    const known = new Set((await prisma.course.findMany({ where: { id: { in: [...STUDENT_SUGGESTED_COURSES] } }, select: { id: true } })).map((x) => x.id))
    await new PartnerGrantService(prisma).create({
      slug: p.slug, nameAr: p.nameAr, nameEn: p.nameEn, type: p.type as PartnerType,
      domains: [...p.domains], percentOff: p.percentOff, maxCourses: p.maxCourses, maxCodes: null,
      closesAt: null, active,
    }, null, { reason, courseIds: STUDENT_SUGGESTED_COURSES.filter((id) => known.has(id)) })
    made.push(p.nameAr)
  }
  return made
}

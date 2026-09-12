/* خدمة التكاملات — مصدر واحد لإعدادات الدفع والبريد.
   القاعدة الذهبية: متغيرات البيئة تغلب قاعدة البيانات دائما (الإنتاج الحساس يُدار بيئيا)،
   وشاشة الإدارة تكتب الأسرار لكنها لا تقرأها أبدا إلا مقنَّعة (آخر 4 خانات فقط).
   لا يُعاد أي سر كاملا عبر أي نقطة API — الحفظ يتجاهل القيم المقنَّعة المعادة. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { hasExplicitSiteUrl, publicSiteUrl } from './notification.service'
import { getZoomConfig, zoomMissing, zoomReady } from './zoom.service'

export type PaymentDriver = 'test' | 'manual' | 'moyasar' | 'stripe'

export interface PaymentConfig {
  enabled: boolean
  driver: PaymentDriver
  publishableKey?: string
  secretKey?: string
  webhookSecret?: string
}

export interface EmailConfig {
  enabled: boolean
  apiKey?: string
  /** وجهةُ «ردّ» على الرسائل الآليّة — الدعمُ افتراضا */
  replyTo?: string
  fromName: string
  fromEmail: string
}

const MASK = /•{4}/ // القيمة المعادة من الواجهة مقنعة — لا تكتب فوق السر الحقيقي
const mask = (v?: string) => (v ? `••••${v.slice(-4)}` : '')

/* ── القراءة: البيئة أولا ثم قاعدة البيانات ── */

export async function getPaymentConfig(prisma: PrismaClient): Promise<PaymentConfig> {
  const row = await prisma.integrationSetting.findUnique({ where: { provider: 'payment' } })
  const c = (row?.config ?? {}) as Partial<PaymentConfig>
  const base: PaymentConfig = {
    enabled: row?.enabled ?? false,
    driver: (c.driver as PaymentDriver) ?? 'test',
    publishableKey: c.publishableKey || undefined,
    secretKey: c.secretKey || undefined,
    webhookSecret: c.webhookSecret || undefined,
  }
  /* غشاء البيئة — كل متغير موجود يغلب حقله من القاعدة استقلالا (الإنتاج يُدار بيئيا) */
  const env = process.env
  if (env.PAYMENT_DRIVER) { base.driver = env.PAYMENT_DRIVER as PaymentDriver; base.enabled = true }
  if (env.PAYMENT_PUBLISHABLE_KEY) base.publishableKey = env.PAYMENT_PUBLISHABLE_KEY
  if (env.PAYMENT_SECRET_KEY) base.secretKey = env.PAYMENT_SECRET_KEY
  if (env.PAYMENT_WEBHOOK_SECRET) base.webhookSecret = env.PAYMENT_WEBHOOK_SECRET
  return base
}

/* عنوان الأكاديمية الرسمي للاستقبال والإرسال — قرار المالك.

   كان الافتراضي سلسلة فارغة، وmail.ts يرفض الإرسال بلا عنوان مرسِل: فمن يفعّل
   القناة من شاشة التكاملات وينسى الحقل يجد قناةً «مفعّلة» لا ترسل شيئا. */
/* نسخةُ الخادم من عناوين الأكاديميّة — والأصلُ في `src/data/academy-email.ts`.
   لا يستورد الخادمُ من `src/`، فالتكرارُ لازم؛ ويحرس تطابقَهما
   `src/tests/academy-email.test.ts`. تُغيَّر النسختان معا أبدا.

   والتقسيمُ بالغاية مشروحٌ في الأصل: العناوينُ رخيصةٌ والصناديقُ ليست كذلك،
   فتُنشأ أسماءً مستعارةً تصبّ في صندوقٍ واحد. */
export const ACADEMY_EMAIL_DOMAIN = 'wajeezacademy.com'

export const ACADEMY_EMAILS = {
  noReply: `no-reply@${ACADEMY_EMAIL_DOMAIN}`,
  support: `support@${ACADEMY_EMAIL_DOMAIN}`,
  calendar: `calendar@${ACADEMY_EMAIL_DOMAIN}`,
} as const

/** المُرسِلُ الافتراضيُّ لكلّ رسالةٍ آليّة — لا يُقرأ ما يصله */
export const ACADEMY_EMAIL = ACADEMY_EMAILS.noReply

export async function getEmailConfig(prisma: PrismaClient): Promise<EmailConfig> {
  const row = await prisma.integrationSetting.findUnique({ where: { provider: 'email' } })
  const c = (row?.config ?? {}) as Partial<EmailConfig>
  const base: EmailConfig = {
    enabled: row?.enabled ?? false,
    apiKey: c.apiKey || undefined,
    replyTo: c.replyTo || undefined,
    fromName: c.fromName ?? 'أكاديمية وجيز', fromEmail: c.fromEmail || ACADEMY_EMAIL,
  }
  /* غشاء البيئة — كل متغير موجود يغلب حقله استقلالا، ووجود المفتاح يفعّل القناة */
  const env = process.env
  if (env.RESEND_API_KEY) { base.apiKey = env.RESEND_API_KEY; base.enabled = true }
  if (env.RESEND_FROM_NAME) base.fromName = env.RESEND_FROM_NAME
  if (env.RESEND_FROM_EMAIL) base.fromEmail = env.RESEND_FROM_EMAIL
  if (env.RESEND_REPLY_TO) base.replyTo = env.RESEND_REPLY_TO
  return base
}

/* ── الحفظ من شاشة الإدارة — قناع لا يكتب، وكل تغيير موثق ── */

/** المزودون المستضافون — يخرج إليهم المشتري ثمّ يعود بروابطَ نبنيها نحن */
const HOSTED_DRIVERS = new Set(['stripe', 'moyasar'])

export async function savePaymentConfig(prisma: PrismaClient, actorId: string, input: Partial<PaymentConfig>) {
  /* لا يُفعَّل مزوّدٌ مستضاف وعنوانُ الموقع غيرُ مضبوط.

     `createCharge` يبني `success_url` و`cancel_url` من `publicSiteUrl()`،
     واحتياطيُّه `http://localhost:7100`. فلو فُعِّل Stripe بلا `APP_URL`،
     خرج المشتري إلى صفحة الدفع ودفع ثمّ أُعيد إلى عنوانٍ لا يفتح عنده.
     والـwebhook مستقلّ عن المتصفّح، فالطلبُ
     يُسوّى والمقعدُ يُحجز والسجلّاتُ كلُّها خضراء — ولا يظهر العطبُ إلا عند
     المشتري وحدَه بعد أن دفع. فالرفضُ هنا، عند الحفظ، أرخصُ من اكتشافه هناك. */
  const driver = input.driver ?? 'test'
  if (input.enabled && HOSTED_DRIVERS.has(driver) && !hasExplicitSiteUrl()) {
    throw new AuthError(
      'site_url_missing',
      'اضبط APP_URL بعنوان الموقع أولا — بدونه يعود المشتري بعد الدفع إلى عنوان لا يفتح عنده',
      409,
    )
  }
  const current = await getRawConfig(prisma, 'payment')
  const next: Record<string, unknown> = { ...current, driver: input.driver ?? current.driver ?? 'test' }
  /* الأسرار تُستبدل فقط بقيمة جديدة صريحة — القناع أو الفراغ يبقي المخزن */
  for (const k of ['publishableKey', 'secretKey', 'webhookSecret'] as const) {
    const v = input[k]
    if (v && !MASK.test(v)) next[k] = v
  }
  const row = await prisma.integrationSetting.upsert({
    where: { provider: 'payment' },
    update: { config: next as Prisma.InputJsonValue, enabled: input.enabled ?? false, updatedBy: actorId },
    create: { provider: 'payment', config: next as Prisma.InputJsonValue, enabled: input.enabled ?? false, updatedBy: actorId },
  })
  await recordAudit(prisma, {
    actorId, action: 'integration.payment.save', entityType: 'integration_setting', entityId: 'payment',
    meta: { driver: next.driver, enabled: row.enabled, keysRotated: ['publishableKey', 'secretKey', 'webhookSecret'].filter((k) => input[k as keyof PaymentConfig] && !MASK.test(String(input[k as keyof PaymentConfig]))) },
  })
  return row
}

export async function saveEmailConfig(prisma: PrismaClient, actorId: string, input: Partial<EmailConfig>) {
  const current = await getRawConfig(prisma, 'email')
  const next: Record<string, unknown> = {
    ...current,
    fromName: input.fromName ?? current.fromName ?? 'أكاديمية وجيز',
    fromEmail: input.fromEmail ?? current.fromEmail ?? '',
  }
  if (input.apiKey && !MASK.test(input.apiKey)) next.apiKey = input.apiKey
  const row = await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { config: next as Prisma.InputJsonValue, enabled: input.enabled ?? false, updatedBy: actorId },
    create: { provider: 'email', config: next as Prisma.InputJsonValue, enabled: input.enabled ?? false, updatedBy: actorId },
  })
  await recordAudit(prisma, {
    actorId, action: 'integration.email.save', entityType: 'integration_setting', entityId: 'email',
    meta: { enabled: row.enabled, apiKeyRotated: !!(input.apiKey && !MASK.test(input.apiKey)) },
  })
  return row
}

/* إعدادُ Zoom — كبقيّة المزوّدين: البيئةُ تغلب، والسرُّ يُكتب ولا يُقرأ.
   وقراءتُه وفحصُه في `zoom.service.ts` كي تبقى نداءاتُ Zoom في موضعٍ واحد. */
export async function saveZoomConfig(
  prisma: PrismaClient, actorId: string,
  input: Partial<{ enabled: boolean; accountId: string; clientId: string; clientSecret: string; hostEmail: string }>,
) {
  const current = await getRawConfig(prisma, 'zoom')
  const next: Record<string, unknown> = {
    ...current,
    hostEmail: input.hostEmail ?? current.hostEmail ?? 'me',
  }
  /* المعرّفان ليسا سرّا لكنّهما يُقنَّعان في العرض، فيُعامَلان معاملتَه:
     لا يُكتب فوق المخزَّن بقيمةٍ مقنَّعةٍ عادت من الشاشة. */
  for (const k of ['accountId', 'clientId', 'clientSecret'] as const) {
    const v = input[k]
    if (v && !MASK.test(v)) next[k] = v
  }
  const row = await prisma.integrationSetting.upsert({
    where: { provider: 'zoom' },
    update: { config: next as Prisma.InputJsonValue, enabled: input.enabled ?? false, updatedBy: actorId },
    create: { provider: 'zoom', config: next as Prisma.InputJsonValue, enabled: input.enabled ?? false, updatedBy: actorId },
  })
  await recordAudit(prisma, {
    actorId, action: 'integration.zoom.save', entityType: 'integration_setting', entityId: 'zoom',
    meta: {
      enabled: row.enabled, hostEmail: next.hostEmail,
      keysRotated: (['accountId', 'clientId', 'clientSecret'] as const).filter((k) => input[k] && !MASK.test(String(input[k]))),
    },
  })
  return row
}

/* ─────────── Calendly — مفتاحُ التوقيع من الشاشة لا من الخادم ───────────

   كان يُقرأ من `process.env` وحدَه، فضبطُه يقتضي SSH وتحريرَ
   `deploy/.env.production` وإعادةَ نشر — وسائرُ التكاملات في هذه المنصّة
   تُضبط من شاشةٍ واحدة. فصار كأخواته: يُحفظ في القاعدة، والبيئةُ غشاءٌ
   يغلبه حين تُضبط (فما ضُبط بيئيّا في الإنتاج يبقى سيّدَ الموقف). */
export interface CalendlyConfig {
  enabled: boolean
  signingKey?: string
  /* ═══ ولماذا صار الرمزُ يُخزَّن بعد أن كان يُنسى ═══

     كُتب أوّلا ألّا يُخزَّن (١٢ سبتمبر ٢٠٢٦): كان يلزم للحظةِ تسجيلِ الاشتراك
     وحدَها، ومفتاحُ حسابِ Calendly كلِّه لا يُترك في قاعدةٍ بلا حاجة.

     ونُقض في اليوم نفسِه لسببٍ لم يكن معروفا حينها: الاشتراكُ خلفَ خطّةٍ
     مدفوعةٍ لا يملكها الحساب، فصارت المزامنةُ سؤالا دوريّا لا انتظارَ دفعٍ —
     والسؤالُ الدوريُّ يقتضي رمزا باقيا، إذ يسأل العاملُ الخلفيُّ كلَّ خمس
     دقائق بلا إنسانٍ يلصقه.

     فيُحفظ كما يُحفظ سرُّ Zoom وسرُّ الدفع: يُكتب ولا يُقرأ إلّا مقنَّعا،
     والبيئةُ تغلبه. وهذه كلفةُ ألّا يُدفع — سرٌّ زائدٌ ساكن. */
  token?: string
  /** رابطُ الحجز العامّ — فارغٌ يعني «استعمل المضمَّنَ في الواجهة» */
  bookingUrl?: string
}

/* ─────────── رابطُ الحجز: يُقبل بأيّ صورةٍ صحيحة، ويُشرَح حين لا يصحّ ───────────

   ═══ لماذا متساهلٌ عمدا ═══

   من يضبط هذا يلصق ما نسخه: مرّةً `hadeel-7/wajeez-academy`، ومرّةً الرابطَ
   كاملا، ومرّةً باسم المستخدم وحدَه، ومرّةً بـ`www` أو بشرطةٍ زائدةٍ في آخره.
   وكلُّها تعني الشيءَ نفسَه — فرفضُ أيٍّ منها تعنّتٌ لا تدقيق (قرارُ صاحب
   المنصّة، ١٢ سبتمبر ٢٠٢٦: «لا ترفض أيّ رابطٍ يعتبر صحيحا لنفس المنصّة،
   وأبلغه ما الخطأ إن كان هناك خطأ»).

   ═══ وما يُرفض يُسمّى سببُه ═══

   لا «رابطٌ غيرُ صالح» — بل أيُّ شيءٍ فيه، فيُصلحه اللاصقُ في ثانية. وأكثرُ
   الأخطاء وقوعا نسخُ عنوانِ **لوحة التحكّم** (`/event_types/…`) بدل رابط
   الحجز العامّ، وهما يتشابهان في الشريط ويفترقان تماما في ما يفتحه الزائر.

   ═══ ولماذا تُطرح المعاملات ═══

   `trainerInterviewUrl` تُلحق `?name=…&utm_content=…` بما يُخزَّن هنا. فلو
   بقي في المخزَّن `?month=2026-09` لصار الناتجُ `?month=…?name=…` — ويسقط
   معه رقمُ الطلب الذي تُطابَق به الحجوزات، بلا خطأٍ يظهر. */

const CALENDLY_HOST = 'calendly.com'

/** مساراتٌ في calendly.com ليست روابطَ حجز — لوحةُ التحكّم لا صفحةُ الزائر */
const CALENDLY_APP_PATHS = new Set(['app', 'event_types', 'events', 'login', 'signup', 'pages'])

export type CalendlyUrlCheck =
  | { ok: true; url: string }
  | { ok: false; messageAr: string }

export function normalizeCalendlyBookingUrl(input: string): CalendlyUrlCheck {
  /* علاماتُ الاتّجاه تُنسخ مع النصّ العربيّ ولا تُرى — وتُفسد المطابقة */
  const raw = input.replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim()
  if (!raw) return { ok: false, messageAr: 'الحقلُ فارغ — الصقِ الرابطَ أو اسمَ المستخدم.' }
  if (/\s/.test(raw)) {
    return { ok: false, messageAr: 'في الرابط فراغ — لعلّه نُسخ ناقصا أو معه نصٌّ آخر.' }
  }

  /* اسمُ المستخدم وحدَه أو مسارٌ بلا مضيف: يُكمَّل لا يُرفض */
  const withHost = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : raw.startsWith(CALENDLY_HOST) || raw.startsWith(`www.${CALENDLY_HOST}`)
      ? `https://${raw}`
      : `https://${CALENDLY_HOST}/${raw.replace(/^\/+/, '')}`

  let parsed: URL
  try {
    parsed = new URL(withHost)
  } catch {
    return { ok: false, messageAr: 'تعذّرت قراءةُ الرابط — راجع صيغتَه.' }
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  if (host !== CALENDLY_HOST) {
    return {
      ok: false,
      messageAr: `المضيفُ «${host}» ليس Calendly — والحجزُ يُضمَّن في الصفحة، ولا تسمح سياسةُ المحتوى بغيره.`,
    }
  }

  const segments = parsed.pathname.split('/').filter(Boolean).map((x) => decodeURIComponent(x))
  if (segments.length === 0) {
    return { ok: false, messageAr: 'هذا عنوانُ Calendly نفسِه بلا اسمِ مستخدم — أضف اسمَك أو نوعَ الموعد.' }
  }
  if (CALENDLY_APP_PATHS.has(segments[0].toLowerCase())) {
    return {
      ok: false,
      messageAr: 'هذا عنوانُ لوحة تحكّم Calendly لا رابطُ الحجز. افتح نوعَ الموعد واختر «Copy link» — يبدأ باسم المستخدم.',
    }
  }

  /* المعاملاتُ والمرساةُ تُطرحان: نحن نُلحق معاملاتِنا بعدها */
  return { ok: true, url: `https://${CALENDLY_HOST}/${segments.join('/')}` }
}

export async function getCalendlyConfig(prisma: PrismaClient): Promise<CalendlyConfig> {
  const row = await prisma.integrationSetting.findUnique({ where: { provider: 'calendly' } })
  const c = (row?.config ?? {}) as Partial<CalendlyConfig>
  const base: CalendlyConfig = {
    enabled: row?.enabled ?? false,
    signingKey: c.signingKey || undefined,
    token: c.token || undefined,
    bookingUrl: c.bookingUrl || undefined,
  }
  const env = process.env
  if (env.CALENDLY_WEBHOOK_SIGNING_KEY) {
    base.signingKey = env.CALENDLY_WEBHOOK_SIGNING_KEY
    base.enabled = true
  }
  if (env.CALENDLY_PAT) base.token = env.CALENDLY_PAT
  if (env.TRAINER_INTERVIEW_URL) base.bookingUrl = env.TRAINER_INTERVIEW_URL
  return base
}

export async function saveCalendlyConfig(
  prisma: PrismaClient, actorId: string,
  input: Partial<{ enabled: boolean; signingKey: string; token: string; bookingUrl: string }>,
) {
  const current = await getRawConfig(prisma, 'calendly')
  const next: Record<string, unknown> = { ...current }
  /* الرابطُ ليس سرّا فلا يُقنَّع — لكنّه يُطبَّع، ويُردّ سببُ الرفض إلى
     الشاشة نصّا يقرؤه إنسان. والفراغُ الصريحُ يعني العودةَ إلى المضمَّن. */
  if (input.bookingUrl !== undefined) {
    const trimmed = input.bookingUrl.trim()
    if (!trimmed) {
      delete next.bookingUrl
    } else {
      const checked = normalizeCalendlyBookingUrl(trimmed)
      if (!checked.ok) throw new AuthError('bad_booking_url', checked.messageAr, 422)
      next.bookingUrl = checked.url
    }
  }
  /* لا يُكتب فوق السرّ المخزَّن بقيمةٍ مقنَّعةٍ عادت من الشاشة */
  for (const k of ['signingKey', 'token'] as const) {
    const v = input[k]
    if (v && !MASK.test(v)) next[k] = v
  }
  const row = await prisma.integrationSetting.upsert({
    where: { provider: 'calendly' },
    update: { config: next as Prisma.InputJsonValue, enabled: input.enabled ?? false, updatedBy: actorId },
    create: { provider: 'calendly', config: next as Prisma.InputJsonValue, enabled: input.enabled ?? false, updatedBy: actorId },
  })
  await recordAudit(prisma, {
    actorId, action: 'integration.calendly.save', entityType: 'integration_setting', entityId: 'calendly',
    meta: {
      enabled: row.enabled,
      keysRotated: (['signingKey', 'token'] as const).filter((k) => input[k] && !MASK.test(String(input[k]))),
    },
  })
  return row
}

async function getRawConfig(prisma: PrismaClient, provider: string): Promise<Record<string, unknown>> {
  const row = await prisma.integrationSetting.findUnique({ where: { provider } })
  return (row?.config as Record<string, unknown>) ?? {}
}

/* ── عرض مقنَّع لشاشة الإدارة — لا سر كامل يغادر الخادم ── */

export async function maskedIntegrationsView(prisma: PrismaClient) {
  const [pay, mail, zoom, calendly] = await Promise.all([
    getPaymentConfig(prisma), getEmailConfig(prisma), getZoomConfig(prisma), getCalendlyConfig(prisma),
  ])
  const envSourced = {
    payment: !!process.env.PAYMENT_DRIVER,
    email: !!process.env.RESEND_API_KEY,
    zoom: !!process.env.ZOOM_ACCOUNT_ID,
    calendly: !!process.env.CALENDLY_WEBHOOK_SIGNING_KEY,
  }
  return {
    payment: {
      enabled: pay.enabled, driver: pay.driver, envSourced: envSourced.payment,
      publishableKey: mask(pay.publishableKey), secretKey: mask(pay.secretKey), webhookSecret: mask(pay.webhookSecret),
      hasSecret: !!pay.secretKey, hasWebhookSecret: !!pay.webhookSecret,
      /* عنوانُ الموقع يُعرض ويُوسَم: منه تُبنى روابطُ عودة المشتري من بوّابة
         الدفع، فصاحبُ المنصّة يراه قبل أن يحفظ لا في رسالة رفضٍ بعدها. */
      siteUrl: publicSiteUrl(), siteUrlExplicit: hasExplicitSiteUrl(),
    },
    email: {
      enabled: mail.enabled, envSourced: envSourced.email,
      apiKey: mask(mail.apiKey),
      fromName: mail.fromName, fromEmail: mail.fromEmail, hasApiKey: !!mail.apiKey,
    },
    zoom: {
      enabled: zoom.enabled, envSourced: envSourced.zoom,
      accountId: mask(zoom.accountId), clientId: mask(zoom.clientId), clientSecret: mask(zoom.clientSecret),
      hostEmail: zoom.hostEmail,
      hasAccountId: !!zoom.accountId, hasClientId: !!zoom.clientId, hasClientSecret: !!zoom.clientSecret,
      /* `ready` تُقال للشاشة صراحةً: «مفعّل» بلا مفاتيحَ ليس جاهزا، وهو الفرقُ
         الذي يجعل مديرا يظنّ التكاملَ قائما ثمّ يفشل أوّلُ لقاءٍ يُنشأ. */
      ready: zoomReady(zoom), missing: zoomMissing(zoom),
    },
    calendly: {
      enabled: calendly.enabled, envSourced: envSourced.calendly,
      signingKey: mask(calendly.signingKey), hasSigningKey: !!calendly.signingKey,
      /* عنوانُ المستقبِل يُعرض ليُنسخ إلى Calendly عند الحاجة، ويُبنى من
         عنوان الموقع نفسِه الذي تبني منه بوّابةُ الدفع روابطَ عودتها. */
      callbackUrl: `${publicSiteUrl()}/api/webhooks/calendly`,
      siteUrlExplicit: hasExplicitSiteUrl(),
      token: mask(calendly.token), hasToken: !!calendly.token,
      /* ═══ طريقان للمزامنة، والشاشةُ تقول أيُّهما قائم ═══

         `ready` مستقبِلٌ جاهزٌ للدفع (يقتضي اشتراكا، والاشتراكُ يقتضي خطّةً
         مدفوعة)، و`polling` سؤالٌ دوريٌّ يعمل على المجّانيّة. وأحدُهما يكفي —
         ولو اجتمعا فلا ازدواج: الإدخالُ يتجاهل التكرار. */
      ready: !!calendly.signingKey,
      polling: !!calendly.token && calendly.enabled,
      bookingUrl: calendly.bookingUrl ?? '',
    },
  }
}

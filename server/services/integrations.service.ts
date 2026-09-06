/* خدمة التكاملات — مصدر واحد لإعدادات الدفع والبريد.
   القاعدة الذهبية: متغيرات البيئة تغلب قاعدة البيانات دائما (الإنتاج الحساس يُدار بيئيا)،
   وشاشة الإدارة تكتب الأسرار لكنها لا تقرأها أبدا إلا مقنَّعة (آخر 4 خانات فقط).
   لا يُعاد أي سر كاملا عبر أي نقطة API — الحفظ يتجاهل القيم المقنَّعة المعادة. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { hasExplicitSiteUrl, publicSiteUrl } from './notification.service'

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

async function getRawConfig(prisma: PrismaClient, provider: string): Promise<Record<string, unknown>> {
  const row = await prisma.integrationSetting.findUnique({ where: { provider } })
  return (row?.config as Record<string, unknown>) ?? {}
}

/* ── عرض مقنَّع لشاشة الإدارة — لا سر كامل يغادر الخادم ── */

export async function maskedIntegrationsView(prisma: PrismaClient) {
  const [pay, mail] = await Promise.all([getPaymentConfig(prisma), getEmailConfig(prisma)])
  const envSourced = { payment: !!process.env.PAYMENT_DRIVER, email: !!process.env.RESEND_API_KEY }
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
  }
}

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
  host: string
  port: number
  secure: boolean
  user?: string
  pass?: string
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
export const ACADEMY_EMAIL = 'Academy@wajeez.co'

export async function getEmailConfig(prisma: PrismaClient): Promise<EmailConfig> {
  const row = await prisma.integrationSetting.findUnique({ where: { provider: 'email' } })
  const c = (row?.config ?? {}) as Partial<EmailConfig>
  const base: EmailConfig = {
    enabled: row?.enabled ?? false,
    host: c.host ?? '', port: Number(c.port ?? 465), secure: c.secure !== false,
    user: c.user || undefined, pass: c.pass || undefined,
    fromName: c.fromName ?? 'أكاديمية وجيز', fromEmail: c.fromEmail || ACADEMY_EMAIL,
  }
  /* غشاء البيئة — كل متغير موجود يغلب حقله استقلالا، ووجود المضيف يفعّل القناة */
  const env = process.env
  if (env.SMTP_HOST) { base.host = env.SMTP_HOST; base.enabled = true }
  if (env.SMTP_PORT) base.port = Number(env.SMTP_PORT)
  if (env.SMTP_SECURE) base.secure = env.SMTP_SECURE !== 'false'
  if (env.SMTP_USER) base.user = env.SMTP_USER
  if (env.SMTP_PASS) base.pass = env.SMTP_PASS
  if (env.SMTP_FROM_NAME) base.fromName = env.SMTP_FROM_NAME
  if (env.SMTP_FROM_EMAIL) base.fromEmail = env.SMTP_FROM_EMAIL
  return base
}

/* ── الحفظ من شاشة الإدارة — قناع لا يكتب، وكل تغيير موثق ── */

/** المزودون المستضافون — يخرج إليهم المشتري ثمّ يعود بروابطَ نبنيها نحن */
const HOSTED_DRIVERS = new Set(['stripe', 'moyasar'])

export async function savePaymentConfig(prisma: PrismaClient, actorId: string, input: Partial<PaymentConfig>) {
  /* لا يُفعَّل مزوّدٌ مستضاف وعنوانُ الموقع غيرُ مضبوط.

     `createCharge` يبني `success_url` و`cancel_url` من `publicSiteUrl()`،
     واحتياطيُّه `http://localhost:7100`. فلو فُعِّل Stripe بلا `APP_URL` ولا
     `VERCEL_PROJECT_PRODUCTION_URL`، خرج المشتري إلى صفحة الدفع ودفع ثمّ
     أُعيد إلى عنوانٍ لا يفتح عنده. والـwebhook مستقلّ عن المتصفّح، فالطلبُ
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
  if (input.host !== undefined && input.host.trim().length < 3) throw new AuthError('bad_host', 'أدخل مضيف SMTP صحيحا')
  const current = await getRawConfig(prisma, 'email')
  const next: Record<string, unknown> = {
    ...current,
    host: input.host ?? current.host ?? '',
    port: input.port ?? current.port ?? 465,
    secure: input.secure ?? current.secure ?? true,
    user: input.user ?? current.user ?? '',
    fromName: input.fromName ?? current.fromName ?? 'أكاديمية وجيز',
    fromEmail: input.fromEmail ?? current.fromEmail ?? '',
  }
  if (input.pass && !MASK.test(input.pass)) next.pass = input.pass
  const row = await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { config: next as Prisma.InputJsonValue, enabled: input.enabled ?? false, updatedBy: actorId },
    create: { provider: 'email', config: next as Prisma.InputJsonValue, enabled: input.enabled ?? false, updatedBy: actorId },
  })
  await recordAudit(prisma, {
    actorId, action: 'integration.email.save', entityType: 'integration_setting', entityId: 'email',
    meta: { host: next.host, enabled: row.enabled, passRotated: !!(input.pass && !MASK.test(input.pass)) },
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
  const envSourced = { payment: !!process.env.PAYMENT_DRIVER, email: !!process.env.SMTP_HOST }
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
      host: mail.host, port: mail.port, secure: mail.secure,
      user: mail.user ?? '', pass: mask(mail.pass),
      fromName: mail.fromName, fromEmail: mail.fromEmail, hasPass: !!mail.pass,
    },
  }
}

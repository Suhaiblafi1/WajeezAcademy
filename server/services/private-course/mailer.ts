/* ═══ بريدُ الدورة الخاصّة — من Gmail صاحبها لا من بريد الأكاديميّة (١٩ نوفمبر ٢٠٢٦) ═══

   قرارُه: «المرسل هو suhaiblafi2@gmail.com.. ولا تضع لوقو وجيز.. فهذا عملٌ خاصّ». وبريدُ المنصّة كلُّه يخرج من Resend
   على نطاق الأكاديميّة (`mail.ts`)، وResend لا يُرسل من `gmail.com`: النطاقُ لا يُوثَّق إلّا لمالكه. فالإرسالُ هنا
   بـSMTP حسابِه نفسِه — `smtp.gmail.com` بكلمة مرور تطبيق — فتصل الرسالةُ من بريده ويُجاب عليه، وتبقى في «المرسَل».

   ── ولماذا المنفذ ٥٨٧ لا ٤٦٥ ──
   الخادمُ على Hetzner، وHetzner يغلق ٢٥ و٤٦٥ للخارج افتراضا ويترك ٥٨٧. فالاتّصالُ عاديٌّ ثمّ يُرقّى إلى TLS
   (`requireTLS`) — ولا يُرسل شيءٌ قبل الترقية.

   ── وكلمةُ المرور ──
   تُكتب من اللوحة الخاصّة ولا تُقرأ منها إلّا آخرَ أربعِ خانات، كمفاتيح التكاملات. وتُحفظ مختومةً (AES-256-GCM)
   بمفتاحٍ مشتقٍّ من سرّ المنصّة (`derivedSecret`): كلمةُ مرور تطبيق Gmail تفتح الصندوقَ كلَّه، فنسخةٌ من القاعدة
   وحدَها لا تكشفها. ومتغيّرا البيئة `PRIVATE_GMAIL_USER` و`PRIVATE_GMAIL_APP_PASSWORD` يغلبان القاعدةَ إن ضُبطا.

   ── والبوّابة ──
   لا يخرج بريدٌ حقيقيٌّ إلّا من بيئة إرسال (`liveMailAllowed`) — كبريد المنصّة تماما. */

import type { PrismaClient } from '@prisma/client'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import nodemailer from 'nodemailer'
import { derivedSecret } from '../storage.service'
import { liveMailAllowed, MAIL_GATE_REFUSAL_AR } from '../../../src/application/notifications/mail-gate'

export const PRIVATE_SENDER_EMAIL = 'suhaiblafi2@gmail.com'
export const PRIVATE_SENDER_NAME = 'صهيب الخوالدة'

const PROVIDER = 'private_gmail'

export interface GmailConfig {
  user: string
  appPassword?: string
  /** من أين جاءت كلمةُ المرور — تقولها اللوحةُ كي لا يُكتب في الشاشة ما تغلبه البيئة */
  source: 'env' | 'db' | 'none'
}

/* ── الختم ── */

function key(): Buffer {
  return derivedSecret('private-gmail:v1')
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join(':')
}

export function openSecret(sealed: string): string | null {
  const [v, iv, tag, ct] = sealed.split(':')
  if (v !== 'v1' || !iv || !tag || !ct) return null
  try {
    const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'))
    d.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8')
  } catch {
    /* تغيّر سرُّ المنصّة — تُعاد كتابتُها من اللوحة، ولا يُرسل بكلمةٍ لا تُفكّ */
    return null
  }
}

/* ── القراءةُ والحفظ ── */

export async function getGmailConfig(prisma: PrismaClient): Promise<GmailConfig> {
  const env = process.env
  const row = await prisma.integrationSetting.findUnique({ where: { provider: PROVIDER } })
  const c = (row?.config ?? {}) as { user?: string; sealedPassword?: string }
  const user = env.PRIVATE_GMAIL_USER?.trim() || c.user || PRIVATE_SENDER_EMAIL
  if (env.PRIVATE_GMAIL_APP_PASSWORD?.trim()) return { user, appPassword: env.PRIVATE_GMAIL_APP_PASSWORD.replace(/\s+/g, ''), source: 'env' }
  const appPassword = c.sealedPassword ? openSecret(c.sealedPassword) ?? undefined : undefined
  return { user, appPassword, source: appPassword ? 'db' : 'none' }
}

export async function gmailView(prisma: PrismaClient) {
  const c = await getGmailConfig(prisma)
  return {
    user: c.user,
    ready: Boolean(c.appPassword),
    source: c.source,
    passwordTail: c.appPassword ? `••••${c.appPassword.slice(-4)}` : '',
    live: liveMailAllowed(),
  }
}

/** كلمةُ مرور التطبيق تُعرض في Google بمسافات (`abcd efgh ijkl mnop`) — تُحفظ بلاها */
export async function saveGmailConfig(prisma: PrismaClient, input: { user?: string; appPassword?: string }) {
  const row = await prisma.integrationSetting.findUnique({ where: { provider: PROVIDER } })
  const prev = (row?.config ?? {}) as { user?: string; sealedPassword?: string }
  const next = { ...prev }
  if (input.user !== undefined) next.user = input.user.trim().toLowerCase() || PRIVATE_SENDER_EMAIL
  if (input.appPassword !== undefined) {
    const clean = input.appPassword.replace(/\s+/g, '')
    if (clean) next.sealedPassword = sealSecret(clean)
    else delete next.sealedPassword
  }
  await prisma.integrationSetting.upsert({
    where: { provider: PROVIDER },
    create: { provider: PROVIDER, enabled: Boolean(next.sealedPassword), config: next },
    update: { enabled: Boolean(next.sealedPassword), config: next },
  })
  return gmailView(prisma)
}

/* ── الإرسال ── */

export interface PrivateMail {
  to: string
  toName?: string
  subject: string
  html: string
  text: string
  attachments?: { filename: string; content: Buffer; contentType: string }[]
  /** دعوةُ التقويم — تُرسل جزءا بديلا `text/calendar` فيعرضها Gmail بطاقةَ موعد */
  ics?: string
}

export type PrivateMailSender = (config: GmailConfig, mail: PrivateMail) => Promise<void>

const smtpSender: PrivateMailSender = async (config, mail) => {
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: config.user, pass: config.appPassword },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  })
  await transport.sendMail({
    from: { name: PRIVATE_SENDER_NAME, address: config.user },
    to: mail.toName ? { name: mail.toName, address: mail.to } : mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    attachments: mail.attachments,
    ...(mail.ics ? { icalEvent: { filename: 'invite.ics', method: 'REQUEST', content: mail.ics } } : {}),
  })
}

let sender: PrivateMailSender = smtpSender

/** للاختبار وحدَه: مُرسِلٌ يلتقط الرسالةَ بدل الشبكة — و`null` يعيد SMTP */
export function setPrivateMailSenderForTests(fn: PrivateMailSender | null): void {
  sender = fn ?? smtpSender
}

function readableError(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; message?: string }
  if (err?.code === 'EAUTH' || err?.responseCode === 535) {
    return 'رفض Gmail الدخول — تأكد من البريد وكلمة مرور التطبيق'
  }
  if (err?.code === 'ETIMEDOUT' || err?.code === 'ECONNECTION' || err?.code === 'ESOCKET' || err?.code === 'EDNS') {
    return 'تعذر الوصول إلى Gmail من الخادم — أعد المحاولة بعد قليل'
  }
  if (err?.responseCode === 550 || err?.responseCode === 553) return 'رفض Gmail عنوان المستلم'
  if (err?.responseCode === 452 || err?.responseCode === 454) return 'تجاوزت حد الإرسال اليومي في Gmail — أعد المحاولة غدا'
  return `تعذر الإرسال: ${err?.message ?? String(e)}`
}

/** ردُّ Gmail على المستلم نفسِه (لا على الدخول ولا الشبكة) — فإعادتُه لا تغيّر شيئا */
function recipientRefused(e: unknown): boolean {
  const code = (e as { responseCode?: number })?.responseCode
  return code === 550 || code === 553
}

export type PrivateMailResult = { ok: true } | { ok: false; error: string; /** رُفض المستلم — لا تُعاد */ recipient?: boolean }

export async function sendPrivateMail(prisma: PrismaClient, mail: PrivateMail): Promise<PrivateMailResult> {
  const config = await getGmailConfig(prisma)
  if (!config.appPassword) return { ok: false, error: 'بريد Gmail غير مضبوط — اكتب كلمة مرور التطبيق في الإعدادات' }
  if (sender === smtpSender && !liveMailAllowed()) return { ok: false, error: MAIL_GATE_REFUSAL_AR }
  try {
    await sender(config, mail)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: readableError(e), ...(recipientRefused(e) ? { recipient: true } : {}) }
  }
}

/** هل يخرج بريدٌ الآن؟ — للعامل: لا يحاول ولا يكتب خطأً كلَّ ساعةٍ وGmail لم يُضبط بعد أو البيئةُ لا ترسل */
export async function privateMailReady(prisma: PrismaClient): Promise<boolean> {
  const config = await getGmailConfig(prisma)
  if (!config.appPassword) return false
  return sender !== smtpSender || liveMailAllowed()
}

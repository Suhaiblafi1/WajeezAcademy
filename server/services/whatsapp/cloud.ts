/* ═══ WhatsApp Cloud API — الإعدادُ والنداءُ والتوقيع (٢٤ نوفمبر ٢٠٢٦) ═══

   الأسرارُ كسائر التكاملات: تُكتب ولا تُقرأ إلّا مقنَّعة، والبيئةُ تغلب القاعدة. والإرسالُ **مغلقٌ افتراضا** ولا يُفتح
   قبل أن تكتمل الأربعة (رقم، حساب، رمز، سرّ التطبيق): بلا السرّ لا يُتحقَّق من وارد، فلا يُعرف من قال «توقف». */

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { recordAudit } from '../audit'
import { AuthError } from '../auth.service'
import { publicSiteUrl } from '../notification.service'
import { WA_DEFAULT_DAILY_CAP, templateSlots, type WaCategory } from '../../../src/application/marketing/whatsapp-send'

const PROVIDER = 'whatsapp_cloud'
const API = 'https://graph.facebook.com/v24.0'
const MASKED = /•{4}/
const mask = (v?: string) => (v ? `••••${v.slice(-4)}` : '')

export interface CloudConfig {
  enabled: boolean
  phoneNumberId?: string
  wabaId?: string
  token?: string
  appSecret?: string
  verifyToken?: string
  dailyCap: number
}

const SECRETS = ['token', 'appSecret', 'verifyToken'] as const
const ENV = {
  phoneNumberId: 'WHATSAPP_PHONE_NUMBER_ID', wabaId: 'WHATSAPP_WABA_ID', token: 'WHATSAPP_CLOUD_TOKEN',
  appSecret: 'WHATSAPP_APP_SECRET', verifyToken: 'WHATSAPP_VERIFY_TOKEN',
} as const

export async function cloudConfig(prisma: PrismaClient): Promise<CloudConfig> {
  const row = await prisma.integrationSetting.findUnique({ where: { provider: PROVIDER } })
  const c = (row?.config ?? {}) as Partial<CloudConfig>
  const out: CloudConfig = { enabled: row?.enabled ?? false, dailyCap: Number(c.dailyCap) || WA_DEFAULT_DAILY_CAP }
  for (const k of Object.keys(ENV) as (keyof typeof ENV)[]) out[k] = process.env[ENV[k]] || c[k] || undefined
  return out
}

export const cloudMissing = (c: CloudConfig): string[] => [
  !c.phoneNumberId && 'معرف الرقم', !c.wabaId && 'معرف الحساب', !c.token && 'رمز الوصول',
  !c.appSecret && 'سر التطبيق', !c.verifyToken && 'رمز التحقق',
].filter((v): v is string => !!v)

export const cloudReady = (c: CloudConfig) => c.enabled && cloudMissing(c).length === 0

export async function cloudView(prisma: PrismaClient) {
  const c = await cloudConfig(prisma)
  return {
    enabled: c.enabled, ready: cloudReady(c), missing: cloudMissing(c), dailyCap: c.dailyCap,
    phoneNumberId: c.phoneNumberId ?? '', wabaId: c.wabaId ?? '',
    token: mask(c.token), appSecret: mask(c.appSecret), verifyToken: mask(c.verifyToken),
    webhookUrl: `${publicSiteUrl()}/api/webhooks/whatsapp-cloud`,
  }
}

export type CloudInput = Partial<Omit<CloudConfig, 'enabled'>> & { enabled: boolean }

export async function saveCloudConfig(prisma: PrismaClient, actorId: string, input: CloudInput, ip?: string) {
  const row = await prisma.integrationSetting.findUnique({ where: { provider: PROVIDER } })
  const next = { ...((row?.config ?? {}) as Record<string, unknown>) }
  for (const k of ['phoneNumberId', 'wabaId'] as const) {
    const v = input[k]?.trim()
    if (v === undefined) continue
    if (v && !/^\d{5,25}$/.test(v)) throw new AuthError('bad_id', 'المعرف أرقام فقط', 422)
    next[k] = v
  }
  for (const k of SECRETS) {
    const v = input[k]?.trim()
    if (v && !MASKED.test(v)) next[k] = v
  }
  if (input.dailyCap !== undefined) next.dailyCap = input.dailyCap
  const merged: CloudConfig = { ...(next as Partial<CloudConfig>), enabled: input.enabled, dailyCap: Number(next.dailyCap) || WA_DEFAULT_DAILY_CAP }
  for (const k of Object.keys(ENV) as (keyof typeof ENV)[]) if (process.env[ENV[k]]) merged[k] = process.env[ENV[k]]
  const missing = cloudMissing(merged)
  if (input.enabled && missing.length) throw new AuthError('incomplete', `لا يفتح الإرسال قبل: ${missing.join('، ')}`, 422)
  const config = next as Prisma.InputJsonValue
  await prisma.integrationSetting.upsert({
    where: { provider: PROVIDER },
    update: { config, enabled: input.enabled, updatedBy: actorId },
    create: { provider: PROVIDER, config, enabled: input.enabled, updatedBy: actorId },
  })
  await recordAudit(prisma, {
    action: 'whatsapp.config', entityType: 'integration_setting', entityId: PROVIDER, actorId, ip,
    meta: { enabled: input.enabled, dailyCap: merged.dailyCap },
  })
  return cloudView(prisma)
}

/** توقيعُ Meta على الجسم الخام — بزمنٍ ثابت، وبلا سرٍّ يُرفض كلُّ شيء */
export function cloudSignatureOk(raw: string, header: string | undefined, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith('sha256=')) return false
  const want = createHmac('sha256', secret).update(raw).digest()
  const got = Buffer.from(header.slice(7), 'hex')
  return got.length === want.length && timingSafeEqual(got, want)
}

export class CloudError extends Error {
  readonly code: number | null
  readonly retry: boolean
  constructor(message: string, code: number | null, retry: boolean) {
    super(message)
    this.code = code
    this.retry = retry
  }
}

/** أكوادُ Meta التي تزول وحدَها: السرعةُ وحدُّ اليوم — تُؤجَّل ولا تسقط */
const RETRY = new Set([4, 80007, 130429, 131048, 131056])

async function call(c: CloudConfig, path: string, init?: { method: string; body: unknown }) {
  let res: Response
  try {
    res = await fetch(`${API}/${path}`, {
      method: init?.method ?? 'GET',
      headers: { authorization: `Bearer ${c.token}`, ...(init ? { 'content-type': 'application/json' } : {}) },
      ...(init ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    /* انقطع بعد أن خرج الطلبُ أو قبله — لا يُعرف. فلا يُعاد: رسالةٌ مرّتين أسوأُ من رسالةٍ تُسأل عنها */
    throw new CloudError('انقطع الاتصال مع Meta، ولا نعرف هل وصلت', null, false)
  }
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & Record<string, unknown>
  if (!res.ok) {
    const code = json.error?.code ?? null
    throw new CloudError((json.error?.message ?? `HTTP ${res.status}`).slice(0, 300), code, code !== null && RETRY.has(code))
  }
  return json
}

async function post(c: CloudConfig, phone: string, rest: Record<string, unknown>): Promise<string> {
  const out = await call(c, `${c.phoneNumberId}/messages`, {
    method: 'POST',
    body: { messaging_product: 'whatsapp', recipient_type: 'individual', to: phone.replace(/\D/g, ''), ...rest },
  })
  const id = (out.messages as { id?: string }[] | undefined)?.[0]?.id
  if (!id) throw new CloudError('لم ترجع Meta معرف الرسالة', null, false)
  return id
}

export const postTemplate = (c: CloudConfig, phone: string, t: { name: string; language: string; params: string[] }) => post(c, phone, {
  type: 'template',
  template: {
    name: t.name, language: { code: t.language },
    ...(t.params.length ? { components: [{ type: 'body', parameters: t.params.map((text) => ({ type: 'text', text })) }] } : {}),
  },
})

export const postText = (c: CloudConfig, phone: string, body: string) => post(c, phone, { type: 'text', text: { body } })

export interface CloudTemplate {
  name: string
  language: string
  category: WaCategory
  body: string
  slots: number
  /** لماذا لا يُرسل من هنا، أو `null` */
  unsupportedAr: string | null
}

type RawComponent = { type?: string; format?: string; text?: string; buttons?: { type?: string; url?: string }[] }
type RawTemplate = { name?: string; language?: string; status?: string; category?: string; components?: RawComponent[] }

export function readTemplate(t: RawTemplate): CloudTemplate | null {
  if (t.status !== 'APPROVED' || !t.name || !t.language || (t.category !== 'UTILITY' && t.category !== 'MARKETING')) return null
  const body = t.components?.find((c) => c.type === 'BODY')?.text ?? ''
  const slots = templateSlots(body)
  const header = t.components?.find((c) => c.type === 'HEADER')
  const buttons = t.components?.find((c) => c.type === 'BUTTONS')?.buttons ?? []
  const unsupportedAr = slots === null ? 'خاناته بأسماء لا بأرقام'
    : header && (header.format !== 'TEXT' || /\{\{/.test(header.text ?? '')) ? 'في رأسه صورة أو خانة'
      : buttons.some((b) => /\{\{/.test(b.url ?? '') || !['URL', 'QUICK_REPLY', 'PHONE_NUMBER'].includes(b.type ?? '')) ? 'في زره خانة'
        : null
  return { name: t.name, language: t.language, category: t.category, body, slots: slots ?? 0, unsupportedAr }
}

export async function cloudTemplates(prisma: PrismaClient): Promise<CloudTemplate[]> {
  const c = await cloudConfig(prisma)
  if (!c.wabaId || !c.token) throw new AuthError('not_connected', 'اربط حساب واتساب أولا', 409)
  try {
    const out = await call(c, `${c.wabaId}/message_templates?fields=name,language,status,category,components&limit=200`)
    return ((out.data as RawTemplate[] | undefined) ?? []).map(readTemplate).filter((t): t is CloudTemplate => !!t)
  } catch (e) {
    throw new AuthError('meta_error', `لم نقرأ القوالب من Meta: ${e instanceof Error ? e.message : ''}`, 502)
  }
}

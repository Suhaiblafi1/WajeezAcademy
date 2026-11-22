/* ═══ إبلاغُ Meta بالشراء حين يتأكّد الحجز — Conversions API (٢١ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة (اقتراحُ «٤»): «نفّذ ٤». البكسلُ في الصفحة يقول لـMeta من حجز (`Lead`)، ولا يعرف من دفع: الدفعُ حوالةٌ
   يؤكّدها صاحبُ الدورة بيده بعد ساعاتٍ أو أيّام. فحين يتأكّد حجزٌ يُرسل الخادمُ إلى Meta حدثَ `Purchase` باسمه، فيبحث
   الإعلانُ عن أشباه من دفع لا من عبّأ النموذجَ وحدَه.

   - **المطابقة**: بريدُه ورقمُه واسمُه وبلدُه مجزّأةً بـSHA-256 كما يطلب Meta (لا تخرج نصّا)، وكعكتا البكسل (`_fbp`،
     `_fbc`) ومتصفّحُه وعنوانُه وقتَ الحجز (`metaClick`) كما هي.
   - **القيمة**: سعرُه بالدولار — ٢٠، أو ٢٨ للاثنين. والاثنان حدثٌ واحدٌ باسم من دفع: صديقُه لم يشترِ شيئا.
   - **مرّةً واحدة**: `metaSentAt` على الصفّ، و`event_id` ثابتٌ للحجز فلا يعدّه Meta مرّتين لو أُعيد.
   - **لا يُسقط التأكيد**: إخفاقُ Meta يُكتب في `metaError` ويُعاد من اللوحة، والتأكيدُ وبريدُه تمّا قبله.
   - **المفتاح**: «رمز الوصول» من Events Manager يُلصق في `/private` ويُختم كمفتاح Gmail، والبيئةُ تغلبه
     (`PRIVATE_META_TOKEN`). ولا يخرج حدثٌ من بيئةٍ لا ترسل (`liveMailAllowed`) — كالبريد تماما.

   ولا يمرّ بأثر الأكاديميّة ولا بتكاملاتها: المساحةُ الخاصّة منفصلة (CLAUDE.md). */

import { createHash } from 'node:crypto'
import type { Prisma, PrismaClient, PrivateRegistration } from '@prisma/client'
import { AuthError } from '../auth.service'
import { publicSiteUrl } from '../site-url'
import { liveMailAllowed } from '../../../src/application/notifications/mail-gate'
import { AI_JOBS, META_PIXEL_ID } from '../../../src/application/private-course/ai-jobs'
import { openSecret, sealSecret } from './mailer'

const PROVIDER = 'private_meta'
/** نسخةُ Graph — تُرفع حين تقترب من انتهاء دعمها (سنتان من صدورها) */
export const GRAPH_VERSION = 'v23.0'

interface StoredConfig {
  sealedToken?: string
  testCode?: string
  lastSentAt?: string
  lastError?: string
}

async function stored(prisma: PrismaClient): Promise<StoredConfig> {
  const row = await prisma.integrationSetting.findUnique({ where: { provider: PROVIDER } })
  return (row?.config ?? {}) as StoredConfig
}

async function write(prisma: PrismaClient, next: StoredConfig): Promise<void> {
  const config = next as unknown as Prisma.InputJsonValue
  await prisma.integrationSetting.upsert({
    where: { provider: PROVIDER },
    create: { provider: PROVIDER, enabled: Boolean(next.sealedToken), config },
    update: { enabled: Boolean(next.sealedToken), config },
  })
}

async function metaToken(prisma: PrismaClient): Promise<{ token?: string; source: 'env' | 'db' | 'none'; testCode?: string }> {
  const c = await stored(prisma)
  const env = process.env.PRIVATE_META_TOKEN?.trim()
  if (env) return { token: env, source: 'env', testCode: c.testCode }
  const token = c.sealedToken ? openSecret(c.sealedToken) ?? undefined : undefined
  return { token, source: token ? 'db' : 'none', testCode: c.testCode }
}

export async function metaView(prisma: PrismaClient) {
  const c = await stored(prisma)
  const { token, source } = await metaToken(prisma)
  return {
    ready: Boolean(token),
    source,
    tokenTail: token ? `••••${token.slice(-4)}` : '',
    testCode: c.testCode ?? '',
    lastSentAt: c.lastSentAt ?? null,
    lastError: c.lastError ?? null,
    pixelId: META_PIXEL_ID,
    live: liveMailAllowed(),
  }
}

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{40,600}$/
const TEST_CODE = /^TEST[A-Za-z0-9]{2,20}$/

/** فارغُ الرمز يفصل الإبلاغ — والرمزُ لا يعاد إلّا مقنّعا */
export async function saveMetaConfig(prisma: PrismaClient, input: { token?: string; testCode?: string }) {
  const c = await stored(prisma)
  const next = { ...c }
  if (input.token !== undefined) {
    const clean = input.token.trim()
    if (clean && !TOKEN_SHAPE.test(clean)) throw new AuthError('bad_token', 'رمز الوصول غير صحيح — انسخه كاملا من Events Manager', 400)
    if (clean) next.sealedToken = sealSecret(clean)
    else delete next.sealedToken
  }
  if (input.testCode !== undefined) {
    const code = input.testCode.trim()
    if (code && !TEST_CODE.test(code)) throw new AuthError('bad_test_code', 'رمز الاختبار يبدأ بـ TEST', 400)
    if (code) next.testCode = code
    else delete next.testCode
  }
  await write(prisma, next)
  return metaView(prisma)
}

/* ── الحدث ── */

const sha = (v: string) => createHash('sha256').update(v).digest('hex')

interface MetaClick { fbp?: string; fbc?: string; ua?: string; ip?: string }

const SIX_DAYS = 6 * 24 * 3_600_000

/** حدثُ الشراء لحجزٍ مؤكَّد — وما لا يُعرف لا يُرسل */
export function purchaseEvent(r: PrivateRegistration, now: Date) {
  const click = (r.metaClick ?? {}) as MetaClick
  const names = r.fullName.trim().toLowerCase().split(/\s+/)
  const pair = r.pairRole === 'lead'
  /* Meta يردّ ما مضى عليه أكثرُ من سبعة أيّام — فالأقدمُ يُرسل بوقت إرساله */
  const at = r.confirmedAt && now.getTime() - r.confirmedAt.getTime() < SIX_DAYS ? r.confirmedAt : now
  return {
    event_name: 'Purchase',
    event_time: Math.floor(at.getTime() / 1000),
    event_id: `ai-jobs-purchase-${r.id}`,
    /* حدثُ الموقع يلزمه متصفّحُ صاحبه — ومن حجز قبل حفظه يُرسل «غيرَ ذلك» */
    action_source: click.ua ? 'website' : 'other',
    event_source_url: `${publicSiteUrl()}/ai-jobs`,
    user_data: {
      em: [sha(r.email.trim().toLowerCase())],
      ph: [sha(r.phone.replace(/\D/g, ''))],
      fn: [sha(names[0] ?? '')],
      ...(names.length > 1 ? { ln: [sha(names[names.length - 1])] } : {}),
      country: [sha(r.phoneCountry.toLowerCase())],
      external_id: [sha(r.id)],
      ...(click.fbp ? { fbp: click.fbp } : {}),
      ...(click.fbc ? { fbc: click.fbc } : {}),
      ...(click.ua ? { client_user_agent: click.ua } : {}),
      ...(click.ip ? { client_ip_address: click.ip } : {}),
    },
    custom_data: {
      currency: 'USD',
      value: pair ? AI_JOBS.pair.priceUsd : AI_JOBS.priceUsd,
      content_name: AI_JOBS.title,
      content_type: 'product',
      num_items: pair ? 2 : 1,
    },
  }
}

/* ── الإرسال ── */

export type MetaSender = (url: string, body: unknown) => Promise<{ ok: boolean; status: number; text: string }>

const httpSender: MetaSender = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  return { ok: res.ok, status: res.status, text: await res.text() }
}

let sender: MetaSender = httpSender

/** للاختبار وحدَه: مُرسِلٌ يلتقط الحدثَ بدل الشبكة — و`null` يعيد HTTP */
export function setMetaSenderForTests(fn: MetaSender | null): void {
  sender = fn ?? httpSender
}

function readable(status: number, text: string): string {
  try {
    const msg = (JSON.parse(text) as { error?: { message?: string } }).error?.message
    if (msg) return `ردّ Meta (${status}): ${msg.slice(0, 200)}`
  } catch { /* ليس JSON */ }
  return `ردّ Meta (${status})`
}

export type PurchaseReport = { sent: true } | { sent: false; reason: string }

/** يُبلغ Meta بشراء حجزٍ مؤكَّد — مرّةً واحدة، ولا يرمي: ما سقط يُكتب في `metaError` */
export async function reportPurchase(prisma: PrismaClient, id: string, now = new Date()): Promise<PurchaseReport> {
  const r = await prisma.privateRegistration.findUnique({ where: { id } })
  if (!r || r.status !== 'confirmed') return { sent: false, reason: 'not_confirmed' }
  /* الاثنان حدثٌ واحدٌ باسم من دفع — صديقُه لم يشترِ */
  if (r.pairRole === 'friend') return { sent: false, reason: 'friend' }
  if (r.metaSentAt) return { sent: false, reason: 'already' }
  const { token, testCode } = await metaToken(prisma)
  if (!token) return { sent: false, reason: 'no_token' }
  if (sender === httpSender && !liveMailAllowed()) return { sent: false, reason: 'not_live' }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events`
  const body = { data: [purchaseEvent(r, now)], access_token: token, ...(testCode ? { test_event_code: testCode } : {}) }
  let error: string | null = null
  try {
    const res = await sender(url, body)
    if (!res.ok) error = readable(res.status, res.text)
  } catch (e) {
    error = `تعذر الوصول إلى Meta: ${e instanceof Error ? e.message : String(e)}`
  }
  const c = await stored(prisma)
  if (error) {
    await prisma.privateRegistration.update({ where: { id }, data: { metaError: error } })
    await write(prisma, { ...c, lastError: error })
    return { sent: false, reason: error }
  }
  await prisma.privateRegistration.update({ where: { id }, data: { metaSentAt: now, metaError: null } })
  await write(prisma, { ...c, lastSentAt: now.toISOString(), lastError: undefined })
  return { sent: true }
}

/** المؤكَّدون الذين لم يُبلَّغ عنهم — قبل ضبط الرمز، أو سقط إبلاغُهم. يقف عند أوّل إخفاق: رمزٌ خاطئٌ لا يُجرَّب خمسين مرّة */
export async function reportPendingPurchases(prisma: PrismaClient, slug: string) {
  const rows = await prisma.privateRegistration.findMany({
    where: { courseSlug: slug, status: 'confirmed', metaSentAt: null, AND: [{ OR: [{ pairRole: null }, { pairRole: 'lead' }] }] },
    orderBy: { confirmedAt: 'asc' },
    take: 200,
  })
  let sent = 0
  let error: string | null = null
  for (const r of rows) {
    const out = await reportPurchase(prisma, r.id)
    if (out.sent) { sent += 1; continue }
    error = out.reason
    break
  }
  return { sent, left: rows.length - sent, error, meta: await metaView(prisma) }
}

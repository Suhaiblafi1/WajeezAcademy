/* ═══ مفتاحُ توقيع Stripe للدورة الخاصّة — يُختم في القاعدة كما تُختم كلمةُ مرور Gmail (٢١ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «نعم اربط Stripe ليتأكّد تلقائيّا». فـStripe يخبرنا بكلّ دفعٍ تمّ من رابط البطاقة، ونتحقّق
   أنّ الخبر منه بمفتاح التوقيع (`whsec_…`) الذي يعطيه حين يُنشأ الـwebhook في لوحته. والمفتاحُ يُكتب في لوحة
   `/private` لا في محادثة، ويُختم بـAES-GCM (`sealSecret`)، والبيئةُ تغلبه (`PRIVATE_STRIPE_WEBHOOK_SECRET`).

   ولا مفتاحَ سرّيّا لحساب Stripe هنا: مفتاحُ التوقيع يتحقّق من الخبر ولا يقبض ولا يردّ مالا.

   ومنفصلٌ عن تكامل الدفع في الأكاديميّة: مساحةُ صاحب المنصّة الخاصّة لا تمرّ بإعداداتها (CLAUDE.md). وفي ملفٍّ
   ورقةٍ لا يستورد خدمةَ التسجيل — كي لا تدور الاستيراداتُ بينها وبين معالج الحدث (`stripe-webhook.ts`). */

import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from '../auth.service'
import { openSecret, sealSecret } from './mailer'

const PROVIDER = 'private_stripe'
const UNMATCHED_KEEP = 20

/** دفعةٌ وصلت ولم نجد حجزها — تُعرض في اللوحة ليطابقها صاحبُ الدورة بيده */
export interface UnmatchedPayment {
  at: string
  sessionId: string
  email: string | null
  reference: string | null
  amount: number | null
  currency: string | null
  /** `no_match`: لا حجزَ بمرجعه ولا ببريده · `second`: حجزٌ دُفع له من قبل */
  reason: 'no_match' | 'second'
}

interface StoredConfig {
  sealedSecret?: string
  lastEventAt?: string
  lastEventType?: string
  unmatched?: UnmatchedPayment[]
}

async function stored(prisma: PrismaClient): Promise<StoredConfig> {
  const row = await prisma.integrationSetting.findUnique({ where: { provider: PROVIDER } })
  return (row?.config ?? {}) as StoredConfig
}

async function write(prisma: PrismaClient, next: StoredConfig): Promise<void> {
  const config = next as unknown as Prisma.InputJsonValue
  await prisma.integrationSetting.upsert({
    where: { provider: PROVIDER },
    create: { provider: PROVIDER, enabled: Boolean(next.sealedSecret), config },
    update: { enabled: Boolean(next.sealedSecret), config },
  })
}

export async function stripeSecret(prisma: PrismaClient): Promise<{ secret?: string; source: 'env' | 'db' | 'none' }> {
  const env = process.env.PRIVATE_STRIPE_WEBHOOK_SECRET?.trim()
  if (env) return { secret: env, source: 'env' }
  const c = await stored(prisma)
  const secret = c.sealedSecret ? openSecret(c.sealedSecret) ?? undefined : undefined
  return { secret, source: secret ? 'db' : 'none' }
}

/** هل يتأكّد دفعُ البطاقة وحدَه؟ — تقوله صفحةُ الدفع للحاجز */
export async function stripeAutoReady(prisma: PrismaClient): Promise<boolean> {
  return Boolean((await stripeSecret(prisma)).secret)
}

export async function stripeView(prisma: PrismaClient) {
  const c = await stored(prisma)
  const { secret, source } = await stripeSecret(prisma)
  return {
    ready: Boolean(secret),
    source,
    secretTail: secret ? `••••${secret.slice(-4)}` : '',
    /** آخرُ خبرٍ وصل من Stripe — يُعرف به أنّ الربطَ يعمل */
    lastEventAt: c.lastEventAt ?? null,
    lastEventType: c.lastEventType ?? null,
    unmatched: c.unmatched ?? [],
  }
}

const SECRET_SHAPE = /^whsec_[A-Za-z0-9+/=]{16,200}$/

/** فارغُه يفصل الربط — ويعود التأكيدُ باليد */
export async function saveStripeSecret(prisma: PrismaClient, raw: string) {
  const clean = raw.trim()
  if (clean && !SECRET_SHAPE.test(clean)) {
    throw new AuthError('bad_secret', 'مفتاح التوقيع يبدأ بـ whsec_ — انسخه من صفحة الـ webhook في Stripe', 400)
  }
  const c = await stored(prisma)
  const next = { ...c }
  if (clean) next.sealedSecret = sealSecret(clean)
  else delete next.sealedSecret
  await write(prisma, next)
  return stripeView(prisma)
}

export async function noteStripeEvent(prisma: PrismaClient, type: string, at: Date): Promise<void> {
  const c = await stored(prisma)
  await write(prisma, { ...c, lastEventAt: at.toISOString(), lastEventType: type })
}

export async function rememberUnmatched(prisma: PrismaClient, p: UnmatchedPayment): Promise<void> {
  const c = await stored(prisma)
  const list = (c.unmatched ?? []).filter((x) => x.sessionId !== p.sessionId)
  await write(prisma, { ...c, unmatched: [p, ...list].slice(0, UNMATCHED_KEEP) })
}

/** صاحبُ الدورة طابقها بيده — تُرفع من القائمة */
export async function dismissUnmatched(prisma: PrismaClient, sessionId: string) {
  const c = await stored(prisma)
  await write(prisma, { ...c, unmatched: (c.unmatched ?? []).filter((x) => x.sessionId !== sessionId) })
  return stripeView(prisma)
}

/* ═══ Stripe يخبر بدفع البطاقة — فيتأكّد الحجزُ ويصله بريدُ Zoom وحدَه (٢١ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «نعم اربط Stripe ليتأكّد تلقائيّا». وقبله: «الغِ خيارَ البطاقة.. لو دفع يصل له التأكيد مباشرة».

   - **الخبر**: `checkout.session.completed` حين يُدفع من رابط البطاقة، و`checkout.session.async_payment_succeeded` لما
     يتأخّر قبضُه. ولا يُعمل بخبرٍ لم يُقبض (`payment_status` غيرُ `paid`).
   - **التوقيع إلزاميّ** بصيغة Stripe (`t=…,v1=…`) ونافذةِ خمس دقائق — بلا مفتاحٍ مضبوطٍ يُردّ كلُّ خبرٍ بـ503 فيعيده
     Stripe حتى يُضبط، وبتوقيعٍ خاطئٍ يُردّ بـ400. فلا يؤكّد حجزا من لم يدفع.
   - **المطابقة**: رابطُ البطاقة يحمل رقمَ مرجع الحاجز (`client_reference_id`، `cardLinkFor`) — وهو أوّلُ ثمانية أحرفٍ من
     معرّفه. فإن غاب أو لم يطابق أحدا فبريدُ الدافع، بشرط أن يكون المبلغُ سعرَ الدورة: بريدٌ وحدَه قد يكون شراءً آخرَ من
     الحساب نفسِه. وما لم يُطابَق يُحفظ في قائمةٍ تراها اللوحة.
   - **التأكيد**: يُكتب الدفعُ على الحجز (`cardPaidAt` والمبلغُ ومعرّفُ Stripe)، ثمّ يتأكّد ويخرج بريدُ التأكيد كما لو ضغط
     صاحبُ الدورة «أكّد وأرسل البريد». إلّا أن يكون المبلغُ دون السعر: يُكتب ويبقى للمراجعة.
   - **مرّةً واحدة**: الخبرُ يُعاد (Stripe يعيد ما لم يُردّ عليه بنجاح)، فالجلسةُ تُحجز على الحجز بشرط فراغها
     (`updateMany … stripeSessionId: null`) — خبران معا لا يرسلان بريدين. ودفعةٌ ثانيةٌ لحجزٍ دُفع له تُحفظ في القائمة.

   ولا أثرَ في سجلّ الأكاديميّة ولا مرورَ بتكامل دفعها — المساحةُ الخاصّة منفصلة (CLAUDE.md). */

import type { PrismaClient, PrivateRegistration } from '@prisma/client'
import { AuthError } from '../auth.service'
import { verifyPaymentWebhook } from '../payments/provider'
import { AI_JOBS, AI_JOBS_SLUG } from '../../../src/application/private-course/ai-jobs'
import { confirmRegistration } from './registration.service'
import { noteStripeEvent, rememberUnmatched, stripeSecret } from './stripe-config'

const PAID_EVENTS = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded'])

interface CheckoutSession {
  id?: string
  client_reference_id?: string | null
  payment_status?: string
  amount_total?: number | null
  currency?: string | null
  customer_email?: string | null
  customer_details?: { email?: string | null } | null
  payment_intent?: string | { id?: string } | null
}

export type StripeAction = 'ignored' | 'unpaid' | 'unmatched' | 'duplicate' | 'second' | 'already_confirmed' | 'held' | 'confirmed'

const REF_SHAPE = /^[0-9A-F]{8}$/i

/** المبلغُ سعرُ الدورة؟ — بالدولار نقارنه، وبعملةٍ أخرى لا نملك سعرا نقارنه به فيُقبل */
export function amountCovers(amount: number | null | undefined, currency: string | null | undefined): boolean {
  if (amount == null) return false
  if ((currency ?? '').toLowerCase() !== 'usd') return amount > 0
  return amount >= AI_JOBS.priceUsd * 100
}

async function byReference(prisma: PrismaClient, slug: string, ref: string): Promise<PrivateRegistration | null> {
  /* المعرّفُ uuid، والمرجعُ أوّلُ ثمانيةٍ منه — `LIKE` على نصّه. وتطابقُ اثنين (احتمالٌ في المليارات) لا يُخمَّن بينهما */
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id"::text AS id FROM "PrivateRegistration"
    WHERE "courseSlug" = ${slug} AND "id"::text LIKE ${`${ref.toLowerCase()}%`}
    LIMIT 2`
  if (rows.length !== 1) return null
  return prisma.privateRegistration.findUnique({ where: { id: rows[0].id } })
}

function emailOf(s: CheckoutSession): string | null {
  const e = (s.customer_details?.email ?? s.customer_email ?? '').trim().toLowerCase()
  return e || null
}

export async function handleStripeWebhook(
  prisma: PrismaClient, slug: string, rawBody: string, signature: string,
  nowS: number = Math.floor(Date.now() / 1000),
): Promise<{ received: true; action: StripeAction; reference?: string }> {
  if (slug !== AI_JOBS_SLUG) throw new AuthError('not_found', 'الدورة غير موجودة', 404)
  const { secret } = await stripeSecret(prisma)
  if (!secret) throw new AuthError('stripe_not_ready', 'التأكيد التلقائي غير مضبوط بعد', 503)
  /* صيغةُ Stripe وحدَها: `verifyPaymentWebhook` يقبل صيغا أخرى لعقدٍ عامّ لا مكانَ له هنا */
  if (!/(^|,)\s*t=/.test(signature) || !signature.includes('v1=') || !verifyPaymentWebhook(rawBody, signature, secret, nowS)) {
    throw new AuthError('bad_signature', 'توقيع غير صالح', 400)
  }
  let event: { type?: string; data?: { object?: CheckoutSession } }
  try {
    event = JSON.parse(rawBody) as typeof event
  } catch {
    throw new AuthError('bad_body', 'جسم غير صالح', 400)
  }
  const now = new Date(nowS * 1000)
  await noteStripeEvent(prisma, String(event.type ?? ''), now)
  if (!PAID_EVENTS.has(String(event.type))) return { received: true, action: 'ignored' }
  const s = event.data?.object ?? {}
  if (!s.id || s.payment_status !== 'paid') return { received: true, action: 'unpaid' }

  const ref = s.client_reference_id && REF_SHAPE.test(s.client_reference_id) ? s.client_reference_id.toUpperCase() : null
  const email = emailOf(s)
  const covers = amountCovers(s.amount_total, s.currency)
  const r = (ref ? await byReference(prisma, slug, ref) : null)
    ?? (email && covers ? await prisma.privateRegistration.findUnique({ where: { courseSlug_email: { courseSlug: slug, email } } }) : null)
  const unmatched = {
    at: now.toISOString(), sessionId: s.id, email, reference: ref,
    amount: s.amount_total ?? null, currency: s.currency?.toUpperCase() ?? null,
  }
  if (!r) {
    await rememberUnmatched(prisma, { ...unmatched, reason: 'no_match' })
    return { received: true, action: 'unmatched' }
  }
  const reference = r.id.slice(0, 8).toUpperCase()
  if (r.stripeSessionId === s.id) return { received: true, action: 'duplicate', reference }

  const paymentId = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id ?? null
  const claimed = await prisma.privateRegistration.updateMany({
    where: { id: r.id, stripeSessionId: null },
    data: {
      payMethod: 'card', cardPaidAt: now, stripeSessionId: s.id, stripePaymentId: paymentId,
      cardAmount: s.amount_total ?? null, cardCurrency: s.currency?.toUpperCase() ?? null,
    },
  })
  if (claimed.count === 0) {
    /* سبقه خبرٌ آخرُ بالجلسة نفسِها — أو دُفع لهذا الحجز من قبل بجلسةٍ أخرى: دفعةٌ ثانيةٌ تُردّ بيد صاحبها */
    const now2 = await prisma.privateRegistration.findUnique({ where: { id: r.id } })
    if (now2?.stripeSessionId === s.id) return { received: true, action: 'duplicate', reference }
    await rememberUnmatched(prisma, { ...unmatched, reference, reason: 'second' })
    return { received: true, action: 'second', reference }
  }
  if (r.status === 'confirmed') return { received: true, action: 'already_confirmed', reference }
  if (!covers) return { received: true, action: 'held', reference }
  await confirmRegistration(prisma, r.id, { sendMail: true })
  return { received: true, action: 'confirmed', reference }
}

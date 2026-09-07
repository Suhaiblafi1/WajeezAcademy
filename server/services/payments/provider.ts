/* مزود الدفع — واجهة مجردة يختارها قرار المالك من شاشة التكاملات (أو البيئة).
   المزودون الحقيقيون (Moyasar/Stripe) يعملان بصفحات دفع مستضافة لديهم:
   لا بيانات بطاقات تمر بخادمنا أبدا، ورجوع المتصفح ليس دليل دفع —
   النجاح يأتي فقط عبر webhook موقَّت أو تسجيل يدوي موثق. */

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PaymentConfig } from '../integrations.service'
import { publicSiteUrl } from '../notification.service'

export interface ChargeInput {
  invoiceNumber: string
  amount: number
  currency: string
  descriptionAr: string
  callbackUrl?: string // صفحة عودة المتعلم بعد الدفع المستضاف
}

export interface ChargeResult {
  provider: string
  providerRef: string
  status: 'succeeded' | 'pending' | 'failed'
  redirectUrl?: string // عند وجوده: الواجهة تحوّل المتعلم لصفحة الدفع المستضافة
}

export interface RefundInput {
  /** مرجع المزود المحفوظ مع الدفعة — جلسة Checkout عند Stripe، فاتورة عند Moyasar */
  providerRef: string
  amount: number
  currency: string
  reasonAr?: string
}

export interface PaymentProvider {
  readonly name: string
  createCharge(input: ChargeInput): Promise<ChargeResult>
  /** ردّ المال فعلا عند المزود. يرمي عند الفشل — ولا يُعلَن استرداد لم يقع.
      المزودان الاختباري واليدوي لا يردّان شيئا: أوّلهما لا مال فيه، والثاني
      يُردّ بتحويل بنكي تسجّله المالية. */
  refund(input: RefundInput): Promise<{ providerRefundRef: string }>
}

/** المزود الاختباري — ينجح دائما ويعلّم مرجعه بـ TEST-؛ لا مال حقيقي */
export class TestPaymentProvider implements PaymentProvider {
  readonly name = 'test'
  async createCharge(): Promise<ChargeResult> {
    return {
      provider: this.name,
      providerRef: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'succeeded',
    }
  }
  async refund(): Promise<{ providerRefundRef: string }> {
    return { providerRefundRef: `TEST-REFUND-${Date.now()}` }
  }
}

/** المزود اليدوي — التحويل البنكي/الكاش: الدفعة تُسجل بيد المالية بصلاحية مستقلة */
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = 'manual'
  async createCharge(): Promise<ChargeResult> {
    throw new Error('manual_provider_offline: الدفع اليدوي يُسجل عبر مسار المالية لا عبر المزود')
  }
  /* الردّ اليدوي تحويلٌ بنكيّ تجريه المالية خارج المنصّة، والقيد هنا توثيقه */
  async refund(): Promise<{ providerRefundRef: string }> {
    return { providerRefundRef: 'MANUAL' }
  }
}

/* أصغر وحدة عملة — Moyasar وStripe يقبلان المبالغ بها لا بالوحدة الكبرى */
const MINOR_UNIT: Record<string, number> = { JOD: 1000, KWD: 1000, BHD: 1000, OMR: 1000, SAR: 100, USD: 100, AED: 100, QAR: 100, EGP: 100 }
const toMinor = (amount: number, currency: string) => Math.round(amount * (MINOR_UNIT[currency.toUpperCase()] ?? 100))

/** Moyasar — فاتورة مستضافة: POST /v1/invoices يعيد صفحة دفع عندهم، التسوية عبر webhook */
export class MoyasarProvider implements PaymentProvider {
  readonly name = 'moyasar'
  private secretKey: string
  constructor(secretKey: string) { this.secretKey = secretKey }
  async createCharge(input: ChargeInput): Promise<ChargeResult> {
    const res = await fetch('https://api.moyasar.com/v1/invoices', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: toMinor(input.amount, input.currency),
        currency: input.currency.toUpperCase(),
        description: `${input.descriptionAr} — فاتورة ${input.invoiceNumber}`,
        callback_url: input.callbackUrl,
        metadata: { invoiceNumber: input.invoiceNumber },
      }),
    })
    const data = (await res.json().catch(() => null)) as { id?: string; url?: string; message?: string } | null
    if (!res.ok || !data?.id || !data.url) {
      throw new Error(`moyasar_charge_failed: ${data?.message ?? `HTTP ${res.status}`}`)
    }
    return { provider: this.name, providerRef: data.id, status: 'pending', redirectUrl: data.url }
  }

  async refund(input: RefundInput): Promise<{ providerRefundRef: string }> {
    const res = await fetch(`https://api.moyasar.com/v1/payments/${encodeURIComponent(input.providerRef)}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: toMinor(input.amount, input.currency) }),
    })
    const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null
    if (!res.ok || !data?.id) throw new Error(`moyasar_refund_failed: ${data?.message ?? `HTTP ${res.status}`}`)
    return { providerRefundRef: data.id }
  }
}

/** Stripe — جلسة Checkout مستضافة: POST /v1/checkout/sessions يعيد رابط دفع، التسوية عبر webhook */
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe'
  private secretKey: string
  constructor(secretKey: string) { this.secretKey = secretKey }
  async createCharge(input: ChargeInput): Promise<ChargeResult> {
    /* عناوين العودة من أصل الموقع لا من ثابتٍ محليّ: كان الافتراض
       localhost:7100، فمشتري الإنتاج يُعاد إلى عنوان لا يفتح عنده. */
    const site = publicSiteUrl()
    const base = input.callbackUrl ?? `${site}/student/billing`
    /* النجاح والإلغاء يفترقان. كانا كليهما `input.callbackUrl` نفسه — وهو
       يُمرَّر دائما — فيعود من ألغى الدفع إلى الصفحة نفسها التي يعود إليها من
       دفع، بلا ما يميّز الحالتين. */
    const withFlag = (flag: string) => `${base}${base.includes('?') ? '&' : '?'}${flag}`
    const body = new URLSearchParams({
      mode: 'payment',
      success_url: withFlag('paid=1'),
      cancel_url: withFlag('cancelled=1'),
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': input.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(toMinor(input.amount, input.currency)),
      'line_items[0][price_data][product_data][name]': `${input.descriptionAr} — ${input.invoiceNumber}`,
      'metadata[invoiceNumber]': input.invoiceNumber,
    })
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = (await res.json().catch(() => null)) as { id?: string; url?: string; error?: { message?: string } } | null
    if (!res.ok || !data?.id || !data.url) {
      throw new Error(`stripe_charge_failed: ${data?.error?.message ?? `HTTP ${res.status}`}`)
    }
    return { provider: this.name, providerRef: data.id, status: 'pending', redirectUrl: data.url }
  }

  /** ردّ المال. مرجعُنا جلسةُ Checkout (cs_…) وStripe يردّ على PaymentIntent،
      فتُقرأ الجلسة أولا لاستخراجه. وجلسةٌ بلا PaymentIntent لم يُدفع فيها شيء. */
  async refund(input: RefundInput): Promise<{ providerRefundRef: string }> {
    let paymentIntent = input.providerRef
    if (/^cs_/.test(input.providerRef)) {
      const sres = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(input.providerRef)}`, {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      })
      const sdata = (await sres.json().catch(() => null)) as
        | { payment_intent?: string | { id?: string }; error?: { message?: string } }
        | null
      const pi = typeof sdata?.payment_intent === 'string' ? sdata.payment_intent : sdata?.payment_intent?.id
      if (!sres.ok || !pi) {
        throw new Error(`stripe_refund_failed: تعذّر إيجاد عملية الدفع للجلسة — ${sdata?.error?.message ?? `HTTP ${sres.status}`}`)
      }
      paymentIntent = pi
    }
    const body = new URLSearchParams({
      payment_intent: paymentIntent,
      amount: String(toMinor(input.amount, input.currency)),
    })
    const res = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = (await res.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null
    if (!res.ok || !data?.id) throw new Error(`stripe_refund_failed: ${data?.error?.message ?? `HTTP ${res.status}`}`)
    return { providerRefundRef: data.id }
  }
}

/** يختار المزود الفعال من إعدادات التكامل — بلا تفعيل أو بلا مفاتيح: اختباري دائما */
export function getPaymentProvider(config: PaymentConfig): PaymentProvider {
  if (!config.enabled) return new TestPaymentProvider()
  switch (config.driver) {
    case 'moyasar':
      return config.secretKey ? new MoyasarProvider(config.secretKey) : new TestPaymentProvider()
    case 'stripe':
      return config.secretKey ? new StripeProvider(config.secretKey) : new TestPaymentProvider()
    case 'manual':
      return new ManualPaymentProvider()
    default:
      return new TestPaymentProvider()
  }
}

/** هل المزوّدُ العاملُ فعلا هو الاختباريّ؟

    ⚠ **يُسأل عن المزوّد المُستقرّ لا عن الإعداد المعلَن.** فـ`getPaymentProvider`
    تُسقط إلى الاختباريّ في ثلاث حالات: القناةُ غيرُ مفعّلة، أو مفعّلةٌ بمزوّدٍ
    حقيقيٍّ **بلا مفتاحٍ سرّيّ**، أو بسائقٍ مجهول. والحكمُ على `config.driver`
    وحدَه يُخطئ الحالتين الأخيرتين — وهما بالضبط ما يجعل الشاشةَ تَعِد بدفعٍ
    حقيقيٍّ فوق مزوّدٍ وهميّ.

    وعليه يُبنى قرارُ «التجريبيُّ يعني مدفوعا فورا»: مزوّدٌ لا يُرجع صفحةَ دفعٍ
    ولا يُرسل webhook لا يجوز أن يترك طلبا «لم يُدفع» ينتظر تسويةً لن تأتي. */
export function isTestProviderActive(config: PaymentConfig): boolean {
  return getPaymentProvider(config).name === 'test'
}

/** نافذة قبول طابع Stripe الزمني — خمس دقائق كما توصي وثائقهم.
    بلا حدٍّ زمني يستطيع من التقط حدثا صالحا أن يعيد إرساله بعد شهر فيُقبل. */
export const STRIPE_TIMESTAMP_TOLERANCE_S = 300

/** تحقق توقيع webhook — السر من إعدادات التكامل (البيئة تغلب)، وبلا سر لا يُقبل أي حدث.

    الصيغ المقبولة:
    · «t=<ثانية>,v1=<hex>» — صيغة Stripe: التوقيع على «<t>.<الجسم>» لا على الجسم
      وحده، مع نافذة زمنية. كانت هذه الصيغة غير مدعومة أصلا، فكان كل حدث Stripe
      حقيقي يُرفض: مالٌ يُقبض والتسجيل لا يُسوّى.
    · «hmac=<hex>» صريحة، أو HMAC hex مجرد — العقد العام.
    · رمز مشترك — أسلوب Moyasar.

    @param nowS الوقت بالثواني — مُحقَن للاختبار وحده، وافتراضه الساعة الحقيقية. */
export function verifyPaymentWebhook(
  rawBody: string,
  signature: string,
  secret?: string,
  nowS: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !signature) return false
  const eq = (a: string, b: string) => {
    const x = Buffer.from(a)
    const y = Buffer.from(b)
    return x.length === y.length && timingSafeEqual(x, y)
  }

  /* صيغة Stripe: ترويسة مفاتيحُها مفصولة بفواصل، وقد تحمل أكثر من v1 عند تدوير السر */
  if (/(^|,)\s*t=/.test(signature) && signature.includes('v1=')) {
    const parts = new Map<string, string[]>()
    for (const chunk of signature.split(',')) {
      const i = chunk.indexOf('=')
      if (i < 1) continue
      const k = chunk.slice(0, i).trim()
      const v = chunk.slice(i + 1).trim()
      parts.set(k, [...(parts.get(k) ?? []), v])
    }
    const t = parts.get('t')?.[0]
    const v1s = parts.get('v1') ?? []
    if (!t || v1s.length === 0) return false
    const ts = Number(t)
    if (!Number.isFinite(ts)) return false
    if (Math.abs(nowS - ts) > STRIPE_TIMESTAMP_TOLERANCE_S) return false
    const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
    return v1s.some((v) => eq(expected, v))
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  if (signature.startsWith('hmac=')) return eq(expected, signature.slice(5))
  if (/^[0-9a-f]{64}$/i.test(signature)) return eq(expected, signature) // HMAC مجرد — العقد الأصلي
  return eq(secret, signature) // رمز مشترك — أسلوب Moyasar
}

/* مزود الدفع — واجهة مجردة يختارها قرار المالك من شاشة التكاملات (أو البيئة).
   المزودون الحقيقيون (Moyasar/Stripe) يعملان بصفحات دفع مستضافة لديهم:
   لا بيانات بطاقات تمر بخادمنا أبدا، ورجوع المتصفح ليس دليل دفع —
   النجاح يأتي فقط عبر webhook موقَّت أو تسجيل يدوي موثق. */

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PaymentConfig } from '../integrations.service'

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

export interface PaymentProvider {
  readonly name: string
  createCharge(input: ChargeInput): Promise<ChargeResult>
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
}

/** المزود اليدوي — التحويل البنكي/الكاش: الدفعة تُسجل بيد المالية بصلاحية مستقلة */
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = 'manual'
  async createCharge(): Promise<ChargeResult> {
    throw new Error('manual_provider_offline: الدفع اليدوي يُسجل عبر مسار المالية لا عبر المزود')
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
}

/** Stripe — جلسة Checkout مستضافة: POST /v1/checkout/sessions يعيد رابط دفع، التسوية عبر webhook */
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe'
  private secretKey: string
  constructor(secretKey: string) { this.secretKey = secretKey }
  async createCharge(input: ChargeInput): Promise<ChargeResult> {
    const body = new URLSearchParams({
      mode: 'payment',
      success_url: input.callbackUrl ?? 'http://localhost:7100/student/billing?paid=1',
      cancel_url: input.callbackUrl ?? 'http://localhost:7100/student/billing?cancelled=1',
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

/** تحقق توقيع webhook — السر يُمرَّر من إعدادات التكامل (البيئة تغلب)، وبلا سر لا يُقبل أي حدث.
   الصيغ المقبولة: «hmac=<hex>» صريحة، أو HMAC hex مجرد (العقد الأصلي)، أو رمز مشترك (Moyasar). */
export function verifyPaymentWebhook(rawBody: string, signature: string, secret?: string): boolean {
  if (!secret || !signature) return false
  const eq = (a: string, b: string) => {
    const x = Buffer.from(a)
    const y = Buffer.from(b)
    return x.length === y.length && timingSafeEqual(x, y)
  }
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  if (signature.startsWith('hmac=')) return eq(expected, signature.slice(5))
  if (/^[0-9a-f]{64}$/i.test(signature)) return eq(expected, signature) // HMAC مجرد — العقد الأصلي
  return eq(secret, signature) // رمز مشترك — أسلوب Moyasar
}

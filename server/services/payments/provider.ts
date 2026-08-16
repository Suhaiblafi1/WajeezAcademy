/* مزود الدفع — واجهة مجردة حتى قرار المالك بالمزود النهائي.
   الآن: مزود اختباري (ينجح فورا بوضع الاختبار) ودفع يدوي بصلاحية مالية.
   لا أموال حقيقية، لا تخزين بيانات بطاقات أبدا، ورجوع المتصفح ليس دليل دفع —
   النجاح يأتي فقط عبر webhook موقَّت أو تسجيل يدوي موثق. */

import { createHmac, timingSafeEqual } from 'node:crypto'

export interface ChargeInput {
  invoiceNumber: string
  amount: number
  currency: string
  descriptionAr: string
}

export interface ChargeResult {
  provider: string
  providerRef: string
  status: 'succeeded' | 'pending' | 'failed'
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

/** يختار المزود الفعال — بلا قرار مالك ومفاتيح: اختباري دائما */
export function getPaymentProvider(): PaymentProvider {
  /* عند قرار المالك: اقرأ integration_settings لـ payment وأعد المزود الحقيقي */
  return new TestPaymentProvider()
}

/** تحقق توقيع webhook — سر التوقيع من البيئة فقط، وبلا سر لا يُقبل أي حدث */
export function verifyPaymentWebhook(rawBody: string, signature: string): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

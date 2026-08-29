/* توقيع webhook بصيغة Stripe.

   لماذا ملفّ مستقلّ: هذا هو الحدّ الذي يقف عليه المال. Stripe يوقّع
   «<الطابع>.<الجسم>» لا الجسمَ وحده، وكانت الدالة تحسب HMAC على الجسم وحده
   وتقرأ ترويسة x-payment-signature فقط. فكان كلّ حدث Stripe حقيقي يُرفض
   بـ«توقيع غير صالح»: المتعلّم يدفع، والطلب يبقى معلّقا إلى الأبد، ولا أحد
   يعرف لماذا. واختبار المجموعة القائم يوقّع بالصيغة العامة ويمرّر اسم
   «stripe»، فكان يمرّ أخضر بلا أن يمسّ صيغة Stripe أصلا.

   ولا قاعدة بيانات هنا: دالة نقيّة، والاختبار على حدّها وحده. */

import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyPaymentWebhook, STRIPE_TIMESTAMP_TOLERANCE_S } from '../../services/payments/provider'

const SECRET = 'whsec_test_secret_value'
const BODY = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1' } } })
const NOW = 1_800_000_000

/** ترويسة Stripe كما يرسلها فعلا */
function stripeHeader(body: string, secret: string, t: number): string {
  const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')
  return `t=${t},v1=${v1}`
}

describe('توقيع Stripe', () => {
  it('الترويسة الصحيحة تُقبل', () => {
    expect(verifyPaymentWebhook(BODY, stripeHeader(BODY, SECRET, NOW), SECRET, NOW)).toBe(true)
  })

  it('سرّ خاطئ يُرفض', () => {
    expect(verifyPaymentWebhook(BODY, stripeHeader(BODY, 'whsec_other', NOW), SECRET, NOW)).toBe(false)
  })

  it('جسمٌ عُبث به يُرفض — التوقيع على الجسم لا على اسمه', () => {
    const header = stripeHeader(BODY, SECRET, NOW)
    const tampered = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_HACKED' } } })
    expect(verifyPaymentWebhook(tampered, header, SECRET, NOW)).toBe(false)
  })

  it('التوقيع على الجسم وحده — الصيغة القديمة — يُرفض تحت ترويسة Stripe', () => {
    const wrong = createHmac('sha256', SECRET).update(BODY).digest('hex')
    expect(verifyPaymentWebhook(BODY, `t=${NOW},v1=${wrong}`, SECRET, NOW)).toBe(false)
  })

  it('طابع قديم يُرفض — إعادةُ بثّ حدثٍ صالح ليست حدثا جديدا', () => {
    const old = NOW - STRIPE_TIMESTAMP_TOLERANCE_S - 1
    expect(verifyPaymentWebhook(BODY, stripeHeader(BODY, SECRET, old), SECRET, NOW)).toBe(false)
  })

  it('طابع داخل النافذة يُقبل', () => {
    const edge = NOW - STRIPE_TIMESTAMP_TOLERANCE_S + 1
    expect(verifyPaymentWebhook(BODY, stripeHeader(BODY, SECRET, edge), SECRET, NOW)).toBe(true)
  })

  it('طابع من المستقبل البعيد يُرفض أيضا — ساعةٌ مضبوطة شرطٌ لا زينة', () => {
    const future = NOW + STRIPE_TIMESTAMP_TOLERANCE_S + 1
    expect(verifyPaymentWebhook(BODY, stripeHeader(BODY, SECRET, future), SECRET, NOW)).toBe(false)
  })

  it('توقيعان v1 — كما أثناء تدوير السرّ — يُقبل إن طابق أحدهما', () => {
    const good = createHmac('sha256', SECRET).update(`${NOW}.${BODY}`).digest('hex')
    expect(verifyPaymentWebhook(BODY, `t=${NOW},v1=deadbeef,v1=${good}`, SECRET, NOW)).toBe(true)
  })

  it('ترويسة بلا v1 تُرفض ولا ترتدّ إلى صيغة أضعف', () => {
    expect(verifyPaymentWebhook(BODY, `t=${NOW}`, SECRET, NOW)).toBe(false)
  })

  it('طابع غير رقمي يُرفض', () => {
    expect(verifyPaymentWebhook(BODY, `t=abc,v1=${'0'.repeat(64)}`, SECRET, NOW)).toBe(false)
  })

  it('بلا سرّ لا يُقبل شيء — ولو كانت الترويسة سليمة الشكل', () => {
    expect(verifyPaymentWebhook(BODY, stripeHeader(BODY, SECRET, NOW), undefined, NOW)).toBe(false)
    expect(verifyPaymentWebhook(BODY, stripeHeader(BODY, SECRET, NOW), '', NOW)).toBe(false)
  })
})

describe('الصيغ الأخرى لم تنكسر', () => {
  it('«hmac=<hex>» العقد العام', () => {
    const sig = createHmac('sha256', SECRET).update(BODY).digest('hex')
    expect(verifyPaymentWebhook(BODY, `hmac=${sig}`, SECRET, NOW)).toBe(true)
    expect(verifyPaymentWebhook(BODY, `hmac=${'0'.repeat(64)}`, SECRET, NOW)).toBe(false)
  })

  it('HMAC hex مجرد', () => {
    const sig = createHmac('sha256', SECRET).update(BODY).digest('hex')
    expect(verifyPaymentWebhook(BODY, sig, SECRET, NOW)).toBe(true)
  })

  it('رمز مشترك — أسلوب Moyasar', () => {
    expect(verifyPaymentWebhook(BODY, SECRET, SECRET, NOW)).toBe(true)
    expect(verifyPaymentWebhook(BODY, 'not-the-secret', SECRET, NOW)).toBe(false)
  })
})

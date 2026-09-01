/* شكلُ طلب الشحن الذاهب إلى Stripe — الحدُّ الذي يقف عليه المبلغُ نفسُه.

   اختبارُ التوقيع يحرس الحدثَ العائد. وهذا يحرس الطلبَ الذاهب، وفيه ثلاثةُ
   مواضعَ يقع فيها المالُ خطأً بلا أن يفشل شيء:

   ١) **الوحدةُ الصغرى.** الدينارُ ثلاثيُّ الكسور (١ = ١٠٠٠ فلس) لا مئويّ.
      فلو حُسب بمئةٍ كالدولار، أُرسل إلى Stripe عُشرُ المبلغ — ويُقبَل ويُدفَع
      ولا يُرمى استثناءٌ واحد. تُقبض دينارانِ ونصف بدل خمسةٍ وعشرين.

   ٢) **روابطُ العودة.** تُبنى وقتَ إنشاء الجلسة من عنوان الموقع، ويجب أن
      تفترق: من ألغى لا يُعاد إلى صفحة من دفع.

   ٣) **رقمُ الفاتورة في البيانات المرافقة.** منه وحدَه يجد الـwebhook الفاتورةَ
      ليُسوّيها. فلو سقط، وصل الحدثُ صحيحَ التوقيع ولم يُسوَّ شيء.

   ولا شبكةَ هنا: `fetch` مُلتقَط، فيُقرأ الجسمُ كما كان سيُرسَل. */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StripeProvider } from '../../services/payments/provider'

const SAVED = process.env.APP_URL
let sent: { url: string; body: URLSearchParams; auth: string } | null = null

beforeEach(() => {
  process.env.APP_URL = 'https://academy.example.com'
  sent = null
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent = {
      url: String(url),
      body: new URLSearchParams(String(init.body)),
      auth: String((init.headers as Record<string, string>).Authorization),
    }
    return {
      ok: true,
      json: async () => ({ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' }),
    }
  }) as unknown as typeof fetch
})
afterEach(() => {
  if (SAVED === undefined) delete process.env.APP_URL
  else process.env.APP_URL = SAVED
})

const charge = (over: Partial<Parameters<StripeProvider['createCharge']>[0]> = {}) =>
  new StripeProvider('sk_test_x').createCharge({
    invoiceNumber: 'WJ-INV-2026-00001',
    amount: 25,
    currency: 'JOD',
    descriptionAr: 'شعبة أكتوبر',
    ...over,
  })

describe('طلبُ الشحن الذاهب إلى Stripe', () => {
  it('الدينارُ يُرسَل بالفلس — ألفٌ لا مئة', async () => {
    await charge({ amount: 25, currency: 'JOD' })
    expect(sent!.body.get('line_items[0][price_data][unit_amount]')).toBe('25000')
    expect(sent!.body.get('line_items[0][price_data][currency]')).toBe('jod')
  })

  it('والدولارُ بالسنت — مئةٌ لا ألف', async () => {
    await charge({ amount: 25, currency: 'USD' })
    expect(sent!.body.get('line_items[0][price_data][unit_amount]')).toBe('2500')
  })

  it('وعملةٌ لا نعرفها تُحسب مئويّةً — وهو الشائع لا الأسلم، فليُعلَم', async () => {
    await charge({ amount: 25, currency: 'XYZ' })
    expect(sent!.body.get('line_items[0][price_data][unit_amount]')).toBe('2500')
  })

  it('رابطا العودة من عنوان الموقع، ويفترقان', async () => {
    await charge()
    const ok = sent!.body.get('success_url')!
    const no = sent!.body.get('cancel_url')!
    expect(ok).toContain('https://academy.example.com')
    expect(no).toContain('https://academy.example.com')
    expect(ok).toContain('paid=1')
    expect(no).toContain('cancelled=1')
    expect(ok).not.toBe(no)
  })

  it('رقمُ الفاتورة يُرافق الجلسة — وبه يجدها الـwebhook', async () => {
    await charge()
    expect(sent!.body.get('metadata[invoiceNumber]')).toBe('WJ-INV-2026-00001')
  })

  it('المفتاحُ السريّ في الترويسة لا في الجسم', async () => {
    await charge()
    expect(sent!.auth).toBe('Bearer sk_test_x')
    expect(String(sent!.body)).not.toContain('sk_test_x')
  })

  it('تُعاد جلسةُ Checkout معلَّقةً برابطها — لا «نجح» قبل الـwebhook', async () => {
    const r = await charge()
    expect(sent!.url).toBe('https://api.stripe.com/v1/checkout/sessions')
    expect(r).toMatchObject({ provider: 'stripe', providerRef: 'cs_test_123', status: 'pending' })
    expect(r.redirectUrl).toContain('checkout.stripe.com')
  })
})

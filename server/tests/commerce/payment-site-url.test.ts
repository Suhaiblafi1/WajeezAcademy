/* حارسُ عنوان الموقع قبل تفعيل مزوّدٍ مستضاف.

   لماذا يستحقّ اختبارا: هذا عطبٌ لا يظهر في أيّ سجلّ. `createCharge` يبني
   `success_url` و`cancel_url` من `publicSiteUrl()`، واحتياطيُّه العنوانُ
   المحلّيّ. فلو فُعِّل Stripe في الإنتاج بلا `APP_URL`، خرج المشتري إلى صفحة
   الدفع ودفع — ثمّ أُعيد إلى `localhost` لا يفتح عنده. والـwebhook مستقلّ عن
   المتصفّح، فالطلبُ يُسوّى والمقعدُ يُحجز وكلُّ ما عندنا أخضر. لا استثناءَ
   يُرفع ولا تنبيهَ يُسجَّل: العطبُ كلُّه عند المشتري وحدَه، بعد أن دفع.

   فالحارسُ يمنع الحفظَ لا الدفعَ — أرخصُ موضعٍ يُكتشف فيه.

   ولا قاعدةَ بيانات هنا حيث لا حاجة: حالتا الرفض تقعان قبل أيّ نداءِ Prisma
   (المُهيّئ الوهميّ يُثبت ذلك — لو مسّته الدالةُ لانفجر الاختبار). */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { savePaymentConfig } from '../../services/integrations.service'
import { hasExplicitSiteUrl } from '../../services/notification.service'

/* عميلٌ ينفجر عند أوّل لمسة — فيُثبت أنّ الرفضَ سبق القاعدة */
const NEVER_TOUCHED = new Proxy({}, {
  get() { throw new Error('لمست القاعدةَ قبل الحارس') },
}) as unknown as PrismaClient

const SAVED = { APP_URL: process.env.APP_URL, VERCEL: process.env.VERCEL_PROJECT_PRODUCTION_URL }

beforeEach(() => {
  delete process.env.APP_URL
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL
})
afterEach(() => {
  if (SAVED.APP_URL === undefined) delete process.env.APP_URL
  else process.env.APP_URL = SAVED.APP_URL
  if (SAVED.VERCEL === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL
  else process.env.VERCEL_PROJECT_PRODUCTION_URL = SAVED.VERCEL
})

describe('عنوانُ الموقع شرطٌ لتفعيل مزوّدٍ مستضاف', () => {
  it('بلا عنوانٍ صريح: تفعيلُ Stripe يُرفض قبل أن تُكتب المفاتيح', async () => {
    await expect(
      savePaymentConfig(NEVER_TOUCHED, 'actor', { enabled: true, driver: 'stripe' }),
    ).rejects.toThrow(/APP_URL/)
  })

  it('وMoyasar مثلُه — الروابطُ تُبنى بالطريقة نفسِها', async () => {
    await expect(
      savePaymentConfig(NEVER_TOUCHED, 'actor', { enabled: true, driver: 'moyasar' }),
    ).rejects.toThrow(/APP_URL/)
  })

  /* الحارسُ يجب ألّا يزيد عن حدّه: هذه الثلاثُ حالاتٍ مشروعة، ولو رفضها
     لأقفل على صاحب المنصّة لوحتَه بلا سبب. ونصلُ فيها إلى القاعدة فعلا،
     فانفجارُ المُهيّئ الوهميّ هو الدليلُ على أنّ الحارسَ لم يعترض. */
  it('المزودُ الاختباريّ لا يحتاج عنوانا — لا خروجَ فيه ولا عودة', async () => {
    await expect(
      savePaymentConfig(NEVER_TOUCHED, 'actor', { enabled: true, driver: 'test' }),
    ).rejects.toThrow(/لمست القاعدة/)
  })

  it('وStripe غيرُ مفعَّل يُحفظ — تهيئةٌ قبل الإطلاق لا تفعيل', async () => {
    await expect(
      savePaymentConfig(NEVER_TOUCHED, 'actor', { enabled: false, driver: 'stripe' }),
    ).rejects.toThrow(/لمست القاعدة/)
  })

  it('ومع APP_URL مضبوطا يمرّ Stripe', async () => {
    process.env.APP_URL = 'https://academy.example.com'
    await expect(
      savePaymentConfig(NEVER_TOUCHED, 'actor', { enabled: true, driver: 'stripe' }),
    ).rejects.toThrow(/لمست القاعدة/)
  })

  it('وعنوانُ Vercel وحدَه يكفي — لا يُلزَم صاحبُ المنصّة بضبط اثنين', () => {
    expect(hasExplicitSiteUrl()).toBe(false)
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'wajeez.vercel.app'
    expect(hasExplicitSiteUrl()).toBe(true)
  })

  it('والفراغُ لا يُحسب عنوانا', () => {
    process.env.APP_URL = '   '
    expect(hasExplicitSiteUrl()).toBe(false)
  })
})

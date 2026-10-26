/* مصدرُ التسجيل — ما يلتقطه المتصفّح، وما يُبقيه، وما ينظّفه الخادم، وما تسمّيه الشاشة.

   سؤالُ صاحب المنصّة (٢٦ أكتوبر ٢٠٢٦): «كيف أعلم هذا المتعلّم من أين وصل وكيف وصل؟».
   والمقيسُ أربعة:
   ① **الالتقاط** — وسمُ الحملة والقناةُ ورابطُ المدرّب والموقعُ المُحيل، وموقعُنا ليس مُحيلا.
   ② **الأولى تبقى** — إلّا مباشرةً تأتي بعدها زيارةٌ بإشارة.
   ③ **الخادمُ لا يثق** — ما ليس وسما يُترك، والعنوانُ الكاملُ لا يُخزَّن.
   ④ **الاسم** — المنصّةُ باسمها، ورابطُ المدرّب بصاحبه، ومن لا صفَّ له «غير معروف». */

import { describe, expect, it } from 'vitest'
import {
  cleanTouch, hasSignal, keepTouch, sourceLabelAr, storedSource, touchFromLocation,
} from '@/application/marketing/signup-source'

const NOW = new Date('2026-10-26T12:00:00Z')
const OWN = 'www.wajeezacademy.com'

describe('① الالتقاط', () => {
  it('وسمُ الحملة يُلتقط بحروفٍ صغيرة', () => {
    const t = touchFromLocation('?utm_source=Facebook&utm_medium=cpc&utm_campaign=Oct-AI', '', OWN, '/courses', NOW)
    expect(t).toMatchObject({ utmSource: 'facebook', utmMedium: 'cpc', utmCampaign: 'oct-ai', landingPath: '/courses' })
  })

  it('رابطُ المدرّب يبقى بحروفه الكبيرة — فيُطابَق صفُّه', () => {
    const t = touchFromLocation('?ref=wj-ab12cd34', '', OWN, '/build/c1', NOW)
    expect(t.refCode).toBe('WJ-AB12CD34')
  })

  it('الموقعُ المُحيل باسمه وحدَه، وموقعُنا ليس مُحيلا', () => {
    expect(touchFromLocation('', 'https://www.google.com/search?q=x', OWN, '/', NOW).referrerHost).toBe('google.com')
    expect(touchFromLocation('', 'https://wajeezacademy.com/courses', OWN, '/', NOW).referrerHost).toBeUndefined()
    expect(touchFromLocation('', 'https://www.wajeezacademy.com/x', OWN, '/', NOW).referrerHost).toBeUndefined()
  })

  it('الصفحةُ الأولى بلا استعلام', () => {
    expect(touchFromLocation('', '', OWN, '/build/c1?email=a@b.com', NOW).landingPath).toBe('/build/c1')
  })
})

describe('② الأولى تبقى', () => {
  const direct = touchFromLocation('', '', OWN, '/', NOW)
  const fb = touchFromLocation('?utm_source=facebook', '', OWN, '/', NOW)
  const google = touchFromLocation('', 'https://google.com/', OWN, '/', NOW)

  it('لا شيء قبلها: تُحفظ', () => expect(keepTouch(null, direct)).toBe(direct))
  it('⚠️ مباشرةٌ ثمّ فيسبوك: فيسبوك', () => expect(keepTouch(direct, fb)).toBe(fb))
  it('فيسبوك ثمّ جوجل: فيسبوك يبقى', () => expect(keepTouch(fb, google)).toBe(fb))
  it('فيسبوك ثمّ مباشرة: فيسبوك يبقى', () => expect(keepTouch(fb, direct)).toBe(fb))
  it('المباشرةُ بلا إشارة', () => {
    expect(hasSignal(direct)).toBe(false)
    expect(hasSignal(fb)).toBe(true)
  })
})

describe('③ الخادمُ لا يثق', () => {
  it('ما ليس وسما يُترك', () => {
    const t = cleanTouch({ utmSource: '<script>', utmCampaign: 'ok_1', referrerHost: 'evil.com/path?x', landingPath: 'javascript:x', at: 'nope' })
    expect(t).toEqual({ utmCampaign: 'ok_1' })
  })
  it('لا شيءَ صالح: لا صفّ', () => {
    expect(cleanTouch({ utmSource: '' })).toBeNull()
    expect(cleanTouch('x')).toBeNull()
    expect(cleanTouch(null)).toBeNull()
  })
})

describe('④ الاسم', () => {
  const row = (over: Partial<Parameters<typeof storedSource>[0] & object> = {}) => storedSource({
    via: 'self', firstSeenAt: null, utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null,
    channel: null, wave: null, refCode: null, referrerHost: null, landingPath: null, ...over,
  })

  it('من لا صفَّ له: غير معروف', () => expect(sourceLabelAr(null).labelAr).toBe('غير معروف'))
  it('أضافه مدير', () => expect(sourceLabelAr(row({ via: 'admin' })).labelAr).toBe('أضافه مدير'))
  it('رابطُ المدرّب بصاحبه', () => {
    expect(sourceLabelAr(row({ refCode: 'WJ-1' }), 'ريم').labelAr).toBe('رابط المدرّب ريم')
    expect(sourceLabelAr(row({ refCode: 'WJ-1' })).labelAr).toBe('رابط مدرّب')
  })
  it('الوسمُ يغلب المُحيل، والإعلانُ يُقال', () => {
    const s = sourceLabelAr(row({ utmSource: 'facebook', utmMedium: 'cpc', utmCampaign: 'oct', referrerHost: 'google.com' }))
    expect(s.labelAr).toBe('فيسبوك (إعلان)')
    expect(s.detailAr).toBe('حملة: oct')
  })
  it('قناةُ رابط المنحة', () => expect(sourceLabelAr(row({ channel: 'whatsapp', wave: '1' })).labelAr).toBe('واتساب'))
  it('المُحيلُ المعروف والمجهول', () => {
    expect(sourceLabelAr(row({ referrerHost: 'l.facebook.com' })).labelAr).toBe('فيسبوك')
    expect(sourceLabelAr(row({ referrerHost: 'google.jo' })).labelAr).toBe('بحث جوجل')
    expect(sourceLabelAr(row({ referrerHost: 'example.org' })).labelAr).toBe('موقع example.org')
  })
  it('بلا إشارة: دخول مباشر', () => expect(sourceLabelAr(row({ landingPath: '/' })).labelAr).toBe('دخول مباشر'))
})

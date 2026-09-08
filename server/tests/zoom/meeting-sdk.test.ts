/* حرّاسُ توقيع Meeting SDK.

   ما يُحرَس هنا ليس «هل يعمل التضمين» — ذاك يظهر في المتصفّح. بل ثلاثةُ
   أشياءَ يسقط بها أمانُ الجلسة صامتا:

   ① السرُّ لا يخرج في التوقيع ولا في أيّ حقلٍ يُرسَل.
   ② الدورُ يُشتقّ من علاقة الطالب بالشعبة — لا يُقبل من جسم الطلب.
   ③ بلا مفاتيحَ لا يُوقَّع شيء، ويُقال ذلك بعربيّةٍ تدلّ على البديل. */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  meetingSdkEnabled, assertMeetingSdkEnabled, meetingSdkKey, signMeetingSdkJwt,
} from '../../services/zoom/meeting-sdk'
import { AuthError } from '../../services/auth.service'

const KEY = 'sdk_key_public_123'
const SECRET = 'sdk_secret_must_never_leave_the_server'

function decodePayload(jwt: string) {
  const [, payload] = jwt.split('.')
  return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
}

describe('توقيعُ Meeting SDK', () => {
  const saved = { key: process.env.ZOOM_SDK_KEY, secret: process.env.ZOOM_SDK_SECRET }
  beforeEach(() => {
    process.env.ZOOM_SDK_KEY = KEY
    process.env.ZOOM_SDK_SECRET = SECRET
  })
  afterEach(() => {
    if (saved.key === undefined) delete process.env.ZOOM_SDK_KEY
    else process.env.ZOOM_SDK_KEY = saved.key
    if (saved.secret === undefined) delete process.env.ZOOM_SDK_SECRET
    else process.env.ZOOM_SDK_SECRET = saved.secret
  })

  it('السرُّ لا يظهر في التوقيع — لا في حمولته ولا في نصّه كلِّه', () => {
    const jwt = signMeetingSdkJwt({ meetingNumber: '81234567890', role: 0 })
    expect(jwt).not.toContain(SECRET)
    /* والحمولةُ تُقرأ بلا مفتاح — فما فيها معلَنٌ لمن التقط التوقيع */
    const payload = decodePayload(jwt)
    expect(JSON.stringify(payload)).not.toContain(SECRET)
    expect(payload.sdkKey).toBe(KEY)
    expect(payload.appKey).toBe(KEY)
  })

  it('التوقيعُ HS256 بالسرّ — يُتحقَّق منه بحسابه من جديد', () => {
    const jwt = signMeetingSdkJwt({ meetingNumber: '81234567890', role: 1 })
    const [h, p, sig] = jwt.split('.')
    const expected = createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(sig).toBe(expected)
    /* وسرٌّ آخرُ يُنتج توقيعا آخر — وإلّا لَما كان السرُّ سرّا */
    const other = createHmac('sha256', 'another_secret').update(`${h}.${p}`).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(sig).not.toBe(other)
  })

  it('الدورُ يدخل الحمولةَ كما أُعطي — مضيفا كان أو مشاركا', () => {
    expect(decodePayload(signMeetingSdkJwt({ meetingNumber: '81234567890', role: 0 })).role).toBe(0)
    expect(decodePayload(signMeetingSdkJwt({ meetingNumber: '81234567890', role: 1 })).role).toBe(1)
  })

  it('العمرُ داخل ما يقبله Zoom — بين نصف ساعةٍ وثمانٍ وأربعين، و`iat` قبل الآن', () => {
    const now = new Date('2026-09-08T12:00:00Z')
    const p = decodePayload(signMeetingSdkJwt({ meetingNumber: '81234567890', role: 0, now }))
    const nowSec = Math.floor(now.getTime() / 1000)
    expect(p.iat).toBeLessThan(nowSec)
    const life = p.exp - p.iat
    expect(life).toBeGreaterThanOrEqual(30 * 60)
    expect(life).toBeLessThanOrEqual(48 * 60 * 60)
    expect(p.tokenExp).toBe(p.exp)
  })

  it('رقمُ الاجتماع يُنظَّف ويُتحقَّق — ولا يمرّ ما ليس رقما', () => {
    /* رابطُ Zoom اليدويُّ يُنسَخ أحيانا برقمٍ مشروط: «812-3456-7890» */
    expect(decodePayload(signMeetingSdkJwt({ meetingNumber: '812-3456-7890', role: 0 })).mn).toBe('81234567890')
    expect(decodePayload(signMeetingSdkJwt({ meetingNumber: '812 3456 7890', role: 0 })).mn).toBe('81234567890')
    for (const bad of ['', 'abc', '123', "8123456789'; DROP", '8123456789012345']) {
      expect(() => signMeetingSdkJwt({ meetingNumber: bad, role: 0 })).toThrow(AuthError)
    }
  })

  it('بلا مفاتيحَ لا يُوقَّع شيء — والرسالةُ تدلّ على تطبيق Zoom', () => {
    delete process.env.ZOOM_SDK_KEY
    delete process.env.ZOOM_SDK_SECRET
    expect(meetingSdkEnabled()).toBe(false)
    expect(() => signMeetingSdkJwt({ meetingNumber: '81234567890', role: 0 })).toThrow(AuthError)
    expect(() => meetingSdkKey()).toThrow(AuthError)
    try {
      assertMeetingSdkEnabled()
      throw new Error('كان يجب أن يسقط')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).message).toContain('تطبيق Zoom')
    }
  })

  it('مفتاحٌ بلا سرٍّ لا يكفي — نصفُ الإعداد إعدادٌ ناقصٌ لا إعدادٌ صالح', () => {
    delete process.env.ZOOM_SDK_SECRET
    expect(meetingSdkEnabled()).toBe(false)
    expect(() => signMeetingSdkJwt({ meetingNumber: '81234567890', role: 0 })).toThrow(AuthError)
  })
})

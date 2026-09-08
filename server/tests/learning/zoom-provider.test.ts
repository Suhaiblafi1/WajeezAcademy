/* شكلُ ما يُرسَل إلى Zoom — وما يُقال حين لا مفاتيحَ.

   ثلاثةُ مواضعَ يقع فيها العطبُ صامتا لو لم تُحرَس:

   ١) **الرمزُ يُطلب مرّةً لا مرّاتٍ.** عمرُه ساعة، ولو طُلب مع كلّ اجتماعٍ
      لضرب المنصّةُ حدَّ Zoom في يومٍ مزدحمٍ من غير سبب. والأسوأُ أنّ عشرةَ
      لقاءاتٍ تُجدوَل معا تطلبه عشرا في اللحظة نفسِها — فالحارسُ يقيس
      **عددَ نداءات الشبكة** لا صحّةَ الرمز وحدَها.

   ٢) **`start_url` لا يُخزَّن ولا يُعاد.** من يملكه يبدأ الاجتماعَ **مضيفا**:
      يُخرج المشاركين ويُسجّل ويُشارك الشاشة. وهو في ردّ Zoom بجانب `join_url`
      تماما، فنسخُه إلى القاعدة سطرٌ واحدٌ ساهٍ.

   ٣) **بلا مفاتيحَ يُرفض ولا يُخترع.** الدرسُ من مزوّد الدفع، ونصُّه في
      `.env.example`: «بلا مفتاح سرّي يعود النظام إلى المزوّد الاختباري
      **صامتا**: نجاحٌ بلا مال». فهنا الرفضُ صريحٌ ويسمّي الناقص.

   ولا شبكةَ هنا: `fetch` مُلتقَط، فيُقرأ الطلبُ كما كان سيُرسَل. */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createZoomMeeting, forgetZoomToken, zoomToken, zoomReady, zoomMissing, getZoomConfig,
  type ZoomConfig,
} from '../../services/zoom.service'

interface Sent { url: string; method: string; headers: Record<string, string>; body: string }
let sent: Sent[] = []
let tokenReplies = 0

const FULL: ZoomConfig = {
  enabled: true, accountId: 'acc-1', clientId: 'cid-1', clientSecret: 'sec-1', hostEmail: 'lessons@wajeez.test',
}

beforeEach(() => {
  sent = []
  tokenReplies = 0
  forgetZoomToken()
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const u = String(url)
    sent.push({
      url: u,
      method: String(init?.method ?? 'GET'),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: String(init?.body ?? ''),
    })
    if (u.includes('/oauth/token')) {
      tokenReplies++
      return { ok: true, status: 200, json: async () => ({ access_token: `tok-${tokenReplies}`, expires_in: 3600 }) }
    }
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 987654321,
        join_url: 'https://zoom.us/j/987654321?pwd=xyz',
        start_url: 'https://zoom.us/s/987654321?zak=SECRET-HOST-KEY',
        password: 'wj2026',
      }),
    }
  }) as unknown as typeof fetch
})

afterEach(() => { forgetZoomToken() })

describe('الرمزُ يُطلب مرّةً ويُعاد استعمالُه', () => {
  it('شكلُ طلب الرمز — نقطةُ Zoom الرسميّة واعتمادٌ في الترويسة لا في الجسم', async () => {
    await zoomToken(FULL)
    const t = sent.find((s) => s.url.includes('/oauth/token'))!
    expect(t.url).toBe('https://zoom.us/oauth/token')
    expect(t.method).toBe('POST')
    /* الاعتمادُ Basic بترميزٍ للمعرّف والسرّ معا — لا في جسم الطلب */
    expect(t.headers.Authorization).toBe(`Basic ${Buffer.from('cid-1:sec-1').toString('base64')}`)
    const body = new URLSearchParams(t.body)
    expect(body.get('grant_type')).toBe('account_credentials')
    expect(body.get('account_id')).toBe('acc-1')
    expect(t.body).not.toContain('sec-1')
  })

  it('ونداءان متتاليان لا يطلبانه مرّتَين', async () => {
    await zoomToken(FULL)
    await zoomToken(FULL)
    expect(sent.filter((s) => s.url.includes('/oauth/token'))).toHaveLength(1)
  })

  it('وعشرةٌ متزامنةٌ تطلبه مرّةً واحدة — لا عشرا', async () => {
    await Promise.all(Array.from({ length: 10 }, () => zoomToken(FULL)))
    expect(sent.filter((s) => s.url.includes('/oauth/token'))).toHaveLength(1)
  })

  it('ويُجدَّد حين يقترب انتهاؤه', async () => {
    const t0 = Date.now()
    await zoomToken(FULL, t0)
    /* بعد ٥٩ دقيقةً ونصف: داخلَ الساعة لكن دون هامشِ الدقيقتَين */
    await zoomToken(FULL, t0 + 59.5 * 60_000)
    expect(sent.filter((s) => s.url.includes('/oauth/token'))).toHaveLength(2)
  })

  it('وتبديلُ المفاتيح يُبطل المحفوظ', async () => {
    await zoomToken(FULL)
    await zoomToken({ ...FULL, clientId: 'cid-2' })
    expect(sent.filter((s) => s.url.includes('/oauth/token'))).toHaveLength(2)
  })
})

describe('إنشاءُ الاجتماع', () => {
  it('يُنشأ عند مضيفِ الإعداد بموعدِ الجلسة ومدّتها', async () => {
    const at = new Date('2026-10-06T15:00:00.000Z')
    const out = await createZoomMeeting(FULL, {
      topic: 'شعبة الأتمتة — الجلسة 3', startsAt: at, durationMinutes: 90, timezone: 'Asia/Amman',
    })
    const call = sent.find((s) => s.url.includes('/v2/users/'))!
    expect(call.url).toBe('https://api.zoom.us/v2/users/lessons%40wajeez.test/meetings')
    expect(call.headers.Authorization).toBe('Bearer tok-1')
    const body = JSON.parse(call.body)
    /* ٢ = مجدوَلٌ بوقتٍ محدّد. و١ فوريٌّ يبدأ الآن، و٨ متكرّر — وكلاهما خطأٌ هنا */
    expect(body.type).toBe(2)
    expect(body.start_time).toBe(at.toISOString())
    expect(body.duration).toBe(90)
    expect(body.timezone).toBe('Asia/Amman')
    expect(out.joinUrl).toContain('zoom.us/j/')
    expect(out.passcode).toBe('wj2026')
    expect(out.meetingId).toBe('987654321')
  })

  it('و`start_url` يعود للمنادي ولا يُخلَط برابط الانضمام', async () => {
    const out = await createZoomMeeting(FULL, {
      topic: 'x', startsAt: new Date('2026-10-06T15:00:00.000Z'), durationMinutes: 60,
    })
    expect(out.startUrl).toContain('zak=')
    expect(out.joinUrl).not.toContain('zak=')
  })

  it('و٤٠٤ من Zoom تُقال بلغةِ من يقرؤها — لا «HTTP 404»', async () => {
    globalThis.fetch = (async (url: string) => (String(url).includes('/oauth/token')
      ? { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) }
      : { ok: false, status: 404, json: async () => ({}) })) as unknown as typeof fetch
    forgetZoomToken()
    await expect(createZoomMeeting(FULL, {
      topic: 'x', startsAt: new Date(), durationMinutes: 60,
    })).rejects.toThrow(/lessons@wajeez\.test/)
  })
})

describe('بلا مفاتيحَ يُرفض ويُسمّى الناقص', () => {
  const bare: ZoomConfig = { enabled: true, hostEmail: 'me' }

  it('`zoomReady` تفرّق بين «مفعّل» و«جاهز»', () => {
    expect(zoomReady({ ...FULL, enabled: false })).toBe(false)
    expect(zoomReady(bare)).toBe(false)
    expect(zoomReady(FULL)).toBe(true)
  })

  it('والناقصُ يُسمّى بالعربيّة لا برمزِ حقل', () => {
    const m = zoomMissing(bare)
    expect(m).toHaveLength(3)
    expect(m.join(' ')).toContain('معرّف الحساب')
  })

  it('ولا نداءَ شبكةٍ يخرج أصلا', async () => {
    await expect(zoomToken(bare)).rejects.toThrow(/غير مكتمل/)
    expect(sent).toHaveLength(0)
  })
})

describe('البيئةُ تغلب القاعدة — كالدفع والبريد', () => {
  const saved = { ...process.env }
  afterEach(() => {
    for (const k of ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_HOST_EMAIL']) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  /** قاعدةٌ صغيرةٌ تكفي: الدالّةُ تقرأ صفّا واحدا */
  const fakePrisma = (config: Record<string, unknown>, enabled = true) => ({
    integrationSetting: { findUnique: async () => ({ provider: 'zoom', enabled, config }) },
  }) as never

  it('قيمةُ البيئة تُزيح قيمةَ القاعدة حقلا حقلا', async () => {
    process.env.ZOOM_ACCOUNT_ID = 'from-env'
    process.env.ZOOM_HOST_EMAIL = 'env@wajeez.test'
    const c = await getZoomConfig(fakePrisma({ accountId: 'from-db', clientId: 'db-cid', clientSecret: 'db-sec', hostEmail: 'db@x.test' }))
    expect(c.accountId).toBe('from-env')
    expect(c.hostEmail).toBe('env@wajeez.test')
    /* وما لا بيئةَ له يبقى من القاعدة — لا يُمحى بغيابِ متغيّر */
    expect(c.clientId).toBe('db-cid')
  })

  it('ووجودُ متغيّرِ الحساب وحدَه يُفعّل التكامل — كما يفعل `PAYMENT_DRIVER`', async () => {
    process.env.ZOOM_ACCOUNT_ID = 'from-env'
    const c = await getZoomConfig(fakePrisma({}, false))
    expect(c.enabled).toBe(true)
  })

  it('والمضيفُ الافتراضيُّ `me` حين لا يُذكر — لا فراغٌ يُرسَل في المسار', async () => {
    const c = await getZoomConfig(fakePrisma({ accountId: 'a', clientId: 'b', clientSecret: 'c' }))
    expect(c.hostEmail).toBe('me')
  })
})

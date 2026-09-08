/* رابطٌ لكلّ متعلّم — وما يُقال حين لا يقبله الحساب.

   ── لماذا رابطٌ لكلّ متعلّمٍ لا رابطٌ واحد ──

   الحضورُ اليومَ يُسجَّل بيدٍ: أربعةُ أزرارٍ لكلّ متعلّمٍ في كلّ جلسة —
   شعبةٌ من ثلاثين في اثنتي عشرةَ جلسةً ألفٌ وأربعُمئةٍ وأربعون نقرة، يفعلها
   المدرّبُ من ذاكرته بعد انتهاء اللقاء.

   وZoom يعرف الجواب، لكنّه يبلّغ عن المشاركين **ببريد المسجَّل** لا بالاسم
   الذي كتبه صاحبُه في خانة العرض. فبرابطٍ واحدٍ مشتركٍ تعود قائمةُ أسماءٍ
   لا تُطابَق بأحد — «أحمد» و«Ahmed» و«iPhone» ثلاثةُ صفوفٍ لشخصٍ واحد.
   فالتسجيلُ المسبق ليس تحسينا في الشكل: هو شرطُ أن يكون العدُّ ممكنا أصلا.

   ── والعطبُ الذي يُحرَس ──

   التسجيلُ المسبق **ليس في كلّ حساب**: المجّانيّةُ لا تملكه. والاجتماعُ
   حينئذٍ قائمٌ صالحٌ يعمل رابطُه المشترك. فلو رمى الكودُ هنا لَسقطت الجلسةُ
   كلُّها لأنّ المطابقةَ الآليّة تعذّرت — عقوبةٌ على الخطأ الصغير بالخطأ
   الكبير. ولو ابتلع الخطأَ صامتا لَظنّ المدرّبُ أنّ العدَّ يجري وهو لا يجري،
   فلا يسجّل بيده، فتضيع الجلسةُ بلا حضور.

   فالحدُّ: يمضي، **ويقول**.

   ولا شبكةَ هنا: `fetch` مُلتقَط، فيُقرأ الطلبُ كما كان سيُرسَل. */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createZoomMeeting, forgetZoomToken, registerZoomParticipant, type ZoomConfig,
} from '../../services/zoom.service'

interface Sent { url: string; method: string; body: string }
let sent: Sent[] = []
/** ما يردّه Zoom على نداء التسجيل — يُبدَّل في كلّ حالة */
let registrantReply: { ok: boolean; status: number; json: unknown } = {
  ok: true, status: 201,
  json: { registrant_id: 'reg-77', join_url: 'https://zoom.us/w/987?tk=PERSONAL' },
}

const FULL: ZoomConfig = {
  enabled: true, accountId: 'acc-1', clientId: 'cid-1', clientSecret: 'sec-1', hostEmail: 'lessons@wajeez.test',
}

beforeEach(() => {
  sent = []
  forgetZoomToken()
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const u = String(url)
    sent.push({ url: u, method: String(init?.method ?? 'GET'), body: String(init?.body ?? '') })
    if (u.includes('/oauth/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 3600 }) }
    }
    if (u.includes('/registrants')) {
      return { ok: registrantReply.ok, status: registrantReply.status, json: async () => registrantReply.json }
    }
    return {
      ok: true, status: 201,
      json: async () => ({ id: 987, join_url: 'https://zoom.us/j/987', start_url: 'https://zoom.us/s/987?zak=K' }),
    }
  }) as unknown as typeof fetch
})

afterEach(() => {
  forgetZoomToken()
  registrantReply = { ok: true, status: 201, json: { registrant_id: 'reg-77', join_url: 'https://zoom.us/w/987?tk=PERSONAL' } }
})

describe('الاجتماعُ يُنشأ قابلا للتسجيل المسبق', () => {
  it('وإلّا رُفض كلُّ تسجيلٍ بعده — والحضورُ لا يُقاس', async () => {
    await createZoomMeeting(FULL, {
      topic: 'شعبةُ الحضور — اللقاء الأوّل',
      startsAt: new Date('2026-10-01T09:00:00Z'),
      durationMinutes: 90,
    })
    const create = sent.find((s) => s.url.endsWith('/meetings'))!
    const body = JSON.parse(create.body) as { settings: Record<string, unknown> }
    /* صفرٌ = يُقبل تلقائيّا. ولو غاب لَردّ Zoom كلَّ تسجيلٍ بـ٤٠٠. */
    expect(
      body.settings.approval_type,
      'بلا `approval_type` لا يقبل الاجتماعُ مسجَّلين، فلا رابطَ خاصًّا ولا مطابقةَ حضور.',
    ).toBe(0)
  })

  it('ولا يُبلّغ Zoom المتعلّمَ — فالمنصّةُ هي التي تبلّغه', async () => {
    await createZoomMeeting(FULL, {
      topic: 'شعبةُ الحضور', startsAt: new Date('2026-10-01T09:00:00Z'), durationMinutes: 90,
    })
    const body = JSON.parse(sent.find((s) => s.url.endsWith('/meetings'))!.body) as { settings: Record<string, unknown> }
    expect(
      body.settings.registrants_email_notification,
      'رسالتان عن لقاءٍ واحدٍ إحداهما بلغةٍ أخرى تُربك لا تُعين.',
    ).toBe(false)
  })
})

describe('والتسجيلُ يردّ رابطا خاصًّا', () => {
  it('يُرسَل البريدُ والاسمُ إلى نقطة المسجَّلين', async () => {
    const r = await registerZoomParticipant(FULL, '987', { email: 'l@wajeez.test', firstName: 'سلمى' })
    expect(r.ok).toBe(true)
    const call = sent.find((s) => s.url.includes('/registrants'))!
    expect(call.url).toBe('https://api.zoom.us/v2/meetings/987/registrants')
    expect(call.method).toBe('POST')
    const body = JSON.parse(call.body) as { email: string; first_name: string; last_name: string }
    expect(body.email).toBe('l@wajeez.test')
    expect(body.first_name).toBe('سلمى')
    /* الأسماءُ العربيّةُ تصل كلمةً واحدةً كثيرا، وZoom يشترط اسما أخيرا
       في بعض الحسابات — فنقطةٌ خيرٌ من رفضِ التسجيل كلِّه. */
    expect(body.last_name, 'اسمٌ أخيرٌ فارغٌ يُردّ في بعض الحسابات').toBeTruthy()
  })

  it('والرابطُ العائدُ هو رابطُ صاحبه لا الرابطُ المشترك', async () => {
    const r = await registerZoomParticipant(FULL, '987', { email: 'l@wajeez.test', firstName: 'سلمى' })
    expect(r.ok && r.registrant.joinUrl).toBe('https://zoom.us/w/987?tk=PERSONAL')
    expect(r.ok && r.registrant.registrantId).toBe('reg-77')
  })
})

describe('وحين لا يقبل الحسابُ تسجيلا — يمضي ويقول', () => {
  it('لا يرمي: الاجتماعُ قائمٌ ورابطُه المشترك يعمل', async () => {
    registrantReply = { ok: false, status: 400, json: {} }
    const r = await registerZoomParticipant(FULL, '987', { email: 'l@wajeez.test', firstName: 'سلمى' })
    expect(
      r.ok,
      'رميٌ هنا يُسقط الجلسةَ كلَّها لأنّ المطابقةَ الآليّة تعذّرت — '
      + 'والاجتماعُ صالحٌ يدخله الطلبةُ برابطه المشترك.',
    ).toBe(false)
  })

  it('ويسمّي السببَ بعربيّةٍ تُقرأ في الشاشة — لا رقمَ HTTP عاريا', async () => {
    registrantReply = { ok: false, status: 400, json: {} }
    const r = await registerZoomParticipant(FULL, '987', { email: 'l@wajeez.test', firstName: 'سلمى' })
    const reason = r.ok ? '' : r.reason
    expect(reason.length, 'سببٌ فارغٌ يُكتب في `syncError` فلا يُقرأ منه شيء').toBeGreaterThan(10)
    expect(/[؀-ۿ]/.test(reason), 'السببُ يُعرض للمدرّب، فيكون بلغته').toBe(true)
    expect(reason).not.toMatch(/^HTTP/)
  })

  it('وردٌّ ناجحٌ بلا رابطٍ يُعدّ فشلا — لا نجاحا بلا أثر', async () => {
    registrantReply = { ok: true, status: 201, json: { registrant_id: 'reg-9' } }
    const r = await registerZoomParticipant(FULL, '987', { email: 'l@wajeez.test', firstName: 'سلمى' })
    expect(
      r.ok,
      'بلا رابطٍ خاصٍّ لا مطابقةَ — ونجاحٌ يُسجَّل هنا يعني صفَّ `SessionJoinLink` بلا رابط.',
    ).toBe(false)
  })
})

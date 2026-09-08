/* اجتماعُ Zoom يُنشأ من داخل المنصّة — لا يُلصَق رابطُه من خارجها.

   ── ما كان قبل هذا ──

   `attachManualZoom` وحدَه: مديرٌ يفتح Zoom في تبويبٍ آخر، ينشئ اجتماعا،
   ينسخ رابطَه ورمزَه، ويعود فيلصقهما في شاشة الشعبة. وثلاثةُ أعطابٍ تولد من
   هذا اللصق ولا يمسكها شيء:

     ١) الرابطُ قد يكون لاجتماعٍ في وقتٍ آخر أو لشعبةٍ أخرى — ولا شيء يقابله
        بموعد الجلسة، فيدخل الطلبةُ على اجتماعٍ لم يبدأ أو انتهى.
     ٢) ومن نسي اللصقَ لا يعرف أحدٌ أنّه نسي: الجلسةُ تُعرض بلا رابطٍ ولا
        تقول إنّها ناقصة، والطالبُ يكتشفها في موعدها.
     ٣) والرمزُ يمرّ في محادثةٍ أو رسالة — وهو سرٌّ يفتح غرفةً.

   فصار الإنشاءُ فعلا واحدا داخل المنصّة: تُنشأ الجلسةُ ويُنشأ اجتماعُها
   ويُخبَر المسجَّلون في نداءٍ واحد.

   ── ولماذا Server-to-Server OAuth لا OAuth المستخدم ──

   الاجتماعاتُ ملكُ الأكاديميّة لا ملكُ المدرّب: المدرّبُ يتبدّل والشعبةُ تبقى،
   ومن يُسنَد بعده يجب أن يُضيف الاجتماعَ نفسَه. فلو رُبط الاجتماعُ بحساب Zoom
   شخصيٍّ لمدرّبٍ لضاع بخروجه. و`account_credentials` تعطي المنصّةَ رمزا باسم
   الحساب لا باسم شخص — بلا أن يملك مدرّبٌ واحدٌ حسابَ Zoom أصلا.

   ── والرمزُ يُحفظ في الذاكرة لا في القاعدة ──

   عمرُه ساعةٌ واحدة (`expires_in: 3600`). وحفظُه في القاعدة يجعله سرّا ثالثا
   يُحرَس ويُنسخ في النسخ الاحتياطيّة بلا فائدة — فهو يُطلب ثانيةً في ثوانٍ.
   ويُجدَّد قبل انتهائه بدقيقتَين، ويُطلب مرّةً واحدةً مهما تزامنت الطلبات
   (`inflight`) — وإلّا استقبل Zoom عشرةَ طلباتِ رمزٍ لجلسةٍ واحدة.

   ── ولا اجتماعَ مزيَّفٌ حين لا مفاتيح ──

   الدرسُ مأخوذٌ من مزوّد الدفع، وهو مكتوبٌ في `.env.example` بنصّه: «بلا مفتاح
   سرّي يعود النظام إلى المزوّد الاختباري **صامتا**: نجاحٌ بلا مال». فهنا
   العكسُ صريح: بلا مفاتيحَ **يُرفض** الإنشاءُ برسالةٍ تقول ما ينقص ومن يضبطه،
   ويبقى المسارُ اليدويُّ بابا مفتوحا. اجتماعٌ يبدو منشأً ولا وجودَ له أسوأُ
   من رفضٍ مفهوم. */

import type { PrismaClient } from '@prisma/client'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { AuthError } from './auth.service'

/** نقطتا Zoom الرسميّتان — الرمزُ من `zoom.us` والواجهةُ من `api.zoom.us` */
const ZOOM_OAUTH_ENDPOINT = 'https://zoom.us/oauth/token'
const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2'

/** هامشُ التجديد: يُطلب رمزٌ جديدٌ قبل انتهاء القديم بدقيقتَين */
const RENEW_MARGIN_MS = 120_000

export interface ZoomConfig {
  enabled: boolean
  accountId?: string
  clientId?: string
  clientSecret?: string
  /** بريدُ مضيف الاجتماعات في حساب Zoom — `me` يعني صاحبَ التطبيق */
  hostEmail: string
  /** سرُّ التحقّق من الـwebhook — يأتي من لوحة Zoom مع نقطة الاستقبال */
  webhookSecret?: string
}

export interface ZoomMeetingResult {
  meetingId: string
  joinUrl: string
  /** رابطُ المضيف — لا يُعطى لمتعلّم أبدا، فهو يبدأ الاجتماعَ بصلاحيّة المضيف */
  startUrl: string
  passcode: string | null
}

/* ── الإعداد: البيئةُ تغلب القاعدةَ، كما في الدفع والبريد ── */

export async function getZoomConfig(prisma: PrismaClient): Promise<ZoomConfig> {
  const row = await prisma.integrationSetting.findUnique({ where: { provider: 'zoom' } })
  const c = (row?.config ?? {}) as Partial<ZoomConfig>
  const base: ZoomConfig = {
    enabled: row?.enabled ?? false,
    accountId: c.accountId || undefined,
    clientId: c.clientId || undefined,
    clientSecret: c.clientSecret || undefined,
    hostEmail: c.hostEmail || 'me',
    webhookSecret: c.webhookSecret || undefined,
  }
  const env = process.env
  if (env.ZOOM_ACCOUNT_ID) { base.accountId = env.ZOOM_ACCOUNT_ID; base.enabled = true }
  if (env.ZOOM_CLIENT_ID) base.clientId = env.ZOOM_CLIENT_ID
  if (env.ZOOM_CLIENT_SECRET) base.clientSecret = env.ZOOM_CLIENT_SECRET
  if (env.ZOOM_HOST_EMAIL) base.hostEmail = env.ZOOM_HOST_EMAIL
  if (env.ZOOM_WEBHOOK_SECRET) base.webhookSecret = env.ZOOM_WEBHOOK_SECRET
  return base
}

/** هل يكتمل الإعدادُ فعلا؟ — «مفعّل» بلا مفاتيحَ ليس جاهزا */
export function zoomReady(c: ZoomConfig): boolean {
  return Boolean(c.enabled && c.accountId && c.clientId && c.clientSecret)
}

/** ما ينقص بالاسم — كي تقول الشاشةُ ما يُضبط لا «تعذّر» */
export function zoomMissing(c: ZoomConfig): string[] {
  const m: string[] = []
  if (!c.accountId) m.push('معرّف الحساب (Account ID)')
  if (!c.clientId) m.push('معرّف التطبيق (Client ID)')
  if (!c.clientSecret) m.push('سرّ التطبيق (Client Secret)')
  return m
}

/* ── الرمز: ذاكرةٌ واحدةٌ وطلبٌ واحدٌ مهما تزامنت النداءات ── */

interface CachedToken { token: string; expiresAt: number; key: string }
let cached: CachedToken | null = null
let inflight: Promise<string> | null = null

/** مفتاحُ الذاكرة من المفاتيح نفسِها — فتبديلُ الاعتماد يُبطل الرمزَ القديم */
const cacheKey = (c: ZoomConfig) => `${c.accountId}:${c.clientId}`

/** للاختبارات ولتبديل الإعداد — يُنسى الرمزُ المحفوظ */
export function forgetZoomToken(): void {
  cached = null
  inflight = null
}

export async function zoomToken(c: ZoomConfig, now = Date.now()): Promise<string> {
  if (!zoomReady(c)) {
    throw new AuthError('zoom_not_configured', `تكاملُ Zoom غير مكتمل — ينقصه: ${zoomMissing(c).join(' · ')}`, 409)
  }
  const key = cacheKey(c)
  if (cached && cached.key === key && cached.expiresAt - RENEW_MARGIN_MS > now) return cached.token
  if (inflight) return inflight

  inflight = (async () => {
    const basic = Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64')
    const body = new URLSearchParams({ grant_type: 'account_credentials', account_id: c.accountId! })
    const res = await fetch(ZOOM_OAUTH_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) {
      /* ٤٠٠ و٤٠١ من Zoom تعنيان اعتمادا خاطئا لا عطبَ شبكة — تُقال كما هي */
      const detail = res.status === 400 || res.status === 401
        ? 'رفض Zoom الاعتماد — راجع معرّف الحساب والتطبيق وسرّه'
        : `تعذّر الحصول على رمز Zoom (HTTP ${res.status})`
      throw new AuthError('zoom_auth_failed', detail, 502)
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!json.access_token) throw new AuthError('zoom_auth_failed', 'ردّ Zoom بلا رمز وصول', 502)
    cached = {
      token: json.access_token,
      expiresAt: now + (json.expires_in ?? 3600) * 1000,
      key,
    }
    return json.access_token
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

/* ── إنشاءُ الاجتماع ── */

export interface CreateMeetingInput {
  topic: string
  startsAt: Date
  durationMinutes: number
  timezone?: string
  agenda?: string
}

export async function createZoomMeeting(c: ZoomConfig, input: CreateMeetingInput): Promise<ZoomMeetingResult> {
  const token = await zoomToken(c)
  const host = encodeURIComponent(c.hostEmail || 'me')
  const res = await fetch(`${ZOOM_API_BASE_URL}/users/${host}/meetings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      topic: input.topic.slice(0, 200),
      /* ٢ = اجتماعٌ مجدوَل بوقتٍ محدّد — لا فوريٌّ ولا متكرّر */
      type: 2,
      start_time: input.startsAt.toISOString(),
      duration: input.durationMinutes,
      timezone: input.timezone || 'Asia/Amman',
      agenda: (input.agenda ?? '').slice(0, 2000),
      settings: {
        /* الانتظارُ مطفأ والدخولُ قبل المضيف مسموح: الطالبُ يدخل فيجد الغرفة،
           ولا ينتظر مدرّبا تأخّر دقيقتَين في غرفةٍ لا يعرف أنّه فيها. */
        waiting_room: false,
        join_before_host: true,
        /* والرمزُ مطلوب: الرابطُ وحدَه يُعاد نشرُه، والرمزُ يجعل النشرَ ناقصا */
        meeting_authentication: false,
        mute_upon_entry: true,
        auto_recording: 'none',
        /* ── التسجيلُ المسبق: صفرٌ = يُقبل تلقائيّا ──

           وهو شرطُ رابطٍ لكلّ متعلّم، والرابطُ لكلّ متعلّمٍ شرطُ حضورٍ
           يُقاس: Zoom يبلّغ عن المشاركين ببريد **المسجَّل**، فبلا تسجيلٍ
           تعود قائمةُ أسماءٍ كتبها أصحابُها بأيديهم — «أحمد» و«Ahmed»
           و«iPhone» ثلاثةُ صفوفٍ لشخصٍ واحد، ولا تُطابَق بمسجَّل.

           والبريدُ من Zoom مطفأ: من يُبلّغ المتعلّمَ هي المنصّة، ورسالتان
           عن لقاءٍ واحدٍ إحداهما بلغةٍ أخرى تُربك لا تُعين. */
        approval_type: 0,
        registration_type: 1,
        registrants_email_notification: false,
        registrants_confirmation_email: false,
      },
    }),
  })
  if (!res.ok) {
    const detail = res.status === 401 || res.status === 403
      ? 'رفض Zoom الطلب — تأكّد أنّ التطبيق يملك صلاحيّة `meeting:write:admin`'
      : res.status === 404
        ? `لا مستخدمَ في Zoom بالبريد «${c.hostEmail}» — صحّح بريدَ المضيف`
        : `ردُّ Zoom غير متوقّع (HTTP ${res.status})`
    throw new AuthError('zoom_create_failed', detail, 502)
  }
  const j = (await res.json()) as {
    id?: number | string; join_url?: string; start_url?: string; password?: string
  }
  if (!j.join_url) throw new AuthError('zoom_create_failed', 'أنشأ Zoom اجتماعا بلا رابط انضمام', 502)
  return {
    meetingId: String(j.id ?? ''),
    joinUrl: j.join_url,
    startUrl: j.start_url ?? j.join_url,
    passcode: j.password ?? null,
  }
}

/** فحصٌ حيٌّ للمفاتيح — يطلب رمزا فعلا ولا يكتفي بوجود القيم */
/* ── تسجيلُ متعلّمٍ في اجتماع ──

   يردّ رابطا خاصًّا به. وقيمتُه ليست في الرابط بل في **المطابقة**: تقريرُ
   المشاركين بعد اللقاء يحمل بريدَ المسجَّل، فيُعرف من حضر بلا تخمينٍ في
   الأسماء.

   ── ولمَ لا يرمي هذا فيُسقط الجلسة ──

   التسجيلُ المسبق ليس متاحا في كلّ حساب: الحساباتُ المجّانيّة لا تملكه،
   وبعضُ أنواع الاجتماعات ترفضه. والاجتماعُ حينئذٍ **قائمٌ وصالح** — رابطُه
   المشترك يعمل ويدخل به الطلبة. فإسقاطُ الجلسة كلِّها لأنّ المطابقةَ الآليّة
   تعذّرت عقوبةٌ على الخطأ الصغير بالخطأ الكبير.

   فيردّ `null` ومعه سببُه، ويُكتب السببُ في `ZoomMeeting.syncError` كي يُقرأ
   في الشاشة: «الحضورُ يُسجَّل يدويّا في هذه الجلسة، وهذا سببه» — لا صمتٌ
   يُظنّ معه أنّ العدّ يجري وهو لا يجري. */
export interface ZoomRegistrant {
  registrantId: string
  joinUrl: string
}

export async function registerZoomParticipant(
  c: ZoomConfig,
  meetingId: string,
  who: { email: string; firstName: string; lastName?: string },
): Promise<{ ok: true; registrant: ZoomRegistrant } | { ok: false; reason: string }> {
  const token = await zoomToken(c)
  const res = await fetch(`${ZOOM_API_BASE_URL}/meetings/${encodeURIComponent(meetingId)}/registrants`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      email: who.email,
      first_name: who.firstName.slice(0, 64),
      /* Zoom يشترط اسما أخيرا في بعض الحسابات، والأسماءُ العربيّةُ تصل
         كلمةً واحدةً كثيرا — فنقطةٌ خيرٌ من رفضِ التسجيل كلِّه. */
      last_name: (who.lastName || '.').slice(0, 64),
    }),
  })
  if (!res.ok) {
    const reason = res.status === 400
      ? 'لا يقبل هذا الاجتماعُ تسجيلا مسبقا — أُنشئ قبل تفعيله أو لا يتيحه نوعُه'
      : res.status === 401 || res.status === 403
        ? 'رفض Zoom التسجيل — تأكّد من صلاحيّة `meeting:write:admin`'
        : res.status === 404
          ? 'لا اجتماعَ بهذا الرقم عند Zoom — رُبّما حُذف من لوحته'
          : `ردُّ Zoom غير متوقّع عند التسجيل (HTTP ${res.status})`
    return { ok: false, reason }
  }
  const j = (await res.json()) as { registrant_id?: string; join_url?: string }
  if (!j.join_url || !j.registrant_id) {
    return { ok: false, reason: 'سجّل Zoom المتعلّمَ بلا رابطٍ خاصٍّ به' }
  }
  return { ok: true, registrant: { registrantId: j.registrant_id, joinUrl: j.join_url } }
}

/* ══════════ الـwebhook: ما يقوله Zoom بعد اللقاء ══════════

   ── ولمَ انتقل التحقّقُ إلى هنا ──

   كان في `server/services/zoom/provider.ts` — ملفٌّ **لا يستورده أحد**:
   `ApiZoomProvider` فيه يرمي `zoom_api_not_wired`، و`getZoomProvider()`
   تقرأ البيئةَ وحدَها. فصار في المستودَع جوابان مختلفان لسؤالٍ واحد «أمُهيَّأٌ
   Zoom؟» — أحدُهما ميّتٌ يقرأ البيئة، والآخرُ حيٌّ يقرأ البيئةَ والقاعدة.

   ومصدران لحقيقةٍ واحدة هو بعينه العطبُ الذي جعل معالجَ الشعبة يعرض سعرا
   ويُنشئ شعبةً بسعرٍ آخر. فنُقل التحقّقُ إلى المزوّد الحيّ وحُذف الميّت،
   وصار السرُّ يُقرأ من حيث تُقرأ بقيّةُ الاعتمادات: القاعدةُ أو البيئة.

   ── والتحقّقُ بمقارنةٍ ثابتةِ الزمن ──

   `timingSafeEqual` لا `===`: المقارنةُ الساذجة تخرج عند أوّل حرفٍ مختلف،
   فزمنُها يُفشي كم حرفا صحّ. */

/** بصمةُ الطلب كما يحسبها Zoom: `v0:<الطابع>:<الجسم الخام>` */
export function zoomWebhookSignature(secret: string, rawBody: string, timestamp: string): string {
  return `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`
}

export function verifyZoomWebhook(
  c: ZoomConfig, rawBody: string, signature: string, timestamp: string,
): boolean {
  /* بلا سرٍّ لا يُقبل شيء: نقطةٌ مفتوحةٌ تقبل أيَّ جسمٍ تكتب حضورا مختلَقا */
  if (!c.webhookSecret) return false
  const expected = Buffer.from(zoomWebhookSignature(c.webhookSecret, rawBody, timestamp))
  const got = Buffer.from(signature)
  return expected.length === got.length && timingSafeEqual(expected, got)
}

/** ردُّ تحدّي إثبات الملكيّة الذي يرسله Zoom عند حفظ النقطة في لوحته */
export function zoomUrlValidationReply(secret: string, plainToken: string) {
  return {
    plainToken,
    encryptedToken: createHmac('sha256', secret).update(plainToken).digest('hex'),
  }
}

/* ══════════ تقريرُ من حضر ══════════

   يُقرأ بعد انتهاء اللقاء لا من أحداث الدخول والخروج المتفرّقة: تلك تصل
   مبعثرةً ويُخطئ رصفُها حين ينقطع اتّصالُ أحدهم ويعود، والتقريرُ يعطيها
   مجموعةً بمجاميعِ الدقائق.

   ── ولمَ يُرمَّز المعرّفُ مرّتَين ──

   معرّفُ اللقاء المنتهي (`uuid`) قد يبدأ بشَرطةٍ مائلة أو يحوي `//`، وهي
   في المسار تُقرأ فواصلَ لا حروفا — فيردّ Zoom ٤٠٤ على لقاءٍ موجود. وهو
   شرطٌ يذكره Zoom في وثيقته، ويُنسى فيُشخَّص «اللقاءُ غيرُ موجود». */

export interface ZoomParticipant {
  name: string
  email: string | null
  joinedAt: Date
  leftAt: Date | null
  minutes: number
}

/** يُرمَّز مرّتَين متى احتاج — وإلّا فمرّةً واحدة */
export function encodeMeetingUuid(uuid: string): string {
  const once = encodeURIComponent(uuid)
  return uuid.startsWith('/') || uuid.includes('//') ? encodeURIComponent(once) : once
}

export async function fetchZoomParticipants(c: ZoomConfig, meetingUuid: string): Promise<ZoomParticipant[]> {
  const token = await zoomToken(c)
  const out: ZoomParticipant[] = []
  let pageToken = ''
  /* سقفٌ للصفحات: حلقةٌ لا تنتهي على ردٍّ يعيد الرمزَ نفسَه تُعلّق العاملَ */
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ page_size: '300' })
    if (pageToken) q.set('next_page_token', pageToken)
    const res = await fetch(
      `${ZOOM_API_BASE_URL}/past_meetings/${encodeMeetingUuid(meetingUuid)}/participants?${q}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) {
      throw new AuthError(
        'zoom_report_failed',
        res.status === 404
          ? 'لا تقريرَ لهذا اللقاء عند Zoom — قد يكون انتهى قبل أن يدخله أحد'
          : `تعذّرت قراءةُ تقرير الحضور من Zoom (HTTP ${res.status})`,
        502,
      )
    }
    const j = (await res.json()) as {
      participants?: { name?: string; user_email?: string; join_time?: string; leave_time?: string; duration?: number }[]
      next_page_token?: string
    }
    for (const p of j.participants ?? []) {
      const joinedAt = p.join_time ? new Date(p.join_time) : null
      if (!joinedAt || Number.isNaN(joinedAt.getTime())) continue
      const leftAt = p.leave_time ? new Date(p.leave_time) : null
      out.push({
        name: p.name?.trim() || 'مشارِكٌ بلا اسم',
        email: p.user_email?.trim().toLowerCase() || null,
        joinedAt,
        leftAt: leftAt && !Number.isNaN(leftAt.getTime()) ? leftAt : null,
        /* `duration` بالثواني في تقرير Zoom — تُحوَّل هنا مرّةً واحدة */
        minutes: Math.max(0, Math.round((p.duration ?? 0) / 60)),
      })
    }
    pageToken = j.next_page_token ?? ''
    if (!pageToken) break
  }
  return out
}

export async function zoomProbe(c: ZoomConfig): Promise<{ ok: boolean; message: string }> {
  if (!c.enabled) return { ok: false, message: 'تكاملُ Zoom غير مفعّل — فعّله واحفظ أوّلا' }
  const missing = zoomMissing(c)
  if (missing.length) return { ok: false, message: `ينقص الإعدادَ: ${missing.join(' · ')}` }
  try {
    forgetZoomToken()
    await zoomToken(c)
    return { ok: true, message: `اتّصالُ Zoom ناجح — والاجتماعاتُ تُنشأ باسم «${c.hostEmail}»` }
  } catch (e) {
    return { ok: false, message: e instanceof AuthError ? e.message : 'تعذّر الوصول إلى Zoom — تحقّق من الشبكة' }
  }
}

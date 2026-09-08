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
  }
  const env = process.env
  if (env.ZOOM_ACCOUNT_ID) { base.accountId = env.ZOOM_ACCOUNT_ID; base.enabled = true }
  if (env.ZOOM_CLIENT_ID) base.clientId = env.ZOOM_CLIENT_ID
  if (env.ZOOM_CLIENT_SECRET) base.clientSecret = env.ZOOM_CLIENT_SECRET
  if (env.ZOOM_HOST_EMAIL) base.hostEmail = env.ZOOM_HOST_EMAIL
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

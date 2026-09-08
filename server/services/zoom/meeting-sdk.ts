/* توقيعُ Meeting SDK — كي تُفتح الجلسةُ داخلَ الموقع لا في تبويبٍ آخر.

   ── وهو غيرُ مفاتيح `provider.ts` ──

   ذاك يُنشئ اجتماعا عبر API الخادم إلى الخادم (S2S OAuth) بمفاتيح
   `ZOOM_ACCOUNT_ID`/`ZOOM_CLIENT_ID`/`ZOOM_CLIENT_SECRET`. وهذا يوقّع دخولَ
   متصفّحٍ إلى اجتماعٍ قائم بمفتاحَي **تطبيق Meeting SDK**:
   `ZOOM_SDK_KEY` و`ZOOM_SDK_SECRET`. زوجان مختلفان من لوحة Zoom، ولا يُغني
   أحدهما عن الآخر — ولذلك مِفتاحُهما هنا مستقلّ.

   ── والسرُّ لا يغادر الخادم ──

   التوقيعُ JWT بخوارزمية HS256، ويُحسب هنا ثمّ يُرسَل التوقيعُ وحدَه مع
   `sdkKey` العلنيّ. و`ZOOM_SDK_SECRET` لا يُعاد في أيّ استجابة ولا يُسجَّل.

   ── والدورُ يقرّره الخادم لا العميل ──

   `role: 1` مضيفٌ يفتح الاجتماعَ ويُخرج منه، و`role: 0` مشارك. ولو أخذ
   الدورَ من جسم الطلب لصار كلُّ متعلّمٍ مضيفا بتعديل حقلٍ في المتصفّح. فيُشتقّ
   من علاقة صاحب الطلب بالشعبة: مدرّبُها مضيف، ومتعلّمُها المسجَّل مشارك. */

import { createHmac } from 'node:crypto'
import { AuthError } from '../auth.service'

/** عمرُ التوقيع. وZoom يشترط ما بين نصف ساعةٍ وثمانٍ وأربعين — وساعتان تكفيان جلسةً وتُبقي الهامش */
const SIGNATURE_TTL_SEC = 2 * 60 * 60

/* Zoom يرفض توقيعا `iat` فيه بعد ساعة الخادم لديه، وساعاتُ الخوادم تتفاوت بثوانٍ.
   فيُؤخَّر `iat` نصفَ دقيقةٍ — وهو ما توصي به وثائقُ Zoom نفسُها. */
const IAT_SKEW_SEC = 30

export type ZoomSdkRole = 0 | 1

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** مفعَّلٌ فقط حين يوجد المفتاحان معا — مفتاحٌ بلا سرٍّ لا يوقّع شيئا */
export function meetingSdkEnabled(): boolean {
  return Boolean(process.env.ZOOM_SDK_KEY && process.env.ZOOM_SDK_SECRET)
}

/** يُرفض الوعدُ بالتضمين قبل أن يُوقَّع — بعربيّةٍ تقول البديل، كما في رفع الملفّات */
export function assertMeetingSdkEnabled(): void {
  if (meetingSdkEnabled()) return
  throw new AuthError(
    'meeting_sdk_unavailable',
    'فتحُ الجلسة داخل الموقع غيرُ مفعّلٍ بعد. افتح رابطَ الجلسة في تطبيق Zoom.',
    501,
  )
}

/** المفتاحُ العلنيّ — يُرسَل إلى المتصفّح مع التوقيع، ولا سرَّ فيه */
export function meetingSdkKey(): string {
  const key = process.env.ZOOM_SDK_KEY
  if (!key) throw new AuthError('meeting_sdk_unavailable', 'مفتاحُ Meeting SDK غيرُ مضبوط', 501)
  return key
}

/** يوقّع دخولَ متصفّحٍ واحدٍ إلى اجتماعٍ واحدٍ بدورٍ قرّره الخادم */
export function signMeetingSdkJwt(input: {
  meetingNumber: string
  role: ZoomSdkRole
  now?: Date
}): string {
  const sdkKey = process.env.ZOOM_SDK_KEY
  const sdkSecret = process.env.ZOOM_SDK_SECRET
  if (!sdkKey || !sdkSecret) {
    throw new AuthError('meeting_sdk_unavailable', 'مفاتيحُ Meeting SDK غيرُ مضبوطة', 501)
  }

  /* رقمُ الاجتماع أرقامٌ فقط. ورابطُ Zoom اليدويُّ قد يحمله بمسافاتٍ أو شُرَط،
     فتُنزع قبل التحقّق — ثمّ يُرفض ما بقي فيه غيرُ رقم. */
  const meetingNumber = input.meetingNumber.replace(/[\s-]/g, '')
  if (!/^\d{9,12}$/.test(meetingNumber)) {
    throw new AuthError('bad_meeting_number', 'رقمُ الاجتماع غيرُ صالح', 400)
  }

  const nowSec = Math.floor((input.now?.getTime() ?? Date.now()) / 1000)
  const iat = nowSec - IAT_SKEW_SEC
  const exp = iat + SIGNATURE_TTL_SEC

  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    appKey: sdkKey,
    sdkKey,
    mn: meetingNumber,
    role: input.role,
    iat,
    exp,
    tokenExp: exp,
  }

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const signature = base64url(createHmac('sha256', sdkSecret).update(signingInput).digest())
  return `${signingInput}.${signature}`
}

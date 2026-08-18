/* مزود Zoom — واجهة مجردة للتكامل المستقبلي.
   الآن: ManualZoomProvider فقط — الإدارة تدخل رابطا جاهزا ومعرف اجتماع ورمز مرور محمي.
   لا يُنشأ أي اجتماع حقيقي عبر API دون مفاتيح ZOOM_ACCOUNT_ID/ZOOM_CLIENT_ID/ZOOM_CLIENT_SECRET.
   التحقق من webhooks يُفعَّل عند التكامل الحقيقي عبر ZOOM_WEBHOOK_SECRET. */

import { createHmac, timingSafeEqual } from 'node:crypto'

export interface ZoomMeetingInput {
  topic: string
  startsAt: Date
  durationMin?: number
}

export interface ZoomMeetingResult {
  provider: 'manual' | 'zoom_api'
  joinUrl: string
  meetingId?: string
  passcode?: string
  learnerUrl?: string
}

export interface ZoomProvider {
  readonly name: string
  createMeeting(input: ZoomMeetingInput): Promise<ZoomMeetingResult>
}

/** المزود اليدوي — لا يتصل بأي خدمة خارجية؛ يعيد ما أدخلته الإدارة بعد تحقق الصيغة */
export class ManualZoomProvider implements ZoomProvider {
  readonly name = 'manual'
  /* الإنشاء اليدوي يتم عبر recordManualMeeting في خدمة الشعب — هذه الواجهة للتكامل الآلي فقط */
  async createMeeting(): Promise<ZoomMeetingResult> {
    throw new Error('manual_provider_no_api: المزود اليدوي لا ينشئ اجتماعات — أدخل الرابط يدويا')
  }
}

/** مزود Zoom API الحقيقي — يُفعَّل فقط عند توفر المفاتيح الثلاثة */
export class ApiZoomProvider implements ZoomProvider {
  readonly name = 'zoom_api'
  private accountId: string
  private clientId: string
  private clientSecret: string
  constructor(accountId: string, clientId: string, clientSecret: string) {
    this.accountId = accountId
    this.clientId = clientId
    this.clientSecret = clientSecret
    void this.accountId; void this.clientId; void this.clientSecret
  }
  async createMeeting(): Promise<ZoomMeetingResult> {
    /* يُنفَّذ عند الربط الفعلي — S2S OAuth ثم POST /users/me/meetings */
    throw new Error('zoom_api_not_wired: تكامل Zoom الآلي جاهز كواجهة ولم يُربط بعد')
  }
}

/** يختار المزود حسب البيئة — بلا مفاتيح: يدوي دائما */
export function getZoomProvider(): ZoomProvider {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env
  if (ZOOM_ACCOUNT_ID && ZOOM_CLIENT_ID && ZOOM_CLIENT_SECRET) {
    return new ApiZoomProvider(ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET)
  }
  return new ManualZoomProvider()
}

/** تحقق توقيع webhook الخاص بـ Zoom — يُستخدم عند تفعيل التكامل */
export function verifyZoomWebhook(rawBody: string, signature: string, timestamp: string): boolean {
  const secret = process.env.ZOOM_WEBHOOK_SECRET
  if (!secret) return false
  const expected = createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')
  const a = Buffer.from(`v0=${expected}`)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

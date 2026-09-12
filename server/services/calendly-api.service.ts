/* نداءُ واجهة Calendly — مصدرٌ واحدٌ يقرؤه السكربتُ وشاشةُ التكاملات معا.

   ═══ لماذا هنا لا في السكربت ═══

   تسجيلُ الاشتراك كان في `scripts/calendly-webhook-setup.ts` وحدَه، فمن أراده
   لزمه SSH ومحرِّرُ ملفٍّ وسطرُ أوامر. وشاشةُ التكاملات هي بابُ كلّ تكاملٍ
   آخرَ في هذه المنصّة (Zoom والدفع والبريد) — فصار البابُ واحدا، والمنطقُ
   الذي خلفه واحدا لا نسختين تفترقان.

   ═══ والرمزُ الشخصيُّ لا يُخزَّن ═══

   `token` يُمرَّر للنداء ويُنسى بعده: هو مفتاحُ حساب Calendly كلِّه، ولا
   حاجةَ بنا إليه إلّا لحظةَ التسجيل. أمّا مفتاحُ التوقيع فيُحفظ، لأنّ الخادمَ
   يتحقّق به من كلّ حدثٍ يصل. */

const API = 'https://api.calendly.com'

/** الحدثان اللذان تعتمد عليهما مزامنةُ المقابلات */
export const CALENDLY_EVENTS = ['invitee.created', 'invitee.canceled'] as const

export interface CalendlySubscription {
  uri?: string
  callback_url?: string
  state?: string
  events?: string[]
  created_at?: string
}

export class CalendlyApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** عنوانُ مستقبِلنا — بلا شرطةٍ مكرّرة، وبـhttps وحدَها (Calendly يرفض غيرها) */
export function calendlyCallbackUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (!base.startsWith('https://')) {
    throw new CalendlyApiError(400, `عنوانُ الموقع يجب أن يكون https — جاء «${base || 'فارغا'}»`)
  }
  return `${base}/api/webhooks/calendly`
}

async function call<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  const text = await res.text()
  if (!res.ok) {
    /* رسالةُ Calendly تُنقل كما جاءت — وفيها يقول صراحةً حين تكون الخطّةُ
       المجّانيّةُ هي المانع. ولا يُنقل الرمزُ الذي أرسلناه. */
    throw new CalendlyApiError(res.status, `ردّ Calendly ${res.status}: ${text.slice(0, 500)}`)
  }
  return (text ? JSON.parse(text) : {}) as T
}

export interface CalendlyAccount {
  organization: string
  name: string
  email: string
}

/** الحسابُ ومنظّمتُه — بلا المنظّمة لا يُنشأ اشتراك */
export async function calendlyAccount(token: string): Promise<CalendlyAccount> {
  const me = await call<{ resource?: { uri?: string; name?: string; email?: string; current_organization?: string } }>(
    '/users/me', token,
  )
  const organization = me.resource?.current_organization
  if (!organization) throw new CalendlyApiError(502, 'لم تُعرف المنظّمةُ من ‎/users/me‎ — راجع صلاحيّةَ الرمز')
  return { organization, name: me.resource?.name ?? '—', email: me.resource?.email ?? '—' }
}

/** الاشتراكُ القائمُ على عنواننا — أو `null`. يُقرأ قبل الإنشاء فلا يُضاعَف */
export async function findCalendlySubscription(
  token: string, organization: string, callbackUrl: string,
): Promise<CalendlySubscription | null> {
  const res = await call<{ collection?: CalendlySubscription[] }>(
    `/webhook_subscriptions?organization=${encodeURIComponent(organization)}&scope=organization&count=100`,
    token,
  )
  return (res.collection ?? []).find((s) => s.callback_url === callbackUrl) ?? null
}

export async function createCalendlySubscription(
  token: string, input: { organization: string; callbackUrl: string; signingKey: string },
): Promise<CalendlySubscription> {
  const res = await call<{ resource?: CalendlySubscription }>('/webhook_subscriptions', token, {
    method: 'POST',
    body: JSON.stringify({
      url: input.callbackUrl,
      events: [...CALENDLY_EVENTS],
      organization: input.organization,
      scope: 'organization',
      signing_key: input.signingKey,
    }),
  })
  return res.resource ?? {}
}

/** الأحداثُ الناقصةُ عن اشتراكٍ قائم — اشتراكٌ بلا `invitee.canceled` نصفُ مزامنة */
export function missingCalendlyEvents(subscription: CalendlySubscription): string[] {
  return CALENDLY_EVENTS.filter((e) => !(subscription.events ?? []).includes(e))
}

/* ─────────── التسجيل: معاينةٌ ثمّ تطبيق ───────────

   عقدُ المنصّة في كلّ إجراءٍ يمسّ الخارج: لا يقع شيءٌ قبل أن تُعرض نتيجتُه.
   فـ`apply: false` يقول ما سيقع، و`true` وحدَها تُنشئ. */
export interface CalendlyRegisterResult {
  applied: boolean
  account: CalendlyAccount
  callbackUrl: string
  /** `existing` اشتراكٌ كان · `created` أُنشئ الآن · `would_create` معاينةٌ لم تُنشئ */
  outcome: 'existing' | 'created' | 'would_create'
  subscription: CalendlySubscription | null
  missingEvents: string[]
}

export async function registerCalendlyWebhook(input: {
  token: string
  signingKey: string
  siteUrl: string
  apply: boolean
}): Promise<CalendlyRegisterResult> {
  const callbackUrl = calendlyCallbackUrl(input.siteUrl)
  const account = await calendlyAccount(input.token)
  const existing = await findCalendlySubscription(input.token, account.organization, callbackUrl)
  if (existing) {
    return {
      applied: false, account, callbackUrl, outcome: 'existing',
      subscription: existing, missingEvents: missingCalendlyEvents(existing),
    }
  }
  if (!input.apply) {
    return { applied: false, account, callbackUrl, outcome: 'would_create', subscription: null, missingEvents: [] }
  }
  const created = await createCalendlySubscription(input.token, {
    organization: account.organization, callbackUrl, signingKey: input.signingKey,
  })
  return {
    applied: true, account, callbackUrl, outcome: 'created',
    subscription: created, missingEvents: missingCalendlyEvents(created),
  }
}

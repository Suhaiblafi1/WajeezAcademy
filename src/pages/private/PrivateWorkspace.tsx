/* ═══ مساحةُ صاحب المنصّة الخاصّة — `/private` (١٩ نوفمبر ٢٠٢٦) ═══

   قرارُه: «ضع لي خانةً داخل موقع الأكاديميّة كشيءٍ منفصل.. ويسمح للسوبر أدمن فقط الوصولَ إليه لأفعّل التسجيل،
   ويرسل لهم رابطَ Zoom تلقائيّا لشعبته.. وأستطيع تحميلَ المسجّلين على انفراد.. فقط أنا suhaib@wajeez.co».

   فهي خارجَ لوحة الإدارة وشريطها: لا يراها أحدٌ من الفريق، ولا يقود إليها شيءٌ إلّا رابطٌ صغيرٌ في رأس لوحته هو
   (`AdminLayout`). والحارسُ الحقيقيُّ في الخادم (`owner.ts`) — وهذه تقول لغيره «غير موجودة» كما يقولها الخادم.

   وكلُّ فعلٍ فيها يعرض خيارَيه وما يقع بكلٍّ منهما (قرارُه ٢ أكتوبر ٢٠٢٦: «لا تجبرني على فعل»): التأكيدُ بالبريد أو
   بلاه، والرفضُ يعود عنه بـ«أعده للمراجعة». */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  CheckCircle2, Copy, CreditCard, Download, ExternalLink, FileText, Loader2, Lock, LockOpen, Mail, MessageCircle, RefreshCw, RotateCcw, Search, Send,
  Trash2, Upload, Video, XCircle, Zap,
} from 'lucide-react'
import { ApiError, apiDelete, apiDownload, apiGet, apiPatch, apiPost, apiPut, apiUpload } from '@/services/api'
import { toast, toastError } from '@/components/Toast'
import Button from '@/components/ui/Button'
import TabBar from '@/components/ui/TabBar'
import { Card, Inset, Panel } from '@/components/ui/Surface'
import { staffControlCls as inputCls } from '@/components/FormKit'
import { fmtDateTime, fmtNum } from '@/application/text/format-ar'
import { AI_JOBS } from '@/application/private-course/ai-jobs'
import { whatsappLink } from '@/application/private-course/phone'

type Status = 'pending' | 'confirmed' | 'rejected'

interface Registration {
  id: string
  reference: string
  fullName: string
  email: string
  phone: string
  phoneCountry: string
  sectionKey: string
  note: string | null
  /** `null` حتى يرفعها — «حجز ولم يدفع بعد» (٢٠ نوفمبر ٢٠٢٦) */
  proof: { name: string; mime: string; size: number } | null
  proofUploadedAt: string | null
  payToken: string
  source: string | null
  payMethod: 'cliq' | 'card' | null
  remindedAt: string | null
  lastChanceAt: string | null
  reminderError: string | null
  /** دفعُ البطاقة كما أخبر به Stripe (٢١ نوفمبر ٢٠٢٦) */
  cardPaidAt: string | null
  cardAmount: number | null
  cardCurrency: string | null
  stripePaymentId: string | null
  /** سجّلا معا بسعر الاثنين (٢١ نوفمبر ٢٠٢٦) */
  pairRole: 'lead' | 'friend' | null
  partnerName: string | null
  partnerPaid: boolean
  amountJod: number
  /** تسجيلُ الدورة: متى وصله، وهل فاته الرابطُ الحاليّ (٢١ نوفمبر ٢٠٢٦) */
  recordingSentAt: string | null
  recordingMissing: boolean
  /** أُبلغ Meta بشرائه — أو سببُ إخفاقه (٢١ نوفمبر ٢٠٢٦) */
  metaSentAt: string | null
  metaError: string | null
  status: Status
  createdAt: string
  confirmedAt: string | null
  rejectedAt: string | null
  mailSentAt: string | null
  mailError: string | null
  zoomMissing: boolean
}

interface Overview {
  course: {
    slug: string
    title: string
    open: boolean
    priceJod: number
    /** رابطُ الدفع بالبطاقة لمن هو خارج الأردن — وفارغُه يُخفي الخيار (٢١ نوفمبر ٢٠٢٦) */
    cardUrl: string | null
    /** البطاقةُ مخفيّةٌ كلّيّا بقرار صاحب المنصّة — فلا تُعرض إعداداتُها (٢١ نوفمبر ٢٠٢٦) */
    cardPayments: boolean
    file: { name: string; custom: boolean }
    sections: { key: string; title: string; timeLabel: string; zoom: { url: string; passcode?: string } | null; recording: string | null }[]
  }
  gmail: { user: string; ready: boolean; source: 'env' | 'db' | 'none'; passwordTail: string; live: boolean }
  stripe: StripeState
  meta: MetaState
  registrations: Registration[]
}

interface MetaState {
  ready: boolean
  source: 'env' | 'db' | 'none'
  tokenTail: string
  testCode: string
  lastSentAt: string | null
  lastError: string | null
  pixelId: string
  live: boolean
}

interface StripeState {
  ready: boolean
  source: 'env' | 'db' | 'none'
  secretTail: string
  lastEventAt: string | null
  lastEventType: string | null
  unmatched: {
    at: string; sessionId: string; email: string | null; reference: string | null
    amount: number | null; currency: string | null; reason: 'no_match' | 'second'
  }[]
}

/** 2000 USD ← «20.00 USD» — Stripe يكتب المبلغ بأصغر وحدة */
function money(amount: number | null, currency: string | null): string {
  if (amount == null) return ''
  return `${(amount / 100).toFixed(2)} ${currency ?? ''}`.trim()
}

type MailResult = { ok: true } | { ok: false; error: string } | null

const SLUG = AI_JOBS.slug
const BASE = `/api/v1/private/courses/${SLUG}`
const STATUS_AR: Record<Status, string> = { pending: 'قيد المراجعة', confirmed: 'مؤكد', rejected: 'مرفوض' }
const STATUS_TONE: Record<Status, 'warn' | 'positive' | 'danger'> = { pending: 'warn', confirmed: 'positive', rejected: 'danger' }

const labelCls = 'block text-fine font-bold text-muted-foreground'

function mailToast(mail: MailResult, okText: string) {
  if (!mail) return
  if (mail.ok) toast(okText)
  else toastError(`تأكد التسجيل، لكن البريد لم يصل: ${mail.error}`)
}

/* ═══ الإعدادات ═══ */

function ZoomEditor({ section, onSaved, missing, onSendMissing, sending }: {
  section: Overview['course']['sections'][number]
  onSaved: (o: Overview) => void
  missing: number
  onSendMissing: () => void
  sending: boolean
}) {
  const [url, setUrl] = useState(section.zoom?.url ?? '')
  const [passcode, setPasscode] = useState(section.zoom?.passcode ?? '')
  const [saving, setSaving] = useState(false)
  const dirty = url !== (section.zoom?.url ?? '') || passcode !== (section.zoom?.passcode ?? '')

  async function save() {
    setSaving(true)
    try {
      const o = await apiPatch<Overview>(BASE, { zoom: { [section.key]: url.trim() ? { url: url.trim(), passcode: passcode.trim() || undefined } : null } })
      onSaved(o)
      toast(url.trim() ? 'حفظنا رابط Zoom' : 'حذفنا رابط Zoom')
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذر الحفظ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm font-black"><Video className="h-4 w-4 text-teal-ink" aria-hidden="true" />{section.title} <span className="font-normal text-muted-foreground">· {section.timeLabel}</span></p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_9rem]">
        <label className="block">
          <span className={labelCls}>رابط Zoom</span>
          <input dir="ltr" className={`${inputCls} mt-1`} placeholder="https://us06web.zoom.us/j/…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>رمز الدخول (اختياري)</span>
          <input dir="ltr" className={`${inputCls} mt-1`} value={passcode} onChange={(e) => setPasscode(e.target.value)} maxLength={40} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button tone="confirm" size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>احفظ الرابط</Button>
        {missing > 0 && !dirty && (
          <Button tone="confirm" size="sm" icon={Send} loading={sending} onClick={onSendMissing}>
            أرسله إلى {fmtNum(missing)} مؤكدين لم يصلهم
          </Button>
        )}
      </div>
      {missing > 0 && !dirty && (
        <p className="mt-2 text-read leading-6 text-muted-foreground">
          وصلهم بريد التأكيد قبل هذا الرابط أو قبل تغييره. الإرسال يعيد لهم بريد التأكيد كاملا بالرابط الجديد.
        </p>
      )}
    </Card>
  )
}

/* ═══ تسجيلُ الشعبة بعد الدورة — يُرسل رابطُه لمؤكَّديها (٢١ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة (اقتراحُ «٨»): تسجيلٌ لمن لا يستطيع الحضور. فبعد الدورة يُلصق الرابط، ويخرج بريدٌ لكلّ مؤكَّدٍ لم يصله */
function RecordingEditor({ section, missing, onSaved }: {
  section: Overview['course']['sections'][number]
  missing: number
  onSaved: (o: Overview) => void
}) {
  const [url, setUrl] = useState(section.recording ?? '')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const dirty = url.trim() !== (section.recording ?? '')

  async function save() {
    setSaving(true)
    try {
      onSaved(await apiPatch<Overview>(BASE, { recordings: { [section.key]: url.trim() || null } }))
      toast(url.trim() ? 'حفظنا رابط التسجيل' : 'حذفنا رابط التسجيل')
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذر الحفظ')
    } finally {
      setSaving(false)
    }
  }

  async function send() {
    setSending(true)
    try {
      const r = await apiPost<{ sent: number; failed: number; left: number; errors: string[]; overview: Overview }>(`${BASE}/sections/${section.key}/recording/send`)
      onSaved(r.overview)
      if (r.failed) toastError(`وصل ${fmtNum(r.sent)} ولم يصل ${fmtNum(r.failed)}: ${r.errors.join('، ')}`)
      else toast(`أرسلنا التسجيل إلى ${fmtNum(r.sent)}`)
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذر الإرسال')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm font-black"><Video className="h-4 w-4 text-teal-ink" aria-hidden="true" />تسجيل {section.title}</p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">بعد الدورة الصق رابط التسجيل (Zoom أو YouTube غير مدرج أو Drive)، وأرسله للمؤكدين في الشعبة.</p>
      <label className="mt-3 block">
        <span className={labelCls}>رابط التسجيل</span>
        <input dir="ltr" className={`${inputCls} mt-1`} placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button tone="confirm" size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>احفظ الرابط</Button>
        {section.recording && !dirty && missing > 0 && (
          <Button size="sm" icon={Send} loading={sending} onClick={() => void send()}>أرسله إلى {fmtNum(missing)} مؤكدين لم يصلهم</Button>
        )}
        {section.recording && !dirty && missing === 0 && <span className="text-read text-muted-foreground">وصل كل المؤكدين</span>}
      </div>
    </Card>
  )
}

/* ═══ الدفعُ بالبطاقة لمن هو خارج الأردن — رابطُ صفحة دفعٍ من مزوّدك (٢١ نوفمبر ٢٠٢٦) ═══ */
function CardLink({ cardUrl, onSaved }: { cardUrl: string | null; onSaved: (o: Overview) => void }) {
  const [url, setUrl] = useState(cardUrl ?? '')
  const [saving, setSaving] = useState(false)
  const dirty = url.trim() !== (cardUrl ?? '')
  async function save() {
    setSaving(true)
    try {
      onSaved(await apiPatch<Overview>(BASE, { cardUrl: url.trim() }))
      toast(url.trim() ? 'حفظنا رابط الدفع بالبطاقة — يظهر للحاجزين الآن' : 'أخفينا الدفع بالبطاقة')
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذر الحفظ')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm font-black"><CreditCard className="h-4 w-4 text-teal-ink" aria-hidden="true" />الدفع بالبطاقة — لمن هو خارج الأردن</p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        أنشئ صفحة دفع بمبلغ <bdi dir="ltr">{AI_JOBS.priceUsd}$</bdi> في Stripe (Payment Link) والصق رابطها هنا. فيظهر للحاجز خيار «بطاقة»، يدفع بلا إيصال يرفعه. واربط Stripe تحته ليتأكد مقعده وحده. وفارغه يخفي الخيار.
      </p>
      <label className="mt-3 block">
        <span className={labelCls}>رابط صفحة الدفع</span>
        <input dir="ltr" className={`${inputCls} mt-1`} placeholder="https://buy.stripe.com/… أو https://paypal.me/…" value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button tone="confirm" size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>احفظ</Button>
        {cardUrl && <Button as="a" href={cardUrl} target="_blank" rel="noopener noreferrer" size="sm" icon={ExternalLink}>افتحه</Button>}
      </div>
      {cardUrl && /buy\.stripe\.com/.test(cardUrl) && (
        <p className="mt-2 text-fine leading-5 text-muted-foreground">رابط Stripe يحمل رقم مرجع الحاجز، فتجده في لوحة Stripe بجانب الدفعة.</p>
      )}
    </Card>
  )
}

/* ═══ ربطُ Stripe — دفعُ البطاقة يؤكّد الحجزَ ويرسل بريدَ Zoom وحدَه (٢١ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «نعم اربط Stripe ليتأكّد تلقائيّا». والربطُ webhook في لوحة Stripe يرسل إلى رابطٍ هنا،
   ومفتاحُ توقيعه يُلصق في الحقل — لا في محادثة. وما وصل ولم نطابقه يظهر تحته ليطابقه بيده. */
const STRIPE_EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded']

function StripeAuto({ stripe, onSaved }: { stripe: StripeState; onSaved: (s: StripeState) => void }) {
  const [secret, setSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const hook = `${window.location.origin}/api/v1/public/private-courses/${SLUG}/stripe-webhook`

  async function save(value: string, done: string) {
    setSaving(true)
    try {
      onSaved(await apiPut<StripeState>('/api/v1/private/stripe', { webhookSecret: value }))
      setSecret('')
      toast(done)
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذر الحفظ')
    } finally {
      setSaving(false)
    }
  }

  async function dismiss(sessionId: string) {
    try {
      onSaved(await apiDelete<StripeState>(`/api/v1/private/stripe/unmatched/${encodeURIComponent(sessionId)}`))
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذر الحذف')
    }
  }

  return (
    <Card className="p-4 lg:col-span-2">
      <p className="flex items-center gap-2 text-sm font-black"><Zap className="h-4 w-4 text-teal-ink" aria-hidden="true" />تأكيد البطاقة تلقائيا — Stripe</p>
      <div className={`mt-2 rounded-lg px-3 py-2 text-read font-bold ${stripe.ready ? 'text-emerald-300' : 'text-gold-ink'}`}>
        {stripe.ready
          ? `مربوط — من يدفع بالبطاقة يتأكد مقعده ويصله البريد ورابط Zoom وحده. مفتاح التوقيع ${stripe.secretTail}${stripe.source === 'env' ? ' (من إعداد الخادم)' : ''}`
          : 'غير مربوط — من يدفع بالبطاقة تؤكده أنت بعد أن تجد دفعته في Stripe'}
      </div>
      {stripe.ready && (
        <p className="mt-1 text-read leading-6 text-muted-foreground">
          {stripe.lastEventAt
            ? <>آخر خبر من Stripe: {fmtDateTime(stripe.lastEventAt)} <span dir="ltr" className="font-mono text-fine">({stripe.lastEventType})</span></>
            : 'لم يصل أي خبر من Stripe بعد. جرب «Send test webhook» في Stripe ليظهر هنا.'}
        </p>
      )}
      <ol className="mt-3 grid list-decimal gap-1.5 ps-5 text-read leading-6 text-muted-foreground">
        <li>
          في Stripe افتح{' '}
          <a className="text-teal-ink underline" href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer">Developers ← Webhooks</a>
          {' '}واضغط «Add endpoint».
        </li>
        <li>
          الصق هذا الرابط في Endpoint URL:
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <code dir="ltr" className="break-all rounded bg-white/5 px-2 py-1 font-mono text-fine text-foreground">{hook}</code>
            <Button size="sm" tone="ghost" icon={Copy} onClick={() => { void navigator.clipboard?.writeText(hook).then(() => toast('نسخنا الرابط')) }}>انسخ</Button>
          </span>
        </li>
        <li>
          اختر الحدثين: {STRIPE_EVENTS.map((e, i) => <span key={e}>{i > 0 && ' و'}<code dir="ltr" className="font-mono text-fine text-foreground">{e}</code></span>)}
        </li>
        <li>بعد الحفظ اضغط «Reveal» تحت Signing secret، وانسخ المفتاح الذي يبدأ بـ <code dir="ltr" className="font-mono text-fine">whsec_</code> والصقه هنا.</li>
      </ol>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block min-w-64 flex-1">
          <span className={labelCls}>مفتاح التوقيع (Signing secret) {stripe.ready && '— اتركه فارغا ليبقى كما هو'}</span>
          <input dir="ltr" type="password" autoComplete="new-password" className={`${inputCls} mt-1`} placeholder="whsec_…"
            value={secret} onChange={(e) => setSecret(e.target.value)} disabled={stripe.source === 'env'} />
        </label>
        <Button tone="confirm" size="sm" loading={saving} disabled={!secret.trim() || stripe.source === 'env'}
          onClick={() => void save(secret, 'ربطنا Stripe — دفع البطاقة يؤكد المقعد وحده من الآن')}>احفظ</Button>
        {stripe.ready && stripe.source === 'db' && (
          <Button size="sm" tone="ghost" disabled={saving}
            onClick={() => { if (window.confirm('فصل Stripe؟ يعود تأكيد دفع البطاقة بيدك.')) void save('', 'فصلنا Stripe — تؤكد دفع البطاقة بيدك') }}>
            افصل
          </Button>
        )}
      </div>
      {stripe.unmatched.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-read font-bold text-gold-ink">دفعات وصلت ولم نجد حجزها — ابحث عنها في Stripe وأكد صاحبها بيدك</p>
          <ul className="mt-2 grid gap-2">
            {stripe.unmatched.map((u) => (
              <li key={u.sessionId}>
                <Inset tone="warn" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-read">
                  <b dir="ltr">{money(u.amount, u.currency)}</b>
                  {u.email && <span dir="ltr">{u.email}</span>}
                  {u.reference && <span>المرجع <b dir="ltr">{u.reference}</b></span>}
                  <span className="text-muted-foreground">{fmtDateTime(u.at)}</span>
                  <span className="text-muted-foreground">{u.reason === 'second' ? 'دفعة ثانية لحجز مدفوع — ردها من Stripe' : 'لا حجز بمرجعه ولا ببريده'}</span>
                  <Button size="sm" tone="ghost" className="ms-auto" onClick={() => void dismiss(u.sessionId)}>تمت مطابقتها</Button>
                </Inset>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

/* ═══ إبلاغُ Meta بالشراء (٢١ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة (اقتراحُ «٤»): حين تؤكّد حجزا يُبلَّغ Meta أنّه اشترى، فيبحث الإعلانُ عن أشباه من دفع. ورمزُ الوصول
   يُلصق هنا — لا في محادثة. */
function MetaSettings({ meta, pending, onSaved, onReported }: {
  meta: MetaState
  pending: number
  onSaved: (m: MetaState) => void
  onReported: () => void
}) {
  const [token, setToken] = useState('')
  const [testCode, setTestCode] = useState(meta.testCode)
  const [saving, setSaving] = useState(false)
  const [reporting, setReporting] = useState(false)

  async function save(body: { token?: string; testCode?: string }, done: string) {
    setSaving(true)
    try {
      onSaved(await apiPut<MetaState>('/api/v1/private/meta', body))
      setToken('')
      toast(done)
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذر الحفظ')
    } finally {
      setSaving(false)
    }
  }

  async function reportPending() {
    setReporting(true)
    try {
      const r = await apiPost<{ sent: number; left: number; error: string | null; meta: MetaState }>(`${BASE}/meta/report-pending`)
      onSaved(r.meta)
      onReported()
      if (r.error) toastError(`أبلغنا عن ${fmtNum(r.sent)} ثم توقفنا: ${r.error}`)
      else toast(`أبلغنا Meta عن ${fmtNum(r.sent)}`)
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذر الإبلاغ')
    } finally {
      setReporting(false)
    }
  }

  return (
    <Card className="p-4 lg:col-span-2">
      <p className="flex items-center gap-2 text-sm font-black"><Zap className="h-4 w-4 text-teal-ink" aria-hidden="true" />إبلاغ Meta بمن دفع</p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        حين تؤكد حجزا نخبر Meta أنه اشترى، فيبحث إعلانك عن أشخاص مثل من دفع، لا مثل من عبأ النموذج فقط.
      </p>
      <div className={`mt-2 rounded-lg px-3 py-2 text-read font-bold ${meta.ready ? 'text-emerald-300' : 'text-gold-ink'}`}>
        {meta.ready
          ? `جاهز — الرمز ${meta.tokenTail}${meta.source === 'env' ? ' (من إعداد الخادم)' : ''}${meta.lastSentAt ? ` · آخر إبلاغ ${fmtDateTime(meta.lastSentAt)}` : ''}`
          : 'غير جاهز — لا يصل Meta شيء حتى تلصق رمز الوصول'}
      </div>
      {meta.lastError && <p className="mt-1 text-read leading-6 text-red-300">آخر خطأ: {meta.lastError}</p>}
      {!meta.live && <p className="mt-1 text-read leading-6 text-muted-foreground">هذه بيئة تجربة: لا يخرج منها شيء إلى Meta.</p>}
      <ol className="mt-3 grid list-decimal gap-1.5 ps-5 text-read leading-6 text-muted-foreground">
        <li>
          افتح{' '}
          <a className="text-teal-ink underline" href={`https://business.facebook.com/events_manager2/list/pixel/${meta.pixelId}/settings`} target="_blank" rel="noopener noreferrer">Events Manager ← البكسل ← Settings</a>.
        </li>
        <li>تحت Conversions API اضغط «Generate access token»، وانسخ الرمز والصقه هنا.</li>
        <li>للتجربة: من «Test events» انسخ رمز الاختبار (يبدأ بـ TEST) والصقه، ثم أكد حجزا وانظر وصوله. وامسحه بعدها.</li>
      </ol>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className="block">
          <span className={labelCls}>رمز الوصول (Access token) {meta.ready && '— اتركه فارغا ليبقى كما هو'}</span>
          <input dir="ltr" type="password" autoComplete="new-password" className={`${inputCls} mt-1`} placeholder="EAA…"
            value={token} onChange={(e) => setToken(e.target.value)} disabled={meta.source === 'env'} />
        </label>
        <label className="block">
          <span className={labelCls}>رمز الاختبار (اختياري)</span>
          <input dir="ltr" className={`${inputCls} mt-1`} placeholder="TEST12345" value={testCode} onChange={(e) => setTestCode(e.target.value)} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button tone="confirm" size="sm" loading={saving} disabled={!token.trim() && testCode.trim() === meta.testCode}
          onClick={() => void save({ ...(token.trim() ? { token } : {}), testCode: testCode.trim() }, 'حفظنا إعداد Meta')}>احفظ</Button>
        {meta.ready && meta.source === 'db' && (
          <Button size="sm" tone="ghost" disabled={saving}
            onClick={() => { if (window.confirm('فصل Meta؟ لا يصله خبر الشراء بعدها.')) void save({ token: '' }, 'فصلنا Meta') }}>افصل</Button>
        )}
        {meta.ready && pending > 0 && (
          <Button size="sm" icon={Send} loading={reporting} onClick={() => void reportPending()}>أبلغ عن {fmtNum(pending)} مؤكدين لم يبلغ عنهم</Button>
        )}
      </div>
    </Card>
  )
}

function CourseFile({ file, onSaved }: { file: Overview['course']['file']; onSaved: (o: Overview) => void }) {
  const [busy, setBusy] = useState(false)
  async function upload(f: File | undefined) {
    if (!f) return
    setBusy(true)
    try {
      await apiUpload(`${BASE}/file?name=${encodeURIComponent(f.name)}`, f)
      onSaved(await apiGet<Overview>(BASE))
      toast('رفعنا ملف الدورة — يرفق بكل بريد تأكيد من الآن')
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذر الرفع')
    } finally {
      setBusy(false)
    }
  }
  async function revert() {
    setBusy(true)
    try {
      onSaved(await apiDelete<Overview>(`${BASE}/file`))
      toast('عدنا إلى ملف الدورة الأصلي')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm font-black"><FileText className="h-4 w-4 text-teal-ink" aria-hidden="true" />ملف الدورة المرفق بالبريد</p>
      <p className="mt-2 text-read leading-6">
        <span dir="ltr" className="font-mono">{file.name}</span>
        <span className="text-muted-foreground"> — {file.custom ? 'رفعته أنت' : 'المنشور الذي أرسلته'}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button as="a" href={`${BASE}/file`} target="_blank" rel="noopener" size="sm" icon={ExternalLink}>افتحه</Button>
        <Button as="label" size="sm" icon={Upload} className="cursor-pointer">
          {busy ? 'نرفع…' : 'ارفع ملفا آخر'}
          <input type="file" accept="application/pdf,image/*" className="sr-only" disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} />
        </Button>
        {file.custom && <Button size="sm" tone="ghost" icon={RotateCcw} disabled={busy} onClick={() => void revert()}>عد إلى الأصلي</Button>}
      </div>
    </Card>
  )
}

function GmailSettings({ gmail, onSaved }: { gmail: Overview['gmail']; onSaved: (g: Overview['gmail']) => void }) {
  const [user, setUser] = useState(gmail.user)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [testTo, setTestTo] = useState('suhaib@wajeez.co')
  const [testing, setTesting] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const g = await apiPut<Overview['gmail']>('/api/v1/private/mail', { user: user.trim(), ...(password.trim() ? { appPassword: password } : {}) })
      onSaved(g)
      setPassword('')
      toast('حفظنا إعداد Gmail')
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذر الحفظ')
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    try {
      const r = await apiPost<{ ok: boolean; error?: string }>('/api/v1/private/mail/test', { to: testTo.trim() })
      if (r.ok) toast(`أرسلنا رسالة تجربة إلى ${testTo.trim()}`)
      else toastError(r.error ?? 'تعذر الإرسال')
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذر الإرسال')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm font-black"><Mail className="h-4 w-4 text-teal-ink" aria-hidden="true" />المرسل: Gmail الخاص بك</p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        البريد يخرج من حسابك أنت، لا من بريد الأكاديمية. يحتاج «كلمة مرور تطبيق» من Google: افتح{' '}
        <a className="text-teal-ink underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">myaccount.google.com/apppasswords</a>
        {' '}(يلزم تفعيل التحقق بخطوتين)، وأنشئ كلمة باسم «Course»، والصقها هنا.
      </p>
      <div className={`mt-3 rounded-lg px-3 py-2 text-read font-bold ${gmail.ready ? 'text-emerald-300' : 'text-gold-ink'}`}>
        {gmail.ready
          ? `جاهز — ${gmail.user} · كلمة المرور ${gmail.passwordTail}${gmail.source === 'env' ? ' (من إعداد الخادم)' : ''}`
          : 'غير جاهز — لا يصل بريد التأكيد حتى تكتب كلمة مرور التطبيق'}
      </div>
      {!gmail.live && (
        <p className="mt-1 text-read leading-6 text-muted-foreground">هذه بيئة تجربة: البريد الحقيقي لا يخرج منها.</p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>بريد Gmail المرسل</span>
          <input dir="ltr" className={`${inputCls} mt-1`} value={user} onChange={(e) => setUser(e.target.value)} disabled={gmail.source === 'env'} />
        </label>
        <label className="block">
          <span className={labelCls}>كلمة مرور التطبيق {gmail.ready && '(اتركها فارغة لتبقى كما هي)'}</span>
          <input dir="ltr" type="password" autoComplete="new-password" className={`${inputCls} mt-1`} placeholder="abcd efgh ijkl mnop"
            value={password} onChange={(e) => setPassword(e.target.value)} disabled={gmail.source === 'env'} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Button tone="confirm" size="sm" loading={saving} disabled={gmail.source === 'env'} onClick={() => void save()}>احفظ</Button>
        <label className="block">
          <span className={labelCls}>رسالة تجربة إلى</span>
          <input dir="ltr" className={`${inputCls} mt-1 w-64`} value={testTo} onChange={(e) => setTestTo(e.target.value)} />
        </label>
        <Button size="sm" icon={Send} loading={testing} disabled={!gmail.ready} onClick={() => void test()}>أرسل تجربة</Button>
      </div>
    </Card>
  )
}

/* ═══ التسجيلُ الواحد ═══ */

function RegistrationCard({ r, onChange, onRemove, onReload }: {
  r: Registration
  onChange: (r: Registration) => void
  onRemove: (id: string) => void
  /** حذفُ أحد اثنين سجّلا معا يفكّ الآخرَ في الخادم — فتُقرأ القائمةُ من جديد */
  onReload: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const isImage = r.proof?.mime.startsWith('image/') ?? false
  const proofUrl = `/api/v1/private/registrations/${r.id}/proof`
  const section = AI_JOBS.sections.find((s) => s.key === r.sectionKey)
  /* رابطُ الدفع باسمه — يذكّره به على واتساب من حجز ولم يرفع الحوالة */
  const payLink = `${window.location.origin}/ai-jobs/pay/${r.payToken}`
  const reminder = whatsappLink(r.phone,
    `مرحبا ${r.fullName.split(' ')[0]}، حجزنا لك مقعدا في ${section?.title ?? 'الدورة'} يوم ${AI_JOBS.dateLabel}. لتأكيده حوّل ${r.amountJod} دينار${r.pairRole === 'lead' && r.partnerName ? ` عنك وعن ${r.partnerName.split(' ')[0]}` : ''} عبر CliQ إلى ${AI_JOBS.cliqAlias} وارفع صورة الحوالة من هنا: ${payLink}`)

  async function act(key: string, run: () => Promise<{ registration: Registration; partners?: Registration[]; mail?: MailResult }>, okText?: string) {
    setBusy(key)
    try {
      const out = await run()
      onChange(out.registration)
      /* وشريكُه معه — سجّلا معا فيتأكّدان ويُرفضان ويُنقلان معا (٢١ نوفمبر ٢٠٢٦) */
      for (const p of out.partners ?? []) onChange(p)
      if (out.mail !== undefined) mailToast(out.mail, okText ?? 'تم')
      else if (okText) toast(okText)
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذر التنفيذ')
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!window.confirm(`حذف تسجيل ${r.fullName} وصورة حوالته نهائيا؟ لا يمكن التراجع.`)) return
    setBusy('delete')
    try {
      await apiDelete(`/api/v1/private/registrations/${r.id}`)
      onRemove(r.id)
      if (r.pairRole) onReload()
      toast('حذفنا التسجيل')
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذر الحذف')
      setBusy(null)
    }
  }

  return (
    <Card as="article" tone={r.status === 'pending' ? 'warn' : 'default'} className="p-4">
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black">{r.fullName}</h3>
            <Inset tone={STATUS_TONE[r.status]} className="px-2 py-0.5 text-fine font-bold">{r.status === 'pending' && !r.proof && !r.cardPaidAt && !r.partnerPaid ? 'بانتظار الدفع' : STATUS_AR[r.status]}</Inset>
            {r.pairRole && (
              <Inset tone="accent" className="px-2 py-0.5 text-fine font-bold">
                {r.pairRole === 'lead' ? `مع صديقه ${r.partnerName ?? ''} · يدفع ${r.amountJod} دينار عنهما` : `مع ${r.partnerName ?? 'صديقه'} · يدفع عنه`}
              </Inset>
            )}
            <span dir="ltr" className="font-mono text-fine text-muted-foreground">#{r.reference}</span>
          </div>
          <div className="mt-2 grid gap-1 text-read leading-6">
            <a dir="ltr" className="w-fit text-teal-ink hover:underline" href={`mailto:${r.email}`}>{r.email}</a>
            <a dir="ltr" className="w-fit text-teal-ink hover:underline" href={whatsappLink(r.phone)} target="_blank" rel="noopener noreferrer">{r.phone} · واتساب</a>
            <span className="text-muted-foreground">سجل {fmtDateTime(r.createdAt)}{r.proofUploadedAt && r.proofUploadedAt !== r.createdAt ? ` · رفع الحوالة ${fmtDateTime(r.proofUploadedAt)}` : ''}</span>
            <span className="text-muted-foreground">المصدر: <b className="text-foreground">{r.source ?? 'مباشر'}</b>{r.payMethod && <> · الدفع: <b className="text-foreground">{r.payMethod === 'card' ? 'بطاقة' : 'CliQ'}</b></>}</span>
            {r.note && <span>ملاحظته: {r.note}</span>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-read">
              <span className="shrink-0 text-muted-foreground">الشعبة</span>
              <select className={`${inputCls} max-w-xs py-1`} value={r.sectionKey} disabled={busy !== null}
                onChange={(e) => void act('move', () => apiPatch(`/api/v1/private/registrations/${r.id}`, { sectionKey: e.target.value }), 'نقلناه — أعد إرسال البريد إن كان مؤكدا')}>
                {AI_JOBS.sections.map((s) => <option key={s.key} value={s.key}>{s.title} · {s.timeLabel}</option>)}
              </select>
            </label>
          </div>
          {r.status === 'confirmed' && (
            <p className={`mt-2 text-read font-bold ${r.mailError ? 'text-red-300' : r.zoomMissing || !r.mailSentAt ? 'text-gold-ink' : 'text-emerald-300'}`}>
              {r.mailError
                ? `لم يصله البريد: ${r.mailError}`
                : !r.mailSentAt
                  ? 'تأكد بلا بريد — لم يرسل له شيء بعد'
                  : r.zoomMissing
                    ? `وصله البريد ${fmtDateTime(r.mailSentAt)} قبل رابط Zoom الحالي`
                    : `وصله البريد ورابط Zoom ${fmtDateTime(r.mailSentAt)}`}
            </p>
          )}
          {r.status === 'confirmed' && r.pairRole !== 'friend' && (r.metaSentAt || r.metaError) && (
            <p className={`mt-1 flex flex-wrap items-center gap-2 text-read ${r.metaError && !r.metaSentAt ? 'text-red-300' : 'text-muted-foreground'}`}>
              {r.metaSentAt ? `أبلغنا Meta بشرائه ${fmtDateTime(r.metaSentAt)}` : `لم يصل Meta: ${r.metaError}`}
              {!r.metaSentAt && (
                <Button size="sm" tone="ghost" loading={busy === 'meta'} disabled={busy !== null}
                  onClick={() => void act('meta', () => apiPost(`/api/v1/private/registrations/${r.id}/meta`), 'أعدنا إبلاغ Meta')}>أعد الإبلاغ</Button>
              )}
            </p>
          )}
          {r.recordingSentAt && <p className="mt-1 text-read text-muted-foreground">وصله التسجيل {fmtDateTime(r.recordingSentAt)}{r.recordingMissing ? ' — قبل الرابط الحالي' : ''}</p>}
        </div>

        {r.proof
          ? (
            <a href={proofUrl} target="_blank" rel="noopener" className="block w-full md:w-40" title="افتح صورة الحوالة">
              {isImage
                ? <img src={proofUrl} alt={`حوالة ${r.fullName}`} loading="lazy" className="h-40 w-full rounded-lg border border-white/10 bg-white object-contain md:w-40" />
                : (
                  <Inset className="flex h-40 flex-col items-center justify-center gap-2 text-read">
                    <FileText className="h-8 w-8 text-teal-ink" aria-hidden="true" />
                    افتح الحوالة (PDF)
                  </Inset>
                )}
            </a>
          )
          : r.pairRole === 'friend'
            ? (
              /* من حجز له صديقُه ويدفع عنهما — حوالتُهما على بطاقة صديقه (٢١ نوفمبر ٢٠٢٦) */
              <Inset tone={r.partnerPaid ? 'positive' : 'warn'} className="flex w-full flex-col items-start gap-2 p-3 text-read md:w-56">
                <b>يدفع عنه {r.partnerName ?? 'صديقه'}</b>
                <span className="text-fine leading-5 text-muted-foreground">
                  {r.partnerPaid ? 'رفع الحوالة عنهما — تجدها على بطاقته. تأكيد أحدهما يؤكد الاثنين.' : 'لم يدفع بعد. تأكيد أحدهما يؤكد الاثنين.'}
                </span>
              </Inset>
            )
          : r.cardPaidAt
            ? (
              /* دفعُ البطاقة كما أخبر به Stripe — يتأكّد وحدَه، إلّا مبلغا دون السعر يبقى للمراجعة (٢١ نوفمبر ٢٠٢٦) */
              <Inset tone={r.status === 'confirmed' ? 'positive' : 'warn'} className="flex w-full flex-col items-start gap-2 p-3 text-read md:w-56">
                <b>دفع بالبطاقة <bdi dir="ltr">{money(r.cardAmount, r.cardCurrency)}</bdi></b>
                <span className="text-fine leading-5 text-muted-foreground">
                  أخبر به Stripe {fmtDateTime(r.cardPaidAt)}{r.status === 'confirmed' ? ' — وتأكد مقعده وحده' : ''}
                </span>
                {r.status === 'pending' && (
                  <span className="text-fine leading-5 text-gold-ink">
                    {r.cardCurrency === 'USD' && (r.cardAmount ?? 0) < AI_JOBS.priceUsd * 100
                      ? 'المبلغ أقل من سعر الدورة — راجعه في Stripe ثم أكده أو ارفضه'
                      : 'لم يتأكد بعد — أكده'}
                  </span>
                )}
                {r.stripePaymentId && (
                  <Button as="a" href={`https://dashboard.stripe.com/payments/${r.stripePaymentId}`} target="_blank" rel="noopener noreferrer" size="sm" icon={ExternalLink}>
                    افتحها في Stripe
                  </Button>
                )}
              </Inset>
            )
          : (
            <Inset tone="warn" className="flex w-full flex-col items-start gap-2 p-3 text-read md:w-56">
              {/* البطاقةُ لا إيصالَ لها: يُطابَق دفعُه في Stripe برقم مرجعه (٢١ نوفمبر ٢٠٢٦) */}
              {r.payMethod === 'card'
                ? (
                  <>
                    <b>اختار الدفع بالبطاقة</b>
                    <span className="text-fine leading-5 text-muted-foreground">ابحث في Stripe عن رقم المرجع <b dir="ltr" className="text-foreground">{r.reference}</b>. إن وصل الدفع فأكّده. وإن لم يصل ذكّره:</span>
                  </>
                )
                : (
                  <>
                    <b>لم يرفع الحوالة بعد</b>
                    <span className="text-fine leading-5 text-muted-foreground">حجز مقعده ولم يدفع. ذكّره برابط الدفع باسمه:</span>
                  </>
                )}
              {/* والبريدُ يذكّره وحدَه: بعد يوم، و«آخر فرصة» بعد ثلاثة (٢١ نوفمبر ٢٠٢٦) */}
              <span className="text-fine leading-5 text-muted-foreground">
                {r.lastChanceAt
                  ? `وصله بريد «آخر فرصة» ${fmtDateTime(r.lastChanceAt)}`
                  : r.remindedAt
                    ? `وصله التذكير بالبريد ${fmtDateTime(r.remindedAt)} — و«آخر فرصة» بعد 3 أيام من حجزه`
                    : 'يصله تذكير بالبريد بعد يوم من حجزه، و«آخر فرصة» بعد 3 أيام'}
              </span>
              {r.reminderError && <span className="text-fine leading-5 text-red-300">لم يصله التذكير: {r.reminderError}</span>}
              <Button as="a" href={reminder} target="_blank" rel="noopener noreferrer" size="sm" icon={MessageCircle}>ذكّره على واتساب</Button>
              <Button size="sm" tone="ghost" icon={Copy} onClick={() => { void navigator.clipboard?.writeText(payLink).then(() => toast('نسخنا رابط الدفع')) }}>انسخ رابط الدفع</Button>
            </Inset>
          )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        {r.status === 'pending' && (
          <>
            <Button tone="confirm" size="sm" icon={CheckCircle2} loading={busy === 'confirm'} disabled={busy !== null}
              onClick={() => void act('confirm', () => apiPost(`/api/v1/private/registrations/${r.id}/confirm`, { sendMail: true }), `أكدنا ${r.fullName} ووصله البريد ورابط Zoom`)}>
              أكّد وأرسل البريد
            </Button>
            <Button size="sm" loading={busy === 'quiet'} disabled={busy !== null}
              onClick={() => void act('quiet', () => apiPost(`/api/v1/private/registrations/${r.id}/confirm`, { sendMail: false }), 'أكدناه بلا بريد')}>
              أكّد بلا بريد
            </Button>
            <Button tone="danger" size="sm" icon={XCircle} loading={busy === 'reject'} disabled={busy !== null}
              onClick={() => void act('reject', () => apiPost(`/api/v1/private/registrations/${r.id}/reject`), 'رفضناه — لم يرسل له شيء')}>
              ارفض
            </Button>
          </>
        )}
        {r.status === 'confirmed' && (
          <>
            <Button size="sm" icon={Send} loading={busy === 'send'} disabled={busy !== null}
              onClick={() => void act('send', () => apiPost(`/api/v1/private/registrations/${r.id}/send`), 'أرسلنا البريد من جديد')}>
              {r.mailSentAt ? 'أرسل البريد من جديد' : 'أرسل البريد الآن'}
            </Button>
            <Button size="sm" tone="ghost" icon={RotateCcw} loading={busy === 'reopen'} disabled={busy !== null}
              onClick={() => void act('reopen', () => apiPost(`/api/v1/private/registrations/${r.id}/reopen`), 'أعدناه للمراجعة')}>
              أعده للمراجعة
            </Button>
          </>
        )}
        {r.status === 'rejected' && (
          <Button size="sm" icon={RotateCcw} loading={busy === 'reopen'} disabled={busy !== null}
            onClick={() => void act('reopen', () => apiPost(`/api/v1/private/registrations/${r.id}/reopen`), 'أعدناه للمراجعة')}>
            أعده للمراجعة
          </Button>
        )}
        <Button size="sm" tone="ghost" icon={Trash2} loading={busy === 'delete'} disabled={busy !== null} onClick={() => void remove()} className="ms-auto">
          احذف
        </Button>
      </div>
      {r.status === 'pending' && (
        <p className="mt-2 text-fine leading-5 text-muted-foreground">
          «أكّد وأرسل البريد»: يصله التأكيد ورابط Zoom {section ? `(${section.title})` : ''} وملف الدورة من Gmail الخاص بك. «أكّد بلا بريد»: يحسب مؤكدا وترسل له لاحقا. «ارفض»: لا يصله شيء، وتستطيع إعادته.
        </p>
      )}
    </Card>
  )
}

/* ═══ الصفحة ═══ */

/* «بانتظار الدفع»: حجز ولم يرفع الحوالة — و«قيد المراجعة»: رفعها ولم تُؤكَّد (٢٠ نوفمبر ٢٠٢٦) */
type Filter = 'unpaid' | 'review' | 'confirmed' | 'rejected' | 'all'

function filterOf(r: Registration): Exclude<Filter, 'all'> {
  /* ودفعُ بطاقةٍ أخبر به Stripe وبقي للمراجعة (مبلغٌ دون السعر) — دفع، فهو للمراجعة لا للتذكير */
  /* ومن دفع عنه صديقُه فحالُه حالُ صديقه (٢١ نوفمبر ٢٠٢٦) */
  if (r.status === 'pending') return r.proof || r.cardPaidAt || r.partnerPaid ? 'review' : 'unpaid'
  return r.status
}

export default function PrivateWorkspace() {
  const [data, setData] = useState<Overview | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
  const [filter, setFilter] = useState<Filter>('review')
  const [section, setSection] = useState<string>('')
  const [q, setQ] = useState('')
  const [onlyConfirmed, setOnlyConfirmed] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [bulk, setBulk] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const o = await apiGet<Overview>(BASE)
      setData(o)
      setState('ok')
    } catch (e) {
      setState(e instanceof ApiError && e.status === 404 ? 'missing' : 'error')
    }
  }, [])

  useEffect(() => {
    document.title = 'مساحتي الخاصة'
    void load()
  }, [load])

  const regs = useMemo(() => data?.registrations ?? [], [data])
  const counts = useMemo(() => ({
    unpaid: regs.filter((r) => filterOf(r) === 'unpaid').length,
    review: regs.filter((r) => filterOf(r) === 'review').length,
    confirmed: regs.filter((r) => r.status === 'confirmed').length,
    rejected: regs.filter((r) => r.status === 'rejected').length,
  }), [regs])

  /* من أين جاؤوا — بأوّل مقطعٍ من المصدر («Instagram · bf1» ← Instagram)، الحاجزون والمؤكَّدون */
  const sources = useMemo(() => {
    const m = new Map<string, { all: number; confirmed: number }>()
    for (const r of regs) {
      const k = (r.source ?? 'مباشر').split(' · ')[0]
      const v = m.get(k) ?? { all: 0, confirmed: 0 }
      v.all += 1
      if (r.status === 'confirmed') v.confirmed += 1
      m.set(k, v)
    }
    return [...m.entries()].sort((a, b) => b[1].all - a[1].all)
  }, [regs])

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return regs.filter((r) =>
      (filter === 'all' || filterOf(r) === filter)
      && (!section || r.sectionKey === section)
      && (!term || r.fullName.toLowerCase().includes(term) || r.email.includes(term) || r.phone.includes(term.replace(/\s/g, '')) || r.reference.toLowerCase().includes(term)))
  }, [regs, filter, section, q])

  const patchReg = (n: Registration) => setData((d) => d && ({ ...d, registrations: d.registrations.map((x) => (x.id === n.id ? n : x)) }))
  const dropReg = (id: string) => setData((d) => d && ({ ...d, registrations: d.registrations.filter((x) => x.id !== id) }))

  async function toggleOpen() {
    if (!data) return
    setToggling(true)
    try {
      const o = await apiPatch<Overview>(BASE, { open: !data.course.open })
      setData(o)
      toast(o.course.open ? 'فتحنا التسجيل في الصفحة' : 'أغلقنا التسجيل — الصفحة تقول للزائر إنه مغلق')
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذر التنفيذ')
    } finally {
      setToggling(false)
    }
  }

  /* الإرسالُ لمن ينقصه الرابط — واحدا واحدا، فيُرى التقدّمُ ولا يطول نداءٌ واحدٌ حتى ينقطع */
  async function sendMissing(sectionKey: string) {
    const targets = regs.filter((r) => r.sectionKey === sectionKey && r.zoomMissing)
    setBulk(sectionKey)
    let ok = 0
    const failed: string[] = []
    for (const r of targets) {
      try {
        const out = await apiPost<{ registration: Registration; mail: MailResult }>(`/api/v1/private/registrations/${r.id}/send`)
        patchReg(out.registration)
        if (out.mail?.ok) ok += 1
        else failed.push(r.fullName)
      } catch {
        failed.push(r.fullName)
      }
    }
    setBulk(null)
    if (failed.length) toastError(`وصل ${fmtNum(ok)} ولم يصل ${fmtNum(failed.length)}: ${failed.join('، ')}`)
    else toast(`أرسلنا الرابط إلى ${fmtNum(ok)}`)
  }

  async function download(sectionKey?: string) {
    const params = new URLSearchParams()
    if (sectionKey) params.set('section', sectionKey)
    if (onlyConfirmed) params.set('status', 'confirmed')
    const qs = params.toString()
    try {
      await apiDownload(`${BASE}/export.xlsx${qs ? `?${qs}` : ''}`, 'registrations.xlsx')
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذر التحميل')
    }
  }

  if (state === 'loading') {
    return <div className="grid min-h-screen place-items-center bg-paper"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" aria-label="جاري التحميل" /></div>
  }
  if (state === 'missing') {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-paper px-5 text-center">
        <div><p className="text-xl font-black">الصفحة غير موجودة</p><Link to="/" className="mt-3 inline-block text-teal-ink underline">الرئيسية</Link></div>
      </div>
    )
  }
  if (state === 'error' || !data) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-paper px-5 text-center">
        <div><p className="font-bold">تعذر الوصول إلى الخادم</p><Button className="mt-3" icon={RefreshCw} onClick={() => { setState('loading'); void load() }}>أعد المحاولة</Button></div>
      </div>
    )
  }

  const income = counts.confirmed * data.course.priceJod
  const tabs: { key: Filter; label: string; n: number }[] = [
    { key: 'review', label: 'قيد المراجعة', n: counts.review },
    { key: 'unpaid', label: 'بانتظار الدفع', n: counts.unpaid },
    { key: 'confirmed', label: 'مؤكد', n: counts.confirmed },
    { key: 'rejected', label: 'مرفوض', n: counts.rejected },
    { key: 'all', label: 'الكل', n: regs.length },
  ]

  return (
    <div dir="rtl" className="min-h-screen bg-paper pb-16">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="flex items-center gap-2 text-lg font-black"><Lock className="h-4 w-4 text-gold-ink" aria-hidden="true" />مساحتي الخاصة</p>
            <p className="text-fine text-muted-foreground">لك وحدك — لا يراها أحد من فريق الأكاديمية</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to="/ai-jobs" target="_blank" size="sm" icon={ExternalLink}>صفحة الدورة</Button>
            <Button as={Link} to="/admin" size="sm" tone="ghost">لوحة الإدارة</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 pt-6">
        <Panel className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-black">{data.course.title}</h1>
              <p className="mt-1 text-read text-muted-foreground">{AI_JOBS.dateLabel} · {AI_JOBS.priceJod} دينار عبر CliQ ({AI_JOBS.cliqAlias})</p>
            </div>
            <Button tone={data.course.open ? 'secondary' : 'confirm'} size="sm" icon={data.course.open ? Lock : LockOpen} loading={toggling} onClick={() => void toggleOpen()}>
              {data.course.open ? 'التسجيل مفتوح — أغلقه' : 'التسجيل مغلق — افتحه'}
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Inset tone="warn" className="p-3"><p className="text-fine text-muted-foreground">قيد المراجعة</p><p className="text-2xl font-black">{fmtNum(counts.review)}</p></Inset>
            <Inset className="p-3"><p className="text-fine text-muted-foreground">بانتظار الدفع</p><p className="text-2xl font-black">{fmtNum(counts.unpaid)}</p></Inset>
            <Inset tone="positive" className="p-3"><p className="text-fine text-muted-foreground">مؤكد</p><p className="text-2xl font-black">{fmtNum(counts.confirmed)}</p></Inset>
            {data.course.sections.map((s) => (
              <Inset key={s.key} className="p-3">
                <p className="text-fine text-muted-foreground">{s.title} (مؤكد)</p>
                <p className="text-2xl font-black">{fmtNum(regs.filter((r) => r.sectionKey === s.key && r.status === 'confirmed').length)}</p>
              </Inset>
            ))}
          </div>
          <p className="mt-3 text-read text-muted-foreground">إيراد المؤكدين: <b className="text-foreground">{fmtNum(income)} دينار</b></p>
          {sources.length > 0 && (
            <div className="mt-4">
              <p className="text-fine font-bold text-muted-foreground">من أين جاؤوا — حجزوا / تأكدوا</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sources.map(([name, v]) => (
                  <Inset key={name} className="px-3 py-1.5 text-read">
                    {name} <b className="text-foreground">{fmtNum(v.all)}</b> / <span className="text-emerald-300">{fmtNum(v.confirmed)}</span>
                  </Inset>
                ))}
              </div>
              <p className="mt-2 text-fine leading-5 text-muted-foreground">
                أضف <span dir="ltr" className="font-mono">?src=instagram</span> أو <span dir="ltr" className="font-mono">?src=linkedin&amp;utm_campaign=post1</span> إلى الرابط الذي تنشره، فيظهر هنا باسمه.
              </p>
            </div>
          )}
        </Panel>

        <Panel as="section" className="p-5" aria-labelledby="pv-settings">
          <h2 id="pv-settings" className="text-base font-black">الإعدادات</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {data.course.sections.map((s) => (
              <ZoomEditor key={`${s.key}:${s.zoom?.url ?? ''}`} section={s} onSaved={setData}
                missing={regs.filter((r) => r.sectionKey === s.key && r.zoomMissing).length}
                sending={bulk === s.key} onSendMissing={() => void sendMissing(s.key)} />
            ))}
            {data.course.sections.map((s) => (
              <RecordingEditor key={`rec:${s.key}:${s.recording ?? ''}`} section={s} onSaved={setData}
                missing={regs.filter((r) => r.sectionKey === s.key && r.recordingMissing).length} />
            ))}
            {data.course.cardPayments && (
              <>
                <CardLink key={data.course.cardUrl ?? ''} cardUrl={data.course.cardUrl} onSaved={setData} />
                <StripeAuto stripe={data.stripe} onSaved={(st) => setData((d) => d && ({ ...d, stripe: st }))} />
              </>
            )}
            <MetaSettings meta={data.meta} onSaved={(m) => setData((d) => d && ({ ...d, meta: m }))} onReported={() => void load()}
              pending={regs.filter((r) => r.status === 'confirmed' && r.pairRole !== 'friend' && !r.metaSentAt).length} />
            <CourseFile file={data.course.file} onSaved={setData} />
            <GmailSettings gmail={data.gmail} onSaved={(g) => setData((d) => d && ({ ...d, gmail: g }))} />
          </div>
        </Panel>

        <Panel as="section" className="p-5" aria-labelledby="pv-regs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="pv-regs" className="text-base font-black">المسجلون</h2>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-read">
                <input type="checkbox" checked={onlyConfirmed} onChange={(e) => setOnlyConfirmed(e.target.checked)} />
                المؤكدون فقط
              </label>
              <Button size="sm" icon={Download} onClick={() => void download()}>Excel: الكل</Button>
              {AI_JOBS.sections.map((s) => (
                <Button key={s.key} size="sm" icon={Download} onClick={() => void download(s.key)}>{s.title}</Button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <TabBar<Filter>
              ariaLabel="حالة التسجيل"
              items={tabs.map((t) => ({ id: t.key, label: `${t.label} (${fmtNum(t.n)})` }))}
              value={filter}
              onChange={setFilter}
            />
            <div className="w-44">
              <select className={`${inputCls} py-1`} aria-label="الشعبة" value={section} onChange={(e) => setSection(e.target.value)}>
                <option value="">كل الشعب</option>
                {AI_JOBS.sections.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
              </select>
            </div>
            <label className="relative w-72 max-w-full">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input className={`${inputCls} py-1 pr-9`} placeholder="ابحث بالاسم أو البريد أو الرقم" aria-label="بحث" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>

          <div className="mt-4 space-y-3">
            {shown.length === 0
              ? <Inset className="p-6 text-center text-read text-muted-foreground">لا أحد هنا {filter === 'review' ? '— لا حوالات تنتظر المراجعة' : filter === 'unpaid' ? '— كل من حجز رفع حوالته' : ''}</Inset>
              : shown.map((r) => <RegistrationCard key={r.id} r={r} onChange={patchReg} onRemove={dropReg} onReload={() => void load()} />)}
          </div>
        </Panel>
      </main>
    </div>
  )
}

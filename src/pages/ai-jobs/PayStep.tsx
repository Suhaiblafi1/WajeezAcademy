/* ═══ الخطوةُ الثانية: الدفعُ ورفعُ صورة الحوالة — بعد الحجز أو من رابط الدفع (٢٠ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «احجز أوّلا وادفع بعد». فالزائرُ يحجز باسمه ورقمه وشعبته، ثمّ يرى هنا الاسمَ المستعار في CliQ
   ويرفع صورةَ الحوالة — الآنَ، أو لاحقا من رابطٍ باسمه (`/ai-jobs/pay/<token>`) يحفظه أو يرسله لنفسه على واتساب.
   ومن لم يرفع يراه صاحبُ الدورة في لوحته «بانتظار الدفع» ويذكّره برابطه نفسِه. */

import { useState, type FormEvent } from 'react'
import { ApiError, apiPost } from '@/services/api'
import { AI_JOBS } from '@/application/private-course/ai-jobs'
import { whatsappLink } from '@/application/private-course/phone'
import { waShare } from '@/application/site/whatsapp'
import { readProof, type Proof } from './proof-file'
import ProofDrop from './ProofDrop'
import AbroadPay from './AbroadPay'
import ShareInvite from './ShareInvite'
import { trackPixel } from './meta-pixel'

export interface PayInfo {
  firstName: string
  reference: string
  sectionTitle: string
  status: 'pending' | 'confirmed' | 'rejected'
  hasProof: boolean
  /** رابطُ الدفع بالبطاقة إن ضبطه صاحبُ الدورة — وإلّا CliQ وحدَه (٢١ نوفمبر ٢٠٢٦) */
  cardUrl: string | null
  /** رقمُه خارجَ الأردن — فالبطاقةُ هي الخيارُ الأوّل له */
  abroad: boolean
  /** ضغط «ادفع بالبطاقة» ولم يرفع حوالة */
  cardChosen: boolean
  /** Stripe مربوط: دفعُ البطاقة يؤكّد مقعده وحدَه، والبريدُ يصله خلال دقائق (٢١ نوفمبر ٢٠٢٦) */
  cardAuto: boolean
}

type Method = 'cliq' | 'card'

function payUrl(token: string): string {
  return `${window.location.origin}/ai-jobs/pay/${token}`
}

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch {
      /* متصفّحٌ بلا حافظة — النصُّ مكتوبٌ أمامه */
    }
  }
  return (
    <button type="button" className={`aij-copy${done ? ' done' : ''}`} onClick={() => void copy()} aria-live="polite">
      {done ? 'نسخ ✓' : label}
    </button>
  )
}

const Tick = () => (
  <div className="tick" aria-hidden="true">
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  </div>
)

export default function PayStep({ token, info, fresh = false, onChange }: {
  token: string
  info: PayInfo
  /** جاء من النموذج الآن — «حجزنا مقعدك» لا «أكمل حجزك» */
  fresh?: boolean
  onChange: (next: PayInfo) => void
}) {
  const [proof, setProof] = useState<Proof | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [again, setAgain] = useState(false)
  const [method, setMethod] = useState<Method>(info.cardUrl && (info.abroad || info.cardChosen) ? 'card' : 'cliq')
  const link = payUrl(token)
  const card = method === 'card' && Boolean(info.cardUrl)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      setProof(await readProof(file))
    } catch (e) {
      setProof(null)
      setError(e instanceof Error ? e.message : 'تعذر قراءة الملف')
    } finally {
      setBusy(false)
    }
  }

  /* البطاقةُ لا إيصالَ لها: يصله إيصالُها ويصلنا الدفع، فنؤكد مقعده — قرارُ صاحب المنصّة (٢١ نوفمبر ٢٠٢٦).
     فيكفي أن نكتب أنّه ذهب إليها، ولا يُنتظر الردّ: صفحةُ الدفع تُفتح في نافذةٍ أخرى */
  function goCard() {
    trackPixel('InitiateCheckout', { value: AI_JOBS.priceUsd, currency: 'USD' })
    if (info.cardChosen) return
    apiPost<PayInfo>(`/api/v1/public/private-courses/${AI_JOBS.slug}/pay/${token}/card`, {})
      .then(onChange)
      .catch(() => { /* لا يمنع الدفع شيء — يطابقه صاحبُ الدورة برقم المرجع في Stripe */ })
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    if (!proof) { setError('اختر صورة الحوالة'); return }
    setSending(true)
    setError('')
    try {
      const next = await apiPost<PayInfo>(`/api/v1/public/private-courses/${AI_JOBS.slug}/pay/${token}`, {
        proof: { name: proof.name, base64: proof.base64 },
        note: note.trim() || undefined,
      })
      trackPixel('AddPaymentInfo', { payment_method: 'cliq', value: AI_JOBS.priceJod, currency: 'JOD' })
      setProof(null)
      setAgain(false)
      onChange(next)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذر الإرسال — تأكد من الاتصال وأعد المحاولة')
    } finally {
      setSending(false)
    }
  }

  const ask = whatsappLink(AI_JOBS.whatsapp, `مرحبا، حجزت مقعدا في دورة التقديم على الوظائف بالذكاء الاصطناعي. رقم المرجع ${info.reference}`)

  if (info.status === 'confirmed') {
    return (
      <div className="aij-box aij-done" role="status">
        <Tick />
        <h2>مقعدك مؤكد</h2>
        <p>{info.sectionTitle}. أرسلنا التأكيد ورابط Zoom إلى بريدك — تفقده، ومجلد الرسائل غير المرغوبة كذلك.</p>
        <div className="aij-row" style={{ justifyContent: 'center' }}>
          <a className="aij-cta aij-cta-y" href={ask} target="_blank" rel="noopener noreferrer">راسلنا على واتساب</a>
        </div>
        <ShareInvite />
      </div>
    )
  }

  if (info.hasProof && info.status === 'pending' && !again) {
    return (
      <div className="aij-box aij-done" role="status">
        <Tick />
        <h2>وصلت صورة الحوالة</h2>
        <p>نراجعها ونرسل التأكيد ورابط Zoom ({info.sectionTitle}) إلى بريدك. تفقده، ومجلد الرسائل غير المرغوبة كذلك.</p>
        <div className="aij-ref" aria-label={`رقم المرجع ${info.reference}`}>{info.reference}</div>
        <div className="aij-row" style={{ justifyContent: 'center' }}>
          <a className="aij-cta aij-cta-y" href={ask} target="_blank" rel="noopener noreferrer">راسلنا على واتساب</a>
          <button type="button" className="aij-ghost" style={{ background: 'none', border: 0, cursor: 'pointer' }} onClick={() => setAgain(true)}>ارفع صورة أخرى</button>
        </div>
        <ShareInvite />
      </div>
    )
  }

  return (
    <form className="aij-box aij-form aij-pay-step" onSubmit={submit} noValidate aria-labelledby="aij-pay-title">
      {fresh && <Tick />}
      <h2 id="aij-pay-title">{fresh ? 'حجزنا مقعدك' : `أهلا ${info.firstName}، أكمل حجزك`}</h2>
      <p className="aij-small" style={{ marginTop: 6 }}>{info.sectionTitle} · رقم المرجع <b dir="ltr">{info.reference}</b></p>
      {info.status === 'rejected' && (
        <div className="aij-alert" role="alert">لم نتمكن من تأكيد الحوالة السابقة. ارفع صورة أوضح، أو راسلنا على واتساب.</div>
      )}

      <p className="aij-step-label">{card ? 'الخطوة الأخيرة: ادفع بالبطاقة' : 'الخطوة الأخيرة: حوّل وارفع صورة الحوالة'}</p>
      {info.cardUrl && (
        <div className="aij-methods" role="radiogroup" aria-label="طريقة الدفع">
          <label className={`aij-choice${method === 'cliq' ? ' on' : ''}`}>
            <input type="radio" name="pay-method" checked={method === 'cliq'} onChange={() => setMethod('cliq')} />
            <b>CliQ</b>
            <span>داخل الأردن · {AI_JOBS.priceJod} دينار</span>
          </label>
          <label className={`aij-choice${method === 'card' ? ' on' : ''}`}>
            <input type="radio" name="pay-method" checked={method === 'card'} onChange={() => setMethod('card')} />
            <b>بطاقة</b>
            <span>من خارج الأردن · <bdi dir="ltr">{AI_JOBS.priceUsd}$</bdi></span>
          </label>
        </div>
      )}
      {card
        ? (
          <div className="aij-cliq">
            <small>
              ادفع <bdi dir="ltr">{AI_JOBS.priceUsd}$</bdi> بالبطاقة في صفحة الدفع.{' '}
              {info.cardAuto
                ? 'يتأكد مقعدك تلقائيا بعد الدفع، ويصلك التأكيد ورابط Zoom على بريدك خلال دقائق — لا حاجة لرفع شيء.'
                : 'يصلك إيصال الدفع على بريدك، ثم نؤكد مقعدك ونرسل لك رابط Zoom — لا حاجة لرفع شيء.'}
            </small>
            <a className="aij-cta aij-cta-y aij-card-btn" href={info.cardUrl!} target="_blank" rel="noopener noreferrer" onClick={goCard}>
              ادفع <bdi dir="ltr">{AI_JOBS.priceUsd}$</bdi> بالبطاقة
            </a>
            {info.cardChosen && (
              <small style={{ marginTop: 8 }}>
                {info.cardAuto ? 'دفعت؟ يصلك التأكيد ورابط Zoom على بريدك خلال دقائق — تفقد الرسائل غير المرغوبة كذلك.' : 'دفعت؟ نؤكد مقعدك فور وصول الدفع، ويصلك البريد ورابط Zoom.'}
              </small>
            )}
          </div>
        )
        : (
          <>
            <div className="aij-cliq">
              <small>حوّل {AI_JOBS.priceJod} دينار عبر CliQ إلى الاسم المستعار</small>
              <div className="aij-alias">
                <b>{AI_JOBS.cliqAlias}</b>
                <Copy text={AI_JOBS.cliqAlias} label="انسخ" />
              </div>
            </div>
            {/* CliQ داخل الأردن وحدَه — ومن رقمُه خارجَه يرتّب الدفعَ على واتساب برقم مرجعه (٢١ نوفمبر ٢٠٢٦) */}
            {info.abroad && <AbroadPay reference={info.reference} />}

            <ProofDrop id="aij-pay-proof" label="صورة الحوالة" hint="صورة أو لقطة شاشة أو PDF"
              proof={proof} busy={busy} invalid={Boolean(error)} onPick={(f) => void pick(f)} />

            <div className="aij-field">
              <label className="aij-label" htmlFor="aij-pay-note">ملاحظة <em>— اختياري، مثل اسم صاحب الحساب المحوّل إن اختلف</em></label>
              <textarea id="aij-pay-note" className="aij-textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            </div>

            {error && <div className="aij-alert" role="alert">{error}</div>}

            <button type="submit" className="aij-cta aij-cta-lg aij-submit" disabled={sending || busy || !proof}>
              {sending ? 'نرسل الصورة…' : 'أرسل صورة الحوالة'}
            </button>
          </>
        )}

      <div className="aij-later">
        <b>لا تستطيع الدفع الآن؟</b>
        <span>مقعدك محجوز. احفظ رابط الدفع وارجع له متى دفعت:</span>
        <span className="aij-link" dir="ltr">{link}</span>
        <div className="aij-row" style={{ marginTop: 10 }}>
          <Copy text={link} label="انسخ الرابط" />
          <a className="aij-copy" href={waShare(`رابط إكمال حجزي في دورة التقديم على الوظائف بالذكاء الاصطناعي: ${link}`)} target="_blank" rel="noopener noreferrer">أرسله لنفسي على واتساب</a>
        </div>
      </div>
      {/* «سجّل معي» لمن حجز الآن — لا لمن عاد يدفع من رابطه */}
      {fresh && <ShareInvite />}
    </form>
  )
}

/* نموذجُ التسجيل في الدورة الخاصّة — الاسمُ والبريدُ والرقمُ بمفتاح الدولة والشعبةُ وصورةُ الحوالة (١٩ نوفمبر ٢٠٢٦).

   والصورةُ تُصغَّر في المتصفّح قبل أن تُرسل: لقطةُ هاتفٍ حديثٍ أربعةُ ميغابايتات، ورفعُها على شبكةٍ ضعيفةٍ يُبقي
   صاحبَها أمام زرٍّ يدور. فما زاد عن ١٨٠٠ نقطةٍ أو ميغابايتٍ ونصف يُعاد رسمُه JPEG — والحوالةُ تُقرأ كما هي.
   والـPDF يُرسل كما هو. والخادمُ يسأل البايتاتِ عن نوعها في الحالتين (`registration.service.ts`). */

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ApiError, apiGet, apiPost } from '@/services/api'
import { COUNTRIES_SORTED, MOBILE_FORMATS, flagOf } from '@/data/countries'
import { AI_JOBS, PROOF_ACCEPT, PROOF_MAX_BYTES, type AiJobsSectionKey } from '@/application/private-course/ai-jobs'
import { normalizePhone, whatsappLink } from '@/application/private-course/phone'
import { useHoneypot } from '@/components/HoneypotField'

interface Proof {
  name: string
  base64: string
  /** معاينةٌ للصورة — `data:` لا `blob:`: سياسةُ المحتوى تسمح بالأولى وحدَها */
  preview: string | null
  pdf: boolean
}

interface Done {
  reference: string
  updated: boolean
  sectionTitle: string
  email: string
}

const MAX_SIDE = 1800
const SHRINK_ABOVE = 1.5 * 1024 * 1024

function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('read'))
    r.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode'))
    img.src = src
  })
}

function base64Bytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.floor((b64.length * 3) / 4)
}

async function prepareProof(file: File): Promise<Proof> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (isPdf) {
    if (file.size > PROOF_MAX_BYTES) throw new Error('ملف PDF أكبر من 8MB')
    const url = await readDataUrl(file)
    return { name: file.name, base64: url, preview: null, pdf: true }
  }
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new Error('ارفع صورة الحوالة أو ملف PDF')
  }
  const original = await readDataUrl(file)
  let img: HTMLImageElement
  try {
    img = await loadImage(original)
  } catch {
    throw new Error('تعذر فتح الصورة — التقط لقطة شاشة للحوالة وارفعها')
  }
  const big = Math.max(img.naturalWidth, img.naturalHeight)
  const plain = /^image\/(jpeg|png|webp)$/.test(file.type)
  if (plain && big <= MAX_SIDE && file.size <= SHRINK_ABOVE) {
    return { name: file.name, base64: original, preview: original, pdf: false }
  }
  const scale = Math.min(1, MAX_SIDE / big)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return { name: file.name, base64: original, preview: original, pdf: false }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const jpeg = canvas.toDataURL('image/jpeg', 0.86)
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return { name, base64: jpeg, preview: jpeg, pdf: false }
}

const ARAB = COUNTRIES_SORTED.filter((c) => c.arab)
const OTHERS = COUNTRIES_SORTED.filter((c) => !c.arab)

export default function RegisterForm() {
  const [open, setOpen] = useState<boolean | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('JO')
  const [phone, setPhone] = useState('')
  const [section, setSection] = useState<AiJobsSectionKey | ''>('')
  const [note, setNote] = useState('')
  const hp = useHoneypot()
  const [proof, setProof] = useState<Proof | null>(null)
  const [proofBusy, setProofBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [alert, setAlert] = useState('')
  const [done, setDone] = useState<Done | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const doneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    apiGet<{ open: boolean }>(`/api/v1/public/private-courses/${AI_JOBS.slug}`)
      .then((r) => { if (alive) setOpen(r.open) })
      .catch(() => { if (alive) setOpen(true) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (done) doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [done])

  const example = useMemo(() => MOBILE_FORMATS[country]?.example ?? '', [country])

  async function pick(file: File | undefined) {
    if (!file) return
    setProofBusy(true)
    setErrors((e) => ({ ...e, proof: '' }))
    try {
      const p = await prepareProof(file)
      if (base64Bytes(p.base64) > PROOF_MAX_BYTES) throw new Error('الملف أكبر من 8MB — التقط لقطة شاشة للحوالة')
      setProof(p)
    } catch (e) {
      setProof(null)
      setErrors((x) => ({ ...x, proof: e instanceof Error ? e.message : 'تعذر قراءة الملف' }))
    } finally {
      setProofBusy(false)
    }
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (fullName.trim().length < 3) e.fullName = 'اكتب اسمك الكامل'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) e.email = 'البريد الإلكتروني غير صحيح'
    const p = normalizePhone(country, phone)
    if (!p.ok) e.phone = p.error
    if (!section) e.section = 'اختر الشعبة'
    if (!proof) e.proof = 'ارفع صورة الحوالة'
    return e
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    setAlert('')
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) {
      const first = Object.keys(e)[0]
      document.getElementById(`aij-${first}`)?.focus()
      return
    }
    setSending(true)
    try {
      const r = await apiPost<{ reference: string; updated: boolean; sectionTitle: string }>(
        `/api/v1/public/private-courses/${AI_JOBS.slug}/registrations`,
        {
          fullName, email, phoneCountry: country, phone, sectionKey: section,
          note: note.trim() || undefined,
          proof: { name: proof!.name, base64: proof!.base64 },
          website: hp.value,
        },
      )
      setDone({ ...r, email: email.trim() })
    } catch (err) {
      setAlert(err instanceof ApiError ? err.message : 'تعذر الإرسال — تأكد من الاتصال وأعد المحاولة')
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div ref={doneRef} className="aij-box aij-done" role="status">
        <div className="tick" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </div>
        <h2>{done.updated ? 'حدّثنا تسجيلك' : 'وصل تسجيلك'}</h2>
        <p>
          نراجع الحوالة ونرسل التأكيد ورابط Zoom ({done.sectionTitle}) إلى <b dir="ltr">{done.email}</b>.
          تفقد بريدك، ومجلد الرسائل غير المرغوبة كذلك.
        </p>
        <div className="aij-ref" aria-label={`رقم المرجع ${done.reference}`}>{done.reference}</div>
        <p className="aij-small">احتفظ برقم المرجع. لأي سؤال راسلنا على واتساب.</p>
        <div className="aij-row" style={{ justifyContent: 'center' }}>
          <a className="aij-cta aij-cta-y" href={whatsappLink(AI_JOBS.whatsapp, `مرحبا، سجلت في دورة التقديم على الوظائف بالذكاء الاصطناعي. رقم المرجع ${done.reference}`)} target="_blank" rel="noopener noreferrer">
            راسلنا على واتساب
          </a>
        </div>
      </div>
    )
  }

  if (open === false) {
    return (
      <div className="aij-box aij-done">
        <h2>التسجيل مغلق الآن</h2>
        <p>اكتملت المقاعد أو أغلق التسجيل مؤقتا. راسلنا على واتساب لتعرف موعد الشعبة القادمة.</p>
        <div className="aij-row" style={{ justifyContent: 'center' }}>
          <a className="aij-cta" href={whatsappLink(AI_JOBS.whatsapp, 'مرحبا، أريد التسجيل في دورة التقديم على الوظائف بالذكاء الاصطناعي')} target="_blank" rel="noopener noreferrer">راسلنا على واتساب</a>
        </div>
      </div>
    )
  }

  return (
    <form className="aij-box aij-form" onSubmit={submit} noValidate aria-labelledby="aij-form-title">
      <h2 id="aij-form-title">سجّل مقعدك</h2>
      <p className="aij-small" style={{ marginTop: 6 }}>بعد التحويل عبّئ النموذج وارفع صورة الحوالة. دقيقة واحدة.</p>

      <div className="aij-field">
        <label className="aij-label" htmlFor="aij-fullName">الاسم الكامل</label>
        <input id="aij-fullName" className="aij-input" autoComplete="name" value={fullName}
          onChange={(e) => setFullName(e.target.value)} aria-invalid={Boolean(errors.fullName)}
          aria-describedby={errors.fullName ? 'aij-fullName-err' : undefined} maxLength={120} />
        {errors.fullName && <p id="aij-fullName-err" className="aij-err">{errors.fullName}</p>}
      </div>

      <div className="aij-field">
        <label className="aij-label" htmlFor="aij-email">البريد الإلكتروني <em>— يصلك عليه التأكيد ورابط Zoom</em></label>
        <input id="aij-email" className="aij-input" type="email" dir="ltr" autoComplete="email" inputMode="email" value={email}
          onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'aij-email-err' : undefined} maxLength={200} />
        {errors.email && <p id="aij-email-err" className="aij-err">{errors.email}</p>}
      </div>

      <div className="aij-field">
        <label className="aij-label" htmlFor="aij-phone">رقم الهاتف (واتساب) <em>— مع مفتاح الدولة</em></label>
        <div className="aij-phone">
          <select className="aij-select" dir="ltr" aria-label="مفتاح الدولة" value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="tel-country-code">
            <optgroup label="الدول العربية">
              {ARAB.map((c) => <option key={c.iso2} value={c.iso2}>{`${flagOf(c.iso2)} ${c.dial} ${c.ar}`}</option>)}
            </optgroup>
            <optgroup label="دول أخرى">
              {OTHERS.map((c) => <option key={c.iso2} value={c.iso2}>{`${flagOf(c.iso2)} ${c.dial} ${c.ar}`}</option>)}
            </optgroup>
          </select>
          <input id="aij-phone" className="aij-input" type="tel" dir="ltr" inputMode="tel" autoComplete="tel-national"
            placeholder={example} value={phone} onChange={(e) => setPhone(e.target.value)}
            aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'aij-phone-err' : undefined} maxLength={30} />
        </div>
        {errors.phone && <p id="aij-phone-err" className="aij-err">{errors.phone}</p>}
      </div>

      <fieldset className="aij-field" style={{ border: 0, padding: 0, margin: '18px 0 0' }}>
        <legend className="aij-label">الشعبة <em>— السبت 5 ديسمبر، بتوقيت عمّان</em></legend>
        <div className="aij-choices">
          {AI_JOBS.sections.map((s, i) => (
            <label key={s.key} className={`aij-choice${section === s.key ? ' on' : ''}`}>
              <input id={i === 0 ? 'aij-section' : undefined} type="radio" name="section" value={s.key}
                checked={section === s.key} onChange={() => setSection(s.key)} />
              <b>{s.title}</b>
              <span>{s.timeLabel}</span>
            </label>
          ))}
        </div>
        {errors.section && <p className="aij-err">{errors.section}</p>}
      </fieldset>

      <div className="aij-field">
        <span className="aij-label" id="aij-proof-label">صورة الحوالة <em>— صورة أو لقطة شاشة أو PDF</em></span>
        <label className={`aij-drop${over ? ' over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void pick(e.dataTransfer.files?.[0]) }}>
          <input id="aij-proof" ref={fileRef} type="file" accept={`${PROOF_ACCEPT},image/*`}
            aria-labelledby="aij-proof-label" aria-invalid={Boolean(errors.proof)}
            onChange={(e) => void pick(e.target.files?.[0])} />
          <span className="thumb" aria-hidden="true">
            {proof?.preview
              ? <img src={proof.preview} alt="" />
              : proof?.pdf
                ? <b style={{ fontSize: 14 }}>PDF</b>
                : (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#142240" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
                )}
          </span>
          <span className="txt">
            <b>{proofBusy ? 'نجهّز الملف…' : proof ? 'تم اختيار الملف — اضغط لتغييره' : 'اضغط لاختيار صورة الحوالة'}</b>
            <small>{proof ? proof.name : 'من الهاتف أو الكمبيوتر'}</small>
          </span>
        </label>
        {errors.proof && <p className="aij-err">{errors.proof}</p>}
      </div>

      <div className="aij-field">
        <label className="aij-label" htmlFor="aij-note">ملاحظة <em>— اختياري، مثل اسم صاحب الحساب المحوّل إن اختلف</em></label>
        <textarea id="aij-note" className="aij-textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </div>

      {hp.field}

      {alert && <div className="aij-alert" role="alert">{alert}</div>}

      <button type="submit" className="aij-cta aij-cta-lg aij-submit" disabled={sending || proofBusy}>
        {sending ? 'نرسل تسجيلك…' : 'أرسل التسجيل'}
      </button>
      <p className="aij-small" style={{ marginTop: 12, textAlign: 'center' }}>
        يصلك التأكيد ورابط Zoom على بريدك بعد مراجعة الحوالة.
      </p>
    </form>
  )
}

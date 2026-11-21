/* نموذجُ الحجز في الدورة الخاصّة — الخطوةُ الأولى: الاسمُ والبريدُ والرقمُ بمفتاح الدولة والشعبة (٢٠ نوفمبر ٢٠٢٦).

   كانت صورةُ الحوالة شرطا في النموذج نفسِه: يترك الزائرُ الصفحةَ إلى تطبيق بنكه، ويحوّل، ويعود فيرفع — وكثيرٌ لا يعود.
   فقال صاحبُ المنصّة «ابدأ بالأوّل»: يحجز أوّلا فيُحفظ اسمُه ورقمُه ومقعدُه، ثمّ تأتي الخطوةُ الثانية (`PayStep`) في
   المكان نفسِه: الاسمُ المستعار في CliQ ورفعُ الصورة — الآنَ أو لاحقا من رابطٍ باسمه. ومن لم يدفع يذكّره صاحبُ الدورة
   برابطه من لوحته. ومصدرُ الزائر (`source.ts`) يُرسل مع الحجز ليُعرف أيُّ منشورٍ يبيع. */

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ApiError, apiPost } from '@/services/api'
import { COUNTRIES_SORTED, MOBILE_FORMATS, flagOf } from '@/data/countries'
import { AI_JOBS, type AiJobsSectionKey } from '@/application/private-course/ai-jobs'
import { normalizePhone, whatsappLink } from '@/application/private-course/phone'
import { storedSource } from '@/application/private-course/source'
import { useHoneypot } from '@/components/HoneypotField'
import { SeatPill } from './Seats'
import PayStep, { type PayInfo } from './PayStep'
import { useCourseState } from './course-state'
import { trackPixel } from './meta-pixel'
import { readProof, type Proof } from './proof-file'
import ProofDrop from './ProofDrop'
import AbroadPay from './AbroadPay'

interface Reserved {
  token: string
  info: PayInfo
}

const ARAB = COUNTRIES_SORTED.filter((c) => c.arab)
const OTHERS = COUNTRIES_SORTED.filter((c) => !c.arab)

export default function RegisterForm() {
  const state = useCourseState()
  const open = state?.open ?? null
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('JO')
  const [phone, setPhone] = useState('')
  const [section, setSection] = useState<AiJobsSectionKey | ''>('')
  const hp = useHoneypot()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [alert, setAlert] = useState('')
  const [reserved, setReserved] = useState<Reserved | null>(null)
  /* صورةُ الحوالة في النموذج نفسِه — لمن حوّل قبل أن يسجّل، كما يقول المنشور (٢١ نوفمبر ٢٠٢٦). واختياريّةٌ:
     من لم يحوّل بعد يحجز، وتأتيه خطوةُ الدفع بعدها (`PayStep`) */
  const [proof, setProof] = useState<Proof | null>(null)
  const [proofBusy, setProofBusy] = useState(false)
  const doneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reserved) doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [reserved])

  const example = useMemo(() => MOBILE_FORMATS[country]?.example ?? '', [country])

  async function pick(file: File | undefined) {
    if (!file) return
    setProofBusy(true)
    setErrors((e) => ({ ...e, proof: '' }))
    try {
      setProof(await readProof(file))
    } catch (err) {
      setProof(null)
      setErrors((e) => ({ ...e, proof: err instanceof Error ? err.message : 'تعذر قراءة الملف' }))
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
      const r = await apiPost<{ reference: string; updated: boolean; sectionTitle: string; payToken: string; hasProof: boolean; cardUrl: string | null; abroad: boolean; cardChosen: boolean; cardAuto: boolean }>(
        `/api/v1/public/private-courses/${AI_JOBS.slug}/registrations`,
        {
          fullName, email, phoneCountry: country, phone, sectionKey: section,
          source: storedSource() ?? undefined,
          ...(proof ? { proof: { name: proof.name, base64: proof.base64 } } : {}),
          website: hp.value,
        },
      )
      /* الحجزُ هو الحدثُ الذي يُحسَّن عليه الإعلان — مرّةً لكلّ حجز */
      trackPixel('Lead', { content_name: AI_JOBS.title, value: AI_JOBS.priceUsd, currency: 'USD' })
      if (proof) trackPixel('AddPaymentInfo', { payment_method: 'cliq', value: AI_JOBS.priceJod, currency: 'JOD' })
      setReserved({
        token: r.payToken,
        info: {
          firstName: fullName.trim().split(/\s+/)[0], reference: r.reference, sectionTitle: r.sectionTitle,
          status: 'pending', hasProof: r.hasProof, cardUrl: r.cardUrl, abroad: r.abroad, cardChosen: r.cardChosen, cardAuto: r.cardAuto,
        },
      })
    } catch (err) {
      setAlert(err instanceof ApiError ? err.message : 'تعذر الإرسال — تأكد من الاتصال وأعد المحاولة')
    } finally {
      setSending(false)
    }
  }

  if (reserved) {
    return (
      <div ref={doneRef} style={{ scrollMarginTop: 110 }}>
        <PayStep token={reserved.token} info={reserved.info} fresh onChange={(info) => setReserved({ ...reserved, info })} />
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
      <h2 id="aij-form-title">سجّل واحجز مقعدك</h2>
      <p className="aij-small" style={{ marginTop: 6 }}>اكتب بياناتك واختر شعبتك، وارفع صورة الحوالة إن حوّلت. لم تحوّل بعد؟ احجز الآن وارفعها لاحقا.</p>

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
              <SeatPill sectionKey={s.key} />
            </label>
          ))}
        </div>
        {errors.section && <p className="aij-err">{errors.section}</p>}
      </fieldset>

      <div className="aij-cliq" style={{ marginTop: 18 }}>
        <small>الدفع: {AI_JOBS.priceJod} دينار عبر CliQ إلى الاسم المستعار <b dir="ltr">{AI_JOBS.cliqAlias}</b>{state?.card ? <> — أو <bdi dir="ltr">{AI_JOBS.priceUsd}$</bdi> بالبطاقة من خارج الأردن بعد الحجز</> : null}</small>
      </div>
      {/* CliQ داخل الأردن وحدَه — فمن اختار مفتاحَ دولةٍ غيرِها يُدعى إلى واتساب لترتيب الدفع (٢١ نوفمبر ٢٠٢٦) */}
      {country !== 'JO' && !state?.card && <AbroadPay country={COUNTRIES_SORTED.find((c) => c.iso2 === country)?.ar} />}

      <ProofDrop id="aij-proof" label="صورة الحوالة" hint="اختياري الآن — صورة أو لقطة شاشة أو PDF"
        proof={proof} busy={proofBusy} invalid={Boolean(errors.proof)} onPick={(f) => void pick(f)} />
      {errors.proof && <p className="aij-err">{errors.proof}</p>}

      {hp.field}

      {alert && <div className="aij-alert" role="alert">{alert}</div>}

      <button type="submit" className="aij-cta aij-cta-lg aij-submit" disabled={sending || proofBusy}>
        {sending ? 'نرسل تسجيلك…' : proof ? 'أرسل التسجيل وصورة الحوالة' : 'احجز مقعدي'}
      </button>
      <p className="aij-small" style={{ marginTop: 12, textAlign: 'center' }}>
        {proof
          ? <>نراجع الحوالة ويصلك التأكيد ورابط Zoom على بريدك.</>
          : state?.card
          ? <>بعدها تحوّل {AI_JOBS.priceJod} دينار عبر CliQ وترفع صورة الحوالة، أو تدفع <bdi dir="ltr">{AI_JOBS.priceUsd}$</bdi> بالبطاقة من خارج الأردن. ويصلك التأكيد ورابط Zoom على بريدك.</>
          : <>بعدها تحوّل {AI_JOBS.priceJod} دينار عبر CliQ وترفع صورة الحوالة، ويصلك التأكيد ورابط Zoom على بريدك.</>}
      </p>
    </form>
  )
}

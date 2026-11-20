/* نموذجُ الحجز في الدورة الخاصّة — الخطوةُ الأولى: الاسمُ والبريدُ والرقمُ بمفتاح الدولة والشعبة (٢٠ نوفمبر ٢٠٢٦).

   كانت صورةُ الحوالة شرطا في النموذج نفسِه: يترك الزائرُ الصفحةَ إلى تطبيق بنكه، ويحوّل، ويعود فيرفع — وكثيرٌ لا يعود.
   فقال صاحبُ المنصّة «ابدأ بالأوّل»: يحجز أوّلا فيُحفظ اسمُه ورقمُه ومقعدُه، ثمّ تأتي الخطوةُ الثانية (`PayStep`) في
   المكان نفسِه: الاسمُ المستعار في CliQ ورفعُ الصورة — الآنَ أو لاحقا من رابطٍ باسمه. ومن لم يدفع يذكّره صاحبُ الدورة
   برابطه من لوحته. ومصدرُ الزائر (`source.ts`) يُرسل مع الحجز ليُعرف أيُّ منشورٍ يبيع. */

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ApiError, apiGet, apiPost } from '@/services/api'
import { COUNTRIES_SORTED, MOBILE_FORMATS, flagOf } from '@/data/countries'
import { AI_JOBS, type AiJobsSectionKey } from '@/application/private-course/ai-jobs'
import { normalizePhone, whatsappLink } from '@/application/private-course/phone'
import { storedSource } from '@/application/private-course/source'
import { useHoneypot } from '@/components/HoneypotField'
import { SeatPill } from './Seats'
import PayStep, { type PayInfo } from './PayStep'

interface Reserved {
  token: string
  info: PayInfo
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
  const hp = useHoneypot()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [alert, setAlert] = useState('')
  const [reserved, setReserved] = useState<Reserved | null>(null)
  const doneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    apiGet<{ open: boolean }>(`/api/v1/public/private-courses/${AI_JOBS.slug}`)
      .then((r) => { if (alive) setOpen(r.open) })
      .catch(() => { if (alive) setOpen(true) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (reserved) doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [reserved])

  const example = useMemo(() => MOBILE_FORMATS[country]?.example ?? '', [country])

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
      const r = await apiPost<{ reference: string; updated: boolean; sectionTitle: string; payToken: string; hasProof: boolean }>(
        `/api/v1/public/private-courses/${AI_JOBS.slug}/registrations`,
        {
          fullName, email, phoneCountry: country, phone, sectionKey: section,
          source: storedSource() ?? undefined,
          website: hp.value,
        },
      )
      setReserved({
        token: r.payToken,
        info: { firstName: fullName.trim().split(/\s+/)[0], reference: r.reference, sectionTitle: r.sectionTitle, status: 'pending', hasProof: r.hasProof },
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
      <h2 id="aij-form-title">احجز مقعدك</h2>
      <p className="aij-small" style={{ marginTop: 6 }}>اكتب بياناتك واختر شعبتك، ثم حوّل وارفع صورة الحوالة — الآن أو لاحقا.</p>

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

      {hp.field}

      {alert && <div className="aij-alert" role="alert">{alert}</div>}

      <button type="submit" className="aij-cta aij-cta-lg aij-submit" disabled={sending}>
        {sending ? 'نحجز مقعدك…' : 'احجز مقعدي'}
      </button>
      <p className="aij-small" style={{ marginTop: 12, textAlign: 'center' }}>
        بعدها تحوّل {AI_JOBS.priceJod} دينار عبر CliQ وترفع صورة الحوالة، ويصلك التأكيد ورابط Zoom على بريدك.
      </p>
    </form>
  )
}

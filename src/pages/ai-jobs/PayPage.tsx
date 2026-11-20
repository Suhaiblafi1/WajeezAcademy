/* صفحةُ رابط الدفع — `/ai-jobs/pay/<token>` (٢٠ نوفمبر ٢٠٢٦).

   من حجز ولم يرفع صورةَ الحوالة يعود من هنا: يحفظ الرابطَ بعد الحجز، أو يرسله لنفسه على واتساب، أو يذكّره به صاحبُ
   الدورة من لوحته. والصفحةُ لا تعرض غيرَ اسمه الأوّل وشعبته — الرابطُ قد يمرّ في محادثة — ولا تُفهرَس. */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { ApiError, apiGet } from '@/services/api'
import { AI_JOBS } from '@/application/private-course/ai-jobs'
import { whatsappLink } from '@/application/private-course/phone'
import PayStep, { type PayInfo } from './PayStep'
import './ai-jobs.css'

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&family=Marhey:wght@600;700&display=swap'

export default function PayPage() {
  const { token = '' } = useParams()
  const [info, setInfo] = useState<PayInfo | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')

  useEffect(() => {
    document.title = 'أكمل حجزك — دورة التقديم على الوظائف بالذكاء الاصطناعي'
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!robots) {
      robots = document.createElement('meta')
      robots.name = 'robots'
      document.head.appendChild(robots)
    }
    robots.content = 'noindex, nofollow'
    if (!document.head.querySelector('link[data-aij-fonts]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = FONTS_HREF
      link.dataset.aijFonts = '1'
      document.head.appendChild(link)
    }
  }, [])

  useEffect(() => {
    let alive = true
    apiGet<PayInfo>(`/api/v1/public/private-courses/${AI_JOBS.slug}/pay/${encodeURIComponent(token)}`)
      .then((r) => { if (alive) { setInfo(r); setState('ok') } })
      .catch((e) => { if (alive) setState(e instanceof ApiError && e.status === 404 ? 'missing' : 'error') })
    return () => { alive = false }
  }, [token])

  return (
    <div className="aij" dir="rtl" lang="ar">
      <section className="aij-sec aij-sun" style={{ minHeight: '100vh', paddingTop: 40 }}>
        <div className="aij-wrap" style={{ maxWidth: 640 }}>
          <p className="aij-top" style={{ marginBottom: 18 }}><span>صهيب الخوالدة · {AI_JOBS.title}</span></p>
          {state === 'loading' && <div className="aij-box aij-done" aria-busy="true"><p>جاري التحميل…</p></div>}
          {(state === 'missing' || state === 'error') && (
            <div className="aij-box aij-done" role="alert">
              <h2>{state === 'missing' ? 'الرابط غير صحيح' : 'تعذر الوصول'}</h2>
              <p>{state === 'missing' ? 'تأكد من الرابط كاملا، أو راسلنا على واتساب ونرسله لك.' : 'تأكد من الاتصال وأعد فتح الرابط.'}</p>
              <div className="aij-row" style={{ justifyContent: 'center' }}>
                <a className="aij-cta" href={whatsappLink(AI_JOBS.whatsapp, 'مرحبا، أحتاج رابط إكمال حجزي في دورة التقديم على الوظائف بالذكاء الاصطناعي')} target="_blank" rel="noopener noreferrer">راسلنا على واتساب</a>
              </div>
            </div>
          )}
          {state === 'ok' && info && <PayStep token={token} info={info} onChange={setInfo} />}
          <p className="aij-small" style={{ textAlign: 'center', marginTop: 20 }}>
            <a href="/ai-jobs" className="aij-ghost">تفاصيل الدورة</a>
          </p>
        </div>
      </section>
    </div>
  )
}

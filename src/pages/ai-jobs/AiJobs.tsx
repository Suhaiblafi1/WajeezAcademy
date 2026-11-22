/* ═══ صفحةُ دورة صاحب المنصّة الخاصّة — «اجعل الذكاء الاصطناعي يقدّم على الوظائف عنك» (١٩ نوفمبر ٢٠٢٦) ═══

   طلبُه: «ابنِ لي صفحة لاند بيج لهذه الدورة، ويكون التسجيلُ من خلالها والدفعُ من خلال CliQ ليرفق ملفَّ إثبات الحوالة..
   اجعلها بنفس الثيم تقريبا إلّا إذا أردت أن تحسّنه.. ونقرُ التسجيل في أكثر من مكان، والرقمُ بمفتاح الدولة، والخصمُ
   كعرض بلاك فرايدي».

   فالصفحةُ منشورُه نفسُه مبسوطا: شرائحُه بترتيبها وألوانُها وخطوطُها (Readex Pro وMarhey وAref Ruqaa)، وبينها أزرارُ
   «سجّل الآن» تنزل إلى النموذج — في الشريط الأعلى، والافتتاح، وبعد الألم، وبعد النتائج، وفي التفاصيل، وفي العرض، وشريطٍ
   ثابتٍ تحت الإبهام في الهاتف. وشريطُ بلاك فرايدي فيه المقاعدُ المتبقّيةُ لكلّ شعبة: «الخصم حتى نفاد المقاعد».

   ولا رأسَ للموقع ولا ذيلَ له هنا: الصفحةُ دورتُه هو، لا صفحةٌ من صفحات الأكاديميّة. */

import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { AI_JOBS, AI_JOBS_SEO } from '@/application/private-course/ai-jobs'
import { whatsappLink } from '@/application/private-course/phone'
import { rememberSource } from '@/application/private-course/source'
import { BONUS, DOORS, FACTS, FEATURES, GUARANTEE, NOT_FOR, PAINS, RESULTS, SKILLS, STEPS, TIPS, WHO, faqsFor } from './content'
import { useCourseState } from './course-state'
import { loadMetaPixel, trackPixel } from './meta-pixel'
import RegisterForm from './RegisterForm'
import { SeatPill, Seats } from './Seats'
import './ai-jobs.css'

const PHOTO = '/campaigns/ai-jobs/suhaib.jpg'
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&family=Marhey:wght@600;700&display=swap'

/* ── قطعٌ صغيرة ── */

function Cta({ label = 'سجّل الآن', yellow = false, large = false }: { label?: ReactNode; yellow?: boolean; large?: boolean }) {
  return (
    <a href="#register" className={`aij-cta${yellow ? ' aij-cta-y' : ''}${large ? ' aij-cta-lg' : ''}`}>
      {label}
      <span aria-hidden="true">←</span>
    </a>
  )
}

function ZoomBadge() {
  return (
    <span className="aij-zoom">
      <span className="cam" aria-hidden="true">
        <svg width="18" height="14" viewBox="0 0 26 20"><rect x="1" y="3" width="16" height="14" rx="3" fill="#fff" /><path d="M18 8 L25 4 V16 L18 12 Z" fill="#fff" /></svg>
      </span>
      مباشر على Zoom
      <span className="dot" aria-hidden="true" />
    </span>
  )
}

function Check({ white = false }: { white?: boolean }) {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="17" fill={white ? '#fff' : '#ffd23f'} stroke="#142240" strokeWidth="3" />
      <path d="M12 20.5 L18 26 L28 14" stroke={white ? '#13a37b' : '#142240'} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Shield() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M20 3 L34 8 V19 C34 28 28 34 20 37 C12 34 6 28 6 19 V8 Z" fill="#13a37b" stroke="#142240" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M13.5 20 L18 24.5 L27 15" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WaIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <path fill="#fff" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 6.9L3.2 29l6.5-1.7c1.9 1 4.1 1.6 6.3 1.6 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2 0-3.9-.5-5.6-1.5l-.4-.2-3.9 1 1-3.7-.3-.4c-1.1-1.7-1.7-3.7-1.7-5.7C5.1 9.9 10 5.2 16 5.2s10.9 4.7 10.9 10.6S22 26.4 16 26.4zm6-7.9c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.6.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.2 1.4 3.4c.2.2 2.4 3.6 5.8 5 .8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z" />
    </svg>
  )
}

const ICONS: Record<string, { bg: string; svg: ReactElement }> = {
  mail: {
    bg: '#ffd23f',
    svg: <svg width="34" height="28" viewBox="0 0 48 40"><rect x="3" y="4" width="42" height="32" rx="5" fill="#fff" stroke="#142240" strokeWidth="3.5" /><path d="M5 8 L24 23 L43 8" stroke="#142240" strokeWidth="3.5" fill="none" strokeLinejoin="round" /></svg>,
  },
  search: {
    bg: '#9be3c8',
    svg: <svg width="32" height="32" viewBox="0 0 46 46"><circle cx="19" cy="19" r="13" fill="#fff" stroke="#142240" strokeWidth="4" /><path d="M29 29 L42 42" stroke="#142240" strokeWidth="5" strokeLinecap="round" /></svg>,
  },
  mic: {
    bg: '#cfe0ff',
    svg: <svg width="28" height="34" viewBox="0 0 40 48"><rect x="12" y="3" width="16" height="26" rx="8" fill="#fff" stroke="#142240" strokeWidth="3.5" /><path d="M5 22 C5 32 12 37 20 37 C28 37 35 32 35 22 M20 37 V45 M12 45 H28" stroke="#142240" strokeWidth="3.5" fill="none" strokeLinecap="round" /></svg>,
  },
}

function CopyAlias() {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(AI_JOBS.cliqAlias)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch {
      /* متصفّحٌ بلا حافظة — الاسمُ مكتوبٌ أمامه */
    }
  }
  return (
    <button type="button" className={`aij-copy${done ? ' done' : ''}`} onClick={() => void copy()} aria-live="polite">
      {done ? 'نسخ ✓' : 'انسخ'}
    </button>
  )
}

/* ── الصفحة ── */

export default function AiJobs() {
  const [barHidden, setBarHidden] = useState(false)
  /* خيارُ البطاقة يُذكر حين يضبط صاحبُ الدورة رابطَه — لا وعدَ بزرٍّ لا يوجد */
  const card = useCourseState()?.card ?? false

  /* من أين جاء — يُحفظ على الجهاز ويُرسل مع الحجز (`source.ts`) */
  useEffect(() => {
    rememberSource(window.location.search, document.referrer, window.location.hostname)
    /* بكسلُ Meta لهذه الصفحة وحدَها (`meta-pixel.ts`) */
    loadMetaPixel()
    trackPixel('PageView')
  }, [])

  useEffect(() => {
    const prevTitle = document.title
    document.title = AI_JOBS_SEO.title
    const desc = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')
    const prevDesc = desc?.content
    if (desc) desc.content = AI_JOBS_SEO.description
    /* خطّا المنشور — Aref Ruqaa محمَّلٌ للموقع كلِّه، والآخران لهذه الصفحة وحدَها */
    let link = document.head.querySelector<HTMLLinkElement>('link[data-aij-fonts]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = FONTS_HREF
      link.dataset.aijFonts = '1'
      document.head.appendChild(link)
    }
    return () => {
      document.title = prevTitle
      if (desc && prevDesc !== undefined) desc.content = prevDesc
    }
  }, [])

  /* شريطُ الهاتف يختفي حين يكون النموذجُ نفسُه أمام العين */
  useEffect(() => {
    const target = document.getElementById('register')
    if (!target || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setBarHidden(e.isIntersecting), { threshold: 0.05 })
    io.observe(target)
    return () => io.disconnect()
  }, [])

  return (
    <div className="aij" dir="rtl" lang="ar">
      {/* ═══ شريطُ بلاك فرايدي ═══ */}
      <div className="aij-bf">
        <div className="aij-wrap aij-bf-in">
          <div className="aij-bf-tag">
            <b>BLACK FRIDAY</b>
            <span className="aij-bf-off">خصم <bdi dir="ltr">80%</bdi></span>
          </div>
          <div className="aij-bf-mid">
            <span>الخصم حتى نفاد المقاعد</span>
            <Seats />
          </div>
          <a href="#register" className="aij-cta">سجّل الآن</a>
        </div>
      </div>

      {/* ═══ الافتتاح ═══ */}
      <header className="aij-sec aij-ice aij-hero">
        <div className="aij-wrap">
          <div className="aij-top"><span>صهيب الخوالدة · دورة عملية</span></div>
          <div className="aij-hero-grid">
            <div>
              <span className="aij-sticker">دورة عملية مباشرة · {AI_JOBS.hours} ساعات</span>
              <h1 className="aij-h1">اجعل <span className="aij-mk">الذكاء الاصطناعي</span> يقدّم على الوظائف عنك</h1>
              <p className="aij-lead">في كل المواقع… وفي الدول التي تختارها أنت</p>
              <p className="aij-note aij-hand">
                لا تحتاج أي خبرة في Claude… نبدأ معك من الصفر
                <svg width="70" height="46" viewBox="0 0 90 60" aria-hidden="true"><path d="M85 8 C60 4 30 10 14 40" stroke="#2d6cdf" strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M6 30 L14 42 L28 36" stroke="#2d6cdf" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </p>
              <div className="aij-facts">
                <div className="aij-fact"><small>الموعد</small><b>{AI_JOBS.dateLabel}</b></div>
                <div className="aij-fact"><small>الطريقة</small><b>مباشر على Zoom</b></div>
                <div className="aij-fact"><small>الخصم</small><b>حتى نفاد المقاعد</b></div>
              </div>
              <div className="aij-row">
                <Cta large label={<>احجز مقعدك بـ <bdi dir="ltr">{AI_JOBS.priceUsd}$</bdi></>} />
                <a className="aij-ghost" href="#details">تفاصيل الدورة</a>
              </div>
            </div>

            <div className="aij-box aij-card">
              <div className="aij-ribbon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
                نظرا لنجاح الدورات السابقة… فتحنا شعبتين إضافيتين
              </div>
              <div className="aij-card-body">
                <div className="aij-photo">
                  <img src={PHOTO} alt="صهيب أحمد الخوالدة" width={210} height={210} />
                  <ZoomBadge />
                </div>
                <div className="aij-who" style={{ marginTop: 14 }}>
                  <b>{AI_JOBS.trainer}</b>
                  <span>مستشار للمنظمات الدولية · مؤسس أكاديمية وجيز · مؤسس موقع «بكلمة» لفن الخطابة والإلقاء</span>
                </div>
              </div>
              <div className="aij-price" aria-label={`السعر ${AI_JOBS.priceUsd} دولار بدل ${AI_JOBS.listPriceUsd}`}>
                <s>{AI_JOBS.listPriceUsd}$</s>
                <b>{AI_JOBS.priceUsd}$</b>
                <span>= {AI_JOBS.priceJod} دينار فقط</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ هل هذا يومك؟ ═══ */}
      <section className="aij-sec aij-butter" aria-labelledby="aij-pain">
        <div className="aij-wrap">
          <h2 id="aij-pain" className="aij-h2">هل هذا يومك<br />في <span className="aij-mk">البحث عن عمل</span>؟</h2>
          <div className="aij-pains">
            {PAINS.map((p) => (
              <div key={p} className="aij-box aij-pain"><span className="aij-x" aria-hidden="true">✕</span>{p}</div>
            ))}
          </div>
          <p className="aij-ask">ماذا لو اشتغل عنك <span className="aij-mkg">مساعد ذكي</span> يبحث ويجهّز ويقدّم…<br />وأنت تركّز على المقابلات فقط؟</p>
          <div className="aij-row"><Cta /></div>
        </div>
      </section>

      {/* ═══ لمن هذه الدورة ═══ */}
      <section className="aij-sec aij-ice" aria-labelledby="aij-who">
        <div className="aij-wrap">
          <h2 id="aij-who" className="aij-h2">لمن <span className="aij-mk">هذه الدورة</span>؟</h2>
          <div className="aij-who-grid">
            {WHO.map((w) => (
              <div key={w.title} className="aij-box aij-who-card">
                <Check />
                <div><b>{w.title}</b><span>{w.text}</span></div>
              </div>
            ))}
          </div>
          <p className="aij-not-for">{NOT_FOR}</p>
        </div>
      </section>

      {/* ═══ من أنا ═══ */}
      <section className="aij-sec aij-mint" aria-labelledby="aij-me">
        <div className="aij-wrap aij-about">
          <div className="aij-photo"><img src={PHOTO} alt="" width={260} height={260} loading="lazy" /></div>
          <div>
            <p className="aij-kicker">من أنا؟</p>
            <h2 id="aij-me" className="aij-about-name">{AI_JOBS.trainer}</h2>
            <p className="aij-about-lines">مستشار للمنظمات الدولية<br />مؤسس أكاديمية وجيز<br />مؤسس موقع «بكلمة» لفن الخطابة والإلقاء<br />14 سنة في البرامج والشراكات</p>
            <div className="aij-timeline">
              {FACTS.map((f) => (
                <div key={f.tag} className="aij-tl">
                  <span className="aij-tag">{f.tag}</span>
                  <span style={'strong' in f ? { fontWeight: 600 } : undefined}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="aij-wrap"><p className="aij-quote aij-hand">وفي هذه الدورة أعلّمك النظام نفسه الذي أستخدمه كل أسبوع.</p></div>
      </section>

      {/* ═══ خمسة أبواب ═══ */}
      <section className="aij-sec aij-ice" aria-labelledby="aij-doors">
        <div className="aij-wrap">
          <h2 id="aij-doors" className="aij-h2">كيف تحصل على <span className="aij-mk">وظيفة</span><br />أو فرصة عمل؟ 5 أبواب</h2>
          <div className="aij-doors">
            {DOORS.map((d, i) => (
              <div key={d.title} className="aij-box aij-door">
                <span className="aij-num">{i + 1}</span>
                <div><b>{d.title}</b><span>{d.text}</span></div>
              </div>
            ))}
          </div>
          <p className="aij-bottomline">في الدورة نجهّز Claude ليبحث لك في <span className="aij-mk">الأبواب الخمسة</span> معا.</p>
        </div>
      </section>

      {/* ═══ كيف يقدّم عنك ═══ */}
      <section className="aij-sec aij-butter" aria-labelledby="aij-how">
        <div className="aij-wrap">
          <h2 id="aij-how" className="aij-h2">كيف يقدّم <span className="aij-mk" dir="ltr">Claude</span> عنك؟</h2>
          <div className="aij-steps">
            {STEPS.map((s, i) => (
              <div key={s.title} className={`aij-box aij-step${'you' in s ? ' you' : ''}`}>
                <span className="aij-k">{i + 1}</span>
                <b>{s.title}</b>
                <span>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ مساعدك الشخصيّ ═══ */}
      <section className="aij-sec aij-mint" aria-labelledby="aij-more">
        <div className="aij-wrap">
          <h2 id="aij-more" className="aij-h2">وأكثر من ذلك…<br /><span className="aij-mk"><span dir="ltr">Claude</span> مساعدك الشخصي</span></h2>
          <div className="aij-feats">
            {FEATURES.map((f) => (
              <div key={f.title} className="aij-box aij-feat">
                <span className="aij-ic" style={{ background: ICONS[f.icon].bg }} aria-hidden="true">{ICONS[f.icon].svg}</span>
                <div><b>{f.title}</b><span>{f.text}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ المهارات ═══ */}
      <section className="aij-sec aij-ice" aria-labelledby="aij-skills">
        <div className="aij-wrap">
          <h2 id="aij-skills" className="aij-h2">أمثلة على <span className="aij-mk">المهارات (Skills)</span><br />التي سنبنيها لـ <span dir="ltr">Claude</span></h2>
          <div className="aij-skills">
            {SKILLS.map((s) => (
              <div key={s.en} className="aij-box aij-skill">
                <b>{s.ar}</b>
                <i>{s.en}</i>
                <span>{s.text}</span>
              </div>
            ))}
          </div>
          <div className="aij-need">
            <b>كل ما تحتاجه:</b> لابتوب، سيرتك الذاتية، بريدك الإلكتروني، وحساب Claude (نشرح لك الخطة المناسبة).<br />
            <b>لا يشترط أي خبرة في Claude، نبدأ معك من الصفر.</b>
          </div>
        </div>
      </section>

      {/* ═══ النتيجة ═══ */}
      <section className="aij-sec aij-butter" aria-labelledby="aij-out">
        <div className="aij-wrap">
          <h2 id="aij-out" className="aij-h2">ماذا ستخرج به؟<br /><span className="aij-mk">نتيجة حقيقية، لا محاضرة</span></h2>
          <div className="aij-results">
            {RESULTS.map((r) => (
              <div key={r} className="aij-box aij-r"><Check />{r}</div>
            ))}
            <div className="aij-box aij-r big"><Check white />{BONUS}</div>
          </div>
          <div className="aij-guarantee">
            <Shield />
            <div><b>{GUARANTEE.title}</b><span>{GUARANTEE.text}</span></div>
          </div>
          <div className="aij-row"><Cta yellow label="أريد هذه النتيجة — سجّل الآن" /></div>
        </div>
      </section>

      {/* ═══ الوظيفة المناسبة في الخليج ═══ */}
      <section className="aij-sec aij-mint" aria-labelledby="aij-gulf">
        <div className="aij-wrap">
          <h2 id="aij-gulf" className="aij-h2">كيف تختار الوظيفة<br />المناسبة <span className="aij-mk">في الخليج</span>؟</h2>
          <div className="aij-tips">
            {TIPS.map((t, i) => (
              <div key={t.title} className="aij-tip">
                <span className="n">{i + 1}</span>
                <div><b>{t.title}</b><span>{t.text}</span></div>
              </div>
            ))}
          </div>
          <p className="aij-quote aij-hand" style={{ fontSize: 'clamp(24px, 3vw, 34px)' }}>وفي الدورة نعلّم <span dir="ltr">Claude</span> أن يفحص كل فرصة بهذه المعايير.</p>
        </div>
      </section>

      {/* ═══ التفاصيل ═══ */}
      <section id="details" className="aij-sec aij-ice" aria-labelledby="aij-det">
        <div className="aij-wrap">
          <h2 id="aij-det" className="aij-h2">تفاصيل <span className="aij-mk">الدورة</span></h2>
          <div className="aij-details">
            <div className="aij-box aij-detail"><small>التاريخ</small><b>{AI_JOBS.dateLabel}</b></div>
            <div className="aij-box aij-detail"><small>المدة</small><b>{AI_JOBS.hours} ساعات تطبيق عملي</b></div>
            <div className="aij-box aij-detail wide">
              <small>نظرا لنجاح الدورات السابقة فتحنا شعبتين إضافيتين · بتوقيت عمّان</small>
              <div className="aij-secs">
                {AI_JOBS.sections.map((s) => (
                  <div key={s.key}><small>{s.title}</small><b>{s.timeLabel}</b><SeatPill sectionKey={s.key} /></div>
                ))}
              </div>
            </div>
            <div className="aij-box aij-detail"><small>الطريقة</small><b>مباشر على Zoom</b></div>
            <div className="aij-box aij-detail"><small>المستوى</small><b>من الصفر، دون خبرة</b></div>
            <div className="aij-box aij-detail wide">
              <small>رسوم الدورة · الخصم حتى نفاد المقاعد · المقاعد محدودة</small>
              <b><s style={{ color: '#3c4a66', textDecorationColor: '#ff4b4b' }} dir="ltr">{AI_JOBS.listPriceUsd}$</s> <span dir="ltr">{AI_JOBS.priceUsd}$</span> <span style={{ fontSize: 16, fontWeight: 500 }}>({AI_JOBS.priceJod} دينار فقط)</span></b>
            </div>
            <div className="aij-box aij-detail green wide"><small>بعد الدورة</small><b>أسبوع متابعة مجانية على واتساب</b></div>
          </div>
          <div className="aij-row"><Cta large /></div>
        </div>
      </section>

      {/* ═══ العرض والتسجيل ═══ */}
      <section id="register" className="aij-sec aij-sun" aria-labelledby="aij-form-title" style={{ scrollMarginTop: 70 }}>
        <div className="aij-wrap aij-offer">
          <div className="aij-ticket">
            <h2>احجز مقعدك مبكرا</h2>
            <div className="aij-prices">
              <span className="old">{AI_JOBS.listPriceUsd}$</span>
              <span className="aij-save">وفّر <bdi dir="ltr">{AI_JOBS.listPriceUsd - AI_JOBS.priceUsd}$</bdi></span>
            </div>
            <div className="aij-now-row">
              <span className="now">{AI_JOBS.priceUsd}$</span>
              <span className="per">فقط<br />= {AI_JOBS.priceJod} دينار</span>
            </div>
            <p className="aij-hand">الخصم ساري حتى نفاد المقاعد</p>
            <div style={{ marginTop: 14 }}><Seats large /></div>
            <div className="aij-guarantee dark">
              <Shield />
              <div><b>{GUARANTEE.title}</b><span>{GUARANTEE.text}</span></div>
            </div>

            <div className="aij-pay">
              <small>الدفع بتحويل CliQ على الاسم المستعار</small>
              <div className="aij-alias">
                <b>{AI_JOBS.cliqAlias}</b>
                <CopyAlias />
              </div>
              <ol className="aij-howto">
                <li>احجز مقعدك: اسمك ورقمك وشعبتك</li>
                <li><span>حوّل {AI_JOBS.priceJod} دينار عبر CliQ إلى <b dir="ltr">{AI_JOBS.cliqAlias}</b> وارفع صورة الحوالة — الآن أو لاحقا</span></li>
                <li>نراجع الحوالة ويصلك التأكيد ورابط Zoom على بريدك</li>
              </ol>
            </div>
            {/* شخصان بسعر — قرارُ صاحب المنصّة (اقتراحُ «٧»، ٢١ نوفمبر ٢٠٢٦) */}
            <p className="aij-pair-note">سجّل مع صديق: <b>{AI_JOBS.pair.priceJod} دينار للاثنين</b> بدل {AI_JOBS.priceJod * 2} — تختاره في النموذج.</p>
            {card && (
              <p className="aij-card-note">من خارج الأردن؟ <b>ادفع <bdi dir="ltr">{AI_JOBS.priceUsd}$</bdi> بالبطاقة</b> بعد الحجز — تختارها في خطوة الدفع.</p>
            )}
          </div>

          <RegisterForm />
        </div>
      </section>

      {/* ═══ أسئلة ═══ */}
      <section className="aij-sec aij-ice" aria-labelledby="aij-faq">
        <div className="aij-wrap" style={{ maxWidth: 860 }}>
          <h2 id="aij-faq" className="aij-h2">أسئلة <span className="aij-mk">سريعة</span></h2>
          <div className="aij-faq">
            {faqsFor(card).map((f) => (
              <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
          <div className="aij-row">
            <Cta />
            <a className="aij-ghost" href={whatsappLink(AI_JOBS.whatsapp, 'مرحبا، عندي سؤال عن دورة التقديم على الوظائف بالذكاء الاصطناعي')} target="_blank" rel="noopener noreferrer">
              سؤال آخر؟ واتساب
            </a>
          </div>
        </div>
      </section>

      <footer className="aij-foot">
        <div className="aij-wrap">
          <p>واتساب: <a href={whatsappLink(AI_JOBS.whatsapp)} target="_blank" rel="noopener noreferrer" dir="ltr">{AI_JOBS.whatsappLabel}</a></p>
          <p className="aij-small" style={{ color: '#aab6cc' }}>دورة تدريبية مستقلة، غير تابعة لشركة Anthropic المطورة لـ Claude.</p>
        </div>
      </footer>

      {/* ═══ واتساب قبل التسجيل — اقتراحُ «٤» ═══ */}
      <a className={`aij-wa${barHidden ? ' low' : ''}`} href={whatsappLink(AI_JOBS.whatsapp, 'مرحبا، عندي سؤال قبل التسجيل في دورة التقديم على الوظائف بالذكاء الاصطناعي')}
        target="_blank" rel="noopener noreferrer" aria-label="اسألني على واتساب قبل التسجيل" onClick={() => trackPixel('Contact')}>
        <WaIcon />
        <span>اسألني قبل التسجيل</span>
      </a>

      {/* ═══ شريطُ الهاتف ═══ */}
      <div className={`aij-mobile-bar${barHidden ? ' hide' : ''}`} aria-hidden={barHidden}>
        <div className="p">
          <s>{AI_JOBS.listPriceUsd}$</s><b>{AI_JOBS.priceUsd}$</b>
          <small>بلاك فرايدي · حتى نفاد المقاعد</small>
        </div>
        <a href="#register" className="aij-cta" tabIndex={barHidden ? -1 : 0}>سجّل الآن</a>
      </div>
    </div>
  )
}

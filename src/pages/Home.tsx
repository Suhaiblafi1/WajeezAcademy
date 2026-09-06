import { useEffect, useRef, useState } from 'react'
import { safeGet, safeSet, safeRemove } from '@/services/safe-storage'
import { Link } from 'react-router'
import {
  Sparkles, Compass, Route, BadgeCheck, Network, Target,
  FileCheck, Quote, ChevronDown, Menu, X, ArrowLeft,
  Clock, User, Award, GraduationCap, Building2, Landmark,
  BookOpen, CheckCircle2, ChevronRight,
  Mail, MessageCircle, Headset, MapPin
} from 'lucide-react'
import { faqs } from '@/data/siteContent'
/* «الأكثرُ طلبا» ووسمُ القسم في ملفَّين بجانب هذا — الرئيسيّةُ كانت ألفا
   وخمسَ مئةٍ وستّةً وستّين سطرا في عشرين قسما. */
import SectionLabel from './home/SectionLabel'
import { Bestsellers } from './home/Bestsellers'
import { WhoAreYou } from './home/WhoAreYou'

/** كم سؤالا يُعرض على الرئيسية — والباقي في `/p/faq` */
const HOME_FAQ_COUNT = 4
import { CONTACT } from '@/data/stories'
import { track } from '@/services/analytics'
import { usePublishedContent } from '@/services/public-content'
import SeoHead from '@/components/SeoHead'
import ThemeToggle from '@/components/ThemeToggle'
import { homePathForRoles, readRoles } from '@/services/auth'
import Modal from '@/components/Modal'
import EcosystemNote from '@/components/EcosystemNote'
import TrustMetricsBar from '@/components/TrustMetricsBar'
import EcosystemOrgStrip from '@/components/EcosystemOrgStrip'
import '../App.css'

/* ───────────────────────── scroll reveal hook ─────────────────────────
   MutationObserver يلتقط العناصر المُضافة لاحقا (محتوى يصل بعد أول رسم —
   مثل بطاقة المسار المميز التي تنتظر لقطة الكتالوج) فلا تبقى مخفية للأبد */
function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('is-visible')),
      { threshold: 0.12 }
    )
    const seen = new WeakSet<Element>()
    const scan = () =>
      document.querySelectorAll('.reveal').forEach((el) => {
        if (!seen.has(el)) { seen.add(el); io.observe(el) }
      })
    scan()
    const mo = new MutationObserver(scan)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => { io.disconnect(); mo.disconnect() }
  }, [])
}

/* ───────────────────────── data ─────────────────────────
   القصص والشعارات انتقلت إلى مصدر مشترك تتقاسمه صفحة القصص المستقلة */
import { stories, partnerLogos, STORY_ILLUSTRATIVE_BADGE_AR } from '@/data/stories'
import StoryAvatar from '@/components/StoryAvatar'
import RemoteImage from '@/components/RemoteImage'
import { UpcomingTermLine } from '@/components/UpcomingTermNote'
import ProofBand from '@/components/ProofBand'
import { Card, Panel, Inset } from '@/components/ui/Surface'

/* «مؤشر وجيز» — سؤالا وعيٍ مستقلّان (البند ٥٧): يُحفظان محليا على جهاز الزائر
   فقط، ولا يغذّيان التشخيص إلّا `m4` — وهو الذي يوفّر سؤالا في التشخيص فعلا
   (`goal_clarity` في `teaser-bridge.ts`). كانا خمسةً، وثلاثةٌ منها لا يُقرأ
   جوابُها في موضعٍ واحد — فطولٌ يُطلب من الزائر بلا مقابلٍ يُعطاه. */
const mirrorQuestions = [
  {
    id: 'm1', moduleLabel: 'المؤشر',
    text: 'خلال هذا العام — كم مرة قررت أن تتعلم شيئا جديدا... ثم انشغلت؟',
    options: ['أكثر مما أعترف به لنفسي', 'مرة أو مرتين', 'بدأت فعلا لكني توقفت', 'لا — أنا منتظم غالبا'],
  },
  {
    id: 'm4', moduleLabel: 'المؤشر',
    text: 'عندما تفكر في وضعك المهني بعد سنتين — كيف تبدو الصورة؟',
    options: ['واضحة ومكتوبة', 'في رأسي تقريبا', 'ضبابية — وهذا يقلقني أحيانا'],
  },
]

/* ───────────────────────── small components ───────────────────────── */
function readUserName(): string | null {
  const raw = safeGet('wajeez_user')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { name?: string; exp?: number }
    if (typeof parsed.exp === 'number' && Date.now() > parsed.exp) {
      safeRemove('wajeez_user')
      return null
    }
    return parsed.name ?? raw
  } catch {
    return raw
  }
}

function Nav() {
  const [open, setOpen] = useState(false)
  const [userName] = useState<string | null>(readUserName)
  /* الاسمُ يقود إلى بوّابة صاحبه — لا إلى بوّابة المتعلّم لكلّ أحد */
  const [portalHome] = useState(() => homePathForRoles(readRoles()))
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const mobileNavRef = useRef<HTMLElement>(null)

  /* قائمة الجوال: عند فتحها ينتقل التركيز إليها، وتُغلق بـEscape ويعود التركيز لزرها */
  useEffect(() => {
    if (!open) return
    const first = mobileNavRef.current?.querySelector<HTMLElement>('a, button')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        menuBtnRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const links: { label: string; href: string; route?: boolean }[] = [
    { label: 'مؤشر وجيز', href: '#diagnostic' },
    { label: 'المسارات', href: '/pathways', route: true },
    { label: 'الدورات', href: '/courses', route: true },
    { label: 'منهجية وجيز', href: '/methodology', route: true },
  ]
  const renderLink = (l: (typeof links)[number], className: string, onClick?: () => void) =>
    l.route ? (
      <Link key={l.href} to={l.href} onClick={onClick} className={className}>{l.label}</Link>
    ) : (
      <a key={l.href} href={l.href} onClick={onClick} className={className}>{l.label}</a>
    )
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <a href="#top" className="flex items-center gap-2.5">
          <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-8 w-8 object-contain md:h-10 md:w-10" />
          <span className="text-base font-black leading-none md:text-lg"><span className="hidden min-[370px]:inline">أكاديمية </span><span className="text-teal-light-ink">وجيز</span></span>
        </a>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {links.map((l) =>
            renderLink(l, 'transition hover:text-teal-light-ink')
          )}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {userName ? (
            <Inset as={Link} tone="accent" interactive to={portalHome} className="hidden items-center gap-2 px-4 py-2 text-sm font-semibold text-teal-light-ink transition hover:bg-teal/20 md:inline-flex">
              <User className="h-4 w-4" />
              {userName}
            </Inset>
          ) : (
            <Inset as={Link} tone="accent" interactive to="/auth" className="hidden items-center gap-2 px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:border-teal/50 hover:text-teal-light-ink md:inline-flex">
              <User className="h-4 w-4" />
              دخول
            </Inset>
          )}
          <a
            href="#diagnostic"
            className="btn-teal hidden px-5 py-2.5 text-sm md:inline-flex"
          >
            ابدأ مؤشر وجيز
          </a>
          <button
            ref={menuBtnRef}
            className="md:hidden grid h-11 w-11 place-items-center text-foreground"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'إغلاق قائمة التنقل' : 'فتح قائمة التنقل'}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-menu" ref={mobileNavRef} aria-label="قائمة التنقل الرئيسية" className="border-t border-white/5 bg-paper px-5 py-4 md:hidden">
          {links.map((l) =>
            renderLink(l, 'block py-2.5 text-muted-foreground hover:text-teal-light-ink', () => setOpen(false))
          )}
          {userName ? (
            <Inset as={Link} tone="accent" interactive to={portalHome} onClick={() => setOpen(false)} className="mt-2 flex items-center justify-center gap-2 px-5 py-3 font-semibold text-teal-light-ink">
              <User className="h-4 w-4" /> {userName}
            </Inset>
          ) : (
            <Inset as={Link} interactive to="/auth"
              onClick={() => setOpen(false)} className="mt-2 flex w-full items-center justify-center gap-2 px-5 py-3 font-semibold text-muted-foreground">
              <User className="h-4 w-4" /> دخول / إنشاء حساب
            </Inset>
          )}
          <a href="#diagnostic" onClick={() => setOpen(false)} className="btn-teal mt-2 flex w-full px-5 py-3">
            ابدأ مؤشر وجيز
          </a>
          <div className="mt-3 flex justify-center">
            <ThemeToggle />
          </div>
        </nav>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-20 pb-0 md:pt-36 md:pb-2">
      {/* ─────────── إيقاع الهيرو على الهاتف ───────────

          كانت `pt-28` (١١٢px) والترويسةُ ٦٤px، فيبقى نحوُ ٥٠px فراغا ميتا فوق
          أوّل كلمة — ويُدفع آخرُ القسم تحت حافّة الشاشة فيُقصّ. والقياس على
          ٣٩٠×٨٤٤: القسم ٥١٥px ثمّ يليه قسمٌ حشوُه العلويّ ٨٠px.

          والعلاج ليس قصَّ المساحة السوداء بل أن ينتهي القسم حيث ينتهي محتواه:
          حشوٌ علويّ يكفي الترويسةَ وقليلا، وسُلَّمٌ طباعيّ يهبط درجةً على
          الهاتف ويعود على الشاشات الأوسع. */}
      {/* ambient glows */}
      <div className="pointer-events-none absolute -top-40 right-1/4 h-[480px] w-[480px] rounded-full bg-teal/15 blur-[140px] animate-pulse-glow" />
      <div className="pointer-events-none absolute top-40 left-0 h-[380px] w-[380px] rounded-full bg-teal-deep/20 blur-[120px] animate-pulse-glow" style={{ animationDelay: '2s' }} />

      <div className="relative mx-auto max-w-7xl px-5 text-center">
        <div className="reveal is-visible">
          <SectionLabel>منصة تفهمك قبل أن تعلّمك</SectionLabel>
        </div>
        <h1 className="reveal is-visible mx-auto mt-3 max-w-3xl">
          <span className="block text-xl font-semibold leading-snug text-foreground/80 sm:text-2xl md:text-3xl">
            المسار الصحيح لا يبدأ باختيار دورة.
          </span>
          <span className="mt-2 block bg-gradient-to-l from-teal-light-ink via-teal-ink to-gold-ink bg-clip-text text-3xl font-bold leading-[1.3] text-transparent sm:text-4xl md:text-6xl md:leading-[1.2]">
            يبدأ بفهم هدفك.
          </span>
        </h1>
        <div className="reveal is-visible mt-11 flex flex-col items-center justify-center">
          <a
            href="#diagnostic"
            onClick={() => track('hero_cta_clicked')}
            className="group btn-teal w-full px-10 py-3.5 text-base shadow-[0_0_40px_-8px_#38A7B4] sm:w-auto sm:py-4 sm:text-lg"
          >
            اعرف من أين تبدأ
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          </a>
          {/* الفعلُ الثانويّ يجب أن يُرى فعلا.

              كان نصّا رماديّا بلا حدٍّ ولا خطٍّ تحته، فلا شيءَ فيه يقول إنّه
              يُنقر — والخطُّ تحته لا يظهر إلّا بالتحويم، وهو ما لا يقع على
              الهاتف أصلا. صار حدّا خفيفا بحشوٍ ظاهر: زرٌّ هادئ إلى جانب
              الدعوة لا يزاحمها. */}
          <a
            href="#bestsellers"
            className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:border-teal/50 hover:bg-teal/[0.07] hover:text-teal-light-ink"
          >
            <Route className="h-3.5 w-3.5" />
            <span className="underline-offset-4 hover:underline">اختر مسارك بنفسك</span>
          </a>
          {/* ── سطرٌ ثانٍ مؤرَّخ (البند ٥٢) ──

              الدعوةُ فوقَه صحيحةٌ ولا يُمسّ ترتيبُها: التشخيصُ قِمعُ المنصّة.
              لكنّها — كدعوات الرئيسة كلِّها — **بلا تاريخ**، ودعوةٌ بلا تاريخٍ
              تُقرأ لافتةً لا نداء. فيُقال تحتها متى يبدأ الفصلُ ومتى تُغلق
              نافذتُه، ولا شيءَ يُقال قبل أن يُنشأ فصل. */}
          <p className="mt-4 text-xs font-bold leading-6 text-muted-foreground">
            <UpcomingTermLine prefix="الفصل القادم:" />
          </p>
        </div>
      </div>
    </section>
  )
}

/* ───────────────── مؤشر وجيز — سؤالا صدقٍ مع النفس ───────────────── */
function DiagnosticTeaser() {
  /* استرجاع المحفوظ المحلي كحالة أولية كسولة — لا setState داخل تأثير */
  const [savedMirror] = useState(() => {
    try {
      const saved = JSON.parse(safeGet('wajeez_mirror') ?? 'null') as { step?: number; answers?: Record<string, string> } | null
      return saved && typeof saved.step === 'number' && saved.answers ? saved : null
    } catch { return null } // لا محفوظات صالحة
  })
  const [step, setStep] = useState(() => Math.min(savedMirror?.step ?? 0, mirrorQuestions.length))
  const [answers, setAnswers] = useState<Record<string, string>>(() => savedMirror?.answers ?? {})
  const [picked, setPicked] = useState<string | null>(null) // إظهار الاختيار لحظيا ومنع الضغط المتكرر
  const done = step >= mirrorQuestions.length
  const current = mirrorQuestions[Math.min(step, mirrorQuestions.length - 1)]

  /* حفظ مؤقت محلي آمن — الإجابات لا تغادر جهاز الزائر. الذي يُرسل هو حدثا
     mirror_started/mirror_completed بلا أي محتوى إجابة (انظر analytics.ts). */
  useEffect(() => {
    safeSet('wajeez_mirror', JSON.stringify({ step, answers }))
  }, [step, answers])

  const pick = (qid: string, value: string) => {
    if (picked) return // ضغطة واحدة تكفي — نمنع التكرار أثناء الانتقال
    if (step === 0) track('mirror_started')
    if (step + 1 === mirrorQuestions.length) track('mirror_completed')
    setPicked(value)
    setAnswers((a) => ({ ...a, [qid]: value }))
    window.setTimeout(() => {
      setStep((s) => s + 1)
      setPicked(null)
    }, 300)
  }
  const back = () => {
    if (picked || step === 0) return
    setStep(step - 1)
  }
  const reset = () => {
    setStep(0)
    setAnswers({})
    setPicked(null)
    safeRemove('wajeez_mirror')
  }

  return (
    /* `scroll-mt-24`: الرأسُ `fixed h-16`، فالقفزُ إلى مرساةٍ بلا هامشِ تمرير
       يضع رأسَ القسم عند y=0 — أي **تحت** الرأس الثابت. فكان الزائرُ يضغط
       «مؤشر وجيز» فتختفي شارةُ القسم وسطرٌ من عنوانه خلف الرأس. و`#top-courses`
       وحدَه كان يحمل الهامش، فعمل — وبقي الباقي مقصوصا.

       وحشوُه العلويّ على الشاشات الواسعة كان ٩٦px فوق ملاحظةِ المنظومة، فيصير
       بين نهاية الصدر وأوّل كلمةٍ هنا ١٩٠ بكسل بيضاء على اللابتوب (٤٠ فوق
       الملاحظة + ٣٦ تحتها + ٩٦ هنا) — وهي «المساحة البيضاء الكبيرة بالأسفل».
       والهاتفُ ليس فيه هذا: حشوُه ٤٨ فالمجموع ١٢٤، وهو معقول. فخُفّض العلويُّ
       على `md` وحدَه وبقي السفليُّ كما هو، فلا يتحرّك شيءٌ على الهاتف. */
    <section id="diagnostic" className="scroll-mt-24 relative py-12 sm:py-16 md:pb-24 md:pt-14">
      {/* ─────────── لماذا ضاق رأسُ هذا القسم ───────────

          على الهاتف كان الزائر يضغط «مؤشر وجيز» فيهبط إلى قسمٍ رأسُه ثلاثةُ
          أسطر (شارة + عنوانٌ من سطرين + فقرة) وحشوُه العلويّ ٨٠px — فيقع
          زرُّ الإجراء تحت حافّة الشاشة، ويضطرّ إلى **الصعود** ليصل إلى ما نزل
          من أجله. وهي أسوأ مفارقةٍ في رحلةٍ كلُّها إجراء.

          والعنوان والفقرة كانا يقولان الشيء نفسَه بصيغتين: «اعرف لماذا لم
          تبدأ» ثمّ «تكشف ما يعطّلك فعلا». فدُمجا في جملةٍ واحدة تحمل الوعد
          كاملا، وهبط الحشوُ على الهاتف وحده — والشاشات الأوسع كما كانت. */}
      <div className="mx-auto max-w-4xl px-5">
        <div className="reveal text-center">
          <SectionLabel>مؤشر وجيز — دقيقة واحدة</SectionLabel>
          <h2 className="mt-4 text-xl font-bold leading-snug sm:text-2xl md:text-4xl">
            قبل أن تختار دورة… اعرف لماذا لم تبدأ بعد
          </h2>
          <p className="mx-auto mt-2.5 max-w-lg text-[13px] leading-6 text-muted-foreground sm:mt-4 sm:text-base sm:leading-8">
            سؤالان صادقان يبني عليهما التشخيص الكامل.
          </p>
        </div>

        <div className="reveal mt-6 overflow-hidden sm:mt-10 rounded-[2rem] border border-white/[0.08] bg-card/90 shadow-[0_24px_90px_-40px_rgba(56,167,180,0.35)] backdrop-blur-sm">
          {/* مؤشر التقدم */}
          <div
            className="flex gap-2 px-8 pt-7"
            role="progressbar"
            aria-label={`التقدم: أجبت عن ${Math.min(step, mirrorQuestions.length)} من ${mirrorQuestions.length} أسئلة`}
            aria-valuemin={0}
            aria-valuemax={mirrorQuestions.length}
            aria-valuenow={Math.min(step, mirrorQuestions.length)}
          >
            {mirrorQuestions.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i < step ? 'bg-teal' : i === step ? 'bg-teal-light/60' : 'bg-white/10'}`} />
            ))}
          </div>

          {/* إعلان السؤال لقارئ الشاشة */}
          <p className="sr-only" aria-live="polite">
            {!done ? `سؤال ${step + 1} من ${mirrorQuestions.length}: ${current.text}` : 'اكتملت المؤشر — تظهر خلاصتك الآن'}
          </p>

          <div className="p-5 sm:p-8 md:p-10" key={step}>
            {!done ? (
              <div className="story-fade">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-teal-light-ink">سؤال {step + 1} من {mirrorQuestions.length}</div>
                  <div className="flex items-center gap-4 text-xs">
                    {step > 0 && (
                      <button
                        onClick={back}
                        disabled={Boolean(picked)}
                        className="inline-flex items-center gap-1 text-muted-foreground transition hover:text-teal-light-ink disabled:opacity-40"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                        السؤال السابق
                      </button>
                    )}
                    <button
                      onClick={reset}
                      className="text-muted-foreground transition hover:text-teal-light-ink"
                    >
                      إعادة البدء
                    </button>
                  </div>
                </div>
                <h3 className="mt-3 text-lg font-bold leading-8 sm:text-2xl sm:leading-relaxed">{current.text}</h3>
                <div className="mt-7 grid gap-3" role="group" aria-label={`خيارات السؤال ${step + 1}`}>
                  {current.options.map((opt) => {
                    const selected = picked === opt || (!picked && answers[current.id] === opt)
                    return (
                      <button
                        key={opt}
                        onClick={() => pick(current.id, opt)}
                        aria-pressed={selected}
                        className={`group flex items-center justify-between gap-2 rounded-2xl border px-4 py-3.5 text-right text-sm font-medium leading-6 transition sm:px-5 sm:py-4 sm:text-base ${
                          selected
                            ? 'border-teal bg-teal/20 text-teal-light-ink'
                            : 'border-white/10 bg-white/[0.03] hover:border-teal/50 hover:bg-teal/10 hover:text-teal-light-ink'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-light-ink" />}
                          {opt}
                        </span>
                        {!selected && <ArrowLeft className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="story-fade text-center">
                {/* الأيقونة تشرح ما يليها: الدماغ والدوائر تقول «ذكاء اصطناعي»
                    وهي ليست الحالة. الحالة أن مهاراته ستُقاس ثم تُرتَّب في مسار
                    — فخريطةُ مهاراتٍ موصولةٍ بمسار أصدق. */}
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal/12 ring-1 ring-teal/25 sm:h-16 sm:w-16">
                  <Network className="h-6 w-6 text-teal-ink sm:h-8 sm:w-8" />
                </div>
                {/* «سمعناك — صورتك بدأت تتضح» تصف شعورا لا خطوة، ولا تقول له ماذا
                    يفعل الآن ولا لماذا. هذه تضعه في مكانه وتسمّي ما يلي. */}
                <h3 className="mt-4 text-lg font-bold leading-7 sm:mt-5 sm:text-2xl sm:leading-relaxed">أنت في المكان الصحيح. الآن نبني خطتك.</h3>
                {/* حُذفت هنا «قراءة» مشتقة من الإجابات («عندك تخمين عن فجواتك…»).
                    كانت تدفع زرّ «ابدأ التشخيص الكامل» تحت الطيّة على الهاتف: هذه
                    شاشةُ إجراء لا شاشةُ تأمّل، ونصٌّ يؤخّر الزرّ يكلّف أكثر مما يعطي. */}
                <p className="mx-auto mt-3 max-w-sm text-xs leading-6 text-muted-foreground">
                  أجب عن أسئلة أعمق عن هدفك وخبرتك ومهاراتك، لنحدّد ما تحتاجه من دورات مرتّبة في مسار واحد.
                </p>
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row">
                  <Link to="/diagnostic" className="btn-teal px-8 py-4">
                    ابدأ التشخيص الكامل
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                  <button onClick={reset} className="text-sm text-muted-foreground underline-offset-4 hover:text-teal-light-ink hover:underline">
                    أعد المؤشر من جديد
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="reveal mt-4 text-center text-xs text-muted-foreground">
          نسترشد بأطر مهنية وتعليمية معروفة: RIASEC للميول المهنية · O*NET وESCO للمهارات · DigComp للجاهزية الرقمية
        </p>
      </div>
    </section>
  )
}

/* ───────────────── how it works ───────────────── */
const steps = [
  { icon: Compass, title: 'نفهمك', text: 'أسئلة متكيفة عن هدفك وواقعك ووقتك — لا عن ذوقك في الدورات.' },
  { icon: Target, title: 'نوصي ونشرح', text: 'مسار واحد واضح، مع السبب ودرجة الثقة. أو مستشار بشري إن احتاج الأمر.' },
  { icon: Route, title: 'تتعلم بترابط', text: 'كل دورة تبني على التي قبلها، ومدرب ومستشار يرافقانك فعليا.' },
  { icon: BadgeCheck, title: 'تُثبت بمخرج', text: 'مشروع حقيقي يُراجَع ويُقيَّم. القيمة بالإنجاز، لا بالمشاهدة.' },
]

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 border-y border-white/5 bg-white/[0.02] py-14 md:py-16">
      <div className="mx-auto max-w-7xl px-5">
        <div className="reveal flex flex-wrap items-center justify-center gap-3 text-center md:justify-between md:text-right">
          <h2 className="text-xl font-bold md:text-2xl">كيف تسير رحلتك — أربع خطوات لا أكثر</h2>
          <SectionLabel>من أول سؤال إلى مخرج مُثبت</SectionLabel>
        </div>
        <div className="relative mt-8">
          {/* خط واصل يلمّ المراحل على الشاشات الكبيرة */}
          <div className="pointer-events-none absolute inset-x-10 top-5 hidden h-px bg-gradient-to-l from-transparent via-teal/25 to-transparent md:block" />
          <div className="grid gap-3 md:grid-cols-4">
            {steps.map((s, i) => (
              <Card tone="accent" key={s.title} className="reveal group relative flex items-start gap-3.5 bg-card px-4 py-4 transition hover:border-teal/40">
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal/12 text-teal-ink transition group-hover:scale-105">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <span className="text-fine font-black text-teal-ink">{i + 1}</span>
                    {s.title}
                  </h3>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">{s.text}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ───────────────── منهجية وجيز — ثقة علمية بلا استعراض شعارات ───────────────── */
/* ───────────────── visual band ───────────────── */
/* ───────────────── stories (the heart) ───────────────── */
function Stories() {
  const [open, setOpen] = useState<(typeof stories)[number] | null>(null)

  return (
    <section id="stories" className="scroll-mt-24 relative py-20 md:py-24">
      <div className="pointer-events-none absolute left-1/3 top-0 h-[400px] w-[400px] rounded-full bg-teal/8 blur-[130px]" />
      <div className="mx-auto max-w-7xl px-5">
        <div className="reveal text-center">
          <SectionLabel>نماذج توضيحية لرحلات التعلم</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold md:text-4xl">هكذا تُبنى الرحلة عندنا</h2>
          <p className="mx-auto mt-4 max-w-xl leading-8 text-muted-foreground">
            كل رحلة تبدأ بتشخيص أو بمسار جاهز، وتمر بدورات الكتالوج، وتنتهي بمشروع تخرج يدخل ملفك — اختر نموذجا واقرأه كاملا.
          </p>
          {/* الصدقُ باقٍ والصوتُ خافت: تنويهٌ لا يزاحم ما جاء الزائرُ ليقرأه */}
          <p className="mx-auto mt-3 max-w-md text-fine leading-5 text-muted-foreground">
            نماذج توضيحية مركبة من أنماط شائعة — ليست شهادات لأشخاص حقيقيين.
          </p>
        </div>
      </div>

      {/* شريط القصص المضغوط — بطاقة لكل قصة، والتفاصيل في نافذتها */}
      <p className="sr-only">{`يعرض ${stories.length} قصص — اسحب بإصبعك أو استخدم أسهم لوحة المفاتيح للتنقل بينها`}</p>
      <div
        role="region"
        aria-roledescription="شريط بطاقات"
        aria-label="قصص متعلمي وجيز"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); e.currentTarget.scrollBy({ left: -320, behavior: 'smooth' }) }
          if (e.key === 'ArrowRight') { e.preventDefault(); e.currentTarget.scrollBy({ left: 320, behavior: 'smooth' }) }
        }}
        className="scrollbar-hide mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 md:px-[max(1.25rem,calc((100vw-72rem)/2+1.25rem))]"
      >
        {stories.map((s) => (
          <button
            key={s.id}
            onClick={() => setOpen(s)}
            className="group flex w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-white/10 bg-card text-right transition-all duration-200 hover:-translate-y-1 hover:border-teal/50 hover:shadow-[0_20px_60px_-30px_rgba(56,167,180,0.4)]"
          >
            <div className="relative h-36 overflow-hidden">
              <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_60%_20%,rgba(56,167,180,0.35),transparent_65%)]">
                <StoryAvatar id={s.id} name={s.name} look={s.look} className="h-20 w-20" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
              <span className="tag-teal absolute bottom-3 right-4 rounded-full px-3 py-1 text-fine font-bold">{s.tag}</span>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="text-sm font-bold">
                {s.name} <span className="font-normal text-muted-foreground">— {s.role}</span>
              </p>
              {/* «قبل» سقط من البطاقة وبقي في النافذة.

                  كان على كلّ بطاقةٍ سطران: حالُه قبلُ ثمّ نتيجتُه. والقارئُ في
                  شريطٍ أفقيّ لا يوازن بينهما — يمسح النتائجَ ليجد ما يشبهه، ثمّ
                  يفتح ما يشبهه ليقرأ القصّة كاملة (وهي كاملةٌ في النافذة أصلا).
                  و«قبل» بلا «بعد» في مساحةِ سطرين لا يبني الموازنةَ التي وُضع
                  لها، ويضاعف نصَّ الشريط. */}
              <p className="mt-2 line-clamp-2 text-xs leading-6 text-foreground/85">
                <span className="font-bold text-gold-ink">النتيجة: </span>
                {s.result}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-teal-light-ink">
                اقرأ القصة كاملة
                <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-1" />
              </span>
            </div>
          </button>
        ))}

        {/* بطاقة ختامية تعيد للتشخيص */}
        <Panel as={Link} tone="accent" interactive to="/diagnostic" className="flex w-[240px] shrink-0 snap-start flex-col items-center justify-center border-dashed text-center transition hover:border-teal/60 hover:bg-teal/10">
          <Compass className="h-7 w-7 text-teal-ink" />
          <p className="mt-3 text-sm font-bold leading-relaxed">وقصتك التالية؟</p>
          <p className="mt-1.5 text-xs leading-6 text-muted-foreground">تبدأ بثلاث دقائق من التشخيص</p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-teal-light-ink">
            ابدأ الآن
            <ArrowLeft className="h-3.5 w-3.5" />
          </span>
        </Panel>
      </div>

      {/* نافذة القصة الكاملة */}
      {open && (
        <Modal onClose={() => setOpen(null)} label={`قصة ${open.name} كاملة`} panelClassName="my-8 w-full max-w-3xl">
          <Panel dir="rtl" className="story-fade overflow-hidden bg-card">
              {/* رأس القصة */}
              <div className="relative h-52 overflow-hidden md:h-60">
                <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_60%_20%,rgba(56,167,180,0.35),transparent_65%)]">
                  <StoryAvatar id={open.id} name={open.name} look={open.look} className="h-28 w-28 md:h-32 md:w-32" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                <button
                  onClick={() => setOpen(null)}
                  aria-label="إغلاق القصة"
                  className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-paper/50 text-foreground backdrop-blur transition hover:bg-paper/70 hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="absolute bottom-4 right-6 flex flex-wrap items-center gap-3">
                  <span className="tag-teal rounded-full px-4 py-1.5 text-sm font-bold">{open.tag}</span>
                  <span className="text-sm text-foreground">{open.name} — {open.role}</span>
                  <span className="text-fine font-normal text-muted-foreground">{STORY_ILLUSTRATIVE_BADGE_AR}</span>
                </div>
              </div>

              {/* الحكاية */}
              <div className="border-b border-white/5 p-8 md:p-10">
                <Quote className="h-8 w-8 text-teal-ink/50" />
                <p className="mt-5 text-lg leading-9 text-foreground/90 md:text-xl md:leading-10">
                  {open.before} {open.turn}
                </p>
              </div>

              {/* تفاصيل المسار */}
              {/* المدخلُ والمسارُ ومشروعُ التخرّج.

                  حُذف عمودُ «المدرب»: قاعدتُنا ألّا يُعرض اسمُ مدرّبٍ قبل اعتماد
                  شعبته، فكان العمودُ يعرض الجملةَ المؤقّتة نفسَها في خمس بطاقات.
                  ومكانَه دخل ما يُقنع فعلا: كيف دخل، ومشروعُ تخرّجه. */}
              <div className="grid gap-px bg-white/5 md:grid-cols-3">
                <div className="bg-card p-6">
                  <div className="flex items-center gap-2 text-xs text-teal-light-ink">
                    {open.entry === 'diagnostic' ? <Compass className="h-4 w-4" /> : <Route className="h-4 w-4" />}
                    {open.entry === 'diagnostic' ? 'بدأ بالتشخيص' : 'اشترى مسارا جاهزا'}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-muted-foreground">
                    {open.entry === 'diagnostic'
                      ? 'لم يكن يعرف من أين يبدأ — فرسم له التشخيص المسار.'
                      : 'كان يعرف وجهته، فبدأ المسار مباشرة.'}
                  </div>
                </div>
                <div className="bg-card p-6">
                  <div className="flex items-center gap-2 text-xs text-teal-light-ink"><Route className="h-4 w-4" /> المسار</div>
                  <div className="mt-2 font-bold leading-7">{open.pathway}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {open.weeks} أسبوعا · {open.weeklyHours} · {open.courses.length} دورات
                  </div>
                </div>
                <div className="bg-card p-6">
                  <div className="flex items-center gap-2 text-xs text-teal-light-ink"><FileCheck className="h-4 w-4" /> مشروع التخرّج</div>
                  <div className="mt-2 text-sm font-bold leading-7">{open.capstone}</div>
                </div>
              </div>

              {/* دورات القصة ومخرجاتها */}
              <div className="border-t border-white/5 p-8 md:px-10">
                <div className="flex items-center gap-2 text-xs text-teal-light-ink">
                  <BookOpen className="h-4 w-4" /> دورات المسار — وماذا خرج من كلّ واحدة
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {open.courses.map((c) => (
                    <Card key={c.id}>
                      <p className="text-sm font-bold leading-relaxed">{c.name}</p>
                      <p className="mt-2 flex items-start gap-1.5 text-xs leading-6 text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-ink" />
                        {c.output}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>

              {/* ما تغيّر فعلا — قبل وبعد.

                  هذا أنفعُ ما في القصّة: النتيجةُ في الأسفل تُروى، وهذه تُقاس.
                  وثلاثةٌ من مسارات الكتالوج تنصّ على قياس قبل/بعد في مشروع
                  تخرّجها — فما يُعرض هنا ما نفعله، لا ما نتمنّاه. */}
              <div className="border-t border-white/5 p-8 md:px-10">
                <div className="flex items-center gap-2 text-xs text-teal-light-ink">
                  <Target className="h-4 w-4" /> قياس المهارة — قبل المسار وبعده
                </div>
                <Card className="mt-4 overflow-hidden">
                  {open.measure.map((m, i) => (
                    <div
                      key={m.skill}
                      className={`grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] sm:items-center ${i ? 'border-t border-white/10' : ''}`}
                    >
                      <p className="text-sm font-bold leading-relaxed">{m.skill}</p>
                      <p className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">
                        <span className="mt-0.5 shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-fine font-bold">قبل</span>
                        {m.before}
                      </p>
                      <p className="flex items-start gap-2 text-xs leading-6 text-foreground/90">
                        <span className="mt-0.5 shrink-0 rounded-full bg-teal/15 px-2 py-0.5 text-fine font-bold text-teal-light-ink">بعد</span>
                        {m.after}
                      </p>
                    </div>
                  ))}
                </Card>
              </div>

              {/* النهاية */}
              <div className="border-t border-white/5 bg-gradient-to-l from-teal/10 to-transparent p-8 md:px-10">
                <div className="flex items-start gap-3">
                  <Award className="mt-1 h-6 w-6 shrink-0 text-gold-ink" />
                  <div>
                    <div className="text-sm font-semibold text-gold-ink">وكيف انتهت القصة؟</div>
                    <p className="mt-2 leading-8 text-foreground/90">{open.result}</p>
                    <div className="mt-4 text-xs text-muted-foreground">— {open.name}، {open.role}</div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/5 p-6 text-center">
                <Link to="/diagnostic" className="inline-flex items-center gap-2 font-semibold text-teal-light-ink transition hover:text-teal-ink">
                  قصتك التالية تبدأ من تشخيصك
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </div>
          </Panel>
        </Modal>
      )}
    </section>
  )
}

/* ───────────────── bestsellers: pathways + courses with category filter ─────────────────
   التصنيف من الدالة المركزية pathwayCategory فقط — كانت خريطة محلية مكررة هنا
   تتضارب معها (COM تُحسب «أساسيات» خطأً، و«تخصصات وظيفية» تظهر بلا مسارات).
   قاعدة: لا زر مجال بلا عناصر — القوائم تُشتق من البيانات الفعلية مع عدادات. */

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="scroll-mt-24 py-20 md:py-24">
      <div className="mx-auto max-w-3xl px-5">
        <div className="reveal text-center">
          <SectionLabel>أسئلة تصلنا كثيرا</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold md:text-4xl">قبل أن تسأل — أجبنا</h2>
        </div>
        {/* أربعةٌ هنا، وبقيّتُها في صفحتها.

            كانت السبعةُ كلُّها على الرئيسية، وهي آخرُ قسمٍ قبل الدعوة الختامية
            — فمن بلغه قد قرأ ألفي كلمةٍ قبله. والأسئلةُ الشائعة صفحةٌ قائمة
            (`/p/faq`) تُفتح بنيّة السؤال، والرئيسيةُ تُمسح بنيّة القرار. فبقيت
            الأربعةُ الأولى ونزل الباقي إلى موضعه، برابطٍ صريحٍ إليه. */}
        <div className="mt-12 space-y-3">
          {faqs.slice(0, HOME_FAQ_COUNT).map((f, i) => (
            <Card tone="accent" key={i} className="reveal overflow-hidden bg-card transition hover:border-teal/30" style={{ transitionDelay: `${i * 60}ms` }}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                aria-controls={`faq-answer-${i}`}
                id={`faq-question-${i}`}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-right font-semibold"
              >
                {f.q}
                <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-teal-light-ink transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              <div
                id={`faq-answer-${i}`}
                role="region"
                aria-labelledby={`faq-question-${i}`}
                className={`grid transition-all duration-300 ${open === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
              >
                <div className="overflow-hidden">
                  <p className="px-6 pb-6 leading-8 text-muted-foreground">{f.a}</p>
                </div>
              </div>
            </Card>
          ))}

          {/* سؤال المنهجية — مميز بإطار تركوازي وزر يقود لصفحة المنهجية */}
          {(() => {
            const i = faqs.length
            return (
              <Card tone="accent" className="reveal overflow-hidden border-2 bg-gradient-to-l from-panel/50 to-card transition hover:border-teal/70" style={{ transitionDelay: `${i * 60}ms` }}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  aria-controls={`faq-answer-${i}`}
                  id={`faq-question-${i}`}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-right font-semibold"
                >
                  <span className="flex items-center gap-2.5">
                    <Sparkles className="h-4.5 w-4.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
                    كيف تبنون توصيتكم — هل هي تخمين؟
                  </span>
                  <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-teal-light-ink transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`} />
                </button>
                <div
                  id={`faq-answer-${i}`}
                  role="region"
                  aria-labelledby={`faq-question-${i}`}
                  className={`grid transition-all duration-300 ${open === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                  <div className="overflow-hidden">
                    <div className="px-6 pb-6">
                      <p className="leading-8 text-muted-foreground">
                        توصية مبنية على منهجية، لا على التخمين: يحلل التشخيص الكامل ميولك وأهدافك وفجوات مهاراتك بأطر مهنية معروفة
                        (RIASEC وO*NET وESCO وDigComp)، وكل استنتاج مرتبط بإجابة قدّمتها — بلا صناديق سوداء، وبدرجة ثقة معلنة.
                        أما «مؤشر وجيز» على هذه الصفحة فسؤالان تمهيديّان عن علاقتك بالتعلّم، لا تحليل مهارات.
                      </p>
                      <Link
                        to="/methodology"
                        className="mt-5 inline-flex items-center gap-2 rounded-full border border-teal/50 bg-teal/15 px-6 py-2.5 text-sm font-bold text-teal-light-ink transition hover:bg-teal/25"
                      >
                        اكتشف كيف نبني توصيتك
                        <ArrowLeft className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })()}
        </div>
        {/* البقيّةُ إلى صفحتها — والرابطُ يقول عددَها فيعرف القارئ ما ينتظره */}
        {faqs.length > HOME_FAQ_COUNT && (
          <div className="mt-6 text-center">
            <Link
              to="/p/faq"
              className="inline-flex min-h-11 items-center gap-1.5 px-3 text-sm font-semibold text-muted-foreground transition hover:text-teal-light-ink"
            >
              {faqs.length - HOME_FAQ_COUNT} أسئلة أخرى
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

/* ───────────────── final CTA ───────────────── */
function FinalCta() {
  return (
    <section id="cta" className="scroll-mt-24 relative overflow-hidden py-24 md:py-28">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-teal/10 to-transparent" />
      <div className="pointer-events-none absolute right-1/2 top-1/2 h-[420px] w-[420px] -translate-y-1/2 translate-x-1/2 rounded-full bg-teal/20 blur-[140px] animate-pulse-glow" />
      <div className="relative mx-auto max-w-3xl px-5 text-center">
        <h2 className="reveal text-3xl font-bold leading-snug md:text-5xl md:leading-tight">
          نسختك القادمة تستحق
          <br />
          <span className="text-teal-light-ink">أكثر من دورة عشوائية.</span>
        </h2>
        <p className="reveal mx-auto mt-6 max-w-md leading-8 text-muted-foreground">
          امنحنا بضع دقائق من الوضوح، نمنحك خريطة طريق كاملة.
        </p>
        <div className="reveal mt-9">
          {/* كان يعِد بخريطة طريق كاملة ثم يهبط بالزائر إلى المؤشّر التمهيديّ في
              الصفحة نفسها. الوعد المكتوب فوق الزر يقرر وجهته: التشخيص الكامل. */}
          <Link
            to="/diagnostic"
            className="btn-teal px-10 py-5 text-lg shadow-[0_0_60px_-10px_#38A7B4]"
          >
            ابدأ التشخيص الكامل
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">
            مجاني · بدون حساب · إجاباتك على جهازك — لا نُرسل إلا أنك بدأت وأكملت
          </p>
        </div>
      </div>
    </section>
  )
}

/* ───────────────── partners (شعارات من موقع وجيز الأم — من المصدر المشترك) ───────────────── */
function Partners() {
  return (
    <section id="partners" className="scroll-mt-24 py-14 md:py-16">
      <div className="mx-auto max-w-5xl px-5 text-center">
        <div className="reveal">
          <SectionLabel>شركاؤنا</SectionLabel>
          <h2 className="mt-4 text-2xl font-bold md:text-3xl">تحدث عنا الإعلام — وشركاء نجاح نفخر بهم</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
              أكاديمية وجيز امتداد لمنصة وجيز التي غطتها كبرى الوسائل الإعلامية.
          </p>
        </div>
        <div className="reveal mt-10 flex flex-wrap items-center justify-center gap-10 md:gap-16">
          {/* و-٢: الشعار يحمل معنى (اسم الجهة) فبديله نصُّه لا فراغ.
              كانت الثلاثة تُستضاف على مُحسِّن صور الموقع الأم ولا تُحمَّل،
              فيقرأ الزائر «تحدث عنا الإعلام» ولا يرى تحته شيئا. */}
          {partnerLogos.map((p) => (
            <RemoteImage
              key={p.name}
              src={p.src}
              alt={p.name}
              fallback="label"
              loading="lazy"
              className="partner-logo h-10 w-auto opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0 md:h-12"
              fallbackClassName="h-10 md:h-12"
            />
          ))}
        </div>
        {/* الجدارُ الثاني تحت الأوّل لا بعد قسمين — البند ٥٦ */}
        <EcosystemOrgStrip nested />
      </div>
    </section>
  )
}

/* ───────────────── footer (full sitemap) ───────────────── */
const footerCols: { title: string; icon: typeof GraduationCap; links: { label: string; to: string }[] }[] = [
  {
    title: 'المنصة',
    icon: GraduationCap,
    links: [
      { label: 'كل المسارات', to: '/pathways' },
      { label: 'كل الدورات', to: '/courses' },
      { label: 'مؤشر وجيز والتشخيص', to: '/diagnostic' },
      { label: 'قصص المتعلمين', to: '/stories' },
      { label: 'المدربون والمستشارون', to: '/trainers' },
      { label: 'التحقق من شهادة', to: '/verify' },
    ],
  },
  {
    title: 'عن وجيز',
    icon: User,
    links: [
      { label: 'من نحن', to: '/p/about' },
      { label: 'منهجية وجيز', to: '/methodology' },
      { label: 'شركاؤنا', to: '#partners' },
      { label: 'انضم كمدرب', to: '/join-trainer' },
    ],
  },
  {
    title: 'الحلول',
    icon: Building2,
    links: [
      { label: 'للأفراد', to: '/pathways' },
      { label: 'للشركات', to: '/contact?type=company' },
      { label: 'للجهات الحكومية', to: '/contact?type=gov' },
      { label: 'طلب عرض مؤسسي', to: '/contact' },
    ],
  },
  {
    title: 'الدعم',
    icon: Landmark,
    links: [
      { label: 'تواصل معنا', to: '/contact' },
      { label: 'الأسئلة الشائعة', to: '/p/faq' },
      { label: 'شروط الاستخدام', to: '/p/terms' },
      { label: 'سياسة الخصوصية', to: '/p/privacy' },
      { label: 'سياسة الاسترداد', to: '/p/refund' },
    ],
  },
]

/* التذييل: أنعمُ وأصغرُ وأقربُ سطورا.

   وُصف بأنّه «كبير ومبعثر». والسببُ قياسٌ لا ذوق: حشوٌ ٤٨px، وفجوةُ شبكةٍ
   ٣٢px بين الأعمدة، وروابطُ ١٤px بفراغِ ٨px بينها، ورؤوسُ أعمدةٍ بحجم النصّ
   العاديّ — فلا يفترق الرأسُ عن رابطه إلا بالوزن. والتذييلُ آخرُ ما يُقرأ،
   فحجمُه يجب أن يقول ذلك.

   فنزلت الروابطُ إلى ١٢٫٥px بفراغِ ٤px، ورؤوسُ الأعمدة إلى ١٣px بأيقونةٍ
   أصغر، والحشوُ إلى ٣٦px. ولا يُحذف رابطٌ واحد: الشكوى في الحجم لا في العدد. */
function Footer() {
  return (
    <footer className="border-t border-white/5 bg-surface3">
      <div className="mx-auto max-w-7xl px-5 py-9">
        <div className="grid gap-x-6 gap-y-7 md:grid-cols-5">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5">
              <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
              <div className="font-bold">وجيز <span className="text-teal-light-ink">أكاديمي</span></div>
            </div>
            <p className="mt-2.5 max-w-xs text-[12.5px] leading-6 text-muted-foreground">
              منصة تفهم الإنسان قبل أن تقترح ما يتعلمه — من مجموعة وجيز wajeez.com
            </p>
            <div className="mt-3 flex items-center gap-2 text-fine text-muted-foreground">
              <Mail className="h-4 w-4 text-teal-ink" />
              <span dir="ltr">{CONTACT.email}</span>
            </div>
            <div className="mt-2 space-y-1">
              {CONTACT.locations.map((loc) => (
                <div key={loc.label} className="flex items-start gap-2 text-fine leading-5 text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-ink" />
                  {loc.href ? (
                    <a href={loc.href} target="_blank" rel="noreferrer" className="transition hover:text-teal-light-ink">
                      {loc.label}{loc.address ? ` — ${loc.address}` : ''}
                    </a>
                  ) : (
                    <span>{loc.label}{loc.address ? ` — ${loc.address}` : ''}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          {footerCols.map((col) => (
            <div key={col.title}>
              <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold">
                <col.icon className="h-3.5 w-3.5 text-teal-ink" />
                {col.title}
              </div>
              <ul className="space-y-1 text-[12.5px] leading-6 text-muted-foreground">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.to.startsWith('#') ? (
                      <a href={l.to} className="transition hover:text-teal-light-ink">{l.label}</a>
                    ) : (
                      <Link to={l.to} className="transition hover:text-teal-light-ink">{l.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-7 flex flex-col items-center justify-between gap-2 border-t border-white/5 pt-5 text-fine text-muted-foreground md:flex-row">
          <div>© 2026 أكاديمية وجيز — جميع الحقوق محفوظة</div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            صُنع بعناية — الفهم قبل البيع
          </div>
        </div>
        {/* تعريف المنظومة — انتقل إلى هنا من أسفل الصدر مباشرة: سطر هوية
            ثانوي لا يستحق مكانا في أول ما تراه العين بعد الهيرو. */}
        <EcosystemNote className="mt-3" />
      </div>
    </footer>
  )
}

/* ───────────────── شريط الدعوة الثابت للجوال ─────────────────
   يظهر بعد تجاوز البطل، ويختفي عند العودة لأعلى — دعوة واحدة دائمة في متناول الإبهام */
function MobileCtaBar() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 450)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-paper/90 px-5 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-xl transition-transform duration-300 md:hidden ${visible ? 'translate-y-0' : 'translate-y-full'}`}
    >
      <a href="#diagnostic" className="btn-teal w-full py-3.5">
        مؤشر وجيز — دقيقة واحدة
        <ArrowLeft className="h-4 w-4" />
      </a>
    </div>
  )
}

/* ───────────────── المستشار المهني — قناة إنسانية هادئة لا تزاحم المؤشر ───────────────── */
const ADVISOR_MSG = 'مرحبا، زرت أكاديمية وجيز وأريد حديثا قصيرا مع مستشار مهني قبل أن أبدأ تشخيصي.'

function advisorHref() {
  return CONTACT.whatsapp
    ? `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(ADVISOR_MSG)}`
    : `mailto:${CONTACT.email}?subject=${encodeURIComponent('أكاديمية وجيز — حديث مع مستشار')}&body=${encodeURIComponent(ADVISOR_MSG)}`
}

/* شارة قناة عصرية — نقطة حية متدرجة لا شعار أخضر تقليدي */
function ChannelBadge() {
  const isWhatsApp = Boolean(CONTACT.whatsapp)
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-fine font-bold text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${isWhatsApp ? 'bg-gradient-to-br from-emerald-300 to-teal' : 'bg-teal'}`} />
      {isWhatsApp ? 'واتساب' : 'بريد'}
    </span>
  )
}

/* شريط رفيع بعد القصص — لحظة الاقتناع العاطفي يجد فيها المتردد طمأنة بشرية */
function AdvisorStrip() {
  const isWhatsApp = Boolean(CONTACT.whatsapp)
  return (
    <section className="mx-auto max-w-7xl px-5 pb-4">
      <Panel tone="accent" className="reveal flex flex-col items-center justify-between gap-5 bg-gradient-to-l from-panel/80 to-card px-6 py-6 md:flex-row md:px-8">
        <div className="flex items-center gap-4 text-center md:text-right">
          <span className="relative hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal/12 text-teal-ink md:grid">
            <Headset className="h-6 w-6" />
            <span className="absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-300 ring-2 ring-card" />
          </span>
          <div>
            <p className="font-bold">لست جاهزا لتشخيص؟ ابدأ بحديث قصير مع مستشار مهني.</p>
            <p className="mt-1 text-sm text-muted-foreground">يسمع هدفك، ويجيب أسئلتك، ويرشدك لأنسب بداية — ثم القرار لك.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2">
          <a
            href={advisorHref()}
            target={isWhatsApp ? '_blank' : undefined}
            rel={isWhatsApp ? 'noreferrer' : undefined}
            className="inline-flex items-center gap-2 rounded-full border border-teal/40 bg-teal/10 px-6 py-2.5 text-sm font-bold text-teal-light-ink transition hover:bg-teal/20"
          >
            <MessageCircle className="h-4 w-4" />
            احجز حديثك
          </a>
          <p className="flex items-center gap-2 text-fine text-muted-foreground">
            مجاني · خمس عشرة دقيقة · بلا التزام
            <ChannelBadge />
          </p>
        </div>
      </Panel>
    </section>
  )
}

/* ───────────────── page ─────────────────
   الترتيب المعتمد: بطل واضح ← مؤشر وجيز ← كيف تعمل الرحلة ← أرقام وجيز مهارات الموثقة
   ← شركاء/إعلام ← مخرجات التعلم ← مسارات ودورات مميزة ← مؤسسات المنظومة ← قصص حقيقية
   ← شريط مستشار ← أسئلة ← دعوة أخيرة + زر مستشار عائم */
export default function Home() {
  useReveal()
  usePublishedContent()
  const topRef = useRef<HTMLDivElement>(null)
  /* الوصول من صفحة داخلية مع مرساة (/#diagnostic): المتصفح يحاول التمرير قبل تركيب React،
     فنمرّر للقسم المطلوب بعد التركيب */
  useEffect(() => {
    if (!window.location.hash) return
    const el = document.querySelector(window.location.hash)
    el?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  return (
    <div ref={topRef} dir="rtl" className="min-h-screen bg-background text-foreground">
      <SeoHead
        title="مسارك يبدأ من فهمك"
        description="أكاديمية وجيز — تشخيص تعليمي ذكي يفهم هدفك وواقعك، ثم يرسم لك مسارا واحدا مفسّرا بمدربين حقيقيين ومخرج عملي يثبت جاهزيتك."
        path="/"
      />
      <Nav />
      <div>
        <Hero />
        {/* «أين أنت الآن؟» قبل شرحِ الرحلة وقبل الكتالوج: أوّلُ سؤالٍ يُطرح
            على الزائر يجب أن يكون عمّا يعرفه عن نفسه، لا عن تصنيفٍ لم يضعه. */}
        <WhoAreYou />
        <DiagnosticTeaser />
        <HowItWorks />
        {/* شريط الثقة — أرقام وجيز مهارات الموثقة فقط، بعد شرح الرحلة (مصدر مركزي: data/trustMetrics) */}
        <TrustMetricsBar />
        <Partners />
        <ProofBand />
        <Bestsellers />
        <Stories />
        <AdvisorStrip />
        <Faq />
        <FinalCta />
      </div>
      {/* تعويض ارتفاع شريط الدعوة الثابت على الجوال */}
      <div className="h-20 md:hidden" />
      <MobileCtaBar />
      <Footer />
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Sparkles, Compass, Route, BadgeCheck, BrainCircuit, Target,
  FileCheck, Quote, ChevronDown, Menu, X, ArrowLeft,
  Clock, User, Award, GraduationCap, Building2, Landmark,
  CheckCircle2, Play, Flame, ChevronLeft, ChevronRight, BookOpen,
  Users, Mail
} from 'lucide-react'
import { bestsellers, pathwayById } from '@/data/pathways'
import { bestsellerCourses, courseById, courseCategories, pathwayTrainers, weeksLabel, type Course } from '@/data/courses'
import { faqs } from '@/data/siteContent'
import { CONTACT } from '@/data/stories'
import { track } from '@/services/analytics'
import SeoHead from '@/components/SeoHead'
import CourseModal from '@/components/CourseModal'
import Modal from '@/components/Modal'
import { CURRENCIES, setCurrency, useCurrency, type CurrencyCode } from '@/services/currency'
import '../App.css'

/* ───────────────────────── مبدّل العملة ───────────────────────── */
function CurrencySwitcher({ compact = false }: { compact?: boolean }) {
  const cur = useCurrency()
  return (
    <label className={`flex items-center gap-1.5 rounded-xl border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-teal/50 ${compact ? '' : 'hidden md:flex'}`}>
      <span className="sr-only">عملة العرض</span>
      <select
        aria-label="عملة العرض"
        value={cur.code}
        onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
        className="cursor-pointer bg-transparent text-xs font-semibold text-muted-foreground outline-none [&>option]:bg-[#121B1D] [&>option]:text-white"
      >
        {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
          <option key={code} value={code}>
            {CURRENCIES[code].symbol} {CURRENCIES[code].label}
          </option>
        ))}
      </select>
    </label>
  )
}

/* ───────────────────────── scroll reveal hook ───────────────────────── */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('is-visible')),
      { threshold: 0.12 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

/* ───────────────────────── data ─────────────────────────
   القصص والشعارات انتقلت إلى مصدر مشترك تتقاسمه صفحة القصص المستقلة */
import { stories, partnerLogos } from '@/data/stories'

/* «وقفة صدق» — خمسة أسئلة وعي مستقلة: تُحفظ محليا على جهاز الزائر فقط ولا تغذي التشخيص،
   بل توقظ فيه السؤال الصحيح وتفتح شهيته لخدمتنا، ثم يبدأ التشخيص الكامل من الصفر باحترافية */
const mirrorQuestions = [
  {
    id: 'm1', moduleLabel: 'الوقفة',
    text: 'خلال هذا العام — كم مرة قررت أن تتعلم شيئا جديدا... ثم انشغلت؟',
    options: ['أكثر مما أعترف به لنفسي', 'مرة أو مرتين', 'بدأت فعلا لكني توقفت', 'لا — أنا منتظم غالبا'],
  },
  {
    id: 'm2', moduleLabel: 'الوقفة',
    text: 'لو سألنا مديرك أو أستاذك: ما المهارة التي تنقصك فعلا؟ — هل تعرف إجابته فورا؟',
    options: ['نعم — أعرفها بالضبط', 'لدي تخمين لا أكثر', 'بصراحة؟ لا أعرف'],
  },
  {
    id: 'm3', moduleLabel: 'الوقفة',
    text: 'كم دورة إلكترونية بدأتها في حياتك... وأكملتها فعلا للنهاية؟',
    options: ['أكملت معظمها', 'بعضها فقط', 'أبدأ بحماس وأتوقف — قصتي المعتادة'],
  },
  {
    id: 'm4', moduleLabel: 'الوقفة',
    text: 'عندما تفكر في وضعك المهني بعد سنتين — كيف تبدو الصورة؟',
    options: ['واضحة ومكتوبة', 'في رأسي تقريبا', 'ضبابية — وهذا يقلقني أحيانا'],
  },
  {
    id: 'm5', moduleLabel: 'الوقفة',
    text: 'وما الذي يمنعك اليوم من البدء فعلا؟',
    options: ['لا أعرف من أين أبدأ', 'الخيارات كثيرة وتشتتني', 'أخاف أدفع ثمن شيء لا يناسبني', 'ظروفي لا تسمح الآن'],
  },
]
/* جواب المانع الأخير يقود رسالة الوقفة — هنا تُشرح قيمة الخدمة بلغة حالته هو */
const mirrorPitch: Record<string, string> = {
  'لا أعرف من أين أبدأ': 'لهذا بالضبط وُجد التشخيص: يبدأ منك أنت — هدفك وقصتك وظروفك — لا من قائمة دورات نفرضها عليك.',
  'الخيارات كثيرة وتشتتني': 'التشخيص يحسم التشتت: مسار واحد مفسَّر بدرجة ثقة، بدل أربعين قائمة تتنافس على انتباهك.',
  'أخاف أدفع ثمن شيء لا يناسبني': 'خوفك في محله — ولهذا التشخيص مجاني والتوصية مفسَّرة: لن تدفع ريالا قبل أن تفهم لماذا هذا المسار لك تحديدا.',
  'ظروفي لا تسمح الآن': 'المسارات عندنا تُبنى على ظروفك أنت: موعدك المستهدف ولغتك وصيغة تعلمك — لا على حياة شخص مثالي لا وجود له.',
}

/* ───────────────────────── small components ───────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-[#38A7B4]/10 px-4 py-1.5 text-sm text-teal-light">
      <Sparkles className="h-3.5 w-3.5" />
      {children}
    </div>
  )
}

function readUserName(): string | null {
  const raw = localStorage.getItem('wajeez_user')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { name?: string; exp?: number }
    if (typeof parsed.exp === 'number' && Date.now() > parsed.exp) {
      localStorage.removeItem('wajeez_user')
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
    { label: 'وقفة صدق', href: '#diagnostic' },
    { label: 'المسارات', href: '/pathways', route: true },
    { label: 'الدورات', href: '/courses', route: true },
    { label: 'قصص المتعلمين', href: '/stories', route: true },
    { label: 'الأسئلة', href: '#faq' },
  ]
  const renderLink = (l: (typeof links)[number], className: string, onClick?: () => void) =>
    l.route ? (
      <Link key={l.href} to={l.href} onClick={onClick} className={className}>{l.label}</Link>
    ) : (
      <a key={l.href} href={l.href} onClick={onClick} className={className}>{l.label}</a>
    )
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#0D0D0D]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="#top" className="flex items-center gap-2.5">
          <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-10 w-10 object-contain" />
          <span className="text-lg font-black leading-none">أكاديمية <span className="text-teal-light">وجيز</span></span>
        </a>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {links.map((l) =>
            renderLink(l, 'transition hover:text-teal-light')
          )}
        </nav>
        <div className="flex items-center gap-3">
          <CurrencySwitcher />
          {userName ? (
            <Link to="/student" className="hidden items-center gap-2 rounded-xl border border-teal/40 bg-[#38A7B4]/10 px-4 py-2 text-sm font-semibold text-teal-light transition hover:bg-[#38A7B4]/20 md:inline-flex">
              <User className="h-4 w-4" />
              {userName}
            </Link>
          ) : (
            <Link
              to="/auth"
              className="hidden items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:border-teal/50 hover:text-teal-light md:inline-flex"
            >
              <User className="h-4 w-4" />
              دخول
            </Link>
          )}
          <a
            href="#diagnostic"
            className="btn-teal hidden px-5 py-2.5 text-sm md:inline-flex"
          >
            جرّب وقفة صدق
          </a>
          <button
            ref={menuBtnRef}
            className="md:hidden text-foreground"
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
        <nav id="mobile-menu" ref={mobileNavRef} aria-label="قائمة التنقل الرئيسية" className="border-t border-white/5 bg-[#0D0D0D] px-5 py-4 md:hidden">
          {links.map((l) =>
            renderLink(l, 'block py-2.5 text-muted-foreground hover:text-teal-light', () => setOpen(false))
          )}
          {userName ? (
            <Link to="/student" onClick={() => setOpen(false)} className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-teal/40 px-5 py-3 font-semibold text-teal-light">
              <User className="h-4 w-4" /> {userName}
            </Link>
          ) : (
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-semibold text-muted-foreground"
            >
              <User className="h-4 w-4" /> دخول / إنشاء حساب
            </Link>
          )}
          <a href="#diagnostic" onClick={() => setOpen(false)} className="btn-teal mt-2 flex w-full px-5 py-3">
            جرّب وقفة صدق
          </a>
          <div className="mt-3 flex justify-center">
            <CurrencySwitcher compact />
          </div>
        </nav>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      {/* ambient glows */}
      <div className="pointer-events-none absolute -top-40 right-1/4 h-[480px] w-[480px] rounded-full bg-[#38A7B4]/15 blur-[140px] animate-pulse-glow" />
      <div className="pointer-events-none absolute top-40 left-0 h-[380px] w-[380px] rounded-full bg-[#247B84]/20 blur-[120px] animate-pulse-glow" style={{ animationDelay: '2s' }} />

      <div className="relative mx-auto max-w-6xl px-5 text-center">
        <div className="reveal is-visible">
          <SectionLabel>منصة تفهمك قبل أن تعلّمك</SectionLabel>
        </div>
        <h1 className="reveal is-visible mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.25] md:text-6xl md:leading-[1.2]">
          مسارك لا يبدأ من دورة.
          <br />
          <span className="bg-gradient-to-l from-[#6EC7D1] via-[#38A7B4] to-[#FABC05] bg-clip-text text-transparent">
            مسارك يبدأ من فهمك.
          </span>
        </h1>
        <p className="reveal is-visible mx-auto mt-6 max-w-xl text-base leading-8 text-muted-foreground md:text-lg">
          تشخيص ذكي يسألك أسئلة قليلة، يفهم هدفك وواقعك ووقتك،
          ثم يوصي بمسار واحد واضح — <span className="text-foreground">ويشرح لك لماذا.</span>
        </p>
        <div className="reveal is-visible mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#diagnostic"
            onClick={() => track('hero_cta_clicked')}
            className="group btn-teal w-full px-8 py-4 shadow-[0_0_40px_-8px_#38A7B4] sm:w-auto"
          >
            خذ وقفة صدق
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          </a>
          <a
            href="#stories"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-8 py-4 font-semibold transition hover:border-teal/40 hover:text-teal-light sm:w-auto"
          >
            <Play className="h-4 w-4" />
            شاهد رحلات من سبقوك
          </a>
        </div>
        <p className="reveal is-visible mt-6 text-xs text-muted-foreground">
          دقيقة واحدة من الصدق · ثم تشخيص كامل يفهمك بلا تقييم ذاتي ولا سؤال مكرر
        </p>
      </div>
    </section>
  )
}

/* ───────────────── وقفة صدق — خمسة أسئلة صدق مع النفس ───────────────── */
function DiagnosticTeaser() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [picked, setPicked] = useState<string | null>(null) // إظهار الاختيار لحظيا ومنع الضغط المتكرر
  const done = step >= mirrorQuestions.length
  const current = mirrorQuestions[Math.min(step, mirrorQuestions.length - 1)]

  /* حفظ مؤقت محلي آمن — لا يغادر جهاز الزائر ولا يُرسل لأي خادم */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('wajeez_mirror') ?? 'null') as { step?: number; answers?: Record<string, string> } | null
      if (saved && typeof saved.step === 'number' && saved.answers) {
        setStep(Math.min(saved.step, mirrorQuestions.length))
        setAnswers(saved.answers)
      }
    } catch { /* لا محفوظات صالحة */ }
  }, [])
  useEffect(() => {
    localStorage.setItem('wajeez_mirror', JSON.stringify({ step, answers }))
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
    localStorage.removeItem('wajeez_mirror')
  }
  const blocker = answers['m5']
  const pitch = blocker ? mirrorPitch[blocker] : null
  const answeredLabels = mirrorQuestions
    .map((q) => (q.options.includes(answers[q.id]) ? answers[q.id] : null))
    .filter(Boolean) as string[]

  /* صورة أولية صادقة مشتقة من إجابات الوقفة نفسها — بلا أرقام ولا ادعاءات */
  const mirrorInsights: Record<string, string> = {
    'نعم — أعرفها بالضبط': 'تعرف فجوتك بالاسم — نصف الطريق قطعتَه، والباقي خطة تنفيذ لا بحث.',
    'لدي تخمين لا أكثر': 'عندك تخمين عن فجوتك — التشخيص الكامل يحوّله إلى يقين موثّق.',
    'بصراحة؟ لا أعرف': 'لم تُسمِّ فجوتك بعد — وهذا أول ما يكشفه لك التشخيص الكامل.',
    'أكملت معظمها': 'عادتك في الإكمال قوية — تحتاج فقط ما يستحق إكماله.',
    'بعضها فقط': 'تُكمل بعض ما تبدأ — الفرق عندنا مرافقة بشرية تحميك من التوقف الصامت.',
    'أبدأ بحماس وأتوقف — قصتي المعتادة': 'قصة التوقف المتكرر لا تُحل بإرادة أقوى — بل بمسار مرافَق يعرف متى تتعثر.',
    'واضحة ومكتوبة': 'صورتك عن سنتين واضحة — سنبني عليها لا أن نعيد رسمها.',
    'في رأسي تقريبا': 'صورتك موجودة لكنها شفافة — التشخيص يحوّلها إلى خطة مكتوبة بموعد.',
    'ضبابية — وهذا يقلقني أحيانا': 'ضبابية الصورة أخطر إشارة — وأكثر ما يجيده التشخيص الكامل هو تبلورها.',
  }
  const insights = (['m2', 'm3', 'm4']
    .map((id) => answers[id])
    .map((a) => (a ? mirrorInsights[a] : null))
    .filter(Boolean) as string[]).slice(0, 2)

  return (
    <section id="diagnostic" className="relative py-20 md:py-24">
      <div className="mx-auto max-w-4xl px-5">
        <div className="reveal text-center">
          <SectionLabel>وقفة صدق — دقيقة واحدة</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold md:text-4xl">قبل أن نتحدث نحن… اسمع نفسك</h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground leading-8">
            خمسة أسئلة صدق مع النفس — لا تُقيّمك ولا تُرسل لأي جهة.
            مهمتها واحدة: أن ترى في إجاباتك ما نراه نحن كل يوم.
          </p>
        </div>

        <div className="reveal mt-10 overflow-hidden rounded-3xl border border-white/10 bg-card shadow-[0_20px_80px_-30px_rgba(56,167,180,0.25)]">
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
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i < step ? 'bg-teal' : i === step ? 'bg-[#6EC7D1]/60' : 'bg-white/10'}`} />
            ))}
          </div>

          {/* إعلان السؤال لقارئ الشاشة */}
          <p className="sr-only" aria-live="polite">
            {!done ? `سؤال ${step + 1} من ${mirrorQuestions.length}: ${current.text}` : 'اكتملت الوقفة — تظهر خلاصتك الآن'}
          </p>

          <div className="p-8 md:p-10" key={step}>
            {!done ? (
              <div className="story-fade">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-teal-light">سؤال {step + 1} من {mirrorQuestions.length}</div>
                  <div className="flex items-center gap-4 text-xs">
                    {step > 0 && (
                      <button
                        onClick={back}
                        disabled={Boolean(picked)}
                        className="inline-flex items-center gap-1 text-muted-foreground transition hover:text-teal-light disabled:opacity-40"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                        السؤال السابق
                      </button>
                    )}
                    <button
                      onClick={reset}
                      className="text-muted-foreground/70 transition hover:text-teal-light"
                    >
                      إعادة البدء
                    </button>
                  </div>
                </div>
                <h3 className="mt-3 text-2xl font-bold leading-relaxed">{current.text}</h3>
                <div className="mt-7 grid gap-3" role="group" aria-label={`خيارات السؤال ${step + 1}`}>
                  {current.options.map((opt) => {
                    const selected = picked === opt || (!picked && answers[current.id] === opt)
                    return (
                      <button
                        key={opt}
                        onClick={() => pick(current.id, opt)}
                        aria-pressed={selected}
                        className={`group flex items-center justify-between rounded-2xl border px-5 py-4 text-right font-medium transition ${
                          selected
                            ? 'border-teal bg-[#38A7B4]/20 text-teal-light'
                            : 'border-white/10 bg-white/[0.03] hover:border-teal/50 hover:bg-[#38A7B4]/10 hover:text-teal-light'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-light" />}
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
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#38A7B4]/15">
                  <BrainCircuit className="h-8 w-8 text-teal" />
                </div>
                <h3 className="mt-5 text-2xl font-bold leading-relaxed">رأيتَ ما نراه؟ أنت لست وحدك في هذا.</h3>
                <div className="mx-auto mt-4 flex max-w-lg flex-wrap justify-center gap-2">
                  {answeredLabels.map((l) => (
                    <span key={l} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">
                      {l}
                    </span>
                  ))}
                </div>
                {pitch && (
                  <p className="mx-auto mt-5 max-w-md rounded-2xl border border-teal/30 bg-[#38A7B4]/10 p-5 leading-8 text-teal-light">
                    {pitch}
                  </p>
                )}
                {/* مكافأة فورية: صورة أولية مشتقة من إجاباته هو — تجعل الانتقال للتشخيص الكامل مكافأة لا التزاما */}
                {insights.length > 0 && (
                  <div className="mx-auto mt-4 max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-white/85">
                      <Sparkles className="h-4 w-4 text-teal-light" />
                      صورتك الأولية — من إجاباتك أنت
                    </p>
                    <ul className="mt-3 space-y-2 text-right">
                      {insights.map((line) => (
                        <li key={line} className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6EC7D1]" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mx-auto mt-4 max-w-md leading-8 text-muted-foreground">
                  الوقفة أدت وظيفتها. الآن يبدأ العمل الحقيقي: تشخيص كامل يفهم قصتك ويستنتج مستواك
                  من مواقفك الحقيقية — ثم يرسم لك مسارا مفسّرا تستطيع تخصيصه.
                </p>
                <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link to="/diagnostic" className="btn-teal px-8 py-4">
                    ابدأ التشخيص الكامل
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                  <button onClick={reset} className="text-sm text-muted-foreground underline-offset-4 hover:text-teal-light hover:underline">
                    أعد الوقفة من جديد
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="reveal mt-4 text-center text-xs text-muted-foreground">
          مبني على مراجع علمية موثوقة: RIASEC للميول المهنية · O*NET وESCO للمهارات · DigComp للجاهزية الرقمية
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
    <section id="how" className="border-y border-white/5 bg-white/[0.02] py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="reveal text-center">
          <SectionLabel>كيف تسير رحلتك</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold md:text-4xl">أربع خطوات — لا أكثر</h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="reveal group relative rounded-3xl border border-white/10 bg-card p-7 transition-all duration-200 hover:-translate-y-1 hover:border-teal/50 hover:shadow-[0_20px_60px_-30px_rgba(56,167,180,0.4)]" style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#38A7B4]/12 text-teal transition group-hover:scale-110">
                  <s.icon className="h-6 w-6" />
                </div>
                <span className="text-4xl font-bold text-white/5 transition group-hover:text-teal/20">{i + 1}</span>
              </div>
              <h3 className="mt-5 text-xl font-bold">{s.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────────────── visual band ───────────────── */
function ImageBand() {
  return (
    <section className="relative overflow-hidden">
      <img
        src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1600&q=80&auto=format&fit=crop"
        alt="متعلمون يتعاونون حول طاولة واحدة"
        loading="lazy"
        className="h-[340px] w-full object-cover md:h-[420px]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/55 to-[#0D0D0D]/25" />
      <div className="absolute inset-0 flex items-end">
        <div className="mx-auto w-full max-w-6xl px-5 pb-10">
          <p className="reveal max-w-xl text-2xl font-bold leading-relaxed md:text-3xl">
            التعلم عندنا ليس مقعدا في صف —
            <span className="text-teal-light"> بل طاولة عمل تُنجز عليها شيئا حقيقيا.</span>
          </p>
          <p className="reveal mt-3 max-w-md text-sm leading-7 text-white/70">
            مجموعات صغيرة، مدرب يراجع عملك بيده، ومشروع تخرج تضعه في ملفك المهني.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ───────────────── stories (the heart) ───────────────── */
function Stories() {
  const [open, setOpen] = useState<(typeof stories)[number] | null>(null)

  return (
    <section id="stories" className="relative py-20 md:py-24">
      <div className="pointer-events-none absolute left-1/3 top-0 h-[400px] w-[400px] rounded-full bg-[#38A7B4]/8 blur-[130px]" />
      <div className="mx-auto max-w-6xl px-5">
        <div className="reveal text-center">
          <SectionLabel>قصص حدثت بالفعل</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold md:text-4xl">مسارات مشى فيها غيرك قبلك</h2>
          <p className="mx-auto mt-4 max-w-xl leading-8 text-muted-foreground">
            كل قصة بدأت بتشخيص، ومرّت بمسار ومدرب، وانتهت بمخرج يمكنك أن تراه — اختر قصة واقرأها كاملة.
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
              <img
                src={s.img}
                alt={`قصة ${s.name}`}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
              <span className="tag-teal absolute bottom-3 right-4 rounded-full px-3 py-1 text-[11px] font-bold">{s.tag}</span>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="text-sm font-bold">
                {s.name} <span className="font-normal text-muted-foreground">— {s.role}</span>
              </p>
              <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">{s.before}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-6 text-foreground/85">
                <span className="font-bold text-amber-brand">النتيجة: </span>
                {s.result}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-teal-light">
                اقرأ القصة كاملة
                <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-1" />
              </span>
            </div>
          </button>
        ))}

        {/* بطاقة ختامية تعيد للتشخيص */}
        <Link
          to="/diagnostic"
          className="flex w-[240px] shrink-0 snap-start flex-col items-center justify-center rounded-3xl border border-dashed border-teal/30 bg-[#38A7B4]/5 p-6 text-center transition hover:border-teal/60 hover:bg-[#38A7B4]/10"
        >
          <Compass className="h-7 w-7 text-teal" />
          <p className="mt-3 text-sm font-bold leading-relaxed">وقصتك التالية؟</p>
          <p className="mt-1.5 text-xs leading-6 text-muted-foreground">تبدأ بخمس دقائق من التشخيص</p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-teal-light">
            ابدأ الآن
            <ArrowLeft className="h-3.5 w-3.5" />
          </span>
        </Link>
      </div>

      {/* نافذة القصة الكاملة */}
      {open && (
        <Modal onClose={() => setOpen(null)} label={`قصة ${open.name} كاملة`} panelClassName="my-8 w-full max-w-3xl">
          <div dir="rtl" className="story-fade overflow-hidden rounded-3xl border border-white/10 bg-card">
              {/* صورة القصة */}
              <div className="relative h-56 overflow-hidden md:h-72">
                <img src={open.img} alt={`صورة رمزية لقصة ${open.name}`} loading="lazy" width="1200" height="600" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                <button
                  onClick={() => setOpen(null)}
                  aria-label="إغلاق القصة"
                  className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white/80 backdrop-blur transition hover:bg-black/70 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="absolute bottom-4 right-6 flex items-center gap-3">
                  <span className="tag-teal rounded-full px-4 py-1.5 text-sm font-bold">{open.tag}</span>
                  <span className="text-sm text-white/80">{open.name} — {open.role}</span>
                </div>
              </div>

              {/* الحكاية */}
              <div className="border-b border-white/5 p-8 md:p-10">
                <Quote className="h-8 w-8 text-teal/50" />
                <p className="mt-5 text-lg leading-9 text-foreground/90 md:text-xl md:leading-10">
                  {open.before} {open.turn}
                </p>
              </div>

              {/* تفاصيل المسار */}
              <div className="grid gap-px bg-white/5 md:grid-cols-3">
                <div className="bg-card p-6">
                  <div className="flex items-center gap-2 text-xs text-teal-light"><Route className="h-4 w-4" /> المسار الذي {open.gender === 'f' ? 'سلكته' : 'سلكه'}</div>
                  <div className="mt-2 font-bold leading-7">{open.pathway}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{open.duration}</div>
                </div>
                <div className="bg-card p-6">
                  <div className="flex items-center gap-2 text-xs text-teal-light"><User className="h-4 w-4" /> المدرب</div>
                  <div className="mt-2 font-bold">{open.trainer}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{open.gender === 'f' ? 'رافقها' : 'رافقه'} في التقييم والمتابعة طوال المسار</div>
                </div>
                <div className="bg-card p-6">
                  <div className="flex items-center gap-2 text-xs text-teal-light"><FileCheck className="h-4 w-4" /> المخرج العملي</div>
                  <div className="mt-2 font-bold leading-7">{open.output}</div>
                </div>
              </div>

              {/* دورات القصة ومخرجاتها */}
              <div className="border-t border-white/5 p-8 md:px-10">
                <div className="flex items-center gap-2 text-xs text-teal-light">
                  <BookOpen className="h-4 w-4" /> الدورات التي {open.gender === 'f' ? 'أخذتها' : 'أخذها'} {open.name} — وماذا خرج{open.gender === 'f' ? 'ت' : ''} من كل واحدة
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {open.courses.map((c) => (
                    <div key={c.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-sm font-bold leading-relaxed">{c.name}</p>
                      <p className="mt-2 flex items-start gap-1.5 text-xs leading-6 text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
                        {c.output}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* النهاية */}
              <div className="border-t border-white/5 bg-gradient-to-l from-[#38A7B4]/10 to-transparent p-8 md:px-10">
                <div className="flex items-start gap-3">
                  <Award className="mt-1 h-6 w-6 shrink-0 text-amber-brand" />
                  <div>
                    <div className="text-sm font-semibold text-amber-brand">وكيف انتهت القصة؟</div>
                    <p className="mt-2 leading-8 text-foreground/90">{open.result}</p>
                    <div className="mt-4 text-xs text-muted-foreground">— {open.name}، {open.role}</div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/5 p-6 text-center">
                <Link to="/diagnostic" className="inline-flex items-center gap-2 font-semibold text-teal-light transition hover:text-teal">
                  قصتك التالية تبدأ من تشخيصك
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </div>
          </div>
        </Modal>
      )}
    </section>
  )
}

/* ───────────────── bestsellers: pathways + courses with category filter ───────────────── */
const PW_CATEGORY: Record<string, string> = {
  FND: 'أساسيات', STU: 'طلاب ومهنة', CAREER: 'طلاب ومهنة', EMP: 'موظفون',
  GOV: 'حكومي', BIZ: 'أعمال', FREE: 'أعمال', LEAD: 'قيادة', FAM: 'أسرة ورفاه', WELL: 'أسرة ورفاه',
}
const pwCategory = (id: string) => PW_CATEGORY[id.split('-')[1]] ?? 'أساسيات'

function Bestsellers() {
  const [cat, setCat] = useState('الكل')
  const [modalCourse, setModalCourse] = useState<Course | null>(null)
  const navigate = useNavigate()
  const pwRailRef = useRef<HTMLDivElement>(null)
  const crRailRef = useRef<HTMLDivElement>(null)
  // في RTL المحتوى الزائد يكون يسارا؛ scrollBy النسبي يعمل في كل المتصفحات
  const scroll = (ref: React.RefObject<HTMLDivElement | null>, dir: 'next' | 'prev') =>
    ref.current?.scrollBy({ left: dir === 'next' ? -420 : 420, behavior: 'smooth' })
  // تحكم لوحة المفاتيح في الشرائط: الأسهم تحرك الشريط ذاته
  const railKeys = (ref: React.RefObject<HTMLDivElement | null>) => (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); scroll(ref, 'next') }
    if (e.key === 'ArrowRight') { e.preventDefault(); scroll(ref, 'prev') }
  }

  /* الرئيسية تعرض نخبة فقط — 6 مسارات و4 دورات كحد أقصى، والكتالوج الكامل في صفحته */
  const shownPathways = bestsellers
    .map((b) => ({ ...b, p: pathwayById(b.id)! }))
    .filter((b) => b.p && (cat === 'الكل' || pwCategory(b.p.id) === cat))
    .slice(0, 6)
  const shownCourses = bestsellerCourses
    .map((b) => ({ ...b, c: courseById(b.id)! }))
    .filter((b) => b.c && (cat === 'الكل' || b.c.category === cat))
    .slice(0, 4)
  const spotlight = shownPathways[0]
  const railPathways = shownPathways.slice(1)

  return (
    <section id="bestsellers" className="py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="reveal flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionLabel>مختارات وجيز</SectionLabel>
            <h2 className="mt-4 text-3xl font-bold md:text-4xl">مسارات ودورات منتقاة بعناية</h2>
            <p className="mt-3 max-w-lg leading-8 text-muted-foreground">
              لا تريد البدء بالتشخيص؟ اختر مجالك أولا — ثم مسارا كاملا، أو دورة واحدة إن كنت تعرف ما تريد بالضبط.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => scroll(pwRailRef, 'prev')} aria-label="السابق"
              className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:border-teal/50 hover:text-teal-light">
              <ChevronRight className="h-5 w-5" />
            </button>
            <button onClick={() => scroll(pwRailRef, 'next')} aria-label="التالي"
              className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:border-teal/50 hover:text-teal-light">
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* فلاتر المجالات — أزرار تبديل تعلن حالتها لقارئ الشاشة */}
        <div className="reveal mt-8 flex flex-wrap gap-2" role="group" aria-label="تصفية المسارات حسب المجال">
          {courseCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              aria-pressed={cat === c}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                cat === c
                  ? 'border-teal bg-[#247B84] text-white shadow-[0_0_24px_-6px_#38A7B4]'
                  : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:border-teal/40 hover:text-teal-light'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* البطاقة المميزة — اختيار وجيز الأول في هذا المجال */}
      {spotlight && (
        <div className="mx-auto max-w-6xl px-5">
          <Link
            to={`/pathways/${spotlight.id}`}
            className="reveal group mt-8 grid overflow-hidden rounded-3xl border border-teal/30 bg-gradient-to-l from-[#12343B] to-card transition hover:border-teal/60 hover:shadow-[0_30px_80px_-40px_rgba(56,167,180,0.5)] md:grid-cols-5"
          >
            <div className="relative flex min-h-[190px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_70%_30%,rgba(56,167,180,0.4),transparent_65%)] md:col-span-2">
              <Route className="h-16 w-16 text-teal-light/70" />
              <span className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-[#FABC05] px-3.5 py-1.5 text-xs font-black text-[#0D0D0D]">
                <Flame className="h-3.5 w-3.5" />
                {spotlight.note}
              </span>
            </div>
            <div className="p-8 md:col-span-3 md:p-10">
              <span className="kicker">اختيار وجيز الأول في هذا المجال</span>
              <h3 className="mt-3 text-2xl font-black leading-snug md:text-3xl">{spotlight.p.name}</h3>
              <p className="mt-3 max-w-lg text-sm leading-8 text-muted-foreground">{spotlight.p.transformation}</p>
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                <span>{spotlight.p.level}</span>
                <span className="text-white/20">•</span>
                <span>{weeksLabel(spotlight.p.durationWeeks)}</span>
                <span className="text-white/20">•</span>
                <span>{spotlight.p.weeklyHours}</span>
                <span className="text-white/20">•</span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-teal" />
                  {pathwayTrainers(spotlight.id).map((t) => t.name).join('، ')}
                </span>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#247B84] px-6 py-2.5 text-sm font-bold text-white transition group-hover:bg-[#1E666E]">
                افتح المسار
                <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* راويل المسارات — بطاقات أنحف وأنظف */}
      <p className="sr-only" aria-live="polite">
        {`يعرض ${railPathways.length} ${railPathways.length === 1 ? 'مسارا' : 'مسارات'} — اسحب بإصبعك أو استخدم أسهم لوحة المفاتيح للتنقل بينها`}
      </p>
      <div
        ref={pwRailRef}
        role="region"
        aria-roledescription="شريط بطاقات"
        aria-label="مسارات مختارات وجيز"
        tabIndex={0}
        onKeyDown={railKeys(pwRailRef)}
        className="scrollbar-hide mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 md:px-[max(1.25rem,calc((100vw-72rem)/2+1.25rem))]"
      >
        {railPathways.map(({ id, note, p }) => (
          <article
            key={id}
            className="group flex w-[280px] shrink-0 snap-start flex-col rounded-3xl border border-white/10 bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:border-teal/50 hover:shadow-[0_20px_60px_-30px_rgba(56,167,180,0.4)]"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#38A7B4]/10 px-3 py-1 text-xs font-bold text-teal-light">
                <Flame className="h-3.5 w-3.5" />
                {note}
              </span>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted-foreground">{pwCategory(id)}</span>
            </div>
            <h3 className="mt-4 text-lg font-bold leading-relaxed">{p.name}</h3>
            <div className="mt-2 text-xs leading-6 text-muted-foreground">
              {p.level} · {weeksLabel(p.durationWeeks)} · {p.weeklyHours}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] leading-5 text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0 text-teal" />
              {pathwayTrainers(id).map((t) => t.name).join('، ')}
            </div>
            <div className="mt-auto pt-5">
              <Link
                to={`/pathways/${id}`}
                className="block rounded-xl border border-teal/40 py-2.5 text-center text-sm font-semibold text-teal-light transition group-hover:bg-[#247B84] group-hover:text-white"
              >
                تفاصيل المسار
              </Link>
            </div>
          </article>
        ))}

        {/* بطاقة ختامية تعيد للتشخيص */}
        <Link
          to="/diagnostic"
          className="flex w-[280px] shrink-0 snap-start flex-col items-center justify-center rounded-3xl border border-dashed border-teal/30 bg-[#38A7B4]/5 p-6 text-center transition hover:border-teal/60 hover:bg-[#38A7B4]/10"
        >
          <Compass className="h-8 w-8 text-teal" />
          <p className="mt-4 font-bold leading-relaxed">لم تجد ما يناسبك؟</p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            التشخيص يطابقك مع مساراتنا المصممة — ويشرح لك لماذا.
          </p>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-light">
            ابدأ التشخيص
            <ArrowLeft className="h-4 w-4" />
          </span>
        </Link>
      </div>

      {/* راويل الدورات المختارة */}
      <div id="top-courses" className="mx-auto mt-12 max-w-6xl scroll-mt-24 px-5">
        <div className="reveal flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-2xl font-bold">
              <BookOpen className="h-6 w-6 text-amber-brand" />
              دورات مختارة بعناية
            </h3>
            <p className="mt-2 max-w-lg text-sm leading-7 text-muted-foreground">
              تعرف تماما ما تريد؟ خذ دورة واحدة وابدأ اليوم — وإن أكملت لاحقا لمسارها الكامل، خُصم ما دفعته من سعره.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => scroll(crRailRef, 'prev')} aria-label="السابق في الدورات"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:border-teal/50 hover:text-teal-light">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={() => scroll(crRailRef, 'next')} aria-label="التالي في الدورات"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:border-teal/50 hover:text-teal-light">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {`يعرض ${shownCourses.length} ${shownCourses.length === 1 ? 'دورة' : 'دورات'} — اسحب بإصبعك أو استخدم أسهم لوحة المفاتيح للتنقل بينها`}
      </p>
      <div
        ref={crRailRef}
        role="region"
        aria-roledescription="شريط بطاقات"
        aria-label="دورات مختارة من وجيز"
        tabIndex={0}
        onKeyDown={railKeys(crRailRef)}
        className="scrollbar-hide mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 md:px-[max(1.25rem,calc((100vw-72rem)/2+1.25rem))]"
      >
        {shownCourses.map(({ id, note, c }) => (
          <article
            key={id}
            className="group flex w-[270px] shrink-0 snap-start flex-col rounded-2xl border border-white/10 bg-card p-5 transition-all duration-200 hover:-translate-y-1 hover:border-teal/50 hover:shadow-[0_20px_60px_-30px_rgba(56,167,180,0.4)]"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#38A7B4]/10 px-3 py-1 text-[11px] font-bold text-teal-light">
                <Flame className="h-3 w-3" />
                {note}
              </span>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted-foreground">{c.category}</span>
            </div>
            <h4 className="mt-3 font-bold leading-relaxed">{c.name}</h4>
            <p className="mt-1 text-xs text-muted-foreground">من مسار «{c.pathwayName}» · {c.weeks} {c.weeks === 1 ? 'أسبوع' : 'أسابيع'}</p>
            {c.skill && (
              <span className="mt-3 w-fit rounded-full border border-teal/25 bg-[#38A7B4]/10 px-2.5 py-1 text-[11px] text-teal-light">
                {c.skill}
              </span>
            )}
            <div className="mt-auto pt-4">
              <button onClick={() => { track('course_viewed', { category: c.category }); setModalCourse(c) }} className="w-full cursor-pointer rounded-lg border border-white/15 py-2 text-xs font-semibold transition group-hover:border-teal/50 group-hover:text-teal-light">
                تفاصيل الدورة
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* روابط الكتالوج الكامل */}
      <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-center gap-3 px-5">
        <Link
          to="/pathways"
          className="inline-flex items-center gap-2 rounded-2xl border border-teal/40 px-6 py-3 text-sm font-bold text-teal-light transition hover:bg-[#247B84] hover:text-white"
        >
          تصفح كل المسارات
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Link
          to="/courses"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-3 text-sm font-bold text-muted-foreground transition hover:border-amber-brand/50 hover:text-amber-brand"
        >
          تصفح كل الدورات
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>

      {/* نافذة تفاصيل الدورة */}
      {modalCourse && (
        <CourseModal
          course={modalCourse}
          onClose={() => setModalCourse(null)}
          onBuy={(c) => navigate(`/pathways/${c.pathwayId}`)}
        />
      )}
    </section>
  )
}

/* ───────────────── FAQ ───────────────── */
function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="py-20 md:py-24">
      <div className="mx-auto max-w-3xl px-5">
        <div className="reveal text-center">
          <SectionLabel>أسئلة تصلنا كثيرا</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold md:text-4xl">قبل أن تسأل — أجبنا</h2>
        </div>
        <div className="mt-12 space-y-3">
          {faqs.map((f, i) => (
            <div key={i} className="reveal overflow-hidden rounded-2xl border border-white/10 bg-card transition hover:border-teal/30" style={{ transitionDelay: `${i * 60}ms` }}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                aria-controls={`faq-answer-${i}`}
                id={`faq-question-${i}`}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-right font-semibold"
              >
                {f.q}
                <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-teal-light transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`} />
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
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────────────── final CTA ───────────────── */
function FinalCta() {
  return (
    <section id="cta" className="relative overflow-hidden py-24 md:py-28">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#38A7B4]/10 to-transparent" />
      <div className="pointer-events-none absolute right-1/2 top-1/2 h-[420px] w-[420px] -translate-y-1/2 translate-x-1/2 rounded-full bg-[#38A7B4]/20 blur-[140px] animate-pulse-glow" />
      <div className="relative mx-auto max-w-3xl px-5 text-center">
        <h2 className="reveal text-3xl font-bold leading-snug md:text-5xl md:leading-tight">
          نسختك القادمة تستحق
          <br />
          <span className="text-teal-light">أكثر من دورة عشوائية.</span>
        </h2>
        <p className="reveal mx-auto mt-6 max-w-md leading-8 text-muted-foreground">
          امنحنا خمس دقائق من الصدق، نمنحك خريطة طريق كاملة.
        </p>
        <div className="reveal mt-9">
          <a
            href="#diagnostic"
            className="btn-teal px-10 py-5 text-lg shadow-[0_0_60px_-10px_#38A7B4]"
          >
            خذ وقفة صدق الآن
            <ArrowLeft className="h-5 w-5" />
          </a>
          <p className="mt-4 text-xs text-muted-foreground">مجاني · بدون حساب · إجاباتك تُحفظ على جهازك فقط</p>
        </div>
      </div>
    </section>
  )
}

/* ───────────────── partners (شعارات من موقع وجيز الأم — من المصدر المشترك) ───────────────── */
function Partners() {
  return (
    <section id="partners" className="py-14 md:py-16">
      <div className="mx-auto max-w-5xl px-5 text-center">
        <div className="reveal">
          <SectionLabel>شركاؤنا</SectionLabel>
          <h2 className="mt-4 text-2xl font-bold md:text-3xl">تحدث عنا الإعلام — وشركاء نجاح نفخر بهم</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
              أكاديمي وجيز امتداد لمنصة وجيز التي غطتها كبرى الوسائل الإعلامية.
          </p>
        </div>
        <div className="reveal mt-10 flex flex-wrap items-center justify-center gap-10 md:gap-16">
          {partnerLogos.map((p) => (
            <img
              key={p.name}
              src={p.src}
              alt={p.name}
              loading="lazy"
              className="h-10 w-auto opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0 md:h-12"
            />
          ))}
        </div>
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
      { label: 'وقفة صدق والتشخيص', to: '/diagnostic' },
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
      { label: 'شركاؤنا', to: '#partners' },
      { label: 'انضم كمدرب', to: '/contact' },
    ],
  },
  {
    title: 'الحلول',
    icon: Building2,
    links: [
      { label: 'للأفراد', to: '/pathways' },
      { label: 'للشركات', to: '/for-business' },
      { label: 'للجهات الحكومية', to: '/for-government' },
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

function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0A0A0A]">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal font-bold text-[#08272B]">و</div>
              <div className="font-bold">وجيز <span className="text-teal-light">أكاديمي</span></div>
            </div>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              منصة تفهم الإنسان قبل أن تقترح ما يتعلمه — من مجموعة وجيز wajeez.com
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-4 w-4 text-teal" />
              <span dir="ltr">{CONTACT.email}</span>
            </div>
          </div>
          {footerCols.map((col) => (
            <div key={col.title}>
              <div className="mb-4 flex items-center gap-2 font-bold">
                <col.icon className="h-4 w-4 text-teal" />
                {col.title}
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.to.startsWith('#') ? (
                      <a href={l.to} className="transition hover:text-teal-light">{l.label}</a>
                    ) : (
                      <Link to={l.to} className="transition hover:text-teal-light">{l.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 text-xs text-muted-foreground md:flex-row">
          <div>© 2026 أكاديمي وجيز — جميع الحقوق محفوظة</div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            صُنع بعناية — الفهم قبل البيع
          </div>
        </div>
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
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0D0D0D]/90 px-5 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-xl transition-transform duration-300 md:hidden ${visible ? 'translate-y-0' : 'translate-y-full'}`}
    >
      <a href="#diagnostic" className="btn-teal w-full py-3.5">
        خذ وقفة صدق — دقيقة واحدة
        <ArrowLeft className="h-4 w-4" />
      </a>
    </div>
  )
}

/* ───────────────── page ─────────────────
   الترتيب المعتمد: بطل واضح ← وقفة صدق ← كيف تعمل الرحلة ← شركاء (دليل ثقة مبكر)
   ← مخرجات التعلم ← ستة مسارات مميزة ← أربع دورات مميزة ← قصص حقيقية ← أسئلة ← دعوة أخيرة */
export default function Home() {
  useReveal()
  const topRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={topRef} dir="rtl" className="min-h-screen bg-background text-foreground">
      <SeoHead
        title="مسارك يبدأ من فهمك"
        description="أكاديمي وجيز — تشخيص تعليمي ذكي يفهم هدفك وواقعك، ثم يرسم لك مسارا واحدا مفسّرا بمدربين حقيقيين ومخرج عملي يثبت جاهزيتك."
        path="/"
      />
      <Nav />
      <div>
        <Hero />
        <DiagnosticTeaser />
        <HowItWorks />
        <Partners />
        <ImageBand />
        <Bestsellers />
        <Stories />
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

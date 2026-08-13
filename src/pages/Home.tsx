import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Sparkles, Compass, Route, BadgeCheck, BrainCircuit, Target,
  FileCheck, ShieldCheck, Quote, ChevronDown, Menu, X, ArrowLeft,
  Clock, User, Award, GraduationCap, Building2, Landmark,
  CheckCircle2, CalendarDays, Play, Flame, ChevronLeft, ChevronRight, BookOpen,
  Star, Users
} from 'lucide-react'
import { bestsellers, pathwayById } from '@/data/pathways'
import { bestsellerCourses, courseById, courseCategories, pathwayTrainers, type Course } from '@/data/courses'
import { faqs } from '@/data/siteContent'
import AuthGate from '@/components/AuthGate'
import CourseModal from '@/components/CourseModal'
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

/* ───────────────────────── data ───────────────────────── */
const stories = [
  {
    id: 'sara',
    tag: 'تصميم تجربة المستخدم',
    name: 'سارة',
    role: 'مصممة جرافيك — جدة',
    img: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=1200&q=80&auto=format&fit=crop',
    before: 'كانت سارة تقفز بين دورات متفرقة منذ سنتين، تتعلم كثيرا ولا يتغير شيء في ملف أعمالها.',
    turn: 'في التشخيص، ظهرت فجوتها الحقيقية بوضوح: ليست الأدوات، بل أبحاث المستخدم وبناء الرحلات.',
    pathway: 'مسار تجربة المستخدم الاحترافي',
    trainer: 'م. لينا الحربي',
    duration: '12 أسبوعا — 6 دورات — مختلط',
    output: 'ملف أعمال من 3 مشاريع حقيقية راجعها المدرب مشروعا بمشروع.',
    courses: [
      { name: 'أساسيات أبحاث المستخدم', output: 'أجرت 5 مقابلات مستخدمين حقيقية وحللتها بمنهجية واضحة.' },
      { name: 'بناء رحلات المستخدم والنماذج الأولية', output: 'صممت رحلة كاملة لتطبيق خدمات، اختُبرت مع مستخدمين فعليين.' },
      { name: 'ملف الأعمال الاحترافي', output: 'رتّبت مشاريعها الثلاثة في ملف يحكي قصة كل قرار تصميمي.' },
    ],
    result: 'بعد ثلاثة أشهر، لم تعد سارة تقول "أعرف التصميم" — صارت تُري عملها. قدّمت ملفها الجديد وبدأت أول مشروع استشاري مستقل لها.',
  },
  {
    id: 'mohammed',
    tag: 'تحليل البيانات',
    name: 'محمد',
    role: 'محاسب — الرياض',
    img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80&auto=format&fit=crop',
    before: 'كان محمد محاسبا يحلم بالانتقال إلى تحليل البيانات، لكن خريطة الطريق أمامه كانت ضبابية: من أين يبدأ؟',
    turn: 'حدّد التشخيص مستواه الحالي ووقته المتاح (4 ساعات أسبوعيا)، فرُسم له مسار لا يحرقه ولا يبطئه.',
    pathway: 'مسار تحليل البيانات للأعمال',
    trainer: 'د. فيصل العتيبي',
    duration: '16 أسبوعا — 8 دورات — مباشر',
    output: 'لوحة مؤشرات كاملة بُنيت على بيانات شركته الفعلية.',
    courses: [
      { name: 'أساسيات تحليل البيانات', output: 'انتقل من الجداول الجاهزة إلى بناء تحليله الخاص خطوة بخطوة.' },
      { name: 'SQL واستخراج البيانات', output: 'سحب بيانات شركته الفعلية بنفسه لأول مرة دون انتظار أحد.' },
      { name: 'لوحات المؤشرات التفاعلية', output: 'بنى لوحة المؤشرات التي صارت مرجع الإدارة الأسبوعي.' },
    ],
    result: 'في الربع التالي، صارت لوحة محمد هي مرجع الإدارة في اجتماعها الأسبوعي — وتوسّع دوره رسميا ليشمل التقارير التحليلية.',
  },
  {
    id: 'nouf',
    tag: 'اكتشاف الاتجاه',
    name: 'نوف',
    role: 'طالبة جامعية — الدمام',
    img: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&q=80&auto=format&fit=crop',
    before: 'وصلت نوف إلى وجيز بسؤال واحد صادق: "لا أعرف أي مجال يناسبني أصلا."',
    turn: 'لم يستعجلها التشخيص؛ فتح أسئلة استكشاف حتى اتضح ميلها: التنظيم، والتفاصيل، والتعامل مع الناس.',
    pathway: 'مسار أساسيات إدارة المشاريع (تمهيدي)',
    trainer: 'أ. ريم القحطاني',
    duration: '8 أسابيع — 4 دورات — مسجل + لقاءات',
    output: 'خطة مشروع تخرجها الجامعي، مبنية بمنهجية احترافية.',
    courses: [
      { name: 'أساسيات إدارة المشاريع', output: 'فهمت دورة حياة المشروع ورسمت أول خطة لها بمعايير مهنية.' },
      { name: 'إدارة الوقت وأولويات الطالب', output: 'نظمت فصلها الدراسي بجدول واقعي التزمت به حتى النهاية.' },
    ],
    result: 'أنهت نوف المسار وهي تعرف أخيرا لماذا اختارت طريقها — ومشروع تخرجها حاز أعلى تقييم في دفعتها.',
  },
  {
    id: 'khaled',
    tag: 'القطاع الحكومي',
    name: 'خالد',
    role: 'موظف خدمة جمهور — الرياض',
    img: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=1200&q=80&auto=format&fit=crop',
    before: 'كان خالد يستقبل عشرات المراجعين يوميا في جهته الحكومية، ويشعر أن عمله روتين لا يُقدَّر ولا يتطور.',
    turn: 'رشّحته جهته ضمن برنامج التدريب الحكومي مع أكاديمي وجيز، وكشف التشخيص أن فجوته ليست المعرفة بل أدوات التعامل تحت الضغط.',
    pathway: 'مسار موظف خدمة الجمهور المتميز (ترشيح حكومي)',
    trainer: 'أ. هند العمري',
    duration: '6 أسابيع — 4 دورات — شعبة حكومية مباشرة',
    output: 'دليل تعامل شخصي مع الحالات الصعبة، طبّقه فعليا على نافذته.',
    courses: [
      { name: 'فن خدمة الجمهور', output: 'تحول من "موظف شباك" إلى سفير لجهته عند كل مراجع.' },
      { name: 'إدارة المشاعر والتعامل تحت الضغط', output: 'تعلم تفريغ التوتر وصار زميله الأهدأ في أصعب الأيام.' },
      { name: 'التواصل الحكومي الفعال', output: 'صاغ ردودا رسمية واضحة خفّضت شكاوى المراجعين المكررة.' },
    ],
    result: 'بعد شهرين، اختير خالد موظف الربع في جهته، وكتب مديره في التقييم: "تحوّل ملموس في التعامل مع المراجعين — نموذج يُحتذى."',
  },
  {
    id: 'team',
    tag: 'حلول الشركات',
    name: 'فريق القيادات الجديدة',
    role: 'شركة لوجستية — 14 مديرا',
    img: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80&auto=format&fit=crop',
    before: 'رقّت الشركة 14 موظفا إلى مناصب قيادية دفعة واحدة، ثم اكتشفت أن الترقية وحدها لا تصنع قائدا.',
    turn: 'شخّصت وجيز فجوات الفريق كاملا، فوجدتها متقاربة: إدارة الوقت، والتغذية الراجعة، والمحادثات الصعبة.',
    pathway: 'مسار قيادة الفرق للمدراء الجدد (دفعة خاصة)',
    trainer: 'م. سلطان الدوسري',
    duration: '10 أسابيع — 6 دورات — شعبة مباشرة',
    output: 'خطة قيادة فردية لكل مدير، قيّمها المدرب مع كل واحد على حدة.',
    courses: [
      { name: 'أساسيات قيادة الفرق', output: 'انتقل كل مدير من "مشرف مهام" إلى قائد يملك رؤية لفريقه.' },
      { name: 'التغذية الراجعة والمحادثات الصعبة', output: 'تدرّبوا على محادثات حقيقية كانوا يؤجلونها منذ شهور.' },
      { name: 'إدارة الوقت القيادي', output: 'خرج كل مدير بنظام أسبوعي يحمي وقته للأهم لا الأعجل.' },
    ],
    result: 'بعد دورتين، قالت مديرة الموارد البشرية جملة واحدة تلخص كل شيء: "لأول مرة، الاجتماعات عندنا تنتهي بقرارات."',
  },
]

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
  const [authOpen, setAuthOpen] = useState(false)
  const [userName, setUserName] = useState<string | null>(readUserName)
  const links = [
    { label: 'وقفة صدق', href: '#diagnostic' },
    { label: 'كيف نعمل', href: '#how' },
    { label: 'قصص المتعلمين', href: '#stories' },
    { label: 'مختارات وجيز', href: '#bestsellers' },
    { label: 'الأسئلة', href: '#faq' },
  ]
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#0D0D0D]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="#top" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal text-white font-bold text-lg">و</div>
          <div className="leading-tight">
            <div className="font-bold">وجيز <span className="text-teal-light">أكاديمي</span></div>
            <div className="text-[10px] text-muted-foreground">من مجموعة wajeez.com</div>
          </div>
        </a>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition hover:text-teal-light">{l.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <CurrencySwitcher />
          {userName ? (
            <Link to="/student" className="hidden items-center gap-2 rounded-xl border border-teal/40 bg-[#38A7B4]/10 px-4 py-2 text-sm font-semibold text-teal-light transition hover:bg-[#38A7B4]/20 md:inline-flex">
              <User className="h-4 w-4" />
              {userName}
            </Link>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="hidden items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:border-teal/50 hover:text-teal-light md:inline-flex"
            >
              <User className="h-4 w-4" />
              دخول
            </button>
          )}
          <a
            href="#diagnostic"
            className="hidden rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-deep md:inline-block"
          >
            جرّب وقفة صدق
          </a>
          <button className="md:hidden text-foreground" onClick={() => setOpen(!open)} aria-label="القائمة">
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-white/5 bg-[#0D0D0D] px-5 py-4 md:hidden">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2.5 text-muted-foreground hover:text-teal-light">
              {l.label}
            </a>
          ))}
          {userName ? (
            <Link to="/student" onClick={() => setOpen(false)} className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-teal/40 px-5 py-3 font-semibold text-teal-light">
              <User className="h-4 w-4" /> {userName}
            </Link>
          ) : (
            <button
              onClick={() => { setOpen(false); setAuthOpen(true) }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-semibold text-muted-foreground"
            >
              <User className="h-4 w-4" /> دخول / إنشاء حساب
            </button>
          )}
          <a href="#diagnostic" onClick={() => setOpen(false)} className="mt-2 block rounded-xl bg-teal px-5 py-3 text-center font-semibold text-white">
            جرّب وقفة صدق
          </a>
          <div className="mt-3 flex justify-center">
            <CurrencySwitcher compact />
          </div>
        </nav>
      )}
      {authOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
          onClick={() => setAuthOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
            <AuthGate
              message="سجّل دخولك أو أنشئ حسابك — ليُحفظ مسارك وتشخيصك وشهاداتك في مكان واحد"
              onDone={() => { setAuthOpen(false); setUserName(readUserName()) }}
            />
          </div>
        </div>
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
            className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal px-8 py-4 font-semibold text-white shadow-[0_0_40px_-8px_#38A7B4] transition hover:bg-teal-deep sm:w-auto"
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

  return (
    <section id="diagnostic" className="relative py-20 md:py-28">
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
                <p className="mx-auto mt-4 max-w-md leading-8 text-muted-foreground">
                  الوقفة أدت وظيفتها. الآن يبدأ العمل الحقيقي: تشخيص كامل يفهم قصتك ويستنتج مستواك
                  من مواقفك الحقيقية — ثم يرسم لك مسارا مفسّرا تستطيع تخصيصه.
                </p>
                <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link to="/diagnostic" className="inline-flex items-center gap-2 rounded-2xl bg-teal px-8 py-4 font-semibold text-white transition hover:bg-teal-deep">
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
    <section id="how" className="border-y border-white/5 bg-white/[0.02] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="reveal text-center">
          <SectionLabel>كيف تسير رحلتك</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold md:text-4xl">أربع خطوات — لا أكثر</h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="reveal group relative rounded-3xl border border-white/10 bg-card p-7 transition hover:border-teal/40" style={{ transitionDelay: `${i * 90}ms` }}>
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
      <div className="scrollbar-hide mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 md:px-[max(1.25rem,calc((100vw-72rem)/2+1.25rem))]">
        {stories.map((s) => (
          <button
            key={s.id}
            onClick={() => setOpen(s)}
            className="group flex w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-white/10 bg-card text-right transition hover:border-teal/40 hover:shadow-[0_20px_60px_-30px_rgba(56,167,180,0.4)]"
          >
            <div className="relative h-36 overflow-hidden">
              <img
                src={s.img}
                alt={`قصة ${s.name}`}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
              <span className="absolute bottom-3 right-4 rounded-full bg-teal/90 px-3 py-1 text-[11px] font-bold text-white">{s.tag}</span>
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm" onClick={() => setOpen(null)}>
          <div className="mx-auto my-8 max-w-3xl px-4 pb-8">
            <div
              className="story-fade overflow-hidden rounded-3xl border border-white/10 bg-card"
              onClick={(e) => e.stopPropagation()}
            >
              {/* صورة القصة */}
              <div className="relative h-56 overflow-hidden md:h-72">
                <img src={open.img} alt={`قصة ${open.name}`} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                <button
                  onClick={() => setOpen(null)}
                  aria-label="إغلاق القصة"
                  className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white/80 backdrop-blur transition hover:bg-black/70 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="absolute bottom-4 right-6 flex items-center gap-3">
                  <span className="rounded-full bg-teal/90 px-4 py-1.5 text-sm font-bold text-white">{open.tag}</span>
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
                  <div className="flex items-center gap-2 text-xs text-teal-light"><Route className="h-4 w-4" /> المسار الذي سلكه</div>
                  <div className="mt-2 font-bold leading-7">{open.pathway}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{open.duration}</div>
                </div>
                <div className="bg-card p-6">
                  <div className="flex items-center gap-2 text-xs text-teal-light"><User className="h-4 w-4" /> المدرب</div>
                  <div className="mt-2 font-bold">{open.trainer}</div>
                  <div className="mt-1 text-xs text-muted-foreground">رافقه في التقييم والمتابعة طوال المسار</div>
                </div>
                <div className="bg-card p-6">
                  <div className="flex items-center gap-2 text-xs text-teal-light"><FileCheck className="h-4 w-4" /> المخرج العملي</div>
                  <div className="mt-2 font-bold leading-7">{open.output}</div>
                </div>
              </div>

              {/* دورات القصة ومخرجاتها */}
              <div className="border-t border-white/5 p-8 md:px-10">
                <div className="flex items-center gap-2 text-xs text-teal-light">
                  <BookOpen className="h-4 w-4" /> الدورات التي أخذها {open.name} — وماذا خرج من كل واحدة
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
          </div>
        </div>
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

  const shownPathways = bestsellers
    .map((b) => ({ ...b, p: pathwayById(b.id)! }))
    .filter((b) => b.p && (cat === 'الكل' || pwCategory(b.p.id) === cat))
  const shownCourses = bestsellerCourses
    .map((b) => ({ ...b, c: courseById(b.id)! }))
    .filter((b) => b.c && (cat === 'الكل' || b.c.category === cat))
  const spotlight = shownPathways[0]
  const railPathways = shownPathways.slice(1)

  return (
    <section id="bestsellers" className="py-16 md:py-20">
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

        {/* فلاتر المجالات */}
        <div className="reveal mt-8 flex flex-wrap gap-2">
          {courseCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                cat === c
                  ? 'border-teal bg-teal text-white shadow-[0_0_24px_-6px_#38A7B4]'
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
                <span>{spotlight.p.durationWeeks} أسبوعا</span>
                <span className="text-white/20">•</span>
                <span>{spotlight.p.weeklyHours}</span>
                <span className="text-white/20">•</span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-teal" />
                  {pathwayTrainers(spotlight.id).map((t) => t.name).join('، ')}
                </span>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-teal px-6 py-2.5 text-sm font-bold text-white transition group-hover:bg-teal-deep">
                افتح المسار
                <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* راويل المسارات — بطاقات أنحف وأنظف */}
      <div
        ref={pwRailRef}
        className="scrollbar-hide mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 md:px-[max(1.25rem,calc((100vw-72rem)/2+1.25rem))]"
      >
        {railPathways.map(({ id, note, p }) => (
          <article
            key={id}
            className="group flex w-[280px] shrink-0 snap-start flex-col rounded-3xl border border-white/10 bg-card p-6 transition hover:border-teal/40 hover:shadow-[0_20px_60px_-30px_rgba(56,167,180,0.4)]"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FABC05]/10 px-3 py-1 text-xs font-bold text-amber-brand">
                <Flame className="h-3.5 w-3.5" />
                {note}
              </span>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted-foreground">{pwCategory(id)}</span>
            </div>
            <h3 className="mt-4 text-lg font-bold leading-relaxed">{p.name}</h3>
            <div className="mt-2 text-xs leading-6 text-muted-foreground">
              {p.level} · {p.durationWeeks} أسبوعا · {p.weeklyHours}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] leading-5 text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0 text-teal" />
              {pathwayTrainers(id).map((t) => t.name).join('، ')}
            </div>
            <div className="mt-auto pt-5">
              <Link
                to={`/pathways/${id}`}
                className="block rounded-xl border border-teal/40 py-2.5 text-center text-sm font-semibold text-teal-light transition group-hover:bg-teal group-hover:text-white"
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
      <div
        ref={crRailRef}
        className="scrollbar-hide mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 md:px-[max(1.25rem,calc((100vw-72rem)/2+1.25rem))]"
      >
        {shownCourses.map(({ id, note, c }) => (
          <article
            key={id}
            className="group flex w-[270px] shrink-0 snap-start flex-col rounded-2xl border border-white/10 bg-card p-5 transition hover:border-amber-brand/40"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#FABC05]/10 px-3 py-1 text-[11px] font-bold text-amber-brand">
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
              <button onClick={() => setModalCourse(c)} className="w-full cursor-pointer rounded-lg border border-white/15 py-2 text-xs font-semibold transition group-hover:border-teal/50 group-hover:text-teal-light">
                تفاصيل الدورة
              </button>
            </div>
          </article>
        ))}
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

/* ───────────────── numbers ───────────────── */
const numbers = [
  { value: 'قصتك', label: 'أولا قبل أي دورة', sub: 'تشخيص يفهم هدفك وواقعك قبل أن يوصي' },
  { value: 'مخرج', label: 'حقيقي يُراجع', sub: 'القيمة بالإنجاز والإثبات، لا بساعات المشاهدة' },
  { value: '3', label: 'أطر علمية موثوقة', sub: 'RIASEC للميول · O*NET وESCO للمهارات · DigComp للجاهزية الرقمية' },
  { value: '4', label: 'خطوات للرحلة', sub: 'فهم، توصية، تعلم، إثبات' },
]

function Numbers() {
  return (
    <section className="border-y border-white/5 bg-white/[0.02] py-16 md:py-20">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-5 md:grid-cols-4">
        {numbers.map((n, i) => (
          <div key={n.label} className="reveal text-center" style={{ transitionDelay: `${i * 80}ms` }}>
            <div className="text-4xl font-bold text-teal-light md:text-5xl">{n.value}</div>
            <div className="mt-2 font-semibold">{n.label}</div>
            <div className="mt-1 text-xs leading-6 text-muted-foreground">{n.sub}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ───────────────── why different ───────────────── */
const why = [
  {
    icon: BrainCircuit,
    title: 'الفهم قبل البيع',
    text: 'لن يصلك سعر أو رابط دفع قبل أن نفهم هدفك. التشخيص أولا — دائما.',
  },
  {
    icon: ShieldCheck,
    title: 'توصية تشرح نفسها',
    text: 'كل توصية تأتي مع "لماذا" ودرجة ثقة. وعند الشك، مستشار بشري يقرر معك — لا خوارزمية متسرعة.',
  },
  {
    icon: BadgeCheck,
    title: 'القيمة بالمخرج',
    text: 'لا نحتفل بعدد ساعات المشاهدة. نحتفل بمشروع سلّمته ومهارة أثبتّها.',
  },
]

function Why() {
  return (
    <section id="why" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="reveal text-center">
          <SectionLabel>لماذا وجيز مختلفة</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold md:text-4xl">لا نبيع دورات. نبني رحلات.</h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {why.map((w, i) => (
            <div key={w.title} className="reveal rounded-3xl border border-white/10 bg-card p-8 transition hover:border-teal/40" style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#38A7B4]/12 text-teal">
                <w.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold">{w.title}</h3>
              <p className="mt-3 leading-8 text-muted-foreground">{w.text}</p>
            </div>
          ))}
        </div>

        {/* honesty strip */}
        <div className="reveal mt-10 rounded-3xl border border-amber-brand/25 bg-[#FABC05]/5 p-8 text-center md:p-10">
          <p className="mx-auto max-w-2xl text-lg leading-9 md:text-xl md:leading-10">
            <span className="font-bold text-amber-brand">وعد الشفافية:</span>{' '}
            لا نعدك بوظيفة ولا بدخل. نعدك بمسار مدروس، ومهارات قابلة للقياس،
            ومشاريع حقيقية تثبت جاهزيتك.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ───────────────── pricing clarity ───────────────── */
/* ───────────────── FAQ ───────────────── */
function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="py-20 md:py-28">
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
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-right font-semibold"
              >
                {f.q}
                <ChevronDown className={`h-5 w-5 shrink-0 text-teal-light transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              <div className={`grid transition-all duration-300 ${open === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
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
    <section id="cta" className="relative overflow-hidden py-24 md:py-32">
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
            className="inline-flex items-center gap-2 rounded-2xl bg-teal px-10 py-5 text-lg font-bold text-white shadow-[0_0_60px_-10px_#38A7B4] transition hover:bg-teal-deep"
          >
            جرّب خمسة أسئلة الآن
            <ArrowLeft className="h-5 w-5" />
          </a>
          <p className="mt-4 text-xs text-muted-foreground">مجاني · بدون حساب · إجاباتك تُحفظ وتُكمل معك للتشخيص الكامل</p>
        </div>
      </div>
    </section>
  )
}

/* ───────────────── partners (من موقع وجيز الأم) ───────────────── */
const partnerLogos = [
  { name: 'BBC', src: 'https://wajeez.com/_next/image?url=%2Fassets%2Fimages%2Fbbc-dark.png&w=256&q=75' },
  { name: 'Forbes', src: 'https://wajeez.com/_next/image?url=%2Fassets%2Fimages%2Fforbes-dark.png&w=256&q=75' },
  { name: 'صحيفة الوطن', src: 'https://wajeez.com/_next/image?url=%2Fassets%2Fimages%2Falwatan-dark.png&w=256&q=75' },
]

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

/* ───────────────── آراء المستخدمين الحقيقية (من موقع وجيز) ───────────────── */
const reviews = [
  { name: 'أحمد سدر', text: 'تطبيق وجيز غيّر طريقة تفكيري في استغلال الوقت. أستمع يوميا أثناء المشي أو القيادة، وأشعر أنني أتعلم بدون مجهود.' },
  { name: 'نورة الخالدي', text: 'الاشتراك المدفوع يستحق كل ريال. فتحت لي الأبواب على مكتبة ضخمة من المعرفة خلال دقائق فقط.' },
  { name: 'خالد جمال', text: 'كنت أظن أنني لا أملك وقتا للقراءة، لكن مع وجيز صارت المعرفة ترافقني أينما ذهبت.' },
  { name: 'سامر الخطيب', text: 'وجيز ساعدني أطور نفسي مهنيا وشخصيا، وصار جزءا من روتيني الصباحي.' },
  { name: 'عبدالله', text: 'أحببت خاصية المسارات، فهي تتيح لي التعلم المنهجي في مجالات محددة مثل القيادة أو التفكير النقدي.' },
  { name: 'راكان', text: 'من خلال وجيز، اكتشفت كتبا كنت أجهلها، واستفدت من أفكار ملهمة غيّرت بعض قراراتي.' },
  { name: 'تركي بدر', text: 'وجود التطبيق على هاتفي أعطاني إحساسا بأنني أستثمر وقتي حتى في الدقائق الضائعة.' },
  { name: 'مها زياد', text: 'وجيز ليس مجرد تطبيق، بل أسلوب حياة جديد لمن يحب التطوير والمعرفة.' },
  { name: 'راشد جميل', text: 'الملخصات تلامس جوهر الكتب فعلا، وتحفزني أحيانا لقراءة النسخة الكاملة.' },
]

function Reviews() {
  return (
    <section className="border-t border-white/5 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="reveal text-center">
          <SectionLabel>ماذا يقول مستخدمو تطبيق وجيز</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold md:text-4xl">تجربتهم مع علامة وجيز</h2>
          <p className="mx-auto mt-4 max-w-xl leading-8 text-muted-foreground">
            من تقييمات مستخدمي تطبيق وجيز على المتجرين — عن تجربتهم مع العلامة.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {reviews.map((r, i) => (
            <figure key={r.name} className="reveal rounded-3xl border border-white/10 bg-card p-6 transition hover:border-teal/40" style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
              <div className="flex items-center gap-1 text-amber-brand">
                {[...Array(5)].map((_, s) => <Star key={s} className="h-4 w-4 fill-current" />)}
              </div>
              <blockquote className="mt-4 text-sm leading-8 text-foreground/90">"{r.text}"</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-teal/15 text-sm font-bold text-teal-light">
                  {r.name.charAt(0)}
                </span>
                <span className="text-sm font-semibold">{r.name}</span>
              </figcaption>
            </figure>
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
      { label: 'مختارات وجيز', to: '#bestsellers' },
      { label: 'الدورات المنفردة', to: '#top-courses' },
      { label: 'وقفة صدق والتشخيص', to: '#diagnostic' },
      { label: 'قصص المتعلمين', to: '#stories' },
      { label: 'بوابة الطالب', to: '/student' },
      { label: 'التحقق من شهادة', to: '/verify' },
    ],
  },
  {
    title: 'عن وجيز',
    icon: User,
    links: [
      { label: 'من نحن', to: '/p/about' },
      { label: 'المدربون والمستشارون', to: '/p/about' },
      { label: 'شركاؤنا', to: '#partners' },
      { label: 'انضم كمدرب', to: '/p/contact' },
    ],
  },
  {
    title: 'الحلول',
    icon: Building2,
    links: [
      { label: 'للأفراد', to: '#bestsellers' },
      { label: 'للشركات', to: '/p/contact' },
      { label: 'للجهات الحكومية', to: '/p/contact' },
      { label: 'طلب عرض مؤسسي', to: '/p/contact' },
    ],
  },
  {
    title: 'الدعم',
    icon: Landmark,
    links: [
      { label: 'تواصل معنا', to: '/p/contact' },
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
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal font-bold text-white">و</div>
              <div className="font-bold">وجيز <span className="text-teal-light">أكاديمي</span></div>
            </div>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              منصة تفهم الإنسان قبل أن تقترح ما يتعلمه — من مجموعة وجيز wajeez.com
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-4 w-4 text-teal" />
              أقرب شعبة تبدأ قريبا — احجز تشخيصك اليوم
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

/* ───────────────── page ───────────────── */
export default function Home() {
  useReveal()
  const topRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={topRef} dir="rtl" className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <DiagnosticTeaser />
        <HowItWorks />
        <ImageBand />
        <Stories />
        <Bestsellers />
        <Numbers />
        <Partners />
        <Why />
        <Reviews />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

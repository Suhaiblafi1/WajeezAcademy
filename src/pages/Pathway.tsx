import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowRight,
  CalendarClock,
  Clock3,
  Route as RouteIcon,
  Gift,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  CreditCard,
  User,
  UserCheck,
  FileText,
  MonitorPlay,
  Headphones,
  ClipboardCheck,
  FolderKanban,
  BadgeCheck,
  BarChart3,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AuthGate from "@/components/AuthGate";
import AdvisorContact from "@/components/AdvisorContact";
import CourseJourney from "@/components/CourseJourney";
import Modal from "@/components/Modal";
import { pathwayById } from "@/data/pathways";
import { courseById, pathwayCourses, pathwayDelivery, coursePriceOf, pathwayPriceFor, pathwayTrainers, courseTrainer, weeksLabel } from "@/data/courses";
import { GOAL_LABELS, GAP_LABELS, OBSTACLE_TO_GAP } from "@/data/diagnostic";
import { grantEnrollment } from "@/services/access";
import { useCurrency, usePriceFormatter, CURRENCIES, setCurrency, type CurrencyCode } from "@/services/currency";
import { track } from "@/services/analytics";
import { usePublishedContent } from "@/services/public-content";
import SeoHead from "@/components/SeoHead";
import EcosystemNote from "@/components/EcosystemNote";

/* اسم المستخدم — يدعم الصيغتين: JSON الجديدة والنص القديم، ويحترم انتهاء الجلسة */
function readUserName(): string | null {
  const raw = localStorage.getItem("wajeez_user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { name?: string; exp?: number };
    if (typeof parsed.exp === "number" && Date.now() > parsed.exp) {
      localStorage.removeItem("wajeez_user");
      return null;
    }
    return parsed.name ?? raw;
  } catch {
    return raw;
  }
}

/* ─────────── المستشارون حسب المجال ─────────── */
const ADVISORS: Record<string, { name: string; title: string }> = {
  FND: { name: "أ. ريم القحطاني", title: "مستشارة المسارات التأسيسية" },
  STU: { name: "أ. ريم القحطاني", title: "مستشارة الجاهزية المهنية" },
  CAREER: { name: "أ. ريم القحطاني", title: "مستشارة التحول المهني" },
  EMP: { name: "د. فيصل العتيبي", title: "مستشار تطوير الموظفين" },
  GOV: { name: "م. سلطان الدوسري", title: "مستشار القطاع الحكومي" },
  BIZ: { name: "م. لينا الحربي", title: "مستشارة ريادة الأعمال" },
  FREE: { name: "م. لينا الحربي", title: "مستشارة العمل الحر" },
  LEAD: { name: "م. سلطان الدوسري", title: "مستشار القيادة" },
  FAM: { name: "أ. ريم القحطاني", title: "مستشارة المسارات الأسرية" },
  WELL: { name: "أ. ريم القحطاني", title: "مستشارة التركيز والرفاه" },
}
// قناة مراسلة المستشار تُدار مركزيا عبر مكوّن AdvisorContact وبيانات CONTACT

const PERSONA_LABELS: Record<string, string> = {
  student: "طالب يستعد لسوق العمل", graduate: "خريج جديد يبحث عن فرصته الأولى",
  employee: "موظف يطمح للأفضل", entrepreneur: "رائد أعمال يبني مشروعه",
  family: "والد/والدة يقود تعلم أسرته", unsure: "مستكشف يبحث عن اتجاهه",
}
const DAY_LABELS: Record<string, string> = {
  meetings: "يومك مزدحم بالاجتماعات والمهام", studying: "يومك بين المحاضرات والواجبات",
  job_hunting: "يومك يدور حول البحث عن فرصة", clients: "يومك مع عملائك ومشروعك",
  home_kids: "يومك مليء بالتزامات البيت والأطفال", routine_meaning: "تبحث عن معنى أكبر في روتينك",
}
const DATE_LABELS: Record<string, string> = { soon: "خلال شهر إلى 3 أشهر", mid: "خلال 3 إلى 6 أشهر", year: "خلال سنة" }

/* ─────────── نافذة الدفع (Stripe) ─────────── */
function StripeCheckout({
  title,
  amount,
  onSuccess,
  onClose,
}: {
  title: string;
  amount: number;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [card, setCard] = useState("");
  const [processing, setProcessing] = useState(false);
  const cur = useCurrency();
  const fmt = usePriceFormatter();
  /* فتح نافذة الدفع = بدء عملية شراء */
  useEffect(() => { track("checkout_started"); }, []);
  const pay = () => {
    if (card.replace(/\s/g, "").length < 12) return;
    setProcessing(true);
    window.setTimeout(onSuccess, 1600);
  };
  return (
    <Modal onClose={onClose} label={`إتمام الدفع: ${title}`} panelClassName="w-full max-w-md">
      <div className="story-fade rounded-3xl border border-white/10 bg-[#121B1D] p-7">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-black">
            <CreditCard className="h-5 w-5 text-[#6EC7D1]" />
            دفع آمن عبر Stripe
          </h3>
          <button onClick={onClose} aria-label="إغلاق نافذة الدفع" className="grid h-11 w-11 place-items-center rounded-full text-white/40 transition hover:bg-white/5 hover:text-white">✕</button>
        </div>
        <p className="mt-2 text-sm text-white/55">{title}</p>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-white/60">الإجمالي</span>
            <span className="text-3xl font-black text-[#FABC05]">{fmt(amount)}</span>
          </div>
          {cur.code !== "USD" && (
            <p className="mt-1 text-left text-[11px] text-white/40">يعادل {amount}$ — التحويل بسعر ثابت للعرض</p>
          )}
          {/* عملة الدفع — تُختار هنا فقط لحظة الدفع، والافتراضي دينار أردني */}
          <label className="mt-3 flex items-center justify-between gap-3 border-t border-white/5 pt-3 text-[11px] text-white/50">
            <span>عملة الدفع</span>
            <select
              aria-label="عملة الدفع"
              value={cur.code}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="cursor-pointer rounded-lg border border-white/15 bg-transparent px-2 py-1.5 text-xs font-bold text-white/80 outline-none [&>option]:bg-[#121B1D]"
            >
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
                <option key={code} value={code}>{CURRENCIES[code].label} ({CURRENCIES[code].symbol})</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 space-y-3">
          <input
            value={card}
            onChange={(e) => setCard(e.target.value.replace(/[^\d]/g, "").replace(/(.{4})/g, "$1 ").trim())}
            placeholder="4242 4242 4242 4242"
            maxLength={19}
            dir="ltr"
            className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-left text-sm placeholder:text-white/30 focus:border-[#6EC7D1] focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="MM / YY" dir="ltr" maxLength={7}
              className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-left text-sm placeholder:text-white/30 focus:border-[#6EC7D1] focus:outline-none" />
            <input placeholder="CVC" dir="ltr" maxLength={4}
              className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-left text-sm placeholder:text-white/30 focus:border-[#6EC7D1] focus:outline-none" />
          </div>
        </div>
        <Button
          onClick={pay}
          disabled={processing || card.replace(/\s/g, "").length < 12}
          className="mt-5 h-12 w-full rounded-xl bg-[#635BFF] font-black text-white hover:bg-[#635BFF]/85"
        >
          {processing ? "جارٍ تأكيد الدفع…" : `ادفع ${fmt(amount)} الآن`}
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-white/40">
          <ShieldCheck className="h-3.5 w-3.5" />
          تشفير كامل · ستصلك رسالة تأكيد على بريدك فور نجاح الدفع
        </p>
      </div>
    </Modal>
  );
}

/* ─────────── الصفحة ─────────── */
export default function PathwayPage() {
  usePublishedContent();
  const { id } = useParams();
  const navigate = useNavigate();
  const pathway = pathwayById(id ?? "");
  const [user, setUser] = useState<string | null>(readUserName);
  const [checkout, setCheckout] = useState<{ title: string; amount: number; kind: "pathway" | "course" | "courses"; courseId?: string; courseIds?: string[] } | null>(null);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const fmt = usePriceFormatter();

  /* تتبع مشاهدة صفحة المسار — بلا بيانات شخصية */
  useEffect(() => {
    if (pathway) track("pathway_viewed", { sector: pathway.sector });
  }, [pathway]);

  /* تخصيصه المحفوظ من صفحة التشخيص */
  const custom = useMemo(() => {
    try {
      const c = JSON.parse(sessionStorage.getItem("wajeez_custom") ?? "null");
      return c && c.pathwayId === pathway?.id ? c as { chosenIds: string[]; giftId: string | null } : null;
    } catch { return null; }
  }, [pathway?.id]);

  const courseIds = custom?.chosenIds ?? (pathway ? pathwayCourses[pathway.id] ?? [] : []);
  const pathwayCoursesList = courseIds.map((cid) => courseById(cid)!).filter(Boolean);
  const separateCost = pathwayCoursesList.reduce((s, c) => s + coursePriceOf(c), 0);
  // التسعير المتدرج: ٤ دورات = 500$ · ٥ = 550$ · ٦+ = 600$
  const pathwayTotal = pathwayPriceFor(courseIds.length || 6);
  const savingPct = separateCost > pathwayTotal ? Math.round((1 - pathwayTotal / separateCost) * 100) : 0;

  /* تقريره الشخصي من إجابات التشخيص */
  const report = useMemo(() => {
    try {
      const a = JSON.parse(sessionStorage.getItem("wajeez_diag_answers") ?? "null");
      if (!a) return null;
      const lines: string[] = [];
      if (a.persona) lines.push(`أنت ${PERSONA_LABELS[a.persona] ?? "متعلم طموح"}، و${DAY_LABELS[a.day_story] ?? "يومك مليء"}.`);
      const goal = a.reconcile_goal ?? a.confirm_goal ?? a.goal;
      if (goal) lines.push(`هدفك الذي صرّحت به: ${GOAL_LABELS[goal] ?? goal}${a.second_goal && a.second_goal !== "none" ? ` — ومعه هدف ثانٍ: ${GOAL_LABELS[a.second_goal]}` : ""}. هذا الوضوح نعمة، وكثيرون يبدأون دونه.`);
      const gaps = (a.sk_gaps ?? "").split(",").filter((g: string) => g && g !== "none");
      const obstacleGaps = (a.emp_obstacle ?? "").split(",").map((o: string) => OBSTACLE_TO_GAP[o]).filter(Boolean);
      const allGaps: string[] = [...new Set([...gaps, ...obstacleGaps])] as string[];
      if (allGaps.length) lines.push(`أوجه النمو عندك واضحة: ${allGaps.map((g) => GAP_LABELS[g]).filter(Boolean).join("، ")} — وهذا المسار مصمم ليعالجها واحدة واحدة.`);
      else lines.push("مهاراتك الأساسية متزنة، وهذا يعني أن المسار سينقلك مباشرة إلى مستوى التطبيق لا التأسيس.");
      if (a.target_date) lines.push(`موعدك الذي حددته (${DATE_LABELS[a.target_date] ?? a.target_date}) قاد اختيار إيقاع هذا المسار وطوله — لا إجهاد ولا بطء ممل.`);
      if (a.learn_lang === "arabic") lines.push("ولأن راحتك في العربية، كل محتوى هذا المسار يُقدَّم بالعربية الواضحة.");
      if (a.learn_lang === "english_ok") lines.push("وراحتك في الإنجليزية ميزة إضافية — ستفتح لك مصادر المسار العالمية بلا حاجز.");
      if (a.emp_moment) lines.push(`والموقف الذي حكيته لنا: «${String(a.emp_moment).slice(0, 140)}» — مدربو هذا المسار يقرؤونه قبل أول لقاء ليعرفوا من أين يبدؤون معك.`);
      return { lines, notes: a.notes as string | undefined };
    } catch { return null; }
  }, []);

  /* المسار الذي اعتمده تشخيصه سابقا — إن وُجد */
  const diagTopId = useMemo(() => {
    try {
      return sessionStorage.getItem("wajeez_diag_top");
    } catch {
      return null;
    }
  }, []);

  if (!pathway) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-[#0D0D0D] text-white">
        <p className="text-xl font-bold">هذا المسار غير موجود</p>
        <Link to="/" className="mt-4 text-[#6EC7D1] underline">العودة للرئيسية</Link>
      </div>
    );
  }

  const advisor = ADVISORS[pathway.id.split("-")[1]] ?? ADVISORS.FND;
  const advisorMsg = `مرحبا ${advisor.name}، أكملت تشخيص وجيز ورُشّح لي مسار «${pathway.name}» وأريد استشارتك قبل البدء.`;

  /* اختيار الدورات المتعدد — دورة واحدة أو عدة دورات بحرية كاملة */
  const buyableCourses = pathwayCoursesList.filter((c) => c.id !== custom?.giftId);
  const picked = buyableCourses.filter((c) => pickedIds.includes(c.id));
  const pickedTotal = picked.reduce((s, c) => s + coursePriceOf(c), 0);
  const togglePick = (cid: string) =>
    setPickedIds(pickedIds.includes(cid) ? pickedIds.filter((x) => x !== cid) : [...pickedIds, cid]);
  const totalWeeks = pathwayCoursesList.reduce((s, c) => s + c.weeks, 0);

  return (
    <div dir="rtl" className="min-h-screen bg-[#0D0D0D] text-white">
      <SeoHead
        title={pathway.name}
        description={`${pathway.transformation} — مسار ${pathway.level} من ${weeksLabel(pathway.durationWeeks)} في أكاديمي وجيز.`}
        path={`/pathways/${pathway.id}`}
      />
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0D0D0D]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2 text-white/70 hover:text-white">
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm font-medium">الرئيسية</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
            <span className="font-black">أكاديمي وجيز</span>
          </div>
          {user && (
            <span className="flex items-center gap-1.5 text-xs text-white/50">
              <User className="h-4 w-4" /> {user}
            </span>
          )}
        </div>
      </header>

      {!user ? (
        <AuthGate
          message="سجّل حسابك لترى صفحة مسارك كاملة: تقريرك الشخصي، دوراتك، تعديلاتك، وبوابة الدفع"
          onDone={() => setUser(readUserName())}
        />
      ) : (
        <main className="mx-auto max-w-5xl px-5 py-12">
          {/* ترويسة المسار */}
          <div className="story-fade">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-[#FABC05] font-black text-[#0D0D0D]">{pathway.badge ?? "مسار مرشح لك"}</Badge>
              <Badge variant="outline" className="border-white/20 text-white/70">{pathway.level}</Badge>
              {custom && <Badge className="border border-[#6EC7D1]/50 bg-[#38A7B4]/15 text-[#6EC7D1]">نسختك المخصصة</Badge>}
            </div>
            <h1 className="mt-4 text-3xl font-black leading-snug md:text-4xl">{pathway.name}</h1>
            <p className="mt-4 max-w-2xl leading-loose text-white/65">{pathway.transformation}</p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-white/70">
                <CalendarClock className="h-3.5 w-3.5 text-[#6EC7D1]" />
                {custom ? `${weeksLabel(totalWeeks)} (مخصصة)` : weeksLabel(pathway.durationWeeks)}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-white/70">
                <Clock3 className="h-3.5 w-3.5 text-[#6EC7D1]" />
                {pathway.weeklyHours} أسبوعيا
              </span>
            </div>
            <p className="mt-3 flex max-w-2xl items-start gap-2 text-sm leading-relaxed text-white/60">
              <RouteIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#FABC05]" />
              <span>
                <span className="font-bold text-white/80">المخرج العملي: </span>
                {pathway.output}
              </span>
            </p>
          </div>

          {/* «ماذا ستحقق من خلال خطتك؟» — رحلة الدورات بأكورديون، بلا قائمة مكررة فوقها */}
          <CourseJourney
            courseIds={pathwayCoursesList.map((c) => c.id)}
            delivery={pathwayDelivery(pathway.id)}
            headingLevel="h2"
            giftId={custom?.giftId ?? null}
          />

          {/* مقاعد التخصصات التدريبية — الأسماء تُعلن بعد اعتماد الشعبة */}
          <div className="story-fade mt-8 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-black">
              <User className="h-4 w-4 text-[#6EC7D1]" />
              الفريق التدريبي لهذا المسار
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {pathwayTrainers(pathway.id).map((t) => (
                <span key={t.role} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs">
                  <User className="h-3.5 w-3.5 shrink-0 text-[#6EC7D1]" />
                  <span className="font-bold text-white/85">{t.role}</span>
                  <span className="text-[#6EC7D1]">{t.name}</span>
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-white/40">
              كل دورة يقدمها المدرب الأعمق في موضوعها — وينسّقون معا حتى تتكامل المهارات لا أن تتكرر. تُعلن الأسماء بعد اعتماد الشعبة رسميا.
            </p>
          </div>

          {/* التشخيص: دعوة للزائر الجديد — وشارة اعتماد لمن جاء من تشخيصه */}
          {!report && (
            <div className="story-fade mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-[#38A7B4]/40 bg-[#38A7B4]/5 px-6 py-4">
              <p className="text-sm leading-relaxed text-white/70">
                <span className="font-black text-[#6EC7D1]">لست متأكدا أن هذا مسارك الأنسب؟ </span>
                ثلاث دقائق مع مؤشر وجيز تطابقك مع مساراتنا المصممة وتشرح لك السبب.
              </p>
              <Button variant="outline" className="border-[#38A7B4]/60 text-[#6EC7D1] hover:bg-[#38A7B4]/15" asChild>
                <Link to="/diagnostic">ابدأ بمؤشر وجيز</Link>
              </Button>
            </div>
          )}
          {report && (
            <div className="story-fade mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#38A7B4]/40 bg-[#38A7B4]/[0.06] px-5 py-3">
              <p className="flex items-center gap-2 text-xs font-bold leading-relaxed text-white/75">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#6EC7D1]" />
                {diagTopId === pathway.id
                  ? "هذا المسار اعتمده تشخيصك — بُني على إجاباتك أنت."
                  : "تستعرض مسارا مختلفا عن الذي اعتمده تشخيصك."}
              </p>
              <Link
                to="/diagnostic"
                className="flex items-center gap-1.5 rounded-full border border-[#38A7B4]/50 px-4 py-1.5 text-xs font-bold text-[#6EC7D1] transition hover:bg-[#38A7B4]/15"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                عد لنتيجتك لإعادة التخصيص
              </Link>
            </div>
          )}

          {/* تقريره الشخصي — مطوي افتراضيا في تبويب صغير */}
          {report && (
            <details className="story-fade group mt-6 rounded-2xl border border-[#38A7B4]/35 bg-gradient-to-b from-[#12343B]/60 to-transparent">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-black text-[#6EC7D1] [&::-webkit-details-marker]:hidden">
                <FileText className="h-4 w-4" />
                تقريرك الشخصي — ما فهمناه عنك
                <span className="mr-auto text-[10px] font-semibold text-white/40 transition group-open:rotate-180">▾</span>
              </summary>
              <div className="border-t border-white/10 px-5 py-4">
                <div className="space-y-3">
                  {report.lines.map((l) => (
                    <p key={l} className="flex items-start gap-3 text-sm leading-loose text-white/75">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#38A7B4]" />
                      {l}
                    </p>
                  ))}
                </div>
                {report.notes && (
                  <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-white/60">
                    <span className="font-bold text-[#6EC7D1]">كلمتك التي كتبتها بنفسك: </span>«{report.notes}»
                  </p>
                )}
                <p className="mt-4 text-xs text-white/40">هذا التقرير مبني على إجاباتك في التشخيص — وسيطوره مستشارك معك في أول جلسة.</p>
              </div>
            </details>
          )}

          {/* مقارنة الشراء: دورة واحدة أم المسار كاملا — تصميم هادئ يريح القرار */}
          {(
            <div id="buy" className="story-fade mt-10 scroll-mt-24 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <h3 className="text-xl font-black">اشترِ بالطريقة التي تناسبك</h3>
              <p className="mt-2 text-xs leading-relaxed text-white/50">خياران واضحان بلا ضغط — قارن بهدوء، والقرار لك.</p>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {/* دورة أو أكثر — اختيار حر */}
                <div className="flex flex-col rounded-2xl border border-white/15 bg-black/30 p-5">
                  <p className="font-black text-sm">دورة أو أكثر من المسار</p>
                  <p className="mt-1 text-xs text-white/50">اختر ما تحتاجه بالضبط — دورة واحدة أو عدة دورات — وادفع مجموعها فقط</p>
                  <div className="mt-4 space-y-2">
                    {buyableCourses.map((c) => {
                      const on = pickedIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => togglePick(c.id)}
                          aria-pressed={on}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-right transition ${
                            on
                              ? "border-[#38A7B4] bg-[#38A7B4]/15"
                              : "border-white/10 bg-white/[0.03] hover:border-[#38A7B4]/50"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                                on ? "border-[#38A7B4] bg-[#38A7B4] text-[#08272B]" : "border-white/25 text-transparent"
                              }`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </span>
                            <span>
                              <span className="block text-sm font-bold leading-snug">{c.name}</span>
                              <span className="text-[11px] text-white/45">
                                {c.weeks} {c.weeks === 1 ? "أسبوع" : "أسابيع"} · {courseTrainer(c).name}
                              </span>
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-black text-white/85">{fmt(coursePriceOf(c))}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* المجموع الحي والتلميح الذكي */}
                  {picked.length > 0 && (
                    <div className="mt-4 flex items-end justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <span className="text-xs text-white/55">
                        اخترت {picked.length === 1 ? "دورة واحدة" : `${picked.length} دورات`} من {buyableCourses.length}
                      </span>
                      <span className="text-2xl font-black text-white">{fmt(pickedTotal)}</span>
                    </div>
                  )}
                  {picked.length > 0 && pickedTotal >= pathwayTotal && (
                    <p className="mt-2 rounded-xl border border-[#FABC05]/40 bg-[#FABC05]/10 px-4 py-2.5 text-[11px] font-semibold leading-relaxed text-[#FABC05]">
                      انتبه — مجموع مختاراتك {fmt(pickedTotal)} {pickedTotal > pathwayTotal ? "تجاوز" : "ساوى"} سعر المسار كاملا {fmt(pathwayTotal)}!
                      المسار الكامل أوفر لك ويشمل التشخيص والمتابعة ودورة إضافية هدية.
                    </p>
                  )}
                  <Button
                    onClick={() =>
                      setCheckout({
                        title:
                          picked.length === 1
                            ? `دورة «${picked[0].name}» من مسار ${pathway.name}`
                            : `${picked.length} دورات مختارة من مسار ${pathway.name}`,
                        amount: pickedTotal,
                        kind: picked.length === 1 ? "course" : "courses",
                        courseIds: picked.map((c) => c.id),
                      })
                    }
                    disabled={picked.length === 0}
                    variant="outline"
                    className="mt-4 h-11 rounded-full border-[#38A7B4]/60 bg-transparent font-black text-[#6EC7D1] hover:bg-[#38A7B4]/10 hover:text-[#6EC7D1] disabled:opacity-40"
                  >
                    {picked.length === 0
                      ? "اختر دورة واحدة على الأقل"
                      : picked.length === 1
                        ? "اشترِ الدورة المختارة"
                        : `اشترِ الدورات المختارة (${picked.length})`}
                  </Button>
                </div>
                {/* المسار كاملا */}
                <div className="relative flex flex-col rounded-2xl border border-[#FABC05]/30 bg-white/[0.03] p-5">
                  <span className="absolute left-3 top-3 rounded-full bg-[#FABC05]/15 px-2.5 py-0.5 text-[10px] font-black text-[#FABC05]">الأوفر</span>
                  <p className="font-black text-sm">المسار كاملا</p>
                  <p className="mt-1 text-xs text-white/50">كل الدورات + التشخيص الكامل + المنظومة التسع أدناه</p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-2xl font-black text-white">{fmt(pathwayTotal)}</span>
                    {savingPct > 0 && <span className="mb-0.5 text-sm text-white/45 line-through">{fmt(separateCost)}</span>}
                  </div>
                  {savingPct > 0 && <p className="mt-1 text-xs text-[#6EC7D1]">بدل {fmt(separateCost)} لو اشتريت الدورات منفردة — توفير {savingPct}%</p>}
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#FABC05]">
                    <Gift className="h-3.5 w-3.5" /> + دورة إضافية مجانية من اختيارك هدية
                  </p>
                  <Button
                    onClick={() => setCheckout({ title: `مسار «${pathway.name}» كاملا (${pathwayCoursesList.length} دورات + هدية)`, amount: pathwayTotal, kind: "pathway" })}
                    className="mt-4 h-11 rounded-full bg-[#FABC05] font-black text-[#0D0D0D] hover:bg-[#FABC05]/90"
                  >
                    <CreditCard className="ml-2 h-4 w-4" />
                    ادفع عبر Stripe
                  </Button>
                </div>
              </div>
              <p className="mt-4 text-center text-[11px] text-white/40">دفع آمنا عبر Stripe — يصلك تأكيد فوري على بريدك وتُفتح منصة الطالب الخاصة بك</p>
            </div>
          )}

          {/* ما ستحصل عليه مع المسار — من عروض أكاديمية وجيز */}
          <div className="story-fade mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Sparkles className="h-5 w-5 text-[#FABC05]" />
              مع المسار لا تأخذ دورات فقط — تأخذ منظومة كاملة
            </h2>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: MonitorPlay, t: "دورات مسجلة + جلسات مباشرة", d: "وحدات فيديو وجلسة حية مع المدرب ومهمة تطبيقية لكل دورة" },
                { icon: Headphones, t: "ملخصات كتب وجيز الصوتية", d: "اسمع ملخصات الكتب المرتبطة بمسارك — ثم اختبر نفسك فيها" },
                { icon: ClipboardCheck, t: "واجبات تُراجع بشريا", d: "مدربك يقرأ واجبك ويعطيك تغذية راجعة عملية — لا تصحيحا آليا" },
                { icon: FolderKanban, t: "مشروع تخرج حقيقي", d: "تبني مخرجا على واقعك وتقدمه للمراجعة قبل الاعتماد" },
                { icon: BadgeCheck, t: "شهادة موثقة بشروط إنجاز", d: "مرتبطة بالحضور والاختبار والمشروع — لا شهادة مشاهدة" },
                { icon: BarChart3, t: "خريطة مهارات قبل وبعد", d: "ترى مستواك 0–5 في كل مهارة قبل المسار وبعده" },
                { icon: RouteIcon, t: "خطة تقدم شخصية", d: "خطوة تالية واضحة بعد المسار — ماذا تتعلم بعده ولماذا" },
                { icon: UserCheck, t: "مستشار نجاح يرافقك", d: "متابعة أسبوعية ورسالة مباشرة عند أي تعثر" },
                { icon: Briefcase, t: "منظومة ما بعد الإتمام", d: "لوحة وظائف وتوصيات مهنية وبرنامج سفراء وجيز" },
              ].map((b) => (
                <div key={b.t} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#38A7B4]/15">
                    <b.icon className="h-4 w-4 text-[#6EC7D1]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black leading-relaxed">{b.t}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/50">{b.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA ختامي — يعيد إلى قسم الدفع في الأعلى */}
          <div className="story-fade mt-8 text-center">
            <a
              href="#buy"
              className="inline-flex items-center gap-2 rounded-full bg-[#FABC05] px-10 py-4 text-lg font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90"
            >
              ابدأ الآن لنسختك القادمة
            </a>
          </div>

          {/* مستشارك على واتساب */}
          <div className="story-fade mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-5">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#38A7B4] to-[#247B84] text-xl font-black text-white">
                {advisor.name.replace(/^(أ\.|د\.|م\.)\s*/, "").charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-black">{advisor.name}</p>
                <p className="mt-0.5 text-sm text-[#6EC7D1]">{advisor.title} — مستشارك المخصص لهذا المسار</p>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  متردد قبل الدفع؟ راسل مستشارك مباشرة — قرأ تشخيصك وسيجيبك بنفسه، لا رد آلي.
                </p>
              </div>
              <Button asChild className="h-12 rounded-full bg-[#25D366] px-6 font-black text-white hover:bg-[#25D366]/85">
                <AdvisorContact
                  text={advisorMsg}
                  label="كلم مستشارك"
                  icon={<MessageCircle className="ml-2 h-5 w-5" />}
                />
              </Button>
            </div>
          </div>

          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-white/55">
            <Sparkles className="h-3.5 w-3.5" />
            منصة الطالب الكاملة (الدورات، الواجبات، المتابعة) تُفتح تلقائيا بعد أول دفع ناجح — وهي محطتنا القادمة.
          </p>
        </main>
      )}

      {/* تعريف المنظومة — سطر ثقة ختامي يظهر للزائر والمسجّل معا */}
      <EcosystemNote className="mx-auto max-w-5xl px-5 pb-8" />

      {/* نافذة الدفع */}
      {checkout && (
        <StripeCheckout
          title={checkout.title}
          amount={checkout.amount}
          onClose={() => setCheckout(null)}
          onSuccess={() => {
            grantEnrollment({
              pathwayId: pathway.id,
              pathwayName: pathway.name,
              courseIds: checkout.kind === "pathway" ? courseIds : (checkout.courseIds ?? courseIds),
              giftId: custom?.giftId ?? null,
              kind: checkout.kind,
              amount: checkout.amount,
            });
            track("payment_completed", { kind: checkout.kind, courses: checkout.kind === "pathway" ? courseIds.length : (checkout.courseIds?.length ?? 1) });
            setCheckout(null);
            /* انتهت عملية الشراء — ينتقل مباشرة إلى تجربته التعليمية في منصة الطالب */
            navigate("/student");
          }}
        />
      )}

    </div>
  );
}

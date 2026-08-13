import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowRight,
  CalendarClock,
  Clock3,
  Route as RouteIcon,
  BookOpen,
  Gift,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  CreditCard,
  User,
  TrendingUp,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AuthGate from "@/components/AuthGate";
import CourseModal from "@/components/CourseModal";
import { pathwayById } from "@/data/pathways";
import { courseById, pathwayCourses, coursePriceOf, pathwayPriceFor, pathwayTrainers, courseTrainer, type Course } from "@/data/courses";
import { GOAL_LABELS, GAP_LABELS, OBSTACLE_TO_GAP } from "@/data/diagnostic";
import { grantEnrollment } from "@/services/access";
import { useCurrency, usePriceFormatter } from "@/services/currency";

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
// رقم تجريبي — يُستبدل برقم واتساب أعمال وجيز عند الإطلاق
const WHATSAPP_NUMBER = "966555555555"

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
  const pay = () => {
    if (card.replace(/\s/g, "").length < 12) return;
    setProcessing(true);
    window.setTimeout(onSuccess, 1600);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm" onClick={onClose}>
      <div className="story-fade w-full max-w-md rounded-3xl border border-white/10 bg-[#121B1D] p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-black">
            <CreditCard className="h-5 w-5 text-[#6EC7D1]" />
            دفع آمن عبر Stripe
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
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
    </div>
  );
}

/* ─────────── الصفحة ─────────── */
export default function PathwayPage() {
  const { id } = useParams();
  const pathway = pathwayById(id ?? "");
  const [user, setUser] = useState<string | null>(readUserName);
  const [checkout, setCheckout] = useState<{ title: string; amount: number; kind: "pathway" | "course" | "courses"; courseId?: string; courseIds?: string[] } | null>(null);
  const [purchased, setPurchased] = useState<{ kind: "pathway" | "course" | "courses"; courseId?: string } | null>(null);
  const [modalCourse, setModalCourse] = useState<Course | null>(null);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const fmt = usePriceFormatter();

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
  const diagTopPathway = diagTopId ? pathwayById(diagTopId) : undefined;

  if (!pathway) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-[#0D0D0D] text-white">
        <p className="text-xl font-bold">هذا المسار غير موجود</p>
        <Link to="/" className="mt-4 text-[#6EC7D1] underline">العودة للرئيسية</Link>
      </div>
    );
  }

  const advisor = ADVISORS[pathway.id.split("-")[1]] ?? ADVISORS.FND;
  const waText = encodeURIComponent(`مرحبا ${advisor.name}، أكملت تشخيص وجيز ورُشّح لي مسار «${pathway.name}» وأريد استشارتك قبل البدء.`);

  /* اختيار الدورات المتعدد — دورة واحدة أو عدة دورات بحرية كاملة */
  const buyableCourses = pathwayCoursesList.filter((c) => c.id !== custom?.giftId);
  const picked = buyableCourses.filter((c) => pickedIds.includes(c.id));
  const pickedTotal = picked.reduce((s, c) => s + coursePriceOf(c), 0);
  const togglePick = (cid: string) =>
    setPickedIds(pickedIds.includes(cid) ? pickedIds.filter((x) => x !== cid) : [...pickedIds, cid]);
  const totalWeeks = pathwayCoursesList.reduce((s, c) => s + c.weeks, 0);

  return (
    <div dir="rtl" className="min-h-screen bg-[#0D0D0D] text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0D0D0D]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2 text-white/70 hover:text-white">
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm font-medium">الرئيسية</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#38A7B4] font-black text-[#08272B]">و</span>
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

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <CalendarClock className="h-5 w-5 text-[#6EC7D1]" />
                <p className="mt-2 text-sm text-white/50">المدة</p>
                <p className="font-black">{custom ? `${totalWeeks} أسابيعا (مخصصة)` : `${pathway.durationWeeks} أسبوعًا`}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <Clock3 className="h-5 w-5 text-[#6EC7D1]" />
                <p className="mt-2 text-sm text-white/50">الوقت الأسبوعي</p>
                <p className="font-black">{pathway.weeklyHours}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <RouteIcon className="h-5 w-5 text-[#6EC7D1]" />
                <p className="mt-2 text-sm text-white/50">المخرج العملي</p>
                <p className="text-sm font-bold leading-relaxed">{pathway.output}</p>
              </div>
            </div>
          </div>

          {/* مدربو المسار — أكثر من مدرب يرافقك */}
          <div className="story-fade mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <User className="h-5 w-5 text-[#6EC7D1]" />
              مدربو هذا المسار
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {pathwayTrainers(pathway.id).map((t) => (
                <div key={t.name} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#38A7B4] to-[#247B84] text-base font-black text-white">
                    {t.name.replace(/^(أ\.|د\.|م\.)\s*/, "").charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-black">{t.name}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[#6EC7D1]">{t.role}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/40">
              كل دورة يقدمها المدرب الأعمق في موضوعها — وينسّقون معا حتى تتكامل المهارات لا أن تتكرر.
            </p>
          </div>

          {/* التشخيص: دعوة للزائر الجديد — وشارة اعتماد لمن جاء من تشخيصه */}
          {!report && (
            <div className="story-fade mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-[#38A7B4]/40 bg-[#38A7B4]/5 px-6 py-4">
              <p className="text-sm leading-relaxed text-white/70">
                <span className="font-black text-[#6EC7D1]">لست متأكدا أن هذا مسارك الأنسب؟ </span>
                خمس دقائق من التشخيص تطابقك مع مساراتنا المصممة وتشرح لك السبب.
              </p>
              <Button variant="outline" className="border-[#38A7B4]/60 text-[#6EC7D1] hover:bg-[#38A7B4]/15" asChild>
                <Link to="/diagnostic">خذ التشخيص أولا</Link>
              </Button>
            </div>
          )}
          {report && diagTopId === pathway.id && (
            <div className="story-fade mt-6 flex items-center gap-3 rounded-2xl border border-[#38A7B4]/50 bg-[#38A7B4]/10 px-6 py-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#6EC7D1]" />
              <p className="text-sm leading-relaxed text-white/80">
                <span className="font-black text-[#6EC7D1]">هذا المسار اعتمده تشخيصك. </span>
                لم يُختَر من كتالوج — بل بُني على إجاباتك أنت: هدفك وفجواتك وإيقاع حياتك.
              </p>
            </div>
          )}
          {report && diagTopId && diagTopId !== pathway.id && diagTopPathway && (
            <div className="story-fade mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4">
              <p className="text-sm leading-relaxed text-white/70">
                <span className="font-black text-[#6EC7D1]">تذكير: </span>
                تشخيصك اعتمد لك مسار «{diagTopPathway.name}» — وأنت الآن تستعرض مسارا آخر.
              </p>
              <Button variant="outline" className="border-[#38A7B4]/60 text-[#6EC7D1] hover:bg-[#38A7B4]/15" asChild>
                <Link to={`/pathways/${diagTopId}`}>انتقل لمساري المعتمد</Link>
              </Button>
            </div>
          )}

          {/* تقريره الشخصي */}
          {report && (
            <div className="story-fade mt-10 rounded-3xl border border-[#38A7B4]/35 bg-gradient-to-b from-[#12343B]/60 to-transparent p-6 md:p-8">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <FileText className="h-5 w-5 text-[#6EC7D1]" />
                تقريرك الشخصي — ما فهمناه عنك
              </h2>
              <div className="mt-4 space-y-3">
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
          )}

          {/* دورات المسار */}
          <div className="story-fade mt-10">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <BookOpen className="h-5 w-5 text-[#6EC7D1]" />
              دورات مسارك ({pathwayCoursesList.length})
            </h2>
            <div className="mt-5 grid gap-3">
              {pathwayCoursesList.map((c: Course, i: number) => {
                const isGift = custom?.giftId === c.id;
                return (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                    <div className="flex items-center gap-4">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#38A7B4]/15 text-sm font-black text-[#6EC7D1]">{i + 1}</span>
                      <div>
                        <p className="font-bold">
                          {c.name}
                          {isGift && (
                            <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-[#FABC05]/15 px-2 py-0.5 text-[11px] font-bold text-[#FABC05]">
                              <Gift className="h-3 w-3" /> هديتك المجانية
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-white/45">{c.weeks} {c.weeks === 1 ? "أسبوع" : "أسابيع"} · {c.skill}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!isGift && <span className="text-sm font-bold text-white/60">{fmt(coursePriceOf(c))} منفردة</span>}
                      <button
                        onClick={() => setModalCourse(c)}
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold transition hover:border-[#6EC7D1]/60 hover:text-[#6EC7D1]"
                      >
                        تفاصيل الدورة
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ما ستحصل عليه مع المسار — من عروض أكاديمية وجيز */}
          <div className="story-fade mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Sparkles className="h-5 w-5 text-[#FABC05]" />
              مع المسار لا تأخذ دورات فقط — تأخذ منظومة كاملة
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { t: "دورات مسجلة + جلسات مباشرة", d: "وحدات فيديو وجلسة حية مع المدرب ومهمة تطبيقية لكل دورة" },
                { t: "ملخصات كتب وجيز الصوتية", d: "اسمع ملخصات الكتب المرتبطة بمسارك — ثم اختبر نفسك فيها" },
                { t: "واجبات تُراجع بشريا", d: "مدربك يقرأ واجبك ويعطيك تغذية راجعة عملية — لا تصحيحا آليا" },
                { t: "مشروع تخرج حقيقي", d: "تبني مخرجا على واقعك وتقدمه للمراجعة قبل الاعتماد" },
                { t: "شهادة موثقة بشروط إنجاز", d: "مرتبطة بالحضور والاختبار والمشروع — لا شهادة مشاهدة" },
                { t: "خريطة مهارات قبل وبعد", d: "ترى مستواك 0–5 في كل مهارة قبل المسار وبعده" },
                { t: "خطة تقدم شخصية", d: "خطوة تالية واضحة بعد المسار — ماذا تتعلم بعده ولماذا" },
                { t: "مستشار نجاح يرافقك", d: "متابعة أسبوعية ورسالة مباشرة عند أي تعثر" },
                { t: "منظومة ما بعد الإتمام", d: "لوحة وظائف وتوصيات مهنية وبرنامج سفراء وجيز" },
              ].map((b) => (
                <div key={b.t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="flex items-start gap-2 text-sm font-black leading-relaxed">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#38A7B4]" />
                    {b.t}
                  </p>
                  <p className="mt-1.5 pr-6 text-xs leading-relaxed text-white/50">{b.d}</p>
                </div>
              ))}
            </div>
          </div>

          {/* نجاح الدفع */}
          {purchased && (
            <div className="story-fade mt-10 rounded-3xl border border-[#38A7B4]/50 bg-[#38A7B4]/10 p-6 text-center md:p-8">
              <CheckCircle2 className="mx-auto h-12 w-12 text-[#6EC7D1]" />
              <h3 className="mt-4 text-2xl font-black">تم الدفع بنجاح — مبارك!</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-loose text-white/65">
                ستصلك الآن رسالة تأكيد على بريدك الإلكتروني — ومنصة الطالب الخاصة بك فُتحت لك للتو:
                دوراتك وواجباتك وجلساتك ومستشارك بانتظارك.
              </p>
              <Link
                to="/student"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#38A7B4] px-8 py-3.5 font-black text-[#08272B] transition hover:bg-[#6EC7D1]"
              >
                ادخل منصة الطالب الآن
              </Link>
              {purchased.kind !== "pathway" && (
                <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-[#FABC05]/40 bg-[#FABC05]/10 p-5">
                  <p className="flex items-center justify-center gap-2 font-black text-[#FABC05]">
                    <TrendingUp className="h-5 w-5" />
                    خطوتك التالية الأذكى: أكمل المسار كاملا
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    اشتريت {purchased.kind === "courses" ? "دورات مختارة" : "دورة"} — ممتاز. لكن الدورات المتفرقة خطوات، والمسار رحلة مكتملة.
                    أكمل «{pathway.name}» كاملا بـ{fmt(pathwayTotal)} وسنخصم لك ما دفعته للتو —
                    فتصبح مشترياتك الأولى عمليا مجانية.
                  </p>
                  <Button
                    onClick={() => setCheckout({ title: `إكمال مسار «${pathway.name}» كاملا`, amount: pathwayTotal, kind: "pathway" })}
                    className="mt-4 rounded-full bg-[#FABC05] px-8 font-black text-[#0D0D0D] hover:bg-[#FABC05]/90"
                  >
                    أكمل المسار بـ{fmt(pathwayTotal)}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* مقارنة الشراء: دورة واحدة أم المسار كاملا */}
          {!purchased && (
            <div className="story-fade mt-10 overflow-hidden rounded-3xl border border-[#FABC05]/40 bg-gradient-to-b from-[#2A2108]/60 to-transparent p-6 md:p-8">
              <h3 className="text-xl font-black text-[#FABC05]">اشترِ بالطريقة التي تناسبك</h3>
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
                <div className="relative flex flex-col overflow-hidden rounded-2xl border border-[#FABC05]/60 bg-[#FABC05]/5 p-5">
                  <span className="absolute left-3 top-3 rounded-full bg-[#FABC05] px-2.5 py-0.5 text-[10px] font-black text-[#0D0D0D]">الأذكى ماليا</span>
                  <p className="font-black text-sm">المسار كاملا</p>
                  <p className="mt-1 text-xs text-white/50">كل الدورات + التشخيص الكامل + المنظومة التسع أعلاه</p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-3xl font-black text-white">{fmt(pathwayTotal)}</span>
                    {savingPct > 0 && <span className="mb-1 text-sm text-white/45 line-through">{fmt(separateCost)}</span>}
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
                <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="ml-2 h-5 w-5" />
                  كلم مستشارك واتساب
                </a>
              </Button>
            </div>
          </div>

          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-white/35">
            <Sparkles className="h-3.5 w-3.5" />
            منصة الطالب الكاملة (الدورات، الواجبات، المتابعة) تُفتح تلقائيا بعد أول دفع ناجح — وهي محطتنا القادمة.
          </p>
        </main>
      )}

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
            setPurchased({ kind: checkout.kind, courseId: checkout.courseId });
            setCheckout(null);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}

      {/* نافذة تفاصيل الدورة */}
      {modalCourse && (
        <CourseModal
          course={modalCourse}
          onClose={() => setModalCourse(null)}
          onBuy={(c) => {
            setModalCourse(null);
            setCheckout({ title: `دورة «${c.name}» من مسار ${pathway.name}`, amount: coursePriceOf(c), kind: "course", courseId: c.id });
          }}
        />
      )}
    </div>
  );
}

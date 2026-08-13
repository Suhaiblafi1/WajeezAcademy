import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  ArrowLeft,
  Compass,
  ShieldCheck,
  Clock3,
  Sparkles,
  CheckCircle2,
  RefreshCcw,
  UserCheck,
  CalendarClock,
  Route as RouteIcon,
  Gauge,
  Plus,
  X,
  Gift,
  Wand2,
  BookOpen,
  BrainCircuit,
  BellRing,
  Zap,
  Wallet,
  Lightbulb,
  BarChart3,
  Footprints,
  History,
  Lock,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/services/currency";
import { Badge } from "@/components/ui/badge";
import AuthGate from "@/components/AuthGate";
import {
  nextQuestion,
  estimateTotal,
  buildState,
  computeResult,
  scenarioLevels,
  GAP_LABELS,
  OBSTACLE_TO_GAP,
  type DiagQuestion,
  type DiagOption,
  type DiagResult,
  type Dim,
} from "@/data/diagnostic";
import {
  courseById,
  pathwayCourses,
  courses,
  coursePriceOf,
  pathwayPriceFor,
  MIN_PATHWAY_COURSES,
  MAX_PATHWAY_COURSES,
} from "@/data/courses";
import type { Pathway } from "@/data/pathways";

type DiagAnswers = Record<string, string>;
type Stage = "intro" | "gate" | "questions" | "computing" | "result";

const resolve = <T,>(v: T | ((a: DiagAnswers) => T) | undefined, a: DiagAnswers): T | undefined =>
  typeof v === "function" ? (v as (a: DiagAnswers) => T)(a) : v;

const DIM_LABELS: Record<Dim, string> = {
  persona: "من أنت",
  goal: "هدفك",
  branch: "قصتك",
  skills: "مهاراتك",
  interest: "اهتماماتك",
  constraints: "إيقاعك وظروفك",
};

/* ═══════════ وحدات الرحلة الخمس — شريط التقدم الجديد ═══════════ */
const JOURNEY_STAGES = [
  { key: "who", label: "من أنت" },
  { key: "goal", label: "هدفك" },
  { key: "story", label: "قصتك وواقعك" },
  { key: "skills", label: "مهاراتك ورصيدك" },
  { key: "life", label: "ظروفك وخطتك" },
] as const;

function stageIndexOf(q: DiagQuestion | null): number {
  if (!q) return 0;
  const m = q.module;
  if (m === "M1") return 0;
  if (m === "M2" || m === "M2B" || m === "M8") return 1;
  if (m.startsWith("M3")) return 2;
  if (m === "M4" || m === "M4B") return 3;
  return 4; // M7 وM9
}

/* ═══════════ الحفظ والاستئناف — لا تشخيص يضيع بعد اليوم ═══════════ */
const PROGRESS_KEY = "wajeez_diag_progress";
interface SavedProgress {
  answers: DiagAnswers;
  asked: string[];
  savedAt: number;
}
function loadProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as SavedProgress;
    return p && Array.isArray(p.asked) && p.asked.length >= 2 ? p : null;
  } catch {
    return null;
  }
}
function saveProgress(answers: DiagAnswers, asked: string[]) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ answers, asked, savedAt: Date.now() }));
  } catch {
    /* مساحة ممتلئة — نتجاهل بهدوء */
  }
}
function clearProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* لا شيء */
  }
}

/** إعادة بناء سلسلة الأسئلة من الإجابات المحفوظة — المحرك قطعي فتُعاد نفس الأسئلة */
function rebuildHistory(answers: DiagAnswers, asked: string[]): DiagQuestion[] {
  const hist: DiagQuestion[] = [];
  let a: DiagAnswers = {};
  const soFar: string[] = [];
  for (const qid of asked) {
    const q = nextQuestion(a, soFar);
    if (!q || q.id !== qid) break; // تغيّر منطق المحرك — نكتفي بما تطابق
    hist.push(q);
    a = { ...a, [qid]: answers[qid] ?? "" };
    soFar.push(qid);
  }
  return hist;
}

/* ═══════════ ملخص القصة — يقرأ نفسه في صفحة النتيجة ═══════════ */
const PERSONA_L: Record<string, string> = {
  student: "طالبا",
  graduate: "خريجا جديدا يبحث عن أول فرصة",
  employee: "موظفا",
  entrepreneur: "رائد أعمال يطارد أهدافه",
  family: "والدا — هدفك الأسري أولويتك",
  unsure: "شخصا ما زال يستكشف اتجاهه",
};
const GOAL_L: Record<string, string> = {
  job: "وظيفة أولى أو ترقية",
  project: "إطلاق مشروع أو دخل إضافي",
  change: "تغيير مسارك المهني بالكامل",
  skill: "إتقان مهارة محددة تحتاجها الآن",
  performance: "تحسين أدائك في وظيفتك الحالية",
  family: "هدفا أسريا ورفاها شخصيا",
};
const SECTOR_L: Record<string, string> = { private: "القطاع الخاص", government: "القطاع الحكومي" };
const OBSTACLE_L: Record<string, string> = {
  writing: "التقارير والكتابة المهنية",
  data: "البيانات والجداول",
  projects: "إدارة المشاريع والمتابعة",
  leadership: "قيادة الفريق والتفويض",
  communication: "التواصل والعرض أمام الآخرين",
  digital_ai: "الأدوات الرقمية والذكاء الاصطناعي",
  complaints: "التعامل مع الشكاوى والضغط",
};
const FORMAT_L: Record<string, string> = {
  live: "المباشر مع مدرب",
  recorded: "المسجل بوتيرتك الخاصة",
  mixed: "المزيج بين المباشر والمسجل",
  applied: "التطبيق والمشاريع",
};
const LANG_L: Record<string, string> = {
  arabic: "بالعربية",
  english_ok: "بالعربية أو الإنجليزية",
  either: "بأي لغة — المهم المحتوى",
};
const TARGET_L: Record<string, string> = {
  soon: "خلال شهر إلى ثلاثة أشهر",
  mid: "خلال ثلاثة إلى ستة أشهر",
  year: "خلال سنة",
};

function storySummary(a: DiagAnswers): string[] {
  const lines: string[] = [];
  const persona = PERSONA_L[a.persona];
  const goal = GOAL_L[a.goal];
  const sector = SECTOR_L[a.emp_sector];
  if (persona) {
    lines.push(
      `أنت ${persona}${sector ? ` في ${sector}` : ""}، وغايتك ${goal ?? "أن يختلف شيء حقيقي في حياتك بعد أشهر"}.`
    );
  }
  const obstacles = (a.emp_obstacle ?? "")
    .split(",")
    .filter(Boolean)
    .map((o) => OBSTACLE_L[o])
    .filter(Boolean);
  if (obstacles.length) {
    lines.push(`ما يبطئك فعلا في يومك: ${obstacles.join(" و")} — ومسارك مبني ليعالج هذا أولا.`);
  }
  const gaps = (a.sk_gaps ?? "")
    .split(",")
    .filter((g) => g && g !== "none")
    .map((g) => GAP_LABELS[g])
    .filter(Boolean);
  if (gaps.length) {
    lines.push(`وبلسانك أشرت إلى رغبتك في تقوية: ${gaps.join("، ")}.`);
  }
  const format = FORMAT_L[a.format];
  const lang = LANG_L[a.learn_lang];
  const target = TARGET_L[a.target_date];
  if (format || lang || target) {
    lines.push(
      `تتعلم أفضل بصيغة ${format ?? "مرنة"}${lang ? ` ${lang}` : ""}، وتريد نتيجة ملموسة ${target ?? "قريبا"}.`
    );
  }
  return lines;
}

/* ═══════════ خريطة المهارات المرئية — مستويات مستنتجة من المواقف ═══════════ */
function SkillMap({ answers }: { answers: DiagAnswers }) {
  const levels = scenarioLevels(answers);
  const declared = new Set(
    [
      ...(answers.sk_gaps ?? "").split(",").filter((g) => g && g !== "none"),
      ...(answers.emp_obstacle ?? "").split(",").map((o) => OBSTACLE_TO_GAP[o]),
    ].filter(Boolean)
  );
  const TARGET = 4;
  const WORDS = ["", "بداية", "أساسيات", "متوسط", "متقدم", "خبير"];
  return (
    <div className="card-soft mt-8">
      <h3 className="h-card flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-[#6EC7D1]" />
        خريطة مهاراتك — كما استنتجها التشخيص من مواقفك
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-white/50">
        لا تقييم ذاتيا هنا — كل مستوى استُنتج من موقف حقيقي حكيته أثناء التشخيص.
        العلامة العنبرية: المستوى المستهدف لهدفك.
      </p>
      <div className="mt-6 space-y-5">
        {Object.entries(GAP_LABELS).map(([key, label]) => {
          const lv = parseInt(levels[key] ?? "", 10);
          const measured = !isNaN(lv);
          const isGap = declared.has(key);
          return (
            <div key={key}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-bold text-white/85">
                  {label}
                  {isGap && (
                    <span className="mr-2 rounded-full bg-[#FABC05]/15 px-2 py-0.5 text-[10px] font-bold text-[#FABC05]">
                      فجوة معلنة
                    </span>
                  )}
                </span>
                <span className="text-xs text-white/50">
                  {measured ? `${WORDS[lv]} — ${lv}/5` : "لم تُقس — لم تُذكر فجوة فيها"}
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-white/10" dir="ltr">
                {measured && (
                  <div
                    className={`h-full rounded-full ${isGap ? "bg-[#FABC05]" : "bg-[#38A7B4]"}`}
                    style={{ width: `${(lv / 5) * 100}%` }}
                  />
                )}
                <div
                  className="absolute -bottom-1 -top-1 w-0.5 rounded bg-[#FABC05]"
                  style={{ left: `${(TARGET / 5) * 100}%` }}
                  title="المستهدف"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════ رحلة المسار خطوة بخطوة — خط زمني لا قائمة ═══════════ */
function JourneyTimeline({ pathway }: { pathway: Pathway }) {
  const list = (pathwayCourses[pathway.id] ?? [])
    .map((id) => courseById(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  let week = 1;
  const steps = list.map((c) => {
    const start = week;
    week += c.weeks;
    return { c, start, end: week - 1 };
  });
  const totalWeeks = Math.max(0, week - 1);
  const weeksWord = (n: number) => (n === 1 ? "أسبوع" : n === 2 ? "أسبوعين" : n <= 10 ? `${n} أسابيع` : `${n} أسبوعا`);
  return (
    <div className="card-soft mt-8">
      <h3 className="h-card flex items-center gap-2">
        <Footprints className="h-5 w-5 text-[#6EC7D1]" />
        رحلتك خطوة بخطوة — {list.length} دورات على {weeksWord(totalWeeks)}
      </h3>
      <ol className="mt-6">
        {steps.map((s, i) => (
          <li key={s.c.id} className="relative flex gap-4 pb-6">
            {i < steps.length && <span className="absolute right-[13px] top-8 h-[calc(100%-24px)] w-px bg-white/10" />}
            <span className="z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#38A7B4]/50 bg-[#0D0D0D] text-xs font-black text-[#6EC7D1]">
              {i + 1}
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">{s.c.name}</p>
                <span className="text-xs text-white/45">
                  الأسبوع {s.start}
                  {s.end !== s.start ? `–${s.end}` : ""}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/50">
                {s.c.skill} · {weeksWord(s.c.weeks)}
              </p>
            </div>
          </li>
        ))}
        <li className="relative flex gap-4">
          <span className="z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#FABC05] text-xs font-black text-[#0D0D0D]">
            ✓
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#FABC05]">شهادة إتمام المسار + تقرير إنجازك الشخصي</p>
            <p className="mt-1 text-xs text-white/50">تُعرض في ملفك ويشاركها أصحاب العمل عبر رابط تحقق</p>
          </div>
        </li>
      </ol>
    </div>
  );
}

/* ─────────── مكوّن تخصيص المسار ─────────── */
function CustomizePathway({
  pathway,
  gaps,
  onReset,
}: {
  pathway: Pathway;
  gaps: string[];
  onReset: number; // يتغير عند تبديل المسار لإعادة التهيئة
}) {
  const baseIds = pathwayCourses[pathway.id] ?? [];
  const [chosenIds, setChosenIds] = useState<string[]>(baseIds.slice(0, MAX_PATHWAY_COURSES));
  const [giftId, setGiftId] = useState<string | null>(null);
  const [recomposed, setRecomposed] = useState(false);
  const [lastReset, setLastReset] = useState(onReset);

  if (lastReset !== onReset) {
    setLastReset(onReset);
    setChosenIds((pathwayCourses[pathway.id] ?? []).slice(0, MAX_PATHWAY_COURSES));
    setGiftId(null);
    setRecomposed(false);
  }

  const base = baseIds.map((id) => courseById(id)!).filter(Boolean);
  const chosen = chosenIds.map((id) => courseById(id)!).filter(Boolean);
  const category = base[0]?.category ?? "أساسيات";

  // اقتراحات: من نفس المجال أولا، وأولوية لما يعالج فجوات المستخدم
  const suggestions = useMemo(() => {
    const chosenSet = new Set(chosenIds);
    if (giftId) chosenSet.add(giftId);
    return courses
      .filter((c) => c.category === category && !chosenSet.has(c.id))
      .sort((x, y) => {
        const xm = gaps.some((g) => x.skill && g.includes(x.skill.slice(0, 8))) ? 1 : 0;
        const ym = gaps.some((g) => y.skill && g.includes(y.skill.slice(0, 8))) ? 1 : 0;
        return ym - xm;
      })
      .slice(0, 6);
  }, [chosenIds, giftId, category, gaps]);

  const removeCourse = (id: string) => {
    if (chosenIds.length <= MIN_PATHWAY_COURSES) return; // الحد الأدنى ٤ دورات
    setChosenIds(chosenIds.filter((c) => c !== id));
    setRecomposed(false);
  };
  const addCourse = (id: string) => {
    if (chosenIds.length >= MAX_PATHWAY_COURSES) return; // الحد الأقصى ٧ دورات
    setChosenIds([...chosenIds, id]);
    setRecomposed(false);
  };
  const pickGift = (id: string) => {
    setGiftId(giftId === id ? null : id); // الهدية فوق المسار ولا تُحتسب في العدد ولا السعر
    setRecomposed(false);
  };

  const gift = giftId ? courseById(giftId) : undefined;
  const allShown = gift ? [...chosen, gift] : chosen;
  const totalWeeks = allShown.reduce((s, c) => s + c.weeks, 0);
  const skills = Array.from(new Set(allShown.map((c) => c.skill).filter(Boolean))).slice(0, 8);
  const separateCost = chosen.reduce((s, c) => s + coursePriceOf(c), 0);
  const price = pathwayPriceFor(chosenIds.length);
  const saving = separateCost > price ? separateCost - price : 0;

  const recompose = () => {
    setRecomposed(true);
    // نحفظ تخصيصه ليظهر له في صفحة المسار
    sessionStorage.setItem(
      "wajeez_custom",
      JSON.stringify({ pathwayId: pathway.id, chosenIds, giftId })
    );
  };

  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
      <h3 className="flex items-center gap-2 text-lg font-black">
        <Wand2 className="h-5 w-5 text-[#6EC7D1]" />
        خصّص مسارك كما تشاء
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-white/55">
        احذف ما لا تحتاجه، وأضف من الدورات المقترحة لك خصيصا — بين {MIN_PATHWAY_COURSES} و{MAX_PATHWAY_COURSES} دورات —
        ثم أعد صياغة مسارك لترى مهاراته وسعره الجديد.
      </p>

      {/* دورات المسار الحالية */}
      <p className="mt-6 mb-3 text-sm font-bold text-white/70">
        دورات مسارك ({chosen.length} من {MIN_PATHWAY_COURSES}–{MAX_PATHWAY_COURSES})
      </p>
      <div className="grid gap-2">
        {chosen.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="h-4 w-4 shrink-0 text-[#6EC7D1]" />
              <div>
                <span className="text-sm font-bold">{c.name}</span>
                <span className="mr-2 text-xs text-white/45">{c.weeks} {c.weeks === 1 ? "أسبوع" : "أسابيع"} · {c.skill}</span>
              </div>
            </div>
            <button
              onClick={() => removeCourse(c.id)}
              disabled={chosenIds.length <= MIN_PATHWAY_COURSES}
              aria-label={`حذف ${c.name}`}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 text-white/50 transition hover:border-red-400/50 hover:text-red-300 disabled:opacity-30"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      {chosenIds.length <= MIN_PATHWAY_COURSES && (
        <p className="mt-2 text-xs text-[#FABC05]/80">وصلت للحد الأدنى — {MIN_PATHWAY_COURSES} دورات هي نواة المسار.</p>
      )}
      {chosenIds.length >= MAX_PATHWAY_COURSES && (
        <p className="mt-2 text-xs text-[#FABC05]/80">وصلت للحد الأقصى — {MAX_PATHWAY_COURSES} دورات حتى يبقى مسارك قابلا للإنجاز.</p>
      )}

      {/* اقتراحات الإضافة */}
      {suggestions.length > 0 && (
        <>
          <p className="mt-6 mb-3 text-sm font-bold text-white/70">مقترحة لك خصيصا من مجال «{category}»</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {suggestions.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-white/15 px-4 py-3"
              >
                <div>
                  <span className="text-sm font-semibold">{c.name}</span>
                  <span className="block text-xs text-white/45">{c.skill} · من مسار {c.pathwayName}</span>
                </div>
                <button
                  onClick={() => addCourse(c.id)}
                  disabled={chosenIds.length >= MAX_PATHWAY_COURSES}
                  aria-label={`إضافة ${c.name}`}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#38A7B4]/40 text-[#6EC7D1] transition hover:bg-[#38A7B4]/20 disabled:opacity-30"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* الهدية المجانية */}
      <div className="mt-6 rounded-2xl border border-[#FABC05]/40 bg-[#FABC05]/5 p-4">
        <p className="flex items-center gap-2 text-sm font-black text-[#FABC05]">
          <Gift className="h-4 w-4" />
          هدية وجيز: اختر دورة إضافية مجانية فوق دورات مسارك
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((c) => (
            <button
              key={c.id}
              onClick={() => pickGift(c.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                giftId === c.id
                  ? "border-[#FABC05] bg-[#FABC05]/20 text-[#FABC05]"
                  : "border-white/15 text-white/60 hover:border-[#FABC05]/60 hover:text-[#FABC05]"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        {gift && (
          <p className="mt-3 flex items-center gap-2 text-xs text-[#FABC05]">
            <Gift className="h-3.5 w-3.5" />
            هديتك: {gift.name} — مجانية تماما فوق سعر المسار.
          </p>
        )}
      </div>

      {/* إعادة الصياغة */}
      <div className="mt-6 text-center">
        <Button
          size="lg"
          onClick={recompose}
          className="h-12 rounded-full bg-[#38A7B4] px-8 font-black text-white hover:bg-[#247B84]"
        >
          <Wand2 className="ml-2 h-4 w-4" />
          أعد صياغة مساري
        </Button>
      </div>

      {recomposed && (
        <div className="story-fade mt-6 rounded-2xl border border-[#38A7B4]/50 bg-gradient-to-b from-[#12343B] to-transparent p-6">
          <p className="text-sm font-bold text-[#6EC7D1]">مسارك بعد إعادة الصياغة</p>
          <h4 className="mt-2 text-xl font-black">{pathway.name} — نسختك المخصصة</h4>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/[0.05] p-3 text-center">
              <p className="text-2xl font-black text-[#6EC7D1]">{allShown.length}</p>
              <p className="text-xs text-white/55">{giftId ? "دورات (إحداها هدية مجانية)" : "دورات"}</p>
            </div>
            <div className="rounded-xl bg-white/[0.05] p-3 text-center">
              <p className="text-2xl font-black text-[#6EC7D1]">{totalWeeks}</p>
              <p className="text-xs text-white/55">أسبوعا تقريبا</p>
            </div>
            <div className="rounded-xl bg-white/[0.05] p-3 text-center">
              <p className="text-2xl font-black text-[#FABC05]">{formatPrice(price)}</p>
              <p className="text-xs text-white/55">
                {saving > 0 ? `وفّرت ${formatPrice(saving)} عن ${formatPrice(separateCost)} منفردة` : "سعر المسار التفضيلي"}
              </p>
            </div>
          </div>
          <p className="mt-4 mb-2 text-sm font-bold text-white/60">المهارات التي سيبنيها مسارك المخصص:</p>
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <span key={s} className="rounded-full border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-3 py-1 text-xs font-semibold text-[#6EC7D1]">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── الصفحة ─────────── */
export default function Diagnostic() {
  const [stage, setStage] = useState<Stage>("intro");
  const [answers, setAnswers] = useState<DiagAnswers>({});
  const [asked, setAsked] = useState<string[]>([]);
  const [history, setHistory] = useState<DiagQuestion[]>([]);
  const [question, setQuestion] = useState<DiagQuestion | null>(null);
  const [multiDraft, setMultiDraft] = useState<string[]>([]);
  const [textDraft, setTextDraft] = useState("");
  const [ratingsDraft, setRatingsDraft] = useState<Record<string, number>>({});
  const [result, setResult] = useState<DiagResult | null>(null);
  const [topPathway, setTopPathway] = useState<Pathway | null>(null);
  const [swapCount, setSwapCount] = useState(0);
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(() => loadProgress());
  /* الضيف أولا: يكمل التشخيص كاملا ويرى ملخصه الأولي، والحساب يُطلب فقط لفتح التفاصيل والحفظ */
  const [authed, setAuthed] = useState(() => Boolean(localStorage.getItem("wajeez_user")));
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [computeMsg, setComputeMsg] = useState(0);
  const [savedFlash, setSavedFlash] = useState(false);

  /* تحذير قبل مغادرة تشخيص غير محفوظ — التقدم محفوظ تلقائيا لكن نطمئنه */
  useEffect(() => {
    if (stage !== "questions") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stage]);

  /* انقطاع الشبكة — كل شيء محلي هنا، لكن نخبره بوضوح */
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  /* حفظ تلقائي مع كل إجابة — لا تشخيص يضيع لو خرج وعاد */
  useEffect(() => {
    if (stage === "questions" && asked.length > 0) {
      saveProgress(answers, asked);
    }
  }, [stage, answers, asked]);

  /* حالة الفهم الحية — تتحدث مع كل إجابة */
  const state = useMemo(() => buildState(answers, asked.length), [answers, asked]);
  const estimatedTotal = useMemo(() => estimateTotal(answers, asked), [answers, asked]);
  const progress = Math.min(100, Math.round(((asked.length + (question ? 1 : 0)) / estimatedTotal) * 100));
  const understoodDims = (Object.keys(DIM_LABELS) as Dim[]).filter((d) => state.dims[d] >= 0.6);
  const prelimTop = state.overall >= 0.3 ? state.ranked[0]?.p : undefined;

  /* مراحل الرحلة الخمس — أيها اكتمل وأيها نشط الآن */
  const currentStageIdx = stageIndexOf(question);
  const passedStages = useMemo(() => {
    const s = new Set(history.map((q) => stageIndexOf(q)));
    s.add(currentStageIdx);
    return s;
  }, [history, currentStageIdx]);

  // يبدأ فورا كضيف — الحساب يُطلب لاحقا عند حفظ النتيجة وتخصيصها
  const begin = () => {
    start();
  };

  const start = () => {
    const first = nextQuestion({}, []);
    setAnswers({});
    setAsked([]);
    setHistory([]);
    setMultiDraft([]);
    setTextDraft("");
    if (!first) {
      finish({});
      return;
    }
    setQuestion(first);
    setStage("questions");
  };

  /* استئناف تشخيص غير مكتمل — يعيد بناء الأسئلة من الإجابات المحفوظة */
  const doResume = () => {
    const saved = loadProgress();
    if (!saved) {
      start();
      return;
    }
    const hist = rebuildHistory(saved.answers, saved.asked);
    const next = nextQuestion(saved.answers, saved.asked);
    setAnswers(saved.answers);
    setAsked(saved.asked);
    setHistory(hist);
    setMultiDraft([]);
    setTextDraft("");
    if (!next) {
      finish(saved.answers);
      return;
    }
    setQuestion(next);
    setStage("questions");
    window.scrollTo(0, 0);
  };

  const resume = () => {
    doResume(); // الاستئناف أيضا متاح للضيف — إجاباته على جهازه
  };

  const discardSaved = () => {
    clearProgress();
    setSavedProgress(null);
  };

  const finish = (finalAnswers: DiagAnswers) => {
    setStage("computing");
    clearProgress();
    setSavedProgress(null);
    const res = computeResult(finalAnswers);
    // نحفظ إجاباته ونتيجته وJSON القرار — في الجلسة وعلى الجهاز ليبقى التشخيص بعد إغلاق المتصفح
    for (const store of [sessionStorage, localStorage]) {
      store.setItem("wajeez_diag_answers", JSON.stringify(finalAnswers));
      store.setItem("wajeez_diag_top", res.top.id);
      store.setItem("wajeez_result_json", JSON.stringify(res.resultJson));
    }
    setComputeMsg(0);
    const ticker = window.setInterval(() => setComputeMsg((m) => m + 1), 620);
    window.setTimeout(() => {
      window.clearInterval(ticker);
      setResult(res);
      setTopPathway(res.top);
      setStage("result");
    }, 1900);
  };

  const answer = (qid: string, value: string) => {
    if (!question) return;
    const next = { ...answers, [qid]: value };
    const nextAsked = asked.includes(qid) ? asked : [...asked, qid];
    setAnswers(next);
    setAsked(nextAsked);
    setHistory([...history, question]);
    setMultiDraft([]);
    setTextDraft("");
    setRatingsDraft({});
    const nq = nextQuestion(next, nextAsked);
    if (!nq) {
      finish(next);
    } else {
      setQuestion(nq);
    }
  };

  const toggleMulti = (q: DiagQuestion, value: string) => {
    let next: string[];
    if (value === "none") {
      next = ["none"];
    } else {
      const cur = multiDraft.filter((v) => v !== "none");
      next = cur.includes(value)
        ? cur.filter((v) => v !== value)
        : q.maxSelect && cur.length >= q.maxSelect
          ? cur
          : [...cur, value];
    }
    setMultiDraft(next);
  };

  const submitMulti = (q: DiagQuestion) => {
    if (multiDraft.length === 0) return;
    answer(q.id, multiDraft.join(","));
  };

  const back = () => {
    if (history.length === 0) {
      setStage("intro");
      return;
    }
    const prev = history[history.length - 1];
    const nextAnswers = { ...answers };
    delete nextAnswers[prev.id];
    setAnswers(nextAnswers);
    setAsked(asked.filter((id) => id !== prev.id));
    setHistory(history.slice(0, -1));
    setQuestion(prev);
    setMultiDraft([]);
    setTextDraft("");
  };

  const restart = () => {
    setAnswers({});
    setAsked([]);
    setHistory([]);
    setQuestion(null);
    setResult(null);
    setTopPathway(null);
    setMultiDraft([]);
    clearProgress();
    setSavedProgress(null);
    setStage("intro");
    window.scrollTo(0, 0);
  };

  const swapTop = (p: Pathway, slot: "faster" | "cheaper") => {
    if (!result || !topPathway) return;
    const old = topPathway;
    const oldPrice = pathwayPriceFor((pathwayCourses[old.id] ?? []).length || 6);
    setResult({
      ...result,
      top: p,
      faster: slot === "faster" ? old : result.faster,
      cheaper: slot === "cheaper" ? { p: old, price: oldPrice } : result.cheaper,
    });
    setTopPathway(p);
    setSwapCount(swapCount + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const qText = question ? resolve(question.text, answers) : "";
  const qHint = question ? resolve(question.hint, answers) : undefined;
  const qOptions: DiagOption[] = question ? (resolve(question.options, answers) ?? []) : [];

  return (
    <div dir="rtl" className="min-h-screen bg-[#0D0D0D] text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0D0D0D]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2 text-white/70 hover:text-white">
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm font-medium">العودة للرئيسية</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#38A7B4] font-black text-[#08272B]">و</span>
            <span className="font-black">أكاديمي وجيز</span>
          </div>
        </div>
      </header>

      {/* ─── Intro ─── */}
      {stage === "intro" && (
        <section className="story-fade mx-auto max-w-3xl px-5 py-16 text-center md:py-24">
          <Badge className="border border-[#FABC05]/40 bg-[#FABC05]/10 text-[#FABC05]">التشخيص الكامل</Badge>
          <h1 className="mt-5 text-3xl font-black leading-snug md:text-5xl">
            خمس دقائق من الصدق
            <span className="text-[#6EC7D1]"> تختصر عليك شهورا من التخبط</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-loose text-white/60">
            سنحكي معك قليلا: عن يومك، وهدفك، وما يعيقك — وكل إجابة تشكّل السؤال التالي.
            ثم يقترح محرك التشخيص المسار الأنسب لك، مع تفسير واضح لسبب كل توصية، وحرية تخصيصه كما تشاء.
          </p>

          <div className="mx-auto mt-8 grid max-w-xl gap-3 text-right sm:grid-cols-3">
            {[
              { icon: Compass, text: "توصية مفسَّرة، ليست حظًا" },
              { icon: Clock3, text: "٥–٨ دقائق فقط" },
              { icon: ShieldCheck, text: "تشخيص تعليمي — لا نفسي ولا طبي" },
            ].map((f) => (
              <div key={f.text} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <f.icon className="h-5 w-5 text-[#6EC7D1]" />
                <p className="mt-2 text-sm font-semibold text-white/85">{f.text}</p>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-xs leading-relaxed text-white/50">
            أسئلتنا مبنية على مراجع علمية موثوقة: <span className="font-bold text-[#6EC7D1]">RIASEC</span> للميول المهنية،
            و<span className="font-bold text-[#6EC7D1]">O*NET وESCO</span> لخرائط المهارات،
            و<span className="font-bold text-[#6EC7D1]">DigComp</span> للجاهزية الرقمية — نظام مبني على علم، لا على تخمين.
          </p>

          <Button
            size="lg"
            onClick={begin}
            className="mt-10 h-14 rounded-full bg-[#FABC05] px-10 text-lg font-black text-[#0D0D0D] hover:bg-[#FABC05]/90"
          >
            ابدأ الحديث
            <ArrowLeft className="mr-2 h-5 w-5" />
          </Button>
          <p className="mt-4 text-xs text-white/40">ابدأ فورا كضيف — الحساب يُطلب فقط عند حفظ نتيجتك وتخصيصها · بالمتابعة أنت توافق على استخدام إجاباتك لبناء التوصية</p>

          {/* بطاقة الاستئناف — تشخيص غير مكتمل ينتظر صاحبه */}
          {savedProgress && (
            <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 p-5">
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-[#6EC7D1]">
                <History className="h-4 w-4" />
                لديك تشخيص غير مكتمل — أجبت على {savedProgress.asked.length} من الأسئلة
              </p>
              <p className="mt-1.5 text-xs text-white/50">إجاباتك محفوظة على جهازك — أكمل من حيث توقفت متى شئت</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Button
                  onClick={resume}
                  className="rounded-full bg-[#38A7B4] px-6 font-black text-[#08272B] hover:bg-[#38A7B4]/90"
                >
                  أكمل من حيث توقفت
                  <ArrowLeft className="mr-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={discardSaved}
                  className="rounded-full border-white/20 text-white/70 hover:bg-white/5"
                >
                  احذفها وابدأ من جديد
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─── بوابة التسجيل — بعد النتيجة: لحفظها وفتح تفاصيلها ─── */}
      {stage === "gate" && (
        <section className="story-fade mx-auto max-w-3xl px-5 py-16">
          <AuthGate
            message="نتيجتك جاهزة — أنشئ حسابك المجاني لتحفظها وتفتح تفاصيلها الكاملة"
            onDone={() => {
              setAuthed(true);
              setStage("result");
            }}
          />
          <p className="mt-6 text-center text-xs text-white/40">
            يفتح لك الحساب: التفسير الكامل للتوصية · البدائل المناسبة · تخصيص المسار دورة بدورة · اعتماده ومتابعته
          </p>
          <button
            onClick={() => setStage("result")}
            className="mx-auto mt-4 block text-xs text-white/45 underline-offset-4 transition hover:text-[#6EC7D1] hover:underline"
          >
            عودة لملخص نتيجتي
          </button>
        </section>
      )}

      {/* ─── Questions ─── */}
      {stage === "questions" && question && (
        <section className="story-fade mx-auto max-w-2xl px-5 py-12 md:py-16">
          {offline && (
            <div role="status" className="mb-5 rounded-2xl border border-[#FABC05]/40 bg-[#FABC05]/10 px-5 py-3 text-center text-xs font-bold text-[#FABC05]">
              انقطع الاتصال بالشبكة — لا تقلق: تشخيصك يعمل على جهازك وإجاباتك محفوظة، أكمل بثقة
            </div>
          )}
          {/* شريط الوحدات الخمس — رحلة مفهومة لا استبيان لا نهائي */}
          <div className="mb-6">
            <div className="mb-4 flex items-center justify-between gap-1" dir="rtl">
              {JOURNEY_STAGES.map((s, i) => {
                const active = i === currentStageIdx;
                const done = passedStages.has(i) && !active;
                return (
                  <div key={s.key} className="flex flex-1 flex-col items-center gap-1.5">
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full border text-[11px] font-black transition ${
                        active
                          ? "border-[#FABC05] bg-[#FABC05] text-[#0D0D0D]"
                          : done
                            ? "border-[#38A7B4] bg-[#38A7B4]/20 text-[#6EC7D1]"
                            : "border-white/15 text-white/35"
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </span>
                    <span
                      className={`text-center text-[10px] font-bold leading-tight md:text-[11px] ${
                        active ? "text-[#FABC05]" : done ? "text-[#6EC7D1]" : "text-white/35"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mb-2 flex items-center justify-between text-xs text-white/50">
              <span>
                سؤال {asked.length + 1} من ~{estimatedTotal}
              </span>
              <span className="text-[#6EC7D1]">{question.moduleLabel}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-l from-[#38A7B4] to-[#FABC05] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* الإشارات الحية — المحرك يفهمك أثناء الحديث */}
          {understoodDims.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-white/45">
                <BrainCircuit className="h-3.5 w-3.5 text-[#38A7B4]" />
                يفهم الآن:
              </span>
              {understoodDims.map((d) => (
                <span
                  key={d}
                  className="rounded-full border border-[#38A7B4]/30 bg-[#38A7B4]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#6EC7D1]"
                >
                  {DIM_LABELS[d]}
                </span>
              ))}
              {prelimTop && (
                <span className="rounded-full border border-[#FABC05]/30 bg-[#FABC05]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#FABC05]">
                  التطابق الأولي: {prelimTop.name}
                </span>
              )}
            </div>
          )}

          <div key={question.id} className="story-fade">
            {(question.level === "deep" || question.level === "conditional") && (
              <p className="mb-4 w-fit rounded-full border border-[#FABC05]/40 bg-[#FABC05]/10 px-3 py-1 text-xs font-bold text-[#FABC05]">
                سؤال تعميق — بناءً على إجاباتك تحديدا
              </p>
            )}
            <h2 className="text-2xl font-black leading-snug md:text-3xl">{qText}</h2>
            {qHint && <p className="mt-3 text-sm leading-relaxed text-white/50">{qHint}</p>}
            {question.source && (
              <p className="mt-4 w-fit rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] leading-relaxed text-white/45">
                <span className="font-bold text-[#6EC7D1]">المصدر العلمي: </span>
                {question.source}
              </p>
            )}

            {question.type === "single" && (
              <div className="mt-8 grid gap-3">
                {qOptions.map((opt) => {
                  const selected = answers[question.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => answer(question.id, opt.value)}
                      className={`rounded-2xl border p-5 text-right transition-all ${
                        selected
                          ? "border-[#6EC7D1] bg-[#38A7B4]/15"
                          : "border-white/10 bg-white/[0.03] hover:border-[#6EC7D1]/60 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="text-base font-bold">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {question.type === "text" && (
              <div className="mt-8">
                <textarea
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  rows={4}
                  placeholder="اكتب بحرية… مثال: أعمل بنظام الورديات ووقتي متقطع، وأحلم أن أفتتح مشروعا صغيرا بعد سنتين"
                  className="w-full rounded-2xl border border-white/15 bg-white/[0.04] p-5 text-base leading-relaxed text-white placeholder:text-white/30 focus:border-[#6EC7D1] focus:outline-none"
                />
                <div className="mt-5 flex items-center justify-between">
                  <button
                    onClick={() => answer(question.id, "")}
                    className="text-sm font-semibold text-white/45 transition hover:text-white"
                  >
                    لا شيء إضافي — أنهِ التشخيص
                  </button>
                  <Button
                    onClick={() => answer(question.id, textDraft.trim())}
                    disabled={textDraft.trim().length === 0}
                    className="rounded-full bg-[#FABC05] px-8 font-black text-[#0D0D0D] hover:bg-[#FABC05]/90"
                  >
                    احفظ كلمتي وأظهر النتيجة
                    <ArrowLeft className="mr-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {question.type === "ratings" && question.items && (
              <div className="mt-8">
                <div className="grid gap-3">
                  {question.items.map((item) => (
                    <div key={item.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-sm font-bold">{item.label}</p>
                      <div className="mt-3 flex items-center gap-2" dir="ltr">
                        {[1, 2, 3, 4, 5].map((n) => {
                          const active = (ratingsDraft[item.key] ?? 0) >= n;
                          return (
                            <button
                              key={n}
                              onClick={() => setRatingsDraft({ ...ratingsDraft, [item.key]: n })}
                              aria-label={`${item.label}: مستوى ${n}`}
                              className={`h-10 flex-1 rounded-xl border text-sm font-black transition ${
                                active
                                  ? "border-[#38A7B4] bg-[#38A7B4]/25 text-[#6EC7D1]"
                                  : "border-white/10 bg-white/[0.03] text-white/35 hover:border-[#6EC7D1]/50"
                              }`}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-left text-[11px] text-white/35" dir="rtl">
                        {ratingsDraft[item.key]
                          ? ["", "لم أبدأ بعد", "أعرف الأساسيات", "أستخدمها بمساعدة", "أستخدمها بثقة", "أعلّمها لغيري"][ratingsDraft[item.key]]
                          : "اختر مستواك — بصدق"}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-xs text-white/40">
                    قيّمت {Object.keys(ratingsDraft).length} من {question.items.length}
                  </span>
                  <Button
                    onClick={() =>
                      answer(
                        question.id,
                        question.items!.map((i) => `${i.key}:${ratingsDraft[i.key] ?? 1}`).join(",")
                      )
                    }
                    disabled={Object.keys(ratingsDraft).length < question.items.length}
                    className="rounded-full bg-[#FABC05] px-8 font-black text-[#0D0D0D] hover:bg-[#FABC05]/90"
                  >
                    متابعة
                    <ArrowLeft className="mr-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {question.type === "multi" && (
              <div className="mt-8">
                <div className="grid gap-3 sm:grid-cols-2">
                  {qOptions.map((opt) => {
                    const selected = multiDraft.includes(opt.value);
                    const disabled =
                      !selected && opt.value !== "none" && question.maxSelect !== undefined && multiDraft.length >= question.maxSelect;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleMulti(question, opt.value)}
                        disabled={disabled}
                        className={`rounded-2xl border p-4 text-right transition-all ${
                          selected
                            ? "border-[#FABC05] bg-[#FABC05]/15"
                            : "border-white/10 bg-white/[0.03] hover:border-[#FABC05]/60 disabled:opacity-40"
                        }`}
                      >
                        <span className="flex items-center justify-between text-sm font-bold">
                          {opt.label}
                          {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#FABC05]" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-xs text-white/40">
                    {question.maxSelect ? `اختر حتى ${question.maxSelect} — ` : ""}اخترت {multiDraft.length}
                  </span>
                  <Button
                    onClick={() => submitMulti(question)}
                    disabled={multiDraft.length === 0}
                    className="rounded-full bg-[#FABC05] px-8 font-black text-[#0D0D0D] hover:bg-[#FABC05]/90"
                  >
                    متابعة
                    <ArrowLeft className="mr-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={back}
                className="flex items-center gap-2 text-sm font-semibold text-white/50 transition hover:text-white"
              >
                <ArrowRight className="h-4 w-4" />
                السؤال السابق
              </button>
              <button
                onClick={() => {
                  saveProgress(answers, asked);
                  setSavedFlash(true);
                  window.setTimeout(() => setSavedFlash(false), 2200);
                }}
                className={`flex items-center gap-2 text-sm font-semibold transition ${
                  savedFlash ? "text-[#6EC7D1]" : "text-white/50 hover:text-white"
                }`}
              >
                {savedFlash ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    حُفظ تقدمك — أكمل لاحقا متى شئت
                  </>
                ) : (
                  "احفظ وأكمل لاحقا"
                )}
              </button>
              {answers[question.id] && question.type === "single" && (
                <span className="flex items-center gap-1.5 text-xs text-[#6EC7D1]">
                  <CheckCircle2 className="h-4 w-4" /> تمت الإجابة
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── Computing ─── */}
      {stage === "computing" && (
        <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 text-center">
          <div className="relative">
            <div className="h-20 w-20 animate-spin rounded-full border-4 border-white/10 border-t-[#38A7B4]" />
            <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-[#FABC05]" />
          </div>
          <h2 className="mt-8 text-2xl font-black">جارٍ بناء توصيتك…</h2>
          <p className="mt-3 min-h-14 leading-loose text-white/55" aria-live="polite">
            {[
              "نقرأ قصتك وهدفك وظروف يومك…",
              "نطابق فجواتك مع كتالوج مساراتنا المصممة…",
              "نحسب درجة الثقة ونراجع الحالات الاستثنائية…",
            ][computeMsg % 3]}
          </p>
        </section>
      )}

      {/* ─── Result ─── */}
      {stage === "result" && result && topPathway && (
        <section className="story-fade mx-auto max-w-3xl px-5 py-12 md:py-16">
          <div className="text-center">
            <Badge className="border border-[#38A7B4]/40 bg-[#38A7B4]/10 text-[#6EC7D1]">اكتمل التشخيص</Badge>
            <h1 className="mt-4 text-3xl font-black md:text-4xl">مسارك الموصى به</h1>
            <div className="mx-auto mt-4 flex w-fit flex-wrap items-center justify-center gap-2">
              <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm">
                <Gauge className="h-4 w-4 text-[#FABC05]" />
                <span className="text-white/70">درجة الثقة:</span>
                <span className="font-black text-[#FABC05]">{result.confidence}%</span>
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/60">
                {result.confidenceBand}
              </span>
            </div>
            {/* شرح الثقة بلغة مبسطة — شفافية لا صناديق سوداء */}
            <details className="mx-auto mt-4 max-w-md rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right text-xs leading-relaxed text-white/55 print:hidden">
              <summary className="cursor-pointer text-center font-bold text-white/70">كيف حسبنا درجة الثقة؟</summary>
              <p className="mt-2">
                تبدأ من اكتمال صورتك: كل إجابة توضّح هدفك وواقعك ومهاراتك أكثر. ترتفع الدرجة عندما تتفق
                إجاباتك مع بعضها، وتنخفض عند التناقض أو عندما تقف حالتك بين مسارين متقاربين.
                فوق ٧٥٪ المحرك واثق بتوصيته، وبين ٥٠ و٧٥٪ التوصية قوية ونعرض معها بدائل،
                ودون ذلك نحيلك لمستشار بشري قبل أي قرار.
              </p>
            </details>
            <button
              onClick={() => window.print()}
              className="mx-auto mt-4 flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/60 transition hover:border-[#6EC7D1]/50 hover:text-[#6EC7D1] print:hidden"
            >
              <FileText className="h-3.5 w-3.5" />
              اطبع نتيجتك أو حمّلها ملفا
            </button>
          </div>

          {/* قصتك كما فهمناها — يقرأ نفسه قبل أن يرى التوصية */}
          {storySummary(answers).length > 0 && (
            <div className="card-soft mt-10 border-[#38A7B4]/30">
              <h3 className="h-card flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-[#6EC7D1]" />
                قصتك كما فهمناها
              </h3>
              <div className="mt-4 space-y-2.5">
                {storySummary(answers).map((line) => (
                  <p key={line} className="flex items-start gap-3 text-sm leading-relaxed text-white/75">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#38A7B4]" />
                    {line}
                  </p>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-white/40">
                كل توصية في هذه الصفحة مبنية على هذه الفقرة — إن كانت لا تشبهك، أعد التشخيص وستتغير النتيجة معك.
              </p>
            </div>
          )}

          {/* خريطة المهارات المرئية */}
          <SkillMap answers={answers} />

          {/* Top pathway card */}
          <div className="mt-10 overflow-hidden rounded-3xl border border-[#38A7B4]/40 bg-gradient-to-b from-[#12343B] to-[#0D0D0D]">
            <div className="border-b border-white/10 bg-[#38A7B4]/10 px-6 py-3 text-sm font-bold text-[#6EC7D1]">
              التوصية الأولى
            </div>
            <div className="p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-[#FABC05] font-black text-[#0D0D0D]">{topPathway.badge ?? topPathway.sector}</Badge>
                <Badge variant="outline" className="border-white/20 text-white/70">{topPathway.sector}</Badge>
                <Badge variant="outline" className="border-white/20 text-white/70">{topPathway.level}</Badge>
              </div>
              <h2 className="mt-4 text-2xl font-black leading-snug md:text-3xl">{topPathway.name}</h2>
              <p className="mt-4 leading-loose text-white/70">{topPathway.transformation}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white/[0.05] p-4">
                  <CalendarClock className="h-5 w-5 text-[#6EC7D1]" />
                  <p className="mt-2 text-sm text-white/50">المدة</p>
                  <p className="font-black">{topPathway.durationWeeks} أسبوعًا</p>
                </div>
                <div className="rounded-xl bg-white/[0.05] p-4">
                  <Clock3 className="h-5 w-5 text-[#6EC7D1]" />
                  <p className="mt-2 text-sm text-white/50">الوقت الأسبوعي</p>
                  <p className="font-black">{topPathway.weeklyHours}</p>
                </div>
                <div className="rounded-xl bg-white/[0.05] p-4">
                  <RouteIcon className="h-5 w-5 text-[#6EC7D1]" />
                  <p className="mt-2 text-sm text-white/50">المخرج العملي</p>
                  <p className="text-sm font-bold leading-relaxed">{topPathway.output}</p>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-2 text-sm font-bold text-white/60">المهارات المحورية التي ستبنيها:</p>
                <div className="flex flex-wrap gap-2">
                  {topPathway.coreSkills.map((s) => (
                    <span key={s} className="rounded-full border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-3 py-1 text-xs font-semibold text-[#6EC7D1]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {result.gaps.length > 0 && (
                <p className="mt-5 rounded-xl border border-[#FABC05]/30 bg-[#FABC05]/5 p-4 text-sm leading-relaxed text-white/70">
                  <span className="font-bold text-[#FABC05]">فجواتك الحالية التي سيركّز عليها المسار: </span>
                  {result.gaps.join("، ")}.
                </p>
              )}

              <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-white/70">
                <span className="font-bold text-[#6EC7D1]">ماذا يشمل مسارك: </span>
                الدورات المسجلة والمباشرة، والتشخيص الكامل، والمتابعة الأسبوعية، والمراجعة البشرية،
                وملخصات كتب تسمعها وتُختبر فيها — ودورة إضافية مجانية هدية من وجيز.
                تفاصيل الاستثمار والخصم تجدها في صفحة مسارك بعد اعتماده.
              </p>
            </div>
          </div>

          {/* التفاصيل الكاملة تُفتح بحساب مجاني — ما فوق هذا السطر متاح للضيف كملخص أولي */}
          {authed ? (
            <>
          {/* رحلة المسار خطوة بخطوة — خط زمني لا قائمة */}
          <JourneyTimeline pathway={topPathway} />

          {/* Why this recommendation */}
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <h3 className="flex items-center gap-2 text-lg font-black">
              <Sparkles className="h-5 w-5 text-[#FABC05]" />
              لماذا هذا المسار تحديدًا؟
            </h3>
            <ul className="mt-4 space-y-3">
              {result.reasons.map((r) => (
                <li key={r} className="flex items-start gap-3 text-sm leading-relaxed text-white/70">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#38A7B4]" />
                  {r}
                </li>
              ))}
            </ul>
            {answers["notes"] && (
              <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-white/60">
                <span className="font-bold text-[#6EC7D1]">وكلمتك محفوظة: </span>«{answers["notes"]}» —
                سيقرأها مستشارك قبل أول جلسة لتكون خطتك أدق.
              </p>
            )}
            {answers["emp_moment"] && (
              <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-white/60">
                <span className="font-bold text-[#6EC7D1]">وقصتك وصلت: </span>«{answers["emp_moment"]}» —
                سيقرأها مدربك قبل أول لقاء ليعرف من أين يبدأ معك.
              </p>
            )}
          </div>

          {/* تقاطع الرصيد السابق مع دورات التوصية — لا يدفع ثمن ما يعرفه */}
          {result.priorOverlap.length > 0 && (
            <div className="mt-8 rounded-3xl border border-[#FABC05]/40 bg-[#FABC05]/5 p-6 md:p-8">
              <h3 className="flex items-center gap-2 text-lg font-black text-[#FABC05]">
                <BookOpen className="h-5 w-5" />
                انتبه — رصيدك السابق يتقاطع مع هذا المسار
              </h3>
              <p className="mt-3 text-sm leading-loose text-white/70">
                كتبت أنك درست سابقا ما يشبه: <span className="font-bold text-white">{result.priorOverlap.join("، ")}</span>.
                راجع محاورها قبل الدفع — وإن كنت أتقنتها فعلا، اطلب من مستشارك استبدالها بدورة أعمق،
                فوعدنا أنك لن تدفع ثمن ما تعرفه أصلا.
              </p>
            </div>
          )}

          {/* خريطة فجواتك التفصيلية */}
          {result.gapDetails.length > 0 && (
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <h3 className="flex items-center gap-2 text-lg font-black">
                <Gauge className="h-5 w-5 text-[#6EC7D1]" />
                خريطة فجواتك — مهارة بمهارة
              </h3>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-white/45">
                      <th className="pb-3 font-semibold">المهارة</th>
                      <th className="pb-3 font-semibold">مستواك الآن</th>
                      <th className="pb-3 font-semibold">المستهدف</th>
                      <th className="pb-3 font-semibold">الأولوية</th>
                      <th className="pb-3 font-semibold">تغطيها</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.gapDetails.map((g) => (
                      <tr key={g.skill} className="border-b border-white/5">
                        <td className="py-3 font-bold text-white/85">{g.skill}</td>
                        <td className="py-3 text-white/55">{g.current}</td>
                        <td className="py-3 text-white/55">{g.target}</td>
                        <td className="py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              g.priority === "عالية"
                                ? "bg-[#FABC05]/15 text-[#FABC05]"
                                : "bg-white/10 text-white/60"
                            }`}
                          >
                            {g.priority}
                          </span>
                        </td>
                        <td className="py-3 text-xs leading-relaxed text-[#6EC7D1]">
                          {g.coveredBy.length > 0 ? g.coveredBy.join("، ") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* مهارات مهمة غير متوفرة حاليا — صدق كامل */}
          {result.unavailableSkills.length > 0 && (
            <div className="mt-8 rounded-3xl border border-[#FABC05]/40 bg-[#FABC05]/5 p-6 md:p-8">
              <h3 className="flex items-center gap-2 text-lg font-black text-[#FABC05]">
                <BellRing className="h-5 w-5" />
                مهارات تحتاجها ولا نغطيها بعد — ولن نخفي ذلك عنك
              </h3>
              <p className="mt-3 text-sm leading-loose text-white/70">
                فجواتك في {result.unavailableSkills.join(" و")} مهمة لهدفك، لكن كتالوجنا الحالي لا يغطيها بعد.
                نفضل أن تعرف الحقيقة كاملة على أن نبيعك مسارا ناقصا.
              </p>
              <Button variant="outline" className="mt-4 border-[#FABC05]/60 text-[#FABC05] hover:bg-[#FABC05]/10" asChild>
                <a
                  href={`mailto:care@wajeez.com?subject=${encodeURIComponent("أشعرني عند توفر: " + result.unavailableSkills.join("، "))}`}
                >
                  أشعِرني عند توفرها
                </a>
              </Button>
            </div>
          )}

          {/* ما قد يغير نتيجتك */}
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <h3 className="flex items-center gap-2 text-lg font-black">
              <Lightbulb className="h-5 w-5 text-[#6EC7D1]" />
              معلومات قد تغيّر نتيجتك
            </h3>
            <ul className="mt-4 space-y-2.5">
              {result.changeMakers.map((c) => (
                <li key={c} className="flex items-start gap-3 text-sm leading-relaxed text-white/60">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6EC7D1]" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          {/* Advisor flag */}
          {result.needsAdvisor && (
            <div className="mt-8 rounded-3xl border border-[#FABC05]/40 bg-[#FABC05]/5 p-6 md:p-8">
              <h3 className="flex items-center gap-2 text-lg font-black text-[#FABC05]">
                <UserCheck className="h-5 w-5" />
                حالتك تستحق جلسة مع مستشار بشري
              </h3>
              <p className="mt-3 text-sm leading-loose text-white/70">
                المحرك غير متأكد تمامًا من التوصية الأنسب لحالتك، أو أنك طلبت استشارة شخصية.
                نوصي بجلسة تعريفية مع مستشار وجيز (30 دقيقة) لصياغة خطتك بدقة — التشخيص الذي
                أتممته للتو سيجعل الجلسة أقصر وأعمق.
              </p>
              <Button variant="outline" className="mt-4 border-[#FABC05]/60 text-[#FABC05] hover:bg-[#FABC05]/10" asChild>
                <a href="mailto:care@wajeez.com?subject=طلب جلسة مستشار بعد التشخيص">احجز جلسة مستشار</a>
              </Button>
            </div>
          )}

          {/* مقارنة الخيارات الثلاثة — الأساسي والأسرع والأوفر في ميزان واحد */}
          {(result.faster || result.cheaper) && (
            <div className="card-soft mt-8">
              <h3 className="h-card">خياراتك الثلاثة في ميزان واحد — بدّل بثقة</h3>
              <p className="mt-2 text-xs leading-relaxed text-white/50">
                ثلاثة مسارات انتقاها المحرك لحالتك تحديدا: توصيتنا الأساسية، وبديل أسرع، وبديل أوفر — والقرار الأخير لك.
                تفاصيل الاستثمار تظهر في صفحة المسار بعد اعتماده.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {/* الأساسي */}
                <div className="flex flex-col rounded-2xl border border-[#38A7B4]/50 bg-[#38A7B4]/10 p-5">
                  <span className="kicker">توصيتك الحالية</span>
                  <h4 className="mt-3 text-sm font-black leading-snug">{topPathway.name}</h4>
                  <dl className="mt-3 space-y-1.5 text-xs text-white/55">
                    <div className="flex items-center justify-between gap-2">
                      <dt>المدة</dt>
                      <dd className="font-bold text-white/85">{topPathway.durationWeeks} أسبوعا</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt>الوقت الأسبوعي</dt>
                      <dd className="font-bold text-white/85">{topPathway.weeklyHours}</dd>
                    </div>
                  </dl>
                  <span className="mt-4 flex items-center gap-1.5 text-xs font-bold text-[#6EC7D1]">
                    <CheckCircle2 className="h-4 w-4" />
                    هذا خيارك المعروض أعلاه
                  </span>
                </div>
                {/* الأسرع */}
                {result.faster && (
                  <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <span className="kicker">
                      <Zap className="h-3 w-3" /> بديل أسرع
                    </span>
                    <h4 className="mt-3 text-sm font-black leading-snug">{result.faster.name}</h4>
                    <dl className="mt-3 space-y-1.5 text-xs text-white/55">
                      <div className="flex items-center justify-between gap-2">
                        <dt>المدة</dt>
                        <dd className="font-bold text-white/85">{result.faster.durationWeeks} أسبوعا</dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt>الوقت الأسبوعي</dt>
                        <dd className="font-bold text-white/85">{result.faster.weeklyHours}</dd>
                      </div>
                    </dl>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => swapTop(result.faster!, "faster")}
                      className="mt-4 w-fit border-[#38A7B4]/50 text-[#6EC7D1] hover:bg-[#38A7B4]/15"
                    >
                      <RefreshCcw className="ml-2 h-3.5 w-3.5" />
                      اجعله توصيتي الأولى
                    </Button>
                  </div>
                )}
                {/* الأوفر */}
                {result.cheaper && (
                  <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <span className="kicker-amber">
                      <Wallet className="h-3 w-3" /> بديل أوفر
                    </span>
                    <h4 className="mt-3 text-sm font-black leading-snug">{result.cheaper.p.name}</h4>
                    <dl className="mt-3 space-y-1.5 text-xs text-white/55">
                      <div className="flex items-center justify-between gap-2">
                        <dt>المدة</dt>
                        <dd className="font-bold text-white/85">{result.cheaper.p.durationWeeks} أسبوعا</dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt>الوقت الأسبوعي</dt>
                        <dd className="font-bold text-white/85">{result.cheaper.p.weeklyHours}</dd>
                      </div>
                    </dl>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => swapTop(result.cheaper!.p, "cheaper")}
                      className="mt-4 w-fit border-[#38A7B4]/50 text-[#6EC7D1] hover:bg-[#38A7B4]/15"
                    >
                      <RefreshCcw className="ml-2 h-3.5 w-3.5" />
                      اجعله توصيتي الأولى
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* تخصيص المسار */}
          <CustomizePathway pathway={topPathway} gaps={result.gaps} onReset={swapCount} />

          {/* CTA — قرار واحد واضح: اعتماد المسار */}
          <div className="mt-10 rounded-3xl bg-[#FABC05] p-6 text-center text-[#0D0D0D] md:p-8">
            <h3 className="text-xl font-black md:text-2xl">مسارك جاهز — بقي قرارك</h3>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed text-[#0D0D0D]/75">
              اعتمده الآن لتفتح صفحته الكاملة: مدربوه، وجدوله، وتفاصيل الاستثمار وقيمة الخصم —
              ومنها تبدأ رحلتك فعليا.
            </p>
            <div className="mt-6">
              <Button size="lg" className="h-14 rounded-full bg-[#0D0D0D] px-12 text-lg font-black text-white hover:bg-[#0D0D0D]/85" asChild>
                <Link to={`/pathways/${topPathway.id}`}>
                  اعتمد مساري «{topPathway.name}»
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
            <button
              onClick={restart}
              className="mx-auto mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#0D0D0D]/60 transition hover:text-[#0D0D0D]"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              لا يشبهني؟ أعد التشخيص من جديد
            </button>
          </div>
            </>
          ) : (
            /* بطاقة الضيف — رأى الملخص الأولي، والتفاصيل الكاملة بانتظار حساب يحفظها */
            <div className="mt-10 overflow-hidden rounded-3xl border border-[#FABC05]/40 bg-gradient-to-b from-[#2A2200] to-[#0D0D0D] p-6 text-center md:p-10">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#FABC05]/15">
                <Lock className="h-7 w-7 text-[#FABC05]" />
              </span>
              <h3 className="mt-5 text-xl font-black md:text-2xl">ملخصك بيدك الآن — والتفاصيل الكاملة تنتظرك</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-loose text-white/60">
                رأيت مسارك الموصى به وقصتك وخريطة مهاراتك. أنشئ حسابك المجاني لتحفظ نتيجتك وتفتح:
              </p>
              <div className="mx-auto mt-6 grid max-w-lg gap-2.5 text-right sm:grid-cols-2">
                {[
                  "التفسير الكامل: لماذا هذا المسار تحديدا",
                  "البدائل المناسبة: أسرع وأوفر — بدّل بثقة",
                  "تخصيص المسار: احذف وأضف دورات كما تشاء",
                  "اعتماد المسار وفتح صفحته وتقريرك الشخصي",
                ].map((f) => (
                  <p key={f} className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold leading-relaxed text-white/75">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FABC05]" />
                    {f}
                  </p>
                ))}
              </div>
              <Button
                size="lg"
                onClick={() => setStage("gate")}
                className="mt-8 h-14 rounded-full bg-[#FABC05] px-10 text-lg font-black text-[#0D0D0D] hover:bg-[#FABC05]/90"
              >
                احفظ نتيجتي وافتح التفاصيل
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Button>
              <p className="mt-3 text-[11px] text-white/40">حساب مجاني بالبريد فقط — نتيجتك محفوظة على جهازك ولن تضيع</p>
              <button
                onClick={restart}
                className="mx-auto mt-4 flex items-center gap-1.5 text-xs font-semibold text-white/45 transition hover:text-white"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                لا يشبهني؟ أعد التشخيص من جديد
              </button>
            </div>
          )}

          <p className="mt-6 text-center text-xs leading-relaxed text-white/35">
            التوصية صادرة عن محرك تشخيص قطعي مبني على إجاباتك، وهي نقطة بداية مفسَّرة —
            القرار النهائي دائمًا بيدك، ومستشارونا موجودون عند الحاجة.
            هذا تشخيص تعليمي مهني: ليس تقييما نفسيا أو طبيا، ولا وعدا بوظيفة أو دخل.
          </p>
        </section>
      )}
    </div>
  );
}

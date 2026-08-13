import { useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AuthGate from "@/components/AuthGate";
import {
  nextQuestion,
  estimateTotal,
  buildState,
  computeResult,
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
              <p className="text-2xl font-black text-[#FABC05]">{price}$</p>
              <p className="text-xs text-white/55">
                {saving > 0 ? `وفّرت ${saving}$ عن ${separateCost}$ منفردة` : "سعر المسار التفضيلي"}
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

  const isAuthed = () => Boolean(localStorage.getItem("wajeez_user"));

  /* حالة الفهم الحية — تتحدث مع كل إجابة */
  const state = useMemo(() => buildState(answers, asked.length), [answers, asked]);
  const estimatedTotal = useMemo(() => estimateTotal(answers, asked), [answers, asked]);
  const progress = Math.min(100, Math.round(((asked.length + (question ? 1 : 0)) / estimatedTotal) * 100));
  const understoodDims = (Object.keys(DIM_LABELS) as Dim[]).filter((d) => state.dims[d] >= 0.6);
  const prelimTop = state.overall >= 0.3 ? state.ranked[0]?.p : undefined;

  // التسجيل أولا — ثم يبدأ من حيث انتهت لمحة «جرّب بنفسك» — لا سؤال يتكرر
  const begin = () => {
    if (!isAuthed()) {
      setStage("gate");
      return;
    }
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

  const finish = (finalAnswers: DiagAnswers) => {
    setStage("computing");
    const res = computeResult(finalAnswers);
    // نحفظ إجاباته ونتيجته وJSON القرار لبناء تقريره الشخصي في صفحة المسار
    sessionStorage.setItem("wajeez_diag_answers", JSON.stringify(finalAnswers));
    sessionStorage.setItem("wajeez_diag_top", res.top.id);
    sessionStorage.setItem("wajeez_result_json", JSON.stringify(res.resultJson));
    window.setTimeout(() => {
      setResult(res);
      setTopPathway(res.top);
      setStage("result");
    }, 1800);
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
  const topPrice = topPathway
    ? pathwayPriceFor((pathwayCourses[topPathway.id] ?? []).length || 6)
    : 600;
  const topSeparate = topPathway
    ? (pathwayCourses[topPathway.id] ?? [])
        .map((id) => courseById(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .reduce((s, c) => s + coursePriceOf(c), 0)
    : 0;

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
              { icon: ShieldCheck, text: "سرّي — ليس اختبارًا نفسيًا" },
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
          <p className="mt-4 text-xs text-white/40">يتطلب حسابا ليُحفظ تشخيصك ومسارك · بالمتابعة أنت توافق على استخدام إجاباتك لبناء التوصية</p>
        </section>
      )}

      {/* ─── بوابة التسجيل ─── */}
      {stage === "gate" && (
        <section className="story-fade mx-auto max-w-3xl px-5 py-16">
          <AuthGate
            message="خطوة واحدة قبل تشخيصك — سجّل ليُحفظ مسارك ونتيجتك في حسابك"
            onDone={start}
          />
          <p className="mt-6 text-center text-xs text-white/40">
            التسجيل يفتح لك: نتيجة التشخيص · تخصيص المسار · صفحة مسارك وتقريرك الشخصي
          </p>
        </section>
      )}

      {/* ─── Questions ─── */}
      {stage === "questions" && question && (
        <section className="story-fade mx-auto max-w-2xl px-5 py-12 md:py-16">
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between text-xs text-white/50">
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
          <p className="mt-3 leading-loose text-white/55">
            نطابق قصتك وهدفك وفجواتك مع أكثر من 45 مسارًا مصممًا،
            <br />
            ونحسب درجة الثقة ونراجع الحالات الاستثنائية.
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
          </div>

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
                <span className="font-bold text-[#6EC7D1]">قيمة مسارك: </span>
                دوراته مجتمعة تكلف {topSeparate}$ لو اشتريتها منفردة — تأخذها كلها بسعر تفضيلي {topPrice}$،
                ويشمل التشخيص والمتابعة الأسبوعية والمراجعة البشرية، ودورة إضافية مجانية هدية من وجيز.
              </p>
            </div>
          </div>

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

          {/* البديلان المنتقى — أسرع وأقل تكلفة */}
          {(result.faster || result.cheaper) && (
            <div className="mt-8">
              <h3 className="text-lg font-black text-white/85">بديلان منتقىان لحالتك — بدّل إن شئت</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {result.faster && (
                  <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <span className="flex w-fit items-center gap-1.5 rounded-full bg-[#38A7B4]/15 px-3 py-1 text-[11px] font-bold text-[#6EC7D1]">
                      <Zap className="h-3 w-3" /> بديل أسرع
                    </span>
                    <h4 className="mt-3 font-black leading-snug">{result.faster.name}</h4>
                    <p className="mt-2 text-xs leading-relaxed text-white/50">{result.faster.transformation}</p>
                    <p className="mt-3 text-xs text-white/45">
                      {result.faster.durationWeeks} أسبوعًا · {result.faster.weeklyHours}
                    </p>
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
                {result.cheaper && (
                  <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <span className="flex w-fit items-center gap-1.5 rounded-full bg-[#FABC05]/15 px-3 py-1 text-[11px] font-bold text-[#FABC05]">
                      <Wallet className="h-3 w-3" /> أقل تكلفة — {result.cheaper.price}$
                    </span>
                    <h4 className="mt-3 font-black leading-snug">{result.cheaper.p.name}</h4>
                    <p className="mt-2 text-xs leading-relaxed text-white/50">{result.cheaper.p.transformation}</p>
                    <p className="mt-3 text-xs text-white/45">
                      {result.cheaper.p.durationWeeks} أسبوعًا · {result.cheaper.p.weeklyHours}
                    </p>
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

          {/* CTA */}
          <div className="mt-10 rounded-3xl bg-[#FABC05] p-6 text-center text-[#0D0D0D] md:p-8">
            <h3 className="text-xl font-black md:text-2xl">جاهز تبدأ «{topPathway.name}»؟</h3>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-[#0D0D0D]/75">
              {answers["commit_pref"] === "single_course" ? (
                <>
                  اخترت أن تبدأ بدورة واحدة أولا — خطوة ذكية: دورات هذا المسار منفردة 130–180$،
                  وإن أحببت التجربة فالمسار كاملا بـ<span className="font-black">{topPrice}$</span> بدل{' '}
                  <span className="font-black line-through decoration-2">{topSeparate}$</span> مع دورة إضافية هدية.
                </>
              ) : (
                <>
                  قيمة دورات هذا المسار منفردة: <span className="font-black line-through decoration-2">{topSeparate}$</span> —
                  تأخذها كلها مع التشخيص والمتابعة والشهادة بـ<span className="font-black">{topPrice}$</span> فقط،
                  أو ابدأ بدورة واحدة 130–180$
                </>
              )}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button size="lg" className="h-12 rounded-full bg-[#0D0D0D] px-8 font-black text-white hover:bg-[#0D0D0D]/85" asChild>
                <Link to={`/pathways/${topPathway.id}`}>افتح صفحة مساري</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={restart}
                className="h-12 rounded-full border-[#0D0D0D]/40 bg-transparent px-8 font-black text-[#0D0D0D] hover:bg-[#0D0D0D]/10"
              >
                <RefreshCcw className="ml-2 h-4 w-4" />
                أعد التشخيص
              </Button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-white/35">
            التوصية صادرة عن محرك تشخيص قطعي مبني على إجاباتك، وهي نقطة بداية مفسَّرة —
            القرار النهائي دائمًا بيدك، ومستشارونا موجودون عند الحاجة.
          </p>
        </section>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
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
  Gift,
  Wand2,
  BookOpen,
  BrainCircuit,
  BellRing,
  Zap,
  Wallet,
  History,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { track } from "@/services/analytics";
import { apiPost } from "@/services/api";
import { ensurePublishedSnapshot } from "@/services/catalog-snapshot";
import { ensurePublishedContent } from "@/services/public-content";
import SeoHead from "@/components/SeoHead";
import EcosystemNote from "@/components/EcosystemNote";
import { Badge } from "@/components/ui/badge";
import ResultGate from "@/components/ResultGate";
import ResultFeedback from "@/components/ResultFeedback";
import CourseJourney, { type CourseSuggestion } from "@/components/CourseJourney";
import { ResultErrorBoundary } from "@/components/ResultErrorBoundary";
import SkillFamilyGrid, { type FamilyToRate } from "@/components/SkillFamilyGrid";
import ComposedPlanCard, { type ComposedPathView } from "@/components/ComposedPlanCard";
import {
  type DiagQuestion,
  type DiagOption,
  type DiagResult,
  type Dim,
} from "@/data/diagnostic";
import { AssessmentSession, createAssessment, diagQuestionById } from "@/application/diagnostic/assessment-service";
import type { DeepeningComparison } from "@/application/diagnostic/assessment-service";
import { loadSession, saveLastResult, loadLastResultSafe } from "@/application/diagnostic/session-store";
import {
  courseById,
  pathwayCourses,
  pathwayDelivery,
  courses,
  pathwayPriceFor,
  MIN_PATHWAY_COURSES,
  MAX_PATHWAY_COURSES,
  weeksLabel,
} from "@/data/courses";
import AdvisorContact from "@/components/AdvisorContact";
import { pathways, type Pathway } from "@/data/pathways";

type DiagAnswers = Record<string, string>;
type Stage = "intro" | "questions" | "skills" | "computing" | "result";

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
  if (m === "M0" || m === "M1") return 0;
  if (m === "M2" || m === "M2B" || m === "M8") return 1;
  if (m.startsWith("M3")) return 2;
  if (m === "M4" || m === "M4B" || m === "M5" || m === "M6") return 3;
  return 4; // M7 وM9
}

/* ═══════════ الحفظ والاستئناف — عبر مستودع الجلسة المحلي (demo-only) ═══════════ */
interface SavedProgress {
  answers: DiagAnswers;
  asked: string[];
  savedAt: number;
}
/** قراءة تقدم محفوظ من المستودع الجديد */
function loadProgress(): SavedProgress | null {
  const s = loadSession();
  if (!s || s.answers.length < 2) return null;
  return {
    answers: Object.fromEntries(
      s.answers.map((a) => [a.questionId, Array.isArray(a.value) ? a.value.join(",") : a.value])
    ),
    asked: s.answers.map((a) => a.questionId),
    savedAt: Date.parse(s.savedAt) || Date.now(),
  };
}
function clearProgress() {
  /* الإزالة الفعلية تتم عبر AssessmentSession.abandon() أو عند الحفظ النهائي */
}


/* ═══════════ رحلة الدورات القابلة للتخصيص — «ماذا ستحقق من خلال خطتك؟» ═══════════ */

/* ─────────── رحلة الدورات القابلة للتخصيص — دمج التخصيص داخل «ماذا ستحقق من خلال خطتك؟» ─────────── */
function PlanCourses({
  pathway,
  gaps,
  authed,
  resetKey,
}: {
  pathway: Pathway;
  gaps: string[];
  authed: boolean;
  resetKey: number; // يتغير عند تبديل المسار لإعادة التهيئة
}) {
  const baseIds = pathwayCourses[pathway.id] ?? [];
  const [chosenIds, setChosenIds] = useState<string[]>(baseIds.slice(0, MAX_PATHWAY_COURSES));
  const [giftId, setGiftId] = useState<string | null>(null);
  const [swapForId, setSwapForId] = useState<string | null>(null);
  const [lastReset, setLastReset] = useState(resetKey);

  if (lastReset !== resetKey) {
    setLastReset(resetKey);
    setChosenIds((pathwayCourses[pathway.id] ?? []).slice(0, MAX_PATHWAY_COURSES));
    setGiftId(null);
    setSwapForId(null);
  }

  const base = baseIds.map((id) => courseById(id)!).filter(Boolean);
  const category = base[0]?.category ?? "أساسيات";

  /* مقترحات: من نفس المجال أولا، وأولوية لما يعالج فجوات المستخدم */
  const pool = useMemo<CourseSuggestion[]>(() => {
    const chosenSet = new Set(chosenIds);
    if (giftId) chosenSet.add(giftId);
    return courses
      .filter((c) => c.category === category && !chosenSet.has(c.id))
      .sort((x, y) => {
        const xm = gaps.some((g) => x.skill && g.includes(x.skill.slice(0, 8))) ? 1 : 0;
        const ym = gaps.some((g) => y.skill && g.includes(y.skill.slice(0, 8))) ? 1 : 0;
        return ym - xm;
      })
      .slice(0, 6)
      .map((c) => ({ id: c.id, name: c.name, note: `${c.skill} · من مسار ${c.pathwayName}` }));
  }, [chosenIds, giftId, category, gaps]);

  /* يُحفظ التخصيص فوريا مع كل تغيير — يظهر في صفحة المسار بعد اعتماده */
  const persist = (ids: string[], gift: string | null) => {
    sessionStorage.setItem("wajeez_custom", JSON.stringify({ pathwayId: pathway.id, chosenIds: ids, giftId: gift }));
  };
  const swapPick = (oldId: string, newId: string) => {
    const next = chosenIds.map((i) => (i === oldId ? newId : i));
    setChosenIds(next);
    setSwapForId(null);
    persist(next, giftId);
  };
  const removeCourse = (id: string) => {
    if (chosenIds.length <= MIN_PATHWAY_COURSES) return;
    const next = chosenIds.filter((i) => i !== id);
    setChosenIds(next);
    if (swapForId === id) setSwapForId(null);
    persist(next, giftId);
  };
  const addCourse = (id: string) => {
    if (chosenIds.length >= MAX_PATHWAY_COURSES) return;
    const next = [...chosenIds, id];
    setChosenIds(next);
    persist(next, giftId);
  };
  const giftToggle = (id: string) => {
    const next = giftId === id ? null : id; // الهدية فوق المسار ولا تُحتسب في العدد
    setGiftId(next);
    persist(chosenIds, next);
  };

  const shownIds = giftId ? [...chosenIds, giftId] : chosenIds;
  const chosen = chosenIds.map((id) => courseById(id)!).filter(Boolean);
  const gift = giftId ? courseById(giftId) : undefined;
  const allShown = gift ? [...chosen, gift] : chosen;
  const totalWeeks = allShown.reduce((s, c) => s + c.weeks, 0);
  const skills = Array.from(new Set(allShown.map((c) => c.skill).filter(Boolean))).slice(0, 8);

  return (
    <>
      <CourseJourney
        courseIds={shownIds}
        delivery={pathwayDelivery(pathway.id)}
        edit={
          authed
            ? {
                giftId,
                swapForId,
                pool,
                minReached: chosenIds.length <= MIN_PATHWAY_COURSES,
                maxReached: chosenIds.length >= MAX_PATHWAY_COURSES,
                onSwapToggle: setSwapForId,
                onSwapPick: swapPick,
                onRemove: removeCourse,
                onAdd: addCourse,
                onGiftToggle: giftToggle,
              }
            : undefined
        }
      />
      {authed && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
          <p className="text-xs font-bold text-white/60">
            مسارك المخصص الآن:{" "}
            <span className="text-white">
              {chosen.length} دورات{gift ? " + هدية مجانية" : ""}
            </span>
            <span className="text-white/40"> · ~{totalWeeks} أسبوعا · يُحفظ تخصيصك تلقائيا ويظهر في صفحة مسارك بعد الاعتماد</span>
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <span key={s} className="rounded-full border border-teal/40 bg-teal/10 px-2.5 py-0.5 text-[11px] font-semibold text-teal-light-ink">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────── الخطة المركبة المخصصة — تعرض عندما يختار المحرك قالبا مركبا ─────────── */
interface CompositeView {
  template_id: string;
  name_ar: string;
  variant: "starter" | "full" | "extended";
  label_ar: string;
  courses: { courseId: string; titleAr: string; hours: number; sequence: number; type: "required" | "conditional" | "bridge"; reason_ar: string }[];
  fit: number;
  removed_courses: { courseId: string; titleAr: string; reason_ar: string }[];
  missing_required_facts: string[];
  rationale_ar: string[];
  represented_pathway_ids: string[];
  capstone_ar: string | null;
  success_metric_ar: string | null;
  nearest_alternative: { templateId: string; nameAr: string; fit: number; whyNot_ar: string } | null;
  advisor_handoff: { filterId: string; rationale_ar: string } | null;
}

const VARIANT_AR: Record<CompositeView["variant"], { label: string; hint: string }> = {
  starter: { label: "نسخة البداية", hint: "جوهر الخطة بأقل عبء — تبدأ بها وتتوسع لاحقا" },
  full: { label: "النسخة الكاملة", hint: "كل الدورات الأساسية مع ما يناسب ظرفك من الشرطية" },
  extended: { label: "النسخة الموسعة", hint: "الكاملة مع دورات جسرية تربط المجالين" },
};

function CompositePlan({ composite }: { composite: CompositeView }) {
  const totalHours = composite.courses.reduce((s, c) => s + c.hours, 0);
  const variant = VARIANT_AR[composite.variant] ?? VARIANT_AR.full;
  const represented = composite.represented_pathway_ids
    .map((id) => pathways.find((p) => p.id === id))
    .filter((p): p is Pathway => Boolean(p));
  return (
    <div className="mt-10 overflow-hidden rounded-3xl border border-[#FABC05]/40 bg-gradient-to-b from-surface to-paper">
      <div className="border-b border-white/10 bg-[#FABC05]/10 px-6 py-3">
        <span className="text-sm font-black text-[#FABC05]">التوصية الأولى · {composite.label_ar}</span>
        <span className="mr-2 text-xs text-white/50">
          خطة مبنية لحالتك من أكثر من مجال — وليست مسارا جاهزا من الكتالوج
        </span>
      </div>
      <div className="p-6 md:p-8">
        <h3 className="text-xl font-black leading-snug md:text-2xl">{composite.name_ar}</h3>

        {/* المسارات التي استُمدت منها الخطة */}
        {represented.length > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-white/55">
            رُكّبت من: {represented.map((p) => p.name).join(" + ")}
          </p>
        )}

        {/* النسخة والساعات */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white/[0.05] p-4">
            <p className="text-sm text-white/50">نسخة خطتك</p>
            <p className="font-black text-gold-ink">{variant.label}</p>
            <p className="mt-1 text-[11px] leading-5 text-white/45">{variant.hint}</p>
          </div>
          <div className="rounded-xl bg-white/[0.05] p-4">
            <p className="text-sm text-white/50">إجمالي ساعات الخطة</p>
            <p className="font-black">{totalHours} ساعة</p>
            <p className="mt-1 text-[11px] leading-5 text-white/45">موزعة على إيقاعك الأسبوعي الذي أخبرتنا به</p>
          </div>
        </div>

        {/* لماذا رُكّبت هذه الخطة */}
        {composite.rationale_ar.length > 0 && (
          <ul className="mt-5 space-y-2">
            {composite.rationale_ar.slice(0, 4).map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/70">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-ink" />
                {r}
              </li>
            ))}
          </ul>
        )}

        {/* دورات الخطة تُعرض في «رحلة الدورات» الموحدة أسفل هذه البطاقة — لا تكرار */}

        {/* دورات أُزيلت بدليل إتقان موثق */}
        {composite.removed_courses.length > 0 && (
          <div className="mt-5 rounded-2xl border border-teal/30 bg-teal/[0.06] p-4">
            <p className="text-sm font-black text-teal-light-ink">أزلناها لأنك تتقنها — لا تدفع ثمن ما تعرفه:</p>
            <ul className="mt-2 space-y-1.5">
              {composite.removed_courses.map((r) => (
                <li key={r.courseId} className="text-xs leading-relaxed text-white/60">
                  <span className="font-bold text-white/80">{r.titleAr}</span> — {r.reason_ar}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* مشروع التخرج ومؤشر النجاح */}
        {(composite.capstone_ar || composite.success_metric_ar) && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {composite.capstone_ar && (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="flex items-center gap-2 text-xs font-black text-gold-ink">
                  <FileText className="h-4 w-4" /> مشروع إثبات الجاهزية
                </p>
                <p className="mt-2 text-xs leading-6 text-white/65">{composite.capstone_ar}</p>
              </div>
            )}
            {composite.success_metric_ar && (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="flex items-center gap-2 text-xs font-black text-teal-light-ink">
                  <Gauge className="h-4 w-4" /> كيف تعرف أنك نجحت؟
                </p>
                <p className="mt-2 text-xs leading-6 text-white/65">{composite.success_metric_ar}</p>
              </div>
            )}
          </div>
        )}

        {/* أقرب بديل ولماذا لم يُختر */}
        {composite.nearest_alternative && (
          <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-white/55">
            <span className="font-bold text-white/75">أقرب خطة بديلة كانت «{composite.nearest_alternative.nameAr}»</span>
            {" "}— {composite.nearest_alternative.whyNot_ar}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────── الصفحة ─────────── */
export default function Diagnostic() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("intro");
  const [answers, setAnswers] = useState<DiagAnswers>({});
  const [asked, setAsked] = useState<string[]>([]);
  const [live, setLive] = useState<ReturnType<AssessmentSession["liveState"]> | null>(null);
  const [history, setHistory] = useState<DiagQuestion[]>([]);
  const [question, setQuestion] = useState<DiagQuestion | null>(null);
  const [multiDraft, setMultiDraft] = useState<string[]>([]);
  const [textDraft, setTextDraft] = useState("");
  const [ratingsDraft, setRatingsDraft] = useState<Record<string, number>>({});
  const [result, setResult] = useState<DiagResult | null>(null);
  const [topPathway, setTopPathway] = useState<Pathway | null>(null);
  const [swapCount, setSwapCount] = useState(0);
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(() => loadProgress());
  /* نتيجة مكتملة محفوظة — تُقرأ عبر مخطط صارم: تُرحّل إن أمكن، وتُحذف بأمان مع رسالة إن تعذر */
  const [storedInitial] = useState(() => loadLastResultSafe());
  const savedDone: DiagResult | null =
    storedInitial.status === "ok" || storedInitial.status === "migrated" ? storedInitial.result : null;
  const discardedResultNotice = storedInitial.status === "discarded" ? storedInitial.reason_ar : null;
  /* جلسة المحرك الحتمي — مصدر الأسئلة والنتيجة الوحيد */
  const sessionRef = useRef<AssessmentSession | null>(null);
  /* الضيف أولا: يكمل التشخيص كاملا ويرى نتيجته حتى حدّ الظهور، والحساب يُطلب فقط لكشف الباقي والحفظ */
  const [authed, setAuthed] = useState(() => Boolean(localStorage.getItem("wajeez_user")));
  /* انكشف للتو من بوابة النتيجة — نجمّد كل ما فوق حدّ الظهور كما هو حتى لا يقفز التخطيط لحظة الكشف */
  const [justRevealed, setJustRevealed] = useState(false);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [savedFlash, setSavedFlash] = useState(false);
  /* جولة تدقيق الخطة: حالة السؤال المعروض وسبب فتح الجولة */
  const [deepStep, setDeepStep] = useState<{ index: number; total: number; reasonAr: string | null } | null>(null);
  const [deepReason, setDeepReason] = useState<string | null>(null);
  const inDeepeningRef = useRef(false);
  /* هل الجلسة الحالية حية وتسمح بجولة تدقيق؟ — حالة تصيير لا تُقرأ من المرجع */
  const [canDeepen, setCanDeepen] = useState(false);
  /* نُقرع الزر ولا جولة نافعة (أقل من 4 أسئلة) — رسالة بدل الصمت */
  const [deepUnavailable, setDeepUnavailable] = useState(false);
  const [families, setFamilies] = useState<FamilyToRate[]>([]);

  /* تحذير قبل مغادرة تشخيص غير محفوظ — التقدم محفوظ تلقائيا لكن نطمئنه */
  const stageRef = useRef(stage);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
  /* من غادر أثناء الأسئلة دون إكمال — حدث "هجر" واحد عند مغادرة الصفحة */
  useEffect(
    () => () => {
      if (stageRef.current === "questions") track("diagnostic_abandoned");
    },
    []
  );

  /* أحداث بوابة النتيجة: الضيف يرى النصف والجدار، والموثق يرى الكاملة —
     يُطلق result_full_viewed أيضا لحظة انكشاف الصفحة بعد التسجيل من الجدار */
  useEffect(() => {
    if (stage !== "result" || !result || !topPathway) return;
    if (result.resultJson.kind === "guardrail_stop") return;
    if (authed) {
      track("result_full_viewed", { confidence: Math.round(result.confidence) });
    } else {
      track("result_teaser_viewed", { confidence: Math.round(result.confidence) });
      track("gate_viewed");
    }
  }, [stage, result, topPathway, authed]);
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

  /* حالة الفهم الحية — تُحدَّث مع كل خطوة محرك، لا تُقرأ من المرجع أثناء التصيير */
  const ESTIMATE_MAX = 14; // «غالبا 8–14 سؤالا» — توقف تكيفي
  const estimatedTotal = Math.max(8, Math.min(ESTIMATE_MAX, asked.length + 3));
  const progress = Math.min(100, Math.round(((asked.length + (question ? 1 : 0)) / ESTIMATE_MAX) * 100));
  const liveNow = stage === "questions" ? live : null;
  const understoodDims = liveNow ? (Object.keys(DIM_LABELS) as Dim[]).filter((d) => liveNow.dims[d] >= 0.6) : [];
  /* لا نشتق «التطابق الأولي» ولا نعرضه — اسم المسار/القالب يُكشف في النتيجة فقط */

  /* مراحل الرحلة الخمس — أيها اكتمل وأيها نشط الآن */
  const currentStageIdx = stageIndexOf(question);
  const passedStages = useMemo(() => {
    const s = new Set(history.map((q) => stageIndexOf(q)));
    s.add(currentStageIdx);
    return s;
  }, [history, currentStageIdx]);

  // يبدأ مجانا بلا حساب — الحساب يُطلب عند النتيجة لفتح تفاصيلها الكاملة
  const begin = () => {
    void start();
  };

  /** يدفع خطوة المحرك إلى حالة الواجهة */
  const applyStep = (step: { question: DiagQuestion | null; deepening?: { index: number; total: number; reasonAr: string | null } | null }) => {
    const session = sessionRef.current;
    if (session) {
      const snapshot = session.answersSnapshot;
      setAsked(snapshot.map((a) => a.questionId));
      setAnswers(
        Object.fromEntries(snapshot.map((a) => [a.questionId, Array.isArray(a.value) ? a.value.join(",") : a.value]))
      );
      setLive(step.question ? session.liveState() : null);
    }
    setDeepStep(step.deepening ?? null);
    setMultiDraft([]);
    setTextDraft("");
    setRatingsDraft({});
    if (!step.question) {
      if (inDeepeningRef.current) {
        finishDeepeningRound();
        return;
      }
      /* قبل النتيجة: شبكة تقييم الجوانب — شاشة واحدة اختيارية.
         تُعرض فقط إن كان للمحرك ما يسأل عنه؛ وإلا نمضي كما كنا. */
      const toRate = session?.familiesToRate() ?? [];
      if (toRate.length > 0) {
        setFamilies(toRate);
        setStage("skills");
        window.scrollTo(0, 0);
        return;
      }
      finish();
      return;
    }
    setQuestion(step.question);
    setStage("questions");
  };

  const start = async () => {
    track("diagnostic_started");
    /* اللقطة المنشورة أولا — المحرك يقرأ أحدث كتالوج محكوم، أو الحزمة المضمنة بصمت */
    await ensurePublishedSnapshot();
    /* والمحتوى العام المنشور — نتيجة التشخيص تعرض الدورات من المصدر نفسه */
    void ensurePublishedContent();
    const session = createAssessment();
    sessionRef.current = session;
    setHistory([]);
    applyStep(session.next());
  };

  /* استئناف تشخيص غير مكتمل — المحرك حتمي فيعيد نفس الأسئلة لنفس الإجابات */
  const doResume = async () => {
    await ensurePublishedSnapshot();
    const session = AssessmentSession.resume();
    if (!session) {
      void start();
      return;
    }
    sessionRef.current = session;
    const snapshot = session.answersSnapshot;
    setHistory(snapshot.map((a) => diagQuestionById(a.questionId)).filter((q): q is DiagQuestion => Boolean(q)));
    applyStep(session.next());
    window.scrollTo(0, 0);
  };

  const resume = () => {
    void doResume(); // الاستئناف أيضا متاح للضيف — إجاباته على جهازه
  };

  const discardSaved = () => {
    clearProgress();
    sessionRef.current?.abandon();
    setSavedProgress(null);
  };

  const showSavedResult = () => {
    if (!savedDone) return;
    setCanDeepen(false);
    setResult(savedDone);
    setTopPathway(savedDone.top);
    setStage("result");
  };

  /* اعتماد خطة مركبة: نحفظ دوراتها كنسخة مخصصة على مسارها المضيف، ونمرر هويتها لصفحة المسار —
     لا تدفق دفع جديدا: صفحة المسار نفسها تعرض الدورات المختارة وتسعّرها كما تفعل مع أي تخصيص */
  const adoptComposite = () => {
    const c = (result?.resultJson.composite as CompositeView | null) ?? null;
    if (!c || !topPathway) return;
    const hostId = c.represented_pathway_ids.includes(topPathway.id)
      ? topPathway.id
      : (c.represented_pathway_ids[0] ?? topPathway.id);
    const ids = [...c.courses].sort((a, b) => a.sequence - b.sequence).map((x) => x.courseId);
    try {
      const custom = JSON.stringify({ pathwayId: hostId, chosenIds: ids, giftId: null });
      const compositeCtx = JSON.stringify({ template_id: c.template_id, name_ar: c.name_ar });
      sessionStorage.setItem("wajeez_custom", custom);
      sessionStorage.setItem("wajeez_diag_composite", compositeCtx);
      sessionStorage.setItem("wajeez_diag_top", hostId);
      localStorage.setItem("wajeez_diag_top", hostId);
    } catch {
      /* مساحة ممتلئة أو خصوصية صارمة — نتابع والصفحة تسقط على شكلها الافتراضي */
    }
    track("composite_adopted", { template: c.template_id, host: hostId });
    navigate(`/pathways/${hostId}`);
  };

  /* إرفاق النتيجة بحساب المستخدم أفضل جهد — ينشئ الخادم ملف متعلم وحالة مستشار دون حجب النتيجة */
  const attachToAccount = (res: DiagResult) => {
    if (!localStorage.getItem("wajeez_user")) return; // ضيف — النتيجة تبقى على جهازه فقط
    void apiPost("/api/learner/diagnostic-attach", { snapshot: res as unknown as Record<string, unknown> }).catch(() => undefined);
  };

  /* نجاح التسجيل من بوابة النتيجة: نفس الصفحة ينكشف فيها الضباب بلا انتقال ولا
     قفزة تخطيط، ونتيجة الضيف المحلية تُدمج بالحساب الجديد — لا إعادة تشخيص ولا فقد */
  const revealResult = () => {
    setAuthed(true);
    setJustRevealed(true);
    if (result) attachToAccount(result);
  };

  const submitFamilyRatings = (ratings: Record<string, number>) => {
    sessionRef.current?.setFamilyRatings(ratings);
    track("skills_rated", { families: Object.keys(ratings).length });
    finish();
  };
  const skipFamilyRatings = () => {
    track("skills_skipped");
    finish();
  };

  const finish = () => {
    const session = sessionRef.current;
    if (!session) return;
    track("diagnostic_completed", { questions: session.askedCount });
    const { result: res } = session.finish();
    res.resultJson.answered_count = session.askedCount; // عداد شارة «اكتمل التشخيص» في الملخص المجاني — يُحفظ مع النتيجة
    saveLastResult(res);
    attachToAccount(res);
    setSavedProgress(null);
    setResult(res);
    setTopPathway(res.top);
    track("recommendation_viewed", { confidence: Math.round(res.confidence) });
    setCanDeepen(true);
    setStage("result");
    window.scrollTo(0, 0);
  };

  /* «دقّق خطتك أكثر» — جولة اختيارية لا تبدأ تلقائيا، مرتبطة بالجلسة نفسها */
  const startDeepeningRound = () => {
    const session = sessionRef.current;
    if (!session || inDeepeningRef.current) return;
    const opened = session.startDeepening();
    if (!opened) {
      /* أقل من 4 أسئلة نافعة — الجولة لا تُفتح ونخبر المستخدم بدل زر صامت */
      setDeepUnavailable(true);
      return;
    }
    track("deepening_started");
    inDeepeningRef.current = true;
    setDeepReason(opened.reasonAr);
    applyStep(opened.step);
    window.scrollTo(0, 0);
  };

  const finishDeepeningRound = () => {
    const session = sessionRef.current;
    if (!session) return;
    const { result: res, comparison } = session.finishDeepening();
    const cmp = comparison as DeepeningComparison;
    inDeepeningRef.current = false;
    setDeepStep(null);
    setCanDeepen(false);
    res.resultJson.answered_count = session.askedCount;
    saveLastResult(res);
    attachToAccount(res);
    setResult(res);
    setTopPathway(res.top);
    track("deepening_completed", { changed: cmp.changed, answered: cmp.answeredCount });
    setStage("result");
    window.scrollTo(0, 0);
  };

  const answer = (qid: string, value: string | string[], optionIds?: string[]) => {
    const session = sessionRef.current;
    if (!question || !session) return;
    track("diagnostic_question_completed", { count: asked.length + 1 });
    setHistory([...history, question]);
    const step = session.submit(qid, value, optionIds);
    applyStep(step);
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
    /* معرفات الخيارات تُشتق من الخيارات المعروضة نفسها — القرار لا يعتمد على النص */
    const ids = multiDraft.map((v) => qOptions.find((o) => o.value === v)?.optionId).filter((x): x is string => Boolean(x));
    answer(q.id, multiDraft, ids.length === multiDraft.length ? ids : undefined);
  };

  const back = () => {
    const session = sessionRef.current;
    if (history.length === 0 || !session) {
      setStage("intro");
      return;
    }
    session.popAnswer();
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    const snapshot = session.answersSnapshot;
    setAsked(snapshot.map((a) => a.questionId));
    setAnswers(
      Object.fromEntries(snapshot.map((a) => [a.questionId, Array.isArray(a.value) ? a.value.join(",") : a.value]))
    );
    setQuestion(prev);
    setMultiDraft([]);
    setTextDraft("");
  };

  const restart = () => {
    sessionRef.current?.abandon();
    sessionRef.current = null;
    inDeepeningRef.current = false;
    setCanDeepen(false);
    setDeepUnavailable(false);
    setDeepStep(null);
    setDeepReason(null);
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
    <div dir="rtl" className="min-h-screen bg-paper text-white">
      <SeoHead
        title="التشخيص الذكي"
        description="تشخيص تعليمي تكيفي يفهم هدفك وواقعك، ويوصي بمسار واحد مفسّر بدرجة ثقة — مجاني ودون حساب."
        path="/diagnostic"
      />
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2 text-white/70 hover:text-white">
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm font-medium">العودة للرئيسية</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
              <span className="font-black">أكاديمية وجيز</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ─── Intro ─── */}
      {stage === "intro" && (
        <section className="story-fade mx-auto max-w-3xl px-5 py-16 text-center md:py-24">
          <Badge className="border border-gold/40 bg-gold/10 text-gold-ink">مؤشر وجيز الكامل</Badge>
          <h1 className="mt-5 text-3xl font-black leading-snug md:text-5xl">
            ثلاث دقائق من الوضوح
            <span className="text-teal-light-ink"> تختصر عليك شهورا من التشتت</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-loose text-white/60">
            حديث قصير عن يومك وهدفك — كل إجابة تشكّل سؤالك التالي، وتنتهي بمسارك الواضح.
          </p>

          <div className="mx-auto mt-7 flex max-w-full flex-wrap items-center justify-center gap-1.5 sm:gap-2 sm:flex-nowrap sm:whitespace-nowrap">
            {[
              { icon: Compass, text: "توصية مفسَّرة، ليست حظًا" },
              { icon: Clock3, text: "١–٣ دقائق فقط" },
              { icon: ShieldCheck, text: "تشخيص تعليمي — لا نفسي ولا طبي" },
            ].map((f) => (
              <span key={f.text} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-bold text-white/65 sm:px-3.5 sm:text-[11px]">
                <f.icon className="h-3 w-3 shrink-0 text-teal-light-ink sm:h-3.5 sm:w-3.5" />
                {f.text}
              </span>
            ))}
          </div>

          <Button
            size="lg"
            onClick={begin}
            className="mt-10 h-14 rounded-full bg-gold px-10 text-lg font-black text-on-gold hover:bg-gold/90"
          >
            ابدأ الحديث
            <ArrowLeft className="mr-2 h-5 w-5" />
          </Button>
          <p className="mt-4 text-xs text-white/55">ابدأ مجانا — ترى مسارك المقترح فورا، وحسابك المجاني يفتح نتيجتك كاملة · بالمتابعة أنت توافق على استخدام إجاباتك لبناء التوصية · التشخيص مصمم للبالغين، وإن كنت دون ١٨ عاما أكمله مع ولي أمرك</p>

          {/* بطاقة الاستئناف — تشخيص غير مكتمل ينتظر صاحبه */}
          {savedProgress && (
            <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-teal/40 bg-teal/10 p-5">
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-teal-light-ink">
                <History className="h-4 w-4" />
                لديك تشخيص غير مكتمل — أجبت على {savedProgress.asked.length} من الأسئلة
              </p>
              <p className="mt-1.5 text-xs text-white/50">إجاباتك محفوظة على جهازك — أكمل من حيث توقفت متى شئت</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Button
                  onClick={resume}
                  className="rounded-full bg-teal px-6 font-black text-on-teal hover:bg-teal/90"
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

          {/* نتيجة قديمة لم يمكن ترحيلها — حُذفت بأمان ونطلب إعادة التشخيص بوضوح */}
          {!savedProgress && !savedDone && discardedResultNotice && (
            <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-gold/40 bg-gold/[0.07] p-5">
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-gold-ink">
                <History className="h-4 w-4" />
                نتيجتك السابقة لم تعد صالحة
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/55">{discardedResultNotice}</p>
            </div>
          )}

          {/* نتيجة مكتملة محفوظة — لا نطلب المؤشر مرتين */}
          {!savedProgress && savedDone && (
            <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-teal/40 bg-teal/10 p-5">
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-teal-light-ink">
                <History className="h-4 w-4" />
                لديك نتيجة مؤشر محفوظة على جهازك
              </p>
              <p className="mt-1.5 text-xs text-white/50">أكملت التشخيص سابقا — لا حاجة لإعادته إلا إذا تغيرت ظروفك</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Button
                  onClick={showSavedResult}
                  className="rounded-full bg-teal px-6 font-black text-on-teal hover:bg-teal/90"
                >
                  اعرض نتيجتي المحفوظة
                  <ArrowLeft className="mr-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* المرجعية العلمية — آخر الشاشة: تطمين هادئ لمن يريد، لا حاجز أمام البدء */}
          <p className="mx-auto mt-10 max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-xs leading-relaxed text-white/50">
            نسترشد في بناء أسئلتنا بأطر مهنية وتعليمية معروفة: <span className="font-bold text-teal-light-ink">RIASEC</span> للميول المهنية،
            و<span className="font-bold text-teal-light-ink">O*NET وESCO</span> لخرائط المهارات،
            و<span className="font-bold text-teal-light-ink">DigComp</span> للجاهزية الرقمية — وتُعرض عليك تفاصيلها في صفحة المنهجية.
          </p>
        </section>
      )}

      {/* ─── Questions ─── */}
      {stage === "questions" && question && (
        <section className="story-fade mx-auto max-w-2xl px-5 py-12 md:py-16">
          {offline && (
            <div role="status" className="mb-5 rounded-2xl border border-gold/40 bg-gold/10 px-5 py-3 text-center text-xs font-bold text-gold-ink">
              انقطع الاتصال بالشبكة — لا تقلق: تشخيصك يعمل على جهازك وإجاباتك محفوظة، أكمل بثقة
            </div>
          )}
          {/* شريط جولة التدقيق — يحل محل شريط المراحل أثناء «دقّق خطتك أكثر» */}
          {deepStep ? (
            <div className="mb-6 rounded-2xl border border-teal/40 bg-teal/[0.07] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-black text-teal-light-ink">
                  <Wand2 className="h-4 w-4" />
                  جولة تدقيق خطتك — أسئلة أعمق لزيادة وضوح التوصية
                </p>
                <span className="text-xs font-bold text-white/55">
                  سؤال {deepStep.index} من {deepStep.total}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-teal transition-all duration-500"
                  style={{ width: `${(deepStep.index / deepStep.total) * 100}%` }}
                />
              </div>
              {deepReason && (
                <p className="mt-3 text-[11px] leading-relaxed text-white/50">{deepReason}</p>
              )}
            </div>
          ) : (
          <>
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
                          ? "border-gold bg-gold text-on-gold"
                          : done
                            ? "border-teal bg-teal/20 text-teal-light-ink"
                            : "border-white/15 text-white/55"
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </span>
                    <span
                      className={`text-center text-[10px] font-bold leading-tight md:text-[11px] ${
                        active ? "text-gold-ink" : done ? "text-teal-light-ink" : "text-white/55"
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
              <span className="text-teal-light-ink">{question.moduleLabel}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-l from-teal to-gold transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          </>
          )}

          {/* الإشارات الحية — المحرك يفهمك أثناء الحديث */}
          {understoodDims.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-white/45">
                <BrainCircuit className="h-3.5 w-3.5 text-teal-ink" />
                يفهم الآن:
              </span>
              {understoodDims.map((d) => (
                <span
                  key={d}
                  className="rounded-full border border-teal/30 bg-teal/10 px-2.5 py-0.5 text-[11px] font-semibold text-teal-light-ink"
                >
                  {DIM_LABELS[d]}
                </span>
              ))}
              {/* لا يُعرض اسم المسار أو القالب أثناء الأسئلة أبدا — كشف التوصية مبكرا يوجّه الإجابات.
                  يظهر فقط ما فُهم (هدف/وقت/سياق) عبر شارات الأبعاد أعلاه. */}
            </div>
          )}

          <div key={question.id} className="story-fade">
            {(question.level === "deep" || question.level === "conditional") && (
              <p className="mb-4 w-fit rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold-ink">
                سؤال تعميق — بناءً على إجاباتك تحديدا
              </p>
            )}
            <h2 className="text-2xl font-black leading-snug md:text-3xl">{qText}</h2>
            {deepStep?.reasonAr && (
              <p className="mt-3 w-fit rounded-xl border border-teal/30 bg-teal/[0.06] px-3.5 py-2 text-[11px] leading-relaxed text-white/55">
                <span className="font-bold text-teal-light-ink">لماذا هذا السؤال؟ </span>
                {deepStep.reasonAr}
              </p>
            )}
            {qHint && <p className="mt-3 text-sm leading-relaxed text-white/50">{qHint}</p>}
            {question.source && (
              <p className="mt-4 w-fit rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] leading-relaxed text-white/45">
                <span className="font-bold text-teal-light-ink">المصدر العلمي: </span>
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
                      onClick={() => answer(question.id, opt.value, opt.optionId ? [opt.optionId] : undefined)}
                      className={`rounded-2xl border p-5 text-right transition-all ${
                        selected
                          ? "border-teal-light bg-teal/15"
                          : "border-white/10 bg-white/[0.03] hover:border-teal-light/60 hover:bg-white/[0.06]"
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
                  className="w-full rounded-2xl border border-white/15 bg-white/[0.04] p-5 text-base leading-relaxed text-white placeholder:text-white/30 focus:border-teal-light focus:outline-none"
                />
                <div className="mt-5 flex items-center justify-between">
                  <button
                    onClick={() => answer(question.id, "")}
                    className="text-sm font-semibold text-white/45 transition hover:text-white"
                  >
                    تخطَّ هذا السؤال
                  </button>
                  <Button
                    onClick={() => answer(question.id, textDraft.trim())}
                    disabled={textDraft.trim().length === 0}
                    className="rounded-full bg-gold px-8 font-black text-on-gold hover:bg-gold/90"
                  >
                    متابعة
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
                                  ? "border-teal bg-teal/25 text-teal-light-ink"
                                  : "border-white/10 bg-white/[0.03] text-white/55 hover:border-teal-light/50"
                              }`}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-left text-[11px] text-white/55" dir="rtl">
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
                    className="rounded-full bg-gold px-8 font-black text-on-gold hover:bg-gold/90"
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
                            ? "border-gold bg-gold/15"
                            : "border-white/10 bg-white/[0.03] hover:border-gold/60 disabled:opacity-40"
                        }`}
                      >
                        <span className="flex items-center justify-between text-sm font-bold">
                          {opt.label}
                          {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-gold-ink" />}
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
                    className="rounded-full bg-gold px-8 font-black text-on-gold hover:bg-gold/90"
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
                  /* الحفظ تلقائي مع كل إجابة عبر الخدمة — هذا الزر طمأنة فقط */
                  setSavedFlash(true);
                  window.setTimeout(() => setSavedFlash(false), 2200);
                }}
                className={`flex items-center gap-2 text-sm font-semibold transition ${
                  savedFlash ? "text-teal-light-ink" : "text-white/50 hover:text-white"
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
                <span className="flex items-center gap-1.5 text-xs text-teal-light-ink">
                  <CheckCircle2 className="h-4 w-4" /> تمت الإجابة
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── تقييم الجوانب — شاشة واحدة اختيارية قبل النتيجة ─── */}
      {stage === "skills" && (
        <section className="px-5 pb-24 pt-10 md:pt-14">
          <SkillFamilyGrid families={families} onDone={submitFamilyRatings} onSkip={skipFamilyRatings} />
        </section>
      )}

      {/* ─── Result ─── */}
      {stage === "result" && result && (
        <ResultErrorBoundary onReset={restart}>
        {result.resultJson.kind === "guardrail_stop" ? (
          /* توقف حوكمي (رفض الموافقة أو قاصر) — شاشة هادئة بلا توصية ولا تشتيت */
          (() => {
            const guardMsg = result.reasons[0] ?? "";
            const isMinor = guardMsg.includes("قاصر");
            return (
          <section className="story-fade mx-auto max-w-xl px-5 py-20 text-center md:py-28">
            <p className="text-lg font-black leading-relaxed">
              {isMinor ? "هذه الجلسة تُكمل مع ولي الأمر" : "احترمنا اختيارك — توقف التشخيص هنا بلا أي توصية."}
            </p>
            <p className="mt-3 text-sm leading-loose text-white/55">
              {isMinor
                ? "لأن المتعلم قاصر، يجب أن يجلس ولي أمره معه ويكمل الإجابات بنفسه — ثم تظهر التوصية كاملة."
                : "لم نحفظ توصية ولم نرشّح مسارا. إن غيّرت رأيك فالبداية الجديدة تستغرق دقائق."}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="h-12 rounded-full bg-gold px-8 font-black text-on-gold hover:bg-gold/90" onClick={restart}>
                ابدأ من جديد
              </Button>
              <Button size="lg" variant="outline" className="h-12 rounded-full border-white/15 px-8 font-bold text-white/70" asChild>
                <Link to="/">العودة للرئيسية</Link>
              </Button>
            </div>
          </section>
            );
          })()
        ) : !topPathway ? (
          /* اتجاه استكشافي / إحالة مستشار بلا مسار مفروض — بطاقة هادئة موجِّهة، لا صفحة فارغة أبدًا */
          (() => {
            const exploration = (result.resultJson.exploration as {
              domain_shortlist?: { id: string; label_ar: string }[]
              evidence_suggestions_ar?: string[]
            } | null) ?? null;
            const isExploratory = result.resultJson.kind === "exploratory_direction";
            return (
              <section className="story-fade mx-auto max-w-xl px-5 py-20 text-center md:py-24">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal/15">
                  <Compass className="h-7 w-7 text-teal-light-ink" />
                </span>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <Badge className="border border-teal/40 bg-teal/10 text-teal-light-ink">اكتمل التشخيص</Badge>
                  <Badge className="bg-teal font-black text-on-teal">
                    {isExploratory ? "اتجاه استكشافي" : "مراجعة مستشار"}
                  </Badge>
                </div>
                <h2 className="mt-5 text-2xl font-black leading-snug md:text-3xl">
                  {isExploratory ? "اتجاهك ما زال يتشكّل — ونرفض أن نخمّن عليك" : "حالتك تستحق مستشارًا بشريًا قبل الترشيح"}
                </h2>
                <div className="mx-auto mt-4 max-w-md space-y-2 text-sm leading-loose text-white/60">
                  {result.reasons.slice(0, 3).map((r) => (
                    <p key={r}>{r}</p>
                  ))}
                </div>

                {isExploratory && (exploration?.domain_shortlist?.length ?? 0) > 0 && (
                  <div className="mt-7">
                    <p className="text-xs font-bold text-white/45">المجالات الأقرب لك من إجاباتك الآن:</p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      {exploration!.domain_shortlist!.map((d) => (
                        <span key={d.id} className="rounded-full border border-teal/40 bg-teal/10 px-4 py-1.5 text-xs font-bold text-teal-light-ink">
                          {d.label_ar}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {isExploratory && (exploration?.evidence_suggestions_ar?.length ?? 0) > 0 && (
                  <div className="mx-auto mt-7 max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-right">
                    <p className="text-xs font-black text-white/70">ما الذي يرفع دقة تشخيصك المرة القادمة؟</p>
                    <ul className="mt-3 space-y-2">
                      {exploration!.evidence_suggestions_ar!.slice(0, 4).map((s) => (
                        <li key={s} className="flex items-start gap-2 text-xs leading-relaxed text-white/60">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-light-ink" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    size="lg"
                    className="h-12 rounded-full bg-gold px-8 font-black text-on-gold hover:bg-gold/90"
                    onClick={restart}
                  >
                    <RefreshCcw className="ml-2 h-4 w-4" />
                    ابدأ التشخيص من جديد
                  </Button>
                  <AdvisorContact
                    label="تحدث مع مستشار مهني"
                    text={
                      isExploratory
                        ? "مرحبا، أكملت مؤشر وجيز وكانت نتيجتي «اتجاه استكشافي» — أريد مستشارا يساعدني على حسم اتجاهي."
                        : "مرحبا، أكملت مؤشر وجيز وأحالني التشخيص لمستشار — أريد مراجعة حالتي."
                    }
                  />
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-white/40">
                  هذا تشخيص تعليمي مهني: ليس تقييما نفسيا أو طبيا. لا نرشّح مسارا بلا دليل كافٍ — هذه مسؤولية لا ضعف.
                </p>
              </section>
            );
          })()
        ) : (
        <section className="story-fade mx-auto max-w-3xl px-5 py-12 md:py-16">
          {/* حدّ الظهور المعتمد: الجميع — ضيفا كان أو موثقا — يرى مقروءا كل شيء
              حتى نهاية بطاقة «ماذا ستحصل عليه فعليا؟» بلا أي تغيير ولا ضباب.
              وكل ما بعدها يبقى في مكانه داخل بوابة النتيجة: ضباب بلا معالم للضيف
              تطفو فوقه بطاقة التسجيل، ويزول في نفس الصفحة بعد التسجيل بلا قفزة تخطيط */}
          {(() => {
            const compositeView = (result.resultJson.composite as CompositeView | null) ?? null;
            const deepeningDone = Boolean(result.resultJson.deepening);
            const deepeningOffered = !deepeningDone && canDeepen;
            return (
          <div className="text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge className="border border-teal/40 bg-teal/10 text-teal-light-ink">اكتمل التشخيص</Badge>
              <Badge className={`font-black ${compositeView ? "bg-gold text-on-gold" : "bg-teal text-on-teal"}`}>
                {compositeView ? "خطة مركبة مخصصة" : "مسارك المقترح"}
              </Badge>
            </div>
            {/* اسم المسار يظهر في بطاقة التوصية أدناه — لا تكرار هنا */}
            {/* جولة التدقيق — للموثق المستقر فقط: تُخفى عن الضيف، وعن من انكشف للتو
                حتى لا يظهر عنصر جديد فوق حدّ الظهور فيقفز ما تحته لحظة الكشف */}
            {authed && !justRevealed && deepeningOffered && (
              <div className="mt-7 print:hidden">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={startDeepeningRound}
                  className="h-12 rounded-full border-teal/50 px-8 font-black text-teal-light-ink hover:bg-teal/15"
                >
                  <Wand2 className="ml-2 h-4 w-4" />
                  لديك دقيقة أخرى لنتأكد أكثر؟
                </Button>
                {!deepUnavailable && (
                  <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-white/40">
                    خطوة اختيارية تماما: ٤–٨ أسئلة قصيرة تزيد دقة توصيتك — تخطَّها بلا أي أثر إن كانت الصورة واضحة لك.
                  </p>
                )}
              </div>
            )}
            {deepUnavailable && (
              <p className="mt-2 text-[11px] font-bold text-teal-light-ink print:hidden">
                صورتك مكتملة بما يكفي — لا أسئلة إضافية نافعة، توصيتك جاهزة بثقة.
              </p>
            )}
          </div>
            );
          })()}

          {/* مقارنة جولة التدقيق — صندوق قبل/بعد فقط عندما تتغير التوصية فعلا */}
          {(() => {
            const cmp = (result.resultJson.deepening as DeepeningComparison | null) ?? null;
            if (!cmp) return null;
            if (!cmp.changed) {
              /* النتيجة نفسها — سطر طمأنة واحد يكفي، بلا صندوق مقارنة مكرر */
              return (
                <div className="mt-8 flex items-start gap-3 rounded-2xl border border-teal/40 bg-teal/[0.05] px-5 py-4 text-right">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-light-ink" />
                  <div>
                    <p className="text-sm font-black text-teal-light-ink">اطمئن — بقي مسارك هو نفسه بعد التدقيق</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/60">
                      {cmp.note_ar} وإن حسّنا دورة داخل مسارك أو اقترحنا إضافة تناسبك فستجدها في خطتك أدناه —
                      ويمكنك تخصيصها بنفسك: استبدالا أو حذفا أو هدية مجانية.
                    </p>
                  </div>
                </div>
              );
            }
            return (
              <div className={`mt-8 rounded-3xl border p-6 md:p-8 ${cmp.changed ? "border-gold/50 bg-gold/[0.06]" : "border-teal/40 bg-teal/[0.05]"}`}>
                <h3 className="flex items-center gap-2 text-lg font-black">
                  <Wand2 className={`h-5 w-5 ${cmp.changed ? "text-gold-ink" : "text-teal-light-ink"}`} />
                  نتيجة تدقيق خطتك
                </h3>
                <p className={`mt-3 text-sm font-bold leading-relaxed ${cmp.changed ? "text-gold-ink" : "text-teal-light-ink"}`}>
                  {cmp.note_ar}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/[0.04] p-4">
                    <p className="text-[11px] font-bold text-white/45">قبل التدقيق</p>
                    <p className="mt-1.5 text-sm font-black leading-snug text-white/85">{cmp.before.topLabel_ar}</p>
                    <p className="mt-1 text-xs text-white/55">مستوى الثبات: {cmp.before.confidenceBand_ar}</p>
                  </div>
                  <div className="rounded-xl border border-teal/30 bg-teal/[0.07] p-4">
                    <p className="text-[11px] font-bold text-teal-light-ink">بعد التدقيق</p>
                    <p className="mt-1.5 text-sm font-black leading-snug">{cmp.after.topLabel_ar}</p>
                    <p className="mt-1 text-xs text-white/65">مستوى الثبات: {cmp.after.confidenceBand_ar}</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {cmp.reasons_ar.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-xs leading-relaxed text-white/60">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-light" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {/* بطاقة التوصية الأولى للمسار القياسي — تظهر فقط عندما لا تفوز خطة مركبة */}
          {((result.resultJson.composite as CompositeView | null) ?? null) === null && (
          <div className="mt-10 overflow-hidden rounded-3xl border border-[#38A7B4]/40 bg-gradient-to-b from-panel to-paper">
            <div className="border-b border-white/10 bg-[#38A7B4]/10 px-6 py-3 text-sm font-bold text-[#6EC7D1]">
              التوصية الأولى
            </div>
            <div className="p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-gold font-black text-on-gold">{topPathway.badge ?? topPathway.sector}</Badge>
                <Badge variant="outline" className="border-white/20 text-white/70">{topPathway.sector}</Badge>
                <Badge variant="outline" className="border-white/20 text-white/70">{topPathway.level}</Badge>
              </div>
              <h2 className="mt-4 text-2xl font-black leading-snug md:text-3xl">{topPathway.name}</h2>
              <p className="mt-4 leading-loose text-white/70">{topPathway.transformation}</p>

              {/* المدة والوقت والمستوى — شارات صغيرة لا تنافس اسم المسار */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-white/70">
                  <BookOpen className="h-3.5 w-3.5 text-teal-light-ink" />
                  {(pathwayCourses[topPathway.id] ?? []).length} دورات
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-white/70">
                  <CalendarClock className="h-3.5 w-3.5 text-teal-light-ink" />
                  {weeksLabel(topPathway.durationWeeks)}
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-white/70">
                  <Clock3 className="h-3.5 w-3.5 text-teal-light-ink" />
                  {topPathway.weeklyHours} أسبوعيا
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-white/70">
                  <Gauge className="h-3.5 w-3.5 text-teal-light-ink" />
                  مستوى {topPathway.level}
                </span>
              </div>
              <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-white/60">
                <RouteIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold-ink" />
                <span>
                  <span className="font-bold text-white/80">المخرج العملي: </span>
                  {topPathway.output}
                </span>
              </p>

              <div className="mt-6">
                <p className="mb-2 text-sm font-bold text-white/60">المهارات المحورية التي ستبنيها:</p>
                <div className="flex flex-wrap gap-2">
                  {topPathway.coreSkills.map((s) => (
                    <span key={s} className="rounded-full border border-teal/40 bg-teal/10 px-3 py-1 text-xs font-semibold text-teal-light-ink">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm font-black text-teal-light-ink">ماذا ستحصل عليه فعليا؟</p>
                <p className="mt-1.5 text-xs leading-6 text-white/55">
                  لا تحصل على قائمة دورات فقط؛ تحصل على ترتيب تعلم، ومتابعة، ومراجعة، ومخرجا تطبيقيا يثبت أنك تقدمت.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {[
                    { icon: RouteIcon, label: "خطة تعلم شخصية", hint: "مرتبة على هدفك أنت" },
                    { icon: BookOpen, label: "دورات مسجلة ومباشرة", hint: "بالترتيب الصحيح لك" },
                    { icon: CalendarClock, label: "متابعة أسبوعية", hint: "لا تتعثر وحدك" },
                    { icon: UserCheck, label: "مراجعة بشرية", hint: "مدرب يقرأ واجبك" },
                    { icon: FileText, label: "مشروع تطبيقي", hint: "يُقيَّم ويُعتمد" },
                    { icon: BrainCircuit, label: "ملخصات كتب وجيز", hint: "تسمعها وتُختبر فيها" },
                    { icon: ShieldCheck, label: "شهادة إتمام", hint: "بمخرج يثبت جاهزيتك" },
                    { icon: Gift, label: "دورة إضافية مجانية", hint: "هدية فوق مسارك" },
                  ].map((f) => (
                    <div key={f.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                      <f.icon className="h-4 w-4 text-teal-light-ink" />
                      <p className="mt-1.5 text-xs font-bold leading-5">{f.label}</p>
                      <p className="mt-0.5 text-[11px] leading-5 text-white/45">{f.hint}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-5 text-white/40">
                  تفاصيل الاستثمار وقيمة الخصم تظهر في صفحة مسارك بعد اعتماده.
                </p>
              </div>
            </div>
          </div>
          )}

          {/* عند فوز خطة مركبة: هي بطاقة التوصية الأولى — والمسار القياسي مرجع ثانوي صغير */}
          {(() => {
            const compositeView = (result.resultJson.composite as CompositeView | null) ?? null;
            if (!compositeView) return null;
            return (
              <>
                <CompositePlan composite={compositeView} />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                  <p className="text-xs leading-relaxed text-white/60">
                    <span className="font-bold text-white/80">أقوى مسار مفرد ضمن خطتك: «{topPathway.name}»</span>
                    {" "}— استُمدت منه دورات أساسية في تركيبتك، وهو مرجعك إن أردت التركيز على مجال واحد فقط.
                  </p>
                  <Link
                    to={`/pathways/${topPathway.id}`}
                    className="shrink-0 text-xs font-bold text-teal-light-ink hover:underline"
                  >
                    استعرض المسار المفرد
                  </Link>
                </div>
              </>
            );
          })()}

          {/* ─── حدّ الظهور: ينتهي المقروء عند آخر عنصر في بطاقة «ماذا ستحصل عليه فعليا؟»
              وكل ما بعده داخل البوابة — محتوى حقيقي في مكانه تحت الضباب للضيف ─── */}
          <ResultGate revealed={authed} onDone={revealResult}>
          {/* «ماذا ستحقق من خلال خطتك؟» — رحلة الدورات، والتخصيص داخلها للمسارات الأساسية */}
          {(() => {
            const compositeView = (result.resultJson.composite as CompositeView | null) ?? null;
            const ordered = compositeView
              ? [...compositeView.courses].sort((a, b) => a.sequence - b.sequence)
              : null;
            if (!ordered) {
              return <PlanCourses pathway={topPathway} gaps={result.gaps} authed={authed} resetKey={swapCount} />;
            }
            const ids = ordered.map((c) => c.courseId);
            const reasons = Object.fromEntries(ordered.map((c) => [c.courseId, c.reason_ar]));
            return <CourseJourney courseIds={ids} reasons={reasons} delivery={pathwayDelivery(topPathway.id)} />;
          })()}

          {/* الاعتماد أسفل الخطة مباشرة — يظهر للضيف مضبّبا في مكانه، ويعمل فور انكشافه بالتسجيل */}
          {(() => {
            const compositeView = (result.resultJson.composite as CompositeView | null) ?? null;
            return (
            <div className="mt-6 flex flex-col items-center gap-3">
              {compositeView ? (
                <Button
                  size="lg"
                  onClick={adoptComposite}
                  className="h-auto min-h-14 max-w-full whitespace-normal rounded-full bg-gold px-8 py-3 text-center text-base font-black leading-snug text-on-gold hover:bg-gold/90 md:text-lg"
                >
                  اعتمد هذه الخطة
                  <ArrowLeft className="mr-2 h-5 w-5 shrink-0" />
                </Button>
              ) : (
                <Button size="lg" className="h-auto min-h-14 max-w-full whitespace-normal rounded-full bg-gold px-8 py-3 text-center text-base font-black leading-snug text-on-gold hover:bg-gold/90 md:text-lg" asChild>
                  <Link to={`/pathways/${topPathway.id}`}>
                    اعتمد هذا المسار
                    <ArrowLeft className="mr-2 h-5 w-5 shrink-0" />
                  </Link>
                </Button>
              )}
              <button
                onClick={restart}
                className="flex items-center gap-1.5 text-xs font-semibold text-white/45 transition hover:text-white"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                لا يشبهني؟ أعد التشخيص من جديد
              </button>
            </div>
            );
          })()}

          {/* الخطة المركّبة — تظهر فقط لمن قيّم جوانبه، وإلا لا شيء يتغيّر */}
          {(() => {
            const cp = result.resultJson.composed_path as ComposedPathView | null | undefined;
            return cp && cp.courses?.length ? <ComposedPlanCard plan={cp} /> : null;
          })()}

          {/* «مع المسار لا تأخذ دورات فقط — تأخذ منظومة كاملة» — إثبات قيمة مضغوط قبل الاعتماد،
              بنفس حجم خط القسم. حلّت محل ثلاثة أكورديونات كانت هنا بقرار المالك (2026-08-23):
              «لماذا هذا المسار؟» و«هل هناك معلومات لم نعرفها بعد؟» و«كيف بُنيت توصيتك؟» */}
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6 print:hidden">
            <h3 className="flex items-center gap-2 text-base font-black">
              <Sparkles className="h-4 w-4 text-[#FABC05]" />
              مع المسار لا تأخذ دورات فقط — تأخذ منظومة كاملة
            </h3>
            <div className="mt-3.5 grid gap-x-4 gap-y-2 sm:grid-cols-2">
              {[
                "دورات مسجلة + جلسات مباشرة مع المدرب",
                "ملخصات كتب وجيز الصوتية المرتبطة بمسارك",
                "واجبات تُراجع بشريا — لا تصحيحا آليا",
                "مشروع تخرج حقيقي يُقدَّم للمراجعة قبل الاعتماد",
                "شهادة موثقة بشروط إنجاز — لا شهادة مشاهدة",
                "خريطة مهارات قبل وبعد (0–5)",
                "خطة تقدم شخصية لما بعد المسار",
                "مستشار نجاح يرافقك أسبوعيا",
                "منظومة ما بعد الإتمام: وظائف وتوصيات وسفراء",
              ].map((f) => (
                <p key={f} className="flex items-start gap-2 text-xs leading-relaxed text-white/65">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#38A7B4]" />
                  {f}
                </p>
              ))}
            </div>
          </div>

          {/* تقاطع الرصيد السابق مع دورات التوصية — لا يدفع ثمن ما يعرفه */}
          {result.priorOverlap.length > 0 && (
            <div className="mt-8 rounded-3xl border border-gold/40 bg-gold/5 p-6 md:p-8">
              <h3 className="flex items-center gap-2 text-lg font-black text-gold-ink">
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

          {/* خريطة فجواتك التفصيلية — داخل توسعة ليبقى المسح البصري خفيفا */}
          {result.gapDetails.length > 0 && (
            <details className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <summary className="flex cursor-pointer items-center gap-2 text-lg font-black">
                <Gauge className="h-5 w-5 text-teal-light-ink" />
                خريطة فجواتك — مهارة بمهارة
              </summary>
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
                                ? "bg-gold/15 text-gold-ink"
                                : "bg-white/10 text-white/60"
                            }`}
                          >
                            {g.priority}
                          </span>
                        </td>
                        <td className="py-3 text-xs leading-relaxed text-teal-light-ink">
                          {g.coveredBy.length > 0 ? g.coveredBy.join("، ") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* مهارات مهمة غير متوفرة حاليا — صدق كامل */}
          {result.unavailableSkills.length > 0 && (
            <div className="mt-8 rounded-3xl border border-gold/40 bg-gold/5 p-6 md:p-8">
              <h3 className="flex items-center gap-2 text-lg font-black text-gold-ink">
                <BellRing className="h-5 w-5" />
                مهارات تحتاجها ولا نغطيها بعد — ولن نخفي ذلك عنك
              </h3>
              <p className="mt-3 text-sm leading-loose text-white/70">
                فجواتك في {result.unavailableSkills.join(" و")} مهمة لهدفك، لكن كتالوجنا الحالي لا يغطيها بعد.
                نفضل أن تعرف الحقيقة كاملة على أن نبيعك مسارا ناقصا.
              </p>
              <Button variant="outline" className="mt-4 border-gold/60 text-gold-ink hover:bg-gold/10" asChild>
                <a
                  href={`mailto:care@wajeez.com?subject=${encodeURIComponent("أشعرني عند توفر: " + result.unavailableSkills.join("، "))}`}
                >
                  أشعِرني عند توفرها
                </a>
              </Button>
            </div>
          )}

          {/* حُذف أكورديونا «هل هناك معلومات لم نعرفها بعد؟» و«كيف بُنيت توصيتك؟» —
              استُبدل الثلاثة بقسم «منظومة كاملة» المضغوط أعلاه (قرار المالك 2026-08-23) */}

          {/* Advisor flag */}
          {result.needsAdvisor && (
            <div className="mt-8 rounded-3xl border border-gold/40 bg-gold/5 p-6 md:p-8">
              <h3 className="flex items-center gap-2 text-lg font-black text-gold-ink">
                <UserCheck className="h-5 w-5" />
                حالتك تستحق جلسة مع مستشار بشري
              </h3>
              <p className="mt-3 text-sm leading-loose text-white/70">
                المحرك غير متأكد تمامًا من التوصية الأنسب لحالتك، أو أنك طلبت استشارة شخصية.
                نوصي بجلسة تعريفية مع مستشار وجيز (30 دقيقة) لصياغة خطتك بدقة — التشخيص الذي
                أتممته للتو سيجعل الجلسة أقصر وأعمق.
              </p>
              <AdvisorContact
                text={`مرحبا، أكملت مؤشر وجيز وأخبرني أن حالتي تستحق جلسة مع مستشار بشري — أريد حجز الجلسة التعريفية.`}
                label="احجز جلسة مستشار عبر واتساب"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold/60 px-5 py-2.5 text-sm font-bold text-gold-ink transition hover:bg-gold/10"
              />
            </div>
          )}

          {/* البدائل في ميزان واحد — ضمن النتيجة الكاملة للموثق */}
          {/* مقارنة الخيارات — الأساسي مع ما توفر من بدائل (أسرع/أوفر)، والعنوان يتبع العدد الفعلي */}
          {(result.faster || result.cheaper) && (() => {
            const altCount = 1 + (result.faster ? 1 : 0) + (result.cheaper ? 1 : 0);
            return (
            <div className="card-soft mt-8">
              <h3 className="h-card">{altCount === 2 ? "خياران" : "خياراتك الثلاثة"} في ميزان واحد — بدّل بثقة</h3>
              <p className="mt-2 text-xs leading-relaxed text-white/50">
                {altCount === 2 ? "مساران انتقاهما المحرك" : "ثلاثة مسارات انتقاها المحرك"} لحالتك تحديدا:
                توصيتنا الأساسية{result.faster ? "، وبديل أسرع" : ""}{result.cheaper ? "، وبديل أوفر" : ""} — والقرار الأخير لك.
                تفاصيل الاستثمار تظهر في صفحة المسار بعد اعتماده.
              </p>
              <div className={`mt-6 grid gap-4 ${altCount === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                {/* الأساسي */}
                <div className="flex flex-col rounded-2xl border border-teal/50 bg-teal/10 p-5">
                  <span className="kicker">توصيتك الحالية</span>
                  <h4 className="mt-3 text-sm font-black leading-snug">{topPathway.name}</h4>
                  <dl className="mt-3 space-y-1.5 text-xs text-white/55">
                    <div className="flex items-center justify-between gap-2">
                      <dt>المدة</dt>
                      <dd className="font-bold text-white/85">{weeksLabel(topPathway.durationWeeks)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt>الوقت الأسبوعي</dt>
                      <dd className="font-bold text-white/85">{topPathway.weeklyHours}</dd>
                    </div>
                  </dl>
                  <span className="mt-4 flex items-center gap-1.5 text-xs font-bold text-teal-light-ink">
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
                        <dd className="font-bold text-white/85">{weeksLabel(result.faster.durationWeeks)}</dd>
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
                      className="mt-4 w-fit border-teal/50 text-teal-light-ink hover:bg-teal/15"
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
                        <dd className="font-bold text-white/85">{weeksLabel(result.cheaper.p.durationWeeks)}</dd>
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
                      className="mt-4 w-fit border-teal/50 text-teal-light-ink hover:bg-teal/15"
                    >
                      <RefreshCcw className="ml-2 h-3.5 w-3.5" />
                      اجعله توصيتي الأولى
                    </Button>
                  </div>
                )}
              </div>
            </div>
            );
          })()}

          {/* شرح قوة الأدلة — أسفل التوصية كاملة لمن يريد التعمق بعد أن رأى كل شيء */}
          <details className="mx-auto mt-10 max-w-md rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right text-xs leading-relaxed text-white/55 print:hidden">
            <summary className="cursor-pointer text-center font-bold text-white/70">كيف حسبنا قوة أدلة التوصية؟</summary>
            <p className="mt-2">
              تبدأ من اكتمال صورتك: كل إجابة توضّح هدفك وواقعك ومهاراتك أكثر. ترتفع عندما تتفق
              إجاباتك مع بعضها، وتنخفض عند التناقض أو عندما تقف حالتك بين مسارين متقاربين.
              فوق ٧٥٪ المحرك واثق بتوصيته، وبين ٥٠ و٧٥٪ التوصية قوية ونعرض معها بدائل،
              ودون ذلك نحيلك لمستشار بشري قبل أي قرار.
            </p>
            {(() => {
              const conf = result.resultJson.confidence as
                | { coverage: number; consistency: number; separation: number; evidenceQuality: number; stability: number; total?: number }
                | undefined
              if (!conf) return null
              const parts = [
                { label: "اكتمال الصورة", value: conf.coverage },
                { label: "اتساق إجاباتك", value: conf.consistency },
                { label: "وضوح الفارق بين المسارات", value: conf.separation },
                { label: "جودة الأدلة", value: conf.evidenceQuality },
                { label: "ثبات النتيجة", value: conf.stability },
              ]
              return (
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  <p className="text-center font-bold text-white/70">
                    قوة الأدلة الإجمالية: {Math.floor((conf.total ?? 0) * 100)}٪
                  </p>
                  {parts.map((p) => (
                    <div key={p.label} className="flex items-center gap-2">
                      <span className="w-32 shrink-0 text-white/60">{p.label}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <span
                          className="block h-full rounded-full bg-teal"
                          style={{ width: `${Math.max(0, Math.min(100, Math.floor(p.value * 100)))}%` }}
                        />
                      </span>
                      <span className="w-9 shrink-0 text-left font-bold text-white/70">
                        {Math.floor(p.value * 100)}٪
                      </span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </details>

          <p className="mt-6 text-center text-xs leading-relaxed text-white/55">
            التوصية صادرة عن محرك تشخيص قطعي مبني على إجاباتك، وهي نقطة بداية مفسَّرة —
            القرار النهائي دائمًا بيدك، ومستشارونا موجودون عند الحاجة.
            هذا تشخيص تعليمي مهني: ليس تقييما نفسيا أو طبيا، ولا وعدا بوظيفة أو دخل.
          </p>

          {/* تعريف المنظومة — سطر ثقة ختامي بعد إخلاء المسؤولية، ثانوي بصريا */}
          <EcosystemNote className="mt-4 print:hidden" />

          {/* بطاقة الرأي — أسفل النتيجة، داخل البوابة: مضبّبة للضيف وتعمل بعد التسجيل */}
          <ResultFeedback
            sessionId={(result.resultJson.session_id as string | undefined) ?? `result-${topPathway.id}`}
            pathwayId={topPathway.id}
          />
          </ResultGate>
        </section>
        )}
        </ResultErrorBoundary>
      )}
    </div>
  );
}

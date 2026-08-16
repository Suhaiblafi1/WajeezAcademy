import { useEffect, useMemo, useRef, useState } from "react";
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
  History,
  Lock,
  FileText,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/services/currency";
import { track } from "@/services/analytics";
import { ensurePublishedSnapshot } from "@/services/catalog-snapshot";
import SeoHead from "@/components/SeoHead";
import { Badge } from "@/components/ui/badge";
import AuthGate from "@/components/AuthGate";
import CourseJourney from "@/components/CourseJourney";
import CvUpload from "@/components/CvUpload";
import { ResultErrorBoundary } from "@/components/ResultErrorBoundary";
import {
  type DiagQuestion,
  type DiagOption,
  type DiagResult,
  type Dim,
} from "@/data/diagnostic";
import { AssessmentSession, createAssessment, diagQuestionById } from "@/application/diagnostic/assessment-service";
import type { DeepeningComparison } from "@/application/diagnostic/assessment-service";
import { loadSession, saveLastResult, loadLastResultSafe, clearAllSessionData } from "@/application/diagnostic/session-store";
import { loadMirrorAnswers } from "@/domain/diagnostic/teaser-bridge";
import { sessionContributingReferences } from "@/data/methodology";
import type { SkillBar } from "@/application/diagnostic/view-model";
import {
  courseById,
  pathwayCourses,
  pathwayDelivery,
  courses,
  courseDetails,
  coursePriceOf,
  pathwayPriceFor,
  MIN_PATHWAY_COURSES,
  MAX_PATHWAY_COURSES,
  weeksLabel,
} from "@/data/courses";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import AdvisorContact from "@/components/AdvisorContact";
import { pathways, type Pathway } from "@/data/pathways";

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


/* ═══════════ خريطة المهارات المرئية — من متجه مهارات المحرك مباشرة ═══════════ */
function SkillMap({ bars }: { bars: SkillBar[] }) {
  const TARGET = 4;
  const WORDS = ["", "بداية", "أساسيات", "متوسط", "متقدم", "خبير"];
  if (bars.length === 0) return null;
  return (
    <div className="card-soft mt-8">
      <h3 className="h-card flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-[#6EC7D1]" />
        خريطة مهاراتك — كما سجّلها التشخيص من إجاباتك
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-white/50">
        كل مستوى من إجابة قدّمتها أثناء التشخيص. العلامة العنبرية: المستوى المستهدف لهدفك.
      </p>
      <div className="mt-6 space-y-5">
        {bars.map((bar) => {
          const lv = bar.level;
          return (
            <div key={bar.slug}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-bold text-white/85">
                  {bar.label}
                  {bar.isGap && (
                    <span className="mr-2 rounded-full bg-[#FABC05]/15 px-2 py-0.5 text-[10px] font-bold text-[#FABC05]">
                      فجوة يعالجها مسارك
                    </span>
                  )}
                </span>
                <span className="text-xs text-white/50">
                  {bar.measured ? `${WORDS[Math.min(5, Math.max(1, lv))]} — ${lv}/5` : "لم تُقس — فجوة يغطيها المسار"}
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-white/10" dir="ltr">
                {bar.measured && (
                  <div
                    className={`h-full rounded-full ${bar.isGap ? "bg-[#FABC05]" : "bg-[#38A7B4]"}`}
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

/* ═══════════ رحلة المسار خطوة بخطوة — حل محلها CourseJourney الأغنى (خامسا) ═══════════ */

/* ─────────── مكوّن تخصيص المسار ─────────── */
/* صف دورة قابل للطي — السهم يفتح المحاور والمخرج والمدرب من courseDetails() دون نافذة */
function CourseRow({
  courseId,
  gift = false,
  onRemove,
  removeDisabled = false,
  removeLabel,
}: {
  courseId: string;
  gift?: boolean;
  onRemove: () => void;
  removeDisabled?: boolean;
  removeLabel?: string;
}) {
  const c = courseById(courseId);
  if (!c) return null;
  const d = courseDetails(c);
  return (
    <Collapsible
      className={`rounded-xl border px-4 py-3 ${
        gift ? "border-[#FABC05]/40 bg-[#FABC05]/[0.06]" : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <CollapsibleTrigger
          className="group flex min-w-0 flex-1 items-center gap-3 text-right"
          aria-label={`محاور ${c.name}`}
        >
          {gift ? (
            <Gift className="h-4 w-4 shrink-0 text-[#FABC05]" />
          ) : (
            <BookOpen className="h-4 w-4 shrink-0 text-[#6EC7D1]" />
          )}
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">{c.name}</span>
              {gift && (
                <span className="rounded-full bg-[#FABC05] px-2 py-0.5 text-[10px] font-black text-[#0D0D0D]">هدية مجانية</span>
              )}
            </span>
            <span className="mt-0.5 block text-xs text-white/45">
              {c.weeks} {c.weeks === 1 ? "أسبوع" : "أسابيع"} · {c.skill}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <button
          onClick={onRemove}
          disabled={removeDisabled}
          aria-label={removeLabel ?? `حذف ${c.name}`}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition disabled:opacity-30 ${
            gift
              ? "border-[#FABC05]/30 text-[#FABC05]/80 hover:border-[#FABC05]/60 hover:text-[#FABC05]"
              : "border-white/10 text-white/50 hover:border-red-400/50 hover:text-red-300"
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <CollapsibleContent className="data-[state=open]:story-fade">
        <div className="mt-3 space-y-2.5 border-t border-white/10 pt-3 text-xs leading-6">
          <p className="text-white/55">
            <span className="font-bold text-[#6EC7D1]">المدرب: </span>
            {d.trainer.name}
          </p>
          <div>
            <p className="mb-1.5 font-bold text-[#6EC7D1]">المحاور:</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {d.topics.map((topic) => (
                <li key={topic} className="flex items-start gap-2 text-white/60">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#38A7B4]" />
                  {topic}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-white/55">
            <span className="font-bold text-[#6EC7D1]">المخرج العملي: </span>
            {d.outcome}
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

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

      {/* دورات المسار الحالية — والهدية عنصر أخير فيها بلا أثر على العدد ولا السعر */}
      <p className="mt-6 mb-3 text-sm font-bold text-white/70">
        دورات مسارك ({allShown.length} {gift ? "— إحداها هدية مجانية" : `من ${MIN_PATHWAY_COURSES}–${MAX_PATHWAY_COURSES}`})
      </p>
      <div className="grid gap-2">
        {chosen.map((c) => (
          <CourseRow key={c.id} courseId={c.id} onRemove={() => removeCourse(c.id)} removeDisabled={chosenIds.length <= MIN_PATHWAY_COURSES} />
        ))}
        {gift && (
          <CourseRow
            courseId={gift.id}
            gift
            onRemove={() => pickGift(gift.id)}
            removeLabel={`إلغاء الهدية ${gift.name}`}
          />
        )}
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
          <p className="mt-3 text-xs text-white/50">
            تظهر هديتك الآن آخر قائمة الدورات بشارة «هدية مجانية» — ويمكنك إلغاؤها أو تغييرها متى شئت.
          </p>
        )}
      </div>

      {/* إعادة الصياغة */}
      <div className="mt-6 text-center">
        <Button
          size="lg"
          onClick={recompose}
          className="h-12 rounded-full bg-[#38A7B4] px-8 font-black text-[#08272B] hover:bg-[#247B84] hover:text-white"
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
    <div className="mt-10 overflow-hidden rounded-3xl border border-[#FABC05]/40 bg-gradient-to-b from-[#1A1A1A] to-[#0D0D0D]">
      <div className="border-b border-white/10 bg-[#FABC05]/10 px-6 py-3">
        <span className="text-sm font-black text-[#FABC05]">{composite.label_ar}</span>
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
            <p className="font-black text-[#FABC05]">{variant.label}</p>
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
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FABC05]" />
                {r}
              </li>
            ))}
          </ul>
        )}

        {/* دورات الخطة تُعرض في «رحلة الدورات» الموحدة أسفل هذه البطاقة — لا تكرار */}

        {/* دورات أُزيلت بدليل إتقان موثق */}
        {composite.removed_courses.length > 0 && (
          <div className="mt-5 rounded-2xl border border-[#38A7B4]/30 bg-[#38A7B4]/[0.06] p-4">
            <p className="text-sm font-black text-[#6EC7D1]">أزلناها لأنك تتقنها — لا تدفع ثمن ما تعرفه:</p>
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
                <p className="flex items-center gap-2 text-xs font-black text-[#FABC05]">
                  <FileText className="h-4 w-4" /> مشروع إثبات الجاهزية
                </p>
                <p className="mt-2 text-xs leading-6 text-white/65">{composite.capstone_ar}</p>
              </div>
            )}
            {composite.success_metric_ar && (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="flex items-center gap-2 text-xs font-black text-[#6EC7D1]">
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
  /* إجابات مؤشر وجيز التمهيدي (الصفحة الرئيسية) تُنقل للجلسة ولا تُسأل مجددا */
  const [mirrorCarried] = useState<boolean>(() => loadMirrorAnswers(window.localStorage) !== null);
  /* نتيجة مكتملة محفوظة — تُقرأ عبر مخطط صارم: تُرحّل إن أمكن، وتُحذف بأمان مع رسالة إن تعذر */
  const [storedInitial] = useState(() => loadLastResultSafe());
  const savedDone: DiagResult | null =
    storedInitial.status === "ok" || storedInitial.status === "migrated" ? storedInitial.result : null;
  const discardedResultNotice = storedInitial.status === "discarded" ? storedInitial.reason_ar : null;
  /* جلسة المحرك الحتمي — مصدر الأسئلة والنتيجة الوحيد */
  const sessionRef = useRef<AssessmentSession | null>(null);
  /* الضيف أولا: يكمل التشخيص كاملا ويرى ملخصه الأولي، والحساب يُطلب فقط لفتح التفاصيل والحفظ */
  const [authed, setAuthed] = useState(() => Boolean(localStorage.getItem("wajeez_user")));
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

  // يبدأ فورا كضيف — الحساب يُطلب لاحقا عند حفظ النتيجة وتخصيصها
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
      } else {
        finish();
      }
      return;
    }
    setQuestion(step.question);
    setStage("questions");
  };

  const start = async () => {
    track("diagnostic_started");
    /* اللقطة المنشورة أولا — المحرك يقرأ أحدث كتالوج محكوم، أو الحزمة المضمنة بصمت */
    await ensurePublishedSnapshot();
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

  const restartFresh = () => {
    clearAllSessionData();
    window.location.reload();
  };

  const finish = () => {
    const session = sessionRef.current;
    if (!session) return;
    track("diagnostic_completed", { questions: session.askedCount });
    const { result: res } = session.finish();
    saveLastResult(res);
    setSavedProgress(null);
    setResult(res);
    setTopPathway(res.top);
    track("recommendation_viewed", { confidence: res.confidence });
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
    saveLastResult(res);
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
    <div dir="rtl" className="min-h-screen bg-[#0D0D0D] text-white">
      <SeoHead
        title="التشخيص الذكي"
        description="تشخيص تعليمي تكيفي يفهم هدفك وواقعك، ويوصي بمسار واحد مفسّر بدرجة ثقة — مجاني ودون حساب."
        path="/diagnostic"
      />
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0D0D0D]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2 text-white/70 hover:text-white">
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm font-medium">العودة للرئيسية</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
            <span className="font-black">أكاديمي وجيز</span>
          </div>
        </div>
      </header>

      {/* ─── Intro ─── */}
      {stage === "intro" && (
        <section className="story-fade mx-auto max-w-3xl px-5 py-16 text-center md:py-24">
          <Badge className="border border-[#FABC05]/40 bg-[#FABC05]/10 text-[#FABC05]">مؤشر وجيز الكامل</Badge>
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
            نسترشد في بناء أسئلتنا بأطر مهنية وتعليمية معروفة: <span className="font-bold text-[#6EC7D1]">RIASEC</span> للميول المهنية،
            و<span className="font-bold text-[#6EC7D1]">O*NET وESCO</span> لخرائط المهارات،
            و<span className="font-bold text-[#6EC7D1]">DigComp</span> للجاهزية الرقمية — وتُعرض عليك تفاصيلها في صفحة المنهجية.
          </p>

          {/* إجابات المؤشر التمهيدي منقولة — لا نسألك مرتين */}
          {mirrorCarried && (
            <p className="mx-auto mt-4 flex max-w-lg items-center justify-center gap-2 rounded-2xl border border-[#38A7B4]/30 bg-[#38A7B4]/[0.08] px-5 py-3 text-xs font-semibold leading-relaxed text-[#6EC7D1]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              إجاباتك في مؤشر وجيز التمهيدي محفوظة ومنقولة لهذه الجلسة — لن نسألك عنها مرة أخرى.
            </p>
          )}

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

          {/* نتيجة قديمة لم يمكن ترحيلها — حُذفت بأمان ونطلب إعادة التشخيص بوضوح */}
          {!savedProgress && !savedDone && discardedResultNotice && (
            <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-[#FABC05]/40 bg-[#FABC05]/[0.07] p-5">
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-[#FABC05]">
                <History className="h-4 w-4" />
                نتيجتك السابقة لم تعد صالحة
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/55">{discardedResultNotice}</p>
            </div>
          )}

          {/* نتيجة مكتملة محفوظة — لا نطلب المؤشر مرتين */}
          {!savedProgress && savedDone && (
            <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 p-5">
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-[#6EC7D1]">
                <History className="h-4 w-4" />
                لديك نتيجة مؤشر محفوظة على جهازك
              </p>
              <p className="mt-1.5 text-xs text-white/50">أكملت التشخيص سابقا — لا حاجة لإعادته إلا إذا تغيرت ظروفك</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Button
                  onClick={showSavedResult}
                  className="rounded-full bg-[#38A7B4] px-6 font-black text-[#08272B] hover:bg-[#38A7B4]/90"
                >
                  اعرض نتيجتي المحفوظة
                  <ArrowLeft className="mr-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={restartFresh}
                  className="rounded-full border-white/20 text-white/70 hover:bg-white/5"
                >
                  أعد المؤشر من جديد
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
          {/* شريط جولة التدقيق — يحل محل شريط المراحل أثناء «دقّق خطتك أكثر» */}
          {deepStep ? (
            <div className="mb-6 rounded-2xl border border-[#38A7B4]/40 bg-[#38A7B4]/[0.07] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-black text-[#6EC7D1]">
                  <Wand2 className="h-4 w-4" />
                  جولة تدقيق خطتك — أسئلة أعمق لزيادة وضوح التوصية
                </p>
                <span className="text-xs font-bold text-white/55">
                  سؤال {deepStep.index} من {deepStep.total}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#38A7B4] transition-all duration-500"
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
                          ? "border-[#FABC05] bg-[#FABC05] text-[#0D0D0D]"
                          : done
                            ? "border-[#38A7B4] bg-[#38A7B4]/20 text-[#6EC7D1]"
                            : "border-white/15 text-white/55"
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </span>
                    <span
                      className={`text-center text-[10px] font-bold leading-tight md:text-[11px] ${
                        active ? "text-[#FABC05]" : done ? "text-[#6EC7D1]" : "text-white/55"
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
          </>
          )}

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
              {/* لا يُعرض اسم المسار أو القالب أثناء الأسئلة أبدا — كشف التوصية مبكرا يوجّه الإجابات.
                  يظهر فقط ما فُهم (هدف/وقت/سياق) عبر شارات الأبعاد أعلاه. */}
            </div>
          )}

          <div key={question.id} className="story-fade">
            {(question.level === "deep" || question.level === "conditional") && (
              <p className="mb-4 w-fit rounded-full border border-[#FABC05]/40 bg-[#FABC05]/10 px-3 py-1 text-xs font-bold text-[#FABC05]">
                سؤال تعميق — بناءً على إجاباتك تحديدا
              </p>
            )}
            <h2 className="text-2xl font-black leading-snug md:text-3xl">{qText}</h2>
            {deepStep?.reasonAr && (
              <p className="mt-3 w-fit rounded-xl border border-[#38A7B4]/30 bg-[#38A7B4]/[0.06] px-3.5 py-2 text-[11px] leading-relaxed text-white/55">
                <span className="font-bold text-[#6EC7D1]">لماذا هذا السؤال؟ </span>
                {deepStep.reasonAr}
              </p>
            )}
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
                      onClick={() => answer(question.id, opt.value, opt.optionId ? [opt.optionId] : undefined)}
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
                    تخطَّ هذا السؤال
                  </button>
                  <Button
                    onClick={() => answer(question.id, textDraft.trim())}
                    disabled={textDraft.trim().length === 0}
                    className="rounded-full bg-[#FABC05] px-8 font-black text-[#0D0D0D] hover:bg-[#FABC05]/90"
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
                                  ? "border-[#38A7B4] bg-[#38A7B4]/25 text-[#6EC7D1]"
                                  : "border-white/10 bg-white/[0.03] text-white/55 hover:border-[#6EC7D1]/50"
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
                  /* الحفظ تلقائي مع كل إجابة عبر الخدمة — هذا الزر طمأنة فقط */
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

      {/* ─── Result ─── */}
      {stage === "result" && result && topPathway && (
        <ResultErrorBoundary onReset={restart}>
        <section className="story-fade mx-auto max-w-3xl px-5 py-12 md:py-16">
          {(() => {
            const compositeView = (result.resultJson.composite as CompositeView | null) ?? null;
            const confBand = (result.resultJson.confidence as { band?: string } | undefined)?.band;
            const stabilityLabel =
              confBand === "strong" ? "مرتفع" : confBand === "good" ? "متوسط" : "يحتاج إلى معلومات إضافية";
            const topGaps =
              result.gapDetails.length > 0
                ? result.gapDetails.slice(0, 3).map((g) => g.skill)
                : result.gaps.slice(0, 3);
            const deepeningDone = Boolean(result.resultJson.deepening);
            const isGuardrail = result.resultJson.kind === "guardrail_stop";
            const deepeningOffered = !deepeningDone && canDeepen && !isGuardrail;
            return (
          <div className="text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge className="border border-[#38A7B4]/40 bg-[#38A7B4]/10 text-[#6EC7D1]">اكتمل التشخيص</Badge>
              <Badge className={`font-black ${compositeView ? "bg-[#FABC05] text-[#0D0D0D]" : "bg-[#38A7B4] text-[#08272B]"}`}>
                {compositeView ? "خطة مركبة مخصصة" : "مسارك المقترح"}
              </Badge>
            </div>
            <h1 className="mt-4 text-3xl font-black leading-snug md:text-4xl">
              {compositeView ? compositeView.name_ar : topPathway.name}
            </h1>
            {/* جملة سبب واحدة — أوضح دليل على التوصية */}
            {result.reasons[0] && (
              <p className="mx-auto mt-4 max-w-xl text-sm leading-loose text-white/65">{result.reasons[0]}</p>
            )}
            {/* أهم ثلاث فجوات + ثبات التوصية كنص لا نسبة */}
            <div className="mx-auto mt-5 flex w-fit max-w-full flex-wrap items-center justify-center gap-2">
              {topGaps.map((g) => (
                <span key={g} className="rounded-full border border-[#FABC05]/35 bg-[#FABC05]/[0.08] px-3.5 py-1 text-xs font-bold text-[#FABC05]">
                  فجوة: {g}
                </span>
              ))}
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-xs font-bold text-white/70">
                <Gauge className="h-3.5 w-3.5 text-[#6EC7D1]" />
                ثبات التوصية: {stabilityLabel}
              </span>
            </div>
            {/* الإجراءان الرئيسيان في أول شاشة */}
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row print:hidden">
              <Button
                size="lg"
                onClick={() => document.getElementById("learning-plan")?.scrollIntoView({ behavior: "smooth" })}
                className="h-12 rounded-full bg-[#FABC05] px-8 font-black text-[#0D0D0D] hover:bg-[#FABC05]/90"
              >
                استعرض خطتي التعليمية
                <ChevronDown className="mr-2 h-4 w-4" />
              </Button>
              {deepeningOffered && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={startDeepeningRound}
                  className="h-12 rounded-full border-[#38A7B4]/50 px-8 font-black text-[#6EC7D1] hover:bg-[#38A7B4]/15"
                >
                  <Wand2 className="ml-2 h-4 w-4" />
                  دقّق خطتك أكثر
                </Button>
              )}
            </div>
            {deepeningOffered && !deepUnavailable && (
              <p className="mt-2 text-[11px] text-white/40 print:hidden">
                «دقّق خطتك أكثر»: جولة منفصلة اختيارية من 4 إلى 8 أسئلة تزيد وضوح التوصية.
              </p>
            )}
            {deepUnavailable && (
              <p className="mt-2 text-[11px] font-bold text-[#6EC7D1] print:hidden">
                صورتك مكتملة بما يكفي — لا أسئلة إضافية نافعة، توصيتك جاهزة بثقة.
              </p>
            )}
            {/* شرح قوة الأدلة بلغة مبسطة + مكوناتها الخمسة — نسبة موثقة الحساب داخل توسعة */}
            <details className="mx-auto mt-5 max-w-md rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right text-xs leading-relaxed text-white/55 print:hidden">
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
                            className="block h-full rounded-full bg-[#38A7B4]"
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
            <button
              onClick={() => window.print()}
              className="mx-auto mt-4 flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/60 transition hover:border-[#6EC7D1]/50 hover:text-[#6EC7D1] print:hidden"
            >
              <FileText className="h-3.5 w-3.5" />
              اطبع نتيجتك أو حمّلها ملفا
            </button>
          </div>
            );
          })()}

          {/* مقارنة جولة التدقيق — قبل/بعد موثقة */}
          {(() => {
            const cmp = (result.resultJson.deepening as DeepeningComparison | null) ?? null;
            if (!cmp) return null;
            return (
              <div className={`mt-8 rounded-3xl border p-6 md:p-8 ${cmp.changed ? "border-[#FABC05]/50 bg-[#FABC05]/[0.06]" : "border-[#38A7B4]/40 bg-[#38A7B4]/[0.05]"}`}>
                <h3 className="flex items-center gap-2 text-lg font-black">
                  <Wand2 className={`h-5 w-5 ${cmp.changed ? "text-[#FABC05]" : "text-[#6EC7D1]"}`} />
                  نتيجة تدقيق خطتك
                </h3>
                <p className={`mt-3 text-sm font-bold leading-relaxed ${cmp.changed ? "text-[#FABC05]" : "text-[#6EC7D1]"}`}>
                  {cmp.note_ar}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/[0.04] p-4">
                    <p className="text-[11px] font-bold text-white/45">قبل التدقيق</p>
                    <p className="mt-1.5 text-sm font-black leading-snug text-white/85">{cmp.before.topLabel_ar}</p>
                    <p className="mt-1 text-xs text-white/55">مستوى الثبات: {cmp.before.confidenceBand_ar}</p>
                  </div>
                  <div className="rounded-xl border border-[#38A7B4]/30 bg-[#38A7B4]/[0.07] p-4">
                    <p className="text-[11px] font-bold text-[#6EC7D1]">بعد التدقيق</p>
                    <p className="mt-1.5 text-sm font-black leading-snug">{cmp.after.topLabel_ar}</p>
                    <p className="mt-1 text-xs text-white/65">مستوى الثبات: {cmp.after.confidenceBand_ar}</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {cmp.reasons_ar.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-xs leading-relaxed text-white/60">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#6EC7D1]" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {/* قصتك كما فهمناها — يقرأ نفسه قبل أن يرى التوصية */}
          {((result.resultJson.story_ar as string[] | undefined) ?? []).length > 0 && (
            <div className="card-soft mt-10 border-[#38A7B4]/30">
              <h3 className="h-card flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-[#6EC7D1]" />
                قصتك كما فهمناها
              </h3>
              <div className="mt-4 space-y-2.5">
                {((result.resultJson.story_ar as string[] | undefined) ?? []).map((line) => (
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
          <SkillMap bars={((result.resultJson.skill_bars as SkillBar[] | undefined) ?? [])} />

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

              {/* المدة والوقت والمستوى — شارات صغيرة لا تنافس اسم المسار */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-white/70">
                  <BookOpen className="h-3.5 w-3.5 text-[#6EC7D1]" />
                  {(pathwayCourses[topPathway.id] ?? []).length} دورات
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-white/70">
                  <CalendarClock className="h-3.5 w-3.5 text-[#6EC7D1]" />
                  {weeksLabel(topPathway.durationWeeks)}
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-white/70">
                  <Clock3 className="h-3.5 w-3.5 text-[#6EC7D1]" />
                  {topPathway.weeklyHours} أسبوعيا
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-white/70">
                  <Gauge className="h-3.5 w-3.5 text-[#6EC7D1]" />
                  مستوى {topPathway.level}
                </span>
              </div>
              <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-white/60">
                <RouteIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#FABC05]" />
                <span>
                  <span className="font-bold text-white/80">المخرج العملي: </span>
                  {topPathway.output}
                </span>
              </p>

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

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm font-black text-[#6EC7D1]">ماذا ستحصل عليه فعليا؟</p>
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
                      <f.icon className="h-4 w-4 text-[#6EC7D1]" />
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

          {/* الخطة المركبة المخصصة — عندما تمتد حاجتك إلى مجالين */}
          {((result.resultJson.composite as CompositeView | null) ?? null) && (
            <CompositePlan composite={result.resultJson.composite as CompositeView} />
          )}

          {/* «ماذا ستحقق من خلال خطتك؟» — رحلة الدورات الموحدة بأكورديون داخل الصفحة */}
          {(() => {
            const compositeView = (result.resultJson.composite as CompositeView | null) ?? null;
            const ordered = compositeView
              ? [...compositeView.courses].sort((a, b) => a.sequence - b.sequence)
              : null;
            const ids = ordered ? ordered.map((c) => c.courseId) : (pathwayCourses[topPathway.id] ?? []);
            const reasons = ordered
              ? Object.fromEntries(ordered.map((c) => [c.courseId, c.reason_ar]))
              : undefined;
            return <CourseJourney courseIds={ids} reasons={reasons} delivery={pathwayDelivery(topPathway.id)} />;
          })()}

          {/* Why this recommendation — ثلاث نقاط قصيرة + توسعة بالتفصيل */}
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <h3 className="flex items-center gap-2 text-lg font-black">
              <Sparkles className="h-5 w-5 text-[#FABC05]" />
              لماذا هذا المسار؟
            </h3>
            <ul className="mt-4 space-y-3">
              {result.reasons.slice(0, 3).map((r) => (
                <li key={r} className="flex items-start gap-3 text-sm leading-relaxed text-white/70">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#38A7B4]" />
                  {r}
                </li>
              ))}
            </ul>
            <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 print:hidden">
              <summary className="cursor-pointer text-sm font-bold text-[#6EC7D1]">
                اعرف سبب التوصية بالتفصيل
              </summary>
              <div className="mt-3">
                {result.reasons.length > 3 && (
                  <ul className="space-y-2.5">
                    {result.reasons.slice(3).map((r) => (
                      <li key={r} className="flex items-start gap-3 text-sm leading-relaxed text-white/60">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#38A7B4]/70" />
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
                {answers["notes"] && (
                  <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-white/60">
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
                {/* مكونات الملاءمة الخمسة للمسار الأول — شفافية كاملة */}
                {(() => {
                  const fit = result.resultJson.primary_fit as
                    | { persona: number; goal: number; skill_gap: number; feasibility: number; motivation: number; total?: number }
                    | null
                    | undefined
                  if (!fit) return null
                  const parts = [
                    { label: "ملاءمة شخصيتك وواقعك", value: fit.persona },
                    { label: "ملاءمة هدفك", value: fit.goal },
                    { label: "سدّ فجوة مهاراتك", value: fit.skill_gap },
                    { label: "ملاءمة وقتك وظروفك", value: fit.feasibility },
                    { label: "دافعيتك واستعدادك", value: fit.motivation },
                  ]
                  return (
                    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs">
                      <p className="font-bold text-white/70">
                        درجة ملاءمة المسار لك: {Math.floor((fit.total ?? 0) * 100)}٪ — كيف توزعت؟
                      </p>
                      <div className="mt-3 space-y-2">
                        {parts.map((p) => (
                          <div key={p.label} className="flex items-center gap-2">
                            <span className="w-36 shrink-0 text-white/60">{p.label}</span>
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                              <span
                                className="block h-full rounded-full bg-[#FABC05]"
                                style={{ width: `${Math.max(0, Math.min(100, Math.floor(p.value * 100)))}%` }}
                              />
                            </span>
                            <span className="w-9 shrink-0 text-left font-bold text-white/70">
                              {Math.floor(p.value * 100)}٪
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </details>
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

          {/* خريطة فجواتك التفصيلية — داخل توسعة ليبقى المسح البصري خفيفا */}
          {result.gapDetails.length > 0 && (
            <details className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <summary className="flex cursor-pointer items-center gap-2 text-lg font-black">
                <Gauge className="h-5 w-5 text-[#6EC7D1]" />
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
            </details>
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

          {/* هل هناك معلومات لم نعرفها بعد؟ — قسم مختصر قابل للتوسعة بثلاثة إجراءات */}
          <details className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8 print:hidden">
            <summary className="flex cursor-pointer items-center gap-2 text-lg font-black">
              <Lightbulb className="h-5 w-5 text-[#6EC7D1]" />
              هل هناك معلومات لم نعرفها بعد؟
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              خبرتك السابقة، سيرتك الذاتية أو هدف مهني محدد قد يساعدنا على تدقيق خطتك أكثر.
            </p>
            <ul className="mt-4 space-y-2.5">
              {result.changeMakers.map((c) => (
                <li key={c} className="flex items-start gap-3 text-xs leading-relaxed text-white/55">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6EC7D1]" />
                  {c}
                </li>
              ))}
            </ul>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {!result.resultJson.deepening && canDeepen && result.resultJson.kind !== "guardrail_stop" && (
                <button
                  onClick={startDeepeningRound}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-[#38A7B4]/50 bg-[#38A7B4]/[0.08] px-4 py-3 text-xs font-bold text-[#6EC7D1] transition hover:bg-[#38A7B4]/15"
                >
                  <Wand2 className="h-4 w-4" />
                  أجب عن أسئلة إضافية
                </button>
              )}
              <AdvisorContact
                text={`مرحبا، أكملت مؤشر وجيز ورُشّح لي مسار «${topPathway.name}»، وأود أن أضيف معلومة قد تغيّر نتيجتي.`}
                label="تواصل مع المستشار"
                className="flex items-center justify-center gap-2 rounded-2xl border border-[#38A7B4]/50 bg-[#38A7B4]/[0.08] px-4 py-3 text-xs font-bold text-[#6EC7D1] transition hover:bg-[#38A7B4]/15"
              />
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-xs font-bold text-white/60 sm:col-span-1">
                أرسل سيرتك للمستشار ↓
              </div>
            </div>
            {/* رفع السيرة — اختياري تماما، يقرأه المستشار البشري فقط */}
            <div className="mt-4">
              <p className="mb-2 text-xs leading-relaxed text-white/50">
                يمكنك إرفاق سيرتك الذاتية ليطّلع عليها مستشار وجيز قبل التواصل معك.
              </p>
              <CvUpload
                sessionId={(result.resultJson.session_id as string | undefined) ?? `result-${topPathway.id}`}
                userId={authed ? (localStorage.getItem("wajeez_user") ?? null) : null}
              />
            </div>
          </details>

          {/* كيف بُنيت توصيتك؟ — المراجع التي ساهمت فعليا في هذه الجلسة فقط */}
          {(() => {
            const refs = sessionContributingReferences({
              interestVector: (result.resultJson.interest_vector as Record<string, number> | undefined) ?? {},
              skillVector: (result.resultJson.skill_vector as Record<string, number> | undefined) ?? {},
              hasTrace: Array.isArray(result.resultJson.decision_trace) && (result.resultJson.decision_trace as unknown[]).length > 0,
            });
            if (refs.length === 0) return null;
            return (
              <details className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8 print:hidden">
                <summary className="flex cursor-pointer items-center gap-2 text-lg font-black">
                  <BookOpen className="h-5 w-5 text-[#6EC7D1]" />
                  كيف بُنيت توصيتك؟
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/60">
                  بُنيت هذه النتيجة على إشارات من إجاباتك (هدفك وواقعك وميولك)، وفجوات المهارات المكتشفة أعلاه،
                  ثم رُبطت بالمسار أو الخطة المركبة الأعلى ملاءمة — بالاستفادة من الأطر المهنية التالية التي
                  ساهمت فعليا في جلستك:
                </p>
                <ul className="mt-4 space-y-2.5">
                  {refs.map((r) => (
                    <li key={r.id} className="flex items-start gap-3 text-sm leading-relaxed text-white/65">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#38A7B4]" />
                      <span>
                        <span className="font-bold text-white/85">{r.name_ar}</span> — {r.purpose_ar}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/methodology"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#6EC7D1] transition hover:text-white"
                >
                  اكتشف كيف نبني توصيتك — منهجية وجيز
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </details>
            );
          })()}

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
              <AdvisorContact
                text={`مرحبا، أكملت مؤشر وجيز وأخبرني أن حالتي تستحق جلسة مع مستشار بشري — أريد حجز الجلسة التعريفية.`}
                label="احجز جلسة مستشار عبر واتساب"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#FABC05]/60 px-5 py-2.5 text-sm font-bold text-[#FABC05] transition hover:bg-[#FABC05]/10"
              />
            </div>
          )}

          {/* ما تبقى يتطلب حسابا مجانيا: اعتماد المسار وبدائله وتخصيصه */}
          {authed ? (
            <>
          {/* قرار مبكر لمن اقتنع — دون المرور على كل التفاصيل */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <Button size="lg" className="h-12 rounded-full bg-[#FABC05] px-10 font-black text-[#0D0D0D] hover:bg-[#FABC05]/90" asChild>
              <Link to={`/pathways/${topPathway.id}`}>
                اعتمد مساري الآن
                <ArrowLeft className="mr-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="text-xs text-white/45">أو تابع القراءة — البدائل والتخصيص أسفل الصفحة</p>
          </div>

          {/* رحلة الدورات تظهر للجميع أعلاه؛ هنا البدائل والتخصيص */}

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
                      <dd className="font-bold text-white/85">{weeksLabel(topPathway.durationWeeks)}</dd>
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
            <div className="mt-10 overflow-hidden rounded-3xl border border-[#38A7B4]/40 bg-gradient-to-b from-[#12343B] to-[#0D0D0D] p-6 text-center md:p-10">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#38A7B4]/15">
                <Lock className="h-7 w-7 text-[#6EC7D1]" />
              </span>
              <h3 className="mt-5 text-xl font-black md:text-2xl">نتيجتك كاملة بين يديك — بقي حفظها واعتمادها</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-loose text-white/60">
                رأيت مسارك الموصى به وقصتك وتفسير التوصية وخريطة فجواتك كاملة. أنشئ حسابك المجاني لتحفظ نتيجتك وتفتح:
              </p>
              <div className="mx-auto mt-6 grid max-w-lg gap-2.5 text-right sm:grid-cols-2">
                {[
                  "البدائل المناسبة: أسرع وأوفر — بدّل بثقة",
                  "رحلة المسار خطوة بخطوة حتى المخرج النهائي",
                  "تخصيص المسار: احذف وأضف دورات كما تشاء",
                  "اعتماد المسار وفتح صفحته وتقريرك الشخصي",
                ].map((f) => (
                  <p key={f} className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold leading-relaxed text-white/75">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6EC7D1]" />
                    {f}
                  </p>
                ))}
              </div>
              <Button
                size="lg"
                onClick={() => setStage("gate")}
                className="mt-8 h-14 rounded-full bg-[#38A7B4] px-10 text-lg font-black text-[#08272B] hover:bg-[#38A7B4]/90"
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

          <p className="mt-6 text-center text-xs leading-relaxed text-white/55">
            التوصية صادرة عن محرك تشخيص قطعي مبني على إجاباتك، وهي نقطة بداية مفسَّرة —
            القرار النهائي دائمًا بيدك، ومستشارونا موجودون عند الحاجة.
            هذا تشخيص تعليمي مهني: ليس تقييما نفسيا أو طبيا، ولا وعدا بوظيفة أو دخل.
          </p>
        </section>
        </ResultErrorBoundary>
      )}
    </div>
  );
}

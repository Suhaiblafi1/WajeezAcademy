import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ArrowRight,
  ArrowLeft,
  Compass,
  ListChecks,
  ScanSearch as SearchIcon,
  ShieldCheck,
  Clock3,
  Sparkles,
  CheckCircle2,
  RefreshCcw,
  UserCheck,
  CalendarClock,
  Route as RouteIcon,
  Gauge,
  AlertCircle,
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
import { useCoursePrices, cheapestOf, pricedCount, formatCohortPrice } from "@/services/cohort-prices";
import { ensurePublishedSnapshot } from "@/services/catalog-snapshot";
import { ensurePublishedContent } from "@/services/public-content";
import SeoHead from "@/components/SeoHead";
import EcosystemNote from "@/components/EcosystemNote";
import { Badge } from "@/components/ui/badge";
import ResultGate from "@/components/ResultGate";
import { FIRST_TIME_PROMO } from "@/application/commerce/first-time-promo";
import ResultFeedback from "@/components/ResultFeedback";
import CourseJourney, { type CourseSuggestion } from "@/components/CourseJourney";
import { ResultErrorBoundary } from "@/components/ResultErrorBoundary";
import SkillFamilyGrid, { type FamilyToRate } from "@/components/SkillFamilyGrid";
import ComposedPlanCard, { type ComposedPathView, type ComposedCourseView } from "@/components/ComposedPlanCard";
import { Q } from "@/domain/diagnostic/v2_1/maps";
import { skillNamesAr, courseById as catalogCourseById } from "@/domain/diagnostic/catalog";
import {
  type DiagQuestion,
  type DiagOption,
  type DiagResult,
  type Dim,
} from "@/data/diagnostic";
import { AssessmentSession, createAssessment, diagQuestionById, type NextStep } from "@/application/diagnostic/assessment-service";
import type { DeepeningComparison } from "@/application/diagnostic/assessment-service";
import { loadSession, saveLastResult, loadLastResultSafe } from "@/application/diagnostic/session-store";
import { foldComposedPlan } from "@/application/diagnostic/composed-fold";
import { saveAdoptedPlan, syncAdoptedPlan, PERSONAL_PLAN_NAME_AR } from "@/application/plan/adopted-plan";
import { NEEDS_ADVISOR_KEY } from "@/application/plan/advisor-referral";
import {
  courseById,
  pathwayCourses,
  pathwayDelivery,
  courses,
  MIN_PATHWAY_COURSES,
  MAX_PATHWAY_COURSES,
  weeksLabel,
} from "@/data/courses";
import AdvisorContact from "@/components/AdvisorContact";
import { pathways, pathwayCategory, type Pathway } from "@/data/pathways";

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
};

/* ═══════════ وحدات الرحلة الخمس — شريط التقدم الجديد ═══════════ */
const JOURNEY_STAGES = [
  { key: "who", label: "من أنت" },
  { key: "goal", label: "هدفك" },
  { key: "story", label: "قصتك وواقعك" },
  { key: "skills", label: "مهاراتك ورصيدك" },
  { key: "life", label: "ظروفك وخطتك" },
] as const;

/* أسئلة القرار الست (وحدة QC) تُوزَّع على مراحلها بمعرّفها لا بوحدتها: وحدتها
   واحدة بينما تنتمي إلى ثلاث مراحل مختلفة. وقبل هذا كانت تسقط إلى الفرع الأخير
   فيرى المتعلم «المرحلة ٥ من ٥» في السؤال الأول — وهي أسئلة «من أنت» و«هدفك»
   نفسها — ثم يتذبذب المؤشر ٥→٢→٥. */
const QC_STAGE: Record<string, number> = {
  [Q.STAGE]: 0,       // من أنت
  [Q.EMPLOYMENT]: 0,  // من أنت
  [Q.GOAL]: 1,        // هدفك
  [Q.NEED]: 1,        // هدفك
  [Q.TIME]: 4,        // ظروفك وخطتك
  [Q.MASTERY]: 4,     // ظروفك وخطتك
};

function stageIndexOf(q: DiagQuestion | null): number {
  if (!q) return 0;
  const qc = QC_STAGE[q.id];
  if (qc !== undefined) return qc;
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

/* سبب وجود المقرر في خطة مركّبة من المقررات — بلغة المتعلم لا بلغة المحرك.

   كان السطر «يسدّ ٤ من فجواتك المقيسة · في صميم مجالك الأول» — ويظهر بنصّه هذا
   حرفيا تحت كل دورة في الخطة. عددٌ متساوٍ ووصفٌ ثابت لا يفرّقان دورة عن أخرى،
   فسؤال «لماذا هذه بالذات؟» يبقى بلا جواب رغم وجود سطر يدّعي أنه جوابه.
   والمحرك يعرف أيّ الفجوات تسدّها كلٌّ منها بالاسم (closesGaps رموزُ مهارات)،
   فتُسمّى. وتُذكر الصفة الثابتة «في صميم مجالك» فقط حين تنتفي — أي حين يخرج
   المقرر عن مجاله الأول — لأن ذلك وحده ما قد يفاجئ القارئ. */
function composedReason(c: ComposedCourseView): string {
  const bits: string[] = [];
  const names = skillNamesAr(c.closesGaps);
  if (names.length > 0) {
    const shown = names.slice(0, 3).join('، ');
    const rest = names.length - 3;
    bits.push(
      names.length === 1
        ? `يسدّ فجوتك في ${shown}`
        : `يسدّ فجواتك في ${shown}${rest > 0 ? ` و${rest === 1 ? 'واحدة' : `${rest}`} غيرها` : ''}`,
    );
  }
  if (!c.onAnchor) bits.push('من خارج مجالك الأول — أُدرج لفجوة قوية');
  return bits.length > 0 ? `${bits.join(' · ')}.` : 'يبني الأساس الذي تقوم عليه بقية خطتك.';
}

/* سبب وجود المقرر في خطة قالب مركّب.

   القالب يعطي كل مقرر وصفَ دوره فقط: «مقرر أساسي في هذه الخطة» — وهو نصّ واحد
   يتكرر تحت ستة مقررات، فيسأل القارئ «ولماذا هذا بالذات؟» ولا يجد جوابا.
   الجواب موجود على جهازه أصلا: مهارات المقرر تتقاطع مع فجواته المقاسة، والفارق
   بين مقرر وآخر هو أيّ فجوة يسدّ. فإن عُرف التقاطع سُمّي، وإلا بقي وصف الدور
   كما هو — لا نخترع سببا حيث لا دليل. */
function templateCourseReason(courseId: string, gapSlugs: Set<string>, fallbackAr: string): string {
  const skills = catalogCourseById.get(courseId)?.skill_slugs ?? [];
  const named = skillNamesAr(skills.filter((s) => gapSlugs.has(s)));
  if (named.length === 0) return fallbackAr;
  const shown = named.slice(0, 3).join("، ");
  const rest = named.length - 3;
  const head =
    named.length === 1
      ? `يسدّ فجوتك في ${shown}`
      : `يسدّ فجواتك في ${shown}${rest > 0 ? ` و${rest === 1 ? "واحدة" : rest} غيرها` : ""}`;
  /* وصف الدور يبقى فقط حين يضيف معنى — الشرطي والجسري يفسّران سبب الإدراج،
     أما «أساسي» فهو حال الأغلب فلا يفرّق. */
  const roleAdds = !fallbackAr.startsWith("مقرر أساسي");
  return roleAdds ? `${head} · ${fallbackAr}` : `${head}.`;
}

/* ─────────── الخطة المركّبة قابلة للاستبدال — لا للحذف ولا للإضافة ───────────

   كانت الخطة المركّبة تُعرض بلا أي أداة تخصيص، بينما المسار القياسي يُمرَّر إليه
   استبدال وحذف وإضافة وهدية. فالمتعلم صاحب أعقد حالة — الذي احتاج خطة من أكثر
   من مجال — كان الوحيد الذي لا يملك ضبط خطته.

   والتبديل وحده لا الحذف: عدد الدورات هو ما يحدد السعر، فتثبيته يفتح الاختيار
   ويُبقي السعر ثابتا. والمجموعة تُبنى من المسارات التي رُكّبت منها الخطة نفسها —
   فالبديل يبقى داخل مجالاتها لا خارجها — ويتقدّم فيها ما يسدّ فجوة معروفة. */
function ComposedSwap({
  planCourseIds,
  reasons,
  pathwayIds,
  gaps,
  delivery,
  authed,
  onChange,
}: {
  planCourseIds: string[];
  reasons: Record<string, string>;
  pathwayIds: string[];
  gaps: string[];
  delivery?: string;
  authed: boolean;
  /** يبلّغ الصفحة بالقائمة الحالية — الاعتماد يكتب ما على الشاشة لا ما يشتقّه من جديد */
  onChange: (ids: string[]) => void;
}) {
  const [chosenIds, setChosenIds] = useState<string[]>(planCourseIds);
  const [swapForId, setSwapForId] = useState<string | null>(null);

  const pool = useMemo<CourseSuggestion[]>(() => {
    const taken = new Set(chosenIds);
    const inPlan = new Set(pathwayIds);
    const closesGap = (skill: string | undefined) =>
      skill && gaps.some((g) => g.includes(skill.slice(0, 8))) ? 1 : 0;
    return courses
      .filter((c) => !taken.has(c.id) && inPlan.has(c.pathwayId))
      .sort((x, y) => closesGap(y.skill) - closesGap(x.skill))
      .slice(0, 6)
      .map((c) => ({ id: c.id, name: c.name, note: `${c.skill} · من مسار ${c.pathwayName}` }));
  }, [chosenIds, pathwayIds, gaps]);

  const swapPick = (oldId: string, newId: string) => {
    const next = chosenIds.map((i) => (i === oldId ? newId : i));
    setChosenIds(next);
    setSwapForId(null);
    /* كان يكتب هنا سجلّا بلا hostPathwayId، وصفحة المسار ترفضه فتعرض غيره.
       صار يبلّغ الصفحة، والاعتماد وحده يكتب — بهوية مضيفٍ صريحة. */
    onChange(next);
  };

  return (
    <CourseJourney
      courseIds={chosenIds}
      reasons={reasons}
      delivery={delivery}
      edit={
        authed
          ? {
              giftId: null,
              swapForId,
              pool,
              minReached: true,
              maxReached: true,
              swapOnly: true,
              onSwapToggle: setSwapForId,
              onSwapPick: swapPick,
              onRemove: () => {},
              onAdd: () => {},
              onGiftToggle: () => {},
            }
          : undefined
      }
    />
  );
}

/* ─────────── رحلة الدورات القابلة للتخصيص — دمج التخصيص داخل «ماذا ستحقق من خلال خطتك؟» ─────────── */
function PlanCourses({
  pathway,
  gaps,
  authed,
  resetKey,
  onChange,
}: {
  pathway: Pathway;
  gaps: string[];
  authed: boolean;
  resetKey: number; // يتغير عند تبديل المسار لإعادة التهيئة
  /** يبلّغ الصفحة بما على الشاشة — الاعتماد وحده يكتب، بمسلك واحد للحالتين */
  onChange: (ids: string[], giftId: string | null) => void;
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

  /* كان يكتب هنا سجلّ `wajeez_custom` مع كل تغيير. صار يبلّغ الصفحة فقط:
     الاعتماد هو الكتابة الوحيدة، فلا شكلان للسجلّ ولا قارئان يفترقان. */
  const persist = (ids: string[], gift: string | null) => {
    onChange(ids, gift);
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

/* سعر الخطة — أسفل الصفحة قبل التسجيل مباشرة، لا في أول بطاقة يراها المتعلم.

   كان الرقم داخل بطاقة التوصية الأولى، فأول ما يقرؤه من أنهى تشخيصه ثمنٌ قبل
   أن يعرف ما يشتري. والترتيب الذي يقنع هو ترتيب السؤال في رأس القارئ: ما
   المسار؟ ثم ماذا سأتعلم؟ ثم لماذا هذا بالذات؟ ثم — وقد عرف — بكم؟

   والرقم من **شعبةٍ حقيقية** لا من تقديرٍ في المتصفّح. كان يُحسب بـ
   `pathwayPriceFor(العدد)` و`coursePriceOf(العنوان)` — أي بعدد الدورات
   ومطابقةِ كلماتٍ في أسمائها — بينما الفاتورة تُصدر بسعر الشعبة وبعملتها.
   فالرقم الذي وعدنا به ليس الرقم الذي نُطالب به. وحين لا شعبة مسعَّرة: لا رقم.

   والصيغة «تبدأ من … للدورة» لا «الخطة كاملة = كذا»: عدد دورات الخطة يتغيّر
   بيد المتعلم في الشاشة التالية، فسعرُ الخطة يُحدَّد بعد أن يعتمدها هو. */
function ResultPriceCard({ courseIds }: { courseIds: readonly string[] }) {
  const { prices, loaded } = useCoursePrices();
  const cheapest = cheapestOf(courseIds, prices);
  const known = pricedCount(courseIds, prices);
  if (courseIds.length === 0) return null;

  return (
    <div className="story-fade mt-8 rounded-3xl border border-gold/35 bg-gradient-to-b from-gold/[0.07] to-transparent p-6 md:p-7">
      <p className="text-[11px] font-black tracking-wide text-gold-ink">وبكم؟</p>
      {cheapest ? (
        <>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm text-white/50">تبدأ من</span>
            <span dir="ltr" className="text-3xl font-black text-white md:text-4xl">{formatCohortPrice(cheapest)}</span>
            <span className="text-sm text-white/45">للدورة</span>
          </div>
          <p className="mt-1.5 text-xs text-teal-light-ink">
            وخصمٌ كبير على خطتك كاملة ({courseIds.length} دورات) مقابل شرائها دورةً دورة
          </p>
        </>
      ) : (
        <p className="mt-2 text-2xl font-black text-white md:text-3xl">
          {loaded ? "يُعلن السعر مع فتح الشعبة" : "يُقرأ السعر…"}
        </p>
      )}
      <div className="mt-5 rounded-2xl border border-teal/35 bg-teal/[0.07] p-4">
        <p className="text-sm font-black leading-relaxed text-teal-light-ink">
          سجّل الآن لتعرف المزيد — ولك خصم إضافي {FIRST_TIME_PROMO.percentOff}٪ {FIRST_TIME_PROMO.labelAr}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/60">
          <span>بالكود</span>
          <code className="rounded-lg border border-teal/50 bg-black/30 px-2.5 py-1 text-sm font-black tracking-widest text-white" dir="ltr">
            {FIRST_TIME_PROMO.code}
          </code>
          <span>يُكتب في نافذة الدفع.</span>
        </p>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-white/40">
        سعر خطتك يُحدَّد بعد أن تعتمدها — أنت من يقرّر دوراتها.
        {cheapest && known < courseIds.length && " وبعض دوراتها لم تُفتح لها شعبة بعد."} ولا يُطلب دفعٌ الآن.
      </p>
    </div>
  );
}

export interface ConfidenceParts {
  coverage: number;
  consistency: number;
  separation: number;
  evidenceQuality: number;
  stability: number;
  total?: number;
}

/* «لماذا هذا المسار» — الوعد الخامس في بطاقة التسجيل، وأول ما يُكشف بعدها.
   ثلاث طبقات بترتيب ما يسأل عنه القارئ: على أي شيء بُنيت التوصية، وما قوة
   أدلتها، وما الذي يغيّرها. كلها محسوبة في المحرك من قبل — هذه عرضها فقط. */
function WhyThisPathway({
  reasons,
  confidence,
  bandAr,
  changeMakers,
  gapNote,
}: {
  reasons: string[];
  confidence: ConfidenceParts | undefined;
  bandAr: string | null;
  changeMakers: string[];
  /** أثر معايرة الجوانب حين لا تستحق قائمة مستقلة — تفسير لا تكرار */
  gapNote?: string | null;
}) {
  const evidence = reasons.filter((r) => r.trim().length > 0).slice(0, 5);
  if (evidence.length === 0 && !confidence) return null;

  const parts = confidence
    ? [
        { label: "اكتمال صورتك", value: confidence.coverage },
        { label: "اتساق إجاباتك", value: confidence.consistency },
        { label: "وضوح الفارق بين المسارات", value: confidence.separation },
        { label: "جودة الأدلة", value: confidence.evidenceQuality },
        { label: "ثبات النتيجة", value: confidence.stability },
      ]
    : [];
  const total = Math.floor((confidence?.total ?? 0) * 100);

  return (
    <div className="card-soft mt-8">
      <h3 className="h-card flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-gold-ink" />
        لماذا هذا المسار بالذات؟
      </h3>

      {evidence.length > 0 && (
        <>
          <p className="mt-2 text-xs leading-relaxed text-white/50">
            لم نخمّن — هذه هي إجاباتك التي بُنيت عليها التوصية:
          </p>
          <ul className="mt-4 space-y-2.5">
            {evidence.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/75">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-light-ink" />
                {r}
              </li>
            ))}
          </ul>
        </>
      )}

      {confidence && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-sm font-black text-white/85">قوة أدلة هذه التوصية</span>
            <span className="text-sm font-black text-teal-light-ink">
              {total}٪{bandAr ? ` — ${bandAr}` : ""}
            </span>
          </div>
          <div className="mt-4 space-y-2 text-xs">
            {parts.map((p) => (
              <div key={p.label} className="flex items-center gap-2">
                <span className="w-36 shrink-0 text-white/55">{p.label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full rounded-full bg-teal"
                    style={{ width: `${Math.max(0, Math.min(100, Math.floor(p.value * 100)))}%` }}
                  />
                </span>
                <span className="w-9 shrink-0 text-left font-bold tabular-nums text-white/70">
                  {Math.floor(p.value * 100)}٪
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/45">
            ترتفع حين تتفق إجاباتك، وتنخفض عند التناقض أو حين تقف حالتك بين مسارين متقاربين.
            فوق ٧٥٪ نحن واثقون بالترشيح، وبين ٥٠ و٧٥٪ نعرض معه بدائل، ودون ذلك نحيلك لمستشار بشري قبل أي قرار.
          </p>
        </div>
      )}

      {gapNote && (
        <p className="mt-4 flex items-start gap-2.5 text-sm leading-relaxed text-white/70">
          <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-teal-light-ink" />
          {gapNote}
        </p>
      )}

      {changeMakers.length > 0 && (
        <p className="mt-4 text-xs leading-relaxed text-white/55">
          <span className="font-bold text-white/75">وما الذي يغيّر هذه التوصية؟ </span>
          {changeMakers[0]}
        </p>
      )}
    </div>
  );
}

function CompositePlan({ composite }: { composite: CompositeView }) {
  const totalHours = composite.courses.reduce((s, c) => s + c.hours, 0);
  const variant = VARIANT_AR[composite.variant] ?? VARIANT_AR.full;
  const represented = composite.represented_pathway_ids
    .map((id) => pathways.find((p) => p.id === id))
    .filter((p): p is Pathway => Boolean(p));
  return (
    <div className="mt-10 overflow-hidden rounded-3xl border border-[#FABC05]/40 bg-gradient-to-b from-surface to-paper">
      {/* «التوصية الأولى» تركت المتعلم يرى ثلاثة كيانات مسمّاة على شاشة واحدة —
          الخطة المركّبة، وأقوى مسار مفرد، ونسخة الخطة — بلا جملة تقول أيّها خطته.
          والتسمية الصريحة هنا تحسمها، وما دونها يُوسم مرجعا. */}
      <div className="border-b border-white/10 bg-[#FABC05]/10 px-6 py-3">
        <span className="text-sm font-black text-[#FABC05]">هذه خطتك · {composite.label_ar}</span>
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
            {/* كان مكتوبًا هنا «موزعة على إيقاعك الأسبوعي الذي أخبرتنا به» — وهو ادعاء
                لا يقع: الرقم مجموع ساعات الدورات الثابتة، لا يُقسَّم على أي إيقاع.
                والوقت الأسبوعي لم يعد يُسأل عنه أصلًا. */}
            <p className="mt-1 text-[11px] leading-5 text-white/45">مجموع ساعات دورات خطتك</p>
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
/* اشتقاقان نقيّان خارج المكوّن.

   كانا `useMemo` داخله، فلمّا احتاجهما `finish()` بالنتيجة الطازجة — قبل أن
   تستقرّ حالة React — لم يصلحا. واستخراجُهما إلى الوحدة يجعلهما نقيّين:
   يُنادَيان من الخطّاف ومن الحدث سواء، ولا يدخلان قائمة اعتماد. */
function composedPrimaryOf(res: DiagResult | null): ComposedPathView | null {
  if ((res?.resultJson.composite as CompositeView | null) ?? null) return null;
  const cp = (res?.resultJson.composed_path as ComposedPathView | null | undefined) ?? null;
  return cp && cp.courses.length > 0 && !cp.matchesPathwayId ? cp : null;
}

function planCourseIdsOf(res: DiagResult | null, hostId: string | undefined): string[] {
  const composite = (res?.resultJson.composite as CompositeView | null) ?? null;
  if (composite) return [...composite.courses].sort((a, b) => a.sequence - b.sequence).map((c) => c.courseId);
  const cp = composedPrimaryOf(res);
  if (cp) return cp.courses.map((c) => c.courseId);
  return (pathwayCourses[hostId ?? ""] ?? []).slice(0, MAX_PATHWAY_COURSES);
}

export default function Diagnostic() {
  const navigate = useNavigate();
  /* `?view=result` — قادمٌ من زرّ «عد لنتيجتك» في صفحة المسار. يُقرأ في مُهيّئ
     الحالة لا في تأثير: savedDone متاح في أوّل تصيير (يُقرأ في مُهيّئ useState
     أدناه)، فلا حاجة إلى قلب الحالة بعد التصيير ولا إلى ومضة مقدّمةٍ تُرى. */
  const [searchParams] = useSearchParams();
  const wantsSavedResult = searchParams.get("view") === "result";

  /* نتيجة مكتملة محفوظة — تُقرأ عبر مخطط صارم: تُرحّل إن أمكن، وتُحذف بأمان مع رسالة إن تعذر */
  const [storedInitial] = useState(() => loadLastResultSafe());
  const savedDone: DiagResult | null =
    storedInitial.status === "ok" || storedInitial.status === "migrated" ? storedInitial.result : null;
  const discardedResultNotice = storedInitial.status === "discarded" ? storedInitial.reason_ar : null;
  /* فتحُ النتيجة المحفوظة مباشرة حين طُلبت وكانت موجودة */
  const openSaved = wantsSavedResult && savedDone != null;
  const [stage, setStage] = useState<Stage>(openSaved ? "result" : "intro");
  const [answers, setAnswers] = useState<DiagAnswers>({});
  const [asked, setAsked] = useState<string[]>([]);
  const [live, setLive] = useState<ReturnType<AssessmentSession["liveState"]> | null>(null);
  const [history, setHistory] = useState<DiagQuestion[]>([]);
  const [question, setQuestion] = useState<DiagQuestion | null>(null);
  const [multiDraft, setMultiDraft] = useState<string[]>([]);
  const [textDraft, setTextDraft] = useState("");
  const [ratingsDraft, setRatingsDraft] = useState<Record<string, number>>({});
  const [result, setResult] = useState<DiagResult | null>(openSaved ? savedDone : null);
  const [topPathway, setTopPathway] = useState<Pathway | null>(openSaved ? savedDone.top : null);
  const [swapCount, setSwapCount] = useState(0);
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(() => loadProgress());
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
  /* سبب اختيار السؤال الحالي — كان يُعرض لأسئلة جولة التدقيق وحدها، بينما المحرك
     يسجّله لكل سؤال. والسؤال غير البديهي («كيف تشرح فكرة لمن هو خارج تخصصك؟»
     لمن هدفه أول وظيفة) هو أحوج ما يكون إلى سببه. */
  const [whyAr, setWhyAr] = useState<string | null>(null);
  /* تناقض قائم بين إجابتين — يُعرض حيث يمكن حسمه، أي بجوار «السؤال السابق». */
  const [contradictionAr, setContradictionAr] = useState<string | null>(null);
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
  /* كل سؤال يبدأ من أعلاه.

     الصفحة كانت تحتفظ بموضع التمرير بين سؤالين، والسؤال أطولُ على الهاتف منه
     على الحاسوب: قياس على شاشة 390×844 — بعد السؤال الخامس بقي التمرير عند 43
     بكسل، وبعد التاسع عند 157، والترويسة اللاصقة تغطي أول سطر من نص السؤال.
     فيرى المتعلم سؤالا مقطوع الرأس وعدّادَ تقدّمٍ خرج من الشاشة، ويظن نفسه
     أخطأ. والقفز إلى الأعلى عند تغيّر معرّف السؤال يعيد لكل سؤال بدايته.

     behavior من تفضيل النظام: من طلب تقليل الحركة يقفز بلا انزلاق. */
  const questionId = question?.id ?? null;
  useEffect(() => {
    if (stage !== "questions" || !questionId) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, [stage, questionId]);

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
  const ESTIMATE_MIN = 8; // أقصر رحلة مقيسة فعليا
  /* كان المقام `max(8, min(14, asked.length + 3))` — أي أنه من السؤال السادس فصاعدا
     يساوي «سؤالك الحالي + ٢». فخط النهاية مُثبَّت سؤالين أمام المتعلم مهما تقدّم،
     ويتمدّد بعد كل إجابة: من وُعد بـ«~٨» أجاب أربعة عشر في ثلاث من رحلات المراجعة.
     والشريط تحته يقسم على ESTIMATE_MAX بصدق، فالمؤشران كانا يتناقضان على شاشة واحدة.
     المدى المعلن ثابت الآن ويطابق ما يفرضه المحرك: 8–14. */
  const progress = Math.min(100, Math.round(((asked.length + (question ? 1 : 0)) / ESTIMATE_MAX) * 100));
  const liveNow = stage === "questions" ? live : null;
  const understoodDims = liveNow ? (Object.keys(DIM_LABELS) as Dim[]).filter((d) => liveNow.dims[d] >= 0.6) : [];
  /* لا نشتق «التطابق الأولي» ولا نعرضه — اسم المسار/القالب يُكشف في النتيجة فقط */

  /* هل تستحق «خطتك مرتَّبة على مقاسك» قائمةً ثانية، أم أنها إعادة سرد للأولى؟
     تُقارَن بما تعرضه الخطة المرئية فعلا: مقررات القالب المركّب إن فاز، وإلا
     مقررات المسار حتى السقف. فإن لم تضف مقررين لا تحويهما الأولى فهي تكرار —
     تُطوى إلى سطر تفسيري واحد داخل بطاقة «لماذا هذا المسار» بدل صفٍّ ثانٍ من
     البطاقات يقرؤه المتعلم فيجد فيه ما قرأه للتو. */
  const composedFold = useMemo(() => {
    const composite = (result?.resultJson.composite as CompositeView | null) ?? null;
    const shown = composite
      ? composite.courses.map((c) => c.courseId)
      : (pathwayCourses[topPathway?.id ?? ""] ?? []).slice(0, MAX_PATHWAY_COURSES);
    return foldComposedPlan(
      (result?.resultJson.composed_path as ComposedPathView | null | undefined) ?? null,
      shown,
    );
  }, [result, topPathway]);

  /* رموز الفجوات المقاسة — من أشرطة المهارات التي يرسلها المحرك مع النتيجة.
     تُستخدم لتسمية ما يسدّه كل مقرر في خطة القوالب، حيث لا يعطي القالبُ إلا
     وصفَ دورٍ واحدا يتكرر تحت مقرراته كلها. */
  const measuredGapSlugs = useMemo(() => {
    const bars = (result?.resultJson.skill_bars as { slug: string; isGap: boolean }[] | undefined) ?? [];
    return new Set(bars.filter((b) => b.isGap).map((b) => b.slug));
  }, [result]);

  /* خطة المقررات هي التوصية الأولى متى وُجدت وتجاوزت مسارا واحدا: لا قالب فاز،
     وقيّم المتعلم جوانبه، ولا تطابق مقرراتُها مسارا قائما. وحين تكون كذلك تحمل
     رأس الصفحة أيضا — لا رأسَ مسارٍ جاهز فوق قائمة مقررات مركّبة. */
  const composedPrimary = useMemo(() => composedPrimaryOf(result), [result]);

  /* مقررات الخطة المعروضة فعلا — بالترتيب الذي تختاره الصفحة نفسها: قالب مركّب
     فاز، ثم خطة مقررات، ثم مسار جاهز حتى السقف. عددها هو ما يحدد السعر، فلا
     يُشتقّ في بطاقة السعر اشتقاقا ثانيا قد يفترق عمّا يراه المتعلم فوقها.
     والتبديل داخل الخطة لا يغيّر العدد — فلا يغيّر السعر. */
  const planCourseIds = useMemo<string[]>(
    () => planCourseIdsOf(result, topPathway?.id),
    [result, topPathway],
  );

  /* المرحلة الحالية — تُسمّى في شريط التقدم. سقط `passedStages` مع صف الدوائر:
     لم يعد شيء يعرض «أيّ مرحلة اكتملت» بعد توحيد المؤشر. */
  const currentStageIdx = stageIndexOf(question);

  // يبدأ مجانا بلا حساب — الحساب يُطلب عند النتيجة لفتح تفاصيلها الكاملة
  const begin = () => {
    void start();
  };

  /** يدفع خطوة المحرك إلى حالة الواجهة */
  /* كان النوع مكتوبا هنا حرفيا بدل NextStep، فكل حقل يضيفه المصدر لا يصل — وقد
     مرّ `step.whyAr` صامتا لأن الجذر tsconfig بلا ملفات و`tsc --noEmit` لا يفحص
     شيئا. النوع المسمّى يمنع تكرارها. */
  const applyStep = (step: Pick<NextStep, "question" | "deepening" | "whyAr" | "contradictionAr">) => {
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
    setWhyAr(step.whyAr ?? null);
    setContradictionAr(step.contradictionAr ?? null);
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

  /* ─────────── الاعتماد: كتابةٌ واحدة، وهي مصدر ما تعرضه صفحة المسار ───────────

     كان هنا مسلكان يكتبان شكلين مختلفين، وثالثٌ لا يكتب شيئا:
     · التبديل يكتب `{composite:true, chosenIds}` بلا hostPathwayId
     · اعتماد القالب يعيد اشتقاق القائمة من نتيجة المحرّك فيمحو التبديل
     · اعتماد المسار الجاهز كان مجرّد <Link> لا يكتب شيئا، فتسقط الصفحة على
       قائمة الكتالوج

     صار مسلكا واحدا يكتب ما **على الشاشة** بهوية مضيفٍ صريحة واسمٍ صريح. */

  /* آخر قائمة عرضها التبديل — في ref لا في state: قراءتها عند الاعتماد فقط،
     فلا داعي لإعادة تصيير عند كل تبديل. */
  const shownPlanRef = useRef<{ courseIds: string[]; giftId: string | null } | null>(null);

  /* الاعتماد مشتقٌّ من النتيجة لا من حالة React.

     كان يقرأ `topPathway` و`planCourseIds` من الحالة، فلا يصلح نداؤه من
     `finish()`: الحالة هناك لم تستقرّ بعد. وصار يُنادى من موضعين — من
     `finish` بالنتيجة الطازجة، ومن الزرّ بما على الشاشة. */
  const adoptFromResult = (res: DiagResult, shown?: { courseIds: string[]; giftId: string | null } | null) => {
    const top = res.top;
    if (!top) return;
    const c = (res.resultJson.composite as CompositeView | null) ?? null;
    const composed = Boolean(c) || Boolean(composedPrimaryOf(res));
    const hostId = c
      ? (c.represented_pathway_ids.includes(top.id) ? top.id : (c.represented_pathway_ids[0] ?? top.id))
      : top.id;
    /* ما رآه المتعلّم فعلا — بتبديلاته إن بدّل */
    const courseIds = shown?.courseIds ?? planCourseIdsOf(res, hostId);
    const giftId = shown?.giftId ?? null;
    const topPathway = top;
    const adoptedPlan = {
      hostPathwayId: hostId,
      composed,
      /* الخطّة المركَّبة لا تستعير اسم المسار المضيف: هي ليست هو، وتسميتُها
         باسمه هي ما جعل المتعلّم يظنّ أننا غيّرنا خطّته. */
      nameAr: composed ? PERSONAL_PLAN_NAME_AR : topPathway.name,
      courseIds,
      giftId,
    };
    saveAdoptedPlan(adoptedPlan);
    /* وإلى الخادم أيضا لمن له حساب — فلا تموت الخطّة بإغلاق التبويب.
       لا ننتظرها: التنقّل لا يُؤجَّل لنداء شبكة، والفشل لا يُلغي الاعتماد. */
    void syncAdoptedPlan(adoptedPlan);
    try {
      if (c) sessionStorage.setItem("wajeez_diag_composite", JSON.stringify({ template_id: c.template_id, name_ar: c.name_ar }));
      sessionStorage.setItem("wajeez_diag_top", hostId);
      localStorage.setItem("wajeez_diag_top", hostId);
    } catch {
      /* مساحة ممتلئة أو خصوصية صارمة — الصفحة تقول إنها لم تجد الخطّة */
    }
    track(c ? "composite_adopted" : "pathway_adopted", {
      ...(c ? { template: c.template_id } : {}),
      host: hostId,
      courses: courseIds.length,
    });
    /* إحالة المستشار تسافر مع الخطّة.

       كانت تعيش في شاشة النتيجة وحدها. ولمّا صار التشخيص ينتقل مباشرةً إلى
       صفحة المسار سقطت الشاشة — وكادت الإحالة تسقط معها، فيدفع مَن كان
       ينبغي أن يُستشار. فالعَلَم يُكتب هنا وتقرؤه صفحة المسار. */
    try {
      if (res.needsAdvisor) sessionStorage.setItem(NEEDS_ADVISOR_KEY, "1");
      else sessionStorage.removeItem(NEEDS_ADVISOR_KEY);
    } catch { /* بلا تخزين — الصفحة لا تعرض الإحالة، ولا يتعطّل شيء */ }
    navigate(`/pathways/${hostId}`);
  };

  const adoptPlan = () => {
    if (!result) return;
    adoptFromResult(result, shownPlanRef.current);
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

    /* نهاية التشخيص هي صفحة المسار — لا صفحةً قبلها.

       بقرار صاحب المنتج: «هذه الصفحة التي يجب أن تظهر بعد انتهاء التشخيص،
       ولا داعي للصفحات التي قبلها». وكنتُ بنيتُ صفحة المسار وربطتُ الانتقال
       إليها بزرٍّ يضغطه المتعلّم — فبقي الطريق القديم مفتوحا، وشاشة النتيجة
       تعترضه قبل وجهته. نصفُ الطلب نُفِّذ وأُعلن تامّا.

       والتخصيص لم يضع: هو في صفحة المسار نفسها — يحذف ويستبدل ويضيف. ولذلك
       حُذفت شارة «اعتمده تشخيصك» بطلبه: لا رجعةَ إلى صفحةٍ لا نريدها.

       وحالتان تبقيان هنا لأنّه لا مسار فيهما أصلا: التوقّف الحوكميّ (رفضُ
       الموافقة أو قاصر)، والاتّجاه الاستكشافيّ حين لا يكفي الدليل. كلتاهما
       بلا `res.top`، أو بنوعٍ يقول ذلك صراحةً. */
    if (res.resultJson.kind !== "guardrail_stop" && res.top) {
      adoptFromResult(res);
      return;
    }
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

  /* تأكيد بصري قبل الانتقال — الاختيار المفرد ينتقل فورا بلا زر تأكيد، وكان
     الانتقال آنيا فلا يرى المتعلم اختياره يُسجَّل: يضغط فيتبدّل السؤال، فلا
     يدري أضغط ما أراد أم أخطأ. ربعُ ثانية يُظهر الخيار محدَّدا ثم ينتقل — لا
     زر تأكيد إضافي ولا انتظار محسوس.
     ولمن طلب تقليل الحركة: انتقالٌ فوري كما كان. */
  const [pendingOpt, setPendingOpt] = useState<string | null>(null);
  const pendingTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
    },
    [],
  );

  const answer = (qid: string, value: string | string[], optionIds?: string[]) => {
    const session = sessionRef.current;
    if (!question || !session) return;
    track("diagnostic_question_completed", { count: asked.length + 1 });
    setHistory([...history, question]);
    const step = session.submit(qid, value, optionIds);
    applyStep(step);
  };

  /** اختيار مفرد: يومض محدَّدا ثم ينتقل. النقرة الثانية أثناء الوميض تُهمل —
      وإلا سجّل المتعلم إجابتين لسؤالين بضغطة واحدة سريعة. */
  const chooseSingle = (opt: { value: string; optionId?: string }) => {
    if (!question || pendingTimer.current !== null) return;
    const qid = question.id;
    setPendingOpt(opt.value);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    pendingTimer.current = window.setTimeout(
      () => {
        pendingTimer.current = null;
        setPendingOpt(null);
        answer(qid, opt.value, opt.optionId ? [opt.optionId] : undefined);
      },
      reduce ? 0 : 220,
    );
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
    /* الرجوع أثناء وميض التأكيد يلغيه: وإلا سجّل المؤقّت إجابة السؤال الذي
       غادره المتعلم للتوّ على السؤال الذي عاد إليه. */
    if (pendingTimer.current !== null) {
      window.clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
      setPendingOpt(null);
    }
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
    setResult({
      ...result,
      top: p,
      faster: slot === "faster" ? old : result.faster,
      cheaper: slot === "cheaper" ? { p: old, courseCount: (pathwayCourses[old.id] ?? []).length || 6 } : result.cheaper,
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
          {/* كان «ثلاث دقائق» بينما الشارة تحته تقول «١–٣ دقائق»، والرحلة الفعلية
              8–14 سؤالا. «بضع» تصدق على المدى كله.
              والشارة صارت «٣–٦ دقائق»: أقصر رحلة مقيسة 8 أسئلة + خطوة معايرة بتسع
              عائلات، ولا يبلغها قارئ عربي في دقيقة. الحد الأدنى المعلن يجب أن يبلغه أحد. */}
          <h1 className="mt-5 text-3xl font-black leading-snug md:text-5xl">
            بضع دقائق من الوضوح
            <span className="text-teal-light-ink"> تختصر عليك شهورا من التشتت</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-loose text-white/60">
            حديث قصير عن يومك وهدفك — كل إجابة تشكّل سؤالك التالي، وتنتهي بمسارك الواضح.
          </p>

          <div className="mx-auto mt-7 flex max-w-full flex-wrap items-center justify-center gap-1.5 sm:gap-2 sm:flex-nowrap sm:whitespace-nowrap">
            {[
              { icon: Compass, text: "توصية مفسَّرة، ليست حظًا" },
              { icon: Clock3, text: "٣–٦ دقائق" },
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
          {/* هذه شاشة إقناعٍ بالبدء، وثلاثة أسطر من الشروط قبل الخطوة الأولى
              تُقرأ عقبةً لا طمأنة. بقيت الدعوة، وزال سطرا الإقرار والسنّ.

              والإفصاح لم يُلغَ بل صغُر: «سياسة الخصوصية» رابطٌ واحد يقول أين
              التفصيل. وإسقاطُه كلّه كان يترك المنصّة بلا إفصاحٍ ظاهر البتّة —
              والمحرّك يسجّل «إقرار الواجهة» على أي حال (engine.ts). */}
          <ul className="mx-auto mt-4 max-w-md space-y-1.5 text-xs leading-relaxed text-white/55">
            <li>ابدأ مجانا — ترى مسارك المقترح فورا، وحسابك المجاني يفتح نتيجتك كاملة</li>
            <li>
              <Link to="/p/privacy" className="underline-offset-4 hover:text-teal-light-ink hover:underline">
                سياسة الخصوصية
              </Link>
            </li>
          </ul>

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
        /* حشو رأسي أقل على الهاتف: 96 بكسل من 844 كانت فراغا فوق السؤال وتحته */
        <section className="story-fade mx-auto max-w-2xl px-5 py-7 sm:py-12 md:py-16">
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
          {/* مؤشر واحد: أين أنا، وكم بقي. كان هنا صف من خمس دوائر بتسمياتها فوق
              عدّاد وشريط — ثلاثة مؤشرات تقول الشيء نفسه وتستهلك نصف شاشة الجوال
              قبل أن يصل المتعلم إلى السؤال. اسم المرحلة يكفي عن الدوائر، والشريط
              يكفي عن الترقيم البصري. */}
          <div className="mb-7">
            <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
              {/* كان يُعرض اسما مجردا بجوار عدّاد، فيُقرأ «المرحلة كذا من خمس» —
                  ولا يمكن أن يكون كذلك: المحرك يختار السؤال بأعلى قيمة تمييزية لا
                  بترتيب المراحل، فيسأل «وقتك» (المرحلة الخامسة) عند السؤال السادس
                  ثم يعود إلى «قصتك». قياس على خط أساس الرحلات المُلتزم: التراجع
                  يقع في ٩ رحلات من ٩، بثلاث عشرة خطوة تراجع.
                  فالتسلسل سليم، والتسمية هي التي كانت تَعِد بترتيب لا وجود له —
                  و«عن:» تجعلها موضوعا لا موضعا. */}
              <span className="font-black text-gold-ink">
                عن: {JOURNEY_STAGES[currentStageIdx]?.label}
              </span>
              <span className="shrink-0 font-semibold text-white/45">
                سؤال {asked.length + 1} من {ESTIMATE_MIN}–{ESTIMATE_MAX}
              </span>
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

          <div key={question.id} className="story-fade">
            {(question.level === "deep" || question.level === "conditional") && (
              <p className="mb-4 w-fit rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold-ink">
                سؤال تعميق — بناءً على إجاباتك تحديدا
              </p>
            )}
            {/* درجةٌ أصغر على الهاتف: نص السؤال كان يأخذ ثلاثة أسطر من الشاشة فلا يبقى
                إلا لأربعة خيارات ونصف — وقياسُ الاختيار أن ترى بدائلك مجتمعة. */}
            <h2 className="text-xl font-black leading-snug sm:text-2xl md:text-3xl">{qText}</h2>
            {(deepStep?.reasonAr ?? whyAr) && (
              <p className="mt-3 w-fit rounded-xl border border-teal/30 bg-teal/[0.06] px-3.5 py-2 text-[11px] leading-relaxed text-white/55">
                <span className="font-bold text-teal-light-ink">لماذا هذا السؤال؟ </span>
                {deepStep?.reasonAr ?? whyAr}
              </p>
            )}
            {/* المحرك يكشف التناقض بين إجابتين ويخفض به «اتساق إجاباتك» في قوة
                الأدلة، وكان لا يُعرض منه شيء — فيمضي التشخيص يسأل من قال إنه لا
                يعمل عن قطاعه الوظيفي. ونصّ القاعدة مكتوب للمتعلم أصلا وينتهي
                بسؤال، فيُعرض حيث يمكن حسمه: فوق الخيارات وبجوار «السؤال السابق».
                ملاحظة لا حاجز: من رأى أن الوصفين يجتمعان في حاله فليمضِ. */}
            {contradictionAr && (
              <p className="mt-3 flex w-fit items-start gap-2 rounded-xl border border-gold/30 bg-gold/[0.07] px-3.5 py-2 text-[11px] leading-relaxed text-white/65">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-ink" />
                <span>
                  {contradictionAr}
                  <span className="text-white/45"> — تستطيع الرجوع وتعديلها، أو المضي إن كانتا تصفانك معا.</span>
                </span>
              </p>
            )}
            {qHint && <p className="mt-3 text-sm leading-relaxed text-white/50">{qHint}</p>}

            {/* transition-colors لا transition-all: الأخيرة تُحرّك outline-width أيضا،
                فحلقة التركيز في index.css كانت تتصاعد من صفر إلى بكسلين على نحو
                ٤٠٠ms بدل أن تظهر فورا. قياسٌ بلوحة المفاتيح: 0px عند الضغط، 1px
                بعد 120ms، 2px بعد 400ms. الحلقة تعمل — لكن من يتنقّل بسرعة بين
                الخيارات يسبقها. والألوان وحدها هي ما يُقصد تحريكه هنا. */}
            {question.type === "single" && (
              <div className="mt-6 grid gap-2.5 sm:mt-8 sm:gap-3">
                {qOptions.map((opt) => {
                  const confirming = pendingOpt === opt.value;
                  const selected = confirming || answers[question.id] === opt.value;
                  /* الباقي يخفت أثناء التأكيد: العين تتبع ما بقي واضحا، فيرى
                     المتعلم أيّ خيار سُجّل قبل أن تتبدّل الشاشة. */
                  const dimmed = pendingOpt !== null && !confirming;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => chooseSingle(opt)}
                      aria-pressed={selected}
                      className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-right transition-all duration-200 sm:p-5 ${
                        selected
                          ? "border-teal-light bg-teal/15"
                          : "border-white/10 bg-white/[0.03] hover:border-teal-light/60 hover:bg-white/[0.06]"
                      } ${dimmed ? "opacity-40" : ""}`}
                    >
                      <span className="text-[15px] font-bold leading-relaxed sm:text-base">{opt.label}</span>
                      {confirming && <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-light-ink" />}
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
                {/* أول سؤال يكسر عقد «نقرة واحدة تكفي» بعد سبعة أسئلة تنتقل وحدها،
                    فيُعلَن تغيّر النمط قبل الخيارات لا بعدها. */}
                <p className="mb-3 text-xs font-bold text-gold-ink">
                  اختر ما ينطبق عليك — يمكن أكثر من واحد — ثم «متابعة».
                </p>
                {/* كان عمودا واحدا على الجوال: تسعة خيارات تنتهي عند 884 بكسل على شاشة
                    ارتفاعها 844، فيقع زر «متابعة» عند 908 خارج الشاشة تماما — والمتعلم
                    لا يرى سبيله الوحيد إلى الأمام. عمودان يُدخلانه داخل الطية. */}
                <div className="grid grid-cols-2 gap-3">
                  {qOptions.map((opt) => {
                    const selected = multiDraft.includes(opt.value);
                    const disabled =
                      !selected && opt.value !== "none" && question.maxSelect !== undefined && multiDraft.length >= question.maxSelect;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleMulti(question, opt.value)}
                        disabled={disabled}
                        className={`rounded-2xl border p-4 text-right transition-colors ${
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

            {/* طمأنة وإسناد — تحت الخيارات لا فوق السؤال. كانتا تفصلان السؤال عن
                خياراته: «يفهم الآن» صفَّ شارات فوق السؤال، و«المصدر العلمي» سطرا
                بينه وبين الخيارات في كل سؤال من التسعة والتسعين بعد المئة. تبقيان
                مقروءتين لمن يريدهما، وتخرجان من طريق من يريد أن يجيب. */}
            {(understoodDims.length > 0 || question.source) && (
              <div className="mt-10 space-y-2.5 border-t border-white/[0.07] pt-5">
                {understoodDims.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-white/40">
                      <BrainCircuit className="h-3.5 w-3.5 text-teal-ink" />
                      يفهم الآن:
                    </span>
                    {understoodDims.map((d) => (
                      <span
                        key={d}
                        className="rounded-full border border-teal/25 bg-teal/[0.08] px-2.5 py-0.5 text-[11px] font-semibold text-teal-light-ink"
                      >
                        {DIM_LABELS[d]}
                      </span>
                    ))}
                  </div>
                )}
                {question.source && (
                  <p className="text-[11px] leading-relaxed text-white/35">
                    <span className="font-bold text-white/45">المصدر العلمي: </span>
                    {question.source}
                  </p>
                )}
              </div>
            )}
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
              /* العنوان يصف حالة بياناتنا لا حالة المتعلم.
                 كان «اتجاهك ما زال يتشكّل»: جملةٌ تضع النقص فيه — وكأنه يحتاج
                 أن ينضج قبل أن نستطيع خدمته. والحقيقة أن إجاباته حتى الآن لا
                 تكفينا نحن، وهذا وصفٌ لنا لا حكمٌ عليه. والفرق ليس تلطّفا:
                 الأول يوحي بالانتظار، والثاني يوحي بخطوة تالية — وهي موجودة.
                 والأيقونة تبعت المعنى: العدسة فوق خريطة ناقصة تقول «ينقصنا
                 قياس» لا البوصلة التي تقول «أنت تائه». */
              <section className="story-fade mx-auto max-w-xl px-5 py-20 text-center md:py-24">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal/15">
                  {isExploratory
                    ? <SearchIcon className="h-7 w-7 text-teal-light-ink" />
                    : <Compass className="h-7 w-7 text-teal-light-ink" />}
                </span>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <Badge className="border border-teal/40 bg-teal/10 text-teal-light-ink">اكتمل التشخيص</Badge>
                  <Badge className="bg-teal font-black text-on-teal">
                    {isExploratory ? "نحتاج قياسا أعمق" : "مراجعة مستشار"}
                  </Badge>
                </div>
                <h2 className="mt-5 text-2xl font-black leading-snug md:text-3xl">
                  {isExploratory ? "إجاباتك الحالية لا تكفي بعد لبناء خطة نثق بها" : "حالتك تستحق مستشارًا بشريًا قبل الترشيح"}
                </h2>
                {isExploratory && (
                  <p className="mx-auto mt-4 max-w-md text-sm leading-loose text-white/70">
                    لا نريد أن نرشّح لك مسارا عاما لا يعكس فجواتك الفعلية. أجب عن استبيان أعمق مبني على
                    مواقف عملية، وسنحدّد المهارات التي تحتاجها ثم نبني لك خطة دورات مناسبة.
                  </p>
                )}
                <div className="mx-auto mt-4 max-w-md space-y-2 text-sm leading-loose text-white/55">
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

                {/* الخطوة التالية أولا، وإعادةُ التشخيص ثانية، والمستشار سطرا.
                    كان الترتيب معكوسا: زرٌّ ذهبي واحد يقول «ابدأ من جديد» —
                    أي أعِد ما لم ينجح — ثم مستشار. والاستبيان التفصيلي موجود
                    أصلا (جولة التدقيق) ولم يكن يُعرض هنا، وهو المكان الذي
                    يحتاجه فيه المتعلم أكثر من أي مكان. */}
                {/* الشرط canDeepen ليس زينة: النتيجة المستعادة من الجهاز تُعرض
                    بلا جلسة حيّة (showSavedResult يصفّره)، فزرٌّ يستدعي
                    startDeepeningRound عليها لا يفعل شيئا — ضغطةٌ في فراغ أسوأ
                    من زرٍّ غائب. ولمن استعاد نتيجته تبقى إعادةُ التشخيص. */}
                {isExploratory && canDeepen && !deepUnavailable && (
                  <div className="mt-9">
                    <Button
                      size="lg"
                      className="h-12 rounded-full bg-gold px-8 font-black text-on-gold hover:bg-gold/90"
                      onClick={startDeepeningRound}
                    >
                      <ListChecks className="ml-2 h-4 w-4" />
                      ابدأ الاستبيان التفصيلي
                    </Button>
                    <p className="mt-2.5 text-[11px] text-white/40">مواقف عملية تقيس مهاراتك مباشرة — لا إعادة لما أجبت عنه.</p>
                  </div>
                )}
                {isExploratory && canDeepen && deepUnavailable && (
                  <p className="mx-auto mt-9 max-w-md rounded-2xl border border-gold/35 bg-gold/[0.07] px-5 py-3 text-xs leading-relaxed text-gold-ink">
                    لا تكفي أسئلتنا المتبقية لاستبيان تفصيلي مفيد على إجاباتك الحالية — فإعادة التشخيص
                    بإجابات أدقّ أنفع لك من أسئلة لا تضيف.
                  </p>
                )}
                <div className={`flex flex-wrap items-center justify-center gap-3 ${isExploratory && canDeepen ? "mt-5" : "mt-9"}`}>
                  <Button
                    size="lg"
                    variant={isExploratory && canDeepen ? "outline" : "default"}
                    className={isExploratory && canDeepen
                      ? "h-12 rounded-full border-white/20 px-8 font-bold text-white/75"
                      : "h-12 rounded-full bg-gold px-8 font-black text-on-gold hover:bg-gold/90"}
                    onClick={restart}
                  >
                    <RefreshCcw className="ml-2 h-4 w-4" />
                    {isExploratory ? "أعد التشخيص السريع" : "ابدأ التشخيص من جديد"}
                  </Button>
                  {isExploratory && (
                    <Button size="lg" variant="ghost" className="h-12 rounded-full px-6 font-bold text-white/55" asChild>
                      <Link to="/pathways">استعرض المسارات بنفسك</Link>
                    </Button>
                  )}
                </div>
                {/* المستشار سطرٌ لمن يحتاجه لا زرٌّ بحجم الخطوة التالية */}
                <p className="mt-5 text-xs text-white/40">
                  أو{" "}
                  <AdvisorContact
                    label="تحدّث مع مستشار مهني"
                    icon={<></>}
                    className="font-bold text-white/60 underline underline-offset-4 transition hover:text-[#6EC7D1]"
                    text={
                      isExploratory
                        ? "مرحبا، أكملت مؤشر وجيز ولم تكفِ إجاباتي لبناء خطة — أريد مستشارا يساعدني."
                        : "مرحبا، أكملت مؤشر وجيز وأحالني التشخيص لمستشار — أريد مراجعة حالتي."
                    }
                  />
                </p>
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

          {/* رأس التوصية حين تكون خطة المقررات هي الأولى — بدل رأس مسار جاهز
              فوق قائمة مقررات رُكّبت من أكثر من مسار.
              بلا سرد الدورات: كانت تسردها كلها هنا ثم تسردها «ماذا ستحقق من خلال
              خطتك؟» بعدها بتفصيل أوفى — ست بطاقات تُقرأ مرتين على شاشة واحدة. */}
          {composedPrimary && <ComposedPlanCard plan={composedPrimary} courseList={false} />}

          {/* بطاقة التوصية الأولى للمسار القياسي — لا قالب فاز ولا خطة مقررات */}
          {((result.resultJson.composite as CompositeView | null) ?? null) === null && !composedPrimary && (
          <div className="mt-10 overflow-hidden rounded-3xl border border-[#38A7B4]/40 bg-gradient-to-b from-panel to-paper">
            <div className="border-b border-white/10 bg-[#38A7B4]/10 px-6 py-3 text-sm font-bold text-[#6EC7D1]">
              التوصية الأولى
            </div>
            <div className="p-6 md:p-8">
              {/* sector تصنيف تسويقي داخلي (B2C/B2B/B2G) يُشتق من رمز المسار. وكان
                  يظهر مرتين هنا: مرة في الشارة الذهبية البارزة — لأن badge معلَن
                  في النوع ولا يُسنَد أبدا فتسقط دائما إلى sector — ومرة في شارة
                  ثانية بجوارها. فأبرز ما يراه المتعلم في بطاقة توصيته كان رمزا
                  لا يعنيه. pathwayCategory تقول له أين يقع مساره بلغته. */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-gold font-black text-on-gold">{topPathway.badge ?? pathwayCategory(topPathway.id)}</Badge>
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
                {/* السعر لم يعد هنا. أول ما يقرؤه المتعلم يجب أن يكون مسارَه لا
                    ثمنَه: البطاقة الأولى تعرّفه على المسار وحده، ثم يرى ما سيتعلمه،
                    ثم لماذا رُشّح له، ثم — وقد عرف ما يشتري — يأتي السعر أسفل
                    الصفحة قبل التسجيل مباشرة (ResultPriceCard). */}
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
                    <span className="font-bold text-white/80">للاطّلاع فقط — وليس خطتك: «{topPathway.name}»</span>
                    {" "}— أقوى مسار مفرد ضمن خطتك، استُمدت منه دورات أساسية في تركيبتك.
                    راجعه إن أردت التركيز على مجال واحد بدل الخطة أعلاه.
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

          {/* كانت الصفحة تعرض خطتين متتاليتين تسمّي كلٌّ منهما نفسها «خطتك»:
              «ماذا ستحقق من خلال خطتك؟» ثم «خطتك مرتَّبة على مقاسك». وقياسٌ على خمس
              حالات: المتعلم يرى ١٠–١١ بطاقة دورة، أربع أو خمس منها الدورات نفسها
              مكرّرة — وفي ثلاث حالات من الخمس كانت القائمة الثانية إعادة سرد للأولى
              كاملة بإطار مختلف. فالثانية لا تُعرض إلا حين تضيف مقررين فأكثر لا
              تحويهما الأولى؛ وحين لا تضيف، تُطوى قيمتها التفسيرية (تغطية الفجوات)
              إلى بطاقة «لماذا هذا المسار» حيث موضعها الطبيعي، ولا تتكرر الدورات. */}
          {/* «ماذا ستحقق من خلال خطتك؟» — ترتيب الأولوية بين ثلاثة مخرجات.

              كانت القوالب المركّبة هي التركيب الوحيد، وهي ستة عشر قالبا تغطي
              واحدا وثلاثين زوجا من المجالات فقط — فمن لا يقابل زوجُه واحدا منها
              يأخذ مسارا جاهزا مهما تعددت حاجته. قياس: صفر خطط مركّبة في تسع رحلات.

              وتركيب المقررات (composePath) لا سقف له: يرتّب المئة مقرر كلها
              بفجوات المتعلم المقيسة ويبني منها خطة لأي تركيبة مجالات. فصار هو
              المخرج المركّب الأساسي، والقوالب تبقى لمن يطابقها بدقة.

              والترتيب: قالب فاز ببوابته ← خطة مقررات تتجاوز مسارا واحدا ← مسار جاهز.
              وشرط «تتجاوز مسارا واحدا» ليس زينة: composePath يعلن matchesPathwayId
              حين تُطابق مقرراتُه مسارا قائما، وحينها عرضُه «تركيبا» ادعاء — يُعرض
              المسار نفسه بشهادته وسعره. */}
          {(() => {
            const compositeView = (result.resultJson.composite as CompositeView | null) ?? null;
            if (compositeView) {
              const ordered = [...compositeView.courses].sort((a, b) => a.sequence - b.sequence);
              return (
                <ComposedSwap
                  planCourseIds={ordered.map((c) => c.courseId)}
                  reasons={Object.fromEntries(
                    ordered.map((c) => [c.courseId, templateCourseReason(c.courseId, measuredGapSlugs, c.reason_ar)]),
                  )}
                  pathwayIds={compositeView.represented_pathway_ids}
                  gaps={result.gaps}
                  delivery={pathwayDelivery(topPathway.id)}
                  authed={authed}
                  onChange={(ids) => { shownPlanRef.current = { courseIds: ids, giftId: null }; }}
                />
              );
            }

            const cp = composedPrimary;
            if (cp) {
              return (
                <ComposedSwap
                  planCourseIds={cp.courses.map((c) => c.courseId)}
                  reasons={Object.fromEntries(cp.courses.map((c) => [c.courseId, composedReason(c)]))}
                  pathwayIds={[...new Set(cp.courses.map((c) => c.pathwayId))]}
                  gaps={result.gaps}
                  delivery={pathwayDelivery(topPathway.id)}
                  authed={authed}
                  onChange={(ids) => { shownPlanRef.current = { courseIds: ids, giftId: null }; }}
                />
              );
            }

            return (
              <PlanCourses
                pathway={topPathway}
                gaps={result.gaps}
                authed={authed}
                resetKey={swapCount}
                onChange={(ids, gift) => { shownPlanRef.current = { courseIds: ids, giftId: gift }; }}
              />
            );
          })()}

          {/* الخطة المركّبة — لمن قيّم جوانبه، وحين تضيف مقررات لا تحويها الخطة أعلاه.
              أما إذا كانت تعيد سرد الدورات نفسها فقد طُويت إلى سطر في بطاقة الأسباب. */}
          {composedFold.showCard && !composedPrimary && (() => {
            const cp = result.resultJson.composed_path as ComposedPathView | null | undefined;
            return cp && cp.courses?.length ? <ComposedPlanCard plan={cp} /> : null;
          })()}

          {/* «لماذا هذا المسار» بعد الدورات لا قبلها. السبب يُقنع من عرف ما
              يُعرض عليه؛ ومن لم يرَ خطته بعدُ يقرأ التبرير قبل الشيء المبرَّر.
              وبطاقة التسجيل تَعِد بستة بنود خامسها «لماذا هذا المسار» — والمحرك
              يحسب أسبابه (reasons_ar) وثبات نتيجته (change_makers_ar) وقوة أدلته
              الخمسة، فتُعرض هنا وفاءً بالوعد كما قُطع. */}
          <WhyThisPathway
            reasons={result.reasons}
            confidence={result.resultJson.confidence as ConfidenceParts | undefined}
            bandAr={result.confidenceBand}
            changeMakers={(result.resultJson.change_makers_ar as string[] | undefined) ?? []}
            gapNote={composedFold.gapNote}
          />

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

          {/* السعر آخر ما يُقرأ قبل التسجيل — بعد أن عرف المسار ودوراته وسببه */}
          <ResultPriceCard courseIds={planCourseIds} />

          {/* ─── حدّ الظهور ───
              كان ينتهي المقروء عند بطاقة «ماذا ستحصل عليه فعليا؟» — أي عند تسع
              بطاقات منافع تسويقية — ويقع خلفه الدليلُ كلُّه: الدورات ومخرجاتها،
              وأسباب الترشيح، وتحذير «لن تدفع ثمن ما تعرفه أصلا». فالزائر الشكّاك،
              وهو من يجب إقناعه، كان يرى الوعود ويُطلب منه حساب.

              فانتقل الحدّ إلى ما بعد الخطة وتحذير التقاطع: القيمة تُثبَت أولًا ثم
              يُطلب البريد. وبقي خلفه ما يحتاج حسابا فعلا — والاعتماد أوّلها، لأنه
              فعلٌ يقود إلى صفحة الدفع لا معلومةٌ تُقرأ. ─── */}
          <ResultGate revealed={authed} onDone={revealResult}>

          {/* الاعتماد أسفل الخطة مباشرة — يظهر للضيف مضبّبا في مكانه، ويعمل فور انكشافه بالتسجيل */}
          {(() => {
            const compositeView = (result.resultJson.composite as CompositeView | null) ?? null;
            const isComposed = Boolean(compositeView) || Boolean(composedPrimary);
            return (
            <div className="mt-6 flex flex-col items-center gap-3">
              {/* زرٌّ واحد للحالتين. كان اعتماد المسار الجاهز <Link> لا يكتب شيئا،
                  فتصل الصفحة بلا خطّة معتمَدة فتسقط على قائمة الكتالوج. */}
              <Button
                size="lg"
                onClick={adoptPlan}
                className="h-auto min-h-14 max-w-full whitespace-normal rounded-full bg-gold px-8 py-3 text-center text-base font-black leading-snug text-on-gold hover:bg-gold/90 md:text-lg"
              >
                {isComposed ? "اعتمد هذه الخطة" : "اعتمد هذا المسار"}
                <ArrowLeft className="mr-2 h-5 w-5 shrink-0" />
              </Button>
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
                  href={`mailto:Academy@wajeez.co?subject=${encodeURIComponent("أشعرني عند توفر: " + result.unavailableSkills.join("، "))}`}
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

          {/* شرح قوة الأدلة انتقل إلى بطاقة «لماذا هذا المسار» أعلى المنطقة المكشوفة —
              كان هنا في ذيل الصفحة ومطويًّا، أي بعد أن يكون القرار قد اتُّخذ. */}

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

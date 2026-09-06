/* بطاقاتُ نتيجة التشخيص — خطّةٌ تُشرَح وتُخصَّص وتُسعَّر.

   كانت هذه الخمسُ داخل `Diagnostic.tsx` وهو ألفان وخمسُ مئةِ سطر: أطولُ
   ملفّ في المستودع، وشاشتُه أهمُّ شاشةٍ في الرحلة. وطولٌ كهذا يخفي عطبه:
   من يقرأ الملفَّ باحثا عن سببِ سعرٍ خاطئ يمرّ على ألفِ سطرٍ لا علاقةَ لها.

   والقطعُ هنا **بلا تغييرِ سلوك**: الخمسُ كنّ دوالَّ عليا مستقلّةً بخصائصها
   المعلنة، لا تقرأ حالةَ الصفحة ولا تكتبها — فنُقلت كما هي. وما تحتاجه من
   المستودع مذكورٌ في الاستيراد أعلاه، وليس فيه شيءٌ من ملفّ الصفحة.

   والترتيبُ من الداخل إلى الخارج: سببُ وجود المقرّر، ثمّ رحلةُ المقرّرات
   وتبديلُها، ثمّ السعرُ، ثمّ «لماذا هذا المسار»، ثمّ الخطّةُ المركّبة. */

import { useMemo, useState } from "react";
import { CheckCircle2, FileText, Gauge, Sparkles } from "lucide-react";
import { useCoursePrices, cheapestOf, pricedCount, formatCohortPrice } from "@/services/cohort-prices";
import { FIRST_TIME_PROMO } from "@/application/commerce/first-time-promo";
import CourseJourney, { type CourseSuggestion } from "@/components/CourseJourney";
import {
  courseById,
  courses,
  MAX_PATHWAY_COURSES,
  MIN_PATHWAY_COURSES,
  pathwayCourses,
  pathwayDelivery,
} from "@/data/courses";
import { pathways, type Pathway } from "@/data/pathways";

/* ─────────── الخطة المركّبة قابلة للاستبدال — لا للحذف ولا للإضافة ───────────

   كانت الخطة المركّبة تُعرض بلا أي أداة تخصيص، بينما المسار القياسي يُمرَّر إليه
   استبدال وحذف وإضافة وهدية. فالمتعلم صاحب أعقد حالة — الذي احتاج خطة من أكثر
   من مجال — كان الوحيد الذي لا يملك ضبط خطته.

   والتبديل وحده لا الحذف: عدد الدورات هو ما يحدد السعر، فتثبيته يفتح الاختيار
   ويُبقي السعر ثابتا. والمجموعة تُبنى من المسارات التي رُكّبت منها الخطة نفسها —
   فالبديل يبقى داخل مجالاتها لا خارجها — ويتقدّم فيها ما يسدّ فجوة معروفة. */
export function ComposedSwap({
  planCourseIds,
  reasons,
  pathwayIds,
  gaps,
  delivery,
  onChange,
}: {
  planCourseIds: string[];
  reasons: Record<string, string>;
  pathwayIds: string[];
  gaps: string[];
  delivery?: string;
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
      edit={{
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
      }}
    />
  );
}

/* ─────────── رحلة الدورات القابلة للتخصيص — دمج التخصيص داخل «ماذا ستحقق من خلال خطتك؟» ─────────── */
export function PlanCourses({
  pathway,
  gaps,
  resetKey,
  onChange,
}: {
  pathway: Pathway;
  gaps: string[];
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
  const category = base[0]?.category ?? "أفراد ومهن ناشئة";

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
        edit={{
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
        }}
      />
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
        <p className="text-xs font-bold text-muted-foreground">
          مسارك المخصص الآن:{" "}
          <span className="text-foreground">
            {chosen.length} دورات{gift ? " + هدية مجانية" : ""}
          </span>
          <span className="text-muted-foreground"> · ~{totalWeeks} أسبوعا · يُحفظ تخصيصك تلقائيا ويظهر في صفحة مسارك بعد الاعتماد</span>
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <span key={s} className="rounded-full border border-teal/40 bg-teal/10 px-2.5 py-0.5 text-[11px] font-semibold text-teal-light-ink">
              {s}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─────────── الخطة المركبة المخصصة — تعرض عندما يختار المحرك قالبا مركبا ─────────── */
export interface CompositeView {
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
export function ResultPriceCard({ courseIds }: { courseIds: readonly string[] }) {
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
            <span className="text-sm text-muted-foreground">تبدأ من</span>
            <span dir="ltr" className="text-3xl font-black text-foreground md:text-4xl">{formatCohortPrice(cheapest)}</span>
            <span className="text-sm text-muted-foreground">للدورة</span>
          </div>
          <p className="mt-1.5 text-xs text-teal-light-ink">
            وخصمٌ كبير على خطتك كاملة ({courseIds.length} دورات) مقابل شرائها دورةً دورة
          </p>
        </>
      ) : (
        <p className="mt-2 text-2xl font-black text-foreground md:text-3xl">
          {loaded ? "يُعلن السعر مع فتح الشعبة" : "يُقرأ السعر…"}
        </p>
      )}
      {/* وكان هنا صندوقٌ يطلب بريدا مقابل الكود. وقرارُ صاحب المنصّة: لا داعي
          له — البريدُ يُكتب عند الشراء أصلا، فطلبُه مرّتين حاجزٌ بلا مقابل.
          والكودُ يُقال سطرا واحدا: هو لأوّل شراءٍ لكلّ أحد. */}
      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-gold/30 bg-gold/[0.06] px-3.5 py-2.5 text-[11.5px] leading-5">
        <span className="font-bold text-gold-ink">خصم {FIRST_TIME_PROMO.percentOff}٪ لأول عملية شراء بالكود</span>
        <code dir="ltr" className="rounded-md border border-gold/40 bg-gold/10 px-1.5 py-0.5 font-mono text-micro font-black text-gold-ink">
          {FIRST_TIME_PROMO.code}
        </code>
        <span className="text-muted-foreground">— يُكتب في صفحة الدفع.</span>
      </p>
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
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
export function WhyThisPathway({
  reasons,
  confidence,
  bandAr,
  blockers = [],
  basis = null,
  changeMakers,
  gapNote,
}: {
  reasons: string[];
  confidence: ConfidenceParts | undefined;
  bandAr: string | null;
  /** لماذا لم تعلُ الدرجة — يُعرض مع الدرجة لا يُترك للتخمين */
  blockers?: string[];
  /** أساسُ الدرجة رقما: المقيسُ من الممكن قياسُه، وما بقي مجهولا */
  basis?: { measured: number; measurable: number; unknown: number } | null;
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
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            لم نخمّن — هذه هي إجاباتك التي بُنيت عليها التوصية:
          </p>
          <ul className="mt-4 space-y-2.5">
            {evidence.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-light-ink" />
                {r}
              </li>
            ))}
          </ul>
        </>
      )}

      {confidence && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
          {/* ── الرقمُ شيءٌ والدرجةُ شيءٌ آخر ──

              كانا يُطبعان في سطرٍ واحد: «٩٧٪ — أفضل تطابق حالي». فيقرأ
              المتعلّمُ رقما عاليا وتحته عبارةٌ تنفيه، وقِيس أنّ **١٧٪ من
              الجلسات** تعرض ٧٨٪ فأعلى تحت «ليس قويّا»، وأعلى ما رُصد ٩٧٫١٪.

              وهما لا يتناقضان أصلا لأنّهما لا يقيسان الشيءَ نفسَه: الرقمُ
              **قوّةُ الأدلة المجموعة** (خمسةُ مكوّناتٍ مفصّلةٌ تحته)، والدرجةُ
              **صنفُ القرار** — وهي تُحجَب لمانعٍ واحدٍ بعينه مهما علا الرقم.

              فصارا سطرين، **ومع الدرجةِ سببُها**: مانعٌ يُقرأ خيرٌ من تناقضٍ
              يُخمَّن. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-sm font-black text-foreground">قوة أدلة هذه التوصية</span>
            <span className="text-sm font-black text-teal-light-ink">{total}٪</span>
          </div>
          {bandAr && (
            <div className="mt-2 rounded-xl border border-white/10 bg-paper/30 px-3 py-2">
              <p className="text-xs font-bold text-foreground">
                صنفُ النتيجة: <span className="text-teal-light-ink">{bandAr}</span>
              </p>
              {blockers.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {blockers.map((b) => (
                    <li key={b} className="flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
                      <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-ink" />
                      {b}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  لا مانعَ قائم — قِسنا ما تسمح المنصّة بقياسه، والباقي يبقى مجهولا لا مفترَضا.
                </p>
              )}
              {/* ── الأساسُ رقما لا عبارة ──

                  «قوية بما قِسناه» قيدٌ قد يُهمَل ويُقرأ صدرُها وحدَه. والرقمان
                  لا يُهمَلان: كم مهارةً قِيست من كم يمكن قياسُها، وكم بقي
                  مجهولا. فيقرأ المتعلّمُ **حدَّ ما نعرفه عنه** لا وصفَه. */}
              {basis && basis.measurable > 0 && (
                <p className="mt-2 border-t border-white/8 pt-2 text-[11px] leading-5 text-muted-foreground">
                  قِسنا <b className="text-foreground">{basis.measured}</b> من{" "}
                  <b className="text-foreground">{basis.measurable}</b> مهارةٍ تسمح المنصّةُ بقياسها في هذا المسار
                  {basis.unknown > 0 && (
                    <> — و<b className="text-foreground">{basis.unknown}</b> من مهاراته تبقى مجهولةً عندنا</>
                  )}.
                </p>
              )}
            </div>
          )}
          <div className="mt-4 space-y-2 text-xs">
            {parts.map((p) => (
              <div key={p.label} className="flex items-center gap-2">
                <span className="w-36 shrink-0 text-muted-foreground">{p.label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full rounded-full bg-teal"
                    style={{ width: `${Math.max(0, Math.min(100, Math.floor(p.value * 100)))}%` }}
                  />
                </span>
                <span className="w-9 shrink-0 text-left font-bold tabular-nums text-foreground">
                  {Math.floor(p.value * 100)}٪
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-muted-foreground">
            ترتفع حين تتفق إجاباتك، وتنخفض عند التناقض أو حين تقف حالتك بين مسارين متقاربين.
            فوق ٧٥٪ نحن واثقون بالترشيح، وبين ٥٠ و٧٥٪ نعرض معه بدائل، ودون ذلك نحيلك لمستشار بشري قبل أي قرار.
          </p>
        </div>
      )}

      {gapNote && (
        <p className="mt-4 flex items-start gap-2.5 text-sm leading-relaxed text-foreground">
          <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-teal-light-ink" />
          {gapNote}
        </p>
      )}

      {changeMakers.length > 0 && (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          <span className="font-bold text-foreground">وما الذي يغيّر هذه التوصية؟ </span>
          {changeMakers[0]}
        </p>
      )}
    </div>
  );
}

export function CompositePlan({ composite }: { composite: CompositeView }) {
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
        <span className="mr-2 text-xs text-muted-foreground">
          خطة مبنية لحالتك من أكثر من مجال — وليست مسارا جاهزا من الكتالوج
        </span>
      </div>
      <div className="p-6 md:p-8">
        <h3 className="text-xl font-black leading-snug md:text-2xl">{composite.name_ar}</h3>

        {/* المسارات التي استُمدت منها الخطة */}
        {represented.length > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            رُكّبت من: {represented.map((p) => p.name).join(" + ")}
          </p>
        )}

        {/* النسخة والساعات */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white/[0.05] p-4">
            <p className="text-sm text-muted-foreground">نسخة خطتك</p>
            <p className="font-black text-gold-ink">{variant.label}</p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{variant.hint}</p>
          </div>
          <div className="rounded-xl bg-white/[0.05] p-4">
            <p className="text-sm text-muted-foreground">إجمالي ساعات الخطة</p>
            <p className="font-black">{totalHours} ساعة</p>
            {/* كان مكتوبًا هنا «موزعة على إيقاعك الأسبوعي الذي أخبرتنا به» — وهو ادعاء
                لا يقع: الرقم مجموع ساعات الدورات الثابتة، لا يُقسَّم على أي إيقاع.
                والوقت الأسبوعي لم يعد يُسأل عنه أصلًا. */}
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">مجموع ساعات دورات خطتك</p>
          </div>
        </div>

        {/* لماذا رُكّبت هذه الخطة */}
        {composite.rationale_ar.length > 0 && (
          <ul className="mt-5 space-y-2">
            {composite.rationale_ar.slice(0, 4).map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground">
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
                <li key={r.courseId} className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-bold text-foreground">{r.titleAr}</span> — {r.reason_ar}
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
                <p className="mt-2 text-xs leading-6 text-foreground">{composite.capstone_ar}</p>
              </div>
            )}
            {composite.success_metric_ar && (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="flex items-center gap-2 text-xs font-black text-teal-light-ink">
                  <Gauge className="h-4 w-4" /> كيف تعرف أنك نجحت؟
                </p>
                <p className="mt-2 text-xs leading-6 text-foreground">{composite.success_metric_ar}</p>
              </div>
            )}
          </div>
        )}

        {/* أقرب بديل ولماذا لم يُختر */}
        {composite.nearest_alternative && (
          <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-muted-foreground">
            <span className="font-bold text-foreground">أقرب خطة بديلة كانت «{composite.nearest_alternative.nameAr}»</span>
            {" "}— {composite.nearest_alternative.whyNot_ar}
          </p>
        )}
      </div>
    </div>
  );
}

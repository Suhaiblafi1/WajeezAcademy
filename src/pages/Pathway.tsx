import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowRight,
  CalendarClock,
  Clock3,
  Route as RouteIcon,
  Gift,
  Sparkles,
  CheckCircle2,
  CalendarDays,
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
import FavoriteButton from "@/components/FavoriteButton";
import ThemeToggle from "@/components/ThemeToggle";
import AdvisorContact from "@/components/AdvisorContact";
import EnrollRequest from "@/components/EnrollRequest";
import CourseJourney from "@/components/CourseJourney";
import Modal from "@/components/Modal";
import { pathwayById, pathwayCategory } from "@/data/pathways";
import { hasCoreCatalog } from "@/data/core-catalog-source";
import { readAdoptedPlan, saveAdoptedPlan } from "@/application/plan/adopted-plan";
import { FIRST_TIME_PROMO } from "@/application/commerce/first-time-promo";
import { useCoursePrices, cheapestOf, pricedCount, formatCohortPrice } from "@/services/cohort-prices";
import { courseById, courses, pathwayCourses, pathwayDelivery, pathwayTrainers, courseTrainer, weeksLabel, MIN_PATHWAY_COURSES, MAX_PATHWAY_COURSES } from "@/data/courses";
import { GOAL_LABELS, GAP_LABELS, OBSTACLE_TO_GAP } from "@/data/diagnostic";
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

/* حُذفت خريطة ADVISORS: عشرة أسماء لأشخاص مكتوبة في الكود وتُعرض على
   مسارات موقعٍ حيّ كأنها فريق استشاري قائم. ولا أحد منهم موثَّق ولا معتمد — وقاعدة المستودع أن لا اسم يُعرض كحقيقة
   قبل توثيقه واعتماده. وقناة المراسلة تُدار مركزيا عبر AdvisorContact وبيانات
   CONTACT، فلم تكن الأسماء تفعل شيئا إلا الادّعاء. */

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

/* ثلاثة من المنظومة لا تُعطى لمن يشتري دورة مفردة — فهي فرق الشراءَين لا قائمة
   عامة. تُعرض تحت زر الدفع مباشرة حيث القرار، لا في صندوق أسفل الصفحة. */
const PATHWAY_ONLY_PERKS = [
  { icon: Headphones, t: "ملخصات كتب وجيز الصوتية", d: "ملخصات الكتب المرتبطة بمسارك — تسمعها ثم تختبر نفسك فيها" },
  { icon: BarChart3, t: "خريطة مهارات قبل وبعد", d: "مستواك 0–5 في كل مهارة قبل المسار وبعده — بالقياس لا بالانطباع" },
  { icon: UserCheck, t: "مستشار نجاح يرافقك", d: "متابعة أسبوعية ورسالة مباشرة عند أي تعثر" },
] as const

/* ─────────── الصفحة ─────────── */
type CheckoutIntent = { title: string; amount: number; kind: "pathway" | "course" | "courses"; courseId?: string; courseIds?: string[] };

export default function PathwayPage() {
  usePublishedContent();
  const { id } = useParams();
  const pathway = pathwayById(id ?? "");
  const [user, setUser] = useState<string | null>(readUserName);
  const [checkout, setCheckout] = useState<CheckoutIntent | null>(null);
  /* نية شراء معلقة بانتظار تسجيل الدخول — التصفح مفتوح، والتسجيل يُطلب لحظة الدفع فقط */
  const [pendingCheckout, setPendingCheckout] = useState<CheckoutIntent | null>(null);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  /* مُنسّق الدولار لم يعد يُستعمل هنا: كلّ سعر على هذه الصفحة صار من شعبةٍ
     حقيقية بعملتها، بلا تحويل — لأن التحويل يُخرج رقما ثالثا لا يُطالَب به أحد. */

  /* تتبع مشاهدة صفحة المسار — بلا بيانات شخصية */
  useEffect(() => {
    if (pathway) track("pathway_viewed", { sector: pathway.sector });
  }, [pathway]);

  /* الخطّة التي اعتمدها فعلا — تُقرأ كما كُتبت، بهوية مضيفٍ مطابقة.

     كان هنا حارسٌ يقارن `c.pathwayId` بسجلٍّ لا يحمل هذا الحقل أصلا، فيُرفض
     كلُّ ما اعتمده المتعلّم بصمت وتُعرض قائمة الكتالوج مكانه. */
  const adopted = useMemo(() => readAdoptedPlan(pathway?.id), [pathway?.id]);
  const custom = useMemo(
    () => (adopted ? { chosenIds: adopted.courseIds, giftId: adopted.giftId } : null),
    [adopted],
  );

  /* سياق الخطة المركبة — حاضر فقط عندما اعتمد المستخدم خطة مركبة من نتيجته، ومقترن بتخصيص مطابق لهذا المسار */
  const compositeCtx = useMemo(() => {
    if (!custom) return null;
    try {
      const c = JSON.parse(sessionStorage.getItem("wajeez_diag_composite") ?? "null");
      return c && typeof c.name_ar === "string" ? c as { template_id: string; name_ar: string } : null;
    } catch { return null; }
  }, [custom]);

  /* ─── تخصيص الخطّة على هذه الصفحة (المرحلة ٢) ───
     كان التخصيص في شاشة النتيجة وحدها، والصفحة عرضٌ فقط. صار هنا: يحذف
     ويستبدل ويضيف ويختار هديّته، ويُحفظ في الخطّة المعتمَدة نفسها لحظةَ كل
     تغيير — مصدرٌ واحد لا نسخةٌ ثانية تفترق عنه. */
  const [edits, setEdits] = useState<{ courseIds: string[]; giftId: string | null } | null>(null);
  const editable = Boolean(adopted);
  const courseIds = useMemo(
    () => edits?.courseIds ?? custom?.chosenIds ?? (pathway ? pathwayCourses[pathway.id] ?? [] : []),
    [edits, custom, pathway],
  );
  const giftId = edits?.giftId ?? custom?.giftId ?? null;
  const [swapForId, setSwapForId] = useState<string | null>(null);

  const commit = (ids: string[], gift: string | null) => {
    setEdits({ courseIds: ids, giftId: gift });
    if (adopted) saveAdoptedPlan({ ...adopted, courseIds: ids, giftId: gift });
  };

  /* بدائل ومقترحات: خارج المختار والهديّة، ومن مجال المسار أوّلا */
  const pool = useMemo(() => {
    const taken = new Set([...courseIds, ...(giftId ? [giftId] : [])]);
    return courses
      .filter((c) => !taken.has(c.id))
      .sort((x, y) => (y.pathwayId === pathway?.id ? 1 : 0) - (x.pathwayId === pathway?.id ? 1 : 0))
      .slice(0, 8)
      .map((c) => ({ id: c.id, name: c.name, note: `${c.skill} · من مسار ${c.pathwayName}` }));
  }, [courseIds, giftId, pathway?.id]);

  /* الدورات المعروضة هي وحدها ما يُسعَّر. كان العدد يُؤخذ من `courseIds` الخام
     والمجموع من القائمة بعد ترشيح المجهول — فيفترقان حين لا يُعرف معرّف، فيظهر
     مرجعٌ لا يطابق ما على الشاشة. مصدرٌ واحد يمنع ذلك. */
  const pathwayCoursesList = courseIds.map((cid) => courseById(cid)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  /* التسعير المُختلَق (coursePriceOf/pathwayPriceFor) لم يعد يُعرض في أي مكان
     على هذه الصفحة: كان يقدّر بمطابقة كلمات، والفاتورة تُصدر بسعر الشعبة. */

  /* «تبدأ من» من **سعر شعبةٍ حقيقية** لا من تقديرٍ في المتصفّح. كان الرقم
     المعروض مُختلَقا بمطابقة كلماتٍ في العنوان، والفاتورة تُصدر بسعر الشعبة
     وبعملة أخرى — فالوعد غير المطالبة. وحين لا شعبة معلومة: لا رقم. */
  const { prices, loaded: pricesLoaded } = useCoursePrices();
  const cheapest = cheapestOf(courseIds, prices);
  const known = pricedCount(courseIds, prices);

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

  /* نتيجة تشخيص مكتملة ومحفوظة على الجهاز (تبقى بعد إغلاق التبويب، بخلاف جلسة الصفحة) —
     وجودها يحوّل دعوة «لست متأكدا» إلى إعادة تخصيص المسار بدل إعادة التشخيص */
  const hasSavedResult = useMemo(() => {
    try {
      return !!localStorage.getItem("wajeez_diag_v2_last_full");
    } catch {
      return false;
    }
  }, []);

  if (!pathway) {
    /* البند ع-١: الكتالوج يصل بعد أول رسم، فـ«غير موجود» قبل وصوله خطأ —
       نعرض حالة تحميل حتى يثبت الكتالوج، ثم نحكم بالغياب. */
    if (!hasCoreCatalog()) {
      return (
        <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-ground text-white/60">
          <p className="text-sm">يُحضر المسار…</p>
        </div>
      );
    }
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper text-white">
        <p className="text-xl font-bold">هذا المسار غير موجود</p>
        <Link to="/" className="mt-4 text-teal-light-ink underline">العودة للرئيسية</Link>
      </div>
    );
  }

  const advisorMsg = `مرحبا، أكملت تشخيص وجيز ورُشّح لي مسار «${pathway.name}» وأريد استشارة قبل البدء.`;

  /* اختيار الدورات المتعدد — دورة واحدة أو عدة دورات بحرية كاملة */
  const buyableCourses = pathwayCoursesList.filter((c) => c.id !== custom?.giftId);
  const picked = buyableCourses.filter((c) => pickedIds.includes(c.id));
  /* مجموع المختارات من أسعار الشعب الحقيقية — و null حين لا يُعرف سعر إحداها،
     فلا يُجمع معلومٌ ومجهول ويُعرض الناتج كأنه كامل. */
  const pickedPrices = picked.map((c) => prices.get(c.id));
  const pickedTotal =
    picked.length > 0 && pickedPrices.every((p) => p != null)
      ? { amount: pickedPrices.reduce((sum, p) => sum + (p as { amount: number }).amount, 0), currency: (pickedPrices[0] as { currency: string }).currency, cohortId: "" }
      : null;
  const togglePick = (cid: string) =>
    setPickedIds(pickedIds.includes(cid) ? pickedIds.filter((x) => x !== cid) : [...pickedIds, cid]);
  const totalWeeks = pathwayCoursesList.reduce((s, c) => s + c.weeks, 0);

  /* بدء الشراء: المسجّل تفتح له نافذة الدفع مباشرة — والزائر تظهر له بوابة التسجيل أولا ثم نكمل الدفع تلقائيا */
  const startCheckout = (intent: CheckoutIntent) => {
    if (user) setCheckout(intent);
    else setPendingCheckout(intent);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-white">
      <SeoHead
        title={pathway.name}
        description={`${pathway.transformation} — مسار ${pathway.level} من ${weeksLabel(pathway.durationWeeks)} في أكاديمية وجيز.`}
        path={`/pathways/${pathway.id}`}
      />
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2 text-white/70 hover:text-white">
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm font-medium">الرئيسية</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
            <span className="font-black">أكاديمية وجيز</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <span className="flex items-center gap-1.5 text-xs text-white/50">
                <User className="h-4 w-4" /> {user}
              </span>
            ) : (
              <Link to="/auth" className="flex items-center gap-1.5 rounded-xl border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-white/70 transition hover:border-teal/50 hover:text-teal-light-ink">
                <User className="h-3.5 w-3.5" />
                دخول
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* تصفح المسار مفتوح للجميع بلا تسجيل — التسجيل يُطلب لحظة الدفع فقط (pendingCheckout) */}
      {(
        /* ب-٢: حاوية تخطيط لا منطقة landmark — main واحدة في التطبيق (App.tsx)
           وهي هدف رابط «تجاوز إلى المحتوى»؛ والمتداخلة تجعل التخطي غامضا. */
        <div className="mx-auto max-w-5xl px-5 py-12">
          {/* ترويسة المسار */}
          <div className="story-fade">
            <div className="flex flex-wrap items-center gap-2">
              {/* «مرشح لك» ادّعاء شخصي، وكان يُقال لكل زائر على كل مسار — حتى لمن لم
                  يفتح التشخيص قط، لأن `badge` التي يسقط عليها لا يضبطها أحد في المصدر.
                  والتصنيف يقول له أين يقع المسار بلا ادّعاء؛ والترشيح يبقى لمساره هو. */}
              <Badge className="bg-gold font-black text-on-gold">
                {pathway.badge ?? (diagTopId === pathway.id ? "مسار مرشح لك" : pathwayCategory(pathway.id))}
              </Badge>
              <Badge variant="outline" className="border-white/20 text-white/70">{pathway.level}</Badge>
              {custom && !compositeCtx && <Badge className="border border-teal-light/50 bg-teal/15 text-teal-light-ink">نسختك المخصصة</Badge>}
              {compositeCtx && <Badge className="border border-gold/60 bg-gold/15 text-gold-ink">خطة مركبة مخصصة</Badge>}
              <FavoriteButton pathwayId={pathway.id} pathwayName={pathway.name} className="ms-auto" />
            </div>
            {/* اسم الخطّة كما اعتُمدت — لا اسم المسار المضيف. استعارةُ اسمه هي
                ما جعل المتعلّم يظنّ أن خطّته أُعيدت تسميتها. */}
            <h1 className="mt-4 text-3xl font-black leading-snug md:text-4xl">{adopted?.nameAr ?? pathway.name}</h1>
            <p className="mt-4 max-w-2xl leading-loose text-white/65">{pathway.transformation}</p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-white/70">
                <CalendarClock className="h-3.5 w-3.5 text-teal-light-ink" />
                {custom ? `${weeksLabel(totalWeeks)} (مخصصة)` : weeksLabel(pathway.durationWeeks)}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-white/70">
                <Clock3 className="h-3.5 w-3.5 text-teal-light-ink" />
                {pathway.weeklyHours} أسبوعيا
              </span>
            </div>
            <p className="mt-3 flex max-w-2xl items-start gap-2 text-sm leading-relaxed text-white/60">
              <RouteIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold-ink" />
              <span>
                <span className="font-bold text-white/80">المخرج العملي: </span>
                {pathway.output}
              </span>
            </p>
          </div>

          {/* شارة الخطة المركبة — تسبق رحلة الدورات لتفسير لماذا تختلف القائمة عن كتالوج المسار */}
          {compositeCtx && (
            <div className="story-fade mt-6 rounded-2xl border border-gold/40 bg-gold/[0.06] px-5 py-4">
              <p className="text-sm font-black text-gold-ink">خطتك المركبة: «{compositeCtx.name_ar}»</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                الدورات أدناه هي تركيبتك كما ركّبها تشخيصك من أكثر من مجال — تُدار وتُتابع عبر مسار «{pathway.name}» المضيف.
              </p>
            </div>
          )}

          {/* «ماذا ستحقق من خلال خطتك؟» — رحلة الدورات بأكورديون، بلا قائمة مكررة فوقها */}
          <CourseJourney
            courseIds={pathwayCoursesList.map((c) => c.id)}
            delivery={pathwayDelivery(pathway.id)}
            headingLevel="h2"
            giftId={giftId}
            edit={
              editable
                ? {
                    giftId,
                    swapForId,
                    pool,
                    minReached: courseIds.length <= MIN_PATHWAY_COURSES,
                    maxReached: courseIds.length >= MAX_PATHWAY_COURSES,
                    onSwapToggle: setSwapForId,
                    onSwapPick: (oldId, newId) => {
                      commit(courseIds.map((i) => (i === oldId ? newId : i)), giftId);
                      setSwapForId(null);
                    },
                    onRemove: (id) => {
                      if (courseIds.length <= MIN_PATHWAY_COURSES) return;
                      commit(courseIds.filter((i) => i !== id), giftId === id ? null : giftId);
                    },
                    onAdd: (id) => {
                      if (courseIds.length >= MAX_PATHWAY_COURSES) return;
                      commit([...courseIds, id], giftId);
                    },
                    /* الهديّة يختارها هو، وتُحتسب ضمن السقف: دورةٌ في الخطّة
                       بلا ثمن، لا دورةٌ سابعة خارجها. */
                    onGiftToggle: (id) => commit(courseIds, giftId === id ? null : id),
                  }
                : undefined
            }
          />

          {/* أنواع المصادر المرافقة حُذفت — كانت مكررة مع صندوق «منظومة كاملة» أدناه */}

          {/* مقاعد التخصصات التدريبية — الأسماء تُعلن بعد اعتماد الشعبة */}
          <div className="story-fade mt-8 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-black">
              <User className="h-4 w-4 text-teal-light-ink" />
              الفريق التدريبي لهذا المسار
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {pathwayTrainers(pathway.id).map((t) => (
                <span key={t.role} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs">
                  <User className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" />
                  <span className="font-bold text-white/85">{t.role}</span>
                  <span className="text-teal-light-ink">{t.name}</span>
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-white/40">
              كل دورة يقدمها المدرب الأعمق في موضوعها — وينسّقون معا حتى تتكامل المهارات لا أن تتكرر. تُعلن الأسماء بعد اعتماد الشعبة رسميا.
            </p>
          </div>

          {/* التأكيد لا يظهر إلا على مسار تشخيصه نفسه.
              كان يظهر على كل مسار جاهز يفتحه بعد التشخيص ليقول له «تستعرض مسارا
              مختلفا عن الذي اعتمده تشخيصك» — وهي جملة لا تخدمه: هو يعلم أنه يتصفح
              مسارا آخر، وقولها يحوّل التصفح إلى مخالفة. والصفحة نفسها مسار جاهز
              معروض للجميع، لا نتيجة شخصية. */}
          {/* يظهر لمن اعتمد خطّة على هذا المسار. كان مشروطا بـwajeez_diag_top
              وحده، ولا يُكتب إلا في مسار القوالب — فمعظم من اعتمد لم يكن يرى
              الزرّ أصلا. */}
          {(adopted || (report && diagTopId === pathway.id)) && (
            <div className="story-fade mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal/40 bg-teal/[0.06] px-5 py-3">
              <p className="flex items-center gap-2 text-xs font-bold leading-relaxed text-white/75">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-light-ink" />
                هذا المسار اعتمده تشخيصك — بُني على إجاباتك أنت.
              </p>
              {/* كان `to="/diagnostic"` مجرّدا، وصفحة التشخيص تفتح دائما على
                  المقدّمة — فالزرّ يَعِد بالعودة إلى النتيجة ويأتي بالبداية،
                  ويحتاج المتعلّم نقرةً ثانية يكتشفها بنفسه. */}
              <Link
                to="/diagnostic?view=result"
                className="flex items-center gap-1.5 rounded-full border border-teal/50 px-4 py-1.5 text-xs font-bold text-teal-light-ink transition hover:bg-teal/15"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                عد لنتيجتك لإعادة التخصيص
              </Link>
            </div>
          )}

          {/* تقريره الشخصي — مطوي افتراضيا، وعلى مسار تشخيصه وحده:
              تقرير «ما فهمناه عنك» جزء من نتيجته لا من صفحة مسار جاهز. */}
          {report && diagTopId === pathway.id && (
            <details className="story-fade group mt-6 rounded-2xl border border-[#38A7B4]/35 bg-gradient-to-b from-panel/60 to-transparent">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-black text-[#6EC7D1] [&::-webkit-details-marker]:hidden">
                <FileText className="h-4 w-4" />
                تقريرك الشخصي — ما فهمناه عنك
                <span className="mr-auto text-[10px] font-semibold text-white/40 transition group-open:rotate-180">▾</span>
              </summary>
              <div className="border-t border-white/10 px-5 py-4">
                <div className="space-y-3">
                  {report.lines.map((l) => (
                    <p key={l} className="flex items-start gap-3 text-sm leading-loose text-white/75">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-teal-ink" />
                      {l}
                    </p>
                  ))}
                </div>
                {report.notes && (
                  <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-white/60">
                    <span className="font-bold text-teal-light-ink">كلمتك التي كتبتها بنفسك: </span>«{report.notes}»
                  </p>
                )}
                <p className="mt-4 text-xs text-white/40">هذا التقرير مبني على إجاباتك في التشخيص — وسيطوره مستشارك معك في أول جلسة.</p>
              </div>
            </details>
          )}

          {/* مقارنة الشراء: دورة واحدة أم المسار كاملا — تصميم هادئ يريح القرار */}
          {(
            <div id="buy" className="story-fade mt-10 scroll-mt-24 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <h3 className="text-xl font-black">سجّل بالطريقة التي تناسبك</h3>
              <p className="mt-2 text-xs leading-relaxed text-white/50">خياران واضحان بلا ضغط — قارن بهدوء، والقرار لك.</p>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {/* دورة أو أكثر — اختيار حر */}
                <div className="flex flex-col rounded-2xl border border-white/15 bg-black/30 p-5">
                  <p className="font-black text-sm">دورة أو أكثر من المسار</p>
                  <p className="mt-1 text-xs text-white/50">اختر ما تحتاجه بالضبط — دورة واحدة أو عدة دورات — ورسومك مجموعها فقط</p>
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
                              ? "border-teal bg-teal/15"
                              : "border-white/10 bg-white/[0.03] hover:border-teal/50"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                                on ? "border-teal bg-teal text-on-teal" : "border-white/25 text-transparent"
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
                          {/* سعر الدورة من شعبتها لا من تقدير — وبلا شعبة لا رقم */}
                          <span className="shrink-0 text-sm font-black text-white/85">
                            {prices.get(c.id) ? (
                              <span dir="ltr">{formatCohortPrice(prices.get(c.id)!)}</span>
                            ) : (
                              <span className="text-[11px] font-bold text-white/40">مع الشعبة</span>
                            )}
                          </span>
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
                      {pickedTotal ? (
                        <span dir="ltr" className="text-2xl font-black text-white">{formatCohortPrice(pickedTotal)}</span>
                      ) : (
                        <span className="text-xs text-white/50">يُعلن السعر مع الشعبة</span>
                      )}
                    </div>
                  )}
                  {picked.length > 0 && (
                    /* التنبيه بلا مقارنةٍ رقمية: المقارنة القديمة كانت بين رقمين
                       مُختلَقين، فكانت تنصح بناءً على ما لا يُدفع. */
                    <p className="mt-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-[11px] font-semibold leading-relaxed text-gold-ink">
                      المسار كاملا أوفر، ويشمل التشخيص والمتابعة ودورةً إضافية هديّة.
                    </p>
                  )}
                  <Button
                    onClick={() =>
                      startCheckout({
                        title:
                          picked.length === 1
                            ? `دورة «${picked[0].name}» من مسار ${pathway.name}`
                            : `${picked.length} دورات مختارة من مسار ${pathway.name}`,
                        amount: pickedTotal?.amount ?? 0,
                        kind: picked.length === 1 ? "course" : "courses",
                        courseIds: picked.map((c) => c.id),
                      })
                    }
                    disabled={picked.length === 0}
                    variant="outline"
                    className="mt-4 h-11 rounded-full border-teal/60 bg-transparent font-black text-teal-light-ink hover:bg-teal/10 hover:text-teal-light-ink disabled:opacity-40"
                  >
                    {picked.length === 0
                      ? "اختر دورة واحدة على الأقل"
                      : picked.length === 1
                        ? "اطلب تسجيلك في الدورة"
                        : `اطلب تسجيلك (${picked.length} دورات)`}
                  </Button>
                </div>
                {/* المسار كاملا */}
                <div className="relative flex flex-col rounded-2xl border border-gold/30 bg-white/[0.03] p-5">
                  <span className="absolute left-3 top-3 rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-black text-gold-ink">الأوفر</span>
                  <p className="font-black text-sm">المسار كاملا</p>
                  <p className="mt-1 text-xs text-white/50">كل الدورات + التشخيص الكامل + المنظومة الست أدناه</p>
                  {/* الرقم الأوّل «تبدأ من … للدورة» لا سعرُ الخطّة كاملة.
                      المتعلّم هنا يقرّر أيبدأ أم لا، ورقمٌ من ثلاث خانات في
                      صدارة البطاقة يُقرأ حاجزا قبل أن يُقرأ قيمة. وسعرُ الخطّة
                      يُحدَّد بعد أن يعتمدها هو — لأن عددها يتغيّر بيده. */}
                  {cheapest ? (
                    <>
                      <div className="mt-4 flex items-end gap-1.5">
                        <span className="mb-1 text-xs text-white/50">تبدأ من</span>
                        <span dir="ltr" className="text-2xl font-black text-white">{formatCohortPrice(cheapest)}</span>
                        <span className="mb-1 text-xs text-white/50">للدورة</span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs">
                        <p className="text-teal-light-ink">خصمٌ كبير على المسار كاملا مقابل شراء دوراته منفردة</p>
                        <p className="text-gold-ink">
                          و<span className="font-black">{FIRST_TIME_PROMO.percentOff}%</span> إضافية لأوّل عملية شراء بالكود{" "}
                          <span dir="ltr" className="font-mono font-black">{FIRST_TIME_PROMO.code}</span>
                        </p>
                        <p className="flex items-center gap-1.5 text-gold-ink">
                          <Gift className="h-3.5 w-3.5" /> ودورةٌ من اختيارك هديّة داخل الخطّة
                        </p>
                        <p className="pt-0.5 text-white/45">
                          سعر مسارك يُحدَّد بعد أن تعتمده — أنت من يقرّر دوراته.
                          {known < courseIds.length && " وبعض دوراته لم تُفتح لها شعبة بعد."}
                        </p>
                      </div>
                    </>
                  ) : (
                    /* لا شعبة مسعَّرة: لا رقم. رقمٌ لا تسنده شعبة هو الذي جعل
                       الوعد يفترق عن الفاتورة. */
                    <div className="mt-4 space-y-1.5 text-xs">
                      <p className="text-sm font-black text-white">
                        {pricesLoaded ? "يُعلن السعر مع فتح الشعبة" : "يُقرأ السعر…"}
                      </p>
                      <p className="text-white/50">
                        نُسعّر كل شعبة على حدة، ولا نعرض رقما قبل أن يكون هو الرقم الذي تدفعه.
                      </p>
                      <p className="flex items-center gap-1.5 text-gold-ink">
                        <Gift className="h-3.5 w-3.5" /> ودورةٌ من اختيارك هديّة داخل الخطّة
                      </p>
                    </div>
                  )}
                  <Button
                    onClick={() => startCheckout({ title: `مسار «${pathway.name}» كاملا (${pathwayCoursesList.length} دورات + هدية)`, amount: 0, kind: "pathway" })}
                    className="mt-4 h-11 rounded-full bg-gold font-black text-on-gold hover:bg-gold/90"
                  >
                    <CalendarDays className="ml-2 h-4 w-4" />
                    اطلب تسجيلك في المسار
                  </Button>
                  {/* كان أسفل الزر فراغ في صندوق أطول من محتواه. وثلاثة من عناصر
                      «المنظومة» التسعة أدناه هي في الحقيقة فرق بين شراء دورة وشراء
                      مسار — لا تُعطى لمن يشتري دورة واحدة — فمكانها هنا لا في قائمة
                      عامة أسفل الصفحة. بقيت ستة هناك. */}
                  <div className="mt-4 border-t border-white/10 pt-3.5">
                    <p className="text-[11px] font-black text-gold-ink">ومعه ثلاثة لا تأتي مع الدورة المفردة:</p>
                    <ul className="mt-2 space-y-2">
                      {PATHWAY_ONLY_PERKS.map((perk) => (
                        <li key={perk.t} className="flex items-start gap-2.5">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gold/15">
                            <perk.icon className="h-3.5 w-3.5 text-gold-ink" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[12px] font-black leading-snug text-white/90">{perk.t}</span>
                            <span className="block text-[10.5px] leading-relaxed text-white/45">{perk.d}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              {/* كان هنا وعدٌ بـ«دفع آمن عبر Stripe وتأكيد فوري»، ولا تكامل دفعٍ في
                  الموقع أصلا. النصّ يصف ما يحدث فعلا. */}
              <p className="mt-4 text-center text-[11px] text-white/40">طلبك يُراجَع، ثم تصلك فاتورتك وتُفتح شعبتك</p>
              {/* الدعوة إلى التشخيص سطر عند لحظة القرار، لا شريطا مؤطّرا في وسط
                  الصفحة. صفحة المسار الجاهز صفحة منتج معروضة للجميع، وكل صندوق
                  يعترضها يقرأ كأنه نتيجة شخصية لزائر لم يتشخّص أصلا. */}
              {diagTopId !== pathway.id && (
                <p className="mt-2 text-center text-[11px] leading-relaxed text-white/35">
                  {hasSavedResult ? "نتيجتك محفوظة — " : "لست متأكدا أنه الأنسب لك؟ "}
                  <Link to="/diagnostic" className="font-bold text-white/55 underline underline-offset-4 transition hover:text-[#6EC7D1]">
                    {hasSavedResult ? "عد إليها وأعد تخصيص مسارك" : "ثلاث دقائق مع مؤشر وجيز"}
                  </Link>
                </p>
              )}
            </div>
          )}

          {/* ما ستحصل عليه مع المسار — من عروض أكاديمية وجيز (نسخة مضغوطة: خانات أصغر ومتقاربة) */}
          <div className="story-fade mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Sparkles className="h-5 w-5 text-[#FABC05]" />
              مع المسار لا تأخذ دورات فقط — تأخذ منظومة كاملة
            </h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: MonitorPlay, t: "دورات مسجلة + جلسات مباشرة", d: "وحدات فيديو وجلسة حية مع المدرب ومهمة تطبيقية لكل دورة" },
                { icon: ClipboardCheck, t: "واجبات تُراجع بشريا", d: "مدربك يقرأ واجبك ويعطيك تغذية راجعة عملية — لا تصحيحا آليا" },
                { icon: FolderKanban, t: "مشروع تخرج حقيقي", d: "تبني مخرجا على واقعك وتقدمه للمراجعة قبل الاعتماد" },
                { icon: BadgeCheck, t: "شهادة موثقة بشروط إنجاز", d: "مرتبطة بالحضور والاختبار والمشروع — لا شهادة مشاهدة" },
                { icon: RouteIcon, t: "خطة تقدم شخصية", d: "خطوة تالية واضحة بعد المسار — ماذا تتعلم بعده ولماذا" },
                { icon: Briefcase, t: "منظومة ما بعد الإتمام", d: "لوحة وظائف وتوصيات مهنية وبرنامج سفراء وجيز" },
              ].map((b) => (
                <div key={b.t} className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#38A7B4]/15">
                    <b.icon className="h-3.5 w-3.5 text-[#6EC7D1]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-black leading-snug">{b.t}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">{b.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA ختامي — يعيد إلى قسم الدفع في الأعلى */}
          <div className="story-fade mt-8 text-center">
            <a
              href="#buy"
              className="inline-flex items-center gap-2 rounded-full bg-gold px-10 py-4 text-lg font-black text-on-gold transition hover:bg-gold/90"
            >
              ابدأ الآن لنسختك القادمة
            </a>
          </div>

          {/* المستشار سطرٌ لمن يحتاجه، لا صندوقٌ يُشجَّع عليه الجميع.

              كان بطاقةً بعرض الصفحة: دائرةُ حرفٍ كبيرة، واسمُ شخصٍ بخط عريض،
              ولقبٌ يقول «مستشارك المخصص لهذا المسار»، وزرٌّ أخضر بحجم زر الشراء.
              وفيها عيبان: الأول أن دور المستشار في هذا المنتج استثناء لا قاعدة —
              التشخيص يحسم، والمستشار لمن لم يحسم له. والثاني أن الأسماء
              (ADVISORS) بيانات ثابتة في الكود لا أشخاصٌ موثّقون، فعرضها كأنها
              فريقٌ قائم ادّعاء — وهو ما تمنعه قاعدةُ «لا اسم يُعرض كحقيقة قبل
              توثيقه». فبقي الباب مفتوحا وسقط الادّعاء: قناة الاتصال نفسها، بلا
              اسم ولا صورة ولا إلحاح. */}
          <p className="story-fade mt-6 text-center text-xs leading-relaxed text-white/40">
            ما زلت مترددا؟{" "}
            <AdvisorContact
              text={advisorMsg}
              label="راسل مستشار وجيز قبل الدفع"
              /* شذرة فارغة لا null: التوقيع يسقط عند null إلى أيقونة افتراضية،
                 وهذه دعوةٌ داخل جملة لا زرّ — أيقونةٌ فيها ضجيج. */
              icon={<></>}
              className="font-bold text-white/60 underline underline-offset-4 transition hover:text-[#6EC7D1]"
            />
          </p>

          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-white/55">
            <Sparkles className="h-3.5 w-3.5" />
            منصة الطالب الكاملة (الدورات، الواجبات، المتابعة) تُفتح تلقائيا بعد أول دفع ناجح — وهي محطتنا القادمة.
          </p>
        </div>
      )}

      {/* تعريف المنظومة — سطر ثقة ختامي يظهر للزائر والمسجّل معا */}
      <EcosystemNote className="mx-auto max-w-5xl px-5 pb-8" />

      {/* بوابة التسجيل لحظة الدفع — تظهر فوق الصفحة دون حجب تصفحها، وبعدها يكمل الدفع تلقائيا */}
      {pendingCheckout && (
        <Modal onClose={() => setPendingCheckout(null)} label="سجّل لإتمام الشراء" panelClassName="w-full max-w-md">
          <AuthGate
            message="تصفح المسار مفتوح للجميع — التسجيل هنا خطوة أخيرة قبل الدفع لتحفظ مشترياتك وتُفتح منصتك."
            source="checkout_gate"
            onDone={() => {
              setUser(readUserName());
              setCheckout(pendingCheckout);
              setPendingCheckout(null);
            }}
          />
        </Modal>
      )}

      {/* نافذة الدفع */}
      {checkout && (
        <EnrollRequest
          title={checkout.title}
          amount={checkout.amount}
          contactHref={`/contact?type=enroll&pathway=${pathway.id}`}
          onClose={() => setCheckout(null)}
        />
      )}

    </div>
  );
}

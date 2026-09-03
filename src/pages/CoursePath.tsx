/* «ابنِ مسارك» — مسار يبدأ بدورة واحدة.

   المشكلة التي حلّها: «تفاصيل الدورة» كانت نافذة صغيرة تعرض المحاور والمخرج،
   وزرُّها الوحيد «سجّل في الدورة» ينقل المتعلم إلى صفحة المسار كاملا. فمن أراد
   دورة واحدة وجد ستّ دورات وسعر مسار، ولم يجد بابا يبني به تركيبته الخاصة.

   هذه الصفحة تعامل الدورة التي فتحها بوصفها مسارا من دورة واحدة: تفاصيلها
   كاملة كما هي في الكتالوج (وصف ومخرجات ووحدات ومشروع)، ثم اقتراحات مرتّبة
   بأسبابها، ثم سعر يتبع القاعدة التي نطقها المالك: ما دام المجموع دون سعر
   المسار فهو السعر ولا يُذكر سعر المسار؛ فإذا بلغه صار المسار هو السعر.

   وله أن يسمّي تركيبته — تُحفظ عندنا لعلّها تصير مسارا معتمدا للعامة. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowRight, BookOpen, CheckCircle2, Clock3, CalendarDays, Layers, ListChecks,
  Plus, Route as RouteIcon, Save, Target, Trash2, User, Sparkles,
} from "lucide-react";
import SeoHead from "@/components/SeoHead";
import AuthGate from "@/components/AuthGate";
import Modal from "@/components/Modal";
import BuyPanel from "@/components/BuyPanel";
import CohortPicker from "@/components/CohortPicker";
import { useRealSession } from "@/services/session";
import CourseTitle from "@/components/CourseTitle";
import { Button } from "@/components/ui/button";
import { usePublishedContent } from "@/services/public-content";
import { useCourseCohorts, type CohortOption } from "@/services/cohort-prices";
import { track } from "@/services/analytics";
import { bundleNudge, pathPricing, suggestNext, MAX_BUILT_COURSES } from "@/application/catalog/course-path";
import { DISCOUNT_CATEGORIES } from "@/application/commerce/discount-policy";
import { FIRST_TIME_PROMO, isFirstTimePromo } from "@/application/commerce/first-time-promo";
import { CONTACT } from "@/data/stories";
import { savePathDraft } from "@/services/path-drafts";
import {
  courseById, courseFullById, courseDetails,
  pathwayCourses, weeksLabel, type Course,
} from "@/data/courses";
import { hasCoreCatalog } from "@/data/core-catalog-source";

/* سعر الدورة الواحدة في القوائم: رقمٌ من شعبةٍ حقيقية، أو «مع الشعبة» —
   ولا تقدير بينهما. */
function CoursePriceTag({ amount, money, className }: { amount: number | null; money: (n: number) => string; className: string }) {
  if (amount === null) return <span className="text-[11px] font-bold text-white/35">مع الشعبة</span>;
  return <span dir="ltr" className={className}>{money(amount)}</span>;
}

function readUserName(): string | null {
  try {
    const raw = localStorage.getItem("wajeez_user");
    if (!raw) return null;
    const u = JSON.parse(raw) as { name?: string };
    return u.name ?? null;
  } catch {
    return null;
  }
}

type Intent = { title: string; amount: number; kind: "course" | "courses" | "pathway" };

/* الغلاف يعيد تركيب الصفحة عند تغيّر الدورة في الرابط (key) بدل تصفير الحالة
   داخل effect: تصفيرُها هناك يُرسم مرتين ويخالف قاعدة React Compiler. */
export default function CoursePathRoute() {
  const { courseId } = useParams();
  return <CoursePathPage key={courseId ?? "none"} courseId={courseId ?? ""} />;
}

function CoursePathPage({ courseId }: { courseId: string }) {
  /* رقم إصدار الكتالوج — يتغيّر لحظة تثبيت اللقطة المنشورة.
     وهو دالّة في كل useMemo يقرأ الكتالوج هنا، وليس زينة: الكتالوج يصل بعد
     أول رسم، فالحسبة الأولى تجري على كتالوج فارغ. وكان أثره ظاهرا: صفّ الدورة
     يعرض سعرها (يُحسب في كل رسم) وبطاقةُ السعر تحته تقول صفرا (محفوظة من
     الرسم الأول). رقمٌ يناقض رقما فوقه مباشرة. */
  const catalogVersion = usePublishedContent();
  /* الأسعار من الشعب لا من تقديرٍ في المتصفّح (التوصية ٤). وعملةٌ واحدة
     مرجعا: خلطُ دينارٍ بريالٍ في مجموعٍ واحد يُخرج رقما لا يُطالَب به أحد،
     فما خالف عملةَ المرجع يُعدّ «غير مسعَّر» ويُقال ذلك نصّا. */
  const { cohorts, loaded: pricesLoaded } = useCourseCohorts();

  const anchor = courseById(courseId);
  const [picked, setPicked] = useState<string[]>(courseId ? [courseId] : []);
  /* الشعبةُ المختارة لكلّ دورة — أقربُ متاحٍ افتراضا، ويبدّلها من شاء.
     وقرارُ صاحب المنصّة: «يختار الشعب المفتوحة للدورة حسب التوفّر». والاختيارُ
     يعيش هنا لا في لوح الشراء: السعرُ المعروض في هذه الصفحة سعرُ الشعبة
     المختارة، فلو عاش الاختيارُ في اللوح لقالت الصفحةُ رقما ولقُبض غيرُه. */
  const [cohortChoice, setCohortChoice] = useState<Record<string, string>>({});
  const [user, setUser] = useState<string | null>(readUserName);
  /* الجلسةُ الحقيقيّة للبريد: لوحُ الشراء يطلب التوثيقَ في موضعه، و`readUserName`
     يقرأ التخزين المحلّيّ وحدَه فقد يخالف كعكةَ الخادم. */
  const { user: session } = useRealSession();
  const [checkout, setCheckout] = useState<Intent | null>(null);
  const [pending, setPending] = useState<Intent | null>(null);
  const [name, setName] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  /* الكود يُكتب هنا ويُطبَّق بزر — لا فور الكتابة: التطبيق التلقائي يجعل كل
     حرف يُكتب محاولةً فاشلة، فيرى المتعلم رفضا وهو في منتصف كلمة. */
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState<string | null>(null);
  const [promoError, setPromoError] = useState(false);
  /* ما تجاوز السقف يُحفظ لمرحلة تالية بدل أن يُرفض بصمت */
  const [deferred, setDeferred] = useState<string[]>([]);

  useEffect(() => {
    if (anchor) track("course_path_opened", { course: anchor.id, pathway: anchor.pathwayId });
  }, [anchor]);

  const suggestions = useMemo(() => {
    /* الكتالوج يصل بعد أول رسم — فإعادة الحساب معلَّقة على إصداره */
    void catalogVersion;
    return suggestNext(picked, 8);
  }, [picked, catalogVersion]);
  /* شعبةُ الدورة المعتبَرة: ما اختاره إن كان ما زال متاحا، وإلّا أقربُ
     شعبةٍ مفتوحة. والقائمةُ مرتّبةٌ بالبدء في مصدرها، فأوّلُها أقربُها. */
  const cohortOf = useCallback(
    (id: string): CohortOption | null => {
      const list = cohorts.get(id);
      if (!list || list.length === 0) return null;
      return list.find((o) => o.id === cohortChoice[id]) ?? list[0];
    },
    [cohorts, cohortChoice],
  );
  const baseCurrency = useMemo(() => {
    for (const id of picked) { const c = cohortOf(id); if (c) return c.currency; }
    for (const list of cohorts.values()) { const first = list[0]; if (first) return first.currency; }
    return null;
  }, [picked, cohortOf, cohorts]);
  const priceOf = useCallback(
    (id: string) => {
      const c = cohortOf(id);
      return c && c.currency === baseCurrency ? c.amount : null;
    },
    [cohortOf, baseCurrency],
  );
  const money = useCallback(
    (n: number) => `${Math.round(n).toLocaleString("en-US")} ${baseCurrency ?? ""}`.trim(),
    [baseCurrency],
  );
  const pricing = useMemo(() => {
    /* الكتالوج يصل بعد أول رسم — فإعادة الحساب معلَّقة على إصداره */
    void catalogVersion;
    return pathPricing(picked, priceOf);
  }, [picked, catalogVersion, priceOf]);
  const nudge = useMemo(
    () => bundleNudge(picked, suggestions.map((s) => s.courseId), priceOf),
    [picked, suggestions, priceOf],
  );

  /* هل صارت مختاراته مسارا جاهزا بعينه؟ حينها نقوله له بدل ادّعاء تركيب جديد */
  const matchesPathway = useMemo(() => {
    /* الكتالوج يصل بعد أول رسم — فإعادة الحساب معلَّقة على إصداره */
    void catalogVersion;
    if (!anchor || picked.length < 4) return null;
    const full = pathwayCourses[anchor.pathwayId] ?? [];
    if (full.length === 0 || picked.length !== full.length) return null;
    return full.every((id) => picked.includes(id)) ? anchor.pathwayId : null;
  }, [anchor, picked, catalogVersion]);

  if (!anchor) {
    if (!hasCoreCatalog()) {
      return (
        <div dir="rtl" className="grid min-h-screen place-items-center bg-paper text-white/60">
          جارٍ تحميل الكتالوج…
        </div>
      );
    }
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-paper px-6 text-center text-white">
        <div>
          <p className="text-lg font-black">لم نجد هذه الدورة</p>
          <p className="mt-2 text-sm text-white/55">قد تكون أُعيدت تسميتها أو نُقلت إلى مسار آخر.</p>
          <Link to="/courses" className="mt-5 inline-block rounded-2xl bg-teal-deep px-7 py-3 font-bold">
            تصفّح الدورات
          </Link>
        </div>
      </div>
    );
  }

  const full = courseFullById(anchor.id);
  const details = courseDetails(anchor);
  const pickedCourses = picked.map((id) => courseById(id)).filter((c): c is Course => Boolean(c));
  const totalWeeks = pickedCourses.reduce((s, c) => s + c.weeks, 0);

  const add = (id: string) => {
    if (picked.includes(id)) return;
    /* عند السقف: تُحفظ للمرحلة التالية لا تُرفض. الرفض الصامت يجعل الزر يبدو
       معطّلا بلا سبب، والرفض بتنبيه يقطع البناء — والحفظ يقول «ليست الآن». */
    if (picked.length >= MAX_BUILT_COURSES) {
      setDeferred((d) => (d.includes(id) ? d : [...d, id]));
      track("course_path_deferred", { course: id });
      return;
    }
    setPicked((p) => [...p, id]);
    setDeferred((d) => d.filter((x) => x !== id));
    track("course_path_added", { course: id, count: picked.length + 1 });
  };
  const remove = (id: string) => {
    /* الدورة التي فتح بها الصفحة لا تُحذف — هي عنوان الصفحة نفسها */
    if (id === anchor.id) return;
    setPicked((p) => p.filter((x) => x !== id));
  };

  /* الكود واحد لا اثنان: كود التشجيع أو كود فئة يُصدَر بعد التحقق. وكود الفئة
     لا يُتحقّق منه هنا — الواجهة لا تعرف الأكواد المُصدَرة، والفوترة تعرفها.
     فما نقوله صادق: نطبّق ما نعرفه، ونقول للباقي إنه يُراجَع عند الدفع. */
  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    if (isFirstTimePromo(code)) {
      setPromoApplied(code);
      setPromoError(false);
      track("promo_applied", { code });
      return;
    }
    setPromoApplied(null);
    setPromoError(true);
  };
  const promoPct = promoApplied ? FIRST_TIME_PROMO.percentOff : 0;
  const finalPayable = Math.round(pricing.payable * (1 - promoPct / 100));
  /* هل هناك ما يُفصَّل أصلا؟ بلا خصمِ بناءٍ ولا كود، «سعر الدورة» و«ما تدفعه»
     رقمٌ واحدٌ مكتوبٌ مرّتين — سطرٌ زائدٌ يُكبّر الصندوق ولا يُضيف علما. */
  const hasBreakdown = pricing.discountPct > 0 || promoPct > 0;
  /* نسبةُ الوفر مشتقّةٌ من الرقمين المعروضين لا من نسبةٍ ثالثة تُذكر: ما
     يُقرأ فوقها هو ما تُحسب منه، فلا تُخالف المشطوبَ الذي بجانبها. */
  const savedPct = pricing.allPriced && pricing.separate > 0 && finalPayable < pricing.separate
    ? Math.round((1 - finalPayable / pricing.separate) * 100)
    : 0;

  const start = (intent: Intent) => {
    if (user) setCheckout(intent);
    else setPending(intent);
  };

  const buy = () =>
    start({
      title:
        picked.length === 1
          ? `دورة «${anchor.name}»`
          : matchesPathway
            ? `مسار «${anchor.pathwayName}» كاملا (${picked.length} دورات)`
            : `مسارك المبني: ${name.trim() || `${picked.length} دورات`}`,
      amount: finalPayable,
      kind: picked.length === 1 ? "course" : matchesPathway ? "pathway" : "courses",
    });

  const saveDraft = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) return;
    setSaveState("saving");
    const ok = await savePathDraft({ name: trimmed, courseIds: picked });
    setSaveState(ok ? "saved" : "failed");
    if (ok) track("course_path_named", { count: picked.length });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-white">
      <SeoHead
        title={`ابنِ مسارك من «${anchor.name}»`}
        description={`ابدأ بدورة «${anchor.name}» وأضف إليها ما يكملها — وادفع ثمن ما اخترته وحده.`}
        path={`/build/${anchor.id}`}
      />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link to="/courses" className="flex items-center gap-2 text-white/70 hover:text-white">
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm font-medium">الدورات</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
            <span className="font-black">أكاديمية وجيز</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24 pt-8">
        {/* ترويسة: هذه دورة واحدة، وهي مسارك حتى الآن */}
        <div className="rounded-3xl border border-teal/30 bg-teal/[0.05] p-6 md:p-8">
          <span className="rounded-full border border-teal/40 bg-teal/10 px-3 py-1 text-[11px] font-bold text-teal-light-ink">
            {anchor.category}
          </span>
          <CourseTitle as="h1" name={anchor.name} termEn={anchor.termEn} className="mt-3 text-2xl font-black leading-snug md:text-3xl" termClassName="text-xs text-white/45" />
          <p className="mt-2 text-sm text-white/50">من مسار «{anchor.pathwayName}»</p>
          {full?.shortPromise && <p className="mt-4 leading-loose text-white/70">{full.shortPromise}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 font-bold text-white/70">
              <Clock3 className="h-3.5 w-3.5 text-teal-light-ink" /> {weeksLabel(anchor.weeks)}
            </span>
            {full && (
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 font-bold text-white/70" dir="ltr">
                {full.totalHours} ساعة
              </span>
            )}
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 font-bold text-white/70">
              <BookOpen className="h-3.5 w-3.5 text-teal-light-ink" /> {anchor.skill}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 font-bold text-white/70">
              <User className="h-3.5 w-3.5 text-teal-light-ink" /> {details.trainer.name}
            </span>
          </div>
        </div>

        {/* التفاصيل الكاملة — لا مقتطف: هذا ما كانت النافذة تخفيه */}
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {full?.description && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-sm font-black text-white/80">عن الدورة</h2>
              <p className="mt-2 text-sm leading-loose text-white/60">{full.description}</p>
            </div>
          )}
          {full?.targetAudience && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-sm font-black text-white/80">لمن هذه الدورة</h2>
              <p className="mt-2 text-sm leading-loose text-white/60">{full.targetAudience}</p>
              {full.prerequisites && (
                <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-white/45">
                  <span className="font-bold text-white/60">ما يُفترض أن تعرفه قبلها: </span>
                  {full.prerequisites}
                </p>
              )}
            </div>
          )}
        </section>

        {full && full.learningOutcomes.length > 0 && (
          <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="flex items-center gap-2 text-sm font-black text-white/80">
              <Target className="h-4 w-4 text-gold-ink" /> ما ستقدر عليه بعدها
            </h2>
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {full.learningOutcomes.map((o) => (
                <li key={o} className="flex items-start gap-2 text-sm leading-relaxed text-white/65">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-light-ink" />
                  {o}
                </li>
              ))}
            </ul>
          </section>
        )}

        {full && full.modules.length > 0 && (
          <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="flex items-center gap-2 text-sm font-black text-white/80">
              <ListChecks className="h-4 w-4 text-teal-light-ink" /> وحدات الدورة ({full.modules.length})
            </h2>
            <ol className="mt-3 space-y-2.5">
              {full.modules.map((m, i) => (
                <li key={m.id} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-teal/15 text-[11px] font-black text-teal-light-ink" dir="ltr">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-snug">{m.title}</span>
                    {m.outcome && <span className="mt-0.5 block text-xs leading-relaxed text-white/50">{m.outcome}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {full?.practicalProject && (
          <section className="mt-4 rounded-2xl border border-gold/30 bg-gold/[0.06] p-5">
            <h2 className="flex items-center gap-2 text-sm font-black text-gold-ink">
              <Target className="h-4 w-4" /> مشروعها العملي
            </h2>
            <p className="mt-2 text-sm leading-loose text-white/70">{full.practicalProject}</p>
          </section>
        )}

        {/* ══ مسارك حتى الآن ══

            كان هذا الصندوقُ ضِعفَ حجمه بلا سببٍ يخصّ القرار: حشوةٌ من ٢٤
            نقطة، وعنوانٌ بحجم عنوان الصفحة، و«سعر الدورة ١٢٥» فوق «ما تدفعه
            ١٢٥» — سطران لرقمٍ واحد. فصار الحجمُ يتبع المعلومة: التفصيلُ يظهر
            حين يكون هناك ما يُفصَّل (خصمُ بناءٍ أو كود)، ولا يُكرَّر الرقمُ
            نفسُه سطرين حين لا خصم. وحُشيَ مكانَ الفراغِ ما ينقص القرارَ فعلا:
            موعدُ الشعبة. */}
        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <h2 className="flex items-center gap-2 text-base font-black">
              <RouteIcon className="h-4 w-4 text-teal-light-ink" />
              مسارك حتى الآن
            </h2>
            {/* العدد والمدة والسقف في شارة واحدة: من يبني يحتاج أن يعرف أين هو
                من الحد قبل أن يصطدم به، لا بعد أن يُرفض اختياره. */}
            <span className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold ${
              pricing.atCap ? "border-gold/50 bg-gold/10 text-gold-ink" : "border-white/10 bg-white/[0.04] text-white/60"
            }`}>
              <span dir="ltr">{picked.length}</span> من <span dir="ltr">{MAX_BUILT_COURSES}</span> دورات
              {" · "}{weeksLabel(totalWeeks)}
              {pricing.atCap && " · بلغت الحد"}
            </span>
          </div>

          <ol className="mt-3.5 space-y-2">
            {pickedCourses.map((c, i) => {
              const options = cohorts.get(c.id) ?? [];
              const chosenCohort = cohortOf(c.id);
              return (
                <li key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-start justify-between gap-2.5">
                    <span className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-teal/15 text-[11px] font-black text-teal-light-ink" dir="ltr">
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-black leading-snug">{c.name}</span>
                        <span className="mt-0.5 block text-[10.5px] text-white/45">
                          {weeksLabel(c.weeks)} · من مسار «{c.pathwayName}»
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <CoursePriceTag amount={priceOf(c.id)} money={money} className="text-[13px] font-black text-white/85" />
                      {c.id !== anchor.id && (
                        <button
                          onClick={() => remove(c.id)}
                          aria-label={`احذف ${c.name} من مسارك`}
                          className="grid h-7 w-7 place-items-center rounded-lg text-white/35 transition hover:bg-white/5 hover:text-white/70"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  </div>
                  {/* الموعدُ في موضع القرار — لا في شاشةٍ تالية.

                      وهو ما طلبه صاحب المنصّة: «يختار الشعب المفتوحة للدورة
                      حسب التوفّر». والمعروضُ هنا هو المتاحُ فعلا: المصدرُ
                      يُسقط ما ليس `open`/`full` وما نفدت مقاعده وما لا سعر
                      له، فلا يُعرض موعدٌ لا يُشترى. والسعرُ في هذا السطر
                      سعرُ الشعبة المختارة — يتبدّل بتبدّلها. */}
                  <div className="mt-2 border-t border-white/[0.08] pt-2">
                    <CohortPicker
                      cohorts={options}
                      selectedId={chosenCohort?.id ?? null}
                      onSelect={(cohortId) => {
                        setCohortChoice((prev) => ({ ...prev, [c.id]: cohortId }));
                        track("cohort_chosen", { course: c.id });
                      }}
                      compact
                    />
                  </div>
                </li>
              );
            })}
          </ol>

          {/* السعر: التفصيلُ حين يكون ما يُفصَّل. المجموع قبل الخصم، ثم خصم
              البناء بنسبته وقيمته، ثم الكود إن كان، ثم ما يدفعه — وكلُّ سطر
              يقابل قرارا اتخذه المتعلم بنفسه. وبلا خصمٍ ولا كود يبقى رقمٌ
              واحد: تكرارُه سطرين كان يُكبّر الصندوق ولا يُضيف علما. */}
          <div className="mt-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
            {pricing.allPriced ? (
              <dl className="space-y-1 text-[12px]">
                {hasBreakdown && (
                  <>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-white/55">{picked.length === 1 ? "سعر الدورة" : `مجموع الـ${picked.length} دورات`}</dt>
                      <dd dir="ltr" className="font-bold text-white/80">{money(pricing.separate)}</dd>
                    </div>
                    {pricing.discountPct > 0 && (
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-teal-light-ink">خصم بناء المسار — {pricing.discountPct}٪</dt>
                        <dd dir="ltr" className="font-bold text-teal-light-ink">−{money(pricing.saving)}</dd>
                      </div>
                    )}
                    {promoPct > 0 && (
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-teal-light-ink">كود {promoApplied} — {promoPct}٪</dt>
                        <dd dir="ltr" className="font-bold text-teal-light-ink">−{money(pricing.payable - finalPayable)}</dd>
                      </div>
                    )}
                  </>
                )}
                <div className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5 ${
                  hasBreakdown ? "border-t border-white/10 pt-2.5" : ""
                }`}>
                  <dt className="text-[11px] text-white/50">
                    {hasBreakdown ? "ما تدفعه" : picked.length === 1 ? "سعر الدورة — ما تدفعه" : `مجموع الـ${picked.length} دورات`}
                  </dt>
                  <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span dir="ltr" className="text-[26px] font-black leading-none text-white">{money(finalPayable)}</span>
                    {/* المشطوبُ يُقرأ ونسبةُ الوفر بجانبه: كان `text-sm
                        text-white/35` فلا يُرى مقدارُ الوفر أصلا. */}
                    {savedPct > 0 && (
                      <>
                        <span dir="ltr" className="text-base font-bold text-white/45 line-through decoration-white/45 decoration-2">
                          {money(pricing.separate)}
                        </span>
                        <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-black text-teal-light-ink">
                          وفّرت {savedPct}٪
                        </span>
                      </>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              /* دورةٌ واحدة بلا شعبةٍ مسعَّرة تُبطل المجموع كله: مجموعُ ثلاثٍ
                 يُقرأ ثمنَ أربع. فلا رقم — ويُقال السبب. */
              <div className="space-y-1 text-[12px]">
                <p className="text-sm font-black text-white">
                  {pricesLoaded ? "يُعلن السعر مع فتح الشعبة" : "يُقرأ السعر…"}
                </p>
                <p className="text-[11px] leading-5 text-white/50">
                  {pricesLoaded && pricing.priced > 0
                    ? `${pricing.priced} من ${pricing.count} من دوراتك لها شعبة مسعَّرة، والباقي لم تُفتح شعبته بعد. ولا نعرض مجموعا ناقصا.`
                    : "نُسعّر كل شعبة على حدة، ولا نعرض رقما قبل أن يكون هو الرقم الذي تدفعه."}
                </p>
                {pricing.discountPct > 0 && (
                  <p className="text-[11px] font-bold text-teal-light-ink">
                    وخصم بناء المسار عند {pricing.count} دورات — {pricing.discountPct}٪ — قائمٌ لك حين تُفتح الشعب.
                  </p>
                )}
              </div>
            )}

            {/* كود الخصم — حقل مستقل بزر، لا يُطبَّق بالكتابة */}
            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="flex gap-2">
                <input
                  id="promo"
                  value={promoInput}
                  onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") applyPromo(); }}
                  placeholder={`كود الخصم — مثال ${FIRST_TIME_PROMO.code}`}
                  aria-label="كود الخصم"
                  dir="ltr"
                  maxLength={24}
                  className={`min-w-0 flex-1 rounded-xl border bg-white/[0.04] px-3 py-2 text-left text-[12px] tracking-widest placeholder:tracking-normal placeholder:text-white/25 focus:outline-none ${
                    promoApplied ? "border-teal-light text-teal-light-ink" : promoError ? "border-gold/60" : "border-white/15 focus:border-teal-light"
                  }`}
                />
                <Button
                  onClick={applyPromo}
                  variant="outline"
                  className="h-auto shrink-0 rounded-xl border-white/20 px-4 py-2 text-[12px] font-bold text-white/80"
                >
                  تطبيق
                </Button>
              </div>
              {promoApplied && (
                <p className="mt-1.5 text-[10.5px] font-bold text-teal-light-ink">طُبِّق خصم {promoPct}٪ {FIRST_TIME_PROMO.labelAr}.</p>
              )}
              {promoError && (
                <p className="mt-1.5 text-[10.5px] text-gold-ink">لم نتعرّف على هذا الكود. راجع كتابته، أو تحقّق من أهليتك لخصم فئة أدناه.</p>
              )}
              {/* الفئات من مصدر السياسة لا من نصٍّ مكتوب هنا: نسبةٌ تُذكر في
                  صفحة الشراء وتُخالف ما يُصدره الإداري كودا هي وعدٌ مكسور.
                  ومطويّة: من ليس منها لا يُشغل بها، ومن يظن نفسه منها يجدها.
                  والصياغةُ صياغةُ صفحة المسار نفسِها — سطرٌ واحدٌ يُنقر، لا
                  سؤالٌ ثمّ رابطٌ في سطرين. */}
              <details className="group mt-2">
                <summary className="cursor-pointer list-none text-[11px] font-bold text-white/60 underline underline-offset-4 transition group-hover:text-teal-light-ink [&::-webkit-details-marker]:hidden">
                  اطّلع على الفئات وتحقّق من أهليتك
                </summary>
                {/* خصمُ أوّل شراء أوّلَ القائمة وكودُه معلَنٌ بجانبه: لكلّ أحدٍ
                    في أوّل مرّة، فلا إثباتَ له ولا سرَّ فيه. */}
                <ul className="mt-2 space-y-1.5 border-r-2 border-white/10 ps-3">
                  <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5">
                    <span className="font-bold text-white/75">خصم أول عملية شراء — {FIRST_TIME_PROMO.percentOff}٪</span>
                    <code dir="ltr" className="rounded-md border border-gold/40 bg-gold/10 px-1.5 py-0.5 font-mono text-[10.5px] font-black text-gold-ink">
                      {FIRST_TIME_PROMO.code}
                    </code>
                    <span className="text-white/40">· بلا إثبات</span>
                  </li>
                  {DISCOUNT_CATEGORIES.map((cat) => (
                    <li key={cat.id} className="text-[11px] leading-5 text-white/50">
                      <span className="font-bold text-white/75">{cat.label_ar} — {cat.percentOff}٪</span>
                      <span className="text-white/40"> · {cat.evidence_ar}</span>
                    </li>
                  ))}
                </ul>
                {/* واتساب لا بريد.

                    التحقّقُ هنا يقوم على **مستندٍ يُرى**: هويّةٌ جامعيّة أو
                    بطاقةُ عملٍ أو هويّةٌ شخصيّة. وإرسالُ صورةٍ في واتساب فعلٌ
                    من ضغطتين على الهاتف — وهو حيث يقف المشتري — بينما مرفقُ
                    بريدٍ من الهاتف رحلةٌ يتركها أكثرُهم في منتصفها.

                    وواتساب المستشارين هو القناة الرسميّة المعتمدة أصلا
                    (`CONTACT.whatsapp` في data/stories.ts)، فلا قناةَ جديدة
                    تُفتح هنا بل تُستعمل القائمة. */}
                <p className="mt-2 text-[10.5px] leading-5 text-white/45">
                  <a
                    href={`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent("أرغب بالتحقق من أهليتي لخصم فئة — وسأرفق ما يثبت ذلك.")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-teal-light-ink underline underline-offset-4 transition hover:text-teal-ink"
                  >
                    راسلنا على واتساب بصورة الإثبات
                  </a>{" "}
                  لمعرفة الكود للطلبة وموظفي الحكومة.
                </p>
              </details>
            </div>

            <Button
              onClick={buy}
              className="mt-3.5 h-11 w-full rounded-full bg-gold px-6 text-[13px] font-black text-on-gold hover:bg-gold/90"
            >
              <CalendarDays className="ml-2 h-4 w-4" />
              {picked.length === 1 ? "اشترِ هذه الدورة" : `اشترِ (${picked.length} دورات)`}
            </Button>

            {/* التنبيه — بالكلفة الحقيقية للدورة الإضافية لا بسعرها المعلن */}
            {nudge && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[11px] font-semibold leading-5 text-gold-ink">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  دورة واحدة أخرى ترفع خصمك إلى {nudge.nextPct}٪: تصير الـ{nudge.nextCount} بـ<span dir="ltr">{money(nudge.nextPayable)}</span>.
                  {" "}أي أن الدورة الإضافية تكلّفك <span dir="ltr">{money(nudge.marginal)}</span> بدل <span dir="ltr">{money(nudge.listPrice)}</span>.
                </span>
              </p>
            )}

            {/* السقف — يُقال بسببه لا بمنعٍ صامت */}
            {pricing.atCap && (
              <p className="mt-2.5 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[11px] leading-5 text-white/60">
                <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-light-ink" />
                <span>
                  بلغتَ {MAX_BUILT_COURSES} دورات — وهو حدّ ما تبنيه بنفسك. ليس بخلا بل حمايةٌ لإنهائه:
                  خطةٌ تُنجَز خير من خطةٍ تُشترى. وما تختاره بعدها يُحفظ لمرحلتك التالية أدناه.
                </span>
              </p>
            )}

            {matchesPathway && (
              <p className="mt-2.5 flex items-start gap-2 text-[11px] leading-5 text-teal-light-ink">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  اخترت دورات مسار «{anchor.pathwayName}» كلها — فتأخذ شهادته كما هي.{" "}
                  <Link to={`/pathways/${matchesPathway}`} className="font-bold underline">
                    استعرض صفحته
                  </Link>
                </span>
              </p>
            )}
          </div>
        </section>
        {/* ══ مرحلتك التالية ══ — ما اختاره بعد السقف، محفوظا لا مرفوضا */}
        {deferred.length > 0 && (
          <section className="mt-6 rounded-3xl border border-dashed border-gold/40 bg-gold/[0.05] p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-base font-black text-gold-ink">
              <Save className="h-4.5 w-4.5" />
              مرحلتك التالية — محفوظة لك
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-white/50">
              اخترتها بعد بلوغ الحد، فحفظناها بدل رفضها. أنهِ مسارك الأول ثم ابنِ هذه — أو احذف واحدة من الخمس أعلاه وأدخِلها مكانها.
            </p>
            <ul className="mt-3.5 space-y-2">
              {deferred.map((id) => {
                const c = courseById(id);
                if (!c) return null;
                return (
                  <li key={id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                    <span className="min-w-0 text-sm font-bold leading-snug">{c.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <CoursePriceTag amount={priceOf(c.id)} money={money} className="text-xs font-black text-white/60" />
                      <button
                        onClick={() => setDeferred((d) => d.filter((x) => x !== id))}
                        aria-label={`أزل ${c.name} من مرحلتك التالية`}
                        className="grid h-8 w-8 place-items-center rounded-lg text-white/35 transition hover:bg-white/5 hover:text-white/70"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ══ ما يكمل مسارك ══ */}
        {suggestions.length > 0 && (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-base font-black">
              <Layers className="h-4 w-4 text-teal-light-ink" />
              ما يكمل مسارك
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-white/45">
              مرتّبة لا معروضة: تبدأ ببقية المسار الذي بدأت منه بترتيبه المصمَّم، ثم ما يبني على المهارة نفسها،
              ثم ما يوسّعها خارج مجالك. ولكل واحدة سببها مكتوبا.
            </p>
            <div className="mt-4 grid gap-2.5 md:grid-cols-2">
              {suggestions.map((s) => {
                const c = courseById(s.courseId);
                if (!c) return null;
                return (
                  <button
                    key={s.courseId}
                    onClick={() => add(s.courseId)}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-right transition hover:border-teal/50 hover:bg-teal/[0.06]"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-black leading-snug">{c.name}</span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-teal-light-ink">{s.reason_ar}</span>
                      <span className="mt-1 block text-[11px] text-white/40">{weeksLabel(c.weeks)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-2">
                      <CoursePriceTag amount={priceOf(c.id)} money={money} className="text-sm font-black text-white/85" />
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal/15 text-teal-light-ink">
                        <Plus className="h-4 w-4" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ══ سمِّ مسارك ══ */}
        {picked.length >= 2 && (
          <section className="mt-6 rounded-3xl border border-gold/30 bg-gold/[0.05] p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-base font-black text-gold-ink">
              <Save className="h-4 w-4" />
              سمِّ مسارك
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-white/65">
              أنت رتّبت هذه الدورات لحاجتك. سمِّها، ونحفظها عندنا — فقد تصير مسارا معتمدا لغيرك، وقد نعود إليك
              فيه. الاسم وقائمة دوراتك فقط، بلا شيء آخر.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setSaveState("idle"); }}
                maxLength={80}
                placeholder="مثال: مسار التفاوض والبيع للمستقلين"
                aria-label="اسم مسارك"
                className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-[13px] placeholder:text-white/30 focus:border-gold focus:outline-none"
              />
              <Button
                onClick={() => void saveDraft()}
                disabled={name.trim().length < 3 || saveState === "saving" || saveState === "saved"}
                variant="outline"
                className="h-11 rounded-xl border-gold/60 px-5 text-[13px] font-black text-gold-ink hover:bg-gold/10 disabled:opacity-40"
              >
                {saveState === "saving" ? "جارٍ الحفظ…" : saveState === "saved" ? "حُفظ — شكرا لك" : "احفظ اسمه"}
              </Button>
            </div>
            {saveState === "failed" && (
              <p className="mt-2 text-xs text-white/55">
                تعذّر الحفظ الآن — مسارك أمامك كما هو ويمكنك الشراء، وأعد المحاولة لاحقا.
              </p>
            )}
          </section>
        )}

        <p className="mt-8 text-center text-[11px] text-white/40">
          دفع آمن — يصلك تأكيد فوري على بريدك وتُفتح منصة الطالب الخاصة بك
        </p>
      </main>

      {/* التسجيل يُطلب لحظة الدفع لا قبله */}
      {pending && (
        <Modal onClose={() => setPending(null)} label="التسجيل قبل الدفع" panelClassName="w-full max-w-md">
          <div className="story-fade rounded-3xl border border-white/10 bg-surface p-6">
            <p className="mb-4 text-center text-sm leading-relaxed text-white/65">
              خطوة واحدة قبل الدفع: حساب يحفظ مسارك وشهاداتك.
            </p>
            <AuthGate
              onDone={() => {
                setUser(readUserName());
                setCheckout(pending);
                setPending(null);
              }}
              initialMode="signup"
              source="course_path_checkout"
            />
          </div>
        </Modal>
      )}

      {/* لوحُ الشراء — التسعيرُ والدفعُ حيث وقع القرار. والكودُ الذي كُتب هنا
          يُمرَّر إليه بدل أن يُعرض ثمّ يُنسى: كانت الواجهة تحسب خصمَه وتُظهره
          ولا ترسله للخادم أصلا، فيُعرض ولا يُخصم. */}
      {checkout && (
        <BuyPanel
          title={checkout.title}
          email={session?.email ?? ""}
          initialCoupon={promoApplied ?? ""}
          lines={picked.map((cid) => ({
            courseId: cid,
            name: courseById(cid)?.name ?? cid,
            /* الشعبةُ التي اختارها هنا تُحمل إلى اللوح: بلا حملها يعود اللوحُ
               إلى أقرب شعبةٍ فيُفوتَر بموعدٍ غير الذي اختاره ورأى سعرَه. */
            ...(cohortOf(cid) ? { cohortId: cohortOf(cid)!.id } : {}),
          }))}
          onClose={() => setCheckout(null)}
        />
      )}
    </div>
  );
}

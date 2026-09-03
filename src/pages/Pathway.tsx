import { useEffect, useMemo, useState } from "react";
import { safeGet, safeRemove } from "@/services/safe-storage";
import { Link, useParams } from "react-router";
import {
  ArrowRight,
  CalendarClock,
  Clock3,
  Route as RouteIcon,
  Sparkles,
  CheckCircle2,
  CalendarDays,
  User,
  UserCheck,
  MonitorPlay,
  Headphones,
  ClipboardCheck,
  FolderKanban,
  BadgeCheck,
  BarChart3,
  Briefcase,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AuthGate from "@/components/AuthGate";
import FavoriteButton from "@/components/FavoriteButton";
import ThemeToggle from "@/components/ThemeToggle";
import AdvisorContact from "@/components/AdvisorContact";
import BuyPanel from "@/components/BuyPanel";
import CourseJourney from "@/components/CourseJourney";
import Modal from "@/components/Modal";
import { pathwayById, pathwayCategory } from "@/data/pathways";
import { hasCoreCatalog } from "@/data/core-catalog-source";
import { readAdoptedPlan, saveAdoptedPlan, syncAdoptedPlan, PERSONAL_PLAN_NAME_AR } from "@/application/plan/adopted-plan";
import { FIRST_TIME_PROMO } from "@/application/commerce/first-time-promo";
import { useCoursePrices, formatCohortPrice, totalOf } from "@/services/cohort-prices";
import { courseById, courses, pathwaySupportCourses, readyPathwayCourseIds, pathwayDelivery, pathwayTrainers, courseTrainer, weeksLabel, MIN_PATHWAY_COURSES, MAX_PATHWAY_COURSES } from "@/data/courses";
import { track } from "@/services/analytics";
import { useRealSession } from "@/services/session";
import { usePublishedContent } from "@/services/public-content";
import SeoHead from "@/components/SeoHead";
import EcosystemNote from "@/components/EcosystemNote";
import { pathwayOffer, formatOfferPrice } from "@/application/commerce/pathway-offer";
import { needsAdvisorReferral } from "@/application/plan/advisor-referral";
import { DISCOUNT_CATEGORIES, MAX_CATEGORY_PCT } from "@/application/commerce/discount-policy";
import { CONTACT } from "@/data/stories";

/* اسم المستخدم — يدعم الصيغتين: JSON الجديدة والنص القديم، ويحترم انتهاء الجلسة */
function readUserName(): string | null {
  const raw = safeGet("wajeez_user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { name?: string; exp?: number };
    if (typeof parsed.exp === "number" && Date.now() > parsed.exp) {
      safeRemove("wajeez_user");
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
  const catalogVersion = usePublishedContent();
  const { id } = useParams();
  const pathway = pathwayById(id ?? "");
  const [user, setUser] = useState<string | null>(readUserName);
  /* الجلسةُ الحقيقيّة إلى جانب الاسم المحلّيّ: لوحُ الشراء يحتاج البريدَ ليطلب
     توثيقَه في موضعه، و`readUserName` يقرأ التخزين المحلّيّ وحدَه — وقد يخالف
     كعكةَ الخادم بعد خروجٍ من تبويبٍ آخر. */
  const { user: session } = useRealSession();
  /* يُقرأ مرّةً عند التركيب: sessionStorage ليس مصدرا تفاعليّا، وقراءتُه في
     كلّ تصيير تُقحم أثرا جانبيّا في جسم المكوّن. */
  const [advisorReferral] = useState(needsAdvisorReferral);
  const [checkout, setCheckout] = useState<CheckoutIntent | null>(null);
  /* نية شراء معلقة بانتظار تسجيل الدخول — التصفح مفتوح، والتسجيل يُطلب لحظة الدفع فقط */
  const [pendingCheckout, setPendingCheckout] = useState<CheckoutIntent | null>(null);
  const [syncing, setSyncing] = useState(false);
  /* رفضٌ برأيٍ لا بعطب: الخادمُ يمنع تبديل المسار بعد الشراء، فيُقال السببُ
     في لوح الشراء بدل أن تبقى الخطّةُ كما هي بلا كلمة. */
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
      /* الدائمُ أوّلا ثمّ الجلسة — والثانيةُ للتوافق مع تبويبٍ فُتح قبل النقل */
      const c = JSON.parse(safeGet("wajeez_diag_composite") ?? safeGet("wajeez_diag_composite", 'session') ?? "null");
      return c && typeof c.name_ar === "string" ? c as { template_id: string; name_ar: string } : null;
    } catch { return null; }
  }, [custom]);

  /* ─── تخصيص الخطّة على هذه الصفحة (المرحلة ٢) ───
     كان التخصيص في شاشة النتيجة وحدها، والصفحة عرضٌ فقط. صار هنا: يحذف
     ويستبدل ويضيف ويختار هديّته، ويُحفظ في الخطّة المعتمَدة نفسها لحظةَ كل
     تغيير — مصدرٌ واحد لا نسخةٌ ثانية تفترق عنه. */
  const [edits, setEdits] = useState<{ courseIds: string[]; giftId: string | null } | null>(null);
  const editable = Boolean(adopted);
  /* المسار الجاهز = أربعُ أساسيات + ثلاثُ مساندات. أمّا الخطّة المعتمَدة من
     التشخيص فتبقى كما اعتُمدت: هناك تُبنى من القياس لا من حزمةٍ جاهزة. */
  const courseIds = useMemo(
    () => edits?.courseIds ?? custom?.chosenIds ?? (pathway ? readyPathwayCourseIds(pathway.id) : []),
    [edits, custom, pathway],
  );
  /* أيّ المعروضات مساندة — للوسم في الرحلة. المساندة تبقى مساندةً حتّى بعد
     تخصيصٍ يحذف غيرها، فالوسم من الكتالوج لا من موضعها في القائمة. */
  const supportIds = useMemo(
    () => new Set((pathway ? pathwaySupportCourses[pathway.id] ?? [] : []).map((s) => s.courseId)),
    [pathway],
  );
  const supportReasons = useMemo(
    () => new Map((pathway ? pathwaySupportCourses[pathway.id] ?? [] : []).map((s) => [s.courseId, s.reasonAr])),
    [pathway],
  );
  /* الهديّة تكون دورةً من الخطّة نفسها لا سابعةً خارجها — سادسة المسار
     مجّانا افتراضا، وله أن يستبدلها بأخرى منه أو يلغيها. `??` كانت تُسقط
     «ألغيتُها» (giftId فارغ صراحة) لأن الفراغ يساوي غيابَ الاختيار في
     سلسلتها، فيعود الافتراضُ رغم إلغائه — لذا التحقّق من الحاوية لا القيمة. */
  const giftId = edits ? edits.giftId : custom ? custom.giftId : (courseIds.length > 0 ? courseIds[courseIds.length - 1] : null);
  const [swapForId, setSwapForId] = useState<string | null>(null);
  const [trainersOpen, setTrainersOpen] = useState(false);
  const [planNote, setPlanNote] = useState<string | null>(null);

  const commit = (ids: string[], gift: string | null) => {
    setEdits({ courseIds: ids, giftId: gift });
    if (adopted) saveAdoptedPlan({ ...adopted, courseIds: ids, giftId: gift });
  };

  /* بدائل ومقترحات: خارج المختار والهديّة، ومن مجال المسار أوّلا.

     ستٌّ لا ثمان. من حذف دورةً يبحث عن بديلٍ واحد، والقائمةُ الطويلة تحوّل
     قرارا واحدا إلى مسحِ ثماني عناوين — فيُغلق الصندوقَ ولا يستبدل شيئا.
     والإقصاءُ قائمٌ أصلا: ما في مساره وهديّتُه خارج القائمة، فلا يرى مكرَّرا. */
  const pool = useMemo(() => {
    const taken = new Set([...courseIds, ...(giftId ? [giftId] : [])]);
    return courses
      .filter((c) => !taken.has(c.id))
      .sort((x, y) => (y.pathwayId === pathway?.id ? 1 : 0) - (x.pathwayId === pathway?.id ? 1 : 0))
      .slice(0, 6)
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
  /* عرض الزائر — من أسعار قائمة الدورات المعروضة نفسها، لا من رقم مكتوب.
     والكتالوج يصل بعد أوّل رسم، فإعادة الحساب معلَّقة على إصداره. */
  const offer = useMemo(() => {
    void catalogVersion;
    return pathwayOffer(courseIds);
  }, [courseIds, catalogVersion]);

  const { prices, loaded: pricesLoaded } = useCoursePrices();
  /* سعرُ المسار كاملا — أو null إن نقص سعرُ دورةٍ واحدة، فلا مجموعَ ناقصا */
  const fullPrice = totalOf(courseIds, prices);
  /* السعر بعد خصم الباقة — نفس النسبة (`offer.bundleMaxPct`) التي يطبّقها
     الخادم فعلا عند الدفع (`cart-pricing.ts`)، فالرقمُ هنا هو ما يُدفع لا وعدٌ منفصل. */
  const discountedFullPrice = fullPrice
    ? { amount: Math.round(fullPrice.amount * (100 - offer.bundleMaxPct)) / 100, currency: fullPrice.currency }
    : null;

  /* المسار الذي اعتمده تشخيصه سابقا — إن وُجد */
  const diagTopId = useMemo(() => {
    try {
      return safeGet("wajeez_diag_top", 'session');
    } catch {
      return null;
    }
  }, []);

  /* نتيجة تشخيص مكتملة ومحفوظة على الجهاز (تبقى بعد إغلاق التبويب، بخلاف جلسة الصفحة) —
     وجودها يحوّل دعوة «لست متأكدا» إلى إعادة تخصيص المسار بدل إعادة التشخيص */
  const hasSavedResult = useMemo(() => {
    try {
      return !!safeGet("wajeez_diag_v2_last_full");
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

  /* اسمُ ما يُشترى — من الخطّة المعتمَدة لا من المسار المضيف.

     الخطّةُ المركّبة تُستضاف على صفحة أوّل مسارٍ رُكّبت منه، ودوراتُها من
     أكثر من مجال. وكان عنوانُ الشراء يُبنى من اسم المضيف وحده، فمن اشترى
     تركيبةً عابرةً لمجالين وصله إيصالٌ باسم أحدهما — والرأسُ فوقه يقول اسمَ
     خطّته (`adopted?.nameAr`). فالوعدُ يفترق عن الإيصال في الشاشة نفسها.
     والاسمُ هنا يتبع ما يقرؤه المتعلّم، فلا يفترقان. */
  const composedPlan = Boolean(adopted?.composed);
  const planNameAr = composedPlan
    ? (compositeCtx?.name_ar ?? adopted?.nameAr ?? PERSONAL_PLAN_NAME_AR)
    : pathway.name;
  const fullPlanTitleAr = composedPlan
    ? `خطّة «${planNameAr}» كاملة (${pathwayCoursesList.length} دورات)`
    : `مسار «${planNameAr}» كاملا (${pathwayCoursesList.length} دورات)`;
  const fromPlanAr = composedPlan ? `من خطّتك «${planNameAr}»` : `من مسار ${planNameAr}`;

  /* بدء الشراء: المسجّل تفتح له نافذة الدفع مباشرة — والزائر تظهر له بوابة التسجيل أولا ثم نكمل الدفع تلقائيا.

     والمسار كاملا استثناء (التوصيتان ٢ و٣): خطّته تُرفَع إلى الخادم ثم يُنقَل
     إلى «مساري» ليطلبها كلها بنداءٍ واحد. كان الزرّ يفتح نافذةً تحيله إلى
     «تصفّح الشعب المفتوحة» — أي يبدأ اختياره من الصفر في شاشةٍ لا تعرف أنّ
     له خطّة. فالخطّة التي بناها كانت تموت عند الزرّ. */
  const goToPlan = async (intent: CheckoutIntent) => {
    setSyncing(true);
    const sync = await syncAdoptedPlan({
      hostPathwayId: adopted?.hostPathwayId ?? pathway?.id ?? "",
      composed: adopted?.composed ?? false,
      nameAr: adopted?.nameAr ?? pathway?.name ?? "خطّتي",
      courseIds,
      giftId,
    });
    setSyncing(false);
    /* رفضُ الخادم لا يُبتلع — من حاول إسقاط دورةٍ دفع ثمنها يُقال له لماذا
       لم تتبدّل خطّته، لا أن يظنّها تبدّلت وهي لم تتبدّل. */
    setPlanNote(sync.reasonAr);
    /* الشراءُ قبل المنصّة لا بعدها.

       كان الزرّ ينقله إلى «مساري» ليطلب هناك — أي يخرج من الصفحة التي قرّر
       فيها إلى شاشةٍ أخرى يبدأ فيها من جديد. وقرارُ صاحب المنصّة: «اجعل
       عمليّة الشراء تتمّ قبل نقله لمنصّته، وبعد الدفع يذهب للمنصّة يرى ما
       دفع ويختار الشعب».

       ورفعُ الخطّة يبقى قبل اللوح لا بعده: الهديّةُ تُستحقّ بالخطّة
       المحفوظة على الخادم (`commerce.service.ts#giftFor`)، فلو فُتح اللوحُ
       قبل رفعها لسُعّرت الهديّةُ بثمنها. ولو تعذّر الرفعُ فُتح اللوح على كلّ
       حال: يشتري بلا هديّة خيرٌ من زرٍّ صامت. */
    setCheckout(intent);
  };

  const startCheckout = (intent: CheckoutIntent) => {
    if (!user) { setPendingCheckout(intent); return; }
    if (intent.kind === "pathway") { void goToPlan(intent); return; }
    setCheckout(intent);
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
          </div>

          {/* تأطيرُ الخطّة — يسبق رحلة الدورات فيقول: هذه خطّتُك لا صفحةُ كتالوج.

              كان الصندوقُ للمركّبة وحدَها، فالمسارُ الجاهز المعتمَد يصل بلا
              تأطير: اسمُ المسار الطويل من الكتالوج، وشارةٌ صغيرة، ثمّ قائمةُ
              دورات. فيُقرأ صفحةَ كتالوجٍ لا نتيجةَ تشخيصٍ اعتمدها صاحبُها —
              وهو ما وصفه صاحبُ المنصّة بأنّها «صفحةٌ قديمة، ليست كصفحة المسار
              الشخصي». والفرقُ لم يكن في الصفحة بل في أنّ إحدى الحالتين مؤطَّرة
              والأخرى عارية.

              فصار لكلٍّ صندوقُه: الذهبيُّ يشرح **لماذا تختلف** القائمةُ عن
              الكتالوج، والفيروزيُّ يقول **إنّها خطّةٌ تُملَك وتُعدَّل**. ولا
              يُقال في أيٍّ منهما ما لا نعرفه: الاعتمادُ واقعٌ (وإلّا لم يُعرض
              الصندوق)، والتعديلُ متاحٌ فعلا (`editable`)، والحفظُ فوريّ. */}
          {compositeCtx ? (
            <div className="story-fade mt-6 rounded-2xl border border-gold/40 bg-gold/[0.06] px-5 py-4">
              <p className="text-sm font-black text-gold-ink">خطتك المركبة: «{compositeCtx.name_ar}»</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                الدورات أدناه هي تركيبتك كما ركّبها تشخيصك من أكثر من مجال — تُدار وتُتابع عبر مسار «{pathway.name}» المضيف.
              </p>
            </div>
          ) : custom ? (
            <div className="story-fade mt-6 rounded-2xl border border-teal-light/40 bg-teal/[0.07] px-5 py-4">
              <p className="flex items-center gap-1.5 text-sm font-black text-teal-light-ink">
                <Sparkles className="h-4 w-4 shrink-0" />
                خطّتك من مؤشر وجيز
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                هذه ليست صفحة كتالوج — بل الخطّة التي رشّحها تشخيصك واعتمدتها أنت.
                والدورات أدناه لك: تستبدل وتحذف وتختار هديّتك، ويُحفظ التغيير فور وقوعه.
              </p>
            </div>
          ) : null}

          {/* «ماذا ستحقق من خلال خطتك؟» — رحلة الدورات بأكورديون، بلا قائمة مكررة فوقها */}
          <CourseJourney
            courseIds={pathwayCoursesList.map((c) => c.id)}
            delivery={pathwayDelivery(pathway.id)}
            headingLevel="h2"
            showSchedule
            giftId={giftId}
            supportReasons={Object.fromEntries([...supportReasons].filter(([id]) => supportIds.has(id)))}
            edit={
              editable
                ? {
                    giftId,
                    swapForId,
                    pool,
                    /* الرقمُ من عرض المسار نفسِه (pathwayOffer) لا من ثابتٍ
                       مكتوب: سلّمُ المسار الجاهز غير سلّم البناء الحرّ. */
                    addReason: `دورات مسارك تُشترى معا بخصم يصل إلى ${offer.bundleMaxPct}٪ — والدورة وحدها بسعرها كاملا.`,
                    minReached: courseIds.length <= MIN_PATHWAY_COURSES,
                    maxReached: courseIds.length >= MAX_PATHWAY_COURSES,
                    onSwapToggle: setSwapForId,
                    onSwapPick: (oldId, newId) => {
                      /* الهديّةُ صفةُ مكانٍ لا معرّف: من استبدل الدورة المجانية
                         تبقى بديلتُها هي المجانية — لا فراغا يترك «هديّة» تُشير
                         إلى دورةٍ لم تعد في الخطّة. */
                      commit(courseIds.map((i) => (i === oldId ? newId : i)), giftId === oldId ? newId : giftId);
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

          {/* مشروع التخرّج — سطرٌ في ختام الرحلة يشبه «شهادة إتمام»، لا صندوقا
              قائما بذاته. وهو ليس دورةً ولا ساعةً في الحساب: مهمّةٌ إضافية
              على واقع المتعلّم يقدّمها بعد الدورات إن أرادها. */}
          {pathway.output && (
            <section className="story-fade mt-6 flex items-start gap-3">
              <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold text-xs font-black text-on-gold">
                <Trophy className="h-4 w-4" />
              </span>
              <div className="pt-1">
                <p className="text-sm font-black text-gold-ink">
                  مشروع التخرّج <span className="font-bold text-white/40">— إضافيّ، خارج دورات المسار</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-white/60">{pathway.output}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                  لا يُحتسب دورةً ولا ساعةً في المسار ولا في سعره. تبنيه على واقع عملك بعد الدورات
                  وتقدّمه للمراجعة إن أردت شهادةً موثّقة بمخرَج.
                </p>
              </div>
            </section>
          )}

          {/* أنواع المصادر المرافقة حُذفت — كانت مكررة مع صندوق «منظومة كاملة» أدناه */}

          {/* الفريق التدريبي — خلف التسجيل، وسطرٌ يفتح نافذةً لا صندوقٌ ثابت.

              قرار صاحب المنصّة: الزائر يرى المسار ودوراته كاملةً، ويبقى شيئان
              وراء الباب: من يدرّبه، وأين يدفع.

              و`id` هنا لأنّ الصفحة تنتقل إليه لحظة اكتمال التسجيل: أوّل ما
              كان مخفيّا هو أوّل ما يُقرأ. */}
          {user && (
            <p id="trainers-reveal" className="story-fade mt-8 scroll-mt-24 text-center text-xs text-white/50">
              كل دورة يقدّمها المدرّب الأعمق في موضوعها —{" "}
              <button
                type="button"
                onClick={() => setTrainersOpen(true)}
                className="cursor-pointer font-bold text-teal-light-ink underline underline-offset-4 transition hover:text-teal-light"
              >
                تعرّف على مدرّبي هذا المسار
              </button>
            </p>
          )}

          {trainersOpen && (
            <Modal onClose={() => setTrainersOpen(false)} label={`الفريق التدريبي لمسار ${pathway.name}`} panelClassName="w-full max-w-md">
              <div className="story-fade rounded-3xl border border-white/10 bg-surface p-6">
                <h3 className="flex items-center gap-2 text-base font-black">
                  <User className="h-4 w-4 text-teal-light-ink" />
                  الفريق التدريبي لهذا المسار
                </h3>
                <div className="mt-4 space-y-2">
                  {pathwayTrainers(pathway.id).map((t) => (
                    <div key={t.role} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm">
                      <User className="h-4 w-4 shrink-0 text-teal-light-ink" />
                      <span className="font-bold text-white/85">{t.role}</span>
                      <span className="text-teal-light-ink">{t.name}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-white/40">
                  كل دورة يقدمها المدرب الأعمق في موضوعها — وينسّقون معا حتى تتكامل المهارات لا أن تتكرر. تُعلن الأسماء بعد اعتماد الشعبة رسميا.
                </p>
              </div>
            </Modal>
          )}

          {/* شارة «هذا المسار اعتمده تشخيصك» حُذفت.

              كانت تقول للمتعلّم إنّ هذا مساره، وتعرض زرّا يعيده إلى نتيجة
              التشخيص «لإعادة التخصيص». وكلاهما لا يخدمه: هو يعلم من أين جاء،
              والتخصيص كلّه متاح في هذه الصفحة نفسها — يستبدل ويحذف ويضيف
              ويختار هديّته في رحلة الدورات أعلاه. فإعادته إلى صفحةٍ سابقة
              لينال ما بين يديه خطوةٌ تُضيع لا تُفيد. */}

          {/* تقريره الشخصي — لم يعد هنا. كان يُعرض للمتعلّم نفسِه من إجاباتٍ
              تبقى على جهازه (session storage) فلا يراه مستشارُه أبدا. صار
              في ملفّه الذي يفتحه مستشارُه من بوابته (`LearnerPanel.tsx`) —
              مبنيّا من نتيجة تشخيصه المرفقة بحسابه فعلا، لا نصّا يزول بإغلاق
              التبويب. */}

          {/* عرض الزائر — يقوم مقام قسم الشراء قبل التسجيل.

              لا يخفي شيئا عن المتصفّح: المسار ودوراته ومخرجاتها كلّها فوق هذا
              مكشوفة. وهذا القسم يقول له بصراحة ما وراء الباب — المدرّبون
              ومكان الدفع — ويضع أمامه الرقم قبل أن يطلب منه شيئا: من كم تبدأ
              الدورة، وكم يكسب في أوّل شراء، وكم يكسب إن أخذ المسار كاملا.

              والأرقام كلّها من مصدرٍ واحد (pathway-offer.ts) تقرؤه الفاتورة
              نفسها — فما يقرؤه هنا هو ما يُطالَب به هناك. وحين لا سعر لدورةٍ
              بعد، لا يُختلق رقم: يُقال إنّ السعر يُعلن مع فتح الشعبة. */}
          {/* إحالة المستشار — قبل بوّابة الشراء لا بعدها.

              حين تنخفض ثقة المحرّك، أو يطلب المتعلّم استشارة، كانت الدعوة
              تُعرض في شاشة النتيجة. وقد زالت تلك الشاشة: التشخيص ينتقل الآن
              إلى هنا مباشرةً. فلو لم تنتقل الدعوة معها لدفع مَن كان ينبغي
              أن يُستشار — وهذا أسوأ من صفحةٍ زائدة.

              وموضعها فوق العرض مقصود: تُقرأ قبل السعر لا بعده. */}
          {advisorReferral && (
            <div className="story-fade mt-10 rounded-3xl border border-gold/40 bg-gold/5 p-6 md:p-8">
              <h2 className="flex items-center gap-2 text-lg font-black text-gold-ink">
                <UserCheck className="h-5 w-5 shrink-0" />
                حالتك تستحق جلسة مع مستشار بشري
              </h2>
              <p className="mt-3 text-sm leading-loose text-white/70">
                تشخيصك لم يعطنا يقينا كافيا بأنّ هذا المسار هو الأنسب لك — أو أنّك
                طلبتَ استشارة. جلسةٌ تعريفيّة (٣٠ دقيقة) تصوغ خطّتك بدقّة، وتشخيصُك
                يجعلها أقصر وأعمق. ولا تدفع شيئا قبلها.
              </p>
              <AdvisorContact
                text="مرحبا، أكملت مؤشر وجيز وأخبرني أن حالتي تستحق جلسة مع مستشار بشري — أريد حجز الجلسة التعريفية."
                label="احجز جلسة مستشار عبر واتساب"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold/60 px-5 py-2.5 text-sm font-bold text-gold-ink transition hover:bg-gold/10"
              />
            </div>
          )}

          {!user && (
            <div id="offer" className="story-fade mt-10 scroll-mt-24 overflow-hidden rounded-3xl border border-teal/40 bg-gradient-to-br from-teal/[0.14] via-white/[0.04] to-gold/[0.08]">
              <div className="p-6 md:p-8">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/15 px-3 py-1 text-[11px] font-black text-gold-ink">
                  <Sparkles className="h-3.5 w-3.5" />
                  خطوة واحدة تفصلك عن البدء
                </span>
                <h2 className="mt-4 text-2xl font-black leading-snug md:text-3xl">
                  سجّل بالطريقة التي تناسبك
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
                  حسابك المجاني يفتح لك شيئين في هذه الصفحة: <span className="font-bold text-teal-light-ink">من يدرّبك</span> —
                  أسماء فريق المسار وتخصّصاتهم — و<span className="font-bold text-teal-light-ink">مكان الدفع</span>،
                  فتختار دورةً أو المسار كاملا وتدفع مباشرة. والتسجيل لا يُلزمك بشراء.
                </p>

                {/* الأرقام الثلاثة — أكبر ما في البطاقة، لأنها ما يقرّر */}
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/12 bg-black/30 p-4">
                    <p className="text-[11px] font-bold text-white/50">تبدأ الدورة من</p>
                    <p className="mt-1 text-2xl font-black tabular-nums text-white">
                      {offer.fromPrice !== null ? formatOfferPrice(offer.fromPrice, offer.currency) : "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-4 text-white/45">
                      {offer.fromPrice !== null ? "أرخص دورة في هذا المسار" : "يُعلن السعر مع فتح الشعبة"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gold/35 bg-gold/[0.08] p-4">
                    <p className="text-[11px] font-bold text-gold-ink/80">أول عملية شراء</p>
                    <p className="mt-1 text-2xl font-black tabular-nums text-gold-ink">{offer.firstTimePct}٪ خصم</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-white/45">يُخصم عند الدفع بكود يظهر لك</p>
                  </div>
                  <div className="rounded-2xl border border-teal/40 bg-teal/[0.10] p-4">
                    <p className="text-[11px] font-bold text-teal-light-ink/80">المسار كاملا</p>
                    <p className="mt-1 text-2xl font-black tabular-nums text-teal-light-ink">
                      يصل إلى {offer.bundleMaxPct}٪
                    </p>
                    <p className="mt-0.5 text-[11px] leading-4 text-white/45">كلما زادت دوراتك ارتفع خصمك</p>
                  </div>
                </div>

                <button
                  onClick={() => { track("offer_signup_clicked", { pathway: pathway.id }); setPendingCheckout({ title: `مسار «${pathway.name}»`, amount: 0, kind: "pathway" }); }}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-teal px-6 py-3.5 text-sm font-black text-on-teal transition hover:brightness-110 sm:w-auto"
                >
                  أنشئ حسابك المجاني الآن
                  <ArrowRight className="h-4 w-4" />
                </button>
                <p className="mt-2.5 text-[11px] text-white/45">
                  بالبريد أو بحساب لينكدإن · دقيقة واحدة · ولا نطلب بطاقتك عند التسجيل
                </p>
              </div>
            </div>
          )}

          {/* مقارنة الشراء: دورة واحدة أم المسار كاملا — تصميم هادئ يريح القرار.
              خلف التسجيل: مكان الدفع هو الشيء الثاني الذي يكسبه بالتسجيل. */}
          {user && (
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
                      المسار كاملا أوفر: خصمُ الباقة يرتفع كلّما زادت دوراتك، ويشمل التشخيص والمتابعة.
                    </p>
                  )}
                  <Button
                    onClick={() =>
                      startCheckout({
                        title:
                          picked.length === 1
                            ? `دورة «${picked[0].name}» ${fromPlanAr}`
                            : `${picked.length} دورات مختارة ${fromPlanAr}`,
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
                        ? "اشترِ هذه الدورة"
                        : `اشترِ (${picked.length} دورات)`}
                  </Button>
                </div>
                {/* المسار كاملا */}
                <div className="relative flex flex-col rounded-2xl border border-gold/30 bg-white/[0.03] p-4">
                  <span className="absolute left-3 top-3 rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-black text-gold-ink">الأوفر</span>
                  <p className="font-black text-sm">المسار كاملا</p>
                  <p className="mt-1 text-xs text-white/50">كل الدورات + التشخيص الكامل + المنظومة الست أدناه</p>
                  {/* السعرُ كاملا لا «تبدأ من» — والرقمُ المعروض بعد خصم الباقة
                      فعلا (`offer.bundleMaxPct`)، لا وعدٌ منفصلٌ عن الفاتورة:
                      الأصليُّ يظهر مشطوبا بجانبه لا نسبةً مجردة. هديّةُ المسار
                      تُقال أعلاه في خطّة الدورات لا هنا مرّتين. */}
                  {fullPrice && discountedFullPrice ? (
                    <>
                      <div className="mt-4 flex flex-wrap items-end gap-2">
                        <span dir="ltr" className="text-2xl font-black text-white">{formatCohortPrice(discountedFullPrice)}</span>
                        {offer.bundleMaxPct > 0 && (
                          <span dir="ltr" className="text-sm font-bold text-white/35 line-through">{formatCohortPrice(fullPrice)}</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-white/40">
                        {courseIds.length} دورات بعد خصم الباقة ({offer.bundleMaxPct}٪) — وهو ما تُصدره الفاتورة
                      </p>
                      <p className="mt-2 text-xs text-gold-ink">
                        و<span className="font-black">{FIRST_TIME_PROMO.percentOff}%</span> إضافية لأوّل عملية شراء بالكود{" "}
                        <span dir="ltr" className="font-mono font-black">{FIRST_TIME_PROMO.code}</span>
                      </p>
                      {/* خصمُ الفئة — نفس مطويّة صفحة شراء الدورة المفردة،
                          فالوعدُ واحد أينما ظهر. */}
                      <details className="group mt-2.5">
                        <summary className="cursor-pointer list-none text-[11px] leading-relaxed text-white/40 [&::-webkit-details-marker]:hidden">
                          هل قد تكون مؤهلا لخصم فئة (حتى {MAX_CATEGORY_PCT}٪)؟{" "}
                          <span className="font-bold text-white/60 underline underline-offset-4 transition group-hover:text-teal-light-ink">
                            اطّلع على الفئات وتحقّق من أهليتك
                          </span>
                        </summary>
                        <ul className="mt-2.5 space-y-1.5 border-r-2 border-white/10 pe-0 ps-3">
                          {DISCOUNT_CATEGORIES.map((cat) => (
                            <li key={cat.id} className="text-[11px] leading-relaxed text-white/50">
                              <span className="font-bold text-white/75">{cat.label_ar} — {cat.percentOff}٪</span>
                              <span className="text-white/40"> · {cat.evidence_ar}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2.5 text-[11px] leading-relaxed text-white/40">
                          الكود لا يُنشر: يُصدَر لك وحدك بعد التحقق، فلا يتسرّب خصم فئةٍ إلى من ليس منها.{" "}
                          <a
                            href={`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent("أرغب بالتحقق من أهليتي لخصم فئة — وسأرفق ما يثبت ذلك.")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-white/60 underline underline-offset-4 transition hover:text-teal-light-ink"
                          >
                            راسلنا على واتساب بصورة الإثبات
                          </a>
                        </p>
                      </details>
                      <p className="mt-2 text-[11px] text-white/45">
                        الرقم أعلاه لهذه الدورات — ويتغيّر إن غيّرتها.
                      </p>
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
                    </div>
                  )}
                  <Button
                    onClick={() => startCheckout({ title: fullPlanTitleAr, amount: 0, kind: "pathway" })}
                    disabled={syncing}
                    className="mt-4 h-11 rounded-full bg-gold font-black text-on-gold hover:bg-gold/90 disabled:opacity-60"
                  >
                    <CalendarDays className="ml-2 h-4 w-4" />
                    {syncing ? "نحفظ خطّتك…" : "اشترِ المسار كاملا"}
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
              {/* كان النصّ «طلبك يُراجَع، ثم تصلك فاتورتك» — وهو ما كان يقع فعلا
                  يوم كان الشراء طلبا. وقد صار الدفعُ مباشرا، فيصف النصُّ ما
                  يقع الآن: تُختار الشعبة، ويُدفع، ثمّ تُفتح المنصّة. */}
              <p className="mt-4 text-center text-[11px] text-white/40">تدفع الآن، ثم تُفتح منصّتك على ما اشتريت وتختار مواعيدك</p>
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

          {/* حُذف زرّ «ابدأ الآن لنسختك القادمة».

              كان يشير إلى `#buy`، و`#buy` مخفيٌّ عمّن لم يسجّل — فالزائر يضغط
              زرّا ذهبيّا بعرض الصفحة فلا يحدث شيء. وهذا أسوأ من غياب الزرّ:
              الزرّ الذي لا يستجيب يقول للزائر إنّ الموقع معطوب.

              ولمن سجّل لم يكن يضيف شيئا: بوّابة الدفع فوقه في الصفحة نفسها،
              وقد قرأها قبل أن يصل إلى هنا. فالحذف يُنهي الصفحة على ما يفيد
              — لا على دعوةٍ مكرّرة. */}

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
            message="تصفح المسار مفتوح للجميع — التسجيل يفتح لك فريق المسار ومكان الدفع، ويحفظ مشترياتك."
            source="checkout_gate"
            onDone={() => {
              setUser(readUserName());
              const intent = pendingCheckout;
              setPendingCheckout(null);
              /* من ضغط «أنشئ حسابك» من العرض لم يختر شيئا بعد: لا نُقحمه في
                 دفعٍ لم يطلبه، بل نأخذه إلى أوّل ما كان مخفيّا عنه — الفريق
                 التدريبي — ليقرأه ثمّ يهبط إلى الشراء بنفسه. والانتقال بعد
                 رسمةٍ واحدة كي يكون العنصر قد ظهر في الشجرة. */
              if (intent?.kind === "pathway" && intent.amount === 0) {
                requestAnimationFrame(() => {
                  document.getElementById("trainers-reveal")?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
                return;
              }
              /* «التسجيل ← الخطّة المعتمَدة ← الطلب» بلا خطوةٍ ضائعة بينها */
              if (intent?.kind === "pathway") void goToPlan(intent);
              else setCheckout(intent);
            }}
          />
        </Modal>
      )}

      {/* لوحُ الشراء — التسعيرُ والدفعُ في مكان القرار، لا طلبٌ يُراجَع */}
      {checkout && (
        <BuyPanel
          title={checkout.title}
          email={session?.email ?? ""}
          note={planNote}
          lines={(checkout.courseIds ?? courseIds)
            .map((cid) => ({ courseId: cid, name: courseById(cid)?.name ?? cid }))}
          onClose={() => setCheckout(null)}
        />
      )}

    </div>
  );
}

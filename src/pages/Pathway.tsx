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
  ClipboardCheck,
  FolderKanban,
  BadgeCheck,
  Briefcase,
} from "lucide-react";
import { PATHWAY_ONLY_PERKS } from "@/data/pathway-perks";
import { FIRST_TIME_PROMO } from "@/application/commerce/first-time-promo";
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
import { useCoursePrices, formatCohortPrice, totalOf } from "@/services/cohort-prices";
import { courseById, courses, pathwaySupportCourses, readyPathwayCourseIds, pathwayDelivery, pathwayTrainers, courseTrainer, weeksLabel, MIN_PATHWAY_COURSES, MAX_PATHWAY_COURSES } from "@/data/courses";
import { track } from "@/services/analytics";
import { useRealSession } from "@/services/session";
import { usePublishedContent } from "@/services/public-content";
import SeoHead from "@/components/SeoHead";
import EcosystemNote from "@/components/EcosystemNote";
import { UpcomingTermLine } from "@/components/UpcomingTermNote";
import { pathwayOffer, readyPathwayPrice } from "@/application/commerce/pathway-offer";
import { needsAdvisorReferral } from "@/application/plan/advisor-referral";
import { DISCOUNT_CATEGORIES } from "@/application/commerce/discount-policy";
import { CONTACT } from "@/data/stories";

import Button from "@/components/ui/Button";
import { Card, Inset, Panel } from "@/components/ui/Surface";
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

  /* الهديّةُ تُطرح قبل السلّم — وكانت لا تُطرح هنا.

     الخادمُ يفي بالهديّة فعلا (`cart.service.ts#giftFor`): بندُها بصفر،
     والسلّمُ على المدفوع وحدَه. وكانت هذه الشاشةُ تضرب **مجموعَ الستّ**
     في نسبة الباقة — فتعرض على مسارٍ نموذجيّ ٦١٨ والفاتورةُ تُصدر ٥٢٠.

     والخطأُ في جهة «أكثر»: نطلب على الشاشة أغلى ممّا نأخذ. فلا شكوى تصل —
     ولذلك بقي. لكنّه يبيع عرضَنا بأضعفَ ممّا هو، ويجعل السطرَ الذي تحته
     («وهو ما تُصدره الفاتورة») غيرَ صحيح. */
  const pathPrice = readyPathwayPrice(courseIds, giftId, (id) => prices.get(id) ?? null);
  const discountedFullPrice = pathPrice ? { amount: pathPrice.payable, currency: pathPrice.currency } : null;
  /* النسبةُ المعروضةُ تُشتقّ من الرقمين لا تُعلَن قبلهما: هي وفرُ الهديّة
     والسلّم والسقف مجتمعةً، وأكبرُ من نسبة السلّم وحدَها. */
  const savedPct = pathPrice?.savedPct ?? 0;

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
        <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-ground text-muted-foreground">
          <p className="text-sm">يُحضر المسار…</p>
        </div>
      );
    }
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper text-foreground">
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
    /* النتيجةُ لا تُقرأ: رفضٌ محتملٌ كان يُقال في لوح الشراء (قرارٌ نُقض
       بصريح طلب صاحب المنصّة — لا حاجز يعترض شاشة الدفع بجملةٍ تقنية)،
       ورفعُ الخطّة يبقى لأثره لا لرسالته: تُستحقّ الهديّةُ بالخطّة المحفوظة
       على الخادم (`commerce.service.ts#giftFor`) بصرف النظر عمّا يُقال هنا. */
    await syncAdoptedPlan({
      hostPathwayId: adopted?.hostPathwayId ?? pathway?.id ?? "",
      composed: adopted?.composed ?? false,
      nameAr: adopted?.nameAr ?? pathway?.name ?? "خطّتي",
      courseIds,
      giftId,
    });
    setSyncing(false);
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
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <SeoHead
        title={pathway.name}
        description={`${pathway.transformation} — مسار ${pathway.level} من ${weeksLabel(pathway.durationWeeks)} في أكاديمية وجيز.`}
        path={`/pathways/${pathway.id}`}
      />
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:text-foreground">
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm font-medium">الرئيسية</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
            <span className="font-black">أكاديمية وجيز</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-4 w-4" /> {user}
              </span>
            ) : (
              <Inset as={Link} tone="accent" interactive to="/auth" className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:border-teal/50 hover:text-teal-light-ink">
                <User className="h-3.5 w-3.5" />
                دخول
              </Inset>
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
              <Badge variant="outline" className="border-white/20 text-foreground">{pathway.level}</Badge>
              {custom && !compositeCtx && <Badge className="border border-teal-light/50 bg-teal/15 text-teal-light-ink">نسختك المخصصة</Badge>}
              {compositeCtx && <Badge className="border border-gold/60 bg-gold/15 text-gold-ink">خطة مركبة مخصصة</Badge>}
              <FavoriteButton pathwayId={pathway.id} pathwayName={pathway.name} className="ms-auto" />
            </div>
            {/* اسم الخطّة كما اعتُمدت — لا اسم المسار المضيف. استعارةُ اسمه هي
                ما جعل المتعلّم يظنّ أن خطّته أُعيدت تسميتها. */}
            <h1 className="mt-4 text-3xl font-black leading-snug md:text-4xl">{adopted?.nameAr ?? pathway.name}</h1>
            <p className="mt-4 max-w-2xl leading-loose text-foreground">{pathway.transformation}</p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-foreground">
                <CalendarClock className="h-3.5 w-3.5 text-teal-light-ink" />
                {custom ? `${weeksLabel(totalWeeks)} (مخصصة)` : weeksLabel(pathway.durationWeeks)}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-foreground">
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
            <Card tone="warn" className="story-fade mt-6 px-5 py-4">
              <p className="text-sm font-black text-gold-ink">خطتك المركبة: «{compositeCtx.name_ar}»</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                الدورات أدناه هي تركيبتك كما ركّبها تشخيصك من أكثر من مجال — تُدار وتُتابع عبر مسار «{pathway.name}» المضيف.
              </p>
            </Card>
          ) : custom ? (
            <Card tone="accent" className="story-fade mt-6 border-teal-light/40 px-5 py-4">
              <p className="flex items-center gap-1.5 text-sm font-black text-teal-light-ink">
                <Sparkles className="h-4 w-4 shrink-0" />
                خطّتك من مؤشر وجيز
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                هذه ليست صفحة كتالوج — بل الخطّة التي رشّحها تشخيصك واعتمدتها أنت.
                والدورات أدناه لك: تستبدل وتحذف وتختار هديّتك، ويُحفظ التغيير فور وقوعه.
              </p>
            </Card>
          ) : null}

          {/* «ماذا ستحقق من خلال خطتك؟» — رحلة الدورات بأكورديون، بلا قائمة مكررة فوقها */}
          <CourseJourney
            courseIds={pathwayCoursesList.map((c) => c.id)}
            delivery={pathwayDelivery(pathway.id)}
            headingLevel="h2"
            showSchedule
            giftId={giftId}
            graduationProjectAr={pathway.output}
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

          {/* مشروع التخرّج انتقل إلى داخل «ماذا ستحقق من خلال خطتك؟» نفسها —
              سطرٌ أخير في رحلة الدورات (CourseJourney عبر graduationProjectAr)،
              لا صندوقٌ منفصلٌ خارج بطاقتها. */}

          {/* أنواع المصادر المرافقة حُذفت — كانت مكررة مع صندوق «منظومة كاملة» أدناه */}

          {/* الفريق التدريبي — سطرٌ يفتح نافذةً لا صندوقٌ ثابت.

              قرار صاحب المنصّة: الزائر يرى كل ما يراه المسجَّل — المسار
              ودوراته وفريقه التدريبي ومكان الدفع، بلا حاجزٍ سوى لحظة إتمام
              الشراء نفسها. كان هذا السطر خلف تسجيلٍ كامل، وقد سقط الحاجز. */}
          <p id="trainers-reveal" className="story-fade mt-8 scroll-mt-24 text-center text-xs text-muted-foreground">
            كل دورة يقدّمها المدرّب الأعمق في موضوعها —{" "}
            <button
              type="button"
              onClick={() => setTrainersOpen(true)}
              className="cursor-pointer font-bold text-teal-light-ink underline underline-offset-4 transition hover:text-teal-light"
            >
              تعرّف على مدرّبي هذا المسار
            </button>
          </p>

          {trainersOpen && (
            <Modal onClose={() => setTrainersOpen(false)} label={`الفريق التدريبي لمسار ${pathway.name}`} panelClassName="w-full max-w-md">
              <Inset className="story-fade bg-surface">
                <h3 className="flex items-center gap-2 text-base font-black">
                  <User className="h-4 w-4 text-teal-light-ink" />
                  الفريق التدريبي لهذا المسار
                </h3>
                <div className="mt-4 space-y-2">
                  {pathwayTrainers(pathway.id).map((t) => (
                    <Inset key={t.role} className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm">
                      <User className="h-4 w-4 shrink-0 text-teal-light-ink" />
                      <span className="font-bold text-foreground">{t.role}</span>
                      <span className="text-teal-light-ink">{t.name}</span>
                    </Inset>
                  ))}
                </div>
                <p className="mt-4 text-fine leading-relaxed text-muted-foreground">
                  كل دورة يقدمها المدرب الأعمق في موضوعها — وينسّقون معا حتى تتكامل المهارات لا أن تتكرر. تُعلن الأسماء بعد اعتماد الشعبة رسميا.
                </p>
              </Inset>
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

          {/* إحالة المستشار — قبل بوّابة الشراء لا بعدها.

              حين تنخفض ثقة المحرّك، أو يطلب المتعلّم استشارة، كانت الدعوة
              تُعرض في شاشة النتيجة. وقد زالت تلك الشاشة: التشخيص ينتقل الآن
              إلى هنا مباشرةً. فلو لم تنتقل الدعوة معها لدفع مَن كان ينبغي
              أن يُستشار — وهذا أسوأ من صفحةٍ زائدة.

              وموضعها فوق العرض مقصود: تُقرأ قبل السعر لا بعده. */}
          {advisorReferral && (
            <Panel tone="warn" className="story-fade mt-10 md:p-8">
              <h2 className="flex items-center gap-2 text-lg font-black text-gold-ink">
                <UserCheck className="h-5 w-5 shrink-0" />
                حالتك تستحق جلسة مع مستشار بشري
              </h2>
              <p className="mt-3 text-sm leading-loose text-foreground">
                تشخيصك لم يعطنا يقينا كافيا بأنّ هذا المسار هو الأنسب لك — أو أنّك
                طلبتَ استشارة. جلسةٌ تعريفيّة (٣٠ دقيقة) تصوغ خطّتك بدقّة، وتشخيصُك
                يجعلها أقصر وأعمق. ولا تدفع شيئا قبلها.
              </p>
              <AdvisorContact
                text="مرحبا، أكملت مؤشر وجيز وأخبرني أن حالتي تستحق جلسة مع مستشار بشري — أريد حجز الجلسة التعريفية."
                label="احجز جلسة مستشار عبر واتساب"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold/60 px-5 py-2.5 text-sm font-bold text-gold-ink transition hover:bg-gold/10"
              />
            </Panel>
          )}

          {/* مقارنة الشراء: دورة واحدة أم المسار كاملا — مكشوفة للجميع.

              كانت خلف تسجيلٍ كامل بحجّة أنها «مكان الدفع». وقرار صاحب
              المنصّة: لا داعي لذلك — يرى الزائر ما يراه المسجَّل تماما،
              والتسجيل يُطلب فقط لحظة إتمام الشراء فعلا (بوّابة
              `pendingCheckout` أسفل الصفحة). */}
          {/* لوحُ الشراء — مضغوطٌ بقصد.

              كان صندوقا في صندوقٍ في صندوق: حشوُ ٣٢ بكسلا خارجا، وعشرين في
              كلّ بطاقة، وثلاثةَ عشرَ سطرا في المسار الكامل وحده — فيملأ
              الشاشةَ ولا يُقرأ منه القرار. والقرارُ سطران: كم تدفع، وماذا
              تأخذ. فالحشوُ نصفُه، والسعرُ أكبرُ ما فيه، وما عداه يخدمه. */}
          <Panel id="buy" className="story-fade mt-10 scroll-mt-20 sm:p-5">
              <h3 className="text-base font-black">اختر طريقة شرائك</h3>
              <p className="mt-1 text-fine text-muted-foreground">قارن بهدوء — والقرار لك.</p>
              <div className="mt-4 grid gap-3.5 md:grid-cols-2">
                {/* دورة أو أكثر — اختيار حر */}
                <Inset className="flex flex-col">
                  <p className="text-sm font-black">دورة أو أكثر من المسار</p>
                  <p className="mt-0.5 text-fine text-muted-foreground">اختر ما تحتاجه — ورسومك مجموعها فقط</p>
                  <div className="mt-3 space-y-1.5">
                    {buyableCourses.map((c) => {
                      const on = pickedIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => togglePick(c.id)}
                          aria-pressed={on}
                          className={`flex w-full items-center justify-between gap-2.5 rounded-xl border px-3 py-2.5 text-right transition ${
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
                            <span className="min-w-0">
                              <span className="block text-xs font-bold leading-snug">{c.name}</span>
                              <span className="text-fine text-muted-foreground">
                                {c.weeks} {c.weeks === 1 ? "أسبوع" : "أسابيع"} · {courseTrainer(c).name}
                              </span>
                            </span>
                          </span>
                          {/* سعر الدورة من شعبتها لا من تقدير — وبلا شعبة لا رقم */}
                          <span className="shrink-0 text-sm font-black text-foreground">
                            {prices.get(c.id) ? (
                              <span dir="ltr">{formatCohortPrice(prices.get(c.id)!)}</span>
                            ) : (
                              <span className="text-fine font-bold text-muted-foreground">مع الشعبة</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* المجموع الحي والتلميح الذكي */}
                  {picked.length > 0 && (
                    <Inset className="mt-3 flex items-end justify-between gap-2 px-3.5 py-2.5">
                      <span className="text-fine text-muted-foreground">
                        اخترت {picked.length === 1 ? "دورة" : `${picked.length} دورات`} من {buyableCourses.length}
                      </span>
                      {pickedTotal ? (
                        <span dir="ltr" className="text-xl font-black text-foreground">{formatCohortPrice(pickedTotal)}</span>
                      ) : (
                        <span className="text-fine text-muted-foreground">يُعلن السعر مع الشعبة</span>
                      )}
                    </Inset>
                  )}
                  {picked.length > 0 && (
                    /* التنبيه بلا مقارنةٍ رقمية: المقارنة القديمة كانت بين رقمين
                       مُختلَقين، فكانت تنصح بناءً على ما لا يُدفع. */
                    <Inset as="p" tone="warn" className="mt-2 px-3.5 py-2 text-fine font-semibold leading-5 text-gold-ink">
                      المسار كاملا أوفر — خصمُه {offer.bundleMaxPct}٪، ويشمل التشخيص والمتابعة.
                    </Inset>
                  )}
                  <Button tone="confirm"
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
                    className="mt-3 h-10 rounded-full border-teal/60 bg-transparent text-sm font-black text-teal-light-ink hover:bg-teal/10 hover:text-teal-light-ink disabled:opacity-40"
                  >
                    {picked.length === 0
                      ? "اختر دورة واحدة على الأقل"
                      : picked.length === 1
                        ? "اشترِ هذه الدورة"
                        : `اشترِ (${picked.length} دورات)`}
                  </Button>
                </Inset>
                {/* المسار كاملا */}
                <Card tone="warn" className="relative flex flex-col">
                  <span className="absolute left-3 top-3.5 rounded-full bg-gold/20 px-2 py-0.5 text-fine font-black text-gold-ink">الأوفر</span>
                  <p className="text-sm font-black">المسار كاملا</p>
                  <p className="mt-0.5 text-fine text-muted-foreground">كل الدورات + التشخيص + المنظومة أدناه</p>
                  {/* السعرُ كاملا لا «تبدأ من» — والرقمُ المعروض بعد خصم الباقة
                      فعلا (`offer.bundleMaxPct`)، لا وعدٌ منفصلٌ عن الفاتورة:
                      الأصليُّ يظهر مشطوبا بجانبه لا نسبةً مجردة. هديّةُ المسار
                      تُقال أعلاه في خطّة الدورات لا هنا مرّتين. */}
                  {fullPrice && discountedFullPrice ? (
                    <>
                      {/* المشطوبُ كان `text-sm text-muted-foreground`: رقمٌ باهتٌ صغير لا
                          يُقرأ، فلا يُعرف مقدارُ الوفر أصلا. والوفرُ نصفُ العرض،
                          فيكبر ويُشار إليه بنسبته في شارةٍ بجانبه. */}
                      <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <span dir="ltr" className="text-[26px] font-black leading-none text-foreground">{formatCohortPrice(discountedFullPrice)}</span>
                        {savedPct > 0 && (
                          <>
                            <span dir="ltr" className="text-base font-bold text-muted-foreground line-through decoration-white/45 decoration-2">
                              {formatCohortPrice(fullPrice)}
                            </span>
                            <span className="rounded-full bg-teal/15 px-2 py-0.5 text-fine font-black text-teal-light-ink">
                              وفّرت {savedPct}٪
                            </span>
                          </>
                        )}
                      </div>
                      <p className="mt-1.5 text-fine leading-5 text-muted-foreground">
                        {courseIds.length} دورات — وهو ما تُصدره الفاتورة، ويتغيّر إن غيّرت الدورات.
                      </p>
                      {/* خصمُ الفئة — نفس مطويّة صفحة شراء الدورة المفردة،
                          فالوعدُ واحد أينما ظهر. النسبةُ تُقال داخل المطويّة
                          مع كلّ فئة، لا مكرَّرةً في سطر الدعوة نفسِه. */}
                      <details className="group mt-2.5">
                        <summary className="cursor-pointer list-none text-fine font-bold text-muted-foreground underline underline-offset-4 transition group-hover:text-teal-light-ink [&::-webkit-details-marker]:hidden">
                          اطّلع على الفئات وتحقّق من أهليتك
                        </summary>
                        {/* خصمُ أوّل شراء في القائمة نفسِها وكودُه بجانبه: هو
                            لكلّ أحدٍ في أوّل مرّة فلا إثباتَ له ولا سرَّ فيه —
                            وإخفاؤه في صندوقٍ ثانٍ يطلب بريدا كان يخفي عرضا
                            مفتوحا. وكودا الفئتين وحدهما يُصدَران بعد التحقّق. */}
                        <ul className="mt-2 space-y-1.5 border-r-2 border-white/10 ps-3">
                          <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fine leading-5">
                            <span className="font-bold text-foreground">خصم أول عملية شراء — {FIRST_TIME_PROMO.percentOff}٪</span>
                            <code dir="ltr" className="rounded-md border border-gold/40 bg-gold/10 px-1.5 py-0.5 font-mono text-fine font-black text-gold-ink">
                              {FIRST_TIME_PROMO.code}
                            </code>
                            <span className="text-muted-foreground">· بلا إثبات</span>
                          </li>
                          {DISCOUNT_CATEGORIES.map((cat) => (
                            <li key={cat.id} className="text-fine leading-5 text-muted-foreground">
                              <span className="font-bold text-foreground">{cat.label_ar} — {cat.percentOff}٪</span>
                              <span className="text-muted-foreground"> · {cat.evidence_ar}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-fine leading-5 text-muted-foreground">
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
                    </>
                  ) : (
                    /* لا شعبة مسعَّرة: لا رقم. رقمٌ لا تسنده شعبة هو الذي جعل
                       الوعد يفترق عن الفاتورة. */
                    <div className="mt-4 space-y-1.5 text-xs">
                      <p className="text-sm font-black text-foreground">
                        {pricesLoaded ? "يُعلن السعر مع فتح الشعبة" : "يُقرأ السعر…"}
                      </p>
                      <p className="text-muted-foreground">
                        نُسعّر كل شعبة على حدة، ولا نعرض رقما قبل أن يكون هو الرقم الذي تدفعه.
                      </p>
                      {/* والسعرُ يبقى مجهولا، أمّا الموعدُ فلا: «مع فتح الشعبة» متى؟
                          — هذا هو الجواب (البند ٥٢). */}
                      {pricesLoaded && (
                        <p className="text-fine font-bold leading-5 text-foreground">
                          <UpcomingTermLine />
                        </p>
                      )}
                    </div>
                  )}
                  <Button tone="confirm"
                    onClick={() => startCheckout({ title: fullPlanTitleAr, amount: 0, kind: "pathway" })}
                    disabled={syncing}
                    className="mt-3.5 h-10 rounded-full bg-gold text-sm font-black text-on-gold hover:bg-gold/90 disabled:opacity-60"
                  >
                    <CalendarDays className="ml-1.5 h-3.5 w-3.5" />
                    {syncing ? "نحفظ خطّتك…" : "اشترِ المسار كاملا"}
                  </Button>
                  {/* كان أسفل الزر فراغ في صندوق أطول من محتواه. وثلاثة من عناصر
                      «المنظومة» التسعة أدناه هي في الحقيقة فرق بين شراء دورة وشراء
                      مسار — لا تُعطى لمن يشتري دورة واحدة — فمكانها هنا لا في قائمة
                      عامة أسفل الصفحة. بقيت ستة هناك. */}
                  {/* ثلاثةُ عناوينَ بلا فقرةٍ تحت كلٍّ: الوصفُ كان يطوّل البطاقةَ
                      ثلاثةَ أسطرٍ ولا يُقرأ — والعنوانُ يقول ما يكفي، وتفصيلُه
                      في «المنظومة» أسفل الصفحة لمن أراد. */}
                  <ul className="mt-3.5 space-y-1.5 border-t border-white/10 pt-3">
                    {PATHWAY_ONLY_PERKS.map((perk) => (
                      <li key={perk.t} className="flex items-center gap-2">
                        <perk.icon className="h-3.5 w-3.5 shrink-0 text-gold-ink" />
                        <span className="text-fine font-bold leading-5 text-foreground">{perk.t}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              {/* كان النصّ «طلبك يُراجَع، ثم تصلك فاتورتك» — وهو ما كان يقع فعلا
                  يوم كان الشراء طلبا. وقد صار الدفعُ مباشرا، فيصف النصُّ ما
                  يقع الآن: تُختار الشعبة، ويُدفع، ثمّ تُفتح المنصّة. */}
              <p className="mt-3.5 text-center text-fine text-muted-foreground">تدفع الآن، ثم تُفتح منصّتك على ما اشتريت</p>
              {/* الدعوة إلى التشخيص سطر عند لحظة القرار، لا شريطا مؤطّرا في وسط
                  الصفحة. صفحة المسار الجاهز صفحة منتج معروضة للجميع، وكل صندوق
                  يعترضها يقرأ كأنه نتيجة شخصية لزائر لم يتشخّص أصلا. */}
              {diagTopId !== pathway.id && (
                <p className="mt-2 text-center text-fine leading-relaxed text-muted-foreground">
                  {hasSavedResult ? "نتيجتك محفوظة — " : "لست متأكدا أنه الأنسب لك؟ "}
                  <Link to="/diagnostic" className="font-bold text-muted-foreground underline underline-offset-4 transition hover:text-[#6EC7D1]">
                    {hasSavedResult ? "عد إليها وأعد تخصيص مسارك" : "ثلاث دقائق مع مؤشر وجيز"}
                  </Link>
                </p>
              )}
          </Panel>

          {/* ما ستحصل عليه مع المسار — من عروض أكاديمية وجيز (نسخة مضغوطة: خانات أصغر ومتقاربة) */}
          <Panel className="story-fade mt-8 md:p-6">
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
                <Inset key={b.t} className="flex items-start gap-2.5 p-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#38A7B4]/15">
                    <b.icon className="h-3.5 w-3.5 text-[#6EC7D1]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black leading-snug">{b.t}</p>
                    <p className="mt-0.5 text-fine leading-relaxed text-muted-foreground">{b.d}</p>
                  </div>
                </Inset>
              ))}
            </div>
          </Panel>

          {/* حُذف زرّ «ابدأ الآن لنسختك القادمة».

              كان يشير إلى `#buy`، وكان `#buy` وقتها خلف تسجيلٍ لم يكتمل بعد
              فوق الصفحة — فالزائر يضغط زرّا ذهبيّا بعرض الصفحة ولا يحدث
              شيء. وهذا أسوأ من غياب الزرّ: الزرّ الذي لا يستجيب يقول للزائر
              إنّ الموقع معطوب. (`#buy` نفسه صار ظاهرا للجميع لاحقا؛ الزرّ
              يبقى محذوفا لأن بوّابة الشراء أعلى الصفحة أصلا، فلا يضيف شيئا.) */}

          {/* المستشار سطرٌ لمن يحتاجه، لا صندوقٌ يُشجَّع عليه الجميع.

              كان بطاقةً بعرض الصفحة: دائرةُ حرفٍ كبيرة، واسمُ شخصٍ بخط عريض،
              ولقبٌ يقول «مستشارك المخصص لهذا المسار»، وزرٌّ أخضر بحجم زر الشراء.
              وفيها عيبان: الأول أن دور المستشار في هذا المنتج استثناء لا قاعدة —
              التشخيص يحسم، والمستشار لمن لم يحسم له. والثاني أن الأسماء
              (ADVISORS) بيانات ثابتة في الكود لا أشخاصٌ موثّقون، فعرضها كأنها
              فريقٌ قائم ادّعاء — وهو ما تمنعه قاعدةُ «لا اسم يُعرض كحقيقة قبل
              توثيقه». فبقي الباب مفتوحا وسقط الادّعاء: قناة الاتصال نفسها، بلا
              اسم ولا صورة ولا إلحاح. */}
          <p className="story-fade mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            ما زلت مترددا؟{" "}
            <AdvisorContact
              text={advisorMsg}
              label="راسل مستشار وجيز قبل الدفع"
              /* شذرة فارغة لا null: التوقيع يسقط عند null إلى أيقونة افتراضية،
                 وهذه دعوةٌ داخل جملة لا زرّ — أيقونةٌ فيها ضجيج. */
              icon={<></>}
              className="font-bold text-muted-foreground underline underline-offset-4 transition hover:text-[#6EC7D1]"
            />
          </p>

          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
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
            message="تصفح المسار مفتوح للجميع بلا تسجيل — والتسجيل هنا فقط لإتمام شرائك وربطه بحسابك."
            source="checkout_gate"
            onDone={() => {
              setUser(readUserName());
              const intent = pendingCheckout;
              setPendingCheckout(null);
              /* «التسجيل ← الخطّة المعتمَدة ← الطلب» بلا خطوةٍ ضائعة بينها.
                 كل نيّةٍ هنا حقيقية — لا نيّة عرضٍ وهميّة (amount:0) تحتاج
                 مسلكا خاصّا، فالزرّ الذي كان يرسلها حُذف مع صندوق الزائر. */
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
          kind={checkout.kind}
          lines={(checkout.courseIds ?? courseIds)
            .map((cid) => ({ courseId: cid, name: courseById(cid)?.name ?? cid }))}
          onClose={() => setCheckout(null)}
        />
      )}

    </div>
  );
}

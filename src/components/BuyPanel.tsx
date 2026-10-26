/* لوحُ الشراء — من قرار الشراء إلى صفحة الدفع، بلا طلبٍ ولا انتظارِ أحد.

   كان هنا `EnrollRequest`: نافذةٌ تقول «الدفع الإلكتروني لم يُفتح بعد»
   وتحيل إلى نموذج تواصل. وقرارُ صاحب المنصّة: «الدفع يكون مباشرة وليس بطلب
   التسجيل — يختار الدورات أو المسار ويدفع مباشرة بوضع الخصم أو الكود…
   واجعل عمليّة الشراء تتمّ **قبل** نقله لمنصّته».

   وأربعةُ قراراتٍ في بنية هذا اللوح، لكلٍّ سببُه:

   ١) **الرقمُ من الخادم لا من المتصفّح.** كلُّ ما يُعرض هنا — المجموع وخصمُ
      الباقة والكوبون — يأتي من `/api/learner/checkout/quote`، وهو
      يناديفي الخادم `priceCart` نفسَها التي يناديها `checkout`. فلا حسابَ
      هنا يُقارَن بحسابٍ هناك: المعروضُ هو المُصدَر بنيةً.

   ٢) **أوّلُ شعبةٍ متاحة تُختار تلقائيا.** «وتكون تلقائيا أوّل شعبة متاحة
      إلّا إذا قرّر أن يغيّرها». فلا يُطالَب المشتري باختيارٍ قبل أن يعرف
      سعرَه — والقائمةُ مرتّبةٌ بالأقرب بدءا، فأوّلُها أقربُها.

   ٣) **ما لا يُشترى يُسمَّى لا يُسقَط صامتا.** ما لا شعبةَ له مفتوحةً
      يُرشَّح هنا (فهذه الشاشةُ تعرف الكتالوج)، وما يملكه المشتري أو حُجز
      مقعدُه فيه يقوله `quote.excluded` — فهو وحده يعرفه.

      وكان `quote` «كلَّ شيءٍ أو لا شيء» كـ`checkout`: يرمي عند أوّل دورةٍ
      يملكها المشتري، فمن اشترى دورةً من مسارٍ رباعيّ يرى رسالةَ خطأٍ وزرَّ
      دفعٍ مطفأً ولا سبيلَ له إلى الثلاث الباقية. فصار يُسعّر ما يُشترى
      ويسمّي ما استُبعد وسببَه. و`checkout` يبقى صارما — وإليه لا يُرسَل
      إلّا ما سعّره الخادمُ نفسُه (`quote.items`)، فلا فاتورةَ بغير ما
      ضُغط عليه.

   ٤) **لا يُعاد هنا ما قيل في الصفحة قبله.** كانت كتلةُ «ومجّانا لك الآن»
      تُعرض في هذا اللوح وهي قائمةٌ في صفحة المسار خلفَه. وقرارُ صاحب المنصّة
      (١٨ سبتمبر ٢٠٢٦): «لا داعي لوجودها بعد أن ينقر على دفع — لا أريد أن
      أشتّته لكي يقوم بإتمام الدفع كاملا، وهي موجودةٌ في الصفحة التي قبلها».
      فما بعد النقر على الشراء غرضُه إتمامُه، وسطرٌ مجّانيٌّ يُنقر فيُغادر
      خصمٌ منه لا زيادة.

      ويبقى `PATHWAY_ONLY_PERKS` فوقَه: ذاك تأكيدُ ما يشتريه لا صرفٌ عنه.

   ولا نقول «تمّ الدفع» عند التحويل: التسويةُ بـwebhook موقَّع، ورجوعُ
   المتصفّح ليس دليلا. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BookOpen, CalendarDays, ChevronDown, CreditCard, Info, Loader2, Route as RouteIcon, Tag, TriangleAlert } from "lucide-react";
import Modal from "@/components/Modal";
import { couponFieldCls } from "@/components/FormKit";
import RegistrationClosedNotice from "@/components/RegistrationClosedNotice";
import LiveSessionDates from "@/components/LiveSessionDates";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { apiPost, ApiError } from "@/services/api";
import { readReferral } from "@/application/commerce/referral";
import { clearPendingCheckout } from "@/services/pending-checkout";
import { useCourseCohorts, type CohortOption } from "@/services/cohort-prices";
import { useMySessions } from "@/services/my-sessions";
import { clashWarnAr, clashesOf, freeAlternative, type TimedCohort } from "@/application/learning/cohort-overlap";
import { GRANT_ERROR_CODES, MEMBER_GRANT_NAME_AR } from "@/application/commerce/grant";
import { PATHWAY_ONLY_PERKS } from "@/data/pathway-perks";
import {
  PRESENTMENT_CODES, PRESENTMENT_CURRENCIES, convertFromUsd, formatPresentment,
  type PresentmentCurrency,
} from "@/application/commerce/presentment";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { buildDiscountPct } from "@/application/commerce/discount-policy";
import { track } from "@/services/analytics";

import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
export interface BuyLine {
  courseId: string;
  name: string;
  /** الشعبةُ التي اختارها في الصفحة قبل أن يفتح اللوح — تُحترم لا تُدهَس.
      وبلا هذا الحقل كان اللوحُ يعيد الاختيارَ إلى أقرب شعبةٍ دائما، فمن
      اختار موعدا ثانيا في صفحة الدورة يُفوتَر بالأوّل. */
  cohortId?: string;
}

interface QuoteItem {
  cohortId: string;
  courseId: string;
  titleAr: string;
  listPrice: number;
  unitPrice: number;
  isGift: boolean;
  /** أوقع عليها الكود؟ — كودُ المدرّب على دوراته وحدَها */
  couponApplies?: boolean;
}

/* ═══ خطأُ الكود لا يُسقط السعر (٢٧ سبتمبر ٢٠٢٦) ═══

   كان كلُّ خطأٍ في التسعير يمحو اللوحَ كلَّه: كودٌ غيرُ صالحٍ فلا سعرَ ولا
   زرَّ دفع، والمشتري يبحث عن السبب. ومع كود المدرّب صار للكود أسبابُ ردٍّ
   مفهومة (لدوراتِ مدرّبٍ ليست في سلّتك · استعملتَه من قبل)، فيُقال السببُ تحت
   خانته ويُسعَّر الطلبُ بلا كود — والقرارُ للمشتري. */
const COUPON_ERRORS: ReadonlySet<string> = new Set(["bad_coupon", "code_used", "code_not_applicable", "code_unavailable", ...GRANT_ERROR_CODES]);

/** ما استبعده الخادمُ من السلّة وسببُه — نصُّ السبب منه لا مُلفَّقٌ هنا */
interface ExcludedLine {
  cohortId: string;
  courseId: string;
  titleAr: string;
  reason: string;
  messageAr: string;
}

interface Quote {
  currency: string;
  couponCode: string | null;
  excluded: ExcludedLine[];
  subtotal: number;
  listTotal: number;
  bundlePct: number;
  bundleDiscount: number;
  capDiscount: number;
  /** خصمُ إكمال الخطّة — ما فاته من خصمها في دفعاتٍ سابقة (١٢ أكتوبر ٢٠٢٦) */
  planCredit: number;
  couponDiscount: number;
  /** نسبةُ منحة أعضاء وجيز إن كان الكودُ كودَها — وهي بدلُ خصم الباقة (٢٠ أكتوبر ٢٠٢٦) */
  grantPct: number | null;
  /** واسمُ حملتها — «منحة وجيز» أو «منحة مؤثرين وجيز» (٢٦ أكتوبر ٢٠٢٦) */
  grantNameAr?: string | null;
  discount: number;
  total: number;
  items: QuoteItem[];
}

interface CheckoutResult { orderId: string }
interface PayResult { redirectUrl?: string }

/* الكسرُ خانتان أو لا شيء — «402.5 USD» لا يُقرأ مبلغا. ونظيرتُها في
   `cohort-prices.ts` لنفس السبب. */
const money = (n: number, c: string) =>
  `${n.toLocaleString("en-US", Number.isInteger(n) ? undefined : { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;

/* شارةٌ قصيرةٌ لسبب الاستبعاد — والنصُّ الكاملُ من الخادم يُعرض تحتها */
const REASON_AR: Record<string, string> = {
  already_enrolled: "مسجّل فيها",
  settling: "دفعت — بانتظار التأكيد",
  order_pending: "طلب لم يكتمل دفعه",
  capacity_full: "لا مقاعد",
  closed: "التسجيل مغلق",
  no_price: "بلا سعر معلن",
  /* ومن نافذة الفصل وخطّة المدرّب (٣ج) — والنصُّ الكاملُ من الخادم تحتها */
  not_yet: "لم يفتح التسجيل",
  awaiting_plan: "تفتح باعتماد خطّتها",
  /* وشعبةٌ لا مدرّبَ معتمَدٌ لها لا تُعرض ولا تُباع (١٢ أكتوبر ٢٠٢٦) — وتبلغ اللوحَ
     من خطّةٍ أو رابطٍ قديم، فيُقال سببُها لا «غير متاحة» */
  no_trainer: "بلا مدرّب بعد",
  late_closed: "أغلق الالتحاق",
};

export default function BuyPanel({
  title,
  lines,
  email,
  initialCoupon = "",
  kind,
  grantPayTotal,
  onClose,
}: {
  title: string;
  lines: BuyLine[];
  /** بريدُ المشتري — للشريط حين لا يكون موثَّقا */
  email: string;
  /** كودٌ كتبه في الصفحة قبل أن يفتح اللوح — يُحمل معه لا يُنسى */
  initialCoupon?: string;
  /** شراءُ مسارٍ كاملٍ يُقال بصريح العبارة أعلى القائمة — لا فرقُه سعرٌ فقط.
      الأسعارُ رآها المشتري قبل أن يصل هنا (صفحة المسار)، فلا تتكرر هنا. */
  kind?: "pathway" | "course" | "courses";
  /** ما يدفعه بعد المنحة كما قالته صفحة المنحة — يفتح تفصيلَ الحساب، ويقول ما يصير إليه المبلغ إن لم يُكتب الكود.
      قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «هنا يجب أن يكون تفصيلُ كم كانت الدورة، وبعد المنحة» */
  grantPayTotal?: number;
  onClose: () => void;
}) {
  const { cohorts, loaded } = useCourseCohorts();

  /* بابُ الموسم — يُقرأ قبل النقر ويُصدَّق بعده.

     الخادمُ هو الحارس، وهذا يجنّب المشتريَ أن يختار موعدا وعملةً ثمّ يُردّ.
     و`serverClosed` لما لا تعرفه القدراتُ المحمَّلة: تبويبٌ فُتح قبل الإغلاق،
     أو نداءُ `/api/config` تعذّر — فتأتي الجملةُ من الردّ نفسِه. */
  const { registration } = usePlatformConfig();
  const [serverClosed, setServerClosed] = useState<string | null>(null);
  const closedAr = serverClosed ?? (registration.open ? null : registration.messageAr);

  /* الشعبةُ المختارة لكلّ دورة — أوّلُ المتاح افتراضا، ويبدّلها من شاء */
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [coupon, setCoupon] = useState(initialCoupon);
  const [applied, setApplied] = useState(initialCoupon);
  const [currency, setCurrency] = useState<PresentmentCurrency>("USD");
  /* ــ مبدّلُ العملة يُطوى حتّى يُطلَب (البند ٦٠) ــ

     كان ثلاثةَ أزرارٍ ظاهرةً **لكلّ مشترٍ** فوق السعر بلا عنوان، فيقرؤها من
     لا شأنَ له بها قرارا رابعا في صفحةٍ فيها ثلاثةُ قرارات. والحسابُ كلُّه
     بالدولار، والدولارُ هو الافتراض — فمن أراد غيرَه طلبه، ومن لم يُرد لم
     يرَ شيئا. والعنوانُ يُقال حين يُفتح: «بأيّ عملةٍ تُقتطع بطاقتُك؟» */
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => { track("buy_panel_opened", { courses: lines.length }); }, [lines.length]);

  /* الدوراتُ التي لها شعبٌ يُختار منها، وما لا شعبةَ له بعد.

     وهذا استبعادٌ من الكتالوج (لا شعبةَ مفتوحة أصلا) لا من الخادم. أمّا ما
     يملكه المشتري أو حُجز مقعدُه فيه فيُعرَف من `quote.excluded` — إذ لا
     تعرفه هذه الشاشةُ بنفسها. */
  const { buyable, withoutCohort } = useMemo(() => {
    const ok: { line: BuyLine; options: CohortOption[] }[] = [];
    const out: BuyLine[] = [];
    for (const l of lines) {
      const options = cohorts.get(l.courseId) ?? [];
      if (options.length > 0) ok.push({ line: l, options });
      else out.push(l);
    }
    return { buyable: ok, withoutCohort: out };
  }, [lines, cohorts]);

  /* الاختيارُ التلقائيّ يقع مرّةً لكلّ دورةٍ جديدة، ولا يدوس اختيارَ المشتري */
  useEffect(() => {
    setChosen((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const { line, options } of buyable) {
        if (!next[line.courseId] || !options.some((o) => o.id === next[line.courseId])) {
          /* ما اختاره في الصفحة أوّلا — إن كان ما زال متاحا — ثمّ أقربُ شعبة */
          const preferred = line.cohortId && options.some((o) => o.id === line.cohortId) ? line.cohortId : options[0].id;
          next[line.courseId] = preferred;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [buyable]);

  /* وكانت هنا «هديّةٌ تنتظر آخرَ دفعةٍ من الخطّة» — أُلغيت الهديّةُ كلُّها (٢٦ أكتوبر ٢٠٢٦، `cart.service.ts`) */
  const cohortIds = useMemo(
    () => buyable.map(({ line }) => chosen[line.courseId]).filter(Boolean),
    [buyable, chosen],
  );

  /* ما يقابَل به كلُّ بندٍ ليُقال التعارض: شعبُ البنود الأخرى كما اختارها، ولقاءاتُه ممّا سجّل فيه */
  const mine = useMySessions();
  const timedOf = (line: BuyLine, o: CohortOption): TimedCohort => ({ cohortId: o.id, courseId: line.courseId, titleAr: line.name, sessions: o.sessions });

  /* خصمُ الخطّة كاملةً — بعدد دوراتها، يُقال لمن يشتري بعضَها */
  const planPct = buildDiscountPct(lines.length);

  /* التسعير: نداءٌ واحد كلّما تبدّلت الشعبُ أو الكود — والرقمُ الظاهر رقمُه */
  const refresh = useCallback(async (code: string) => {
    if (cohortIds.length === 0) { setQuote(null); return; }
    setQuoting(true);
    setError(null);
    try {
      setQuote(await apiPost<Quote>("/api/learner/checkout/quote", {
        cohortIds,
        ...(code ? { couponCode: code } : {}),
      }));
      if (code) setCouponError(null);
    } catch (e) {
      /* الكودُ وحدَه رُدّ: يُقال سببُه تحت خانته، ويُعاد التسعيرُ بلا كود */
      if (code && e instanceof ApiError && COUPON_ERRORS.has(e.code)) {
        setCouponError(e.message);
        setApplied("");
        return;
      }
      setQuote(null);
      setError(e instanceof ApiError ? e.message : "تعذّر تسعير طلبك — أعد المحاولة");
    } finally {
      setQuoting(false);
    }
  }, [cohortIds]);

  useEffect(() => { void refresh(applied); }, [refresh, applied]);

  /* سببُ الاستبعاد بالشعبة لا بالدورة: من مُنع من شعبةٍ قد تُتاح له أخرى
     من الدورة نفسِها، فيبقى المبدّلُ معروضا ليختار موعدا آخر. */
  const excludedOf = useMemo(
    () => new Map((quote?.excluded ?? []).map((e) => [e.cohortId, e])),
    [quote],
  );
  /* ما يُدفع ثمنُه فعلا هو ما سعّره الخادم — لا ما اختارته الشاشة. فلا
     يُرسَل إلى `checkout` بندٌ يرفضه، وهو صارمٌ بحقّ: طلبٌ فوق مقعدٍ مملوك
     يعني فاتورةً بغير ما ضغط عليه المشتري. */
  const payableIds = useMemo(() => (quote?.items ?? []).map((i) => i.cohortId), [quote]);
  /* وما يُقابَل به: بنودٌ ستُشترى فعلا — لا مستبعَدٌ — ولقاءاتُه ممّا سجّل فيه.
     والشعبةُ المسجَّلُ فيها لا تُعدّ مرّتين إن كانت في الطلب أيضا */
  const busyBesides = (courseId: string): TimedCohort[] => {
    const lines = buyable
      .filter(({ line }) => line.courseId !== courseId)
      .flatMap(({ line, options }) => {
        const o = options.find((x) => x.id === chosen[line.courseId]) ?? options[0];
        return o && !excludedOf.has(o.id) ? [timedOf(line, o)] : [];
      });
    return [...mine.filter((m) => !lines.some((l) => l.cohortId === m.cohortId)), ...lines];
  };
  const nothingLeft = !!quote && payableIds.length === 0;

  const usd = quote?.currency === "USD";
  const shownTotal = quote
    ? usd
      ? formatPresentment(convertFromUsd(quote.total, currency), currency)
      : money(quote.total, quote.currency)
    : "—";
  /* وما يصير إليه المبلغ بكود المنحة — بصيغة المجموع نفسِها («$60.00» لا «60 USD») */
  const shownGrant = quote && grantPayTotal !== undefined
    ? usd ? formatPresentment(convertFromUsd(grantPayTotal, currency), currency) : money(grantPayTotal, quote.currency)
    : null;

  const pay = async () => {
    if (!quote || payableIds.length === 0) return;
    setPaying(true);
    setError(null);
    try {
      const order = await apiPost<CheckoutResult>("/api/learner/checkout", {
        cohortIds: payableIds,
        ...(applied ? { couponCode: applied } : {}),
        /* رمزُ دعوة المدرّب إن هبط الزائرُ برابطه — والخادمُ يقرّر قبولَه */
        ...(readReferral() ? { referralCode: readReferral()! } : {}),
      });
      /* الطلبُ أُنشئ — فلا «أكمل شراءك» بعده على ما صار في «فواتيري» (`pending-checkout.ts`) */
      clearPendingCheckout();
      const r = await apiPost<PayResult>(`/api/learner/orders/${order.orderId}/pay`, {
        idempotencyKey: `buy-${order.orderId}-${currency}`,
        ...(usd ? { presentment: currency } : {}),
      });
      if (r.redirectUrl) { window.location.assign(r.redirectUrl); return; }
      /* مزوّدٌ غير مستضاف: الدفعةُ سُجّلت — ويُمرَّر معرّفُ الطلب فتعرض صفحةُ
         التعلّم إيصالَه. كان يُرسَل بلا معرّف، فيصل الطالبُ بلا رقمِ فاتورةٍ
         ولا مبلغ — ولا يستطيع أن يجيب «هل نجح دفعي؟». */
      window.location.assign(`/student/learning?paid=${order.orderId}`);
    } catch (e) {
      /* وقفلُ الموسم لا يُعرض خطأً أحمرَ في أسفل اللوح: هو ليس عطبا في طلبه
         بل بابٌ لم يُفتح، وجوابُه حقلُ بريدٍ لا «أعد المحاولة». */
      if (e instanceof ApiError && e.code === "season_closed") {
        setServerClosed(e.message);
        setPaying(false);
        return;
      }
      setError(e instanceof ApiError ? e.message : "تعذّر إتمام الشراء — أعد المحاولة");
      setPaying(false);
    }
  };

  /* ═══ البنودُ تُطوى — ولا يُطوى تحذيرٌ معها ═══

     قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): «اجعل قائمة الدورات منسدلةً لتقليل
     حجم الصندوق». وستُّ دوراتٍ كانت تدفع المجموعَ وزرَّ الدفع خارجَ الشاشة،
     فيُمرَّر إليهما بعد أن قُرئ ما لا يُقرأ مرّتين — الأسماءُ رآها المشتري
     قبل أن يصل هنا.

     **ولا تُطوى إن كان فيها ما استُبعد.** فالبندُ المستبعَدُ ليس اسما يُعاد،
     بل تحذيرٌ يقول «هذه لن تُشترى» — وطيُّه يجعل المشتريَ يظنّ أنّه اشترى
     ما لم يشترِه، وهو العطبُ نفسُه الذي كُتب له `withoutCohort` أسفلَه. */
  const [listOpen, setListOpen] = useState(false);
  const hasExcluded = useMemo(
    () => buyable.some(({ line, options }) =>
      excludedOf.has(chosen[line.courseId] ?? options[0]?.id ?? "")),
    [buyable, chosen, excludedOf],
  );
  const listShown = listOpen || hasExcluded;

  const startsLabel = (o: CohortOption) => (o.startsAt ? cohortDayAr(o.startsAt) : "يعلن الموعد");

  /* اللوحُ أضيقُ وأقلُّ حشوا (`max-w-md` و`sm:p-5`): شاشةُ الدفع في صفحة
     الدورة كانت «كبيرةً» في عين صاحب المنصّة (٨ سبتمبر ٢٠٢٦)، وما فيها
     بنودٌ ومجموعٌ وزرّ — لا تحتاج عرضَ مقالة. */
  return (
    <Modal onClose={onClose} label={`الشراء: ${title}`} panelClassName="w-full max-w-md">
      <Inset tone="solid" className="story-fade max-h-[86vh] overflow-y-auto sm:p-5">
        <h3 className="text-base font-black">إتمام الشراء</h3>
        <p className="mt-1 text-read text-muted-foreground">{title}</p>

        {!loaded && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> نقرأ الشعب المتاحة…
          </p>
        )}

        {loaded && buyable.length === 0 && (
          <Card as="p" className="mt-6 text-sm leading-6 text-muted-foreground">
            لا شعبة مفتوحة لهذه الدورات الآن. افتح مسارك في منصّتك وسنعلمك فور فتح أوّل شعبة.
          </Card>
        )}

        {loaded && buyable.length > 0 && (
          <>
            {/* شراءُ مسارٍ كاملٍ يُقال بصريح العبارة، لا يُترَك للعدّ. */}
            {kind === "pathway" && (
              <Card tone="warn" className="mt-5">
                <p className="flex items-center gap-1.5 text-sm font-black text-gold-ink">
                  <RouteIcon className="h-4 w-4" /> تشتري مسارا كاملا — لا دورات منفردة
                </p>
                <ul className="mt-3 space-y-2">
                  {PATHWAY_ONLY_PERKS.map((perk) => (
                    <li key={perk.t} className="flex items-start gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-gold/15">
                        <perk.icon className="h-3 w-3 text-gold-ink" />
                      </span>
                      <span className="text-fine leading-relaxed text-foreground">{perk.t}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* البنودُ بشعبها — والموعدُ يُبدَّل هنا لا في شاشةٍ أخرى. أسماءٌ
                وتواريخ بلا أسعار: رآها المشتري قبل أن يصل هنا، ولا تتكرر —
                المجموعُ وحده أسفل اللوح. قائمةٌ واحدة بفواصل، لا صندوقٌ
                مستقلٌّ لكلّ بند. */}
            <button
              type="button"
              onClick={() => setListOpen((v) => !v)}
              aria-expanded={listShown}
              aria-controls="buy-lines"
              /* ولا يُطفأ الزرُّ حين يُقسَر الفتح: زرٌّ معطَّلٌ لا يقول لماذا.
                 بل يُقال في متنه إنّ فيها ما يستحقّ النظر. */
              /* ═══ زرٌّ يُرى زرّا (٢٦ أكتوبر ٢٠٢٦) ═══
                 كان صفّا بلا إطار، فقال صاحبُ المنصّة: «الدورات ومواعيدها لا تبدو أنّها زرٌّ للنقر.. اجعلها بإطارٍ
                 مميّز». فصار حبّةَ المعجم الفيروزيّة (`btn-outline-brand`) بعرض اللوح، وبتعبئةٍ خفيفة، ويقول فعلَه
                 «عرض» أو «إخفاء» — لا سهما وحدَه. والحبّةُ لا صندوقٌ مكتوبٌ باليد، فلا تزيد سقفَ الصيغ. */
              className="btn-outline-brand mt-3 h-auto min-h-11 w-full justify-between gap-3 bg-teal/[0.06] px-4 py-2 text-right"
            >
              <span className="flex min-w-0 items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {buyable.length === 1 ? "الدورة وموعدها" : `الدورات ومواعيدها (${buyable.length})`}
                  {hasExcluded && <span className="text-gold-ink"> — فيها ما استبعد</span>}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-fine">
                {listShown ? "إخفاء" : "عرض"}
                <ChevronDown className={`h-4 w-4 transition ${listShown ? "rotate-180" : ""}`} aria-hidden="true" />
              </span>
            </button>

            <ul
              id="buy-lines"
              hidden={!listShown}
              className="mt-2 divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
            >
              {buyable.map(({ line, options }) => {
                const picked = options.find((o) => o.id === chosen[line.courseId]) ?? options[0];
                const out = excludedOf.get(picked.id);
                return (
                  <li key={line.courseId} className={`p-3 ${out ? "bg-white/[0.02]" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className={`block text-sm font-bold leading-snug ${out ? "text-muted-foreground" : ""}`}>{line.name}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-fine text-muted-foreground">
                          <CalendarDays className="h-3 w-3" /> {startsLabel(picked)}
                          {!out && picked.seatsLeft !== null && picked.seatsLeft <= 5 && (
                            <span className="text-gold-ink"> · بقي {picked.seatsLeft}</span>
                          )}
                        </span>
                      </span>
                      {/* لا سعرَ للبند (قرارُ اللوح: المجموعُ وحده أسفلَه)، لكنّ
                          المستبعَدَ يُقال سببُه في موضعه — وإلّا بقي بندٌ في
                          القائمة لا يدخل المجموعَ بلا أن يُعرف لماذا. */}
                      {out ? (
                        <span className="shrink-0 text-fine font-bold text-gold-ink">
                          {REASON_AR[out.reason] ?? "غير متاحة الآن"}
                        </span>
                      ) : null}
                    </div>
                    {out && (
                      <p className="mt-1.5 text-read leading-5 text-muted-foreground">
                        {out.messageAr}
                        {options.length > 1 && " — أو اختر موعدا آخر أدناه."}
                      </p>
                    )}
                    {options.length > 1 && (
                      <label className="mt-2.5 block">
                        <span className="sr-only">اختر موعد «{line.name}»</span>
                        <select
                          value={chosen[line.courseId] ?? options[0].id}
                          onChange={(e) => setChosen({ ...chosen, [line.courseId]: e.target.value })}
                          className="w-full cursor-pointer rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-foreground outline-none transition hover:border-teal/40 focus:border-teal/60"
                        >
                          {options.map((o) => (
                            <option key={o.id} value={o.id} className="bg-surface">
                              {startsLabel(o)}{o.title ? ` — ${o.title}` : ""}{o.trainers.length > 0 ? ` — مع ${o.trainers.join(" و")}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {/* ومواعيدُ لقاءاتها قبل الدفع لا بعده — مطويّةً، فاللوحُ قائمةُ
                        بنودٍ ومجموع. والمستبعَدُ لا تُعرض لقاءاتُه: لن يُشترى. */}
                    {!out && <LiveSessionDates key={picked.id} sessions={picked.sessions} />}
                    {/* ═══ وشعبةٌ تقع لقاءاتُها على أخرى في الطلب أو ممّا سجّل فيه — قبل الدفع (٢٤ أكتوبر ٢٠٢٦) ═══
                        يُقال مع أيّها وكم لقاءً، ويُدلّ على موعدٍ لا يتعارض إن وُجد. ولا يمنع الدفع (`cohort-overlap.ts`) */}
                    {!out && (() => {
                      const clashes = clashesOf(timedOf(line, picked), busyBesides(line.courseId));
                      if (clashes.length === 0) return null;
                      const alt = freeAlternative(options.map((o) => timedOf(line, o)), busyBesides(line.courseId));
                      const altOption = alt ? options.find((o) => o.id === alt.cohortId) : undefined;
                      return (
                        <div className="mt-2 grid gap-1.5">
                          <p className="flex items-start gap-1.5 text-read font-bold leading-6 text-gold-ink">
                            <TriangleAlert className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{clashWarnAr(clashes, Boolean(altOption))}</span>
                          </p>
                          {altOption && (
                            <button type="button" onClick={() => setChosen({ ...chosen, [line.courseId]: altOption.id })}
                              className="w-fit text-read font-bold text-teal-light-ink underline-offset-4 hover:underline">
                              بدّل إلى {startsLabel(altOption)}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </li>
                );
              })}
            </ul>

            {/* ما استُبعد يُسمّى: الخادمُ «كلُّ شيءٍ أو لا شيء»، فإسقاطُه صامتا
                يجعل المشتريَ يظنّ أنّه اشترى ما لم يشترِه. */}
            {withoutCohort.length > 0 && (
              <Card as="p" className="mt-3 flex items-start gap-2 text-read leading-5 text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  خارج هذا الطلب لأنّها بلا شعبة مفتوحة بعد:{" "}
                  <span className="text-foreground">{withoutCohort.map((l) => l.name).join("، ")}</span>. تبقى في
                  مسارك، ونعلمك فور فتح شعبتها.
                  {/* ما يكسبه بالانتظار — لا ما يخسره: الخصمُ يُكمَل في الدفعة التالية
                      (`planCredit` في `cart-pricing.ts`)، قرارُ صاحب المنصّة «أ٢» */}
                  {kind === "pathway" && planPct > 0 && (
                    <>
                      {" "}
                      <span className="text-foreground">خصم خطّتك كاملة ({planPct}٪) محفوظ لك:</span> حين تشتري
                      باقيها يخصم من فاتورتها ما فاتك اليوم.
                    </>
                  )}
                </span>
              </Card>
            )}

            {/* الكود — يُرسَل فعلا. وكان يُعرض على الشاشة ولا يُرسَل أصلا. */}
            <div className="mt-4 flex items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-muted-foreground">
                <Tag className="h-4 w-4" />
              </span>
              <input
                value={coupon}
                onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setCouponError(null); }}
                placeholder="كود الخصم"
                aria-label="كود الخصم"
                dir="ltr"
                className={`${couponFieldCls} ${couponError ? "border-gold/60" : "border-white/12"} focus:border-gold/50`}
              />
              <button
                onClick={() => setApplied(coupon.trim())}
                disabled={quoting || coupon.trim() === applied}
                className="shrink-0 cursor-pointer rounded-xl border border-gold/40 px-3 py-2 text-xs font-black text-gold-ink transition hover:bg-gold/10 disabled:opacity-40"
              >
                طبّق
              </button>
            </div>
            {couponError && <p className="mt-1.5 text-read leading-6 text-gold-ink">{couponError}</p>}
            {/* ومن جاء من صفحة المنحة بلا كودٍ مكتوب (عاد بعد أن أخذه، فأُرسل إلى بريده ولم يُعرض) — يُقال له ما يصير
                إليه المبلغ بكوده، لا يُترك أمام سعرٍ كاملٍ يظنّه سعرَ المنحة */}
            {grantPayTotal !== undefined && quote && quote.grantPct === null && !couponError && !nothingLeft && (
              <p className="mt-1.5 text-read leading-6 text-gold-ink">
                اكتب كود منحتك ليصير المبلغ <bdi dir="ltr">{shownGrant}</bdi>. تجده في بريدك.
              </p>
            )}
            {/* كودٌ وقع على بعض الدورات دون بعض — كودُ المدرّب على دوراته وحدَها،
                فيُسمّى ما خصمه، ولا يُظنّ أنّه خصم الطلبَ كلَّه */}
            {quote && quote.couponDiscount > 0 && quote.items.some((i) => i.couponApplies === false) && (
              <p className="mt-1.5 text-read leading-6 text-muted-foreground">
                خصم الكود على: <span className="text-foreground">{quote.items.filter((i) => i.couponApplies).map((i) => i.titleAr).join("، ")}</span>
              </p>
            )}

            {/* لا شيء يُشترى: كلُّه مملوكٌ أو محجوز — يُقال صراحةً بدل صفٍّ
                من الأصفار وزرِّ دفعٍ لا يفعل شيئا. */}
            {/* ═══ وزرٌّ إلى «تعلّمي» لا اسمُها وحدَه (٢٦ أكتوبر ٢٠٢٦) ═══
                «لماذا لا يوجد هنا زرّ يأخذه إلى تعلّمي مباشرة؟ بدلا من أن يسأل أين تعلّمي وما هي» (صاحب المنصّة). */}
            {nothingLeft && (
              <Card tone="accent" className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 flex-1 text-read leading-6 text-teal-light-ink">
                  كلّ ما في هذا الطلب لك بالفعل — لا شيء يدفع ثمنه مرّة أخرى.
                </p>
                <Button as={Link} to="/student/learning" tone="confirm" size="sm" icon={BookOpen} onClick={onClose}>
                  افتح «تعلّمي»
                </Button>
              </Card>
            )}

            {/* ─── الحساب: المبلغُ ظاهرٌ، وتفصيلُه مطويٌّ (١٢ سبتمبر ٢٠٢٦) ───

                قرارُ صاحب المنصّة: «الحسابُ يظهر في صفحة الاختيار… وشاشةُ
                الدفع يكون فيها المبلغُ المطلوبُ دفعُه فقط». وقد صار المجموعُ
                وخصمُ الباقة يُعرضان حيّين في صندوق الاختيار (صفحة المسار)،
                فتكرارُهما هنا يُعيد على المشتري حسابا أنهاه.

                وما طُوي لم يُحذف: `<details>` بنقرةٍ واحدة. إخفاءُ بنود
                الفاتورة عن دافعها ليس تبسيطا — البنودُ حقُّه، والطيُّ يرتّب
                ما يراه أوّلا لا ما يستطيع رؤيته.

                ⚠ والطيُّ **مغلقٌ افتراضا ولا يُقفَل**: لوحُ الدفع يُفتح من
                صفحة الدورة المفردة أيضا، ومن جاء منها لم يرَ حسابا قبلَه —
                فسطرُ «تفصيل الحساب» هو بابُه الوحيد إليه. */}
            {quote && !nothingLeft && (
              <Card className="mt-4 space-y-1.5 text-xs">
                {/* ومن صفحة المنحة مفتوحٌ: كم كانت الدورة، وكم المنحة، وما يبقى — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦) */}
                <details className="group" open={grantPayTotal !== undefined}>
                  {/* `text-read` لا `text-fine`: هذا البابُ الوحيدُ إلى بنود
                      الفاتورة لمن جاء من صفحة الدورة المفردة، وبابٌ بحجم
                      الحاشية يُقرأ حاشيةً فلا يُفتح. */}
                  <summary className="flex cursor-pointer list-none items-center gap-1 text-read font-bold leading-6 text-muted-foreground transition hover:text-teal-light-ink [&::-webkit-details-marker]:hidden">
                    تفصيل الحساب
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="mt-1.5 space-y-1.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>مجموع الدورات</span>
                  <span dir="ltr">{money(quote.subtotal, quote.currency)}</span>
                </div>
                {quote.bundleDiscount > 0 && (
                  <div className="flex items-center justify-between text-teal-light-ink">
                    <span>خصم الباقة — {quote.bundlePct}٪</span>
                    <span dir="ltr">−{money(quote.bundleDiscount, quote.currency)}</span>
                  </div>
                )}
                {/* سقفُ سعر المسار — بندٌ باسمه لا نسبةٌ مدموجةٌ في خصم
                    الباقة: سببان مختلفان، ودمجُهما يُخرج نسبةً (٣٣٪ · ٤١٪)
                    لا يقابلها شيءٌ في السياسة فتُقرأ وعدا في سلّةٍ أخرى. */}
                {quote.capDiscount > 0 && (
                  <div className="flex items-center justify-between text-teal-light-ink">
                    <span>حدّ سعر المسار</span>
                    <span dir="ltr">−{money(quote.capDiscount, quote.currency)}</span>
                  </div>
                )}
                {/* خصمُ إكمال الخطّة — ما فاته في دفعةٍ سابقةٍ يُخصم هنا، باسمه */}
                {quote.planCredit > 0 && (
                  <div className="flex items-center justify-between text-teal-light-ink">
                    <span>خصم إكمال خطّتك</span>
                    <span dir="ltr">−{money(quote.planCredit, quote.currency)}</span>
                  </div>
                )}
                {quote.couponDiscount > 0 && (
                  <div className="flex items-center justify-between text-gold-ink">
                    <span>{quote.grantPct !== null ? `${quote.grantNameAr ?? MEMBER_GRANT_NAME_AR} — ${quote.grantPct}٪` : `الكود ${quote.couponCode}`}</span>
                    <span dir="ltr">−{money(quote.couponDiscount, quote.currency)}</span>
                  </div>
                )}
                  </div>
                </details>
                <div className="flex items-end justify-between border-t border-white/10 pt-2 text-foreground">
                  <span className="text-xs font-bold">ما تدفعه الآن</span>
                  <span dir="ltr" className="text-2xl font-black">{shownTotal}</span>
                </div>
              </Card>
            )}

            {/* عملةُ البطاقة تُختار هنا وحدَها — والموقعُ كلُّه بالدولار */}
            {usd && !nothingLeft && (
              <div className="mt-2.5 text-left">
                {!currencyOpen ? (
                  <button
                    type="button"
                    onClick={() => setCurrencyOpen(true)}
                    aria-expanded={false}
                    className="cursor-pointer text-xs font-bold text-muted-foreground underline-offset-4 transition hover:text-teal-light-ink hover:underline"
                  >
                    {currency === "USD"
                      ? "ادفع بعملة أخرى"
                      : `تقتطع بطاقتك بـ${PRESENTMENT_CURRENCIES[currency].labelAr} — غيّرها`}
                  </button>
                ) : (
                  <div role="group" aria-label="بأيّ عملة تقتطع بطاقتك؟">
                    <p className="mb-1.5 text-read leading-5 font-bold text-muted-foreground">
                      بأيّ عملة تقتطع بطاقتك؟
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {PRESENTMENT_CODES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCurrency(c)}
                          aria-pressed={currency === c}
                          className={`min-h-[32px] cursor-pointer rounded-full border px-3 py-0.5 text-xs font-bold transition ${
                            currency === c
                              ? "border-gold/60 bg-gold/15 text-gold-ink"
                              : "border-white/12 text-muted-foreground hover:border-white/25 hover:text-foreground"
                          }`}
                        >
                          {PRESENTMENT_CURRENCIES[c].labelAr}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ولا «وثّق بريدك» هنا: الدفعُ أوّلا والتوثيقُ بعده في بوّابته (٢٦ أكتوبر ٢٠٢٦، `commerce.service`) */}
            {error && (
              <Inset as="p" tone="danger" className="mt-3 px-3 py-2 text-read leading-5 text-red-200">
                {error}
              </Inset>
            )}

            {/* البابُ مغلقٌ: الرسالةُ وحقلُ البريد مكانَ زرِّ الدفع.

                ولا يُعرض الزرُّ معطَّلا إلى جانبها: زرٌّ مطفأٌ يُقرأ عطبا في
                الصفحة، والجملةُ تقول ما يقوله الإطفاءُ وأكثر. */}
            {!nothingLeft && closedAr && (
              <RegistrationClosedNotice
                messageAr={closedAr}
                source={kind === "pathway" ? "pathway" : "course"}
                email={email}
                className="mt-5"
              />
            )}

            {!nothingLeft && !closedAr && (
              <>
                <Button tone="primary" onClick={() => void pay()}
                  disabled={paying || quoting || !quote || payableIds.length === 0} className="mt-5 w-full disabled:opacity-50">
                  {paying || quoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {paying ? "نحوّلك إلى صفحة الدفع…" : <>ادفع الآن · <span dir="ltr">{shownTotal}</span></>}
                </Button>
                <p className="mt-2 text-center text-read leading-5 text-muted-foreground">
                  الدفع على صفحة المزوّد — لا نحفظ بيانات بطاقتك. وبعد الدفع تفتح منصّتك على ما اشتريت.
                </p>
              </>
            )}
          </>
        )}
      </Inset>
    </Modal>
  );
}

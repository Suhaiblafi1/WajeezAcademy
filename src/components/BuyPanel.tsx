/* لوحُ الشراء — من قرار الشراء إلى صفحة الدفع، بلا طلبٍ ولا انتظارِ أحد.

   كان هنا `EnrollRequest`: نافذةٌ تقول «الدفع الإلكتروني لم يُفتح بعد»
   وتحيل إلى نموذج تواصل. وقرارُ صاحب المنصّة: «الدفع يكون مباشرة وليس بطلب
   التسجيل — يختار الدورات أو المسار ويدفع مباشرة بوضع الخصم أو الكود…
   واجعل عمليّة الشراء تتمّ **قبل** نقله لمنصّته».

   وثلاثةُ قراراتٍ في بنية هذا اللوح، لكلٍّ سببُه:

   ١) **الرقمُ من الخادم لا من المتصفّح.** كلُّ ما يُعرض هنا — المجموع وخصمُ
      الباقة والهديّة والكوبون — يأتي من `/api/learner/checkout/quote`، وهو
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

   ولا نقول «تمّ الدفع» عند التحويل: التسويةُ بـwebhook موقَّع، ورجوعُ
   المتصفّح ليس دليلا. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CreditCard, Gift, Info, Loader2, Route as RouteIcon, Tag } from "lucide-react";
import Modal from "@/components/Modal";
import VerifyEmailNotice from "@/components/VerifyEmailNotice";
import { apiPost, ApiError } from "@/services/api";
import { useCourseCohorts, type CohortOption } from "@/services/cohort-prices";
import { FIRST_TIME_PROMO } from "@/application/commerce/first-time-promo";
import { PATHWAY_ONLY_PERKS } from "@/data/pathway-perks";
import {
  PRESENTMENT_CODES, PRESENTMENT_CURRENCIES, convertFromUsd, formatPresentment,
  type PresentmentCurrency,
} from "@/application/commerce/presentment";
import { fmtDateAr } from "@/utils/format";
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
}

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
  emailVerified: boolean;
  excluded: ExcludedLine[];
  subtotal: number;
  listTotal: number;
  bundlePct: number;
  bundleDiscount: number;
  capDiscount: number;
  couponDiscount: number;
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
  already_enrolled: "مسجَّل فيها",
  settling: "دُفعت — بانتظار التأكيد",
  order_pending: "طلبٌ لم يكتمل دفعُه",
  capacity_full: "لا مقاعد",
  closed: "التسجيل مغلق",
  no_price: "بلا سعر معلن",
};

export default function BuyPanel({
  title,
  lines,
  email,
  initialCoupon = "",
  kind,
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
  onClose: () => void;
}) {
  const { cohorts, loaded } = useCourseCohorts();

  /* الشعبةُ المختارة لكلّ دورة — أوّلُ المتاح افتراضا، ويبدّلها من شاء */
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [coupon, setCoupon] = useState(initialCoupon);
  const [applied, setApplied] = useState(initialCoupon);
  const [currency, setCurrency] = useState<PresentmentCurrency>("USD");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const cohortIds = useMemo(
    () => buyable.map(({ line }) => chosen[line.courseId]).filter(Boolean),
    [buyable, chosen],
  );

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
    } catch (e) {
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
  const nothingLeft = !!quote && payableIds.length === 0;

  const usd = quote?.currency === "USD";
  const shownTotal = quote
    ? usd
      ? formatPresentment(convertFromUsd(quote.total, currency), currency)
      : money(quote.total, quote.currency)
    : "—";

  const pay = async () => {
    if (!quote || payableIds.length === 0) return;
    setPaying(true);
    setError(null);
    try {
      const order = await apiPost<CheckoutResult>("/api/learner/checkout", {
        cohortIds: payableIds,
        ...(applied ? { couponCode: applied } : {}),
      });
      const r = await apiPost<PayResult>(`/api/learner/orders/${order.orderId}/pay`, {
        idempotencyKey: `buy-${order.orderId}-${currency}`,
        ...(usd ? { presentment: currency } : {}),
      });
      if (r.redirectUrl) { window.location.assign(r.redirectUrl); return; }
      /* مزوّدٌ غير مستضاف: الدفعةُ سُجّلت، فالمنصّةُ تعرض ما دُفع */
      window.location.assign("/student/learning");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر إتمام الشراء — أعد المحاولة");
      setPaying(false);
    }
  };

  const startsLabel = (o: CohortOption) => (o.startsAt ? fmtDateAr(o.startsAt) : "يُعلن الموعد");

  return (
    <Modal onClose={onClose} label={`الشراء: ${title}`} panelClassName="w-full max-w-lg">
      <Inset className="story-fade max-h-[86vh] overflow-y-auto bg-surface sm:p-7">
        <h3 className="text-lg font-black">إتمام الشراء</h3>
        <p className="mt-1 text-sm text-muted-foreground">{title}</p>

        {!loaded && (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> نقرأ الشعب المتاحة…
          </p>
        )}

        {loaded && buyable.length === 0 && (
          <Card as="p" className="mt-6 text-sm leading-6 text-muted-foreground">
            لا شعبة مفتوحة لهذه الدورات الآن. افتح مسارك في منصّتك وسنُعلمك فور فتح أوّل شعبة.
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
                      <span className="text-micro leading-relaxed text-foreground">{perk.t}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* البنودُ بشعبها — والموعدُ يُبدَّل هنا لا في شاشةٍ أخرى. أسماءٌ
                وتواريخ بلا أسعار: رآها المشتري قبل أن يصل هنا، ولا تتكرر —
                المجموعُ وحده أسفل اللوح. قائمةٌ واحدة بفواصل، لا صندوقٌ
                مستقلٌّ لكلّ بند. */}
            <ul className="mt-3 divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              {buyable.map(({ line, options }) => {
                const item = quote?.items.find((i) => i.courseId === line.courseId);
                const picked = options.find((o) => o.id === chosen[line.courseId]) ?? options[0];
                const out = excludedOf.get(picked.id);
                return (
                  <li key={line.courseId} className={`p-3 ${out ? "bg-white/[0.02]" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className={`block text-sm font-bold leading-snug ${out ? "text-muted-foreground" : ""}`}>{line.name}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-micro text-muted-foreground">
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
                        <span className="shrink-0 text-micro font-bold text-gold-ink">
                          {REASON_AR[out.reason] ?? "غير متاحة الآن"}
                        </span>
                      ) : item?.isGift ? (
                        <span className="flex shrink-0 items-center gap-1 text-micro font-black text-gold-ink">
                          <Gift className="h-3.5 w-3.5" /> هديّة
                        </span>
                      ) : null}
                    </div>
                    {out && (
                      <p className="mt-1.5 text-micro leading-5 text-muted-foreground">
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
                              {startsLabel(o)}{o.title ? ` — ${o.title}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* ما استُبعد يُسمّى: الخادمُ «كلُّ شيءٍ أو لا شيء»، فإسقاطُه صامتا
                يجعل المشتريَ يظنّ أنّه اشترى ما لم يشترِه. */}
            {withoutCohort.length > 0 && (
              <Card as="p" className="mt-3 flex items-start gap-2 text-micro leading-5 text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  خارج هذا الطلب لأنّها بلا شعبة مفتوحة بعد:{" "}
                  <span className="text-foreground">{withoutCohort.map((l) => l.name).join("، ")}</span>. تبقى في
                  مسارك، ونُعلمك فور فتح شعبتها.
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
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder={`كود الخصم — مثال ${FIRST_TIME_PROMO.code}`}
                dir="ltr"
                className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-left text-xs font-mono text-foreground outline-none transition focus:border-gold/50"
              />
              <button
                onClick={() => setApplied(coupon.trim())}
                disabled={quoting || coupon.trim() === applied}
                className="shrink-0 cursor-pointer rounded-xl border border-gold/40 px-3 py-2 text-xs font-black text-gold-ink transition hover:bg-gold/10 disabled:opacity-40"
              >
                طبّق
              </button>
            </div>

            {/* لا شيء يُشترى: كلُّه مملوكٌ أو محجوز — يُقال صراحةً بدل صفٍّ
                من الأصفار وزرِّ دفعٍ لا يفعل شيئا. */}
            {nothingLeft && (
              <Card as="p" tone="accent" className="mt-4 text-xs leading-6 text-teal-light-ink">
                كلُّ ما في هذا الطلب لك بالفعل — لا شيء يُدفع ثمنُه مرّةً أخرى.
                تجد شعبك ومقاعدك المحجوزة في «تعلّمي».
              </Card>
            )}

            {/* الحساب — كلُّ سطرٍ منه من الخادم */}
            {quote && !nothingLeft && (
              <Card className="mt-4 space-y-1.5 text-xs">
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
                    <span>حدُّ سعر المسار</span>
                    <span dir="ltr">−{money(quote.capDiscount, quote.currency)}</span>
                  </div>
                )}
                {quote.couponDiscount > 0 && (
                  <div className="flex items-center justify-between text-gold-ink">
                    <span>الكود {quote.couponCode}</span>
                    <span dir="ltr">−{money(quote.couponDiscount, quote.currency)}</span>
                  </div>
                )}
                {quote.listTotal > quote.subtotal && (
                  <div className="flex items-center justify-between text-gold-ink">
                    <span className="flex items-center gap-1"><Gift className="h-3.5 w-3.5" /> دورة هديّة</span>
                    <span dir="ltr">−{money(quote.listTotal - quote.subtotal, quote.currency)}</span>
                  </div>
                )}
                <div className="flex items-end justify-between border-t border-white/10 pt-2 text-foreground">
                  <span className="text-xs font-bold">ما تدفعه الآن</span>
                  <span dir="ltr" className="text-2xl font-black">{shownTotal}</span>
                </div>
              </Card>
            )}

            {/* عملةُ البطاقة تُختار هنا وحدَها — والموقعُ كلُّه بالدولار */}
            {usd && !nothingLeft && (
              <div className="mt-2.5 flex items-center justify-end gap-1" role="group" aria-label="عملة الدفع">
                {PRESENTMENT_CODES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    aria-pressed={currency === c}
                    title={PRESENTMENT_CURRENCIES[c].labelAr}
                    className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-micro font-bold transition ${
                      currency === c
                        ? "border-gold/60 bg-gold/15 text-gold-ink"
                        : "border-white/12 text-muted-foreground hover:border-white/25 hover:text-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {quote && !quote.emailVerified && !nothingLeft && (
              /* الحاجزُ يُقال في موضعه: `VerifyEmailNotice` لا يُعرض خارج
                 بوابة المتعلّم، فرسالةُ الخادم كانت تحيل إلى شريطٍ لا وجودَ له
                 في هذه الصفحة — طريقٌ مسدود بلا مخرج. */
              <VerifyEmailNotice email={email} className="mt-4" />
            )}

            {error && (
              <Inset as="p" tone="danger" className="mt-3 px-3 py-2 text-xs leading-5 text-red-200">
                {error}
              </Inset>
            )}

            {!nothingLeft && (
              <>
                <Button tone="primary" onClick={() => void pay()}
                  disabled={paying || quoting || !quote || !quote.emailVerified || payableIds.length === 0} className="mt-5 w-full disabled:opacity-50">
                  {paying || quoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {paying ? "نحوّلك إلى صفحة الدفع…" : <>ادفع الآن · <span dir="ltr">{shownTotal}</span></>}
                </Button>
                <p className="mt-2 text-center text-micro leading-5 text-muted-foreground">
                  الدفع على صفحة المزوّد — لا نحفظ بيانات بطاقتك. وبعد الدفع تُفتح منصّتك على ما اشتريت.
                </p>
              </>
            )}
          </>
        )}
      </Inset>
    </Modal>
  );
}

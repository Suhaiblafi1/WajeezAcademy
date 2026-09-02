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

   ٣) **ما لا شعبةَ له يُسمَّى لا يُسقَط صامتا.** الخادمُ «كلُّ شيءٍ أو لا
      شيء»: يرمي عند أوّل دورةٍ بلا سعرٍ أو بلا مقعد قبل أيّ كتابة. فلو
      أُرسلت الدوراتُ كلُّها لاصطدم الزرُّ بـ409 بلا أن يفهم المشتري لماذا.
      فتُرشَّح هنا، ويُقال له صراحةً ما استُبعد ولماذا.

   ولا نقول «تمّ الدفع» عند التحويل: التسويةُ بـwebhook موقَّع، ورجوعُ
   المتصفّح ليس دليلا. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CreditCard, Gift, Info, Loader2, Tag } from "lucide-react";
import Modal from "@/components/Modal";
import VerifyEmailNotice from "@/components/VerifyEmailNotice";
import { apiPost, ApiError } from "@/services/api";
import { useCourseCohorts, type CohortOption } from "@/services/cohort-prices";
import { FIRST_TIME_PROMO } from "@/application/commerce/first-time-promo";
import {
  PRESENTMENT_CODES, PRESENTMENT_CURRENCIES, convertFromUsd, formatPresentment,
  type PresentmentCurrency,
} from "@/application/commerce/presentment";
import { fmtDateAr } from "@/utils/format";
import { track } from "@/services/analytics";

export interface BuyLine {
  courseId: string;
  name: string;
}

interface QuoteItem {
  cohortId: string;
  courseId: string;
  titleAr: string;
  listPrice: number;
  unitPrice: number;
  isGift: boolean;
}

interface Quote {
  currency: string;
  couponCode: string | null;
  emailVerified: boolean;
  subtotal: number;
  listTotal: number;
  bundlePct: number;
  bundleDiscount: number;
  couponDiscount: number;
  discount: number;
  total: number;
  items: QuoteItem[];
}

interface CheckoutResult { orderId: string }
interface PayResult { redirectUrl?: string }

const money = (n: number, c: string) => `${n.toLocaleString("en-US")} ${c}`;

export default function BuyPanel({
  title,
  lines,
  email,
  initialCoupon = "",
  note = null,
  onClose,
}: {
  title: string;
  lines: BuyLine[];
  /** بريدُ المشتري — للشريط حين لا يكون موثَّقا */
  email: string;
  /** كودٌ كتبه في الصفحة قبل أن يفتح اللوح — يُحمل معه لا يُنسى */
  initialCoupon?: string;
  /** رفضُ خادمٍ يستحقّ أن يُقال — مثل محاولة إسقاط دورةٍ دُفع ثمنها.
      يظهر خفيفا لا حاجزا: هذه حالةٌ نادرة لا واجهة الشراء المعتادة. */
  note?: string | null;
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

  /* الدوراتُ القابلة للشراء وما استُبعد منها — بسببِ كلٍّ صريحا */
  const { buyable, excluded } = useMemo(() => {
    const ok: { line: BuyLine; options: CohortOption[] }[] = [];
    const out: BuyLine[] = [];
    for (const l of lines) {
      const options = cohorts.get(l.courseId) ?? [];
      if (options.length > 0) ok.push({ line: l, options });
      else out.push(l);
    }
    return { buyable: ok, excluded: out };
  }, [lines, cohorts]);

  /* الاختيارُ التلقائيّ يقع مرّةً لكلّ دورةٍ جديدة، ولا يدوس اختيارَ المشتري */
  useEffect(() => {
    setChosen((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const { line, options } of buyable) {
        if (!next[line.courseId] || !options.some((o) => o.id === next[line.courseId])) {
          next[line.courseId] = options[0].id;
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

  const usd = quote?.currency === "USD";
  const shownTotal = quote
    ? usd
      ? formatPresentment(convertFromUsd(quote.total, currency), currency)
      : money(quote.total, quote.currency)
    : "—";

  const pay = async () => {
    if (!quote || cohortIds.length === 0) return;
    setPaying(true);
    setError(null);
    try {
      const order = await apiPost<CheckoutResult>("/api/learner/checkout", {
        cohortIds,
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
      <div className="story-fade max-h-[86vh] overflow-y-auto rounded-3xl border border-white/10 bg-surface p-6 sm:p-7">
        <h3 className="text-lg font-black">إتمام الشراء</h3>
        <p className="mt-1 text-sm text-white/55">{title}</p>

        {note && (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-gold-ink/90">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            {note}
          </p>
        )}

        {!loaded && (
          <p className="mt-6 flex items-center gap-2 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" /> نقرأ الشعب المتاحة…
          </p>
        )}

        {loaded && buyable.length === 0 && (
          <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-white/60">
            لا شعبة مفتوحة لهذه الدورات الآن. افتح مسارك في منصّتك وسنُعلمك فور فتح أوّل شعبة.
          </p>
        )}

        {loaded && buyable.length > 0 && (
          <>
            {/* البنودُ بشعبها — والموعدُ يُبدَّل هنا لا في شاشةٍ أخرى.
                قائمةٌ واحدة بفواصل، لا صندوقٌ مستقلٌّ لكلّ بند — الحاوية
                واحدة تحمل كلَّ دوراته، أهدأ للعين من صفٍّ من البطاقات. */}
            <ul className="mt-5 divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              {buyable.map(({ line, options }) => {
                const item = quote?.items.find((i) => i.courseId === line.courseId);
                const picked = options.find((o) => o.id === chosen[line.courseId]) ?? options[0];
                return (
                  <li key={line.courseId} className="p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-bold leading-snug">{line.name}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-white/45">
                          <CalendarDays className="h-3 w-3" /> {startsLabel(picked)}
                          {picked.seatsLeft !== null && picked.seatsLeft <= 5 && (
                            <span className="text-gold-ink"> · بقي {picked.seatsLeft}</span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-black">
                        {item?.isGift ? (
                          <span className="flex items-center gap-1 text-gold-ink">
                            <Gift className="h-3.5 w-3.5" /> هديّة
                          </span>
                        ) : (
                          <span dir="ltr">{money(item?.unitPrice ?? picked.amount, picked.currency)}</span>
                        )}
                      </span>
                    </div>
                    {options.length > 1 && (
                      <label className="mt-2.5 block">
                        <span className="sr-only">اختر موعد «{line.name}»</span>
                        <select
                          value={chosen[line.courseId] ?? options[0].id}
                          onChange={(e) => setChosen({ ...chosen, [line.courseId]: e.target.value })}
                          className="w-full cursor-pointer rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-[12px] text-white/75 outline-none transition hover:border-teal/40 focus:border-teal/60"
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
            {excluded.length > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-[11px] leading-5 text-white/50">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  خارج هذا الطلب لأنّها بلا شعبة مفتوحة بعد:{" "}
                  <span className="text-white/70">{excluded.map((l) => l.name).join("، ")}</span>. تبقى في
                  مسارك، ونُعلمك فور فتح شعبتها.
                </span>
              </p>
            )}

            {/* الكود — يُرسَل فعلا. وكان يُعرض على الشاشة ولا يُرسَل أصلا. */}
            <div className="mt-4 flex items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-white/50">
                <Tag className="h-4 w-4" />
              </span>
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder={`كود الخصم — مثال ${FIRST_TIME_PROMO.code}`}
                dir="ltr"
                className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-left text-[12px] font-mono text-white outline-none transition focus:border-gold/50"
              />
              <button
                onClick={() => setApplied(coupon.trim())}
                disabled={quoting || coupon.trim() === applied}
                className="shrink-0 cursor-pointer rounded-xl border border-gold/40 px-3 py-2 text-[12px] font-black text-gold-ink transition hover:bg-gold/10 disabled:opacity-40"
              >
                طبّق
              </button>
            </div>

            {/* الحساب — كلُّ سطرٍ منه من الخادم */}
            {quote && (
              <div className="mt-4 space-y-1.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-[12px]">
                <div className="flex items-center justify-between text-white/60">
                  <span>مجموع الدورات</span>
                  <span dir="ltr">{money(quote.subtotal, quote.currency)}</span>
                </div>
                {quote.bundleDiscount > 0 && (
                  <div className="flex items-center justify-between text-teal-light-ink">
                    <span>خصم الباقة — {quote.bundlePct}٪</span>
                    <span dir="ltr">−{money(quote.bundleDiscount, quote.currency)}</span>
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
                <div className="flex items-end justify-between border-t border-white/10 pt-2 text-white">
                  <span className="text-xs font-bold">ما تدفعه الآن</span>
                  <span dir="ltr" className="text-2xl font-black">{shownTotal}</span>
                </div>
              </div>
            )}

            {/* عملةُ البطاقة تُختار هنا وحدَها — والموقعُ كلُّه بالدولار */}
            {usd && (
              <div className="mt-2.5 flex items-center justify-end gap-1" role="group" aria-label="عملة الدفع">
                {PRESENTMENT_CODES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    aria-pressed={currency === c}
                    title={PRESENTMENT_CURRENCIES[c].labelAr}
                    className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition ${
                      currency === c
                        ? "border-gold/60 bg-gold/15 text-gold-ink"
                        : "border-white/12 text-white/45 hover:border-white/25 hover:text-white/70"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {quote && !quote.emailVerified && (
              /* الحاجزُ يُقال في موضعه: `VerifyEmailNotice` لا يُعرض خارج
                 بوابة المتعلّم، فرسالةُ الخادم كانت تحيل إلى شريطٍ لا وجودَ له
                 في هذه الصفحة — طريقٌ مسدود بلا مخرج. */
              <VerifyEmailNotice email={email} className="mt-4" />
            )}

            {error && (
              <p className="mt-3 rounded-xl border border-red-400/30 bg-red-400/[0.07] px-3 py-2 text-[12px] leading-5 text-red-200">
                {error}
              </p>
            )}

            <button
              onClick={() => void pay()}
              disabled={paying || quoting || !quote || !quote.emailVerified}
              className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-gold py-3.5 text-sm font-black text-on-gold transition hover:bg-gold/90 disabled:opacity-50"
            >
              {paying || quoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {paying ? "نحوّلك إلى صفحة الدفع…" : <>ادفع الآن · <span dir="ltr">{shownTotal}</span></>}
            </button>
            <p className="mt-2 text-center text-[11px] leading-5 text-white/40">
              الدفع على صفحة المزوّد — لا نحفظ بيانات بطاقتك. وبعد الدفع تُفتح منصّتك على ما اشتريت.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

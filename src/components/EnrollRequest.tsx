/* طلب التسجيل — بديل نافذة الدفع.
   ------------------------------------------------------------------
   كانت هنا `StripeCheckout`: نموذجٌ يطلب رقم بطاقة، ويقبل أيّ اثني عشر رقما،
   ثم `window.setTimeout(onSuccess, 1600)` — بلا نداء خادمٍ واحد. وبعده
   `grantEnrollment()` يكتب «استحقاقا» في localStorage برقم مرجعٍ عشوائي
   وتُفتح البوابة. أي أن أيّ زائرٍ على الموقع الحيّ كان يرى «تم الدفع» ورقمَ
   طلبٍ ويدخل المنصّة، بلا دفعٍ وبلا أثرٍ على الخادم.

   والبديل يقول الحقيقة ويُبقي الطريق مفتوحا: السعر معروضٌ كما هو من الكتالوج،
   والتسجيل يمرّ بطلبٍ حقيقي أو بالتواصل، والدفع الإلكتروني معلَنٌ أنه لم
   يُفتح بعد. ويُستبدل هذا كلُّه بتكامل دفعٍ حقيقي حين يُربط. */

import { useEffect } from "react";
import { Link } from "react-router";
import { CalendarDays, Headset, Info } from "lucide-react";
import Modal from "@/components/Modal";
import { CURRENCIES, setCurrency, useCurrency, usePriceFormatter, type CurrencyCode } from "@/services/currency";
import { FIRST_TIME_PROMO } from "@/application/commerce/first-time-promo";
import { track } from "@/services/analytics";

export default function EnrollRequest({
  title,
  amount,
  contactHref = "/contact?type=enroll",
  onClose,
}: {
  title: string;
  amount: number;
  /** وجهة «تواصل معنا» — تختلف بين المسار الجاهز والمسار المبنيّ */
  contactHref?: string;
  onClose: () => void;
}) {
  const cur = useCurrency();
  const fmt = usePriceFormatter();
  useEffect(() => { track("enroll_request_opened"); }, []);

  return (
    <Modal onClose={onClose} label={`طلب التسجيل: ${title}`} panelClassName="w-full max-w-md">
      <div className="story-fade rounded-3xl border border-white/10 bg-surface p-7">
        <h3 className="text-lg font-black">طلب التسجيل</h3>
        <p className="mt-1 text-sm text-white/55">{title}</p>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-white/50">الرسوم</span>
            {/* صفر يعني «لا سعر معلوم» لا «مجّانا»: الشعبة لم تُفتح بعد فلا
                رقم يُعرض. رقمٌ لا تسنده شعبة هو ما جعل الوعد يفترق عن الفاتورة. */}
            {amount > 0 ? (
              <span className="text-2xl font-black">{fmt(amount)}</span>
            ) : (
              <span className="text-sm font-black text-white/70">يُعلن مع فتح الشعبة</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                  cur.code === c ? "border-teal/60 bg-teal/15 text-teal-light-ink" : "border-white/10 text-white/50 hover:border-white/30"
                }`}
              >
                {CURRENCIES[c].label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-white/50">
            كود <span className="font-black text-gold-ink">{FIRST_TIME_PROMO.code}</span> يخصم
            {" "}{FIRST_TIME_PROMO.percentOff}٪ {FIRST_TIME_PROMO.labelAr} — اذكره في طلبك ويُطبَّق على فاتورتك.
          </p>
        </div>

        <p className="mt-5 flex items-start gap-2 rounded-2xl border border-gold/30 bg-gold/[0.06] p-3.5 text-[11px] leading-5 text-gold-ink">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          الدفع الإلكتروني المباشر لم يُفتح بعد. تسجيلك يبدأ بطلبٍ نراجعه، ثم تصلك فاتورتك ويُفتح وصولك.
        </p>

        <div className="mt-5 grid gap-2.5">
          <Link
            to="/student/cohorts"
            className="flex items-center justify-center gap-2 rounded-full bg-teal py-3 text-sm font-black text-on-teal transition hover:bg-teal-light"
          >
            <CalendarDays className="h-4 w-4" /> تصفّح الشعب المفتوحة واطلب التسجيل
          </Link>
          <Link
            to={contactHref}
            className="flex items-center justify-center gap-2 rounded-full border border-white/15 py-3 text-sm font-bold text-white/80 transition hover:border-teal/50 hover:text-teal-light-ink"
          >
            <Headset className="h-4 w-4" /> تواصل معنا لترتيب تسجيلك
          </Link>
        </div>
      </div>
    </Modal>
  );
}

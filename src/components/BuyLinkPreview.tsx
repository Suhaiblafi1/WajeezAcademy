/* صندوقُ السعر النهائيّ قبل الدفع — من الخادم لا من المتصفّح (٤ نوفمبر ٢٠٢٦).

   يقرأ ما ردّته المعاينة (`useCheckoutPreview`) ويقوله سطرا سطرا: سعرُ القائمة، وكلُّ خصمٍ طُبّق بقيمته، وما
   يدفعه، وعلى أيّ الدورات وقع الكود — ولماذا لم يقع غيرُه. ولا يحسب شيئا: كلُّ رقمٍ هنا رقمُ الفاتورة.
   والنصوصُ بلا تشكيل (قواعدُ المستودَع). */

import type { CheckoutPreview } from "@/services/checkout-preview";

/** المبلغُ كما تُصدره الفاتورة — بالقروش إن كان فيه كسر، فلا يُقرأ ٢٤٨ وهو ٢٤٨٫٤٠ */
function previewMoney(n: number, currency: string): string {
  const v = Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v} ${currency}`;
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "save" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={tone === "save" ? "text-teal-light-ink" : "text-muted-foreground"}>{label}</dt>
      <dd dir="ltr" className={`font-bold ${tone === "save" ? "text-teal-light-ink" : "text-foreground"}`}>{value}</dd>
    </div>
  );
}

export default function BuyLinkPreview({ preview: p, courseName }: { preview: CheckoutPreview; courseName: (courseId: string) => string }) {
  const m = (n: number) => previewMoney(n, p.currency);
  const count = p.items.length;
  const codeLabel = p.grantNameAr
    ? `${p.grantNameAr} — ${p.grantPct}٪`
    : p.firstPurchasePct
      ? `خصم أول عملية شراء — ${p.firstPurchasePct}٪`
      : `الكود ${p.couponCode ?? ""}`;
  const codeCourses = p.items.filter((i) => i.couponApplies);
  const partial = p.couponDiscount > 0 && codeCourses.length < count;
  return (
    <div className="space-y-2 text-xs" data-testid="buy-link-preview">
      {count > 0 && (
        <dl className="space-y-1">
          <Row label={count === 1 ? "سعر الدورة" : `مجموع ${count} دورات`} value={m(p.subtotal)} />
          {p.bundleDiscount > 0 && <Row tone="save" label={`خصم بناء المسار — ${p.bundlePct}٪`} value={`−${m(p.bundleDiscount)}`} />}
          {p.capDiscount > 0 && <Row tone="save" label="الحد الأعلى لسعر المسار" value={`−${m(p.capDiscount)}`} />}
          {p.planCredit > 0 && <Row tone="save" label="خصم إكمال خطتك" value={`−${m(p.planCredit)}`} />}
          {p.couponDiscount > 0 && <Row tone="save" label={codeLabel} value={`−${m(p.couponDiscount)}`} />}
          <div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-2">
            <dt className="text-fine text-muted-foreground">ما تدفعه</dt>
            <dd dir="ltr" className="text-[26px] font-black leading-none text-foreground">{m(p.total)}</dd>
          </div>
        </dl>
      )}

      {/* لماذا طُبّق هذا ولم يُطبّق ذاك — من قواعد الدفع نفسِها */}
      {p.grantNameAr && p.couponDiscount > 0 && (
        <p className="text-read leading-5 text-muted-foreground">
          {p.grantNameAr} بدل خصم بناء المسار، ولا يجتمعان. طبقنا الأفضل لك.
        </p>
      )}
      {!p.grantNameAr && p.couponDiscount > 0 && p.bundleDiscount > 0 && (
        <p className="text-read leading-5 text-muted-foreground">الكود يطبق بعد خصم بناء المسار. كود واحد في كل طلب.</p>
      )}
      {partial && (
        <p className="text-read leading-5 text-muted-foreground">
          الكود على: {codeCourses.map((i) => courseName(i.courseId)).join("، ")}.
        </p>
      )}

      {p.couponError && (
        <p className="text-read leading-5 text-gold-ink" data-testid="buy-link-coupon-error">
          لم نطبق الكود: {p.couponError.messageAr} السعر أعلاه بدونه.
        </p>
      )}
      {p.excluded.map((e) => (
        <p key={e.cohortId} className="text-read leading-5 text-gold-ink">
          استبعدنا «{courseName(e.courseId)}»: {e.messageAr}
        </p>
      ))}
      {p.unknownCohorts > 0 && (
        <p className="text-read leading-5 text-gold-ink">في الرابط شعبة غير موجودة، فتجاهلناها.</p>
      )}
      {!p.accountChecked && (
        <p className="text-fine leading-5 text-muted-foreground">
          نتأكد بعد دخولك من أنك غير مسجل في هذه الدورات ومن أهليتك للكود. والسعر النهائي يثبت عند الدفع.
        </p>
      )}
    </div>
  );
}

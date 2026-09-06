/* «مقعدك محجوز» — النافذةُ بين الدفع وتأكيده تُقال باسمها.

   بين ضغطة الدفع ووصول webhook المزوّد تمرّ دقائق. وكانت بوابةُ المتعلّم
   عمياءَ فيها: «تعلّمي» لا تعرض إلّا `enrollment`، والحجزُ ليس تسجيلا، فيقرأ
   من دفع «لا شعب مسجلة بعد» ويرى «اشترِ الآن» على الدورة نفسِها — فيظنّ أنّ
   دفعه ضاع، أو يضغط فيُنشئ طلبا ثانيا فوق مقعدٍ دفع ثمنَه.

   فهذه البطاقةُ تحلّ محلّ زرّ الشراء ما دام المقعد محجوزا: تقول أدُفع فينتظر
   تأكيد البنك، أم لم يكتمل دفعُه فيُكمَل من «الفواتير» — بطلبه نفسِه. */

import { Link } from "react-router";
import { Clock, CreditCard } from "lucide-react";

export interface HeldSeat {
  requestId: string;
  cohortId: string;
  cohortTitle: string;
  courseId: string;
  courseTitleAr: string;
  startsAt: string | null;
  status: string;
  orderId: string | null;
  orderStatus: string | null;
  invoiceNumber: string | null;
  total: number | null;
  currency: string | null;
}

export default function HeldSeatNotice({ seat, className = "" }: { seat: HeldSeat; className?: string }) {
  /* ثلاثُ حالاتٍ لا حالتان: دُفع فينتظر تأكيد المزوّد، أو طلبٌ لم يكتمل
     دفعُه، أو حجزٌ بلا طلبٍ أصلا — وهو طلبُ مراجعةٍ إداريّة لا دفعةٌ ناقصة.
     وقولُ «دفعتك لم تكتمل» لمن لم يُطالَب بدفعٍ بعد يُقلقه بلا سبب. */
  const paid = seat.orderStatus === "paid";
  const unpaid = seat.orderStatus === "pending_payment";
  const tone = paid
    ? "border-teal/40 bg-teal/[0.07] text-teal-light-ink"
    : unpaid
      ? "border-gold/40 bg-gold/[0.06] text-gold-ink"
      : "border-white/15 bg-white/[0.03] text-foreground";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone} ${className}`}>
      <p className="flex items-center gap-2 text-[12px] font-black">
        {unpaid ? <CreditCard className="h-3.5 w-3.5 shrink-0" /> : <Clock className="h-3.5 w-3.5 shrink-0" />}
        {paid
          ? "مقعدك محجوز — نؤكّد دفعتك مع البنك"
          : unpaid
            ? "مقعدك محجوز — دفعتك لم تكتمل"
            : "طلبك قيد المراجعة — مقعدك محفوظ"}
      </p>
      <p className="mt-1.5 text-fine leading-6 text-muted-foreground">
        {paid ? (
          <>
            استلمنا دفعتك عن «{seat.courseTitleAr}» ({seat.cohortTitle}) ولا تدفع مرّةً أخرى.
            تظهر الشعبة في «تعلّمي» فور تأكيد المزوّد — عادةً خلال دقائق.
          </>
        ) : unpaid ? (
          <>
            حُجز مقعدك في «{seat.courseTitleAr}» ({seat.cohortTitle}) بطلبٍ لم يكتمل دفعُه — أكمله
            بطلبه نفسِه ولا تُنشئ طلبا ثانيا فوقه.
          </>
        ) : (
          <>
            طلبك على «{seat.courseTitleAr}» ({seat.cohortTitle}) قيد المراجعة — نحجز مقعدك ثمّ تصلك
            فاتورتُه، ولا يُطلب منك دفعٌ قبل ذلك.
          </>
        )}
        {seat.invoiceNumber && (
          <>
            {" "}فاتورة <span dir="ltr" className="font-mono">{seat.invoiceNumber}</span>
            {seat.total !== null && seat.currency && (
              <> — <span dir="ltr">{seat.total.toLocaleString("en-US")} {seat.currency}</span></>
            )}
          </>
        )}
      </p>
      {(paid || unpaid) && (
        <Link
          to="/student/billing"
          className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-fine font-bold text-foreground transition hover:border-white/40"
        >
          {paid ? "تفاصيل الفاتورة" : "أكمل الدفع من الفواتير"}
        </Link>
      )}
    </div>
  );
}

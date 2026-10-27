/* نجومُ المحطّة — نجمةٌ لكلّ نوعٍ فيها: اكتمل محورُها · حضر · قُبل عملُه (`stage-path.ts`).
   والأولى ليست «قرأ»: المحورُ يكتمل بدليلٍ (عملٌ مقبول أو تقييمٌ مجتاز أو حضورٌ حيث لا عمل)
   لا بفتح صفحته — فكان العنوانُ «نجمة للقراءة» يَعِد بما لا تعطيه القراءة (٢٧ أكتوبر ٢٠٢٦).
   تسكن ملفّا وحدَها لأنّ شاشتين ترسمانها: صفحةُ الدورة وشاشةُ الدراسة —
   ونجومُ المحطّة الواحدة لا تُرسم بشكلين. */

import { Star } from "lucide-react";

export default function StopStars({ stars }: { stars: { earned: number; total: number } }) {
  if (stars.total === 0) return null;
  return (
    <span
      className="flex shrink-0 items-center gap-0.5"
      role="img"
      aria-label={`${stars.earned} من ${stars.total} نجوم`}
      title="نجمة حين يكتمل المحور، ونجمة للحضور، ونجمة حين يقبل عملك"
    >
      {Array.from({ length: stars.total }, (_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={`h-3.5 w-3.5 ${i < stars.earned ? "fill-gold text-gold" : "text-muted-foreground/40"}`}
        />
      ))}
    </span>
  );
}

/* لوحة تقييمٍ واحدة — يشترك فيها المدرّب والمستشار: نفس شكل البيانات من
   `GET /api/me/ratings` (حقل `trainer` أو `advisor` حسب الدور)، ونفس عتبة
   إخفاء الهوية. استُخرجت من صفحة المدرّب لتُستخدم في بوابة المستشار أيضا
   دون تكرار الشيفرة. */

import { MessageSquareQuote, ShieldCheck, Star } from "lucide-react";

export interface RatingsHidden { revealed: false; count: number; avg: null; noticeAr: string }
export interface RatingsShown {
  revealed: true; count: number; avg: number | null;
  distribution: { score: number; count: number }[];
  comments: { score: number; commentAr: string }[];
}
export type RatingsSubjectView = RatingsHidden | RatingsShown;
export interface MyRatingsResponse { trainer?: RatingsSubjectView; advisor?: RatingsSubjectView }

export function RatingsPanel({ titleAr, view }: { titleAr: string; view: RatingsSubjectView }) {
  if (!view.revealed) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-black">{titleAr}</h2>
        <p className="mt-3 flex items-start gap-2.5 text-[12px] leading-6 text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-light-ink" />
          {view.noticeAr}
        </p>
      </section>
    );
  }
  const max = Math.max(1, ...view.distribution.map((d) => d.count));
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-black">{titleAr}</h2>
        <span className="text-[11px] text-muted-foreground">{view.count} تقييما</span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Star className="h-7 w-7 fill-gold text-gold" />
        <span className="text-3xl font-black">{view.avg?.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground">من ٥</span>
      </div>

      <div className="mt-5 space-y-1.5">
        {[...view.distribution].reverse().map((d) => (
          <div key={d.score} className="flex items-center gap-2 text-[11px]">
            <span className="w-8 shrink-0 text-muted-foreground">{d.score} ★</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <span className="block h-full rounded-full bg-teal" style={{ width: `${(d.count / max) * 100}%` }} />
            </span>
            <span className="w-6 shrink-0 text-left text-muted-foreground">{d.count}</span>
          </div>
        ))}
      </div>

      {view.comments.length > 0 && (
        <div className="mt-6 space-y-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
            <MessageSquareQuote className="h-3.5 w-3.5" /> التعليقات — بلا ترتيب زمنيّ ولا صاحب
          </p>
          {view.comments.map((c, i) => (
            <blockquote key={i} className="rounded-xl border border-white/[0.07] bg-paper/20 px-4 py-3">
              <span className="mb-1 block text-micro font-bold text-gold">{c.score} ★</span>
              <p className="text-[12px] leading-6 text-foreground">{c.commentAr}</p>
            </blockquote>
          ))}
        </div>
      )}
    </section>
  );
}

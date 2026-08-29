/* ما قيل عنّي (١و) — سطح المدرّب والمستشار.

   الصفحة تعرض ما وصل مجمّعا، ولا تعرض شيئا تحت عتبة إخفاء الهوية. والامتناع
   يُشرَح لا يُصمَت عليه: مدرّبٌ يرى «لا شيء» بلا سبب يظنّ أن أحدا لم يقيّمه،
   وهو ظنٌّ خاطئ يبني عليه. */

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquareQuote, ServerOff, ShieldCheck, Star } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { apiGet, ApiError } from "@/services/api";

interface Hidden { revealed: false; count: number; avg: null; noticeAr: string }
interface Shown {
  revealed: true; count: number; avg: number | null;
  distribution: { score: number; count: number }[];
  comments: { score: number; commentAr: string }[];
}
type SubjectView = Hidden | Shown;
interface MyRatingsResponse { trainer?: SubjectView; advisor?: SubjectView }

function Panel({ titleAr, view }: { titleAr: string; view: SubjectView }) {
  if (!view.revealed) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-black">{titleAr}</h2>
        <p className="mt-3 flex items-start gap-2.5 text-[12px] leading-6 text-white/55">
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
        <span className="text-[11px] text-white/45">{view.count} تقييما</span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Star className="h-7 w-7 fill-gold text-gold" />
        <span className="text-3xl font-black">{view.avg?.toFixed(1)}</span>
        <span className="text-xs text-white/40">من ٥</span>
      </div>

      <div className="mt-5 space-y-1.5">
        {[...view.distribution].reverse().map((d) => (
          <div key={d.score} className="flex items-center gap-2 text-[11px]">
            <span className="w-8 shrink-0 text-white/45">{d.score} ★</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <span className="block h-full rounded-full bg-teal" style={{ width: `${(d.count / max) * 100}%` }} />
            </span>
            <span className="w-6 shrink-0 text-left text-white/40">{d.count}</span>
          </div>
        ))}
      </div>

      {view.comments.length > 0 && (
        <div className="mt-6 space-y-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-white/50">
            <MessageSquareQuote className="h-3.5 w-3.5" /> التعليقات — بلا ترتيب زمنيّ ولا صاحب
          </p>
          {view.comments.map((c, i) => (
            <blockquote key={i} className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3">
              <span className="mb-1 block text-[10px] font-bold text-gold">{c.score} ★</span>
              <p className="text-[12px] leading-6 text-white/70">{c.commentAr}</p>
            </blockquote>
          ))}
        </div>
      )}
    </section>
  );
}

export default function MyRatings() {
  const [data, setData] = useState<MyRatingsResponse>({});
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setOffline(null);
    try {
      setData(await apiGet<MyRatingsResponse>("/api/me/ratings"));
    } catch (e) {
      setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <TrainerLayout title="ما قيل عنّي">
      <p className="mb-6 max-w-2xl text-[12px] leading-6 text-white/55">
        التقييمات تصلك <span className="font-bold text-white/75">مجمّعة وبلا أسماء</span>، ولا يُعرض
        منها شيء حتى تبلغ ثلاثة عن الهدف الواحد — في العدد القليل يُستدلّ على أصحاب
        الآراء مهما حُذفت الأسماء، وحمايتُهم شرطُ صدقهم معك.
      </p>

      {offline && (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center">
          <ServerOff className="h-10 w-10 text-white/20" />
          <p className="mt-3 max-w-md text-sm leading-7 text-white/55">{offline}</p>
        </div>
      )}

      {!offline && loading && (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>
      )}

      {!offline && !loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.trainer && <Panel titleAr="بصفتي مدرّبا" view={data.trainer} />}
          {data.advisor && <Panel titleAr="بصفتي مستشارا" view={data.advisor} />}
        </div>
      )}
    </TrainerLayout>
  );
}

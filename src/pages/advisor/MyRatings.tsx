/* ما قيل عنّي — بوابة المستشار.

   `GET /api/me/ratings` يعيد بالفعل حقل `advisor` لكل من يحمل صلاحية
   `rating.view.subject` — والمدرّب يرى صفحته المقابلة منذ زمن. هذه نفس
   اللوحة (`RatingsPanel`) بإطار بوابة المستشار، لا صفحة موازية جديدة. */

import { useCallback, useEffect, useState } from "react";
import { Loader2, ServerOff } from "lucide-react";
import AdvisorLayout from "./AdvisorLayout";
import { apiGet, ApiError } from "@/services/api";
import { RatingsPanel, type MyRatingsResponse } from "@/components/RatingsPanel";

export default function AdvisorMyRatings() {
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
    <AdvisorLayout title="ما قيل عنّي">
      <p className="mb-6 max-w-2xl text-[12px] leading-6 text-muted-foreground">
        التقييمات تصلك <span className="font-bold text-foreground">مجمّعة وبلا أسماء</span>، ولا يُعرض
        منها شيء حتى تبلغ ثلاثة عن الهدف الواحد — في العدد القليل يُستدلّ على أصحاب
        الآراء مهما حُذفت الأسماء، وحمايتُهم شرطُ صدقهم معك.
      </p>

      {offline && (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center">
          <ServerOff className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
        </div>
      )}

      {!offline && loading && (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>
      )}

      {!offline && !loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.advisor && <RatingsPanel titleAr="بصفتي مستشارا" view={data.advisor} />}
        </div>
      )}
    </AdvisorLayout>
  );
}

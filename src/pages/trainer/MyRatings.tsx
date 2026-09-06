/* ما قيل عنّي (١و) — سطح المدرّب والمستشار.

   الصفحة تعرض ما وصل مجمّعا، ولا تعرض شيئا تحت عتبة إخفاء الهوية. والامتناع
   يُشرَح لا يُصمَت عليه: مدرّبٌ يرى «لا شيء» بلا سبب يظنّ أن أحدا لم يقيّمه،
   وهو ظنٌّ خاطئ يبني عليه. */

import { useCallback, useEffect, useState } from "react";
import { Loader2, ServerOff } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { apiGet, ApiError } from "@/services/api";
import { RatingsPanel, type MyRatingsResponse } from "@/components/RatingsPanel";

import { Panel } from "@/components/ui/Surface";
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
      <p className="mb-6 max-w-2xl text-[12px] leading-6 text-muted-foreground">
        التقييمات تصلك <span className="font-bold text-foreground">مجمّعة وبلا أسماء</span>، ولا يُعرض
        منها شيء حتى تبلغ ثلاثة عن الهدف الواحد — في العدد القليل يُستدلّ على أصحاب
        الآراء مهما حُذفت الأسماء، وحمايتُهم شرطُ صدقهم معك.
      </p>

      {offline && (
        <Panel className="grid place-items-center py-16 text-center">
          <ServerOff className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
        </Panel>
      )}

      {!offline && loading && (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>
      )}

      {!offline && !loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.trainer && <RatingsPanel titleAr="بصفتي مدرّبا" view={data.trainer} />}
          {data.advisor && <RatingsPanel titleAr="بصفتي مستشارا" view={data.advisor} />}
        </div>
      )}
    </TrainerLayout>
  );
}

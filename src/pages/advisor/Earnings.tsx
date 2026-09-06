/* عمولتي — بوابة المستشار.

   الإدارة تُعيّن نسبة العمولة وتحسب المستحقّ منها في «إدارة المستشارين»
   (`/admin/advisors`) منذ أن بُنيت — ولم يكن للمستشار نفسه أيّ نافذة على
   هذا الرقم، رغم أنه يخصّه هو لا أحدا غيره. */

import { useCallback, useEffect, useState } from "react";
import { Banknote, Loader2, ServerOff, Star } from "lucide-react";
import AdvisorLayout from "./AdvisorLayout";
import { apiGet, ApiError } from "@/services/api";
import { fmtMoney } from "@/application/text/format-ar";

import { Panel, Card } from "@/components/ui/Surface";
interface AdvisorEarnings {
  commissionPct: number | null;
  commissionOwed: number | null;
  revenueFromReferrals: number;
  currency: string;
  activeCases: number;
  ratingAvg: number | null;
  ratingCount: number;
}

export default function AdvisorEarnings() {
  const [data, setData] = useState<AdvisorEarnings | null>(null);
  const [offline, setOffline] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await apiGet<AdvisorEarnings>("/api/advisor/earnings")); }
    catch (e) { setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل"); }
  }, []);

  /* استدعاء غير متزامن: لا setState يجري قبل أول await، فالتصيير
     المتتالي الذي تحذّر منه القاعدة لا يقع هنا. القاعدة لا ترى عبر
     الحدّ غير المتزامن فتَعُدّ كل دالة تنتهي بـsetState متزامنة. */
  // eslint-disable-next-line react-hooks/set-state-in-effect -- setState بعد await لا قبله
  useEffect(() => { void load(); }, [load]);

  if (offline) {
    return (
      <AdvisorLayout title="عمولتي">
        <Panel className="grid place-items-center py-16 text-center">
          <ServerOff className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
        </Panel>
      </AdvisorLayout>
    );
  }
  if (!data) {
    return (
      <AdvisorLayout title="عمولتي">
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>
      </AdvisorLayout>
    );
  }

  return (
    <AdvisorLayout title="عمولتي">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted-foreground">نسبة عمولتي</p>
          <p className="mt-2 text-2xl font-black">
            {data.commissionPct !== null ? `${data.commissionPct}%` : "لم تُتّفق بعد"}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground">إيراد عملائي الدافعين</p>
          <p className="mt-2 text-2xl font-black" dir="ltr">{fmtMoney(data.revenueFromReferrals, data.currency)}</p>
        </Card>
        <div className="rounded-2xl border border-teal/30 bg-teal/5 p-5">
          <p className="text-xs text-teal-light-ink">عمولتي المستحقّة</p>
          <p className="mt-2 text-2xl font-black text-teal-light-ink" dir="ltr">
            {data.commissionOwed !== null ? fmtMoney(data.commissionOwed, data.currency) : "—"}
          </p>
        </div>
      </div>

      <Card className="mt-4 flex flex-wrap items-center gap-4">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Banknote className="h-4 w-4 text-muted-foreground" /> {data.activeCases} حالة نشطة مسندة إليّ
        </p>
        {data.ratingAvg !== null ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Star className="h-4 w-4 fill-gold text-gold" /> {data.ratingAvg.toFixed(1)} من ٥ — {data.ratingCount} تقييما
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">لا يظهر تقييمك بعد — يُحسب من ثلاثة تقييمات فأكثر</p>
        )}
      </Card>

      <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-center text-[11px] leading-6 text-muted-foreground">
        الإيراد محسوب من الطلبات المدفوعة فعلا لعملائك ضمن حالاتك النشطة، والعمولة نسبةٌ تُعيّنها الإدارة —
        لأي استفسار عن الرقم أو النسبة تواصل مع منسّقك.
      </p>
    </AdvisorLayout>
  );
}

/* عمولتي — بوابة المستشار.

   الإدارة تُعيّن نسبة العمولة وتحسب المستحقّ منها في «إدارة المستشارين»
   (`/admin/advisors`) منذ أن بُنيت — ولم يكن للمستشار نفسه أيّ نافذة على
   هذا الرقم، رغم أنه يخصّه هو لا أحدا غيره.

   وكشوفُه الشهريّة هنا (١٩ أكتوبر ٢٠٢٦): ما صُرف له، وما ينتظر في كشف، وما لم يدخل
   كشفا بعدُ — وكلُّ كشفٍ ببنوده من ساعة يولد. والعلّةُ في `advisor-payout.service.ts`. */

import { useCallback, useEffect, useState } from "react";
import { Banknote, Loader2, ServerOff, Star } from "lucide-react";
import AdvisorLayout from "./AdvisorLayout";
import { apiGet, ApiError } from "@/services/api";
import { fmtDate, fmtMoney } from "@/application/text/format-ar";
import { PAYOUT_STATUS_AR, type AdvisorPayoutStatus } from "@/application/advisor/payout";

import { Panel, Card } from "@/components/ui/Surface";
interface PayoutItem { id: string; kind: string; descriptionAr: string; base: number; amount: number; voided: boolean }
interface Payout {
  id: string; periodAr: string; status: AdvisorPayoutStatus; commissionPct: number; total: number; currency: string;
  paidAt: string | null; paidRefAr: string | null; cancelReasonAr: string | null; items: PayoutItem[];
}
interface AdvisorEarnings {
  commissionPct: number | null;
  commissionOwed: number | null;
  paid: number;
  awaiting: number;
  upcoming: number;
  payouts: Payout[];
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-read text-muted-foreground">نسبة عمولتي</p>
          <p className="mt-2 text-2xl font-black">
            {data.commissionPct !== null ? `${data.commissionPct}%` : "لم تتّفق بعد"}
          </p>
        </Card>
        <Card>
          <p className="text-read text-muted-foreground">صرف لي</p>
          <p className="mt-2 text-2xl font-black" dir="ltr">{fmtMoney(data.paid, data.currency)}</p>
        </Card>
        <Card tone="accent">
          <p className="text-read text-teal-light-ink">ينتظر الصرف</p>
          <p className="mt-2 text-2xl font-black text-teal-light-ink" dir="ltr">{fmtMoney(data.awaiting, data.currency)}</p>
        </Card>
        <Card>
          <p className="text-read text-muted-foreground">يدخل الكشف القادم</p>
          <p className="mt-2 text-2xl font-black" dir="ltr">
            {data.commissionPct !== null ? fmtMoney(data.upcoming, data.currency) : "—"}
          </p>
        </Card>
      </div>

      <Card className="mt-4 flex flex-wrap items-center gap-4">
        <p className="flex items-center gap-2 text-read text-muted-foreground">
          <Banknote className="h-4 w-4 text-muted-foreground" /> {data.activeCases} حالة نشطة مسندة إليّ
        </p>
        <p className="text-read text-muted-foreground">
          دفعات طلابي وهم عندي: <span dir="ltr">{fmtMoney(data.revenueFromReferrals, data.currency)}</span>
        </p>
        {data.ratingAvg !== null ? (
          <p className="flex items-center gap-1.5 text-read text-muted-foreground">
            <Star className="h-4 w-4 fill-gold text-gold" /> {data.ratingAvg.toFixed(1)} من ٥ — {data.ratingCount} تقييما
          </p>
        ) : (
          <p className="text-read text-muted-foreground">لا يظهر تقييمك بعد — يحسب من ثلاثة تقييمات فأكثر</p>
        )}
      </Card>

      <h2 className="mt-8 text-lg font-black">كشوفي</h2>
      {data.payouts.length === 0 ? (
        <Card as="p" className="mt-3 text-read text-muted-foreground">لا كشف بعد. يولد كشفك بعد نهاية كل شهر.</Card>
      ) : (
        <div className="mt-3 grid gap-3">
          {data.payouts.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black">كشف {p.periodAr}</p>
                <p className="text-read text-muted-foreground">
                  {PAYOUT_STATUS_AR[p.status]} · <span dir="ltr">{fmtMoney(p.total, p.currency)}</span>
                </p>
              </div>
              <ul className="mt-3 grid gap-1.5">
                {p.items.map((i) => (
                  <li key={i.id} className="flex flex-wrap justify-between gap-2 text-read">
                    <span className={i.amount < 0 ? "text-gold-ink" : undefined}>{i.descriptionAr}</span>
                    <span dir="ltr" className={i.amount < 0 ? "text-gold-ink" : undefined}>
                      {fmtMoney(i.amount, p.currency)} من {fmtMoney(i.base, p.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              {p.status === "paid" && p.paidAt && (
                <p className="mt-3 text-read text-muted-foreground">
                  صرف في {fmtDate(p.paidAt)}{p.paidRefAr ? ` — مرجع الحوالة ${p.paidRefAr}` : ""}
                </p>
              )}
              {p.status === "cancelled" && p.cancelReasonAr && (
                <p className="mt-3 text-read text-muted-foreground">سبب الإلغاء: {p.cancelReasonAr}. تعود دفعاته إلى الكشف التالي.</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card as="p" className="mt-6 px-5 py-4 text-center text-read leading-6 text-muted-foreground">
        العمولة على ما دفعه طلابك وهم عندك، بنسبة تحددها الإدارة. يولد كشف كل شهر، تعتمده الإدارة ثم تصرفه.
        وما يسترد من دفعة يحسم في الكشف التالي. لأي استفسار تواصل مع منسقك.
      </Card>
    </AdvisorLayout>
  );
}

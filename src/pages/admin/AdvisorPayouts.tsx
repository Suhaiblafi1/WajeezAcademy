/* كشوفُ عمولة المستشارين — شاشةُ من يصرف (١٩ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «A» — كشوفٌ شهريّةٌ كالمدرّبين. لكلّ مستشارٍ كشفُ شهرٍ ببنوده: يُعتمد
   ثمّ يُصرف، أو يُلغى بسببٍ فتعود دفعاتُه إلى الكشف التالي. وكلُّ فعلٍ بتأكيدٍ يقول ما سيقع.
   والحسابُ في `server/services/advisor-payout.service.ts`. */

import { useCallback, useEffect, useState } from "react";
import { Loader2, ServerOff } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { toast, toastError } from "@/components/Toast";
import ConfirmAction from "@/components/ConfirmAction";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { fmtDate, fmtMoney } from "@/application/text/format-ar";
import { PAYOUT_STATUS_AR, periodAr, type AdvisorPayoutStatus } from "@/application/advisor/payout";
import { Panel, Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

interface PayoutItem { id: string; kind: string; descriptionAr: string; base: number; amount: number; voided: boolean }
interface MaskedBank {
  id: string; maskedAr: string; holderName: string; bankNameAr: string; branchAr: string | null;
  swiftBic: string | null; accountKind: string; routingCode: string | null; outcome: string; outcomeSaidAr: string;
}
interface Payout {
  id: string; advisorName: string; period: string; periodAr: string; status: AdvisorPayoutStatus;
  commissionPct: number; total: number; currency: string;
  paidAt: string | null; paidRefAr: string | null; cancelReasonAr: string | null; items: PayoutItem[];
  bankAccount: MaskedBank | null; revealed: boolean;
}
interface Summary {
  advisorId: string; name: string; commissionPct: number | null;
  paid: number; awaiting: number; upcoming: number; currency: string;
}
interface Data { payouts: Payout[]; summaries: Summary[]; lastClosedPeriod: string }

type Pending = { kind: "approve" | "reveal" | "pay" | "cancel"; payout: Payout } | null;

export default function AdminAdvisorPayouts() {
  const [data, setData] = useState<Data | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [status, setStatus] = useState<"" | AdvisorPayoutStatus>("");
  const [refs, setRefs] = useState<Record<string, string>>({});
  /* الرقمُ الصريحُ يبقى في الشاشة وحدَها — لا يُحفظ ولا يعود بعد تحديثها */
  const [ibans, setIbans] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await apiGet<Data>(`/api/admin/advisor-payouts${status ? `?status=${status}` : ""}`)); }
    catch (e) { setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل"); }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const { created } = await apiPost<{ created: number }>("/api/admin/advisor-payouts/generate", { period: data.lastClosedPeriod });
      toast(created === 0 ? "لا كشف جديد لهذا الشهر" : `ولد ${created} كشف`);
      await load();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر الاتصال بالخادم"); }
    finally { setBusy(false); }
  };

  const act = async (reason?: string) => {
    if (!confirm) return;
    const { kind, payout } = confirm;
    setBusy(true);
    try {
      if (kind === "approve") await apiPost(`/api/admin/advisor-payouts/${payout.id}/approve`, {});
      if (kind === "reveal") {
        const { iban } = await apiPost<{ iban: string }>(`/api/admin/advisor-payouts/${payout.id}/bank-account/reveal`, {});
        setIbans((m) => ({ ...m, [payout.id]: iban }));
      }
      if (kind === "pay") await apiPost(`/api/admin/advisor-payouts/${payout.id}/pay`, { ref: refs[payout.id]?.trim() || undefined });
      if (kind === "cancel") await apiPost(`/api/admin/advisor-payouts/${payout.id}/cancel`, { reason });
      toast(kind === "approve" ? "اعتمد الكشف" : kind === "reveal" ? "كشف رقم الحساب وسجل الكشف" : kind === "pay" ? "سجل الصرف" : "ألغي الكشف");
      setConfirm(null);
      await load();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر الاتصال بالخادم"); }
    finally { setBusy(false); }
  };

  if (offline) {
    return (
      <AdminLayout title="كشوف عمولة المستشارين">
        <Panel className="grid place-items-center py-16 text-center">
          <ServerOff className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
        </Panel>
      </AdminLayout>
    );
  }
  if (!data) {
    return (
      <AdminLayout title="كشوف عمولة المستشارين">
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="كشوف عمولة المستشارين">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-read text-muted-foreground">
          يولد كشف لكل مستشار بعد نهاية الشهر. وإن لم يظهر بعد ولده الآن.
        </p>
        <Button onClick={() => void generate()} disabled={busy}>ولد كشوف {periodAr(data.lastClosedPeriod)}</Button>
      </Card>

      <h2 className="mt-6 text-lg font-black">المستشارون</h2>
      {data.summaries.length === 0 ? (
        <Card as="p" className="mt-3 text-read text-muted-foreground">لا مستشار له نسبة عمولة بعد.</Card>
      ) : (
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full text-read">
            <thead>
              <tr className="text-muted-foreground">
                <th className="p-2 text-start">المستشار</th>
                <th className="p-2 text-start">النسبة</th>
                <th className="p-2 text-start">صرف</th>
                <th className="p-2 text-start">ينتظر الصرف</th>
                <th className="p-2 text-start">لم يدخل كشفا</th>
              </tr>
            </thead>
            <tbody>
              {data.summaries.map((s) => (
                <tr key={s.advisorId} className="border-t border-border">
                  <td className="p-2 font-bold">{s.name}</td>
                  <td className="p-2">{s.commissionPct !== null ? `${s.commissionPct}%` : "—"}</td>
                  <td className="p-2" dir="ltr">{fmtMoney(s.paid, s.currency)}</td>
                  <td className="p-2" dir="ltr">{fmtMoney(s.awaiting, s.currency)}</td>
                  <td className="p-2" dir="ltr">{fmtMoney(s.upcoming, s.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black">الكشوف</h2>
        <label className="flex items-center gap-2 text-read">
          الحالة
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | AdvisorPayoutStatus)}
            className="rounded-lg border border-border bg-background px-2 py-1"
          >
            <option value="">الكل</option>
            {(Object.keys(PAYOUT_STATUS_AR) as AdvisorPayoutStatus[]).map((k) => (
              <option key={k} value={k}>{PAYOUT_STATUS_AR[k]}</option>
            ))}
          </select>
        </label>
      </div>

      {data.payouts.length === 0 ? (
        <Card as="p" className="mt-3 text-read text-muted-foreground">لا كشف هنا.</Card>
      ) : (
        <div className="mt-3 grid gap-3">
          {data.payouts.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black">{p.advisorName} — كشف {p.periodAr}</p>
                <p className="text-read text-muted-foreground">
                  {PAYOUT_STATUS_AR[p.status]} · {p.commissionPct}% · <span dir="ltr">{fmtMoney(p.total, p.currency)}</span>
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
                <p className="mt-3 text-read text-muted-foreground">سبب الإلغاء: {p.cancelReasonAr}</p>
              )}
              {(p.status === "pending" || p.status === "approved") && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {p.status === "pending" && (
                    <Button onClick={() => setConfirm({ kind: "approve", payout: p })} disabled={busy}>اعتمد</Button>
                  )}
                  {p.status === "approved" && !p.bankAccount && (
                    <p className="w-full text-read text-gold-ink">لم يدخل المستشار حسابه البنكي بعد، فلا يصرف حتى يدخله من «عمولتي».</p>
                  )}
                  {p.status === "approved" && p.bankAccount && (
                    <div className="grid w-full gap-1 text-read">
                      <p>
                        {p.bankAccount.accountKind === "local" ? "رقم الحساب" : "IBAN"}:{" "}
                        <span dir="ltr" className="font-mono font-bold">{ibans[p.id] ?? p.bankAccount.maskedAr}</span>
                        {" · "}{p.bankAccount.holderName} · {p.bankAccount.bankNameAr}{p.bankAccount.branchAr ? ` — ${p.bankAccount.branchAr}` : ""}
                        {p.bankAccount.swiftBic ? <> · SWIFT <span dir="ltr" className="font-mono">{p.bankAccount.swiftBic}</span></> : null}
                        {p.bankAccount.routingCode ? <> · <span dir="ltr" className="font-mono">{p.bankAccount.routingCode}</span></> : null}
                      </p>
                      {p.bankAccount.outcome === "differs" && <p className="text-gold-ink">⚠️ {p.bankAccount.outcomeSaidAr}</p>}
                    </div>
                  )}
                  {p.status === "approved" && p.bankAccount && !ibans[p.id] && (
                    <Button tone="secondary" onClick={() => setConfirm({ kind: "reveal", payout: p })} disabled={busy}>اكشف رقم الحساب</Button>
                  )}
                  {p.status === "approved" && p.bankAccount && (ibans[p.id] || p.revealed) && (
                    <>
                      <input
                        value={refs[p.id] ?? ""}
                        onChange={(e) => setRefs((r) => ({ ...r, [p.id]: e.target.value }))}
                        placeholder="مرجع الحوالة (اختياري)"
                        maxLength={200}
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-read"
                      />
                      <Button onClick={() => setConfirm({ kind: "pay", payout: p })} disabled={busy}>أكد الصرف</Button>
                    </>
                  )}
                  <Button tone="ghost" onClick={() => setConfirm({ kind: "cancel", payout: p })} disabled={busy}>ألغ الكشف</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {confirm?.kind === "approve" && (
        <ConfirmAction
          titleAr={`اعتماد كشف ${confirm.payout.advisorName} — ${confirm.payout.periodAr}`}
          confirmLabelAr="اعتمد" tone="default" busy={busy}
          onCancel={() => setConfirm(null)} onConfirm={() => void act()}
        >
          يصير الكشف معتمدا ينتظر الصرف، ويبلغ المستشار. ويمكن إلغاؤه ما لم يصرف.
        </ConfirmAction>
      )}
      {confirm?.kind === "reveal" && (
        <ConfirmAction
          titleAr={`كشف رقم حساب ${confirm.payout.advisorName}`}
          confirmLabelAr="اكشف الرقم" tone="default" busy={busy}
          onCancel={() => setConfirm(null)} onConfirm={() => void act()}
        >
          يظهر الرقم كاملا في هذه الشاشة فقط، ويسجل الكشف باسمك مع الكشف ومبلغه. وإن بدل المستشار حسابه بعدها فلا يقبل الصرف حتى تكشفه ثانية.
        </ConfirmAction>
      )}
      {confirm?.kind === "pay" && (
        <ConfirmAction
          titleAr={`تأكيد صرف ${fmtMoney(confirm.payout.total, confirm.payout.currency)} إلى ${confirm.payout.advisorName}`}
          confirmLabelAr="أكد الصرف" tone="default" busy={busy}
          onCancel={() => setConfirm(null)} onConfirm={() => void act()}
        >
          يصير الكشف مصروفا ولا يلغى بعدها، ويبلغ المستشار بالمبلغ{refs[confirm.payout.id]?.trim() ? " والمرجع" : ""}.
        </ConfirmAction>
      )}
      {confirm?.kind === "cancel" && (
        <ConfirmAction
          titleAr={`إلغاء كشف ${confirm.payout.advisorName} — ${confirm.payout.periodAr}`}
          confirmLabelAr="ألغ الكشف" busy={busy}
          reason={{ labelAr: "سبب الإلغاء", minLength: 5 }}
          onCancel={() => setConfirm(null)} onConfirm={(reason) => void act(reason)}
        >
          يلغى الكشف ويبلغ المستشار بالسبب. وتعود دفعاته إلى الكشف التالي، فيولد من جديد بنسبته يومها.
          وإن أردت تأخير الصرف فقط فاتركه معتمدا ولا تلغه.
        </ConfirmAction>
      )}
    </AdminLayout>
  );
}

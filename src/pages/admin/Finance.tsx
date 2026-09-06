/* المالية — API حقيقي: طلبات التسجيل (موافقة بكوبون/رفض)، فواتير ودفعات يدوية
   واستردادات، كوبونات، خطط اشتراك. */
import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import {
  BadgePercent, CheckCircle2, CreditCard, FileText, Loader2, RefreshCw,
  RotateCcw, ServerOff, Wallet, XCircle,
  Inbox, Receipt, Undo2,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import ListToolbar from "@/components/admin/ListToolbar";
import EmptyState from "@/components/EmptyState";
import { Panel, Card, Inset } from "@/components/ui/Surface";
import Chip from "@/components/ui/Chip";
import BulkBar from "@/components/admin/BulkBar";
import { bulkMessage, runBulk } from "@/application/admin/bulk";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import FlowSteps from "@/components/FlowSteps";
import { apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";
import { LEDGER_CURRENCY } from "@/application/commerce/presentment";
import { useAutoRefresh } from "@/services/useAutoRefresh";
import { useRealSession } from "@/services/session";
import { fmtDate, fmtDateTime } from "@/application/text/format-ar";
import ConfirmAction from "@/components/ConfirmAction";

import Button from "@/components/ui/Button";
const inputCls = "rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none";

interface EnrollReq {
  id: string; status: string; note: string | null; createdAt: string;
  user: { displayName: string; email: string };
  cohort: { id: string; title: string; price: string | null; currency: string; course: { versions: { titleAr: string }[] } };
}
interface Invoice {
  id: string; status: string; total: string; currency: string; issuedAt: string;
  order: { user: { displayName: string; email: string }; items: { title?: string; titleAr?: string }[] };
  payments: { id: string; amount: string; status: string; method?: string | null; refunds: { id: string }[] }[];
}
interface Refund { id: string; status: string; amount: string; reason: string; createdAt: string; payment: { id: string; invoice: { id: string } } }
interface Coupon { id: string; code: string; percentOff: number | null; amountOff: string | null; currency: string; maxUses: number | null; usedCount?: number; active: boolean; expiresAt: string | null }

const ER_STATUS: Record<string, string> = { pending: "بانتظار المراجعة", seat_held: "مقعد محجوز", approved: "موافق عليه", converted: "تحوّل إلى تسجيل ✓", rejected: "مرفوض", expired: "منتهي" };
const INV_STATUS: Record<string, string> = { issued: "صادرة", paid: "مدفوعة", partially_refunded: "مستردة جزئيا", refunded: "مستردة", void: "ملغاة" };
const RF_STATUS: Record<string, string> = { requested: "مطلوب", approved: "منفذ", rejected: "مرفوض" };

type Tab = "requests" | "invoices" | "refunds" | "coupons";

export default function Finance() {
  /* ═══ الشاشةُ تعرض ما يستطيع صاحبُها، لا كلَّ ما فيها ═══

     بعد فصل المال عن الأكاديميّ صار المديرُ الأكاديميّ يملك `finance.view`
     وحدَها: يقرأ الفواتيرَ ليعرف أدفع المتعلّمُ أم لا، ولا يسجّل دفعةً ولا
     يعتمد استردادا ولا يصنع كوبونا. وبلا هذا الترشيح كان سيرى الأزرارَ
     كلَّها ويصطدم بـ٤٠٣ عند الضغط — وهي القاعدةُ نفسُها التي حكمت المرحلةَ
     الأولى: لا زرَّ يعِد بما لا تستطيعه المنصّةُ لصاحبه.

     والقراءةُ تُحصَّن أيضا: نداءُ الكوبونات يُردّ بـ٤٠٣ لمن لا يملكها، وكان
     ذلك سيُسقط الشاشةَ كلَّها في «الخادم غير متصل». */
  const { user } = useRealSession();
  const can = (key: string) => user?.permissions.includes(key) ?? false;
  const canRecordPayment = can("finance.payment.record");
  const canRefund = can("finance.refund.process");
  const canCommerce = can("commerce.manage");
  /* `finance.view` شرطُ الشاشة نفسِها: من لا يملكها لا يُعرض له لوحٌ فارغ،
     بل الرسالةُ الصريحةُ التي يقولها الخادم (اسمُ الصلاحيّة ومن يملكها). */
  const canViewMoney = can("finance.view");
  const readOnly = canViewMoney && !canRecordPayment && !canRefund && !canCommerce;

  const [tab, setTab] = useState<Tab>("requests");
  /* بحثٌ وترقيمٌ للتبويبين اللذين يطولان بالعمل: الطلبات والفواتير.
     والاستردادُ والكوبونُ محدودان بطبيعتهما فلا يُثقلان بشريط. */
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  /* التحديدُ للطلبات المعلَّقة وحدَها — وسيأتي بيانُ لِمَ لا يشمل غيرَها */
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState("");
  /* الفعلُ الجماعيُّ يُؤكَّد في نافذة المنصّة لا في حوار متصفّح: يحجز مقاعدَ
     ويُصدر فواتيرَ لعشراتٍ في ضغطةٍ واحدة، والرفضُ يصل صاحبَه بسببه. */
  const [bulkConfirm, setBulkConfirm] = useState<"approve" | "reject" | null>(null);
  /* رفضُ طلبٍ واحد — بالنافذة نفسِها التي يُرفض بها عشرون */
  const [rejecting, setRejecting] = useState<{ id: string; whoAr: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<EnrollReq[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponForm, setCouponForm] = useState({ code: "", percentOff: "", amountOff: "", maxUses: "", expiresAt: "" });
  const [planForm, setPlanForm] = useState({ code: "", nameAr: "", price: "", intervalMonths: "1", features: "" });
  const [couponFor, setCouponFor] = useState<Record<string, string>>({});
  const [payForm, setPayForm] = useState<Record<string, string>>({});
  const [refundForm, setRefundForm] = useState<Record<string, { amount: string; reason: string }>>({});

  const load = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setOffline(null); }
    try {
      /* الممنوعُ من قائمةٍ لا يُسقط الشاشة: يعود فارغا ويبقى ما يستطيع */
      const allowed = async <T,>(p: Promise<T[]>): Promise<T[]> => {
        try { return await p } catch (e) { if (e instanceof ApiError && e.status === 403) return []; throw e }
      };
      const [er, inv, rf, cp] = await Promise.all([
        allowed(apiGet<EnrollReq[]>("/api/admin/enrollment-requests")),
        /* والفواتيرُ لا تُلتمَس بلا صلاحيّتها: منعُها يُقال صراحةً لا يُبتلع،
           ولا يُعاد النداءُ كلَّ دقيقةٍ ليُردّ كلَّ دقيقة. */
        canViewMoney ? apiGet<Invoice[]>("/api/admin/invoices") : Promise.resolve([] as Invoice[]),
        canViewMoney ? allowed(apiGet<Refund[]>("/api/admin/refunds")) : Promise.resolve([] as Refund[]),
        canCommerce ? allowed(apiGet<Coupon[]>("/api/admin/coupons")) : Promise.resolve([] as Coupon[]),
      ]);
      setRequests(er); setInvoices(inv); setRefunds(rf); setCoupons(cp);
    } catch (e) { if (!silent) setOffline(permissionMessage(e, "الخادم غير متصل")); }
    finally { if (!silent) setLoading(false); }
  }, [canCommerce, canViewMoney]);

  useEffect(() => { void load(); }, [load]);
  /* نبض صامت كل دقيقة — طلبات التسجيل والفواتير تتحدث دون تحديث يدوي */
  const silentReload = useCallback(() => { void load(true); }, [load]);
  useAutoRefresh(silentReload, 60_000);

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(doneMsg); await load(); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  };

  if (offline) {
    return (
      <AdminLayout title="المالية">
        <EmptyState
          icon={ServerOff}
          titleAr="الخادم لا يجيب"
          reasonAr={offline}
          actions={[{ onClick: () => void load(), labelAr: "إعادة المحاولة", hintAr: "تُعاد قراءةُ الطلبات والفواتير" }]}
        />
      </AdminLayout>
    );
  }

  const tabs: [Tab, string, number][] = [
    ["requests", "طلبات التسجيل", requests.filter((r) => r.status === "pending").length],
    ...(canViewMoney ? ([
      ["invoices", "الفواتير", invoices.length],
      ["refunds", "الاستردادات", refunds.filter((r) => r.status === "requested").length],
    ] as [Tab, string, number][]) : []),
    /* الكوبوناتُ والخططُ بندٌ ماليّ — لا تُعرض لمن لا يملك `commerce.manage` */
    ...(canCommerce ? [["coupons", "الكوبونات والخطط", coupons.length] as [Tab, string, number]] : []),
  ];

    /* الجماعيُّ على المعلَّق وحدَه.

     «وافق» تحجز مقعدا وتُصدر فاتورة، و«ارفض» تُغلق الطلبَ وتُخبر صاحبَه —
     وكلاهما لا يصحّ إلّا على `pending`. ولو سُمح بتحديد ما تحوّل أو رُفض
     سلفا لصار نصفُ الدفعة إخفاقا لا سببَ له إلّا أنّا عرضناه. */
  const selectable = requests.filter((r) => r.status === "pending");
  const toggleSel = (id: string) => setSel((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const bulkRequests = async (kind: "approve" | "reject", reason?: string) => {
    if (busy || sel.size === 0) return;
    setBusy(true); setBulkProgress("");
    const outcome = await runBulk(
      [...sel],
      (id) => kind === "approve"
        /* لا كوبونَ في الجماعيّ: الكوبونُ قرارٌ لصفٍّ بعينه، وتعميمُه على
           دفعةٍ يمنح خصما لمن لم يُقصد. */
        ? apiPost(`/api/admin/enrollment-requests/${id}/approve`, {})
        : apiPost(`/api/admin/enrollment-requests/${id}/reject`, { reason }),
      (done, total) => setBulkProgress(`${done} من ${total}`),
    );
    setBulkProgress("");
    setSel(new Set(outcome.failed.map((f) => f.id)));
    toast(bulkMessage(outcome, kind === "approve" ? "وُوفق" : "رُفض"));
    setBusy(false);
    await load();
  };

  const reqView = paginate(
    requests.filter((r) => matchesQuery(q, [r.user.displayName, r.user.email, r.cohort.title, r.cohort.course.versions[0]?.titleAr])),
    page, 20);
  const invView = paginate(
    invoices.filter((inv) => matchesQuery(q, [inv.order.user.displayName, inv.order.user.email, inv.id, inv.total])),
    page, 20);

  return (
    <AdminLayout title="المالية — طلبات وفواتير واستردادات وكوبونات">
      <FlowSteps steps={[
        { label: "طلب تسجيل", actor: "الطالب" },
        { label: "مراجعة وموافقة أو اعتذار", actor: "أنت هنا" },
        { label: "فاتورة تُصدر", actor: "النظام تلقائياً" },
        { label: "الدفع يُسجَّل", actor: "أنت أو بوابة الدفع" },
        { label: "المنصة تُفتح للطالب", actor: "تلقائي فور الدفع" },
      ]} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-full border border-white/15 p-1">
          {tabs.map(([k, label, n]) => (
            <button key={k} onClick={() => { setTab(k); setQ(""); setPage(1); setSel(new Set()); }}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-black transition ${tab === k ? "bg-gold text-on-gold" : "text-muted-foreground hover:text-foreground"}`}>
              {label} {n > 0 && <span className="mr-1 opacity-70">({n})</span>}
            </button>
          ))}
        </div>
        <Button tone="secondary" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </Button>
      </div>

      {/* ولا يُترك القارئُ يظنّ الشاشةَ معطوبةً لخلوّها من الأزرار: يُقال له
          ما يستطيع وما لا يستطيع ومن يستطيعه — صراحةً، مرّةً في أعلى الصفحة. */}
      {readOnly && (
        <Card as="p" className="mb-5 flex items-start gap-2 px-4 py-3 text-micro font-bold leading-6 text-muted-foreground">
          <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-ink" />
          حسابُك يقرأ المالَ ولا يحرّكه: تعرف من دفع ومن لم يدفع لتقرّر تسجيلا، وتراجع طلباتِ التسجيل.
          أمّا تسجيلُ دفعةٍ يدويّةٍ واعتمادُ استردادٍ وإنشاءُ كوبونٍ فهي بيد <b className="text-foreground">المالية</b> —
          فصلٌ مقصود: من يسجّل التسجيلَ لا يسجّل دفعتَه.
        </Card>
      )}

      {loading && <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>}

      {/* طلبات التسجيل */}
      {!loading && tab === "requests" && (
        <div className="space-y-3">
          {requests.length === 0 && (
            <EmptyState icon={Inbox} titleAr="لا طلباتِ تسجيلٍ تنتظر"
              reasonAr="طلبُ التسجيل يصل هنا حين يختار متعلّمٌ شعبةً بلا شراءٍ مباشر — والشراءُ المباشر لا يمرّ بهذه الشاشة."
              tone="done" />
          )}
          {requests.length > 0 && (
            <ListToolbar q={q} onQ={setQ} onPage={setPage} view={reqView} unit="طلبا"
              placeholder="ابحث باسمِ طالبٍ أو بريدٍ أو شعبة…" />
          )}
          {selectable.length > 0 && (
            <div className="flex items-center gap-2 text-micro text-muted-foreground">
              <input type="checkbox"
                checked={sel.size > 0 && selectable.every((r) => sel.has(r.id))}
                onChange={(e) => setSel(e.target.checked ? new Set(selectable.map((r) => r.id)) : new Set())}
                aria-label="حدّد كلّ الطلبات المعلّقة" className="h-3.5 w-3.5 cursor-pointer accent-gold" />
              حدّد كلّ المعلَّقة ({selectable.length})
            </div>
          )}
          <BulkBar count={sel.size} busy={busy} progress={bulkProgress} onClear={() => setSel(new Set())}>
            <Button tone="confirm" size="sm" onClick={() => setBulkConfirm("approve")}>
              وافق واحجز المقاعد — على {sel.size}
            </Button>
            <Button tone="danger" size="sm" onClick={() => setBulkConfirm("reject")}>
              ارفض بسبب — على {sel.size}
            </Button>
          </BulkBar>
          {requests.length > 0 && reqView.total === 0 && (
            <EmptyState icon={Inbox} titleAr="لا طلب يطابق بحثك" tone="filter"
              reasonAr={`لا شيءَ يطابق «${q.trim()}» في أسماء المتعلّمين ولا بريدهم ولا الشعب.`}
              actions={[{ onClick: () => { setQ(""); setPage(1); }, labelAr: "امسح البحث", hintAr: "تعود القائمةُ كاملةً" }]} />
          )}
          {reqView.rows.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{r.user.displayName} <span className="text-micro font-normal text-muted-foreground" dir="ltr">{r.user.email}</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.cohort.course.versions[0]?.titleAr ?? "—"} · {r.cohort.title} · {r.cohort.price ? `${r.cohort.price} ${r.cohort.currency}` : "بلا سعر"}
                  </p>
                  {r.note && <p className="mt-1 text-micro text-muted-foreground">ملاحظة المتعلم: {r.note}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <Chip tone="accent" srPrefixAr="الحالة">{ER_STATUS[r.status] ?? r.status}</Chip>
                  {r.status === "pending" && (
                    <label className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center">
                      <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)}
                        aria-label={`حدّد طلب ${r.user.displayName}`} className="h-4 w-4 cursor-pointer accent-gold" />
                    </label>
                  )}
                </div>
              </div>
              {r.status === "pending" && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
                  <input value={couponFor[r.id] ?? ""} onChange={(e) => setCouponFor({ ...couponFor, [r.id]: e.target.value })}
                    placeholder="كوبون (اختياري)" dir="ltr" className={`${inputCls} w-32 font-mono`} />
                  <Button tone="confirm" size="sm" disabled={busy}
                    onClick={() => act(() => apiPost(`/api/admin/enrollment-requests/${r.id}/approve`, { couponCode: couponFor[r.id] || undefined }), "وُوفق: حُجز المقعد وأُنشئت الفاتورة")}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> موافقة وحجز مقعد
                  </Button>
                  <Button tone="danger" size="sm" disabled={busy}
                    onClick={() => setRejecting({ id: r.id, whoAr: r.user.displayName })}>
                    <XCircle className="h-3.5 w-3.5" /> رفض
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* الفواتير */}
      {!loading && tab === "invoices" && (
        <div className="space-y-3">
          {invoices.length === 0 && (
            <EmptyState icon={Receipt} titleAr="لا فواتير بعد"
              reasonAr="تُنشأ الفاتورةُ عند الموافقة على طلبِ تسجيلٍ أو عند شراءٍ مباشر." tone="start" />
          )}
          {invoices.length > 0 && (
            <ListToolbar q={q} onQ={setQ} onPage={setPage} view={invView} unit="فاتورة"
              placeholder="ابحث باسمِ مشترٍ أو بريدٍ أو رقمِ فاتورة…" />
          )}
          {invoices.length > 0 && invView.total === 0 && (
            <EmptyState icon={Receipt} titleAr="لا فاتورة تطابق بحثك" tone="filter"
              reasonAr={`لا شيءَ يطابق «${q.trim()}» في أسماء المشترين ولا بريدهم ولا أرقام الفواتير.`}
              actions={[{ onClick: () => { setQ(""); setPage(1); }, labelAr: "امسح البحث", hintAr: "تعود القائمةُ كاملةً" }]} />
          )}
          {invView.rows.map((inv) => (
            <Card key={inv.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{inv.total} {inv.currency} <span className="mr-2 font-mono text-micro font-normal text-muted-foreground" dir="ltr">{inv.id.slice(0, 8)}…</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">{inv.order.user.displayName} · {fmtDate(new Date(inv.issuedAt))}</p>
                </div>
                <Chip tone="accent" srPrefixAr="حالةُ الفاتورة">{INV_STATUS[inv.status] ?? inv.status}</Chip>
              </div>
              {inv.status === "issued" && canRecordPayment && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
                  <input value={payForm[inv.id] ?? ""} onChange={(e) => setPayForm({ ...payForm, [inv.id]: e.target.value })}
                    placeholder="طريقة الدفع — تحويل بنكي / كاش" className={`${inputCls} flex-1`} />
                  <Button tone="confirm" size="sm" disabled={busy || (payForm[inv.id] ?? "").length < 3}
                    onClick={() => act(() => apiPost(`/api/admin/invoices/${inv.id}/manual-payment`, { methodNote: payForm[inv.id] }), "سُجلت الدفعة اليدوية الموثقة")}>
                    <CreditCard className="h-3.5 w-3.5" /> تسجيل دفعة يدوية
                  </Button>
                </div>
              )}
              {inv.payments.filter((p) => p.status === "succeeded").map((p) => (
                <Inset key={p.id} tone="positive" className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-emerald-300">دفعة ناجحة {p.amount} {inv.currency}</span>
                  <span className="text-muted-foreground">{p.refunds.length} استرداد</span>
                  {canRefund && (<>
                  <input value={refundForm[p.id]?.amount ?? ""} onChange={(e) => setRefundForm({ ...refundForm, [p.id]: { ...refundForm[p.id], amount: e.target.value, reason: refundForm[p.id]?.reason ?? "" } })}
                    placeholder="مبلغ" type="number" className={`${inputCls} w-24`} />
                  <input value={refundForm[p.id]?.reason ?? ""} onChange={(e) => setRefundForm({ ...refundForm, [p.id]: { ...refundForm[p.id], reason: e.target.value, amount: refundForm[p.id]?.amount ?? "" } })}
                    placeholder="سبب موثق (5+ أحرف)" className={`${inputCls} flex-1`} />
                  <Button tone="secondary" size="sm" disabled={busy || (refundForm[p.id]?.reason ?? "").length < 5 || !Number(refundForm[p.id]?.amount)}
                    onClick={() => act(() => apiPost(`/api/admin/payments/${p.id}/refund`, { amount: Number(refundForm[p.id].amount), reason: refundForm[p.id].reason }), "قُدم طلب الاسترداد")} className="text-micro text-gold-ink">
                    <RotateCcw className="h-3 w-3" /> طلب استرداد
                  </Button>
                  </>)}
                </Inset>
              ))}
            </Card>
          ))}
        </div>
      )}

      {/* الاستردادات */}
      {!loading && tab === "refunds" && (
        <div className="space-y-3">
          {refunds.length === 0 && (
            <EmptyState icon={Undo2} titleAr="لا طلباتِ استردادٍ تنتظر"
              reasonAr="يُقدَّم طلبُ الاسترداد من بوّابة المتعلّم، ويظهر هنا لحظةَ تقديمه." tone="done" />
          )}
          {refunds.map((rf) => (
            <Card key={rf.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black">{rf.amount} <span className="text-xs font-normal text-muted-foreground">— {rf.reason}</span></p>
                <p className="mt-1 text-micro text-muted-foreground">{fmtDateTime(new Date(rf.createdAt))}</p>
              </div>
              <div className="flex items-center gap-2">
                <Chip tone="accent" srPrefixAr="حالةُ الطلب">{RF_STATUS[rf.status] ?? rf.status}</Chip>
                {rf.status === "requested" && canRefund && (
                  <>
                    <Button tone="secondary" size="sm" disabled={busy} onClick={() => act(() => apiPost(`/api/admin/refunds/${rf.id}/process`, { approve: true }), "نُفذ الاسترداد وحُدثت الدفعة والطلب")} className="bg-emerald-500/20">
                      تنفيذ
                    </Button>
                    <Button tone="danger" size="sm" disabled={busy} onClick={() => act(() => apiPost(`/api/admin/refunds/${rf.id}/process`, { approve: false, note: "مرفوض من المالية" }), "رُفض الاسترداد")}>
                      رفض
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* الكوبونات والخطط */}
      {!loading && tab === "coupons" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel as="section">
            <h3 className="flex items-center gap-2 text-sm font-black"><BadgePercent className="h-4 w-4 text-gold-ink" /> كوبون جديد</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} placeholder="الرمز — WAJEEZ20" dir="ltr" className={`${inputCls} font-mono`} />
              <input type="number" min={1} max={100} value={couponForm.percentOff} onChange={(e) => setCouponForm({ ...couponForm, percentOff: e.target.value })} placeholder="خصم %" className={inputCls} />
              <input type="number" min={0.5} value={couponForm.amountOff} onChange={(e) => setCouponForm({ ...couponForm, amountOff: e.target.value })} placeholder={`أو مبلغ ثابت (${LEDGER_CURRENCY})`} className={inputCls} />
              <input type="number" min={1} value={couponForm.maxUses} onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })} placeholder="أقصى استخدام" className={inputCls} />
              <input type="date" value={couponForm.expiresAt} onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })} className={inputCls} />
            </div>
            <Button tone="primary" disabled={busy || couponForm.code.length < 3 || (!couponForm.percentOff && !couponForm.amountOff)}
              onClick={() => act(async () => {
                await apiPost("/api/admin/coupons", {
                  code: couponForm.code,
                  percentOff: couponForm.percentOff ? Number(couponForm.percentOff) : undefined,
                  amountOff: couponForm.amountOff ? Number(couponForm.amountOff) : undefined,
                  maxUses: couponForm.maxUses ? Number(couponForm.maxUses) : undefined,
                  expiresAt: couponForm.expiresAt ? new Date(couponForm.expiresAt) : undefined,
                });
                setCouponForm({ code: "", percentOff: "", amountOff: "", maxUses: "", expiresAt: "" });
              }, "أُنشئ الكوبون")} className="mt-3">
              أنشئ الكوبون
            </Button>
            <ul className="mt-4 space-y-2">
              {coupons.map((c) => (
                <Inset as="li" key={c.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <span className="font-mono font-bold text-gold-ink" dir="ltr">{c.code}</span>
                  <span className="text-muted-foreground">{c.percentOff ? `${c.percentOff}%` : `${c.amountOff} ${c.currency}`}</span>
                  <span className="text-muted-foreground">{c.usedCount ?? 0}/{c.maxUses ?? "∞"}</span>
                  {!c.active && <Chip tone="danger">معطّل</Chip>}
                </Inset>
              ))}
            </ul>
          </Panel>

          <Panel as="section">
            <h3 className="flex items-center gap-2 text-sm font-black"><Wallet className="h-4 w-4 text-gold-ink" /> خطة اشتراك جديدة</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input value={planForm.code} onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })} placeholder="الرمز — monthly" dir="ltr" className={`${inputCls} font-mono`} />
              <input value={planForm.nameAr} onChange={(e) => setPlanForm({ ...planForm, nameAr: e.target.value })} placeholder="اسم الخطة" className={inputCls} />
              <input type="number" min={0} value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} placeholder={`السعر (${LEDGER_CURRENCY})`} className={inputCls} />
              <input type="number" min={1} value={planForm.intervalMonths} onChange={(e) => setPlanForm({ ...planForm, intervalMonths: e.target.value })} placeholder="كل كم شهر" className={inputCls} />
              <input value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} placeholder="مزايا مفصولة بفاصلة" className={`${inputCls} sm:col-span-2`} />
            </div>
            <Button tone="primary" disabled={busy || planForm.code.length < 2 || planForm.nameAr.length < 3 || !planForm.price}
              onClick={() => act(async () => {
                await apiPost("/api/admin/subscription-plans", {
                  code: planForm.code, nameAr: planForm.nameAr, price: Number(planForm.price),
                  intervalMonths: Number(planForm.intervalMonths) || 1,
                  features: planForm.features ? planForm.features.split(/[،,]/).map((f) => f.trim()).filter(Boolean) : undefined,
                });
                setPlanForm({ code: "", nameAr: "", price: "", intervalMonths: "1", features: "" });
              }, "أُنشئت الخطة وأصبحت عامة فورا")} className="mt-3">
              أنشئ الخطة
            </Button>
            <p className="mt-3 flex items-center gap-1.5 text-micro text-muted-foreground">
              <FileText className="h-3 w-3" /> الخطط الفعالة تظهر للعامة عبر /api/public/subscription-plans
            </p>
          </Panel>
        </div>
      )}
      {bulkConfirm === "approve" && (
        <ConfirmAction
          tone="default"
          titleAr={`الموافقةُ على ${sel.size} طلبَ تسجيل`}
          confirmLabelAr={`وافق على ${sel.size}`}
          busy={busy}
          onCancel={() => setBulkConfirm(null)}
          onConfirm={() => { setBulkConfirm(null); void bulkRequests("approve"); }}
        >
          <p>لكلّ طلبٍ منها: <b className="text-foreground">يُحجَز مقعدٌ في شعبته وتُصدَر فاتورتُه</b>. والمقعدُ المحجوزُ يُنقص السعةَ المعروضةَ فورا.</p>
          <p>ولا كوبونَ في الجماعيّ — الكوبونُ قرارٌ لصفٍّ بعينه، وتعميمُه يمنح خصما لمن لم يُقصد.</p>
        </ConfirmAction>
      )}

      {rejecting && (
        <ConfirmAction
          titleAr={`رفضُ طلبِ «${rejecting.whoAr}»`}
          confirmLabelAr="ارفض الطلب"
          busy={busy}
          reason={{ labelAr: "سببُ الرفض — يصل صاحبَ الطلب كما تكتبه", minLength: 5 }}
          onCancel={() => setRejecting(null)}
          onConfirm={(reason) => {
            const target = rejecting;
            setRejecting(null);
            void act(() => apiPost(`/api/admin/enrollment-requests/${target.id}/reject`, { reason }), "رُفض الطلب — ووصل السببُ صاحبَه");
          }}
        >
          <p>يُغلَق الطلبُ ولا يُحجَز له مقعد، ويقرأ صاحبُه سببَك كما تكتبه.</p>
        </ConfirmAction>
      )}

      {bulkConfirm === "reject" && (
        <ConfirmAction
          titleAr={`رفضُ ${sel.size} طلبَ تسجيل`}
          confirmLabelAr={`ارفض ${sel.size}`}
          busy={busy}
          reason={{ labelAr: "سببُ الرفض — يصل صاحبَ الطلب كما تكتبه", minLength: 5 }}
          onCancel={() => setBulkConfirm(null)}
          onConfirm={(reason) => { setBulkConfirm(null); void bulkRequests("reject", reason); }}
        >
          <p>يُغلَق كلُّ طلبٍ منها ويُخبَر صاحبُه. والسببُ الذي تكتبه هو ما يقرؤه — فاكتبه له لا للسجلّ.</p>
        </ConfirmAction>
      )}
    </AdminLayout>
  );
}

/* طابورُ طلبات المستشارين — خصمٌ أو تعديلُ خطّة.

   كان المستشار إذا احتاج خصما خرج بالطلب من المنصّة إلى واتساب. فلا
   الإدارة ترى طابورا، ولا أحدَ يعرف بعد شهرٍ كم خصما أُعطي ولا لماذا،
   ولا يعود إلى المستشار سببُ الرفض فيعيد الطلب نفسه.

   وهنا: أقدمُ الطلبات أوّلا، وسببُ كلٍّ منها ظاهرٌ بلا فتح، والرفضُ
   يلزمه سبب يقرؤه صاحبُه. والاعتمادُ يُنتج كوبونا مقصورا على العميل. */

import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import { BadgePercent, CheckCircle2, Clock, Loader2, Route, ServerOff, XCircle } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { courseById } from "@/data/courses";
import { areaCls } from "@/components/FormKit";
import { fmtDateTimeAr } from "@/utils/format";

import { Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
interface Row {
  id: string;
  kind: string;
  status: string;
  percentOff: number | null;
  amountOff: string | null;
  currency: string | null;
  courseId: string | null;
  reasonAr: string;
  createdAt: string;
  advisor: { displayName: string; email: string };
  case: {
    id: string;
    status: string;
    client: { id: string; displayName: string; email: string } | null;
    lead: { fullName: string; email: string } | null;
  };
}

const KIND_AR: Record<string, string> = {
  discount: "خصم على الفاتورة",
  plan_add: "إضافة دورة إلى الخطّة",
  plan_remove: "إلغاء دورة من الخطّة",
};

/** أقلُّ سببٍ يُقرأ — مطابقٌ لما يفرضه الخادم */
const MIN_REASON = 12;

export default function AdvisorRequests() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await apiGet<Row[]>("/api/admin/advisor-requests"));
      setOffline(null);
    } catch (e) {
      setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusy(id);
    try {
      await apiPost(`/api/admin/advisor-requests/${id}/decision`, { decision, noteAr: note[id]?.trim() || undefined });
      toast(decision === "approved" ? "اعتُمد الطلب — ووُلّد كوبونٌ مقصور على العميل إن كان خصما" : "رُفض الطلب، ويصل سببُك إلى المستشار");
      await load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ القرار");
    } finally {
      setBusy("");
    }
  };

  if (offline) {
    return (
      <AdminLayout title="طلبات المستشارين">
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
        </Panel>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="طلبات المستشارين — خصمٌ وتعديلُ خطّة">

      {rows === null ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      ) : rows.length === 0 ? (
        <Panel className="grid place-items-center py-16 text-center">
          <CheckCircle2 className="h-12 w-12 text-teal-light-ink/50" />
          <h2 className="mt-4 text-xl font-black">لا طلبَ ينتظر قرارك</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
            حين يطلب مستشارٌ خصما لعميله أو تعديلا على خطّته يظهر هنا بسببه كاملا.
          </p>
        </Panel>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const who = r.case.client?.displayName ?? r.case.lead?.fullName ?? "عميل بلا اسم";
            const email = r.case.client?.email ?? r.case.lead?.email ?? "";
            const reason = note[r.id] ?? "";
            return (
              <Panel as="li" key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm font-black">
                      {r.kind === "discount" ? <BadgePercent className="h-4 w-4 text-gold-ink" /> : <Route className="h-4 w-4 text-teal-light-ink" />}
                      {KIND_AR[r.kind] ?? r.kind}
                      {r.percentOff !== null && <span className="text-gold-ink">{r.percentOff}٪</span>}
                      {r.amountOff && <span className="text-gold-ink">{r.amountOff} {r.currency}</span>}
                      {r.courseId && <span className="font-normal text-foreground">— {courseById(r.courseId)?.name ?? r.courseId}</span>}
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      للعميل <b className="text-foreground">{who}</b>
                      {email && <span dir="ltr" className="ms-2 text-muted-foreground">{email}</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      رفعه {r.advisor.displayName} · <Clock className="mb-0.5 inline h-3 w-3" /> {fmtDateTimeAr(r.createdAt)}
                    </p>
                  </div>
                </div>

                <p className="mt-3 rounded-xl border border-white/10 bg-paper/25 px-4 py-3 text-xs leading-7 text-foreground">
                  <span className="font-bold text-muted-foreground">سببُه: </span>{r.reasonAr}
                </p>

                <div className="mt-3">
                  <label htmlFor={`note-${r.id}`} className="mb-1.5 block text-[11px] font-bold text-muted-foreground">
                    ردُّك — إلزاميٌّ عند الرفض، يقرؤه المستشار
                  </label>
                  <textarea
                    id={`note-${r.id}`} rows={2} value={reason}
                    onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder="مثال: الخصم فوق سقف هذه الفئة — اعرض عليها التقسيط بدلا منه."
                    className={areaCls}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button tone="confirm" type="button" onClick={() => void decide(r.id, "approved")} disabled={busy === r.id}>
                    {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    اعتمد
                  </Button>
                  <Button tone="danger" type="button" onClick={() => void decide(r.id, "rejected")}
                    disabled={busy === r.id || reason.trim().length < MIN_REASON} className="disabled:cursor-not-allowed disabled:opacity-35">
                    <XCircle className="h-3.5 w-3.5" /> ارفض
                  </Button>
                  {reason.trim().length < MIN_REASON && (
                    <span className="text-micro text-muted-foreground">الرفض يلزمه سببٌ لا يقلّ عن {MIN_REASON} حرفا</span>
                  )}
                </div>
              </Panel>
            );
          })}
        </ul>
      )}
    </AdminLayout>
  );
}

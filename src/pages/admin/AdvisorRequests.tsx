/* طابورُ طلبات المستشارين — خصمٌ أو تعديلُ خطّة.

   كان المستشار إذا احتاج خصما خرج بالطلب من المنصّة إلى واتساب. فلا
   الإدارة ترى طابورا، ولا أحدَ يعرف بعد شهرٍ كم خصما أُعطي ولا لماذا،
   ولا يعود إلى المستشار سببُ الرفض فيعيد الطلب نفسه.

   وهنا: أقدمُ الطلبات أوّلا، وسببُ كلٍّ منها ظاهرٌ بلا فتح، والرفضُ
   يلزمه سبب يقرؤه صاحبُه. والاعتمادُ يُنتج كوبونا مقصورا على العميل. */

import { useCallback, useEffect, useState } from "react";
import { BadgePercent, CheckCircle2, Clock, Loader2, Route, ServerOff, XCircle } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { courseById } from "@/data/courses";
import { areaCls } from "@/components/FormKit";
import { fmtDateTimeAr } from "@/utils/format";

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
  const [flash, setFlash] = useState("");

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
    setBusy(id); setFlash("");
    try {
      await apiPost(`/api/admin/advisor-requests/${id}/decision`, { decision, noteAr: note[id]?.trim() || undefined });
      setFlash(decision === "approved" ? "اعتُمد الطلب — ووُلّد كوبونٌ مقصور على العميل إن كان خصما" : "رُفض الطلب، ويصل سببُك إلى المستشار");
      await load();
    } catch (e) {
      setFlash(e instanceof ApiError ? e.message : "تعذّر تنفيذ القرار");
    } finally {
      setBusy("");
    }
  };

  if (offline) {
    return (
      <AdminLayout title="طلبات المستشارين">
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <ServerOff className="h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">{offline}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="طلبات المستشارين — خصمٌ وتعديلُ خطّة">
      {flash && <p role="status" className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs font-bold text-white/80">{flash}</p>}

      {rows === null ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center">
          <CheckCircle2 className="h-12 w-12 text-teal-light-ink/50" />
          <h2 className="mt-4 text-xl font-black">لا طلبَ ينتظر قرارك</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">
            حين يطلب مستشارٌ خصما لعميله أو تعديلا على خطّته يظهر هنا بسببه كاملا.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const who = r.case.client?.displayName ?? r.case.lead?.fullName ?? "عميل بلا اسم";
            const email = r.case.client?.email ?? r.case.lead?.email ?? "";
            const reason = note[r.id] ?? "";
            return (
              <li key={r.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm font-black">
                      {r.kind === "discount" ? <BadgePercent className="h-4 w-4 text-gold-ink" /> : <Route className="h-4 w-4 text-teal-light-ink" />}
                      {KIND_AR[r.kind] ?? r.kind}
                      {r.percentOff !== null && <span className="text-gold-ink">{r.percentOff}٪</span>}
                      {r.amountOff && <span className="text-gold-ink">{r.amountOff} {r.currency}</span>}
                      {r.courseId && <span className="font-normal text-white/65">— {courseById(r.courseId)?.name ?? r.courseId}</span>}
                    </p>
                    <p className="mt-1.5 text-xs text-white/60">
                      للعميل <b className="text-white/85">{who}</b>
                      {email && <span dir="ltr" className="ms-2 text-white/40">{email}</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/40">
                      رفعه {r.advisor.displayName} · <Clock className="mb-0.5 inline h-3 w-3" /> {fmtDateTimeAr(r.createdAt)}
                    </p>
                  </div>
                </div>

                <p className="mt-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-xs leading-7 text-white/75">
                  <span className="font-bold text-white/45">سببُه: </span>{r.reasonAr}
                </p>

                <div className="mt-3">
                  <label htmlFor={`note-${r.id}`} className="mb-1.5 block text-[11px] font-bold text-white/55">
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
                  <button
                    type="button" onClick={() => void decide(r.id, "approved")} disabled={busy === r.id}
                    className="flex cursor-pointer items-center gap-2 rounded-full bg-teal px-6 py-2.5 text-xs font-black text-on-teal transition hover:bg-teal-light disabled:opacity-40"
                  >
                    {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    اعتمد
                  </button>
                  <button
                    type="button" onClick={() => void decide(r.id, "rejected")}
                    disabled={busy === r.id || reason.trim().length < MIN_REASON}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-red-400/40 px-6 py-2.5 text-xs font-bold text-red-300 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <XCircle className="h-3.5 w-3.5" /> ارفض
                  </button>
                  {reason.trim().length < MIN_REASON && (
                    <span className="text-[10.5px] text-white/35">الرفض يلزمه سببٌ لا يقلّ عن {MIN_REASON} حرفا</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AdminLayout>
  );
}

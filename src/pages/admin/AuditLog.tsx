/* سجل التدقيق الموحّد — كل حدثٍ حسّاس سُجّل من أي شاشة، في مكان واحد.

   قرارُ صاحب المنصّة: أراد مكانا واحدا يجيب «من فعل ماذا ومتى» على مستوى
   المنصّة كلّها، بدل أثرٍ مبعثر يظهر كل جزء منه في شاشته وحدها. والبيانات
   لم تكن ناقصة — recordAudit() يكتبها من كل خدمة حسّاسة أصلا — الناقص كان
   شاشة تجمعها. */

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, ApiError } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  meta: unknown;
  createdAt: string;
  actor: { id: string; displayName: string; email: string } | null;
}

interface AuditResponse { page: number; pageSize: number; total: number; items: AuditRow[] }
interface Facets { entityTypes: string[]; actions: string[] }

export default function AdminAuditLog() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [facets, setFacets] = useState<Facets>({ entityTypes: [], actions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [actorEmail, setActorEmail] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    apiGet<Facets>("/api/admin/audit-log/facets").then(setFacets).catch(() => {});
  }, []);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "30" });
      if (actorEmail.trim()) params.set("actorEmail", actorEmail.trim());
      if (entityType) params.set("entityType", entityType);
      if (action) params.set("action", action);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      setData(await apiGet<AuditResponse>(`/api/admin/audit-log?${params.toString()}`));
      setPage(p);
    } catch (e) {
      setData(null);
      setError(e instanceof ApiError ? e.message : "تعذّر قراءة سجل التدقيق");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorEmail, entityType, action, from, to]);

  useEffect(() => { void load(1); }, [load]);

  const field = "rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-teal/50 [&>option]:bg-surface";
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminLayout title="سجل التدقيق">
      <div className="space-y-4">
        <p className="text-[11.5px] text-white/45">
          كل إجراءٍ حسّاس على المنصّة — من يسّجّل مستخدما ومن يعتمد دورة ومن يستردّ دفعة — مسجَّلٌ هنا بفاعله ووقته.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); void load(1); }}
          className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
        >
          <div className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-white/35" />
            <input
              value={actorEmail}
              onChange={(e) => setActorEmail(e.target.value)}
              placeholder="بريد الفاعل…"
              dir="ltr"
              className="w-36 bg-transparent text-xs text-white outline-none placeholder:text-white/30"
            />
          </div>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className={field}>
            <option value="">كل الأنواع</option>
            {facets.entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={action} onChange={(e) => setAction(e.target.value)} className={field}>
            <option value="">كل الإجراءات</option>
            {facets.actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[11px] text-white/45">
            من
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-white/45">
            إلى
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
          </label>
          <button type="submit" className="cursor-pointer rounded-full bg-teal px-4 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light">
            بحث
          </button>
          {(actorEmail || entityType || action || from || to) && (
            <button
              type="button"
              onClick={() => { setActorEmail(""); setEntityType(""); setAction(""); setFrom(""); setTo(""); }}
              className="flex cursor-pointer items-center gap-1 text-[11px] font-bold text-white/45 hover:text-white/70"
            >
              <X className="h-3 w-3" /> مسح الفلاتر
            </button>
          )}
        </form>

        {loading && !data ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-7 w-7 animate-spin text-teal-ink" /></div>
        ) : error ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-white/60">{error}</p>
        ) : !data || data.items.length === 0 ? (
          <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-14 text-center">
            <p className="text-sm font-black">لا أحداث تطابق هذا البحث</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-right text-[12px]">
                <thead className="bg-white/[0.04] text-[10.5px] font-black text-white/50">
                  <tr>
                    <th className="px-3 py-2.5">الوقت</th>
                    <th className="px-3 py-2.5">الفاعل</th>
                    <th className="px-3 py-2.5">الإجراء</th>
                    <th className="px-3 py-2.5">الكيان</th>
                    <th className="px-3 py-2.5">السبب</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <>
                      <tr
                        key={r.id}
                        onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                        className="cursor-pointer border-t border-white/8 hover:bg-white/[0.03]"
                      >
                        <td dir="ltr" className="whitespace-nowrap px-3 py-2.5 text-left text-white/60">{fmtDateTime(new Date(r.createdAt))}</td>
                        <td className="px-3 py-2.5">
                          {r.actor ? (
                            <span>
                              <span className="font-bold text-white/80">{r.actor.displayName}</span>
                              <span dir="ltr" className="mr-1.5 text-[10.5px] text-white/40">{r.actor.email}</span>
                            </span>
                          ) : <span className="text-white/40">النظام</span>}
                        </td>
                        <td dir="ltr" className="px-3 py-2.5 text-left font-mono text-[11px] text-teal-light-ink">{r.action}</td>
                        <td dir="ltr" className="px-3 py-2.5 text-left text-[11px] text-white/50">{r.entityType}</td>
                        <td className="max-w-[16rem] truncate px-3 py-2.5 text-white/55">{r.reason ?? "—"}</td>
                      </tr>
                      {expanded === r.id && (
                        <tr key={`${r.id}-detail`} className="border-t border-white/8 bg-black/20">
                          <td colSpan={5} className="px-3 py-3">
                            <pre dir="ltr" className="max-h-64 overflow-auto text-left text-[10.5px] leading-6 text-white/60">
                              {JSON.stringify(r.meta ?? {}, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 text-[11.5px] text-white/50">
              <span>{data.total} حدثا — صفحة {page} من {totalPages}</span>
              <div className="flex gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => void load(page - 1)}
                  className="flex cursor-pointer items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 font-bold text-white/70 transition hover:border-teal/50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronRight className="h-3.5 w-3.5" /> السابق
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => void load(page + 1)}
                  className="flex cursor-pointer items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 font-bold text-white/70 transition hover:border-teal/50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  التالي <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

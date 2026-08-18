/* التقارير التشغيلية — API حقيقي: فهرس بطريقة الحساب المعلنة، تشغيل بفلاتر
   تاريخ/دورة/شعبة، وتصدير CSV/XLSX (صلاحية reports.export من الخادم). */
import { useCallback, useEffect, useState } from "react";
import { BarChart3, Download, Loader2, Play, RefreshCw, ServerOff } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, ApiError } from "@/services/api";

const inputCls = "rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white focus:border-[#38A7B4] focus:outline-none";

interface ReportDef { key: string; titleAr: string; methodAr: string }
interface ReportResult { key: string; titleAr: string; methodAr: string; rows: Record<string, unknown>[] }

export default function Reports() {
  const [defs, setDefs] = useState<ReportDef[]>([]);
  const [offline, setOffline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({ from: "", to: "", cohortId: "", courseId: "" });
  const [selected, setSelected] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try {
      const list = await apiGet<ReportDef[]>("/api/admin/reports");
      setDefs(list);
      if (list.length && !selected) setSelected(list[0].key);
    } catch (e) { setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل"); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void load(); }, [load]);

  const query = () => {
    const p = new URLSearchParams();
    if (filter.from) p.set("from", new Date(filter.from).toISOString());
    if (filter.to) p.set("to", new Date(filter.to).toISOString());
    if (filter.cohortId) p.set("cohortId", filter.cohortId);
    if (filter.courseId) p.set("courseId", filter.courseId);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  const run = async () => {
    if (!selected) return;
    setRunning(true); setError("");
    try { setResult(await apiGet<ReportResult>(`/api/admin/reports/${selected}${query()}`)); }
    catch (e) { setError(e instanceof ApiError ? e.message : "فشل تشغيل التقرير"); }
    finally { setRunning(false); }
  };

  const download = async (format: "csv" | "xlsx") => {
    if (!selected) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/reports/${selected}/export${query()}${query() ? "&" : "?"}format=${format}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: { message_ar?: string } } | null;
        throw new Error(data?.error?.message_ar ?? `خطأ ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `report-${selected}.${format}`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "فشل التصدير — قد تنقصك صلاحية reports.export"); }
  };

  if (offline) {
    return (
      <AdminLayout title="التقارير">
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <ServerOff className="h-12 w-12 text-white/20" />
          <p className="mt-4 max-w-md text-sm text-white/55">{offline}</p>
          <button onClick={() => void load()} className="mt-5 flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-xs font-bold text-white/70 hover:border-white/40">
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </button>
        </div>
      </AdminLayout>
    );
  }

  const columns = result?.rows.length ? Object.keys(result.rows[0]) : [];

  return (
    <AdminLayout title="التقارير التشغيلية — 16 تقريرا بطريقة حساب معلنة">
      {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* فهرس التقارير */}
          <div className="space-y-2">
            {defs.map((d) => (
              <button key={d.key} onClick={() => { setSelected(d.key); setResult(null); }}
                className={`w-full cursor-pointer rounded-2xl border p-4 text-right transition ${selected === d.key ? "border-[#FABC05]/50 bg-[#FABC05]/5" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}>
                <p className="flex items-center gap-2 text-sm font-black">
                  <BarChart3 className={`h-4 w-4 ${selected === d.key ? "text-[#FABC05]" : "text-white/40"}`} /> {d.titleAr}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-white/50">{d.methodAr}</p>
              </button>
            ))}
          </div>

          {/* التشغيل والنتيجة */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
              <div className="grid gap-2 sm:grid-cols-4">
                <label className="text-[10px] text-white/50">من تاريخ
                  <input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} className={`${inputCls} mt-1 w-full`} />
                </label>
                <label className="text-[10px] text-white/50">إلى تاريخ
                  <input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} className={`${inputCls} mt-1 w-full`} />
                </label>
                <label className="text-[10px] text-white/50">معرف دورة (اختياري)
                  <input value={filter.courseId} onChange={(e) => setFilter({ ...filter, courseId: e.target.value })} dir="ltr" className={`${inputCls} mt-1 w-full font-mono`} />
                </label>
                <label className="text-[10px] text-white/50">معرف شعبة (اختياري)
                  <input value={filter.cohortId} onChange={(e) => setFilter({ ...filter, cohortId: e.target.value })} dir="ltr" className={`${inputCls} mt-1 w-full font-mono`} />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={() => void run()} disabled={running || !selected}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#FABC05] px-5 py-2 text-xs font-black text-[#0D0D0D] disabled:opacity-40">
                  {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} شغّل التقرير
                </button>
                <button onClick={() => void download("csv")} disabled={!selected}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/60 hover:border-white/40 disabled:opacity-40">
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
                <button onClick={() => void download("xlsx")} disabled={!selected}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/60 hover:border-white/40 disabled:opacity-40">
                  <Download className="h-3.5 w-3.5" /> XLSX
                </button>
              </div>
            </div>

            {result && (
              <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="text-sm font-black">{result.titleAr} <span className="text-[11px] font-normal text-white/45">— {result.rows.length} صف</span></h3>
                {result.rows.length === 0 ? (
                  <p className="mt-3 text-xs text-white/45">لا صفوف ضمن الفلاتر الحالية.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr>{columns.map((c) => <th key={c} className="border-b border-white/10 px-3 py-2 font-bold text-white/50">{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {result.rows.slice(0, 200).map((r, i) => (
                          <tr key={i} className="border-b border-white/5">
                            {columns.map((c) => <td key={c} className="px-3 py-2 text-white/75">{String(r[c] ?? "—")}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {result.rows.length > 200 && <p className="mt-2 text-[10px] text-white/40">يُعرض أول 200 صف — صدّر CSV/XLSX للكامل.</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

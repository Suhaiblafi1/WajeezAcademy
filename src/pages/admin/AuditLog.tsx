import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, History, Loader2, RefreshCw, Search, ServerOff } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, permissionMessage } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";

interface AuditRow {
  id: string; action: string; entityType: string; entityId: string; createdAt: string;
  reason: string | null; ip: string | null;
  actor: { id: string; displayName: string; email: string } | null;
  meta: unknown; before: unknown; after: unknown;
}
interface AuditPage {
  total: number; page: number; pages: number; pageSize: number; rows: AuditRow[];
  facets: { actions: { value: string; count: number }[]; entityTypes: { value: string; count: number }[] };
}

const ENTITY_AR: Record<string, string> = {
  user: "حساب", enrollment: "تسجيل", cohort: "شعبة", course: "دورة", invoice: "فاتورة",
  order: "طلب شراء", payment: "دفعة", refund: "استرداد", notification: "إشعار",
  trainer_application: "طلب مدرّب", trainer_profile: "ملفّ مدرّب", certificate: "شهادة",
  support_ticket: "تذكرة دعم", staff_task: "مهمّة", module: "وحدة", pathway: "مسار",
};

const field = "rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-xs text-white focus:border-teal focus:outline-none [&>option]:bg-surface";

/** سجلُّ الأثر الموحَّد — ما وقع، ومن أوقعه، ومتى.

    كلُّ خدمةٍ في المنصّة تكتب في `AuditEvent`: تعيينُ دور، فتحُ شعبة، اعتمادُ
    متن، استردادُ مبلغ، ترقيةٌ من قائمة انتظار، حذفُ حساب. ولم تكن هناك شاشةٌ
    تقرؤه — فالسجلُّ يُكتب بأمانةٍ لأحدٍ لا يراه، ومن أراد أن يعرف «من غيّر
    هذا؟» لم يكن أمامه إلّا SQL على قاعدة الإنتاج.

    والترشيحُ والترقيمُ في الخادم لا هنا: هذا الجدولُ وحدَه ينمو بلا سقفٍ مع
    كلّ فعلٍ يقع، فلا يُنقَل كاملا ليُرشَّح في المتصفّح. */
export default function AuditLog() {
  const [data, setData] = useState<AuditPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filters, setFilters] = useState({ action: "", entityType: "", from: "", to: "" });
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    const qs = new URLSearchParams({ page: String(page), pageSize: "25" });
    for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
    try { setData(await apiGet<AuditPage>(`/api/admin/audit?${qs.toString()}`)); }
    catch (e) { setOffline(permissionMessage(e, "الخادم غير متصل")); }
    finally { setLoading(false); }
  }, [filters, page]);

  useEffect(() => { void load(); }, [load]);

  const set = (patch: Partial<typeof filters>) => { setFilters({ ...filters, ...patch }); setPage(1); };

  if (offline) {
    return (
      <AdminLayout title="سجلّ الأثر">
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

  return (
    <AdminLayout title="سجلّ الأثر — من فعل ماذا ومتى">
      <p className="mb-4 max-w-2xl text-xs leading-6 text-white/50">
        كلُّ فعلٍ يقع على المنصّة يُكتب هنا بصاحبه ووقته: الأدوارُ والإيقافُ والحذف، وفتحُ الشعب
        والتسجيلُ والترقيةُ من الانتظار، والفواتيرُ والاستردادات، واعتمادُ المتون وقراراتُ المدربين.
        السجلُّ يُقرأ ولا يُكتب من هنا.
      </p>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[11px] text-white/45">
          الفعل
          <select value={filters.action} onChange={(e) => set({ action: e.target.value })} className={`mt-1 w-full ${field}`}>
            <option value="">كلّ الأفعال</option>
            {(data?.facets.actions ?? []).map((a) => (
              <option key={a.value} value={a.value}>{a.value} ({a.count})</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-white/45">
          نوع الكيان
          <select value={filters.entityType} onChange={(e) => set({ entityType: e.target.value })} className={`mt-1 w-full ${field}`}>
            <option value="">كلّ الأنواع</option>
            {(data?.facets.entityTypes ?? []).map((e2) => (
              <option key={e2.value} value={e2.value}>{ENTITY_AR[e2.value] ?? e2.value} ({e2.count})</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-white/45">
          من تاريخ
          <input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className={`mt-1 w-full ${field}`} />
        </label>
        <label className="text-[11px] text-white/45">
          إلى تاريخ
          <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className={`mt-1 w-full ${field}`} />
        </label>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/45">
        <span>
          {data ? (data.total === 0 ? "لا وقائع بهذا الفرز" : `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} من ${data.total} واقعة`) : "…"}
        </span>
        <div className="flex items-center gap-2">
          {Object.values(filters).some(Boolean) && (
            <button onClick={() => { setFilters({ action: "", entityType: "", from: "", to: "" }); setPage(1); }}
              className="cursor-pointer rounded-full border border-white/15 px-3 py-1 font-bold text-white/60 hover:border-white/35">
              امسح الفرز
            </button>
          )}
          {data && data.pages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(data.page - 1)} disabled={data.page <= 1} aria-label="الصفحة السابقة"
                className="cursor-pointer rounded-lg border border-white/12 p-1.5 text-white/60 hover:border-white/35 disabled:cursor-default disabled:opacity-25">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <span className="tabular-nums">{data.page} / {data.pages}</span>
              <button onClick={() => setPage(data.page + 1)} disabled={data.page >= data.pages} aria-label="الصفحة التالية"
                className="cursor-pointer rounded-lg border border-white/12 p-1.5 text-white/60 hover:border-white/35 disabled:cursor-default disabled:opacity-25">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>
      ) : !data || data.rows.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <Search className="h-12 w-12 text-white/20" />
          <p className="mt-4 text-sm text-white/50">لا وقائع تطابق هذا الفرز — وسّع المدى أو امسحه.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <button onClick={() => setOpen(open === r.id ? null : r.id)}
                className="flex w-full cursor-pointer flex-wrap items-center gap-3 text-right">
                <History className="h-3.5 w-3.5 shrink-0 text-white/30" />
                <span className="font-mono text-[11px] font-bold text-gold-ink" dir="ltr">{r.action}</span>
                <span className="text-[11px] text-white/55">
                  {ENTITY_AR[r.entityType] ?? r.entityType}
                  <span className="mr-1.5 font-mono text-white/35" dir="ltr">{r.entityId.slice(0, 8)}…</span>
                </span>
                {/* الفاعلُ يُسمّى دائما: «النظام» ليس فراغا بل فاعلٌ آخر */}
                <span className="text-[11px] text-white/70">{r.actor ? r.actor.displayName : "النظام (تلقائيّ)"}</span>
                <span className="mr-auto text-[11px] text-white/40">{fmtDateTime(new Date(r.createdAt))}</span>
              </button>
              {open === r.id && (
                <div className="mt-3 space-y-2 border-t border-white/8 pt-3 text-[11px] leading-6 text-white/60">
                  {r.actor?.email && <p dir="ltr" className="font-mono text-white/45">{r.actor.email}</p>}
                  {r.reason && <p>السبب المكتوب: {r.reason}</p>}
                  {r.ip && <p dir="ltr" className="font-mono text-white/40">IP {r.ip}</p>}
                  <p className="font-mono text-[10px] text-white/45" dir="ltr">{r.entityId}</p>
                  {([["قبل", r.before], ["بعد", r.after], ["تفاصيل", r.meta]] as const).map(([label, value]) => value != null && (
                    <div key={label}>
                      <p className="font-bold text-white/50">{label}</p>
                      <pre dir="ltr" className="mt-1 overflow-x-auto rounded-xl border border-white/8 bg-black/30 p-3 text-[10px] text-white/60">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

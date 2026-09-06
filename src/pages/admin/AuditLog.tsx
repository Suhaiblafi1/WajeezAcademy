import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, History, Loader2, RefreshCw, Search, ServerOff } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, permissionMessage } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";

import { Panel, Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
interface AuditRow {
  id: string; action: string; actionAr: string; entityType: string; entityTypeAr: string; entityId: string; createdAt: string;
  reason: string | null; ip: string | null;
  actor: { id: string; displayName: string; email: string } | null;
  meta: unknown; before: unknown; after: unknown;
}
interface AuditPage {
  total: number; page: number; pages: number; pageSize: number; rows: AuditRow[];
  facets: { actions: { value: string; labelAr: string; count: number }[]; entityTypes: { value: string; labelAr: string; count: number }[] };
}

/* حُذف جدولُ أنواعِ الكيانات من هذه الصفحة: كان يعرّب ستّةَ عشرَ نوعا من
   سبعةٍ وثلاثين، فما لم يكن فيه يُعرض بمفتاحه. والخادمُ يعرّبها كلَّها من
   المعجم الواحد (`src/application/audit/labels.ts`) ويرسلها مع الصفّ —
   فمعجمٌ واحدٌ لا اثنان يفترقان. */

const field = "rounded-xl border border-white/12 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-teal focus:outline-none [&>option]:bg-surface";

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
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 max-w-md text-sm text-muted-foreground">{offline}</p>
          <Button tone="secondary" onClick={() => void load()} className="mt-5">
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </Button>
        </Panel>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="سجلّ الأثر — من فعل ماذا ومتى">
      <p className="mb-4 max-w-2xl text-xs leading-6 text-muted-foreground">
        كلُّ فعلٍ يقع على المنصّة يُكتب هنا بصاحبه ووقته: الأدوارُ والإيقافُ والحذف، وفتحُ الشعب
        والتسجيلُ والترقيةُ من الانتظار، والفواتيرُ والاستردادات، واعتمادُ المتون وقراراتُ المدربين.
        السجلُّ يُقرأ ولا يُكتب من هنا.
      </p>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-micro text-muted-foreground">
          الفعل
          <select value={filters.action} onChange={(e) => set({ action: e.target.value })} className={`mt-1 w-full ${field}`}>
            <option value="">كلّ الأفعال</option>
            {(data?.facets.actions ?? []).map((a) => (
              <option key={a.value} value={a.value}>{a.labelAr} ({a.count})</option>
            ))}
          </select>
        </label>
        <label className="text-micro text-muted-foreground">
          نوع الكيان
          <select value={filters.entityType} onChange={(e) => set({ entityType: e.target.value })} className={`mt-1 w-full ${field}`}>
            <option value="">كلّ الأنواع</option>
            {(data?.facets.entityTypes ?? []).map((e2) => (
              <option key={e2.value} value={e2.value}>{e2.labelAr} ({e2.count})</option>
            ))}
          </select>
        </label>
        <label className="text-micro text-muted-foreground">
          من تاريخ
          <input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className={`mt-1 w-full ${field}`} />
        </label>
        <label className="text-micro text-muted-foreground">
          إلى تاريخ
          <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className={`mt-1 w-full ${field}`} />
        </label>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-micro text-muted-foreground">
        <span>
          {data ? (data.total === 0 ? "لا وقائع بهذا الفرز" : `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} من ${data.total} واقعة`) : "…"}
        </span>
        <div className="flex items-center gap-2">
          {Object.values(filters).some(Boolean) && (
            <Button tone="secondary" size="sm" onClick={() => { setFilters({ action: "", entityType: "", from: "", to: "" }); setPage(1); }}>
              امسح الفرز
            </Button>
          )}
          {data && data.pages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(data.page - 1)} disabled={data.page <= 1} aria-label="الصفحة السابقة"
                className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-white/12 text-muted-foreground hover:border-white/35 disabled:cursor-default disabled:opacity-25">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <span className="tabular-nums">{data.page} / {data.pages}</span>
              <button onClick={() => setPage(data.page + 1)} disabled={data.page >= data.pages} aria-label="الصفحة التالية"
                className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-white/12 text-muted-foreground hover:border-white/35 disabled:cursor-default disabled:opacity-25">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      ) : !data || data.rows.length === 0 ? (
        <Panel className="grid place-items-center py-20 text-center">
          <Search className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">لا وقائع تطابق هذا الفرز — وسّع المدى أو امسحه.</p>
        </Panel>
      ) : (
        <div className="space-y-2">
          {data.rows.map((r) => (
            <Card key={r.id}>
              <button onClick={() => setOpen(open === r.id ? null : r.id)}
                className="flex w-full cursor-pointer flex-wrap items-center gap-3 text-right">
                <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                {/* الاسمُ العربيُّ في الصدارة، والمفتاحُ الخامُ عند الفتح.
                    وكان السجلُّ يعرض `cohort.session.add` نصّا لاتينيّا لمن
                    يقرأ — وهو ما أُصلح في لوحة المدير (T5) وبقي هنا. */}
                <span className="text-micro font-black text-gold-ink">{r.actionAr}</span>
                <span className="text-micro text-muted-foreground">
                  {r.entityTypeAr}
                  <span className="mr-1.5 font-mono text-muted-foreground" dir="ltr">{r.entityId.slice(0, 8)}…</span>
                </span>
                {/* الفاعلُ يُسمّى دائما: «النظام» ليس فراغا بل فاعلٌ آخر */}
                <span className="text-micro text-foreground">{r.actor ? r.actor.displayName : "النظام (تلقائيّ)"}</span>
                <span className="mr-auto text-micro text-muted-foreground">{fmtDateTime(new Date(r.createdAt))}</span>
              </button>
              {open === r.id && (
                <div className="mt-3 space-y-2 border-t border-white/8 pt-3 text-micro leading-6 text-muted-foreground">
                  {r.actor?.email && <p dir="ltr" className="font-mono text-muted-foreground">{r.actor.email}</p>}
                  {r.reason && <p>السبب المكتوب: {r.reason}</p>}
                  <p className="font-mono text-micro text-muted-foreground" dir="ltr">{r.action}</p>
                  {r.ip && <p dir="ltr" className="font-mono text-muted-foreground">IP {r.ip}</p>}
                  <p className="font-mono text-micro text-muted-foreground" dir="ltr">{r.entityId}</p>
                  {([["قبل", r.before], ["بعد", r.after], ["تفاصيل", r.meta]] as const).map(([label, value]) => value != null && (
                    <div key={label}>
                      <p className="font-bold text-muted-foreground">{label}</p>
                      <pre dir="ltr" className="mt-1 overflow-x-auto rounded-xl border border-white/8 bg-paper/30 p-3 text-micro text-muted-foreground">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

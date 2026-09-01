import { useCallback, useEffect, useState } from "react";
import { BadgePercent, Loader2, RefreshCw, ServerOff, UserCheck } from "lucide-react";
import AdminLayout from "./AdminLayout";
import ListToolbar from "@/components/admin/ListToolbar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { apiGet, apiPatch, ApiError, permissionMessage } from "@/services/api";

interface AdvisorRow {
  userId: string; displayName: string; email: string; status: string;
  commissionPct: number | null; notesAr: string; activeCases: number;
}

/** المستشارون — شروطُ عملهم لا حالاتُهم.

    كان المستشارُ دورا على حسابٍ لا غير: تُسنَد إليه الحالات من «الاستثناءات»
    ويُبتّ في طلباته من «طلبات المستشارين»، ولا موضعَ يُكتب فيه ما يستحقّه على
    ما يُغلقه. فالعمولةُ تُتّفق خارج المنصّة وتُحسب بالذاكرة — وأوّلُ خلافٍ
    عليها لا سجلَّ يفصله.

    و«لم تُتّفق بعد» غيرُ «صفر بالمئة»: الأولى تُنتظر والثانية قرار. */
export default function Advisors() {
  const [rows, setRows] = useState<AdvisorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ commissionPct: "", notesAr: "" });

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try { setRows(await apiGet<AdvisorRow[]>("/api/admin/advisors")); }
    catch (e) { setOffline(permissionMessage(e, "الخادم غير متصل")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (userId: string) => {
    const pct = Number(form.commissionPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) { setFlash("النسبةُ بين صفرٍ ومئة."); return; }
    setBusy(true); setFlash("");
    try {
      const res = await apiPatch<{ error?: { message_ar: string } }>(`/api/admin/advisors/${userId}`, {
        commissionPct: pct, notesAr: form.notesAr.trim() || undefined,
      });
      if (res?.error) { setFlash(res.error.message_ar); return; }
      setFlash("حُفظت العمولة — وسُجّل التغيير بصاحبه ووقته.");
      setEditing(null);
      await load();
    } catch (e) { setFlash(e instanceof ApiError ? e.message : "تعذّر الحفظ"); }
    finally { setBusy(false); }
  };

  const matched = rows.filter((r) => matchesQuery(q, [r.displayName, r.email]));
  const view = paginate(matched, page, 20);

  if (offline) {
    return (
      <AdminLayout title="المستشارون">
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
    <AdminLayout title="المستشارون — العمولة وشروط العمل">
      <p className="mb-5 max-w-2xl text-xs leading-6 text-white/50">
        نسبةُ العمولة تُكتب هنا لا تُتذكَّر، ويُسجَّل كلُّ تغييرٍ فيها بصاحبه ووقته والرقمين معا.
        وإسنادُ الحالات من «الاستثناءات»، والبتُّ في طلبات الخصم من «طلبات المستشارين».
      </p>
      {flash && <p className="mb-4 rounded-xl border border-teal/30 bg-teal/5 px-4 py-2.5 text-xs font-bold text-teal-light-ink" role="status">{flash}</p>}

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <UserCheck className="h-12 w-12 text-white/20" />
          <p className="mt-4 max-w-md text-sm text-white/50">
            لا مستشارين بعد — يصير الحسابُ مستشارا بإسناد دور «مستشار» من شاشة المستخدمين.
          </p>
        </div>
      ) : (
        <>
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="مستشارا"
            placeholder="ابحث باسمٍ أو بريد…" />
          {view.total === 0 ? (
            <p className="rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-white/45">
              لا مستشار يطابق «{q.trim()}».
            </p>
          ) : (
            <div className="space-y-3">
              {view.rows.map((r) => (
                <div key={r.userId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-black">
                        {r.displayName || "—"}
                        <span className="mr-2 text-[11px] font-normal text-white/40" dir="ltr">{r.email}</span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                        <span className={`rounded-full border px-2.5 py-0.5 font-bold ${r.commissionPct === null ? "border-white/20 text-white/45" : "border-gold/45 text-gold-ink"}`}>
                          {r.commissionPct === null ? "لم تُتّفق العمولة بعد" : `عمولة ${r.commissionPct}%`}
                        </span>
                        <span>{r.activeCases} حالةً مسندة</span>
                        {r.status !== "active" && <span className="text-red-400">موقوف</span>}
                      </p>
                      {r.notesAr && <p className="mt-1.5 text-[11px] leading-6 text-white/45">{r.notesAr}</p>}
                    </div>
                    <button
                      onClick={() => {
                        setEditing(editing === r.userId ? null : r.userId);
                        setForm({ commissionPct: r.commissionPct === null ? "" : String(r.commissionPct), notesAr: r.notesAr });
                        setFlash("");
                      }}
                      className="flex cursor-pointer items-center gap-1.5 rounded-full border border-gold/45 px-4 py-1.5 text-xs font-bold text-gold-ink hover:bg-gold/10">
                      <BadgePercent className="h-3.5 w-3.5" /> {editing === r.userId ? "إغلاق" : "العمولة"}
                    </button>
                  </div>

                  {editing === r.userId && (
                    <div className="mt-4 grid gap-3 rounded-xl border border-gold/25 bg-black/25 p-4 sm:grid-cols-[8rem_1fr_auto]">
                      <label className="text-[11px] text-white/50">
                        النسبة %
                        <input type="number" min={0} max={100} step={0.5} value={form.commissionPct}
                          onChange={(e) => setForm({ ...form, commissionPct: e.target.value })}
                          aria-label="نسبة العمولة"
                          className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:border-gold focus:outline-none" />
                      </label>
                      <label className="text-[11px] text-white/50">
                        ملاحظة (اختيارية)
                        <input value={form.notesAr} onChange={(e) => setForm({ ...form, notesAr: e.target.value })}
                          placeholder="شرطٌ أو استثناءٌ متّفقٌ عليه"
                          aria-label="ملاحظة على شرط العمل"
                          className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-gold focus:outline-none" />
                      </label>
                      <div className="flex items-end">
                        <button disabled={busy} onClick={() => void save(r.userId)}
                          className="cursor-pointer rounded-full bg-gold px-5 py-2 text-xs font-black text-on-gold hover:bg-gold/90 disabled:opacity-40">
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "احفظ"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}

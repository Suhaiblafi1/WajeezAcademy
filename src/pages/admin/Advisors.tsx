import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import { BadgePercent, ChevronDown, ChevronUp, Loader2, RefreshCw, ServerOff, Star, UserCheck } from "lucide-react";
import AdminLayout from "./AdminLayout";
import ListToolbar from "@/components/admin/ListToolbar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { apiGet, apiPatch, ApiError, permissionMessage } from "@/services/api";
import { fmtMoney, fmtDate } from "@/application/text/format-ar";

interface AdvisorRow {
  userId: string; displayName: string; email: string; status: string;
  commissionPct: number | null; notesAr: string; activeCases: number;
}

interface AdvisorDetail {
  revenueFromReferrals: number; commissionOwed: number; currency: string;
  ratingAvg: number | null; ratingCount: number;
  cases: { caseId: string; status: string; clientName: string; clientEmail: string | null; assignedAt: string }[];
  requests: { id: string; kind: string; status: string; reasonAr: string; createdAt: string; decidedAt: string | null }[];
}

const REQUEST_KIND_AR: Record<string, string> = { discount: "خصم", plan_add: "إضافة دورة", plan_remove: "حذف دورة" };
const REQUEST_STATUS_AR: Record<string, string> = { pending: "قيد البتّ", approved: "معتمد", rejected: "مرفوض", cancelled: "مسحوب" };

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
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ commissionPct: "", notesAr: "" });
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdvisorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const toggleDetail = async (userId: string) => {
    if (detailFor === userId) { setDetailFor(null); setDetail(null); return; }
    setDetailFor(userId); setDetail(null); setDetailLoading(true);
    try { setDetail(await apiGet<AdvisorDetail>(`/api/admin/advisors/${userId}`)); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذّر جلب ملفّ المستشار"); }
    finally { setDetailLoading(false); }
  };

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try { setRows(await apiGet<AdvisorRow[]>("/api/admin/advisors")); }
    catch (e) { setOffline(permissionMessage(e, "الخادم غير متصل")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (userId: string) => {
    const pct = Number(form.commissionPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) { toastError("النسبةُ بين صفرٍ ومئة."); return; }
    setBusy(true);
    try {
      const res = await apiPatch<{ error?: { message_ar: string } }>(`/api/admin/advisors/${userId}`, {
        commissionPct: pct, notesAr: form.notesAr.trim() || undefined,
      });
      if (res?.error) { toastError(res.error.message_ar); return; }
      toast("حُفظت العمولة — وسُجّل التغيير بصاحبه ووقته.");
      setEditing(null);
      await load();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذّر الحفظ"); }
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
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => void toggleDetail(r.userId)}
                        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-xs font-bold text-white/70 hover:border-teal/50 hover:text-teal-light-ink">
                        {detailFor === r.userId ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} الملفّ الكامل
                      </button>
                      <button
                        onClick={() => {
                          setEditing(editing === r.userId ? null : r.userId);
                          setForm({ commissionPct: r.commissionPct === null ? "" : String(r.commissionPct), notesAr: r.notesAr });
                        }}
                        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-gold/45 px-4 py-1.5 text-xs font-bold text-gold-ink hover:bg-gold/10">
                        <BadgePercent className="h-3.5 w-3.5" /> {editing === r.userId ? "إغلاق" : "العمولة"}
                      </button>
                    </div>
                  </div>

                  {detailFor === r.userId && (
                    <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
                      {detailLoading ? (
                        <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-white/30" /></div>
                      ) : !detail ? null : (
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-4 text-[11px]">
                            <span className="text-white/50">
                              إيراد العملاء المحوَّلين: <b className="text-white/85">{fmtMoney(detail.revenueFromReferrals, detail.currency)}</b>
                            </span>
                            <span className="text-white/50">
                              العمولة المستحقّة: <b className="text-gold-ink">{fmtMoney(detail.commissionOwed, detail.currency)}</b>
                            </span>
                            <span className="flex items-center gap-1 text-white/50">
                              <Star className="h-3 w-3 text-gold" />
                              {detail.ratingAvg === null
                                ? `تقييمات قليلة (${detail.ratingCount}) — لا يُعرض المعدَّل قبل ثلاثة`
                                : `${detail.ratingAvg.toFixed(1)} من ٥ (${detail.ratingCount} تقييما)`}
                            </span>
                          </div>

                          <div>
                            <p className="mb-1.5 text-micro font-black text-white/40">الحالات المسندة ({detail.cases.length})</p>
                            {detail.cases.length === 0 ? (
                              <p className="text-[11px] text-white/40">لا حالات مسندة له حاليا.</p>
                            ) : (
                              <ul className="space-y-1">
                                {detail.cases.map((c) => (
                                  <li key={c.caseId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-1.5 text-[11px]">
                                    <span>{c.clientName} {c.clientEmail && <span dir="ltr" className="text-white/40">— {c.clientEmail}</span>}</span>
                                    <span className="text-white/45">{c.status} · {fmtDate(new Date(c.assignedAt))}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div>
                            <p className="mb-1.5 text-micro font-black text-white/40">طلباته ({detail.requests.length})</p>
                            {detail.requests.length === 0 ? (
                              <p className="text-[11px] text-white/40">لم يرفع أي طلب خصم أو تعديل خطّة بعد.</p>
                            ) : (
                              <ul className="space-y-1">
                                {detail.requests.map((req) => (
                                  <li key={req.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-1.5 text-[11px]">
                                    <span>{REQUEST_KIND_AR[req.kind] ?? req.kind} — {req.reasonAr}</span>
                                    <span className="text-white/45">{REQUEST_STATUS_AR[req.status] ?? req.status} · {fmtDate(new Date(req.createdAt))}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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

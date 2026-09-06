import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import { BadgePercent, ChevronDown, ChevronUp, Loader2, RefreshCw, ServerOff, Star, UserCheck } from "lucide-react";
import AdminLayout from "./AdminLayout";
import ListToolbar from "@/components/admin/ListToolbar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { apiGet, apiPatch, ApiError, permissionMessage } from "@/services/api";
import { fmtMoney, fmtDate } from "@/application/text/format-ar";

import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
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
    <AdminLayout title="المستشارون — العمولة وشروط العمل">
      <p className="mb-5 max-w-2xl text-xs leading-6 text-muted-foreground">
        نسبةُ العمولة تُكتب هنا لا تُتذكَّر، ويُسجَّل كلُّ تغييرٍ فيها بصاحبه ووقته والرقمين معا.
        وإسنادُ الحالات من «الاستثناءات»، والبتُّ في طلبات الخصم من «طلبات المستشارين».
      </p>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      ) : rows.length === 0 ? (
        <Panel className="grid place-items-center py-20 text-center">
          <UserCheck className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            لا مستشارين بعد — يصير الحسابُ مستشارا بإسناد دور «مستشار» من شاشة المستخدمين.
          </p>
        </Panel>
      ) : (
        <>
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="مستشارا"
            placeholder="ابحث باسمٍ أو بريد…" />
          {view.total === 0 ? (
            <p className="rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-muted-foreground">
              لا مستشار يطابق «{q.trim()}».
            </p>
          ) : (
            <div className="space-y-3">
              {view.rows.map((r) => (
                <Card key={r.userId}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-black">
                        {r.displayName || "—"}
                        <span className="mr-2 text-micro font-normal text-muted-foreground" dir="ltr">{r.email}</span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-micro text-muted-foreground">
                        <span className={`rounded-full border px-2.5 py-0.5 font-bold ${r.commissionPct === null ? "border-white/20 text-muted-foreground" : "border-gold/45 text-gold-ink"}`}>
                          {r.commissionPct === null ? "لم تُتّفق العمولة بعد" : `عمولة ${r.commissionPct}%`}
                        </span>
                        <span>{r.activeCases} حالةً مسندة</span>
                        {r.status !== "active" && <span className="text-red-400">موقوف</span>}
                      </p>
                      {r.notesAr && <p className="mt-1.5 text-micro leading-6 text-muted-foreground">{r.notesAr}</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button tone="secondary" size="sm" onClick={() => void toggleDetail(r.userId)}>
                        {detailFor === r.userId ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} الملفّ الكامل
                      </Button>
                      <Button tone="primary" size="sm" onClick={() => {
                          setEditing(editing === r.userId ? null : r.userId);
                          setForm({ commissionPct: r.commissionPct === null ? "" : String(r.commissionPct), notesAr: r.notesAr });
                        }} className="text-gold-ink">
                        <BadgePercent className="h-3.5 w-3.5" /> {editing === r.userId ? "إغلاق" : "العمولة"}
                      </Button>
                    </div>
                  </div>

                  {detailFor === r.userId && (
                    <Inset className="mt-4">
                      {detailLoading ? (
                        <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" /></div>
                      ) : !detail ? null : (
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-4 text-micro">
                            <span className="text-muted-foreground">
                              إيراد العملاء المحوَّلين: <b className="text-foreground">{fmtMoney(detail.revenueFromReferrals, detail.currency)}</b>
                            </span>
                            <span className="text-muted-foreground">
                              العمولة المستحقّة: <b className="text-gold-ink">{fmtMoney(detail.commissionOwed, detail.currency)}</b>
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Star className="h-3 w-3 text-gold" />
                              {detail.ratingAvg === null
                                ? `تقييمات قليلة (${detail.ratingCount}) — لا يُعرض المعدَّل قبل ثلاثة`
                                : `${detail.ratingAvg.toFixed(1)} من ٥ (${detail.ratingCount} تقييما)`}
                            </span>
                          </div>

                          <div>
                            <p className="mb-1.5 text-micro font-black text-muted-foreground">الحالات المسندة ({detail.cases.length})</p>
                            {detail.cases.length === 0 ? (
                              <p className="text-micro text-muted-foreground">لا حالات مسندة له حاليا.</p>
                            ) : (
                              <ul className="space-y-1">
                                {detail.cases.map((c) => (
                                  <li key={c.caseId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-1.5 text-micro">
                                    <span>{c.clientName} {c.clientEmail && <span dir="ltr" className="text-muted-foreground">— {c.clientEmail}</span>}</span>
                                    <span className="text-muted-foreground">{c.status} · {fmtDate(new Date(c.assignedAt))}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div>
                            <p className="mb-1.5 text-micro font-black text-muted-foreground">طلباته ({detail.requests.length})</p>
                            {detail.requests.length === 0 ? (
                              <p className="text-micro text-muted-foreground">لم يرفع أي طلب خصم أو تعديل خطّة بعد.</p>
                            ) : (
                              <ul className="space-y-1">
                                {detail.requests.map((req) => (
                                  <li key={req.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-1.5 text-micro">
                                    <span>{REQUEST_KIND_AR[req.kind] ?? req.kind} — {req.reasonAr}</span>
                                    <span className="text-muted-foreground">{REQUEST_STATUS_AR[req.status] ?? req.status} · {fmtDate(new Date(req.createdAt))}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                    </Inset>
                  )}

                  {editing === r.userId && (
                    <Inset tone="warn" className="mt-4 grid gap-3 sm:grid-cols-[8rem_1fr_auto]">
                      <label className="text-micro text-muted-foreground">
                        النسبة %
                        <input type="number" min={0} max={100} step={0.5} value={form.commissionPct}
                          onChange={(e) => setForm({ ...form, commissionPct: e.target.value })}
                          aria-label="نسبة العمولة"
                          className="mt-1 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none" />
                      </label>
                      <label className="text-micro text-muted-foreground">
                        ملاحظة (اختيارية)
                        <input value={form.notesAr} onChange={(e) => setForm({ ...form, notesAr: e.target.value })}
                          placeholder="شرطٌ أو استثناءٌ متّفقٌ عليه"
                          aria-label="ملاحظة على شرط العمل"
                          className="mt-1 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-gold focus:outline-none" />
                      </label>
                      <div className="flex items-end">
                        <Button tone="primary" disabled={busy} onClick={() => void save(r.userId)}>
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "احفظ"}
                        </Button>
                      </div>
                    </Inset>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}

/* المؤثّرون في «منحة مؤثرين وجيز» — إضافتُهم وأكوادُهم وعمولاتُهم وما دُفع لهم (٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «كيف أضيف اسمَ المؤثّر… لكلّ مؤثّرٍ كودٌ خاصٌّ فيه». فهنا: يُضاف باسمه وكوده وعمولته وبريده
   (فيُنشأ له حسابٌ بدعوة، أو يُربط بحسابه إن كان له)، ثمّ لكلٍّ صفٌّ بأرقامه، ويُفتح فيرى من اشترى بكوده، ويُسجَّل
   ما دُفع له. والكودُ لا يتغيّر بعد إضافته — هو في رابطه المنشور. والعلّةُ في `server/services/influencer.service.ts`. */

import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import ConfirmAction from "@/components/ConfirmAction";
import ListToolbar from "@/components/admin/ListToolbar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { apiGet, apiPatch, apiPost, ApiError } from "@/services/api";
import { fmtDate, fmtMoney } from "@/application/text/format-ar";
import { INFLUENCER_COMMISSION_DEFAULT, INFLUENCER_CODE_FORMAT_AR, normalizeInfluencerCode } from "@/application/commerce/influencer";
import { staffControlCls } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";

interface Totals { signups: number; codes: number; buyers: number; sales: number; earned: number; paid: number; balance: number }
interface Influencer {
  id: string; nameAr: string; code: string; commissionPercent: number; active: boolean; link: string;
  email: string | null; accountStatus: string | null; createdAt: string; totals: Totals; currency: string;
}
interface Statement {
  currency: string; totals: Totals;
  rows: { orderId: string; at: string; buyerAr: string; courses: number; listTotal: number; percent: number; commission: number; stateAr: string }[];
  payouts: { id: string; amount: number; currency: string; noteAr: string | null; paidAt: string }[];
}

const errAr = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export default function InfluencersPanel() {
  const [list, setList] = useState<Influencer[] | null>(null);
  const [form, setForm] = useState({ nameAr: "", code: "", commission: String(INFLUENCER_COMMISSION_DEFAULT), email: "" });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try { setList(await apiGet<Influencer[]>("/api/admin/influencers")); } catch { setList([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const code = normalizeInfluencerCode(form.code);
  const commission = Number(form.commission);
  const commissionOk = Number.isInteger(commission) && commission >= 0 && commission <= 100;
  const canAdd = form.nameAr.trim().length >= 2 && code !== null && commissionOk;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const out = await apiPost<{ account: { created: boolean; inviteSent: boolean | null } | null }>("/api/admin/influencers", {
        nameAr: form.nameAr.trim(), code, commissionPercent: commission, email: form.email.trim() || null,
      });
      toast(!out.account ? "أضيف المؤثر" : out.account.created
        ? (out.account.inviteSent ? "أضيف المؤثر، ووصلته دعوة حسابه" : "أضيف المؤثر وأنشئ حسابه، ولم ترسل الدعوة. اطلب منه «نسيت كلمة المرور»")
        : "أضيف المؤثر وربط بحسابه");
      setForm({ nameAr: "", code: "", commission: String(INFLUENCER_COMMISSION_DEFAULT), email: "" });
      await load();
    } catch (err) { toastError(errAr(err, "تعذر إضافة المؤثر")); }
    finally { setBusy(false); }
  };

  return (
    <>
      <h2 className="mt-6 text-lg font-black">المؤثرون</h2>
      <p className="mt-1 text-read text-muted-foreground">
        لكل مؤثر كود ورابط. من يعبئ النموذج بكوده يأخذ كود منحة، ومن يشتري به تحسب للمؤثر عمولته من سعر الدورات قبل الخصم.
      </p>

      <Card as="form" onSubmit={add} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-read">اسم المؤثر
          <input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className={staffControlCls} />
        </label>
        <label className="grid gap-1 text-read">الكود
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} dir="ltr" placeholder="SARA" className={staffControlCls} />
        </label>
        <label className="grid gap-1 text-read">العمولة %
          <input type="number" min={0} max={100} value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} className={staffControlCls} />
        </label>
        <label className="grid gap-1 text-read">بريده (لحسابه)
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" placeholder="اختياري" className={staffControlCls} />
        </label>
        <Button type="submit" disabled={busy || !canAdd}>أضف المؤثر</Button>
        {form.code.trim() !== "" && code === null && <p className="w-full text-read text-danger-ink">{INFLUENCER_CODE_FORMAT_AR}</p>}
      </Card>

      {list === null ? null : list.length === 0 ? (
        <Card as="p" className="mt-3 text-read text-muted-foreground">لا مؤثرين بعد.</Card>
      ) : (() => {
        const view = paginate(list.filter((x) => matchesQuery(q, [x.nameAr, x.code, x.email])), page, 20);
        return (
          <div className="mt-3">
            <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="مؤثرا" placeholder="ابحث باسم المؤثر أو كوده أو بريده" />
            <div className="space-y-3">
              {view.rows.map((x) => (
                <InfluencerRow key={x.id} x={x} open={open === x.id} onToggle={() => setOpen(open === x.id ? null : x.id)} onChanged={load} />
              ))}
            </div>
          </div>
        );
      })()}
    </>
  );
}

function InfluencerRow({ x, open, onToggle, onChanged }: { x: Influencer; open: boolean; onToggle: () => void; onChanged: () => Promise<void> }) {
  const money = (n: number) => fmtMoney(n, x.currency);
  const [st, setSt] = useState<Statement | null>(null);
  const [commission, setCommission] = useState(String(x.commissionPercent));
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<null | "commission" | "active" | "payout">(null);
  const [busy, setBusy] = useState(false);

  const loadStatement = useCallback(async () => {
    try { setSt(await apiGet<Statement>(`/api/admin/influencers/${x.id}/statement`)); } catch { setSt(null); }
  }, [x.id]);
  useEffect(() => { if (open) void loadStatement(); }, [open, loadStatement]);

  const commissionNum = Number(commission);
  const commissionOk = Number.isInteger(commissionNum) && commissionNum >= 0 && commissionNum <= 100;
  const amountNum = Number(amount);

  const run = async (fn: () => Promise<unknown>, doneAr: string, failAr: string) => {
    setBusy(true);
    try { await fn(); toast(doneAr); setConfirm(null); await onChanged(); await loadStatement(); }
    catch (e) { toastError(errAr(e, failAr)); }
    finally { setBusy(false); }
  };

  return (
    <Inset>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black">
            {x.nameAr} <bdi dir="ltr" className="text-muted-foreground">{x.code}</bdi>{" "}
            {!x.active && <Chip tone="warn">موقوف</Chip>}
          </p>
          <p className="mt-0.5 truncate text-read text-muted-foreground" dir="ltr">{x.link}</p>
          <p className="mt-0.5 text-read text-muted-foreground">
            عمولته {x.commissionPercent}% · {x.email ? `حسابه ${x.email}${x.accountStatus === "invited" ? " (لم يفعله بعد)" : ""}` : "بلا حساب"}
          </p>
        </div>
        <p className="text-read font-bold">
          سجل {x.totals.signups} · اشترى {x.totals.buyers} · له <bdi dir="ltr">{money(x.totals.earned)}</bdi> · دفع <bdi dir="ltr">{money(x.totals.paid)}</bdi> · بقي <bdi dir="ltr">{money(x.totals.balance)}</bdi>
        </p>
        <Button size="sm" onClick={onToggle}>{open ? "أغلق" : "التفاصيل"}</Button>
      </div>

      {open && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-read">العمولة %
              <input type="number" min={0} max={100} value={commission} onChange={(e) => setCommission(e.target.value)} className={staffControlCls} />
            </label>
            <Button size="sm" disabled={busy || !commissionOk || commissionNum === x.commissionPercent} onClick={() => setConfirm("commission")}>احفظ العمولة</Button>
            <Button size="sm" disabled={busy} onClick={() => setConfirm("active")}>{x.active ? "أوقف الكود" : "شغل الكود"}</Button>
          </div>

          {!x.email && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-read">بريده لحسابه
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className={staffControlCls} />
              </label>
              <Button size="sm" disabled={busy || !/\S+@\S+\.\S+/.test(email)}
                onClick={() => void run(() => apiPost(`/api/admin/influencers/${x.id}/account`, { email }), "ربط الحساب، وإن كان جديدا وصلته دعوة", "تعذر ربط الحساب")}>
                أنشئ حسابه أو اربطه
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-read">دفعة دفعت له
              <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" className={staffControlCls} />
            </label>
            <label className="grid gap-1 text-read">ملاحظة
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلا تحويل بنكي" className={staffControlCls} />
            </label>
            <Button size="sm" disabled={busy || !(amountNum > 0)} onClick={() => setConfirm("payout")}>سجل الدفعة</Button>
          </div>

          {st && (
            st.rows.length === 0 ? (
              <p className="text-read text-muted-foreground">لم يشتر أحد بكوده بعد.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-read">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="p-2 text-start">التاريخ</th>
                      <th className="p-2 text-start">المتعلم</th>
                      <th className="p-2 text-start">الدورات</th>
                      <th className="p-2 text-start">سعر الدورات</th>
                      <th className="p-2 text-start">العمولة</th>
                      <th className="p-2 text-start">الحال</th>
                    </tr>
                  </thead>
                  <tbody>
                    {st.rows.map((r) => (
                      <tr key={r.orderId} className="border-t border-border">
                        <td className="p-2">{fmtDate(new Date(r.at))}</td>
                        <td className="p-2">{r.buyerAr}</td>
                        <td className="p-2">{r.courses}</td>
                        <td className="p-2" dir="ltr">{money(r.listTotal)}</td>
                        <td className="p-2 font-bold" dir="ltr">{money(r.commission)} <span className="text-muted-foreground">({r.percent}%)</span></td>
                        <td className="p-2">{r.stateAr}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          {st && st.payouts.length > 0 && (
            <div>
              <p className="font-bold">ما دفع له</p>
              {st.payouts.map((p) => (
                <p key={p.id} className="text-read">{fmtDate(new Date(p.paidAt))} · <bdi dir="ltr">{fmtMoney(p.amount, p.currency)}</bdi>{p.noteAr ? ` · ${p.noteAr}` : ""}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {confirm === "commission" && (
        <ConfirmAction tone="default" titleAr="تغيير عمولة المؤثر" confirmLabelAr="احفظ" busy={busy} onCancel={() => setConfirm(null)}
          onConfirm={() => void run(() => apiPatch(`/api/admin/influencers/${x.id}`, { commissionPercent: commissionNum }), "حفظت العمولة", "تعذر حفظ العمولة")}>
          <p>العمولة الجديدة {commissionNum}% على أكواد المنحة التي تعطى بكوده بعد الحفظ. وما أعطي قبله يبقى بعمولته {x.commissionPercent}%.</p>
        </ConfirmAction>
      )}
      {confirm === "active" && (
        <ConfirmAction tone="default" titleAr={x.active ? "إيقاف كود المؤثر" : "تشغيل كود المؤثر"} confirmLabelAr={x.active ? "أوقف" : "شغل"} busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void run(() => apiPatch(`/api/admin/influencers/${x.id}`, { active: !x.active }), x.active ? "أوقف الكود" : "شغل الكود", "تعذر الحفظ")}>
          <p>{x.active
            ? "لا يأخذ أحد كود منحة جديدا بكوده. ومن أخذ كودا قبله يستعمله، وتحسب عمولته كما هي."
            : "يعود كوده يعطي أكواد المنحة لمن يعبئ النموذج."}</p>
        </ConfirmAction>
      )}
      {confirm === "payout" && (
        <ConfirmAction tone="default" titleAr="تسجيل دفعة للمؤثر" confirmLabelAr="سجل" busy={busy} onCancel={() => setConfirm(null)}
          onConfirm={() => void run(async () => { await apiPost(`/api/admin/influencers/${x.id}/payouts`, { amount: amountNum, noteAr: note.trim() || null }); setAmount(""); setNote(""); }, "سجلت الدفعة", "تعذر تسجيل الدفعة")}>
          <p>تسجل دفعة <bdi dir="ltr">{money(amountNum)}</bdi> لـ{x.nameAr}، فينقص رصيده إلى <bdi dir="ltr">{money(x.totals.balance - amountNum)}</bdi>. ويراها في حسابه.</p>
        </ConfirmAction>
      )}
    </Inset>
  );
}

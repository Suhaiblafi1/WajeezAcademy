/* المؤثّرون في «منحة مؤثرين وجيز» — إضافتُهم وأكوادُهم وعمولاتُهم وما دُفع لهم (٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «كيف أضيف اسمَ المؤثّر… لكلّ مؤثّرٍ كودٌ خاصٌّ فيه». فهنا: يُضاف باسمه وكوده وعمولته وبريده
   (فيُنشأ له حسابٌ بدعوة، أو يُربط بحسابه إن كان له)، ثمّ لكلٍّ صفٌّ بأرقامه، ويُفتح فيرى من اشترى بكوده، ويُسجَّل
   ما دُفع له. والعلّةُ في `server/services/influencer.service.ts`.

   ═══ وكودُه يتغيّر، ولكلٍّ خصمُه ورابطاه (١٥ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «اسمح لي تغيير الكود هناك وقيمة الخصم للمؤثر كلا على حدا». فلكلّ مؤثّرٍ هنا: كودُه يُغيَّر بسطرٍ يقول
   إنّ الرابطَ القديمَ يبقى يعمل، وخصمُ متابعيه (فارغٌ بنسبة الحملة) على ما يُعطى بعد الحفظ، ورابطاه في منحة المؤثّرين و«بلاك
   فرايدي وجيز».

   وفوقها طلباتُ الانضمام من «انضم كمؤثر» (`InfluencerApplications.tsx`، ٣١ أكتوبر ٢٠٢٦): يُقبَل منها بكوده وعمولته
   فيصير صفّا هنا. والدفعةُ الزائدةُ على رصيده تُعرض بخيارَيها — «سجلها سلفة» أو «عدل المبلغ» — لا تُمنع (`recordPayout`).

   ═══ وتفاصيلُه كلُّها تتغيّر (١٥ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «منحني فرصة تغيير اسم صاحب المنحة المؤثر وتغيير كل التفاصيل، إيميله، رقمه». فاسمُه ورقمُه يُحفظان
   بتأكيدٍ كالعمولة، وبريدُه يُغيَّر بتأكيدٍ يقول ما يقع: ملفُّه إلى حساب البريد الجديد، والقديمُ لا يرى صفحتَه بعدُ، ويصل الجديدَ
   بريدُ الترحيب بكوده وطريقِ دخوله. ومن لم يفعّل حسابَه تُعاد له الدعوة. والعلّةُ في `influencer.service.ts` (١ب).

   ودوراتُه في تفاصيله (١٥ نوفمبر ٢٠٢٦، `GrantCourseChoice`): بعضُ دورات «منحة مؤثرين وجيز» تظهر في صفحته — والافتراضيُّ
   دوراتُها كلُّها. وكودُ من جاء به يخصم على أيّ دورةٍ حتى حدّه. */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import ConfirmAction from "@/components/ConfirmAction";
import ListToolbar from "@/components/admin/ListToolbar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { apiGet, apiPatch, apiPost, ApiError } from "@/services/api";
import { fmtDate, fmtMoney } from "@/application/text/format-ar";
import { INFLUENCER_COMMISSION_DEFAULT, INFLUENCER_CODE_FORMAT_AR, INFLUENCER_CODE_KEEPS_AR, INFLUENCER_DISCOUNT_BAD_AR, INFLUENCER_PHONE_BAD_AR, cleanInfluencerPhone, normalizeInfluencerCode } from "@/application/commerce/influencer";
import { INFLUENCER_GRANT_NAME_AR, grantClosesAt, grantLastDay } from "@/application/commerce/grant";
import { staffControlCls } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import InfluencerApplications from "./InfluencerApplications";
import GrantCourseChoice from "./GrantCourseChoice";

interface Totals { signups: number; codes: number; buyers: number; sales: number; earned: number; paid: number; balance: number }
interface Influencer {
  id: string; nameAr: string; code: string; commissionPercent: number; active: boolean; link: string;
  /** خصمُ متابعيه — وفارغٌ بنسبة الحملة */
  percentOff: number | null;
  /** آخرُ يومٍ لمنحة متابعيه — وفارغٌ بنهاية الحملة (١٧ نوفمبر ٢٠٢٦) */
  closesAt: string | null;
  /** أكوادُه السابقة — روابطُها تعمل */
  formerCodes: string[];
  /** رابطاه في حملتَي المؤثّرين */
  links: { influencer: string; blackFriday: string };
  /** رقمُه بشكله — أو بلا رقم */
  phone: string | null;
  email: string | null; accountStatus: string | null; createdAt: string; totals: Totals; currency: string;
}
interface Statement {
  currency: string; totals: Totals;
  rows: { orderId: string; at: string; buyerAr: string; courses: number; listTotal: number; percent: number; commission: number; stateAr: string }[];
  payouts: { id: string; amount: number; currency: string; noteAr: string | null; paidAt: string }[];
}

const errAr = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** ما يصل المؤثّرَ حين يُربط حسابُه أو يتغيّر بريدُه — كما يقال في الإضافة */
type Connected = { account: { created: boolean; inviteSent: boolean | null }; emailDelivery: string };
const welcomeAr = (delivery: string) => (delivery === "sent" ? "، ووصلته رسالة بكوده" : "، ولم ترسل رسالة كوده");
function connectedAr(out: Connected): string {
  return out.account.created
    ? (out.account.inviteSent ? `أنشئ حسابه، ووصلته دعوة حسابه${welcomeAr(out.emailDelivery)}` : "أنشئ حسابه ولم ترسل الدعوة. اطلب منه «نسيت كلمة المرور»")
    : `ربط بحسابه${welcomeAr(out.emailDelivery)}`;
}

/** خانةُ الخصم → رقمُه، أو `null` فارغةً (نسبةُ الحملة)، أو `undefined` إن لم تصحّ */
function discountOf(raw: string): number | null | undefined {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : undefined;
}

export default function InfluencersPanel() {
  const [list, setList] = useState<Influencer[] | null>(null);
  const [form, setForm] = useState({ nameAr: "", code: "", commission: String(INFLUENCER_COMMISSION_DEFAULT), discount: "", email: "", phone: "" });
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
  const discount = discountOf(form.discount);
  /* والبريدُ لازم — لكلّ مؤثّرٍ حسابٌ وصفحة، ويصله بريدُ ترحيبٍ كمن قُبل طلبُه (١٥ نوفمبر ٢٠٢٦) */
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  /* ورقمُه اختياريّ — بشكل الرقم إن كُتب (١٥ نوفمبر ٢٠٢٦) */
  const phone = cleanInfluencerPhone(form.phone);
  const canAdd = form.nameAr.trim().length >= 2 && code !== null && commissionOk && discount !== undefined && emailOk && phone !== undefined;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const out = await apiPost<{ account: { created: boolean; inviteSent: boolean | null }; emailDelivery: string }>("/api/admin/influencers", {
        nameAr: form.nameAr.trim(), code, commissionPercent: commission, percentOff: discount, email: form.email.trim(), phone,
      });
      const welcome = out.emailDelivery === "sent" ? "، ووصلته رسالة بكوده" : "، ولم ترسل رسالة كوده";
      toast(out.account.created
        ? (out.account.inviteSent ? `أضيف المؤثر، ووصلته دعوة حسابه${welcome}` : "أضيف المؤثر وأنشئ حسابه، ولم ترسل الدعوة. اطلب منه «نسيت كلمة المرور»")
        : `أضيف المؤثر وربط بحسابه${welcome}`);
      setForm({ nameAr: "", code: "", commission: String(INFLUENCER_COMMISSION_DEFAULT), discount: "", email: "", phone: "" });
      await load();
    } catch (err) { toastError(errAr(err, "تعذر إضافة المؤثر")); }
    finally { setBusy(false); }
  };

  return (
    <>
      <InfluencerApplications onApproved={load} />

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
        <label className="grid gap-1 text-read">خصم متابعيه %
          <input type="number" min={0} max={100} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} placeholder="نسبة المنحة" className={staffControlCls} />
        </label>
        <label className="grid gap-1 text-read">بريده (لحسابه)
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" className={staffControlCls} />
        </label>
        <label className="grid gap-1 text-read">رقمه
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" placeholder="اختياري" className={staffControlCls} />
        </label>
        <Button type="submit" disabled={busy || !canAdd}>أضف المؤثر</Button>
        {form.code.trim() !== "" && code === null && <p className="w-full text-read text-danger-ink">{INFLUENCER_CODE_FORMAT_AR}</p>}
        {discount === undefined && <p className="w-full text-read text-danger-ink">{INFLUENCER_DISCOUNT_BAD_AR}</p>}
        {phone === undefined && <p className="w-full text-read text-danger-ink">{INFLUENCER_PHONE_BAD_AR}</p>}
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
  const [discount, setDiscount] = useState(x.percentOff === null ? "" : String(x.percentOff));
  const [lastDay, setLastDay] = useState(x.closesAt ? grantLastDay(x.closesAt) : "");
  const [newCode, setNewCode] = useState(x.code);
  const [name, setName] = useState(x.nameAr);
  const [phone, setPhone] = useState(x.phone ?? "");
  const [email, setEmail] = useState(x.email ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<null | "name" | "phone" | "email" | "commission" | "discount" | "closes" | "code" | "active" | "payout">(null);
  /* ما قاله الخادمُ حين زاد المبلغُ على رصيده — وتحته الخياران: سلفةٌ أو تعديلُ المبلغ */
  const [over, setOver] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const loadStatement = useCallback(async () => {
    try { setSt(await apiGet<Statement>(`/api/admin/influencers/${x.id}/statement`)); } catch { setSt(null); }
  }, [x.id]);
  useEffect(() => { if (open) void loadStatement(); }, [open, loadStatement]);

  const commissionNum = Number(commission);
  const commissionOk = Number.isInteger(commissionNum) && commissionNum >= 0 && commissionNum <= 100;
  const discountNum = discountOf(discount);
  const codeNorm = normalizeInfluencerCode(newCode);
  const nameNew = name.trim();
  const phoneNew = cleanInfluencerPhone(phone);
  const emailNew = email.trim().toLowerCase();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNew) && emailNew !== (x.email ?? "").toLowerCase();
  const amountNum = Number(amount);

  /* الدفعةُ — وما زاد على رصيده يعود بـ`payout_exceeds_balance` فيُعرض خياراه، لا يُسجَّل ولا يُمنع (`recordPayout`) */
  const pay = async (advance: boolean) => {
    setBusy(true);
    try {
      await apiPost(`/api/admin/influencers/${x.id}/payouts`, { amount: amountNum, noteAr: note.trim() || null, ...(advance ? { advance: true } : {}) });
      toast(advance ? "سجلت الدفعة سلفة" : "سجلت الدفعة");
      setAmount(""); setNote(""); setOver(null); setConfirm(null);
      await onChanged(); await loadStatement();
    } catch (e) {
      setConfirm(null);
      if (e instanceof ApiError && e.code === "payout_exceeds_balance") setOver(e.message);
      else toastError(errAr(e, "تعذر تسجيل الدفعة"));
    } finally { setBusy(false); }
  };

  /* وما يقال بعده قد يتبع جوابَ الخادم — ما وصل المؤثّرَ من رسائل */
  const run = async <T,>(fn: () => Promise<T>, doneAr: string | ((out: T) => string), failAr: string) => {
    setBusy(true);
    try { const out = await fn(); toast(typeof doneAr === "string" ? doneAr : doneAr(out)); setConfirm(null); await onChanged(); await loadStatement(); }
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
          {/* رابطُه في منحة المؤثّرين. ورابطُ بلاك فرايدي خرج من هنا (١٧ نوفمبر ٢٠٢٦): صارت منحةً للجميع لا تقرأ كودَ مؤثّر
              (`grant-merge.service.ts`)، فكان يوحي بأنّه يُحسب له وهو لا يُحسب */}
          <p className="mt-0.5 truncate text-read text-muted-foreground">{INFLUENCER_GRANT_NAME_AR}: <bdi dir="ltr">{x.links.influencer}</bdi></p>
          <p className="mt-0.5 text-read text-muted-foreground">
            {x.phone && <>رقمه <bdi dir="ltr">{x.phone}</bdi> · </>}
            عمولته {x.commissionPercent}% · خصم متابعيه {x.percentOff === null ? "نسبة المنحة" : `${x.percentOff}%`} · آخر يوم {x.closesAt ? fmtDate(new Date(new Date(x.closesAt).getTime() - 1)) : "نهاية المنحة"} · {x.email ? `حسابه ${x.email}${x.accountStatus === "invited" ? " (لم يفعله بعد)" : ""}` : "بلا حساب"}
            {x.formerCodes.length > 0 && <> · كان كوده <bdi dir="ltr">{x.formerCodes.join("، ")}</bdi></>}
          </p>
        </div>
        <p className="text-read font-bold">
          سجل {x.totals.signups} · اشترى {x.totals.buyers} · له <bdi dir="ltr">{money(x.totals.earned)}</bdi> · دفع <bdi dir="ltr">{money(x.totals.paid)}</bdi> · بقي <bdi dir="ltr">{money(x.totals.balance)}</bdi>
        </p>
        <Button size="sm" onClick={onToggle}>{open ? "أغلق" : "التفاصيل"}</Button>
      </div>

      {open && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          {/* اسمُه ورقمُه وبريدُه — كلُّها تتغيّر (١٥ نوفمبر ٢٠٢٦) */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-read">الاسم
              <input value={name} onChange={(e) => setName(e.target.value)} className={staffControlCls} />
            </label>
            <Button size="sm" disabled={busy || nameNew.length < 2 || nameNew === x.nameAr} onClick={() => setConfirm("name")}>احفظ الاسم</Button>
            <label className="grid gap-1 text-read">رقمه
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="بلا رقم" className={staffControlCls} />
            </label>
            <Button size="sm" disabled={busy || phoneNew === undefined || phoneNew === x.phone} onClick={() => setConfirm("phone")}>احفظ الرقم</Button>
            {phoneNew === undefined && <p className="w-full text-read text-danger-ink">{INFLUENCER_PHONE_BAD_AR}</p>}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-read">{x.email ? "بريده" : "بريده لحسابه"}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className={staffControlCls} />
            </label>
            <Button size="sm" disabled={busy || !emailOk} onClick={() => setConfirm("email")}>{x.email ? "غير البريد" : "أنشئ حسابه أو اربطه"}</Button>
            {x.accountStatus === "invited" && (
              <Button size="sm" disabled={busy}
                onClick={() => void run(() => apiPost<{ emailDelivery: string }>(`/api/admin/influencers/${x.id}/resend-invite`, {}),
                  (out) => (out.emailDelivery === "sent" ? "وصلته دعوة جديدة في رسالة بكوده، والقديمة أبطلت" : "لم ترسل الدعوة. قناة البريد غير موصولة"),
                  "تعذر إرسال الدعوة")}>
                أعد إرسال الدعوة
              </Button>
            )}
            {x.accountStatus === "invited" && <p className="w-full text-read text-muted-foreground">لم يفعل حسابه بعد. الدعوة الجديدة تصله مع كوده، وتبطل القديمة.</p>}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-read">العمولة %
              <input type="number" min={0} max={100} value={commission} onChange={(e) => setCommission(e.target.value)} className={staffControlCls} />
            </label>
            <Button size="sm" disabled={busy || !commissionOk || commissionNum === x.commissionPercent} onClick={() => setConfirm("commission")}>احفظ العمولة</Button>
            <Button size="sm" disabled={busy} onClick={() => setConfirm("active")}>{x.active ? "أوقف الكود" : "شغل الكود"}</Button>
          </div>

          {/* خصمُ متابعيه — فارغٌ بنسبة المنحة، وعلى ما يُعطى بعد الحفظ */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-read">خصم متابعيه %
              <input type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="نسبة المنحة" className={staffControlCls} />
            </label>
            <Button size="sm" disabled={busy || discountNum === undefined || discountNum === x.percentOff} onClick={() => setConfirm("discount")}>احفظ الخصم</Button>
            <p className="w-full text-read text-muted-foreground">فارغ يعني نسبة المنحة. والخصم الجديد على من يأخذ كودا بعد الحفظ فقط.</p>
          </div>

          {/* وآخرُ يومٍ لمتابعيه — يغلب نهايةَ المنحة له وحدَه (١٧ نوفمبر ٢٠٢٦، `influencerClosesAt`) */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-read">آخر يوم لمتابعيه
              <input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} className={staffControlCls} />
            </label>
            <Button size="sm" disabled={busy || (lastDay || null) === (x.closesAt ? grantLastDay(x.closesAt) : null)} onClick={() => setConfirm("closes")}>احفظ آخر يوم</Button>
            <p className="w-full text-read text-muted-foreground">فارغ يعني نهاية المنحة. وبه وحده تفتح صفحته ويأخذ متابعوه أكوادهم ويدفعون بها، ولو انتهت المنحة لغيره.</p>
          </div>

          {/* وكودُه — والرابطُ القديمُ يبقى يعمل */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-read">الكود
              <input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} dir="ltr" className={staffControlCls} />
            </label>
            <Button size="sm" disabled={busy || codeNorm === null || codeNorm === x.code} onClick={() => setConfirm("code")}>غير الكود</Button>
            <p className="w-full text-read text-muted-foreground">{codeNorm === null && newCode.trim() !== "" ? INFLUENCER_CODE_FORMAT_AR : INFLUENCER_CODE_KEEPS_AR}</p>
          </div>

          <GrantCourseChoice endpoint={`/api/admin/influencers/${x.id}/courses`} forInfluencer />

          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-read">دفعة دفعت له
              <input ref={amountRef} type="number" min={0} step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); setOver(null); }} dir="ltr" className={staffControlCls} />
            </label>
            <label className="grid gap-1 text-read">ملاحظة
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلا تحويل بنكي" className={staffControlCls} />
            </label>
            <Button size="sm" disabled={busy || !(amountNum > 0)} onClick={() => setConfirm("payout")}>سجل الدفعة</Button>
          </div>
          {over && (
            <Inset role="alert" tone="warn" className="space-y-3 px-4 py-3 text-read">
              <p>المبلغ أكبر من رصيده. {over}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" tone="confirm" disabled={busy} loading={busy} onClick={() => void pay(true)}>سجلها سلفة</Button>
                <Button size="sm" tone="secondary" disabled={busy} onClick={() => { setOver(null); amountRef.current?.focus(); }}>عدل المبلغ</Button>
              </div>
            </Inset>
          )}

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
      {confirm === "name" && (
        <ConfirmAction tone="default" titleAr="تغيير اسم المؤثر" confirmLabelAr="احفظ" busy={busy} onCancel={() => setConfirm(null)}
          onConfirm={() => void run(() => apiPatch(`/api/admin/influencers/${x.id}`, { nameAr: nameNew }), "حفظ الاسم", "تعذر حفظ الاسم")}>
          <p>يصير اسمه {nameNew}. ويظهر في صفحته وفي رسائله القادمة.</p>
        </ConfirmAction>
      )}
      {confirm === "phone" && (
        <ConfirmAction tone="default" titleAr="تغيير رقم المؤثر" confirmLabelAr="احفظ" busy={busy} onCancel={() => setConfirm(null)}
          onConfirm={() => void run(() => apiPatch(`/api/admin/influencers/${x.id}`, { phone: phoneNew ?? null }), "حفظ الرقم", "تعذر حفظ الرقم")}>
          <p>{phoneNew ? <>يصير رقمه <bdi dir="ltr">{phoneNew}</bdi>.</> : "يمحى رقمه."}</p>
        </ConfirmAction>
      )}
      {confirm === "email" && (
        <ConfirmAction tone="default" titleAr={x.email ? "تغيير بريد المؤثر" : "ربط حساب المؤثر"} confirmLabelAr={x.email ? "غير" : "اربط"} busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void run(() => apiPost<Connected>(`/api/admin/influencers/${x.id}/account`, { email: emailNew }), connectedAr, "تعذر ربط الحساب")}>
          {x.email ? (
            <>
              <p>ينتقل ملفه بكوده ومتابعيه وعمولاته إلى حساب <bdi dir="ltr">{emailNew}</bdi>. وحسابه القديم <bdi dir="ltr">{x.email}</bdi> لا يرى صفحة المؤثر بعد.</p>
              <p className="mt-2">ويصل البريد الجديد رسالة بكوده: دعوة لتفعيل حسابه إن كان جديدا، أو دخول بحسابه إن كان له حساب.</p>
            </>
          ) : (
            <p>ينشأ له حساب بهذا البريد، أو يربط بحسابه إن كان له حساب. وتصله رسالة بكوده وطريقة الدخول.</p>
          )}
        </ConfirmAction>
      )}
      {confirm === "discount" && (
        <ConfirmAction tone="default" titleAr="تغيير خصم متابعي المؤثر" confirmLabelAr="احفظ" busy={busy} onCancel={() => setConfirm(null)}
          onConfirm={() => void run(() => apiPatch(`/api/admin/influencers/${x.id}`, { percentOff: discountNum ?? null }), "حفظ الخصم", "تعذر حفظ الخصم")}>
          <p>{discountNum === null || discountNum === undefined ? "يأخذ متابعوه نسبة المنحة" : `يأخذ متابعوه ${discountNum}%`} على أكواد المنحة التي تعطى بكوده بعد الحفظ. وما أعطي قبله يبقى بخصمه.</p>
        </ConfirmAction>
      )}
      {confirm === "closes" && (
        <ConfirmAction tone="default" titleAr="آخر يوم لمتابعي المؤثر" confirmLabelAr="احفظ" busy={busy} onCancel={() => setConfirm(null)}
          onConfirm={() => void run(() => apiPatch(`/api/admin/influencers/${x.id}`, { closesAt: lastDay ? grantClosesAt(lastDay) : null }), "حفظ آخر يوم", "تعذر حفظ آخر يوم")}>
          <p>{lastDay
            ? `تبقى صفحته مفتوحة حتى آخر يوم ${fmtDate(new Date(`${lastDay}T00:00:00`))}: يأخذ متابعوه أكوادهم ويدفعون بها حتى نهايته، ولو انتهت المنحة لغيره.`
            : "تتبع صفحته نهاية المنحة كغيره."}</p>
          <p className="mt-2">ويبقى شرطا أن تكون المنحة مشغلة.</p>
        </ConfirmAction>
      )}
      {confirm === "code" && (
        <ConfirmAction tone="default" titleAr="تغيير كود المؤثر" confirmLabelAr="غير" busy={busy} onCancel={() => setConfirm(null)}
          onConfirm={() => void run(() => apiPatch(`/api/admin/influencers/${x.id}`, { code: codeNorm }), "تغير الكود", "تعذر تغيير الكود")}>
          <p>يصير كوده <bdi dir="ltr">{codeNorm}</bdi> ورابطه به. والرابط القديم بكود <bdi dir="ltr">{x.code}</bdi> يبقى يعمل.</p>
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
          onConfirm={() => void pay(false)}>
          <p>تسجل دفعة <bdi dir="ltr">{money(amountNum)}</bdi> لـ{x.nameAr}، فينقص رصيده إلى <bdi dir="ltr">{money(x.totals.balance - amountNum)}</bdi>. ويراها في حسابه.</p>
        </ConfirmAction>
      )}
    </Inset>
  );
}

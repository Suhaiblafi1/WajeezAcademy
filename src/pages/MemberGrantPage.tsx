/* صفحةُ «منحة أعضاء وجيز» — من النموذج إلى الدفع في صفحةٍ واحدة (٢٠ أكتوبر ٢٠٢٦).

   قراراتُ صاحب المنصّة:
   · «A»: من يعبّئ النموذج يأخذ الكودَ فورا ويختار مسارَه ويدفع بنفسه — «فبهذه الحركة قد نكون قد أتممنا
     عمليّة الشراء قبل أن نذهب ونعود بإرسال رسالةٍ له ثانية». والمستشارُ لمن يطلبه.
   · المساراتُ «نحن من أعددناها»، و«يحقّ لك فقط ٤ دورات»، ويحذف منها أو يبدّل بدوراتٍ لها شعب.
   · والمنحةُ نسبةٌ تُقال بالمال: «تدفع كذا فقط، ووجيز تتحمّل كذا».
   · والحسابُ يُنشأ حين يختار المسار — باسمه وبريده من النموذج.

   ثلاثُ خطوات: النموذج ← الكودُ والمسارات ← المسارُ المختار (`/grant/:pathwayId`) ثمّ لوحُ الدفع بالكود.
   وما أخذه من النموذج يُحفظ على جهازه (`services/grant-landing.ts`)، فمن خرج ليوثّق بريده عاد إلى
   مساره ولوحُه مفتوح (`ResumeCheckout`). والعلّةُ في `server/services/grant-landing.service.ts`. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, Copy, Gift, Loader2, X } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { useRealSession } from "@/services/session";
import { useHoneypot } from "@/components/HoneypotField";
import { toast, toastError } from "@/components/Toast";
import Modal from "@/components/Modal";
import AuthGate from "@/components/AuthGate";
import BuyPanel from "@/components/BuyPanel";
import ResumeCheckout from "@/components/ResumeCheckout";
import SeoHead from "@/components/SeoHead";
import { controlCls } from "@/components/FormKit";
import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { fmtDate, fmtMoney } from "@/application/text/format-ar";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { grantPrice, MEMBER_GRANT_NAME_AR } from "@/application/commerce/grant";
import { GRANT_CONSENT_AR, WORK_FIELDS, campaignParams, grantSavingAr } from "@/application/commerce/grant-landing";
import { readStoredGrant, saveStoredGrant, type StoredGrant } from "@/services/grant-landing";
import { resumedCheckoutFor, savePendingCheckout } from "@/services/pending-checkout";

interface GrantCourse { courseId: string; titleAr: string; cohortId: string; startsAt: string | null; seatsLeft?: number | null; price: number }
interface GrantPathway { id: string; titleAr: string; blurbAr: string | null; courses: GrantCourse[]; listTotal: number; grantTotal: number }
interface View {
  campaign: { open: boolean; percentOff: number; maxCourses: number; closesAt: string | null; left: number | null };
  pathways: GrantPathway[];
  openCourses: GrantCourse[];
}
interface ApplyResult extends View {
  ref: string;
  grant: { code: string | null; sentTo: string | null; percentOff: number } | null;
  reasonAr: string | null;
}

const USD = "USD";
const money = (n: number) => fmtMoney(n, USD);

export default function MemberGrantPage() {
  const { pathwayId } = useParams();
  const navigate = useNavigate();
  const { user: session } = useRealSession();
  const hp = useHoneypot();
  const [view, setView] = useState<View | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [stored, setStored] = useState<StoredGrant | null>(readStoredGrant);
  const [reasonAr, setReasonAr] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", workField: "" });
  const [busy, setBusy] = useState(false);
  const [advisorAsked, setAdvisorAsked] = useState(false);
  const [note, setNote] = useState("");

  /* المسارُ المختار ودوراتُه — يحذف منها ويبدّل بدوراتٍ لها شعبٌ مفتوحة */
  const [picked, setPicked] = useState<GrantCourse[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);

  const load = useCallback(async () => {
    try { setView(await apiGet<View>("/api/public/grant")); }
    catch (e) { setFailed(e instanceof ApiError ? e.message : "تعذر تحميل الصفحة"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const pathway = view?.pathways.find((p) => p.id === pathwayId) ?? null;
  const path = pathwayId ? `/grant/${pathwayId}` : "/grant";
  const [resumed] = useState(() => (pathwayId ? resumedCheckoutFor(`/grant/${pathwayId}`) : null));

  /* دوراتُ المسار حين يُفتح — أو ما تركه قبل أن يخرج ليوثّق بريده */
  useEffect(() => {
    if (!view || !pathway) return;
    if (resumed) {
      const all = [...pathway.courses, ...view.openCourses];
      setPicked(resumed.intent.courseIds.map((id) => all.find((c) => c.courseId === id)).filter((c): c is GrantCourse => !!c));
    } else setPicked(pathway.courses);
  }, [view, pathway, resumed]);

  const pct = view?.campaign.percentOff ?? 0;
  const max = view?.campaign.maxCourses ?? 4;
  const listTotal = useMemo(() => picked.reduce((s, c) => s + c.price, 0), [picked]);
  const payTotal = grantPrice(listTotal, pct);
  const swapOptions = (view?.openCourses ?? []).filter((c) => !picked.some((p) => p.courseId === c.courseId));

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const out = await apiPost<ApplyResult>("/api/public/grant", {
        ...form, ...campaignParams(window.location.search), website: hp.value,
      });
      const g = { ref: out.ref, code: out.grant?.code ?? null, sentTo: out.grant?.sentTo ?? null, name: form.fullName.trim(), email: form.email.trim() };
      saveStoredGrant(g);
      setStored({ ...g, at: Date.now() });
      setReasonAr(out.reasonAr);
      setView(out);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { toastError(err instanceof ApiError ? err.message : "تعذر الإرسال، أعد المحاولة"); }
    finally { setBusy(false); }
  };

  const askAdvisor = async () => {
    if (!stored) return;
    setBusy(true);
    try {
      await apiPost("/api/public/grant/advisor", { ref: stored.ref, noteAr: note.trim() || null, website: hp.value });
      setAdvisorAsked(true);
    } catch (err) { toastError(err instanceof ApiError ? err.message : "تعذر الإرسال"); }
    finally { setBusy(false); }
  };

  const pay = () => {
    if (!pathway || picked.length === 0) return;
    savePendingCheckout({
      path, intent: { title: pathway.titleAr, amount: payTotal, kind: "courses", courseIds: picked.map((c) => c.courseId) },
      cohortByCourse: Object.fromEntries(picked.map((c) => [c.courseId, c.cohortId])),
    });
    if (!session) { setAuthOpen(true); return; }
    setBuyOpen(true);
  };

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast("نسخ الكود"); } catch { /* المتصفّحُ منعه — الكودُ ظاهرٌ يُنسخ باليد */ }
  };

  if (failed) {
    return <Shell><Card as="p" className="text-read">{failed}</Card></Shell>;
  }
  if (!view) {
    return <Shell><div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div></Shell>;
  }

  const c = view.campaign;
  const lastDay = c.closesAt ? fmtDate(new Date(new Date(c.closesAt).getTime() - 1)) : null;

  /* ─── الخطوة ٣: المسارُ المختار ─── */
  if (pathwayId) {
    if (!pathway) {
      return (
        <Shell>
          <Card as="p" className="text-read">هذا المسار لم يعد متاحا.</Card>
          <Button className="mt-3" onClick={() => navigate("/grant")}>اختر مسارا آخر</Button>
        </Shell>
      );
    }
    return (
      <Shell>
        <Link to="/grant" className="inline-flex items-center gap-1 text-read text-muted-foreground"><ArrowRight className="h-4 w-4" /> كل المسارات</Link>
        <h1 className="mt-3 text-2xl font-black">{pathway.titleAr}</h1>
        {pathway.blurbAr && <p className="mt-1 text-read text-muted-foreground">{pathway.blurbAr}</p>}
        <Card className="mt-4">
          <ul className="space-y-2">
            {picked.map((x) => (
              <li key={x.courseId} className="flex flex-wrap items-center justify-between gap-2 text-read">
                <span className="font-bold">{x.titleAr}</span>
                <span className="flex items-center gap-3 text-muted-foreground">
                  تبدأ {cohortDayAr(x.startsAt)}
                  <button type="button" aria-label={`احذف ${x.titleAr}`} onClick={() => setPicked(picked.filter((p) => p.courseId !== x.courseId))} className="cursor-pointer"><X className="h-4 w-4" /></button>
                </span>
              </li>
            ))}
          </ul>
          {picked.length < max && swapOptions.length > 0 && (
            <select value="" onChange={(e) => { const add = swapOptions.find((o) => o.courseId === e.target.value); if (add) setPicked([...picked, add]); }} className={`${controlCls} mt-3`}>
              <option value="">أضف دورة لها شعبة مفتوحة</option>
              {swapOptions.map((o) => <option key={o.courseId} value={o.courseId}>{o.titleAr} — تبدأ {cohortDayAr(o.startsAt)}</option>)}
            </select>
          )}
          <p className="mt-2 text-read text-muted-foreground">يحق لك {max} دورات بحد أقصى. احذف دورة لتضيف غيرها.</p>
        </Card>
        {picked.length > 0 && (
          <Card className="mt-4 text-center">
            <p className="text-read text-muted-foreground">قيمة مسارك <span dir="ltr" className="line-through">{money(listTotal)}</span></p>
            <p className="mt-1 text-xl font-black">{grantSavingAr(money(payTotal), money(listTotal - payTotal))}</p>
            <Button className="mt-4 w-full" onClick={pay}>ادفع الآن</Button>
            {stored?.code
              ? <p className="mt-2 text-read text-muted-foreground">كودك {stored.code} يوضع تلقائيا.</p>
              : <p className="mt-2 text-read text-muted-foreground">اكتب كود منحتك في لوح الدفع. أرسلناه إلى بريدك.</p>}
          </Card>
        )}

        {authOpen && (
          <Modal onClose={() => setAuthOpen(false)} label="أنشئ حسابك لتدفع" panelClassName="w-full max-w-md">
            <AuthGate
              initialMode="signup" source="grant_checkout"
              message="أنشئ حسابك لتدفع. فيه تجد دوراتك ومواعيدها."
              prefill={{ name: stored?.name, email: stored?.email }}
              onDone={() => { setAuthOpen(false); setBuyOpen(true); }}
            />
          </Modal>
        )}
        <ResumeCheckout ready={resumed !== null && picked.length > 0} onResume={() => (session ? setBuyOpen(true) : setAuthOpen(true))} />
        {buyOpen && (
          <BuyPanel
            title={pathway.titleAr}
            email={session?.email ?? stored?.email ?? ""}
            kind="courses"
            initialCoupon={stored?.code ?? ""}
            lines={picked.map((x) => ({ courseId: x.courseId, name: x.titleAr, cohortId: x.cohortId }))}
            onClose={() => setBuyOpen(false)}
          />
        )}
      </Shell>
    );
  }

  /* ─── الخطوة ٢: الكودُ والمسارات ─── */
  if (stored) {
    return (
      <Shell>
        <Card tone="accent" className="text-center">
          <Gift className="mx-auto h-8 w-8 text-gold-ink" aria-hidden="true" />
          {stored.code ? (
            <>
              <p className="mt-2 text-read">كود منحتك</p>
              <p className="mt-1 flex items-center justify-center gap-2 text-2xl font-black" dir="ltr">
                {stored.code}
                <button type="button" aria-label="انسخ الكود" onClick={() => void copy(stored.code!)} className="cursor-pointer"><Copy className="h-5 w-5" /></button>
              </p>
              <p className="mt-1 text-read text-muted-foreground">أرسلناه إلى بريدك أيضا. يستعمل مرة واحدة، ويمكنك أن تهديه لغيرك.</p>
            </>
          ) : stored.sentTo ? (
            <p className="mt-2 text-read">لك كود منحة من قبل. أرسلناه إلى {stored.sentTo}.</p>
          ) : (
            <p className="mt-2 text-read">{reasonAr ?? (c.open ? "" : "المنحة مغلقة الآن")}</p>
          )}
        </Card>

        <h2 className="mt-6 text-xl font-black">اختر مسارا يناسبك</h2>
        <p className="mt-1 text-read text-muted-foreground">خصم {c.percentOff}% على مسار حتى {c.maxCourses} دورات.{lastDay ? ` آخر يوم ${lastDay}.` : ""}</p>
        {view.pathways.length === 0 ? (
          <Card as="p" className="mt-3 text-read text-muted-foreground">لا مسار متاح الآن. تواصل مع مستشار ليقترح عليك.</Card>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {view.pathways.map((p) => (
              <Card key={p.id} className="flex flex-col">
                <p className="text-lg font-black">{p.titleAr}</p>
                {p.blurbAr && <p className="text-read text-muted-foreground">{p.blurbAr}</p>}
                <ul className="mt-2 flex-1 space-y-1 text-read">
                  {p.courses.map((x) => <li key={x.courseId}>{x.titleAr} <span className="text-muted-foreground">· تبدأ {cohortDayAr(x.startsAt)}</span></li>)}
                </ul>
                <p className="mt-3 text-read text-muted-foreground">قيمة المسار <span dir="ltr" className="line-through">{money(p.listTotal)}</span></p>
                <p className="font-black">{grantSavingAr(money(p.grantTotal), money(p.listTotal - p.grantTotal))}</p>
                <Button className="mt-3" onClick={() => navigate(`/grant/${p.id}`)}>اختر هذا المسار</Button>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-6">
          <p className="font-bold">لست متأكدا؟ تواصل مع مستشار</p>
          {advisorAsked ? (
            <p className="mt-1 text-read text-muted-foreground">وصل طلبك. سيتواصل معك مستشار قريبا.</p>
          ) : (
            <>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="اكتب ما تريد أن تعرفه (اختياري)" className={`${controlCls} mt-2 h-auto py-2`} />
              {hp.field}
              <Button tone="secondary" className="mt-2" disabled={busy} onClick={() => void askAdvisor()}>اطلب مستشارا</Button>
            </>
          )}
        </Card>
      </Shell>
    );
  }

  /* ─── الخطوة ١: النموذج ─── */
  const ready = form.fullName.trim().length >= 2 && form.phone.trim().length >= 5 && /\S+@\S+\.\S+/.test(form.email) && form.workField !== "";
  return (
    <Shell>
      <div className="text-center">
        <Gift className="mx-auto h-10 w-10 text-gold-ink" aria-hidden="true" />
        <h1 className="mt-2 text-3xl font-black">{MEMBER_GRANT_NAME_AR}</h1>
        <p className="mt-2 text-read text-muted-foreground">
          {c.open
            ? `خصم ${c.percentOff}% على مسار من ${c.maxCourses} دورات. عدد المنح محدود${lastDay ? `، وآخر يوم ${lastDay}` : ""}.`
            : "المنحة مغلقة الآن. اترك بياناتك ونخبرك بما يناسبك."}
        </p>
      </div>
      <Card as="form" onSubmit={apply} className="mt-5 space-y-3">
        <label className="grid gap-1 text-read">الاسم
          <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} autoComplete="name" className={controlCls} />
        </label>
        <label className="grid gap-1 text-read">رقم واتساب
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" autoComplete="tel" dir="ltr" className={controlCls} />
        </label>
        <label className="grid gap-1 text-read">البريد
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" dir="ltr" className={controlCls} />
        </label>
        <label className="grid gap-1 text-read">مجال عملك
          <select value={form.workField} onChange={(e) => setForm({ ...form, workField: e.target.value })} className={controlCls}>
            <option value="">اختر</option>
            {WORK_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        {hp.field}
        <Button type="submit" className="w-full" disabled={busy || !ready}>{c.open ? "أعطني كود المنحة" : "أرسل"}</Button>
        <p className="text-read leading-6 text-muted-foreground">{GRANT_CONSENT_AR}</p>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <SeoHead title={MEMBER_GRANT_NAME_AR} description="منحة لأعضاء وجيز: مسار من دورات مختارة بخصم كبير، والعدد محدود." path="/grant" />
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-5">
          <Link to="/" className="text-sm font-bold text-foreground">أكاديمية وجيز</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>
    </div>
  );
}

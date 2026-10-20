/* صفحةُ «منحة أعضاء وجيز» — من النموذج إلى الدفع في صفحةٍ واحدة (٢٠ أكتوبر ٢٠٢٦).

   قراراتُ صاحب المنصّة:
   · «A»: من يعبّئ النموذج يأخذ الكودَ فورا ويختار دوراته ويدفع بنفسه — «فبهذه الحركة قد نكون قد أتممنا
     عمليّة الشراء قبل أن نذهب ونعود بإرسال رسالةٍ له ثانية». والمستشارُ لمن يطلبه.
   · **قائمةُ دوراتٍ واقتراحاتٌ فوقها، بلا كلمة «مسار»** — «بدلا من أن نشتّته بكلمة مسار ومساراتٍ جاهزة»:
     «اختر الدورات التي تريد أن تربطها بمنحتك»، دورةً واحدةً أو أكثر حتّى حدّ المنحة. والاقتراحاتُ ما أعدّه
     صاحبُ المنصّة: يضغط أحدَها فتُختار دوراتُه، ثمّ يضيف ويحذف كما يشاء.
   · ولا يُعرض إلّا ما له شعبةٌ مفتوحةٌ ومدرّبٌ منشور، ويُقرأ ساعةَ الطلب — فالجديدُ يظهر وحدَه
     (`grant-pathway.service.ts#buyable`).
   · والمنحةُ نسبةٌ تُقال بالمال: «تدفع كذا فقط، ووجيز تتحمّل كذا».
   · والنموذجُ بجملٍ تحثّ على التعبئة — قرارُه: «اجعل فيه جملةً تحفيزيّةً تضمن أنّه سيسجّل». وما يُقال فيها
     حقٌّ في المنصّة: عددُ المنح الباقي من الخادم، والشهادةُ والمدرّبون المعتمدون قائمون.
   · والحسابُ يُنشأ حين يدفع — باسمه وبريده من النموذج.

   خطوتان: النموذج ← الكودُ واختيارُ الدورات، ثمّ لوحُ الدفع والكودُ فيه. و`/grant/:id` يفتح الاختيارَ نفسَه
   باقتراحٍ مختارٍ سلفا. وما أخذه من النموذج يُحفظ على جهازه (`services/grant-landing.ts`)، فمن خرج ليوثّق
   بريده عاد إلى دوراته ولوحُه مفتوح (`ResumeCheckout`). والعلّةُ في `server/services/grant-landing.service.ts`. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Check, Copy, Gift, Loader2 } from "lucide-react";
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
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { fmtDate, fmtMoney } from "@/application/text/format-ar";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { grantPrice, MEMBER_GRANT_NAME_AR } from "@/application/commerce/grant";
import { GRANT_CONSENT_AR, GRANT_PERKS_AR, WORK_FIELDS, campaignParams, grantSavingAr, toggleCourse } from "@/application/commerce/grant-landing";
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
/** طريقُ العودة بعد توثيق البريد — اختيارُه محفوظٌ على الجهاز، والصفحةُ تعيده (`pending-checkout.ts`) */
const PICK_PATH = "/grant/build";
const BUY_TITLE_AR = "دورات منحتك";
const money = (n: number) => fmtMoney(n, USD);

export default function MemberGrantPage() {
  const { pathwayId } = useParams();
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

  /* الدوراتُ المختارة بترتيب اختيارها — من كلّ ما يُشترى اليوم */
  const [picked, setPicked] = useState<string[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);

  const load = useCallback(async () => {
    try { setView(await apiGet<View>("/api/public/grant")); }
    catch (e) { setFailed(e instanceof ApiError ? e.message : "تعذر تحميل الصفحة"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const [resumed] = useState(() => resumedCheckoutFor(PICK_PATH));

  /* الاختيارُ الأوّل مرّةً واحدة: ما تركه قبل أن يخرج ليوثّق بريده، أو اقتراحٌ جاء رابطُه به */
  useEffect(() => {
    if (!view || seeded) return;
    const open = new Set(view.openCourses.map((x) => x.courseId));
    const from = resumed?.intent.courseIds ?? view.pathways.find((x) => x.id === pathwayId)?.courses.map((x) => x.courseId) ?? [];
    setPicked(from.filter((id) => open.has(id)).slice(0, view.campaign.maxCourses));
    setSeeded(true);
  }, [view, seeded, resumed, pathwayId]);

  const pct = view?.campaign.percentOff ?? 0;
  const max = view?.campaign.maxCourses ?? 4;
  const chosen = useMemo(
    () => picked.map((id) => view?.openCourses.find((x) => x.courseId === id)).filter((x): x is GrantCourse => !!x),
    [picked, view],
  );
  const listTotal = chosen.reduce((sum, x) => sum + x.price, 0);
  const payTotal = grantPrice(listTotal, pct);
  const toggle = (id: string) => setPicked((p) => toggleCourse(p, id, max));

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
    if (chosen.length === 0) return;
    savePendingCheckout({
      path: PICK_PATH, intent: { title: BUY_TITLE_AR, amount: payTotal, kind: "courses", courseIds: chosen.map((x) => x.courseId) },
      cohortByCourse: Object.fromEntries(chosen.map((x) => [x.courseId, x.cohortId])),
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

  /* ─── الخطوة ٢: الكودُ واختيارُ الدورات ─── */
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

        <h2 className="mt-6 text-xl font-black">اختر دوراتك</h2>
        <p className="mt-1 text-read text-muted-foreground">
          اختر الدورات التي تريد أن تربطها بمنحتك: دورة واحدة أو أكثر، حتى {max} دورات. تدفع {100 - pct}% فقط من سعرها.{lastDay ? ` آخر يوم ${lastDay}.` : ""}
        </p>

        {view.pathways.length > 0 && (
          <>
            <p className="mt-5 font-bold">اقتراحات لك</p>
            <p className="text-read text-muted-foreground">اضغط اقتراحا لتختار دوراته، ثم أضف أو احذف كما تشاء.</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {view.pathways.map((p) => (
                <Card key={p.id} className="flex flex-col">
                  <p className="font-black">{p.titleAr}</p>
                  {p.blurbAr && <p className="text-read text-muted-foreground">{p.blurbAr}</p>}
                  <p className="mt-1 flex-1 text-read">{p.courses.map((x) => x.titleAr).join(" · ")}</p>
                  <Button size="sm" tone="secondary" className="mt-3" onClick={() => setPicked(p.courses.map((x) => x.courseId).slice(0, max))}>اختر هذه الدورات</Button>
                </Card>
              ))}
            </div>
          </>
        )}

        {view.openCourses.length === 0 ? (
          <Card as="p" className="mt-5 text-read text-muted-foreground">لا دورات متاحة الآن. تواصل مع مستشار ليقترح عليك.</Card>
        ) : (
          <>
            <p className="mt-6 font-bold">كل الدورات المتاحة ({view.openCourses.length})</p>
            <div className="mt-2 space-y-2">
              {view.openCourses.map((x) => {
                const on = picked.includes(x.courseId);
                const full = !on && picked.length >= max;
                return (
                  <Inset as="label" key={x.courseId} tone={on ? "accent" : "default"} interactive={!full} className={`flex cursor-pointer items-start gap-3 ${full ? "opacity-50" : ""}`}>
                    <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(x.courseId)} className="mt-1" />
                    <span className="flex-1">
                      <span className="block font-bold">{x.titleAr}</span>
                      <span className="block text-read text-muted-foreground">تبدأ {cohortDayAr(x.startsAt)}</span>
                    </span>
                    <span className="text-end text-read">
                      <span dir="ltr" className="block text-muted-foreground line-through">{money(x.price)}</span>
                      <span dir="ltr" className="block font-black">{money(grantPrice(x.price, pct))}</span>
                    </span>
                  </Inset>
                );
              })}
            </div>
            {picked.length >= max && <p className="mt-2 text-read text-muted-foreground">وصلت الحد: {max} دورات. احذف دورة لتضيف غيرها.</p>}
          </>
        )}

        {chosen.length > 0 && (
          <Card tone="solid" className="sticky bottom-3 mt-4 text-center shadow-lg">
            <p className="text-read text-muted-foreground">اخترت {chosen.length} {chosen.length === 1 ? "دورة" : "دورات"} · قيمتها <span dir="ltr" className="line-through">{money(listTotal)}</span></p>
            <p className="mt-1 text-lg font-black">{grantSavingAr(money(payTotal), money(listTotal - payTotal))}</p>
            <Button className="mt-3 w-full" onClick={pay}>ادفع الآن</Button>
            {stored.code
              ? <p className="mt-2 text-read text-muted-foreground">كودك {stored.code} يوضع تلقائيا.</p>
              : <p className="mt-2 text-read text-muted-foreground">اكتب كود منحتك في لوح الدفع. أرسلناه إلى بريدك.</p>}
          </Card>
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

        {authOpen && (
          <Modal onClose={() => setAuthOpen(false)} label="أنشئ حسابك لتدفع" panelClassName="w-full max-w-md">
            <AuthGate
              initialMode="signup" source="grant_checkout"
              message="أنشئ حسابك لتدفع. فيه تجد دوراتك ومواعيدها."
              prefill={{ name: stored.name, email: stored.email }}
              onDone={() => { setAuthOpen(false); setBuyOpen(true); }}
            />
          </Modal>
        )}
        <ResumeCheckout ready={resumed !== null && seeded && chosen.length > 0} onResume={() => (session ? setBuyOpen(true) : setAuthOpen(true))} />
        {buyOpen && (
          <BuyPanel
            title={BUY_TITLE_AR}
            email={session?.email ?? stored.email}
            kind="courses"
            initialCoupon={stored.code ?? ""}
            lines={chosen.map((x) => ({ courseId: x.courseId, name: x.titleAr, cohortId: x.cohortId }))}
            onClose={() => setBuyOpen(false)}
          />
        )}
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
        {c.open ? (
          <>
            <p className="mt-2 text-lg font-bold">خصم {c.percentOff}% على الدورات التي تختارها، حتى {c.maxCourses} دورات.</p>
            <p className="mt-1 text-read text-muted-foreground">
              المنح محدودة{c.left !== null ? `: بقي ${c.left} منحة` : ""}{lastDay ? `، وآخر يوم ${lastDay}` : ""}.
            </p>
          </>
        ) : (
          <p className="mt-2 text-read text-muted-foreground">المنحة مغلقة الآن. اترك بياناتك ونخبرك بما يناسبك.</p>
        )}
      </div>
      <ul className="mx-auto mt-4 max-w-md space-y-1 text-read">
        {GRANT_PERKS_AR.map((t) => <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />{t}</li>)}
      </ul>
      <Card as="form" onSubmit={apply} className="mt-5 space-y-3">
        <p className="text-center font-bold">دقيقة واحدة وتأخذ كود منحتك فورا</p>
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
        <Button type="submit" className="w-full" disabled={busy || !ready}>{c.open ? "احجز منحتي الآن" : "أرسل"}</Button>
        <p className="text-read leading-6 text-muted-foreground">{GRANT_CONSENT_AR}</p>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <SeoHead title={MEMBER_GRANT_NAME_AR} description="منحة لأعضاء وجيز: دورات تختارها بخصم كبير، والعدد محدود." path="/grant" />
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-5">
          <Link to="/" className="text-sm font-bold text-foreground">أكاديمية وجيز</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>
    </div>
  );
}

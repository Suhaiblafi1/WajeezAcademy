/* صفحةُ «منحة أعضاء وجيز» — من النموذج إلى الدفع في صفحةٍ واحدة (٢٠ أكتوبر ٢٠٢٦).

   قراراتُ صاحب المنصّة:
   · «A»: من يعبّئ النموذج يأخذ الكودَ فورا ويختار دوراته ويدفع بنفسه — «فبهذه الحركة قد نكون قد أتممنا
     عمليّة الشراء قبل أن نذهب ونعود بإرسال رسالةٍ له ثانية». والمستشارُ لمن يطلبه.
   · **دوراتٌ فقط، بسعرها قبل المنحة وبعدها** — «بدلا من أن نشتّته بكلمة مسار ومساراتٍ جاهزة»: «اختر الدورات
     التي تريد أن تربطها بمنحتك»، من دورةٍ واحدةٍ إلى حدّ المنحة. وكانت فوقها «اقتراحاتٌ» يُعدّها صاحبُ المنصّة،
     فقال: «ألم نتّفق أن يظهر له دوراتٌ فقط، وتخبره كم السعرُ قبل المنحة وبعدها، ويختار ما شاء منها» — فحُذفت.
   · ولا يُعرض إلّا ما له شعبةٌ مفتوحةٌ في الفصل القادم القريب ومدرّبٌ منشور، ويُقرأ ساعةَ الطلب — فالجديدُ
     يظهر وحدَه (`grant-courses.service.ts#pool`).
   · **وأنّها مباشرةٌ على Zoom** — قرارُه: «يجب أن يقال له إنّها دوراتٌ مباشرةٌ عبر زوم، وكلُّ ما يجب أن يسمعه
     ليتحمّس بالتسجيل». فيُقال في أوّل الصفحة، وأوّلَ ما يحصل عليه، وفوق القائمة، وفي كلّ دورة.
   · والمنحةُ نسبةٌ تُقال بالمال: «تدفع كذا فقط، ووجيز تتحمّل كذا».
   · والنموذجُ بجملٍ تحثّ على التعبئة — قرارُه: «اجعل فيه جملةً تحفيزيّةً تضمن أنّه سيسجّل». وما يُقال فيها
     حقٌّ في المنصّة: عددُ المنح الباقي من الخادم، والشهادةُ والمدرّبون المعتمدون قائمون.
   · **ونبذةٌ قبله وأسئلةٌ أحترف** — قرارُه: «غير احترافيّة.. يجب أن نعطيه نبذةً عن الأكاديمية وقوّتها وماذا
     سيحصل». فالصفحةُ قبل النموذج: ما المنحة، ومن نحن (نصُّ «من نحن» نفسُه)، وما يحصل عليه مع كلّ دورة، وكيف
     تعمل المنحة؛ وعددُ الدورات المفتوحة ومجالاتها من الخادم لا رقمٌ يُكتب. والنموذجُ ستُّ خانات: أربعٌ لازمةٌ
     بصياغةٍ وأمثلة، وسؤالان اختياريّان — مستواه، وما يريد تطويرَه من مجالات الدورات المفتوحة — وبالثاني
     تُرتَّب له الدورات (`rankByInterest`).
   · والحسابُ يُنشأ حين يدفع — باسمه وبريده من النموذج.

   خطوتان: النموذج ← الكودُ واختيارُ الدورات، ثمّ لوحُ الدفع والكودُ فيه. وما أخذه من النموذج يُحفظ على جهازه
   (`services/grant-landing.ts`)، فمن خرج ليوثّق بريده عاد إلى `/grant/build` ودوراتُه مختارةٌ ولوحُه مفتوح
   (`ResumeCheckout`). والعلّةُ في `server/services/grant-landing.service.ts`. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Award, BookOpen, CirclePlay, ClipboardCheck, Copy, Gift, Headphones, Loader2, Video, type LucideIcon } from "lucide-react";
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
import Chip from "@/components/ui/Chip";
import { FAMILY_INTRO } from "@/data/about";
import { countAr, type CountForms } from "@/application/text/count-ar";
import { fmtDate, fmtMoney } from "@/application/text/format-ar";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { grantPrice, MEMBER_GRANT_NAME_AR } from "@/application/commerce/grant";
import {
  CAREER_LEVELS, GRANT_CONSENT_AR, GRANT_GAINS_AR, GRANT_MAX_INTERESTS, WORK_FIELDS,
  campaignParams, grantSavingAr, grantStepsAr, rankByInterest, toggleCourse,
} from "@/application/commerce/grant-landing";
import { readStoredGrant, saveStoredGrant, type StoredGrant } from "@/services/grant-landing";
import { resumedCheckoutFor, savePendingCheckout } from "@/services/pending-checkout";

interface GrantCourse { courseId: string; titleAr: string; cohortId: string; startsAt: string | null; seatsLeft?: number | null; price: number; domainAr?: string }
interface View {
  campaign: { open: boolean; percentOff: number; maxCourses: number; closesAt: string | null; left: number | null };
  /** فصلُ الدورات المعروضة — الفصلُ القادمُ القريب (`grant-courses.service.ts#pool`) */
  termAr: string | null;
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
/** مجالُ دورةٍ لم تُسمَّ عائلتُها — لا يُعرض فيما يريد تطويرَه */
const OTHER_DOMAIN = "أخرى";
/** العددُ بصيغته — والمثنّى بلا رقم: «مجالين» لا «2 مجالين» */
const dualOr = (n: number, forms: CountForms) => (n === 2 ? forms.two : countAr(n, forms));
const GAIN_ICON: Record<(typeof GRANT_GAINS_AR)[number]["id"], LucideIcon> = {
  live: Video, recording: CirclePlay, sources: BookOpen, experts: ClipboardCheck, certificate: Award, advisor: Headphones,
};

export default function MemberGrantPage() {
  const { user: session } = useRealSession();
  const hp = useHoneypot();
  const [view, setView] = useState<View | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [stored, setStored] = useState<StoredGrant | null>(readStoredGrant);
  const [reasonAr, setReasonAr] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", workField: "", careerLevel: "" });
  const [interests, setInterests] = useState<string[]>([]);
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

  /* الاختيارُ الأوّل مرّةً واحدة: ما تركه قبل أن يخرج ليوثّق بريده */
  useEffect(() => {
    if (!view || seeded) return;
    const open = new Set(view.openCourses.map((x) => x.courseId));
    setPicked((resumed?.intent.courseIds ?? []).filter((id) => open.has(id)).slice(0, view.campaign.maxCourses));
    setSeeded(true);
  }, [view, seeded, resumed]);

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
        ...form, careerLevel: form.careerLevel || null, interests, ...campaignParams(window.location.search), website: hp.value,
      });
      const g = {
        ref: out.ref, code: out.grant?.code ?? null, sentTo: out.grant?.sentTo ?? null,
        name: form.fullName.trim(), email: form.email.trim(), interests,
      };
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
    /* ما قال إنّه يريد تطويرَه أوّلا */
    const mine = new Set(stored.interests);
    const fits = (x: GrantCourse) => (x.domainAr && mine.has(x.domainAr) ? 1 : 0);
    const courses = rankByInterest(view.openCourses, fits);
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
          اختر الدورات التي تريد أن تربطها بمنحتك: من دورة واحدة إلى {max} دورات. ترى سعر كل دورة قبل المنحة وبعدها.{lastDay ? ` آخر يوم ${lastDay}.` : ""}
        </p>
        <Inset tone="accent" className="mt-3 flex items-start gap-3">
          <Video className="mt-0.5 h-5 w-5 shrink-0 text-teal-light-ink" aria-hidden="true" />
          <span className="text-read">
            <span className="block font-bold">كل الدورات مباشرة على Zoom</span>
            <span className="block text-muted-foreground">تلتقي مدربك وزملاءك مباشرة من أي مكان، وتسجيل كل لقاء يصلك بعده.</span>
          </span>
        </Inset>

        {view.openCourses.length === 0 ? (
          <Card as="p" className="mt-5 text-read text-muted-foreground">لا دورات متاحة الآن. تواصل مع مستشار ليقترح عليك.</Card>
        ) : (
          <>
            <p className="mt-6 font-bold">
              كل الدورات المتاحة ({view.openCourses.length})
              {view.termAr && <span className="font-normal text-muted-foreground"> · {view.termAr}</span>}
            </p>
            <div className="mt-2 space-y-2">
              {courses.map((x) => {
                const on = picked.includes(x.courseId);
                const full = !on && picked.length >= max;
                return (
                  <Inset
                    as="label" key={x.courseId} tone={on ? "accent" : "default"} interactive={!full}
                    className={`grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)_auto] ${full ? "opacity-50" : ""}`}
                  >
                    <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(x.courseId)} className="mt-1" />
                    <span>
                      <span className="block font-bold">{x.titleAr}</span>
                      <span className="block text-read text-muted-foreground">{x.domainAr ? `${x.domainAr} · ` : ""}تبدأ {cohortDayAr(x.startsAt)} · مباشرة على Zoom</span>
                      {fits(x) > 0 && <Chip tone="accent" className="mt-1">يناسب ما تريد تطويره</Chip>}
                    </span>
                    {/* السعرُ تحت العنوان على الهاتف، وبجانبه على الحاسوب — فلا يضيق العنوانُ حتّى يتكسّر */}
                    <span className="col-start-2 flex flex-wrap gap-x-4 text-read sm:col-start-3 sm:block sm:text-end">
                      <span className="block text-muted-foreground">قبل المنحة <span dir="ltr" className="line-through">{money(x.price)}</span></span>
                      <span className="block font-black">بعد المنحة <span dir="ltr">{money(grantPrice(x.price, pct))}</span></span>
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
            <Button tone="confirm" className="mt-3 w-full" onClick={pay}>ادفع الآن</Button>
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

  /* ─── الخطوة ١: نبذةٌ ثمّ النموذج ─── */
  const ready = form.fullName.trim().length >= 2 && form.phone.trim().length >= 5 && /\S+@\S+\.\S+/.test(form.email) && form.workField !== "";
  const domains = [...new Set(view.openCourses.map((x) => x.domainAr).filter((d): d is string => !!d && d !== OTHER_DOMAIN))]
    .sort((a, b) => a.localeCompare(b, "ar"));
  const pickInterest = (d: string) => setInterests((p) => toggleCourse(p, d, GRANT_MAX_INTERESTS));
  return (
    <Shell wide>
      <Card tone="accent" className="text-center">
        <Gift className="mx-auto h-10 w-10 text-gold-ink" aria-hidden="true" />
        <h1 className="mt-2 text-3xl font-black">{MEMBER_GRANT_NAME_AR}</h1>
        {c.open ? (
          <>
            <p className="mt-3 text-xl font-black">لأنك من أعضاء وجيز، تتحمل وجيز {c.percentOff}% من سعر دوراتك.</p>
            <p className="mt-1 text-read text-muted-foreground">دورات مباشرة على Zoom مع مدربين معتمدين. تختار من دورة إلى {c.maxCourses} دورات، وتدفع {100 - c.percentOff}% فقط.</p>
            <p className="mt-3">
              <Chip tone="warn">المنح محدودة{c.left !== null ? `: بقي ${c.left} منحة` : ""}{lastDay ? `، وآخر يوم ${lastDay}` : ""}</Chip>
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 text-xl font-black">المنحة غير مفتوحة الآن.</p>
            <p className="mt-1 text-read text-muted-foreground">سجل بياناتك، ونبلغك أول ما تفتح.</p>
          </>
        )}
        <a href="#grant-form" className="mt-3 inline-block font-bold text-teal-light-ink underline md:hidden">{c.open ? "احجز منحتك" : "سجل بياناتك"}</a>
      </Card>

      <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:items-start">
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-black">عن أكاديمية وجيز</h2>
            <p className="mt-2 text-read leading-8">{FAMILY_INTRO.body}</p>
            {view.openCourses.length > 0 && (
              <p className="mt-2 text-read font-bold">
                {dualOr(view.openCourses.length, { one: "دورة مفتوحة", two: "دورتان مفتوحتان", few: "دورات مفتوحة", many: "دورة مفتوحة" })} للتسجيل
                {view.termAr ? ` في ${view.termAr}` : " الآن"}
                {domains.length > 1 ? `، من ${dualOr(domains.length, { one: "مجال", two: "مجالين", few: "مجالات", many: "مجالا" })}` : ""}.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-xl font-black">ماذا تحصل عليه مع كل دورة</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {GRANT_GAINS_AR.map((g) => {
                const Icon = GAIN_ICON[g.id];
                return (
                  <Inset as="li" key={g.id} className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-teal-light-ink" aria-hidden="true" />
                    <span>
                      <span className="block font-bold">{g.title}</span>
                      <span className="block text-read text-muted-foreground">{g.body}</span>
                    </span>
                  </Inset>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black">كيف تعمل المنحة</h2>
            <ol className="mt-3 space-y-3">
              {grantStepsAr(c.percentOff, c.maxCourses).map((st, i) => (
                <li key={st.title} className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal font-black text-on-teal">{i + 1}</span>
                  <span>
                    <span className="block font-bold">{st.title}</span>
                    <span className="block text-read text-muted-foreground">{st.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <Card as="form" id="grant-form" tone="solid" onSubmit={apply} className="space-y-4 md:sticky md:top-6">
          <div>
            <h2 className="text-xl font-black">{c.open ? "احجز منحتك" : "سجل بياناتك"}</h2>
            <p className="text-read text-muted-foreground">{c.open ? "دقيقة واحدة، وتأخذ كود منحتك فورا." : "ونبلغك أول ما تفتح المنحة."}</p>
          </div>
          <label className="grid gap-1 text-read"><span className="font-bold">الاسم الكامل</span>
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} autoComplete="name" placeholder="مثال: سارة أحمد" className={controlCls} />
            <span className="text-muted-foreground">كما تريده أن يظهر على شهادتك</span>
          </label>
          <label className="grid gap-1 text-read"><span className="font-bold">رقم الواتساب</span>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" autoComplete="tel" dir="ltr" placeholder="+962 7X XXX XXXX" className={controlCls} />
            <span className="text-muted-foreground">مع رمز الدولة، لنتواصل معك بخصوص منحتك</span>
          </label>
          <label className="grid gap-1 text-read"><span className="font-bold">البريد الإلكتروني</span>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" dir="ltr" placeholder="name@example.com" className={controlCls} />
            <span className="text-muted-foreground">{c.open ? "يصلك عليه كود المنحة" : "نبلغك عليه حين تفتح المنحة"}</span>
          </label>
          <label className="grid gap-1 text-read"><span className="font-bold">مجال عملك</span>
            <select value={form.workField} onChange={(e) => setForm({ ...form, workField: e.target.value })} className={controlCls}>
              <option value="">اختر مجالك</option>
              {WORK_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>

          <div className="border-t border-border pt-4">
            <p className="font-bold">سؤالان اختياريان</p>
            <p className="text-read text-muted-foreground">يساعداننا نرتب لك الدورات الأنسب.</p>
          </div>
          <label className="grid gap-1 text-read"><span className="font-bold">مستواك الوظيفي <span className="font-normal text-muted-foreground">(اختياري)</span></span>
            <select value={form.careerLevel} onChange={(e) => setForm({ ...form, careerLevel: e.target.value })} className={controlCls}>
              <option value="">اختر مستواك</option>
              {CAREER_LEVELS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          {domains.length > 0 && (
            <fieldset className="text-read">
              <legend className="font-bold">ما الذي تريد تطويره؟ <span className="font-normal text-muted-foreground">(اختياري)</span></legend>
              <span className="block text-muted-foreground">اختر حتى {GRANT_MAX_INTERESTS} مجالات.</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {domains.map((d) => {
                  const on = interests.includes(d);
                  const full = !on && interests.length >= GRANT_MAX_INTERESTS;
                  return (
                    <Inset as="label" key={d} tone={on ? "accent" : "default"} interactive={!full} className={`inline-flex items-center gap-2 px-3 py-2 ${full ? "opacity-50" : ""}`}>
                      <input type="checkbox" checked={on} disabled={full} onChange={() => pickInterest(d)} />
                      {d}
                    </Inset>
                  );
                })}
              </div>
            </fieldset>
          )}

          {hp.field}
          <Button type="submit" tone="primary" className="w-full" disabled={busy || !ready}>{c.open ? "احجز منحتي الآن" : "سجلني"}</Button>
          <p className="text-read leading-6 text-muted-foreground">{GRANT_CONSENT_AR}</p>
        </Card>
      </div>
    </Shell>
  );
}

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <SeoHead title={MEMBER_GRANT_NAME_AR} description="منحة لأعضاء وجيز: دورات تختارها بخصم كبير، والعدد محدود." path="/grant" />
      <header className="border-b border-white/10">
        <div className={`mx-auto flex h-14 items-center px-5 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
          <Link to="/" className="text-sm font-bold text-foreground">أكاديمية وجيز</Link>
        </div>
      </header>
      <main className={`mx-auto px-5 py-8 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>{children}</main>
    </div>
  );
}

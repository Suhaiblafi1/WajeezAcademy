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
     ليتحمّس بالتسجيل». فيُقال في أوّل الصفحة، وفيما يحصل عليه، وفوق القائمة، وفي كلّ دورة.
   · والمنحةُ نسبةٌ تُقال بالمال: «تدفع كذا فقط، ووجيز تتحمّل كذا».
   · والنموذجُ بجملٍ تحثّ على التعبئة — قرارُه: «اجعل فيه جملةً تحفيزيّةً تضمن أنّه سيسجّل». وما يُقال فيها
     حقٌّ في المنصّة.
   · **وقليلٌ هادئ** — كانت قبله نبذةٌ طويلة (من نحن، وستُّ بطاقات، وثلاثُ خطوات) بطلبه: «نعطيه نبذةً عن
     الأكاديمية وقوّتها وماذا سيحصل». فرآها فقال (٢١ أكتوبر ٢٠٢٦): «مكتظّةٌ كثيرا.. قد تنفّر الشخصَ من التعبئة..
     اجعلها أنعمَ وأقلَّ محتوى وأبسط». فصارت: سطرا المنحة، وثلاثةُ ما يحصل عليه بكلمتين، والنموذج، وسطرٌ عن
     الأكاديمية تحته. والنموذجُ أربعُ خاناتٍ لازمةٍ بلا شرحٍ تحت كلٍّ (المثالُ في الخانة نفسِها)، والسؤالان
     الاختياريّان — مستواه، وما يريد تطويرَه — **مطويّان** يفتحهما من شاء، وبالثاني تُرتَّب له الدورات.
   · **ولا عددَ للمنح** — قرارُه: «لا تذكر عدد المنح لأنّ العددَ الكبير قد يقلّل من قيمتها». فيُقال «المنح
     محدودة» وآخرُ يوم، والعددُ لا يخرج من الخادم للزائر (`grant-landing.service.ts#view`).
   · والحسابُ يُنشأ حين يدفع — باسمه وبريده من النموذج.

   خطوتان: النموذج ← الكودُ واختيارُ الدورات، ثمّ لوحُ الدفع والكودُ فيه. وما أخذه من النموذج يُحفظ على جهازه
   (`services/grant-landing.ts`)، فمن خرج ليوثّق بريده عاد إلى `/grant/build` ودوراتُه مختارةٌ ولوحُه مفتوح
   (`ResumeCheckout`). والعلّةُ في `server/services/grant-landing.service.ts`. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Award, CirclePlay, Copy, Gift, Loader2, Share2, UserRound, Video, type LucideIcon } from "lucide-react";
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
import { fmtDate, fmtMoney } from "@/application/text/format-ar";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { grantPrice, MEMBER_GRANT_NAME_AR } from "@/application/commerce/grant";
import {
  CAREER_LEVELS, GRANT_ACADEMY_LINE_AR, GRANT_CONSENT_AR, GRANT_GAINS_AR, GRANT_MAX_INTERESTS, GRANT_SUGGESTED_COURSES, WORK_FIELDS,
  campaignParams, grantSavingAr, grantShareAr, rankByInterest, seatsLeftAr, suggestCourses, suggestPaths, toggleCourse, type GrantPathOption,
} from "@/application/commerce/grant-landing";
import { readStoredGrant, saveStoredGrant, type StoredGrant } from "@/services/grant-landing";
import publicPathsData from "@/data/catalog/public-pathways.json";
import { waShare } from "@/application/site/whatsapp";
import { resumedCheckoutFor, savePendingCheckout } from "@/services/pending-checkout";

interface GrantCourse {
  courseId: string; titleAr: string; cohortId: string; startsAt: string | null; seatsLeft?: number | null; price: number; domainAr?: string;
  /** مدرّبُها المنشور — ببوّابة النشر في الخادم (`grant-courses.service.ts`) */
  trainer?: { id: string; name: string; photoUrl: string | null } | null;
}
interface View {
  campaign: { open: boolean; percentOff: number; maxCourses: number; closesAt: string | null };
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
/** «دورة» و«دورتين» بلا رقم، و«4 دورات» */
const coursesAr = (n: number) => (n === 1 ? "دورة" : n === 2 ? "دورتين" : `${n} دورات`);
/* المساراتُ العامّةُ بترتيب مختارات صاحب المنصّة — ومنها الرئيسيُّ والبديل (`suggestPaths`) */
const PICK_RANK = new Map(publicPathsData.picks.map((x, i) => [x.id, i]));
const GRANT_PATHS: GrantPathOption[] = [...publicPathsData.pathways]
  .sort((a, b) => (PICK_RANK.get(a.id) ?? Infinity) - (PICK_RANK.get(b.id) ?? Infinity))
  .map((x) => ({ id: x.id, title: x.title, courseIds: x.course_ids }));
/** مجالُ دورةٍ لم تُسمَّ عائلتُها — لا يُعرض فيما يريد تطويرَه */
const OTHER_DOMAIN = "أخرى";
const GAIN_ICON: Record<(typeof GRANT_GAINS_AR)[number]["id"], LucideIcon> = { live: Video, recording: CirclePlay, certificate: Award };

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
  /* ما اخترناه له سلفا — يبقى أعلى القائمة بشارته وإن حذفه، فلا تقفز الصفوفُ تحت يده */
  const [suggested, setSuggested] = useState<string[]>([]);
  /* المسارُ الذي اخترنا دوراتِه له، والبديلُ الذي يبدّل إليه بضغطة */
  const [path, setPath] = useState<{ main: GrantPathOption | null; alt: GrantPathOption | null }>({ main: null, alt: null });
  const [seeded, setSeeded] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);

  const load = useCallback(async () => {
    try { setView(await apiGet<View>("/api/public/grant")); }
    catch (e) { setFailed(e instanceof ApiError ? e.message : "تعذر تحميل الصفحة"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const [resumed] = useState(() => resumedCheckoutFor(PICK_PATH));

  /* الاختيارُ الأوّل مرّةً واحدةً حين يصير له كود: ما تركه قبل أن يخرج ليوثّق بريده، وإلّا دوراتُ المسار الرئيسيّ
     الذي يناسب مجالَه واهتمامَه (`suggestPaths`)، أو أربعُ دوراتٍ تناسبهما إن لم يناسبه مسار (`suggestCourses`) —
     يحذف منها ويضيف كما يشاء حتّى حدّ المنحة */
  useEffect(() => {
    if (!view || !stored || seeded) return;
    const max = view.campaign.maxCourses;
    const found = suggestPaths(GRANT_PATHS, view.openCourses, stored.interests, stored.workField);
    const ours = found.main
      ? found.main.courseIds.slice(0, max)
      : suggestCourses(view.openCourses, stored.interests, stored.workField, Math.min(GRANT_SUGGESTED_COURSES, max));
    const open = new Set(view.openCourses.map((x) => x.courseId));
    setPath(found);
    setSuggested(ours);
    setPicked(resumed ? resumed.intent.courseIds.filter((id) => open.has(id)).slice(0, max) : ours);
    setSeeded(true);
  }, [view, stored, seeded, resumed]);

  const pct = view?.campaign.percentOff ?? 0;
  const max = view?.campaign.maxCourses ?? 4;
  const chosen = useMemo(
    () => picked.map((id) => view?.openCourses.find((x) => x.courseId === id)).filter((x): x is GrantCourse => !!x),
    [picked, view],
  );
  const listTotal = chosen.reduce((sum, x) => sum + x.price, 0);
  const payTotal = grantPrice(listTotal, pct);
  const toggle = (id: string) => setPicked((p) => toggleCourse(p, id, max));
  /* يبدّل إلى البديل: تُختار دوراتُه، ويصير الرئيسيُّ بديلا يعود إليه */
  const switchPath = () => {
    if (!path.alt) return;
    const ids = path.alt.courseIds.slice(0, max);
    setPath({ main: path.alt, alt: path.main });
    setSuggested(ids);
    setPicked(ids);
  };

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const out = await apiPost<ApplyResult>("/api/public/grant", {
        ...form, careerLevel: form.careerLevel || null, interests, ...campaignParams(window.location.search), website: hp.value,
      });
      const g = {
        ref: out.ref, code: out.grant?.code ?? null, sentTo: out.grant?.sentTo ?? null,
        name: form.fullName.trim(), email: form.email.trim(), interests, workField: form.workField,
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
    /* ما اخترناه له أوّلا، ثمّ ما قال إنّه يريد تطويرَه */
    const mine = new Set(stored.interests);
    const ours = new Set(suggested);
    const fits = (x: GrantCourse) => (x.domainAr && mine.has(x.domainAr) ? 1 : 0);
    /* والمختارةُ بترتيب اختيارنا — أنسبُها أوّلا — فوق كلّ ما سواها */
    const courses = rankByInterest(view.openCourses, (x) => (ours.has(x.courseId) ? 2 + suggested.length - suggested.indexOf(x.courseId) : fits(x)));
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
              <p className="mt-1 text-read text-muted-foreground">أرسلناه إلى بريدك أيضا. يستعمل مرة واحدة، ويمكنك أن تهديه لغيرك.{lastDay ? ` آخر يوم ${lastDay}.` : ""}</p>
            </>
          ) : stored.sentTo ? (
            <p className="mt-2 text-read">لك كود منحة من قبل. أرسلناه إلى {stored.sentTo}.</p>
          ) : (
            <p className="mt-2 text-read">{reasonAr ?? (c.open ? "" : "المنحة مغلقة الآن")}</p>
          )}
          {/* «أهد منحة لصديق» — رسالةٌ جاهزة برابط المنحة ووسم قناتها، فالصديقُ يأخذ منحتَه لا كودَك */}
          {c.open && (
            <a
              href={waShare(grantShareAr(window.location.origin, pct, lastDay))} target="_blank" rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 font-bold text-teal-light-ink underline"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" /> أهد منحة لصديق
            </a>
          )}
        </Card>

        <h2 className="mt-6 text-xl font-black">اختر دوراتك</h2>
        {/* بقولٍ واحدٍ سهل — قرارُ صاحب المنصّة (٢١ أكتوبر ٢٠٢٦): «بيّن الأمرَ بشكلٍ سلسٍ وجميلٍ وبسيط.. فقط اختر
            الدورات من ١-٥ التي تريد أن تندرج ضمن المنحة.. يمكنك استبدالها لاحقا بدوراتٍ أخرى باستشارة مستشارك الخاص» */}
        <p className="mt-1 text-read text-muted-foreground">
          اختر من دورة إلى {max} دورات تريدها ضمن منحتك. ويمكنك استبدالها لاحقا بدورات أخرى بعد استشارة مستشارك الخاص.
        </p>
        {suggested.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-read">
            <span>{path.main ? `حددنا لك دورات مسار «${path.main.title}».` : `حددنا لك ${coursesAr(suggested.length)} تناسبك.`}</span>
            {path.alt && (
              <>
                <span className="text-muted-foreground">أو مسار «{path.alt.title}»</span>
                <Button size="sm" tone="secondary" onClick={switchPath}>بدّل إليه</Button>
              </>
            )}
          </p>
        )}
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
                      {/* المدرّبُ ببوّابة النشر، وتفاصيلُ الدورة — في نافذةٍ جديدة فلا يضيع ما اختاره */}
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-read">
                        {x.trainer && (
                          <a href={`/trainers#trainer-${encodeURIComponent(x.trainer.id)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-bold text-teal-light-ink">
                            {x.trainer.photoUrl
                              ? <img src={x.trainer.photoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                              : <UserRound className="h-5 w-5" aria-hidden="true" />}
                            مع {x.trainer.name}
                          </a>
                        )}
                        <a href={`/build/${encodeURIComponent(x.courseId)}`} target="_blank" rel="noreferrer" className="text-muted-foreground underline">تفاصيل الدورة</a>
                      </span>
                      {seatsLeftAr(x.seatsLeft) && <Chip tone="warn" className="mt-1 me-1">{seatsLeftAr(x.seatsLeft)}</Chip>}
                      {ours.has(x.courseId)
                        ? <Chip tone="accent" className="mt-1">اخترناها لك</Chip>
                        : fits(x) > 0 && <Chip tone="accent" className="mt-1">يناسب ما تريد تطويره</Chip>}
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

  /* ─── الخطوة ١: النموذج — قليلٌ هادئ ─── */
  const ready = form.fullName.trim().length >= 2 && form.phone.trim().length >= 5 && /\S+@\S+\.\S+/.test(form.email) && form.workField !== "";
  const domains = [...new Set(view.openCourses.map((x) => x.domainAr).filter((d): d is string => !!d && d !== OTHER_DOMAIN))]
    .sort((a, b) => a.localeCompare(b, "ar"));
  const pickInterest = (d: string) => setInterests((p) => toggleCourse(p, d, GRANT_MAX_INTERESTS));
  return (
    <Shell>
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <Gift className="mx-auto h-10 w-10 text-gold-ink" aria-hidden="true" />
          <h1 className="mt-2 text-3xl font-black">{MEMBER_GRANT_NAME_AR}</h1>
          {c.open ? (
            <>
              <p className="mt-3 text-lg font-bold">لأنك من أعضاء وجيز، تدفع {100 - c.percentOff}% فقط من سعر دوراتك.</p>
              <p className="mt-1 text-read text-muted-foreground">دورات مباشرة على Zoom، تختار منها حتى {c.maxCourses}.</p>
              <p className="mt-3"><Chip tone="warn">المنح محدودة{lastDay ? `، وآخر يوم ${lastDay}` : ""}</Chip></p>
            </>
          ) : (
            <p className="mt-3 text-lg font-bold">المنحة غير مفتوحة الآن. سجل بياناتك ونبلغك أول ما تفتح.</p>
          )}
        </div>

        <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-read">
          {GRANT_GAINS_AR.map((g) => {
            const Icon = GAIN_ICON[g.id];
            return <li key={g.id} className="flex items-center gap-1.5"><Icon className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />{g.title}</li>;
          })}
        </ul>

        <Card as="form" onSubmit={apply} className="mt-6 space-y-3">
          <p className="text-center text-read text-muted-foreground">{c.open ? "دقيقة واحدة، وتأخذ كود منحتك فورا." : "نبلغك على بريدك أول ما تفتح."}</p>
          <label className="grid gap-1 text-read">الاسم الكامل
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} autoComplete="name" placeholder="كما تريده على شهادتك" className={controlCls} />
          </label>
          <label className="grid gap-1 text-read">رقم الواتساب
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" autoComplete="tel" dir="ltr" placeholder="+962 7X XXX XXXX" className={controlCls} />
          </label>
          <label className="grid gap-1 text-read">البريد الإلكتروني
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" dir="ltr" placeholder="name@example.com" className={controlCls} />
          </label>
          <label className="grid gap-1 text-read">مجال عملك
            <select value={form.workField} onChange={(e) => setForm({ ...form, workField: e.target.value })} className={controlCls}>
              <option value="">اختر مجالك</option>
              {WORK_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>

          {/* السؤالان الاختياريّان مطويّان — لا يزحمان من يريد أن يبدأ، ويفتحهما من شاء */}
          <details className="text-read">
            <summary className="cursor-pointer text-muted-foreground">سؤالان اختياريان لنرتب لك الدورات</summary>
            <div className="mt-3 space-y-3">
              <label className="grid gap-1">مستواك الوظيفي
                <select value={form.careerLevel} onChange={(e) => setForm({ ...form, careerLevel: e.target.value })} className={controlCls}>
                  <option value="">اختر مستواك</option>
                  {CAREER_LEVELS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              {domains.length > 0 && (
                <fieldset>
                  <legend>ما الذي تريد تطويره؟ <span className="text-muted-foreground">حتى {GRANT_MAX_INTERESTS}</span></legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {domains.map((d) => {
                      const on = interests.includes(d);
                      const full = !on && interests.length >= GRANT_MAX_INTERESTS;
                      return (
                        <Inset as="label" key={d} tone={on ? "accent" : "default"} interactive={!full} className={`inline-flex items-center gap-2 px-3 py-1.5 ${full ? "opacity-50" : ""}`}>
                          <input type="checkbox" checked={on} disabled={full} onChange={() => pickInterest(d)} />
                          {d}
                        </Inset>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </div>
          </details>

          {hp.field}
          <Button type="submit" tone="primary" className="w-full" disabled={busy || !ready}>{c.open ? "احجز منحتي الآن" : "سجلني"}</Button>
          <p className="text-read leading-6 text-muted-foreground">{GRANT_CONSENT_AR}</p>
        </Card>
        <p className="mt-4 text-center text-read text-muted-foreground">{GRANT_ACADEMY_LINE_AR}</p>
      </div>
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

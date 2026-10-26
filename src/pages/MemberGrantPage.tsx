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
import { Award, ChevronDown, Clock, Copy, Flame, Gift, Loader2, Mail, MessageCircle, PencilRuler, Share2, Sparkles, UserRound, Video, type LucideIcon } from "lucide-react";
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
import { fmtDateLong, fmtMoney } from "@/application/text/format-ar";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { grantPrice, MEMBER_GRANT_NAME_AR } from "@/application/commerce/grant";
import {
  CAREER_LEVELS, GRANT_ACADEMY_LINE_AR, GRANT_CONSENT_AR, GRANT_GAINS_AR, GRANT_GIFT_AR, GRANT_MAX_INTERESTS, GRANT_SUGGESTED_COURSES, WORK_FIELDS,
  GRANT_FACES_PHONE, GRANT_VALUE_AR, GRANT_VALUE_PAID_AR, campaignParams, grantAdvisorTextAr, grantCountAr, grantTrainerFaces, grantTrainersAr, grantCountdown, grantLeftAr, grantLimitAr, grantRemainingAr, grantSections, grantShareAr, grantShareMailto, rankByInterest, seatsLeftAr, suggestCourses, suggestPaths, toggleCourse,
  type GrantPathOption,
} from "@/application/commerce/grant-landing";
import { readStoredGrant, saveStoredGrant, type StoredGrant } from "@/services/grant-landing";
import publicPathsData from "@/data/catalog/public-pathways.json";
import { waHref, waShare } from "@/application/site/whatsapp";
import { useWhatsAppNumbers } from "@/services/whatsapp";
import { CONTACT } from "@/data/stories";
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

/** عدّادُ انتهاء المنحة وآخرُ يومٍ لها — سطرٌ واحدٌ بالأيّام، وتحت اليوم بالساعات (`grantLeftAr`) */
function GrantCountdown({ closesAt, className = "" }: { closesAt: string; className?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const left = grantLeftAr(grantCountdown(closesAt, now));
  if (!left) return <p className={`text-read font-bold ${className}`}>انتهت المنحة</p>;
  return (
    <div className={className} role="timer">
      <p className="inline-flex items-center gap-1.5 font-black"><Clock className="h-4 w-4 text-gold-ink" aria-hidden="true" /> تنتهي المنحة بعد {left}</p>
      <p className="mt-0.5 text-read text-muted-foreground">آخر يوم: {fmtDateLong(new Date(new Date(closesAt).getTime() - 1))}</p>
    </div>
  );
}
/* المساراتُ العامّةُ بترتيب مختارات صاحب المنصّة — ومنها الرئيسيُّ والبديل (`suggestPaths`) */
const PICK_RANK = new Map(publicPathsData.picks.map((x, i) => [x.id, i]));
const GRANT_PATHS: GrantPathOption[] = [...publicPathsData.pathways]
  .sort((a, b) => (PICK_RANK.get(a.id) ?? Infinity) - (PICK_RANK.get(b.id) ?? Infinity))
  .map((x) => ({ id: x.id, title: x.title, courseIds: x.course_ids }));
/** مجالُ دورةٍ لم تُسمَّ عائلتُها — لا يُعرض فيما يريد تطويرَه */
const OTHER_DOMAIN = "أخرى";
const GAIN_ICON: Record<(typeof GRANT_GAINS_AR)[number]["id"], LucideIcon> = { live: Video, practice: PencilRuler, certificate: Award };

/** ما يحصل عليه — في صندوق الكود بعد النموذج (`GRANT_GAINS_AR`)، لا في الصفحة الأولى. قائمةٌ مرتّبةٌ بأيقونةٍ لكلّ بند، كتلةٌ في الوسط وبنودُها
    على سطرٍ واحد — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «ضعهم في الصندوق الأعلى بطريقةٍ مرتّبةٍ مع أيقونات» */
function GrantGains({ className = "" }: { className?: string }) {
  return (
    <ul className={`mx-auto grid w-fit gap-2.5 text-start text-read ${className}`}>
      {GRANT_GAINS_AR.map((g) => {
        const Icon = GAIN_ICON[g.id];
        return (
          <li key={g.id} className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal/10"><Icon className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /></span>
            {g.title}
          </li>
        );
      })}
    </ul>
  );
}

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
  /* رقمُ مستشار المنحة من شاشة الربط (`grant_advisor`) — لا حرفٌ في الشيفرة */
  const numbers = useWhatsAppNumbers();

  /* الدوراتُ المختارة بترتيب اختيارها — من كلّ ما يُشترى اليوم */
  const [picked, setPicked] = useState<string[]>([]);
  /* ما اخترناه له سلفا — يبقى أعلى القائمة بشارته وإن حذفه، فلا تقفز الصفوفُ تحت يده */
  const [suggested, setSuggested] = useState<string[]>([]);
  /* المسارُ الذي اخترنا دوراتِه له. وكان معه بديلٌ يبدّل إليه بضغطة، فحُذف بقرار صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «لا داعي
     لخيار بدّل للمسار لأنّه غير مفهوم» — ومن أراد غيرَ ما اقترحناه يجده في أقسام المجالات تحته */
  const [mainPath, setMainPath] = useState<GrantPathOption | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);

  const load = useCallback(async () => {
    try { setView(await apiGet<View>("/api/public/grant")); }
    catch (e) { setFailed(e instanceof ApiError ? e.message : "تعذر تحميل الصفحة"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const [resumed] = useState(() => resumedCheckoutFor(PICK_PATH));

  /* ما نقترحه مرّةً واحدةً حين يصير له كود: دوراتُ المسار الرئيسيّ الذي يناسب مجالَه واهتمامَه (`suggestPaths`)، أو
     أربعُ دوراتٍ تناسبهما إن لم يناسبه مسار (`suggestCourses`) — تُعرض أوّلا بشارة «نقترحها لك» **ولا تُختار عنه**:
     قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦) «لا تختر عنه أنت، فقط اكتب له بخطٍّ صغير: نقترحها لك». ويعود ما تركه قبل أن
     يخرج ليوثّق بريده مختارا كما كان */
  useEffect(() => {
    if (!view || !stored || seeded) return;
    const max = view.campaign.maxCourses;
    const found = suggestPaths(GRANT_PATHS, view.openCourses, stored.interests, stored.workField);
    const ours = found.main
      ? found.main.courseIds.slice(0, max)
      : suggestCourses(view.openCourses, stored.interests, stored.workField, Math.min(GRANT_SUGGESTED_COURSES, max));
    const open = new Set(view.openCourses.map((x) => x.courseId));
    setMainPath(found.main);
    setSuggested(ours);
    setPicked(resumed ? resumed.intent.courseIds.filter((id) => open.has(id)).slice(0, max) : []);
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
  /* آخرُ يومٍ بتاريخه الطويل — في رسالة الهديّة («30 أكتوبر 2026») */
  const lastDayLong = c.closesAt ? fmtDateLong(new Date(new Date(c.closesAt).getTime() - 1)) : null;
  const shareText = grantShareAr(window.location.origin, pct, lastDayLong);

  /* ─── الخطوة ٢: الكودُ واختيارُ الدورات ─── */
  if (stored) {
    /* ما اخترناه له أوّلا، ثمّ ما قال إنّه يريد تطويرَه */
    const mine = new Set(stored.interests);
    const ours = new Set(suggested);
    const fits = (x: GrantCourse) => (x.domainAr && mine.has(x.domainAr) ? 1 : 0);
    /* والمختارةُ بترتيب اختيارنا — أنسبُها أوّلا — فوق كلّ ما سواها */
    const courses = rankByInterest(view.openCourses, (x) => (ours.has(x.courseId) ? 2 + suggested.length - suggested.indexOf(x.courseId) : fits(x)));
    /* ما اخترناه له فوقُ مفتوحا، والباقي أقسامٌ مطويّةٌ بمجالها — ما يريد تطويرَه أوّلا (`grantSections`) */
    const top = courses.filter((x) => ours.has(x.courseId));
    const sections = grantSections(courses.filter((x) => !ours.has(x.courseId)), stored.interests, OTHER_DOMAIN);
    const advisorHref = waHref(numbers, "grant_advisor", CONTACT.whatsapp, grantAdvisorTextAr(stored.name, stored.code, chosen.map((x) => x.titleAr), `${window.location.origin}/grant`));
    /* سطرُ الصندوق حين لا كود ولا بريد — سببُ الخادم، أو أنّها مغلقة. ولا فقرةٌ فارغةٌ حين لا شيء يقال */
    const topNote = reasonAr ?? (c.open ? null : "المنحة مغلقة الآن");
    /* بطاقةُ الدورة — في المختارات فوق وفي أقسام المجالات تحتها، ولا يُعاد اسمُ المجال تحت قسمه. وصورةُ مدرّبها أوّلُ ما يُرى، وبكبرها — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «اجعل صورةَ المدرّب
       هي الشيءَ الذي يراه الشخص، بتصميمٍ يبيّن الصورةَ بحجمٍ كبيرٍ عصريّ». والشاراتُ وسومٌ نصّيّةٌ أعلاها لا أقراصٌ تُشبه
       الأزرار («نقترحها لك يبدو زرّا»)، والسعرُ قيمتان بلا «قبل المنحة/بعد المنحة»: ما يدفعه كبيرا، وأصلُه مشطوبا */
    const row = (x: GrantCourse, inSection = false) => {
      const on = picked.includes(x.courseId);
      const full = !on && picked.length >= max;
      const seats = seatsLeftAr(x.seatsLeft);
      const tag = ours.has(x.courseId) ? "نقترحها لك" : fits(x) > 0 ? "يناسب ما تريد تطويره" : null;
      return (
        <Inset
          as="label" key={x.courseId} tone={on ? "accent" : "default"} interactive={!full}
          className={`flex cursor-pointer items-start gap-4 ${full ? "opacity-50" : ""}`}
        >
          {/* والاختيارُ على الصورة نفسِها — يُرى ويُضغط معها */}
          <span className="relative shrink-0">
            {x.trainer?.photoUrl
              ? <img src={x.trainer.photoUrl} alt="" loading="lazy" className="h-24 w-24 rounded-2xl object-cover shadow-lg sm:h-28 sm:w-28" />
              : <span className="grid h-24 w-24 place-items-center rounded-2xl bg-teal/10 text-teal-light-ink sm:h-28 sm:w-28"><UserRound className="h-10 w-10" aria-hidden="true" /></span>}
            <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(x.courseId)} aria-label={x.titleAr} className="absolute start-2 top-2 h-5 w-5 shadow" />
          </span>
          <span className="min-w-0 flex-1">
            {(tag || seats) && (
              <span className="mb-1 flex flex-wrap items-center gap-x-3 text-read font-bold">
                {tag && <span className="inline-flex items-center gap-1 text-gold-ink"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{tag}</span>}
                {seats && <span className="inline-flex items-center gap-1 text-red-300"><Flame className="h-3.5 w-3.5" aria-hidden="true" />{seats}</span>}
              </span>
            )}
            <span className="block font-bold leading-6">{x.titleAr}</span>
            {/* المدرّبُ ببوّابة النشر، وتفاصيلُ الدورة — في نافذةٍ جديدة فلا يضيع ما اختاره */}
            {x.trainer && (
              <a href={`/trainers#trainer-${encodeURIComponent(x.trainer.id)}`} target="_blank" rel="noreferrer" className="mt-0.5 block text-read font-bold text-teal-light-ink">
                مع {x.trainer.name}
              </a>
            )}
            <span className="mt-0.5 block text-read text-muted-foreground">{x.domainAr && !inSection ? `${x.domainAr} · ` : ""}تبدأ {cohortDayAr(x.startsAt)} · مباشرة على Zoom</span>
            <span className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="flex items-baseline gap-2">
                <bdi dir="ltr" className="text-lg font-black">{money(grantPrice(x.price, pct))}</bdi>
                <bdi dir="ltr" className="text-read text-muted-foreground line-through">{money(x.price)}</bdi>
              </span>
              <a href={`/build/${encodeURIComponent(x.courseId)}`} target="_blank" rel="noreferrer" className="text-read text-muted-foreground underline">تفاصيل الدورة</a>
            </span>
          </span>
        </Inset>
      );
    };
    return (
      <Shell>
        {/* صندوقُ الكود — عمودان على الحاسوب: الكودُ والعدّادُ والحدّ، وبجانبها ما يحصل عليه؛ وعلى الهاتف عمودٌ واحد.
            قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «لم يستغلّ البوكس.. من الممكن أن يكون أصغر وأرتب». وكان كلُّه في الوسط
            سطرا تحت سطر، وأيقونةُ الهديّة وحدَها سطر */}
        <Card tone="accent" className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8">
          <div className="text-center sm:text-start">
            {stored.code ? (
              <>
                <p className="flex items-center justify-center gap-1.5 text-read text-muted-foreground sm:justify-start">
                  <Gift className="h-4 w-4 text-gold-ink" aria-hidden="true" /> كود منحتك
                </p>
                {/* الكودُ بخطٍّ لاتينيّ من اليسار، فطرفُه في الحاسوب طرفُ العمود الأيمن (`justify-end` في `ltr`) */}
                <p className="mt-1 flex items-center justify-center gap-2 text-2xl font-black sm:justify-end" dir="ltr">
                  {stored.code}
                  <button type="button" aria-label="انسخ الكود" onClick={() => void copy(stored.code!)} className="cursor-pointer"><Copy className="h-5 w-5" /></button>
                </p>
                <p className="mt-0.5 text-read text-muted-foreground">أرسلناه إلى بريدك أيضا.</p>
              </>
            ) : stored.sentTo ? (
              <p className="text-read">لك كود منحة من قبل. أرسلناه إلى {stored.sentTo}، واكتبه عند الدفع.</p>
            ) : (
              topNote && <p className="text-read">{topNote}</p>
            )}
            {c.open && c.closesAt && <GrantCountdown closesAt={c.closesAt} className="mt-3" />}
            {/* وحدُّها جملةٌ واحدةٌ تحت «آخر يوم» — قرارُه (٢٤ أكتوبر ٢٠٢٦). وهو حدٌّ يحرس قيمتَها: «اختر ٤ دوراتٍ بحدٍّ أقصى» */}
            {c.open && <p className="mt-0.5 text-read text-muted-foreground">{grantLimitAr(max)}</p>}
          </div>
          {/* وما يحصل عليه داخلَ هذا الصندوق — قرارُه (٢٤ أكتوبر ٢٠٢٦): «ضعهم في الصندوق الأعلى» */}
          <div className="border-t border-border pt-4 sm:border-s sm:border-t-0 sm:ps-8 sm:pt-0"><GrantGains /></div>
        </Card>

        <h2 className="mt-6 text-xl font-black">
          اختر دوراتك{view.termAr && <span className="text-read font-normal text-muted-foreground"> · {view.termAr}</span>}
        </h2>
        {suggested.length > 0 && (
          <p className="mt-2 text-read">{mainPath ? `نقترح لك دورات مسار «${mainPath.title}».` : `نقترح لك ${coursesAr(suggested.length)} تناسبك.`}</p>
        )}

        {view.openCourses.length === 0 ? (
          <Card as="p" className="mt-5 text-read text-muted-foreground">لا دورات متاحة الآن. تواصل مع مستشار ليقترح عليك.</Card>
        ) : (
          <>
            {top.length > 0 && <div className="mt-5 space-y-3">{top.map((x) => row(x))}</div>}
            {/* والباقي أقسامٌ مطويّةٌ بمجالها — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «الدوراتُ كثيرةٌ وتحيّر الشخص» */}
            {sections.length > 0 && (
              <>
                {top.length > 0 && <p className="mt-6 font-bold">ويمكنك اختيار دورات أخرى من المجالات التالية</p>}
                <div className="mt-2 space-y-2">
                  {sections.map((sec) => {
                    const mineHere = sec.items.filter((x) => picked.includes(x.courseId)).length;
                    return (
                      <Inset as="details" key={sec.domain} className="group">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                          <span className="font-bold">{sec.domain}</span>
                          <span className="flex shrink-0 items-center gap-2 text-read text-muted-foreground">
                            {grantCountAr(sec.items.length)}{mineHere > 0 && <Chip tone="accent">اخترت {mineHere}</Chip>}
                            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
                          </span>
                        </summary>
                        <div className="mt-3 space-y-3">{sec.items.map((x) => row(x, true))}</div>
                      </Inset>
                    );
                  })}
                </div>
              </>
            )}
            {picked.length >= max && <p className="mt-2 text-read text-muted-foreground">وصلت الحد: {max} دورات. احذف دورة لتضيف غيرها.</p>}
          </>
        )}

        {chosen.length > 0 && (
          <Card tone="solid" className="sticky bottom-3 mt-4 text-center shadow-lg">
            {/* ما يدفعه كبيرا، وقيمةُ منحته صغيرةً تحته — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦). والمبالغُ معزولةٌ فلا تنقلب */}
            <p className="text-lg font-black">
              {grantCountAr(chosen.length)} بـ<bdi dir="ltr">{money(payTotal)}</bdi>{" "}
              <span className="text-read font-normal text-muted-foreground">بدل <bdi dir="ltr" className="line-through">{money(listTotal)}</bdi></span>
            </p>
            <p className="mt-0.5 text-read text-muted-foreground">{GRANT_VALUE_AR} <bdi dir="ltr">{money(listTotal - payTotal)}</bdi> {GRANT_VALUE_PAID_AR}</p>
            {/* وما بقي له ضمن منحته — فلا يترك منها شيئا (قرارُه: «اختر ٤ دوراتٍ بحدٍّ أقصى») */}
            <p className="mt-1 text-read font-bold text-gold-ink">{grantRemainingAr(chosen.length, max)}</p>
            <Button tone="confirm" className="mt-3 w-full" onClick={pay}>احصل على المنحة</Button>
          </Card>
        )}

        {/* الإهداءُ صندوقٌ وحدَه خارجَ لوح الدفع — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «صندوقُ الإهداء يكون خارجَ صندوق
            الدفع، واجعل الكلمة: يحقّ لك أن تهدي هذه المنحة لأصدقائك (بحدٍّ أعلى ٣)». رسالةٌ جاهزةٌ في واتساب والبريد، فالصديقُ
            يأخذ منحتَه لا كودَك (`grantShareAr`) */}
        {c.open && (
          <Card className="mt-6 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold/10"><Gift className="h-6 w-6 text-gold-ink" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-black">{GRANT_GIFT_AR.title}</span>
              <span className="block text-read text-muted-foreground">{GRANT_GIFT_AR.limit}، برسالة جاهزة ترسلها بضغطة.</span>
            </span>
            <span className="flex shrink-0 gap-2">
              <Button as="a" href={waShare(shareText)} target="_blank" rel="noreferrer" icon={Share2}>واتساب</Button>
              <Button as="a" href={grantShareMailto(window.location.origin, pct, lastDayLong)} icon={Mail}>البريد</Button>
            </span>
          </Card>
        )}

        {/* والمستشارُ على واتساب مباشرة — قرارُه (٢٤ أكتوبر ٢٠٢٦): «التواصلُ مع المستشار فاشلة لا تمثّل وسيلةً احترافيّة،
            اجعلها واتساب مباشرة». برسالةٍ فيها اسمُه وكودُه، والرقمُ موضعُه في شاشة الربط (`grant_advisor`).
            وطلبُ المستشار المكتوب (`/api/public/grant/advisor`) بقي في الخادم ولا تناديه الصفحة: مكالمةُ الساعتين تُفتح وحدَها */}
        {advisorHref && (
          <Card className="mt-4 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-teal/10"><MessageCircle className="h-6 w-6 text-teal-light-ink" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-black">تحتاج مساعدة في الاختيار؟</span>
              <span className="block text-read text-muted-foreground">مستشارك الخاص يرد عليك مباشرة على واتساب.</span>
            </span>
            <Button as="a" href={advisorHref} target="_blank" rel="noreferrer" icon={MessageCircle} className="shrink-0">راسل مستشارك</Button>
          </Card>
        )}

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
            grantPayTotal={payTotal}
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
  const trainers = grantTrainerFaces(view.openCourses);
  return (
    <Shell>
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <Gift className="mx-auto h-10 w-10 text-gold-ink" aria-hidden="true" />
          <h1 className="mt-2 text-3xl font-black">{MEMBER_GRANT_NAME_AR}</h1>
          {c.open ? (
            <>
              {/* المنحةُ بنسبتها لا بما يبقى عليه — قرارُ صاحب المنصّة (٢٥ أكتوبر ٢٠٢٦): «نقول إنّ المنحة تصل لـ٦٠٪ أفضل من
                  أنّك تدفع ٤٠٪». وكذلك في بريد الكود وبريد التذكير */}
              <p className="mt-3 text-lg font-bold">لأنك من أعضاء وجيز، منحتك تصل إلى {c.percentOff}% من سعر دوراتك.</p>
              <p className="mt-1 text-read text-muted-foreground">دورات مباشرة على Zoom، تختار منها حتى {c.maxCourses}.</p>
              {c.closesAt
                ? <GrantCountdown closesAt={c.closesAt} className="mt-4" />
                : <p className="mt-3"><Chip tone="warn">المنح محدودة</Chip></p>}
            </>
          ) : (
            <p className="mt-3 text-lg font-bold">المنحة غير مفتوحة الآن. سجل بياناتك ونبلغك أول ما تفتح.</p>
          )}
        </div>

        {/* وما يحصل عليه في صندوق الكود بعد النموذج وحدَه — قرارُ صاحب المنصّة (٢٥ أكتوبر ٢٠٢٦): «احذفها من الصفحة
            الأولى». فالنموذجُ يبدأ بعد سطرَي المنحة والعدّاد */}
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
        {/* وجوهُ مدرّبي الموسم تحت النموذج — قرارُ صاحب المنصّة (٢٥ أكتوبر ٢٠٢٦)، والعلّةُ عند `grantTrainerFaces` */}
        {trainers.faces.length >= 3 && (
          <div className="mt-6 text-center">
            <div className="flex justify-center -space-x-4 rtl:space-x-reverse">
              {trainers.faces.map((t, i) => (
                <img key={t.id} src={t.photoUrl} alt={t.name} title={t.name} width={64} height={64} loading="lazy" decoding="async"
                  className={`h-14 w-14 shrink-0 rounded-full bg-paper object-cover object-[50%_25%] ring-2 ring-paper sm:h-16 sm:w-16 ${i < GRANT_FACES_PHONE ? "" : "hidden sm:block"}`} />
              ))}
              {trainers.total > Math.min(trainers.faces.length, GRANT_FACES_PHONE) && (
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-teal-deep font-black text-white ring-2 ring-paper sm:hidden" dir="ltr">
                  +{trainers.total - Math.min(trainers.faces.length, GRANT_FACES_PHONE)}
                </span>
              )}
              {trainers.total > trainers.faces.length && (
                <span className="hidden h-16 w-16 shrink-0 place-items-center rounded-full bg-teal-deep text-lg font-black text-white ring-2 ring-paper sm:grid" dir="ltr">
                  +{trainers.total - trainers.faces.length}
                </span>
              )}
            </div>
            <p className="mt-2 font-bold">تتعلم مع مدربين معتمدين لدينا</p>
            <p className="text-read text-muted-foreground">{grantTrainersAr(trainers.total)} · {grantCountAr(view.openCourses.length)} مباشرة على Zoom</p>
          </div>
        )}
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

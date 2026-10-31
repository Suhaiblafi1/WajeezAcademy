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
   (`ResumeCheckout`). والعلّةُ في `server/services/grant-landing.service.ts`.

   ═══ وهي صفحةُ «منحة مؤثرين وجيز» أيضا (٢٦ أكتوبر ٢٠٢٦) ═══

   `/grant/i/<كود المؤثّر>` — قرارُ صاحب المنصّة («A»): صفحتُها غيرُ `/grant`، برابط المؤثّر وكودُه مكتوبٌ في النموذج،
   ونسبتُها نسبتُها. والفرقُ خانةُ كود المؤثّر (لازمة)، وسطرُ المنحة باسمه («بدعوة من …»)، وما يُحفظ على الجهاز في
   مفتاحٍ وحدَه، والإهداءُ برابط المؤثّر نفسِه — فالصديقُ يأخذ منحتَها ويُحسب لمن جاء به. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Award, Check, ChevronDown, Clock, Copy, ExternalLink, Flame, Gift, Loader2, Mail, MessageCircle, PencilRuler, Share2, Sparkles, TriangleAlert, UserRound, Video, type LucideIcon } from "lucide-react";
import { apiGet, apiPost, apiPut, ApiError } from "@/services/api";
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
import type { TimedSession } from "@/application/learning/cohort-overlap";
import { GRANT_CLOSED_AR, GRANT_SOLD_OUT_AR, grantPrice, INFLUENCER_GRANT_NAME_AR, MEMBER_GRANT_NAME_AR } from "@/application/commerce/grant";
import { INFLUENCER_GRANT_PATH, influencerCodeLabelAr, normalizeInfluencerCode } from "@/application/commerce/influencer";
import {
  CAREER_LEVELS, GRANT_ACADEMY_LINE_AR, GRANT_CONSENT_AR, GRANT_FAQ_AR, GRANT_GAINS_AR, GRANT_GIFT_AR, GRANT_MAX_INTERESTS, GRANT_SUGGESTED_COURSES, WORK_FIELDS,
  GRANT_FACES_PHONE, GRANT_SHARE_PATH, GRANT_VALUE_AR, type GrantCourseSummary, GRANT_VALUE_PAID_AR, campaignParams, grantAdvisorTextAr, grantClashAr, grantRecordLink, grantCountAr, grantTrainerFaces, grantTrainersAr, grantCountdown, grantLeftAr, grantLimitAr, grantRemainingAr, grantSections, grantShareAr, grantShareMailto, grantThanksAr, rankByInterest, seatsLeftAr, suggestCourses, suggestPaths, toggleCourse,
  type GrantPathOption, GRANT_OUTCOMES_TITLE_AR, grantPerSession, grantSessionsAr, grantShortTitleAr, grantUntilAr,
} from "@/application/commerce/grant-landing";
import { GRANT_STORE_KEY, INFLUENCER_GRANT_STORE_KEY, readStoredGrant, saveStoredGrant, type StoredGrant } from "@/services/grant-landing";
import publicPathsData from "@/data/catalog/public-pathways.json";
import { BARE_HOST } from "@/application/site/origin";
import { waHref, waShare } from "@/application/site/whatsapp";
import { useWhatsAppNumbers } from "@/services/whatsapp";
import { CONTACT } from "@/data/stories";
import { resumedCheckoutFor, savePendingCheckout } from "@/services/pending-checkout";
import { firstTouch, pageTouchNow, visitorId } from "@/services/first-touch";

interface GrantCourse {
  courseId: string; titleAr: string; cohortId: string; startsAt: string | null; seatsLeft?: number | null; price: number; domainAr?: string;
  /** مدرّبُها المنشور — ببوّابة النشر في الخادم (`grant-courses.service.ts`) */
  trainer?: { id: string; name: string; photoUrl: string | null } | null;
  /** نبذتُها تحت سهمٍ في صفّها (`grantCourseSummary`) — بلا شيءٍ لا سهمَ لها */
  summary?: GrantCourseSummary | null;
  /** مواعيدُ لقاءاتها المعتمَدة — بها يُقال التعارضُ فورَ الاختيار (`grantClashAr`) */
  sessions?: TimedSession[];
}
interface View {
  /** `soldOut`: نفدت أكوادُها والمنحةُ مفتوحة — فمن لا كودَ له يبقى عند سببه ولا يعود إلى النموذج كلَّ زيارة */
  campaign: { open: boolean; percentOff: number; maxCourses: number; closesAt: string | null; soldOut?: boolean };
  /** فصلُ الدورات المعروضة — الفصلُ القادمُ القريب (`grant-courses.service.ts#pool`) */
  termAr: string | null;
  openCourses: GrantCourse[];
  /** مؤثّرُ الرابط في منحة المؤثّرين — إن كان كودُه صحيحا */
  influencer?: { nameAr: string; code: string } | null;
  /** رابطُ الهديّة القصير (`/s/…`) يصنعه الخادم مرّةً لكلّ وجهة — وبدونه الطويلُ كما كان */
  sharePath?: string | null;
}
interface ApplyResult extends View {
  ref: string;
  grant: { code: string | null; sentTo: string | null; percentOff: number } | null;
  reasonAr: string | null;
}

const USD = "USD";
/** طريقُ العودة بعد توثيق البريد — اختيارُه محفوظٌ على الجهاز، والصفحةُ تعيده (`pending-checkout.ts`) */
const PICK_PATH = "/grant/build";
const influencerPickPath = (code: string) => `${INFLUENCER_GRANT_PATH}/${code}/build`;
const BUY_TITLE_AR = "دورات منحتك";
/** حيث يُحفظ ما اختاره، وكم يُنتظر بعد آخر نقرةٍ قبل حفظه */
const GRANT_PICKS_PATH = "/api/public/grant/picks";
const PICKS_SAVE_DELAY_MS = 800;
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
/** كم وجها في رأس كلِّ قسم */
const SECTION_FACES = 3;
/** أيقونةُ كلِّ بندٍ ممّا يحصل عليه — في سطر صندوق الكود */
const GAIN_ICON: Record<(typeof GRANT_GAINS_AR)[number]["id"], LucideIcon> = { live: Video, practice: PencilRuler, certificate: Award };

export default function MemberGrantPage({ variant = "members" }: { variant?: "members" | "influencer" }) {
  const forInfluencer = variant === "influencer";
  const nameAr = forInfluencer ? INFLUENCER_GRANT_NAME_AR : MEMBER_GRANT_NAME_AR;
  const storeKey = forInfluencer ? INFLUENCER_GRANT_STORE_KEY : GRANT_STORE_KEY;
  const params = useParams();
  const urlCode = forInfluencer ? normalizeInfluencerCode(params.code) : null;
  const { user: session } = useRealSession();
  /* ومن أنشأ حسابَه أو دخل في نافذة الدفع داخلٌ من يومها — `useRealSession` يُقرأ مرّةً عند التحميل، فكانت الصفحةُ تراه
     «غيرَ داخل» حتّى يحدّثها: يغلق لوحَ الدفع ثمّ يضغط الشراء فتعود نافذةُ الحساب، ويقال له «البريدُ مسجّل» */
  const [signedIn, setSignedIn] = useState(false);
  const authed = !!session || signedIn;
  const hp = useHoneypot();
  const [view, setView] = useState<View | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [stored, setStored] = useState<StoredGrant | null>(() => readStoredGrant(storeKey));
  const [reasonAr, setReasonAr] = useState<string | null>(null);
  /* ومن عاد إلى النموذج (لا كودَ له بعد) يجده بما كتب أوّلَ مرّة — إلّا رقمَه، فهو لا يُحفظ على جهازه */
  const [form, setForm] = useState(() => {
    const was = readStoredGrant(storeKey);
    return { fullName: was?.name ?? "", phone: "", email: was?.email ?? "", workField: was?.workField ?? "", careerLevel: "" };
  });
  /* كودُ المؤثّر — من رابطه، ويكتبه من جاء بلا رابط */
  const [influencerCode, setInfluencerCode] = useState(urlCode ?? "");
  /* ومن حُسب له: مؤثّرُ ما حُفظ إن أخذ كودا، وإلّا مؤثّرُ الرابط */
  const creditedCode = stored?.influencer ?? urlCode;
  const pickPath = forInfluencer ? (creditedCode ? influencerPickPath(creditedCode) : null) : PICK_PATH;
  const shell = forInfluencer
    ? { title: nameAr, path: `${INFLUENCER_GRANT_PATH}${urlCode ? `/${urlCode}` : ""}`, description: "منحة من أكاديمية وجيز: دورات مباشرة تختارها بخصم كبير، والعدد محدود." }
    : {};
  const [interests, setInterests] = useState<string[]>(() => readStoredGrant(storeKey)?.interests ?? []);
  const [busy, setBusy] = useState(false);
  /* متى فتح هذه الصفحة ومن أين — يُرسَل مع النموذج فيُعرف في قائمة من عبّأ مصدرُه ووقتُ فتحه الرابط (`grant-registrants.ts`) */
  const [opened] = useState(pageTouchNow);
  /* ويُعدّ من فتحها وإن لم يعبّئ — مرّةً مع كلّ فتح، والخادمُ يجمع المتصفّحَ الواحدَ في صفّ (`grant-visit.service.ts`) */
  const [visitor] = useState(visitorId);
  useEffect(() => {
    void apiPost("/api/public/grant/visit", {
      campaign: forInfluencer ? "influencer" : "member", visitorId: visitor, code: urlCode, source: { page: opened, first: firstTouch() },
    }).catch(() => {});
  }, [forInfluencer, visitor, urlCode, opened]);
  /* رقمُ مستشار المنحة من شاشة الربط (`grant_advisor`) — لا حرفٌ في الشيفرة */
  const numbers = useWhatsAppNumbers();

  /* الدوراتُ المختارة بترتيب اختيارها — من كلّ ما يُشترى اليوم */
  const [picked, setPicked] = useState<string[]>([]);
  /* ما اخترناه له سلفا — يبقى أعلى القائمة بشارته وإن حذفه، فلا تقفز الصفوفُ تحت يده */
  const [suggested, setSuggested] = useState<string[]>([]);
  /* نبذةُ أيِّ دورةٍ مفتوحةٌ الآن — واحدةٌ في كلّ مرّة، فتبقى القائمةُ مرتّبة */
  const [summaryOf, setSummaryOf] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);

  const load = useCallback(async () => {
    const url = forInfluencer
      ? `/api/public/grant/influencer${urlCode ? `?code=${encodeURIComponent(urlCode)}` : ""}`
      : "/api/public/grant";
    try { setView(await apiGet<View>(url)); }
    catch (e) { setFailed(e instanceof ApiError ? e.message : "تعذر تحميل الصفحة"); }
  }, [forInfluencer, urlCode]);
  useEffect(() => { void load(); }, [load]);

  const [resumed] = useState(() => (pickPath ? resumedCheckoutFor(pickPath) : null));

  /* ما نقترحه مرّةً واحدةً حين يصير له كود: خمسُ دوراتٍ لا تتعارض ولا يتكرّر فيها مدرّب، أوّلُها دوراتُ المسار الرئيسيّ
     الذي يناسب مجالَه واهتمامَه (`suggestPaths`)، ثمّ ما يناسبهما (`suggestCourses`) — ويختار منها حتّى الحدّ. قرارُ صاحب
     المنصّة (٢٧ أكتوبر ٢٠٢٦). وتُعرض أوّلا بشارة «نقترحها لك» **ولا تُختار عنه**:
     قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦) «لا تختر عنه أنت، فقط اكتب له بخطٍّ صغير: نقترحها لك». ويعود ما تركه قبل أن
     يخرج ليوثّق بريده مختارا كما كان */
  useEffect(() => {
    if (!view || !stored || seeded) return;
    const max = view.campaign.maxCourses;
    const found = suggestPaths(GRANT_PATHS, view.openCourses, stored.interests, stored.workField);
    const ours = suggestCourses(view.openCourses, stored.interests, stored.workField, GRANT_SUGGESTED_COURSES, found.main?.courseIds ?? []);
    const open = new Set(view.openCourses.map((x) => x.courseId));
    setSuggested(ours);
    setPicked((resumed ? resumed.intent.courseIds : stored.picks ?? []).filter((id) => open.has(id)).slice(0, max));
    setSeeded(true);
  }, [view, stored, seeded, resumed]);

  /* ونسبةُ كوده إن كان له — كلُّ كودٍ يحمل نسبتَه يومَ أُعطي (`grant.service.ts`)، فإن غيّر صاحبُ المنصّة نسبةَ الحملة بعده
     سُعّرت الصفحةُ بالجديدة ودُفع بالقديمة.
     ولا خصمَ يُرى لمن لا منحةَ يستعملها (مراجعةُ ٢٨ أكتوبر ٢٠٢٦): من عبّأ النموذجَ والمنحةُ مغلقةٌ أو نفدت أكوادُها فلا كودَ له
     ولا بريد، ومن انتهت منحتُه بعد يومها الأخير يُردّ كودُه عند الدفع — وكانت الصفحةُ تعرض لهم «$88» مشطوبا عنه «$160»
     ويدفعون كاملا. فالخصمُ ما دام له كودٌ أو بريدٌ به والمنحةُ مفتوحة */
  const grantOn = !!view?.campaign.open && !!(stored?.code || stored?.sentTo);
  const pct = grantOn ? stored?.percentOff ?? view?.campaign.percentOff ?? 0 : 0;
  const max = view?.campaign.maxCourses ?? 4;
  const chosen = useMemo(
    () => picked.map((id) => view?.openCourses.find((x) => x.courseId === id)).filter((x): x is GrantCourse => !!x),
    [picked, view],
  );
  const listTotal = chosen.reduce((sum, x) => sum + x.price, 0);
  const payTotal = grantPrice(listTotal, pct);
  /* ما اختاره يُحفظ في ملفّه فيراه المستشار (`savePicks`) — بعد أن يغيّره هو لا عند فتح الصفحة: الصفحةُ تفتح
     فارغةً في جهازٍ آخر، فلو حُفظ فتحُها لمحا ما اختاره قبله. وبمهلةٍ تجمع النقرات المتتابعة في طلبٍ واحد */
  const [touched, setTouched] = useState(false);
  const toggle = (id: string) => { setTouched(true); setPicked((p) => toggleCourse(p, id, max)); };
  const ref = stored?.ref;
  /* وعلى جهازه في الحال — فمن حدّث الصفحةَ أو عاد إليها وجد ما اختاره، لا قائمةً فارغة */
  useEffect(() => {
    if (!touched || !ref) return;
    const kept = readStoredGrant(storeKey);
    if (kept?.ref === ref) saveStoredGrant({ ...kept, picks: picked }, storeKey);
  }, [touched, ref, picked, storeKey]);
  useEffect(() => {
    if (!touched || !ref) return;
    const t = setTimeout(() => { void apiPut(GRANT_PICKS_PATH, { ref, courseIds: picked }).catch(() => {}); }, PICKS_SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [touched, ref, picked]);

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const out = await apiPost<ApplyResult>(forInfluencer ? "/api/public/grant/influencer" : "/api/public/grant", {
        ...form, careerLevel: form.careerLevel || null, interests, ...campaignParams(window.location.search), website: hp.value,
        source: { page: opened, first: firstTouch() }, visitorId: visitor,
        ...(forInfluencer ? { influencerCode: influencerCode.trim() } : {}),
      });
      const g = {
        ref: out.ref, code: out.grant?.code ?? null, sentTo: out.grant?.sentTo ?? null,
        name: form.fullName.trim(), email: form.email.trim(), interests, workField: form.workField,
        influencer: out.influencer?.code ?? null, percentOff: out.grant?.percentOff ?? null,
        /* ومن عاد إلى النموذج (لا كودَ له بعد) لا يفقد ما اختاره قبله — ملفُّه نفسُه */
        picks: stored?.ref === out.ref ? stored.picks : undefined,
      };
      saveStoredGrant(g, storeKey);
      setStored({ ...g, at: Date.now() });
      /* ويُقترح له من جديد بما كتب الآن — فقد يعود إلى النموذج بعد أن اقتُرح له بما كتب أوّلَ مرّة */
      setSeeded(false);
      setReasonAr(out.reasonAr);
      setView(out);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { toastError(err instanceof ApiError ? err.message : "تعذر الإرسال، أعد المحاولة"); }
    finally { setBusy(false); }
  };

  /* ومن جاء بلا كودٍ ظاهر («أرسلناه إلى بريدك») يأخذه بحسابه حين يدخل — ببريد النموذج (`myCode` في الخادم). فيظهر في صندوقه،
     ويفتح لوحُ الدفع بمنحته وبالسعر الذي رآه. قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦): «يجب أن يصلح ويتغيّر من جهتك» */
  /* ويُطلب حين يفتح لوحُ الدفع أيضا: من أنشأ حسابه في نافذة الدفع لا تعرفه هذه الصفحة بعدُ (`useRealSession` يُقرأ مرّةً
     عند التحميل)، فكان لا يُطلب له كودُه أبدا ويرى «اكتب كود منحتك» — بلاغُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦): «اجعل الكود يتفعّل
     تلقائيّا بدلا من تصعيب الأمور». واللوحُ لا يفتح إلّا بحساب (`pay`)، فطلبُه حينها آمن */
  const claimFor = (authed || buyOpen) && stored && !stored.code ? `${session?.email ?? "buy"}|${stored.ref}` : null;
  useEffect(() => {
    if (!claimFor) return;
    let on = true;
    apiGet<{ code: string | null; percentOff?: number | null }>(`/api/learner/grant-code?campaign=${forInfluencer ? "influencer" : "member"}`)
      .then(({ code, percentOff = null }) => {
        if (!on || !code) return;
        const kept = readStoredGrant(storeKey);
        if (kept && !kept.code) saveStoredGrant({ ...kept, code, sentTo: null, percentOff: percentOff ?? kept.percentOff }, storeKey);
        setStored((s) => (s && !s.code ? { ...s, code, sentTo: null, percentOff: percentOff ?? s.percentOff } : s));
      })
      .catch(() => undefined);
    return () => { on = false; };
  }, [claimFor, forInfluencer, storeKey]);

  const pay = () => {
    if (chosen.length === 0) return;
    savePendingCheckout({
      path: pickPath ?? PICK_PATH, intent: { title: BUY_TITLE_AR, amount: payTotal, kind: "courses", courseIds: chosen.map((x) => x.courseId) },
      cohortByCourse: Object.fromEntries(chosen.map((x) => [x.courseId, x.cohortId])),
    });
    if (!authed) { setAuthOpen(true); return; }
    setBuyOpen(true);
  };

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast("نسخ الكود"); } catch { /* المتصفّحُ منعه — الكودُ ظاهرٌ يُنسخ باليد */ }
  };

  if (failed) {
    return <Shell {...shell}><Card as="p" className="text-read">{failed}</Card></Shell>;
  }
  if (!view) {
    return <Shell {...shell}><div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div></Shell>;
  }

  const c = view.campaign;
  /* آخرُ يومٍ بتاريخه الطويل — في رسالة الهديّة («30 أكتوبر 2026») */
  const lastDayLong = c.closesAt ? fmtDateLong(new Date(new Date(c.closesAt).getTime() - 1)) : null;
  /* ومنحةُ المؤثّرين تُهدى برابط مؤثّرها — فالصديقُ يأخذ منحتَها، ويُحسب للمؤثّر */
  const sharePath = forInfluencer && creditedCode ? `${INFLUENCER_GRANT_PATH}/${creditedCode}` : GRANT_SHARE_PATH;
  /* والرابطُ قصيرٌ من الخادم إن صنعه — قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦): «الرابط يجب أن يكون قصيرا جدّا» */
  const shareLink = view.sharePath ? `https://${BARE_HOST}${view.sharePath}` : `${window.location.origin}${sharePath}`;
  /* والهديّةُ بنسبة الحملة اليوم لا بنسبة كوده: الصديقُ يأخذ كودا جديدا بنسبة يومه */
  const shareText = grantShareAr(shareLink, c.percentOff, lastDayLong, !forInfluencer);

  /* ─── الخطوة ٢: الكودُ واختيارُ الدورات ─── */
  /* ومن عبّأ النموذجَ والمنحةُ مغلقةٌ أو نفدت أكوادُها لم يأخذ كودا ولا بريدا — فإن فتحت يعود إلى النموذج ليأخذه، لا إلى
     الدورات بلا كودٍ فيدفع كاملا ويقال له «تجده في بريدك» ولم يصله شيء. ومن ردّه الخادمُ الآن يرى سببَه (`reasonAr`) */
  if (stored && (stored.code || stored.sentTo || reasonAr || !c.open || c.soldOut)) {
    /* ما اخترناه له أوّلا، ثمّ ما قال إنّه يريد تطويرَه */
    const mine = new Set(stored.interests);
    const ours = new Set(suggested);
    const fits = (x: GrantCourse) => (x.domainAr && mine.has(x.domainAr) ? 1 : 0);
    /* والمختارةُ بترتيب اختيارنا — أنسبُها أوّلا — فوق كلّ ما سواها */
    const courses = rankByInterest(view.openCourses, (x) => (ours.has(x.courseId) ? 2 + suggested.length - suggested.indexOf(x.courseId) : fits(x)));
    /* ما اخترناه له فوقُ مفتوحا، والباقي أقسامٌ مطويّةٌ بمجالها — ما يريد تطويرَه أوّلا (`grantSections`) */
    const top = courses.filter((x) => ours.has(x.courseId));
    const timedSuggested = top.length > 0 && top.every((x) => (x.sessions?.length ?? 0) > 0);
    const sections = grantSections(courses.filter((x) => !ours.has(x.courseId)), stored.interests, OTHER_DOMAIN);
    const advisorHref = waHref(numbers, "grant_advisor", CONTACT.whatsapp, grantAdvisorTextAr({
      name: stored.name, email: stored.email, code: stored.code, courses: chosen.map((x) => x.titleAr),
      recordLink: grantRecordLink(BARE_HOST, stored.code ?? stored.ref), grantNameAr: nameAr,
    }));
    /* سطرُ الصندوق حين لا كود ولا بريد — سببُ الخادم، أو أنّها مغلقة. ولا فقرةٌ فارغةٌ حين لا شيء يقال */
    const topNote = reasonAr ?? (!c.open ? GRANT_CLOSED_AR : c.soldOut ? GRANT_SOLD_OUT_AR : null);
    /* آخرُ يومٍ قصيرا («7 نوفمبر») — لسطر ما يخسره إن تأخّر */
    const lastDayShort = c.closesAt ? cohortDayAr(new Date(new Date(c.closesAt).getTime() - 1), { day: "numeric", month: "long" }) : null;
    /* وتحت «ما ستخرج به»: لقاءاتُها كلُّها ومدرّبوها وشهادتُها — ما يأخذه لا ما يدفعه */
    const chosenMeetings = chosen.reduce((n, x) => n + (x.sessions?.length ?? 0), 0);
    const chosenTrainers = new Set(chosen.map((x) => x.trainer?.id).filter(Boolean)).size;
    const outcomeExtras = [
      chosenMeetings > 0 ? grantSessionsAr(chosenMeetings) : null,
      chosenTrainers > 0 ? grantTrainersAr(chosenTrainers) : null,
      GRANT_GAINS_AR.find((g) => g.id === "certificate")?.title ?? null,
    ].filter(Boolean).join(" · ");
    /* بطاقةُ الدورة — في المختارات فوق وفي أقسام المجالات تحتها، ولا يُعاد اسمُ المجال تحت قسمه. وصورةُ مدرّبها أوّلُ ما يُرى، وبكبرها — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «اجعل صورةَ المدرّب
       هي الشيءَ الذي يراه الشخص، بتصميمٍ يبيّن الصورةَ بحجمٍ كبيرٍ عصريّ». والشاراتُ وسومٌ نصّيّةٌ أعلاها لا أقراصٌ تُشبه
       الأزرار («نقترحها لك يبدو زرّا»)، والسعرُ قيمتان بلا «قبل المنحة/بعد المنحة»: ما يدفعه كبيرا، وأصلُه مشطوبا */
    const row = (x: GrantCourse, inSection = false) => {
      const on = picked.includes(x.courseId);
      const full = !on && picked.length >= max;
      const seats = seatsLeftAr(x.seatsLeft);
      const tag = ours.has(x.courseId) ? "نقترحها لك" : fits(x) > 0 ? "يناسب ما تريد تطويره" : null;
      const sum = x.summary ?? null;
      /* و«نبذة» لأهدافها ولمن هي — وعدُها ظاهرٌ فوقُ، فلا نبذةَ إن لم يكن لها غيرُه */
      const more = !!sum && (sum.goalsAr.length > 0 || !!sum.audienceAr);
      const open = more && summaryOf === x.courseId;
      const meetings = x.sessions?.length ?? 0;
      const pay = grantPrice(x.price, pct);
      const perMeeting = grantPerSession(pay, meetings);
      const sumId = `sum-${x.courseId}`;
      /* وتعارضُها مع ما اختاره قبلها — يُقال فورَ اختيارها، ولا يمنعه */
      const clash = on ? grantClashAr(x, chosen.slice(0, chosen.findIndex((c) => c.courseId === x.courseId))) : null;
      /* الصفُّ كلُّه يختار — والسهمُ خارجَ وسمه، فنبذتُه تُفتح ولا تختار. ولا رابطَ فيه إلى الموقع: قرارُ صاحب المنصّة
         (٢٧ أكتوبر ٢٠٢٦): «عند النقر على الدورات لشرائها لا يجب أن تأخذ النقرةُ العميلَ إلى صفحة الموقع» */
      return (
        <Inset key={x.courseId} tone={on ? "accent" : "default"} interactive={!full} className={full ? "opacity-50" : ""}>
          <label className="flex cursor-pointer items-start gap-4">
            {/* والاختيارُ على الصورة نفسِها — يُرى ويُضغط معها */}
            <span className="relative shrink-0">
              {x.trainer?.photoUrl
                ? <img src={x.trainer.photoUrl} alt="" loading="lazy" className="h-24 w-24 rounded-2xl object-cover shadow-lg sm:h-28 sm:w-28" />
                : <span className="grid h-24 w-24 place-items-center rounded-2xl bg-teal/10 text-teal-light-ink sm:h-28 sm:w-28"><UserRound className="h-10 w-10" aria-hidden="true" /></span>}
              <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(x.courseId)} aria-label={x.titleAr} className="absolute start-2 top-2 h-5 w-5 shadow" />
            </span>
            <span className="min-w-0 flex-1">
              {(tag || seats) && (
                <span className="mb-1 flex flex-wrap items-center gap-x-3">
                  {/* وسمُ «نقترحها لك» أصغرُ وأهدأ من العنوان — قرارُه (٢٧ أكتوبر ٢٠٢٦): «يجب أن تكون أصغر وبخطٍّ أقلّ أهميّةً للنظر» */}
                  {tag && <span className="inline-flex items-center gap-1 text-fine text-muted-foreground"><Sparkles className="h-3 w-3 text-gold-ink" aria-hidden="true" />{tag}</span>}
                  {seats && <span className="inline-flex items-center gap-1 text-read font-bold text-red-300"><Flame className="h-3.5 w-3.5" aria-hidden="true" />{seats}</span>}
                </span>
              )}
              <span className="block font-bold leading-6">{x.titleAr}</span>
              {x.trainer && <span className="mt-0.5 block text-read font-bold text-teal-light-ink">مع {x.trainer.name}</span>}
              {/* وما يخرج به أوّلَ ما يُقرأ بعد اسمها ومدرّبها — لا وراء «نبذة» (٣١ أكتوبر ٢٠٢٦): الناسُ يشترون ما سيقدرون عليه لا عنوانا */}
              {sum?.aboutAr && (
                <span className="mt-1 flex items-start gap-1.5 text-read leading-6">
                  <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />{sum.aboutAr}
                </span>
              )}
              {/* وعددُ لقاءاتها المباشرة — ووقتُه بجانب سعره، فيصغر المبلغُ أمام ما يأخذه */}
              <span className="mt-0.5 block text-read text-muted-foreground">{x.domainAr && !inSection ? `${x.domainAr} · ` : ""}تبدأ {cohortDayAr(x.startsAt)} · {meetings > 0 ? `${grantSessionsAr(meetings)} على Zoom` : "مباشرة على Zoom"}</span>
              <span className="mt-2 flex flex-wrap items-baseline gap-x-2">
                <bdi dir="ltr" className="text-lg font-black">{money(pay)}</bdi>
                {pct > 0 && <bdi dir="ltr" className="text-read text-muted-foreground line-through">{money(x.price)}</bdi>}
                {perMeeting !== null && <span className="text-read text-muted-foreground">· <bdi dir="ltr">{money(perMeeting)}</bdi> للقاء</span>}
              </span>
              {clash && (
                <span role="status" className="mt-2 flex items-start gap-1.5 text-read font-bold leading-6 text-gold-ink">
                  <TriangleAlert className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{clash}
                </span>
              )}
            </span>
          </label>
          {sum && more && (
            <>
              <button
                type="button" aria-expanded={open} aria-controls={sumId} onClick={() => setSummaryOf(open ? null : x.courseId)}
                className="mt-2 flex min-h-9 w-full cursor-pointer items-center justify-center gap-1.5 border-t border-border pt-2 text-read text-muted-foreground"
              >
                {open ? "إخفاء النبذة" : "نبذة عن الدورة"}
                <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {open && (
                <div id={sumId} className="mt-1 space-y-3 text-read leading-6">
                  {sum.goalsAr.length > 0 && (
                    <div>
                      <p className="font-bold">أهدافها</p>
                      <ul className="mt-1 space-y-1">
                        {sum.goalsAr.map((g) => (
                          <li key={g} className="flex items-start gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />{g}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {sum.audienceAr && <p><span className="font-bold">لمن هي: </span>{sum.audienceAr}</p>}
                  {/* و«المزيد» بطلبه وحدَه، في نافذةٍ جديدة — فلا يضيع ما اختاره */}
                  <a href={`/build/${encodeURIComponent(x.courseId)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground underline">
                    المزيد عن الدورة<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              )}
            </>
          )}
        </Inset>
      );
    };
    return (
      <Shell {...shell}>
        {/* صندوقُ الكود — عمودٌ واحدٌ في الوسط: الكودُ ثمّ العدّادُ وآخرُ يومٍ والحدّ، وتحتها سطرٌ صغيرٌ بما يحصل عليه.
            قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦): «تنتهي المنحة بعد… وآخر يوم واختر حتى ٤ يجب أن تكون في المنتصف،
            وأسفلها سطرٌ صغير». وكان عمودين على الحاسوب، وما يحصل عليه قائمةٌ بأيقونات (٢٤ أكتوبر) */}
        <Card tone="accent" className="text-center">
          {stored.code ? (
            <>
              <p className="flex items-center justify-center gap-1.5 text-read text-muted-foreground">
                <Gift className="h-4 w-4 text-gold-ink" aria-hidden="true" /> كود منحتك
              </p>
              <p className="mt-1 flex items-center justify-center gap-2 text-2xl font-black" dir="ltr">
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
          {/* وصاحبُ الكود بعد يومها الأخير يُقال له إنّها أُغلقت — فلا يظنّ كودَه يُخصم عند الدفع */}
          {(stored.code || stored.sentTo) && !c.open && <p className="mt-2 text-read font-bold">{GRANT_CLOSED_AR}</p>}
          {/* والعدّادُ والحدُّ والهديّةُ لمن له منحةٌ يستعملها — ومن نفدت عنه لا يُقال له «تنتهي بعد يومين» ولا «أهدِها» (٢٨ أكتوبر ٢٠٢٦) */}
          {grantOn && c.closesAt && <GrantCountdown closesAt={c.closesAt} className="mt-3" />}
          {/* وحدُّها جملةٌ واحدةٌ تحت «آخر يوم» — قرارُه (٢٤ أكتوبر ٢٠٢٦). وهو حدٌّ يحرس قيمتَها: «اختر ٤ دوراتٍ بحدٍّ أقصى» */}
          {grantOn && <p className="mt-0.5 text-read text-muted-foreground">{grantLimitAr(max)}</p>}
          {/* وما يحصل عليه سطرٌ صغيرٌ تحت خطٍّ رفيع، بأيقونةٍ قبل كلّ بند — قرارُه (٢٧ أكتوبر ٢٠٢٦): «ضع أيقوناتٍ للمباشر وغيرها
              في نفس السطر.. تكون عصريّة». وكلُّ بندٍ لا ينقسم بين سطرين على الهاتف */}
          <p className="mx-auto mt-3 flex max-w-lg flex-wrap justify-center gap-x-4 gap-y-1 border-t border-border pt-3 text-read leading-6 text-muted-foreground">
            {GRANT_GAINS_AR.map((g) => {
              const Icon = GAIN_ICON[g.id];
              return (
                <span key={g.id} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Icon className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />{g.title}
                </span>
              );
            })}
          </p>
        </Card>

        <h2 className="mt-6 text-xl font-black">
          اختر دوراتك{view.termAr && <span className="text-read font-normal text-muted-foreground"> · {view.termAr}</span>}
        </h2>
        {suggested.length > 0 && (
          <p className="mt-2 text-read">
            {/* «لا تتعارض» قولٌ يُقاس: يُقال حين لكلِّ مقترحةٍ لقاءاتٌ معتمَدة، وإلّا فـ«تناسبك» وحدَها */}
            نقترح لك {coursesAr(suggested.length)} تناسبك{timedSuggested ? " ولا تتعارض مواعيدها" : ""}.{suggested.length > max && ` اختر منها حتى ${max}.`}
          </p>
        )}

        {view.openCourses.length === 0 ? (
          <Card as="p" className="mt-5 text-read text-muted-foreground">لا دورات متاحة الآن. تواصل مع مستشار ليقترح عليك.</Card>
        ) : (
          <>
            {top.length > 0 && <div className="mt-5 space-y-3">{top.map((x) => row(x))}</div>}
            {/* والباقي أقسامٌ مطويّةٌ بمجالها — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «الدوراتُ كثيرةٌ وتحيّر الشخص».
                ثمّ (٢٧ أكتوبر ٢٠٢٦): «التصميمُ سطحيٌّ… لا أزرارا متكدّسةً وراء بعضها… ادمج كلَّ جزئين». فبطاقةٌ واحدةٌ هادئة،
                أقسامُها مدموجةٌ (`GRANT_SECTION_GROUPS`) بينها خطوطٌ رفيعة، وفي كلّ قسمٍ وجوهُ مدرّبيه وعددُ دوراته */}
            {sections.length > 0 && (
              <Card className="mt-6">
                {top.length > 0 && <p className="mb-1 font-bold">ويمكنك اختيار دورات أخرى من المجالات التالية</p>}
                <div className="divide-y divide-border">
                  {sections.map((sec) => {
                    const mineHere = sec.items.filter((x) => picked.includes(x.courseId)).length;
                    /* وجهُ كلِّ مدرّبٍ مرّةً — ومن درّس دورتين في القسم لا يتكرّر */
                    const faces = [...new Map(sec.items.filter((x) => x.trainer?.photoUrl).map((x) => [x.trainer!.id, x])).values()].slice(0, SECTION_FACES);
                    return (
                      <details key={sec.domain} className="group py-3 last:pb-0">
                        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                          {faces.length > 0 && (
                            <span className="flex shrink-0 -space-x-2 rtl:space-x-reverse" aria-hidden="true">
                              {faces.map((x) => <img key={x.courseId} src={x.trainer!.photoUrl!} alt="" loading="lazy" className="h-8 w-8 rounded-full object-cover object-[50%_25%] ring-2 ring-paper" />)}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold leading-6">{sec.domain}</span>
                            <span className="block text-read text-muted-foreground">{grantCountAr(sec.items.length)}</span>
                          </span>
                          {mineHere > 0 && <Chip tone="accent">اخترت {mineHere}</Chip>}
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
                        </summary>
                        <div className="mt-3 space-y-3">{sec.items.map((x) => row(x, true))}</div>
                      </details>
                    );
                  })}
                </div>
              </Card>
            )}
            {picked.length >= max && <p className="mt-2 text-read text-muted-foreground">وصلت الحد: {max} دورات. احذف دورة لتضيف غيرها.</p>}
          </>
        )}

        {/* «ما ستخرج به» من الدورات التي اختارها — بوعد كلٍّ منها، وعددِ لقاءاتها ومدرّبيها وشهادتها (٣١ أكتوبر ٢٠٢٦).
            بطاقةٌ غيرُ عالقة: اللوحُ العالقُ تحتها يبقى قصيرا على الهاتف */}
        {chosen.length > 0 && (
          <Card className="mt-6">
            <p className="font-black">{GRANT_OUTCOMES_TITLE_AR}</p>
            <ul className="mt-2 space-y-2 text-read leading-6">
              {chosen.map((x) => (
                <li key={x.courseId} className="flex items-start gap-2">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
                  <span><span className="font-bold">{grantShortTitleAr(x.titleAr)}</span>{x.summary?.aboutAr ? `: ${x.summary.aboutAr}` : ""}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-border pt-3 text-read text-muted-foreground">{outcomeExtras}</p>
          </Card>
        )}
        {chosen.length > 0 && (
          <Card tone="solid" className="sticky bottom-3 mt-4 text-center shadow-lg">
            {/* ما يدفعه كبيرا، وقيمةُ منحته صغيرةً تحته — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦). والمبالغُ معزولةٌ فلا تنقلب */}
            <p className="text-lg font-black">
              {grantCountAr(chosen.length)} بـ<bdi dir="ltr">{money(payTotal)}</bdi>{" "}
              {grantOn && <span className="text-read font-normal text-muted-foreground">بدل <bdi dir="ltr" className="line-through">{money(listTotal)}</bdi></span>}
            </p>
            {/* وقيمةُ المنحة وما بقي منها لمن له منحةٌ يستعملها — ومن لا منحةَ له يرى ما يدفعه وزرَّ الشراء وحدَهما */}
            {grantOn && (
              <>
                <p className="mt-0.5 text-read text-muted-foreground">{GRANT_VALUE_AR} <bdi dir="ltr">{money(listTotal - payTotal)}</bdi> {GRANT_VALUE_PAID_AR}</p>
                {/* وما يخسره إن تأخّر — أقوى ممّا يوفّره (٣١ أكتوبر ٢٠٢٦) */}
                {lastDayShort && <p className="mt-0.5 text-read text-muted-foreground">{grantUntilAr(lastDayShort)}</p>}
                {/* وما بقي له ضمن منحته — فلا يترك منها شيئا (قرارُه: «اختر ٤ دوراتٍ بحدٍّ أقصى») */}
                <p className="mt-1 text-read font-bold text-gold-ink">{grantRemainingAr(chosen.length, max)}</p>
              </>
            )}
            <Button tone="confirm" className="mt-3 w-full" onClick={pay}>{grantOn ? "احصل على المنحة" : "اشتر الدورات"}</Button>
          </Card>
        )}

        {/* الإهداءُ صندوقٌ وحدَه خارجَ لوح الدفع — قرارُ صاحب المنصّة (٢٤ أكتوبر ٢٠٢٦): «صندوقُ الإهداء يكون خارجَ صندوق
            الدفع، واجعل الكلمة: يحقّ لك أن تهدي هذه المنحة لأصدقائك (بحدٍّ أعلى ٣)». رسالةٌ جاهزةٌ في واتساب والبريد، فالصديقُ
            يأخذ منحتَه لا كودَك (`grantShareAr`). ولمن له منحةٌ يستعملها وحدَه: من نفدت عنه لا يُهدي ما لا يأخذه صديقُه */}
        {grantOn && (
          <Card className="mt-6 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold/10"><Gift className="h-6 w-6 text-gold-ink" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-black">{GRANT_GIFT_AR.title}</span>
              <span className="block text-read text-muted-foreground">{GRANT_GIFT_AR.limit}، برسالة جاهزة ترسلها بضغطة.</span>
            </span>
            <span className="flex shrink-0 gap-2">
              <Button as="a" href={waShare(shareText)} target="_blank" rel="noreferrer" icon={Share2}>واتساب</Button>
              <Button as="a" href={grantShareMailto(shareLink, c.percentOff, lastDayLong, !forInfluencer)} icon={Mail}>البريد</Button>
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
              initialMode="signup" source="grant_checkout" verifyLater
              message="أنشئ حسابك لتدفع. فيه تجد دوراتك ومواعيدها."
              prefill={{ name: stored.name, email: stored.email }}
              onDone={() => { setSignedIn(true); setAuthOpen(false); setBuyOpen(true); }}
            />
          </Modal>
        )}
        <ResumeCheckout ready={resumed !== null && seeded && chosen.length > 0} onResume={() => (authed ? setBuyOpen(true) : setAuthOpen(true))} />
        {buyOpen && (
          <BuyPanel
            /* ويُعاد بنيانُه حين يصل الكودُ بعد فتحه — فيُسعَّر بمنحته لا بدونها */
            key={stored.code ?? "no-code"}
            title={BUY_TITLE_AR}
            email={session?.email ?? stored.email}
            kind="courses"
            initialCoupon={stored.code ?? ""}
            grantPayTotal={grantOn ? payTotal : undefined}
            lines={chosen.map((x) => ({ courseId: x.courseId, name: x.titleAr, cohortId: x.cohortId }))}
            onClose={() => setBuyOpen(false)}
          />
        )}
      </Shell>
    );
  }

  /* ─── الخطوة ١: النموذج — قليلٌ هادئ ─── */
  const ready = form.fullName.trim().length >= 2 && form.phone.trim().length >= 5 && /\S+@\S+\.\S+/.test(form.email) && form.workField !== ""
    && (!forInfluencer || normalizeInfluencerCode(influencerCode) !== null);
  const domains = [...new Set(view.openCourses.map((x) => x.domainAr).filter((d): d is string => !!d && d !== OTHER_DOMAIN))]
    .sort((a, b) => a.localeCompare(b, "ar"));
  const pickInterest = (d: string) => setInterests((p) => toggleCourse(p, d, GRANT_MAX_INTERESTS));
  const trainers = grantTrainerFaces(view.openCourses);
  return (
    <Shell {...shell}>
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <Gift className="mx-auto h-10 w-10 text-gold-ink" aria-hidden="true" />
          <h1 className="mt-2 text-3xl font-black">{nameAr}</h1>
          {c.open ? (
            <>
              {/* المنحةُ بنسبتها لا بما يبقى عليه — قرارُ صاحب المنصّة (٢٥ أكتوبر ٢٠٢٦): «نقول إنّ المنحة تصل لـ٦٠٪ أفضل من
                  أنّك تدفع ٤٠٪». وكذلك في بريد الكود وبريد التذكير */}
              <p className="mt-3 text-lg font-bold">
                {!forInfluencer
                  ? grantThanksAr(c.percentOff)
                  : view.influencer
                    ? `بدعوة من ${view.influencer.nameAr}، منحتك تصل إلى ${c.percentOff}% من سعر دوراتك.`
                    : `منحتك تصل إلى ${c.percentOff}% من سعر دوراتك.`}
              </p>
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
          {/* كودُ المؤثّر أوّلَ النموذج في منحة المؤثّرين — مكتوبٌ من رابطه، ولازمٌ لمن جاء بلا رابط */}
          {forInfluencer && (
            <label className="grid gap-1 text-read">{influencerCodeLabelAr(view.influencer?.nameAr)}
              <input value={influencerCode} onChange={(e) => setInfluencerCode(e.target.value.toUpperCase())} autoComplete="off" dir="ltr" placeholder="مثلا SARA" className={controlCls} />
            </label>
          )}
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
        {/* وبينها وبين النموذج فوقها والأسئلة تحتها مسافةٌ أوسع — قرارُه (٢٧ أكتوبر ٢٠٢٦): «تزيد المسافات ما بين صور المدربين والبوكس» */}
        {trainers.faces.length >= 3 && (
          <div className="mt-12 text-center">
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
        {/* أسئلةٌ سريعةٌ مطويّة — قرارُ صاحب المنصّة (٢٦ أكتوبر ٢٠٢٦)، والعلّةُ عند `GRANT_FAQ_AR` */}
        {/* وأصغرُ قليلا — قرارُه (٢٧ أكتوبر ٢٠٢٦): «الأسئلة السريعة حاول أن تجعلها أصغر قليلا». فعنوانٌ أصغرُ وحشوةٌ أقلّ وعرضٌ أضيق — والمتنُ أربعة عشر كسائر الصفحات */}
        <div className="mx-auto mt-12 max-w-xl">
          <h2 className="mb-2 text-center text-read font-bold">أسئلة سريعة</h2>
          <div className="space-y-1.5">
            {GRANT_FAQ_AR.map((f) => (
              <Inset as="details" key={f.q} className="group px-3.5 py-2.5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-read font-bold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-1.5 text-read leading-6 text-muted-foreground">{f.a}</p>
              </Inset>
            ))}
          </div>
        </div>
        <p className="mt-6 text-center text-read text-muted-foreground">{GRANT_ACADEMY_LINE_AR}</p>
      </div>
    </Shell>
  );
}

function Shell({
  children, title = MEMBER_GRANT_NAME_AR, path = "/grant", description = "منحة حصرية لقراء وجيز: دورات مباشرة على Zoom بخصم كبير، والمقاعد محدودة.",
}: { children: React.ReactNode; title?: string; path?: string; description?: string }) {
  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <SeoHead title={title} description={description} path={path} />
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-5">
          <Link to="/" className="text-sm font-bold text-foreground">أكاديمية وجيز</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>
    </div>
  );
}

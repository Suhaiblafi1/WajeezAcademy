/* «مسار {الاسم الأوّل}» — صفحةُ المسار الخاصّ `/go/<رمز>` (٥ نوفمبر ٢٠٢٦، وقالبُها ٨ نوفمبر ٢٠٢٦).

   طلبُ صاحب المنصّة: صفحةٌ باسم المتعلّم بدل أن يبدأ رابطُ الحملة من صفحة دورة. فيها دوراتُه وسببُ اختيار كلٍّ منها، ثمّ
   السعرُ قبل المنحة وقيمتُها وما يدفعه وآخرُ يومها، وزرٌّ واحد «أكمل التسجيل» يفتح لوحَ الدفع القائم بالدورات والكود
   نفسيهما ورمزِ من ولّد الرابط. والأرقامُ من الخادم (`/api/public/go/:code` ← `CommerceService.preview`) — لا حسابَ هنا.

   ═══ وبقالب صفحة المسار المعتادة (٨ نوفمبر ٢٠٢٦) ═══
   «تُعرض /go/:token بالقالب نفسه الذي تستخدمه صفحات المسار المعتادة، بكل تفاصيله». فالشريطُ العلويّ وصندوقُ «منظومة
   كاملة» من `PathwayChrome.tsx`، والدوراتُ برحلة `CourseJourney` نفسِها كما في `pages/Pathway.tsx`: صورةُ المدرّب ونبذتُه
   وشارةُ «مباشر»، والمدّةُ والمهارات، وعددُ اللقاءات وأوّلُها بتوقيت عمّان، والتفاصيلُ تُفتح، والشعبُ إن كانت أكثرَ من
   واحدة. والفروقُ وحدَها:
   · العنوانُ «مسار {الاسم الأوّل والأخير} الشخصي» وتحته سطرٌ من مستواه ومجاله ودوراته — آليّان (`privatePathHeadline`).
   · و«سبب اختيارها لك» تحت عنوان كلّ دورةٍ بارزا — السببُ الذي كتبه مولّدُ الرابط (`reasonsProminentLabelAr`).
   · والسعرُ صندوقُه كما كان: الأصليّ، والمنحة، وما يدفعه، و«أكمل التسجيل».
   · و«استبدالها» باقٍ بقاعدة المسار الجاهز (`swapCandidates`)، والبديلُ ممّا يُشترى هذا الموسم. وبعد كلّ استبدالٍ أو
     إضافةٍ أو تبديلِ شعبةٍ يُسأل الخادمُ عن السعر بالكود نفسِه (`/api/public/checkout/preview`، سعرَ الزائر كما في أوّل
     فتح) — وإن قال إنّ الكودَ لا يسع ما صار في السلّة قيل ذلك وتعطّل الزرّ حتّى يعيد دوراتِه. والدفعُ يسعّر من جديد على
     الخادم في كلّ حال.
   · **و«أضف دورة» ما دام على الكود دورات** — قرارُ صاحب المنصّة (٢١ نوفمبر ٢٠٢٦، «Allow adding»)، نسخا لـ«لا أضف دورة»:
     يضيف حتّى ما بقي على كود منحته (`coursesLeft` من الخادم ← `pathAddsLeft`)، ويختفي الزرُّ عند الحدّ. والمرشّحون بقاعدة
     البدائل نفسِها (`addCandidates`). وما أضافه يُحذف، ودوراتُ المستشار تُستبدل ولا تُحذف (`pathCourseRemovable`). وبلا كود
     منحةٍ لا إضافة: لم يُطلب أن يضيف بسعرها الكامل.
   · **والبدائلُ والإضافةُ من دورات صفحة المنحة وحدَها** — قرارُه (٢١ نوفمبر ٢٠٢٦، «Only Black Friday courses»): قائمةُ حملة
     الكود من الخادم (`grantCourseIds` ← `pathCandidatesWithin`)، وبلا كود منحةٍ كلُّ ما يُشترى. ودوراتُ المسار تبقى ولو لم تكن فيها.
   · **والمسارُ العامّ (`/go/BF80`) بلا استبدال، و«أضف دورة» فيه من دورات بلاك فرايدي وحدَها** — قرارُ صاحب المنصّة (٢٢ نوفمبر
     ٢٠٢٦): «اسمح لهم بإضافة دورات، لكن من الدورات الباقية في منحة بلاك فرايدي فقط». يختار من الثلاث ما شاء (واحدةً على الأقلّ)،
     ويضيف ما يسعه كودُه بعد ما اختار (`publicPathAddsLeft`)، والمرشّحون من قائمة الحملة خارجَ الثلاث (`publicPathCandidates`)،
     وما أضافه يُحذف من صندوق الاختيار. والدفعُ بما اختاره وما أضافه (`publicPathBuyIds`).
   · **وبلا حسابٍ يرى المسارَ العامَّ كلَّه إلّا اسمَه، والحسابُ عند الدفع** — قرارُ صاحب المنصّة (٢٣ نوفمبر ٢٠٢٦): «They should
     see everything, and once they click to pay, then create account or sign in if they are not»، نسخا لصندوق «سجل دخولك» أسفلَ
     الصفحة. فالسعرُ بنسبة الحملة من الخادم (`/api/public/go/:code` ثمّ `…/preview` لكلّ اختيار)، و«أضف دورة» والاختيارُ كما لمن
     دخل. و«أكمل التسجيل» يحفظ ما اختاره ثمّ يفتح الدخولَ (`AuthGate`)، فإذا دخل أُعيد المسارُ بكوده من نداء المتعلّم وفُتح لوحُ
     الدفع بالاختيار نفسِه (`payAfterAuth`) — لا يضيع منه شيء.
   · ولا «مسار جاهز يناسبك» ولا «مجّانا لك الآن». والبدائلُ لا تظهر إلّا لمن ضغط «استبدالها» أو «أضف دورة».

   ومن فتح نسخةً قديمةً يُحوَّل إلى الأحدث. والاسمُ الأوّلُ وحدَه يُعرض: لا بريدَ ولا هاتف. ومعاينةُ واتساب معاينةُ الموقع
   نفسُها (`index.html`) — لا اسمَ المتعلّم ولا كودَه. والقاعدةُ في `src/application/commerce/private-path.ts`. */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { CalendarClock, Gift, Layers, Loader2, Plus, Sparkles, UserRound } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { useRealSession, type SessionUser } from "@/services/session";
import { fetchMe } from "@/services/me";
import { rememberBuyLink } from "@/services/buy-link-token";
import { takeEarly } from "@/services/early-fetch";
import { hasCoreCatalog } from "@/data/core-catalog-source";
import { resumedCheckoutFor, savePendingCheckout } from "@/services/pending-checkout";
import type { PendingCheckout } from "@/application/commerce/pending-checkout";
import { useCourseCohorts } from "@/services/cohort-prices";
import { useListedCourses } from "@/services/listed-courses";
import { usePublishedContent } from "@/services/public-content";
import SeoHead from "@/components/SeoHead";
import Modal from "@/components/Modal";
import AuthGate from "@/components/AuthGate";
import BuyPanel from "@/components/BuyPanel";
import ResumeCheckout from "@/components/ResumeCheckout";
import CourseJourney from "@/components/CourseJourney";
import EcosystemNote from "@/components/EcosystemNote";
import SiteFooter from "@/components/SiteFooter";
import { PathwayEcosystemPanel, PathwayTopBar } from "@/components/PathwayChrome";
import { Badge } from "@/components/ui/badge";
import Button from "@/components/ui/Button";
import { Card, Inset } from "@/components/ui/Surface";
import { courseById, courseDomain, courseFullById, courses, pathwayDelivery } from "@/data/courses";
import { fmtMoney } from "@/application/text/format-ar";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { addCandidates, chosenCohorts, swapCandidates } from "@/application/catalog/pathway-swap";
import CohortPicker from "@/components/CohortPicker";
import {
  giftMissingAr, giftRuleAr, goPath, isGoCode, pathAddsLeft, pathSwappable, publicPathAddsLeft, publicPathBuyIds,
  publicPathCandidates, publicPathAddIds, pathCoursePrice, publicPathOf, restoredPublicPath, PUBLIC_PATH_PICK_AR, PUBLIC_PATH_SIGN_IN_AR, pathAddsLeftAr, pathCandidatesWithin, pathCourseRemovable,
  privatePathGrantLabelAr, privatePathHeadline, privatePathPrice, REASON_LABEL_AR, restoredPathCourses,
  type GiftRule, type PathPreviewNumbers, type PrivatePathPrice,
} from "@/application/commerce/private-path";

interface PathView {
  code: string;
  firstName: string;
  nameAr?: string;
  profile?: { workField: string | null; careerLevel: string | null };
  courses: { n: number; courseId: string; cohortId: string; titleAr: string; reasonAr: string | null; trainerName: string | null; firstSessionAt: string | null }[];
  price: PrivatePathPrice | null;
  lastDay: string | null;
  couponCode: string | null;
  unavailable: { titleAr: string; reasonAr: string }[];
  /** كم دورةً يضيفها بكوده — و`null` بلا كود منحة (٢١ نوفمبر ٢٠٢٦) */
  coursesLeft?: number | null;
  /** دوراتُ صفحة منحة الكود — منها وحدَها البدائلُ والإضافة. و`null` بلا كود منحة */
  grantCourseIds?: string[] | null;
  buyLinkToken: string | null;
  /** المسارُ العامّ (`/go/BF80`، ٢٢ نوفمبر ٢٠٢٦): هل يُطلب الدخول، وسطرٌ إن لم يُعطَ كودا */
  publicPath?: { code: string; signIn: boolean; noteAr: string | null };
  /** لماذا لا يسع كودُه دوراتِه كلَّها — فينقص ما اختاره */
  priceProblemAr?: string | null;
  /** الدورةُ المجانيّة وشرطُها (`private-path-gift.ts`) — وسعرُها الأصليّ يُعرض مشطوبا */
  gift?: {
    courseId: string; cohortId: string; titleAr: string; trainerName: string | null; firstSessionAt: string | null;
    listPrice: number; currency: string; rule: GiftRule; minCourses: number; unavailableAr: string | null;
  } | null;
}
type Loaded = { state: "loading" } | { state: "ready"; view: PathView } | { state: "moved"; to: string } | { state: "failed"; messageAr: string };

/** ما يردّه الخادمُ عن سلّةٍ تغيّرت — ممّا تقرؤه الصفحة */
type PreviewReply = PathPreviewNumbers & {
  items: { cohortId: string }[];
  excluded?: { cohortId: string; messageAr: string }[];
  couponError: { code: string; messageAr: string } | null;
};
type Priced =
  | { key: string; state: "loading" }
  | { key: string; state: "ready"; price: PrivatePathPrice | null; problemAr: string | null };

const NOT_FOUND_AR = "هذا الرابط غير صحيح. تأكد من نسخه كاملا، أو اطلب رابطا جديدا من مستشارك.";
const SESSION_AR: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" };
const REPRICE_FAILED_AR = "تعذر تحديث السعر الآن. أعد المحاولة بعد قليل، أو أعد دورات المسار كما كانت.";
const GONE_AR = "إحدى دوراتك لم تعد متاحة للشراء. استبدلها أو أعد دورات المسار كما كانت.";

export default function PrivatePath() {
  const { code: raw = "" } = useParams();
  const code = raw.trim().toUpperCase();
  const [loaded, setLoaded] = useState<Loaded>(() => (isGoCode(code) ? { state: "loading" } : { state: "failed", messageAr: NOT_FOUND_AR }));
  const [resumed] = useState(() => resumedCheckoutFor(goPath(code)));
  /* ═══ والمسارُ العامّ (`/go/BF80`، ٢٢ نوفمبر ٢٠٢٦) يُقرأ بحسابه ═══
     بلا حساب: كلُّ شيءٍ إلّا اسمَه، والدخولُ عند الدفع (٢٣ نوفمبر ٢٠٢٦). ومن دخل من الصفحة نفسِها تُقرأ جلستُه ثانيةً فيُعاد المسارُ باسمه وكودِه */
  const isPublic = publicPathOf(code) !== null;
  const real = useRealSession();
  const [signedIn, setSignedIn] = useState<SessionUser | null>(null);
  const me = signedIn ?? real.user;
  const waitSession = isPublic && !real.checked && !signedIn;
  const asLearner = isPublic && me !== null;

  useEffect(() => {
    if (!isGoCode(code) || waitSession) return;
    let on = true;
    /* والطلبُ بدأ مع الصفحة قبل وصول شيفرتها (`index.html` → `early-fetch.ts`) — يُؤخذ، وما خاب منه يُعاد عاديّا */
    const path = asLearner ? `/api/learner/go/${code}` : `/api/public/go/${code}`;
    const early = isPublic ? undefined : takeEarly(path);
    const request: Promise<PathView | { movedTo: string }> = early
      ? early
        .then((res) => (res.ok ? (res.json() as Promise<PathView | { movedTo: string }>) : Promise.reject(new Error("early"))))
        .catch(() => apiGet<PathView | { movedTo: string }>(path))
      : apiGet<PathView | { movedTo: string }>(path);
    request
      .then((r) => {
        if (!on) return;
        if ("movedTo" in r) { setLoaded({ state: "moved", to: r.movedTo }); return; }
        /* ورمزُ من ولّد الرابط يُحفظ — فيُرسَل مع الشراء ويُنسب الطلبُ إليه (`buyLinkForOrder`) */
        if (r.buyLinkToken) rememberBuyLink(r.buyLinkToken);
        setLoaded({ state: "ready", view: r });
      })
      .catch((e) => { if (on) setLoaded({ state: "failed", messageAr: e instanceof ApiError && e.status !== 404 ? e.message : NOT_FOUND_AR }); });
    return () => { on = false; };
  }, [code, waitSession, asLearner, isPublic]);

  if (loaded.state === "moved") return <Navigate replace to={goPath(loaded.to)} />;
  if (loaded.state === "ready") {
    return (
      <PathPage
        view={loaded.view}
        resumed={resumed}
        session={isPublic ? me : undefined}
        onSignedIn={() => { fetchMe(true).then((r) => { if (r.user) setSignedIn(r.user); }).catch(() => undefined); }}
      />
    );
  }

  return (
    <Frame title="مسارك في أكاديمية وجيز">
      {loaded.state === "loading"
        ? <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>
        : (
          <Card className="p-5 text-center">
            <h1 className="text-xl font-black">رابط لا يفتح</h1>
            <p className="mt-2 text-read text-muted-foreground">{loaded.messageAr}</p>
            <Link to="/" className="mt-4 inline-block text-read font-bold text-teal-light-ink underline">صفحة الأكاديمية</Link>
          </Card>
        )}
    </Frame>
  );
}

function PathPage({ view: v, resumed, session: given, onSignedIn }: {
  view: PathView; resumed: PendingCheckout | null;
  /** جلسةُ المسار العامّ كما قرأها الأعلى — فلا تبقى فارغةً بعد الدخول من الصفحة نفسِها */
  session?: SessionUser | null;
  onSignedIn: () => void;
}) {
  const real = useRealSession();
  const session = given !== undefined ? given : real.user;
  /* المسارُ العامّ: لا استبدال، والمتعلّمُ يختار ما يشتريه من دوراته ويضيف من دورات المنحة (قرارا صاحب المنصّة، ٢٢ نوفمبر ٢٠٢٦).
     و`signIn` زائرٌ بلا حساب: يرى كلَّ شيء، والحسابُ عند الدفع (٢٣ نوفمبر ٢٠٢٦) */
  const isPublic = Boolean(v.publicPath);
  const signIn = Boolean(v.publicPath?.signIn);
  /* ضغط «أكمل التسجيل» قبل أن يدخل — فإذا عاد المسارُ بكوده فُتح لوحُ الدفع بما اختاره */
  const [payAfterAuth, setPayAfterAuth] = useState(false);
  /* والخفيفةُ لا الكاملة (٨ نوفمبر ٢٠٢٦): الرحلةُ تقرأ عنوانَ الوحدة ومخرجَها وساعاتِها لا متونَها — كـ«ابنِ مسارك».
     والكاملةُ ٢ ميغا مضغوطا كانت أكثرَ ما تنتظره الصفحة (`?lite=1` في `public.routes.ts`) */
  const catalogVersion = usePublishedContent({ lite: true });
  const { cohorts, loaded: cohortsLoaded } = useCourseCohorts();
  const listed = useListedCourses();
  /* ═══ ولا بطاقاتٍ مختصرةً ثمّ القالب — هيكلٌ حتّى يصل الكتالوجُ والشعب (٨ نوفمبر ٢٠٢٦) ═══
     شكا صاحبُ المنصّة: «تفتح بطيئا وتُظهر التصميمَ السابق ثمّ الجديد». وكان ما قبل الكتالوج يُعرض بالبطاقة المختصرة
     (`outsideCatalog`) — وهي صورةُ الصفحة الأولى — ثمّ يقفز إلى قالب المسار. فالآن هيكلٌ ساكنٌ بعدد الدورات حتّى يجهزا */
  void catalogVersion;
  const journeyReady = hasCoreCatalog() && cohortsLoaded;
  const [authOpen, setAuthOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);

  /* دوراتُ الرابط وشعبُها كما ولّدها المستشار — ومن خرج ليوثّق بريده وعاد يجد ما استبدله */
  const originalIds = useMemo(() => v.courses.map((c) => c.courseId), [v]);
  const originalPicked = useMemo(() => Object.fromEntries(v.courses.map((c) => [c.courseId, c.cohortId])), [v]);
  const originalKey = v.courses.map((c) => c.cohortId).join();
  /* والعامُّ يعود بما اختاره من الثلاث وما أضافه (`restoredPublicPath`) — وفي السلّة المعروضة الثلاثُ كلُّها ثمّ المضاف */
  const [resumedPublic] = useState(() => (isPublic ? restoredPublicPath(resumed?.intent.courseIds, originalIds, v.coursesLeft) : null));
  const [courseIds, setCourseIds] = useState<string[]>(
    () => (isPublic
      ? [...originalIds, ...(resumedPublic?.added ?? [])]
      : restoredPathCourses(resumed?.intent.courseIds, originalIds.length, v.coursesLeft) ?? originalIds),
  );
  const [picked, setPicked] = useState<Record<string, string>>(() => ({ ...originalPicked, ...(resumed?.cohortByCourse ?? {}) }));
  const [swapForId, setSwapForId] = useState<string | null>(null);
  const reasons = useMemo(
    () => Object.fromEntries(v.courses.flatMap((c) => (c.reasonAr ? [[c.courseId, c.reasonAr] as const] : []))),
    [v],
  );

  /* ═══ وما يختاره من دورات المسار العامّ — واحدةً أو أكثر، وكلُّها أوّلا (٢٢ نوفمبر ٢٠٢٦) ═══ */
  const [chosen, setChosen] = useState<string[]>(() => resumedPublic?.chosen ?? originalIds);
  const addedIds = courseIds.filter((id) => !originalIds.includes(id));
  const buyIds = isPublic ? publicPathBuyIds(originalIds, chosen, addedIds) ?? [] : courseIds;
  const toggle = (id: string) => setChosen((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  /* ═══ والسعرُ بعد كلّ تغيير — من الخادم بالكود نفسِه ═══ */
  const cohortIds = buyIds.map((id) => picked[id]).filter((id): id is string => Boolean(id));
  const key = cohortIds.join();
  /* وما سأله الخادمُ آخرَ مرّة بمفتاحه — فسلّةُ الرابط كما هي سعرُها من فتحه، وسلّةٌ لم يصل جوابُها «نحدث السعر» */
  const [answered, setAnswered] = useState<Extract<Priced, { state: "ready" }> | null>(null);
  useEffect(() => {
    if (key === originalKey || !key) return;
    let on = true;
    /* والزائرُ بلا حساب يُسعَّر بنسبة الحملة بلا كود (`campaignPreview`) — ومن دخل بكوده */
    (signIn
      ? apiPost<PreviewReply>(`/api/public/go/${v.code}/preview`, { cohortIds: key.split(",") })
      : apiPost<PreviewReply>("/api/public/checkout/preview", {
        cohortIds: key.split(","),
        ...(v.couponCode ? { couponCode: v.couponCode } : {}),
        asVisitor: true,
      }))
      .then((r) => {
        if (!on) return;
        const gone = r.items.length < key.split(",").length;
        const problemAr = r.couponError?.messageAr ?? r.excluded?.[0]?.messageAr ?? (gone ? GONE_AR : null);
        setAnswered({ key, state: "ready", price: privatePathPrice(r), problemAr });
      })
      .catch((e) => {
        if (on) setAnswered({ key, state: "ready", price: null, problemAr: e instanceof ApiError && e.status < 500 ? e.message : REPRICE_FAILED_AR });
      });
    return () => { on = false; };
  }, [key, originalKey, v.couponCode, v.code, signIn]);
  const current: Priced = key === originalKey
    ? { key, state: "ready", price: v.price, problemAr: v.priceProblemAr ?? null }
    : answered?.key === key ? answered : { key, state: "loading" };

  /* ═══ و«استبدالها» — بقاعدة المسار الجاهز (`pathway-swap.ts`): ما يُشترى هذا الموسم، وما لا يتعارض أوّلا ═══
     والمرشّحون دوراتُ مسار الدورة المستبدَلة أوّلا ثمّ كلُّ دورةٍ لها شعبة — كما في `pages/Pathway.tsx` */
  const season = listed.state === "ready" ? listed.season ?? null : null;
  const swapChoices = useMemo(() => {
    void catalogVersion;
    if (!swapForId) return [];
    const from = courseById(swapForId);
    const near = from ? courses.filter((c) => c.pathwayId === from.pathwayId) : [];
    const ranked = pathCandidatesWithin(
      [...near, ...courses].map((c) => ({ courseId: c.id, reason_ar: `من مسار «${c.pathwayName}»` })),
      v.grantCourseIds,
    );
    return swapCandidates({
      courseId: swapForId, courseIds, ranked, season,
      cohortsOf: (id) => cohorts.get(id) ?? [],
      picked,
      titleOf: (id) => courseById(id)?.name ?? id,
    });
  }, [swapForId, courseIds, season, cohorts, picked, catalogVersion, v.grantCourseIds]);

  /* ═══ و«أضف دورة» ما دام على الكود دورات (٢١ نوفمبر ٢٠٢٦، «Allow adding») ═══
     العددُ من الخادم (`coursesLeft`)، والمرشّحون بقاعدة البدائل: مسارُ دوراته أوّلا، وما لا يتعارض أوّلا، ومن قائمة منحته */
  const addsLeft = isPublic
    ? publicPathAddsLeft({ coursesLeft: v.coursesLeft, baseCount: originalIds.length, selected: buyIds.length })
    : pathAddsLeft({ coursesLeft: v.coursesLeft, baseCount: originalIds.length, current: courseIds.length });
  const canAdd = addsLeft > 0;
  /* ومفتوحةٌ دائما (٢٢ نوفمبر ٢٠٢٦، «الإضافة غير واضحة.. يجب أن تكون واضحة لهم»): زرٌّ صغيرٌ في آخر الصفحة لا يُرى، فالدوراتُ
     تُعرض بنفسها تحت عنوانٍ يقول ما هي وبكم */
  const addOpen = true;
  const addChoices = useMemo(() => {
    void catalogVersion;
    if (!addOpen || !canAdd) return [];
    const ways = new Set(courseIds.map((id) => courseById(id)?.pathwayId).filter(Boolean));
    const near = courses.filter((c) => ways.has(c.pathwayId));
    const all = [...near, ...courses].map((c) => ({ courseId: c.id, reason_ar: `من مسار «${c.pathwayName}»` }));
    /* والعامُّ من قائمة بلاك فرايدي وحدَها خارجَ دوراته — وبلا قائمةٍ لا شيء */
    const ranked = isPublic
      ? publicPathCandidates(all, publicPathAddIds(publicPathOf(v.code), v.grantCourseIds), courseIds)
      : pathCandidatesWithin(all, v.grantCourseIds);
    return addCandidates({
      courseIds, ranked, season,
      cohortsOf: (id) => cohorts.get(id) ?? [],
      picked,
      titleOf: (id) => courseById(id)?.name ?? id,
      limit: 6,
    }).filter((s) => s.courseId !== v.gift?.courseId);
  }, [addOpen, canAdd, courseIds, season, cohorts, picked, catalogVersion, v.grantCourseIds, v.gift?.courseId, isPublic, v.code]);
  /* ═══ وسعرُ كلّ دورةٍ بجانبها — قبل الخصم مشطوبا وبعده (٢٣ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة: «يجب أن تكون أسعار الدورات
     بجانب كلّ دورة ليعلم الشخص على ماذا سيدفع») ═══ سعرُ شعبتها المختارة أو أولاها، وبنسبة منحته. والدفعُ يسعّر على الخادم */
  const coursePct = v.price?.grantPct ?? 0;
  const priceTag = (id: string) => {
    const list = cohorts.get(id) ?? [];
    const o = list.find((x) => x.id === picked[id]) ?? list[0];
    if (!o) return null;
    const shown = pathCoursePrice(o.amount, coursePct);
    return (
      <span className="shrink-0 text-read" data-testid="course-price">
        {shown.after < shown.before && <bdi dir="ltr" className="text-muted-foreground line-through">{fmtMoney(shown.before, o.currency)}</bdi>}{" "}
        <bdi dir="ltr" className="font-black text-foreground">{fmtMoney(shown.after, o.currency)}</bdi>
      </span>
    );
  };
  /* ═══ وصندوقُ الإضافة — في المسار العامّ تحت اختيار الثلاث: يختار منها ثمّ يضيف (٢٣ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة) ═══ */
  const addBox = addsLeft > 0 && (
    <Card className="mt-4 border-2 border-gold/60 p-4 sm:p-5" data-testid="private-path-add">
      <h2 className="flex items-center gap-2 text-lg font-black">
        <Plus className="h-5 w-5 text-gold-ink" aria-hidden="true" />
        {v.price?.grantPct ? `أضف دورات أخرى بخصم ${v.price.grantPct}%` : "أضف دورات أخرى"}
      </h2>
      <p className="mt-1 text-read text-muted-foreground">{pathAddsLeftAr(addsLeft)}</p>
      <div className="mt-3 grid gap-2">
        {addChoices.map((s) => (
          <div
            key={s.courseId}
            className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5"
          >
            <span className="min-w-0">
              <span className="block text-read font-bold text-foreground">{courseById(s.courseId)?.name ?? s.courseId}</span>
              <span className="mt-0.5 block text-read text-muted-foreground">{s.noteAr}</span>
            </span>
            {priceTag(s.courseId)}
            <Button tone="secondary" size="sm" onClick={() => addCourse(s.courseId, s.cohortId)} aria-label={`أضف ${courseById(s.courseId)?.name ?? s.courseId}`}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> أضف
            </Button>
          </div>
        ))}
        {addChoices.length === 0 && <p className="text-read text-muted-foreground">لا دورة لها شعبة الآن.</p>}
      </div>
    </Card>
  );
  const addCourse = (courseId: string, cohortId: string) => {
    setCourseIds((ids) => (ids.includes(courseId) ? ids : [...ids, courseId]));
    setPicked((prev) => ({ ...prev, [courseId]: cohortId }));
  };
  /* والمضافُ وحدَه يُحذف — وهو ما بعد دورات المسار (الاستبدالُ في مكانه لا يحرّكه) */
  const removableIds = courseIds.filter((_, i) => pathCourseRemovable(i, originalIds.length));
  /* وفي العامّ يُحذف من صندوق الاختيار — فلا رحلةَ تعديلٍ فيه */
  const removeAdded = (id: string) => {
    if (!removableIds.includes(id)) return;
    setCourseIds((ids) => ids.filter((x) => x !== id));
    setPicked((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  /* ═══ والدورةُ المجانيّة (٨ نوفمبر ٢٠٢٦) ═══
     طلبُ صاحب المنصّة: بطاقةٌ مستقلّةٌ بعد دورات المسار — «مجانية»، وسعرُها الأصليّ مشطوبٌ والحاليّ صفر، وسطرٌ بشرطها. وتُضاف
     إلى الدفع بصفرٍ إن تحقّق الشرط، وإلّا لا تُضاف ويُقال كم دورةً تنقصه. وتعارضُ المواعيد يشملها في الاتّجاهين. والحكمُ عند
     الدفع للخادم (`private-path-gift.ts`): هذا عرضٌ لما سيحكم به، لا حساب */
  const gift = v.gift ?? null;
  const [giftCohortId, setGiftCohortId] = useState<string | null>(v.gift?.cohortId ?? null);
  const giftOptions = gift ? cohorts.get(gift.courseId) ?? [] : [];
  const giftChosen = giftOptions.find((o) => o.id === giftCohortId) ?? giftOptions[0] ?? null;
  const giftMissing = gift ? Math.max(0, gift.minCourses - courseIds.length) : 0;
  const giftOn = Boolean(gift && !gift.unavailableAr && giftChosen && giftMissing === 0);
  const giftTimed = giftChosen && gift ? [{ cohortId: giftChosen.id, courseId: gift.courseId, titleAr: gift.titleAr, sessions: giftChosen.sessions }] : [];
  const pathTimed = chosenCohorts(courseIds, (id) => cohorts.get(id) ?? [], picked, (id) => courseById(id)?.name ?? id);

  const changed = courseIds.join() !== originalIds.join() || key !== originalKey;
  const reset = () => { setCourseIds(originalIds); setChosen(originalIds); setPicked(originalPicked); setSwapForId(null); };
  const titleOf = (id: string) => courseFullById(id)?.title ?? v.courses.find((c) => c.courseId === id)?.titleAr ?? id;
  /* ودورةٌ لا يعرفها كتالوجُ الواجهة لا تسقط من الصفحة وهي في السلّة — تُعرض ببطاقتها المختصرة */
  const outsideCatalog = v.courses.filter((c) => courseIds.includes(c.courseId) && !courseFullById(c.courseId));
  const firstStart = v.courses.map((c) => c.firstSessionAt).filter((d): d is string => Boolean(d)).sort()[0] ?? null;
  const delivery = pathwayDelivery(courseById(courseIds[0] ?? "")?.pathwayId ?? "");
  /* العنوانُ والسطرُ تحته — آليّان من دوراته الآن (فيتبدّلان مع «استبدالها») ومن نموذجه (`privatePathHeadline`) */
  const headline = privatePathHeadline({
    name: v.nameAr || v.firstName,
    workField: v.profile?.workField ?? null,
    careerLevel: v.profile?.careerLevel ?? null,
    courses: courseIds.map((id) => ({ courseId: id, titleAr: titleOf(id), domainAr: courseDomain(id) })),
  });

  const ready = current.state === "ready" && current.price !== null && !current.problemAr && buyIds.length > 0;
  const showPrice = Boolean(v.price || changed) && buyIds.length > 0;
  /* بكم غيّر الاستبدالُ ما يدفعه — عن سعر الرابط كما وصل. وصفرٌ حين لم يتغيّر شيء أو لم يصل السعرُ بعد */
  const priceShift = current.state === "ready" && current.price && v.price && current.price.currency === v.price.currency
    ? Math.round((current.price.total - v.price.total) * 100) / 100
    : 0;
  /* هل بطاقةُ السعر على الشاشة الآن — فيختفي الزرُّ الثابتُ ولا يتكرّر الدفعُ مرّتين أمامه */
  const buyRef = useRef<HTMLDivElement>(null);
  const [buyInView, setBuyInView] = useState(false);
  useEffect(() => {
    const el = buyRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setBuyInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [showPrice, journeyReady]);
  const buy = () => {
    if (!ready || current.state !== "ready") return;
    /* يُحفظ ما يشتريه قبل أن يُطلب منه حساب — فإن خرج ليوثّق بريده عاد إلى مساره (`ResumeCheckout`) */
    savePendingCheckout({
      path: goPath(v.code),
      intent: { title: headline.titleAr, amount: current.price?.total ?? 0, kind: "courses", courseIds: buyIds },
      cohortByCourse: Object.fromEntries(buyIds.flatMap((id) => (picked[id] ? [[id, picked[id]]] : []))),
      ...(v.couponCode ? { couponCode: v.couponCode } : {}),
    });
    if (session) setBuyOpen(true);
    else setAuthOpen(true);
  };
  /* ومن دخل من «أكمل التسجيل» في المسار العامّ: يُفتح لوحُ الدفع حين يصل المسارُ بكوده — بما اختاره نفسِه */
  const buyShown = buyOpen || (payAfterAuth && !signIn && session !== null);
  const closeBuy = () => { setBuyOpen(false); setPayAfterAuth(false); };

  return (
    <Frame title={headline.titleAr} user={session?.displayName ?? null}>
      {/* ترويسةُ المسار — بقالب صفحة المسار */}
      <div className="story-fade">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-gold font-black text-on-gold">مسار خاص بك</Badge>
        </div>
        <h1 className="mt-4 text-3xl font-black leading-snug md:text-4xl">{headline.titleAr}</h1>
        <p className="mt-4 max-w-2xl leading-loose text-foreground">{headline.subtitleAr}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-foreground">
            <Layers className="h-3.5 w-3.5 text-teal-light-ink" />
            {courseIds.length === 1 ? "دورة واحدة" : courseIds.length === 2 ? "دورتان" : `${courseIds.length} دورات`}
          </span>
          {firstStart && (
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-foreground">
              <CalendarClock className="h-3.5 w-3.5 text-teal-light-ink" />
              أول لقاء {cohortDayAr(firstStart, { day: "numeric", month: "long" })}
            </span>
          )}
        </div>
      </div>

      {!journeyReady ? (
        <ol className="mt-8 space-y-3" aria-busy="true" aria-label="نجهز دورات مسارك">
          {v.courses.map((c) => (
            <Card as="li" key={c.cohortId} className="h-40 animate-pulse" />
          ))}
        </ol>
      ) : (
        <>
      <CourseJourney
        courseIds={courseIds}
        reasons={reasons}
        reasonsProminentLabelAr={REASON_LABEL_AR}
        cohortHintOneLine
        lean
        extraBusy={giftOn ? giftTimed : undefined}
        delivery={delivery}
        headingLevel="h2"
        showSchedule
        picked={picked}
        onPick={(courseId, cohortId) => setPicked((prev) => ({ ...prev, [courseId]: cohortId }))}
        edit={!pathSwappable(isPublic) ? undefined : {
          swapOnly: true,
          swapForId,
          /* والدورةُ المجانيّةُ لا تُستبدل بها دورةٌ مدفوعة — هي في بطاقتها */
          pool: swapChoices.filter((s) => s.courseId !== gift?.courseId).map((s) => ({ id: s.courseId, name: courseById(s.courseId)?.name ?? s.courseId, note: s.noteAr })),
          introAr: v.coursesLeft
            ? "لك أن تستبدل أي دورة بأخرى، وخاصة التي تتعارض مواعيدها. والسعر يحدث من جديد بعد كل تغيير."
            : "لك أن تستبدل أي دورة بأخرى، وخاصة التي تتعارض مواعيدها. العدد ثابت، والسعر يحدث من جديد بعد الاستبدال.",
          onReset: changed ? reset : undefined,
          minReached: true,
          maxReached: true,
          onSwapToggle: setSwapForId,
          /* والبديلةُ على شعبتها التي لا تتعارض — لا على أقرب شعبها */
          onSwapPick: (oldId, newId) => {
            const cohortId = swapChoices.find((s) => s.courseId === newId)?.cohortId;
            setCourseIds((ids) => ids.map((id) => (id === oldId ? newId : id)));
            setPicked((prev) => {
              const next = { ...prev };
              delete next[oldId];
              if (cohortId) next[newId] = cohortId;
              return next;
            });
            setSwapForId(null);
          },
          removableIds,
          onRemove: (id) => {
            if (!removableIds.includes(id)) return;
            setCourseIds((ids) => ids.filter((x) => x !== id));
            setPicked((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          },
          onAdd: () => undefined,
        }}
      />

      {!isPublic && addBox}

      {outsideCatalog.length > 0 && (
        <ol className="mt-3 space-y-3">
          {outsideCatalog.map((c) => (
            <li key={c.cohortId}>
              <Card className="p-4">
                <h2 className="text-base font-black leading-snug">{c.titleAr}</h2>
                {c.reasonAr && (
                  <Inset tone="warn" className="mt-2.5 px-3 py-2.5">
                    <p className="text-read font-black text-gold-ink">{REASON_LABEL_AR}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-foreground">{c.reasonAr}</p>
                  </Inset>
                )}
                <ul className="mt-2 space-y-1 text-read text-muted-foreground">
                  {c.trainerName && <li className="flex items-center gap-1.5"><UserRound className="h-4 w-4" /> مع {c.trainerName}</li>}
                  {c.firstSessionAt && (
                    <li className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4" /> أول لقاء: {cohortDayAr(c.firstSessionAt, SESSION_AR)} بتوقيت عمان</li>
                  )}
                </ul>
              </Card>
            </li>
          ))}
        </ol>
      )}
        </>
      )}

      {gift && journeyReady && (
        <Card className="mt-4 p-4" data-testid="private-path-gift">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="flex min-w-0 items-start gap-2 text-base font-black leading-snug">
              <Gift className="mt-0.5 h-5 w-5 shrink-0 text-gold-ink" aria-hidden="true" />
              {courseFullById(gift.courseId)?.title ?? gift.titleAr}
            </h2>
            <Badge className="bg-gold font-black text-on-gold">مجانية</Badge>
          </div>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-read">
            {gift.listPrice > 0 && <bdi dir="ltr" className="text-muted-foreground line-through">{fmtMoney(gift.listPrice, gift.currency)}</bdi>}
            <bdi dir="ltr" className="text-lg font-black text-foreground">{fmtMoney(0, gift.currency)}</bdi>
          </p>
          <p className="mt-1 text-read font-bold text-foreground">{giftRuleAr(gift)}</p>
          {gift.unavailableAr ? (
            <p className="mt-1 text-read text-gold-ink">لم تعد متاحة: {gift.unavailableAr}</p>
          ) : giftMissing > 0 ? (
            <p className="mt-1 text-read text-gold-ink" data-testid="private-path-gift-missing">{giftMissingAr(giftMissing)}</p>
          ) : (
            <p className="mt-1 text-read text-teal-light-ink">تضاف إلى طلبك مجانا عند الدفع</p>
          )}
          {!gift.unavailableAr && giftOptions.length > 0 && (
            <div className="mt-3">
              <CohortPicker
                compact
                hintOneLine
                cohorts={giftOptions}
                selectedId={giftChosen?.id ?? null}
                onSelect={setGiftCohortId}
                others={pathTimed}
              />
            </div>
          )}
        </Card>
      )}

      {v.unavailable.length > 0 && (
        <Inset className="mt-3 text-read">
          {v.unavailable.map((u) => <p key={u.titleAr}>«{u.titleAr}» لم تعد متاحة: {u.reasonAr}</p>)}
        </Inset>
      )}

      {/* ═══ المسارُ العامّ: يختار ما يشتريه من دوراته — ولو لم يدخل بعد (٢٢ و٢٣ نوفمبر ٢٠٢٦) ═══ */}
      {isPublic && journeyReady && (
        <Card className="mt-4 p-4" data-testid="public-path-pick">
          <p className="text-read font-bold text-foreground">{PUBLIC_PATH_PICK_AR}</p>
          <div className="mt-3 grid gap-1.5">
            {originalIds.map((id) => (
              <label key={id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-read">
                <input type="checkbox" checked={chosen.includes(id)} onChange={() => toggle(id)} className="h-4 w-4 accent-teal-light" />
                <span className="flex-1 font-bold text-foreground">{titleOf(id)}</span>
                {priceTag(id)}
              </label>
            ))}
          </div>
          {addedIds.length > 0 && (
            <div className="mt-2 grid gap-1.5" data-testid="public-path-added">
              {addedIds.map((id) => (
                <div key={id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-read">
                  <span className="flex-1 font-bold text-foreground">{titleOf(id)}</span>
                  {priceTag(id)}
                  <button type="button" onClick={() => removeAdded(id)} className="font-bold text-teal-light-ink underline-offset-4 hover:underline">
                    احذفها
                  </button>
                </div>
              ))}
            </div>
          )}
          {buyIds.length === 0 && <p className="mt-2 text-read text-gold-ink">اختر دورة واحدة على الأقل من دورات المسار.</p>}
        </Card>
      )}
      {isPublic && journeyReady && addBox}
      {isPublic && v.publicPath?.noteAr && (
        <Inset tone="warn" className="mt-3 text-read" data-testid="public-path-note"><p>{v.publicPath.noteAr}</p></Inset>
      )}

      <PathwayEcosystemPanel compact />

      <p className="mt-8 flex items-center justify-center gap-2 text-center text-read leading-5 text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        منصة الطالب الكاملة (الدورات، الواجبات، المتابعة) تفتح تلقائيا بعد أول دفع ناجح.
      </p>

      {/* السعرُ كاملا: الأصليّ، والمنحة، وما يدفعه — من الخادم. وموضعُه أسفلَ الصفحة بعد «تفتح تلقائيا بعد أول دفع ناجح»
          (صاحب المنصّة، ٨ نوفمبر ٢٠٢٦)، وزرٌّ صغيرٌ ثابتٌ أسفلَ الشاشة يقوم مقامَه حتّى يصله (`private-path-sticky-buy`) */}
      {showPrice && (
        <Card id="buy" ref={buyRef} className="story-fade mt-6 scroll-mt-24 p-5" data-testid="private-path-price">
          {current.state === "loading" ? (
            <p className="flex items-center gap-2 text-read text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> نحدث السعر…</p>
          ) : current.price ? (
            <dl className="space-y-1.5 text-read">
              <div className="flex justify-between"><dt>السعر الأصلي</dt><dd className="line-through text-muted-foreground">{fmtMoney(current.price.before, current.price.currency)}</dd></div>
              {current.price.grant > 0 && (
                <div className="flex justify-between"><dt>{privatePathGrantLabelAr(current.price)}</dt><dd>− {fmtMoney(current.price.grant, current.price.currency)}</dd></div>
              )}
              <div className="flex justify-between text-lg font-black"><dt>{current.price.grant > 0 ? "ما تدفعه بعد المنحة" : "ما تدفعه"}</dt><dd>{fmtMoney(current.price.total, current.price.currency)}</dd></div>
              {priceShift !== 0 && v.price && (
                <p className="text-muted-foreground" data-testid="private-path-price-was">
                  قبل التعديل كان <bdi dir="ltr">{fmtMoney(v.price.total, v.price.currency)}</bdi> — {priceShift > 0 ? "زاد" : "نقص"} <bdi dir="ltr">{fmtMoney(Math.abs(priceShift), current.price.currency)}</bdi>
                </p>
              )}
              {giftOn && gift && (
                <div className="flex justify-between"><dt>{courseFullById(gift.courseId)?.title ?? gift.titleAr}</dt><dd className="font-bold text-teal-light-ink">مجانية</dd></div>
              )}
              {v.lastDay && <p className="pt-1 text-muted-foreground">آخر يوم للمنحة: {cohortDayAr(`${v.lastDay}T12:00:00Z`, { weekday: "long", day: "numeric", month: "long" })}</p>}
            </dl>
          ) : null}
          {current.state === "ready" && current.problemAr && (
            <Inset tone="warn" className="mt-3 text-read" data-testid="private-path-problem">
              <p>{current.problemAr}</p>
              {changed && (
                <button type="button" onClick={reset} className="mt-1.5 font-bold text-teal-light-ink underline-offset-4 hover:underline">
                  أعد دورات المسار كما كانت
                </button>
              )}
            </Inset>
          )}
          <Button tone="confirm" className="mt-4 w-full" onClick={buy} disabled={!ready}>أكمل التسجيل</Button>
        </Card>
      )}


      {/* ═══ زرُّ الدفع صغيرٌ ثابتٌ على الشاشة (٨ نوفمبر ٢٠٢٦) ═══
          قرارُ صاحب المنصّة: «اجعل خانةَ الدفع كزرٍّ صغيرٍ ثابتٍ على الشاشة، ويُعاد إيجادُه بعد جملة فتح المنصّة بالأسفل».
          فما يدفعه وزرُّ الشراء ثابتان أسفلَ الشاشة، ويختفيان حين تظهر بطاقةُ السعر نفسُها فلا يتكرّران. وما
          لم يجهز سعرُه (يُحدَّث، أو فيه مشكلة) ينقله الزرُّ إلى البطاقة حيث يُقال السبب */}
      {showPrice && !buyInView && !buyShown && !authOpen && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" data-testid="private-path-sticky-buy">
          <div className="pointer-events-auto mx-auto flex max-w-sm items-center justify-between gap-3 rounded-full border border-white/15 bg-paper/95 py-1.5 pe-1.5 ps-5 shadow-xl backdrop-blur">
            <span className="min-w-0 text-read leading-5">
              {current.state === "ready" && current.price ? (
                <>
                  {/* قبلُ وبعدُ (٨ نوفمبر ٢٠٢٦): «اجعل السعرَ يظهر قبل وبعد مع شطب السعر الأصليّ.. ليعلم ما التغيير في السعر
                      إن غيّر شيئا، وليعلم أنّ السعرَ بعد المنحة». فالأصليُّ مشطوبٌ بجانب ما يدفعه، وفوقهما «بعد {المنحة}»،
                      وإن غيّر الاستبدالُ السعرَ قيل بكم (`priceShift`) */}
                  <span className="block text-muted-foreground">{current.price.grant > 0 ? `بعد ${current.price.grantNameAr ?? "الخصم"}` : "ما تدفعه"}</span>
                  <span className="flex flex-wrap items-baseline gap-x-1.5">
                    {current.price.grant > 0 && (
                      <bdi dir="ltr" className="text-muted-foreground line-through">{fmtMoney(current.price.before, current.price.currency)}</bdi>
                    )}
                    <bdi dir="ltr" className="text-base font-black text-foreground">{fmtMoney(current.price.total, current.price.currency)}</bdi>
                    {priceShift !== 0 && (
                      <bdi dir="ltr" className={`font-bold ${priceShift > 0 ? "text-gold-ink" : "text-teal-light-ink"}`} data-testid="private-path-price-shift">
                        {priceShift > 0 ? "+" : "−"}{fmtMoney(Math.abs(priceShift), current.price.currency)}
                      </bdi>
                    )}
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> نحدث السعر…</span>
              )}
            </span>
            <Button
              tone="confirm"
              size="sm"
              onClick={ready ? buy : () => document.getElementById("buy")?.scrollIntoView({ behavior: "smooth", block: "center" })}
              disabled={current.state === "loading"}
            >
              أكمل التسجيل
            </Button>
          </div>
        </div>
      )}
      {showPrice && <div aria-hidden="true" className="h-20" />}

      <ResumeCheckout ready={resumed !== null} onResume={() => (session ? setBuyOpen(true) : setAuthOpen(true))} />

      {authOpen && (
        <Modal onClose={() => setAuthOpen(false)} label="التسجيل قبل الدفع" panelClassName="w-full max-w-md">
          <Inset tone="solid">
            <p className="mb-4 text-center text-sm">{signIn ? PUBLIC_PATH_SIGN_IN_AR : "خطوة واحدة قبل الدفع: حساب يحفظ مسارك وشهاداتك."}</p>
            <AuthGate
              onDone={() => {
                setAuthOpen(false);
                if (signIn) { setPayAfterAuth(true); onSignedIn(); } else setBuyOpen(true);
              }}
              initialMode="signup"
              source={isPublic ? "public_path" : "private_path_checkout"}
              verifyLater
            />
          </Inset>
        </Modal>
      )}
      {buyShown && (
        <BuyPanel
          title={headline.titleAr}
          email={session?.email ?? ""}
          kind="courses"
          initialCoupon={v.couponCode ?? ""}
          lines={[
            ...buyIds.map((id) => ({ courseId: id, name: titleOf(id), cohortId: picked[id] })),
            /* والمجانيّةُ في الطلب إن تحقّق شرطُها — والخادمُ يسعّرها بصفرٍ برمز الرابط ويحكم ثانيةً (`private-path-gift.ts`) */
            ...(giftOn && gift && giftChosen ? [{ courseId: gift.courseId, name: courseFullById(gift.courseId)?.title ?? gift.titleAr, cohortId: giftChosen.id }] : []),
          ]}
          onClose={closeBuy}
        />
      )}
    </Frame>
  );
}

/** إطارُ صفحة المسار: شريطُها وحاويتُها وختامُها — كما في `pages/Pathway.tsx` */
function Frame({ children, title, user = null }: { children: React.ReactNode; title: string; user?: string | null }) {
  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      {/* لا يُفهرس: صفحةٌ باسم إنسانٍ لا تُعرض في محرّكات البحث */}
      <SeoHead title={title} description="مسارك في أكاديمية وجيز" path="/go" noindex />
      <PathwayTopBar user={user} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-5 sm:py-12">{children}</div>
      <EcosystemNote className="mx-auto max-w-5xl px-5 pb-8" />
      <SiteFooter />
    </div>
  );
}

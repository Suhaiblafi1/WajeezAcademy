/* «مسار {الاسم الأوّل}» — صفحةُ المسار الخاصّ `/go/<رمز>` (٥ نوفمبر ٢٠٢٦).

   طلبُ صاحب المنصّة: صفحةٌ باسم المتعلّم بدل أن يبدأ رابطُ الحملة من صفحة دورة. فيها دوراتُه مرقّمةً — اسمُها وسببُ اختيارها
   ومدرّبُها وأوّلُ لقائها بتوقيت عمّان ورابطٌ صغيرٌ لتفاصيلها — ثمّ السعرُ قبل المنحة وقيمتُها وما يدفعه وآخرُ يومها، وزرٌّ
   واحد «أكمل التسجيل» يفتح لوحَ الدفع القائم بالدورات والكود نفسيهما ورمزِ من ولّد الرابط. ولا اقتراحَ لغيرها، ولا
   «ابنِ مسارك». والأرقامُ من الخادم (`/api/public/go/:code` ← `CommerceService.preview`) — لا حسابَ هنا.

   ومن فتح نسخةً قديمةً يُحوَّل إلى الأحدث. والاسمُ الأوّلُ وحدَه يُعرض: لا بريدَ ولا هاتف. ومعاينةُ واتساب معاينةُ الموقع
   نفسُها (اسمُ الأكاديميّة وشعارُها في `index.html`) — لا اسمَ المتعلّم ولا كودَه. والقاعدةُ في
   `src/application/commerce/private-path.ts`. */

import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { CalendarClock, Loader2, UserRound } from "lucide-react";
import { apiGet, ApiError } from "@/services/api";
import { useRealSession } from "@/services/session";
import { rememberBuyLink } from "@/services/buy-link-token";
import { resumedCheckoutFor, savePendingCheckout } from "@/services/pending-checkout";
import SeoHead from "@/components/SeoHead";
import Modal from "@/components/Modal";
import AuthGate from "@/components/AuthGate";
import BuyPanel from "@/components/BuyPanel";
import ResumeCheckout from "@/components/ResumeCheckout";
import Button from "@/components/ui/Button";
import { Card, Inset } from "@/components/ui/Surface";
import { fmtMoney } from "@/application/text/format-ar";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { goPath, GO_CODE_RE } from "@/application/commerce/private-path";

interface PathView {
  code: string;
  firstName: string;
  courses: { n: number; courseId: string; cohortId: string; titleAr: string; reasonAr: string | null; trainerName: string | null; firstSessionAt: string | null }[];
  price: { currency: string; before: number; grant: number; grantNameAr: string | null; total: number } | null;
  lastDay: string | null;
  couponCode: string | null;
  unavailable: { titleAr: string; reasonAr: string }[];
  buyLinkToken: string;
}
type Loaded = { state: "loading" } | { state: "ready"; view: PathView } | { state: "moved"; to: string } | { state: "failed"; messageAr: string };

const NOT_FOUND_AR = "هذا الرابط غير صحيح. تأكد من نسخه كاملا، أو اطلب رابطا جديدا من مستشارك.";
const SESSION_AR: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" };

export default function PrivatePath() {
  const { code: raw = "" } = useParams();
  const code = raw.trim().toUpperCase();
  const [loaded, setLoaded] = useState<Loaded>(() => (GO_CODE_RE.test(code) ? { state: "loading" } : { state: "failed", messageAr: NOT_FOUND_AR }));
  const { user: session } = useRealSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [resumed] = useState(() => resumedCheckoutFor(goPath(code)));

  useEffect(() => {
    if (!GO_CODE_RE.test(code)) return;
    let on = true;
    apiGet<PathView | { movedTo: string }>(`/api/public/go/${code}`)
      .then((r) => {
        if (!on) return;
        if ("movedTo" in r) { setLoaded({ state: "moved", to: r.movedTo }); return; }
        /* ورمزُ من ولّد الرابط يُحفظ — فيُرسَل مع الشراء ويُنسب الطلبُ إليه (`buyLinkForOrder`) */
        rememberBuyLink(r.buyLinkToken);
        setLoaded({ state: "ready", view: r });
      })
      .catch((e) => { if (on) setLoaded({ state: "failed", messageAr: e instanceof ApiError && e.status !== 404 ? e.message : NOT_FOUND_AR }); });
    return () => { on = false; };
  }, [code]);

  if (loaded.state === "moved") return <Navigate replace to={goPath(loaded.to)} />;

  if (loaded.state !== "ready") {
    return (
      <Shell title="مسارك في أكاديمية وجيز">
        {loaded.state === "loading"
          ? <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>
          : (
            <Card className="p-5 text-center">
              <h1 className="text-xl font-black">رابط لا يفتح</h1>
              <p className="mt-2 text-read text-muted-foreground">{loaded.messageAr}</p>
              <Link to="/" className="mt-4 inline-block text-read font-bold text-teal-light-ink underline">صفحة الأكاديمية</Link>
            </Card>
          )}
      </Shell>
    );
  }

  const v = loaded.view;
  const buy = () => {
    /* يُحفظ ما يشتريه قبل أن يُطلب منه حساب — فإن خرج ليوثّق بريده عاد إلى مساره (`ResumeCheckout`) */
    savePendingCheckout({
      path: goPath(v.code),
      intent: { title: `مسار ${v.firstName}`, amount: v.price?.total ?? 0, kind: "courses", courseIds: v.courses.map((c) => c.courseId) },
      cohortByCourse: Object.fromEntries(v.courses.map((c) => [c.courseId, c.cohortId])),
      ...(v.couponCode ? { couponCode: v.couponCode } : {}),
    });
    if (session) setBuyOpen(true);
    else setAuthOpen(true);
  };

  return (
    <Shell title={`مسار ${v.firstName}`}>
      <h1 className="text-3xl font-black">مسار {v.firstName}</h1>
      <p className="mt-1 text-read text-muted-foreground">دورات اخترناها لك، مرتبة.</p>

      <ol className="mt-5 space-y-3">
        {v.courses.map((c) => (
          <li key={c.cohortId}>
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-light-ink/15 text-sm font-black text-teal-light-ink">{c.n}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-black leading-snug">{c.titleAr}</h2>
                  {c.reasonAr && <p className="mt-1 text-read">{c.reasonAr}</p>}
                  <ul className="mt-2 space-y-1 text-read text-muted-foreground">
                    {c.trainerName && <li className="flex items-center gap-1.5"><UserRound className="h-4 w-4" /> مع {c.trainerName}</li>}
                    {c.firstSessionAt && (
                      <li className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4" /> أول لقاء: {cohortDayAr(c.firstSessionAt, SESSION_AR)} بتوقيت عمان</li>
                    )}
                  </ul>
                  <Link to={`/build/${encodeURIComponent(c.courseId)}`} className="mt-2 inline-block text-xs font-bold text-teal-light-ink underline">التفاصيل</Link>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      {v.unavailable.length > 0 && (
        <Inset className="mt-3 text-read">
          {v.unavailable.map((u) => <p key={u.titleAr}>«{u.titleAr}» لم تعد متاحة: {u.reasonAr}</p>)}
        </Inset>
      )}

      {v.price && v.courses.length > 0 && (
        <Card className="mt-5 p-4" data-testid="private-path-price">
          <dl className="space-y-1.5 text-read">
            <div className="flex justify-between"><dt>السعر الأصلي</dt><dd className="line-through text-muted-foreground">{fmtMoney(v.price.before, v.price.currency)}</dd></div>
            {v.price.grant > 0 && (
              <div className="flex justify-between"><dt>{v.price.grantNameAr ?? "الخصم"}</dt><dd>− {fmtMoney(v.price.grant, v.price.currency)}</dd></div>
            )}
            <div className="flex justify-between text-lg font-black"><dt>ما تدفعه</dt><dd>{fmtMoney(v.price.total, v.price.currency)}</dd></div>
            {v.lastDay && <p className="pt-1 text-muted-foreground">آخر يوم للمنحة: {cohortDayAr(`${v.lastDay}T12:00:00Z`, { weekday: "long", day: "numeric", month: "long" })}</p>}
          </dl>
          <Button tone="confirm" className="mt-4 w-full" onClick={buy}>أكمل التسجيل</Button>
        </Card>
      )}

      <ResumeCheckout ready={resumed !== null} onResume={() => (session ? setBuyOpen(true) : setAuthOpen(true))} />

      {authOpen && (
        <Modal onClose={() => setAuthOpen(false)} label="التسجيل قبل الدفع" panelClassName="w-full max-w-md">
          <Inset tone="solid">
            <p className="mb-4 text-center text-sm">خطوة واحدة قبل الدفع: حساب يحفظ مسارك وشهاداتك.</p>
            <AuthGate onDone={() => { setAuthOpen(false); setBuyOpen(true); }} initialMode="signup" source="private_path_checkout" verifyLater />
          </Inset>
        </Modal>
      )}
      {buyOpen && (
        <BuyPanel
          title={`مسار ${v.firstName}`}
          email={session?.email ?? ""}
          kind="courses"
          initialCoupon={v.couponCode ?? ""}
          lines={v.courses.map((c) => ({ courseId: c.courseId, name: c.titleAr, cohortId: c.cohortId }))}
          onClose={() => setBuyOpen(false)}
        />
      )}
    </Shell>
  );
}

function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      {/* لا يُفهرس: صفحةٌ باسم إنسانٍ لا تُعرض في محرّكات البحث */}
      <SeoHead title={title} description="مسارك في أكاديمية وجيز" path="/go" noindex />
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-5">
          <Link to="/" className="text-sm font-bold text-foreground">أكاديمية وجيز</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}

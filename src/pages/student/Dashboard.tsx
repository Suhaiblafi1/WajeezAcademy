import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Activity, ArrowLeft, BookOpen, CalendarDays, CalendarPlus, Clock3, Loader2, Target,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import MyAdvisorCard from "@/components/MyAdvisorCard";
import { buildJourney, defaultTrackId, type JourneyPlan, type JourneyTrack } from "@/application/student/journey";
import { usePublishedContent } from "@/services/public-content";
import { useRealSession } from "@/services/session";
import { apiGet } from "@/services/api";
import {
  KIND_LABEL_AR, NO_STREAK_NOTE, buildMomentum, momentumFactsFrom, sinceLabelAr,
  type EvidenceKind, type Momentum,
} from "@/application/student/momentum";
import MyDeadlines from "@/components/MyDeadlines";
import type { NowItem } from "@/components/MyDeadlines";
import { fmtSession } from "@/application/text/format-ar";
import { countAr, type ArCounts } from "@/application/student/deadlines";
import Button from "@/components/ui/Button";

import { Card, Panel } from "@/components/ui/Surface";
import { cohortDayAr, DAY_NUMERIC } from "@/application/learning/cohort-gate";
/* حُذفت خريطة ADVISORS هنا كما حُذفت في صفحة المسار: أسماءُ أشخاصٍ مكتوبةٌ في
   الكود تُعرض للطالب الدافع كأنها مستشارُه المعيَّن. والقاعدة أن لا اسم يُعرض
   كحقيقة قبل توثيقه واعتماده.
   ووُصل الإسنادُ الحقيقيّ (١٩ أكتوبر ٢٠٢٦): بطاقةُ «مستشارك» (`MyAdvisorCard`) تقرأ
   صاحبَ الإسناد النشط على حالته من القاعدة — لا اسمٌ يُنتقى برمز المسار. */

/* ─── أنواع الوضع الحقيقي (مطابقة لاستجابات /api/learner) ─── */
interface RealEnrollment {
  id: string; status: string; createdAt: string;
  cohort: {
    id: string; title: string;
    /* معرّف الدورة من الكتالوج (C-…) — يربط التسجيل بترتيب المسار في ط-٢ */
    course: { id: string; versions: { titleAr: string }[] };
    trainers: { profile: { application: { fullName: string } } }[];
  };
  courseProgress: { percent: number } | null;
  /* الشهاداتُ بشكلها لا `unknown[]`: بناءُ الرحلة يقرأ حالتَها — والفعّالةُ
     دليلُ إنجاز، والملغاةُ ليست دليلا. */
  certificates?: { id: string; number: string; status: string }[];
}
/* إشاراتُ من لا تسجيلَ له — ثلاثةٌ فوق التسجيلات */
interface HeldSeatLite { requestId: string; courseTitleAr: string; cohortTitle: string; startsAt: string | null }
interface OrderLite {
  id: string; status: string; total: string | number; currency: string;
  /* مهلةُ الدفع من الخادم، والعناصرُ بعناوينها لحظةَ الشراء */
  payBy?: string | null; items?: { titleAr: string }[];
}
interface EmptySignals { held: HeldSeatLite[]; unpaid: OrderLite[]; plan: JourneyPlan | null }

interface RealSessionItem {
  id: string; title: string; startsAt: string; endsAt: string | null; status: string;
  zoom: { joinUrl: string; learnerUrl: string | null } | null;
}
interface EnrollmentDetail {
  id: string;
  cohort: {
    title: string;
    sessions: RealSessionItem[];
    assessments: { id: string; title: string; type: string; dueAt: string | null }[];
  };
  /* حقول مؤشر الزخم (ط-٥) — كلها موجودة في الردّ أصلا، ولا نقطة نهاية جديدة */
  attendance?: { sessionId: string; status: string; createdAt?: string }[];
  moduleProgress?: { moduleId: string; status: string; completedAt: string | null }[];
  certificates?: { status: string; issuedAt: string }[];
  submissions: { assessmentId: string; status: string; submittedAt?: string; assessment?: { title?: string } | null }[];
}
interface RealNotif { id: string; title: string; body: string; status: string; sentAt: string | null; queuedAt: string }

const DAY_MS = 86_400_000;
/** لقاءٌ بلا وقتِ نهايةٍ يُعدّ منتهيا بعد ساعتين من بدئه */
const SESSION_ASSUMED_MS = 2 * 3600_000;
const AR_MESSAGES: ArCounts = { one: "رسالة", two: "رسالتان", few: "رسائل", many: "رسالة" };

const greeting = () => (new Date().getHours() < 12 ? "صباح الخير" : new Date().getHours() < 17 ? "طاب يومك" : "مساء الخير");

/** لوحتي — موزّع: جلسة حقيقية بتسجيلات ترى بياناتها الفعلية، وإلا تجربة المحاكاة للديمو */
export default function StudentDashboard() {
  const { user: sessionUser } = useRealSession();
  /* النتيجة موسومة بصاحبها. كان التأثير يبدأ بـsetRows(null) متزامنا عند غياب
     الجلسة — تصيير زائد، وتحذير «setState داخل تأثير». وحذف التصفير وحده كان
     سيترك صفوف مستخدم سابق معروضة لحظة تبديل الحساب، لأن الجلب يستغرق وقتا.
     الوسم يحلّ الاثنين: ما لا يخصّ صاحب الجلسة الحالية يُقرأ null بلا تصفير. */
  const [fetched, setFetched] = useState<{ userId: string; rows: RealEnrollment[] | null } | null>(null);
  const rows = sessionUser && fetched?.userId === sessionUser.userId ? fetched.rows : null;

  /* ── حالةُ من لا تسجيلَ له تُشتقّ من أربعة مصادر لا من واحد ──

     كان الشرطُ يفحص شيئا واحدا: هل يوجد صفُّ تسجيل؟ وهو أضيقُ الإشارات
     المتاحة. فطالبٌ **دفع للتوّ** وعنده مقعدٌ محجوزٌ وطلبٌ مدفوع كان يقرأ
     «حسابك جاهز — بقيت أوّل شعبة». ومن اعتمد خطّةً بعد تشخيصه كان يقرأها
     كذلك، وخطّتُه محفوظةٌ على الخادم لا يراها أحد.

     وكلُّ نداءٍ منها يحتمل الفشلَ وحدَه: فشلُ واحدٍ لا يُفرِّغ اللوحةَ كلَّها،
     بل يُسقط إشارتَه ويبقى ما سواها. */
  const [signals, setSignals] = useState<EmptySignals | null>(null);

  useEffect(() => {
    if (!sessionUser) return;
    const userId = sessionUser.userId;
    let on = true;
    apiGet<RealEnrollment[]>("/api/learner/my-learning")
      .then((r) => { if (on) setFetched({ userId, rows: r }); })
      /* الفشل يُبقي rows على null كما كان قبل الوسم — أي يستمر مؤشر التحميل.
         وهذا سلوك قائم لا أغيّره هنا: تحويله إلى «لا شعب لديك» يكذب على من
         فشل طلبه، وإظهار خطأ صريح تحسينٌ يستحق تغييرا مستقلا لا يُدسّ في
         إصلاح تلويم. */
      .catch(() => { if (on) setFetched({ userId, rows: null }); });
    void Promise.all([
      apiGet<HeldSeatLite[]>("/api/learner/held-seats").catch(() => [] as HeldSeatLite[]),
      apiGet<OrderLite[]>("/api/learner/orders").catch(() => [] as OrderLite[]),
      apiGet<{ plan: JourneyPlan | null }>("/api/learner/plan").catch(() => ({ plan: null })),
    ]).then(([held, orders, planRes]) => {
      if (!on) return;
      setSignals({
        held,
        unpaid: orders.filter((o) => o.status === "pending_payment"),
        plan: planRes.plan,
      });
    });
    return () => { on = false; };
  }, [sessionUser]);

  /* جلسة حقيقية — انتظر الجلب قبل اختيار الوضع، حتى لا تومض المحاكاة لصاحب الحساب */
  if (sessionUser && rows === null) {
    return (
      <PortalLayout title={`${greeting()} يا ${sessionUser.displayName.split(" ")[0]}`}>
        <div className="grid place-items-center py-24"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" /></div>
      </PortalLayout>
    );
  }
  if (sessionUser && rows && rows.length > 0) return <RealDashboard name={sessionUser.displayName} rows={rows} />;
  if (sessionUser && rows) return <EmptyRealDashboard name={sessionUser.displayName} signals={signals} />;
  return <PortalLayout title="لوحتي">{null}</PortalLayout>;
}

/* مؤشر زخم صادق (ط-٥) — آثارك المسجَّلة بتواريخها. لا سلسلة ولا نقاط ولا ترتيب.
   القاعدة معلنة للمتعلم في ذيل البطاقة لا في تعليق كود. */
function MomentumCard({ m, className = "" }: { m: Momentum; className?: string }) {
  const kinds = (Object.keys(m.counted) as EvidenceKind[]).filter((k) => m.counted[k] > 0);
  return (
    <section className={`rounded-3xl border border-white/10 bg-white/[0.03] p-6 ${className}`.trim()}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Activity className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> زخمك
        </h3>
        <p className="text-read text-muted-foreground">آخر {m.windowDays} يوما</p>
      </div>

      <p className="mt-3 text-sm font-black">
        {m.last ? m.last.labelAr : "لا أثر مسجّل بعد"}
      </p>
      <p className="mt-1 text-read leading-5 text-muted-foreground">
        {m.last ? `${KIND_LABEL_AR[m.last.kind]} · ${sinceLabelAr(m.daysSince)}` : "يبدأ الزخم بأول حضور أو تسليم أو وحدة مقرّة"}
      </p>

      {m.countedTotal > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {kinds.map((k) => (
            <li key={k} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-fine text-foreground">
              <span className="tabular-nums font-bold text-teal-light-ink">{m.counted[k]}</span> {KIND_LABEL_AR[k]}
            </li>
          ))}
        </ul>
      ) : (
        <Card as="p" className="mt-4 px-4 py-3 text-read leading-6 text-muted-foreground">
          لا أثر مسجّل في آخر {m.windowDays} يوما.
        </Card>
      )}

      {m.cohortPace && m.cohortPace.total > 0 && (
        <p className="mt-4 border-t border-white/8 pt-3 text-read leading-6 text-muted-foreground">
          إيقاع شعبتك: انتهت{" "}
          <span className="font-bold tabular-nums text-foreground">{m.cohortPace.done}</span> من{" "}
          <span className="tabular-nums">{m.cohortPace.total}</span> جلسة
          <span className="text-muted-foreground"> — جدول الشعبة لا هدف منّا.</span>
        </p>
      )}

      {/* ‎/55 لا ‎/40: الأخيرة تقيس 3.83:1 على سطح البطاقة — والقاعدة المعلنة
          أولى النصوص بأن تُقرأ */}
      <p className="mt-3 text-read leading-5 text-muted-foreground">{NO_STREAK_NOTE}</p>
    </section>
  );
}

/* ═══════════ الوضع الحقيقي — شاشةُ يومه (١٩ أكتوبر ٢٠٢٦) ═══════════

   كانت الرئيسيّةُ تسعةَ ألواح: حلقةُ تقدّم، و«مواعيدي»، و«أين أنت»، و«زخمك»، و«التالي الآن»،
   و«شعبي»، و«جدولي» وفي ذيله «بانتظار تسليمك»، و«أحدث التنبيهات»، وأربعةُ روابطَ سريعة. فاللقاءُ
   نفسُه يُرى مرّتين، والواجبُ مرّتين، والتقدّمُ مرّتين — وطلبٌ لم يكتمل دفعُه لا يُرى أصلا.
   و«بانتظار تسليمك» كان يطالب بمهامَّ لم تُفتح بعد (لا يقرأ `locked`).

   فصارت شاشةَ يومه بقرار صاحب المنصّة في خطّة تبسيط جهة المتعلّم (الخطوة ط):
     ① **ما عليك الآن** — قائمةٌ واحدة، لكلّ سطرٍ زرٌّ واحد (`MyDeadlines`).
     ② **لقاءاتك القادمة** — بعد يومه، ولكلٍّ دعوةُ تقويم.
     ③ **أين أنت من رحلتك** — والتقدّمُ فيها وحدَها.
     ④ مستشارُه، ثمّ «زخمك».
   وما حُذف له موضعُه في القائمة: الشهاداتُ والمهاراتُ في «خزانتي»، والدعمُ والرسائلُ في
   قائمة الحساب، والشعبُ في «تعلّمي». */
function RealDashboard({ name, rows }: { name: string; rows: RealEnrollment[] }) {
  const [details, setDetails] = useState<EnrollmentDetail[] | null>(null);
  const [notifs, setNotifs] = useState<RealNotif[]>([]);
  const [unpaid, setUnpaid] = useState<OrderLite[]>([]);
  /* الخطّةُ المعتمَدة — تدخل في بناء المسار كما تدخل في «رحلتي»، فلا تفترق
     اللوحةُ عن الشاشة التي تُحيل إليها. وفشلُ قراءتها لا يُسقط اللوحة. */
  const [plan, setPlan] = useState<JourneyPlan | null>(null);
  /* آثار ط-٥ من نقاط نهاية قائمة: بطاقات الاسترجاع والقياس البعديّ */
  const [extra, setExtra] = useState<{ retrievalCards: { lastAnswerAt: string | null }[]; remeasures: { measuredAt: string; courseId: string }[]; at: string } | null>(null);

  useEffect(() => {
    let on = true;
    Promise.all(rows.slice(0, 4).map((r) => apiGet<EnrollmentDetail>(`/api/learner/enrollments/${r.id}`).catch(() => null)))
      .then((ds) => { if (on) setDetails(ds.filter((d): d is EnrollmentDetail => d !== null)); });
    apiGet<RealNotif[]>("/api/learner/notifications?audience=learner").then((n) => on && setNotifs(n)).catch(() => undefined);
    /* طلبٌ لم يكتمل دفعُه — ومهلتُه من الخادم (`payBy`)، فما يُقال هو ما يقع */
    apiGet<OrderLite[]>("/api/learner/orders")
      .then((o) => on && setUnpaid(o.filter((x) => x.status === "pending_payment")))
      .catch(() => undefined);
    apiGet<{ plan: JourneyPlan | null }>("/api/learner/plan").then((r) => on && setPlan(r.plan)).catch(() => undefined);
    void (async () => {
      const safe = async <T,>(pr: Promise<T>): Promise<T | null> => pr.then((v) => v).catch(() => null);
      const [ret, grw] = await Promise.all([
        safe(apiGet<{ cards: { lastAnswerAt: string | null }[] }>("/api/learner/retrieval")),
        safe(apiGet<{ records: { measuredAt: string; courseId: string }[] }>("/api/learner/skill-growth")),
      ]);
      if (!on) return;
      /* لحظة القراءة تُحفظ مع البيانات: «قبل كم» يُحسب على وقت الجلب لا على كل رسم */
      setExtra({ retrievalCards: ret?.cards ?? [], remeasures: grw?.records ?? [], at: new Date().toISOString() });
    })();
    return () => { on = false; };
  }, [rows]);

  const momentum = useMemo<Momentum | null>(() => {
    if (!details) return null;
    const facts = momentumFactsFrom(details, {
      retrievalCards: extra?.retrievalCards ?? [],
      remeasures: extra?.remeasures ?? [],
    });
    return buildMomentum(facts, extra ? new Date(extra.at) : new Date());
  }, [details, extra]);

  /* «الآن» يُلتقط مرّةً عند التركيب: قراءةُ `Date.now()` أثناء التصيير استدعاءٌ غيرُ نقيّ
     يمنعه مصرّفُ React، والذاكرةُ لا تُعاد إلّا بتغيّر details فالوقتُ مجمّدٌ عمليّا على أيّ حال. */
  const [now] = useState(() => Date.now());

  /* لقاءاتُ شعبه التي لم تنته — ولقاءٌ بلا آخرَ يُعدّ منتهيا بعد ساعتين من بدئه */
  const sessions = useMemo(() =>
    (details ?? [])
      .flatMap((d) => d.cohort.sessions.map((s) => ({ ...s, cohortTitle: d.cohort.title })))
      .filter((s) => s.status !== "cancelled" && (s.endsAt ? Date.parse(s.endsAt) : Date.parse(s.startsAt) + SESSION_ASSUMED_MS) > now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  [details, now]);
  const todaySessions = sessions.filter((s) => Date.parse(s.startsAt) <= now + DAY_MS);
  const nextSessions = sessions.filter((s) => Date.parse(s.startsAt) > now + DAY_MS).slice(0, 3);

  /* ما عليه الآن من خارج التسليمات: المالُ أوّلا (مقعدٌ يُفرَج عنه بعد مهلته)، ثمّ لقاءٌ في يومه */
  const before: NowItem[] = [
    ...unpaid.map((o): NowItem => ({
      key: `order-${o.id}`, kind: "money",
      titleAr: o.items?.length === 1 ? `لم يكتمل دفع «${o.items[0].titleAr}»` : "طلب لم يكتمل دفعه",
      detailAr: o.payBy ? `ادفع قبل ${fmtSession(o.payBy)}، وبعدها يفرج عن المقعد لغيرك` : "أتمم الدفع أو ألغ الطلب",
      action: { labelAr: "افتح فواتيري", to: "/student/billing" },
    })),
    ...todaySessions.map((s): NowItem => ({
      key: `session-${s.id}`, kind: "session",
      titleAr: s.title,
      detailAr: `${fmtSession(new Date(s.startsAt))} · ${s.cohortTitle}`,
      action: s.zoom
        ? { labelAr: "ادخل اللقاء", href: s.zoom.learnerUrl ?? s.zoom.joinUrl, newTab: true }
        : { labelAr: "أضفه لتقويمك", href: `/api/calendar/cohort-sessions/${s.id}.ics` },
    })),
  ];
  const unread = notifs.filter((n) => n.status !== "read");
  const after: NowItem[] = unread.length > 0
    ? [{
        key: "inbox", kind: "inbox",
        titleAr: `${countAr(unread.length, AR_MESSAGES)} لم تقرأها`,
        detailAr: unread[0].title,
        action: { labelAr: "افتح الرسائل", to: "/student/inbox" },
      }]
    : [];

  /* موضعُه من رحلته — من المملوك والخطّة، لا من لقطة تشخيصٍ في المتصفّح.

     كانت هذه اللوحةُ تختار المسارَ من لقطة التشخيص المحفوظة محلّيّا: فمن
     شخّص مسارا ثمّ اشترى غيره يرى خريطةَ مسارٍ لا يملك منه شيئا، ومن اشترى
     مسارين يرى واحدا. والمصدرُ الآن هو مصدرُ «رحلتي» نفسُه — فلا تقول
     اللوحةُ شيئا وتقول الرحلةُ غيرَه. */
  const catalogVersion = usePublishedContent();
  const track: JourneyTrack | null = useMemo(() => {
    void catalogVersion;
    const tracks = buildJourney(rows, plan);
    if (tracks.length === 0) return null;
    return tracks.find((t) => t.id === defaultTrackId(tracks)) ?? tracks[0];
  }, [rows, plan, catalogVersion]);

  return (
    <PortalLayout title={`${greeting()} يا ${name.split(" ")[0]}`}>
      {/* ① ما عليك الآن — ينتظر لقاءاتِه كي لا يقول «لا شيء عليك» ولقاؤه بعد ساعة */}
      {details === null ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-teal-ink" /></div>
      ) : (
        <MyDeadlines before={before} after={after} />
      )}

      {/* ② لقاءاتك القادمة — بعد يومه. ومن لا لقاءَ له بعدُ يقرأ ذلك سطرا */}
      {details !== null && (nextSessions.length > 0 || todaySessions.length === 0) && (
        <Panel as="section" aria-labelledby="next-h" className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="next-h" className="flex items-center gap-2 text-sm font-bold">
              <CalendarDays className="h-4 w-4 text-gold-ink" aria-hidden="true" /> لقاءاتك القادمة
            </h2>
            <Link to="/student/learning" className="inline-flex min-h-8 items-center px-2 text-fine font-bold text-teal-light-ink hover:text-foreground">تعلّمي ←</Link>
          </div>
          {nextSessions.length === 0 ? (
            <p className="mt-3 text-read leading-6 text-muted-foreground">لا لقاء مجدول بعد. يظهر هنا برابطه فور جدولته.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {nextSessions.map((s) => (
                <Card as="li" key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{s.title}</p>
                    <p className="text-read text-muted-foreground">{fmtSession(new Date(s.startsAt))} · {s.cohortTitle}</p>
                  </div>
                  {/* دعوةُ تقويم — موعدٌ لا يدخل تقويمَ صاحبه موعدٌ يُنسى.
                      وهي ملفٌّ معياريّ يفتحه قوقل وآبل وأوتلوك بلا حساب. */}
                  <Button as="a" size="sm" tone="ghost" icon={CalendarPlus} href={`/api/calendar/cohort-sessions/${s.id}.ics`}>
                    أضفه لتقويمك
                  </Button>
                </Card>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {/* ③ «أين أنا من رحلتي؟» — بطاقةٌ تُلخّص وتُحيل، لا خريطةٌ ثانية تُرسم.
          والتقدّمُ هنا وحدَه: كانت فوقه حلقةُ نسبةٍ تقول الشيءَ نفسَه برقمٍ آخر. */}
      {track && track.counts.total > 0 && <JourneyGlance track={track} className="mt-6" />}

      {/* ④ مستشارُه المسنَد — اسمُه وزرُّ مراسلته (`MyAdvisorCard`) */}
      <MyAdvisorCard className="mt-6" />

      {/* مؤشر الزخم (ط-٥) — ما فعله فعلا، في ذيل يومه لا في رأسه */}
      {momentum && <MomentumCard m={momentum} className="mt-6" />}
    </PortalLayout>
  );
}

/* ═══════════ حسابٌ بلا تسجيلاتٍ بعد — والحالةُ من أربعة مصادر ═══════════

   كانت شاشةً واحدةً لكلّ من لا صفَّ تسجيلٍ له: «حسابك جاهز — بقيت أوّل شعبة».
   وهي تكذب على ثلاثة أصنافٍ من الطلبة:

     · **من دفع للتوّ** وعنده مقعدٌ محجوزٌ ينتظر التسوية.
     · **من بدأ شراءً ولم يكمله** — طلبٌ قائمٌ يستطيع إتمامَه أو إلغاءه.
     · **من اعتمد خطّةً بعد تشخيصه** — مسارُه محفوظٌ على الخادم ولا يراه.

   والترتيبُ ترتيبُ الأقربِ إلى المال: المدفوعُ أوّلا، ثمّ ما لم يكتمل دفعُه،
   ثمّ الخطّة، ثمّ الفراغُ الحقيقيّ.

   ── والنصُّ القديمُ كان يصف مسارا أُلغي ──

   «واطلب التسجيل؛ عند موافقة العمليّات تصلك فاتورتك» — وقرارُ صاحب المنصّة
   المسجَّل في الشيفرة أنّ الشراءَ مباشر. فكانت الشاشةُ توجّه كلَّ طالبٍ جديدٍ
   إلى المسار الذي أُلغي.

   ── والروابطُ تذهب إلى وجهتها لا إلى تحويل ──

   كان زرُّ «تصفّح الشعب» يشير إلى `/student/pathway`، وهو **تحويلٌ** إلى
   `/student/learning` — حيث رسالةُ فراغٍ ثانيةٌ مختلفة. رسالتا فراغٍ لحالةٍ
   واحدة، إحداهما تحيل إلى الأخرى. */
function EmptyRealDashboard({ name, signals }: { name: string; signals: EmptySignals | null }) {
  const held = signals?.held ?? [];
  const unpaid = signals?.unpaid ?? [];
  const plan = signals?.plan ?? null;
  const title = `${greeting()} يا ${name.split(" ")[0]}`;

  if (held.length > 0) {
    return (
      <PortalLayout title={title}>
        <Panel as="section" tone="accent" className="grid place-items-center bg-gradient-to-b from-teal/10 to-transparent py-14 text-center">
          <Clock3 className="h-11 w-11 text-teal-light-ink" />
          <h2 className="mt-5 text-2xl font-black">
            {held.length === 1 ? "مقعدك محجوز — نؤكّد دفعتك" : `${held.length} مقاعد محجوزة — نؤكّد دفعتك`}
          </h2>
          <ul className="mt-3 space-y-1 text-sm leading-7 text-muted-foreground">
            {held.slice(0, 4).map((h) => (
              <li key={h.requestId}>
                <span className="font-bold text-foreground">{h.courseTitleAr}</span> — {h.cohortTitle}
                {h.startsAt && ` · تبدأ ${cohortDayAr(h.startsAt, DAY_NUMERIC)}`}
              </li>
            ))}
          </ul>
          <p className="mt-3 max-w-md text-read leading-7 text-muted-foreground">
            تفتح شعبتك هنا فور تأكيد الدفعة.
          </p>
          <Link to="/student/learning" className="mt-6 rounded-full bg-teal px-6 py-3 font-black text-on-teal transition hover:bg-teal-light">
            تابع في رحلتي
          </Link>
        </Panel>
        <MyAdvisorCard className="mt-6" />
      </PortalLayout>
    );
  }

  if (unpaid.length > 0) {
    return (
      <PortalLayout title={title}>
        <Panel as="section" tone="warn" className="grid place-items-center bg-gradient-to-b from-gold/10 to-transparent py-14 text-center">
          <Clock3 className="h-11 w-11 text-gold-ink" />
          <h2 className="mt-5 text-2xl font-black">
            {unpaid.length === 1 ? "طلبك لم يكتمل دفعه" : `${unpaid.length} طلبات لم يكتمل دفعها`}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
            أتمم الدفع لتفتح شعبتك، أو ألغ الطلب فيتحرّر مقعدك.
          </p>
          <Link to="/student/billing" className="mt-6 rounded-full bg-gold px-6 py-3 font-black text-on-gold transition hover:bg-gold/90">
            افتح فواتيري
          </Link>
        </Panel>
        <MyAdvisorCard className="mt-6" />
      </PortalLayout>
    );
  }

  if (plan && plan.items.length > 0) {
    return (
      <PortalLayout title={title}>
        <Panel as="section" tone="accent" className="grid place-items-center bg-gradient-to-b from-teal/10 to-transparent py-14 text-center">
          <Target className="h-11 w-11 text-teal-light-ink" />
          <h2 className="mt-5 text-2xl font-black">خطّتك جاهزة — بقيت شعبتك الأولى</h2>
          <p className="mt-2 text-base font-bold text-teal-light-ink">{plan.nameAr}</p>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
            {plan.items.length === 1 ? "دورة واحدة" : `${plan.items.length} دورات`} في مسارك.
            اختر شعبة أولاها، والدفع يسجّلك فورا.
          </p>
          <Link to="/student/learning" className="mt-6 rounded-full bg-teal px-6 py-3 font-black text-on-teal transition hover:bg-teal-light">
            اختر شعبتك الأولى
          </Link>
        </Panel>
        <MyAdvisorCard className="mt-6" />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title={`${greeting()} يا ${name.split(" ")[0]}`}>
      <Panel as="section" tone="accent" className="grid place-items-center bg-gradient-to-b from-teal/10 to-transparent py-16 text-center">
        <BookOpen className="h-12 w-12 text-teal-light-ink" />
        <h2 className="mt-5 text-2xl font-black">حسابك جاهز — بقيت أوّل شعبة</h2>
        <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
          اختر دورة وشعبتها، وتفتح هنا فور الدفع. أو ابدأ بالتشخيص لنقترح مسارك.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link to="/diagnostic" className="rounded-full bg-teal px-6 py-3 font-black text-on-teal transition hover:bg-teal-light">
            ابدأ التشخيص
          </Link>
          <Link to="/courses" className="rounded-full border border-white/15 px-6 py-3 font-bold text-foreground hover:border-white/40">
            كتالوج الدورات
          </Link>
        </div>
      </Panel>
      <MyAdvisorCard className="mt-6" />
    </PortalLayout>
  );
}

/* حُذفت لوحة المحاكاة (`SimulatedDashboard`). كانت تُعرض لزائر بلا جلسة:
   تختار مسارا من كتالوج العرض وتبني تقدّمه وإشعاراته من متجر محلي. وحارسُ
   `PortalLayout` يكفي — يقول للزائر بصدق إن البوابة تُفتح بعد أول تسجيل. */

/* بطاقةُ «أين أنا من رحلتي» — تُلخّص وتُحيل.

   كانت هنا خريطةُ المسار كاملةً برسمها وعقدِها. ولمّا صارت «رحلتي» شاشةً
   لها شريطُ مراحلَ يُنقر، صار رسمُها ثانيةً في اللوحة تكرارا يُشتّت: نسختان
   من الشيء نفسِه، ونقرةٌ لا تعرف أيَّهما تفتح.

   فهذه سطران ورقمان وزرٌّ واحد يقود إلى موضع العمل. */
function JourneyGlance({ track, className = "" }: { track: JourneyTrack; className?: string }) {
  const { counts, hours, currentIndex, stages } = track;
  const here = currentIndex >= 0 ? stages[currentIndex] : null;
  const pct = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
  return (
    <section
      aria-label="أين أنت من رحلتك"
      className={`rounded-3xl border border-teal/30 bg-teal-ink/[0.06] p-5 sm:p-6 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-read leading-5 text-muted-foreground">أين أنت من رحلتك</p>
          <p className="mt-1 text-xl font-black leading-tight text-teal-light-ink">
            {currentIndex === -1 ? "أنجزت مراحلك كلها" : `المرحلة ${currentIndex + 1} من ${counts.total}`}
          </p>
          <p className="mt-1 truncate text-read leading-5 text-muted-foreground">
            {track.titleAr}
            {here && ` · ${here.titleAr}`}
          </p>
        </div>
        <dl className="flex gap-5 text-center">
          <div>
            <dd className="text-xl font-black tabular-nums">{counts.completed}</dd>
            <dt className="mt-0.5 text-fine text-muted-foreground">أنجزتها</dt>
          </div>
          <div>
            <dd className="text-xl font-black tabular-nums">{counts.owned - counts.completed}</dd>
            <dt className="mt-0.5 text-fine text-muted-foreground">تعمل فيها</dt>
          </div>
          {hours.total > 0 && (
            <div>
              <dd className="text-xl font-black tabular-nums">{hours.done}</dd>
              <dt className="mt-0.5 text-fine text-muted-foreground">من {hours.total} ساعة</dt>
            </div>
          )}
        </dl>
      </div>
      <div aria-hidden="true" className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-teal-ink transition-all" style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <Link
        to={here ? `/student/learning?stage=${here.courseId}` : "/student/learning"}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal px-5 py-2.5 text-xs font-black text-on-teal transition hover:bg-teal-light"
      >
        {here ? `تابع «${here.titleAr}»` : "افتح رحلتي"}
        <ArrowLeft className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

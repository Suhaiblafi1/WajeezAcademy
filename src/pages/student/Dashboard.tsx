import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Activity, ArrowLeft, Award, Bell, BookOpen, CalendarDays, CheckCircle2, Clock3,
  Lightbulb, Loader2, MessageCircle, Send, Sparkles, Target, TrendingUp, Video, LifeBuoy,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import { hasShowcaseCatalog, showcasePathwayId } from "@/data/showcase";
import PathwayMap from "@/components/PathwayMap";
import { buildPathwayMap, enrollmentFactsFromApi } from "@/application/student/pathway-map";
import { pathwayIdFromSnapshot } from "@/application/student/skills-profile";
import { loadLastResultSafe } from "@/application/diagnostic/session-store";
import { usePublishedContent } from "@/services/public-content";
import { getEnrollment, isPreview } from "@/services/access";
import { useRealSession } from "@/services/session";
import { apiGet } from "@/services/api";
import {
  KIND_LABEL_AR, NO_STREAK_NOTE, buildMomentum, momentumFactsFrom, sinceLabelAr,
  type EvidenceKind, type Momentum,
} from "@/application/student/momentum";
import { pathwayById } from "@/data/pathways";
import { pathwayCourses } from "@/data/courses";
import {
  loadPortal, nextAction, pathwayPercent,
  readUserName, courseGate,
} from "@/data/student";
import AdvisorContact from "@/components/AdvisorContact";
import EmptyState from "@/components/EmptyState";

/* حُذفت خريطة ADVISORS هنا كما حُذفت في صفحة المسار: أسماءُ أشخاصٍ مكتوبةٌ في
   الكود تُعرض للطالب الدافع كأنها مستشارُه المعيَّن. والقاعدة أن لا اسم يُعرض
   كحقيقة قبل توثيقه واعتماده.
   وللإسناد الحقيقي جداولُه في القاعدة (AdvisorCase وAdvisorAssignment
   وAdvisorNote)، ولا تقرؤها هذه الصفحة بعدُ. فحين تُوصَل، يُعرض المستشار
   المعيَّن فعلا وملاحظتُه الفعلية — لا اسمٌ يُنتقى برمز المسار. */

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
  certificates?: unknown[];
}
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
  if (sessionUser && rows) return <EmptyRealDashboard name={sessionUser.displayName} />;
  return <SimulatedDashboard />;
}

/* مؤشر زخم صادق (ط-٥) — آثارك المسجَّلة بتواريخها. لا سلسلة ولا نقاط ولا ترتيب.
   القاعدة معلنة للمتعلم في ذيل البطاقة لا في تعليق كود. */
function MomentumCard({ m, className = "" }: { m: Momentum; className?: string }) {
  const kinds = (Object.keys(m.counted) as EvidenceKind[]).filter((k) => m.counted[k] > 0);
  return (
    <section className={`rounded-3xl border border-white/10 bg-white/[0.03] p-6 ${className}`.trim()}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white/70">
          <Activity className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> زخمك
        </h3>
        <p className="text-[11px] text-white/45">آخر {m.windowDays} يوما</p>
      </div>

      <p className="mt-3 text-sm font-black">
        {m.last ? m.last.labelAr : "لا أثر مسجَّل بعد"}
      </p>
      <p className="mt-1 text-xs text-white/55">
        {m.last ? `${KIND_LABEL_AR[m.last.kind]} · ${sinceLabelAr(m.daysSince)}` : "يبدأ الزخم بأول حضور أو تسليم أو وحدة مُقرّة"}
      </p>

      {m.countedTotal > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {kinds.map((k) => (
            <li key={k} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70">
              <span className="tabular-nums font-bold text-teal-light-ink">{m.counted[k]}</span> {KIND_LABEL_AR[k]}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[11px] leading-6 text-white/60">
          لا أثر مسجَّل في آخر {m.windowDays} يوما. وهذا ما تقوله السجلات — لا حكم فيه ولا عدّاد ينكسر.
        </p>
      )}

      {m.cohortPace && m.cohortPace.total > 0 && (
        <p className="mt-4 border-t border-white/8 pt-3 text-[11px] leading-6 text-white/60">
          إيقاع شعبتك: انتهت{" "}
          <span className="font-bold tabular-nums text-white/85">{m.cohortPace.done}</span> من{" "}
          <span className="tabular-nums">{m.cohortPace.total}</span> جلسة
          <span className="text-white/55"> — جدول وضعته الشعبة، لا هدفا وضعناه لك.</span>
        </p>
      )}

      {/* ‎/55 لا ‎/40: الأخيرة تقيس 3.83:1 على سطح البطاقة — والقاعدة المعلنة
          أولى النصوص بأن تُقرأ */}
      <p className="mt-3 text-[10px] leading-5 text-white/55">{NO_STREAK_NOTE}</p>
    </section>
  );
}

/* ═══════════ الوضع الحقيقي — شعب وجلسات وواجبات وإشعارات الخادم ═══════════ */
function RealDashboard({ name, rows }: { name: string; rows: RealEnrollment[] }) {
  const [details, setDetails] = useState<EnrollmentDetail[] | null>(null);
  const [notifs, setNotifs] = useState<RealNotif[]>([]);
  const [certCount, setCertCount] = useState(0);
  /* آثار ط-٥ من نقاط نهاية قائمة: بطاقات الاسترجاع والقياس البعديّ */
  const [extra, setExtra] = useState<{ retrievalCards: { lastAnswerAt: string | null }[]; remeasures: { measuredAt: string; courseId: string }[]; at: string } | null>(null);

  useEffect(() => {
    let on = true;
    Promise.all(rows.slice(0, 4).map((r) => apiGet<EnrollmentDetail>(`/api/learner/enrollments/${r.id}`).catch(() => null)))
      .then((ds) => { if (on) setDetails(ds.filter((d): d is EnrollmentDetail => d !== null)); });
    apiGet<RealNotif[]>("/api/learner/notifications").then((n) => on && setNotifs(n.slice(0, 4))).catch(() => undefined);
    apiGet<unknown[]>("/api/learner/certificates").then((c) => on && setCertCount(c.length)).catch(() => undefined);
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

  const fmtWhen = (iso: string) => new Date(iso).toLocaleString("ar-JO", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  /* التقدم الكلي: متوسط نِسب الشعب التي لها تقدم محسوب */
  const withProgress = rows.filter((r) => r.courseProgress);
  const pct = withProgress.length
    ? Math.round(withProgress.reduce((s, r) => s + (r.courseProgress?.percent ?? 0), 0) / withProgress.length)
    : 0;
  const activeCount = rows.filter((r) => r.status === "enrolled").length;

  /* حدّ «القادمة» يُلتقط مرة عند التركيب. كان Date.now() يُقرأ داخل useMemo —
     أي أثناء التصيير، وهو استدعاء غير نقي يمنعه مصرّف React. ولا يغيّر
     الالتقاطُ سلوكا: الذاكرة لا تُعاد إلا بتغيّر details، فالوقت كان مجمّدا
     عمليا على أي حال. جلسة بدأت قبل ثلاث ساعات تبقى معروضة. */
  const [upcomingCutoff] = useState(() => Date.now() - 3 * 3600_000);

  /* الجلسات القادمة من كل الشعب — مرتبة زمنيا */
  const upcoming = useMemo(() =>
    (details ?? [])
      .flatMap((d) => d.cohort.sessions.map((s) => ({ ...s, cohortTitle: d.cohort.title })))
      .filter((s) => new Date(s.startsAt).getTime() >= upcomingCutoff)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 4),
  [details, upcomingCutoff]);

  /* واجبات بانتظارك: لم تُسلَّم أو طُلبت إعادتها */
  const pendingAssessments = useMemo(() =>
    (details ?? []).flatMap((d) =>
      d.cohort.assessments
        .filter((a) => !d.submissions.some((s) => s.assessmentId === a.id && ["submitted", "under_review", "accepted"].includes(s.status)))
        .map((a) => ({ ...a, enrollId: d.id, cohortTitle: d.cohort.title }))
    ), [details]);

  /* «التالي الآن» الحقيقي: أقرب جلسة، ثم أقرب واجب، ثم مواصلة أول شعبة */
  const next = useMemo(() => {
    if (upcoming[0]) {
      const s = upcoming[0];
      return { label: `جلسة «${s.title}» قادمة`, detail: `${s.cohortTitle} · ${fmtWhen(s.startsAt)}`, cta: "ادخل الجلسة", href: s.zoom ? (s.zoom.learnerUrl ?? s.zoom.joinUrl) : "/student/learning", external: !!s.zoom };
    }
    if (pendingAssessments[0]) {
      const a = pendingAssessments[0];
      return { label: `سلّم «${a.title}»`, detail: `${a.cohortTitle}${a.dueAt ? ` · يستحق ${new Date(a.dueAt).toLocaleDateString("ar-JO")}` : ""}`, cta: "افتح الواجب", href: "/student/learning", external: false };
    }
    const first = rows[0];
    return { label: `تابع «${first.cohort.course.versions[0]?.titleAr ?? first.cohort.title}»`, detail: "جلساتك وموادك وواجباتك في صفحة تعلّمي", cta: "افتح تعلّمي", href: "/student/learning", external: false };
  }, [upcoming, pendingAssessments, rows]);

  const unread = notifs.filter((n) => n.status !== "read").length;

  /* خريطة المسار (ط-٢) من التسجيلات الحقيقية — المسار من لقطة التشخيص أو الاستحقاق.
     الكتالوج كسول (ع-١) فنربط الحساب بنسخته حتى تصل عناوين الدورات وترتيبها. */
  const catalogVersion = usePublishedContent();
  const map = useMemo(() => {
    void catalogVersion;
    const local = loadLastResultSafe();
    const snap = local.status === "ok" || local.status === "migrated" ? local.result : null;
    const pathwayId = pathwayIdFromSnapshot(snap) ?? getEnrollment()?.pathwayId ?? null;
    return buildPathwayMap(pathwayId, enrollmentFactsFromApi(rows));
  }, [rows, catalogVersion]);

  return (
    <PortalLayout title={`${greeting()} يا ${name.split(" ")[0]}`}>
      {/* شريط التقدم العام الحقيقي */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/55">رحلتك الحقيقية</p>
            <h2 className="mt-1 text-xl font-black">{activeCount} {activeCount === 1 ? "شعبة نشطة" : "شعب نشطة"} · {rows.length} إجمالا</h2>
            <p className="mt-1 text-xs text-white/45">
              {certCount > 0 ? `${certCount} ${certCount === 1 ? "شهادة صادرة" : "شهادات صادرة"} · ` : ""}تقدمك يُحسب من حضورك وتسليماتك الفعلية
            </p>
          </div>
          <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(var(--teal-ink) / 0.15)" strokeWidth="9" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke="rgb(var(--teal-ink))" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - pct / 100)}
                className="transition-all duration-700"
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-teal-light-ink">{pct}%</span>
              <span className="text-[9px] text-white/50">من شعبك</span>
            </span>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-l from-teal to-teal-light transition-all" style={{ width: `${Math.max(3, pct)}%` }} />
        </div>
      </section>

      {/* خريطة المسار (ط-٢) — تجيب «أين أنا من رحلتي؟» بدل عدّ الشعب وحده */}
      {map && map.totalCount > 0 && <PathwayMap map={map} className="mt-6" />}

      {/* مؤشر الزخم (ط-٥) — بعد «أين أنا» وقبل «ماذا الآن»: ما فعلته فعلا */}
      {momentum && <MomentumCard m={momentum} className="mt-6" />}

      <div className="mt-6 grid gap-5 [&>*]:min-w-0 lg:grid-cols-3">
        {/* التالي الآن — حقيقي */}
        <section className="rounded-3xl border border-teal/40 bg-gradient-to-b from-teal/10 to-transparent p-6 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm font-bold text-teal-light-ink">
            <Target className="h-4 w-4" /> التالي الآن
          </div>
          <h3 className="mt-3 text-2xl font-black leading-snug">{next.label}</h3>
          <p className="mt-2 text-sm leading-7 text-white/60">{next.detail}</p>
          {next.external ? (
            <a href={next.href} target="_blank" rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-teal px-6 py-3 font-black text-on-teal transition hover:bg-teal-light">
              {next.cta} <Video className="h-4 w-4" />
            </a>
          ) : (
            <Link to={next.href}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-teal px-6 py-3 font-black text-on-teal transition hover:bg-teal-light">
              {next.cta} <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
        </section>

        {/* شعبي — ملخص سريع */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <BookOpen className="h-4 w-4 text-teal-light-ink" /> شعبي
            </div>
            <Link to="/student/learning" className="text-[11px] font-bold text-teal-light-ink hover:text-white">الكل ←</Link>
          </div>
          <div className="mt-4 space-y-3">
            {rows.slice(0, 3).map((r) => (
              <div key={r.id}>
                <p className="truncate text-xs font-bold text-white/85">{r.cohort.course.versions[0]?.titleAr ?? r.cohort.title}</p>
                <p className="mt-0.5 truncate text-[10px] text-white/45">
                  {r.cohort.trainers.length > 0 ? `المدرب: ${r.cohort.trainers.map((t) => t.profile.application.fullName).join("، ")}` : r.cohort.title}
                </p>
                {r.courseProgress && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-teal" style={{ width: `${r.courseProgress.percent}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-5 [&>*]:min-w-0 lg:grid-cols-3">
        {/* جدولي الحقيقي */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <CalendarDays className="h-4 w-4 text-gold-ink" /> جدولي — الجلسات القادمة
            </div>
            <Link to="/student/learning" className="text-[11px] font-bold text-teal-light-ink hover:text-white">تعلّمي ←</Link>
          </div>
          <div className="mt-4 space-y-2.5">
            {details === null ? (
              <div className="grid place-items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-teal-ink" /></div>
            ) : upcoming.length === 0 ? (
              /* ط-٤ · الإجراءات من حالة هذه الصفحة نفسها: واجبٌ معلَّق يُقترح لأنه
                 موجود، والشعب المفتوحة دعوةٌ للتصفّح لا زعمٌ بوجود شعبة. */
              <EmptyState
                icon={CalendarDays}
                titleAr="لا جلسات مجدولة قادمة"
                reasonAr="عند جدولة شعبتك تظهر الجلسة هنا مع رابط الانضمام. وحتى ذلك الحين وقتك ليس فراغا:"
                actions={[
                  ...(pendingAssessments[0]
                    ? [{ to: "/student/learning", labelAr: `سلّم «${pendingAssessments[0].title}»`, hintAr: pendingAssessments[0].dueAt ? `يستحق ${new Date(pendingAssessments[0].dueAt).toLocaleDateString("ar-JO")}` : "بانتظار تسليمك" }]
                    : []),
                  ...(rows[0]
                    ? [{ to: "/student/learning", labelAr: `تابع «${rows[0].cohort.course.versions[0]?.titleAr ?? rows[0].cohort.title}»`, hintAr: "الوحدات والمواد" }]
                    : []),
                  { to: "/student/review", labelAr: "راجع ما تعلّمته", hintAr: "بطاقات الاسترجاع" },
                  { to: "/student/cohorts", labelAr: "تصفّح الشعب المفتوحة", hintAr: "للتسجيل في دورة أخرى" },
                ]}
              />
            ) : (
              upcoming.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold/15 text-gold-ink">
                      <Video className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold">{s.title}</p>
                      <p className="text-[11px] text-white/45">{s.cohortTitle} · {fmtWhen(s.startsAt)}</p>
                    </div>
                  </div>
                  {s.zoom ? (
                    <a href={s.zoom.learnerUrl ?? s.zoom.joinUrl} target="_blank" rel="noreferrer"
                      className="rounded-full border border-teal/40 px-4 py-1.5 text-xs font-bold text-teal-light-ink transition hover:bg-teal hover:text-on-teal">
                      انضم الآن
                    </a>
                  ) : (
                    <Link to="/student/learning"
                      className="rounded-full border border-teal/40 px-4 py-1.5 text-xs font-bold text-teal-light-ink transition hover:bg-teal hover:text-on-teal">
                      التفاصيل
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>

          {/* واجبات بانتظارك */}
          {pendingAssessments.length > 0 && (
            <div className="mt-5 border-t border-white/8 pt-4">
              <div className="flex items-center gap-2 text-sm font-bold text-white/70">
                <Send className="h-4 w-4 text-teal-light-ink" /> بانتظار تسليمك ({pendingAssessments.length})
              </div>
              <div className="mt-3 space-y-2">
                {pendingAssessments.slice(0, 3).map((a) => (
                  <Link key={a.id} to="/student/learning"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-gold/25 bg-gold/5 px-4 py-2.5 transition hover:border-gold/50">
                    <span className="text-xs font-bold text-white/85">{a.title} <span className="font-normal text-white/45">· {a.cohortTitle}</span></span>
                    {a.dueAt && <span className="shrink-0 text-[10px] text-gold-ink">يستحق {new Date(a.dueAt).toLocaleDateString("ar-JO")}</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* الإشعارات الحقيقية */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <Bell className="h-4 w-4 text-gold-ink" /> الإشعارات
            </div>
            {unread > 0 && <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-black text-on-gold">{unread} جديد</span>}
          </div>
          <div className="mt-4 space-y-2.5">
            {notifs.length === 0 && <p className="rounded-xl border border-white/5 px-3 py-6 text-center text-xs text-white/45">لا إشعارات بعد</p>}
            {notifs.map((n) => (
              <p key={n.id} className={`rounded-xl border px-3 py-2.5 text-xs leading-6 ${n.status === "read" ? "border-white/5 text-white/50" : "border-teal/25 bg-teal/5 text-white/75"}`}>
                <span className="block font-bold">{n.title}</span>
                {n.body}
              </p>
            ))}
          </div>
          <Link to="/student/notifications" className="mt-3 block text-center text-[11px] font-bold text-teal-light-ink hover:text-white">كل الإشعارات ←</Link>
        </section>
      </div>

      {/* روابط سريعة */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/student/skills" className="block rounded-3xl border border-teal/30 bg-teal/5 p-5 transition hover:border-teal/60">
          <div className="flex items-center gap-2 text-sm font-bold text-teal-light-ink">
            <TrendingUp className="h-4 w-4" /> ملف مهاراتي
          </div>
          <p className="mt-2 text-xs leading-6 text-white/55">ما قِيس لك فعلا: فجواتك وما تُتقنه وما لم يُقس بعد</p>
        </Link>
        <Link to="/student/cohorts" className="block rounded-3xl border border-teal/30 bg-teal/5 p-5 transition hover:border-teal/60">
          <div className="flex items-center gap-2 text-sm font-bold text-teal-light-ink">
            <CalendarDays className="h-4 w-4" /> الشعب المفتوحة
          </div>
          <p className="mt-2 text-xs leading-6 text-white/55">تصفح الشعب القادمة واطلب التسجيل فيما يناسبك</p>
        </Link>
        <Link to="/student/certificates" className="block rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/30">
          <div className="flex items-center gap-2 text-sm font-bold text-white/70">
            <Award className="h-4 w-4 text-gold-ink" /> شهاداتي {certCount > 0 && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] text-gold-ink">{certCount}</span>}
          </div>
          <p className="mt-2 text-xs leading-6 text-white/55">أرقام تحقق عامة تُشاركها مع أي جهة</p>
        </Link>
        <Link to="/student/support" className="block rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/30">
          <div className="flex items-center gap-2 text-sm font-bold text-white/70">
            <LifeBuoy className="h-4 w-4" /> الدعم
          </div>
          <p className="mt-2 text-xs leading-6 text-white/55">تذكرة دعم تصل لفريق العمليات مباشرة</p>
        </Link>
      </div>

      <p className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] text-white/55">
        <Sparkles className="h-3.5 w-3.5" />
        <Clock3 className="h-3.5 w-3.5" />
        تقدمك يُحفظ في الخادم تلقائيا — أكمل من أي جهاز
        <CheckCircle2 className="h-3.5 w-3.5 text-teal-ink" />
      </p>
    </PortalLayout>
  );
}

/* ═══════════ حساب حقيقي بلا تسجيلات بعد — ترحيب يوجه لأول خطوة ═══════════ */
function EmptyRealDashboard({ name }: { name: string }) {
  return (
    <PortalLayout title={`${greeting()} يا ${name.split(" ")[0]}`}>
      <section className="grid place-items-center rounded-3xl border border-teal/30 bg-gradient-to-b from-teal/10 to-transparent py-16 text-center">
        <BookOpen className="h-12 w-12 text-teal-light-ink" />
        <h2 className="mt-5 text-2xl font-black">حسابك جاهز — بقيت أول شعبة</h2>
        <p className="mt-3 max-w-md text-sm leading-7 text-white/60">
          تصفح الشعب المفتوحة واطلب التسجيل؛ عند موافقة العمليات تصلك فاتورتك، وبالدفع تُفتح شعبتك هنا تلقائيا.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link to="/student/cohorts" className="rounded-full bg-teal px-6 py-3 font-black text-on-teal transition hover:bg-teal-light">
            تصفح الشعب المفتوحة
          </Link>
          <Link to="/catalog" className="rounded-full border border-white/15 px-6 py-3 font-bold text-white/80 hover:border-white/40">
            كتالوج الدورات
          </Link>
        </div>
      </section>
    </PortalLayout>
  );
}

/* ═══════════ وضع المحاكاة — تجربة الديمو للزائر دون حساب حقيقي ═══════════ */
/* ⚠ الكتالوج كسول (ع-١): الجسم خلف حالة تحميل، ويُعاد تركيبه بمفتاح نسخته. */
function SimulatedDashboard() {
  const catalogVersion = usePublishedContent();
  if (!hasShowcaseCatalog()) {
    return (
      <PortalLayout title="لوحتي">
        <div className="grid place-items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="جارٍ تحميل الكتالوج" />
        </div>
      </PortalLayout>
    );
  }
  return <SimulatedDashboardBody key={catalogVersion} />;
}

function SimulatedDashboardBody() {
  const enrollment = getEnrollment();
  // في وضع المعاينة نعرض أول مسار غني بالدورات
  const pathwayId = enrollment?.pathwayId ?? showcasePathwayId()!;
  const pathway = pathwayById(pathwayId);
  const state = useMemo(() => loadPortal(pathwayId), [pathwayId]);
  const pct = pathwayPercent(pathwayId, state);
  const next = nextAction(pathwayId, state);
  const user = readUserName();

  const advisorMsg = `مرحبا، أنا ${user} طالب مسار «${pathway?.name}» وأريد استشارة.`;
  const unread = state.notifications.filter((n) => !n.read).length;
  const completedCount = (pathwayCourses[pathwayId] ?? []).filter((id) => courseGate(pathwayId, id, state).status === "completed").length;
  const totalCourses = (pathwayCourses[pathwayId] ?? []).length;

  return (
    <PortalLayout title={`${greeting()} يا ${user.split(" ")[0]}`}>
      {isPreview() && (
        <p className="mb-5 rounded-xl border border-dashed border-gold/40 bg-gold/5 px-4 py-2 text-center text-xs text-gold-ink">
          وضع المعاينة التجريبية — بيانات محاكاة لمسار «{pathway?.name}»
        </p>
      )}

      {/* شريط التقدم العام */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/55">مسارك النشط</p>
            <h2 className="mt-1 text-xl font-black">{pathway?.name}</h2>
            <p className="mt-1 text-xs text-white/45">
              {completedCount} من {totalCourses} دورات مكتملة · {pathway?.weeklyHours} أسبوعيا
            </p>
          </div>
          <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(var(--teal-ink) / 0.15)" strokeWidth="9" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke="rgb(var(--teal-ink))" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - pct / 100)}
                className="transition-all duration-700"
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-teal-light-ink">{pct}%</span>
              <span className="text-[9px] text-white/50">من رحلتك</span>
            </span>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-l from-teal to-teal-light transition-all" style={{ width: `${Math.max(3, pct)}%` }} />
        </div>
      </section>

      <div className="mt-6 grid gap-5 [&>*]:min-w-0 lg:grid-cols-3">
        {/* التالي الآن — إجراء واحد (US-04) */}
        <section className="rounded-3xl border border-teal/40 bg-gradient-to-b from-teal/10 to-transparent p-6 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm font-bold text-teal-light-ink">
            <Target className="h-4 w-4" /> التالي الآن
          </div>
          <h3 className="mt-3 text-2xl font-black leading-snug">{next.label}</h3>
          <p className="mt-2 text-sm leading-7 text-white/60">{next.detail}</p>
          <Link
            to={next.courseId ? `/student/course/${next.courseId}` : "/student/project"}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-teal px-6 py-3 font-black text-on-teal transition hover:bg-teal-light"
          >
            {next.cta}
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </section>

        {/* المستشار — بابٌ مفتوح بلا اسمٍ مختلق ولا ملاحظةٍ لم تُكتب.
            كانت البطاقة تعرض اسم شخص ولقبه، ثم «آخر ملاحظة: بداية موفقة…» —
            رسالةٌ منسوبةٌ إلى إنسان لم يكتبها. الاسمُ والملاحظة يعودان معًا يوم
            تُقرأ AdvisorAssignment وAdvisorNote من القاعدة. */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-white/70">
            <MessageCircle className="h-4 w-4 text-[#25D366]" /> مستشار وجيز
          </div>
          <p className="mt-3 text-xs leading-6 text-white/50">
            تعثّرت في محور، أو أردت تبديل دورة، أو احتجت رأيا قبل قرار — راسلنا ويردّ عليك إنسان.
          </p>
          <AdvisorContact
            text={advisorMsg}
            label="راسل مستشارا"
            className="mt-4 flex items-center justify-center gap-2 rounded-full border border-[#25D366]/50 py-2.5 text-sm font-bold text-[#25D366] transition hover:bg-[#25D366]/10"
          />
        </section>
      </div>

      <div className="mt-6 grid gap-5 [&>*]:min-w-0 lg:grid-cols-3">
        {/* حُذف «جدولي — الجلسات القادمة». كان يُركَّب من `courseSessions`
            التي تخترع جلستين لكل دورة بتاريخ ووقت ثابتين. */}

        {/* الإشعارات */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <Bell className="h-4 w-4 text-gold-ink" /> الإشعارات
            </div>
            {unread > 0 && <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-black text-on-gold">{unread} جديد</span>}
          </div>
          <div className="mt-4 space-y-2.5">
            {state.notifications.slice(0, 4).map((n) => (
              <p key={n.id} className={`rounded-xl border px-3 py-2.5 text-xs leading-6 ${n.read ? "border-white/5 text-white/50" : "border-teal/25 bg-teal/5 text-white/75"}`}>
                {n.text}
              </p>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-5 [&>*]:min-w-0 lg:grid-cols-3">
        {/* حُذف «مهاراتي — الحالي مقابل المستهدف». كان المستوى يُحسب
            `1 + عدد الدورات المكتملة × 2` ويُعرض رقما من ٥ كأنه قياس. */}

        {/* التوصيات + الدعم */}
        <section className="space-y-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <Lightbulb className="h-4 w-4 text-gold-ink" /> توصيات لك — ولماذا
            </div>
            <div className="mt-4 space-y-3 text-xs leading-6">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="font-bold text-white/85">ملخص «التركيز العميق» الصوتي</p>
                <p className="mt-1 text-white/45">لأنك ذكرت في تشخيصك أن وقتك محدود — سمعه قبل درسك القادم.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="font-bold text-white/85">جلسة تقوية جماعية الخميس</p>
                <p className="mt-1 text-white/45">طلاب دفعتك الذين أنهوا الدرس الثاني ارتفعت درجاتهم 18%.</p>
              </div>
            </div>
          </div>
          <Link to="/student/pathway" className="block rounded-3xl border border-teal/30 bg-teal/5 p-5 transition hover:border-teal/60">
            <div className="flex items-center gap-2 text-sm font-bold text-teal-light-ink">
              <BookOpen className="h-4 w-4" /> خريطة مساري الكاملة
            </div>
            <p className="mt-2 text-xs leading-6 text-white/55">الدورات وحالاتها وقواعد الفتح ومشروع التخرج</p>
          </Link>
          <a href="mailto:Academy@wajeez.co" className="block rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/30">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <LifeBuoy className="h-4 w-4" /> الدعم
            </div>
            <p className="mt-2 text-xs leading-6 text-white/50">قاعدة المعرفة · تذكرة دعم · السياسات</p>
          </a>
        </section>
      </div>

      <p className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] text-white/55">
        <Sparkles className="h-3.5 w-3.5" />
        <Clock3 className="h-3.5 w-3.5" />
        تقدمك يُحفظ تلقائيا — أكمل من أي جهاز بعد الدخول
        <CheckCircle2 className="h-3.5 w-3.5 text-teal-ink" />
      </p>
    </PortalLayout>
  );
}

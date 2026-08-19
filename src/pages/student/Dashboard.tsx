import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft, Award, Bell, BookOpen, CalendarDays, CheckCircle2, Clock3,
  Lightbulb, Loader2, MessageCircle, Send, Sparkles, Target, TrendingUp, Video, LifeBuoy,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import { getEnrollment, isPreview } from "@/services/access";
import { useRealSession } from "@/services/session";
import { apiGet } from "@/services/api";
import { pathwayById, pathways } from "@/data/pathways";
import { courseById, pathwayCourses } from "@/data/courses";
import {
  loadPortal, nextAction, pathwayPercent, pathwaySkills, courseSessions,
  readUserName, courseGate,
} from "@/data/student";
import AdvisorContact from "@/components/AdvisorContact";

/* مستشارو المجالات — نفس منطق صفحة المسار العامة (وضع المحاكاة) */
const ADVISORS: Record<string, { name: string; title: string }> = {
  EMP: { name: "د. فيصل العتيبي", title: "مستشار تطوير الموظفين" },
  GOV: { name: "م. سلطان الدوسري", title: "مستشار القطاع الحكومي" },
  STU: { name: "أ. ريم القحطاني", title: "مستشارة الجاهزية المهنية" },
  BIZ: { name: "م. لينا الحربي", title: "مستشارة ريادة الأعمال" },
  LEAD: { name: "م. سلطان الدوسري", title: "مستشار القيادة" },
};

/* ─── أنواع الوضع الحقيقي (مطابقة لاستجابات /api/learner) ─── */
interface RealEnrollment {
  id: string; status: string; createdAt: string;
  cohort: {
    id: string; title: string;
    course: { versions: { titleAr: string }[] };
    trainers: { profile: { application: { fullName: string } } }[];
  };
  courseProgress: { percent: number } | null;
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
  submissions: { assessmentId: string; status: string }[];
}
interface RealNotif { id: string; title: string; body: string; status: string; sentAt: string | null; queuedAt: string }

const greeting = () => (new Date().getHours() < 12 ? "صباح الخير" : new Date().getHours() < 17 ? "طاب يومك" : "مساء الخير");

/** لوحتي — موزّع: جلسة حقيقية بتسجيلات ترى بياناتها الفعلية، وإلا تجربة المحاكاة للديمو */
export default function StudentDashboard() {
  const { user: sessionUser } = useRealSession();
  const [rows, setRows] = useState<RealEnrollment[] | null>(null);

  useEffect(() => {
    if (!sessionUser) { setRows(null); return; }
    let on = true;
    apiGet<RealEnrollment[]>("/api/learner/my-learning")
      .then((r) => { if (on) setRows(r); })
      .catch(() => { if (on) setRows(null); });
    return () => { on = false; };
  }, [sessionUser]);

  /* جلسة حقيقية — انتظر الجلب قبل اختيار الوضع، حتى لا تومض المحاكاة لصاحب الحساب */
  if (sessionUser && rows === null) {
    return (
      <PortalLayout title={`${greeting()} يا ${sessionUser.displayName.split(" ")[0]}`}>
        <div className="grid place-items-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A7B4]" /></div>
      </PortalLayout>
    );
  }
  if (sessionUser && rows && rows.length > 0) return <RealDashboard name={sessionUser.displayName} rows={rows} />;
  if (sessionUser && rows) return <EmptyRealDashboard name={sessionUser.displayName} />;
  return <SimulatedDashboard />;
}

/* ═══════════ الوضع الحقيقي — شعب وجلسات وواجبات وإشعارات الخادم ═══════════ */
function RealDashboard({ name, rows }: { name: string; rows: RealEnrollment[] }) {
  const [details, setDetails] = useState<EnrollmentDetail[] | null>(null);
  const [notifs, setNotifs] = useState<RealNotif[]>([]);
  const [certCount, setCertCount] = useState(0);

  useEffect(() => {
    let on = true;
    Promise.all(rows.slice(0, 4).map((r) => apiGet<EnrollmentDetail>(`/api/learner/enrollments/${r.id}`).catch(() => null)))
      .then((ds) => { if (on) setDetails(ds.filter((d): d is EnrollmentDetail => d !== null)); });
    apiGet<RealNotif[]>("/api/learner/notifications").then((n) => on && setNotifs(n.slice(0, 4))).catch(() => undefined);
    apiGet<unknown[]>("/api/learner/certificates").then((c) => on && setCertCount(c.length)).catch(() => undefined);
    return () => { on = false; };
  }, [rows]);

  const fmtWhen = (iso: string) => new Date(iso).toLocaleString("ar-JO", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  /* التقدم الكلي: متوسط نِسب الشعب التي لها تقدم محسوب */
  const withProgress = rows.filter((r) => r.courseProgress);
  const pct = withProgress.length
    ? Math.round(withProgress.reduce((s, r) => s + (r.courseProgress?.percent ?? 0), 0) / withProgress.length)
    : 0;
  const activeCount = rows.filter((r) => r.status === "enrolled").length;

  /* الجلسات القادمة من كل الشعب — مرتبة زمنيا */
  const upcoming = useMemo(() => {
    const now = Date.now();
    return (details ?? [])
      .flatMap((d) => d.cohort.sessions.map((s) => ({ ...s, cohortTitle: d.cohort.title })))
      .filter((s) => new Date(s.startsAt).getTime() >= now - 3 * 3600_000)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 4);
  }, [details]);

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
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke="#38A7B4" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - pct / 100)}
                className="transition-all duration-700"
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-[#6EC7D1]">{pct}%</span>
              <span className="text-[9px] text-white/50">من شعبك</span>
            </span>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-l from-[#38A7B4] to-[#6EC7D1] transition-all" style={{ width: `${Math.max(3, pct)}%` }} />
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* التالي الآن — حقيقي */}
        <section className="rounded-3xl border border-[#38A7B4]/40 bg-gradient-to-b from-[#38A7B4]/10 to-transparent p-6 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm font-bold text-[#6EC7D1]">
            <Target className="h-4 w-4" /> التالي الآن
          </div>
          <h3 className="mt-3 text-2xl font-black leading-snug">{next.label}</h3>
          <p className="mt-2 text-sm leading-7 text-white/60">{next.detail}</p>
          {next.external ? (
            <a href={next.href} target="_blank" rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#38A7B4] px-6 py-3 font-black text-[#08272B] transition hover:bg-[#6EC7D1]">
              {next.cta} <Video className="h-4 w-4" />
            </a>
          ) : (
            <Link to={next.href}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#38A7B4] px-6 py-3 font-black text-[#08272B] transition hover:bg-[#6EC7D1]">
              {next.cta} <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
        </section>

        {/* شعبي — ملخص سريع */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <BookOpen className="h-4 w-4 text-[#6EC7D1]" /> شعبي
            </div>
            <Link to="/student/learning" className="text-[11px] font-bold text-[#6EC7D1] hover:text-white">الكل ←</Link>
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
                    <div className="h-full rounded-full bg-[#38A7B4]" style={{ width: `${r.courseProgress.percent}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* جدولي الحقيقي */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <CalendarDays className="h-4 w-4 text-[#FABC05]" /> جدولي — الجلسات القادمة
            </div>
            <Link to="/student/learning" className="text-[11px] font-bold text-[#6EC7D1] hover:text-white">تعلّمي ←</Link>
          </div>
          <div className="mt-4 space-y-2.5">
            {details === null ? (
              <div className="grid place-items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#38A7B4]" /></div>
            ) : upcoming.length === 0 ? (
              <p className="rounded-2xl border border-white/8 bg-black/20 px-4 py-6 text-center text-xs text-white/50">
                لا جلسات مجدولة قادمة — عند جدولة شعبتك تظهر هنا مع رابط الانضمام.
              </p>
            ) : (
              upcoming.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#FABC05]/15 text-[#FABC05]">
                      <Video className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold">{s.title}</p>
                      <p className="text-[11px] text-white/45">{s.cohortTitle} · {fmtWhen(s.startsAt)}</p>
                    </div>
                  </div>
                  {s.zoom ? (
                    <a href={s.zoom.learnerUrl ?? s.zoom.joinUrl} target="_blank" rel="noreferrer"
                      className="rounded-full border border-[#38A7B4]/40 px-4 py-1.5 text-xs font-bold text-[#6EC7D1] transition hover:bg-[#38A7B4] hover:text-[#08272B]">
                      انضم الآن
                    </a>
                  ) : (
                    <Link to="/student/learning"
                      className="rounded-full border border-[#38A7B4]/40 px-4 py-1.5 text-xs font-bold text-[#6EC7D1] transition hover:bg-[#38A7B4] hover:text-[#08272B]">
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
                <Send className="h-4 w-4 text-[#6EC7D1]" /> بانتظار تسليمك ({pendingAssessments.length})
              </div>
              <div className="mt-3 space-y-2">
                {pendingAssessments.slice(0, 3).map((a) => (
                  <Link key={a.id} to="/student/learning"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[#FABC05]/25 bg-[#FABC05]/5 px-4 py-2.5 transition hover:border-[#FABC05]/50">
                    <span className="text-xs font-bold text-white/85">{a.title} <span className="font-normal text-white/45">· {a.cohortTitle}</span></span>
                    {a.dueAt && <span className="shrink-0 text-[10px] text-[#FABC05]">يستحق {new Date(a.dueAt).toLocaleDateString("ar-JO")}</span>}
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
              <Bell className="h-4 w-4 text-[#FABC05]" /> الإشعارات
            </div>
            {unread > 0 && <span className="rounded-full bg-[#FABC05] px-2 py-0.5 text-[10px] font-black text-[#0D0D0D]">{unread} جديد</span>}
          </div>
          <div className="mt-4 space-y-2.5">
            {notifs.length === 0 && <p className="rounded-xl border border-white/5 px-3 py-6 text-center text-xs text-white/45">لا إشعارات بعد</p>}
            {notifs.map((n) => (
              <p key={n.id} className={`rounded-xl border px-3 py-2.5 text-xs leading-6 ${n.status === "read" ? "border-white/5 text-white/50" : "border-[#38A7B4]/25 bg-[#38A7B4]/5 text-white/75"}`}>
                <span className="block font-bold">{n.title}</span>
                {n.body}
              </p>
            ))}
          </div>
          <Link to="/student/notifications" className="mt-3 block text-center text-[11px] font-bold text-[#6EC7D1] hover:text-white">كل الإشعارات ←</Link>
        </section>
      </div>

      {/* روابط سريعة */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link to="/student/cohorts" className="block rounded-3xl border border-[#38A7B4]/30 bg-[#38A7B4]/5 p-5 transition hover:border-[#38A7B4]/60">
          <div className="flex items-center gap-2 text-sm font-bold text-[#6EC7D1]">
            <CalendarDays className="h-4 w-4" /> الشعب المفتوحة
          </div>
          <p className="mt-2 text-xs leading-6 text-white/55">تصفح الشعب القادمة واطلب التسجيل فيما يناسبك</p>
        </Link>
        <Link to="/student/certificates" className="block rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/30">
          <div className="flex items-center gap-2 text-sm font-bold text-white/70">
            <Award className="h-4 w-4 text-[#FABC05]" /> شهاداتي {certCount > 0 && <span className="rounded-full bg-[#FABC05]/15 px-2 py-0.5 text-[10px] text-[#FABC05]">{certCount}</span>}
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
        <CheckCircle2 className="h-3.5 w-3.5 text-[#38A7B4]" />
      </p>
    </PortalLayout>
  );
}

/* ═══════════ حساب حقيقي بلا تسجيلات بعد — ترحيب يوجه لأول خطوة ═══════════ */
function EmptyRealDashboard({ name }: { name: string }) {
  return (
    <PortalLayout title={`${greeting()} يا ${name.split(" ")[0]}`}>
      <section className="grid place-items-center rounded-3xl border border-[#38A7B4]/30 bg-gradient-to-b from-[#38A7B4]/10 to-transparent py-16 text-center">
        <BookOpen className="h-12 w-12 text-[#6EC7D1]" />
        <h2 className="mt-5 text-2xl font-black">حسابك جاهز — بقيت أول شعبة</h2>
        <p className="mt-3 max-w-md text-sm leading-7 text-white/60">
          تصفح الشعب المفتوحة واطلب التسجيل؛ عند موافقة العمليات تصلك فاتورتك، وبالدفع تُفتح شعبتك هنا تلقائيا.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link to="/student/cohorts" className="rounded-full bg-[#38A7B4] px-6 py-3 font-black text-[#08272B] transition hover:bg-[#6EC7D1]">
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
function SimulatedDashboard() {
  const enrollment = getEnrollment();
  // في وضع المعاينة نعرض أول مسار غني بالدورات
  const pathwayId = enrollment?.pathwayId ?? pathways.find((p) => (pathwayCourses[p.id] ?? []).length >= 4)?.id ?? pathways[0].id;
  const pathway = pathwayById(pathwayId);
  const state = useMemo(() => loadPortal(pathwayId), [pathwayId]);
  const pct = pathwayPercent(pathwayId, state);
  const next = nextAction(pathwayId, state);
  const skills = pathwaySkills(pathwayId, state);
  const user = readUserName();

  const startDate = new Date(state.startedAt);
  const sessions = (pathwayCourses[pathwayId] ?? [])
    .map((id) => courseById(id))
    .filter(Boolean)
    .flatMap((c) => courseSessions(c!, startDate))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const advisor = ADVISORS[pathwayId.split("-")[1]] ?? ADVISORS.EMP;
  const advisorMsg = `مرحبا ${advisor.name}، أنا ${user} طالب مسار «${pathway?.name}» وأريد استشارتك.`;
  const unread = state.notifications.filter((n) => !n.read).length;
  const completedCount = (pathwayCourses[pathwayId] ?? []).filter((id) => courseGate(pathwayId, id, state).status === "completed").length;
  const totalCourses = (pathwayCourses[pathwayId] ?? []).length;

  return (
    <PortalLayout title={`${greeting()} يا ${user.split(" ")[0]}`}>
      {isPreview() && (
        <p className="mb-5 rounded-xl border border-dashed border-[#FABC05]/40 bg-[#FABC05]/5 px-4 py-2 text-center text-xs text-[#FABC05]">
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
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke="#38A7B4" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - pct / 100)}
                className="transition-all duration-700"
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-[#6EC7D1]">{pct}%</span>
              <span className="text-[9px] text-white/50">من رحلتك</span>
            </span>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-l from-[#38A7B4] to-[#6EC7D1] transition-all" style={{ width: `${Math.max(3, pct)}%` }} />
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* التالي الآن — إجراء واحد (US-04) */}
        <section className="rounded-3xl border border-[#38A7B4]/40 bg-gradient-to-b from-[#38A7B4]/10 to-transparent p-6 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm font-bold text-[#6EC7D1]">
            <Target className="h-4 w-4" /> التالي الآن
          </div>
          <h3 className="mt-3 text-2xl font-black leading-snug">{next.label}</h3>
          <p className="mt-2 text-sm leading-7 text-white/60">{next.detail}</p>
          <Link
            to={next.courseId ? `/student/course/${next.courseId}` : "/student/project"}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#38A7B4] px-6 py-3 font-black text-[#08272B] transition hover:bg-[#6EC7D1]"
          >
            {next.cta}
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </section>

        {/* المستشار */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-white/70">
            <MessageCircle className="h-4 w-4 text-[#25D366]" /> مستشارك
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#38A7B4] to-[#247B84] text-lg font-black">
              {advisor.name.replace(/^(أ\.|د\.|م\.)\s*/, "").charAt(0)}
            </span>
            <div>
              <p className="font-black">{advisor.name}</p>
              <p className="text-xs text-[#6EC7D1]">{advisor.title}</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-6 text-white/50">آخر ملاحظة: «بداية موفقة — ركز على إنهاء دروس الدورة الأولى هذا الأسبوع.»</p>
          <AdvisorContact
            text={advisorMsg}
            label="راسل مستشارك"
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-[#25D366] py-2.5 text-sm font-black text-white hover:bg-[#25D366]/85"
          />
        </section>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* جدولي */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <CalendarDays className="h-4 w-4 text-[#FABC05]" /> جدولي — الجلسات القادمة
            </div>
            <span className="text-[11px] text-white/50">بتوقيت الرياض (GMT+3)</span>
          </div>
          <div className="mt-4 space-y-2.5">
            {sessions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${s.type === "live" ? "bg-[#FABC05]/15 text-[#FABC05]" : "bg-[#38A7B4]/15 text-[#6EC7D1]"}`}>
                    <Video className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">{s.title}</p>
                    <p className="text-[11px] text-white/45">{s.courseName} · {s.date} · {s.time}</p>
                  </div>
                </div>
                <Link
                  to={`/student/course/${s.courseId}`}
                  className="rounded-full border border-[#38A7B4]/40 px-4 py-1.5 text-xs font-bold text-[#6EC7D1] transition hover:bg-[#38A7B4] hover:text-[#08272B]"
                >
                  التفاصيل والانضمام
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* الإشعارات */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <Bell className="h-4 w-4 text-[#FABC05]" /> الإشعارات
            </div>
            {unread > 0 && <span className="rounded-full bg-[#FABC05] px-2 py-0.5 text-[10px] font-black text-[#0D0D0D]">{unread} جديد</span>}
          </div>
          <div className="mt-4 space-y-2.5">
            {state.notifications.slice(0, 4).map((n) => (
              <p key={n.id} className={`rounded-xl border px-3 py-2.5 text-xs leading-6 ${n.read ? "border-white/5 text-white/50" : "border-[#38A7B4]/25 bg-[#38A7B4]/5 text-white/75"}`}>
                {n.text}
              </p>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* مهاراتي: الحالي مقابل المستهدف */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm font-bold text-white/70">
            <TrendingUp className="h-4 w-4 text-[#6EC7D1]" /> مهاراتي — الحالي مقابل المستهدف (0–5)
          </div>
          <div className="mt-4 space-y-3">
            {skills.map((s) => (
              <div key={s.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">{s.name}</span>
                  <span className="text-white/45">{s.current} / {s.target}</span>
                </div>
                <div className="mt-1.5 flex gap-1">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <span
                      key={lvl}
                      className={`h-2 flex-1 rounded-full ${
                        lvl <= s.current ? "bg-[#38A7B4]" : lvl <= s.target ? "bg-white/10" : "bg-white/5"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-white/55">{s.evidence}</p>
              </div>
            ))}
          </div>
        </section>

        {/* التوصيات + الدعم */}
        <section className="space-y-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-white/70">
              <Lightbulb className="h-4 w-4 text-[#FABC05]" /> توصيات لك — ولماذا
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
          <Link to="/student/pathway" className="block rounded-3xl border border-[#38A7B4]/30 bg-[#38A7B4]/5 p-5 transition hover:border-[#38A7B4]/60">
            <div className="flex items-center gap-2 text-sm font-bold text-[#6EC7D1]">
              <BookOpen className="h-4 w-4" /> خريطة مساري الكاملة
            </div>
            <p className="mt-2 text-xs leading-6 text-white/55">الدورات وحالاتها وقواعد الفتح ومشروع التخرج</p>
          </Link>
          <a href="mailto:support@wajeez.com" className="block rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/30">
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
        <CheckCircle2 className="h-3.5 w-3.5 text-[#38A7B4]" />
      </p>
    </PortalLayout>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CalendarClock, ClipboardCheck, GraduationCap, Loader2, ServerOff, Users, Video } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { apiGet } from "@/services/api";
import { trainerInterviewUrl } from "@/application/trainer/application-options";
import TrainerWorkQueue from "@/components/TrainerWorkQueue";
import AtRiskList from "@/components/AtRiskList";
import { buildWorkQueue } from "@/application/trainer/work-queue";
import { findAtRisk } from "@/application/trainer/at-risk";
import { useRealSession } from "@/services/session";
import { fmtDateTimeAr } from "@/utils/format";
import { countAr } from "@/application/text/count-ar";

import { Panel, Card } from "@/components/ui/Surface";
import ProgressRing from "@/components/ui/ProgressRing";
/* صيغةُ العدد لا تُرتجل في السطر: «و1 طالباً» نصبٌ في غير موضعه يقرؤه
   المدرّب في كلّ دخول. */
const COHORT_FORMS = { one: "شعبة", two: "شعبتان", few: "شعب", many: "شعبة" } as const;
const STUDENT_FORMS = { one: "طالب", two: "طالبان", few: "طلاب", many: "طالبا" } as const;

/* ── الصفحة الحقيقية للمدرب المسجّل — من الخادم مباشرة، بلا بيانات استعراض ── */

/* النوع يطابق ما يعيده /api/trainer/my-cohorts فعلا — كان ناقصا الحضور
   والتقدم والتقييمات وروابط الجلسة، وهي ما يبنى عليه ف-١ وف-٢. */
interface RealCohort {
  role: string;
  cohort: {
    id: string; title: string; status: string;
    course: { versions: { titleAr: string }[] };
    sessions: {
      id: string; title: string; startsAt: string; endsAt: string | null; status: string;
      zoom: { joinUrl: string; learnerUrl: string | null } | null;
      recordings: { id: string }[];
      /* لا حضور على الجلسة: الخادم يعيده داخل كل تسجيل */
    }[];
    enrollments: {
      id: string; status: string;
      user: { displayName: string; email: string };
      courseProgress: { percent: number } | null;
      attendance: { sessionId: string; status: string }[];
    }[];
    assessments: {
      id: string; title: string; type: string; dueAt: string | null; status: string;
      submissions: { enrollmentId: string; status: string }[];
    }[];
  };
}
interface RealQueueItem { id: string; status: string }
/** موجزُ الشعبة كما يعطيه `/api/trainer/cohorts/summary` — الدالّةُ نفسُها التي تحسب قائمةَ صفحة الشعبة */
interface CohortSummary {
  id: string; title: string; courseTitle: string; planStatus: string; done: number; total: number;
  next: { key: string; labelAr: string } | null;
}

function RealTrainerHome({ name, email }: { name: string; email: string }) {
  const [cohorts, setCohorts] = useState<RealCohort[] | null>(null);
  const [queue, setQueue] = useState<RealQueueItem[] | null>(null);
  const [summary, setSummary] = useState<CohortSummary[]>([]);
  const [failed, setFailed] = useState(false);
  /* طلبُ اجتماعٍ مع الإدارة — يُطوى حتّى يُطلب، فالإطارُ ثقيلٌ على لوحةٍ تُفتح كلَّ يوم */
  const [meetingOpen, setMeetingOpen] = useState(false);
  /* نبضة كل دقيقة: «جلستك الآن» تتغيّر مع الوقت بلا إعادة تحميل.
     القيمة في حالة لا في الرسم — Date.now() في الرسم غير نقي. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Promise.all([
      apiGet<RealCohort[]>("/api/trainer/my-cohorts"),
      apiGet<RealQueueItem[]>("/api/trainer/grading-queue"),
      /* الموجزُ رفاهيةٌ فوق الأساس: غيابُه لا يُسقط اللوحة */
      apiGet<CohortSummary[]>("/api/trainer/cohorts/summary").catch(() => [] as CohortSummary[]),
    ])
      .then(([c, q, s]) => { setCohorts(c); setQueue(q); setSummary(s); })
      .catch(() => setFailed(true));
  }, []);

  if (failed)
    return (
      <Card className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <ServerOff className="h-5 w-5" /> تعذر جلب شعبك — تأكد أن الخادم يعمل ثم حدّث الصفحة.
      </Card>
    );
  if (!cohorts || !queue)
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> أحضر شعبك…
      </div>
    );

  /* ف-١ وف-٢: كلاهما من نفس الردّين — بلا نقطة نهاية جديدة */
  const work = buildWorkQueue(cohorts, queue.filter((q) => q.status === "submitted" || q.status === "under_review").length, now);
  const atRisk = findAtRisk(cohorts, now);

  const students = cohorts.reduce((n, c) => n + c.cohort.enrollments.length, 0);
  const awaiting = queue.filter((q) => q.status === "submitted" || q.status === "under_review").length;
  const nowIso = new Date(now).toISOString();
  const upcoming = cohorts
    .flatMap((c) => c.cohort.sessions.filter((s) => s.startsAt > nowIso && s.status !== "done").map((s) => ({ ...s, cohortTitle: c.cohort.title, cohortId: c.cohort.id })))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 4);

  /* جلساتُ الأسبوع — رقمٌ في الشريط لا قائمةٌ ثانية */
  const weekEnd = new Date(now + 7 * 86_400_000).toISOString();
  const weekSessions = cohorts.reduce((n, c) => n + c.cohort.sessions.filter((s) => s.startsAt > nowIso && s.startsAt < weekEnd && s.status !== "done").length, 0);

  return (
    <div>
      {/* ═══ الرأس: تحيّةٌ وأربعةُ أرقامٍ في شريطٍ واحد ═══

          قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): «بطاقاتُ الشعب أوّلا» — فالأرقامُ
          شريطٌ رفيعٌ في الرأس، والشعبُ بحلقاتها تحته مباشرة، ثمّ ما ينتظر عمله. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">أهلاً {name} — {cohorts.length > 0 ? `لديك ${countAr(cohorts.length, COHORT_FORMS)} و${countAr(students, STUDENT_FORMS)}.` : "لم تُسند إليك شعب بعد."}</p>
        <div className="flex flex-wrap gap-2">
          {[
            { icon: GraduationCap, label: "شعبي", value: cohorts.length, to: "/trainer/board", warn: false },
            { icon: Users, label: "طلابي", value: students, to: "/trainer/learners", warn: false },
            { icon: ClipboardCheck, label: "تنتظر تقييمي", value: awaiting, to: "/trainer/grading", warn: awaiting > 0 },
            { icon: Video, label: "جلسات هذا الأسبوع", value: weekSessions, to: "/trainer/schedule", warn: false },
          ].map((k) => (
            <Card as={Link} interactive key={k.label} to={k.to} tone={k.warn ? "warn" : "default"} className="flex items-center gap-2.5 px-3.5 py-2">
              <k.icon className={`h-4 w-4 ${k.warn ? "text-gold-ink" : "text-teal-light-ink"}`} aria-hidden="true" />
              <span className={`text-lg font-black tabular-nums ${k.warn ? "text-gold-ink" : "text-foreground"}`}>{k.value}</span>
              <span className="text-read text-muted-foreground">{k.label}</span>
            </Card>
          ))}
        </div>
      </div>

      {/* بطاقة إرشاد المدرب الجديد — بوابة بلا شعب تشرح ما يحدث تاليا بدل أن تكتفي بأصفار */}
      {cohorts.length === 0 && (
        <Panel as="section" tone="accent" className="mb-8">
          <p className="flex items-center gap-2 text-sm font-black"><GraduationCap className="h-4 w-4 text-teal-light-ink" /> بوابتك جاهزة — هذا ما يحدث تالياً</p>
          <div className="mt-4 grid gap-3 text-xs leading-6 text-foreground sm:grid-cols-3">
            <Card className="bg-paper/20">
              <p className="font-black text-teal-light-ink">١ · الإسناد</p>
              <p className="mt-1">الإدارة تسند إليك شعبة من شاشة «الشعب» — يصلك إشعار فور الإسناد.</p>
            </Card>
            <Card className="bg-paper/20">
              <p className="font-black text-teal-light-ink">٢ · التجهيز على مراحل</p>
              <p className="mt-1">تفتح صفحةَ الشعبة فتجد مراحلَها على خطّ: الاسمُ والمواعيد، والمحاور، والمصادر، واللقاءات، والتكاليف، ثمّ الاعتماد.</p>
            </Card>
            <Card className="bg-paper/20">
              <p className="font-black text-teal-light-ink">٣ · التشغيل</p>
              <p className="mt-1">باعتماد الإدارة تنتقل إلى التشغيل: الحضورُ والموادُّ والتسليمات والرسائل — من الصفحة نفسِها.</p>
            </Card>
          </div>
        </Panel>
      )}

      {/* ═══ شعبي — بطاقةٌ لكلٍّ بحلقة تجهيزها وخطوتها التالية ═══ */}
      {summary.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-black"><GraduationCap className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> شعبي</h2>
            <Link to="/trainer/board" className="text-read font-bold text-teal-light-ink hover:text-foreground">كلُّها</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {summary.map((c) => {
              const ready = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
              const approved = c.planStatus === "approved" || c.planStatus === "published";
              return (
                <Card as={Link} interactive key={c.id} to={`/trainer/cohort/${c.id}`} tone={approved ? "positive" : c.planStatus === "changes_requested" ? "warn" : "default"} className="flex items-center gap-3.5">
                  <ProgressRing value={ready} label={`${c.done}/${c.total}`} size={56} stroke={5} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-read font-black text-foreground">{c.title}</span>
                    <span className="block truncate text-read text-muted-foreground">{c.courseTitle}</span>
                    <span className="mt-1 block text-read leading-5 text-teal-light-ink">
                      {approved ? "معتمَدة — في التشغيل" : c.next ? `التالي: ${c.next.labelAr}` : "التجهيزُ مكتمل"}
                    </span>
                  </span>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ف-١ · طابور العمل — أول ما يراه المدرب صار قابلا للتنفيذ لا مجرد أرقام */}
      {cohorts.length > 0 && <TrainerWorkQueue items={work} className="mb-6" />}

      {/* ف-٢ · من يحتاج تدخلك — أهم معلومة عند المدرب ولم تكن معروضة */}
      {cohorts.length > 0 && <AtRiskList learners={atRisk} className="mb-6" />}

      <Panel as="section">
        <p className="flex items-center gap-2 text-sm font-black"><Video className="h-4 w-4 text-teal-ink" /> جلساتي القادمة</p>
        <div className="mt-3 space-y-2">
          {upcoming.length === 0 && <p className="py-3 text-center text-read text-muted-foreground">لا جلسات قادمة مجدولة</p>}
          {upcoming.map((s) => (
            <Card as={Link} interactive key={s.id} to={`/trainer/cohort/${s.cohortId}`} className="flex items-center gap-3 px-4 py-2.5 text-xs transition hover:border-white/30">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-foreground">{s.title}</p>
                <p className="mt-0.5 truncate text-read text-muted-foreground">{s.cohortTitle}</p>
              </div>
              <span className="shrink-0 text-fine font-bold text-muted-foreground">
                {fmtDateTimeAr(s.startsAt)}
              </span>
            </Card>
          ))}
        </div>
      </Panel>

      {/* ═══ اجتماعٌ مع الإدارة — بنقرة، داخل الصفحة، وفي الذيل لا الصدر ═══

          قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): لا مهامَّ تهيئةٍ هنا — ما يلزم
          المدرّبَ يُقال له في كلّ شعبةٍ في موضعها. وبدلَها بابٌ يسأل منه: من
          لم يفهم شيئا يحجز موعدا من التقويم نفسِه الذي يحجز منه المتقدّمون. */}
      <Panel as="section" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-black"><CalendarClock className="h-4 w-4 text-teal-light-ink" /> تريد أن تسأل أو تفهم شيئا؟ احجز اجتماعا مع الإدارة</p>
          <button type="button" aria-expanded={meetingOpen} onClick={() => setMeetingOpen((v) => !v)} className="btn-outline-brand h-10 px-5">
            {meetingOpen ? "أغلق التقويم" : "اختر موعدا"}
          </button>
        </div>
        {meetingOpen && (
          <div className="mt-4 overflow-hidden rounded-xl bg-white">
            <iframe
              src={`${trainerInterviewUrl({ name, email })}${trainerInterviewUrl({ name, email }).includes("?") ? "&" : "?"}embed_domain=${encodeURIComponent(window.location.hostname)}&embed_type=Inline`}
              title="حجز اجتماع مع الإدارة"
              loading="lazy"
              style={{ border: "none" }}
              className="block h-[680px] w-full"
            />
          </div>
        )}
      </Panel>

      <p className="mt-6 text-center text-read text-muted-foreground">
        كل بند أعلاه يقودك إلى مكان تنفيذه — وصفحةُ كلّ شعبةٍ تحمل تجهيزَها وتشغيلَها معا.
      </p>
    </div>
  );
}


/* حُذفت لوحة المحاكاة (كانت من `export default` إلى آخر الملف): شعبٌ وطلابٌ
   وتسليماتٌ وقائمةُ تهيئةٍ تُولَّد في المتصفّح لهويّة مدرّبٍ مختلَقة، وتُعرض
   متى وُجدت تلك الهوية في localStorage — أي دائما بعد أول اختيار. */
/* الإطار على الصفحة الأولى أيضا — وكان غائبا عنها وحدها.

   هي أوّل ما يهبط عليه المدرب بعد الدخول، وكانت تُصيَّر عارية: بلا تبويبات
   ولا جرس إشعارات ولا بحث ولا خروج. فمن دخل بوابته وقف في غرفةٍ بلا أبواب،
   ولا يبلغ «طابور التقييم» ولا «مستحقّاتي» إلا بكتابة المسار بيده. والشاشات
   الخمس الأخرى كانت تحمل الإطار كاملا — فالعطب في هذه وحدها. */
export default function TrainerDashboard() {
  const { user, checked } = useRealSession();
  return (
    <TrainerLayout title="الرئيسية">
      {checked
        ? <RealTrainerHome name={user?.displayName ?? ""} email={user?.email ?? ""} />
        : <div className="grid place-items-center py-24"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="يُحمَّل" /></div>}
    </TrainerLayout>
  );
}

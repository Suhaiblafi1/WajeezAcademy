import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, Circle, ClipboardCheck, GitPullRequest, GraduationCap, ListChecks, Loader2, ServerOff, Users, Video } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { apiGet, apiPost } from "@/services/api";
import TrainerWorkQueue from "@/components/TrainerWorkQueue";
import AtRiskList from "@/components/AtRiskList";
import { buildWorkQueue } from "@/application/trainer/work-queue";
import { findAtRisk } from "@/application/trainer/at-risk";
import { useRealSession } from "@/services/session";
import { fmtDateTimeAr } from "@/utils/format";
import { countAr } from "@/application/text/count-ar";

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

function RealTrainerHome({ name }: { name: string }) {
  const [cohorts, setCohorts] = useState<RealCohort[] | null>(null);
  const [queue, setQueue] = useState<RealQueueItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  /* مهام التهيئة الحقيقية من ملف المدرب. كانت الصفحة تعرض مهاما من localStorage
     (بيانات استعراض) بينما مهامه الفعلية في TrainerOnboardingTask لا يقرؤها أحد
     ولا يملك أحد طريقا لإغلاقها — أربع مهام تُزرع عند القبول وتبقى معلّقة أبدا. */
  const [tasks, setTasks] = useState<{ key: string; title: string; doneAt: string | null }[]>([]);
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
    ])
      .then(([c, q]) => { setCohorts(c); setQueue(q); })
      .catch(() => setFailed(true));
    apiGet<{ onboardingTasks?: { key: string; title: string; doneAt: string | null }[] }>("/api/trainer/me")
      .then((me) => setTasks(me.onboardingTasks ?? []))
      .catch(() => { /* المهام رفاهية — غيابها لا يمنع الشعب */ });
  }, []);

  const completeTask = async (key: string) => {
    try {
      await apiPost(`/api/trainer/me/onboarding-tasks/${encodeURIComponent(key)}/complete`, {});
      setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, doneAt: new Date().toISOString() } : t)));
    } catch { /* الرسالة تظهر عند إعادة التحميل — لا نخترع نجاحا */ }
  };

  if (failed)
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-muted-foreground">
        <ServerOff className="h-5 w-5" /> تعذر جلب شعبك — تأكد أن الخادم يعمل ثم حدّث الصفحة.
      </div>
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
    .flatMap((c) => c.cohort.sessions.filter((s) => s.startsAt > nowIso && s.status !== "done").map((s) => ({ ...s, cohortTitle: c.cohort.title })))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 4);

  return (
    <div>
      <p className="mb-6 text-sm text-muted-foreground">أهلاً {name} — {cohorts.length > 0 ? `لديك ${countAr(cohorts.length, COHORT_FORMS)} و${countAr(students, STUDENT_FORMS)}.` : "لم تُسند إليك شعب بعد."}</p>

      {/* بطاقة إرشاد المدرب الجديد — بوابة بلا شعب تشرح ما يحدث تاليا بدل أن تكتفي بأصفار */}
      {cohorts.length === 0 && (
        <section className="mb-8 rounded-3xl border border-teal/30 bg-teal/[0.06] p-6">
          <p className="flex items-center gap-2 text-sm font-black"><GraduationCap className="h-4 w-4 text-teal-light-ink" /> بوابتك جاهزة — هذا ما يحدث تالياً</p>
          <div className="mt-4 grid gap-3 text-xs leading-6 text-foreground sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-paper/20 p-4">
              <p className="font-black text-teal-light-ink">١ · الإسناد</p>
              <p className="mt-1">الإدارة تسند إليك شعبة من شاشة «الشعب» — يصلك إشعار فور الإسناد.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-paper/20 p-4">
              <p className="font-black text-teal-light-ink">٢ · الظهور التلقائي</p>
              <p className="mt-1">تظهر شعبتك وجلساتها وطلابها هنا وفي شاشة «شعبي» دون أي إجراء منك.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-paper/20 p-4">
              <p className="font-black text-teal-light-ink">٣ · بدء العمل</p>
              <p className="mt-1">تسجّل الحضور وتقيّم التسليمات وتدير الجلسات — كلها من «شعبي».</p>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            حتى يصلك أول إسناد يمكنك مراجعة المحتوى واقتراح تحسينات عليه من{" "}
            <Link to="/trainer/proposals" className="font-bold text-teal-light-ink underline decoration-dotted underline-offset-4 hover:text-foreground">«اقتراحاتي»</Link>.
          </p>
        </section>
      )}

      {/* مهام تهيئتك — من ملفك عند الخادم لا من هذا الجهاز */}
      {tasks.length > 0 && tasks.some((t) => !t.doneAt) && (
        <section className="mb-8 rounded-3xl border border-teal/25 bg-teal/[0.05] p-6">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-black">
              <ListChecks className="h-4 w-4 text-teal-light-ink" /> مهام تهيئتك كمدرب
            </p>
            <span className="text-xs font-bold text-teal-light-ink">
              {tasks.filter((t) => t.doneAt).length} / {tasks.length}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-teal transition-all"
              style={{ width: `${(tasks.filter((t) => t.doneAt).length / tasks.length) * 100}%` }} />
          </div>
          <div className="mt-4 space-y-2">
            {tasks.map((t) => {
              /* توقيع العقد يُغلق بواقعة موثقة لا بإقرار صاحبه — فلا زر له */
              const selfCompletable = t.key !== "sign_contract" && !t.doneAt;
              return (
                <button
                  key={t.key}
                  onClick={selfCompletable ? () => void completeTask(t.key) : undefined}
                  disabled={!selfCompletable}
                  className={`flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-paper/20 px-4 py-3 text-right transition ${
                    selfCompletable ? "cursor-pointer hover:border-teal/40" : "cursor-default"
                  }`}
                >
                  {t.doneAt
                    ? <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-teal-ink" />
                    : <Circle className="h-4.5 w-4.5 shrink-0 text-muted-foreground/50" />}
                  <span className={`text-sm ${t.doneAt ? "text-muted-foreground line-through" : "font-bold text-foreground"}`}>{t.title}</span>
                  {!t.doneAt && t.key === "sign_contract" && (
                    <span className="mr-auto text-micro font-bold text-muted-foreground">يُغلق بتوقيع العقد</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-[11px] text-muted-foreground">
        <span className="font-black text-foreground">من أين أبدأ؟</span>
        {/* الترقيمُ لاتينيّ كبقيّة أرقام البوّابة — لا رسمان في بطاقةٍ واحدة */}
        {[
          { key: "open", label: "افتح شعبتك", to: "/trainer/board" },
          { key: "attend", label: "سجّل حضور الجلسة", to: "/trainer/board" },
          { key: "grade", label: "قيّم التسليمات", to: "/trainer/grading" },
        ].map((s, i) => (
          <span key={s.key} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" className="text-muted-foreground/50">←</span>}
            {/* `py-1` كان يعطي سبعا وعشرين بكسلا — هدفٌ يُخطئه الإصبعُ على
                الهاتف. والحدُّ المتعارف عليه أربعٌ وأربعون، وستٌّ وثلاثون
                أقلُّ ما يُقبل في شريطٍ داخليّ. */}
            <Link to={s.to} className="flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 font-bold transition hover:border-gold/60 hover:text-gold-ink">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-gold/15 text-micro text-gold-ink">{i + 1}</span>
              {s.label}
            </Link>
          </span>
        ))}
      </div>

      {/* ف-١ · طابور العمل — أول ما يراه المدرب صار قابلا للتنفيذ لا مجرد أرقام */}
      {cohorts.length > 0 && <TrainerWorkQueue items={work} className="mb-6" />}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Link to="/trainer/board" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/30">
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><GraduationCap className="h-4 w-4" /> شعبي</p>
          <p className="mt-2 text-3xl font-black">{cohorts.length}</p>
        </Link>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-4 w-4" /> طلابي</p>
          <p className="mt-2 text-3xl font-black">{students}</p>
        </div>
        <Link to="/trainer/board" className={`rounded-2xl border p-5 transition hover:border-white/30 ${awaiting > 0 ? "border-gold/40 bg-gold/5" : "border-white/10 bg-white/[0.03]"}`}>
          <p className="flex items-center gap-2 text-xs text-gold-ink"><ClipboardCheck className="h-4 w-4" /> تسليمات بانتظار تقييمي</p>
          <p className="mt-2 text-3xl font-black text-gold-ink">{awaiting}</p>
        </Link>
        <Link to="/trainer/proposals" className="rounded-2xl border border-teal/30 bg-teal/5 p-5 transition hover:border-teal/60">
          <p className="flex items-center gap-2 text-xs text-teal-light-ink"><GitPullRequest className="h-4 w-4" /> اقتراحاتي على المحتوى</p>
          <p className="mt-2 text-3xl font-black text-teal-light-ink">↗</p>
        </Link>
      </div>

      {/* ف-٢ · من يحتاج تدخلك — أهم معلومة عند المدرب ولم تكن معروضة */}
      {cohorts.length > 0 && <AtRiskList learners={atRisk} className="mt-6" />}

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <p className="flex items-center gap-2 text-sm font-black"><Video className="h-4 w-4 text-teal-ink" /> جلساتي القادمة</p>
        <div className="mt-3 space-y-2">
          {upcoming.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">لا جلسات قادمة مجدولة</p>}
          {upcoming.map((s) => (
            <Link key={s.id} to="/trainer/board" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs transition hover:border-white/30">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-foreground">{s.title}</p>
                <p className="mt-0.5 truncate text-micro text-muted-foreground">{s.cohortTitle}</p>
              </div>
              <span className="shrink-0 text-micro font-bold text-muted-foreground">
                {fmtDateTimeAr(s.startsAt)}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        كل بند أعلاه يقودك إلى مكان تنفيذه — والتفاصيل الكاملة لكل شعبة في شاشة «شعبي».
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
        ? <RealTrainerHome name={user?.displayName ?? ""} />
        : <div className="grid place-items-center py-24"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="يُحمَّل" /></div>}
    </TrainerLayout>
  );
}

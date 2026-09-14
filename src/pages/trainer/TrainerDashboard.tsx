import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CalendarClock, GraduationCap, Loader2, Send, ServerOff, Video } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { apiGet } from "@/services/api";
import { trainerInterviewUrl } from "@/application/trainer/application-options";
import TrainerWorkQueue from "@/components/TrainerWorkQueue";
import AtRiskList from "@/components/AtRiskList";
import { buildWorkQueue } from "@/application/trainer/work-queue";
import { findAtRisk } from "@/application/trainer/at-risk";
import { buildUpcoming } from "@/application/trainer/upcoming";
import { useRealSession } from "@/services/session";
import { fmtDayMonth, fmtTime } from "@/application/text/format-ar";
import { countAr } from "@/application/text/count-ar";

import { Panel, Card, Inset } from "@/components/ui/Surface";
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
  /* التخطيطُ لا العمل: ما بَعُد عن نافذة الطابور وحدَه — والقسمةُ محروسةٌ في
     `src/tests/trainer/upcoming.test.ts` كي لا تعود جلسةٌ تظهر في اللوحتين. */
  const planAhead = buildUpcoming(cohorts, now);

  /* ما تنتظر إرسالَه: المسودّةُ والمردودةُ وحدَهما — والمعتمَدةُ والمرسَلةُ
     ليست عليه. والعددُ لا يُرى في أيّ تبويب: يلزم فتحُ كلّ شعبةٍ لمعرفته. */
  const waitingToSubmit = summary.filter((c) => c.planStatus === "draft" || c.planStatus === "changes_requested").length;

  return (
    <div>
      {/* ═══ الرأس: تحيّةٌ وإشارتان لا تُريهما التبويبات ═══

          كانت أربعَ بطاقاتٍ تشير إلى **المقاصد الأربعة نفسِها** التي في
          شريط التبويبات فوقها: «شعبي» و«طلابي» و«تنتظر تقييمي» و«جلسات
          هذا الأسبوع» — أي الروابطُ ذاتُها مرّتين في شاشةٍ واحدة. وقالها
          صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «مبعثرة… وفيها معلوماتٌ سهلةُ
          الوصول للمدرّب في التبويبات أعلاه».

          فحُذفت، وبقي في موضعها ما **لا** يُرى في تبويبٍ ولا في قسمٍ أسفلَ
          الصفحة: كم شعبةً تنتظر إرسالَه للاعتماد — ولا يُعرف إلّا بفتح كلِّ
          شعبةٍ على حدة. والأعدادُ التي حُذفت لم تضِع: التحيّةُ تقولها نثرا.

          ولم تُوضع بجانبها «أقربُ جلسة»: طابورُ العمل تحتها يعرض الجلسةَ
          القريبةَ بزرِّ دخولها، و«جلساتي القادمة» تعرض ما بَعُد — فبطاقةٌ
          ثالثةٌ تقولها تكرارٌ ثالث، وهو عينُ ما حُذف من أجله الأربعة.

          ⚠ وعدّادُ «كم سجّل عبر رابطك» هو المؤشّرُ الذي طلبه صاحبُ المنصّة،
          ويحتاج رابطا على مستوى المدرّب لا على مستوى الشعبة (المرحلة «أ» من
          خطّة المسار) — فلا يُختلق هنا رقمٌ لا مصدرَ له. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">أهلاً {name} — {cohorts.length > 0 ? `لديك ${countAr(cohorts.length, COHORT_FORMS)} و${countAr(students, STUDENT_FORMS)}.` : "لم تُسند إليك شعب بعد."}</p>
        <div className="flex flex-wrap gap-2">
          {waitingToSubmit > 0 && (
            <Card as={Link} interactive to="/trainer/board" tone="warn" className="flex items-center gap-2.5 px-3.5 py-2">
              <Send className="h-4 w-4 text-gold-ink" aria-hidden="true" />
              <span className="text-read font-bold text-gold-ink">{countAr(waitingToSubmit, COHORT_FORMS)} تنتظر إرسالَك للاعتماد</span>
            </Card>
          )}
        </div>
      </div>

      {/* ═══ ولماذا سقطت بطاقاتُ «بوّابتك جاهزة» ═══

          كانت ثلاثَ بطاقاتٍ تشرح ما يحدث تاليا (الإسنادُ · التجهيزُ على مراحل
          · التشغيل) لمن لم تُسند إليه شعبةٌ بعد. وقرارُ صاحب المنصّة (١٣
          سبتمبر ٢٠٢٦): تُحذف وتبقى الصفحة. فالشرحُ يسبق العمل، ومن لا شعبةَ
          له لا ينفعه شرحُ مراحلِ شعبةٍ لا يراها — ومن أُسندت إليه يجدها في
          «شعبي» أدناه فيتعلّمها منها. وسطرُ «لم تُسند إليك شعب بعد» أعلاه
          يقول حالَه بلا ثلاث بطاقات. */}

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

      {/* ═══ ولماذا لم يعد الرابطُ هنا ═══

          كان بطاقةً في هذه الصفحة بين طابور العمل وجلساتِه القادمة، فيراه
          مرّةً يومَ أُسندت إليه شعبتُه ثمّ لا يعود إليه. وقرارُ صاحب المنصّة
          (١٣ سبتمبر ٢٠٢٦): تبويبٌ خاصٌّ به بعد «ما قيل عنّي» — وهو
          `pages/trainer/Referral.tsx`. فنُقل ولم يُكرَّر: نسختان منه تفترقان
          يوما، ويُقرأ الرقمُ فيهما مختلفا. */}

      {/* ف-١ · طابور العمل — أول ما يراه المدرب صار قابلا للتنفيذ لا مجرد أرقام */}
      {cohorts.length > 0 && <TrainerWorkQueue items={work} className="mb-6" />}

      {/* ف-٢ · من يحتاج تدخلك — أهم معلومة عند المدرب ولم تكن معروضة */}
      {cohorts.length > 0 && <AtRiskList learners={atRisk} className="mb-6" />}

      {/* ═══ جلساتي القادمة — للتخطيط لا للعمل ═══

          كانت تعيد ما في الطابور أعلاه بصيغةٍ أضعف: الجلسةُ نفسُها بسطرين،
          ومعها في الطابور زرُّ دخولٍ وهنا رابطٌ إلى الشعبة. فصارت لما بَعُد
          عن نافذته وحدَه: أيّامٌ معنونةٌ يُخطَّط عليها، بلا رابطِ اجتماعٍ —
          فلا أحدَ يدخل جلسةً بعد ثلاثةِ أيّام، والرابطُ فعلٌ عاجلٌ مكانُه
          الطابور. والقاعدةُ تُقال للمدرّب تحت العنوان كي يعرف لمَ لا يرى
          جلسةَ الغد هنا. */}
      <Panel as="section">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-black"><Video className="h-4 w-4 text-teal-ink" aria-hidden="true" /> جلساتي القادمة</p>
          <Link to="/trainer/schedule" className="text-read font-bold text-teal-light-ink hover:text-foreground">جدولي كاملا</Link>
        </div>
        <p className="mt-1 text-read text-muted-foreground">ما هو أبعدُ من يوم — وأقربُ منه تجده في «ما ينتظرك الآن» أعلاه بزرِّ دخوله.</p>

        {planAhead.length === 0 ? (
          <Inset as="p" className="mt-4 px-4 py-6 text-center text-read text-muted-foreground">
            لا جلساتٍ مجدولةً بعد يومك — وما كان خلال يومٍ فمكانُه الطابورُ أعلاه.
          </Inset>
        ) : (
          <div className="mt-4 space-y-4">
            {planAhead.map((d) => (
              <div key={d.dayOffset}>
                <p className="mb-2 flex flex-wrap items-baseline gap-x-2 text-read font-black text-teal-light-ink">
                  {d.labelAr}
                  <span className="font-bold text-muted-foreground">{fmtDayMonth(d.sessions[0].startsAt)}</span>
                </p>
                <ul className="space-y-2">
                  {d.sessions.map((s) => (
                    <Card as="li" key={s.id} className="p-0">
                      <Link to={`/trainer/cohort/${s.cohortId}`} className="flex items-center gap-3 px-4 py-2.5 text-xs transition hover:text-teal-light-ink">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-foreground">{s.titleAr}</span>
                          <span className="mt-0.5 block truncate text-read text-muted-foreground">{s.cohortTitleAr}</span>
                        </span>
                        <span className="shrink-0 text-fine font-bold tabular-nums text-muted-foreground">
                          {fmtTime(s.startsAt)}
                        </span>
                      </Link>
                    </Card>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
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

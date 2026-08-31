/* صفحة الدورة بالمحطات — على البيانات الحقيقية وحدها.
   ------------------------------------------------------------------
   حلّت محلّ `CourseView` المحذوفة، وكانت تبني الدروس والتقدّم والتسليم من
   متجر محاكاة في المتصفّح. هنا: الوحدات من الكتالوج المنشور، وحالتُها من
   `moduleProgress` في تسجيل المتعلم — وهي حالةٌ لا تُكتب إلا بدليل (تسليمٌ
   مقبول، أو تقييمٌ مجتاز، أو حضورُ جلسة الوحدة). لا زرَّ «أنهيتُها» يضغطه
   المتعلم على نفسه.

   والمحطات مرتّبة، والحالية مفتوحة وما بعدها مطويّ — لكن **لا يُمنع الاطلاع
   المسبق**: إكمالُ الوحدة يحتاج دليلا من مدرّب أو جلسة، فقفلُ قراءتها خلفه
   يحبس المتعلم بلا فائدة. الترتيب يوجّه، والدليل يُكمل. */

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { BookOpen, CheckCircle2, ChevronDown, Circle, FileText, Loader2, Play, Target } from "lucide-react";
import PortalLayout from "./PortalLayout";
import CourseTitle from "@/components/CourseTitle";
import { splitLessons } from "@/application/content/lesson-split";
import { parseChecks } from "@/application/content/module-checks";
import { countAr } from "@/application/text/count-ar";
import { usePublishedContent } from "@/services/public-content";
import { useRealSession } from "@/services/session";
import { apiGet } from "@/services/api";
import { courseById, courseFullById } from "@/data/courses";

interface Row {
  id: string;
  status: string;
  cohort: { title: string; course: { id: string } | null } | null;
  courseProgress: { percent: number } | null;
}
interface Detail {
  id: string;
  moduleProgress: { moduleId: string; status: string; completedAt: string | null }[];
  courseProgress: { percent: number } | null;
}

export default function CourseMilestones() {
  const { courseId = "" } = useParams();
  const catalogVersion = usePublishedContent();
  const { user: sessionUser, checked } = useRealSession();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    if (!sessionUser) return;
    let on = true;
    apiGet<Row[]>("/api/learner/my-learning")
      .then((r) => { if (on) setRows(r); })
      .catch(() => { if (on) setRows([]); });
    return () => { on = false; };
  }, [sessionUser]);

  const row = useMemo(
    () => (rows ?? []).find((r) => r.cohort?.course?.id === courseId) ?? null,
    [rows, courseId],
  );

  useEffect(() => {
    if (!row) return;
    let on = true;
    apiGet<Detail>(`/api/learner/enrollments/${row.id}`)
      .then((d) => { if (on) setDetail(d); })
      .catch(() => undefined);
    return () => { on = false; };
  }, [row]);

  const course = courseById(courseId);
  const full = useMemo(() => { void catalogVersion; return courseFullById(courseId); }, [courseId, catalogVersion]);

  if (!checked || (sessionUser && rows === null)) {
    return (
      <PortalLayout title="الدورة">
        <div className="grid place-items-center py-24"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="يُحمَّل" /></div>
      </PortalLayout>
    );
  }

  if (!course || !full) {
    return (
      <PortalLayout title="الدورة">
        <p className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/60">
          هذه الدورة غير موجودة في الكتالوج المنشور.
        </p>
      </PortalLayout>
    );
  }

  if (!row) return <NotEnrolled name={course.name} termEn={course.termEn} />;

  const doneIds = new Set((detail?.moduleProgress ?? []).filter((m) => m.status === "completed").map((m) => m.moduleId));
  const currentIndex = full.modules.findIndex((m) => !doneIds.has(m.id));
  const percent = detail?.courseProgress?.percent ?? row.courseProgress?.percent ?? 0;

  return (
    <PortalLayout title="الدورة">
      <section className="rounded-3xl border border-teal/30 bg-gradient-to-b from-teal/[0.07] to-transparent p-6">
        <CourseTitle as="h2" name={course.name} termEn={course.termEn} className="text-xl font-black leading-snug" />
        {full.shortPromise && <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">{full.shortPromise}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/50">
          <span>{row.cohort?.title}</span>
          <span>·</span>
          <span>{doneIds.size} من {full.modules.length} محطة مكتملة</span>
          <span>·</span>
          <span>{full.totalHours} ساعة</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${Math.max(2, percent)}%` }} />
        </div>
        {currentIndex === -1 && full.modules.length > 0 ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-teal/40 bg-teal/10 px-4 py-2.5 text-sm font-bold text-teal-light-ink">
            <CheckCircle2 className="h-4 w-4" /> أكملت محطات هذه الدورة — بقي مشروعها ثم شهادتها.
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-white/45">
            المحطة تكتمل بدليل — تسليمٌ يقبله مدرّبك، أو تقييمٌ تجتازه، أو حضورُ جلستها. لا تُعلَّم مكتملةً بضغطة.
          </p>
        )}
      </section>

      <ol className="mt-6 space-y-3">
        {full.modules.map((m, i) => (
          <Milestone
            /* المفتاح يحمل «الحالية»: تقدّمُ التسجيل يصل بعد أوّل تصيير، فلو
               بقي المفتاح ثابتا لبقيت المحطة الأولى مفتوحةً وهي مكتملة، ولظلّت
               الحاليةُ مطويّة. تغيّرُ المفتاح يعيد التركيب فتُفتح الصحيحة. */
            key={`${m.id}-${i === currentIndex}`}
            index={i}
            module={m}
            done={doneIds.has(m.id)}
            current={i === currentIndex}
            prevTitle={i > 0 ? full.modules[i - 1].title : null}
            courseId={courseId}
          />
        ))}
      </ol>

      {full.practicalProject && (
        <section className="mt-6 rounded-3xl border border-gold/25 bg-gold/[0.05] p-6">
          <h3 className="flex items-center gap-2 text-sm font-black text-gold-ink"><Target className="h-4 w-4" /> مشروع الدورة</h3>
          <p className="mt-2 text-sm leading-7 text-white/70">{full.practicalProject}</p>
        </section>
      )}
    </PortalLayout>
  );
}

function NotEnrolled({ name, termEn }: { name: string; termEn?: string | null }) {
  return (
    <PortalLayout title="الدورة">
      <section className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.03] py-16 text-center">
        <BookOpen className="h-12 w-12 text-white/40" />
        <CourseTitle as="h2" name={name} termEn={termEn} className="mt-5 text-xl font-black" />
        <p className="mt-3 max-w-md text-sm leading-7 text-white/60">
          هذه الدورة ليست ضمن شعبك الحالية، فمحطاتها لا تُفتح لك. تصفّح الشعب
          المفتوحة واطلب التسجيل فيها.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link to="/student/pathway" className="rounded-full bg-teal px-6 py-3 font-black text-on-teal transition hover:bg-teal-light">
            الشعب المفتوحة
          </Link>
          <Link to="/student/learning" className="rounded-full border border-white/15 px-6 py-3 font-bold text-white/80 hover:border-white/40">
            دوراتي
          </Link>
        </div>
      </section>
    </PortalLayout>
  );
}

const MIN_FORMS = { one: "دقيقة", two: "دقيقتان", few: "دقائق", many: "دقيقة" } as const;
const LESSON_FORMS = { one: "درس", two: "درسان", few: "دروس", many: "درسا" } as const;
const CHECK_FORMS = { one: "تمرين", two: "تمرينان", few: "تمارين", many: "تمرينا" } as const;

type Mod = { id: string; title: string; outcome: string; activity: string; artifact: string; hours: number; body: string | null; checks: string | null; video: string | null; scenario: string | null };

function Milestone({ index, module: m, done, current, prevTitle, courseId }: {
  index: number; module: Mod; done: boolean; current: boolean; prevTitle: string | null; courseId: string;
}) {
  /* الحالية مفتوحة، وما عداها مطويّ — والفتح متاح لمن أراد الاطلاع مسبقا */
  const [open, setOpen] = useState(current);
  const lessons = useMemo(() => splitLessons(m.body), [m.body]);
  const checkCount = useMemo(() => parseChecks(m.checks).checks.filter((c) => c.chapterIndex === null).length, [m.checks]);
  const hasContent = !!(m.body || m.checks || m.scenario || m.video);

  return (
    <li className={`overflow-hidden rounded-3xl border transition ${
      done ? "border-teal/50 bg-teal/[0.04]" : current ? "border-teal/60 bg-white/[0.04]" : "border-white/10 bg-white/[0.02]"
    }`}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-4 p-5 text-right"
      >
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-sm font-black ${
          done ? "bg-teal text-on-teal" : current ? "bg-teal/20 text-teal-light-ink" : "bg-white/5 text-white/50"
        }`}>
          {done ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-black leading-snug ${done || current ? "" : "text-white/70"}`}>{m.title}</span>
          <span className="mt-0.5 block text-[11px] text-white/45">{m.hours} ساعة · {m.outcome}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {done ? (
            <span className="rounded-full border border-teal/50 px-3 py-1 text-[11px] font-bold text-teal-ink">مكتملة</span>
          ) : current ? (
            <span className="flex items-center gap-1 rounded-full bg-teal px-3 py-1 text-[11px] font-black text-on-teal">
              <Play className="h-3 w-3" /> ابدأ من هنا
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-white/40"><Circle className="h-3 w-3" /> لم تبدأ</span>
          )}
          <ChevronDown className={`h-4 w-4 text-white/40 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="border-t border-white/10 p-5 pt-4">
          {!done && !current && prevTitle && (
            <p className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[11px] leading-5 text-white/50">
              ترتيبها بعد «{prevTitle}» — تستطيع الاطلاع عليها الآن، وإكمالها يحتاج دليلها.
            </p>
          )}

          {/* المحطة تُعرّف بما فيها وتُفتح في مشغّلها — لا تُفرَغ هنا.

              كان المتنُ كلُّه والتمارينُ والسيناريو تنهال داخل الأكورديون:
              ألفا كلمةٍ في عمودٍ واحد بلا تقدّمٍ ولا توقّف. فصفحةُ الدورة
              الآن خريطةٌ تُقرأ في نصف دقيقة، والدراسةُ في شاشةٍ لها. */}
          {lessons.length > 0 ? (
            <>
              <ol className="space-y-2">
                {lessons.map((l) => (
                  <li key={l.index} className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal/15 text-[10px] font-black tabular-nums text-teal-light-ink">
                      {l.index}
                    </span>
                    <span className="min-w-0 flex-1 text-xs font-bold leading-6">{l.title || "تمهيد"}</span>
                    {l.minutes > 0 && <span className="shrink-0 text-[10px] text-white/35">{countAr(l.minutes, MIN_FORMS)}</span>}
                  </li>
                ))}
              </ol>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
                <span>{countAr(lessons.length, LESSON_FORMS)}</span>
                {checkCount > 0 && <span>· {countAr(checkCount, CHECK_FORMS)} استرجاع</span>}
                {m.scenario && <span>· سيناريو قرار</span>}
                {m.video && <span>· فيديو</span>}
              </p>
              <Link
                to={`/student/course/${courseId}/module/${m.id}`}
                className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-teal px-6 py-3 text-sm font-black text-on-teal transition hover:bg-teal-light"
              >
                {done ? "راجع الوحدة" : current ? "ابدأ الوحدة" : "اطّلع على الوحدة"}
                <Play className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-xs leading-6 text-white/50">
              لم يُضَف متن هذه الوحدة بعد. عنوانها ونشاطها وناتجها أدناه، ويظهر المتن هنا فور كتابته.
            </p>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] font-black text-white/60">نشاطك في هذه المحطة</p>
              <p className="mt-1.5 text-xs leading-6 text-white/70">{m.activity}</p>
            </div>
            <div className="rounded-2xl border border-gold/25 bg-gold/[0.05] p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-black text-gold-ink"><FileText className="h-3 w-3" /> ما تخرج به</p>
              <p className="mt-1.5 text-xs leading-6 text-white/70">{m.artifact}</p>
            </div>
          </div>

          {!hasContent && (
            <p className="mt-4 text-[11px] text-white/40">هذه المحطة معرَّفة بناتجها ونشاطها، ومادّتها قيد الكتابة.</p>
          )}
        </div>
      )}
    </li>
  );
}

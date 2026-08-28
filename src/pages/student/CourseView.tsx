import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft, ArrowRight, Award, CheckCircle2, ClipboardList, FileUp,
  HelpCircle, Lock, MessageSquare, Send, Upload, Video, Loader2, BookOpen} from "lucide-react";
import PortalLayout from "./PortalLayout";
import { hasShowcaseCatalog, showcasePathwayId } from "@/data/showcase";
import { usePublishedContent } from "@/services/public-content";
import SimulationNote from "@/components/SimulationNote";
import VideoPlayer from "@/components/VideoPlayer";
import LessonBody from "@/components/LessonBody";
import ModuleCheck from "@/components/ModuleCheck";
import DecisionScenario from "@/components/DecisionScenario";
import ModuleVideo from "@/components/ModuleVideo";
import CourseResources from "@/components/CourseResources";
import { getEnrollment } from "@/services/access";
import { pathways, pathwayById } from "@/data/pathways";
import { courseById, courseDetails, courseTrainer, pathwayCourses } from "@/data/courses";
import {
  courseGate, courseLessons, isCourseComplete,
  loadPortal, maybeOpenProject, savePortal, type PortalState,
} from "@/data/student";

/* ⚠ الكتالوج كسول (ع-١): الجسم خلف حالة تحميل، ويُعاد تركيبه بمفتاح نسخته. */
export default function CourseView() {
  const catalogVersion = usePublishedContent();
  if (!hasShowcaseCatalog()) {
    return (
      <PortalLayout title="الدورة">
        <div className="grid place-items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="جارٍ تحميل الكتالوج" />
        </div>
      </PortalLayout>
    );
  }
  return <CourseViewBody key={catalogVersion} />;
}

function CourseViewBody() {
  const { courseId } = useParams();
  const course = courseById(courseId ?? "");
  const enrollment = getEnrollment();
  const pathwayId = enrollment?.pathwayId
    ?? pathways.find((p) => (pathwayCourses[p.id] ?? []).includes(courseId ?? ""))?.id
    ?? course?.pathwayId
    ?? showcasePathwayId()!;
  const pathway = pathwayById(pathwayId);

  const [state, setState] = useState<PortalState>(() => loadPortal(pathwayId));
  const [activeLesson, setActiveLesson] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string[]>([]);

  const gate = course ? courseGate(pathwayId, course.id, state) : null;
  const progress = course ? state.courses[course.id] : null;
  const lessons = useMemo(() => (course ? courseLessons(course) : []), [course]);
  const details = course ? courseDetails(course) : null;
  const trainer = course ? courseTrainer(course) : null;

  const update = (fn: (s: PortalState) => void) => {
    setState((prev) => {
      const next: PortalState = JSON.parse(JSON.stringify(prev));
      fn(next);
      maybeOpenProject(next);
      savePortal(next);
      return next;
    });
  };

  if (!course || !progress || !gate || !details || !trainer) {
    return (
      <PortalLayout title="دورة غير موجودة">
        <Link to="/student/pathway" className="flex items-center gap-2 text-teal-light-ink"><ArrowRight className="h-4 w-4" /> عودة لمساري</Link>
      </PortalLayout>
    );
  }

  if (gate.status === "locked") {
    return (
      <PortalLayout title={course.name}>
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <Lock className="h-12 w-12 text-white/25" />
          <h2 className="mt-4 text-xl font-black">هذه الدورة مقفلة</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">{gate.lockReason}</p>
          <Link to="/student/pathway" className="mt-6 rounded-full bg-teal px-6 py-3 font-black text-on-teal hover:bg-teal-light">
            عودة لخريطة مساري
          </Link>
        </div>
      </PortalLayout>
    );
  }

  const lesson = lessons[activeLesson];
  const lessonPct = progress.lessons[lesson.id]?.pct ?? 0;
  const complete = isCourseComplete(course, progress);

  const submitAssignment = (fileName: string) => {
    update((s) => {
      const cp = s.courses[course.id];
      cp.assignment = { status: "under_review", fileName };
      s.notifications.unshift({ id: `n-${Date.now()}`, text: `استلمنا واجب «${course.name}» — يراجعه ${trainer.name} خلال 72 ساعة.`, kind: "grade", read: false });
    });
    /* لا اعتماد آليّ. كان هنا مؤقّتٌ من ١٢ ثانية يقلب الحالة إلى «معتمد»
       بدرجة ٨٨ وملاحظةٍ نصّية منسوبةٍ إلى المدرّب بالاسم — أي حكمٌ بشريّ
       مخترع. الاعتماد لا يأتي إلا من طابور تقييم المدرّب. */
  };

  /* إعادة التسليم — بعد طلب المدرب فقط (حالة revision)، كما في POST /api/learner/assessments/:id/resubmit */
  const resubmitAssignment = (fileName: string) => {
    update((s) => {
      const cp = s.courses[course.id];
      cp.assignment = { status: "under_review", fileName };
      s.notifications.unshift({ id: `n-${Date.now()}`, text: `استلمنا نسختك المعدلة من واجب «${course.name}» — يعيد ${trainer.name} مراجعتها.`, kind: "grade", read: false });
    });
  };

  return (
    <PortalLayout title={course.name}>
      <SimulationNote what="محتوى الدورة" />
      {/* نظرة عامة */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-teal-light-ink">من مسار «{pathway?.name}»</p>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/60">{details.outcome}</p>
          </div>
          <div className="text-left text-xs text-white/50">
            <p>المدرب: <span className="font-bold text-white/80">{trainer.name}</span></p>
            <p className="mt-1">{course.weeks} {course.weeks === 1 ? "أسبوع" : "أسابيع"} · {course.skill}</p>
          </div>
        </div>
        {complete && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-teal/40 bg-teal/10 px-4 py-2.5 text-sm font-bold text-teal-light-ink">
            <CheckCircle2 className="h-4 w-4" /> أُكملت هذه الدورة — شهادتها في صفحة شهاداتي
          </p>
        )}
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* العمود الرئيسي */}
        <div className="space-y-5 lg:col-span-2">
          {/* الدرس الحالي */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-black">
                {lesson.body ? <BookOpen className="h-4 w-4 text-teal-light-ink" /> : <Video className="h-4 w-4 text-teal-light-ink" />}
                {lesson.title}
              </h3>
              <span className="text-[11px] text-white/50">
                {lesson.hours ? `${lesson.hours} ساعة` : `${lesson.minutes} د`}
                {" · "}
                {lesson.body ? "درس نصي" : lesson.kind === "video" ? "فيديو" : "نشاط تطبيقي"}
              </span>
            </div>
            {!lesson.body && (
              <p className="mt-1.5 text-xs leading-6 text-white/50">
                {lesson.kind === "activity"
                  ? `نشاط تطبيقي: طبّق «${lesson.title}» على حالة من واقعك ووثّق النتيجة — سترفقها في واجب الدورة.`
                  : `درس مرئي يشرح «${lesson.title}» خطوة بخطوة مع أمثلة من واقع العمل.`}
              </p>
            )}
            {/* البند ح-١: متن الدرس من الكتالوج المنشور. لا مشغّل ولا تقدم آلي —
                القراءة يعلنها المتعلم بنفسه، فلا نزعم قياس ما لا نقيسه. */}
            {lesson.body ? (
              <div className="mt-4">
                {/* ح-٢: الفيديو بفصوله ونقاط تفتيشه — قبل المتن، فالمشاهدة تسبق القراءة */}
                {lesson.video && (
                  <ModuleVideo raw={lesson.video} checksRaw={lesson.checks} moduleId={lesson.id} className="mb-6" />
                )}
                <LessonBody body={lesson.body} />
                {/* ح-٥: سيناريو القرار بعد المتن وقبل الاسترجاع — يُطبَّق ما قُرئ
                    على موقف مهني، ثم يُسترجَع. التطبيق قبل التثبيت. */}
                {lesson.scenario && <DecisionScenario raw={lesson.scenario} moduleId={lesson.id} className="mt-6" />}
                {/* ح-٣: الاسترجاع بعد القراءة مباشرة — لا كواجب منفصل */}
                {lesson.checks && <ModuleCheck raw={lesson.checks} moduleId={lesson.id} className="mt-6" />}
                <button
                  onClick={() => update((s) => { s.courses[course.id].lessons[lesson.id] = { pct: lessonPct >= 100 ? 0 : 100 }; })}
                  className={`mt-5 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-black transition ${
                    lessonPct >= 100
                      ? "border border-teal/50 bg-teal-ink/10 text-teal-light-ink"
                      : "bg-teal text-on-teal hover:bg-teal-light"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {lessonPct >= 100 ? "أنهيت هذا الدرس — تراجع؟" : "أنهيت قراءة الدرس"}
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <VideoPlayer
                  key={lesson.id}
                  lessonId={lesson.id}
                  minutes={lesson.minutes}
                  initialPct={lessonPct}
                  onProgress={(pct) => update((s) => { s.courses[course.id].lessons[lesson.id] = { pct }; })}
                />
              </div>
            )}
            {/* قائمة الدروس */}
            <div className="mt-4 space-y-1.5">
              {lessons.map((l, i) => {
                const p = progress.lessons[l.id]?.pct ?? 0;
                return (
                  <button
                    key={l.id}
                    onClick={() => setActiveLesson(i)}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-xl border px-4 py-2.5 text-right text-sm transition ${
                      i === activeLesson ? "border-teal/50 bg-teal/10" : "border-white/10 hover:border-white/25"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {p >= 90 ? <CheckCircle2 className="h-4 w-4 text-teal-ink" /> : <span className="grid h-4 w-4 place-items-center rounded-full border border-white/25 text-[9px]">{i + 1}</span>}
                      {l.title}
                    </span>
                    <span className="text-[11px] text-white/50">{p}%</span>
                  </button>
                );
              })}
            </div>
            {/* الانتقال التلقائي للدرس التالي عند اكتمال الحالي */}
            {lessonPct >= 90 && activeLesson < lessons.length - 1 && (
              <button
                onClick={() => setActiveLesson(activeLesson + 1)}
                className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-teal py-3 text-sm font-black text-on-teal transition hover:bg-teal-light"
              >
                الدرس التالي: {lessons[activeLesson + 1].title}
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {lessonPct >= 90 && activeLesson === lessons.length - 1 && (
              <p className="mt-4 flex items-center justify-center gap-2 rounded-full border border-gold/40 bg-gold/5 py-3 text-sm font-bold text-gold-ink">
                <CheckCircle2 className="h-4 w-4" /> أنهيت كل الدروس — بقي تطبيقك العملي بالأسفل
              </p>
            )}
          </section>

          {/* الاختبار: لا يُعرض حتى يوجد اختبار حقيقي في المنهج.
              كان هنا اختبارٌ من أربعة أسئلة تُركَّب قالبيا من اسم الدورة،
              بدرجة نجاح ٧٠٪ وثلاث محاولات، ونتيجتُه «تغذي ملف مهاراتك». */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="flex items-center gap-2 font-black"><HelpCircle className="h-4 w-4 text-white/40" /> اختبار الدورة</h3>
            <p className="mt-3 text-sm leading-7 text-white/55">
              لم يُضَف بعد اختبارٌ لهذه الدورة. حين يضعه مدرّبها سيظهر هنا،
              ودرجتُك فيه تُحتسب ضمن تقدّمك.
            </p>
          </section>

          {/* الواجب العملي */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="flex items-center gap-2 font-black"><ClipboardList className="h-4 w-4 text-teal-light-ink" /> التطبيق العملي — يُراجعه مدربك بشريا</h3>
            <p className="mt-2 text-sm leading-7 text-white/55">
              طبّق ما تعلمته على حالة من واقعك، وارفع ملفك (PDF/عرض/صورة). المعيار: وضوح المشكلة، تطبيق المنهجية، جودة المخرج.
            </p>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (progress.assignment.status === "revision") resubmitAssignment(f.name);
                else submitAssignment(f.name);
                e.target.value = "";
              }}
            />
            {progress.assignment.status === "none" ? (
              <div className="mt-4">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 py-8 text-sm font-bold text-white/60 transition hover:border-teal/60 hover:text-teal-light-ink"
                >
                  <Upload className="h-5 w-5" /> ارفع واجبك هنا
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                  <FileUp className="h-4 w-4 text-teal-light-ink" />
                  {progress.assignment.fileName}
                  <span className={`mr-auto rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                    progress.assignment.status === "approved" ? "bg-teal/20 text-teal-light-ink" : "bg-gold/15 text-gold-ink"
                  }`}>
                    {progress.assignment.status === "approved" ? `معتمد — ${progress.assignment.grade}%` : progress.assignment.status === "revision" ? "يحتاج تعديلا" : "قيد المراجعة"}
                  </span>
                </p>
                {progress.assignment.feedback && (
                  <div className="rounded-xl border border-teal/25 bg-teal/5 p-4">
                    <p className="text-xs font-bold text-teal-light-ink">ملاحظات {trainer.name}:</p>
                    <p className="mt-1.5 text-sm leading-7 text-white/70">{progress.assignment.feedback}</p>
                  </div>
                )}
                {progress.assignment.status === "revision" && (
                  <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
                    <p className="text-xs leading-6 text-gold-ink">
                      طلب مدربك إعادة التسليم — زر إعادة الرفع لا يظهر إلا بعد طلبه، تماما كما يفرضه الخادم.
                    </p>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gold/40 py-5 text-sm font-bold text-gold-ink transition hover:bg-gold/10"
                    >
                      <Upload className="h-4 w-4" /> ارفع النسخة المعدلة
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* أسئلة للمدرب */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="flex items-center gap-2 font-black"><MessageSquare className="h-4 w-4 text-teal-light-ink" /> اسأل مدربك</h3>
            <p className="mt-1.5 text-xs text-white/45">سؤالك مرتبط بهذه الدورة ويصل {trainer.name} مباشرة — وقت الاستجابة المستهدف 24 ساعة.</p>
            <div className="mt-3 flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="اكتب سؤالك هنا…"
                className="flex-1 rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
              />
              <button
                onClick={() => { if (question.trim()) { setAsked([question.trim(), ...asked]); setQuestion(""); } }}
                className="cursor-pointer rounded-xl bg-teal px-4 text-on-teal transition hover:bg-teal-light"
                aria-label="إرسال"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {asked.map((q, i) => (
              <p key={i} className="mt-2.5 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-xs leading-6 text-white/70">
                {q} <span className="block text-[10px] text-white/55">أُرسل — سيصلك الرد إشعارا</span>
              </p>
            ))}
          </section>
        </div>

        {/* العمود الجانبي */}
        <div className="space-y-5">
          {/* حُذف قسم «الجلسات المباشرة (Zoom)». كان يعرض جلستين مخترعتين
              بتاريخ محسوب ووقت ثابت وحالة «مؤكدة»، وزرَّ انضمامٍ يسجّل الحضور
              تلقائيا. مواعيدُ لا وجود لها في أي شعبة. جلسات الشعبة الحقيقية
              في /api/learner/enrollments/:id وتُعرض في «تعلّمي». */}

          {/* مصادر الدورة — تبويبات تُشتق من البيانات المتاحة فقط، بلا أنواع فارغة */}
          <CourseResources
            courseId={course.id}
            savedQuiz={progress.bookQuiz}
            onQuizPass={(book, score) => update((s) => {
              s.courses[course.id].bookQuiz[book.id] = { passed: true, score };
              s.notifications.unshift({ id: `n-${Date.now()}`, text: `أُضيف ملخص «${book.title}» لملفك بدرجة ${score}%`, kind: "content", read: false });
            })}
          />

          {/* شهادة الدورة */}
          <section className="rounded-3xl border border-gold/25 bg-gold/5 p-6">
            <h3 className="flex items-center gap-2 text-sm font-black text-gold-ink"><Award className="h-4 w-4" /> شهادة الدورة</h3>
            {/* لا سكّ شهادة من المتصفّح. كان الزر يستدعي `issueCertificate`
                فيولّد رقما عشوائيا في localStorage — رقمٌ لا يجتاز التحقق
                العام. الإصدار من الإدارة بعد اعتماد المدرّب. */}
            {complete ? (
              <Link to="/student/certificates" className="mt-3 block rounded-full bg-gold py-2.5 text-center text-sm font-black text-on-gold transition hover:bg-gold/90">
                استوفيت الشروط — تابع حالة شهادتك
              </Link>
            ) : (
              <p className="mt-2 text-xs leading-6 text-white/55">
                تصدر بعد: إكمال الدروس (90%+) وتسليم تطبيقك العملي واعتماد مدرّبك له. لا شهادة مشاهدة عندنا.
              </p>
            )}
          </section>
        </div>
      </div>
    </PortalLayout>
  );
}

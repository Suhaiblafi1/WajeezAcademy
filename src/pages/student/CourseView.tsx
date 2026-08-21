import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft, ArrowRight, Award, CheckCircle2, ClipboardList, FileUp,
  HelpCircle, Lock, MessageSquare, Send, Upload, Video, XCircle,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import SimulationNote from "@/components/SimulationNote";
import VideoPlayer from "@/components/VideoPlayer";
import CourseResources from "@/components/CourseResources";
import { getEnrollment } from "@/services/access";
import { zoom, type ZoomJoinInfo } from "@/services/zoom";
import { pathways, pathwayById } from "@/data/pathways";
import { courseById, courseDetails, courseTrainer, pathwayCourses } from "@/data/courses";
import {
  courseGate, courseLessons, courseQuiz, courseSessions, isCourseComplete,
  loadPortal, maybeOpenProject, savePortal, QUIZ_PASS, QUIZ_MAX_ATTEMPTS,
  issueCertificate, readUserName, type PortalState,
} from "@/data/student";

export default function CourseView() {
  const { courseId } = useParams();
  const course = courseById(courseId ?? "");
  const enrollment = getEnrollment();
  const pathwayId = enrollment?.pathwayId
    ?? pathways.find((p) => (pathwayCourses[p.id] ?? []).includes(courseId ?? ""))?.id
    ?? course?.pathwayId
    ?? pathways[0].id;
  const pathway = pathwayById(pathwayId);

  const [state, setState] = useState<PortalState>(() => loadPortal(pathwayId));
  const [zoomInfo, setZoomInfo] = useState<Record<string, ZoomJoinInfo>>({});
  const [activeLesson, setActiveLesson] = useState(0);
  const [quizOn, setQuizOn] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string[]>([]);

  const gate = course ? courseGate(pathwayId, course.id, state) : null;
  const progress = course ? state.courses[course.id] : null;
  const lessons = useMemo(() => (course ? courseLessons(course) : []), [course]);
  const quiz = useMemo(() => (course ? courseQuiz(course) : []), [course]);
  const sessions = useMemo(() => (course ? courseSessions(course, new Date(state.startedAt)) : []), [course, state.startedAt]);
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

  const submitQuiz = () => {
    const correct = quiz.filter((q, i) => quizAnswers[i] === q.correct).length;
    const score = Math.round((correct / quiz.length) * 100);
    const passed = score >= QUIZ_PASS;
    setQuizResult({ score, passed });
    update((s) => {
      const cp = s.courses[course.id];
      cp.quiz = { attempts: cp.quiz.attempts + 1, best: Math.max(cp.quiz.best, score), passed: cp.quiz.passed || passed };
    });
  };

  const submitAssignment = (fileName: string) => {
    update((s) => {
      const cp = s.courses[course.id];
      cp.assignment = { status: "under_review", fileName };
      s.notifications.unshift({ id: `n-${Date.now()}`, text: `استلمنا واجب «${course.name}» — يراجعه ${trainer.name} خلال 72 ساعة.`, kind: "grade", read: false });
    });
    // محاكاة المراجعة البشرية بعد لحظات
    window.setTimeout(() => {
      update((s) => {
        const cp = s.courses[course.id];
        if (cp.assignment.status === "under_review") {
          cp.assignment = { status: "approved", fileName, grade: 88, feedback: "عمل متقن — طبقت المنهجية بدقة. لاحظ التعليق على المحور الثاني لتطويره في الدورة القادمة." };
          s.notifications.unshift({ id: `n-${Date.now() + 1}`, text: `اعتُمد واجب «${course.name}» بدرجة 88 — اقرأ ملاحظات مدربك.`, kind: "grade", read: false });
        }
      });
    }, 12000);
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
              <h3 className="flex items-center gap-2 font-black"><Video className="h-4 w-4 text-teal-light-ink" /> {lesson.title}</h3>
              <span className="text-[11px] text-white/50">{lesson.minutes} د · {lesson.kind === "video" ? "فيديو" : "نشاط تطبيقي"}</span>
            </div>
            <p className="mt-1.5 text-xs leading-6 text-white/50">
              {lesson.kind === "activity"
                ? `نشاط تطبيقي: طبّق «${lesson.title}» على حالة من واقعك ووثّق النتيجة — سترفقها في واجب الدورة.`
                : `درس مرئي يشرح «${lesson.title}» خطوة بخطوة مع أمثلة من واقع العمل.`}
            </p>
            <div className="mt-4">
              <VideoPlayer
                key={lesson.id}
                lessonId={lesson.id}
                minutes={lesson.minutes}
                initialPct={lessonPct}
                onProgress={(pct) => update((s) => { s.courses[course.id].lessons[lesson.id] = { pct }; })}
              />
            </div>
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
            {lessonPct >= 90 && activeLesson === lessons.length - 1 && !progress.quiz.passed && (
              <p className="mt-4 flex items-center justify-center gap-2 rounded-full border border-gold/40 bg-gold/5 py-3 text-sm font-bold text-gold-ink">
                <CheckCircle2 className="h-4 w-4" /> أنهيت كل الدروس — اختبار الدورة بانتظارك بالأسفل
              </p>
            )}
          </section>

          {/* الاختبار النهائي */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-black"><HelpCircle className="h-4 w-4 text-gold-ink" /> اختبار الدورة</h3>
              <span className="text-[11px] text-white/50">نجاح من {QUIZ_PASS}% · {QUIZ_MAX_ATTEMPTS} محاولات</span>
            </div>
            {progress.quiz.passed ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-teal/40 bg-teal/10 px-4 py-3 text-sm font-bold text-teal-light-ink">
                <CheckCircle2 className="h-4 w-4" /> اجتزت الاختبار بأفضل درجة {progress.quiz.best}%
              </p>
            ) : !quizOn ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-white/55">
                  {progress.quiz.attempts > 0
                    ? `آخر محاولة: ${progress.quiz.best}% — تبقى ${QUIZ_MAX_ATTEMPTS - progress.quiz.attempts} محاولات`
                    : `${quiz.length} أسئلة تقيس فهمك الفعلي — النتيجة تغذي ملف مهاراتك`}
                </p>
                <button
                  onClick={() => { setQuizOn(true); setQuizAnswers({}); setQuizResult(null); }}
                  disabled={progress.quiz.attempts >= QUIZ_MAX_ATTEMPTS}
                  className="cursor-pointer rounded-full bg-gold px-5 py-2.5 text-sm font-black text-on-gold transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {progress.quiz.attempts > 0 ? "أعد المحاولة" : "ابدأ الاختبار"}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {quiz.map((q, i) => (
                  <div key={i} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-bold leading-7">{i + 1}. {q.q}</p>
                    <div className="mt-2.5 grid gap-1.5">
                      {q.options.map((op, j) => {
                        const chosen = quizAnswers[i] === j;
                        const revealed = quizResult !== null;
                        const isCorrect = q.correct === j;
                        return (
                          <button
                            key={j}
                            disabled={revealed}
                            onClick={() => setQuizAnswers({ ...quizAnswers, [i]: j })}
                            className={`cursor-pointer rounded-lg border px-3 py-2 text-right text-xs transition disabled:cursor-default ${
                              revealed && isCorrect ? "border-teal bg-teal/15 text-teal-light-ink"
                              : revealed && chosen && !isCorrect ? "border-red-500/60 bg-red-500/10 text-red-300"
                              : chosen ? "border-teal/60 bg-teal/10" : "border-white/10 hover:border-white/25"
                            }`}
                          >
                            {op}
                          </button>
                        );
                      })}
                    </div>
                    {quizResult && <p className="mt-2 text-[11px] leading-5 text-white/45">{q.explain}</p>}
                  </div>
                ))}
                {!quizResult ? (
                  <button
                    onClick={submitQuiz}
                    disabled={Object.keys(quizAnswers).length < quiz.length}
                    className="w-full cursor-pointer rounded-full bg-gold py-3 font-black text-on-gold transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    سلّم الإجابات
                  </button>
                ) : (
                  <div className={`rounded-2xl border p-4 text-center ${quizResult.passed ? "border-teal/50 bg-teal/10" : "border-red-500/40 bg-red-500/10"}`}>
                    <p className="flex items-center justify-center gap-2 text-lg font-black">
                      {quizResult.passed ? <CheckCircle2 className="h-5 w-5 text-teal-ink" /> : <XCircle className="h-5 w-5 text-red-400" />}
                      {quizResult.score}% — {quizResult.passed ? "ناجح! أحسنت" : "لم تبلغ درجة النجاح بعد"}
                    </p>
                    {!quizResult.passed && (
                      <button onClick={() => { setQuizOn(false); }} className="mt-3 cursor-pointer rounded-full border border-white/20 px-5 py-2 text-xs font-bold hover:border-white/40">
                        راجع الدروس ثم حاول مجددا
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
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
          {/* الجلسات المباشرة — زووم */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="flex items-center gap-2 text-sm font-black"><Video className="h-4 w-4 text-gold-ink" /> الجلسات المباشرة (Zoom)</h3>
            <div className="mt-4 space-y-3">
              {sessions.map((s) => (
                <div key={s.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-bold">{s.title}</p>
                  <p className="mt-1 text-[11px] text-white/45">{s.date} · {s.time} · بتوقيت الرياض</p>
                  {zoomInfo[s.id] ? (
                    <a
                      href={zoomInfo[s.id].joinUrl}
                      target="_blank" rel="noreferrer"
                      onClick={() => update((st) => { st.courses[course.id].attendance = "present"; })}
                      className="mt-3 block rounded-full bg-[#2D8CFF] py-2 text-center text-xs font-black text-white transition hover:bg-[#2D8CFF]/85"
                    >
                      انضم عبر Zoom — {zoomInfo[s.id].meetingId}
                    </a>
                  ) : (
                    <button
                      onClick={() => zoom.getJoinInfo(s.id).then((info) => setZoomInfo({ ...zoomInfo, [s.id]: info }))}
                      className="mt-3 w-full cursor-pointer rounded-full border border-[#2D8CFF]/50 py-2 text-xs font-bold text-[#2D8CFF] transition hover:bg-[#2D8CFF]/10"
                    >
                      أظهر رابط الانضمام
                    </button>
                  )}
                  <p className="mt-2 text-[10px] text-white/30">الانضمام يُسجل حضورك تلقائيا · التسجيل يُنشر بعد المراجعة</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-white/50">
              الحضور: {progress.attendance === "present" ? <span className="font-bold text-teal-light-ink">حاضر ✓</span> : "لم يُسجل بعد"}
            </p>
          </section>

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
            {complete ? (
              <Link
                to="/student/certificates"
                onClick={() => issueCertificate(readUserName(), course.name, "course")}
                className="mt-3 block rounded-full bg-gold py-2.5 text-center text-sm font-black text-on-gold transition hover:bg-gold/90"
              >
                شهادتك جاهزة — اعرضها
              </Link>
            ) : (
              <p className="mt-2 text-xs leading-6 text-white/55">
                تصدر بعد: إكمال الدروس (90%+) + اجتياز الاختبار + تسليم الواجب. لا شهادة مشاهدة عندنا.
              </p>
            )}
          </section>
        </div>
      </div>
    </PortalLayout>
  );
}

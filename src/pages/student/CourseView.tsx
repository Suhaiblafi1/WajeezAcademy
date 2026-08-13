import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowRight, Award, BookOpen, CheckCircle2, ClipboardList, FileUp,
  HelpCircle, Lock, MessageSquare, Send, Upload, Video, XCircle,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import VideoPlayer from "@/components/VideoPlayer";
import { getEnrollment } from "@/services/access";
import { wajeezBooks, type BookSummary } from "@/services/wajeezBooks";
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
  const [books, setBooks] = useState<BookSummary[]>([]);
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

  useEffect(() => {
    if (!course) return;
    wajeezBooks.getBooksForCourse(course.id).then(setBooks).catch(() => setBooks([]));
  }, [course]);

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
        <Link to="/student/pathway" className="flex items-center gap-2 text-[#6EC7D1]"><ArrowRight className="h-4 w-4" /> عودة لمساري</Link>
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
          <Link to="/student/pathway" className="mt-6 rounded-full bg-[#38A7B4] px-6 py-3 font-black text-[#08272B] hover:bg-[#6EC7D1]">
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

  return (
    <PortalLayout title={course.name}>
      {/* نظرة عامة */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#6EC7D1]">من مسار «{pathway?.name}»</p>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/60">{details.outcome}</p>
          </div>
          <div className="text-left text-xs text-white/50">
            <p>المدرب: <span className="font-bold text-white/80">{trainer.name}</span></p>
            <p className="mt-1">{course.weeks} {course.weeks === 1 ? "أسبوع" : "أسابيع"} · {course.skill}</p>
          </div>
        </div>
        {complete && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-4 py-2.5 text-sm font-bold text-[#6EC7D1]">
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
              <h3 className="flex items-center gap-2 font-black"><Video className="h-4 w-4 text-[#6EC7D1]" /> {lesson.title}</h3>
              <span className="text-[11px] text-white/40">{lesson.minutes} د · {lesson.kind === "video" ? "فيديو" : "نشاط تطبيقي"}</span>
            </div>
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
                      i === activeLesson ? "border-[#38A7B4]/50 bg-[#38A7B4]/10" : "border-white/10 hover:border-white/25"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {p >= 90 ? <CheckCircle2 className="h-4 w-4 text-[#38A7B4]" /> : <span className="grid h-4 w-4 place-items-center rounded-full border border-white/25 text-[9px]">{i + 1}</span>}
                      {l.title}
                    </span>
                    <span className="text-[11px] text-white/40">{p}%</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* الاختبار النهائي */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-black"><HelpCircle className="h-4 w-4 text-[#FABC05]" /> اختبار الدورة</h3>
              <span className="text-[11px] text-white/40">نجاح من {QUIZ_PASS}% · {QUIZ_MAX_ATTEMPTS} محاولات</span>
            </div>
            {progress.quiz.passed ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-4 py-3 text-sm font-bold text-[#6EC7D1]">
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
                  className="cursor-pointer rounded-full bg-[#FABC05] px-5 py-2.5 text-sm font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:cursor-not-allowed disabled:opacity-40"
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
                              revealed && isCorrect ? "border-[#38A7B4] bg-[#38A7B4]/15 text-[#6EC7D1]"
                              : revealed && chosen && !isCorrect ? "border-red-500/60 bg-red-500/10 text-red-300"
                              : chosen ? "border-[#38A7B4]/60 bg-[#38A7B4]/10" : "border-white/10 hover:border-white/25"
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
                    className="w-full cursor-pointer rounded-full bg-[#FABC05] py-3 font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    سلّم الإجابات
                  </button>
                ) : (
                  <div className={`rounded-2xl border p-4 text-center ${quizResult.passed ? "border-[#38A7B4]/50 bg-[#38A7B4]/10" : "border-red-500/40 bg-red-500/10"}`}>
                    <p className="flex items-center justify-center gap-2 text-lg font-black">
                      {quizResult.passed ? <CheckCircle2 className="h-5 w-5 text-[#38A7B4]" /> : <XCircle className="h-5 w-5 text-red-400" />}
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
            <h3 className="flex items-center gap-2 font-black"><ClipboardList className="h-4 w-4 text-[#6EC7D1]" /> التطبيق العملي — يُراجعه مدربك بشريا</h3>
            <p className="mt-2 text-sm leading-7 text-white/55">
              طبّق ما تعلمته على حالة من واقعك، وارفع ملفك (PDF/عرض/صورة). المعيار: وضوح المشكلة، تطبيق المنهجية، جودة المخرج.
            </p>
            {progress.assignment.status === "none" ? (
              <div className="mt-4">
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) submitAssignment(f.name); }} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 py-8 text-sm font-bold text-white/60 transition hover:border-[#38A7B4]/60 hover:text-[#6EC7D1]"
                >
                  <Upload className="h-5 w-5" /> ارفع واجبك هنا
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                  <FileUp className="h-4 w-4 text-[#6EC7D1]" />
                  {progress.assignment.fileName}
                  <span className={`mr-auto rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                    progress.assignment.status === "approved" ? "bg-[#38A7B4]/20 text-[#6EC7D1]" : "bg-[#FABC05]/15 text-[#FABC05]"
                  }`}>
                    {progress.assignment.status === "approved" ? `معتمد — ${progress.assignment.grade}%` : progress.assignment.status === "revision" ? "يحتاج تعديلا" : "قيد المراجعة"}
                  </span>
                </p>
                {progress.assignment.feedback && (
                  <div className="rounded-xl border border-[#38A7B4]/25 bg-[#38A7B4]/5 p-4">
                    <p className="text-xs font-bold text-[#6EC7D1]">ملاحظات {trainer.name}:</p>
                    <p className="mt-1.5 text-sm leading-7 text-white/70">{progress.assignment.feedback}</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* أسئلة للمدرب */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="flex items-center gap-2 font-black"><MessageSquare className="h-4 w-4 text-[#6EC7D1]" /> اسأل مدربك</h3>
            <p className="mt-1.5 text-xs text-white/45">سؤالك مرتبط بهذه الدورة ويصل {trainer.name} مباشرة — وقت الاستجابة المستهدف 24 ساعة.</p>
            <div className="mt-3 flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="اكتب سؤالك هنا…"
                className="flex-1 rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none"
              />
              <button
                onClick={() => { if (question.trim()) { setAsked([question.trim(), ...asked]); setQuestion(""); } }}
                className="cursor-pointer rounded-xl bg-[#38A7B4] px-4 text-[#08272B] transition hover:bg-[#6EC7D1]"
                aria-label="إرسال"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {asked.map((q, i) => (
              <p key={i} className="mt-2.5 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-xs leading-6 text-white/70">
                {q} <span className="block text-[10px] text-white/35">أُرسل — سيصلك الرد إشعارا</span>
              </p>
            ))}
          </section>
        </div>

        {/* العمود الجانبي */}
        <div className="space-y-5">
          {/* الجلسات المباشرة — زووم */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="flex items-center gap-2 text-sm font-black"><Video className="h-4 w-4 text-[#FABC05]" /> الجلسات المباشرة (Zoom)</h3>
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
            <p className="mt-3 text-[11px] text-white/40">
              الحضور: {progress.attendance === "present" ? <span className="font-bold text-[#6EC7D1]">حاضر ✓</span> : "لم يُسجل بعد"}
            </p>
          </section>

          {/* كتب وجيز */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="flex items-center gap-2 text-sm font-black"><BookOpen className="h-4 w-4 text-[#6EC7D1]" /> ملخصات كتب وجيز لهذه الدورة</h3>
            <p className="mt-1.5 text-[11px] text-white/45">اسمع الملخص ثم اختبر نفسك فيه — جزء من إكمالك.</p>
            <div className="mt-4 space-y-3">
              {books.map((b) => {
                const done = progress.bookQuiz[b.id]?.passed;
                return (
                  <div key={b.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-bold">{b.title}</p>
                    <p className="mt-1 text-[11px] text-white/45">{b.author} · استماع {b.minutes} دقيقة · {b.quizQuestions} أسئلة</p>
                    <button
                      onClick={() => update((s) => { s.courses[course.id].bookQuiz[b.id] = { passed: true, score: 100 }; })}
                      disabled={!!done}
                      className={`mt-3 w-full cursor-pointer rounded-full py-2 text-xs font-black transition disabled:cursor-default ${
                        done ? "bg-[#38A7B4]/20 text-[#6EC7D1]" : "bg-[#38A7B4] text-[#08272B] hover:bg-[#6EC7D1]"
                      }`}
                    >
                      {done ? "اجتزت اختبار الملخص ✓" : "اسمع ثم اختبر نفسك"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* شهادة الدورة */}
          <section className="rounded-3xl border border-[#FABC05]/25 bg-[#FABC05]/5 p-6">
            <h3 className="flex items-center gap-2 text-sm font-black text-[#FABC05]"><Award className="h-4 w-4" /> شهادة الدورة</h3>
            {complete ? (
              <Link
                to="/student/certificates"
                onClick={() => issueCertificate(readUserName(), course.name, "course")}
                className="mt-3 block rounded-full bg-[#FABC05] py-2.5 text-center text-sm font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90"
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

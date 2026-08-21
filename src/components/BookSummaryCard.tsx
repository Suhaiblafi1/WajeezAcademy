import { useMemo, useState } from "react";
import { BookOpen, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import AudioPlayer from "./AudioPlayer";
import { bookQuiz, type BookSummary } from "@/services/wajeezBooks";

/**
 * بطاقة ملخص كتاب تفاعلية: استماع عبر المشغل الصوتي،
 * ثم اختبار قصير (٣ أسئلة) يُفتح بعد اكتمال 90% من الاستماع،
 * والنجاح من درجتين فأكثر يُحفظ في ملف الطالب.
 */
export default function BookSummaryCard({
  book,
  saved,
  onPass,
}: {
  book: BookSummary;
  saved?: { passed: boolean; score: number };
  onPass: (score: number) => void;
}) {
  const [listenPct, setListenPct] = useState(0);
  const [quizOn, setQuizOn] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const questions = useMemo(() => bookQuiz(book), [book]);

  if (saved?.passed) {
    return (
      <div className="rounded-2xl border border-teal/30 bg-teal/5 p-4">
        <p className="text-sm font-bold">{book.title}</p>
        <p className="mt-1 text-[11px] text-white/45">{book.author} · استماع {book.minutes} دقيقة</p>
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-teal/40 bg-teal/10 px-3 py-2 text-xs font-bold text-teal-light-ink">
          <CheckCircle2 className="h-4 w-4" /> اجتزت اختبار الملخص بدرجة {saved.score}%
        </p>
      </div>
    );
  }

  const listened = listenPct >= 90;

  const submit = () => {
    const correct = questions.filter((q, i) => answers[i] === q.correct).length;
    const score = Math.round((correct / questions.length) * 100);
    const passed = correct >= 2;
    setResult({ score, passed });
    if (passed) onPass(score);
  };

  const reset = () => {
    setQuizOn(false);
    setAnswers({});
    setResult(null);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold">{book.title}</p>
          <p className="mt-1 text-[11px] text-white/45">{book.author} · استماع {book.minutes} دقيقة · {questions.length} أسئلة</p>
        </div>
        <BookOpen className="h-4 w-4 shrink-0 text-teal-light-ink" />
      </div>

      {!quizOn ? (
        <>
          <div className="mt-3">
            <AudioPlayer minutes={book.minutes} onProgress={setListenPct} />
          </div>
          <button
            onClick={() => setQuizOn(true)}
            disabled={!listened}
            className="mt-3 w-full cursor-pointer rounded-full bg-teal py-2 text-xs font-black text-on-teal transition hover:bg-teal-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            {listened ? "ابدأ اختبار الملخص" : `أكمل الاستماع لتفتح الأسئلة (${listenPct}%)`}
          </button>
        </>
      ) : (
        <div className="mt-3 space-y-3">
          {questions.map((q, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-xs font-bold leading-6">{i + 1}. {q.q}</p>
              <div className="mt-2 grid gap-1.5">
                {q.options.map((op, j) => {
                  const chosen = answers[i] === j;
                  const revealed = result !== null;
                  const isCorrect = q.correct === j;
                  return (
                    <button
                      key={j}
                      disabled={revealed}
                      onClick={() => setAnswers({ ...answers, [i]: j })}
                      className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-right text-[11px] transition disabled:cursor-default ${
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
              {result && <p className="mt-2 text-[10px] leading-5 text-white/40">{q.explain}</p>}
            </div>
          ))}
          {!result ? (
            <button
              onClick={submit}
              disabled={Object.keys(answers).length < questions.length}
              className="w-full cursor-pointer rounded-full bg-gold py-2.5 text-xs font-black text-on-gold transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              سلّم إجابات الملخص
            </button>
          ) : result.passed ? (
            <p className="flex items-center justify-center gap-2 rounded-xl border border-teal/50 bg-teal/10 py-2.5 text-xs font-black text-teal-light-ink">
              <CheckCircle2 className="h-4 w-4" /> {result.score}% — أُضيف الملخص لملفك
            </p>
          ) : (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-center">
              <p className="flex items-center justify-center gap-2 text-xs font-black text-red-300">
                <XCircle className="h-4 w-4" /> {result.score}% — تحتاج درجتين صحيحتين للنجاح
              </p>
              <button onClick={reset} className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/20 px-4 py-1.5 text-[11px] font-bold hover:border-white/40">
                <RotateCcw className="h-3 w-3" /> حاول مجددا
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

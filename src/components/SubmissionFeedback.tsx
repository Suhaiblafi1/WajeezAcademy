/* تعليق المدرب في سياق التسليم (البند ص-٢).
   كان المعروض: درجة مجرّدة وسطر ملاحظة لا يظهر إلا عند الرفض، وتعليقات
   بلا عنوان ولا تاريخ. والمتعلم لا يعرف **لماذا** حصل على درجته.

   الآن يُعرض الحكم كاملا:
   - تفصيل الروبرك معيارا معيارا: من أين جاءت الدرجة
   - ملاحظة المراجعة في **كل** الحالات لا عند الرفض وحده — الملاحظة على
     المقبول ثناء أو توجيه، وحجبها يُفقد المتعلم أنفع ما كُتب له
   - تعليقات المدرب معنونة ومؤرَّخة، لا فقرات رمادية مجهولة النسب
   - تعديل الدرجة يُعلن: «عُدِّلت من ٦ إلى ٨» — لا تغيير صامت

   ولا اسم مدرب: «تعليق مدربك» — قاعدة عدم عرض أسماء المدربين قبل الاعتماد. */

import { CheckCircle2, History, MessageSquare, ScrollText } from "lucide-react";
import { fmtDayMonth } from "@/application/text/format-ar";

import { Card } from "@/components/ui/Surface";
export interface RubricCriterionView { id: string; title: string; maxScore: number; sequence: number }
export interface GradeView {
  score: string | number;
  maxScore: string | number;
  rubricScores?: { criterionId: string; score: number }[] | null;
  history?: { oldScore: string | number | null; newScore: string | number | null; createdAt?: string }[] | null;
}
export interface SubmissionView {
  status: string;
  reviewNote: string | null;
  grades: GradeView[];
  feedback: { body: string; createdAt: string }[];
}

const NOTE_LABEL: Record<string, string> = {
  accepted: "ملاحظة المدرب على تسليمك المقبول",
  rejected: "سبب الرفض",
  resubmit_requested: "ما يلزم تعديله قبل إعادة التسليم",
  under_review: "ملاحظة أولية من المدرب",
  submitted: "ملاحظة المدرب",
};

const num = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : fmtDayMonth(d);
};

export default function SubmissionFeedback({
  submission,
  criteria,
  className = "",
}: {
  submission: SubmissionView;
  /** معايير روبرك التقييم — تُقرن بدرجات الروبرك بالمعرّف */
  criteria?: RubricCriterionView[] | null;
  className?: string;
}) {
  const grade = submission.grades[0];
  const rubric = (criteria ?? []).slice().sort((a, b) => a.sequence - b.sequence);
  const byId = new Map((grade?.rubricScores ?? []).map((r) => [r.criterionId, r.score]));
  const hasRubric = rubric.length > 0 && (grade?.rubricScores?.length ?? 0) > 0;

  /* آخر تعديل درجة له قيمتان مختلفتان — لا نعلن «تعديلا» بلا فرق */
  const revision = (grade?.history ?? []).find((h) => {
    const o = num(h.oldScore);
    const n = num(h.newScore);
    return o !== null && n !== null && o !== n;
  });

  const noteLabel = NOTE_LABEL[submission.status] ?? "ملاحظة المدرب";
  const nothing = !grade && !submission.reviewNote && submission.feedback.length === 0;
  if (nothing) return null;

  return (
    <div className={`space-y-2.5 ${className}`.trim()}>
      {hasRubric && (
        <Card className="bg-paper/20 p-3.5">
          <p className="flex items-center gap-2 text-[11px] font-black text-foreground">
            <ScrollText className="h-3.5 w-3.5 text-teal-light-ink" aria-hidden="true" />
            من أين جاءت درجتك
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {rubric.map((c) => {
              const got = byId.get(c.id);
              return (
                <li key={c.id} className="grid grid-cols-[1fr_auto] items-center gap-3 text-[11px]">
                  <span className="min-w-0 truncate text-foreground">{c.title}</span>
                  <span className="shrink-0 tabular-nums font-bold">
                    {got === undefined ? <span className="text-muted-foreground">لم يُقيَّم</span> : <>{got}<span className="text-muted-foreground">/{c.maxScore}</span></>}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {revision && (
        <p className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/[0.06] px-3.5 py-2.5 text-[11px] leading-6 text-foreground">
          <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-ink" aria-hidden="true" />
          <span>
            عُدِّلت درجتك من <span className="tabular-nums font-bold">{num(revision.oldScore)}</span> إلى{" "}
            <span className="tabular-nums font-bold">{num(revision.newScore)}</span>
            {revision.createdAt ? ` · ${fmtDate(revision.createdAt)}` : ""} — كل تعديل يُسجَّل ولا يُمحى.
          </span>
        </p>
      )}

      {submission.reviewNote && (
        <div className="rounded-2xl border border-teal/25 bg-teal-ink/[0.06] p-3.5">
          <p className="flex items-center gap-2 text-[11px] font-black text-teal-light-ink">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {noteLabel}
          </p>
          <p className="mt-1.5 text-[11px] leading-6 text-foreground">{submission.reviewNote}</p>
        </div>
      )}

      {submission.feedback.map((f, i) => (
        <Card key={i} className="p-3.5">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-black text-foreground">
            <MessageSquare className="h-3.5 w-3.5 text-teal-light-ink" aria-hidden="true" />
            تعليق مدربك
            <span className="font-medium text-muted-foreground">{fmtDate(f.createdAt)}</span>
          </p>
          <p className="mt-1.5 whitespace-pre-line text-[11px] leading-6 text-foreground">{f.body}</p>
        </Card>
      ))}
    </div>
  );
}

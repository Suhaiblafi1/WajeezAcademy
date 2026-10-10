/* ملفُّ التسليم في بطاقة الواجب — يُرفق قبل التسليم، ويُرى بعده (١٠ أكتوبر ٢٠٢٦).

   كان التسليمُ نصّا وحدَه، فمهمّةٌ تطلب ملفّا أو تسجيلا لا تُسلَّم إلّا برابطٍ يُلصق. وقال صاحبُ
   المنصّة: «no need to tell the trainers to make links instead of text or files… solve it not
   limiting the trainers». فيُرفق المتعلّمُ ملفَّه مع نصّه أو وحدَه، ويرى بعد التسليم ما سلّمه.

   · **السببُ قبل الانتظار**: نوعٌ لا يُقبل أو حجمٌ فوق الحدّ يُقال لحظةَ الاختيار، لا بعد رفعٍ
     طويلٍ يُردّ. والخادمُ يبقى الحَكَم (`submission-file.ts` نفسُه).
   · **والنسبةُ تُرى** أثناء الرفع — تسجيلٌ كبيرٌ على شبكة هاتفٍ دقائق.
   · **ورفعٌ انقطع يُعاد** من البطاقة نفسِها، على التسليم نفسِه. */

import { useRef } from "react";
import { Paperclip, RefreshCw, X } from "lucide-react";
import Button from "@/components/ui/Button";
import LinkedText from "@/components/LinkedText";
import { Inset } from "@/components/ui/Surface";
import {
  SUBMISSION_FILE_ACCEPT, SUBMISSION_FILE_KINDS_AR, SUBMISSION_FILE_MAX_BYTES, fileSizeAr, submissionFileProblemAr,
} from "@/application/learning/submission-file";
import type { MySubmission } from "@/services/enrollment-detail";

/** اختيارُ الملفّ قبل التسليم — والسببُ إن لم يُقبل */
export function SubmissionFilePick({
  file, onPick, disabled,
}: { file: File | null; onPick: (f: File | null) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const problem = file ? submissionFileProblemAr(file.name, file.size) : null;
  return (
    <div className="mt-2">
      <input
        ref={input} type="file" accept={SUBMISSION_FILE_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={(e) => { onPick(e.target.files?.[0] ?? null); e.target.value = ""; }}
      />
      {!file ? (
        <>
          <Button size="sm" disabled={disabled} onClick={() => input.current?.click()}>
            <Paperclip className="h-3 w-3" /> أرفق ملفا
          </Button>
          <p className="mt-1.5 text-read leading-6 text-muted-foreground">
            اختياري: {SUBMISSION_FILE_KINDS_AR}، حتى {fileSizeAr(SUBMISSION_FILE_MAX_BYTES)}.
          </p>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-read font-bold text-foreground">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
            <span className="[overflow-wrap:anywhere]">{file.name}</span>
            <span className="shrink-0 font-normal text-muted-foreground">({fileSizeAr(file.size)})</span>
          </span>
          <Button size="sm" disabled={disabled} onClick={() => onPick(null)} aria-label="أزل الملف">
            <X className="h-3 w-3" /> أزله
          </Button>
        </div>
      )}
      {problem && <p className="mt-1.5 text-read leading-6 text-red-400">{problem}</p>}
    </div>
  );
}

/** نسبةُ الرفع — تُرى ما دام الملفُّ يُرفع */
export function UploadProgress({ pct }: { pct: number }) {
  return (
    <div className="mt-2" role="status" aria-live="polite">
      <p className="text-read text-muted-foreground">يُرفع الملف… {pct}% — لا تغلق الصفحة حتى يكتمل.</p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-teal transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** ما سلّمه — ملفُّه يُفتح، أو يُقال إنّ رفعَه انقطع ويُعاد؛ ونصُّه يُقرأ بروابطه */
export function SubmittedWork({
  submission, kept, onRetry, busy,
}: {
  submission: MySubmission;
  /** الملفُّ الذي انقطع رفعُه إن بقي في يد الصفحة — يُعاد بنقرة */
  kept: File | null;
  onRetry?: (file: File) => void;
  busy: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const text = (submission.textAnswer ?? "").trim();
  if (!submission.fileUrl && !text) return null;
  const canRetry = submission.fileWaiting && submission.status === "submitted" && onRetry;
  return (
    <div className="mt-3 space-y-2">
      {submission.fileUrl && submission.fileWaiting && (
        <Inset tone="warn" className="p-3">
          <p className="text-read leading-6 text-gold-ink">
            لم يكتمل رفع الملف{submission.fileName ? ` «${submission.fileName}»` : ""}، ولن يراه مدرّبك حتى يصل.
          </p>
          {canRetry && (
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                ref={input} type="file" accept={SUBMISSION_FILE_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onRetry(f); }}
              />
              {kept && (
                <Button size="sm" tone="confirm" disabled={busy} onClick={() => onRetry(kept)}>
                  <RefreshCw className="h-3 w-3" /> أعد رفع «{kept.name}»
                </Button>
              )}
              <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
                <Paperclip className="h-3 w-3" /> {kept ? "اختر ملفا آخر" : "اختر الملف وارفعه"}
              </Button>
            </div>
          )}
        </Inset>
      )}
      {submission.fileUrl && !submission.fileWaiting && (
        <a href={submission.fileUrl} target="_blank" rel="noreferrer"
          className="inline-flex min-h-9 items-center gap-1.5 text-read font-bold text-teal-light-ink hover:text-foreground">
          <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="[overflow-wrap:anywhere]">ملفك: {submission.fileName ?? "الملف المرفق"}</span>
          {submission.fileSize ? <span className="font-normal text-muted-foreground">({fileSizeAr(submission.fileSize)})</span> : null}
        </a>
      )}
      {text && (
        <details className="group">
          <summary className="cursor-pointer text-read font-bold text-muted-foreground hover:text-foreground">النص الذي سلّمته</summary>
          <LinkedText text={text} className="mt-2 rounded-xl bg-paper/30 p-3 text-read leading-7 text-foreground" />
        </details>
      )}
    </div>
  );
}

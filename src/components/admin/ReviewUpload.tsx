/* ═══ صندوقُ رفعٍ واحد في «خطط تنتظر اعتمادك» — «فقط تحميل ورفع» (صاحب المنصّة، ٢٦ أكتوبر ٢٠٢٦) ═══

   يأخذ ما رجع من المراجعة كلَّه، ويُرسل كلَّ ملفٍّ إلى بابه (`review-upload.ts`): ملفُّ التعديلات إلى خطّته
   بمسلك البطاقة نفسِه ومعه كرّاساتُه، والتقريرُ إلى خطّته باسمه. وما رُدّ لا يوقف ما بعده.

   وكان صندوقين — للتعديلات بثلاث طرقٍ («أضف» و«استبدل المسودات» و«ابدأ من جديد»)، وللتقارير بخانة «استبدل
   التقارير السابقة» — وبينهما زرُّ «احذف المكرر من كل الخطط». وكلُّ ذلك «كان لحلّ مشكلةٍ ظهرت في وقتها». فالرفعُ هنا
   الرفعُ العاديّ وحدَه، وما يُراجَع بندا بندا ففي بطاقة خطّته. وهو يقضي فيما رُفع قبلُ وحدَه (٢٦ أكتوبر ٢٠٢٦، `upload`):
   البطاقةُ نفسُها تُتجاهَل، والأحدثُ يحلّ محلّ ما لم يُقرَّر فيه — ويقول السطرُ ما وقع. */

import { useRef, useState } from "react";
import { ExternalLink, Files } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import { putSigned } from "@/services/signed-upload";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import {
  editFilePath, missingWorkbooksAr, pdfKey, pickedPdfs, readEditsFile, uploadedLineAr, withWorkbookKeys,
  workbookFilesNeeded,
} from "@/application/trainer/plan-edits-bulk";
import { matchReportFile, type ReportPlan } from "@/application/trainer/review-reports-bulk";
import { expandReportFiles, skippedLineAr } from "@/application/trainer/review-reports-zip";
import { isEditsFile, reviewUploadSummaryAr, splitReviewFiles } from "@/application/trainer/review-upload";
import type { PlanEditsUploadCounts } from "@/application/trainer/plan-edits";
import { REVIEW_REPORT_MIMES } from "@/application/trainer/module-body";

type Row = {
  name: string;
  kind: "edits" | "report";
  planId: string | null;
  labelAr: string | null;
  state: "done" | "already" | "failed";
  noteAr: string;
};

const errText = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

const ACCEPT = [
  "application/json", ".json", "application/pdf", ".pdf", ".docx", ".zip", "application/zip", ...REVIEW_REPORT_MIMES,
].join(",");

export default function ReviewUpload({ editPlans, reportPlans, openable, onUploaded, onOpen }: {
  /** ما يُرفع إليه ملفُّ تعديلات — المنتظِرةُ والمردودةُ إلى مدرّبيها */
  editPlans: readonly { id: string; labelAr: string }[];
  /** وما يُرفع إليه تقرير — المنتظِرة، باسم مدرّبها وعنوان شعبتها (بهما يطابَق الاسمُ بلا معرّف) */
  reportPlans: readonly ReportPlan[];
  /** ما تُفتح بطاقتُه في هذه الصفحة */
  openable: ReadonlySet<string>;
  onUploaded: (planId: string) => void;
  onOpen: (planId: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState("");
  const [skippedAr, setSkippedAr] = useState("");
  const [over, setOver] = useState(false);

  const run = async (picked: readonly File[]) => {
    if (progress || picked.length === 0) return;
    setRows([]); setSummary(""); setSkippedAr("");
    setProgress("يقرأ ما اخترت");
    const out: Row[] = [];
    const push = (r: Row) => { out.push(r); setRows([...out]); };

    /* ① ملفّاتُ التعديلات تُقرأ أوّلا — فيُعرف أيُّ PDF كرّاسةٌ سمّاها أحدُها، وما بقي تقارير */
    const reads = await Promise.all(picked.filter(isEditsFile)
      .map(async (file) => ({ file, read: readEditsFile(file.name, await file.text()) })));
    const { workbooks, reports } = splitReviewFiles(
      picked.filter((f) => !isEditsFile(f)),
      reads.flatMap(({ read }) => (read.ok ? workbookFilesNeeded(read.body) : [])),
    );
    const pdfs = pickedPdfs(workbooks);

    /* ② التعديلات إلى خطّتها مسوّداتٍ — بالرفع العاديّ: ما رُفع قبلُ يُتجاهَل، و«مرفوع» إن لم يكن فيه جديد */
    for (const [i, { file, read }] of reads.entries()) {
      setProgress(`يرفع التعديلات ${i + 1} من ${reads.length}`);
      if (!read.ok) {
        push({ name: file.name, kind: "edits", planId: null, labelAr: null, state: "failed", noteAr: read.problemAr });
        continue;
      }
      const labelAr = editPlans.find((p) => p.id === read.planId)?.labelAr ?? read.titleAr;
      try {
        const needed = workbookFilesNeeded(read.body);
        const missing = needed.filter((n) => !pdfs.has(pdfKey(n)));
        if (missing.length) throw new Error(missingWorkbooksAr(missing));
        const keys: Record<string, string> = {};
        for (const n of needed) {
          const up = await apiPost<{ storageKey: string; uploadUrl: string; maxBytes: number }>(
            editFilePath(read.planId), { mime: "application/pdf", originalName: n });
          await putSigned(up.uploadUrl, pdfs.get(pdfKey(n))!, up.maxBytes);
          keys[n] = up.storageKey;
        }
        const r = await apiPost<PlanEditsUploadCounts>(
          `/api/admin/cohort-plans/${read.planId}/edits`, needed.length ? withWorkbookKeys(read.body, keys) : read.body);
        push({ name: file.name, kind: "edits", planId: read.planId, labelAr, state: r.added > 0 ? "done" : "already", noteAr: uploadedLineAr(r) });
        if (r.added > 0) onUploaded(read.planId);
      } catch (e) {
        push({ name: file.name, kind: "edits", planId: read.planId, labelAr, state: "failed", noteAr: errText(e, "تعذّر الرفع") });
      }
    }

    /* ③ التقاريرُ إلى خطّتها باسمها — تُفتح حِزَمُها هنا، ولا يُحذف ما رُفع قبلها */
    if (reports.length > 0) {
      setProgress("يفتح التقارير");
      const expanded = await expandReportFiles(reports);
      setSkippedAr(skippedLineAr(expanded.skipped));
      for (const p of expanded.problems) {
        push({ name: p.name, kind: "report", planId: null, labelAr: null, state: "failed", noteAr: p.problemAr });
      }
      for (const [i, file] of expanded.files.entries()) {
        setProgress(`يرفع التقارير ${i + 1} من ${expanded.files.length}`);
        const m = matchReportFile(file.name, file.type, reportPlans);
        if (!m.ok) {
          push({ name: file.name, kind: "report", planId: null, labelAr: null, state: "failed", noteAr: m.problemAr });
          continue;
        }
        try {
          const r = await apiPost<{ uploadUrl: string; maxBytes: number }>(
            `/api/admin/cohort-plans/${m.planId}/review-report`, { mime: m.mime, originalName: m.storedName });
          await putSigned(r.uploadUrl, file, r.maxBytes);
          push({ name: file.name, kind: "report", planId: m.planId, labelAr: m.labelAr, state: "done", noteAr: "يراه المدرب في صفحة شعبته من الآن." });
          onUploaded(m.planId);
        } catch (e) {
          const already = e instanceof ApiError && e.code === "report_exists";
          push({
            name: file.name, kind: "report", planId: m.planId, labelAr: m.labelAr, state: already ? "already" : "failed",
            noteAr: already ? "كان مرفوعا من قبل — لم يكرر." : errText(e, "تعذّر الرفع"),
          });
        }
      }
    }

    setProgress(null);
    setSummary(reviewUploadSummaryAr(
      out.filter((r) => r.state === "done").length, out.filter((r) => r.state === "already").length,
      out.filter((r) => r.state === "failed").length,
    ));
    if (input.current) input.current.value = "";
  };

  return (
    <Inset className="mb-4 px-4 py-3" role="region" aria-label="ارفع ما رجع من المراجعة">
      <p className="text-read font-black text-foreground">ارفع ما رجع من المراجعة</p>
      <p className="mt-1 max-w-3xl text-read leading-6 text-muted-foreground">
        ملفات التعديلات ومعها الكراسات المصححة، وتقارير المراجعة (PDF أو Word أو zip). كل ملف يذهب إلى خطته:
        التعديلات مسودات لا يراها المدرب حتى تعتمد بنودها، والتقرير يراه في صفحة شعبته من لحظة رفعه.
      </p>
      <div
        className={`mt-3 flex flex-wrap items-center gap-3 rounded-lg border-2 border-dashed p-4 ${over ? "border-teal-light-ink bg-teal-light-ink/5" : "border-border"}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void run(Array.from(e.dataTransfer.files)); }}
      >
        <input
          ref={input}
          type="file"
          multiple
          className="sr-only"
          aria-label="ما رجع من المراجعة"
          accept={ACCEPT}
          onChange={(e) => void run(Array.from(e.target.files ?? []))}
        />
        <Button tone="secondary" size="sm" icon={Files} disabled={progress !== null} onClick={() => input.current?.click()}>
          {progress ? `${progress}…` : "اختر الملفات"}
        </Button>
        <span className="text-read text-muted-foreground">أو اسحبها كلها إلى هنا وأفلتها.</span>
      </div>
      {summary && <p className="mt-3 text-read font-bold text-teal-light-ink" role="status">{summary}</p>}
      {skippedAr && <p className="mt-1 text-read text-muted-foreground">{skippedAr}</p>}
      {rows.length > 0 && (
        <ol className="mt-2 space-y-2">
          {rows.map((r, i) => (
            <li key={`${i}-${r.name}`} className="rounded-lg border border-border/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={r.state === "failed" ? "danger" : "positive"}>
                  {r.state === "done" ? "رفع" : r.state === "already" ? "مرفوع" : "ردّ"}
                </Chip>
                <Chip>{r.kind === "edits" ? "تعديلات" : "تقرير"}</Chip>
                <span className="text-read font-bold text-foreground" dir="auto">{r.labelAr ?? r.name}</span>
              </div>
              {r.labelAr && <p className="mt-1 text-read text-muted-foreground" dir="auto">{r.name}</p>}
              <p className={`mt-1 whitespace-pre-wrap text-read leading-6 ${r.state === "failed" ? "text-danger-ink" : "text-foreground"}`}>
                {r.noteAr}
              </p>
              {r.planId && r.state !== "failed" && openable.has(r.planId) && (
                <Button className="mt-2" tone="ghost" size="sm" icon={ExternalLink} onClick={() => onOpen(r.planId!)}>
                  {r.kind === "edits" ? "افتح خطته وراجع بنودها" : "افتح خطته"}
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Inset>
  );
}

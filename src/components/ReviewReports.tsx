/* تقريرُ المراجعة — يرفعه المعتمِدُ مع قراره، ويقرؤه المدرّبُ في صفحة شعبته (٨ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: التقريرُ يصل المدرّبَ **من المنصّة نفسِها** — يُحفظ مع الخطّة،
   وتذكره رسالةُ القرار جرسا وبريدا، ويبقى في الصفحة يُفتح بعد البريد. لا مرفقا في بريدٍ
   يُرسَل من خارجها.

   والوجهان هنا: `ReviewReportUploader` لبطاقة المراجعة (يرفع ويحذف قبل القرار)،
   و`ReviewReportList` لصفحة المدرّب (يقرأ). والقراءةُ بالمسار المحروس نفسِه لملفّات
   الشعبة (`/api/v1/cohort-files/…`): مدرّبُها والإدارةُ وحدَهم. */

import { useRef, useState } from "react";
import { ExternalLink, FileText, Files, Upload } from "lucide-react";
import { apiDelete, apiPost, ApiError } from "@/services/api";
import { putSigned } from "@/services/signed-upload";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { matchReportFile, reportTitleAr, reportsSummaryAr, type ReportPlan } from "@/application/trainer/review-reports-bulk";
import { expandReportFiles, skippedLineAr } from "@/application/trainer/review-reports-zip";
import { fmtDateTimeAr } from "@/utils/format";
import { REVIEW_REPORT_MIMES } from "@/application/trainer/module-body";

export interface ReviewReport {
  storageKey: string;
  originalName: string;
  mime: string;
  createdAt: string;
}

const fileHref = (key: string) => `/api/v1/cohort-files/${encodeURIComponent(key)}`;

/* نوعُ Word قد يصل فارغا من بعض الأنظمة — فيُعرف من امتداده */
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
function mimeOf(file: File): string {
  if (file.type) return file.type;
  if (/\.pdf$/i.test(file.name)) return "application/pdf";
  if (/\.docx$/i.test(file.name)) return DOCX;
  return "";
}

/** لبطاقة المراجعة — يُرفع ويُحذف والخطّةُ بانتظار القرار */
export function ReviewReportUploader({ planId, reports, onChange }: {
  planId: string;
  reports: readonly ReviewReport[];
  onChange: () => void | Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const upload = async (file: File) => {
    setBusy(true); setMsg("");
    try {
      const r = await apiPost<{ uploadUrl: string; maxBytes: number }>(
        `/api/admin/cohort-plans/${planId}/review-report`,
        { mime: mimeOf(file), originalName: file.name },
      );
      await putSigned(r.uploadUrl, file, r.maxBytes);
      await onChange();
      setMsg(`رُفع «${file.name}» — تذكره رسالةُ قرارك، ويجده المدرّبُ في صفحة شعبته.`);
    } catch (e) {
      setMsg(e instanceof ApiError || e instanceof Error ? e.message : "تعذّر الرفع");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async (key: string, name: string) => {
    setBusy(true); setMsg("");
    try {
      await apiDelete(`/api/admin/cohort-plans/${planId}/review-report/${encodeURIComponent(key)}`);
      await onChange();
      setMsg(`حُذف «${name}».`);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Inset className="mt-3" role="region" aria-label="تقرير المراجعة">
      <p className="text-read font-black text-foreground">تقريرُ المراجعة (اختياريّ)</p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        ارفعه PDF أو Word قبل قرارك: يُحفظ مع الخطّة، وتذكره رسالةُ القرار للمدرّب جرسا وبريدا،
        ويجده في صفحة شعبته تحت «تقرير المراجعة».
      </p>
      {reports.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {reports.map((r) => (
            <li key={r.storageKey} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-read">
              <FileText className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
              <a href={fileHref(r.storageKey)} target="_blank" rel="noreferrer" className="font-bold text-teal-light-ink underline">
                {r.originalName}
              </a>
              <Button tone="ghost" size="sm" disabled={busy} onClick={() => void remove(r.storageKey, r.originalName)}>
                احذفه
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        <input
          ref={input}
          type="file"
          className="sr-only"
          aria-label="ملفُّ تقرير المراجعة"
          accept={[...REVIEW_REPORT_MIMES, ".pdf", ".docx"].join(",")}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
        />
        <Button tone="secondary" size="sm" icon={Upload} disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "يُرفع…" : reports.length > 0 ? "ارفع تقريرا آخر" : "ارفع التقرير"}
        </Button>
      </div>
      {msg && <p className="mt-2 text-read font-bold text-teal-light-ink" role="status">{msg}</p>}
    </Inset>
  );
}

/* ═══ التقاريرُ كلُّها دفعةً واحدة — «خططٌ تنتظر اعتمادك» (١١ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «اريد ان ارفع كل شي مره واحده!». كلُّ ملفٍّ يحمل في اسمه معرّفَ خطّته
   (`review-reports-bulk.ts`) فيُرفع إليها بمسلك البطاقة نفسِه، وما رُفع قبلُ لا يتكرّر (٤٠٩ من
   الخادم يُقال «كان مرفوعا»). ويُقال قبل الرفع ما يقع به: يراه المدرّبُ من الآن.
   والملفُّ المضغوطُ يُسقط فيه كما هو ويُفتح هنا (`review-reports-zip.ts`) — ردّت أداةُ الفكّ
   في جهاز صاحب المنصّة حزمتَه بأسمائها العربيّة. */
type ReportResult = { name: string; planId: string | null; labelAr: string | null; state: "done" | "already" | "failed"; noteAr: string };

export function ReviewReportsBulkUpload({ plans, onUploaded, onOpen }: {
  plans: readonly ReportPlan[];
  onUploaded: (planId: string) => void;
  onOpen: (planId: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [results, setResults] = useState<ReportResult[]>([]);
  const [summary, setSummary] = useState("");
  const [skippedAr, setSkippedAr] = useState("");
  const [over, setOver] = useState(false);

  const run = async (picked: readonly File[]) => {
    if (progress || picked.length === 0) return;
    setResults([]); setSummary(""); setSkippedAr("");
    setProgress("يُفتح ما اخترت");
    const expanded = await expandReportFiles(picked);
    const files = expanded.files;
    setSkippedAr(skippedLineAr(expanded.skipped));
    const out: ReportResult[] = expanded.problems.map((p) => ({ name: p.name, planId: null, labelAr: null, state: "failed", noteAr: p.problemAr }));
    for (const [i, file] of files.entries()) {
      setProgress(`يُرفع ${i + 1} من ${files.length}`);
      const m = matchReportFile(file.name, file.type, plans);
      if (!m.ok) {
        out.push({ name: file.name, planId: null, labelAr: null, state: "failed", noteAr: m.problemAr });
      } else {
        try {
          const r = await apiPost<{ uploadUrl: string; maxBytes: number }>(
            `/api/admin/cohort-plans/${m.planId}/review-report`, { mime: m.mime, originalName: m.storedName },
          );
          await putSigned(r.uploadUrl, file, r.maxBytes);
          out.push({ name: file.name, planId: m.planId, labelAr: m.labelAr, state: "done", noteAr: "رُفع إلى خطّته" });
          onUploaded(m.planId);
        } catch (e) {
          const already = e instanceof ApiError && e.code === "report_exists";
          out.push({
            name: file.name, planId: m.planId, labelAr: m.labelAr, state: already ? "already" : "failed",
            noteAr: already ? "كان مرفوعا من قبل — لم يُكرَّر" : e instanceof ApiError || e instanceof Error ? e.message : "تعذّر الرفع",
          });
        }
      }
      setResults([...out]);
    }
    setProgress(null);
    setSummary(reportsSummaryAr(
      out.filter((r) => r.state === "done").length, out.filter((r) => r.state === "already").length,
      out.filter((r) => r.state === "failed").length,
    ));
    if (input.current) input.current.value = "";
  };

  return (
    <Inset className="mb-4 px-4 py-3" role="region" aria-label="تقاريرُ المراجعة دفعةً واحدة">
      <p className="text-read font-black text-foreground">ارفع تقاريرَ المراجعة وملاحقَها كلَّها دفعةً واحدة</p>
      <p className="mt-1 max-w-3xl text-read leading-6 text-muted-foreground">
        كلُّ ملفٍّ يذكر خطّتَه في اسمه (اسمَ المدرّب واسمَ الشعبة) فيُرفع إلى بطاقتها وحدَها، وما رُفع من قبل لا يتكرّر. ويراه المدرّبُ في صفحة
        شعبته من لحظة رفعه — باسمه بلا معرّف الخطّة — وتذكره رسالةُ قرارك حين تقرّر. PDF أو Word، أو الملفُّ
        المضغوطُ (zip) كما هو بلا أن تفتحه.
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
          aria-label="ملفّاتُ تقارير المراجعة"
          accept={[...REVIEW_REPORT_MIMES, ".pdf", ".docx", ".zip", "application/zip"].join(",")}
          onChange={(e) => void run(Array.from(e.target.files ?? []))}
        />
        <Button tone="secondary" size="sm" icon={Files} disabled={progress !== null} onClick={() => input.current?.click()}>
          {progress ? `${progress}…` : "اختر الملفّات"}
        </Button>
        <span className="text-read text-muted-foreground">أو اسحبها كلَّها إلى هنا وأفلتها.</span>
      </div>
      {summary && <p className="mt-3 text-read font-bold text-teal-light-ink" role="status">{summary}</p>}
      {skippedAr && <p className="mt-1 text-read text-muted-foreground">{skippedAr}</p>}
      {results.length > 0 && (
        <ol className="mt-2 space-y-2">
          {results.map((r, i) => (
            <li key={`${i}-${r.name}`} className="rounded-lg border border-border/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={r.state === "failed" ? "danger" : "positive"}>{r.state === "done" ? "رُفع" : r.state === "already" ? "مرفوع" : "رُدّ"}</Chip>
                <span className="text-read font-bold text-foreground" dir="auto">{r.labelAr ?? r.name}</span>
              </div>
              {r.labelAr && <p className="mt-1 text-read text-muted-foreground" dir="auto">{r.name}</p>}
              <p className={`mt-1 text-read leading-6 ${r.state === "failed" ? "text-danger-ink" : "text-foreground"}`}>{r.noteAr}</p>
              {r.planId && r.state !== "failed" && (
                <Button className="mt-2" tone="ghost" size="sm" icon={ExternalLink} onClick={() => onOpen(r.planId!)}>
                  افتح خطّتَه
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Inset>
  );
}

/** لصفحة المدرّب — ما رفعته الإدارةُ مع قراراتها، أحدثُه أوّلا */
export function ReviewReportList({ reports }: { reports: readonly ReviewReport[] }) {
  if (reports.length === 0) return null;
  return (
    <Inset className="mt-2" role="region" aria-label="تقرير المراجعة">
      <p className="text-read font-black text-foreground">تقريرُ المراجعة — للقراءة إن شئت</p>
      {/* وكلُّ ما فيه بنودٌ في «المراجعة» يقبلها أو يرفضها — فلا يلزمه أن يقرأه ليقرّر (١١ أكتوبر ٢٠٢٦) */}
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        رفعته الإدارةُ بعد قراءة خطّتك. وكلُّ ما فيه مكتوبٌ بنودا أعلاه، فلا يلزمك قراءتُه لتقرّر.
      </p>
      <ul className="mt-2 space-y-1.5">
        {reports.map((r) => (
          <li key={r.storageKey} className="flex flex-wrap items-center gap-x-2 text-read">
            <FileText className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
            <a href={fileHref(r.storageKey)} target="_blank" rel="noreferrer" className="font-bold text-teal-light-ink underline">
              {reportTitleAr(r.originalName)}
            </a>
            <span className="text-muted-foreground">· {fmtDateTimeAr(r.createdAt)}</span>
          </li>
        ))}
      </ul>
    </Inset>
  );
}

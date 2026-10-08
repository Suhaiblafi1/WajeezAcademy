/* تقريرُ المراجعة — يرفعه المعتمِدُ مع قراره، ويقرؤه المدرّبُ في صفحة شعبته (٨ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: التقريرُ يصل المدرّبَ **من المنصّة نفسِها** — يُحفظ مع الخطّة،
   وتذكره رسالةُ القرار جرسا وبريدا، ويبقى في الصفحة يُفتح بعد البريد. لا مرفقا في بريدٍ
   يُرسَل من خارجها.

   والوجهان هنا: `ReviewReportUploader` لبطاقة المراجعة (يرفع ويحذف قبل القرار)،
   و`ReviewReportList` لصفحة المدرّب (يقرأ). والقراءةُ بالمسار المحروس نفسِه لملفّات
   الشعبة (`/api/v1/cohort-files/…`): مدرّبُها والإدارةُ وحدَهم. */

import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { apiDelete, apiPost, ApiError } from "@/services/api";
import { putSigned } from "@/services/signed-upload";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
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

/** لصفحة المدرّب — ما رفعته الإدارةُ مع قراراتها، أحدثُه أوّلا */
export function ReviewReportList({ reports }: { reports: readonly ReviewReport[] }) {
  if (reports.length === 0) return null;
  return (
    <Inset className="mt-2" role="region" aria-label="تقرير المراجعة">
      <p className="text-read font-black text-foreground">تقريرُ المراجعة</p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        رفعته الإدارةُ مع ردّها على خطّتك — فيه ما يُعدَّل وما يُقترح، وكيف تعدّله في خطواتك.
      </p>
      <ul className="mt-2 space-y-1.5">
        {reports.map((r) => (
          <li key={r.storageKey} className="flex flex-wrap items-center gap-x-2 text-read">
            <FileText className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
            <a href={fileHref(r.storageKey)} target="_blank" rel="noreferrer" className="font-bold text-teal-light-ink underline">
              {r.originalName}
            </a>
            <span className="text-muted-foreground">· {fmtDateTimeAr(r.createdAt)}</span>
          </li>
        ))}
      </ul>
    </Inset>
  );
}

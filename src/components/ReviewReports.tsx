/* تقريرُ المراجعة — يرفعه المعتمِدُ مع قراره، ويقرؤه المدرّبُ في صفحة شعبته (٨ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: التقريرُ يصل المدرّبَ **من المنصّة نفسِها** — يُحفظ مع الخطّة،
   وتذكره رسالةُ القرار جرسا وبريدا، ويبقى في الصفحة يُفتح بعد البريد. لا مرفقا في بريدٍ
   يُرسَل من خارجها.

   والوجهان هنا: لمساحة المراجعة ما رُفع (`ReviewReportFiles`) — ورفعُه وحذفُه قبل القرار في `hooks/useReviewReports.ts` —
   و`ReviewReportList` لصفحة المدرّب (يقرأ). والقراءةُ بالمسار المحروس نفسِه لملفّات
   الشعبة (`/api/v1/cohort-files/…`): مدرّبُها والإدارةُ وحدَهم. */

import { FileText } from "lucide-react";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { reportTitleAr } from "@/application/trainer/review-reports-bulk";
import { fmtDateTimeAr } from "@/utils/format";
import { REVIEW_REPORT_MIMES } from "@/application/trainer/module-body";

export interface ReviewReport {
  storageKey: string;
  originalName: string;
  mime: string;
  createdAt: string;
}

const fileHref = (key: string) => `/api/v1/cohort-files/${encodeURIComponent(key)}`;


/** ما يُختار في «ارفع تقرير المراجعة» — PDF أو Word */
export const REVIEW_REPORT_ACCEPT = [...REVIEW_REPORT_MIMES, ".pdf", ".docx"].join(",");

/** «بطاقات للمدرب» — تقريرُ المراجعة يصله مع قرارك. و`onRemove` لمن يرفعه والخطّةُ بانتظار القرار */
export function ReviewReportFiles({ reports, busy, onRemove }: {
  reports: readonly ReviewReport[];
  busy: boolean;
  onRemove?: (key: string, name: string) => void;
}) {
  if (reports.length === 0) return null;
  return (
    <div className="mt-3" role="region" aria-label="تقرير المراجعة">
      <p className="text-read font-black text-foreground">تقرير المراجعة — يصله مع قرارك</p>
      <ul className="mt-2 space-y-1.5">
        {reports.map((r) => (
          <li key={r.storageKey} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-read">
            <FileText className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
            <a href={fileHref(r.storageKey)} target="_blank" rel="noreferrer" className="font-bold text-teal-light-ink underline">
              {r.originalName}
            </a>
            {onRemove && (
              <Button tone="ghost" size="sm" disabled={busy} onClick={() => onRemove(r.storageKey, r.originalName)}>
                احذفه
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* وكان هنا صندوقُ «ارفع تقارير المراجعة وملاحقها كلّها دفعة واحدة» بخانة «استبدل التقارير السابقة». وقال صاحبُ
   المنصّة (٢٦ أكتوبر ٢٠٢٦): «فقط تحميل ورفع» — فصار صندوقا واحدا لما رجع كلِّه (`ReviewUpload.tsx`). */

/** لصفحة المدرّب — ما رفعته الإدارةُ مع قراراتها، أحدثُه أوّلا */
export function ReviewReportList({ reports }: { reports: readonly ReviewReport[] }) {
  if (reports.length === 0) return null;
  return (
    <Inset className="mt-2" role="region" aria-label="تقرير المراجعة">
      <p className="text-read font-black text-foreground">تقرير المراجعة — للقراءة إن شئت</p>
      {/* وكلُّ ما فيه بنودٌ في «المراجعة» يقبلها أو يرفضها — فلا يلزمه أن يقرأه ليقرّر (١١ أكتوبر ٢٠٢٦) */}
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        رفعته الإدارة بعد قراءة خطّتك. وكلّ ما فيه مكتوب بنودا أعلاه، فلا يلزمك قراءته لتقرّر.
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

/* رفعُ تقرير المراجعة وحذفُه قبل القرار — لـ«أدوات Claude» ولسان «بطاقات للمدرب» معا. وفي ملفّه لا في
   `ReviewReports.tsx`: ملفُّ المكوّنات لا يصدّر غيرَها (`react-refresh/only-export-components`). */
import { useState } from "react";
import { apiDelete, apiPost, ApiError } from "@/services/api";
import { putSigned } from "@/services/signed-upload";

/* نوعُ Word قد يصل فارغا من بعض الأنظمة — فيُعرف من امتداده */
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
function mimeOf(file: File): string {
  if (file.type) return file.type;
  if (/\.pdf$/i.test(file.name)) return "application/pdf";
  if (/\.docx$/i.test(file.name)) return DOCX;
  return "";
}

/* ═══ والرفعُ في «أدوات Claude»، وما رُفع في «بطاقات للمدرب» (٢٦ أكتوبر ٢٠٢٦، المرحلة الخامسة) ═══
   كان صندوقا واحدا يرفع ويعرض (`ReviewReportUploader`). وفي مساحة المراجعة (خطّة لوحة الإدارة، ٣د) صار الرفعُ في القائمة
   الواحدة، وما رُفع مع ما يصل المدرّبَ من بطاقاتك — فهو يصله مع قرارك. والرسالةُ في سطر الأدوات (`say`). */

/** رفعُ تقرير المراجعة وحذفُه قبل القرار — والخطّةُ بانتظاره */
export function useReviewReports(planId: string | null, onChange: () => void | Promise<void>, say: (msg: string) => void) {
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (!planId) return;
    setBusy(true); say("");
    try {
      const r = await apiPost<{ uploadUrl: string; maxBytes: number }>(
        `/api/admin/cohort-plans/${planId}/review-report`,
        { mime: mimeOf(file), originalName: file.name },
      );
      await putSigned(r.uploadUrl, file, r.maxBytes);
      await onChange();
      say(`رفع «${file.name}» — تذكره رسالة قرارك، ويجده المدرّب في صفحة شعبته.`);
    } catch (e) {
      say(e instanceof ApiError || e instanceof Error ? e.message : "تعذّر الرفع");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (key: string, name: string) => {
    if (!planId) return;
    setBusy(true); say("");
    try {
      await apiDelete(`/api/admin/cohort-plans/${planId}/review-report/${encodeURIComponent(key)}`);
      await onChange();
      say(`حذف «${name}».`);
    } catch (e) {
      say(e instanceof ApiError ? e.message : "تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  };

  return { busy, upload, remove };
}

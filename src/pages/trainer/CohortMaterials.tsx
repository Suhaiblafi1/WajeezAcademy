/* موادُّ الشعبة — في مرحلة «المصادر» من التجهيز (ع-١).

   ═══ لماذا انتقلت ═══

   نصُّ ع-١: «التشغيلُ يصير مركزَ التواصل، ولا يبقى فيه إلّا المخاطبة». وما
   كان فيه لا يُحذف بل يذهب إلى موضعه — كما ذهبت اللقاءاتُ والحضورُ في د-٤.

   ولوحتان من الأربع كانتا **تكرارا** لتبويبٍ قائم، فسقطتا بلا بديل: «من
   التحق وتقدّمُه» تكرارُ «طلبتي»، و«المهامُّ وتسليماتُها» تكرارُ «طابور
   التقييم». وهذه وحدَها **لم يكن لها موضعٌ آخر** في المنصّة كلِّها — فنُقلت
   ولم تُحذف، وموضعُها «المصادر»: هي مادّةٌ يقرؤها المتعلّم كالمصادر سواء.

   ═══ والفرقُ بينها وبين مصادر الخطّة ═══

   مصادرُ الخطّة تُكتب في الخطّة وتمرّ بالاعتماد وتصل المتعلّمَ في درسه.
   وهذه موادُّ **شعبةٍ جارية**: كرّاسةٌ يرفعها المدرّبُ في الأسبوع الثالث،
   أو رابطٌ يُضيفه بعد سؤالٍ في اللقاء. لا تمرّ باعتماد، وتظهر للمسجَّلين
   وحدَهم. ولذلك بقيت لوحةً على حدة تحت مصادر الخطّة لا مدموجةً فيها. */

import { useCallback, useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { controlCls } from "@/components/FormKit";

const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

interface OpsRow {
  cohort: { materials: { id: string; title: string; readUrl: string | null }[] };
}

export default function CohortMaterials({ cohortId }: { cohortId: string }) {
  const { fileUploads } = usePlatformConfig();
  const [row, setRow] = useState<OpsRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [materialLink, setMaterialLink] = useState({ title: "", url: "" });

  const load = useCallback(async () => {
    try { setRow(await apiGet<OpsRow>(`/api/trainer/cohorts/${cohortId}/ops`)); }
    catch { /* الغيابُ يُعرض فارغا — ولا يُسقط المرحلة */ }
  }, [cohortId]);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(doneMsg); await load(); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر تنفيذ الإجراء"); }
    finally { setBusy(false); }
  };

  const uploadMaterialFile = (file: File) =>
    act(async () => {
      const res = await apiPost<{ uploadUrl?: string }>(`/api/trainer/cohorts/${cohortId}/materials`, {
        title: file.name.replace(/\.[^.]+$/, ""), kind: "file",
        file: { originalName: file.name, mime: file.type || "application/octet-stream", sizeBytes: file.size },
      });
      if (res.uploadUrl) {
        const put = await fetch(`${API_BASE}${res.uploadUrl}`, {
          method: "PUT", credentials: "include", headers: { "content-type": "application/octet-stream" }, body: file,
        });
        if (!put.ok) throw new ApiError("upload_failed", "تعذر رفع الملف بعد تسجيل المادة", put.status);
      }
    }, "أُضيفت المادة ورُفعت — تظهر للمسجلين في الشعبة");

  const addMaterialLink = () => {
    if (!materialLink.title.trim() || !materialLink.url.trim()) return;
    return act(
      () => apiPost(`/api/trainer/cohorts/${cohortId}/materials`, {
        title: materialLink.title.trim(), kind: "link", externalUrl: materialLink.url.trim(),
      }),
      "أُضيف الرابط إلى مواد الشعبة",
    ).then(() => setMaterialLink({ title: "", url: "" }));
  };

  if (!row) return null;
  const c = row.cohort;

  return (
    <Panel as="section">
      <h3 className="flex items-center gap-2 text-sm font-black text-foreground"><Upload className="h-4 w-4 text-teal-light-ink" /> مواد الشعبة</h3>
      {c.materials.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {c.materials.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 text-read text-foreground">
              <span className="min-w-0 truncate">{m.title}</span>
              {m.readUrl && (
                <a href={`${API_BASE}${m.readUrl}`} target="_blank" rel="noreferrer" className="shrink-0 font-bold text-teal-light-ink underline decoration-dotted underline-offset-4">افتح</a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-read text-muted-foreground">لا مواد بعد — {fileUploads ? "ارفع كرّاسة أو أضف رابطا." : "أضف رابطا أدناه."}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {fileUploads ? (
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-teal/45 px-3.5 py-1.5 text-fine font-bold text-teal-light-ink transition hover:bg-teal/10">
            <Upload className="h-3 w-3" /> ارفع ملفا (كرّاسة أو فيديو)
            <input type="file" className="hidden" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadMaterialFile(f); e.target.value = ""; }} />
          </label>
        ) : (
          <p className="text-read leading-6 text-muted-foreground">
            رفعُ الملفّات لم يُفعَّل على هذه المنصّة بعد — <span className="font-bold text-foreground">أضف المادّةَ برابطٍ أدناه</span> (Drive أو YouTube أو أيّ رابطٍ يفتحه طلبتُك).
          </p>
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input aria-label="عنوان الرابط" placeholder="عنوان المادة" value={materialLink.title}
          onChange={(e) => setMaterialLink((f) => ({ ...f, title: e.target.value }))} className={controlCls} />
        <input aria-label="رابط المادة" dir="ltr" placeholder="https://…" value={materialLink.url}
          onChange={(e) => setMaterialLink((f) => ({ ...f, url: e.target.value }))} className={`${controlCls} text-left`} />
        <Button tone="secondary" size="sm" disabled={busy || !materialLink.title.trim() || !materialLink.url.trim()} onClick={() => void addMaterialLink()}>
          أضف رابطا
        </Button>
      </div>
    </Panel>
  );
}

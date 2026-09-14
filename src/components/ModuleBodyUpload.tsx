/* إرفاقُ ملفِّ المحتوى النظريّ — بديلا عن كتابته (ع-٢).

   ═══ ولمَ هو تحت المحرّر لا مكانَه ═══

   الكتابةُ تبقى الأصل: `LessonBody` يقسّم الدروسَ ويركّب الاسترجاعَ ويُقرأ
   على الهاتف. والملفُّ بابٌ **لمن معه عرضُه جاهزا** ولا يُعيد كتابتَه —
   والبديلُ عنه ليس متنا أحسنَ بل محورا فارغا يقرأ متعلّمُه «قيد التأليف».

   فالمحرّرُ أوّلا، والملفُّ تحته بعبارةٍ تقول إنّه يُغني عنه. */

import { useRef, useState } from "react";
import { FileUp, Trash2, FileText, Loader2 } from "lucide-react";
import { apiPost, apiDelete, ApiError, permissionMessage } from "@/services/api";
import {
  MAX_BODY_FILE_BYTES, acceptedMimes, fileBlockerAr, fileLabelAr, type FilePurpose,
} from "@/application/trainer/module-body";

/* كما في بقيّة أسطح الرفع: الرفعُ يذهب إلى الخادم مباشرةً لا عبر `apiPost` */
const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

import Button from "@/components/ui/Button";
import { Inset } from "@/components/ui/Surface";

export interface BodyFileValue {
  bodyFileKey?: string | null;
  bodyFileName?: string | null;
  bodyFileMime?: string | null;
}

export default function ModuleBodyUpload({
  cohortId, purpose = "module_body", refId, value, onChange, disabled = false, label, hint,
}: {
  cohortId: string;
  purpose?: FilePurpose;
  refId: string;
  value: BodyFileValue;
  onChange: (next: BodyFileValue) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    /* الحاجزُ هنا وعند الخادم معا: من رفع ملفّا كبيرا يُقال له قبل أن ينتظر
       رفعَه كلَّه ثمّ يُردّ. والخادمُ يبقى الحَكَم. */
    const blocker = fileBlockerAr(purpose, file.type, file.size);
    if (blocker) { setErr(blocker); return; }
    setBusy(true);
    setErr(null);
    try {
      const res = await apiPost<{ storageKey: string; uploadUrl: string }>(
        `/api/trainer/cohorts/${cohortId}/files`,
        { purpose, refId, mime: file.type, originalName: file.name },
      );
      const put = await fetch(`${API_BASE}${res.uploadUrl}`, {
        method: "PUT", credentials: "include",
        headers: { "content-type": "application/octet-stream" }, body: file,
      });
      if (!put.ok) throw new ApiError("upload_failed", "تعذّر رفعُ الملفّ", put.status);
      onChange({ bodyFileKey: res.storageKey, bodyFileName: file.name, bodyFileMime: file.type });
    } catch (e) {
      setErr(permissionMessage(e, "تعذّر رفعُ الملفّ الآن — أعد المحاولة بعد قليل."));
    } finally {
      setBusy(false);
      if (pick.current) pick.current.value = "";
    }
  };

  const remove = async () => {
    const key = value.bodyFileKey;
    if (!key) return;
    setBusy(true);
    setErr(null);
    try {
      await apiDelete(`/api/trainer/cohorts/${cohortId}/files/${encodeURIComponent(key)}`);
      onChange({ bodyFileKey: null, bodyFileName: null, bodyFileMime: null });
    } catch (e) {
      setErr(permissionMessage(e, "تعذّر حذفُ الملفّ الآن."));
    } finally {
      setBusy(false);
    }
  };

  if (value.bodyFileKey) {
    return (
      <div className="mt-2">
        <Inset className="flex flex-wrap items-center gap-2.5">
          <FileText className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
          <span className="min-w-0 flex-1 break-words text-read leading-6">
            {value.bodyFileName || "ملفّ"}
            <span className="text-muted-foreground">{" · "}{fileLabelAr(purpose, value.bodyFileMime)}</span>
          </span>
          <Button tone="ghost" icon={Trash2} onClick={remove} disabled={disabled || busy} className="min-h-9">
            احذفه
          </Button>
        </Inset>
        <p className="mt-1.5 text-read leading-6 text-muted-foreground">
          {hint ?? "يقرؤه المتعلّمُ في وحدته. ويكفي وحدَه لاعتماد المحور — وإن كتبتَ فوقه فله الاثنان."}
        </p>
        {err && <p role="status" className="mt-1.5 text-read leading-6 text-gold">{err}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <input
        ref={pick}
        type="file"
        accept={acceptedMimes(purpose).join(",")}
        className="sr-only"
        aria-label={label}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
      />
      <Button
        tone="secondary"
        icon={busy ? Loader2 : FileUp}
        onClick={() => pick.current?.click()}
        disabled={disabled || busy}
        className="min-h-9"
      >
        {busy ? "يُرفَع…" : label}
      </Button>
      <p className="mt-1.5 text-read leading-6 text-muted-foreground">
        {hint ?? `PDF يُقرأ في الصفحة، وWord يُنزَّل — حتّى ${Math.round(MAX_BODY_FILE_BYTES / (1024 * 1024))} ميغابايت.`}
      </p>
      {err && <p role="status" className="mt-1.5 text-read leading-6 text-gold">{err}</p>}
    </div>
  );
}

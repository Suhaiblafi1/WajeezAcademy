import { useEffect, useRef, useState } from "react";
import { FileUp, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import {
  CV_CONSENT_TEXT_AR,
  deleteCv,
  loadCvMeta,
  saveCvPrivate,
  validateCvFile,
  type CvMeta,
} from "@/application/cv/cv-store";

import Button from "@/components/ui/Button";
import { Card, Inset } from "@/components/ui/Surface";
/* «أرسل سيرتك للمستشار» — اختياري تماما، لا يمنع رؤية النتيجة.
   الملف يُخزن خاصا على جهاز المستخدم (IndexedDB) في هذا الإصدار،
   ولا يُرسل لأي نموذج ذكاء اصطناعي — يقرأه المستشار البشري فقط. */
export default function CvUpload({
  sessionId,
  userId,
  defaultName,
  defaultPhone,
}: {
  sessionId: string;
  userId?: string | null;
  defaultName?: string | null;
  defaultPhone?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<CvMeta | null>(null);

  /* سيرة محفوظة سابقا لهذه الجلسة — تظهر حالتها فور العودة */
  useEffect(() => {
    loadCvMeta(sessionId)
      .then((m) => setSaved(m))
      .catch(() => setSaved(null));
  }, [sessionId]);

  const pick = (f: File | null) => {
    setError(null);
    if (!f) return;
    const v = validateCvFile(f);
    if (!v.ok) {
      setFile(null);
      setError(v.reason_ar);
      return;
    }
    setFile(f);
  };

  const send = async () => {
    if (!file || !consent || busy) return;
    setBusy(true);
    setError(null);
    try {
      const meta = await saveCvPrivate(file, {
        diagnosticSessionId: sessionId,
        userId: userId ?? null,
        name: defaultName ?? null,
        phone: defaultPhone ?? null,
      });
      setSaved(meta);
      setFile(null);
      setConsent(false);
    } catch {
      setError("تعذر حفظ الملف على جهازك — تحقق من مساحة التخزين أو جرّب متصفحا آخر.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteCv(sessionId);
      setSaved(null);
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <Card tone="accent">
        <p className="flex items-start gap-2.5 text-sm font-bold leading-relaxed text-teal-light-ink">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          تم استلام سيرتك، وسيتمكن المستشار من مراجعتها عند التواصل معك.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          الملف: {saved.original_filename} — محفوظ بشكل خاص، وحالته «بانتظار مراجعة المستشار».
        </p>
        <button
          onClick={remove}
          disabled={busy}
          className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-red-300 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          احذف سيرتي قبل مراجعتها
        </button>
      </Card>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        aria-label="اختيار ملف السيرة الذاتية"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-4 text-sm font-bold text-foreground transition hover:border-teal-light/60 hover:text-teal-light-ink"
      >
        <FileUp className="h-4 w-4" />
        {file ? file.name : "اختر ملف سيرتك — PDF أو DOC أو DOCX (حتى 5MB)"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold leading-relaxed text-gold-ink">
          {error}
        </p>
      )}
      {file && (
        <div className="story-fade mt-3">
          <Inset as="label" className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-teal"
            />
            {CV_CONSENT_TEXT_AR}
          </Inset>
          <Button tone="confirm"
            onClick={send}
            disabled={!consent || busy}
            className="mt-3 h-10 w-full rounded-full bg-teal font-black text-on-teal hover:bg-teal/90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="ml-2 h-4 w-4" />}
            إرسال السيرة للمستشار
          </Button>
        </div>
      )}
    </div>
  );
}

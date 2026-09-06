/* بطاقة رأي المتعلم في نتيجته — أسفل النتيجة الكاملة بعد التسجيل فقط.
   تُخزَّن مربوطة بجلسة التشخيص والمسار الموصى به، وتظهر مجمّعة في /admin/quality. */

import { useState } from "react";
import { Loader2, MessageSquareHeart, Send } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import { track } from "@/services/analytics";

import Button from "@/components/ui/Button";
import { Panel } from "@/components/ui/Surface";
type Verdict = "yes" | "somewhat" | "no";

const VERDICTS: { id: Verdict; label: string }[] = [
  { id: "yes", label: "نعم" },
  { id: "somewhat", label: "إلى حد ما" },
  { id: "no", label: "لا" },
];

export default function ResultFeedback({ sessionId, pathwayId }: { sessionId: string; pathwayId: string }) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!verdict || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiPost("/api/diagnostic-feedback", {
        sessionId,
        pathwayId,
        verdict,
        note: note.trim() || undefined,
      });
      track("feedback_submitted", { verdict });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذر الإرسال — حاول مجددا");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel as="section" tone="accent" className="mt-10 text-center md:p-8 print:hidden">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-teal/15">
        <MessageSquareHeart className="h-5 w-5 text-teal-light-ink" />
      </span>
      <h3 className="mt-4 text-lg font-black leading-snug">
        نحن في نسخة تجريبية — ورأيك يصنع النسخة التالية
      </h3>

      {done ? (
        <p className="mt-4 text-sm font-black text-teal-light-ink">وصلنا رأيك — شكرا لك.</p>
      ) : (
        <>
          <p className="mt-4 text-sm font-bold text-foreground">هل تصف هذه النتيجة وضعك؟</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {VERDICTS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVerdict(v.id)}
                aria-pressed={verdict === v.id}
                className={`rounded-full border px-6 py-2.5 text-sm font-black transition ${
                  verdict === v.id
                    ? "border-gold bg-gold text-on-gold"
                    : "border-white/20 text-foreground hover:border-teal-light/60 hover:text-foreground"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <label htmlFor="result-feedback-note" className="mt-5 block text-xs font-bold text-muted-foreground">
            ما الذي كنت تتوقعه؟ (اختياري)
          </label>
          <textarea
            id="result-feedback-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            className="mt-2 w-full resize-none rounded-xl border border-white/15 bg-paper/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none"
            placeholder="اكتب باختصار — ٥٠٠ حرف كحد أقصى"
          />

          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-xs font-bold text-red-200">
              {error}
            </p>
          )}

          <Button tone="confirm"
            onClick={submit}
            disabled={!verdict || busy}
            className="mt-4 h-11 rounded-full bg-teal px-8 font-black text-on-teal hover:bg-teal/90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="ml-2 h-4 w-4" />}
            أرسل رأيي
          </Button>
        </>
      )}
    </Panel>
  );
}

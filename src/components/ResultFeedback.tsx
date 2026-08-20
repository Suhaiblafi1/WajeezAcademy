/* بطاقة رأي المتعلم في نتيجته — أسفل النتيجة الكاملة بعد التسجيل فقط.
   تُخزَّن مربوطة بجلسة التشخيص والمسار الموصى به، وتظهر مجمّعة في /admin/quality. */

import { useState } from "react";
import { Loader2, MessageSquareHeart, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost, ApiError } from "@/services/api";
import { track } from "@/services/analytics";

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
    <section className="mt-10 rounded-3xl border border-[#38A7B4]/40 bg-[#38A7B4]/[0.05] p-6 text-center md:p-8 print:hidden">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#38A7B4]/15">
        <MessageSquareHeart className="h-5 w-5 text-[#6EC7D1]" />
      </span>
      <h3 className="mt-4 text-lg font-black leading-snug">
        نحن في نسخة تجريبية — ورأيك يصنع النسخة التالية
      </h3>

      {done ? (
        <p className="mt-4 text-sm font-black text-[#6EC7D1]">وصلنا رأيك — شكرا لك.</p>
      ) : (
        <>
          <p className="mt-4 text-sm font-bold text-white/75">هل تصف هذه النتيجة وضعك؟</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {VERDICTS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVerdict(v.id)}
                aria-pressed={verdict === v.id}
                className={`rounded-full border px-6 py-2.5 text-sm font-black transition ${
                  verdict === v.id
                    ? "border-[#FABC05] bg-[#FABC05] text-[#0D0D0D]"
                    : "border-white/20 text-white/70 hover:border-[#6EC7D1]/60 hover:text-white"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <label htmlFor="result-feedback-note" className="mt-5 block text-xs font-bold text-white/55">
            ما الذي كنت تتوقعه؟ (اختياري)
          </label>
          <textarea
            id="result-feedback-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            className="mt-2 w-full resize-none rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none"
            placeholder="اكتب باختصار — ٥٠٠ حرف كحد أقصى"
          />

          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-xs font-bold text-red-200">
              {error}
            </p>
          )}

          <Button
            onClick={submit}
            disabled={!verdict || busy}
            className="mt-4 h-11 rounded-full bg-[#38A7B4] px-8 font-black text-[#08272B] hover:bg-[#38A7B4]/90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="ml-2 h-4 w-4" />}
            أرسل رأيي
          </Button>
        </>
      )}
    </section>
  );
}

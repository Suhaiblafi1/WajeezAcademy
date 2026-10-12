/* «أبلغني حين تفتح شعبتها» — لدورةٍ بعينها، في صفحتها العامّة (١٢ أكتوبر ٢٠٢٦).

   ═══ لماذا ═══

   منذ صار لا يُعرض للعموم إلّا ما اعتُمدت خطّةُ مدرّبه، صارت أكثرُ الدورات بلا شعبة.
   ومن جاء يريد دورةً بعينها كان يقرأ «يعلن الموعد مع فتح الشعبة» ثمّ لا شيء — فيغادر
   ولا يعود. وقرارُ صاحب المنصّة: «أبلغني» لكلّ دورةٍ، بريدٌ واحدٌ ولا حساب.

   ═══ ولمَ مطويٌّ في رابطٍ لا حقلٌ ظاهر ═══

   يقع تحت موعد كلّ دورةٍ في قائمةٍ قد تكون أربعا أو خمسا — وحقلٌ ظاهرٌ تحت كلٍّ منها
   يصير خمسةَ نماذجَ في صفحةٍ غرضُها الشراء. فرابطٌ قصيرٌ يُفتح لمن أراده.

   ═══ ولا يُجمع إلّا ما يوصَل به ═══

   البريدُ وحدَه. والوعدُ رسالةٌ واحدةٌ حين تفتح لها شعبةٌ تُشترى — ونصُّه يُحفظ في
   الخادم مع البريد (`course-interest.service.ts`). */

import { useState } from "react";
import { BellRing, Check, Loader2 } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import { controlCls } from "@/components/FormKit";
import Button from "@/components/ui/Button";

interface InterestResult { alreadyWaiting: boolean }

export default function CourseInterestForm({
  courseId,
  email: initialEmail = "",
}: {
  courseId: string;
  /** بريدُ من كان داخلا بحسابه — فلا يكتب ما نعرفه */
  email?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<InterestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      setDone(await apiPost<InterestResult>("/api/public/course-interest", { email: value, courseId }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر حفظ بريدك — أعد المحاولة");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className="mt-1.5 flex items-start gap-1.5 text-read leading-5 text-teal-light-ink">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {done.alreadyWaiting
          ? "بريدك مسجّل عندنا لهذه الدورة — تصلك رسالة واحدة حين تفتح شعبتها."
          : "حفظ بريدك — تصلك رسالة واحدة حين تفتح شعبتها، ولا شيء غيرها."}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 flex items-center gap-1.5 text-read font-bold text-teal-light-ink hover:underline"
      >
        <BellRing className="h-3.5 w-3.5" aria-hidden="true" /> أبلغني حين تفتح شعبتها
      </button>
    );
  }

  return (
    <div className="mt-2">
      <p className="text-read leading-5 text-muted-foreground">
        اترك بريدك ونعلمك حين تفتح شعبة لهذه الدورة — رسالة واحدة، ولا شيء غيرها.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">بريدك الإلكتروني</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            placeholder="name@example.com"
            dir="ltr"
            autoComplete="email"
            className={`${controlCls} text-left`}
          />
        </label>
        <Button
          tone="confirm"
          onClick={() => void submit()}
          disabled={busy || email.trim() === ""}
          className="shrink-0 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          أبلغني
        </Button>
      </div>
      {error && <p className="mt-1.5 text-read leading-5 text-red-300">{error}</p>}
    </div>
  );
}

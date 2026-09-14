/* بلاغُ الاختيار في بوّابة المتعلّم (ن-١٠).

   ═══ لماذا في الإطار لا في صفحة ═══

   الاختيارُ ليس صفحةً يزورها — هو **حالٌ** تلاحقه حتّى يجيب. فمكانُه إطارُ
   البوّابة مع بلاغ توثيق البريد: أيَّ صفحةٍ فتح وجده. وصفحةٌ مستقلّةٌ تعني
   أن يجدها، ومن لم يجدها لم يختر، ومن لم يختر بقي مالُه معلّقا.

   ═══ وثلاثةُ فروقٍ عن بلاغ التوثيق، كلُّها مقصودة ═══

   ① **لا يُطوى ولا يُخفى.** بلاغُ التوثيق يُطوى لأنّ صاحبَه قد يؤجّله
      بحقّ — الحدُّ معلَنٌ ويبقى. وهذا لا: المنصّةُ هي التي أخلّت، ومالُه
      معلّقٌ حتّى يجيب. فزرُّ «لاحقا» هنا يخدم المنصّةَ وحدَها.
   ② **والخياران متساويان في الرسم.** لا لونَ يرجّح ولا «الأنسب لك»: القاعدةُ
      ② تقول «ولا رصيدٌ يُفرَض على من أراد مالَه» — والترجيحُ بالتصميم فرضٌ
      ألطفُ من المنع وأثقلُ أثرا. فالزرّان في حبرٍ واحدٍ وحجمٍ واحد.
   ③ **ونقرةٌ ثمّ تأكيد.** ما يُحسم به مالٌ لا يُحسم بلمسةٍ واحدةٍ على هاتف.

   ونصُّ الخيارَين من `CHOICE_LABEL_AR` — هو نفسُه الذي قرأه في بريده، فلا
   يقف أمام زرٍّ يتساءل أهو الذي وُعد به. */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { apiGet, apiPost, permissionMessage } from "@/services/api";
import {
  CHOICE_LABEL_AR, LEARNER_CHOICES, type LearnerChoice,
} from "@/application/trainer/departure-rules";

import Button from "@/components/ui/Button";
import { Card, Inset } from "@/components/ui/Surface";

interface OpenChoice {
  caseId: string;
  cohortTitle: string;
  courseTitleAr: string;
  noteAr: string | null;
  offeredAt: string | null;
}

export default function DepartureChoiceNotice({ className = "" }: { className?: string }) {
  const [rows, setRows] = useState<OpenChoice[]>([]);
  const [picked, setPicked] = useState<Record<string, LearnerChoice>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await apiGet<OpenChoice[]>("/api/learner/departure-choices"));
    } catch {
      /* بلاغٌ لا يُحمَّل لا يُعطّل البوّابة — والخبرُ في بريده على كلّ حال */
      setRows([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const confirm = async (caseId: string) => {
    const choice = picked[caseId];
    if (!choice) return;
    setBusy(caseId);
    setError(null);
    try {
      await apiPost(`/api/learner/departure-choices/${caseId}`, { choice });
      await load();
    } catch (e) {
      setError(permissionMessage(e, "تعذّر تسجيلُ اختيارك الآن — أعد المحاولة بعد قليل."));
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) return null;

  return (
    <div className={className}>
      {rows.map((r) => (
        <Card key={r.caseId} tone="warn" as="section" className="mb-4">
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">القرارُ لك في «{r.cohortTitle}»</p>
              <p className="mt-1 text-read leading-6 text-muted-foreground">
                رحل مدرّبُ شعبتك في
                <span className="font-bold text-foreground"> {r.courseTitleAr}</span>،
                ولم نجد له بديلا ولا شعبةً نظيرةً تصلح لك. فالقرارُ لك وحدك، ولا يُحسم
                شيءٌ قبل أن تختار.
              </p>
              {r.noteAr && (
                <p className="mt-2 text-fine leading-6 text-muted-foreground">{r.noteAr}</p>
              )}

              {/* مجموعةُ خيارٍ لا زرّان: قارئُ الشاشة يسمعها «١ من ٢» فيعلم
                  أنّ ثمّة ثانيا قبل أن يختار الأوّل. */}
              <fieldset className="mt-3">
                <legend className="sr-only">اختر ما يناسبك في «{r.cohortTitle}»</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {LEARNER_CHOICES.map((c) => {
                    const on = picked[r.caseId] === c;
                    return (
                      <Inset key={c} as="label" interactive tone={on ? "warn" : "default"}
                        className="flex items-start gap-2.5 text-read leading-6">
                        <input type="radio" name={`choice-${r.caseId}`} value={c} checked={on}
                          onChange={() => setPicked((p) => ({ ...p, [r.caseId]: c }))}
                          className="mt-1 h-4 w-4 shrink-0 accent-gold" />
                        <span className="min-w-0">{CHOICE_LABEL_AR[c]}</span>
                      </Inset>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button tone="ghost" onClick={() => void confirm(r.caseId)}
                  disabled={!picked[r.caseId] || busy === r.caseId}
                  className="min-h-9 bg-gold text-on-gold hover:bg-gold/90 hover:text-on-gold disabled:opacity-60">
                  <Check className="h-3.5 w-3.5" />
                  {busy === r.caseId ? "يُسجَّل…" : "أكّد اختياري"}
                </Button>
                <span className="text-fine text-muted-foreground">
                  {picked[r.caseId] ? "يُنفَّذ بعد التأكيد، ولا يُعدَّل بعده — فراجِعه." : "اختر أوّلا ثمّ أكّد."}
                </span>
              </div>
              {error && (
                <p role="status" className="mt-2.5 text-read leading-6 text-gold">{error}</p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

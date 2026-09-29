/* ملفُّ قراراتِ الدورات — يُرفع فيُعرض ما سيفعله، ثمّ يُطبَّق بنقرة.

   ═══ ولمَ في شاشة التصنيف ═══

   قراراتُه قراراتُ هذه الشاشة نفسِها — ربطٌ ودورةٌ جديدةٌ وسؤالٌ ورفض —
   ومعها تأهيلُ أصحابها. فمن طبّق الملفَّ رأى أثرَه في الطابور تحته فورا،
   ولا يبحث عنه في شاشةٍ ثالثة.

   ═══ والمعاينةُ ليست خطوةً تُتخطّى ═══

   زرُّ التطبيق لا يظهر إلّا بعد معاينةٍ تقول ما سيقع وما يُترك ولماذا: من لم
   يرَ ما سيقع لا يضغط عليه. والخادمُ يرسم الخطّةَ ثانيةً عند التطبيق ولا يثق بما عُرض هنا
   (`server/services/course-decisions.service.ts`). والقواعدُ في
   `src/application/trainer/course-decisions.ts`. */

import { useRef, useState } from "react";
import { FileUp, ListChecks, Loader2, PlayCircle } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import { toast } from "@/components/Toast";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import {
  STEP_STATE_LABELS, type DecisionsPlan, type PlannedStep, type StepState,
} from "@/application/trainer/course-decisions";

interface PreviewResult { errorsAr: string[]; plan: DecisionsPlan | null }
interface ApplyResult {
  plan: DecisionsPlan | null;
  applied: number[];
  failed: { n: number; errorAr: string } | null;
  refusedAr: string | null;
}

const STATE_CLS: Record<StepState, string> = {
  todo: "bg-sky-500/15 text-sky-300",
  done: "bg-emerald-500/15 text-emerald-300",
  blocked: "bg-red-500/15 text-red-300",
};

/** الخطواتُ مجموعةً بمدرّبها — وترتيبُها ترتيبُ التنفيذ */
function byTrainer(steps: readonly PlannedStep[]) {
  const groups: { reference: string; trainer: string; steps: PlannedStep[] }[] = [];
  for (const s of steps) {
    const last = groups[groups.length - 1];
    if (last && last.reference === s.reference) last.steps.push(s);
    else groups.push({ reference: s.reference, trainer: s.trainer, steps: [s] });
  }
  return groups;
}

export default function CourseDecisionsUpload({ onApplied }: { onApplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [outcome, setOutcome] = useState<ApplyResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  const read = async (file: File) => {
    setErr(null);
    setOutcome(null);
    setPreview(null);
    setFileName(file.name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setErr("ليس ملفَّ JSON يُقرأ — أهو الملفُّ الذي أُعدّ للقرارات؟");
      return;
    }
    setRaw(parsed);
    await show(parsed);
  };

  const show = async (body: unknown) => {
    setBusy(true);
    try {
      setPreview(await apiPost<PreviewResult>("/api/admin/course-decisions/preview", body));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّرت المعاينة");
    } finally {
      setBusy(false);
      if (pick.current) pick.current.value = "";
    }
  };

  const apply = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await apiPost<ApplyResult>("/api/admin/course-decisions/apply", raw);
      setOutcome(r);
      if (r.applied.length > 0) {
        toast(`طُبّقت ${r.applied.length} خطوة${r.failed ? " — ووقف التطبيقُ عند خطوةٍ تعذّرت" : ""}`);
        onApplied();
      }
      /* وتُعاد المعاينةُ لتقول الحالَ بعد التطبيق — ما طُبّق صار «طُبّق من قبل» */
      setPreview(await apiPost<PreviewResult>("/api/admin/course-decisions/preview", raw));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر التطبيق");
    } finally {
      setBusy(false);
    }
  };

  const plan = preview?.plan ?? null;

  return (
    <Card className="mb-4">
      <Button tone="ghost" icon={ListChecks} onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "أخفِ ملفَّ القرارات" : "طبّق قراراتٍ من ملفّ — ربطٌ وتأهيلٌ وأسئلةٌ دفعةً واحدة"}
      </Button>

      {open ? (
        <div className="mt-3">
          <p className="text-sm leading-7 text-muted-foreground">
            ملفٌّ أُعدّ لمراجعة اقتراحات المدرّبين: <b>ربطٌ برمزٍ قائم</b>، أو <b>دورةٌ جديدة</b>،
            أو <b>سؤالٌ لصاحبه</b> — ومعها <b>تأهيلُهم</b> لما يدرّسون. يُعرض كلُّ ما سيفعله قبل أن يفعله،
            وكلُّ خطوةٍ تقع من باب زرّها في هذه الشاشة أو في شاشة الإسناد، فيُكتب أثرُها ويصل صاحبَها خبرُها.
            {" "}<b>وقراراتُ المدرّب الواحد تُطبَّق معا أو تُترك معا</b>: خطوةٌ لا تُطبَّق تُبقي صاحبَها
            كما هو حتّى تُصلَح، ويُطبَّق غيرُه. وما طُبّق من قبل لا يُعاد.
          </p>

          <input
            ref={pick}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label="اختر ملفَّ القرارات"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); }}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Button tone="secondary" icon={busy && !plan ? Loader2 : FileUp} onClick={() => pick.current?.click()} disabled={busy}>
              {fileName ? "اختر ملفّا آخر" : "اختر ملفَّ القرارات"}
            </Button>
            {fileName ? <span className="text-sm text-muted-foreground">{fileName}</span> : null}
          </div>

          {err ? <p role="alert" className="mt-3 text-read font-bold text-red-300">{err}</p> : null}

          {preview && preview.errorsAr.length > 0 ? (
            <Inset className="mt-3" role="alert">
              <b className="text-read text-red-300">الملفُّ لا يُقرأ — {preview.errorsAr.length} خطأ:</b>
              <ul className="mt-2 grid gap-1 text-sm leading-7 text-muted-foreground">
                {preview.errorsAr.map((e) => <li key={e}>· {e}</li>)}
              </ul>
            </Inset>
          ) : null}

          {outcome ? (
            <Inset className="mt-3" role="status">
              {outcome.refusedAr ? (
                <p className="text-read font-bold text-amber-300">{outcome.refusedAr}</p>
              ) : (
                <p className="text-read text-foreground">
                  طُبّقت <b>{outcome.applied.length}</b> خطوة.
                  {outcome.failed ? (
                    <span className="text-red-300">
                      {" "}ووقف التطبيقُ عند الخطوة {outcome.failed.n}: {outcome.failed.errorAr} — أصلِح سببَها ثمّ
                      ارفع الملفَّ ثانيةً فيُكمل من حيث وقف.
                    </span>
                  ) : null}
                </p>
              )}
            </Inset>
          ) : null}

          {plan ? (
            <div className="mt-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <b className="text-read text-foreground">{plan.titleAr}</b>
                {(["todo", "done", "blocked"] as const).map((s) => (
                  <span key={s} className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATE_CLS[s]}`}>
                    {STEP_STATE_LABELS[s]}: {plan.counts[s]}
                  </span>
                ))}
              </div>

              <div className="mt-3 grid gap-3">
                {byTrainer(plan.steps).map((g) => (
                  <Inset key={g.reference}>
                    <b className="text-read text-foreground">{g.trainer}</b>
                    <span className="text-sm text-muted-foreground"> — {g.reference}</span>
                    <ol className="mt-2 grid gap-1.5">
                      {g.steps.map((s) => (
                        <li key={s.n} className="text-sm leading-7 text-muted-foreground">
                          <span className={`me-2 rounded-full px-2 py-0.5 text-xs font-bold ${STATE_CLS[s.state]}`}>
                            {STEP_STATE_LABELS[s.state]}
                          </span>
                          <span className="text-foreground">{s.n}. {s.labelAr}</span>
                          {s.reasonAr ? <span className="block text-xs text-muted-foreground/80">{s.reasonAr}</span> : null}
                        </li>
                      ))}
                    </ol>
                  </Inset>
                ))}
              </div>

              <div className="mt-3">
                <Button tone="confirm" icon={busy ? Loader2 : PlayCircle} onClick={apply} disabled={busy || !plan.applicable}>
                  {plan.applicable
                    ? `طبّق ${plan.counts.todo} خطوة${plan.counts.blocked > 0 ? ` — وتُترك ${plan.counts.blocked}` : ""}`
                    : plan.counts.blocked > 0
                      ? "لا شيءَ يُطبَّق — كلُّ ما بقي ممتنع"
                      : "لا جديدَ يُطبَّق"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

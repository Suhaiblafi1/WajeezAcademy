/* ملفُّ قراراتِ الدورات — يُرفع فيُعرض ما سيفعله، ثمّ يُطبَّق بنقرة.

   ═══ ولمَ في شاشة التصنيف ═══

   قراراتُه قراراتُ هذه الشاشة نفسِها — ربطٌ ودورةٌ جديدةٌ وسؤالٌ ورفض —
   ومعها تأهيلُ أصحابها. فمن طبّق الملفَّ رأى أثرَه في الطابور تحته فورا،
   ولا يبحث عنه في شاشةٍ ثالثة.

   ═══ والمعاينةُ ليست خطوةً تُتخطّى ═══

   زرُّ التطبيق لا يظهر إلّا بعد معاينةٍ تقول ما سيقع وما يُترك ولماذا: من لم
   يرَ ما سيقع لا يضغط عليه. والخادمُ يرسم الخطّةَ ثانيةً عند التطبيق ولا يثق بما عُرض هنا
   (`server/services/course-decisions.service.ts`). والقواعدُ في
   `src/application/trainer/course-decisions.ts`.

   ═══ والورقةُ قبل الملفّ (٢ أكتوبر ٢٠٢٦) ═══

   من يُعِدّ القراراتِ خارجَ الشاشة لا يرى الطابورَ الحيّ، فكانت البطاقاتُ تُنقل إليه
   صورةً صورة ثمّ يُسأل عن مرجع كلّ صاحب. فالخطوةُ الأولى هنا ورقةُ القرارات: الطابورُ
   المفتوحُ بصيغة الملفّ نفسِها، تُنسخ أو تُنزَّل بنقرة (والقولُ في
   `src/application/trainer/course-decisions-worksheet.ts`).

   والثانيةُ تقبل الملفَّ ملفّا أو نصّا يُلصق: من يعمل من هاتفه يصله الملفُّ نصّا في
   محادثة، ونقلُه إلى ملفٍّ ثمّ اختيارُه أشقُّ من لصقه. والطريقان يمرّان من المعاينة
   نفسِها — لا يُطبَّق ملصوقٌ لم يُرَ. */

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardPaste, Copy, Download, FileUp, ListChecks, Loader2, PlayCircle } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { toast } from "@/components/Toast";
import { staffAreaCls } from "@/components/FormKit";
import { countAr } from "@/application/text/count-ar";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import {
  STEP_STATE_LABELS, type DecisionsPlan, type PlannedStep, type StepState,
} from "@/application/trainer/course-decisions";

interface PreviewResult { errorsAr: string[]; plan: DecisionsPlan | null }
/** ورقةُ القرارات كما يردّها الخادم — يُقرأ منها عددُها وتُنقل كما هي */
interface Worksheet { titleAr: string; context: { openProposals: number; trainers: number } }
interface ApplyResult {
  plan: DecisionsPlan | null;
  applied: number[];
  failed: { n: number; errorAr: string } | null;
  refusedAr: string | null;
}

const PROPOSAL_FORMS = { one: "اقتراح", two: "اقتراحان", few: "اقتراحات", many: "اقتراحا" };
const TRAINER_FORMS = { one: "مدرّب", two: "مدرّبَين", few: "مدرّبين", many: "مدرّبا" };
/* «طُبّقت ٣ خطوة» كانت تُقرأ في كلّ تطبيق. والمثنّى يتبع موقعَه: فاعلٌ بعد «طُبّقت»،
   ومفعولٌ بعد «طبّق» — والجمعُ والمفردُ المنصوبُ واحدٌ في الحالين. */
const STEPS_DONE = { one: "خطوة", two: "خطوتان", few: "خطوات", many: "خطوة" };
const STEPS_TO_DO = { ...STEPS_DONE, two: "خطوتين" };

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

  /* الورقةُ تُحمَّل حين يُفتح الباب لا حين يُنقر «انسخ»: النسخُ إلى الحافظة يلزم أن
     يقع في نقرة المستخدم نفسِها، وانتظارُ الشبكة بينهما يُسقطه في Safari بلا خطأ. */
  const [sheet, setSheet] = useState<{ text: string; data: Worksheet } | null>(null);
  const [sheetErr, setSheetErr] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [pasted, setPasted] = useState("");

  const loadSheet = useCallback(() => {
    setSheetErr(null);
    setCopyFailed(false);
    apiGet<Worksheet>("/api/admin/course-proposals/worksheet")
      .then((data) => setSheet({ data, text: JSON.stringify(data, null, 2) }))
      .catch((e) => setSheetErr(e instanceof ApiError ? e.message : "تعذّر تحميلُ ورقة القرارات"));
  }, []);

  useEffect(() => { if (open) loadSheet(); }, [open, loadSheet]);

  const copySheet = () => {
    if (!sheet) return;
    /* وإن رُفض النسخُ — متصفّحٌ بلا حافظةٍ أو إذنٌ لم يُعطَ — عُرض النصُّ ليُنسخ باليد */
    if (!navigator.clipboard) { setCopyFailed(true); return; }
    navigator.clipboard.writeText(sheet.text)
      .then(() => toast("نُسخت ورقةُ القرارات — أرسلها لمن يقرّر فيها"))
      .catch(() => setCopyFailed(true));
  };

  const downloadSheet = () => {
    if (!sheet) return;
    const url = URL.createObjectURL(new Blob([sheet.text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `wajeez-course-decisions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* بابٌ واحدٌ للملفّ وللنصّ الملصوق — والاثنان إلى المعاينة لا إلى التطبيق */
  const take = async (text: string, name: string) => {
    setErr(null);
    setOutcome(null);
    setPreview(null);
    setFileName(name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setErr("ليس نصَّ JSON يُقرأ — أهو الملفُّ الذي أُعدّ للقرارات كاملا؟");
      return;
    }
    setRaw(parsed);
    await show(parsed);
  };

  const read = async (file: File) => take(await file.text(), file.name);

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
        toast(`طُبّقت ${countAr(r.applied.length, STEPS_DONE)}${r.failed ? " — ووقف التطبيقُ عند خطوةٍ تعذّرت" : ""}`);
        onApplied();
        loadSheet();
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

          <Inset className="mt-3">
            <b className="text-read text-foreground">١) ورقةُ القرارات</b>
            <p className="mt-1 text-sm leading-7 text-muted-foreground">
              الطابورُ المفتوحُ كلُّه بصيغة هذا الملفّ: لكلّ اقتراحٍ معرّفُه ومرجعُ صاحبه وخاناتُ قراره
              فارغة، ومعه نصُّه وأقربُ رموزنا إليه للقراءة. انسخها أو نزّلها لمن يقرّر فيها — ثمّ ارفع
              ما يعود منها في الخطوة الثانية.
            </p>
            {sheetErr ? (
              <p role="alert" className="mt-2 text-sm font-bold text-red-300">{sheetErr}</p>
            ) : !sheet ? (
              <p className="mt-2 text-sm text-muted-foreground">تُحمَّل الورقة…</p>
            ) : sheet.data.context.openProposals === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">لا اقتراحَ ينتظر قرارا — الطابورُ المفتوحُ فارغ.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-foreground">
                  ينتظر القرارَ <b>{countAr(sheet.data.context.openProposals, PROPOSAL_FORMS)}</b>،
                  لدى <b>{countAr(sheet.data.context.trainers, TRAINER_FORMS)}</b>.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2.5">
                  <Button tone="secondary" icon={Copy} onClick={copySheet}>انسخ الورقة</Button>
                  <Button tone="secondary" icon={Download} onClick={downloadSheet}>نزّلها ملفّا</Button>
                </div>
                {copyFailed ? (
                  <div className="mt-2">
                    <label htmlFor="decisions-sheet" className="text-sm font-bold text-foreground">
                      لم يقبل المتصفّحُ النسخ — حدِّد النصَّ كلَّه وانسخه بيدك:
                    </label>
                    <textarea
                      id="decisions-sheet" readOnly dir="ltr" rows={6} value={sheet.text}
                      onFocus={(e) => e.currentTarget.select()}
                      className={`${staffAreaCls} mt-1 font-mono text-xs`}
                    />
                  </div>
                ) : null}
              </>
            )}
          </Inset>

          <b className="mt-4 block text-read text-foreground">٢) الملفُّ بعد القرار</b>
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
          <label htmlFor="decisions-paste" className="mt-3 block text-sm font-bold text-foreground">
            أو الصق نصَّ الملفّ هنا
          </label>
          <textarea
            id="decisions-paste" dir="ltr" rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)}
            placeholder='{ "kind": "wajeez.trainer-course-decisions", … }'
            className={`${staffAreaCls} mt-1 font-mono text-xs`}
          />
          <div className="mt-2">
            <Button
              tone="secondary" icon={busy && !plan ? Loader2 : ClipboardPaste}
              onClick={() => void take(pasted, "نصٌّ ملصوق")} disabled={busy || pasted.trim().length === 0}
            >
              عاين ما لُصق
            </Button>
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
                  طُبّقت <b>{countAr(outcome.applied.length, STEPS_DONE)}</b>.
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
                    ? `طبّق ${countAr(plan.counts.todo, STEPS_TO_DO)}${plan.counts.blocked > 0 ? ` — وتُترك ${plan.counts.blocked}` : ""}`
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

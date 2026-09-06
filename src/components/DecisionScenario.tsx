/* مشغّل سيناريو القرار المتفرّع (البند ح-٥) — موقف ← قرار ← نتيجة ← تأمل.

   قواعد التصميم المطبَّقة:
   - الأثر لا يُعرض قبل القرار. لو ظهر لصار السؤال «أيّها أفضل» لا قرارا.
   - لا خيار «صحيح»: لا علامة صواب ولا خطأ ولا درجة. الآثار تتكلم عن نفسها،
     والحكم على المتعلم لا على النظام. ويُقال ذلك صراحة في رأس السيناريو.
   - المسار مرئي: ما اخترته وما ترتب عليه يبقى معروضا فوق العقدة الحالية —
     القرار الأول يُنسى عند الثالث، ولا تأمل بلا تذكّر.
   - «أعد من البداية» متاح دائما: إعادة القرار هي الفائدة لا الغش.
   - التأمل حقل حرّ عند النهاية، ويُحفَظ مع المسار — كتابة تُفقَد بالتحديث
     تُعلّم المتعلم ألا يكتب.
   - سيناريو معطوب لا يُعرض نصفه: تُعرض رسالة صريحة، لأن نصف سيناريو يحبس. */

import { useMemo, useState } from "react";
import { CheckCircle2, CornerDownLeft, Loader2, MapPin, RotateCcw, Save, Split, TriangleAlert } from "lucide-react";
import { apiPost } from "@/services/api";
import { Card } from "@/components/ui/Surface";
import {
  entryOf, isTerminal, nodeOf, parseScenario, validateScenario,
  type ScenarioNode, type ScenarioStep,
} from "@/application/content/scenario";

const NO_GRADE_NOTE =
  "لا جواب صحيح هنا ولا درجة. كل قرار له أثر — والغرض أن ترى الأثر قبل أن تدفع ثمنه في عملك.";

/** خطوة مقطوعة من المسار: العقدة والخيار الذي اختاره وأثره */
interface Taken {
  nodeTitle: string;
  optionIndex: number;
  labelAr: string;
  effectAr: string | null;
}

export default function DecisionScenario({
  raw, moduleId, className = "",
}: {
  raw: string;
  moduleId: string;
  className?: string;
}) {
  const parsed = useMemo(() => {
    const { scenario } = parseScenario(raw);
    const check = validateScenario(raw);
    return { scenario, ok: check.ok, errorsAr: check.ok ? [] : check.errorsAr };
  }, [raw]);

  const [taken, setTaken] = useState<Taken[]>([]);
  const [reflection, setReflection] = useState("");
  const [save, setSave] = useState<"idle" | "busy" | "done" | "unavailable">("idle");

  const scenario = parsed.scenario;
  const current: ScenarioNode | null = useMemo(() => {
    if (!scenario) return null;
    if (taken.length === 0) return entryOf(scenario);
    const last = taken[taken.length - 1];
    const from = nodeOf(scenario, last.nodeTitle);
    const opt = from?.options[last.optionIndex];
    return opt ? nodeOf(scenario, opt.toNode) : null;
  }, [scenario, taken]);

  if (!scenario || !parsed.ok || !current) {
    return (
      <section className={`rounded-3xl border border-gold/30 bg-gold/[0.06] p-5 ${className}`.trim()}>
        <p className="flex items-start gap-2 text-xs leading-6 text-foreground">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />
          سيناريو هذه الوحدة غير مكتمل، فلا يُعرض نصفه — نصف سيناريو يحبس من يمشي فيه.
          {parsed.errorsAr.length > 0 && <span className="text-muted-foreground"> ({parsed.errorsAr[0]})</span>}
        </p>
      </section>
    );
  }

  const ended = isTerminal(current);
  const path: ScenarioStep[] = taken.map((t) => ({ node: t.nodeTitle, optionIndex: t.optionIndex }));

  const choose = (optionIndex: number) => {
    const opt = current.options[optionIndex];
    if (!opt) return;
    setTaken((prev) => [
      ...prev,
      { nodeTitle: current.titleAr, optionIndex, labelAr: opt.labelAr, effectAr: opt.effectAr },
    ]);
  };

  const restart = () => {
    setTaken([]);
    setReflection("");
    setSave("idle");
  };

  const saveRun = async () => {
    setSave("busy");
    const ok = await apiPost(`/api/learner/scenarios/${moduleId}/runs`, {
      path,
      reflectionAr: reflection.trim() || undefined,
    }).then(() => true).catch(() => false);
    setSave(ok ? "done" : "unavailable");
  };

  return (
    <section
      aria-labelledby={`scenario-${moduleId}`}
      className={`rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`scenario-${moduleId}`} className="flex items-center gap-2 text-sm font-black">
          <Split className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />
          سيناريو قرار
        </h3>
        <p className="text-[11px] text-muted-foreground">قرارك يفتح مسارا — والمسار يظهر أثره</p>
      </div>

      <p className="mt-3 whitespace-pre-line rounded-2xl border border-teal/25 bg-teal-ink/[0.06] px-4 py-3 text-sm leading-7">
        {scenario.situationAr}
      </p>
      <p className="mt-2 text-[11px] leading-6 text-muted-foreground">{NO_GRADE_NOTE}</p>

      {/* المسار المقطوع — القرار وأثره، فلا تأمل بلا تذكّر */}
      {taken.length > 0 && (
        <ol className="mt-5 space-y-2">
          {taken.map((t, i) => (
            <Card as="li" key={`${t.nodeTitle}-${i}`} className="px-4 py-3">
              <p className="flex items-start gap-2 text-xs font-bold">
                <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="text-muted-foreground">قرارك {i + 1}: </span>
                  {t.labelAr}
                </span>
              </p>
              {t.effectAr && <p className="mt-1.5 ps-6 text-[11px] leading-6 text-foreground">{t.effectAr}</p>}
            </Card>
          ))}
        </ol>
      )}

      {/* العقدة الحالية */}
      <Card className="mt-5 bg-paper/20">
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
          <MapPin className="h-3 w-3" aria-hidden="true" />
          {current.titleAr}
        </p>
        <p className="mt-2 whitespace-pre-line text-sm leading-7">{current.bodyAr}</p>

        {!ended && (
          <div className="mt-4 space-y-2">
            {current.options.map((o, oi) => (
              <button
                key={o.labelAr}
                type="button"
                onClick={() => choose(oi)}
                className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-2.5 text-right text-xs leading-6 transition hover:border-teal/60 hover:bg-teal-ink/10"
              >
                <span className="min-w-0 flex-1">{o.labelAr}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* النهاية: التأمل ثم الحفظ */}
      {ended && (
        <Card tone="accent" className="mt-5 bg-teal-ink/[0.07]">
          <p className="flex items-start gap-2 text-sm font-bold leading-7">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
            {current.reflectAr}
          </p>
          <label className="mt-3 block">
            <span className="sr-only">تأملك</span>
            <textarea
              rows={4}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              maxLength={4000}
              placeholder="اكتب تأملك — بأي قرار كنت ستبدأ لو أعدتها، ولماذا؟"
              className="w-full rounded-2xl border border-white/12 bg-paper/25 px-4 py-3 text-xs leading-7 placeholder:text-muted-foreground/75 focus:border-teal/60 focus:outline-none"
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {save === "done" ? (
              <p className="flex items-center gap-2 text-xs font-bold text-teal-light-ink">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                حُفظت جولتك وتأملك — تعود إليهما متى شئت.
              </p>
            ) : save === "unavailable" ? (
              <p className="text-xs text-muted-foreground">
                تُحفَظ الجولة لمن سُجّل في الدورة — تابع بلا حفظ، والسيناريو نفسه هو الفائدة.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void saveRun()}
                disabled={save === "busy"}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-gold px-5 text-xs font-black text-on-gold transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {save === "busy"
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  : <Save className="h-3.5 w-3.5" aria-hidden="true" />}
                احفظ الجولة والتأمل
              </button>
            )}
            <button
              type="button"
              onClick={restart}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 text-xs font-bold transition hover:border-teal/60 hover:text-teal-light-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              أعد من البداية بقرار آخر
            </button>
          </div>
        </Card>
      )}

      {!ended && taken.length > 0 && (
        <button
          type="button"
          onClick={restart}
          className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 text-xs font-bold transition hover:border-teal/60 hover:text-teal-light-ink"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          أعد من البداية
        </button>
      )}
    </section>
  );
}

/* عارض الروبرك (البند ح-٧) — المراجعةُ الذاتيّةُ قبل التسليم.

   قرارانِ في العرض:

   ١) المستوياتُ الثلاثةُ معروضةٌ كلُّها لا الأعلى وحدَه. فالمتعلّمُ يحكم
      على مخرَجه بالمقارنة: يقرأ الثلاثةَ فيعرف أين هو، ومن رأى الأعلى
      وحدَه قرأ أمنيةً لا مقياسا.

   ٢) وحكمُه على نفسه يبقى في متصفّحه (`localStorage`) — لا يُرفع ولا يُقاس.
      فالتقييمُ الذي يُحتسب هو تقييمُ المدرّب على المخرَج المرفوع، وهذا
      الحكمُ أداةُ مراجعةٍ لا درجة؛ ولو رُفع صار المتعلّمُ يُقيّم نفسه
      لعينٍ تنظر، فيرتفع الرقمُ وتسقط فائدةُ المراجعة. */

import { useCallback, useState } from "react";
import { ClipboardCheck, ScrollText } from "lucide-react";
import { parseRubric } from "@/application/content/rubric";
import { safeGet, safeSet } from "@/services/safe-storage";
import { fmtNum } from "@/application/text/format-ar";

import { Card } from "@/components/ui/Surface";
const KEY = (moduleId: string) => `wj.rubric.${moduleId}`;

function readMarks(moduleId: string): Record<number, number> {
  try {
    const raw = safeGet(KEY(moduleId));
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<number, number> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "number") out[Number(k)] = val;
    }
    return out;
  } catch {
    /* قيمةٌ محفوظةٌ بصيغةٍ قديمةٍ أو مبتورة — تُهمَل ويُبدأ من فارغ */
    return {};
  }
}

export default function RubricSelfReview({
  raw,
  moduleId,
  className = "",
}: {
  raw: string;
  moduleId: string;
  className?: string;
}) {
  const { rubric } = parseRubric(raw);
  const [marks, setMarks] = useState<Record<number, number>>(() => readMarks(moduleId));

  /* كإعادة ضبط `PracticeActivity` — انتقالٌ بين وحدتين بنفس المسار */
  const [seen, setSeen] = useState(moduleId);
  if (seen !== moduleId) {
    setSeen(moduleId);
    setMarks(readMarks(moduleId));
  }

  const mark = useCallback(
    (ci: number, level: number) => {
      setMarks((prev) => {
        const next = { ...prev };
        if (next[ci] === level) delete next[ci];
        else next[ci] = level;
        /* متصفّحٌ يمنع التخزين — الحكمُ أداةُ مراجعةٍ لا درجة، فيضيع بلا أثر */
        safeSet(KEY(moduleId), JSON.stringify(next));
        return next;
      });
    },
    [moduleId],
  );

  if (!rubric) return null;

  const answered = rubric.criteria.filter((_, i) => marks[i] !== undefined).length;
  const lowest = rubric.criteria
    .map((_, i) => marks[i])
    .filter((v): v is number => v !== undefined)
    .sort((a, b) => a - b)[0];

  return (
    <section
      aria-labelledby={`rubric-${moduleId}`}
      className={`rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`rubric-${moduleId}`} className="flex items-center gap-2 text-sm font-black">
          <ClipboardCheck className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />
          راجع مخرَجك قبل أن تُسلّمه
        </h3>
        <span className="rounded-full bg-teal-ink/15 px-2 py-0.5 text-micro tabular-nums text-teal-light-ink">
          {fmtNum(rubric.criteria.length)} معايير
        </span>
      </div>

      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        حكمُك هنا لك وحدَك — لا يُرفع ولا يُحتسب. والمحتسَبُ تقييمُ المدرّب على
        ما ترفعه، وبهذه المعايير نفسِها.
      </p>

      <div className="mt-4 space-y-4">
        {rubric.criteria.map((c, ci) => (
          <Card key={ci}>
            <p className="flex items-start gap-2 text-sm font-bold leading-6">
              <ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              {c.titleAr}
            </p>
            <ul className="mt-2 space-y-1.5">
              {c.levels.map((l) => {
                const picked = marks[ci] === l.level;
                return (
                  <li key={l.level}>
                    <button
                      type="button"
                      onClick={() => mark(ci, l.level)}
                      aria-pressed={picked}
                      className={`flex w-full items-start gap-2 rounded-xl border p-2.5 text-right text-xs leading-6 transition ${
                        picked
                          ? "border-teal-ink/50 bg-teal-ink/15"
                          : "border-white/10 bg-transparent hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-micro font-black tabular-nums">
                        {fmtNum(l.level)}
                      </span>
                      <span>{l.textAr}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      {answered === rubric.criteria.length && lowest !== undefined && lowest < 3 && (
        <Card as="p" tone="warn" className="mt-3 text-xs leading-6 text-amber-100">
          أدنى ما حكمتَ به على نفسك {fmtNum(lowest)} — وهذا موضعُ عملك قبل التسليم،
          لا بعد التقييم.
        </Card>
      )}
    </section>
  );
}

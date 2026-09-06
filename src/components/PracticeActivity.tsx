/* عارض النشاط التطبيقيّ (البند ح-٦) — الخطواتُ بأزمنتها، والمخرَجُ،
   وبديلُ من لا عمل له.

   قرارانِ في العرض:

   ١) الخطوةُ تُعلَّم منجَزةً في المتصفّح وحدَه (`localStorage`) — لا يُرفع
      شيءٌ إلى الخادم. فما يُقاس في وجيز هو المخرَجُ المرفوعُ ومراجعتُه، لا
      عددُ المربّعات المؤشَّرة؛ وعلامةُ الخطوةِ راحةٌ لمن يعمل على مرّتين،
      فلا تُعطى وزنَ دليل.

   ٢) وزمنُ كلّ خطوةٍ معروضٌ بأرقامٍ عربيّة — لأنّ نصفَ فائدة النشاط أن
      يعرف المتعلّم قبل أن يبدأ أنّ الخطوةَ الثانيةَ عشرون دقيقةً لا خمس. */

import { useCallback, useState } from "react";
import { CheckCircle2, Circle, ClipboardList, FileUp, Timer, UserRoundSearch } from "lucide-react";
import { parsePractice } from "@/application/content/practice";
import { safeGet, safeSet } from "@/services/safe-storage";
import { fmtNum } from "@/application/text/format-ar";

import { Card } from "@/components/ui/Surface";
const KEY = (moduleId: string) => `wj.practice.${moduleId}`;

function readDone(moduleId: string): number[] {
  try {
    const raw = safeGet(KEY(moduleId));
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : [];
  } catch {
    /* قيمةٌ محفوظةٌ بصيغةٍ قديمةٍ أو مبتورة — تُهمَل ويُبدأ من فارغ */
    return [];
  }
}

export default function PracticeActivity({
  raw,
  moduleId,
  className = "",
}: {
  raw: string;
  moduleId: string;
  className?: string;
}) {
  const { practice } = parsePractice(raw);
  const [done, setDone] = useState<number[]>(() => readDone(moduleId));

  /* الانتقالُ إلى وحدةٍ أخرى لا يُعيد تركيبَ المكوّن (المسارُ نفسُه بمُعامل
     آخر)، فتبقى علاماتُ الوحدة السابقة. وإعادةُ الضبط أثناء التصيير هي ما
     توصي به React لهذه الحالة بعينها — لا تأثيرٌ يُصيّر مرّتين. */
  const [seen, setSeen] = useState(moduleId);
  if (seen !== moduleId) {
    setSeen(moduleId);
    setDone(readDone(moduleId));
  }

  const toggle = useCallback(
    (i: number) => {
      setDone((prev) => {
        const next = prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i];
        /* متصفّحٌ يمنع التخزين — العلامةُ راحةٌ لا دليل، فتضيع بلا أثر */
        safeSet(KEY(moduleId), JSON.stringify(next));
        return next;
      });
    },
    [moduleId],
  );

  if (!practice) return null;

  return (
    <section
      aria-labelledby={`practice-${moduleId}`}
      className={`rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`practice-${moduleId}`} className="flex items-center gap-2 text-sm font-black">
          <ClipboardList className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />
          النشاط التطبيقيّ
        </h3>
        <span className="flex items-center gap-1 rounded-full bg-teal-ink/15 px-2 py-0.5 text-[11px] tabular-nums text-teal-light-ink">
          <Timer className="h-3 w-3" aria-hidden="true" />
          {fmtNum(practice.minutes)} دقيقة
        </span>
      </div>

      <p className="mt-3 text-sm font-bold leading-7">{practice.titleAr}</p>

      <ol className="mt-4 space-y-2">
        {practice.steps.map((s, i) => {
          const isDone = done.includes(i);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={isDone}
                className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-right transition hover:bg-white/[0.05]"
              >
                {isDone ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                )}
                <span className={`text-[13px] leading-6 ${isDone ? "text-muted-foreground line-through" : ""}`}>
                  {s.textAr}
                </span>
                <span className="ms-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {fmtNum(s.minutes)} د
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <dl className="mt-4 space-y-3 text-[13px] leading-6">
        <Card>
          <dt className="flex items-center gap-1.5 text-[11px] font-black text-teal-light-ink">
            <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
            المخرَج — وهو ما يُرفع
          </dt>
          <dd className="mt-1">{practice.artifactAr}</dd>
        </Card>
        <Card>
          <dt className="flex items-center gap-1.5 text-[11px] font-black text-muted-foreground">
            <UserRoundSearch className="h-3.5 w-3.5" aria-hidden="true" />
            لمن لا عمل له الآن
          </dt>
          <dd className="mt-1 text-foreground">{practice.alternativeAr}</dd>
        </Card>
      </dl>
    </section>
  );
}

/* موجة ٦ · أ-١ — لوح تغطية القياس: أين وزن فجوة المهارة خامل، وبأي سؤال يُفعَّل.

   لماذا هنا لا في سكربت: الرقم كان يُبلَّغ في بوابة المصدر ولا يُعالج، لأن
   إضافة سؤال قياس كانت تحتاج نشر كود (خطة الأسئلة مولَّدة وقت البناء). بعد
   ج-٢ صارت ممكنة من الإدارة — فالتقرير صار خطة عمل لا معلومة.

   ويقرأ **الكتالوج المثبَّت** لا ملفات المصدر: أي أنه يصف ما يعيشه المتعلم في
   اللقطة المنشورة الآن، لا ما في مستودع الكود. */

import { useMemo, useState } from "react";
import { Activity, ChevronDown, Gauge, HelpCircle, Target } from "lucide-react";
import { buildCoverageReport, coverageHeadlineAr } from "@/application/catalog/measurement-coverage";
import { countAr } from "@/application/text/count-ar";

import { Card, Inset } from "@/components/ui/Surface";
const PATHWAY_FORMS = { one: "مسارا", two: "مسارين", few: "مسارات", many: "مسارا" };

/* شريط تغطية — لونٌ ونصٌّ معا، فلا يُقرأ باللون وحده */
function Bar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = pct === 0 ? "bg-red-500/70" : pct < 34 ? "bg-amber-400/70" : "bg-teal";
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </span>
      <span dir="ltr" className="tabular-nums text-micro text-foreground">{pct}%</span>
    </span>
  );
}

export default function MeasurementCoverage({ className = "" }: { className?: string }) {
  const r = useMemo(() => buildCoverageReport(), []);
  const [openGaps, setOpenGaps] = useState(false);
  const [openOrphans, setOpenOrphans] = useState(false);

  const topGaps = r.gaps.filter((g) => g.unlocks.length > 0);
  const shownGaps = openGaps ? r.gaps : topGaps.slice(0, 5);

  return (
    <section className={className}>
      <h2 className="flex items-center gap-2 text-lg font-black">
        <Gauge className="h-5 w-5 text-gold-ink" aria-hidden="true" /> تغطية القياس — وزن فجوة المهارة
      </h2>
      <p className="mt-2 max-w-3xl text-xs leading-6 text-foreground">{coverageHeadlineAr(r)}</p>

      {/* الأثر أولا: أرخص ثلاثة أسئلة وما تفتحه */}
      {topGaps.length > 0 && (
        <Card tone="warn" className="mt-4">
          <p className="flex items-center gap-2 text-xs font-black text-gold-ink">
            <Target className="h-4 w-4" aria-hidden="true" /> أرخص طريق: سؤال واحد لكل مهارة
          </p>
          <p className="mt-1 text-micro leading-6 text-foreground">
            هذه المهارات يتطلبها أكثر من مسار بلا تغطية — فسؤال قياس واحد لكل واحدة
            يُخرج عدة مسارات من الصفر معا. الترتيب بما يُفتح لا بما يُستعمل.
          </p>
          <ul className="mt-3 space-y-2">
            {topGaps.slice(0, 3).map((g) => (
              <Inset as="li" key={g.slug} className="flex flex-wrap items-center gap-2 px-3 py-2 text-micro">
                <span className="font-black text-foreground">{g.nameAr}</span>
                <span dir="ltr" className="font-mono text-muted-foreground">{g.slug}</span>
                <span className="rounded-full border border-emerald-400/40 px-2 py-0.5 font-bold text-emerald-300">
                  يفتح {countAr(g.unlocks.length, PATHWAY_FORMS)}
                </span>
                <span className="text-muted-foreground">يتطلبه {countAr(g.pathwayIds.length, PATHWAY_FORMS)}</span>
              </Inset>
            ))}
          </ul>
        </Card>
      )}

      {/* المسارات — الأسوأ أولا */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[38rem] text-right text-xs">
          <caption className="sr-only">تغطية قياس المهارات لكل مسار، من الأسوأ إلى الأفضل</caption>
          <thead>
            <tr className="text-micro text-muted-foreground">
              <th scope="col" className="py-2 font-bold">المسار</th>
              <th scope="col" className="py-2 font-bold">التغطية</th>
              <th scope="col" className="py-2 font-bold">مقيس / نشط</th>
              <th scope="col" className="py-2 font-bold">الثمن</th>
            </tr>
          </thead>
          <tbody>
            {r.pathways.map((p) => (
              <tr key={p.pathwayId} className="border-t border-white/8">
                <td className="py-2.5 align-top">
                  <span className="font-bold text-foreground">{p.titleAr}</span>
                  <span dir="ltr" className="ms-2 font-mono text-micro text-muted-foreground">{p.pathwayId}</span>
                </td>
                <td className="py-2.5 align-top"><Bar value={p.coverage} /></td>
                <td className="py-2.5 align-top" dir="ltr">
                  <span className="tabular-nums text-foreground">{p.measured} / {p.activeSkills}</span>
                </td>
                <td className="py-2.5 align-top text-micro leading-5 text-foreground">{p.costAr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* كل الفجوات */}
      <button onClick={() => setOpenGaps(!openGaps)}
        className="mt-4 flex cursor-pointer items-center gap-1.5 text-micro font-bold text-teal-light-ink hover:text-foreground">
        <ChevronDown className={`h-3.5 w-3.5 transition ${openGaps ? "rotate-180" : ""}`} aria-hidden="true" />
        {openGaps ? "أخفِ الفجوات" : `اعرض كل الفجوات (${r.gaps.length})`}
      </button>
      {openGaps && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {shownGaps.map((g) => (
            <li key={g.slug} title={`المسارات: ${g.pathwayIds.join("، ")}`}
              className="rounded-full border border-white/12 bg-paper/20 px-3 py-1 text-micro text-foreground">
              {g.nameAr}
              <span className="ms-1.5 text-muted-foreground">·{g.pathwayIds.length}</span>
              {g.unlocks.length > 0 && <span className="ms-1 text-emerald-300">↑{g.unlocks.length}</span>}
            </li>
          ))}
        </ul>
      )}

      {/* الأسئلة المعلّقة */}
      {r.orphanQuestions.length > 0 && (
        <Card tone="warn" className="mt-6">
          <button onClick={() => setOpenOrphans(!openOrphans)}
            className="flex w-full cursor-pointer items-center gap-2 text-start text-xs font-black text-amber-300">
            <HelpCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {r.orphanQuestions.length} سؤال قياس يقيس مفتاحا ليس مهارة مسجَّلة
            <ChevronDown className={`ms-auto h-3.5 w-3.5 transition ${openOrphans ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          <p className="mt-1 text-micro leading-6 text-foreground">
            جوابُ هذه الأسئلة يسقط في متجه المهارات تحت مفتاح لا تطلبه دورة ولا يحتاجه مسار.
            ما كان منها على سطح B2C يُسأل المتعلم فعلا ولا يُحتسب — وما كان خارجه لا يُسأل،
            فالخلل فيه توثيقي لا وقتُ متعلم مهدور.
          </p>
          {openOrphans && (
            <ul className="mt-3 space-y-1.5">
              {r.orphanQuestions.map((q) => (
                <li key={q.questionId} className="flex flex-wrap items-center gap-2 text-micro leading-6">
                  <span dir="ltr" className="font-mono text-foreground">{q.questionId}</span>
                  <span className="text-muted-foreground">→</span>
                  <span dir="ltr" className="font-mono text-amber-300">{q.measuredKey}</span>
                  <span className={`rounded-full border px-2 py-0.5 font-bold ${
                    q.onB2cSurface ? "border-red-400/40 text-red-300" : "border-white/20 text-muted-foreground"
                  }`}>
                    {q.onB2cSurface ? "يُسأل ويُهمَل" : "خارج السطح — توثيقي"}
                  </span>
                  <span className="text-muted-foreground">{q.textAr}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <p className="mt-4 flex items-start gap-2 text-micro leading-6 text-muted-foreground">
        <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
        <span>
          الأرقام من الكتالوج المثبَّت الآن — أي من اللقطة المنشورة التي يعيشها المتعلم، لا من ملفات المستودع.
          وإضافة سؤال قياس صارت من الإدارة بلا نشر كود: يدخل خطة الأسئلة وطبقات المهارات عند بناء اللقطة.
        </span>
      </p>
    </section>
  );
}

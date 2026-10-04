/* ما تغيّر عن المعتمَد — سطورُه بخطوات المدرّب (٣ج-٤).

   يقرؤه المعتمِدُ في بطاقته قبل أن يعتمد المراجعة، ويقرؤه المدرّبُ في خطوة
   الإرسال قبل أن يرسلها — الشيءَ نفسَه. والقاعدةُ (ما يُذكر، وبأيّ خطوة) في
   `application/trainer/plan-diff.ts`؛ وهنا عرضُه وحدَه. */

import type { PlanDiffSection, SinceReturnRow } from '@/application/trainer/plan-diff'

export function PlanDiffList({ sections, emptyText }: { sections: PlanDiffSection[]; emptyText: string }) {
  if (sections.length === 0) return <p className="text-read leading-6 text-muted-foreground">{emptyText}</p>
  return (
    <dl className="space-y-2 text-read leading-7">
      {sections.map((s) => (
        <div key={s.section}>
          <dt className="font-bold text-foreground">{s.label}</dt>
          <dd>
            <ul className="list-disc space-y-0.5 ps-5 text-muted-foreground">
              {s.lines.map((line, i) => <li key={`${s.section}-${i}`}>{line}</li>)}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* «ما تغيّر منذ ردّك» — ملاحظتُك بجانب ما تغيّر في خطوتها (⑦، `sinceReturn`).
   وملاحظةٌ لا تغيّرَ بجانبها تُقال في مكانها بلونها — لعلّ جوابَها في لقاءٍ أو
   مهمّة (لهما قوائمُهما في البطاقة)، أو لم يُجِب. */
export function SinceReturnList({ general, rows }: { general: string | null; rows: SinceReturnRow[] }) {
  return (
    <div className="space-y-2 text-read leading-7">
      {general && (
        <p>
          <span className="font-bold text-foreground">ملاحظتُك العامّة: </span>
          <span className="text-muted-foreground">{general}</span>
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-muted-foreground">لم يعدّل في الخطّة نفسِها شيئا منذ ردّك.</p>
      ) : (
        <dl className="space-y-2">
          {rows.map((r) => (
            <div key={r.section}>
              <dt className="font-bold text-foreground">{r.label}</dt>
              <dd>
                {r.note && <p className="text-muted-foreground">ملاحظتُك: {r.note}</p>}
                {r.lines.length > 0 ? (
                  <ul className="list-disc space-y-0.5 ps-5 text-muted-foreground">
                    {r.lines.map((line, i) => <li key={`${r.section}-${i}`}>{line}</li>)}
                  </ul>
                ) : (
                  <p className="font-bold text-gold-ink" data-unchanged>
                    لم يتغيّر في هذه الخطوة شيءٌ من الخطّة نفسِها — واللقاءاتُ المباشرةُ والمهامُّ لها قوائمُها أدناه.
                  </p>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

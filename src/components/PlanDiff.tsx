/* ما تغيّر عن المعتمَد — سطورُه بخطوات المدرّب (٣ج-٤).

   يقرؤه المعتمِدُ في بطاقته قبل أن يعتمد المراجعة، ويقرؤه المدرّبُ في خطوة
   الإرسال قبل أن يرسلها — الشيءَ نفسَه. والقاعدةُ (ما يُذكر، وبأيّ خطوة) في
   `application/trainer/plan-diff.ts`؛ وهنا عرضُه وحدَه. */

import type { PlanDiffSection } from '@/application/trainer/plan-diff'

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

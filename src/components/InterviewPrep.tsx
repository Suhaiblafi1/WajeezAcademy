/* أسطرُ التهيئة للقاء التعارف — تُعرض لمن حجز، في موضعَين.

   لماذا مكوّنٌ لا نصٌّ في كلّ شاشة: المتقدّمُ يرى موعدَه في صفحة حسابه
   وفي صفحة المتابعة بالبريد — وهما بابان لإنسانٍ واحد. وقد افترقا من قبل:
   كانت إحداهما تعرض موعدَه والأخرى لا شيء، فحجز مرّتَين. فما يُقرأ في
   إحداهما يُقرأ في الأخرى، ومن موضعٍ واحد.

   وموضعُه تحت الموعد لا فوقَه: الخبرُ أوّلا («موعدك الخميس»)، ثمّ ما
   يُعمل به. ولا يُعرض لمن لم يحجز — لا تهيئةَ للقاءٍ بلا وقت. */

import { CalendarClock, CheckCircle2 } from 'lucide-react'
import { INTERVIEW_PREP, PREP_MISSED_AR, PREP_TITLE_AR } from '@/application/trainer/interview-prep'
import { Inset } from '@/components/ui/Surface'

export function InterviewPrep({ className = '' }: { className?: string }) {
  /* غاطسٌ لا بطاقة: تفصيلٌ داخل بطاقة الموعد لا قسمٌ قائمٌ بذاته — وسلّمُ
     الأسطح في `ui/Surface.tsx` يقول ذلك بالشكل بلا أن يُشرَح. */
  return (
    <Inset as="section" className={className}>
      <p className="flex items-center gap-2 text-read font-black text-foreground">
        <CheckCircle2 className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> {PREP_TITLE_AR}
      </p>
      <ul className="mt-3 space-y-2">
        {INTERVIEW_PREP.map((line) => (
          <li key={line.key} className="text-read leading-6 text-muted-foreground">
            <b className="text-foreground">{line.labelAr}</b> — {line.textAr}
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-start gap-2 text-read leading-6 text-muted-foreground">
        <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{PREP_MISSED_AR}</span>
      </p>
    </Inset>
  )
}

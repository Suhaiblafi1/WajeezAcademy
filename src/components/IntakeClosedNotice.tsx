import { CalendarClock } from 'lucide-react'
import { Card } from '@/components/ui/Surface'
import {
  INTAKE_CLOSED_AFTER_AR, INTAKE_CLOSED_BEFORE_AR, INTAKE_CLOSED_PROMISE_AR, INTAKE_CLOSED_TITLE_AR,
} from '@/application/trainer/intake-closed'

/* إشعارُ إغلاق الاستقبال — بطاقةٌ واحدةٌ لموضعين: رأسِ الاستمارة قبل أن يبدأ، وشاشةِ
   ما بعد الإرسال. والنصُّ وموعدُه من `application/trainer/intake-closed.ts` وحدَه. */
export default function IntakeClosedNotice({ when, className = '' }: {
  when: 'before' | 'after'
  className?: string
}) {
  return (
    <Card tone="warn" role="status" className={className}>
      <p className="flex items-center gap-2 text-sm font-black text-foreground">
        <CalendarClock className="h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />
        {INTAKE_CLOSED_TITLE_AR}
      </p>
      <p className="mt-2 pr-6 text-read leading-7 text-foreground">
        {when === 'before' ? INTAKE_CLOSED_BEFORE_AR : INTAKE_CLOSED_PROMISE_AR}
      </p>
      {when === 'after' && (
        <p className="mt-1 pr-6 text-read leading-7 text-muted-foreground">{INTAKE_CLOSED_AFTER_AR}</p>
      )}
    </Card>
  )
}

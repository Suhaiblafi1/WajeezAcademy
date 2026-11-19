/* المقاعدُ المتبقّيةُ لكلّ شعبة — في شريط بلاك فرايدي وبطاقة العرض والنموذج (١٩ نوفمبر ٢٠٢٦). والحسابُ في
   `seatsLeft` (`application/private-course/ai-jobs.ts`)، وهذه عرضُه وحدَه. */

import { useEffect, useState } from 'react'
import { AI_JOBS, seatsLabel, seatsLeft, type AiJobsSectionKey } from '@/application/private-course/ai-jobs'

/* ── المقاعدُ المتبقّية — بدل عدّاد الوقت: «حتى نفاد المقاعد» (١٩ نوفمبر ٢٠٢٦، `seatsLeft`) ── */

/** يُعاد الحسابُ كلَّ دقيقة — فمن ترك الصفحةَ مفتوحةً إلى منتصف ليل عمّان يرى عددَ يومه */
function useSeats() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  return AI_JOBS.sections.map((s) => ({ key: s.key, short: s.title.replace('الشعبة ', ''), n: seatsLeft(s.key, now) }))
}

export function Seats({ large = false }: { large?: boolean }) {
  const seats = useSeats()
  return (
    <span className={`aij-seats${large ? ' aij-seats-lg' : ''}`}>
      {seats.map((s) => (
        <span key={s.key}>
          {large ? <i style={{ fontStyle: 'normal' }}>{`الشعبة ${s.short}`}</i> : s.short}
          <b>{seatsLabel(s.n)}</b>
        </span>
      ))}
    </span>
  )
}

/** سطرُ المقاعد تحت الشعبة في النموذج والتفاصيل */
export function SeatPill({ sectionKey }: { sectionKey: AiJobsSectionKey }) {
  const seats = useSeats()
  const n = seats.find((s) => s.key === sectionKey)?.n ?? 0
  return <span className="aij-seat-pill">{seatsLabel(n)}</span>
}

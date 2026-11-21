/* حالُ الدورة للصفحة — التسجيلُ مفتوح؟ والدفعُ بالبطاقة مضبوط؟ (٢١ نوفمبر ٢٠٢٦)

   تقرؤه الصفحةُ (سطرُ البطاقة في العرض وسؤالُها) والنموذجُ (مغلقٌ أم مفتوح) معا، فيُطلب مرّةً واحدةً ويتقاسمانه. */

import { useEffect, useState } from 'react'
import { apiGet } from '@/services/api'
import { AI_JOBS } from '@/application/private-course/ai-jobs'

export interface CourseState {
  open: boolean
  card: boolean
}

let pending: Promise<CourseState> | null = null

function fetchState(): Promise<CourseState> {
  pending ??= apiGet<CourseState>(`/api/v1/public/private-courses/${AI_JOBS.slug}`)
    /* تعذّر الوصول — يبقى التسجيلُ مفتوحا ولا يُعرض خيارُ البطاقة: لا يُغلق بابٌ على غير جواب */
    .catch(() => ({ open: true, card: false }))
  return pending
}

/** `null` حتى يصل الجواب */
export function useCourseState(): CourseState | null {
  const [state, setState] = useState<CourseState | null>(null)
  useEffect(() => {
    let alive = true
    void fetchState().then((s) => { if (alive) setState(s) })
    return () => { alive = false }
  }, [])
  return state
}

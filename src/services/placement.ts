/* اختبارُ تحديد مستوى الإنجليزيّة — من الخادم.

   الأسئلةُ تصل بلا أجوبتها، والتصحيحُ على الخادم: الجوابُ الصحيحُ لا يصل المتصفّحَ
   أبدا. وحالُ الفتح تُقرأ مرّةً وتُحفظ للجلسة — يسأل عنها كلُّ سطرِ مستوى وكلُّ
   خطّة، ولا يتغيّر في دقائق. */

import { useEffect, useState } from 'react'
import { apiGet, apiPost } from './api'
import type { PlacementItem, PlacementResult } from '@/domain/placement/english-placement'

export type PublicPlacementItem = Omit<PlacementItem, 'answer_index'>

export interface PlacementBank {
  open: boolean
  items: PublicPlacementItem[]
}

let cached: Promise<PlacementBank> | null = null

export function fetchPlacementBank(): Promise<PlacementBank> {
  cached ??= apiGet<PlacementBank>('/api/public/placement/english').catch((e) => {
    cached = null
    throw e
  })
  return cached
}

/** هل الاختبارُ مفتوح؟ — `null` حتّى يُعرف، و`false` إن تعذّر السؤال */
export function usePlacementOpen(): boolean | null {
  const [open, setOpen] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    fetchPlacementBank().then((b) => { if (live) setOpen(b.open) }, () => { if (live) setOpen(false) })
    return () => { live = false }
  }, [])
  return open
}

export function scorePlacement(answers: Record<string, number>): Promise<PlacementResult> {
  return apiPost<PlacementResult>('/api/public/placement/english/score', { answers })
}

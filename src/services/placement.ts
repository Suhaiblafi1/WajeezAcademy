/* اختبارُ تحديد مستوى الإنجليزيّة — من الخادم.

   الأسئلةُ تصل بلا أجوبتها، والتصحيحُ على الخادم: الجوابُ الصحيحُ لا يصل المتصفّحَ
   أبدا. وحالُ الفتح تُقرأ مرّةً وتُحفظ للجلسة — يسأل عنها كلُّ سطرِ مستوى وكلُّ
   خطّة، ولا يتغيّر في دقائق. */

import { useEffect, useState } from 'react'
import { apiGet, apiPost } from './api'
import { rememberMeasuredEnglish, rememberMeasuredField } from '@/application/placement/measured'
import { FIELD_CHECKS, type FieldCheckResult, type FieldSubject } from '@/domain/placement/field-check'
import type { PlacementItem, PlacementResult } from '@/domain/placement/english-placement'

/** سؤالٌ بلا جوابه — ومستواه رمزُ السلّم: A1… في الإنجليزيّة، وbasics… في المجال */
export type PublicPlacementItem = Omit<PlacementItem, 'answer_index' | 'level' | 'skill'> & { level: string; skill: string }

export interface PlacementBank {
  open: boolean
  items: PublicPlacementItem[]
}

/** والموضوعُ الإنجليزيّةُ أو أحدُ فحوص المجالات — والبنكُ واحدٌ في الخادم */
export type PlacementSubjectCode = 'english' | FieldSubject

const cached = new Map<string, Promise<PlacementBank>>()

export function fetchPlacementBank(subject: PlacementSubjectCode = 'english'): Promise<PlacementBank> {
  let p = cached.get(subject)
  if (!p) {
    p = apiGet<PlacementBank>(`/api/public/placement/${subject}`).catch((e) => {
      cached.delete(subject)
      throw e
    })
    cached.set(subject, p)
  }
  return p
}

/** هل الاختبارُ مفتوح؟ — `null` حتّى يُعرف (أو بلا موضوع)، و`false` إن تعذّر السؤال */
export function usePlacementOpen(subject: PlacementSubjectCode | null = 'english'): boolean | null {
  const [open, setOpen] = useState<boolean | null>(null)
  useEffect(() => {
    if (!subject) return
    let live = true
    fetchPlacementBank(subject).then((b) => { if (live) setOpen(b.open) }, () => { if (live) setOpen(false) })
    return () => { live = false }
  }, [subject])
  return subject ? open : null
}

/** يصحّح ويحفظ المستوى المقيسَ على الجهاز — ليقول سطرُ المستوى «مقيس» حين تُبنى الخطّةُ عليه */
export async function scorePlacement(answers: Record<string, number>): Promise<PlacementResult> {
  const result = await apiPost<PlacementResult>('/api/public/placement/english/score', { answers })
  rememberMeasuredEnglish(result.level)
  return result
}

/** فحصُ المجال: يصحّح ويحفظ المستوى المقيسَ للاحتياج على الجهاز */
export async function scoreFieldCheckOn(subject: FieldSubject, answers: Record<string, number>): Promise<FieldCheckResult> {
  const result = await apiPost<FieldCheckResult>(`/api/public/placement/${subject}/score`, { answers })
  const need = FIELD_CHECKS.find((c) => c.subject === subject)?.need
  if (need) rememberMeasuredField(need, result.level)
  return result
}

/* رموزُ الدورات المعروضة في قوائم الموقع — نداءٌ واحدٌ في الزيارة تتقاسمه الصفحاتُ كلُّها.
   والقاعدةُ وما يُفعل بجوابها في `application/catalog/listed-courses.ts`. */

import { useEffect, useState } from 'react'
import { withRetry } from './retry'
import { listedFromResponse, type ListedCourses } from '@/application/catalog/listed-courses'

const API_BASE: string = import.meta.env.VITE_API_URL ?? ''

/* وعدٌ واحدٌ للزيارة: القسمُ والرئيسةُ والبحثُ يسألون معا فلا يُجلب الشيءُ ثلاثا */
let pending: Promise<ListedCourses> | null = null

function load(): Promise<ListedCourses> {
  pending ??= withRetry(async () => {
    const r = await fetch(`${API_BASE}/api/public/listed-courses`)
    if (!r.ok) throw new Error(`listed-courses ${r.status}`)
    return r.json() as Promise<unknown>
  })
    .then((raw): ListedCourses => {
      const ids = listedFromResponse(raw)
      return ids ? { state: 'ready', ids } : { state: 'failed' }
    })
    .catch((): ListedCourses => {
      /* ومن تعذّر عليه يُعاد له في الزيارة التالية لا في هذه */
      return { state: 'failed' }
    })
  return pending
}

export function useListedCourses(): ListedCourses {
  const [listed, setListed] = useState<ListedCourses>({ state: 'loading' })
  useEffect(() => {
    let on = true
    void load().then((v) => { if (on) setListed(v) })
    return () => { on = false }
  }, [])
  return listed
}

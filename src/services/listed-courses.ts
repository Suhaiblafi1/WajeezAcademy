/* رموزُ الدورات المعروضة في قوائم الموقع — نداءٌ واحدٌ في الزيارة تتقاسمه الصفحاتُ كلُّها.
   والقاعدةُ وما يُفعل بجوابها في `application/catalog/listed-courses.ts`.

   ═══ وأوّلُ إخفاقٍ يُظهر الكتالوجَ كلَّه — والإعادةُ تمضي في الخلفيّة ═══

   كان «تعذّر» لا يُقال إلّا بعد أن تنفد فواصلُ الإعادة (نحو نصف دقيقة، `retry.ts`)، وفي أثنائها
   قسمُ الدورات فارغٌ يقول «جار التحميل». فسقط فحصُ الإتاحة في CI — الواجهةُ تُبنى فيه بلا خادم،
   وينتظر بطاقةً خمسا وعشرين ثانية — وكان الزائرُ سيرى الشيءَ نفسَه في ثواني النشر التي يُقلع
   فيها الخادم. فصار أوّلُ إخفاقٍ يُظهر الكتالوجَ كلَّه فورا، وتبقى الإعادةُ تعمل: فإن نجحت
   انكمشت القائمةُ إلى ما له شعبة. والمجهولُ يُعرض كلُّه، والمعلومُ يُرشَّح. */

import { useEffect, useSyncExternalStore } from 'react'
import { withRetry } from './retry'
import { listedFromResponse, type ListedCourses } from '@/application/catalog/listed-courses'

const API_BASE: string = import.meta.env.VITE_API_URL ?? ''

let current: ListedCourses = { state: 'loading' }
let started = false
const listeners = new Set<() => void>()

function set(next: ListedCourses) {
  current = next
  for (const l of listeners) l()
}

function start() {
  if (started) return
  started = true
  void withRetry(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/public/listed-courses`)
      if (!r.ok) throw new Error(`listed-courses ${r.status}`)
      const ids = listedFromResponse(await r.json())
      if (!ids) throw new Error('listed-courses: جوابٌ لا يقرأ')
      return ids
    } catch (err) {
      /* أوّلُ إخفاقٍ لا يُبقي القسمَ فارغا — والإعادةُ ماضية */
      if (current.state === 'loading') set({ state: 'failed' })
      throw err
    }
  })
    .then((ids) => set({ state: 'ready', ids }))
    .catch(() => undefined)
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
const snapshot = () => current

export function useListedCourses(): ListedCourses {
  useEffect(start, [])
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

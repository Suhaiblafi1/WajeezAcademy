/* الفصلُ القادم — جوابُ «متى تبدأ؟» (البند ٥٢).

   صفحتا الدورات والمسارات لا تعرضان تواريخَ إطلاقا، والجوابُ الصادقُ الوحيدُ
   اليوم عن «متى تبدأ هذه الدورة؟» هو **«يُعلن الموعد مع فتح الشعبة»** — وهو
   صادقٌ ولا يفيد: يقرؤه الزائرُ فلا يعرف أينتظر أسبوعا أم فصلا.

   وبعد أن صار للفصل كيانٌ بتواريخ، صار للجملة تتمّة: «تفتح في موسم الربيع
   (فبراير – أبريل)، والتسجيل يبدأ ٢٠ يناير». والفارقُ بين الجملتين هو الفارقُ
   بين انتظارٍ أعمى وموعدٍ يُنتظَر.

   ولا يُخترع شيء: ما لم يُنشَأ فصلٌ بعدُ تبقى الجملةُ الأولى كما هي. */

import { useEffect, useState } from 'react'
import { apiGet } from './api'

export interface UpcomingTerm {
  id: string
  titleAr: string
  startsOn: string
  endsOn: string
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  registrationOpen: boolean
  calendarPublished: boolean
}

/* لقطةٌ واحدةٌ للتطبيق كلِّه: الفصلُ لا يتغيّر بين بطاقةٍ وأخرى، ونداءٌ لكلّ
   بطاقةِ دورةٍ في شبكةٍ من ثمانين يُغرق الخادمَ بلا فائدة. */
let cached: UpcomingTerm | null | undefined
let inflight: Promise<UpcomingTerm | null> | null = null
const listeners = new Set<() => void>()

async function fetchOnce(): Promise<UpcomingTerm | null> {
  if (cached !== undefined) return cached
  inflight ??= apiGet<{ term: UpcomingTerm | null }>('/api/public/upcoming-term')
    .then((r) => {
      cached = r.term
      return cached
    })
    .catch(() => {
      /* لا فصلَ يُعرض ولا خطأٌ يُزعج الزائر — الجملةُ القديمةُ تكفي */
      cached = null
      return null
    })
    .finally(() => {
      inflight = null
      for (const fn of listeners) fn()
    })
  return inflight
}

/** الفصلُ القادم — `undefined` ما دام يُقرأ، و`null` إن لم يوجد */
export function useUpcomingTerm(): UpcomingTerm | null | undefined {
  const [term, setTerm] = useState<UpcomingTerm | null | undefined>(cached)
  useEffect(() => {
    let on = true
    const sync = () => { if (on) setTerm(cached) }
    listeners.add(sync)
    void fetchOnce().then(sync)
    return () => { on = false; listeners.delete(sync) }
  }, [])
  return term
}

/** لأغراض الاختبار وحدَها — تُفرَّغ اللقطةُ فتُقرأ من جديد */
export function resetUpcomingTermCache(): void {
  cached = undefined
  inflight = null
}

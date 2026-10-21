/* عددُ غير المقروء لبوّابةٍ — مخزنٌ واحدٌ يقرؤه الجرسُ وبندُ القائمة معا (٢١ أكتوبر ٢٠٢٦).

   صار للمدرّب بندٌ «الرسائل والتنبيهات» يحمل العددَ الذي يحمله الجرس. ونداءٌ في كلٍّ منهما طلبان
   كلَّ نصفِ دقيقةٍ لرقمٍ واحد — وكان الإطارُ ينادي `/api/auth/me` خمسَ مرّاتٍ في الفتحة الواحدة قبل
   أن يُوحَّد. فمخزنٌ لكلّ جمهور كمخزن أرقام واتساب (`whatsapp.ts`): أوّلُ مشتركٍ يُشعل العدَّ والمؤقّت،
   وآخرُ من يغادر يطفئهما. ومن قرأ في الصندوق يعاد العدُّ فورا (`inbox-events.ts`). */

import { useSyncExternalStore } from 'react'
import { apiGet } from '@/services/api'
import { onInboxRead } from '@/services/inbox-events'

export type UnreadAudience = 'learner' | 'trainer' | 'staff'

const EVERY_MS = 30_000

interface Store {
  value: number
  listeners: Set<() => void>
  stop: (() => void) | null
}
const stores = new Map<UnreadAudience, Store>()

function storeFor(audience: UnreadAudience): Store {
  let s = stores.get(audience)
  if (!s) { s = { value: 0, listeners: new Set(), stop: null }; stores.set(audience, s) }
  return s
}

/** يعيد العدَّ من الخادم الآن — بعد قراءةٍ أو حين يُطلب */
export async function refreshUnread(audience: UnreadAudience): Promise<void> {
  const s = storeFor(audience)
  try {
    const r = await apiGet<{ unread: number }>(`/api/learner/notifications/unread-count?audience=${audience}`)
    if (r.unread !== s.value) { s.value = r.unread; for (const l of s.listeners) l() }
  } catch { /* بلا جلسة أو خادمٍ غير متاح — يبقى الرقمُ الأخير */ }
}

function subscribe(audience: UnreadAudience, cb: () => void): () => void {
  const s = storeFor(audience)
  s.listeners.add(cb)
  if (!s.stop) {
    void refreshUnread(audience)
    const t = window.setInterval(() => void refreshUnread(audience), EVERY_MS)
    const off = onInboxRead(() => void refreshUnread(audience))
    s.stop = () => { window.clearInterval(t); off() }
  }
  return () => {
    s.listeners.delete(cb)
    if (s.listeners.size === 0 && s.stop) { s.stop(); s.stop = null }
  }
}

/** العددُ كما يعرفه المخزن — و`enabled` يُطفئه لمن لا جلسةَ له */
export function useUnreadCount(audience: UnreadAudience, enabled = true): number {
  return useSyncExternalStore(
    (cb) => (enabled ? subscribe(audience, cb) : () => undefined),
    () => (enabled ? storeFor(audience).value : 0),
    () => 0,
  )
}

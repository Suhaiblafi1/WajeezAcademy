/* حفظُ الشراء المعلّق وقراءتُه على الجهاز (`application/commerce/pending-checkout.ts`).

   التخزينُ المحلّيّ لا الجلسيّ: رابطُ التوثيق يُفتح في تبويبٍ جديد، والجلسيُّ لا يعبر التبويب. وكلُّ
   نداءٍ في `try`: تخزينٌ معطَّلٌ (نافذةٌ خاصّة) يُسقط العودةَ لا الشراء. */

import {
  PENDING_CHECKOUT_KEY, parsePendingCheckout, type PendingCheckout,
} from '@/application/commerce/pending-checkout'

export function savePendingCheckout(p: Omit<PendingCheckout, 'at'>): void {
  try { localStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({ ...p, at: Date.now() })) } catch { /* بلا تخزين — يمضي الشراء */ }
}

export function readPendingCheckout(now = Date.now()): PendingCheckout | null {
  try { return parsePendingCheckout(localStorage.getItem(PENDING_CHECKOUT_KEY), now) } catch { return null }
}

/** يُمحى حين يُنشأ الطلب — فلا يُعرض «أكمل شراءك» على ما اشتُري */
export function clearPendingCheckout(): void {
  try { localStorage.removeItem(PENDING_CHECKOUT_KEY) } catch { /* لا شيء يُمحى */ }
}

/** ما تُعاد به صفحةُ القرار — إن جاءت بـ`?resume=1` وكان المحفوظُ لها هي */
export function resumedCheckoutFor(path: string): PendingCheckout | null {
  if (typeof window === 'undefined' || new URLSearchParams(window.location.search).get('resume') !== '1') return null
  const p = readPendingCheckout()
  return p && p.path === path ? p : null
}

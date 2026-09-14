/* أرقامُ واتساب كما تقرؤها الشاشة — نداءٌ واحدٌ للجلسة، ورجوعٌ لا يكسر.

   ═══ لماذا `useSyncExternalStore` ولا `useEffect` في كلّ مكوّن ═══

   الأرقامُ تُقرأ في خمسة مواضع، منها ما يظهر في الصفحة الرئيسية وصفحة المسار
   معا. ونداءٌ في كلّ مكوّنٍ يعني خمسةَ طلباتٍ لشيءٍ واحدٍ لا يتغيّر في الجلسة.

   فمخزنٌ صغيرٌ واحد: أوّلُ مكوّنٍ يطلب يُشعل النداء، والبقيّةُ تشترك فيه.

   ═══ والرجوعُ إلى الرقم المدمج ═══

   حتّى يُضبط أوّلُ رقمٍ من الإدارة، يبقى `CONTACT.whatsapp` عاملا. فالنشرةُ
   لا تُطفئ أزرارَ الموقع في انتظار أن يفتح أحدٌ شاشةَ الإعدادات. */

import { useSyncExternalStore } from 'react'
import type { WhatsAppNumbers } from '@/application/site/whatsapp'

let numbers: WhatsAppNumbers = {}
let started = false
const listeners = new Set<() => void>()

function emit() { for (const l of listeners) l() }

function start() {
  if (started) return
  started = true
  fetch('/api/site/whatsapp')
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { numbers?: WhatsAppNumbers } | null) => {
      if (d?.numbers) { numbers = d.numbers; emit() }
    })
    .catch(() => { /* يبقى الرقمُ المدمج — ولا زرَّ يُطفأ لأنّ نداءً أخفق */ })
}

export function useWhatsAppNumbers(): WhatsAppNumbers {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); start(); return () => { listeners.delete(cb) } },
    () => numbers,
    () => numbers,
  )
}

/** للاختبارات وللشاشة بعد الحفظ — يُحدَّث المخزنُ بلا إعادة تحميل */
export function setWhatsAppNumbers(next: WhatsAppNumbers) {
  numbers = next
  started = true
  emit()
}

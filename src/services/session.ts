/* جلسة الخادم الحقيقية — جسر واحد بين تسجيل الدخول عبر API وبوابات المنصات.
   كل بوابة كانت تعتمد هوية محلية تجريبية؛ هذا الخطاف يتيح لها التعرف على
   الحساب الحقيقي فتتجاوز شاشة «من أنت؟» لمن سجّل دخوله فعلا. */

import { useEffect, useState } from "react";
import { apiGet } from "./api";

export interface SessionUser {
  userId: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  /* توثيق البريد (١هـ) — يحجب الشراء والشهادة فقط، لا الدخول ولا التصفّح */
  emailVerified: boolean;
}

/** يجلب جلسة الخادم مرة واحدة — user=null حتى يكتمل الفحص أو عند غياب جلسة.

    ومعها حالةُ قناة البريد: حاجزُ التوثيق **لا يُفرَض حين تكون مغلقة** (الخادمُ
    يُسقطه صراحةً). فبدونها تقول الواجهةُ للمتعلّم إنّ شراءَه موقوفٌ وهو ليس
    موقوفا، وتعرض عليه زرَّ إرسالٍ لا يمكن أن ينجح. */
export function useRealSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [emailChannel, setEmailChannel] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    apiGet<{ user: SessionUser | null; emailChannelEnabled?: boolean }>("/api/auth/me")
      .then((r) => {
        setUser(r.user ?? null);
        setEmailChannel(r.emailChannelEnabled ?? null);
      })
      .catch(() => setUser(null))
      .finally(() => setChecked(true));
  }, []);
  return { user, checked, emailChannel };
}

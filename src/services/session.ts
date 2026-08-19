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
}

/** يجلب جلسة الخادم مرة واحدة — user=null حتى يكتمل الفحص أو عند غياب جلسة */
export function useRealSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    apiGet<{ user: SessionUser | null }>("/api/auth/me")
      .then((r) => setUser(r.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setChecked(true));
  }, []);
  return { user, checked };
}

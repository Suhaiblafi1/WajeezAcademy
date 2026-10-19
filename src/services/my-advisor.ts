/* مستشارُ الطالب المسنَد — اسمُه وحدَه، من `GET /api/learner/advisor` (١٩ أكتوبر ٢٠٢٦).

   يقرؤه زرُّ المراسلة في كلّ موضع (`AdvisorContact`) وبطاقةُ «مستشارك» في اللوحة — فيُسأل
   الخادمُ مرّةً لكلّ جلسةٍ لا مع كلّ زرّ. ومن لا جلسةَ له لا يُسأل عنه شيء: الزائرُ لا مستشارَ
   له بعد. والفشلُ يُقرأ «لا مستشار» — الزرُّ يعمل بلا اسم كما كان. */

import { useEffect, useState } from "react";
import { apiGet } from "@/services/api";
import { readSession } from "@/services/auth";

const TTL_MS = 5 * 60_000;
let cached: { email: string; at: number; name: Promise<string | null> } | null = null;

export function fetchMyAdvisorName(): Promise<string | null> {
  const session = readSession();
  if (!session) return Promise.resolve(null);
  if (cached && cached.email === session.email && Date.now() - cached.at < TTL_MS) return cached.name;
  const name = apiGet<{ advisor: { displayName: string } | null }>("/api/learner/advisor")
    .then((r) => r.advisor?.displayName ?? null)
    .catch(() => null);
  cached = { email: session.email, at: Date.now(), name };
  return name;
}

export function useMyAdvisorName(): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    void fetchMyAdvisorName().then((n) => { if (on) setName(n); });
    return () => { on = false; };
  }, []);
  return name;
}

/* لقاءاتُ شعبي الآتية — يُقابَل بها ما أختاره من شعبٍ قبل أن أدفع (`application/learning/cohort-overlap.ts`).

   مرّةً لكلّ حساب، ولمن دخل وحدَه: الزائرُ لا شعبَ له، فلا يُسأل الخادمُ عنه. وإن تعذّرت القراءةُ فلا تنبيه —
   لا يقف اختيارُ الشعبة عليها. */

import { useEffect, useState } from "react";
import { apiGet } from "@/services/api";
import { fetchMe } from "@/services/me";
import type { TimedCohort } from "@/application/learning/cohort-overlap";

/* ═══ ولكلّ حسابٍ جوابُه (٢٤ أكتوبر ٢٠٢٦) ═══
   كان الجوابُ محفوظا للتبويب كلِّه، والخروجُ لا يعيد تحميل الصفحة — فيرى الداخلُ بعده في التبويب نفسِه دوراتِ
   من قبله في «تتعارض مع «…»». فيُحفظ بمعرّف صاحبه، ويُسأل من جديد لغيره. ولا يُحفظ ما تعذّر */
let cache: { userId: string; cohorts: Promise<TimedCohort[]> } | null = null;

async function load(): Promise<TimedCohort[]> {
  const me = await fetchMe().catch(() => null);
  const userId = me?.user?.userId;
  if (!userId) return [];
  if (cache?.userId !== userId) {
    const cohorts = apiGet<{ cohorts: TimedCohort[] }>("/api/learner/my-sessions").then((r) => r.cohorts);
    cache = { userId, cohorts };
    cohorts.catch(() => { if (cache?.cohorts === cohorts) cache = null; });
  }
  return cache.cohorts.catch(() => []);
}

export function useMySessions(): TimedCohort[] {
  const [list, setList] = useState<TimedCohort[]>([]);
  useEffect(() => {
    let alive = true;
    void load().then((x) => { if (alive) setList(x); });
    return () => { alive = false; };
  }, []);
  return list;
}

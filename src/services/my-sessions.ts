/* لقاءاتُ شعبي الآتية — يُقابَل بها ما أختاره من شعبٍ قبل أن أدفع (`application/learning/cohort-overlap.ts`).

   مرّةً للصفحة، ولمن دخل وحدَه: الزائرُ لا شعبَ له، فلا يُسأل الخادمُ عنه. وإن تعذّرت القراءةُ فلا تنبيه —
   لا يقف اختيارُ الشعبة عليها. */

import { useEffect, useState } from "react";
import { apiGet } from "@/services/api";
import { fetchMe } from "@/services/me";
import type { TimedCohort } from "@/application/learning/cohort-overlap";

let cache: Promise<TimedCohort[]> | null = null;

function load(): Promise<TimedCohort[]> {
  if (cache) return cache;
  const run = fetchMe()
    .then((me) => (me.user ? apiGet<{ cohorts: TimedCohort[] }>("/api/learner/my-sessions").then((r) => r.cohorts) : null))
    .catch(() => null);
  /* ومن لم يدخل بعدُ لا يُحفظ له جواب — فإن دخل في الصفحة نفسِها سُئل من جديد */
  cache = run.then((x) => x ?? []);
  void run.then((x) => { if (x === null) cache = null; });
  return cache;
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

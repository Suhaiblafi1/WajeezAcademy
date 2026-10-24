/* أوقاتُ الدورات القريبة — قراءتُها مرّةً لكلّ شعبة، وما يقع منها على وقتٍ مختار. والعرضُ في `NearbyTimes.tsx`،
   وفُصلا لأنّ ملفَّ المكوّنات لا يصدّر غيرَها (`react-refresh/only-export-components`). */

import { useEffect, useState } from "react";
import { apiGet } from "@/services/api";
import { nearbyAt, type NearbyTime } from "@/application/terms/schedule-clash";
import { MIN_SESSION_MINUTES, toMinutes } from "@/application/trainer/session-length";
import { zonedInstant } from "@/application/trainer/cohort-period";

/* مرّةً لكلّ شعبةٍ في الصفحة — بطاقاتُ المواعيد كلُّها تقرأ القائمةَ نفسَها */
const cache = new Map<string, Promise<NearbyTime[]>>();

export function useNearbyTimes(cohortId: string): NearbyTime[] {
  const [list, setList] = useState<NearbyTime[]>([]);
  useEffect(() => {
    let alive = true;
    let p = cache.get(cohortId);
    if (!p) {
      /* وإن تعذّرت القراءةُ فلا تنبيه — لا يقف اختيارُ الموعد عليها */
      p = apiGet<{ nearby: NearbyTime[] }>(`/api/trainer/cohorts/${cohortId}/nearby-times`).then((r) => r.nearby);
      cache.set(cohortId, p);
      /* وما تعذّر لا يُحفظ فارغا — يُسأل من جديد في الفتحة التالية */
      const failed = p;
      failed.catch(() => { if (cache.get(cohortId) === failed) cache.delete(cohortId); });
    }
    void p.then((x) => { if (alive) setList(x); }, () => undefined);
    return () => { alive = false; };
  }, [cohortId]);
  return list;
}

const at = (date: string, clock: string) => {
  const m = toMinutes(clock) ?? 0;
  return zonedInstant(date, [Math.floor(m / 60), m % 60, 0, 0]);
};

/** ما يقع على لقاءٍ يبدأ في هذه الساعة — وطولُه المختارُ إن اختير، وإلّا أقصرُ لقاء */
export function nearbyHits(nearby: readonly NearbyTime[], date: string, from: string, to?: string): NearbyTime[] {
  if (!date || !from || nearby.length === 0) return [];
  const start = at(date, from);
  const end = to ? at(date, to) : new Date(start.getTime() + MIN_SESSION_MINUTES * 60_000);
  return nearbyAt(nearby, start, end);
}

/** وسمُ الساعة في القائمة — « · دورة قريبة» */
export const nearbyMarkAr = (nearby: readonly NearbyTime[], date: string, from: string) =>
  nearbyHits(nearby, date, from).length > 0 ? " · فيها دورة قريبة" : "";

/* أوقاتُ الدورات القريبة — يراها المدرّبُ وهو يختار موعدَ لقائه، فيتجنّبها أو يبقي اختياره (٢٢ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «عندما يختار موعدا يُذكر له أنّ هذا الموعدَ اختاره مدرّبٌ آخر لدورةٍ قد تكون متكاملةً مع
   دورتك، فننصح بتغييرها أو نعطيه الخيارَ أن يضيفها على أيّ حال». فثلاثةُ مواضع: الساعةُ في القائمة موسومةٌ إن
   وقعت على لقاءٍ قريب، واليومُ المختارُ يقول ما فيه منها، والوقتُ المختارُ يُنبَّه عليه — ولا شيءَ يمنع الحفظ.

   والقاعدةُ (أيُّ دورتين مربوطتان) في `application/terms/schedule-clash.ts`، واللقاءاتُ من
   `GET /api/trainer/cohorts/:id/nearby-times` — باسم الدورة وسبب الربط، لا باسم مدرّبها. */

import { useEffect, useState } from "react";
import { CalendarClock, TriangleAlert } from "lucide-react";
import { apiGet } from "@/services/api";
import { nearbyAt, nearbyOnDay, nearbySpanAr, nearbyWarnAr, type NearbyTime } from "@/application/terms/schedule-clash";
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
      p = apiGet<{ nearby: NearbyTime[] }>(`/api/trainer/cohorts/${cohortId}/nearby-times`).then((r) => r.nearby).catch(() => []);
      cache.set(cohortId, p);
    }
    void p.then((x) => { if (alive) setList(x); });
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

/** ما في اليوم المختار من لقاءات الدورات القريبة — قبل أن يختار الساعة */
export function NearbyDay({ nearby, day }: { nearby: readonly NearbyTime[]; day: string }) {
  const list = day ? nearbyOnDay(nearby, day) : [];
  if (list.length === 0) return null;
  return (
    <p className="flex items-start gap-2 text-read leading-6 text-muted-foreground">
      <CalendarClock className="mt-1 h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
      <span>في هذا اليوم لقاءات لدورات قريبة من دورتك: {list.map(nearbySpanAr).join("، ")}. اختر ساعة لا تقع عليها إن استطعت.</span>
    </p>
  );
}

/** التنبيهُ على الوقت المختار — ينصح ولا يمنع */
export function NearbyWarn({ hits }: { hits: readonly NearbyTime[] }) {
  const text = nearbyWarnAr(hits);
  if (!text) return null;
  return (
    <p role="status" className="flex items-start gap-2 text-read font-bold leading-6 text-gold-ink">
      <TriangleAlert className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}

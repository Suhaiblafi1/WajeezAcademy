/* أوقاتُ الدورات القريبة — يراها المدرّبُ وهو يختار موعدَ لقائه، فيتجنّبها أو يبقي اختياره (٢٢ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «عندما يختار موعدا يُذكر له أنّ هذا الموعدَ اختاره مدرّبٌ آخر لدورةٍ قد تكون متكاملةً مع
   دورتك، فننصح بتغييرها أو نعطيه الخيارَ أن يضيفها على أيّ حال». فثلاثةُ مواضع: الساعةُ في القائمة موسومةٌ إن
   وقعت على لقاءٍ قريب، واليومُ المختارُ يقول ما فيه منها، والوقتُ المختارُ يُنبَّه عليه — ولا شيءَ يمنع الحفظ.

   والقاعدةُ (أيُّ دورتين مربوطتان) في `application/terms/schedule-clash.ts`، واللقاءاتُ من
   `GET /api/trainer/cohorts/:id/nearby-times` — باسم الدورة وسبب الربط، لا باسم مدرّبها. */

import { CalendarClock, TriangleAlert } from "lucide-react";
import { nearbyOnDay, nearbySpanAr, nearbyWarnAr, type NearbyTime } from "@/application/terms/schedule-clash";

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

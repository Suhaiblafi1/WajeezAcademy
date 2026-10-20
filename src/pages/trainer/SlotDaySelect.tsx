/* يومُ اللقاء أو يومُ فتح الجلسة المسجّلة — من أيّام الموعد وحدَها (١١ أكتوبر ٢٠٢٦).

   «اعرض لي الوقتَ المسموحَ به وحدَه» (صاحب المنصّة): لا تقويمٌ مفتوحٌ يُكتب فيه أيُّ يومٍ ثمّ
   تُقال ملاحظة، بل قائمةُ أيّام الموعد (`slotDays`). ويومٌ محفوظٌ خارجَها — قبل هذه القائمة، أو
   بعد أن تغيّر الموعد — يُعرض كما هو معلَّما «خارجَ وقت المحور» ولا يُختار ثانيةً.

   و`upcoming` لأيّام اللقاءات (٢٠ أكتوبر ٢٠٢٦): ما مضى من أيّام الموعد لا يُعرض، ويومٌ محفوظٌ مضى
   يُعلَّم «مضى» — «Block it» (صاحب المنصّة)، وبابُ الخادم يردّه (`pastTimeProblem`). */

import { useMemo } from "react";
import { staffControlCls } from "@/components/FormKit";
import { slotDayOptionAr, slotDays } from "@/application/trainer/session-picker";
import { zonedDay } from "@/application/trainer/cohort-period";
import type { PlanSlot } from "@/application/trainer/axis-timeline";

export default function SlotDaySelect({ slot, value, onChange, ariaLabel, disabled, upcoming, placeholder = "اختر اليوم" }: {
  slot: Pick<PlanSlot, "startsOn" | "endsOn">;
  value: string;
  onChange: (date: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  /** يومُ لقاء: لا يُعرض ما مضى من الأيّام */
  upcoming?: boolean;
  placeholder?: string;
}) {
  const today = upcoming ? zonedDay(new Date()) : undefined;
  const days = useMemo(() => slotDays(slot, today), [slot, today]);
  const foreign = value !== "" && !days.some((d) => d.date === value);
  const foreignAr = today && value < today ? "مضى" : "خارج وقت المحور";
  return (
    <select value={value} disabled={disabled} aria-label={ariaLabel}
      onChange={(e) => e.target.value && onChange(e.target.value)} className={staffControlCls}>
      <option value="" disabled={value !== ""}>{placeholder}</option>
      {foreign && <option value={value} disabled>{value} · {foreignAr}</option>}
      {days.map((d) => <option key={d.date} value={d.date}>{slotDayOptionAr(d)}</option>)}
    </select>
  );
}

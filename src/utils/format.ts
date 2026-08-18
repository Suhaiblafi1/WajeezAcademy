/* ─────────── تنسيق وقت عربي موحد لكل البوابات ───────────
   القريب نسبي («قبل 3 أيام»، «غدا 14:30») والبعيد تاريخ كامل.
   يقبل ISO كاملا أو تاريخا فقط (YYYY-MM-DD) أو الصيغة الناقصة (YYYY-MM-DDTHH:MM). */

function plural(n: number, one: string, two: string, few: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${few}`;
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fullDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fmtWhen(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMin = Math.round(Math.abs(diffMs) / 60000);
  const dayMs = 86400000;
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);

  /* مستقبل */
  if (diffMs > 0) {
    if (sameDay) return diffMin < 60 ? `بعد ${plural(Math.max(1, diffMin), "دقيقة", "دقيقتين", "دقائق")}` : `اليوم ${hhmm(d)}`;
    if (d.toDateString() === tomorrow.toDateString()) return `غدا ${hhmm(d)}`;
    const days = Math.round(diffMs / dayMs);
    if (days < 7) return `بعد ${plural(days, "يوم", "يومين", "أيام")}`;
    return `${fullDate(d)} · ${hhmm(d)}`;
  }

  /* ماضٍ */
  if (sameDay) {
    if (diffMin < 1) return "الآن";
    if (diffMin < 60) return `قبل ${plural(diffMin, "دقيقة", "دقيقتين", "دقائق")}`;
    const hours = Math.floor(diffMin / 60);
    return `قبل ${plural(hours, "ساعة", "ساعتين", "ساعات")}`;
  }
  if (d.toDateString() === yesterday.toDateString()) return "أمس";
  const days = Math.round(-diffMs / dayMs);
  if (days < 7) return `قبل ${plural(days, "يوم", "يومين", "أيام")}`;
  return fullDate(d);
}

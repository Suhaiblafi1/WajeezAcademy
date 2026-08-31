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

/* ─────────── تاريخ الشعبة: ميلاديٌّ صراحةً، وأيّامٌ بالعربية ───────────

   كانت صفحة الشعب تكتب `toLocaleDateString("ar-SA", …)`، و`ar-SA` في
   المتصفّحات يحمل التقويم **الهجريّ** افتراضا — فظهر «١٩ ربيع الآخر ١٤٤٨ هـ»
   لمتعلّمٍ يخطّط بالميلاديّ. وبقرار صاحب المنتج: ميلاديٌّ فقط، بلا هجريّ.
   والتقويم مثبَّتٌ في الوسم `-u-ca-gregory` لا متروكٌ للغة، فلا يعود بتغيّر
   إعدادات القارئ.

   والأيّام كانت تُطبع كما تُخزَّن: `tue, thu` بالإنجليزية في واجهةٍ عربيّة. */

const DAY_AR: Record<string, string> = {
  sun: 'الأحد', mon: 'الاثنين', tue: 'الثلاثاء', wed: 'الأربعاء',
  thu: 'الخميس', fri: 'الجمعة', sat: 'السبت',
};

/** يوم الأسبوع بالعربية — ويُعيد ما لا يعرفه كما هو بدل أن يُخفيه */
export function dayLabelAr(code: string): string {
  return DAY_AR[code.trim().toLowerCase().slice(0, 3)] ?? code;
}

/** أيّام الشعبة مجموعةً: «الثلاثاء والخميس» */
export function daysLabelAr(codes: readonly string[] | null | undefined): string {
  const days = (codes ?? []).map(dayLabelAr).filter(Boolean);
  if (days.length === 0) return '';
  if (days.length === 1) return days[0];
  return `${days.slice(0, -1).join('، ')} و${days[days.length - 1]}`;
}

/** تاريخٌ ميلاديّ بالعربية: «12 أكتوبر 2026» */
export function fmtDateAr(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** كم يبعد الموعد: «بعد 3 أسابيع» — يساعد على القرار أكثر من التاريخ وحده */
export function untilLabelAr(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.round((d.getTime() - Date.now()) / 86400000);
  if (days < 0) return 'بدأت';
  if (days === 0) return 'اليوم';
  if (days === 1) return 'غدا';
  if (days < 14) return `بعد ${days} يوما`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `بعد ${weeks === 2 ? 'أسبوعين' : `${weeks} أسابيع`}`;
  const months = Math.round(days / 30);
  return `بعد ${months === 2 ? 'شهرين' : months === 1 ? 'شهر' : `${months} أشهر`}`;
}


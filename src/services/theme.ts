/* إدارة المظهر — يتبع الجهازَ، ويحفظ اختيارَ الزائر.

   ── القاعدةُ المعتمدة (١٨ سبتمبر ٢٠٢٦، قرارُ صاحب المنصّة) ──

   نسخا للقاعدة التي قبلها: «الموقع يفتح بالوضع الليلي دائما مهما اختار
   الزائرُ سابقا، واختيارُ الفاتح يعيش للزيارة الحالية وحدَها».

   والقاعدةُ الجديدةُ طبقتان:

   ١. **بلا اختيارٍ من الزائر: الجهازُ هو الحكم** (`prefers-color-scheme`).
      وأكثرُ الهواتف والأنظمة تبدّل هذا المفتاحَ نهارا وليلا من نفسها على
      شروق الشمس وغروبها الحقيقيّين في موضع الجهاز — فيصير الموقعُ نهاريّا
      في النهار وليليّا في الليل **بلا ساعةٍ نخترعها نحن**.

      ولماذا لا ساعةُ حائطٍ نكتبها بأيدينا (٦ص–٦م مثلا): الغروبُ في الخليج
      يتأرجح بين الخامسة والسابعة على مدار السنة فالحدُّ اعتباطيّ، ثمّ إنّ
      من ثبّت جهازَه على الداكن يريده داكنا في الظهيرة أيضا — والساعةُ
      تُلغي اختيارَه، والجهازُ يحترمه.

   ٢. **اختيارُ الزائر بيده يعلو على الجهاز، ويبقى بين الزيارات**
      (`localStorage` لا `sessionStorage`). ولولا البقاءُ لتخاصم الأمران:
      يبدّل الزائرُ بيده، ثمّ يعود غدا فيجد الجهازَ قد أعاده — فيظنّ الزرَّ
      لا يعمل.

   والتطبيقُ على `<html data-theme>`، ويُقرأ مبكرا في `index.html` قبل أوّل
   رسمٍ حتى لا يومض المظهرُ عند الفتح. وما هنا يكرّر ما هناك عمدا: ذاك
   لأوّل رسم، وهذا لبقيّة العمر. */

export type Theme = "dark" | "light";

const KEY = "wajeez_theme";

/** مظهرُ الجهاز. و`(prefers-color-scheme: dark)` — لا `light` — هو المسؤول
    عنه: المواصفةُ أسقطت `no-preference`، فالمتصفّحُ يقول «فاتح» لمن اختاره
    **ولمن لم يختر شيئا** سواءً بسواء. فالسؤالُ عن الداكن وحدَه هو الذي
    يُجاب بيقين. */
export function deviceTheme(): Theme {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    /* بلا `matchMedia` — الداكنُ هو هويّةُ المنصّة فهو المرتدّ إليه */
    return "dark";
  }
}

/** ما اختاره الزائرُ بيده — أو `null` إن لم يختر قطّ فيُترك الحكمُ للجهاز */
export function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function getTheme(): Theme {
  return storedTheme() ?? deviceTheme();
}

export function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", t === "light" ? "#F6F4EF" : "#0D0D0D");
}

/* ── المشتركون ──

   الزرُّ يُركَّب مرّتين في الشاشة الواحدة (الترويسةُ والدرجُ في `SiteShell`
   و`Home`). ولولا هذا الإخطارُ لبقي كلُّ نسخةٍ على حالةٍ من عندها: يبدّل
   الزائرُ من الدرج فتقلب الصفحةُ مظهرَها ويبقى رمزُ الترويسة على ما كان. */
const listeners = new Set<(t: Theme) => void>();

export function subscribeTheme(fn: (t: Theme) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "light" ? "dark" : "light";
  try { localStorage.setItem(KEY, next); } catch { /* وضع خاص بلا تخزين — التبديل آني فقط */ }
  applyTheme(next);
  listeners.forEach((fn) => fn(next));
  return next;
}

/** يُستدعى مرّةً عند الإقلاع: يطبّق المظهر، ويُنصت لتبديل الجهاز نهارا وليلا
    ما دام الزائرُ لم يختر بيده. */
export function initTheme(): void {
  applyTheme(getTheme());
  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      /* اختيارُ الزائر يعلو — فلا يُنتزع منه المظهرُ عند الغروب */
      if (storedTheme()) return;
      const t = deviceTheme();
      applyTheme(t);
      listeners.forEach((fn) => fn(t));
    });
  } catch { /* متصفّحٌ بلا `matchMedia` — المظهرُ مطبَّقٌ ولا متابعةَ */ }
}

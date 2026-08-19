/* إدارة المظهر — داكن افتراضي / فاتح اختياري.
   التطبيق على <html data-theme> ويُحفظ في localStorage؛ يُقرأ مبكرا في index.html
   قبل أول رسم حتى لا يومض المظهر عند الفتح. */

export type Theme = "dark" | "light";

const KEY = "wajeez_theme";

export function getTheme(): Theme {
  try { return localStorage.getItem(KEY) === "light" ? "light" : "dark"; } catch { return "dark"; }
}

export function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", t === "light" ? "#F6F4EF" : "#0D0D0D");
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "light" ? "dark" : "light";
  try { localStorage.setItem(KEY, next); } catch { /* وضع خاص بلا تخزين — التبديل آني فقط */ }
  applyTheme(next);
  return next;
}

/** يُستدعى قبل إقلاع React — يعيد المظهر المحفوظ */
export function initTheme(): void {
  applyTheme(getTheme());
}

/* إدارة المظهر — داكن عند كل فتح / فاتح اختياري أثناء الزيارة.
   القاعدة المعتمدة: الموقع يفتح بالوضع الليلي دائما مهما اختار الزائر سابقا،
   واختيار «الفاتح» يعيش طوال الزيارة الحالية فقط (تنقل وتحديث الصفحة) وينتهي
   بإغلاقها — لذلك يُحفظ في sessionStorage لا localStorage.
   التطبيق على <html data-theme>؛ يُقرأ مبكرا في index.html قبل أول رسم
   حتى لا يومض المظهر عند الفتح. */

export type Theme = "dark" | "light";

const KEY = "wajeez_theme";

export function getTheme(): Theme {
  try { return sessionStorage.getItem(KEY) === "light" ? "light" : "dark"; } catch { return "dark"; }
}

export function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", t === "light" ? "#F6F4EF" : "#0D0D0D");
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "light" ? "dark" : "light";
  try { sessionStorage.setItem(KEY, next); } catch { /* وضع خاص بلا تخزين — التبديل آني فقط */ }
  applyTheme(next);
  return next;
}

/** يُستدعى قبل إقلاع React — يطبق مظهر الزيارة الحالية (داكن إن لم يختر فاتحا) */
export function initTheme(): void {
  applyTheme(getTheme());
}

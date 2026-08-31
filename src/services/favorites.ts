import { safeGet, safeSet, safeRemove } from "./safe-storage";
/* مفضلة المسارات — تُحفظ محليا لكل مستخدم على حدة.
   الزائر لا مفضلة له: الزر نفسه (FavoriteButton) يطلب تسجيل الدخول أولا،
   فلا تصل إلى هنا عملية حفظ بلا حساب. المفتاح يُشتق من البريد إن وُجد وإلا الاسم. */

const PREFIX = "wajeez_favorites:";
const CHANGE_EVENT = "wajeez:favorites-changed";

/** مفتاح المستخدم الحالي — null للزائر */
export function favoriteUserKey(): string | null {
  const raw = safeGet("wajeez_user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { name?: string; email?: string; exp?: number };
    if (typeof parsed.exp === "number" && Date.now() > parsed.exp) {
      safeRemove("wajeez_user");
      return null;
    }
    return parsed.email ?? parsed.name ?? raw;
  } catch {
    return raw;
  }
}

export function readFavorites(): string[] {
  const key = favoriteUserKey();
  if (!key) return [];
  try {
    const list = JSON.parse(safeGet(PREFIX + key) ?? "[]");
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function isFavorite(pathwayId: string): boolean {
  return readFavorites().includes(pathwayId);
}

/** يقلب الحالة ويعيد الجديدة. لا يفعل شيئا للزائر — البوابة تسبقه. */
export function toggleFavorite(pathwayId: string): boolean {
  const key = favoriteUserKey();
  if (!key) return false;
  const list = readFavorites();
  const next = list.includes(pathwayId) ? list.filter((x) => x !== pathwayId) : [...list, pathwayId];
  safeSet(PREFIX + key, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  return next.includes(pathwayId);
}

/** اشتراك بتحديثات المفضلة — لتوافق كل الأزرار الظاهرة في نفس الصفحة */
export function onFavoritesChanged(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

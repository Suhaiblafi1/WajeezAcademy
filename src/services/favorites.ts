/* المفضّلة — تسكن حيث يسكن الحساب، لا حيث صادف أن يكون المتصفّح (ع-٨).

   ═══ ما كان، ولمَ لم يكن يكفي ═══

   كانت `localStorage` بمفتاحٍ مشتقٍّ من البريد. وهي تعمل عملا تامّا حتّى
   يفتح صاحبُها حاسوبَه بعد هاتفه: مفضّلةٌ فارغة، وقد حفظ فيها أمس. والزرُّ
   نفسُه يشترط حسابا قبل الحفظ — فما حُفظ **لحسابٍ** يُحفظ مع الحساب.

   وكانت **مساراتٍ وحدَها**. وع-٨ يقول «المسارات والدورات».

   ═══ ولمَ ذاكرةٌ متزامنةٌ فوق بابٍ غيرِ متزامن ═══

   `useSyncExternalStore` يسأل «أهذا في المفضّلة؟» ويريد الجوابَ في اللحظة،
   ولا ينتظر شبكة. فالصفوفُ تُحمَّل مرّةً إلى مجموعةٍ في الذاكرة، وتُقرأ منها
   الأزرارُ كلُّها. والنقرُ **يسبق الشبكة**: تنقلب الحالةُ في اللحظة ثمّ
   تُرسَل، وإن ردّ الخادمُ خطأً رجعت — فلا قلبٌ يتأخّر نبضُه ربعَ ثانية،
   ولا قلبٌ يكذب إن سقط الطلب. */

import { apiGet, apiPost, apiDelete } from "./api";
import { safeGet, safeSet, safeRemove } from "./safe-storage";
import {
  favoriteKey, isFavoriteKind, type FavoriteKind,
} from "@/application/catalog/favorites";

const LEGACY_PREFIX = "wajeez_favorites:";
const MERGED_FLAG = "wajeez_favorites_merged";
const CHANGE_EVENT = "wajeez:favorites-changed";

export interface FavoriteRow { kind: FavoriteKind; refId: string; savedAt?: string }

/** المحمَّلُ في الذاكرة — `null` يعني «لم يُحمَّل بعد» لا «فارغ» */
let cache: Set<string> | null = null;
let rows: FavoriteRow[] = [];
let loading: Promise<void> | null = null;

const notify = () => window.dispatchEvent(new CustomEvent(CHANGE_EVENT));

/** أمسجَّلٌ صاحبُ الشاشة؟ النسخةُ المحلّيّةُ للعرض تكفي — والخادمُ هو الحَكَم */
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

/* ما بقي في المتصفّح من العهد السابق — مساراتٌ كلُّها، فتلك كانت وحدَها */
function legacyRefs(): FavoriteRow[] {
  const key = favoriteUserKey();
  if (!key || safeGet(MERGED_FLAG) === key) return [];
  try {
    const list = JSON.parse(safeGet(LEGACY_PREFIX + key) ?? "[]");
    if (!Array.isArray(list)) return [];
    return list
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .map((refId) => ({ kind: "pathway" as const, refId }));
  } catch {
    return [];
  }
}

/** يُحمَّل مرّةً — ويُرفع ما كان في المتصفّح قبله فلا يضيع */
export function loadFavorites(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    if (!favoriteUserKey()) { cache = new Set(); rows = []; notify(); return; }
    try {
      const stale = legacyRefs();
      if (stale.length > 0) {
        await apiPost("/api/favorites/merge", { refs: stale });
        const key = favoriteUserKey();
        if (key) { safeSet(MERGED_FLAG, key); safeRemove(LEGACY_PREFIX + key); }
      }
      const fetched = await apiGet<FavoriteRow[]>("/api/favorites");
      rows = fetched.filter((r) => isFavoriteKind(r.kind));
      cache = new Set(rows.map((r) => favoriteKey(r.kind, r.refId)));
    } catch {
      /* لا شبكةَ أو لا جلسة: مفضّلةٌ فارغةٌ خيرٌ من قلبٍ يكذب */
      cache = new Set();
      rows = [];
    }
    notify();
  })();
  return loading;
}

/** يُعاد التحميلُ بعد تغيّر الجلسة — دخولٌ أو خروج */
export function resetFavorites(): void {
  cache = null;
  rows = [];
  loading = null;
  notify();
}

export function favoriteRows(): FavoriteRow[] {
  return rows;
}

/** أحُمِّلت المفضّلةُ بعد؟ تفرّق الشاشةُ بين «لا شيءَ محفوظ» و«لم يصل بعد» */
export function favoritesLoaded(): boolean {
  return cache !== null;
}

export function isFavorite(kind: FavoriteKind, refId: string): boolean {
  return cache?.has(favoriteKey(kind, refId)) ?? false;
}

/** يقلب الحالة ويعيد الجديدة. لا يفعل شيئا للزائر — البوّابة تسبقه. */
export function toggleFavorite(kind: FavoriteKind, refId: string): boolean {
  if (!favoriteUserKey()) return false;
  if (cache === null) cache = new Set();
  const key = favoriteKey(kind, refId);
  const next = !cache.has(key);

  /* تنقلب في اللحظة — والشبكةُ تلحق */
  if (next) { cache.add(key); rows = [{ kind, refId }, ...rows]; }
  else { cache.delete(key); rows = rows.filter((r) => favoriteKey(r.kind, r.refId) !== key); }
  notify();

  const request = next
    ? apiPost("/api/favorites", { kind, refId })
    : apiDelete("/api/favorites", { kind, refId });
  void request.catch(() => {
    /* سقط الطلبُ — تُردّ الحالةُ كما كانت فلا يبقى قلبٌ ممتلئٌ بلا صفّ خلفه */
    if (next) { cache!.delete(key); rows = rows.filter((r) => favoriteKey(r.kind, r.refId) !== key); }
    else { cache!.add(key); rows = [{ kind, refId }, ...rows]; }
    notify();
  });
  return next;
}

/** اشتراك بتحديثات المفضّلة — لتوافق كل الأزرار الظاهرة في نفس الصفحة */
export function onFavoritesChanged(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/* جلب المحتوى العام المنشور من خادم API — المسارات والدورات والوحدات
   والمخرجات والمنهجية. الاتفاق: محاولة واحدة قصيرة (2.5 ثانية)، وعند غياب
   الخادم أو أي خطأ تبقى الواجهة على الحزمة المضمنة الموثقة بصمت.
   لا تظهر مسودات: الخادم لا يقدم إلا المنشور أصلا. */

import { useEffect, useSyncExternalStore } from "react";
import {
  getCatalogVersion,
  installCoreCatalogRaw,
  onCoreCatalogInstalled,
  type CoreCatalogRaw,
} from "@/data/core-catalog-source";
import {
  installMethodologyRegistry,
  type MethodologyReference,
} from "@/data/methodology";

const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

let inflight: Promise<void> | null = null;

async function fetchJson(path: string): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // fallback صامت — انقطاع شبكة أو خادم غير جاهز
  }
}

/** يجلب الكتالوج الجوهري والمنهجية من API ويثبتهما — مرة واحدة لكل جلسة */
export function ensurePublishedContent(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const [catalog, methodology] = await Promise.all([
      fetchJson("/api/public/core-catalog"),
      fetchJson("/api/public/methodology"),
    ]);
    const c = catalog as Partial<CoreCatalogRaw> | null;
    if (c && Array.isArray(c.launch_pathways) && Array.isArray(c.courses) && Array.isArray(c.modules)) {
      installCoreCatalogRaw(c as CoreCatalogRaw);
    }
    const m = methodology as { references?: MethodologyReference[] } | null;
    if (m && Array.isArray(m.references)) {
      installMethodologyRegistry(m.references);
    }
  })();
  return inflight;
}

/** خطاف الصفحات العامة: يبدأ الجلب ويعيد الرسم عند تثبيت اللقطة المنشورة */
export function usePublishedContent(): void {
  useSyncExternalStore(onCoreCatalogInstalled, getCatalogVersion);
  useEffect(() => {
    void ensurePublishedContent();
  }, []);
}

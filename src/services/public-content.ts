/* جلب المحتوى العام المنشور من خادم API — المسارات والدورات والوحدات
   والمخرجات والمنهجية. الاتفاق: محاولة واحدة قصيرة (2.5 ثانية)، وعند غياب
   الخادم أو أي خطأ تبقى الواجهة على الحزمة المضمنة الموثقة بصمت.
   لا تظهر مسودات: الخادم لا يقدم إلا المنشور أصلا. */

import { useEffect, useSyncExternalStore } from "react";
import {
  getCatalogVersion,
  installCoreCatalogRaw,
  onCoreCatalogInstalled,
  loadBundledCoreCatalog,
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

/** يجلب الكتالوج الجوهري والمنهجية من API ويثبتهما — مرة واحدة لكل جلسة.
   عند تعذّر الجلب أو نقص البيانات: يُحضر الاحتياطي المضمن كسولا (البند ع-١)
   فلا يهبط الكتالوج في حزمة الدخول ولا يفقد الموقع محتواه عند انقطاع API. */
export function ensurePublishedContent(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    let installed = false;
    try {
      const [catalog, methodology] = await Promise.all([
        fetchJson("/api/public/core-catalog"),
        fetchJson("/api/public/methodology"),
      ]);
      /* الفراغ ليس جوابا. /api/public/core-catalog يقرأ جداول Pathway وCourse
         مباشرة، فقاعدة لم تُستورد بعد ترد 200 ومصفوفات فارغة — و`Array.isArray([])`
         صحيحة. فكان الموقع يثبّت الفراغ، ويعدّ نفسه ناجحا، ويتخطى الاحتياطي
         المضمن الذي وُضع لهذه الحالة بالذات: الصفحة الرئيسية تعرض «الكل ٠»
         بلا بطاقة واحدة. الطول شرطٌ لا زينة — وهو نفس ما يشترطه
         installCatalogSnapshot وloadBundledCoreCatalog أصلا. */
      const c = catalog as Partial<CoreCatalogRaw> | null;
      if (
        c &&
        Array.isArray(c.launch_pathways) && c.launch_pathways.length > 0 &&
        Array.isArray(c.courses) && c.courses.length > 0 &&
        Array.isArray(c.modules)
      ) {
        installCoreCatalogRaw(c as CoreCatalogRaw);
        installed = true;
      }
      const m = methodology as { references?: MethodologyReference[] } | null;
      if (m && Array.isArray(m.references) && m.references.length > 0) {
        installMethodologyRegistry(m.references);
      }
    } catch {
      /* انقطاع شبكة أو خادم — الاحتياطي أدناه */
    }
    if (!installed) await loadBundledCoreCatalog();
  })();
  return inflight;
}

/** خطاف الصفحات العامة: يبدأ الجلب ويعيد الرسم عند تثبيت اللقطة المنشورة */
export function usePublishedContent(): number {
  const version = useSyncExternalStore(onCoreCatalogInstalled, getCatalogVersion);
  useEffect(() => {
    void ensurePublishedContent();
  }, []);
  return version;
}

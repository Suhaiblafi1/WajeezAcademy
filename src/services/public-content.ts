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
import { takeEarly } from "./early-fetch";
import {
  installMethodologyRegistry,
  type MethodologyReference,
} from "@/data/methodology";

const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

let inflight: Promise<void> | null = null;
/* ═══ والنسخةُ الخفيفة — بلا متون الدروس (٥ نوفمبر ٢٠٢٦) ═══
   «ابنِ مسارك» تنتظر الكتالوجَ كاملا (٢ ميغا مضغوطا) ولا تقرأ متونَ الوحدات: عشرُ ثوانٍ إلى ستَّ عشرةَ على الهاتف.
   فلها نسخةٌ خفيفة (`?lite=1`). ولا تُثبَّت فوق الكاملة أبدا، ولا تُغني عنها: صفحةٌ تطلب الكاملةَ تجلبها كما كانت —
   فصفحاتُ الدروس لا ترى كتالوجا بلا متون. */
let liteInflight: Promise<void> | null = null;
let fullInstalled = false;
/* طُلبت الكاملةُ مرّةً فلا تُثبَّت الخفيفةُ بعدها — وإن كانت مثبَّتةً تُرفع، فترى الصفحةُ «جار التحميل» كأوّل زيارة لا وحداتٍ بلا متون */
let fullWanted = false;
let liteActive = false;

async function fetchJson(path: string): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    /* طلبٌ بدأ مع الصفحة يُؤخذ أوّلا (`early-fetch.ts`) */
    const res = await ((API_BASE === "" ? takeEarly(path) : null) ?? fetch(`${API_BASE}${path}`, { signal: ctrl.signal }));
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
  fullWanted = true;
  if (liteActive && !fullInstalled) {
    liteActive = false;
    installCoreCatalogRaw({ launch_pathways: [], courses: [], modules: [], library_resources: [] });
  }
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
        fullInstalled = true;
      }
      const m = methodology as { references?: MethodologyReference[] } | null;
      if (m && Array.isArray(m.references) && m.references.length > 0) {
        installMethodologyRegistry(m.references);
      }
    } catch {
      /* انقطاع شبكة أو خادم — الاحتياطي أدناه */
    }
    if (!installed) { await loadBundledCoreCatalog(); fullInstalled = true; }
  })();
  return inflight;
}

/** النسخةُ الخفيفة — لصفحةٍ لا تقرأ متونَ الدروس. وإن تعذّرت فالكاملةُ كما كانت */
export function ensureLiteContent(): Promise<void> {
  if (fullInstalled || fullWanted) return fullWanted && !fullInstalled ? ensurePublishedContent() : Promise.resolve();
  if (liteInflight) return liteInflight;
  liteInflight = (async () => {
    const c = (await fetchJson("/api/public/core-catalog?lite=1")) as Partial<CoreCatalogRaw> | null;
    const ok = c && Array.isArray(c.launch_pathways) && c.launch_pathways.length > 0 && Array.isArray(c.courses) && c.courses.length > 0 && Array.isArray(c.modules);
    /* والكاملةُ إن سبقتها لا تُستبدل بها */
    if (ok && !fullInstalled && !fullWanted) { installCoreCatalogRaw(c as CoreCatalogRaw); liteActive = true; }
    else if (!ok) await ensurePublishedContent();
  })();
  return liteInflight;
}

/** خطاف الصفحات العامة: يبدأ الجلب ويعيد الرسم عند تثبيت اللقطة المنشورة */
export function usePublishedContent(opts: { lite?: boolean } = {}): number {
  const version = useSyncExternalStore(onCoreCatalogInstalled, getCatalogVersion);
  const lite = opts.lite === true;
  useEffect(() => {
    void (lite ? ensureLiteContent() : ensurePublishedContent());
  }, [lite]);
  return version;
}

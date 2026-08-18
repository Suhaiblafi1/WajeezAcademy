/* جلب لقطة الكتالوج المنشورة من خادم API وتثبيتها في محرك التشخيص.
   الاتفاق: محاولة واحدة قصيرة (2.5 ثانية) — عند غياب الخادم أو أي خطأ
   يبقى المحرك على الحزمة المضمنة الموثقة بصمت ودون كسر تجربة المستخدم. */

import { installCatalogSnapshot, type CatalogSnapshotPayload } from "@/domain/diagnostic/catalog";

const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

let inflight: Promise<string> | null = null;

/** يعيد تسمية اللقطة الفعالة — «bundled» تعني الحزمة المضمنة (لا خادم) */
export function ensurePublishedSnapshot(): Promise<string> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${API_BASE}/api/catalog/active-snapshot`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return "bundled";
      const data = (await res.json()) as { label: string; payload: CatalogSnapshotPayload };
      installCatalogSnapshot(data.payload, data.label);
      return data.label;
    } catch {
      return "bundled"; // fallback صامت — انقطاع شبكة أو خادم غير جاهز
    }
  })();
  return inflight;
}

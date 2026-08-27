/* جلب لقطة الكتالوج المنشورة من خادم API وتثبيتها في محرك التشخيص.
   الاتفاق: محاولة قصيرة ثم أطول — وعند غياب الخادم أو أي خطأ يبقى المحرك على
   الحزمة المضنة الموثقة بصمت ودون كسر تجربة المستخدم. */

import { installCatalogSnapshot, type CatalogSnapshotPayload } from "@/domain/diagnostic/catalog";

const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

/* محاولتان بمهلتين، لا محاولة واحدة قصيرة.
   الدالة السحابية تُقلع باردة بعد سكون: قياس على الإنتاج أعطى 7.4 ثانية لأول
   طلب و0.27–0.63 ثانية لما بعده. فمهلة 2.5 ثانية وحدها كانت تُلغي الطلب في
   الحالة الباردة بالضبط، فيقع المحرك على الكتالوج المضمن — وقد يكون أقدم من
   المنشور — بلا أن يعلم أحد. وأول زائر بعد سكون هو أكثر من يقع فيها.

   المحاولة الأولى تبقى قصيرة كي لا ينتظر الزائر في الحالة الشائعة (دافئة)،
   والثانية تمنح الإقلاع البارد وقته. والانتظار كله يسبق بدء التشخيص، فلا
   تُستبدل لقطة تحت قدم جلسة جارية. */
const FIRST_TRY_MS = 2_500;
const RETRY_MS = 9_000;

let inflight: Promise<string> | null = null;

async function fetchSnapshot(timeoutMs: number): Promise<{ label: string; payload: CatalogSnapshotPayload } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/api/catalog/active-snapshot`, { signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as { label: string; payload: CatalogSnapshotPayload };
  } catch {
    return null; // مهلة أو انقطاع شبكة أو خادم غير جاهز
  } finally {
    clearTimeout(timer);
  }
}

/** يعيد تسمية اللقطة الفعالة — «bundled» تعني الحزمة المضمنة (لا خادم) */
export function ensurePublishedSnapshot(): Promise<string> {
  if (inflight) return inflight;
  inflight = (async () => {
    const data = (await fetchSnapshot(FIRST_TRY_MS)) ?? (await fetchSnapshot(RETRY_MS));
    if (!data) return "bundled";
    try {
      installCatalogSnapshot(data.payload, data.label);
      return data.label;
    } catch {
      /* لقطة ناقصة ترفضها الحُرّاس البنيوية — المضمن أسلم من نصف كتالوج */
      return "bundled";
    }
  })();
  return inflight;
}

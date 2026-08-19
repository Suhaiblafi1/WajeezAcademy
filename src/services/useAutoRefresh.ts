/* تحديث تلقائي مهذب — Auto Refresh Hook
   يعيد النداء كل ms طالما التبويب ظاهر، ويحدّث فور عودة التركيز للتبويب.
   لا يعمل في الخلفية (تبويب مخفي = لا طلبات)، ولا يمس حالة التحميل الأولى. */

import { useEffect } from "react";

/** reload: دالة الجلب (صامتة غالبا) — ms: الفترة، افتراضيا 45 ثانية */
export function useAutoRefresh(reload: () => void, ms = 45_000) {
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") reload(); };
    const onVis = () => { if (document.visibilityState === "visible") reload(); };
    const id = setInterval(tick, ms);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reload, ms]);
}

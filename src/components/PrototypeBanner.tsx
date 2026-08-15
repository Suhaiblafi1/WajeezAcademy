/* شريط «نموذج UX تجريبي» — يظهر أعلى كل بوابة داخلية (إدارة/مدرب/مستشار/طالب).
   البيانات المعروضة محلية تجريبية (localStorage) وليست مصدر حقيقة تشغيلية —
   مصدر الحقيقة الوحيد هو الكتالوج الأكاديمي والتشخيص الموثق. */

import { FlaskConical } from "lucide-react";

export default function PrototypeBanner() {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-[#FABC05]/25 bg-[#FABC05]/[0.07] px-4 py-2 text-center text-[11px] font-bold leading-5 text-[#FABC05]"
    >
      <FlaskConical className="h-3.5 w-3.5 shrink-0" />
      نموذج تجريبي لاستعراض التجربة — البيانات المعروضة محلية وليست تشغيلية حقيقية
    </div>
  );
}

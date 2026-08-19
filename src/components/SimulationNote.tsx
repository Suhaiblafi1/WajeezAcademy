/* لافتة «نموذج استرشادي» — تظهر داخل صفحات المحاكاة المحلية (مساري/مشروع التخرج/سيرتي/عرض الدورة)
   عندما يكون الزائر مسجلا بحساب خادم حقيقي. الشريط العام PrototypeBanner يُخفى حينها،
   فتبدو بيانات المحاكاة وكأنها بياناته — هذه اللافتة تمنع الالتباس دون إزعاج زائر الديمو. */

import { Info } from "lucide-react";
import { useRealSession } from "@/services/session";

export default function SimulationNote({ what }: { what: string }) {
  const { user } = useRealSession();
  if (!user) return null; // زائر الديمو يكفيه الشريط العام أعلى البوابة
  return (
    <p
      role="note"
      className="mb-5 flex items-start gap-2 rounded-2xl border border-[#38A7B4]/25 bg-[#38A7B4]/[0.06] px-4 py-3 text-xs leading-6 text-[#6EC7D1]"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {what} المعروض هنا <b>نموذج استرشادي</b> لاستعراض التجربة — بياناتك التشغيلية الحقيقية تُبنى تلقائيا مع أول تسجيل مؤكد في شعبة.
      </span>
    </p>
  );
}

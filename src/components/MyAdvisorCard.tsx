/* بطاقةُ «مستشارك» في لوحة الطالب — اسمُ مستشاره المسنَد وزرُّ مراسلته (١٩ أكتوبر ٢٠٢٦).

   والعلّةُ في `advisor-message.ts`: الرسالةُ تذهب إلى رقم الأكاديمية وتحمل اسمَ المستشار.
   ولا مستشارَ مسنَدا = لا بطاقة: لا اسمَ يُختلَق، ولا «يُسند لك قريبا» يعِد بما لا نعرف موعده. */

import { UserRound } from "lucide-react";
import { Panel } from "@/components/ui/Surface";
import AdvisorContact from "@/components/AdvisorContact";
import { useMyAdvisorName } from "@/services/my-advisor";

export default function MyAdvisorCard({ className = "" }: { className?: string }) {
  const name = useMyAdvisorName();
  if (!name) return null;
  return (
    <Panel as="section" className={`flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}>
      <div>
        <p className="flex items-center gap-2 text-sm font-bold text-foreground">
          <UserRound className="h-4 w-4 text-teal-ink" /> مستشارك: {name}
        </p>
        <p className="mt-1 text-read text-muted-foreground">يساعدك في اختيار دوراتك ومتابعة تقدمك.</p>
      </div>
      <AdvisorContact
        text="مرحبا، أريد التحدث مع مستشاري."
        label="راسل مستشارك"
        className="flex shrink-0 items-center gap-2 rounded-full border border-teal/40 px-4 py-2 text-xs font-bold text-teal-light-ink transition hover:bg-teal/10"
      />
    </Panel>
  );
}

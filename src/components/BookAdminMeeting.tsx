/* «تريد أن تسأل أو تفهم شيئا؟ احجز اجتماعا مع الإدارة» — بابٌ واحدٌ يُستعمل مرّتين.

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): لا مهامَّ تهيئةٍ في لوحة المدرّب —
   وبدلَها بابٌ يسأل منه، من التقويم نفسِه الذي يحجز منه المتقدّمون.

   ثمّ طلب ع-١ السطرَ نفسَه في «مركز التواصل»: من فتح الشعبةَ ليخاطب أحدا
   قد يكون سؤالُه للإدارة لا لمتعلّميه.

   ═══ ولماذا مكوّنٌ لا نسختان ═══

   نسختان تفترقان: تُبدَّل صيغةُ الرابط في إحداهما ويُنسى الأخرى، فيحجز نصفُ
   المدرّبين على تقويمٍ ونصفُهم على آخر. وقد تكرّر هذا في المنصّة (رأسان
   للموقع، وسقفان للمتن، وزرَّا بحث) — فالمكوّنُ واحدٌ وحارسُه على التكرار. */

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { trainerInterviewUrl } from "@/application/trainer/application-options";
import { Panel } from "@/components/ui/Surface";

export default function BookAdminMeeting({ name, email, className }: {
  name: string;
  email: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const url = trainerInterviewUrl({ name, email });

  return (
    <Panel as="section" className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-black">
          <CalendarClock className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />
          تريد أن تسأل أو تفهم شيئا؟ احجز اجتماعا مع الإدارة
        </p>
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="btn-outline-brand h-10 px-5">
          {open ? "أغلق التقويم" : "اختر موعدا"}
        </button>
      </div>
      {open && (
        <div className="mt-4 overflow-hidden rounded-xl bg-white">
          <iframe
            src={`${url}${url.includes("?") ? "&" : "?"}embed_domain=${encodeURIComponent(window.location.hostname)}&embed_type=Inline`}
            title="حجز اجتماع مع الإدارة"
            loading="lazy"
            style={{ border: "none" }}
            className="block h-[680px] w-full"
          />
        </div>
      )}
    </Panel>
  );
}

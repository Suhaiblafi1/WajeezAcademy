/* مواعيدُ اللقاءات المباشرة — حيث يقع قرارُ الشراء (٢٩ سبتمبر ٢٠٢٦).

   قال صاحبُ المنصّة: «these dates appears in the information of the training
   for the user when they buy it». وكان المشتري يعرف متى تبدأ شعبتُه وأيّامَها،
   ولا يعرف مواعيدَ لقاءاتها حتّى يدفع.

   وما يصل هنا رشّحه الخادم: المعتمَدُ غيرُ الملغى، لا المبدئيُّ ولا ما ينتظر
   الإدارة (`public-catalog.service.ts`). والساعةُ بتوقيت عمّان صراحةً — ساعةُ
   الشعبة التي تُقاس بها مواعيدُها، كما في ورشة المدرّب (`SlotSessions.tsx`):
   لو قُرئت من متصفّح القارئ لصار لقاءُ السادسة في عمّان السابعةَ في دبيّ، وهو
   يقرؤها موعدَ الشعبة.

   ومطويّةٌ في القوائم (`open` افتراضُه مطويّ): ستُّ دوراتٍ بثمانيةِ لقاءاتٍ
   لكلٍّ منها ثمانيةٌ وأربعون سطرا في صفحةٍ واحدة. والسطرُ المطويُّ يقول
   عددَها وأوّلَها، وهو ما يكفي أكثرَ القرّاء.

   وحجمُها حجمُ المتن (`text-read`) لا حجمُ اللصيقة: مواعيدُ تُقرأ ويُرتَّب عليها
   يومٌ، لا شارةٌ بجانب اسم (`learner-surface.test.ts` ②). */

import { useState } from "react";
import { ChevronDown, Video } from "lucide-react";
import type { LiveSessionDate } from "@/services/cohort-prices";
import { whenAr } from "@/application/learning/cohort-gate";
import { countAr } from "@/application/text/count-ar";

export const LIVE_SESSION_FORMS = {
  one: "لقاءٌ مباشر", two: "لقاءان مباشران", few: "لقاءاتٍ مباشرة", many: "لقاءً مباشرا",
} as const;

export default function LiveSessionDates({
  sessions,
  defaultOpen = false,
}: {
  sessions: readonly LiveSessionDate[];
  /** صفحةُ الدورة الواحدة تفتحها — والقوائمُ تطويها */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (sessions.length === 0) return null;
  const first = sessions[0];

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-1.5 text-right text-read leading-6 text-muted-foreground transition hover:text-foreground"
      >
        <Video className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" />
        <span className="min-w-0 flex-1">
          <span className="font-bold text-foreground">{countAr(sessions.length, LIVE_SESSION_FORMS)}</span>
          {" · "}أوّلُها {whenAr(first.startsAt)}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <ol className="mt-1.5 grid gap-1">
            {sessions.map((s, i) => (
              <li key={`${s.startsAt}-${i}`} className="flex flex-wrap items-baseline gap-x-1.5 text-read leading-6">
                <span className="font-bold text-foreground">{whenAr(s.startsAt)}</span>
                {s.title && <span className="min-w-0 truncate text-muted-foreground">— {s.title}</span>}
              </li>
            ))}
          </ol>
          <p className="mt-1 text-read leading-6 text-muted-foreground">بتوقيت عمّان.</p>
        </>
      )}
    </div>
  );
}

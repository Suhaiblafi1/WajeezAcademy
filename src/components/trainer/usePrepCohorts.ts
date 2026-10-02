/* شعبُ الإعداد التي لصاحب الجلسة — لتُوسَم في «شعبي» وفي ورشتها (٢ أكتوبر ٢٠٢٦).

   شعبةُ الإعداد مسوّدةٌ ينشئها قبولُ الدورة في طور الموادّ: لا متعلّمين فيها
   ولا أتعابَ قبل اعتماد دوراته. والوسمُ يقول ذلك حيث يعمل فيها، فلا يظنّها
   شعبةً مفتوحةً للتسجيل. والعلّةُ في `server/services/trainer-prep.service.ts`.
   وغيابُ الجواب لا يُسقط الشاشة: بلا وسمٍ كما كانت. */

import { useEffect, useState } from "react";
import { apiGet } from "@/services/api";

export const PREP_NOTICE_AR =
  "شعبةُ إعداد — تعبّئ فيها دورتَك مرّةً واحدةً وترسلها لاعتمادنا. لا متعلّمين فيها ولا تُنشَر، ولا أتعابَ قبل اعتماد دوراتك؛ وتصير شعبتَك الأولى حين تُعتمَد.";

export function usePrepCohorts(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let live = true;
    apiGet<{ cohortId: string | null; state: string }[]>("/api/trainer/prep")
      .then((rows) => {
        if (!live) return;
        setIds(new Set(rows.filter((r) => r.cohortId && r.state !== "declined").map((r) => r.cohortId!)));
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);
  return ids;
}

/* ═══ «أعد فتحها» — تراجعٌ عن إلغاء الشعبة (٢٤ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «ماذا لو أردت أن أتراجع عن الإلغاء؟» — وكان الإلغاءُ نهائيّا. فخُيّر واختار زرّا يعيدها:
   تعود إلى حالها قبل الإلغاء بمواعيدها ومتعلّميها، ويصل مدرّبَها ومتعلّميها أنّها عادت. والزرُّ يقول ذلك قبل أن
   يُضغط، ولا يظهر لما مضى أوّلُ لقاءٍ فيها. والأثرُ في `CohortService.reopen`. */

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

export default function ReopenCancelledBox({ cohortId, title, onDone, onError }: {
  cohortId: string;
  title: string;
  onDone: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const reopen = async () => {
    setBusy(true);
    try {
      const r = await apiPost<{ learnersTold: number }>(`/api/admin/cohorts/${cohortId}/reopen`);
      onDone(`أعدنا فتح «${title}»${r.learnersTold ? `، ووصل ${r.learnersTold} متعلم الخبر` : ""}`);
      setAsking(false);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "تعذر إعادة فتحها");
    } finally {
      setBusy(false);
    }
  };

  if (!asking) {
    return (
      <Button tone="secondary" icon={RotateCcw} onClick={() => setAsking(true)}>أعد فتحها</Button>
    );
  }
  return (
    <Inset className="space-y-2 text-read">
      <p className="font-bold">إعادة فتح «{title}»</p>
      <ul className="list-disc space-y-1 pe-5">
        <li>تعود كما كانت قبل الإلغاء، بمواعيدها ومتعلميها.</li>
        <li>يصل مدربها ومتعلميها أنها عادت.</li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button tone="secondary" loading={busy} onClick={() => void reopen()}>نعم، أعد فتحها</Button>
        <Button tone="ghost" disabled={busy} onClick={() => setAsking(false)}>تراجع</Button>
      </div>
    </Inset>
  );
}

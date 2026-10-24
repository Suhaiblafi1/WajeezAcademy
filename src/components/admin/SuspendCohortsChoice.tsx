/* ═══ شعبُ المدرّب التي لم تبدأ — يُختار لكلٍّ منها في نافذة إيقافه (٢٤ أكتوبر ٢٠٢٦) ═══

   أوقف صاحبُ المنصّة مدرّبا فبقيت شعبتُه «مفتوحة» في «تبدأ قريبا»: «لقد قمت بإيقاف المدرّب.. لماذا ما زالت شعبتُه
   ظاهرةً لدينا؟». الإيقافُ يمسّ بوّابتَه وظهورَه لا شعبَه. فخيّر واختار أن يُسأل في النافذة نفسِها: كلُّ شعبةٍ لم تبدأ
   بعدد مسجّليها، وخياران لكلٍّ — تُلغى فيصل متعلّميها الخبر، أو تبقى لمدرّبٍ بديل. والافتراضُ «تبقى»: لا يقع إلغاءٌ
   بلا اختيار. والأثرُ في `TrainerReviewService.suspendTrainer`. */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiGet } from "@/services/api";
import { Card } from "@/components/ui/Surface";
import { fmtDateTimeAr } from "@/utils/format";

interface Row {
  id: string; title: string; status: string; firstAt: string | null; enrolled: number; role: string; otherTrainers: number;
}

export default function SuspendCohortsChoice({ profileId, cancelIds, onChange }: {
  profileId: string;
  cancelIds: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    apiGet<Row[]>(`/api/admin/trainers/${profileId}/suspend-preview`).then(setRows).catch(() => setRows([]));
  }, [profileId]);

  const set = (id: string, cancel: boolean) => {
    const next = new Set(cancelIds);
    if (cancel) next.add(id); else next.delete(id);
    onChange(next);
  };

  if (rows === null) return <div className="grid place-items-center py-3"><Loader2 className="h-4 w-4 animate-spin text-teal-ink" /></div>;
  if (rows.length === 0) return <p className="mt-3 text-read text-muted-foreground">لا شعبة له لم تبدأ.</p>;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-read font-bold">شعبه التي لم تبدأ — اختر لكل شعبة:</p>
      <ul className="space-y-2">
        {rows.map((c) => (
          <li key={c.id}>
            <Card as="fieldset" className="space-y-1.5 p-3">
              <legend className="sr-only">{c.title}</legend>
              <p className="font-bold">{c.title}</p>
              <p className="text-read text-muted-foreground">
                {c.firstAt ? `تبدأ ${fmtDateTimeAr(c.firstAt)}` : "بلا موعد بعد"} · المسجلون {c.enrolled}
                {c.otherTrainers > 0 && ` · معه ${c.otherTrainers} مدرب آخر`}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-read">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input type="radio" name={`suspend-${c.id}`} className="accent-teal"
                    checked={!cancelIds.has(c.id)} onChange={() => set(c.id, false)} />
                  أبقها لمدرب بديل
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input type="radio" name={`suspend-${c.id}`} className="accent-teal"
                    checked={cancelIds.has(c.id)} onChange={() => set(c.id, true)} />
                  ألغها{c.enrolled > 0 ? ` — يصل ${c.enrolled} متعلم الخبر` : ""}
                </label>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-read text-muted-foreground">ما تبقيه يظهر في «تبدأ قريبا» بشارة «مدربها موقوف» حتى تسند بديلا أو تلغيها.</p>
    </div>
  );
}

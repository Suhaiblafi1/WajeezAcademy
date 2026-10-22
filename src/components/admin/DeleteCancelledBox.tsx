/* حذفُ الشعبة الملغاة — خياران واضحان، وما يقع بكلٍّ منهما (٢٢ أكتوبر ٢٠٢٦).

   «اجعل خيارَ الحذف واضحا جدّا» (صاحب المنصّة). والقاعدةُ: «لا إجبارَ على فعل — الفرقُ والخياراتُ
   وأثرُ كلٍّ، والقرارُ لصاحب المنصّة». فالملغاةُ لها خياران يُعرضان معا:
   · **أبقها ملغاة** — لا تُرى في الموقع، وتبقى خطّةُ مدرّبها ينسخ منها لشعبةٍ جديدة.
   · **احذفها نهائيّا** — تختفي من كلّ مكان، ومعها خطّةُ مدرّبها إن كانت لها.
   وما يمنع الحذفَ (متعلّمٌ أو طلبُ تسجيلٍ أو بندُ مستحقّات) يُقال بدل الزرّ. والقاعدةُ في الخادم
   (`cancelled-cohort-delete.service.ts`) لا هنا. */

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

interface Preview {
  canDelete: boolean;
  blockedAr: string | null;
  trainerNames: string[];
  plans: number;
  sessions: number;
}

export default function DeleteCancelledBox({ cohortId, title, onDeleted, onError }: {
  cohortId: string;
  title: string;
  onDeleted: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [p, setP] = useState<Preview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    apiGet<Preview>(`/api/admin/cohorts/${cohortId}/delete-preview`)
      .then((r) => { if (alive) setP(r); })
      .catch(() => { if (alive) setP(null); });
    return () => { alive = false; };
  }, [cohortId]);

  if (!p) return null;
  const hasTrainer = p.trainerNames.length > 0;

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiPost(`/api/admin/cohorts/${cohortId}/delete-cancelled`, { withTrainerPlan: hasTrainer });
      onDeleted(`حذفت «${title}» نهائيا`);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "تعذر الحذف");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <Inset className="px-4 py-3">
      <p className="flex items-center gap-1.5 text-read font-black text-foreground">
        <Trash2 className="h-3.5 w-3.5 text-danger-ink" /> ملغاة — أتبقيها أم تحذفها؟
      </p>
      {!p.canDelete ? (
        <p className="mt-2 text-read leading-6 text-muted-foreground">{p.blockedAr}. تبقى ملغاة ولا تظهر في الموقع.</p>
      ) : (
        <>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-read font-bold text-foreground">أبقها ملغاة</dt>
              <dd className="mt-0.5 text-read leading-6 text-muted-foreground">
                لا تظهر في الموقع.{hasTrainer ? " وتبقى خطة المدرب لينسخ منها لشعبة جديدة." : ""} لا تفعل شيئا.
              </dd>
            </div>
            <div>
              <dt className="text-read font-bold text-foreground">احذفها نهائيا</dt>
              <dd className="mt-0.5 text-read leading-6 text-muted-foreground">
                تختفي من كل مكان مع {p.sessions} لقاء.
                {hasTrainer ? ` وتحذف معها خطة ${p.trainerNames.join("، ")} لهذه الشعبة.` : ""} لا رجوع عنه.
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {confirming ? (
              <>
                <Button tone="danger" disabled={busy} loading={busy} onClick={() => void remove()}>
                  {hasTrainer ? "أكد الحذف مع خطة المدرب" : "أكد الحذف"}
                </Button>
                <Button tone="ghost" disabled={busy} onClick={() => setConfirming(false)}>تراجع</Button>
              </>
            ) : (
              <Button tone="danger" icon={Trash2} onClick={() => setConfirming(true)}>احذفها نهائيا</Button>
            )}
          </div>
        </>
      )}
    </Inset>
  );
}

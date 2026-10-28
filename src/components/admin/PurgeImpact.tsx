/* ═══ ما يقع بحذف المدرّب على شعبه — يُقرأ قبل الحذف (٢٨ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «if we delete the trainer, then all the sessions should be deleted, but with a warning that
   there's a student in this class before you deleted the sessions»، واختار «Warn, remove for all». فيُقال في حوار
   الحذف — قبل الضغط — أيُّ شعبه فيها طلاب، وكم لقاءً قادما يُرفع من تقاويم الجميع، وما يبقى فيه مدرّبٌ غيرُه
   فتبقى لقاءاتُه. والخادمُ يقرأ ذلك (`purgeImpact`) ويفعله (`clearSessionsOfDeletedTrainer`)، وهنا ما يُقال. */

import { useEffect, useState } from "react";
import { apiGet, ApiError } from "@/services/api";
import { Inset } from "@/components/ui/Surface";
import { impactLineAr, type ImpactCohort } from "@/application/trainer/purge-impact";

export default function PurgeImpact({ reference }: { reference: string }) {
  const [cohorts, setCohorts] = useState<ImpactCohort[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    apiGet<{ cohorts: ImpactCohort[] }>(`/api/admin/trainer-applications/${encodeURIComponent(reference)}/purge-impact`)
      .then((r) => { if (live) setCohorts(r.cohorts); })
      .catch((e) => { if (live) setErr(e instanceof ApiError ? e.message : "تعذّر قراءة شعبه"); });
    return () => { live = false; };
  }, [reference]);

  /* وما لم يُقرأ يُقال — لا يُحذف مدرّبٌ وفي شعبه طلابٌ لم يُخبَر بهم من يحذفه */
  if (err) return <p role="alert" className="mt-2 text-read leading-6 text-gold-ink">{err} — راجع شعبه قبل أن تحذفه.</p>;
  if (!cohorts || cohorts.length === 0) return null;
  const removing = cohorts.some((c) => !c.keepsSessions && c.upcoming > 0);
  return (
    <Inset tone="warn" role="alert" className="mt-2 grid gap-1.5 px-3 py-2.5 text-read leading-6">
      <p className="font-bold">في شعبه طلاب:</p>
      <ul className="list-inside list-disc">
        {cohorts.map((c) => <li key={c.id}>{impactLineAr(c)}</li>)}
      </ul>
      {removing && (
        <p>
          إن حذفته رفعت لقاءاتها القادمة من تقاويم الجميع — الطلاب والمدرّب والأكاديمية — وألغي اجتماعها في Zoom.
          {" "}ويبقى الطلاب مسجلين حتى يسند إليها مدرّب.
        </p>
      )}
    </Inset>
  );
}

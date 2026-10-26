/* ═══ منهاجُ شعبةٍ في صفحته — يُفتح من لسان «المنهاج» في بطاقة الخطّة (١١ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «أو على الأقلّ يمكن فتحُ منهاجه منفصلا وتنزيلُه إذا رغبتُ أنا». فالصفحةُ
   تقرأ الخطّةَ من المسار نفسِه الذي تقرأ منه بطاقتُها (`/api/admin/cohorts/:id/trainer-plan`)،
   وتعرضها بالمكوّن نفسِه (`PlanCurriculum`) — فلا يختلف ما يُقرأ هنا عمّا يُقرأ في اللسان. ولا
   قرارَ فيها: القرارُ في بطاقة الخطّة تحت ألسنتها (٢٦ أكتوبر ٢٠٢٦). */
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Download, Printer } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiDownload, apiGet, ApiError } from "@/services/api";
import { PlanCurriculum, type TrainerPlan } from "@/components/admin/TrainerPlanReview";
import Button from "@/components/ui/Button";

export default function PlanCurriculumPage() {
  const { cohortId = "" } = useParams();
  /* `undefined` يُحمَّل، و`null` لا خطّة */
  const [plan, setPlan] = useState<TrainerPlan | null | undefined>(undefined);
  const [msg, setMsg] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let live = true;
    apiGet<TrainerPlan | null>(`/api/admin/cohorts/${cohortId}/trainer-plan`)
      .then((p) => { if (live) setPlan(p); })
      .catch(() => { if (live) setPlan(null); });
    return () => { live = false; };
  }, [cohortId]);

  /* التنزيلُ نفسُه الذي في البطاقة: المنهجُ نصّا مقروءا وكلُّ ملفٍّ رفعه المدرّب */
  const download = async () => {
    if (downloading) return;
    setDownloading(true); setMsg("");
    try {
      const name = await apiDownload(`/api/admin/cohorts/${cohortId}/trainer-plan/review-bundle`, "خطة-الشعبة.zip");
      setMsg(`نزّلت «${name}».`);
    } catch (e) { setMsg(e instanceof ApiError ? e.message : "تعذّر التنزيل"); }
    finally { setDownloading(false); }
  };

  const title = plan?.cohortTitle ? `منهاج «${plan.cohortTitle}»` : "المنهاج";
  return (
    <AdminLayout title={title}>
      {plan === undefined ? (
        <p className="text-read text-muted-foreground">يحمّل…</p>
      ) : plan === null ? (
        <p className="text-read text-muted-foreground">لا خطّة لهذه الشعبة بعد.</p>
      ) : (
        <>
          {plan.trainerName && <p className="text-read text-muted-foreground">{plan.trainerName}</p>}
          <div className="mt-3 flex flex-wrap gap-2 print:hidden">
            <Button tone="secondary" size="sm" icon={Download} disabled={downloading} onClick={() => void download()}>
              {downloading ? "يجهّز التنزيل…" : "نزّله"}
            </Button>
            <Button tone="ghost" size="sm" icon={Printer} onClick={() => window.print()}>اطبعه</Button>
          </div>
          {msg && <p className="mt-2 text-read font-bold text-teal-light-ink" role="status">{msg}</p>}
          <div className="mt-3">
            <PlanCurriculum trainerPlan={plan} cohortTitle={plan.cohortTitle} />
          </div>
        </>
      )}
    </AdminLayout>
  );
}

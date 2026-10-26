/* «الاتفاقية» وحدَها — ملفُّ المدرّب لمن يضبط أجرَه ولا يقرأ طلبَه (قرارُ صاحب المنصّة «a»، ٢٦ أكتوبر ٢٠٢٦).

   الأجرُ يُضبط في «الاتفاقية» من ملفّ المدرّب وحدَها، ويضبطه المديرُ الأكاديميُّ أو الماليّة (قرارُ «C»). والماليّةُ لا
   تقرأ الطلبات: في الملفّ طلبُه ومقابلتُه ووثائقُه. فسُئل صاحبُ المنصّة أين تغيّر الماليّةُ أجرا، فقال «a»: تفتح «الاتفاقية»
   وحدَها. فهذه هي: خطواتُ «الاتفاقية» نفسُها (`PreparationSteps`) من حمولتها وحدَها (`/agreement`) — لا نسخةٌ ثانيةٌ
   تفترق عنها. ويُفتح بالعنوان نفسِه (`/admin/trainers/:id`)، فالرابطُ واحدٌ لمن يقرأ الملفَّ كلَّه ولمن يقرأ هذه. */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import AdminLayout from "./AdminLayout";
import PreparationSteps, {
  type PrepContract, type PrepProposal, type PrepQualification, type PrepRule,
} from "./PreparationSteps";
import { apiGet, ApiError } from "@/services/api";
import { useRealSession } from "@/services/session";
import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { contractsHref } from "@/application/trainer/record-links";
import type { Readiness } from "@/application/trainer/readiness";

/** ما يردّه `/api/admin/trainer-applications/:id/agreement` — بلا طلبٍ ولا مقابلةٍ ولا وثائق */
interface AgreementView {
  id: string; fullName: string; reference: string; status: string;
  profile: {
    id: string; legalNameAr: string | null; suspendedAt: string | null;
    contracts: PrepContract[]; qualifications: PrepQualification[]; courseProposals: PrepProposal[];
  } | null;
  readiness: Readiness;
  activeCompensationRule: PrepRule | null;
}

export default function TrainerAgreementOnly({ id }: { id: string }) {
  const { user } = useRealSession();
  const [a, setA] = useState<AgreementView | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<AgreementView>(`/api/admin/trainer-applications/${id}/agreement`)
      .then((r) => { setA(r); setErr(null); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر فتح الاتفاقية"));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout title={a ? `الاتفاقية — ${a.fullName}` : "الاتفاقية"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button as={Link} to="/admin/trainer-compensation" tone="ghost" size="sm" icon={ArrowRight}>
          الأتعاب
        </Button>
        <p className="text-read leading-6 text-muted-foreground">
          ترى هنا «الاتفاقية» وحدها: أجره وعقوده. وطلبه ومقابلته لمن يقرأ الطلبات.
        </p>
      </div>

      {err ? (
        <Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card>
      ) : !a ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جار التحميل" />
        </div>
      ) : (
        <PreparationSteps
          profileId={a.profile?.id ?? null}
          readiness={a.readiness}
          activeRule={a.activeCompensationRule}
          proposals={a.profile?.courseProposals ?? []}
          contracts={a.profile?.contracts ?? []}
          qualifications={a.profile?.qualifications ?? []}
          permissions={user?.permissions ?? []}
          onChanged={load}
          contractsHref={contractsHref(a, "contract")}
          composeHref={contractsHref(a, "contract_new")}
        />
      )}
    </AdminLayout>
  );
}

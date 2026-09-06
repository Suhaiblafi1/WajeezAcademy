/* شهادةُ الدورة — في آخر مرحلتها لا في خزانةٍ بعيدة.

   بكلام صاحب المنصّة: «وفي نهاية كل دورة يظهر له طلب شهادة للدورة».

   وكانت الشهاداتُ تُصدَر من لوحة الإدارة وحدَها: فمن أنهى دورتَه لم يجد في
   بوابته بابا يطلب منه شهادتَه — ينتظر أن يتذكّره أحد. و«شهاداتي» تعرض ما
   صدر فقط، فمن لم تصدر شهادتُه يرى فراغا لا يعرف سببَه.

   وثلاثُ حالاتٍ تُقال صريحةً هنا، ولا رابعةَ صامتة:
     • صدرت   → رقمُها وصفحةُ تحقّقها العامّة.
     • طُلبت  → حالةُ الطلب، وقرارُه إن قُرّر.
     • لم تُطلب → أمؤهَّلٌ فيُطلب، أم ماذا ينقصه بالنصّ. */

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Award, Loader2, Send } from "lucide-react";
import { ApiError } from "@/services/api";
import {
  createRequest, fetchCourseEligibility, REQUEST_STATUS_AR,
  type Eligibility, type LearnerRequest,
} from "@/services/learner-requests";
import type { EnrollmentCertificate } from "@/services/enrollment-detail";

import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
export default function CourseCertificate({
  enrollmentId,
  courseTitleAr,
  certificates,
  request,
  onChanged,
}: {
  enrollmentId: string;
  courseTitleAr: string;
  certificates: EnrollmentCertificate[];
  /** الطلبُ القائم إن كان — تقرؤه الصفحةُ مرّةً وتوزّعه، فلا نداءَ لكلّ مرحلة */
  request?: LearnerRequest | null;
  onChanged: () => void;
}) {
  const issued = certificates.find((c) => c.status === "active") ?? null;
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  /* الأهليّةُ لا تُقرأ إلّا حين تلزم: صدرت الشهادةُ أو طُلبت فلا سؤالَ عنها */
  const needsCheck = !issued && !request;
  useEffect(() => {
    if (!needsCheck) return;
    let on = true;
    fetchCourseEligibility(enrollmentId)
      .then((e) => { if (on) setEligibility(e); })
      .catch(() => { if (on) setEligibility(null); });
    return () => { on = false; };
  }, [enrollmentId, needsCheck]);

  if (issued) {
    return (
      <Card tone="warn" className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3.5">
        <span className="flex items-center gap-1.5 text-xs font-black text-gold-ink">
          <Award className="h-4 w-4" /> صدرت شهادتك
        </span>
        <span dir="ltr" className="min-w-0 flex-1 font-mono text-xs text-foreground">{issued.number}</span>
        <Link
          to={`/verify/${issued.number}`}
          className="shrink-0 text-micro font-bold text-teal-light-ink underline underline-offset-4"
        >
          صفحة التحقق العامة
        </Link>
      </Card>
    );
  }

  if (request || sent) {
    const meta = REQUEST_STATUS_AR[request?.status ?? "pending"] ?? REQUEST_STATUS_AR.pending;
    return (
      <Card className="p-3.5">
        <p className="flex flex-wrap items-center gap-2 text-xs font-black text-foreground">
          <Award className="h-4 w-4 text-gold-ink" /> شهادة «{courseTitleAr}»
          <span className={`rounded-full border px-2.5 py-0.5 text-micro font-bold ${meta.cls}`}>{meta.label}</span>
        </p>
        <p className="mt-1.5 text-micro leading-5 text-muted-foreground">
          {request?.decisionAr
            ? request.decisionAr
            : "نراجع قواعد الإكمال ثم تُصدَر الشهادة برقم تحقّق، وتصلك في «شهاداتي»."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-black text-foreground">
        <Award className="h-4 w-4 text-gold-ink" /> شهادة هذه الدورة
      </p>
      {eligibility === null ? (
        <p className="mt-1.5 flex items-center gap-2 text-micro text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> نقرأ استحقاقك…
        </p>
      ) : eligibility.eligible ? (
        <>
          <p className="mt-1.5 text-micro leading-5 text-muted-foreground">
            استوفيت قواعد إكمال الدورة. اطلبها الآن، وتُصدَر برقم تحقّقٍ باسمك.
          </p>
          <Button tone="primary" onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await createRequest({ kind: "course_certificate", enrollmentId });
                setSent(true);
                onChanged();
              } catch (e) {
                setError(e instanceof ApiError ? e.message : "تعذّر إرسال الطلب — أعد المحاولة");
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy} className="mt-2.5 disabled:opacity-50">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            اطلب شهادة الدورة
          </Button>
        </>
      ) : (
        <>
          {/* ما ينقصه بالنصّ — لا زرٌّ مطفأ يُقرأ عطبا */}
          <p className="mt-1.5 text-micro leading-5 text-muted-foreground">ما يبقى قبل شهادتك:</p>
          <ul className="mt-1.5 space-y-1 border-r-2 border-white/10 ps-3">
            {eligibility.reasonsAr.map((r) => (
              <li key={r} className="text-micro leading-5 text-muted-foreground">{r}</li>
            ))}
          </ul>
        </>
      )}
      {error && <p className="mt-2 text-micro font-bold text-gold-ink">{error}</p>}
    </Card>
  );
}

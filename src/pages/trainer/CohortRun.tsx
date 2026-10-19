/* ═══ «التشغيل» — الشعبةُ الجارية تُفتح على عمل أسبوعها (١٩ أكتوبر ٢٠٢٦) ═══

   درس صاحبُ المنصّة جانبَ المدرّب واختار («All, in order»، الخطوة E): كان حضورُ لقاءٍ جارٍ في الخطوة
   الرابعة من سلّم إعداد الخطّة («اللقاءات»)، والشعبةُ المعتمدةُ تُفتح على «الاعتماد». فمن أراد أن يسجّل
   حضورَ اليوم مرّ بسلّمٍ وُضع لكتابة الخطّة لا لتشغيلها.

   فالشعبةُ الجارية (مفتوحةٌ أو ممتلئةٌ أو جارية، أو فيها متعلّمون) تُفتح هنا: لقاءاتُها وحضورُها، وتسليماتُها،
   وطريقُ مراسلة طلبتها والتصحيح. والسلّمُ باقٍ في لسان «الخطة» بجانبه لمن أراد تعديلها — لا يسقط منه
   شيء. ولا شيءَ هنا يُكتب من جديد: المكوّنان نفساهما اللذان كانا داخل الخطوتين (`SessionsAndAttendance`
   و`CohortSubmissions`). */

import { Link } from "react-router";
import { ClipboardCheck, ListChecks, MessageSquare } from "lucide-react";
import SessionsAndAttendance from "./SessionsAndAttendance";
import CohortSubmissions from "./CohortSubmissions";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

export default function CohortRun({ cohortId, learners, nextSessionAr, refresh, pendingReview, onOpenReview }: {
  cohortId: string;
  learners: number;
  /** اللقاءُ القادم بتوقيت الأكاديميّة — أو `null` حين لا لقاء قادما */
  nextSessionAr: string | null;
  /** بصمةُ اللقاءات — تتبدّل فيُعاد جلبُ الحضور */
  refresh: string;
  /** اقتراحاتُ الإدارة على خطّته التي تنتظر قرارَه */
  pendingReview: number;
  onOpenReview: () => void;
}) {
  return (
    <div className="space-y-5">
      <Inset className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-read leading-7 text-muted-foreground">
          <b className="text-foreground">{learners}</b> {learners === 1 ? "متعلم" : "متعلمين"}
          {" · "}
          {nextSessionAr ? <>اللقاء القادم: <b className="text-foreground">{nextSessionAr}</b></> : "لا لقاء قادما"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button as={Link} to={`/trainer/learners?cohort=${cohortId}`} size="sm" icon={MessageSquare}>راسل طلبتها</Button>
          <Button as={Link} to="/trainer/grading" size="sm" icon={ClipboardCheck}>طابور التقييم</Button>
        </div>
      </Inset>

      {pendingReview > 0 && (
        <Inset tone="warn" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-read leading-7 text-gold-ink">
            في خطتك {pendingReview === 1 ? "اقتراح من الإدارة ينتظر" : `${pendingReview} اقتراحات من الإدارة تنتظر`} قرارك.
          </p>
          <Button size="sm" icon={ListChecks} onClick={onOpenReview}>افتح المراجعة</Button>
        </Inset>
      )}

      <SessionsAndAttendance cohortId={cohortId} refresh={refresh} />
      <CohortSubmissions cohortId={cohortId} />
    </div>
  );
}

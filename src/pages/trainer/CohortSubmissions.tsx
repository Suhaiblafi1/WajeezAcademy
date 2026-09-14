/* «ما سُلّم وما ينتظر» — في مرحلة «المهامّ والتطبيق العمليّ» (ع-١).

   ═══ وتصحيحُ ظنٍّ أخطأتُه ═══

   ظننتُ هذه اللوحةَ تكرارَ «طابور التقييم» فحذفتُها، فأسقط الحارسُ الحذفَ —
   وكان محقًّا. الطابورُ صفُّ **تسليماتٍ** تُصحَّح واحدا واحدا؛ وهذه تقول
   لكلّ **مهمّةٍ** كم سلّم من متعلّمي الشعبة وكم ينتظر تصحيحَه، بالمقام
   الصحيح («٣ من ١٢» لا «من ٠»). وهما سؤالان مختلفان: «ما الذي أصحّحه الآن؟»
   و«أيُّ مهمّةٍ لم يسلّمها نصفُ الشعبة؟».

   فنُقلت ولم تُحذف، وموضعُها حيث يؤلّفها: من كتب المهمّةَ يرى تحتها مَن
   استجاب لها.

   ═══ ولماذا تقرأ `/ops` لا الورشة ═══

   `CohortAssignments` تعدّ التسليماتِ وتصفّيها بحالتها (`under_review`)،
   وموجزُ الورشة يعطي **عددا** لا صفوفا. فتُقرأ من حيث تأتي كاملة، ولا
   يُغيَّر المكوّنُ ليقبل شكلا أفقر — فالعددُ لا يُصفَّى بحالة. */

import { useEffect, useState } from "react";
import { apiGet } from "@/services/api";
import { Panel } from "@/components/ui/Surface";
import CohortAssignments, { type CohortAssessment } from "./CohortAssignments";

interface OpsRow {
  cohort: {
    enrollments: { id: string; status: string }[];
    assessments: CohortAssessment[];
  };
}

export default function CohortSubmissions({ cohortId }: { cohortId: string }) {
  const [row, setRow] = useState<OpsRow | null>(null);

  /* القراءةُ في ردّ النداء لا في جسم الأثر: `set-state-in-effect` يمنع
     الثانية، وهي كذلك تترك سباقا عند تبديل الشعبة قبل وصول الجواب —
     فـ`alive` يُسقط جوابا متأخّرا لشعبةٍ غادرها المدرّب. */
  useEffect(() => {
    let alive = true;
    apiGet<OpsRow>(`/api/trainer/cohorts/${cohortId}/ops`)
      .then((r) => { if (alive) setRow(r); })
      .catch(() => { /* الغيابُ لا يُسقط المرحلة — التأليفُ فوقها يعمل */ });
    return () => { alive = false; };
  }, [cohortId]);

  if (!row) return null;
  /* المقامُ من التحق فعلا — ومنتظرو القائمة ليسوا مطالَبين بتسليم */
  const learners = row.cohort.enrollments.filter((e) => e.status !== "waitlisted").length;

  return (
    <Panel as="section">
      <CohortAssignments items={row.cohort.assessments} learners={learners} />
    </Panel>
  );
}

/* طلبةُ المدرّب — شعبُه هو، لا طلبةُ غيره.

   واللوحُ هو نفسُه الذي في بوابتَي الإدارة والمستشار: النطاقُ يُشتقّ في
   الخادم من صلاحيّات صاحب الجلسة، فالمدرّبُ يقرأ طلبةَ شعبه ولا يسجّل أحدا
   ولا يحذفه — والرؤيةُ لا تُعطي التعديل. */

import TrainerLayout from "./TrainerLayout";
import LearnersPanel from "@/components/LearnersPanel";

export default function TrainerMyLearners() {
  return (
    <TrainerLayout title="طلبتي">
      <LearnersPanel />
    </TrainerLayout>
  );
}

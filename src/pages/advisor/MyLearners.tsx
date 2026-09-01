/* طلبةُ المستشار — عملاءُ حالاته المسندة إليه وحدَهم.

   واللوحُ هو نفسُه الذي في بوابتَي الإدارة والمدرّب: النطاقُ في الخادم،
   والمستشارُ يتابع ولا يعدّل حسابا. */

import AdvisorLayout from "./AdvisorLayout";
import LearnersPanel from "@/components/LearnersPanel";

export default function AdvisorMyLearners() {
  return (
    <AdvisorLayout title="طلبتي">
      <LearnersPanel />
    </AdvisorLayout>
  );
}

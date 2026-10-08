/* مراجعةُ اختبار تحديد المستوى في بوّابة المدرّب — لمن مُنح `placement.review` وحدَه.
   اللوحةُ نفسُها في `src/components/placement/PlacementReviewBoard.tsx`. */

import TrainerLayout from "./TrainerLayout";
import PlacementReviewBoard from "@/components/placement/PlacementReviewBoard";

export default function TrainerPlacementReview() {
  return (
    <TrainerLayout title="مراجعة اختبار تحديد المستوى">
      <PlacementReviewBoard />
    </TrainerLayout>
  );
}

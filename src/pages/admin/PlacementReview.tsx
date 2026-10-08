/* مراجعةُ اختبار تحديد المستوى في لوحة الإدارة — اللوحةُ نفسُها التي يراها مدرّبُ
   الإنجليزيّة في بوّابته (`src/components/placement/PlacementReviewBoard.tsx`). */

import AdminLayout from "./AdminLayout";
import PlacementReviewBoard from "@/components/placement/PlacementReviewBoard";

export default function AdminPlacementReview() {
  return (
    <AdminLayout title="اختبار تحديد المستوى">
      <PlacementReviewBoard />
    </AdminLayout>
  );
}

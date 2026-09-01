/* الطلبةُ المسجَّلون — شاشةُ الإدارة.

   واللوحُ نفسُه يُركَّب في بوابتَي المدرّب والمستشار: النطاقُ يُشتقّ في الخادم
   من صلاحيّات صاحب الجلسة، فالسؤالُ واحدٌ والجوابُ يختلف بمن يسأل. */

import AdminLayout from "./AdminLayout";
import LearnersPanel from "@/components/LearnersPanel";

export default function AdminLearners() {
  return (
    <AdminLayout title="الطلبة المسجَّلون">
      <div className="mx-auto max-w-4xl">
        <LearnersPanel />
      </div>
    </AdminLayout>
  );
}

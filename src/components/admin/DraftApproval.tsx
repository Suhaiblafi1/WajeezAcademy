/* المسودّةُ تُقدَّم للاعتماد من صفّها (٢٧ أكتوبر ٢٠٢٦، المرحلة الثامنة — ب).

   كان بابُها الوحيدُ صندوقَ JSON «طلب تعديل على كيان موجود». وذهب الصندوق، فصار في صفّ كلّ مسودّةٍ زرٌّ يقدّمها لمن
   يملك تأليفَ صنفها — أو شارةٌ تقول إنّها تنتظر، فلا يُقدَّم الطلبُ مرّتين. وما ليس مسودّةً لا شيءَ له هنا. */

import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";

export default function DraftApproval({ status, waiting, canSubmit, busy, onSubmit }: {
  status: string
  /** في الطابور طلبٌ له ينتظر قرارا */
  waiting: boolean
  canSubmit: boolean
  busy: boolean
  onSubmit: () => void
}) {
  if (status !== "draft") return null;
  if (waiting) return <Chip tone="info">ينتظر الاعتماد</Chip>;
  if (!canSubmit) return null;
  return <Button tone="secondary" size="sm" disabled={busy} onClick={onSubmit}>قدم للاعتماد</Button>;
}

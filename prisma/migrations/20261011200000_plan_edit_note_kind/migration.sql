-- ملاحظاتُ الردّ بنودٌ في «المراجعة» يوافق عليها المدرّب (١١ أكتوبر ٢٠٢٦).
--
-- كانت ملاحظاتُ الإدارة صندوقا فوق كلّ خطوةٍ ونقاطا حمراءَ على دوائرها. فسأل صاحبُ المنصّة: «لماذا هذا
-- القسم؟»، وقرّر: «دعها في قسم التعديلات بشكلٍ واضح… على شكل نقاط ليوافق عليها أيضا». فصار لكلّ ملاحظةِ
-- خطوةٍ بندٌ من نوعٍ جديد `note` في جدول التعديلات المقترحة، بمسلك القبول والرفض نفسِه. ولا عمودَ جديد:
-- القيدُ وحدَه يتّسع له. والقيدُ مولَّدٌ من تعليق العمود بـ`scripts/status-checks.ts`.

ALTER TABLE "PlanEditSuggestion" DROP CONSTRAINT IF EXISTS "PlanEditSuggestion_kind_allowed";
ALTER TABLE "PlanEditSuggestion" ADD CONSTRAINT "PlanEditSuggestion_kind_allowed" CHECK ("kind" IN ('module', 'plan', 'resource_add', 'resource_change', 'resource_remove', 'task_add', 'task_change', 'session_move', 'session_remove', 'note'));

-- الكرّاسةُ بطاقةُ «قبل/بعد» في التعديلات المقترحة (١٢ أكتوبر ٢٠٢٦).
--
-- سُئل صاحبُ المنصّة عن عيوب الكرّاسات فاختار «We fix the PDF, he accepts»: نرفع الكرّاسةَ المصحّحة ملفّا،
-- فيرى القديمةَ والجديدةَ ويقبل أو يرفض. فنوعٌ جديد `workbook_replace`، ولا عمودَ جديد: القيدُ وحدَه يتّسع
-- له، مولَّدا من تعليق العمود بـ`scripts/status-checks.ts`.

ALTER TABLE "PlanEditSuggestion" DROP CONSTRAINT IF EXISTS "PlanEditSuggestion_kind_allowed";
ALTER TABLE "PlanEditSuggestion" ADD CONSTRAINT "PlanEditSuggestion_kind_allowed" CHECK ("kind" IN ('module', 'plan', 'resource_add', 'resource_change', 'resource_remove', 'task_add', 'task_change', 'session_move', 'session_remove', 'note', 'schedule', 'cohort_title', 'task_remove', 'session_add', 'session_change', 'workbook_replace'));

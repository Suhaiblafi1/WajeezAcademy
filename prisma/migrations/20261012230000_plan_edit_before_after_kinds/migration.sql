-- ما كان يُطلب من المدرّب أن يعمله بنفسه — بطاقاتٌ «قبل/بعد» في التعديلات المقترحة (١٢ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: «i don't need any suggestions that would ask him to do something himself.. all must
-- be before and after and he accept or reject». فأربعةُ أنواعٍ جديدة: `cohort_title` (عنوانُ الشعبة)،
-- و`task_remove` (حذفُ مهمّة)، و`session_add` (لقاءٌ جديد)، و`session_change` (عنوانُ لقاءٍ أو ملاحظتُه).
-- ولا عمودَ جديد: القيدُ وحدَه يتّسع لها، مولَّدا من تعليق العمود بـ`scripts/status-checks.ts`.

ALTER TABLE "PlanEditSuggestion" DROP CONSTRAINT IF EXISTS "PlanEditSuggestion_kind_allowed";
ALTER TABLE "PlanEditSuggestion" ADD CONSTRAINT "PlanEditSuggestion_kind_allowed" CHECK ("kind" IN ('module', 'plan', 'resource_add', 'resource_change', 'resource_remove', 'task_add', 'task_change', 'session_move', 'session_remove', 'note', 'schedule', 'cohort_title', 'task_remove', 'session_add', 'session_change'));

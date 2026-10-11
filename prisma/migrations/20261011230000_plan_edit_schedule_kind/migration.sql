-- جدولٌ كاملٌ بسلسلته بندا واحدا في التعديلات المقترحة (١١ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: «في حال قمنا بتعديل شيءٍ قد يؤثّر على توقيتاتٍ أخرى يجب أن يكون التعديلُ كاملا
-- بسلسلة، لكي لا نخرّب بدلَ ما نُصلح». فنوعٌ جديد `schedule`: لقاءاتٌ تُنقل معا ومواعيدُ المهامّ التي
-- تتبعها — يُقبل كلُّه أو يُرفض كلُّه. ولا عمودَ جديد: القيدُ وحدَه يتّسع له، مولَّدا من تعليق العمود
-- بـ`scripts/status-checks.ts`.

ALTER TABLE "PlanEditSuggestion" DROP CONSTRAINT IF EXISTS "PlanEditSuggestion_kind_allowed";
ALTER TABLE "PlanEditSuggestion" ADD CONSTRAINT "PlanEditSuggestion_kind_allowed" CHECK ("kind" IN ('module', 'plan', 'resource_add', 'resource_change', 'resource_remove', 'task_add', 'task_change', 'session_move', 'session_remove', 'note', 'schedule'));

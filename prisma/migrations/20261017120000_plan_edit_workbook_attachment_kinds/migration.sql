-- عنوانُ الكرّاسة ومواضعُ محاورها، ومرفقُ المهمّة — بطاقاتُ «قبل/بعد» (١٧ أكتوبر ٢٠٢٦).
--
-- «وما لا تحمله البطاقاتُ بعدُ يُبنى له بابُها، لا يُحال على المدرّب» (قرارُ صاحب المنصّة، ١٢ أكتوبر). فنوعان
-- جديدان `workbook_change` و`task_attachment`، ولا عمودَ جديد: القيدُ وحدَه يتّسع لهما، مولَّدا من تعليق العمود
-- بـ`scripts/status-checks.ts`.

ALTER TABLE "PlanEditSuggestion" DROP CONSTRAINT IF EXISTS "PlanEditSuggestion_kind_allowed";
ALTER TABLE "PlanEditSuggestion" ADD CONSTRAINT "PlanEditSuggestion_kind_allowed" CHECK ("kind" IN ('module', 'plan', 'resource_add', 'resource_change', 'resource_remove', 'task_add', 'task_change', 'session_move', 'session_remove', 'note', 'schedule', 'cohort_title', 'task_remove', 'session_add', 'session_change', 'workbook_replace', 'workbook_change', 'task_attachment'));

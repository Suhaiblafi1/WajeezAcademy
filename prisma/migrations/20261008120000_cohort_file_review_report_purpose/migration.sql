-- تقريرُ المراجعة غرضٌ رابعٌ لملفّات الشعبة (٨ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: يصل تقريرُ مراجعة الخطّة المدرّبَ من المنصّة نفسِها — يرفعه المعتمِدُ
-- على بطاقة المراجعة، ويُحفظ مع الخطّة، ويُذكر في رسالة القرار — لا بريدا من خارجها.
--
-- والقيدُ مولَّدٌ من تعليق العمود بـ`scripts/status-checks.ts` لا مكتوبٌ باليد (والدرسُ من
-- `20261007120000_cohort_file_workbook_purpose`: غرضٌ في الشيفرة بلا قيدٍ يُردّ رفعُه بخطأ
-- خادم). ولا صفَّ قديمَ بغرضٍ غيرِ الثلاثة، فيُفحَص ما مضى ولا حاجةَ إلى `NOT VALID`.

ALTER TABLE "CohortFile" DROP CONSTRAINT IF EXISTS "CohortFile_purpose_allowed";
ALTER TABLE "CohortFile" ADD CONSTRAINT "CohortFile_purpose_allowed" CHECK ("purpose" IN ('module_body', 'plan_resource', 'workbook', 'review_report'));

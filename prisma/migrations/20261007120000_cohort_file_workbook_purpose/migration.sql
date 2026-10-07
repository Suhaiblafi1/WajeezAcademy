-- الكرّاسةُ PDF غرضٌ ثالثٌ لملفّات الشعبة — والقيدُ لم يعرفه (٧ أكتوبر ٢٠٢٦).
--
-- بلّغ صاحبُ المنصّة: «هناك خطأ عند تحميل الملفات». وكان رفعُ كلّ كرّاسةٍ يُردّ بخطأ
-- خادم (500): زيد الغرضُ `workbook` في الشيفرة (`FILE_PURPOSES`) يومَ صار رفعُ الكرّاسة
-- PDF وحدَه (٦ أكتوبر)، ولم يُزَد في تعليق العمود ولا في قيده — فيُنشأ صفُّ الملفّ قبل
-- رابط الرفع ويردّه `CohortFile_purpose_allowed`. ومتنُ المحور والمصدرُ يُرفعان كما كانا.
--
-- والقيدُ مولَّدٌ من تعليق العمود بـ`scripts/status-checks.ts` لا مكتوبٌ باليد. ولا صفَّ
-- قديمَ بغرضٍ غيرِ الثلاثة (القيدُ كان يردّها)، فيُفحَص ما مضى ولا حاجةَ إلى `NOT VALID`.

ALTER TABLE "CohortFile" DROP CONSTRAINT IF EXISTS "CohortFile_purpose_allowed";
ALTER TABLE "CohortFile" ADD CONSTRAINT "CohortFile_purpose_allowed" CHECK ("purpose" IN ('module_body', 'plan_resource', 'workbook'));

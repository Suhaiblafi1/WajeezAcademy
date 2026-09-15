-- نبذةٌ عن الدورة بدل «لمن هي»، وسؤالُ الإدارة قبل القرار.
--
-- والعمودُ يُعاد تسميتُه ولا يُستبدَل: ما كتبه المدرّبون في «لمن هي» كلامُهم
-- هم، ولو أُسقط العمودُ وأُنشئ غيرُه لضاع بلا أن يقول أحدٌ إنّه ضاع. ومن وجد
-- جمهورَه القديمَ في خانة النبذة عدّله — وهو أهونُ من أن يجدها فارغة.
ALTER TABLE "TrainerCourseProposal" RENAME COLUMN "audienceAr" TO "summaryAr";

-- سؤالُ الإدارة وجوابُه — وكلاهما يبقى بعد القرار: من قرأ «رُفضت» بعد شهرٍ
-- يحتاج أن يرى ما سُئل عنه وبمَ أجاب.
ALTER TABLE "TrainerCourseProposal" ADD COLUMN "questionAr" TEXT;
ALTER TABLE "TrainerCourseProposal" ADD COLUMN "questionBy" UUID;
ALTER TABLE "TrainerCourseProposal" ADD COLUMN "questionAt" TIMESTAMP(3);
ALTER TABLE "TrainerCourseProposal" ADD COLUMN "answerAr" TEXT;
ALTER TABLE "TrainerCourseProposal" ADD COLUMN "answeredAt" TIMESTAMP(3);

-- واقتراحاتُ الطلبات المحفوظةُ في عمود JSON: مفتاحُها `audienceAr` فيها،
-- ويُقرأ اليومَ `summaryAr ?? audienceAr` في `teachable-proposals.ts` — فلا
-- تُمسّ صفوفُ الطلبات هنا. الطلبُ سجلُّ ما قُدّم يومَ قُدّم، ولا يُعاد كتابتُه.

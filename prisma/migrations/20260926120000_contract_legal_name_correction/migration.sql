-- اسمُ الطرف الثاني القانونيُّ ومسارُ تصحيحه.
--
-- العطبُ: ديباجةُ العقد تُطبَع باسم `TrainerApplication.fullName` — وهو ما
-- أُخذ من حساب المتقدّم أو كتبه في نموذجه، وقد لا يطابق وثيقةَ هويّته. ثمّ
-- يوقّع المدرّبُ باسمه القانونيّ في خانة التوقيع، فتخرج وثيقةٌ تسمّي طرفا
-- ويوقّعها آخر. وبلاغُ صاحب المنصّة (٢٦ سبتمبر ٢٠٢٦).
--
-- والأعمدةُ كلُّها اختياريّة، فلا يتغيّر شيءٌ في صفٍّ قائم.

ALTER TABLE "TrainerProfile"  ADD COLUMN "legalNameAr"        TEXT;
ALTER TABLE "TrainerContract" ADD COLUMN "nameCorrectionAr"   TEXT;
ALTER TABLE "TrainerContract" ADD COLUMN "nameCorrectionAt"   TIMESTAMP(3);
ALTER TABLE "TrainerContract" ADD COLUMN "replacesContractId" UUID;

-- رابطُ المدرّب على مستواه هو، وصفحتُه العامّة باسمه
--
-- كان لكلّ شعبةٍ رابطٌ منفصل، فالمدرّبُ الذي يدرّب خمسا ينشر خمسةَ روابط
-- ويشرح لكلٍّ موضعَه. وقال صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «أتِح للمدرّب
-- رابطَ دعوةٍ لكافّة دوراته وليس لدورةٍ دورة»، و«يظهر مسارٌ باسم المدرّب
-- للعامّة في الرابط ليسجّلوا فيه».
--
-- ولم يُنشأ جدولٌ ثانٍ: `code` يجب أن يكون فريدا بين النوعين معا، وإلّا
-- احتاج كلُّ قارئٍ نداءَين وما ضمن أحدٌ ألّا يتصادما. فالرابطُ الواسع صفٌّ
-- في الجدول نفسِه بـ`cohortId` فارغ.

ALTER TABLE "TrainerReferralLink" ALTER COLUMN "cohortId" DROP NOT NULL;

-- و`@@unique([cohortId, profileId])` لا يمنع رابطَين واسعَين لمدرّبٍ واحد:
-- PostgreSQL يعدّ كلَّ `NULL` مختلفا عن أخيه. فالفرادةُ في فهرسٍ جزئيّ.
CREATE UNIQUE INDEX "TrainerReferralLink_profileId_wide_key"
  ON "TrainerReferralLink" ("profileId")
  WHERE "cohortId" IS NULL;

-- اسمُه في العنوان: يُشتقّ مرّةً من اسمه في طلبه ثمّ يبقى.
ALTER TABLE "TrainerProfile" ADD COLUMN "publicSlug" TEXT;
CREATE UNIQUE INDEX "TrainerProfile_publicSlug_key" ON "TrainerProfile" ("publicSlug");

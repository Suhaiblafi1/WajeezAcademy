-- الفسخُ عند الرحيل: عقدٌ نفَذ يُنهى، ولا يُمحى دليلُه.
--
-- إضافيّةٌ كلُّها: ثلاثةُ أعمدةٍ تقبل الفراغَ، فلا صفَّ قائمٌ يتأثّر ولا
-- جدولٌ يُقفَل. و`terminated` مذكورةٌ في قيد الحالات منذ المرحلة الثالثة،
-- فلا قيدَ يُعاد توليدُه.

ALTER TABLE "TrainerContract" ADD COLUMN "terminatedAt"      TIMESTAMP(3);
ALTER TABLE "TrainerContract" ADD COLUMN "terminatedBy"      UUID;
ALTER TABLE "TrainerContract" ADD COLUMN "terminateReasonAr" TEXT;

-- ═══ وملفُّ الرحيل يذهب مع صاحبه ═══
--
-- `TrainerDeparture.profileId` كان بلا `onDelete` فصار Restrict، فكلُّ مدرّبٍ
-- فُتح له ملفُّ رحيلٍ لا يُمحى أبدا — و`purge` تسقط برسالةِ قاعدةٍ غامضة.
-- وكشفه حارسُ «بعد الفسخ يُمحى»: رسالةُ مانعِ المحو تدلّ على مسار الرحيل،
-- وذاك المسارُ نفسُه كان يُغلق البابَ الذي يدلّ عليه.
--
-- والحالاتُ تذهب معه: `DepartureCase.departureId` متتالٍ منذ إنشائه.

ALTER TABLE "TrainerDeparture" DROP CONSTRAINT "TrainerDeparture_profileId_fkey";
ALTER TABLE "TrainerDeparture" ADD CONSTRAINT "TrainerDeparture_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

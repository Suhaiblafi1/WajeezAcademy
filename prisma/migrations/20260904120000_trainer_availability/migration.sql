-- إتاحةُ المدرّب (المهمّة ٧١): ساعاتٌ أسبوعيّةٌ يعلنها، وغيابٌ يسجّله.
-- الغيابُ مانعٌ للإسناد، والساعاتُ إرشادٌ للمُسنِد — والفرقُ مقصودٌ ومكتوبٌ
-- في المخطّط: من لم يُعلن ساعاتِه لا يُمنَع من شيء.
CREATE TABLE "TrainerAvailability" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerAvailability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainerBlackout" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerBlackout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainerAvailability_profileId_weekday_idx" ON "TrainerAvailability"("profileId", "weekday");
CREATE INDEX "TrainerBlackout_profileId_startsAt_idx" ON "TrainerBlackout"("profileId", "startsAt");

ALTER TABLE "TrainerAvailability" ADD CONSTRAINT "TrainerAvailability_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainerBlackout" ADD CONSTRAINT "TrainerBlackout_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- حدودٌ في القاعدة لا في الواجهة وحدَها: يومٌ من سبعة، ودقائقُ من يومٍ، ونهايةٌ بعد بداية.
ALTER TABLE "TrainerAvailability" ADD CONSTRAINT "TrainerAvailability_weekday_range" CHECK ("weekday" BETWEEN 0 AND 6);
ALTER TABLE "TrainerAvailability" ADD CONSTRAINT "TrainerAvailability_minutes_range"
  CHECK ("startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute");
ALTER TABLE "TrainerBlackout" ADD CONSTRAINT "TrainerBlackout_range" CHECK ("endsAt" > "startsAt");

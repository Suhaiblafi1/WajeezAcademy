-- كودُ «شارك دوراتك» — خصمُ الأكاديميّة ٣٠٪ على دورات مدرّبٍ بعينه، ينشره هو (٢٦ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: خصمٌ «منّا نحن» لا ينقص من حساب المدرّب. والعلّةُ في `src/application/trainer/share-code.ts`.

CREATE TABLE "TrainerShareCode" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "couponId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerShareCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainerShareCode_profileId_key" ON "TrainerShareCode"("profileId");
CREATE UNIQUE INDEX "TrainerShareCode_couponId_key" ON "TrainerShareCode"("couponId");

ALTER TABLE "TrainerShareCode" ADD CONSTRAINT "TrainerShareCode_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainerShareCode" ADD CONSTRAINT "TrainerShareCode_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ردُّنا على المعتذِر عن عقده، وخيارُه في بياناته (٣ أكتوبر ٢٠٢٦)
ALTER TABLE "TrainerContract" ADD COLUMN "declineReplyAr" TEXT;
ALTER TABLE "TrainerContract" ADD COLUMN "declineRepliedAt" TIMESTAMP(3);
ALTER TABLE "TrainerContract" ADD COLUMN "declineRepliedBy" UUID;
ALTER TABLE "TrainerContract" ADD COLUMN "dataChoiceTokenHash" TEXT;
ALTER TABLE "TrainerContract" ADD COLUMN "dataChoiceExpiresAt" TIMESTAMP(3);
ALTER TABLE "TrainerContract" ADD COLUMN "dataChoice" TEXT;
ALTER TABLE "TrainerContract" ADD COLUMN "dataChoiceAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "TrainerContract_dataChoiceTokenHash_key" ON "TrainerContract"("dataChoiceTokenHash");

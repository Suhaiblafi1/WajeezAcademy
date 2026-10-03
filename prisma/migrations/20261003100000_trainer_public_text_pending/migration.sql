-- عنوانُ المدرّب ونبذتُه المعلَّقان حتّى تعتمدهما الإدارة (٣ أكتوبر ٢٠٢٦)
ALTER TABLE "TrainerProfile" ADD COLUMN "headlinePending" TEXT;
ALTER TABLE "TrainerProfile" ADD COLUMN "bioPending" TEXT;
ALTER TABLE "TrainerProfile" ADD COLUMN "publicTextPendingAt" TIMESTAMP(3);
ALTER TABLE "TrainerProfile" ADD COLUMN "publicTextRejectNoteAr" TEXT;

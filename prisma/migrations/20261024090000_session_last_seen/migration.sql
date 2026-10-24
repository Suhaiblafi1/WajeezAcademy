-- آخرُ نشاطٍ للجلسة — منه «آخرُ نشاطٍ» للمدرّب (قرارُ صاحب المنصّة ٢٤ أكتوبر ٢٠٢٦)
-- AlterTable
ALTER TABLE "Session" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- والقائمةُ تُملأ بوقت الدخول: أصدقُ ما نعرفه عنها قبل هذا العمود
UPDATE "Session" SET "lastSeenAt" = "createdAt" WHERE "lastSeenAt" IS NULL;

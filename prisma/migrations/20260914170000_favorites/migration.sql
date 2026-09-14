-- مفضّلةُ الزائر المسجَّل (ع-٨) — تنتقل من متصفّحه إلى حسابه

CREATE TABLE "Favorite" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- لا يُحفظ الشيءُ مرّتَين لصاحبٍ واحد
CREATE UNIQUE INDEX "Favorite_userId_kind_refId_key" ON "Favorite"("userId", "kind", "refId");
CREATE INDEX "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt");

ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- قيدُ الحالة مولَّدٌ لا مكتوبٌ بيده (قاعدةُ المستودَع):
--   npx tsx scripts/status-checks.ts
-- والتعليقُ في المخطّط هو العقد — من أراد نوعا ثالثا كتبه هناك ثمّ ولّد الترحيل.
ALTER TABLE "Favorite" DROP CONSTRAINT IF EXISTS "Favorite_kind_allowed";
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_kind_allowed" CHECK ("kind" IN ('pathway', 'course'));

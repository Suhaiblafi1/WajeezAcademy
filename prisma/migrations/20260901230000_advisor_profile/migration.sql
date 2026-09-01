-- ملفُّ المستشار — لم يكن له صفٌّ يخصّه، فقط حالاتٌ مسندة إليه. ونسبة
-- العمولة وملاحظات الإدارة لا تخصّ حالة بعينها، بل صاحبها.

CREATE TABLE "AdvisorProfile" (
  "id"                UUID           NOT NULL DEFAULT gen_random_uuid(),
  "userId"            UUID           NOT NULL,
  "commissionPercent" DECIMAL(5,2),
  "notesAr"           TEXT,
  "createdAt"         TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3)   NOT NULL,
  CONSTRAINT "AdvisorProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdvisorProfile_userId_key" ON "AdvisorProfile"("userId");

ALTER TABLE "AdvisorProfile"
  ADD CONSTRAINT "AdvisorProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

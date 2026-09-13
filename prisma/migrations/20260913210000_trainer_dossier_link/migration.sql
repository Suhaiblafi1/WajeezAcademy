-- سجلُّ المتقدّم يُقرأ برابطٍ باسمِ قارئه، بدل ورقةٍ تُطبع.
-- ولا يُحفظ الرمزُ بل هاشُه — كـ"TrainerInvitation" سواءً بسواء.
CREATE TABLE "TrainerDossierLink" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "applicationId" UUID         NOT NULL,
  "tokenHash"     TEXT         NOT NULL,
  "reviewerName"  TEXT         NOT NULL,
  "reviewerEmail" TEXT,
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "revokedAt"     TIMESTAMP(3),
  "firstOpenedAt" TIMESTAMP(3),
  "lastOpenedAt"  TIMESTAMP(3),
  "createdBy"     UUID,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainerDossierLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainerDossierLink_tokenHash_key" ON "TrainerDossierLink"("tokenHash");
CREATE INDEX "TrainerDossierLink_applicationId_idx" ON "TrainerDossierLink"("applicationId");

ALTER TABLE "TrainerDossierLink"
  ADD CONSTRAINT "TrainerDossierLink_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "TrainerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- وصفُّ المراجعة يقبل كاتبَين: موظّفا مسجَّلا (reviewerId) أو صاحبَ رابط (linkId).
-- فيُرفع القيدُ عن الأوّل ويُضاف الثاني.
ALTER TABLE "TrainerApplicationReview"
  ALTER COLUMN "reviewerId" DROP NOT NULL;

ALTER TABLE "TrainerApplicationReview"
  ADD COLUMN "linkId"       UUID,
  ADD COLUMN "reviewerName" TEXT,
  ADD COLUMN "verdict"      TEXT,
  ADD COLUMN "coursesNote"  TEXT,
  -- الصفوفُ القائمةُ تأخذ وقتَ إنشائها، لا وقتَ الهجرة: وإلّا بدت كلُّها
  -- كأنّها عُدّلت اليومَ، وهو كذبٌ في عمودٍ وُضع ليُصدَّق.
  ADD COLUMN "updatedAt"    TIMESTAMP(3);

UPDATE "TrainerApplicationReview" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "TrainerApplicationReview"
  ALTER COLUMN "updatedAt" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "TrainerApplicationReview"
  ADD CONSTRAINT "TrainerApplicationReview_linkId_fkey"
  FOREIGN KEY ("linkId") REFERENCES "TrainerDossierLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- لكلّ قارئٍ تقييمٌ واحدٌ يعود إليه فيراجعه. وNULL في Postgres لا يساوي NULL،
-- فمراجعاتُ الموظّفين (linkId فارغ) لا يقيّدها هذا الفهرسُ أصلا — وهو المقصود.
CREATE UNIQUE INDEX "TrainerApplicationReview_applicationId_linkId_key"
  ON "TrainerApplicationReview"("applicationId", "linkId");

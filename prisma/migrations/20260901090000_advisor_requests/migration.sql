-- طلبات المستشار التي تحتاج قرار الإدارة: خصمٌ أو تعديلُ خطّة.
-- والكوبون يمكن أن يُقصَر على عميلٍ بعينه — فارغٌ يعني عامّا كما كان.

ALTER TABLE "Coupon" ADD COLUMN "restrictedToUserId" UUID;

ALTER TABLE "Coupon"
  ADD CONSTRAINT "Coupon_restrictedToUserId_fkey"
  FOREIGN KEY ("restrictedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Coupon_restrictedToUserId_idx" ON "Coupon"("restrictedToUserId");

CREATE TABLE "AdvisorRequest" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "caseId"         UUID NOT NULL,
  "advisorId"      UUID NOT NULL,
  "kind"           TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'pending',
  "percentOff"     INTEGER,
  "amountOff"      DECIMAL(10,2),
  "currency"       TEXT,
  "courseId"       TEXT,
  "reasonAr"       TEXT NOT NULL,
  "decidedById"    UUID,
  "decidedAt"      TIMESTAMP(3),
  "decisionNoteAr" TEXT,
  "couponId"       UUID,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdvisorRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdvisorRequest_status_createdAt_idx"  ON "AdvisorRequest"("status", "createdAt");
CREATE INDEX "AdvisorRequest_caseId_createdAt_idx"  ON "AdvisorRequest"("caseId", "createdAt");
CREATE INDEX "AdvisorRequest_advisorId_status_idx"  ON "AdvisorRequest"("advisorId", "status");

ALTER TABLE "AdvisorRequest"
  ADD CONSTRAINT "AdvisorRequest_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "AdvisorCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdvisorRequest"
  ADD CONSTRAINT "AdvisorRequest_advisorId_fkey"
  FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdvisorRequest"
  ADD CONSTRAINT "AdvisorRequest_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdvisorRequest"
  ADD CONSTRAINT "AdvisorRequest_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

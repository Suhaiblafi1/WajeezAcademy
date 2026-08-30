-- تقييم المتعلّم (١و): المدرّب والمستشار والدورة.
-- raterId يُحفظ للنزاهة (تقييم واحد لكل تسجيل لكل هدف) ولا يُعرض أبدا.
CREATE TABLE IF NOT EXISTS "Rating" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "enrollmentId"     UUID NOT NULL,
  "raterId"          UUID NOT NULL,
  "subjectType"      TEXT NOT NULL,
  "subjectId"        TEXT NOT NULL,
  "score"            INTEGER NOT NULL,
  "commentAr"        TEXT,
  "publishStatus"    TEXT NOT NULL DEFAULT 'pending',
  "moderatedBy"      UUID,
  "moderatedAt"      TIMESTAMP(3),
  "moderationReason" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Rating_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Rating_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Rating_enrollmentId_subjectType_subjectId_key"
  ON "Rating"("enrollmentId", "subjectType", "subjectId");
CREATE INDEX IF NOT EXISTS "Rating_subjectType_subjectId_createdAt_idx"
  ON "Rating"("subjectType", "subjectId", "createdAt");
CREATE INDEX IF NOT EXISTS "Rating_publishStatus_createdAt_idx"
  ON "Rating"("publishStatus", "createdAt");

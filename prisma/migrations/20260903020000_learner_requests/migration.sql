-- طلباتُ المتعلّم في آخر رحلته: شهادةُ دورة، وشهادةُ مسارٍ كاملا، وتوصيةٌ مهنيّة.
--
-- كانت الشهاداتُ تُصدَر من لوحة الإدارة وحدها، فمن أنهى دورتَه لم يجد في
-- بوابته بابا يطلب منه شهادتَه — ينتظر أن يتذكّره أحد. وقولُ صاحب المنصّة:
-- «وفي نهاية كل دورة يظهر له طلب شهادة للدورة، وفي نهاية المسار يظهر له طلب
-- شهادة المسار كاملا وتوصية لعمله أو لجماعته».
--
-- وجدولٌ واحد لثلاثة أنواع لأنّ دورتَها واحدة: يُطلب، فيُراجَع، فيُنفَّذ أو
-- يُعتذَر بسببٍ مكتوب. والشهادةُ نفسُها تبقى في "Certificate" — هذا طلبُها.
CREATE TABLE IF NOT EXISTS "LearnerRequest" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "userId"       UUID         NOT NULL,
  "kind"         TEXT         NOT NULL,
  "enrollmentId" UUID,
  "pathwayId"    TEXT,
  "audienceAr"   TEXT,
  "noteAr"       TEXT,
  "status"       TEXT         NOT NULL DEFAULT 'pending',
  "decisionAr"   TEXT,
  "decidedAt"    TIMESTAMP(3),
  "decidedById"  UUID,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearnerRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LearnerRequest_userId_kind_idx" ON "LearnerRequest" ("userId", "kind");
CREATE INDEX IF NOT EXISTS "LearnerRequest_status_createdAt_idx" ON "LearnerRequest" ("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "LearnerRequest"
    ADD CONSTRAINT "LearnerRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LearnerRequest"
    ADD CONSTRAINT "LearnerRequest_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

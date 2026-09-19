-- اعتمادُ التوقيع، والإسنادُ عرضًا يُقبَل لا أمرًا يُنفَّذ.
--
-- البندُ الثالثُ من العقد: «لا ينشأ ارتباطُ المدرّب بأيّ شعبةٍ إلّا بعرضٍ من
-- الأكاديميّة وقبولٍ منه». وكان الإسنادُ فعلًا واحدًا يقع بنقرةِ مسؤول.
--
-- والأعمدةُ كلُّها تقبل الفراغَ عدا ما له افتراض، فلا يُقفل الترحيلُ على صفٍّ
-- سابق. والجدولُ الجديد يُنشأ فارغًا.
--
-- والتصميمُ في docs/superpowers/specs/2026-09-19-trainer-contract-design.md

ALTER TABLE "TrainerContract"
  ADD COLUMN "countersignedAt"       TIMESTAMP(3),
  ADD COLUMN "countersignedBy"       UUID,
  ADD COLUMN "academySignatoryName"  TEXT,
  ADD COLUMN "academySignatoryTitle" TEXT,
  ADD COLUMN "countersignNoteAr"     TEXT;

-- ═══ العرضُ جدولٌ ثالثٌ لا عمودٌ على أحد القائمَين ═══
--
-- ولمَ لا `CohortTrainer`: كتابتُه فيه تجعله مشغولًا قبل أن يقبل — تظهر
-- الشعبةُ في «شعبي» وجدولِه ومستحقّاتِه ويمرّ بـ`assertCohortTrainer`.
--
-- ولمَ لا `TrainerCourseAssignment`: صفٌّ فيه حالتُه `active` يُنشر اسمُه على
-- صفحة الدورة العامّة (`publicCourseTrainer`) ويجعله مستحقًّا للمال
-- (`cohortLeadTrainer` تسقط إليه، و`generateForCohort` تعمل آليًّا).
--
-- فعرضٌ لم يُقبَل كان سيُعلَن مدرّبًا ويُصرف له.
CREATE TABLE "TrainerAssignmentOffer" (
    "id"               UUID NOT NULL,
    "profileId"        UUID NOT NULL,
    "courseId"         TEXT NOT NULL,
    "cohortId"         UUID,
    "contractId"       UUID,
    "status"           TEXT NOT NULL DEFAULT 'offered',
    "sessionsCount"    INTEGER,
    "startsAt"         TIMESTAMP(3),
    "feeNoteAr"        TEXT,
    "noteAr"           TEXT,
    "expiresAt"        TIMESTAMP(3) NOT NULL,
    "offeredBy"        UUID,
    "offeredAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt"      TIMESTAMP(3),
    "declineReasonAr"  TEXT,
    "withdrawnBy"      UUID,
    "withdrawReasonAr" TEXT,
    "prepDays"         INTEGER NOT NULL DEFAULT 5,
    "prepDueAt"        TIMESTAMP(3),
    "prepConfirmedAt"  TIMESTAMP(3),
    "prepRemindedAt"   TIMESTAMP(3),
    "prepLapsedAt"     TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerAssignmentOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainerAssignmentOffer_profileId_status_idx"  ON "TrainerAssignmentOffer"("profileId", "status");
CREATE INDEX "TrainerAssignmentOffer_status_expiresAt_idx"  ON "TrainerAssignmentOffer"("status", "expiresAt");
CREATE INDEX "TrainerAssignmentOffer_cohortId_idx"          ON "TrainerAssignmentOffer"("cohortId");
CREATE INDEX "TrainerAssignmentOffer_contractId_idx"        ON "TrainerAssignmentOffer"("contractId");

-- وعرضٌ مفتوحٌ واحدٌ لكلّ مدرّبٍ في الشعبة الواحدة: نقرتان متزامنتان لا
-- تُنتجان عرضَين يقبلهما فيصير ارتباطان لشيءٍ واحد.
CREATE UNIQUE INDEX "TrainerAssignmentOffer_one_open_per_cohort"
  ON "TrainerAssignmentOffer"("profileId", "cohortId")
  WHERE "status" = 'offered' AND "cohortId" IS NOT NULL;

ALTER TABLE "TrainerAssignmentOffer"
  ADD CONSTRAINT "TrainerAssignmentOffer_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TrainerAssignmentOffer_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TrainerAssignmentOffer_cohortId_fkey"
  FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "TrainerAssignmentOffer_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "TrainerContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- قيودُ الحالات مولَّدةٌ بـ`npx tsx scripts/status-checks.ts` لا مكتوبةٌ باليد
ALTER TABLE "TrainerContract" DROP CONSTRAINT IF EXISTS "TrainerContract_status_allowed";
ALTER TABLE "TrainerContract" ADD CONSTRAINT "TrainerContract_status_allowed" CHECK ("status" IN ('draft', 'sent', 'declined', 'revoked', 'signed', 'countersigned', 'expired', 'terminated'));

ALTER TABLE "TrainerAssignmentOffer" DROP CONSTRAINT IF EXISTS "TrainerAssignmentOffer_status_allowed";
ALTER TABLE "TrainerAssignmentOffer" ADD CONSTRAINT "TrainerAssignmentOffer_status_allowed" CHECK ("status" IN ('offered', 'accepted', 'declined', 'lapsed', 'withdrawn'));

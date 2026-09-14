-- رحيلُ مدرّب: بديلٌ أوّلا، ونقلٌ ثانيا، والاختيارُ لصاحبه ثالثا (ن-٩ · ن-١٠)
--
-- ═══ الفرضيّة ═══
--
-- البرمجيّةُ تسجّل التزاما ولا تمنع إنسانا من الرحيل. فالتصميمُ يفترض أنّ
-- الرحيلَ يقع ويجعل التسليمَ لطيفا — لا يدّعي منعَه.
--
-- ═══ ولمَ جدولان لا عمودٌ على الشعبة ═══
--
-- «يريدها أن تكون شيئا واحدا يُتتبَّع لا ذاكرةَ إداريّ: قائمةُ شعبٍ متأثّرةٍ
-- بكلّ متعلّمٍ مسجَّلٍ فيها، يُحلّ كلٌّ منهم وحدَه، ولا تُغلق الحالةُ واسمٌ
-- واحدٌ معلَّق». وعمودٌ على الشعبة يحلّ الشعبةَ كتلةً — والحلُّ فرديّ: هذا
-- يُسنَد إليه بديلٌ، وذاك يُنقَل، وثالثٌ يختار مالَه.
--
-- ═══ وقاعدةُ السمعة تسكن عمودا ═══
--
-- `notifiedAt` لا تُكتب وحالُ الصفّ `pending`: «لا ينبغي أن يقرأ متعلّمٌ
-- «رحل مدرّبُك» بلا أن يكون البديلُ في الجملة نفسِها». والشرطُ في الخدمة
-- ويحرسه اختبار — فالعمودُ وحدَه لا يمنع، لكنّه يجعل المنعَ قابلا للقياس.

CREATE TABLE "TrainerDeparture" (
  "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "profileId" UUID         NOT NULL,
  "reasonAr"  TEXT         NOT NULL,
  "openedBy"  UUID         NOT NULL,
  "openedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt"  TIMESTAMP(3),
  "closedBy"  UUID,
  CONSTRAINT "TrainerDeparture_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainerDeparture_closedAt_openedAt_idx" ON "TrainerDeparture"("closedAt", "openedAt");

ALTER TABLE "TrainerDeparture" ADD CONSTRAINT "TrainerDeparture_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DepartureCase" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "departureId"     UUID         NOT NULL,
  "enrollmentId"    UUID         NOT NULL,
  "cohortId"        UUID         NOT NULL,
  "outcome"         TEXT         NOT NULL DEFAULT 'pending',
  "notifiedAt"      TIMESTAMP(3),
  "choiceOfferedAt" TIMESTAMP(3),
  "learnerChoice"   TEXT,
  "chosenAt"        TIMESTAMP(3),
  "resolvedBy"      UUID,
  "resolvedAt"      TIMESTAMP(3),
  "noteAr"          TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DepartureCase_pkey" PRIMARY KEY ("id")
);

-- متعلّمٌ واحدٌ لا يُفتح له صفّان في رحيلٍ واحد
CREATE UNIQUE INDEX "DepartureCase_departureId_enrollmentId_key"
  ON "DepartureCase"("departureId", "enrollmentId");
CREATE INDEX "DepartureCase_departureId_outcome_idx" ON "DepartureCase"("departureId", "outcome");

ALTER TABLE "DepartureCase" ADD CONSTRAINT "DepartureCase_departureId_fkey"
  FOREIGN KEY ("departureId") REFERENCES "TrainerDeparture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartureCase" ADD CONSTRAINT "DepartureCase_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartureCase" ADD CONSTRAINT "DepartureCase_cohortId_fkey"
  FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

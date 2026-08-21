-- القياس البعديّ للمهارة بعد إتمام الدورة (البند ح-٧)
-- إضافي بالكامل: جدول جديد لا يمس جدولا قائما، فآمن على قاعدة حيّة.
CREATE TABLE "SkillRemeasure" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "courseId" TEXT NOT NULL,
    "skillSlug" TEXT NOT NULL,
    "beforeLevel" INTEGER,
    "afterLevel" INTEGER NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillRemeasure_pkey" PRIMARY KEY ("id")
);

-- القياس مرة واحدة لكل مهارة في كل تسجيل — الفرق سجل لا مقبض
CREATE UNIQUE INDEX "SkillRemeasure_enrollmentId_skillSlug_key" ON "SkillRemeasure"("enrollmentId", "skillSlug");
CREATE INDEX "SkillRemeasure_userId_measuredAt_idx" ON "SkillRemeasure"("userId", "measuredAt");

ALTER TABLE "SkillRemeasure" ADD CONSTRAINT "SkillRemeasure_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillRemeasure" ADD CONSTRAINT "SkillRemeasure_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

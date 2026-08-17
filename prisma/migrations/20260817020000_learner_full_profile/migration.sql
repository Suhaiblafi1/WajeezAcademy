-- توسيع ملف المتعلم: بيانات شخصية وتعليمية ومهنية اختيارية يملؤها الطالب من حسابه
ALTER TABLE "LearnerProfile"
  ADD COLUMN "avatarUrl"       TEXT,
  ADD COLUMN "phone"           TEXT,
  ADD COLUMN "country"         TEXT,
  ADD COLUMN "city"            TEXT,
  ADD COLUMN "birthDate"       TIMESTAMP(3),
  ADD COLUMN "gender"          TEXT,
  ADD COLUMN "education"       TEXT,
  ADD COLUMN "university"      TEXT,
  ADD COLUMN "major"           TEXT,
  ADD COLUMN "jobTitle"        TEXT,
  ADD COLUMN "company"         TEXT,
  ADD COLUMN "experienceYears" TEXT,
  ADD COLUMN "careerGoal"      TEXT,
  ADD COLUMN "interests"       JSONB,
  ADD COLUMN "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

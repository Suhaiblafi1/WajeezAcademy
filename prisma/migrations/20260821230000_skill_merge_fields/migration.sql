-- ج-٢: حقول الدمج والتفعيل على المهارة — تحتاجها طبقات المهارات المولّدة
-- وقت النشر (كانت تُقرأ من skills.v1.ar.json وحده).
ALTER TABLE "Skill" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Skill" ADD COLUMN "mergedInto" TEXT;
ALTER TABLE "Skill" ADD COLUMN "mergeDate" TEXT;

-- ج-١: مجالات المسار صفوفا تُنشر داخل لقطة الكتالوج
-- بدلا من استيرادها وقت البناء من pathway-domains.v2.json وحده.
CREATE TABLE "PathwayDomain" (
    "pathwayId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PathwayDomain_pkey" PRIMARY KEY ("pathwayId","domainId")
);

CREATE INDEX "PathwayDomain_domainId_idx" ON "PathwayDomain"("domainId");

ALTER TABLE "PathwayDomain" ADD CONSTRAINT "PathwayDomain_pathwayId_fkey"
    FOREIGN KEY ("pathwayId") REFERENCES "Pathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ملفُّ المستشار: نسبةُ العمولة تُكتب لا تُتذكَّر.
CREATE TABLE "AdvisorProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "commissionPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "notesAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdvisorProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdvisorProfile_userId_key" ON "AdvisorProfile"("userId");

ALTER TABLE "AdvisorProfile" ADD CONSTRAINT "AdvisorProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

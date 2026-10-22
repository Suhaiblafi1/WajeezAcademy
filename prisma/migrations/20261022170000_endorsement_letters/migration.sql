-- خطابُ توصيةٍ من الأكاديمية يُستحقّ مع الشهادة (٢٢ أكتوبر ٢٠٢٦)
CREATE TABLE "EndorsementLetter" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "certificateId" UUID NOT NULL,
    "attendancePct" INTEGER NOT NULL,
    "tasksDone" INTEGER NOT NULL,
    "tasksTotal" INTEGER NOT NULL,
    "skills" TEXT[],
    "totalHours" INTEGER,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EndorsementLetter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EndorsementLetter_number_key" ON "EndorsementLetter"("number");
CREATE UNIQUE INDEX "EndorsementLetter_certificateId_key" ON "EndorsementLetter"("certificateId");

ALTER TABLE "EndorsementLetter" ADD CONSTRAINT "EndorsementLetter_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

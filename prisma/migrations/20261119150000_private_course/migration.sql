-- ═══ دورةُ صاحب المنصّة الخاصّة (١٩ نوفمبر ٢٠٢٦) ═══
--
-- قرارُه: «خانةٌ داخل موقع الأكاديميّة كشيءٍ منفصل فقط لأستفيد من السيرفر لشيءٍ شخصيٍّ لي». جدولان لا يتّصلان
-- بشيءٍ من جداول الأكاديميّة، ولا يقرؤهما إلّا هو. والصفحةُ `/ai-jobs` واللوحةُ `/private`.

CREATE TABLE "PrivateCourse" (
    "slug" TEXT NOT NULL,
    "open" BOOLEAN NOT NULL DEFAULT true,
    "zoom" JSONB NOT NULL DEFAULT '{}',
    "fileKey" TEXT,
    "fileName" TEXT,
    "fileMime" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateCourse_pkey" PRIMARY KEY ("slug")
);

CREATE TABLE "PrivateRegistration" (
    "id" UUID NOT NULL,
    "courseSlug" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneCountry" TEXT NOT NULL,
    "note" TEXT,
    "proofKey" TEXT NOT NULL,
    "proofName" TEXT NOT NULL,
    "proofMime" TEXT NOT NULL,
    "proofSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "mailSentAt" TIMESTAMP(3),
    "mailZoomUrl" TEXT,
    "mailError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivateRegistration_courseSlug_email_key" ON "PrivateRegistration"("courseSlug", "email");
CREATE INDEX "PrivateRegistration_courseSlug_status_idx" ON "PrivateRegistration"("courseSlug", "status");

ALTER TABLE "PrivateRegistration" ADD CONSTRAINT "PrivateRegistration_courseSlug_fkey"
    FOREIGN KEY ("courseSlug") REFERENCES "PrivateCourse"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- قيدُ الحالة من تعليق المخطّط (`scripts/status-checks.ts`)
ALTER TABLE "PrivateRegistration" DROP CONSTRAINT IF EXISTS "PrivateRegistration_status_allowed";
ALTER TABLE "PrivateRegistration" ADD CONSTRAINT "PrivateRegistration_status_allowed" CHECK ("status" IN ('pending', 'confirmed', 'rejected'));

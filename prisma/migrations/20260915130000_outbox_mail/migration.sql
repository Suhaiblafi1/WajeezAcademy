-- ي-٦: طابورُ البريد الخارج — الجدولُ الوحيدُ الذي يبقى بعد من يُخبِره.
--
-- `Notification` معلَّقٌ بصاحبه بـ`onDelete: Cascade`، ورسالةُ المحو تخرج إلى
-- من يُمحى صفُّه بعد ثانية. فلا علاقةَ بمستخدِمٍ هنا بقصد.

CREATE TABLE "OutboxMail" (
    "id" UUID NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT,
    "html" TEXT,
    "purpose" TEXT,
    "batchId" UUID,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "OutboxMail_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutboxMail_status_createdAt_idx" ON "OutboxMail"("status", "createdAt");
CREATE INDEX "OutboxMail_batchId_idx" ON "OutboxMail"("batchId");

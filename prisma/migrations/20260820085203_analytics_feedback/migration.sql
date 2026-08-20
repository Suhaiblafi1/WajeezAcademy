-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "meta" JSONB,
    "anonId" TEXT,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticFeedback" (
    "id" UUID NOT NULL,
    "sessionId" TEXT NOT NULL,
    "pathwayId" TEXT,
    "verdict" TEXT NOT NULL,
    "note" TEXT,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_event_createdAt_idx" ON "AnalyticsEvent"("event", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_anonId_idx" ON "AnalyticsEvent"("anonId");

-- CreateIndex
CREATE INDEX "DiagnosticFeedback_sessionId_idx" ON "DiagnosticFeedback"("sessionId");

-- CreateIndex
CREATE INDEX "DiagnosticFeedback_createdAt_idx" ON "DiagnosticFeedback"("createdAt");

-- CreateTable
CREATE TABLE "GrantVisit" (
    "id" UUID NOT NULL,
    "campaign" TEXT NOT NULL,
    "visitorId" UUID NOT NULL,
    "pageTouch" JSONB,
    "firstTouch" JSONB,
    "influencerCode" TEXT,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visits" INTEGER NOT NULL DEFAULT 1,
    "leadId" UUID,

    CONSTRAINT "GrantVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GrantVisit_campaign_firstAt_idx" ON "GrantVisit"("campaign", "firstAt");

-- CreateIndex
CREATE INDEX "GrantVisit_leadId_idx" ON "GrantVisit"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "GrantVisit_campaign_visitorId_key" ON "GrantVisit"("campaign", "visitorId");

-- AddForeignKey
ALTER TABLE "GrantVisit" ADD CONSTRAINT "GrantVisit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "GrantPathway" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "titleAr" TEXT NOT NULL,
    "blurbAr" TEXT,
    "courseIds" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrantPathway_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GrantPathway_campaignId_sortOrder_idx" ON "GrantPathway"("campaignId", "sortOrder");

-- AddForeignKey
ALTER TABLE "GrantPathway" ADD CONSTRAINT "GrantPathway_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "GrantCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;


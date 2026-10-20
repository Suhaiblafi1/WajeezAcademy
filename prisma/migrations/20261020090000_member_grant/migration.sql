-- CreateTable
CREATE TABLE "GrantCampaign" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "percentOff" INTEGER NOT NULL DEFAULT 60,
    "maxCodes" INTEGER,
    "issuedCount" INTEGER NOT NULL DEFAULT 0,
    "closesAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrantCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantCode" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "couponId" UUID NOT NULL,
    "leadId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrantCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GrantCampaign_slug_key" ON "GrantCampaign"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GrantCode_couponId_key" ON "GrantCode"("couponId");

-- CreateIndex
CREATE UNIQUE INDEX "GrantCode_leadId_key" ON "GrantCode"("leadId");

-- CreateIndex
CREATE INDEX "GrantCode_campaignId_createdAt_idx" ON "GrantCode"("campaignId", "createdAt");

-- AddForeignKey
ALTER TABLE "GrantCode" ADD CONSTRAINT "GrantCode_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "GrantCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantCode" ADD CONSTRAINT "GrantCode_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantCode" ADD CONSTRAINT "GrantCode_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- النسبةُ بين واحدٍ ومئة، والمُعطى لا يتجاوز العدد — فلا تُنقَص الكمّيّةُ تحت ما أُعطي
ALTER TABLE "GrantCampaign" ADD CONSTRAINT "GrantCampaign_percent_range" CHECK ("percentOff" BETWEEN 1 AND 100);
ALTER TABLE "GrantCampaign" ADD CONSTRAINT "GrantCampaign_within_max" CHECK ("maxCodes" IS NULL OR "issuedCount" <= "maxCodes");

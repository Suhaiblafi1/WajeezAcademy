-- كشوفُ عمولة المستشار الشهريّة (١٩ أكتوبر ٢٠٢٦) — والعلّةُ في `server/services/advisor-payout.service.ts`.

-- CreateTable
CREATE TABLE "AdvisorPayout" (
    "id" UUID NOT NULL,
    "advisorId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "commissionPct" DECIMAL(5,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "paidBy" UUID,
    "paidAt" TIMESTAMP(3),
    "paidRefAr" TEXT,
    "cancelReasonAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorPayoutItem" (
    "id" UUID NOT NULL,
    "payoutId" UUID NOT NULL,
    "advisorId" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'commission',
    "orderId" UUID NOT NULL,
    "refundId" UUID,
    "base" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "AdvisorPayoutItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvisorPayout_advisorId_period_idx" ON "AdvisorPayout"("advisorId", "period");

-- CreateIndex
CREATE INDEX "AdvisorPayout_status_createdAt_idx" ON "AdvisorPayout"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdvisorPayoutItem_payoutId_idx" ON "AdvisorPayoutItem"("payoutId");

-- CreateIndex
CREATE INDEX "AdvisorPayoutItem_advisorId_orderId_idx" ON "AdvisorPayoutItem"("advisorId", "orderId");

-- AddForeignKey
ALTER TABLE "AdvisorPayout" ADD CONSTRAINT "AdvisorPayout_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorPayoutItem" ADD CONSTRAINT "AdvisorPayoutItem_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "AdvisorPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- كشفٌ حيٌّ واحدٌ للمستشار في الشهر — والملغى لا يمنع أن يُعاد
CREATE UNIQUE INDEX "AdvisorPayout_one_live_per_period"
  ON "AdvisorPayout"("advisorId", "period") WHERE "status" <> 'cancelled';

-- ولا تُعدّ دفعةٌ في كشفين، ولا استردادٌ — وبندُ الكشف الملغى يُفرَج عنه
CREATE UNIQUE INDEX "AdvisorPayoutItem_commission_once"
  ON "AdvisorPayoutItem"("advisorId", "orderId") WHERE "kind" = 'commission' AND "voidedAt" IS NULL;
CREATE UNIQUE INDEX "AdvisorPayoutItem_refund_once"
  ON "AdvisorPayoutItem"("advisorId", "refundId") WHERE "kind" = 'refund' AND "voidedAt" IS NULL;

-- قيودُ الحالات مولَّدةٌ بـ`scripts/status-checks.ts` لا مكتوبةٌ باليد
ALTER TABLE "AdvisorPayout" DROP CONSTRAINT IF EXISTS "AdvisorPayout_status_allowed";
ALTER TABLE "AdvisorPayout" ADD CONSTRAINT "AdvisorPayout_status_allowed" CHECK ("status" IN ('pending', 'approved', 'paid', 'cancelled'));

ALTER TABLE "AdvisorPayoutItem" DROP CONSTRAINT IF EXISTS "AdvisorPayoutItem_kind_allowed";
ALTER TABLE "AdvisorPayoutItem" ADD CONSTRAINT "AdvisorPayoutItem_kind_allowed" CHECK ("kind" IN ('commission', 'refund'));

-- خصمُ المدرّب — يصدره من عنده لشخصٍ يسمّيه، ويُحسم من مستحقّاته لا من إيرادنا.
--
-- قرارُ صاحب المنصّة (٢١ سبتمبر ٢٠٢٦)، وهو في العقد بندان: 4-9 (خصومُ
-- الأكاديميّة لا تمسّ أتعابَه) و4-10 (خصمُه هو يُحسم منه).
--
-- إضافيّةٌ كلُّها: جدولٌ جديدٌ لا غير. ولا عمودَ يُضاف إلى `Coupon` — العلاقةُ
-- واحدٌ لواحدٍ محمولةٌ على هذا الطرف، فلا يُقفَل جدولُ الكوبونات الحيُّ.

CREATE TABLE "TrainerIssuedDiscount" (
    "id"            UUID           NOT NULL,
    "profileId"     UUID           NOT NULL,
    "couponId"      UUID           NOT NULL,
    "status"        TEXT           NOT NULL DEFAULT 'live',
    "amount"        DECIMAL(10, 2) NOT NULL,
    "currency"      TEXT           NOT NULL DEFAULT 'USD',
    "forWhomAr"     TEXT           NOT NULL,
    "noteAr"        TEXT,
    "expiresAt"     TIMESTAMP(3),
    "usedAt"        TIMESTAMP(3),
    "usedOrderId"   UUID,
    "revokedAt"     TIMESTAMP(3),
    "settledItemId" UUID,
    "settledAt"     TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerIssuedDiscount_pkey" PRIMARY KEY ("id")
);

-- كوبونٌ واحدٌ لخصمٍ واحد: الكوبونُ يفعل الخصمَ في السلّة، والصفُّ يقول من
-- يتحمّله. ولو تعدّد لصار مبلغٌ واحدٌ يُحسم من مدرّبَين.
CREATE UNIQUE INDEX "TrainerIssuedDiscount_couponId_key" ON "TrainerIssuedDiscount"("couponId");

CREATE INDEX "TrainerIssuedDiscount_profileId_status_idx"
  ON "TrainerIssuedDiscount"("profileId", "status");

ALTER TABLE "TrainerIssuedDiscount" ADD CONSTRAINT "TrainerIssuedDiscount_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainerIssuedDiscount" ADD CONSTRAINT "TrainerIssuedDiscount_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- والمبلغُ موجبٌ دائما: السالبُ هنا يقلب الحسمَ زيادةً في الكشف. والبندُ
-- السالبُ في `TrainerPayoutItem` يُشتقّ من هذا الموجب عند التسوية.
ALTER TABLE "TrainerIssuedDiscount" ADD CONSTRAINT "TrainerIssuedDiscount_amount_positive"
  CHECK ("amount" > 0);

-- قيودُ الحالات مولَّدةٌ بـ`scripts/status-checks.ts` لا مكتوبةٌ باليد
ALTER TABLE "TrainerIssuedDiscount" DROP CONSTRAINT IF EXISTS "TrainerIssuedDiscount_status_allowed";
ALTER TABLE "TrainerIssuedDiscount" ADD CONSTRAINT "TrainerIssuedDiscount_status_allowed" CHECK ("status" IN ('live', 'used', 'settled', 'revoked'));

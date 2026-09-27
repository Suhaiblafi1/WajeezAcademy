-- كودُ المدرّب بالنسبة، ودفترُ استعماله (المرحلة ٤أ).
--
-- قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): الخصمُ الذي يصدره المدرّبُ كودٌ بنسبةٍ
-- لا مبلغ، على دوراته وحدَها، وسقفُه ٣٠٪ — ويُحسم ما منحه من مستحقّاته.
--
-- إضافيّةٌ كلُّها: جدولان جديدان، وقيمةٌ جديدةٌ في قيد حالة الخصم القديم.
-- ولا عمودَ يُضاف إلى `Coupon` ولا `Order`: العلاقتان محمولتان على هذا الطرف،
-- فلا يُقفَل جدولٌ حيٌّ من جداول المال.

CREATE TABLE "TrainerCode" (
    "id"         UUID         NOT NULL,
    "profileId"  UUID         NOT NULL,
    "couponId"   UUID         NOT NULL,
    "percentOff" INTEGER      NOT NULL,
    "status"     TEXT         NOT NULL DEFAULT 'live',
    "labelAr"    TEXT         NOT NULL,
    "pausedAt"   TIMESTAMP(3),
    "revokedAt"  TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerCode_pkey" PRIMARY KEY ("id")
);

-- كوبونٌ واحدٌ لكودٍ واحد: الكوبونُ يفعل الخصمَ في السلّة، والصفُّ يقول من
-- يتحمّله. ولو تعدّد لصار خصمٌ واحدٌ يُحسم من مدرّبَين.
CREATE UNIQUE INDEX "TrainerCode_couponId_key" ON "TrainerCode"("couponId");
CREATE INDEX "TrainerCode_profileId_status_idx" ON "TrainerCode"("profileId", "status");

ALTER TABLE "TrainerCode" ADD CONSTRAINT "TrainerCode_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainerCode" ADD CONSTRAINT "TrainerCode_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══ والسقفُ في القاعدة لا في الشاشة وحدَها ═══
--
-- ثلاثون بالمئة سقفٌ في العقد (البند 4-10) على مالٍ يُحسم من إنسان. والتسعيرُ
-- يقرأ النسبةَ من هذا العمود لا من الكوبون، فالقيدُ هنا هو ما يمنع حسما
-- فوق السقف مهما جاء من بابٍ غيرِ الشاشة.
ALTER TABLE "TrainerCode" ADD CONSTRAINT "TrainerCode_percent_range"
  CHECK ("percentOff" BETWEEN 1 AND 30);

CREATE TABLE "TrainerCodeRedemption" (
    "id"         UUID           NOT NULL,
    "codeId"     UUID           NOT NULL,
    "profileId"  UUID           NOT NULL,
    "orderId"    UUID           NOT NULL,
    "userId"     UUID           NOT NULL,
    "status"     TEXT           NOT NULL DEFAULT 'held',
    "amount"     DECIMAL(10, 2) NOT NULL,
    "currency"   TEXT           NOT NULL DEFAULT 'USD',
    "owed"       DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "pending"    DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt"     TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "TrainerCodeRedemption_pkey" PRIMARY KEY ("id")
);

-- كودٌ واحدٌ للطلب (`Order.couponId`) — فاستعمالٌ واحدٌ للطلب
CREATE UNIQUE INDEX "TrainerCodeRedemption_orderId_key" ON "TrainerCodeRedemption"("orderId");
CREATE INDEX "TrainerCodeRedemption_profileId_status_idx" ON "TrainerCodeRedemption"("profileId", "status");
CREATE INDEX "TrainerCodeRedemption_codeId_userId_idx" ON "TrainerCodeRedemption"("codeId", "userId");

ALTER TABLE "TrainerCodeRedemption" ADD CONSTRAINT "TrainerCodeRedemption_codeId_fkey"
  FOREIGN KEY ("codeId") REFERENCES "TrainerCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainerCodeRedemption" ADD CONSTRAINT "TrainerCodeRedemption_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainerCodeRedemption" ADD CONSTRAINT "TrainerCodeRedemption_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══ مرّةً واحدةً لكلّ متعلّم — في القاعدة، لا بفحصٍ يسبق الكتابة ═══
--
-- الفحصُ قبل الطلب يُجيب المتعلّمَ بجملةٍ مفهومة، ولا يمنع نقرتين متزامنتين:
-- كلتاهما تقرأ «لم يُستعمَل» ثمّ تكتب. والقيدُ يردّ الثانية.
--
-- والمعتبَرُ المحجوزُ والمدفوعُ وحدَهما: طلبٌ هُجر فأُفرج عنه لم يستعمل الكود،
-- وشراءٌ رُدّ ثمنُه كلُّه لم يبقَ منه شيء — فلصاحبه أن يستعمله من جديد.
CREATE UNIQUE INDEX "TrainerCodeRedemption_once_per_learner"
  ON "TrainerCodeRedemption"("codeId", "userId")
  WHERE "status" IN ('held', 'paid');

-- والمبلغُ موجبٌ دائما، وما عليه منه لا يزيد عليه ولا ينزل تحت الصفر. أمّا
-- `pending` فسالبُه معنًى لا عطب: حُسم ثمّ رُدّ الثمنُ، فيُعاد إليه.
ALTER TABLE "TrainerCodeRedemption" ADD CONSTRAINT "TrainerCodeRedemption_amount_positive"
  CHECK ("amount" > 0);
ALTER TABLE "TrainerCodeRedemption" ADD CONSTRAINT "TrainerCodeRedemption_owed_range"
  CHECK ("owed" >= 0 AND "owed" <= "amount");

-- قيودُ الحالات مولَّدةٌ بـ`npx tsx scripts/status-checks.ts` لا مكتوبةٌ باليد
ALTER TABLE "TrainerIssuedDiscount" DROP CONSTRAINT IF EXISTS "TrainerIssuedDiscount_status_allowed";
ALTER TABLE "TrainerIssuedDiscount" ADD CONSTRAINT "TrainerIssuedDiscount_status_allowed" CHECK ("status" IN ('live', 'used', 'settled', 'revoked', 'refunded'));
ALTER TABLE "TrainerCode" DROP CONSTRAINT IF EXISTS "TrainerCode_status_allowed";
ALTER TABLE "TrainerCode" ADD CONSTRAINT "TrainerCode_status_allowed" CHECK ("status" IN ('live', 'paused', 'revoked'));
ALTER TABLE "TrainerCodeRedemption" DROP CONSTRAINT IF EXISTS "TrainerCodeRedemption_status_allowed";
ALTER TABLE "TrainerCodeRedemption" ADD CONSTRAINT "TrainerCodeRedemption_status_allowed" CHECK ("status" IN ('held', 'paid', 'released', 'refunded'));

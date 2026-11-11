-- ═══ من ردّ «توقف» على واتساب (١١ نوفمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: «سجّل من يردّ "توقف" على واتساب في المنصة». بذيل رقمه، فيُعرف في قائمة من عبّأ النموذج وفي حالة
-- المستشار، ويُخفى زرُّ واتساب عنه.

CREATE TABLE "WhatsAppOptOut" (
    "tail" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "WhatsAppOptOut_pkey" PRIMARY KEY ("tail")
);

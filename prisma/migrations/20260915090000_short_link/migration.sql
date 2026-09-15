-- ط-٣: رابطٌ قصيرٌ يُقرأ تحت زرِّ البريد ويُنسخ باليد.
-- والوجهةُ مسارٌ داخليٌّ لا عنوانٌ مطلق — الشرطُ في `src/application/links/short-link.ts`.

CREATE TABLE "ShortLink" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "purpose" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShortLink_code_key" ON "ShortLink"("code");

-- فتحاتُ الروابط القصيرة — كم فُتح رابطُ المدرّب ومن أيّ منصّة (٢٧ أكتوبر ٢٠٢٦).
--
-- اقترح Claude «عدّادا لروابط المدرّب»، فقال صاحبُ المنصّة: «كلّهم». والعلّةُ في `server/services/link-opens.ts`.

CREATE TABLE "ShortLinkOpen" (
    "id" UUID NOT NULL,
    "linkId" UUID NOT NULL,
    "via" TEXT,
    "visitor" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShortLinkOpen_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShortLinkOpen_linkId_at_idx" ON "ShortLinkOpen"("linkId", "at");

ALTER TABLE "ShortLinkOpen" ADD CONSTRAINT "ShortLinkOpen_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

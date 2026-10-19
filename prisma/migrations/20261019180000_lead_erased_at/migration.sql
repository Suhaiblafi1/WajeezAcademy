-- بياناتُ من لم يسجّل تُمحى بعد ستة أشهر بلا نشاط (١٩ أكتوبر ٢٠٢٦) — والعلّةُ في `server/services/guest-erasure.service.ts`.

ALTER TABLE "Lead" ADD COLUMN "erasedAt" TIMESTAMP(3);

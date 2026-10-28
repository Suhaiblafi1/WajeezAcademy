-- كودُ المنحة يُستعمل في أكثر من شراء حتى يبلغ حدَّ دوراته (٢٨ أكتوبر ٢٠٢٦) — فلا حدَّ استعمالٍ على كوبونه،
-- والحدُّ عددُ الدورات في `grant.service.ts#coursesLeft`.
UPDATE "Coupon" SET "maxUses" = NULL WHERE "id" IN (SELECT "couponId" FROM "GrantCode");

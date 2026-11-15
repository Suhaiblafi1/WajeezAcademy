-- ═══ «بلاك فرايدي وجيز»: خصمٌ لكلّ مؤثّر، وكودٌ يتغيّر ورابطُه القديمُ يعمل (١٥ نوفمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: «use my link as مؤثر في الموقع واسمح لي تغيير الكود هناك وقيمه الخصم للمؤثر كلا على حدا»،
-- بسبعين بالمئة وكودِه `Suhaib`. فلكلّ مؤثّرٍ خصمٌ يأخذه متابعُه (فارغٌ بنسبة الحملة)، وأكوادُه السابقةُ تُقرأ كودَه.
-- وصفُّ الحملة نفسِها لا يُكتب هنا: يُنشأ موقوفا أوّلَ ما تُقرأ، كأخواتها (`GrantService.campaign`).

ALTER TABLE "Influencer" ADD COLUMN IF NOT EXISTS "percentOff" INTEGER;
ALTER TABLE "Influencer" ADD COLUMN IF NOT EXISTS "formerCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Influencer" DROP CONSTRAINT IF EXISTS "Influencer_percentOff_range";
ALTER TABLE "Influencer" ADD CONSTRAINT "Influencer_percentOff_range"
  CHECK ("percentOff" IS NULL OR ("percentOff" >= 0 AND "percentOff" <= 100));

-- ورابطُ صاحب المنصّة مؤثّرا: كودُه SUHAIB بسبعين وبلا عمولة، ويُربط حسابُه من الإدارة بعدُ — فلا بريدَ هنا.
-- ومرّةً واحدة: إن كان الكودُ لأحدٍ — حاليّا أو سابقا — لم يُكتب
INSERT INTO "Influencer" ("id", "nameAr", "code", "formerCodes", "commissionPercent", "percentOff", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'صهيب', 'SUHAIB', ARRAY[]::TEXT[], 0, 70, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "Influencer" WHERE "code" = 'SUHAIB' OR 'SUHAIB' = ANY("formerCodes")
);

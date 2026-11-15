-- ═══ رقمُ المؤثّر (١٥ نوفمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: «منحني فرصة تغيير اسم صاحب المنحة المؤثر وتغيير كل التفاصيل، إيميله، رقمه وإلى آخره».
-- وكان الرقمُ في طلب الانضمام وحدَه (`InfluencerApplication.phone`)، فلا رقمَ لمن أُضيف من الشاشة ولا يُغيَّر لمن قُبل.
-- فلكلّ مؤثّرٍ رقمُه، ويُملأ لمن قُبل طلبُه من آخر طلبٍ قُبل به: مفتاحُ الدولة ثمّ الرقم. ومن له رقمٌ لا يُمسّ.

ALTER TABLE "Influencer" ADD COLUMN IF NOT EXISTS "phone" TEXT;

UPDATE "Influencer" i
SET "phone" = a."full"
FROM (
  SELECT DISTINCT ON ("influencerId") "influencerId",
    btrim(concat_ws(' ', NULLIF(btrim("phoneCountryCode"), ''), NULLIF(btrim("phone"), ''))) AS "full"
  FROM "InfluencerApplication"
  WHERE "influencerId" IS NOT NULL AND NULLIF(btrim("phone"), '') IS NOT NULL
  ORDER BY "influencerId", "createdAt" DESC
) a
WHERE a."influencerId" = i."id" AND i."phone" IS NULL AND a."full" <> '';

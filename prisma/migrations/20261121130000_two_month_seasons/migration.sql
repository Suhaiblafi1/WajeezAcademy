-- ═══ شهران عملٌ وشهرٌ راحة (٢١ نوفمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: «يجب أن نبدأ الفصل القادم ... لنبتعد عن شهر رمضان»، و«اجعلها تبدأ من 1 أبريل إلى نهاية
-- مايو، شهرين فقط». فالمواسمُ أبريل–مايو ويوليو–أغسطس وأكتوبر–نوفمبر ويناير–فبراير، وأوّلُها ربيعُ ٢٠٢٧. والحسابُ
-- في `src/application/terms/season.ts`، وهذا ما يحتاجه الإنتاجُ يومَ القرار:
--
-- ① فصلُ ربيع ٢٠٢٧ يُنشأ «مخطَّطا» بحدوده المحسوبة — كما ينشئه زرُّ الإدارة (`TermService.create`) وكما ينشئه
--    `ensureTerm`: من ١ أبريل إلى ٣١ مايو. وما كان قائما لا يُمسّ.
INSERT INTO "Term" ("id", "year", "season", "titleAr", "startsOn", "endsOn", "status", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 2027, 'apr_may', 'موسم الربيع 2027', DATE '2027-04-01', DATE '2027-05-31', 'planned', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("year", "season") DO NOTHING;

-- ② وفصولُ التقويم القديم بعد آخر يناير ٢٠٢٧ (فبراير–أبريل ٢٠٢٧ وأخواتُه، بذرها ترحيلُ الفصول للسنة التالية) لم تعد في
--    التقويم — فما كان منها فارغا يُلغى بحالته («ملغى»، `lifecycle.ts`)، فلا يُعرض في «المواسم والتقويم» موسمان
--    باسم «موسم الربيع 2027». وشروطُه شروطُ الإلغاء والحذف بيد الإدارة وأشدّ: مخطَّطٌ لم يُفتح، ولم يُنشر تقويمُه،
--    ولا شعبةَ فيه ولا مسارَ مدرّب. وما فيه شيءٌ يبقى كما هو — قرارُه لصاحب المنصّة، لا لترحيل.
UPDATE "Term" t
SET "status" = 'cancelled', "updatedAt" = CURRENT_TIMESTAMP
WHERE t."season" IN ('nov_jan', 'feb_apr', 'may_jul', 'aug_oct')
  AND t."startsOn" >= DATE '2027-02-01'
  AND t."status" = 'planned'
  AND t."calendarPublishedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Cohort" c WHERE c."termId" = t."id")
  AND NOT EXISTS (SELECT 1 FROM "TrainerPath" p WHERE p."termId" = t."id");

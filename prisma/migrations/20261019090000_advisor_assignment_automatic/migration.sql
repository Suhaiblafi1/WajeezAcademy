-- الإسنادُ التلقائيّ يُعلَّم صراحةً — وعمولتُه لا تبدأ إلّا بأوّل تواصلٍ يسجّله المستشار (١٩ أكتوبر ٢٠٢٦).
-- والعلّةُ عند `attributedRevenue` في `server/services/advisor.service.ts`.

ALTER TABLE "AdvisorAssignment" ADD COLUMN "automatic" BOOLEAN NOT NULL DEFAULT false;

-- وما أسنده النظامُ منذ صار الإسنادُ تلقائيّا (#559، ١٩ أكتوبر ٢٠٢٦ صباحا) كان يُعرف بغياب
-- من أسنده وحدَه. وقبلها لا إسنادَ بلا فاعلٍ إلّا ما بذرته البيئاتُ التجريبيّة — فلا يُمسّ.
UPDATE "AdvisorAssignment" SET "automatic" = true
WHERE "assignedBy" IS NULL AND "assignedAt" >= TIMESTAMP '2026-10-19 06:00:00'; -- العمودُ بلا منطقة، وPrisma يكتبه بتوقيت UTC

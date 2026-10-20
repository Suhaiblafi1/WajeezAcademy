-- «اقتراحات المنحة» حُذفت بقرار صاحب المنصّة (٢٠ أكتوبر ٢٠٢٦): يرى صاحبُ المنحة دوراتٍ فقط.
-- DropForeignKey
ALTER TABLE "GrantPathway" DROP CONSTRAINT "GrantPathway_campaignId_fkey";

-- DropTable
DROP TABLE "GrantPathway";

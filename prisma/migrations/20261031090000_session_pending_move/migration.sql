-- لقاءٌ معتمَدٌ نُقل فعاد ينتظر الإدارة: موعدُه في تقاويمهم قبل النقل، ومن نقله ولماذا — فتقول دعوتُه حين يُعتمد
-- «كان … وصار …» وسببَه لا دعوةً جديدةً (٣١ أكتوبر ٢٠٢٦).

-- AlterTable
ALTER TABLE "CohortSession" ADD COLUMN     "movedFromAt" TIMESTAMP(3),
ADD COLUMN     "moveWhy" JSONB;

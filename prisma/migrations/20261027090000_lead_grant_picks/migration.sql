-- الدورات التي اختارها صاحب المنحة في صفحتها — كانت في متصفحه وحده، فلا يراها المستشار في ملفه (٢٧ أكتوبر ٢٠٢٦).
ALTER TABLE "Lead" ADD COLUMN     "grantPicks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "grantPicksAt" TIMESTAMP(3);

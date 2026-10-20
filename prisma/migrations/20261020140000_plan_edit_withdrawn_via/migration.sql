-- ما سحب بندَ التعديل: «اسحب ما لم يقرّر» (manual) أو رفعُ ملفٍّ مكانه (replace) أو «احذف المكرر» (dedupe).
-- و«أعد ما سحبته» يعيد آخرَ سحبٍ manual وحدَه. وما سُحب قبل هذا العمود يبقى فارغا فلا يعود.
-- AlterTable
ALTER TABLE "PlanEditSuggestion" ADD COLUMN     "withdrawnVia" TEXT;

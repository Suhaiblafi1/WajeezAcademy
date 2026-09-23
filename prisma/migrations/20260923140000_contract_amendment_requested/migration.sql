-- النهايةُ الثالثة: يطلب المدرّبُ تعديلا فلا يوقّع ولا يعتذر.
-- والعقدُ لا يُغلَق بها — الصفُّ باقٍ ينتظر نسخةً مصحّحة — لكنّ التوقيعَ يقف.
ALTER TABLE "TrainerContract"
  ADD COLUMN "amendmentRequestAr"   TEXT,
  ADD COLUMN "amendmentRequestedAt" TIMESTAMP(3);

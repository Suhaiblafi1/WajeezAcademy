-- نطاق الكتالوج صلاحية تُمنح بعد سجل مثبت (البند هـ-١)
-- إضافي بالكامل: عمودان يقبلان NULL — آمن على قاعدة حيّة.
ALTER TABLE "TrainerProfile" ADD COLUMN "catalogScopeGrantedAt" TIMESTAMP(3);
ALTER TABLE "TrainerProfile" ADD COLUMN "catalogScopeGrantedBy" UUID;

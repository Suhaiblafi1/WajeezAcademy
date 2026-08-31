-- حاكميّة تأليف الوحدات: من كتب، ومتى رُفع، ومن راجع وبأيّ ملاحظة.
-- تُسجَّل للحاكمية لا للعرض — المحتوى يُنشر باسم الأكاديمية لا باسم كاتبه.
ALTER TABLE "CourseModuleVersion" ADD COLUMN "createdBy" UUID;
ALTER TABLE "CourseModuleVersion" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "CourseModuleVersion" ADD COLUMN "reviewedBy" UUID;
ALTER TABLE "CourseModuleVersion" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "CourseModuleVersion" ADD COLUMN "reviewNoteAr" TEXT;

-- طابور المراجعة يُقرأ بالحالة، والمسوّدةُ الواحدة تُلتقط بها
CREATE INDEX "CourseModuleVersion_status_idx" ON "CourseModuleVersion"("status");

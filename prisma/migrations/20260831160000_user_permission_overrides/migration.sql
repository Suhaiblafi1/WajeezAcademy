-- استثناء الصلاحية لشخص بعينه: منحٌ زائد على دوره، أو منعٌ ينزعها منه وحده.
-- والمنع أعلى من المنح والدور معا — القرار في طبقة الحساب لا هنا.
CREATE TABLE "UserPermission" (
  "userId"        UUID NOT NULL,
  "permissionKey" TEXT NOT NULL,
  "effect"        TEXT NOT NULL,
  "reason"        TEXT NOT NULL,
  "grantedBy"     UUID,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("userId", "permissionKey")
);
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionKey_fkey"
  FOREIGN KEY ("permissionKey") REFERENCES "Permission"("key") ON DELETE CASCADE ON UPDATE CASCADE;

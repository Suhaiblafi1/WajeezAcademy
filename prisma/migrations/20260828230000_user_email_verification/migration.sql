-- توثيق بريد المستخدم (١هـ) — يحجب الشراء وسكّ الشهادة لا الدخول.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "User_emailVerifyTokenHash_key" ON "User"("emailVerifyTokenHash");

-- من وثّق بريده أصلا في مسار المدرب لا يُطالَب به مرة ثانية: الدليل قائم،
-- وإعادة الطلب عليه تُفقده الثقة بلا فائدة. ولا أحد سواه يُعتبر موثَّقا.
UPDATE "User" u
SET "emailVerifiedAt" = a."emailVerifiedAt"
FROM "TrainerApplication" a
WHERE lower(a."email") = lower(u."email")
  AND a."emailVerifiedAt" IS NOT NULL
  AND u."emailVerifiedAt" IS NULL;

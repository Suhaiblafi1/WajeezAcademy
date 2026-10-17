-- حسابُ التجربة — تعلّمه الإدارة فلا يُعدّ طلبُه في «من ينتظر دورة بلا شعبة» (١٧ أكتوبر ٢٠٢٦).
-- والعلّةُ في `src/application/admin/test-account.ts`.

ALTER TABLE "User" ADD COLUMN "isTestAccount" BOOLEAN NOT NULL DEFAULT false;

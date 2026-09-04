-- سقفُ الدخول على مستوى الشبكة (المهمّة ١٧) يعدُّ إخفاقاتِ عنوانٍ واحدٍ في
-- نافذةِ ربعِ ساعة. وبلا فهرسٍ على (ip, createdAt) يصير كلُّ دخولٍ مسحا كاملا
-- لجدول المحاولات — فالفهرسُ شرطُ السقف لا تحسينا له.
CREATE INDEX IF NOT EXISTS "LoginAttempt_ip_createdAt_idx" ON "LoginAttempt"("ip", "createdAt");

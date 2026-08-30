-- جمهور الإشعار — لأيّ بوابةٍ هو، لا لأيّ مستخدم.
--
-- كان الإشعار يحمل صاحبَه ولا يحمل بوابتَه، وجرسُ بوابة الطالب يعرض كلّ ما
-- لصاحب الحساب. فمن يحمل دورا إداريا يرى في جرس «تعلّمي» إشعارا نصّه «طلب
-- انضمام مدرب — بلا تحقق بريدي… راجعه بدليل أضعف من المعتاد»: شأنٌ إداريّ
-- في موضع المتعلّم، ولا علاقة له بتعلّمه.
--
-- والافتراضي 'learner': الإشعار للمتعلّم ما لم يُقل غير ذلك، فالسهو يُبقيه
-- حيث يراه صاحبه لا حيث يختفي.
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "audience" TEXT NOT NULL DEFAULT 'learner';

-- والقائم يُصنَّف بما يدلّ عليه مفتاح قالبه: كلّ ما بدأ بـadmin. شأنُ إدارة،
-- وكشفُ المستحقّات شأنُ المدرّب في بوابته لا في بوابة تعلُّمه.
UPDATE "Notification" SET "audience" = 'staff' WHERE "templateKey" LIKE 'admin.%';
UPDATE "Notification" SET "audience" = 'trainer' WHERE "templateKey" = 'trainer_payout';

CREATE INDEX IF NOT EXISTS "Notification_userId_audience_status_idx"
  ON "Notification" ("userId", "audience", "status");

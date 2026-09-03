-- وسيلةُ التواصل التي يختارها المتقدّم للاجتماع التعريفيّ.
--
-- كان الطلبُ يُرسَل ولا يُقال لصاحبه ماذا بعده، ولا يُسأل كيف يريد أن
-- نصلَ إليه: فيُتصل بمن لا يجيب المجهول، ويُراسَل من لا يفتح بريده.
-- القناةُ تُختار في آخر النموذج، والبريدُ البديل يُملأ حين تكون القناة
-- بريدا غير بريد الطلب.
ALTER TABLE "TrainerApplication" ADD COLUMN IF NOT EXISTS "contactChannel" TEXT;
ALTER TABLE "TrainerApplication" ADD COLUMN IF NOT EXISTS "contactAltEmail" TEXT;

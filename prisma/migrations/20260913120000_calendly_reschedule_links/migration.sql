-- روابطُ التعديل والإلغاء تصل مع كلّ مدعوٍّ من Calendly وكانت تُرمى.
-- وبقاؤها يُغني المتقدّمَ عن التنقيب في بريده حين يريد نقلَ موعده.
ALTER TABLE "TrainerInterview"
  ADD COLUMN "rescheduleUrl" TEXT,
  ADD COLUMN "cancelUrl" TEXT;

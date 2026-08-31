-- محتوى وثائق المتقدّمين في القاعدة لا على القرص.
-- الحقل يقبل NULL: الوثيقة تُسجَّل أولا ثم يُرفع محتواها برابط موقّع.
ALTER TABLE "TrainerApplicationDocument" ADD COLUMN "content" BYTEA;

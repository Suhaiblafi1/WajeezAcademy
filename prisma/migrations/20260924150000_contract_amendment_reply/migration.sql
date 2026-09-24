-- جوابُ الإدارة على طلب التعديل — كان الطلبُ يصل ولا يُردّ، فيقف العقدُ أبدا.
-- ويُحفَظ مع العقد لا في البريد وحدَه: المدرّبُ يرى لماذا بقي العرضُ كما هو
-- وهو أمام زرّ التوقيع.
ALTER TABLE "TrainerContract" ADD COLUMN "amendmentReplyAr" TEXT;
ALTER TABLE "TrainerContract" ADD COLUMN "amendmentRepliedAt" TIMESTAMP(3);
ALTER TABLE "TrainerContract" ADD COLUMN "amendmentRepliedBy" UUID;

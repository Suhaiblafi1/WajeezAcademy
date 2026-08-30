-- خطّة المتعلّم على طلب التسجيل: تجمع طلباتِ خطّةٍ واحدة في طلب شراء وفاتورة واحدة.
-- كانت تسويةُ الدفع تحوّل **أوّل** طلبٍ محجوز على الطلب فقط (findFirst)، فمن اشترى
-- خطّةً بأربع دورات ودفع مرّة واحدة كان يُسجَّل في واحدة ويبقى خارج الثلاث.
ALTER TABLE "EnrollmentRequest" ADD COLUMN "planId" UUID;
CREATE INDEX "EnrollmentRequest_planId_status_idx" ON "EnrollmentRequest"("planId", "status");

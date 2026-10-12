-- بريدُ من أراد دورةً لا شعبةَ مفتوحةً لها بعد (١٢ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: «أبلغني» لكلّ دورةٍ في صفحتها العامّة، لمن ليس له حساب. وكان
-- الإبلاغُ بالموسم وحدَه (`RegistrationInterest`) ولمن له خطّةٌ وحدَه (`LearnerPlanItem`)،
-- فالزائرُ الذي أراد دورةً بعينها لا بابَ له إلّا أن يتذكّرنا.
--
-- والمفتاحُ `(email, courseId)`: من أراد دورتين ينتظر كلّا منهما. ونصُّ الموافقة يُحفظ مع
-- الصفّ — رسالةٌ واحدةٌ عند فتح شعبةٍ لها، ولا شيء غيرها. ومنه يُقرأ الطلبُ على الدورات بلا
-- شعبة في لوحة الإدارة.

CREATE TABLE "CourseInterest" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "consentAr" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseInterest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseInterest_email_courseId_key" ON "CourseInterest"("email", "courseId");
CREATE INDEX "CourseInterest_courseId_notifiedAt_idx" ON "CourseInterest"("courseId", "notifiedAt");

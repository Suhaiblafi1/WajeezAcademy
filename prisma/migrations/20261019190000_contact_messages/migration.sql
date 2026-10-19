-- رسائلُ «تواصل معنا» من الموقع العامّ (١٩ أكتوبر ٢٠٢٦).
--
-- كان النموذجُ يحاكي الإرسال: يعرض رقما مرجعيّا ولا يصل أحدا — وسياسةُ الاسترداد تحيل إليه.
-- وخُيّر صاحبُ المنصّة فاختار أن يصير حقيقيّا: يُحفظ، ويصل بريدَ الأكاديميّة، ويظهر للفريق.
-- والعلّةُ في `server/services/contact.service.ts`.

CREATE TABLE "ContactMessage" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "entity" TEXT NOT NULL DEFAULT 'individual',
    "organization" TEXT,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "handledAt" TIMESTAMP(3),
    "handledBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactMessage_reference_key" ON "ContactMessage"("reference");

CREATE INDEX "ContactMessage_handledAt_createdAt_idx" ON "ContactMessage"("handledAt", "createdAt");

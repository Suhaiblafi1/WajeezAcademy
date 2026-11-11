-- ═══ إلغاءُ الاشتراك في رسائل التسويق (١١ نوفمبر ٢٠٢٦) ═══
--
-- قرارُ صاحب المنصّة: «أضف رابط إلغاء الاشتراك للبريد». فمن ضغطه لا تصله رسائلُ التسويق بعدُ (تذكيرُ المنحة، و«مددنا
-- منحتك»، ورسائلُ الإدارة لمن عبّأ النموذج)، ورسائلُ حسابه ودوراته باقية. والرابطُ يُكتب مع الرسالة في الطابور ليُرسَل
-- في رأس `List-Unsubscribe`.

CREATE TABLE "MailOptOut" (
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purpose" TEXT,

    CONSTRAINT "MailOptOut_pkey" PRIMARY KEY ("email")
);

ALTER TABLE "OutboxMail" ADD COLUMN "unsubscribeUrl" TEXT;

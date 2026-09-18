-- إيقافُ التسجيل حتّى يُفتح بابُ الموسم، وبريدُ من ينتظره.
--
-- قرارُ صاحب المنصّة (١٨ سبتمبر ٢٠٢٦): يُوقَف كلُّ تسجيلٍ الآن، ومن نقر
-- «ادفع» يُقال له إنّ البابَ لم يُفتح بعدُ ويُطلَب بريدُه ليُبلَّغ حين يُفتح.
--
-- والقفلُ صفٌّ في `SystemSetting` لا ثابتٌ في الشيفرة: يُفتح البابُ من شاشة
-- الفصول بلا نشرِ خادم — ويومَ يُفتح لا ننتظر بناءً ولا دمجا.
--
-- و`ON CONFLICT DO NOTHING` تُبقي ما ضُبط من الشاشة: من فتح البابَ ثمّ أُعيد
-- تشغيلُ الترحيلات لا يُغلَق بابُه من تحته.

INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
VALUES (
  'registration.season',
  '{"open": false, "seasonKey": "nov_jan", "seasonAr": "موسم الشتاء", "messageAr": "لم يفتح باب التسجيل لموسم الشتاء بعد"}'::jsonb,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;

-- بريدُ المنتظِر — بالموسم لا بالعنوان وحدَه: من انتظر الشتاء وأُبلغ به قد
-- ينتظر الربيعَ بعده، فلا يمنعه صفٌّ قديمٌ من انتظارٍ جديد.
CREATE TABLE "RegistrationInterest" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'buy',
    "consentAr" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationInterest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationInterest_email_seasonKey_key" ON "RegistrationInterest"("email", "seasonKey");
CREATE INDEX "RegistrationInterest_seasonKey_notifiedAt_idx" ON "RegistrationInterest"("seasonKey", "notifiedAt");

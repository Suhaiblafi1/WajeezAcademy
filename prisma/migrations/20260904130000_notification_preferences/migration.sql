-- تفضيلاتُ الإشعارات (المهمّة ٧٢): صفٌّ يُكتب عند المخالفة وحدَها، والغيابُ
-- يعني «مُفعَّل» — فحسابٌ لم يفتح الشاشةَ لا يتغيّر سلوكُه.
-- وحدُّ ما يُكتَم يُفرَض في الخادم لا هنا: `notify` يتجاهل تفضيلا يُسكِت
-- خبرا لا يجوز كتمُه (المال · الشهادات · عملُ الموظّف).
CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_userId_category_channel_key"
  ON "NotificationPreference"("userId", "category", "channel");
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- القناةُ محصورةٌ في ما تعرفه المنصّة — لا صفَّ بقناةٍ لا مزوّدَ لها
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_channel_allowed"
  CHECK ("channel" IN ('in_app', 'email'));

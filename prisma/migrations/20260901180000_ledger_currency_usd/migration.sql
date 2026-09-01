-- عملةُ الدفتر: الدولار — لا الدينار الأردنيّ.
--
-- كانت سبعةُ نماذج تفترض `JOD` افتراضا، منها مسلكُ المال كلُّه:
-- Cohort و Order و Invoice و Payment. والكتالوجُ مسعَّرٌ بالدولار مئةً
-- بالمئة، وحسابُ Stripe لدينا أمريكيٌّ لا يقبل `jod` أصلا (جُرّب فرُفض).
--
-- فأيُّ صفٍّ كان يُنشأ بلا عملةٍ صريحة يُولد بعملةٍ لا تُباع بها دورةٌ ولا
-- تُقبض بها بطاقة — بلا أن يُرمى خطأ: يُخزَّن، ويُعرض، ويُجمع مع غيره،
-- ويُكتشف عند أوّل شحنٍ يُرفض.
--
-- والافتراضُ وحدَه يتغيّر هنا. الصفوفُ القائمة تبقى بعملتها المخزَّنة عمدا:
-- فاتورةٌ صدرت بالدينار صدرت به، وتغييرُ حرفها بعد إصدارها تزويرٌ لا تصحيح.
-- وتصحيحُ ما بقي منها قرارٌ إداريّ يُتّخذ صفّا صفّا، لا ترحيلٌ أعمى.

ALTER TABLE "TrainerCompensationRule" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "TrainerPayout"           ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "Cohort"                  ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "SubscriptionPlan"        ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "Order"                   ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "Invoice"                 ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "Payment"                 ALTER COLUMN "currency" SET DEFAULT 'USD';

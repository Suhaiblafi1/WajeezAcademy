-- ═══ شهادةٌ فعّالةٌ واحدةٌ لكلّ تسجيل (٨ نوفمبر ٢٠٢٦) ═══
--
-- ضغطتان على «أصدر» معا كانتا تُصدران للتسجيل الواحد شهادتين فعّالتين. والإصدارُ صار بقفلٍ في الشيفرة
-- (`CertificateService.issueOnce`)، وهذا حارسُه في القاعدة: فهرسٌ فريدٌ على التسجيل للشهادات الفعّالة وحدَها — فالملغاةُ
-- تبقى أثرا ولا تمنع إصدارا جديدا.
--
-- ولا يُنشأ إن وُجد في القاعدة تسجيلٌ له شهادتان فعّالتان من قبل: إسقاطُ النشر كلِّه بفهرسٍ لم ينشأ أسوأُ من غيابه، وأيُّ
-- الشهادتين تُلغى قرارٌ بشريّ. فيُقال ذلك في سجلّ الترحيل، والقفلُ في الشيفرة يمنع الجديد على كلّ حال.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Certificate" WHERE "status" = 'active' GROUP BY "enrollmentId" HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'Certificate_one_active_per_enrollment لم يُنشأ: في القاعدة تسجيلٌ له شهادتان فعّالتان — تُلغى إحداهما بيدٍ ثمّ يُعاد';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_one_active_per_enrollment"
      ON "Certificate" ("enrollmentId") WHERE "status" = 'active';
  END IF;
END $$;

-- لا سلسلةَ حذفٍ تبلغ شهادةً صادرة.
--
-- كان القيدُ ON DELETE CASCADE: فحذفُ صفِّ تسجيلٍ يمحو الشهادةَ المعلَّقةَ به
-- ورقمُها منشورٌ ويُتحقَّق منه برابط. والشهادةُ دعوى مستقلّةٌ لا أثرٌ للتسجيل.
--
-- والسحبُ له بابُه: status = 'revoked' مع صفٍّ في CertificateRevocation يحمل
-- السببَ ومن سحبها. فالسحبُ يُقال، والمحوُ يُخفي.

ALTER TABLE "Certificate" DROP CONSTRAINT "Certificate_enrollmentId_fkey";

ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

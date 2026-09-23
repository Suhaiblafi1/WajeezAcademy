-- العرضُ المشروط: جلسةُ التهيئة ومهلةُ الموادّ.
--
-- قرارُ صاحب المنصّة (٢٣ سبتمبر ٢٠٢٦): القبولُ مشروطٌ من أصله. يوقّع المتقدّمُ
-- عرضا مشروطا فتُفتح بوّابتُه، ويرفع موادَّه في مهلةٍ معلومة، فإذا قُبلت صار
-- عقدُه نهائيّا وُقِّع من الطرفين. وبهذا يصير «لم نقبل موادَّك» شرطا لم يتحقّق
-- لا عقدا يُفسَخ — وما بين توقيعه واعتمادِنا لا وثيقةَ نافذةً على أحد.
--
-- وتسكن الأعمدةُ في العقد لا في الطلب: الشرطُ بندُ عقدٍ لا خاصّيّةُ طلب.
--
-- ─────────── ومبدأُ المهلة جلسةُ التهيئة لا التوقيع ───────────
--
-- `conditionDeadlineAt = orientationAt + ٧ أيّام`، يُحسب مرّةً عند الإرسال
-- ويُخزَّن. فلو حُسب عند القراءة لَتبدّلت مهلةُ عرضٍ وُقّع بتبدّلِ ثابتٍ في
-- الشيفرة. ولو تعلّق المبدأُ بحضوره الجلسةَ لَاحتاج نقرةَ إنسانٍ يسجّل حضورا،
-- ومن نُسي بقي في الطور أبدا بلا مهلةٍ ولا تذكير.
--
-- ─────────── إضافيّةٌ كلُّها، وبلا قيدٍ على القيم ───────────
--
-- سبعةُ أعمدةٍ تقبل الفراغ، ولا عمودَ يُعاد تعريفُه ولا صفٌّ يُكتب.
--
-- والفراغُ صحيحٌ لا ناقص (§١٢ من التصميم): من هو في التهيئة اليومَ بلا عرضٍ
-- موقَّعٍ لا مهلةَ عليه — ولا تُبدأ ساعةٌ صامتةٌ على من لم يوقّع عليها. ولهذا
-- يُشترط في العامل ألّا يذكّر قطُّ حين تكون المهلةُ NULL، وهو محروسٌ بفحص.
--
-- وعقودُ `gatesActivation = false` (بندٌ يُوثَّق على مدرّبٍ نشط) لا مهلةَ لها
-- كذلك: لا شرطَ يُلحَق بملفٍّ حيّ.

ALTER TABLE "TrainerContract" ADD COLUMN "orientationAt" TIMESTAMP(3);
ALTER TABLE "TrainerContract" ADD COLUMN "orientationUrl" TEXT;
ALTER TABLE "TrainerContract" ADD COLUMN "conditionDeadlineAt" TIMESTAMP(3);
ALTER TABLE "TrainerContract" ADD COLUMN "conditionPausedAt" TIMESTAMP(3);
ALTER TABLE "TrainerContract" ADD COLUMN "conditionExtendedAt" TIMESTAMP(3);
ALTER TABLE "TrainerContract" ADD COLUMN "conditionRemindedAt" TIMESTAMP(3);
ALTER TABLE "TrainerContract" ADD COLUMN "conditionMetAt" TIMESTAMP(3);

-- ويُقرأ الطابورُ بها: «من انقضت مهلتُه» و«من أمامه يومان» مسحٌ على المهلة.
CREATE INDEX "TrainerContract_conditionDeadlineAt_idx"
  ON "TrainerContract" ("conditionDeadlineAt");

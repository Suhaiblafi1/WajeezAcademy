-- التقييمُ يُعلَّق بمقابلةٍ بعينها — لا بالطلب مطلقا.
--
-- قال صاحبُ المنصّة (٢١ سبتمبر ٢٠٢٦): «لا أريد التقييمَ العامّ، أريده مرتبطا
-- بالمقابلات المجدولة… وإن وضعنا في التقييم أنّه اجتاز فليُعكَس على قسم
-- المقابلة ويظهر في ملفّه. لا أريد شيئين: اجتاز واجتاز».
--
-- وكان `TrainerApplicationReview.verdict` حكما على **الطلب** لا على لقاء:
-- لا يقول أيَّ مقابلةٍ حكم فيها، ولا يصل `TrainerInterview.outcome` أبدا.
-- فيُكتب القولُ مرّتين في موضعين، ويُقرأ في الصفّ شارتان لحقيقةٍ واحدة.
--
-- والعمودُ يقبل الفراغَ بقصد: التقييماتُ المكتوبةُ قبل اليوم لا مقابلةَ
-- تُنسَب إليها، وتخمينُها يُلصق حكمَ إنسانٍ بلقاءٍ لم يقصده. فتبقى كما هي
-- وتُقرأ «تقييمٌ عامّ — قبل الربط»، وما يُكتب بعد اليوم مربوطٌ.
--
-- و`ON DELETE SET NULL`: حذفُ مقابلةٍ لا يمحو حكمَ من حكم فيها — يفقد
-- نسبتَه إليها ويبقى مقروءا، كما يفعل `linkId` حين يُحذف الرابط.

ALTER TABLE "TrainerApplicationReview"
  ADD COLUMN "interviewId" UUID;

ALTER TABLE "TrainerApplicationReview"
  ADD CONSTRAINT "TrainerApplicationReview_interviewId_fkey"
  FOREIGN KEY ("interviewId") REFERENCES "TrainerInterview"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TrainerApplicationReview_interviewId_idx"
  ON "TrainerApplicationReview"("interviewId");

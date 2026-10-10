-- ملفُّ التسليم (١٠ أكتوبر ٢٠٢٦): اسمُه ونوعُه وحجمُه كما رُفع، ومتى وصل.
-- كان التسليمُ يحمل مفتاحَ التخزين وحدَه، فيرى المدرّبُ رابطا بلا اسم، ولا يُعرف أوصل الملفُّ أم انقطع رفعُه.
-- أعمدةٌ فارغةٌ لكلّ ما قبلها — لا تمسّ تسليما قائما.
ALTER TABLE "AssignmentSubmission" ADD COLUMN "fileName" TEXT;
ALTER TABLE "AssignmentSubmission" ADD COLUMN "fileMime" TEXT;
ALTER TABLE "AssignmentSubmission" ADD COLUMN "fileSize" INTEGER;
ALTER TABLE "AssignmentSubmission" ADD COLUMN "fileUploadedAt" TIMESTAMP(3);

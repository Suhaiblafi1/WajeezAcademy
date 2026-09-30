-- ═══ دعواتُ اللقاءات المباشرة (٢٩ سبتمبر ٢٠٢٦) ═══
--
-- قال صاحبُ المنصّة: «invite suhaib@wajeez.co and suhaib@wajeez.co to each
-- meeting he sit once it approved and also this invitiation goes to each student
-- in the class». واختار العنوانَ الثاني Academy@wajeez.co، ودعوةً ببريدٍ وتقويم.
--
-- ① `OutboxMail` يحمل دعوةَ التقويم مرفقةً — والدعوةُ تخرج دفعةً (مسجَّلو شعبةٍ
--    كلُّهم ساعةَ يُعتمَد لقاء) فتحتاج مهلةَ هذا الطابور. وتُمحى مع المتن ساعةَ
--    تخرج، كما يُمحى المتن.
-- ② `SessionGuestLink` رابطُ المدعوّ بعنوانه في Zoom — الاجتماعُ بتسجيلٍ مسبق،
--    فيُسجَّل المدعوُّ مرّةً ويُحفظ رابطُه، ويُحذف مع اجتماعه.

-- AlterTable
ALTER TABLE "OutboxMail" ADD COLUMN     "icsContent" TEXT;
ALTER TABLE "OutboxMail" ADD COLUMN     "icsMethod" TEXT;
ALTER TABLE "OutboxMail" ADD COLUMN     "icsFilename" TEXT;

-- CreateTable
CREATE TABLE "SessionGuestLink" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "registrantId" TEXT NOT NULL,
    "joinUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionGuestLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionGuestLink_sessionId_email_key" ON "SessionGuestLink"("sessionId", "email");

-- AddForeignKey
ALTER TABLE "SessionGuestLink" ADD CONSTRAINT "SessionGuestLink_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ZoomMeeting"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

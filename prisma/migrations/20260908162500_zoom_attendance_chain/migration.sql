-- ═══════════ سلسلةُ الحضور من Zoom ═══════════
--
-- الحضورُ اليومَ يُسجَّل بيدٍ: أربعةُ أزرارٍ لكلّ متعلّمٍ في كلّ جلسة. وشعبةٌ
-- من ثلاثين في اثنتي عشرةَ جلسةً ألفٌ وأربعُمئةٍ وأربعون نقرة، والمدرّبُ
-- يفعلها من ذاكرته بعد انتهاء اللقاء.
--
-- وZoom يعرف الجواب: من دخل، ومتى، وكم بقي. فتُنقل الواقعةُ كما هي
-- (`SessionParticipation`) ويُشتقّ منها الحكمُ (`Attendance`) — وتبقى ليدِ
-- المدرّب الكلمةُ الأخيرة، فالمشتقُّ لا يمسح ما وضعه إنسان.
--
-- و`SessionJoinLink` هو ما يجعل ذلك ممكنا: Zoom يبلّغ عن المشاركين ببريد
-- **المسجَّل** لا بالاسم الذي كتبه في خانة العرض. فبلا رابطٍ لكلّ متعلّمٍ
-- تعود قائمةُ أسماءٍ لا تُطابَق بأحد.
--
-- ── ولمَ لا قيدَ CHECK على syncState و source ──
--
-- `scripts/status-checks.ts` يطابق اسمَ العمود **تامّا**، فلا يشملهما.
-- وتوسيعُ قائمته يجرّ قيدا على `Lead.source` — جدولٌ لا شأنَ له بهذا العمل
-- وفيه بياناتُ إنتاج. والسببُ مكتوبٌ عند العمود في المخطَّط.

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "ZoomMeeting" ADD COLUMN     "actualEndAt" TIMESTAMP(3),
ADD COLUMN     "actualStartAt" TIMESTAMP(3),
ADD COLUMN     "durationMin" INTEGER,
ADD COLUMN     "hostJoinedAt" TIMESTAMP(3),
ADD COLUMN     "participantCount" INTEGER,
ADD COLUMN     "syncError" TEXT,
ADD COLUMN     "syncState" TEXT NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "SessionJoinLink" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "registrantId" TEXT NOT NULL,
    "joinUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionJoinLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionParticipation" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "enrollmentId" UUID,
    "email" TEXT,
    "displayName" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3),
    "minutes" INTEGER NOT NULL,

    CONSTRAINT "SessionParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionJoinLink_sessionId_enrollmentId_key" ON "SessionJoinLink"("sessionId", "enrollmentId");

-- CreateIndex
CREATE INDEX "SessionParticipation_sessionId_idx" ON "SessionParticipation"("sessionId");

-- AddForeignKey
ALTER TABLE "SessionJoinLink" ADD CONSTRAINT "SessionJoinLink_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ZoomMeeting"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionJoinLink" ADD CONSTRAINT "SessionJoinLink_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipation" ADD CONSTRAINT "SessionParticipation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CohortSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

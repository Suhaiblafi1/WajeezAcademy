-- بطاقات الاسترجاع المتباعد (البند ح-٤)
-- إضافي بالكامل: جدول جديد لا يمس جدولا قائما، فآمن على قاعدة حيّة.
CREATE TABLE "RetrievalCard" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "moduleId" TEXT NOT NULL,
    "checkIndex" INTEGER NOT NULL,
    "skillSlug" TEXT,
    "step" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "lastAnswerAt" TIMESTAMP(3),
    "lastCorrect" BOOLEAN,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetrievalCard_pkey" PRIMARY KEY ("id")
);

-- بطاقة واحدة لكل (متعلم، وحدة، سؤال)
CREATE UNIQUE INDEX "RetrievalCard_userId_moduleId_checkIndex_key" ON "RetrievalCard"("userId", "moduleId", "checkIndex");
CREATE INDEX "RetrievalCard_userId_dueAt_idx" ON "RetrievalCard"("userId", "dueAt");

ALTER TABLE "RetrievalCard" ADD CONSTRAINT "RetrievalCard_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- حسابُ المستشار البنكيّ لعمولته (١٩ أكتوبر ٢٠٢٦) — والعلّةُ في `server/services/advisor-bank.service.ts`.

-- AlterTable
ALTER TABLE "AdvisorPayout" ADD COLUMN     "bankAccountId" UUID;

-- CreateTable
CREATE TABLE "AdvisorBankAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "ibanSealed" TEXT NOT NULL,
    "tail4" TEXT NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,
    "holderName" TEXT NOT NULL,
    "bankNameAr" TEXT NOT NULL,
    "branchAr" TEXT,
    "swiftBic" TEXT,
    "accountKind" TEXT NOT NULL DEFAULT 'iban',
    "routingCode" TEXT,
    "ownNameConfirmedAt" TIMESTAMP(3),
    "outcome" TEXT NOT NULL DEFAULT 'unverifiable',
    "outcomeScore" INTEGER NOT NULL DEFAULT 0,
    "setBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "lastRevealAt" TIMESTAMP(3),

    CONSTRAINT "AdvisorBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvisorBankAccount_userId_status_idx" ON "AdvisorBankAccount"("userId", "status");

-- AddForeignKey
ALTER TABLE "AdvisorPayout" ADD CONSTRAINT "AdvisorPayout_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "AdvisorBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorBankAccount" ADD CONSTRAINT "AdvisorBankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- فعّالٌ واحدٌ لكلّ مستشار — لا صفّان يتنازعان على أين تذهب عمولتُه
CREATE UNIQUE INDEX "AdvisorBankAccount_one_active"
  ON "AdvisorBankAccount"("userId") WHERE "status" = 'active';

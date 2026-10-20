-- إجازةُ المستشار ومن يغطّيه فيها (١٩ أكتوبر ٢٠٢٦) — والعلّةُ في `server/services/advisor-away.service.ts`.

ALTER TABLE "AdvisorProfile" ADD COLUMN "awayFrom" TIMESTAMP(3);
ALTER TABLE "AdvisorProfile" ADD COLUMN "awayUntil" TIMESTAMP(3);
ALTER TABLE "AdvisorProfile" ADD COLUMN "awayNoteAr" TEXT;

-- أفي التقاويم هو؟ (٢٧ أكتوبر ٢٠٢٦، خطة لوحة الإدارة — المرحلة السادسة).
-- كان يقرأ من آخر صف في طابور البريد عن اللقاء، وما خرج من الطابور يحذف بعد أربعة عشر يوما. فصار يكتب على اللقاء،
-- ويملأ هنا لما سبق.

-- ١) ما بقي أثره في الطابور: آخر ما كتب عنه للجميع. والعنوان الأول من المدعوين (`SESSION_GUESTS`) يصله كل ما
--    يكتب للجميع ولا يصله ما يكتب لواحد — فرفع اللقاء من تقويم من ترك الشعبة لا يقرأ رفعا للجميع.
WITH latest AS (
  SELECT DISTINCT ON ("batchId") "batchId", "purpose", "createdAt"
  FROM "OutboxMail"
  WHERE "to" = 'suhaib@wajeez.co'
    AND "purpose" IN ('session.invite.new', 'session.invite.update', 'session.invite.cancel')
  ORDER BY "batchId", "createdAt" DESC
)
UPDATE "CohortSession" AS s
SET "calendarAnnouncedAt" = l."createdAt",
    "calendarWithdrawnAt" = CASE WHEN l."purpose" = 'session.invite.cancel' THEN l."createdAt" END
FROM latest AS l
WHERE s."id" = l."batchId";

-- ٢) وما حذف أثره من الطابور: كل لقاء معتمد آت دعي إليه ساعة اعتماده (منذ ٢٩ سبتمبر ٢٠٢٦). وما لم يدع إليه
--    منها — قبل ذلك اليوم — تصل رسالة رفعه إن ألغيت شعبته، ولا يرفع من تقويم شيئا.
UPDATE "CohortSession"
SET "calendarAnnouncedAt" = now()
WHERE "calendarAnnouncedAt" IS NULL
  AND "approvalState" = 'approved'
  AND "placeholder" = false
  AND "status" <> 'cancelled'
  AND "startsAt" > now();

-- ٣) ومدربو الشعب لم تصلهم دعوة قط: يبقى «calendarSentAt» فارغا، فيرسل العامل لكل منهم جدول كل شعبة له مرة
--    (`SessionInviteService.sweepTrainerCalendars`).

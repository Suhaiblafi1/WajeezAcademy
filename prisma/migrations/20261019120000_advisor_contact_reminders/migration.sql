-- لا تنتظر حالةٌ مستشارا لا يكلّمها (١٩ أكتوبر ٢٠٢٦) — والعلّةُ عند `remindDue` في `server/services/advisor.service.ts`.
-- ختمُ «ذُكّر» و«بُلّغ» على كلّ إسناد، و«ذُكّر» على كلّ متابعة: لا يتكرّر تذكيرٌ بدورة العامل.
-- ولا يُملأ لما مضى: نافذةُ التذكير أسبوعٌ من الإسناد، وما قبلها يظهر في قائمة الإدارة وحدَها.

ALTER TABLE "AdvisorAssignment" ADD COLUMN "contactRemindedAt" TIMESTAMP(3);
ALTER TABLE "AdvisorAssignment" ADD COLUMN "contactEscalatedAt" TIMESTAMP(3);
ALTER TABLE "FollowUp" ADD COLUMN "remindedAt" TIMESTAMP(3);

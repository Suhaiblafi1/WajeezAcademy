-- من رفع كرّاسةً قبل قالب وجيز (٦ أكتوبر ٢٠٢٦).
--
-- قرارُ صاحب المنصّة: قالبُ الكرّاسة «مستحسَنٌ لمن رفع كرّاسةً من قبل، وإلزاميٌّ
-- للجدد»، ويُحكم لكلّ مدرّبٍ لا لكلّ ملفّ. فالعلمُ يُكتب هنا مرّةً — يومَ القرار —
-- لكلّ مدرّبٍ في إحدى خططه (بأيّ حال) كرّاسةٌ:
--   ① كرّاسةُ الدورة (`content.workbook`) — ملفٌّ مرفوعٌ أو رابط؛
--   ② أو كرّاسةُ موعدٍ من قبل ٣٠ سبتمبر (`content.slots[].workbook`).
-- ولا يكتبه شيءٌ بعدها: من رفع كرّاستَه الأولى غدا رفعها على القالب.
--
-- والحارس: server/tests/trainer/workbook-before-template.test.ts — ينفّذ جملةَ
-- `UPDATE` هذه نفسَها على خططٍ مزروعة.

ALTER TABLE "TrainerProfile" ADD COLUMN IF NOT EXISTS "workbookBeforeTemplate" BOOLEAN NOT NULL DEFAULT false;

UPDATE "TrainerProfile" t SET "workbookBeforeTemplate" = true
WHERE EXISTS (
  SELECT 1 FROM "CohortDeliveryPlan" p
  WHERE p."trainerId" = t.id
    AND (
      coalesce(btrim(p.content #>> '{workbook,bodyFileKey}'), '') <> ''
      OR coalesce(btrim(p.content #>> '{workbook,url}'), '') <> ''
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.content -> 'slots') = 'array' THEN p.content -> 'slots' ELSE '[]'::jsonb END) s
        WHERE coalesce(btrim(s #>> '{workbook,bodyFileKey}'), '') <> ''
           OR coalesce(btrim(s #>> '{workbook,url}'), '') <> ''
      )
    )
);

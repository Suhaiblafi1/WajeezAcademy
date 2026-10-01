-- كودُ المدرّب نسبةٌ أو مبلغ (١ أكتوبر ٢٠٢٦) — البند 4-10 بصيغته الثانية.
--
-- والنسبةُ صارت تقبل الفراغ، فقيدُ مداها (`TrainerCode_percent_range`) يبقى كما
-- هو: CHECK على فراغٍ يمرّ في PostgreSQL، وعلى عددٍ يُقاس بين ١ و٣٠.

ALTER TABLE "TrainerCode" ALTER COLUMN "percentOff" DROP NOT NULL;
ALTER TABLE "TrainerCode" ADD COLUMN "amountOff" DECIMAL(10,2);

-- وجهٌ واحدٌ لا اثنان ولا صفر: كودٌ بنسبةٍ ومبلغٍ معا لا يُعرف أيُّهما يُسعَّر،
-- وكودٌ بلا أيٍّ منهما يُقبل في السلّة بخصمِ صفرٍ صامت.
ALTER TABLE "TrainerCode" ADD CONSTRAINT "TrainerCode_one_face"
  CHECK (num_nonnulls("percentOff", "amountOff") = 1);

ALTER TABLE "TrainerCode" ADD CONSTRAINT "TrainerCode_amount_range"
  CHECK ("amountOff" IS NULL OR ("amountOff" >= 1 AND "amountOff" <= 1000));

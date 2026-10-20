/* ═══ قوائمُ الصفحة — «كل الشعب» و«معتمدة — تنتظر فتحك» (١٢ أكتوبر ٢٠٢٦) ═══

   «اريد تاب خاصة للدورات التي تكون معتمدة» (صاحب المنصّة). والمعتمَدةُ هنا ما تقوله شارتُها في
   البطاقة نفسِها: مسوّدةٌ اعتُمدت خطّةُ مدرّبها ولم تُفتح بعد — فالشارةُ واللسانُ شرطٌ واحد
   (`awaitsOpening`) لا شرطان يفترقان. */
export type CohortList = "all" | "approved";

export const COHORT_LISTS: { id: CohortList; label: string }[] = [
  { id: "all", label: "كل الشعب" },
  { id: "approved", label: "معتمدة — تنتظر فتحك" },
];

/** مسوّدةٌ اعتُمدت خطّةُ مدرّبها — تُعرض وتُباع حين تُفتح */
export function awaitsOpening(c: { status: string; trainerPlanApproved: boolean }): boolean {
  return c.status === "draft" && c.trainerPlanApproved;
}

export function inCohortList(list: CohortList, c: { status: string; trainerPlanApproved: boolean }): boolean {
  return list === "all" || awaitsOpening(c);
}

/* ═══ ما تحتاجه الشعبةُ — كلمةٌ واحدةٌ بجانب اسمها (٢٠ أكتوبر ٢٠٢٦) ═══

   قولُ صاحب المنصّة: «القائمةُ معقّدة، لا أميّز بين دوراتٍ لها مدرّبٌ ودوراتٍ لا مدرّبَ لها ودوراتٍ
   مدرّبوها موقوفون». وكانت شاراتٌ متفرّقةٌ تقول بعضَ ذلك ولا تقول بعضَه. فصارت شارةً واحدةً تقول
   ما ينقص الشعبةَ الآن، بترتيب ما يوقفها: لا مدرّب، ثمّ مدرّبٌ موقوف، ثمّ خطّةٌ لم تُعتمد، ثمّ
   معتمَدةٌ لم تُفتح. والمنتهيةُ والملغاةُ لا تحتاج شيئا. */
export type NextTone = "warn" | "danger" | "info" | "ok";

export interface NextStepRow {
  status: string;
  trainerPlanApproved: boolean;
  trainerPlanStatus?: string | null;
  trainers: { suspended?: boolean }[];
}

const LIVE = ["open", "full", "active"];

export function cohortNextStep(c: NextStepRow): { label: string; tone: NextTone } | null {
  if (c.status === "completed" || c.status === "cancelled") return null;
  const hidden = LIVE.includes(c.status) && !c.trainerPlanApproved ? " — مخفية عن الموقع" : "";
  if (c.trainers.length === 0) return { label: `بلا مدرب${hidden}`, tone: "warn" };
  if (c.trainers.some((t) => t.suspended)) return { label: `مدربها موقوف${hidden}`, tone: "danger" };
  if (!c.trainerPlanApproved) {
    return c.trainerPlanStatus === "submitted"
      ? { label: `خطة تنتظر مراجعتك${hidden}`, tone: "info" }
      : { label: `تنتظر خطة المدرب${hidden}`, tone: "warn" };
  }
  /* والشارةُ واللسانُ شرطٌ واحد (`awaitsOpening`) واسمٌ واحد */
  if (awaitsOpening(c)) return { label: "معتمدة — تنتظر فتحك", tone: "ok" };
  return null;
}

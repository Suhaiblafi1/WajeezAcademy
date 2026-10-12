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

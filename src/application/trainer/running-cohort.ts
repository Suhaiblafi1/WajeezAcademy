/* أهي شعبةٌ تُشغَّل لا تُعَدّ — يُفتح لها «التشغيل» (الخطوة E، ١٩ أكتوبر ٢٠٢٦، `pages/trainer/CohortRun.tsx`).
   مفتوحةٌ أو ممتلئةٌ أو جاريةٌ أو منتهية، أو فيها متعلّمون وإن بقيت مسوّدة. والملغاةُ بلا متعلّمين
   والتي تُعَدّ بعدُ تُفتح على سلّم الخطّة كما كانت. */
export function isRunningCohort(status: string, learners: number): boolean {
  return ["open", "full", "active", "completed"].includes(status) || learners > 0;
}

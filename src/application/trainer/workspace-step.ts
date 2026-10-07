/* ═══ رابطٌ إلى خطوةٍ بعينها في خطّة الشعبة (٧ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: تقريرُ المراجعة الذي يصل المدرّبَ يقول له ما يعدّله —
   «واجعله سهلا عليه، وأرِه كيف». فاختار أن يحمل كلُّ تعديلٍ في التقرير رابطا
   يفتح الخطّةَ على خطوته (`/trainer/cohort/<id>?step=workbooks`) لا وصفا لطريقٍ
   يبحث فيه: «شعبي» ← الشعبة ← الكرّاسة.

   والمفاتيحُ مفاتيحُ خطوات الصفحة نفسُها (`CohortWorkspace`) وأقسامِ ملاحظات
   المعتمِد (`review-notes.ts`) — فالرابطُ والملاحظةُ يسمّيان الشيءَ نفسَه.

   ── والرابطُ لا يفتح ما هو مقفل ──

   الخطواتُ تُفتح بالترتيب: لا تُفتح «الكرّاسة» قبل أن تتمّ «المحاور» في خطّةٍ في
   يد المدرّب. فالرابطُ طلبٌ لا أمر: يُفتح على خطوته إن كانت تُفتح له، وإلّا على ما
   كانت الصفحةُ تُفتح عليه — ولا يُقفز به فوق القفل. والخطّةُ المرسَلةُ أو المعتمَدةُ
   كلُّ خطواتها تُقرأ، فيُفتح على المطلوب. */

export const WORKSPACE_STEPS = ['identity', 'modules', 'workbooks', 'sessions', 'assignments', 'approval'] as const
export type WorkspaceStep = (typeof WORKSPACE_STEPS)[number]

/** اسمُ المعامل في الرابط */
export const STEP_PARAM = 'step'

/** خطوةُ الرابط — أو `null` لما ليس منها (رابطٌ قديمٌ أو مكتوبٌ بيد) */
export function readWorkspaceStep(v: string | null | undefined): WorkspaceStep | null {
  return (WORKSPACE_STEPS as readonly string[]).includes(v ?? '') ? (v as WorkspaceStep) : null
}

/** مسارُ الخطّة على خطوتها — يُلصق بعنوان الموقع في التقرير والرسائل */
export function workspaceStepPath(cohortId: string, step: WorkspaceStep): string {
  return `/trainer/cohort/${encodeURIComponent(cohortId)}?${STEP_PARAM}=${step}`
}

/** أوّلُ خطوةٍ تُفتح: خطوةُ الرابط إن كانت تُفتح له، وإلّا ما كانت الصفحةُ تُفتح عليه */
export function firstStep(
  requested: WorkspaceStep | null,
  fallback: WorkspaceStep,
  openable: (s: WorkspaceStep) => boolean,
): WorkspaceStep {
  return requested && openable(requested) ? requested : fallback
}

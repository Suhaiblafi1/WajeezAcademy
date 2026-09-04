/* اختيارُ خطّةِ المتعلّم بعد تشخيصه — وموضعُ مراحل الرحلة على شريط التقدّم.

   ─────────── لمَ أُخرجت هذه الدوالُّ من صفحة التشخيص ───────────

   كانت داخلَ `src/pages/Diagnostic.tsx` (ألفٌ وتسعُ مئةِ سطر) **غيرَ
   مصدَّرة** — فلا يمكن اختبارُها إطلاقا. ومنها تُشتقّ **الدوراتُ التي
   تُعرَض على المتعلّم**، وعليها يُبنى **ما سيدفعه**. فمنطقُ المال والخطّة
   كان منطوقا في تعليقٍ لا محروسا باختبار.

   ولا يتغيّر بهذا الإخراجِ سلوكٌ ولا قيمة: نفسُ الفروع بنفس ترتيبها. الجديدُ
   أنّ خمسَ قواعدَ صامتةٍ صارت مكتوبةً ومحروسةً في
   `src/tests/diagnostic/plan-selection.test.ts`:

   ١) **الترتيبُ بين الفروع**: النتيجةُ المركَّبة تغلب المسارَ المؤلَّف، وهو
      يغلب دوراتِ المسار المضيف. ولو انقلب فرعان لَحصل متعلّمٌ على خطّةٍ
      أخرى وسعرٍ آخر.
   ٢) **الترتيبُ داخلَ الخطّة**: المركَّبةُ تُرتَّب بـ`sequence`، والمؤلَّفُ
      يُعرض بترتيب مصفوفته كما بناه المحرّك.
   ٣) **السقفُ غيرُ متماثلٍ بقصد**: دوراتُ المسار المضيف تُقصّ عند
      `MAX_PATHWAY_COURSES`، والمركَّبةُ والمؤلَّفُ لا يُقصّان — فهما قرارُ
      محرّكٍ صريحٌ لا قائمةٌ افتراضيّة.
   ٤) **مسارٌ مضيفٌ مجهولٌ يعطي خطّةً فارغة** ولا يرمي.
   ٥) **الاستئناف** لا يقع دون جوابَين، والأجوبةُ المتعدّدةُ تُجمع بفاصلة.

   ─────────── ومرحلةُ السؤال: عطبٌ وقع مرّةً فلا يعود ───────────

   `stageIndexOf` تُسقط كلَّ وحدةٍ لا تعرفها في **المرحلة الأخيرة**. وهذا
   وقع فعلا: أسئلةُ القرار (وحدة `QC`) كانت تسقط هناك، فيرى المتعلّم
   «المرحلة ٥ من ٥» في السؤال الأوّل ثمّ يتذبذب المؤشّر ٥→٢→٥. فأُضيفت
   خريطةُ `QC_STAGE` بمعرّف السؤال لا بوحدته.

   والعلاجُ الدائمُ ليس في هذا الملفّ بل في اختباره: **الاختبارُ يمرّ على بنك
   الأسئلة الحيّ** ويشترط أن تكون لكلّ وحدةٍ فيه مرحلةٌ صريحة — فمن أضاف
   وحدةَ أسئلةٍ جديدةً غدا **سقط اختبارُه**، ولم يكتشفها متعلّمٌ في شريط
   تقدّمه. */

import { Q } from '../../domain/diagnostic/v2_1/maps'
import { loadSession } from './session-store'
import { pathwayCourses, MAX_PATHWAY_COURSES } from '../../data/courses'
import type { DiagQuestion, DiagResult } from '../../data/diagnostic'

/* ─────────── لمَ شكلانِ محلّيّان لا استيرادُ نوعَي المكوّنَين ───────────

   `ComposedPathView` و`CompositeView` معرَّفان في مكوّنَي عرضٍ (`.tsx`)،
   واستيرادُ نوعٍ منهما — وإن كان `import type` يُمحى — **يُسقط بناءَ
   المشروع**: هذا الملفُّ يُبنى في مشروعٍ بلا `--jsx`. وهذه ليست حجّةَ
   تنظيمٍ بل خطأُ مترجمٍ حقيقيّ (‏TS6142).

   والأشكالُ أدناه **أقلُّ ما يقرؤه القرار** لا نسخةٌ من نوعَي العرض: القرارُ
   لا يحتاج ساعاتٍ ولا أسبابا ولا وسوما، بل معرّفَ الدورة وتسلسلَها ومطابقةَ
   المسار. فما يمرّ عبرهما أوسعُ منهما ويُقبَل بالبنية (structural typing)،
   ولو تغيّر حقلٌ عرضيٌّ في المكوّن لم يتأثّر هذا الملفّ. */

/** دورةٌ في نتيجةٍ مركَّبة — التسلسلُ هو ما يُرتَّب به */
export interface PlanCourseRef {
  courseId: string
  sequence: number
}

export interface CompositeLike {
  courses: PlanCourseRef[]
}

export interface ComposedPathLike {
  courses: { courseId: string }[]
  matchesPathwayId: string | null
}

/* ═══ مراحلُ الرحلة الخمس — شريطُ التقدّم ═══ */

export const JOURNEY_STAGES = [
  { key: 'who', label: 'من أنت' },
  { key: 'goal', label: 'هدفك' },
  { key: 'story', label: 'قصتك وواقعك' },
  { key: 'skills', label: 'مهاراتك ورصيدك' },
  { key: 'life', label: 'ظروفك وخطتك' },
] as const

/** أسئلةُ القرار الستّ (وحدة QC) تُوزَّع بمعرّفها لا بوحدتها: وحدتُها واحدةٌ
    وتنتمي إلى ثلاث مراحل. */
export const QC_STAGE: Record<string, number> = {
  [Q.STAGE]: 0,       // من أنت
  [Q.EMPLOYMENT]: 0,  // من أنت
  [Q.GOAL]: 1,        // هدفك
  [Q.NEED]: 1,        // هدفك
  [Q.TIME]: 4,        // ظروفك وخطتك
  [Q.MASTERY]: 4,     // ظروفك وخطتك
}

/** وحداتُ البنك وموضعُ كلٍّ منها من المراحل الخمس — يقرؤها الاختبارُ ليشترط
    أن لا وحدةَ في البنك الحيّ بلا مرحلة. */
export const MODULE_STAGE: Record<string, number> = {
  M0: 0, M1: 0,
  M2: 1, M2B: 1, M8: 1,
  M4: 3, M4B: 3, M5: 3, M6: 3,
  M7: 4, M9: 4,
}

/** كلُّ وحدةٍ تبدأ بـ`M3` في المرحلة الثالثة — بادئةٌ لا اسمٌ كامل */
export const M3_PREFIX_STAGE = 2

export function stageIndexOf(q: DiagQuestion | null): number {
  if (!q) return 0
  const qc = QC_STAGE[q.id]
  if (qc !== undefined) return qc
  const m = q.module
  const known = MODULE_STAGE[m]
  if (known !== undefined) return known
  if (m.startsWith('M3')) return M3_PREFIX_STAGE
  /* وحدةٌ مجهولة: تسقط في الأخيرة — وهو ما يحرسه الاختبارُ بمرورِه على البنك */
  return JOURNEY_STAGES.length - 1
}

/* ═══ اختيارُ دورات الخطّة ═══ */

/** المسارُ المؤلَّفُ **إن كان هو الأصلَ** — و`null` إن وُجدت نتيجةٌ مركَّبة:
    المركَّبةُ تغلب، فلا يُعرض اقتراحان متضاربان في شاشةٍ واحدة. */
export function composedPrimaryOf<T extends ComposedPathLike>(res: DiagResult | null): T | null {
  if ((res?.resultJson.composite as CompositeLike | null) ?? null) return null
  const cp = (res?.resultJson.composed_path as T | null | undefined) ?? null
  return cp && cp.courses.length > 0 && !cp.matchesPathwayId ? cp : null
}

/** دوراتُ الخطّة بترتيبها المعروض — ثلاثةُ فروعٍ بترتيبٍ مقصود */
export function planCourseIdsOf(res: DiagResult | null, hostId: string | undefined): string[] {
  const composite = (res?.resultJson.composite as CompositeLike | null) ?? null
  if (composite) return [...composite.courses].sort((a, b) => a.sequence - b.sequence).map((c) => c.courseId)
  const cp = composedPrimaryOf(res)
  if (cp) return cp.courses.map((c) => c.courseId)
  return (pathwayCourses[hostId ?? ''] ?? []).slice(0, MAX_PATHWAY_COURSES)
}

/* ═══ الحفظُ والاستئناف ═══ */

export interface SavedProgress {
  answers: Record<string, string>
  asked: string[]
  savedAt: number
}

/** شكلُ ما يُقرأ من مخزن الجلسة — أقلُّ ما تحتاجه الدالّة، فلا تُقيَّد بأكثر */
export interface SessionLike {
  answers: { questionId: string; value: string | string[] }[]
  savedAt: string
}

/** تحويلُ جلسةٍ محفوظةٍ إلى تقدّمٍ يُستأنف — نقيّةٌ ليُختبَر العقد:
    لا استئنافَ دون جوابَين، والأجوبةُ المتعدّدةُ تُجمع بفاصلة. */
export function progressFromSession(s: SessionLike | null, now = Date.now()): SavedProgress | null {
  if (!s || s.answers.length < 2) return null
  return {
    answers: Object.fromEntries(
      s.answers.map((a) => [a.questionId, Array.isArray(a.value) ? a.value.join(',') : a.value]),
    ),
    asked: s.answers.map((a) => a.questionId),
    savedAt: Date.parse(s.savedAt) || now,
  }
}

/** قراءةُ تقدّمٍ محفوظ من مخزن الجلسة */
export function loadProgress(): SavedProgress | null {
  return progressFromSession(loadSession() as SessionLike | null)
}

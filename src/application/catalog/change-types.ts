/* أسماءُ أنواعِ التغيير بالعربيّة — طبقةٌ مشتركةٌ يقرؤها المدرّبُ والإدارة.

   ولمَ ملفٌّ جديدٌ ولم تُنقَل القائمةُ نفسُها إلى هنا: `CHANGE_TYPES` في
   `server/services/trainer-change.service.ts` **يُقرأ نصّا** من حارسٍ قائم
   (`src/tests/trainer/cohort-proposals.test.ts`) يقتصّ ما بين
   `export const CHANGE_TYPES = [` و`] as const` ليُثبت أنّ نوعَ اسم الدورة
   لم يعد فيها. فنقلُها يجعل ذلك الحارسَ يقتصّ من `indexOf` سالبٍ — فلا
   يسقط، بل **يحرس فراغا** ويبقى أخضر. وحارسٌ أخضرُ لا يحرس شيئا أسوأُ من
   لا حارس.

   فالقائمةُ حيث هي، وهذا معجمُها. واتّفاقُهما ليس أدبا يُرجى: يحرسه
   `server/tests/trainer/own-course-authoring.test.ts` — نوعٌ يُضاف هناك بلا
   اسمٍ هنا يظهر للمدرّب رمزا لاتينيّا، واسمٌ هنا بلا نوعٍ هناك يعرض عليه
   بابا يردّه الخادم. */

/** بالترتيب الذي يُعرَض به: المحاورُ أوّلا ثمّ ما يُعلَّق عليها ثمّ حدودُ الدورة */
export const CHANGE_TYPE_LABELS_AR: Record<string, string> = {
  module_add: 'إضافةُ محور',
  module_title_edit: 'تعديلُ عنوانِ محور',
  module_reorder: 'إعادةُ ترتيبِ المحاور',
  explanation_improve: 'تحسينُ الشرح',
  examples_update: 'تحديثُ الأمثلة',
  material_add: 'إضافةُ مصدر',
  activity_add: 'إضافةُ نشاط',
  assignment_add: 'إضافةُ مهمّة',
  assessment_improve: 'تحسينُ التقييم',
  project_propose: 'اقتراحُ مشروعٍ تطبيقيّ',
  outcome_propose: 'اقتراحُ مخرَجٍ تعلّميّ',
  duration_propose: 'اقتراحُ مدّةٍ بالساعات',
}

/** اسمُ النوعِ أو النوعُ نفسُه — فلا يُعرَض فراغٌ لنوعٍ لم يُسمَّ بعد */
export function changeTypeLabelAr(changeType: string): string {
  return CHANGE_TYPE_LABELS_AR[changeType] ?? changeType
}

/* ══════════ شكلُ `afterValue` لكلّ نوع ══════════

   `publishToCatalog` في `server/services/trainer-change.service.ts` يقرأ لكلّ
   نوعٍ مفاتيحَ بعينها: `titleAr` للمحور، و`order` للترتيب، و`totalHours`
   للمدّة، و`text` لثمانيةٍ تُعلَّق على محورٍ قائم. فما لم يُبنَ بهذا الشكل
   **يُعتمَد ثمّ لا يفعل شيئا** — اقتراحٌ يمرّ بالمراجعة ويُنشَر ولا يتغيّر به
   في الدورة حرف. وهو أسوأُ من ردٍّ صريح: الردُّ يُقرأ، والصمتُ لا.

   فالبناءُ هنا لا في الشاشة، ويحرسه
   `server/tests/trainer/own-course-authoring.test.ts` بمقابلته بما يقرؤه
   الناشرُ فعلا — لا بأنّه «يبدو صحيحا». */

/** الأنواعُ التي تتعلّق بمحورٍ قائم — تبحث عن `targetKey` في محاور الدورة */
export const NEEDS_MODULE: ReadonlySet<string> = new Set([
  'module_title_edit', 'explanation_improve', 'examples_update', 'material_add',
  'activity_add', 'assignment_add', 'assessment_improve', 'project_propose',
  'outcome_propose',
])

/** والثمانيةُ التي يجمع الناشرُ نصَّها في حقلٍ واحد عبر `text` */
export const TEXT_TYPES: ReadonlySet<string> = new Set([
  'explanation_improve', 'examples_update', 'material_add', 'activity_add',
  'assignment_add', 'assessment_improve', 'project_propose', 'outcome_propose',
])

export interface ModuleRef { id: string; titleAr: string; sequence: number }

/** ما يكتبه المدرّبُ في النموذج قبل أن يصير عنصرا في اقتراح */
export interface ChangeDraft {
  changeType: string
  targetKey: string
  /** عنوانُ المحورِ الجديدِ أو عنوانُه المعدَّل */
  titleAr: string
  /** نصُّ المصدرِ أو الشرحِ أو المهمّة */
  text: string
  hours: string
  /** ترتيبُ المحاورِ المقترَح — لـ`module_reorder` وحدَه */
  order: string[]
  note: string
}

export const emptyChangeDraft = (): ChangeDraft => ({
  changeType: 'module_add', targetKey: '', titleAr: '', text: '',
  hours: '', order: [], note: '',
})

/** يبني `afterValue` بالشكلِ الذي يقرؤه `publishToCatalog` لهذا النوع بعينه */
export function afterValueFor(d: ChangeDraft): Record<string, unknown> {
  switch (d.changeType) {
    case 'module_add': {
      const v: Record<string, unknown> = { titleAr: d.titleAr.trim() }
      if (d.text.trim()) v.activityAr = d.text.trim()
      const h = Number(d.hours)
      if (Number.isFinite(h) && h > 0) v.hours = h
      return v
    }
    case 'module_title_edit':
      return { titleAr: d.titleAr.trim() }
    case 'module_reorder':
      return { order: d.order }
    case 'duration_propose':
      return { totalHours: Number(d.hours) }
    default:
      return { text: d.text.trim() }
  }
}

/** أدنى طولٍ للسبب — حدُّ `submit` نفسُه، فلا يُقال للمدرّب حدّان */
export const MIN_CHANGE_REASON_LEN = 10

/** ما ينقص هذا العنصرَ قبل أن يُرسَل — فارغةٌ تعني أنّه تامّ */
export function draftProblemsAr(d: ChangeDraft, modules: readonly ModuleRef[]): string[] {
  const out: string[] = []
  if (NEEDS_MODULE.has(d.changeType)) {
    if (!d.targetKey) out.push('اختَرِ المحورَ الذي يتعلّق به')
    else if (!modules.some((m) => m.id === d.targetKey)) {
      out.push('المحورُ المختارُ ليس من محاور هذه الدورة')
    }
  }
  if (d.changeType === 'module_add' && d.titleAr.trim().length < 3) out.push('عنوانُ المحورِ الجديد')
  if (d.changeType === 'module_title_edit' && d.titleAr.trim().length < 3) out.push('العنوانُ الجديد')
  if (TEXT_TYPES.has(d.changeType) && d.text.trim().length < 3) out.push('النصُّ الذي تضيفه')
  if (d.changeType === 'duration_propose') {
    const h = Number(d.hours)
    if (!Number.isFinite(h) || h <= 0) out.push('عددُ الساعاتِ المقترَح')
  }
  if (d.changeType === 'module_reorder' && d.order.length < 2) out.push('محورانِ على الأقلّ لتُرتِّبهما')
  return out
}

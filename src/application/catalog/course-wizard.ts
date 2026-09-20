/* معالج إضافة دورة من أربع خطوات — نفس مبدأ معالج المسار (pathway-wizard):
   لا تقدُّم بخطوةٍ ناقصة، ولا نموذجٌ مسطّحٌ واحد يخفي فيه النقص بين عشرات الحقول.

   قرار صاحب المنصّة: «اختر/أنشئ دورة ← وحداتها ← مهاراتها ← مراجعة ونشر»،
   بتعليمات قصيرة فوق كل خطوة بلغة غير تقنية. */

export type CourseWizardStepKey = 'basics' | 'modules' | 'skills' | 'review'

export const COURSE_WIZARD_STEPS: { key: CourseWizardStepKey; labelAr: string; hintAr: string }[] = [
  { key: 'basics', labelAr: 'الدورة', hintAr: 'اسمها ومسارها وعدد ساعاتها' },
  { key: 'modules', labelAr: 'الوحدات', hintAr: 'كل وحدة درسٌ يراه المتعلم — عنوانها إلزامي وباقيها اختياري' },
  { key: 'skills', labelAr: 'المهارات', hintAr: 'ما تقيسه هذه الدورة من مهارات المحرك التشخيصي' },
  { key: 'review', labelAr: 'مراجعة وإنشاء', hintAr: 'راجع الملخص ثم أنشئها مسودة' },
]

export interface CourseModuleDraft {
  titleAr: string; outcomeAr: string; activityAr: string; artifactAr: string
  bodyAr: string; checksAr: string; videoAr: string; scenarioAr: string; hours: string
}

export const EMPTY_MODULE: CourseModuleDraft = {
  titleAr: '', outcomeAr: '', activityAr: '', artifactAr: '', bodyAr: '',
  checksAr: '', videoAr: '', scenarioAr: '', hours: '',
}

export interface CourseWizardDraft {
  /* لا `id` هنا: المعرّفُ يولّده الخادمُ من المسار الأمّ (`mintCourseId`)،
     ولا يمرّ بالمسوّدة أصلا. وكان حقلا نصُّه النائب «CRS-XXX-000» — وهي
     صيغةٌ يرفضها الخادمُ نفسُه (`C-XXX-000`)، فكان الحقلُ يطلب ما لا يُقبل. */
  /* ═══ والمسارُ الأمُّ اختياريٌّ منذ ٢٠ سبتمبر ٢٠٢٦ ═══

     قرارُ صاحب المنصّة: «إن أردتُ أن أضيفها دورةً جديدةً، فلِمَ أضيفها إلى
     مسار؟». فمن أراد دورةً قائمةً بنفسها اضطُرّ قبلُ إلى اختراع مسارٍ لها،
     أو إلحاقها بمسارٍ لا تنتمي إليه فتظهر في رحلةِ من لم يطلبها.

     والعائلةُ تقوم مقامَه حين يغيب: منها يُشتقّ المعرِّفُ (`MKT` ← `C-MKT-101`)
     ومجالُ الدورة في مخطِّط الفصل. وأحدُهما لازمٌ — لا كلاهما ولا واحدَ. */
  pathwayId: string
  /** عائلةُ المعرِّف حين لا مسارَ — من `COURSE_DOMAIN_FAMILIES` */
  familyCode: string
  sequence: string
  titleAr: string
  shortPromiseAr: string
  levelAr: string
  totalHours: string
  skillIds: string[]
  modules: CourseModuleDraft[]
}

export const EMPTY_COURSE_DRAFT: CourseWizardDraft = {
  pathwayId: '', familyCode: '', sequence: '1', titleAr: '', shortPromiseAr: '', levelAr: '',
  totalHours: '', skillIds: [], modules: [EMPTY_MODULE],
}

/** ما يمنع الانتقال من الخطوة — قائمة فارغة تعني «امضِ» */
export function courseBlockersOf(step: CourseWizardStepKey, d: CourseWizardDraft): string[] {
  switch (step) {
    case 'basics': {
      const out: string[] = []
      /* أحدُهما لازم: مسارٌ أمٌّ، أو عائلةٌ لدورةٍ قائمةٍ بنفسها. والفراغُ
         يترك المعرِّفَ بلا عائلةٍ فيصير `C-GEN-101` بلا مجالٍ ولا جيران. */
      if (!d.pathwayId && !d.familyCode) {
        out.push('اختر المسار الأمّ — أو عائلةَ الدورة إن كانت قائمةً بنفسها')
      }
      if (d.titleAr.trim().length < 3) out.push('اسم الدورة (٣ أحرف على الأقل)')
      if (!(Number(d.totalHours) >= 1)) out.push('إجمالي الساعات — رقم واحد على الأقل')
      return out
    }
    case 'modules':
      return d.modules.every((m) => m.titleAr.trim().length >= 3)
        ? []
        : ['كل وحدة تحتاج عنوانا — ٣ أحرف على الأقل']
    case 'skills':
      /* لا إلزام: بعض الدورات تعريفية بلا مهارة تُقاس بعد */
      return []
    case 'review':
      return []
  }
}

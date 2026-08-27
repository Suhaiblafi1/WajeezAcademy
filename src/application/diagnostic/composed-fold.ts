/* هل تستحق «خطتك مرتَّبة على مقاسك» قائمةً ثانية على صفحة النتيجة؟

   كانت تُعرض دائما متى قيّم المتعلم جوانبه، فتقع تحت «ماذا ستحقق من خلال خطتك؟»
   قائمةٌ ثانية تسمّي نفسها «خطتك» أيضا. وقياس على خمس حالات: المتعلم يرى ١٠–١١
   بطاقة دورة، أربع أو خمس منها الدورات نفسها مكرّرة — وفي ثلاث حالات من الخمس
   كانت الثانية إعادة سرد كاملة للأولى بإطار مختلف.

   والقاعدة: القائمة الثانية تُبرّر وجودها بما تضيفه لا بما تعيده. فإن لم تضف
   مقررين لا تحويهما الأولى، تُطوى إلى سطر تفسيري واحد داخل بطاقة «لماذا هذا
   المسار» — فتُحفظ قيمتها (تغطية الفجوات ومعايرة المستوى) ولا تتكرر الدورات.

   ومنطق قرارٍ خالص هنا لا في مكوّن الصفحة: ليُختبَر وحده، ولأن تصدير غير
   المكوّنات من ملف مكوّن يكسر التحديث السريع (react-refresh). */

/** أقل عدد مقررات جديدة تستحق بها الخطة المرتَّبة قائمةً مستقلة بدل سطر تفسير */
export const COMPOSED_CARD_MIN_NOVEL = 2

export interface FoldablePlan {
  courses: { courseId: string }[]
  coveredGaps: string[]
}

export interface ComposedFold {
  /** تُعرض البطاقة كاملة — أضافت ما يكفي */
  showCard: boolean
  /** بديلها حين تُطوى: سطر واحد يحفظ قيمتها التفسيرية، أو null إن لا قيمة */
  gapNote: string | null
}

export function foldComposedPlan(
  plan: FoldablePlan | null | undefined,
  shownCourseIds: string[],
): ComposedFold {
  if (!plan?.courses?.length) return { showCard: false, gapNote: null }

  const novel = plan.courses.filter((c) => !shownCourseIds.includes(c.courseId))
  if (novel.length >= COMPOSED_CARD_MIN_NOVEL) return { showCard: true, gapNote: null }

  const covered = plan.coveredGaps.length
  return {
    showCard: false,
    gapNote:
      covered > 0
        ? `ورتّبنا دوراتك على مستواك الذي قدّرته، فتغطي خطتك ${covered} من الجوانب التي قلت إنك دونها.`
        : null,
  }
}

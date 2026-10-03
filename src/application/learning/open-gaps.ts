/* ═══ نواقصُ فتح الشعبة التي تُوفى في لسانٍ من بطاقتها (٣ أكتوبر ٢٠٢٦) ═══

   شروطُ الفتح يقولها الخادمُ نصّا (`CohortService.openChecklist`)، والشاشةُ
   تعرضها شاراتٍ حمراء. وكانت الشارةُ تقول «لا سعة محددة» ولا تقول أين تُحدَّد —
   فيبحث صاحبُ المنصّة عن اللسان الذي فيه السعة. فصارت الشارةُ تفتح لسانَها،
   واللوحُ بعد الاعتماد الأخير (`TrainerNextSteps`) يوفي السعةَ في مكانه.

   والنصوصُ هنا وحدَها، يكتبها الخادمُ منها وتقابلها الشاشةُ بها — فلا تُطابَق
   جملةٌ بجملةٍ تفترقان عند أوّل تعديلٍ في إحداهما. */

export const OPEN_GAP = {
  schedule: 'لا جدول جلسات',
  capacity: 'لا سعة محددة',
  financial: 'الإعداد المالي غير مكتمل (السعر والعملة)',
} as const

/** لسانُ البطاقة الذي يُوفى فيه هذا النقص — أو `null` لما لا لسانَ له */
export function tabForGap(gap: string): 'schedule' | 'enrollment' | null {
  if (gap === OPEN_GAP.schedule) return 'schedule'
  if (gap === OPEN_GAP.capacity || gap === OPEN_GAP.financial) return 'enrollment'
  return null
}

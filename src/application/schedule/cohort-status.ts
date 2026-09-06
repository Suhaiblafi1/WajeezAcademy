/* حالاتُ الشعبة الحيّة — مصدرٌ واحدٌ للواجهة.

   الخادمُ يعرف ثلاثَ حالاتٍ حيّة: `open` و`full` و`active` — مكرّرةً في
   `catalog-readiness.service.ts` و`catalog-impact.service.ts`
   و`public-catalog.service.ts` و`trainer-review.service.ts`. وكانت الواجهةُ
   تُعيد كتابتَها في موضعين، فافترق أحدُهما: لوحةُ الإدارة كانت تعدّ
   `open || running || full` — و«running» لا وجودَ لها في هذه المنصّة، لا في
   المخطَّط ولا في خدمةٍ ولا في بذرِ الديمو؛ وردت مرّةً واحدةً في المستودع
   كلِّه وهي تلك.

   والأثرُ أنّ بطاقةَ «شعب نشطة الآن» كانت تقرأ صفرا وفي القاعدة شعبةٌ
   `active` بمتعلّمٍ مسجَّلٍ وجلساتٍ قادمة — أي أنّ أوّلَ رقمٍ يراه المديرُ عن
   نشاط أكاديميّته كان يُنقص الشعبَ الجارية كلَّها. ولم يكن يظهر خطأٌ: العدُّ
   صحيحٌ حسابا، والمفردةُ وحدَها كاذبة.

   فالثابتُ هنا، ومنه تقرأ الشاشتان. */
export const LIVE_COHORT_STATUSES = ['open', 'full', 'active'] as const

export function isLiveCohort(status: string): boolean {
  return (LIVE_COHORT_STATUSES as readonly string[]).includes(status)
}

/* الأفعالُ الجماعيّة في طابور الطلبات — ما يصلح للمحدَّد كلِّه، وكيف يُحدَّد.

   ═══ ما طُلب (٢١ سبتمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «أريد أن نضع خيارَ تذكيرِ جميعِ من بدؤوا بمسوّدةٍ أن
   يكملوا الطلبَ الخاصَّ بهم، وأيضا أريد أن أختارَ الكلَّ وأقومَ بأكشن لهم
   كلِّهم **حسب حالتهم إذا كانوا نفسَ الفئة**».

   وكان في الشاشة تحديدٌ بمربّعٍ لكلّ صفّ، وشريطٌ يعرض القراراتِ الجماعيّة،
   وتذكيرٌ جماعيٌّ واحدٌ — بحجز الموعد. ونقص شيئان:

   ① **تذكيرُ المسوّدة لا يُجمَّع.** كان في قائمة الصفّ وحدَه: «ذكّره بإكمال
      طلبه» — واحدا واحدا. وعشرون مسوّدةً واقفةً تعني عشرين فتحةَ قائمة.
   ② **ولا سبيلَ إلى «الكلّ».** المربّعاتُ تُنقَر صفّا صفّا، فمن رشّح الطابورَ
      على «مسودة» ووجد أربعين نقرها أربعين مرّة.

   ═══ والشرطُ الذي لا يُنقَض: لا يُعرض إلّا ما يصلح للمحدَّد كلِّه ═══

   «حسب حالتهم إذا كانوا نفسَ الفئة» — وهو شرطٌ كان قائما للقرارات
   (`commonActions` في الشاشة) ولم يكن للتذكيرات. فخرج إلى هنا ليُكتب مرّةً
   ويُفحَص بنيةً: فعلٌ يصلح لبعض المحدَّد يُنتج **إخفاقا جزئيّا** — عشرةٌ
   نجحت وثلاثون رُدّت ٤٠٩ — لا سببَ له إلّا أنّا عرضناه.

   وهو حدُّ عرضٍ لا حدُّ أمان: الخادمُ يردّ كلَّ واحدةٍ لا تصلح على حدة
   (`not_draft` و`not_bookable` و`already_booked`). فلو انحرفت هذه الشاشةُ
   يوما لم يقع إلّا زرٌّ يُرَدّ — لا فعلٌ يقع على من لا يستحقّه. */

import { canRemindToBook } from './application-options'
import type { Decision } from './decisions'
import { BULK_ACTIONS } from './decisions'

/** ما يلزم للحكم على صفٍّ — لا الصفُّ كلُّه، فتُختبَر الدوالُّ بلا تركيب طلبٍ تامّ */
export interface BulkRow {
  status: string
  /** عددُ مواعيده القائمة — الملغى لا يُحسب */
  interviewsCount: number
}

/**
 * أيصلح هذا الفعلُ للمحدَّد كلِّه؟
 *
 * **والفراغُ لا يصلح لشيء**: صفرُ محدَّدٍ يجعل `every` صادقةً في جافاسكربت،
 * فتُعرض الأفعالُ كلُّها على لا أحد. وهي الحالةُ التي تقع أوّلَ ما تُفتح
 * الشاشة — أي دائما.
 */
export function fitsAll<T>(rows: readonly T[], fits: (row: T) => boolean): boolean {
  return rows.length > 0 && rows.every(fits)
}

/** القراراتُ التي تصلح للمحدَّد كلِّه — من `DECISIONS` نفسِها لا من قائمةٍ ثانية */
export function bulkDecisionsFor(
  rows: readonly BulkRow[],
  decisions: readonly Decision[],
): Decision[] {
  return decisions.filter(
    (d) => BULK_ACTIONS.includes(d.action) && fitsAll(rows, (a) => d.from.includes(a.status)),
  )
}

/** تذكيرٌ جماعيّ: لفظُه، ومسارُه في الخادم، وما يُقال حين يقع */
export interface BulkReminder {
  key: string
  labelAr: string
  /** آخرُ مقطعٍ في مسار الخادم — يُبنى حوله النداء فلا يُكتب مرّتين */
  path: string
  doneAr: string
}

/* ═══ والتذكيران لا يجتمعان أبدا، وهو مقصود ═══

   «مسودة» ليست في `BOOKABLE_STATUSES` — فمن لم يُكمل طلبَه لا يُدعى إلى
   حجزِ موعدٍ على طلبٍ ناقص. فالشرطان متنافيان بنيةً لا باتّفاق، ولذلك
   يظهر في الشريط تذكيرٌ واحدٌ أبدا: إمّا «أكمِلْ» وإمّا «احجزْ». */
const REMINDERS: readonly (BulkReminder & { fits: (row: BulkRow) => boolean })[] = [
  {
    key: 'draft',
    labelAr: 'ذكّرهم بإكمال الطلب',
    path: 'draft-reminder',
    doneAr: 'أُرسل تذكيرُ الإكمال',
    /* مِحَكُّ الخادم بعينه (`remindDraftApplicant`): «مسودة» وحدَها */
    fits: (a) => a.status === 'draft',
  },
  {
    key: 'booking',
    labelAr: 'ذكّرهم بحجز الموعد',
    path: 'booking-reminder',
    doneAr: 'أُرسل التذكير',
    /* ومِحَكُّ `remindToBookInterview` بعينه — ولو افترقا لعُرض زرٌّ يردّه ٤٠٩ */
    fits: (a) => canRemindToBook({ status: a.status, liveInterviews: a.interviewsCount }),
  },
]

/** التذكيراتُ التي تصلح للمحدَّد كلِّه — و`fits` لا يخرج معها: هو حكمُ العرض
    لا شيءٌ تصيّره الشاشة، ونشرُه يغري بإعادة الحكم في موضعٍ ثانٍ. */
export function bulkRemindersFor(rows: readonly BulkRow[]): BulkReminder[] {
  return REMINDERS.filter((r) => fitsAll(rows, r.fits))
    .map(({ key, labelAr, path, doneAr }) => ({ key, labelAr, path, doneAr }))
}

/* ═══ وتحديدُ «الكلّ» على درجتين لا درجةٍ واحدة ═══

   «أريد أن أختارَ الكلّ» — و«الكلُّ» لفظٌ يحتمل شيئين: صفحةً معروضةً فيها
   خمسون، وطابورا مرشَّحا فيه ثلاثمئة. وأخطرُ ما يقع أن يُقصَد الأوّلُ ويقعَ
   الثاني: من ظنّ أنّه حدّد خمسين فرفض، رفض ثلاثمئة.

   فالمربّعُ في الترويسة يحدّد **الصفحةَ المعروضة** — ما تراه العينُ وهي
   تنقر. فإن وراءها مطابِقٌ لم يُحدَّد عُرض عرضٌ ثانٍ صريحٌ بعدده:
   «حدّد الكلَّ المطابقَ (٣٠٠)». نقرتان لا نقرة، والعددُ مكتوبٌ في كلتيهما. */

/** حالُ مربّع الترويسة — الثلاثةُ لا اثنتان: «بعضُه» ليست «كلَّه» ولا «لا شيء» */
export type PageSelection = 'none' | 'some' | 'all'

export function pageSelection(
  pageIds: readonly string[],
  selected: ReadonlySet<string>,
): PageSelection {
  if (pageIds.length === 0) return 'none'
  const n = pageIds.filter((id) => selected.has(id)).length
  if (n === 0) return 'none'
  return n === pageIds.length ? 'all' : 'some'
}

/**
 * يضمّ الصفحةَ إلى التحديد أو يرفعها عنه — **ولا يمسّ ما خارجها**.
 *
 * فمن حدّد الكلَّ المطابقَ ثمّ نقر المربّعَ ليرفع الصفحةَ بقي له الباقي.
 */
export function togglePage(
  selected: ReadonlySet<string>,
  pageIds: readonly string[],
  on: boolean,
): Set<string> {
  const next = new Set(selected)
  for (const id of pageIds) {
    if (on) next.add(id)
    else next.delete(id)
  }
  return next
}

/** كم يطابق الفرزَ ولم يُحدَّد بعد — فلا يُعرض «حدّد الكلّ» ولا شيءَ وراءه */
export function unselectedMatching(
  matchingIds: readonly string[],
  selected: ReadonlySet<string>,
): number {
  return matchingIds.filter((id) => !selected.has(id)).length
}

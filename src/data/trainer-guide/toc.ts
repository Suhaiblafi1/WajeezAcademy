/* فهرسُ الدليل — أجزاءٌ بعناوين، وتحت كلٍّ أقسامُه بأرقامها، وعلامةُ «جديد» لما أُضيف حديثا.

   كان يُبنى في `pages/trainer/Guide.tsx` ويقرؤه شريطٌ جانبيٌّ على الحاسوب وصندوقٌ
   مطويٌّ على الهاتف. ثمّ قال صاحبُ المنصّة (٥ أكتوبر ٢٠٢٦) إنّه لا فهرسَ يدلّ على
   ما حُدّث في الدليل — والصندوقُ مطويٌّ بعد شاشةٍ من الغلاف فلا يُرى — واختار من
   ثلاثة بدائل صفحةَ محتوياتٍ بعد الغلاف: بطاقةٌ لكلّ جزء، وعلامةُ «جديد» على
   الجديد. فالفهرسُ بياناتٌ تُبنى هنا مرّةً، ويعرضها ثلاثة: صفحةُ المحتويات،
   والشريطُ الجانبيّ، ورأسُ القسم نفسِه.

   ويحرسه `src/tests/trainer/guide-contents.test.ts`. */

import { GUIDE_PARTS, GUIDE_SECTIONS, shortTitle } from './content'

export type TocItem = { id: string; label: string; n?: number; isNew?: boolean }
/** «قبل أن تبدأ» وما بعدها تمهيدٌ وخاتمة — والأجزاءُ هي أجزاءُ الدليل */
export type TocGroup = { title: string; kind: 'before' | 'part' | 'after'; items: TocItem[] }

/** كم يبقى القسمُ «جديدا» بعد إضافته — شهرٌ يكفي من قرأ الإعلانَ ليجده، ثمّ تسقط العلامةُ وحدَها */
export const NEW_FOR_DAYS = 30

const DAY = 86_400_000

/** أُضيف في آخر `NEW_FOR_DAYS` يوما؟ — واليومُ يبدأ بتوقيت عمّان (+03:00) */
export function isNewSince(added: string | undefined, now: Date): boolean {
  if (!added || !/^\d{4}-\d{2}-\d{2}$/.test(added)) return false
  const age = now.getTime() - Date.parse(`${added}T00:00:00+03:00`)
  return age >= 0 && age < NEW_FOR_DAYS * DAY
}

/** «قبل أن تبدأ»، ثمّ أجزاءُ الدليل، ثمّ «مساعدة» — والرقمُ ترتيبُ القسم في الدليل كما في رأسه */
export function guideToc(now: Date): TocGroup[] {
  const byId = new Map(GUIDE_SECTIONS.map((s, i): [string, TocItem] =>
    [s.id, { id: s.id, label: shortTitle(s.title), n: i + 1, isNew: isNewSince(s.added, now) }]))
  return [
    { title: 'قبل أن تبدأ', kind: 'before', items: [{ id: 'journey', label: 'رحلتُك في المنصّة' }, { id: 'first-week', label: 'أسبوعُك الأوّل' }] },
    ...GUIDE_PARTS.map((p): TocGroup => ({
      title: p.title,
      kind: 'part',
      items: p.ids.map((id) => byId.get(id)).filter((t): t is TocItem => !!t),
    })),
    { title: 'مساعدة', kind: 'after', items: [{ id: 'faq', label: 'أسئلةٌ شائعة' }, { id: 'help', label: 'تحتاج مساعدة؟' }] },
  ]
}

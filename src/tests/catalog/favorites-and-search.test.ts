/* ع-٨ · بحثٌ يبلغ ما يُدرَّس، ومفضّلةٌ تخصّ صاحبَها.

   ═══ ثلاثةُ أعطابٍ يحرسها هذا الملفّ ═══

   ① **ما يُدرَّس داخلَ الدورة كان محجوبا عن البحث.** الحقولُ المبحوثةُ
      كانت الاسمَ والوعدَ والجمهورَ والمهارات — ولا محورَ فيها. فمن بحث عن
      «المقابلة المعلوماتيّة» لم يجد الدورةَ التي تُفرد لها محورا كاملا،
      **والمنصّةُ تُدرّسها**. وع-٨ يقول: «يطابق الكلماتِ حيثما كانت —
      العنوانُ والوعدُ وعناوينُ المحاور».
   ② **والتوسعةُ بلا ترتيبٍ تُفسد ما تُصلح.** لو صعد من ذُكرت كلمتُه في
      محورٍ فوق من يحملها في اسمه، صار البحثُ أسوأَ لا أحسن.
   ③ **والمفضّلةُ لا تُحفَظ إلّا لصاحبها**، ولا تقبل نوعا مجهولا: `kind`
      عمودٌ نصّيٌّ، فالقيدُ في القسمة لا في القاعدة.

   وحارسُ ① **مشتقٌّ من الكتالوج لا مكتوبٌ بيده**: يمرّ على كلّ دورةٍ وكلّ
   محورٍ فيها. فلا يبلى بتغيّر عنوانٍ ولا يُصلَّح بتحديث مثالٍ في اختبار. */

import { describe, expect, it } from 'vitest'
import '../setup-catalog'
import { courses, moduleTitlesOf } from '../../data/courses'
import { catalogRank, matchesCatalogQuery } from '../../application/catalog/catalog-search'
import { courseSearchFields, courseSearchLayers } from '../../application/catalog/search-fields'
import {
  FAVORITE_KINDS, favoriteBlockerAr, favoriteKey, favoriteKeySet, isFavoriteKind, MAX_REF_LEN,
} from '../../application/catalog/favorites'

/* والحقولُ تُقرأ من مالكها (`search-fields.ts`) لا تُكتب هنا: حارسٌ يبني
   قائمتَه بيده يحرس نفسَه — تُنزع عناوينُ المحاور من الشاشة فيبقى أخضر. */
const courseFields = courseSearchFields

describe('ع-٨ · البحثُ يبلغ عناوينَ المحاور', () => {
  it('كلُّ عنوانِ محورٍ يجد دورتَه — في الكتالوج كلِّه لا في مثالٍ مختار', () => {
    const missed: string[] = []
    for (const c of courses) {
      for (const title of moduleTitlesOf(c.id)) {
        if (!matchesCatalogQuery(title, courseFields(c))) missed.push(`${c.id} · ${title}`)
      }
    }
    expect(missed, `عناوينُ محاورَ لا تجد دورتَها:\n${missed.slice(0, 5).join('\n')}`).toEqual([])
  })

  it('وفيها ما لا يوجد إلّا في محاورها — وإلّا فالحارسُ يمرّ بلا أن يحرس شيئا', () => {
    /* حارسُ الحارس: لو كانت عناوينُ المحاور كلُّها مذكورةً في الاسم والوعد
       لَمرّ الفحصُ الأوّلُ وإن نُزع بحثُ المحاور كلُّه. فيُثبَت أنّ ثمّة
       عناوينَ **لا يجدها** إلّا بحثُ المحاور. */
    const own = (c: (typeof courses)[number]) =>
      [c.name, c.promise, c.audience, c.pathwayName, ...c.skills]
    let onlyInModules = 0
    for (const c of courses) {
      for (const title of moduleTitlesOf(c.id)) {
        if (!matchesCatalogQuery(title, own(c))) onlyInModules++
      }
    }
    expect(onlyInModules, 'لا عنوانَ محورٍ يزيد على ما في الحقول الأخرى — فالفحصُ زينة')
      .toBeGreaterThan(20)
  })

  it('② والمحورُ أدنى الطبقات — يُخرج نتيجةً ولا يتصدّر', () => {
    const rank = (c: (typeof courses)[number], q: string) =>
      catalogRank(q, courseSearchLayers(c))

    /* الرتبةُ تُقاس على الدورة نفسِها، فلا يتسرّب إلى الفحص اختلافُ دورتَين:
       اسمُها يرفعها إلى أعلى طبقة، وعنوانُ محورٍ لا يُذكر في سواه إلى أدناها. */
    const own = (c: (typeof courses)[number]) =>
      [c.name, c.promise, c.audience, c.pathwayName, ...c.skills]
    const sample = courses.find(
      (c) => moduleTitlesOf(c.id).some((t) => !matchesCatalogQuery(t, own(c))),
    )
    expect(sample, 'لا دورةَ فيها عنوانُ محورٍ ينفرد به').toBeTruthy()
    const moduleOnly = moduleTitlesOf(sample!.id)
      .find((t) => !matchesCatalogQuery(t, own(sample!)))!

    expect(rank(sample!, sample!.name), 'الاسمُ ليس أعلى الطبقات').toBe(3)
    expect(rank(sample!, moduleOnly), 'المحورُ لا يُخرج شيئا، أو يتصدّر').toBe(1)
  })
})

describe('ع-٨ · ما يُحفَظ في المفضّلة', () => {
  it('③ المسارُ والدورةُ كلاهما — وكانت المساراتِ وحدَها', () => {
    expect([...FAVORITE_KINDS].sort()).toEqual(['course', 'pathway'])
    for (const k of FAVORITE_KINDS) expect(isFavoriteKind(k)).toBe(true)
  })

  it('ولا يُقبل نوعٌ مجهول — و`kind` عمودٌ نصّيٌّ فالقيدُ هنا لا في القاعدة', () => {
    expect(favoriteBlockerAr('pathway', 'P-1')).toBeNull()
    expect(favoriteBlockerAr('course', 'C-1')).toBeNull()
    expect(favoriteBlockerAr('trainer', 'T-1'), 'نوعٌ مجهولٌ يمرّ').toBeTruthy()
    expect(favoriteBlockerAr('pathway', '   '), 'رمزٌ فارغٌ يمرّ').toBeTruthy()
    expect(favoriteBlockerAr('pathway', 'x'.repeat(MAX_REF_LEN + 1)), 'رمزٌ بلا سقف').toBeTruthy()
  })

  it('والمفتاحُ يجمع النوعَ والرمزَ — فلا يخلط مسارٌ بدورةٍ حملت رمزَه', () => {
    expect(favoriteKey('pathway', 'X-1')).not.toBe(favoriteKey('course', 'X-1'))
    const set = favoriteKeySet([{ kind: 'course', refId: 'X-1' }])
    expect(set.has(favoriteKey('course', 'X-1'))).toBe(true)
    expect(set.has(favoriteKey('pathway', 'X-1')), 'رمزٌ واحدٌ بنوعَين يُقرأ واحدا').toBe(false)
  })
})

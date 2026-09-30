/* إصدارٌ من المتن لا يخرج بلا نقاطٍ تقول ما تغيّر فيه.
 *
 * ═══ العطبُ الذي يحرسه ═══
 *
 * العرضُ المرسَلُ صار يُحدَّث في مكانه، وتصل صاحبَه رسالةٌ تقول ما تبدّل
 * نقاطا. فمن رفع `CONTRACT_BODY_VERSION` ونسي نقاطَه أرسل إلى مدرّبٍ رسالةً
 * عنوانُها «حُدّث نصُّ عرضك» وقائمتُها **فارغة** — وهو أسوأُ من ألّا تصله:
 * يعرف أنّ شيئا تبدّل ولا يعرف ما هو، فيقرأ ثلاثمئة سطرٍ باحثا.
 *
 * ويقع صامتا: لا نوعَ يمنعه، ولا شاشةَ تُظهره — الرسالةُ تخرج والقائمةُ خالية.
 */

import { describe, expect, it } from 'vitest'
import { CONTRACT_BODY_VERSION } from '@/application/trainer/contract-body'
import {
  CONTRACT_CHANGELOG, changesForVersion, changesBetween,
} from '@/application/trainer/contract-changelog'

describe('لكلّ إصدارٍ نقاطُه', () => {
  it('⚠️ الإصدارُ الحاليُّ يحمل نقاطَه — وإلّا خرجت رسالةٌ بقائمةٍ خالية', () => {
    const pts = changesForVersion(CONTRACT_BODY_VERSION)
    expect(pts.length, `الإصدارُ «${CONTRACT_BODY_VERSION}» بلا نقاط —`
      + ' أضِفْها في `contract-changelog.ts` قبل أن يُرفَع').toBeGreaterThan(0)
  })

  it('والنقاطُ جملٌ تُقرأ لا أرقامَ بنودٍ عارية', () => {
    for (const v of CONTRACT_CHANGELOG) {
      expect(v.pointsAr.length, `«${v.version}» بلا نقاط`).toBeGreaterThan(0)
      for (const p of v.pointsAr) {
        expect(p.trim().length, `نقطةٌ أقصرُ من جملةٍ في «${v.version}»: «${p}»`).toBeGreaterThan(25)
        /* «تغيّر البند 4-1» وأمثالُها: رقمٌ بلا معنًى لمن يقرأ */
        expect(p, `نقطةٌ تقول رقمَ بندٍ ولا تقول ما صار: «${p}»`)
          .not.toMatch(/^(تغيّر|أُضيف|حُذف)\s+البند/)
      }
    }
  })

  it('ولا إصدارَ مكرَّرٌ في الجدول', () => {
    const vs = CONTRACT_CHANGELOG.map((c) => c.version)
    expect(new Set(vs).size, 'إصدارٌ مكرَّرٌ — فأيُّ نقاطه تُقرأ؟').toBe(vs.length)
  })
})

describe('وما بين إصدارَين يُجمَع، لا الأخيرُ وحدَه', () => {
  it('من كان على الإصدار الحاليّ لا يُقال له شيء', () => {
    expect(changesBetween(CONTRACT_BODY_VERSION, CONTRACT_BODY_VERSION)).toEqual([])
  })

  it('ومن كان على إصدارٍ أقدمَ يقرأ ما بينهما كلَّه', () => {
    const all = changesBetween(null, CONTRACT_BODY_VERSION)
    expect(all.length, 'لم يُقرأ شيءٌ لمن جاء من إصدارٍ لا نعرفه').toBeGreaterThan(0)
    /* وكلُّ نقاط الإصدار الحاليّ فيها — فلا يُقتطَع منه */
    for (const p of changesForVersion(CONTRACT_BODY_VERSION)) {
      expect(all, 'سقطت نقطةٌ من الإصدار الحاليّ').toContain(p)
    }
  })

  it('وإصدارٌ لا يعرفه الجدولُ لا يُخترَع له شيء', () => {
    expect(changesBetween(null, 'v99-لا-وجود-له')).toEqual([])
  })

  /* ═══ وصار الجدولُ الحقيقيُّ يشهد كذلك (٣٠ سبتمبر ٢٠٢٦) ═══

     منذ v18 فيه إصداران، فالجمعُ والاقتطاعُ يُقاسان على ما يُرسَل فعلا لا
     على جدولٍ مفتعَلٍ وحدَه. وهذه هي الحالةُ الواقعةُ بعينها: من يحمل عرضا
     مفتوحا على v17 ويُحدَّث في مكانه إلى v18. */
  it('⚠️ ومن كان على v17 يقرأ نقاطَ v18 وحدَها لا نقاطَ v17 معها', () => {
    const table = [...CONTRACT_CHANGELOG]
    if (table.length < 2) return
    const [newest, before] = table
    const only = changesBetween(before.version, newest.version)
    expect(only, 'لم تُقرأ نقاطُ الإصدار الأحدث').toEqual([...newest.pointsAr])
    for (const p of before.pointsAr) {
      expect(only, 'أُعيد على صاحبه ما قرأه في إصدارٍ سابق').not.toContain(p)
    }
  })

  /* ═══ الشاهدُ المضادّ: الجمعُ يُثبَت بجدولٍ من إصدارَين ═══
     وإلّا مرّ الفحصُ فوقَه على جدولٍ فيه واحدٌ، ولا يقول شيئا عن الجمع. */
  it('⚠️ والجمعُ يقع فعلا حين يكون بينهما إصداران', () => {
    const table = [
      { version: 'ب', pointsAr: ['نقطةُ ب'] },
      { version: 'أ', pointsAr: ['نقطةُ أ'] },
    ]
    const order = [...table].reverse()
    const between = (from: string | null, to: string) => {
      const toAt = order.findIndex((c) => c.version === to)
      if (toAt < 0) return []
      const fromAt = from ? order.findIndex((c) => c.version === from) : -1
      return order.slice(fromAt + 1, toAt + 1).flatMap((c) => c.pointsAr)
    }
    expect(between(null, 'ب'), 'لم تُجمَع نقاطُ الإصدارَين').toEqual(['نقطةُ أ', 'نقطةُ ب'])
    expect(between('أ', 'ب'), 'من كان على «أ» قُرئ له ما قرأه قبلُ').toEqual(['نقطةُ ب'])
  })
})

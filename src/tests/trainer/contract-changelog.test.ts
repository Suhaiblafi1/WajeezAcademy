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
  CONTRACT_CHANGELOG, CHANGE_TOPICS, changesForVersion, changesBetween, changeGroupsBetween,
} from '@/application/trainer/contract-changelog'

describe('لكلّ إصدارٍ نقاطُه', () => {
  it('⚠️ الإصدارُ الحاليُّ يحمل نقاطَه — وإلّا خرجت رسالةٌ بقائمةٍ خالية', () => {
    const pts = changesForVersion(CONTRACT_BODY_VERSION)
    expect(pts.length, `الإصدارُ «${CONTRACT_BODY_VERSION}» بلا نقاط —`
      + ' أضِفْها في `contract-changelog.ts` قبل أن يُرفَع').toBeGreaterThan(0)
  })

  it('والنقاطُ جملٌ تُقرأ لا أرقامَ بنودٍ عارية', () => {
    for (const v of CONTRACT_CHANGELOG) {
      expect(v.points.length, `«${v.version}» بلا نقاط`).toBeGreaterThan(0)
      for (const p of v.points.map((x) => x.textAr)) {
        expect(p.trim().length, `نقطةٌ أقصرُ من جملةٍ في «${v.version}»: «${p}»`).toBeGreaterThan(25)
        /* ═══ وحدٌّ أعلى كذلك (٣٠ سبتمبر ٢٠٢٦) ═══

           قال صاحبُ المنصّة: «النص طويل.. اختصره لانك تشرح باختصار ماذا
           تغير وليس نقل النصوص». وكانت نقاطُ v18 نقلا لنصّ البنود حرفا،
           فبلغت الرسالةُ سبعةَ عشرَ بندا لمن عرضُه قديم — ومن رأى ذلك لم
           يقرأ. فالنقطةُ شرحٌ يُقرأ في سطرٍ أو سطرَين لا بندٌ مُقتطَع. */
        /* وشُدّ الحدُّ إلى ١٢٠ (١ أكتوبر ٢٠٢٦): «النصوص طويلة وكثيرة… اختصرها» */
        expect(p.trim().length, `نقطةٌ أطولُ من شرحٍ يُقرأ في «${v.version}»: «${p}»`)
          .toBeLessThanOrEqual(120)
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
    expect([...only].sort(), 'لم تُقرأ نقاطُ الإصدار الأحدث').toEqual(newest.points.map((x) => x.textAr).sort())
    for (const p of before.points.map((x) => x.textAr)) {
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

/* ═══ وتُجمَع تحت بنودها، قصيرةً، بلا نقيض (١ أكتوبر ٢٠٢٦) ═══

   قولُ صاحب المنصّة عن رسالة إعادة التوقيع: «النصوص طويلة وكثيرة… أن نشير له
   بأنّا عدّلنا كذا وكذا باختصار… في بند الأتعاب تغيّر كذا». وكانت ثمانيا
   وعشرين نقطةً لمن وقّع v17، ونقطةُ رسوم الحوالة في v20 ينقضها v22. */
describe('أبوابُ التغيير', () => {
  const OLDEST = [...CONTRACT_CHANGELOG].reverse()[0].version
  const all = changeGroupsBetween(null, CONTRACT_BODY_VERSION)

  it('⚠️ تُجمَع تحت بنودها بترتيب البنود — وكلُّ نقطةٍ مرّةً واحدة', () => {
    const titles = all.map((g) => g.titleAr)
    const order = CHANGE_TOPICS.map((t) => t.titleAr).filter((t) => titles.includes(t))
    expect(titles, 'الأبوابُ بغير ترتيب البنود').toEqual(order)
    const flat = all.flatMap((g) => g.itemsAr)
    const every = CONTRACT_CHANGELOG.flatMap((v) => v.points.map((p) => p.textAr))
    expect([...flat].sort(), 'سقطت نقطةٌ أو تكرّرت حين جُمعت').toEqual([...every].sort())
  })

  it('⚠️ ومن وقّع أقدمَ إصدارٍ يقرأ قائمةً تُقرأ — لا ثمانيا وعشرين', () => {
    const n = changesBetween(OLDEST, CONTRACT_BODY_VERSION).length
    expect(n, `بلغت النقاطُ ${n} لمن وقّع «${OLDEST}»`).toBeLessThanOrEqual(16)
  })

  it('⚠️ ولا تبقى في v20 رسومُ الحوالة التي نسخها v22', () => {
    const v20 = changesForVersion('v20-2026-10-01').join(' ')
    expect(v20, 'عادت «الرسومُ تُقتطع» في v20 — تنقضها نقطةُ v22 بعدها').not.toMatch(/رسوم/)
    expect(changesForVersion('v22-2026-10-01').join(' ')).toContain('رسومُ مصرفنا على الحوالة صارت علينا')
  })

  /* وما قيل صريحا بأمرٍ لا يُختصَر حتّى يختفي */
  it('والنقصُ في v19 والاستردادُ من مستحقّاته في v18 باقيان صريحَين', () => {
    expect(changesForVersion('v19-2026-10-01').join(' ')).toContain('وهذا نقصٌ نقوله لك صريحا')
    const v18 = changesForVersion('v18-2026-09-30').join(' ')
    expect(v18).toContain('٣٠٠ دولار من مستحقّاتك')
  })

  it('ولا تبدأ نقطةٌ بواو العطف إلّا ما يُكمل نقطةً قبله في إصداره وبابه', () => {
    for (const v of CONTRACT_CHANGELOG) {
      v.points.forEach((p, i) => {
        if (!p.textAr.startsWith('و')) return
        const prev = v.points[i - 1]
        expect(prev?.topic, `«${p.textAr}» تعطف على ما ليس قبلها تحت بابها`).toBe(p.topic)
      })
    }
  })
})

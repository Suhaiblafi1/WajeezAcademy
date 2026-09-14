/* هندسةُ تأطير الصورة — قاعدتان لا تُريان بالنظر.

   ═══ الطلبُ الذي كُتبت له ═══

   قرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «اسمح للمستخدم أن يعمل زوم أو يحدّد
   المربّع الذي يريد أن يظهر بدلا من أن تكون الصورة صغيرة».

   فكان القصُّ من **وسط** الصورة دائما — تخمينٌ منّا عن إطارٍ يخصّ صاحبَه —
   وكانت الصورةُ دون ٤٠٠ بكسل تُردّ كلُّها.

   ═══ وما يُحرَس هنا ═══

   ١) **المُخرَجُ مربّعٌ ٥١٢ مهما كان الإطار.** الشاشةُ تعرضه دائرةً أو
      مربّعا، فمستطيلٌ يخرج مشوّها. ولا يُرى ذلك في المؤطِّر: صاحبُه يرى
      النافذةَ مربّعةً فيطمئنّ، والعيبُ في المُخرَج لا في المعاينة.

   ٢) **الإزاحةُ تُقصّ عند الحدّ.** من سحب الصورةَ أبعدَ من حافّتها يقف
      عندها، وإلّا اقتُطع ما وراء الصورة فرُسمت **حافّةٌ سوداء** في المُخرَج
      — وهي أسوأُ من إطارٍ سيّئ لأنّها تبدو عطبا في الموقع لا خيارا لصاحبها.

   وكلتاهما حسابٌ لا مظهر، فتُقاسان هنا لا بتجربةِ يد. */

import { describe, expect, it } from 'vitest'
import {
  cropRect, sourceSide, framingIsSoft, FRAMING_CENTER, PHOTO_MIN_SIDE, MAX_ZOOM,
} from '@/lib/prepare-image'

describe('المربّعُ المقتطَع يبقى داخلَ الصورة', () => {
  it('الوسطُ افتراضا — والضلعُ أقصرُ ضلعَي المصدر', () => {
    const r = cropRect(1200, 800, FRAMING_CENTER)
    expect(r.side).toBe(800)
    expect(r.sx).toBe(200) // (1200-800)/2
    expect(r.sy).toBe(0)
  })

  it('والسحبُ إلى أقصى اليمين يقف عند الحافّة لا بعدها', () => {
    const r = cropRect(1200, 800, { zoom: 1, offsetX: 99_999, offsetY: 0 })
    expect(
      r.sx + r.side,
      'خرج الاقتطاعُ عن عرض الصورة: تُرسم حافّةٌ سوداء في المُخرَج.',
    ).toBeLessThanOrEqual(1200)
    expect(r.sx).toBeGreaterThanOrEqual(0)
  })

  it('وإلى أقصى اليسار كذلك', () => {
    const r = cropRect(1200, 800, { zoom: 1, offsetX: -99_999, offsetY: 0 })
    expect(r.sx).toBe(0)
  })

  it('والرأسيُّ مثلُه في الاتّجاهَين', () => {
    const down = cropRect(800, 1200, { zoom: 1, offsetX: 0, offsetY: 99_999 })
    expect(down.sy + down.side).toBeLessThanOrEqual(1200)
    const up = cropRect(800, 1200, { zoom: 1, offsetX: 0, offsetY: -99_999 })
    expect(up.sy).toBe(0)
  })

  it('ومع التقريب يبقى داخلَ الحدود أيضا', () => {
    for (const zoom of [1, 1.5, 2.5, MAX_ZOOM]) {
      const r = cropRect(1000, 600, { zoom, offsetX: 99_999, offsetY: 99_999 })
      expect(r.sx).toBeGreaterThanOrEqual(0)
      expect(r.sy).toBeGreaterThanOrEqual(0)
      expect(r.sx + r.side).toBeLessThanOrEqual(1000)
      expect(r.sy + r.side).toBeLessThanOrEqual(600)
    }
  })
})

describe('التقريبُ يصغّر المأخوذَ من المصدر', () => {
  it('ضِعفُ التقريب نصفُ الضلع', () => {
    expect(sourceSide(1000, 600, 1)).toBe(600)
    expect(sourceSide(1000, 600, 2)).toBe(300)
  })

  it('والمقتطَعُ مربّعٌ دائما — طولُه عرضُه', () => {
    const r = cropRect(1000, 600, { zoom: 1.7, offsetX: 40, offsetY: -25 })
    /* `cropRect` يعطي ضلعا واحدا، فالمربّعُ مضمونٌ بنيةً لا بالمصادفة */
    expect(r.side).toBeGreaterThan(0)
    expect(sourceSide(1000, 600, 1.7)).toBe(r.side)
  })
})

describe('الحدّةُ تُقاس على المختار لا على الملفّ', () => {
  it('صورةٌ كبيرةٌ قُرّب فيها كثيرا: يُنبَّه ولا يُمنع', () => {
    /* ١٨٠٠ ÷ ٥ = ٣٦٠ — دون الحدّ حقّا. وكانت ٢٠٠٠ فأعطت ٤٠٠ بالضبط،
       فاخضرّ الحسابُ والاختبارُ يسأل عن «أقلَّ من» — خطأُ الاختبار لا الشيفرة. */
    const soft = framingIsSoft(1800, 1800, { zoom: MAX_ZOOM, offsetX: 0, offsetY: 0 })
    expect(sourceSide(1800, 1800, MAX_ZOOM)).toBeLessThan(PHOTO_MIN_SIDE)
    expect(soft, 'قُرّب حتّى صار المأخوذُ دون الحدّ ولم يُنبَّه').toBe(true)
  })

  it('وصورةٌ صغيرةٌ بلا تقريب: تمضي منبَّها لا مردودة', () => {
    expect(framingIsSoft(300, 300, FRAMING_CENTER)).toBe(true)
    /* والمهمُّ أنّها **تُقتطع** ولا تُرمى: هذا لبُّ الطلب */
    expect(cropRect(300, 300, FRAMING_CENTER).side).toBe(300)
  })

  it('وما بلغ الحدَّ يمضي صامتا', () => {
    expect(framingIsSoft(800, 800, FRAMING_CENTER)).toBe(false)
  })
})

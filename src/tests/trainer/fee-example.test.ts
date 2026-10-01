/* المثالُ الحسابيُّ الذي يرافق رابطَ التوقيع — ولا يدخل العقد.

   والمقيسُ هنا ما يجعله آمنا وصادقا في آنٍ واحد:

   · **المعادلةُ واحدة** — المثالُ يحسب بما يحسب به الكشف، وإلّا وعدنا برقمٍ
     ثمّ دفعنا غيرَه.
   · **ولا يُسمّى المقعدُ العامُّ «من تسويق الأكاديميّة»** — فالمحرّكُ لا يعرف
     ذلك: `general = total − referred`، ويدخله ما جاء به المدرّبُ نفسُه بلا
     رابطه، وما جاء برابط مدرّبٍ آخر.
   · **ولا مثالَ حيث لا يصحّ** — بلا قاعدةٍ، أو بنسبةٍ من الإيراد (رقمُها دالّةٌ
     في سعرٍ نملكه نحن)، أو بلا سعرِ إحالةٍ (فلا يُوعَد بقناةٍ لا تُحتسب).
   · **والعملةُ من القاعدة** لا كلمةٌ مكتوبة. */

import { describe, expect, it } from 'vitest'
import { buildFeeExampleAr } from '@/application/trainer/fee-example'
import { perSeatBreakdown } from '@/application/trainer/seat-fee'
import type { ContractCompensation } from '@/application/trainer/contract-body'

const perSeat = (over: Partial<ContractCompensation> = {}): ContractCompensation => ({
  type: 'per_seat', rate: '25.00', currency: 'USD', minSeats: 8, referralRate: '30.00', ...over,
})

/** وكلُّ شعبةٍ في هذه الجولة انعقدت، إلّا ما يُقال فيه خلافُ ذلك صريحا */
const seats = (over: Omit<Parameters<typeof perSeatBreakdown>[0], 'cohortStarted'>) =>
  perSeatBreakdown({ ...over, cohortStarted: true })

describe('معادلةُ المقاعد — تطبيقٌ واحدٌ يقرؤه الكشفُ والشاشةُ والمثال', () => {
  /* ═══ الأرضيّةُ أرضيّةُ مالٍ لا أرضيّةُ مقاعد (١ أكتوبر ٢٠٢٦) ═══

     كانت `max(general, minSeats − referred) × rate + referred × referralRate`
     فتعطي هذه الحالةَ ٢١٠، وصارت `max(ما سجّل، minSeats × rate)` فتعطي ٢٠٠.
     وقرارُ صاحب المنصّة وعلّتُه في رأس `seat-fee.ts`. */
  it('⚠️ الأرضيّةُ تُكمِّل المالَ ولا تنفخ عددَ المقاعد', () => {
    const b = seats({ general: 3, referred: 2, rate: 25, referralRate: 30, minSeats: 8 })
    expect(b.generalSeats, 'نُفخ العامُّ إلى عدد الأرضيّة').toBe(3)
    expect(b.billedSeats, 'المحتسَبُ عددُ الأرضيّة لا عددُ المسجّلين').toBe(5)
    expect(b.generalAmount + b.referralAmount, 'ما سجّل بمصدره').toBe(135)
    expect(b.floorTopUp, 'التكملةُ ليست فرقَ ما سجّل والأرضيّة').toBe(65)
    expect(b.total, 'المجموعُ ليس الأرضيّة').toBe(200)
    expect(b.floorApplied).toBe(true)
  })

  /* ═══ ولا أرضيّةَ لشعبةٍ لم تبدأ ═══
     بلا هذا تدفع الأرضيّةُ ٢٠٠ عن شعبةٍ فارغةٍ أُلغيت. */
  it('⚠️ وشعبةٌ لم تبدأ لا أرضيّةَ لها — فلا تُدفَع عن فراغ', () => {
    const open = perSeatBreakdown({
      general: 3, referred: 2, rate: 25, referralRate: 30, minSeats: 8, cohortStarted: false,
    })
    expect(open.total, 'طُبّقت الأرضيّةُ على شعبةٍ لم تنعقد').toBe(135)
    expect(open.floorTopUp).toBe(0)
    expect(open.floorApplied).toBe(false)

    const empty = perSeatBreakdown({
      general: 0, referred: 0, rate: 25, referralRate: 30, minSeats: 8, cohortStarted: false,
    })
    expect(empty.total, 'شعبةٌ فارغةٌ لم تبدأ تُدفَع عنها الأرضيّة').toBe(0)
  })

  /* ═══ و«طُبّقت الأرضيّة» تعني أنّ مالا كُمّل، لا أنّ المسجّلين أقلُّ من العدد ═══

     وكانت تعني الثانيةَ: فسبعةٌ عبر رابطه بمئتَين وعشرةٍ تُطبَع في كشفه
     «طُبّق الحدُّ الأدنى» ولم يُكمَّل فيها دولارٌ واحد. */
  it('⚠️ والعلامةُ على تكملةٍ وقعت لا على عددٍ قصر', () => {
    const b = seats({ general: 0, referred: 7, rate: 25, referralRate: 30, minSeats: 8 })
    expect(b.billedSeats, 'المسجّلون ليسوا أقلَّ من العدد — فالفحصُ على لا شيء')
      .toBeLessThan(8)
    expect(b.total, 'ما سجّل يفوق الأرضيّةَ فلا تُكمَّل').toBe(210)
    expect(b.floorTopUp).toBe(0)
    expect(b.floorApplied, 'قيلت «كُمّلت» ولم يُكمَّل شيء').toBe(false)
  })

  it('ومن بلغ الحدَّ بإحالاته لا يُضاعَف له العامّ', () => {
    const b = seats({ general: 10, referred: 10, rate: 25, referralRate: 30, minSeats: 8 })
    expect(b.generalSeats).toBe(10)
    expect(b.floorApplied).toBe(false)
    expect(b.total).toBe(550)
  })

  it('وبلا سعرِ إحالةٍ يُحتسب المقعدُ المحال بالسعر العامّ', () => {
    const b = seats({ general: 4, referred: 2, rate: 25, referralRate: null, minSeats: 0 })
    expect(b.referralAmount).toBe(50)
    expect(b.total).toBe(150)
  })

  /* ═══ وتحت الأرضيّة لا يزيد مقعدُ الرابط شيئا — وقد قُرّر على بيّنة ═══

     كانت قيمتُه الحدّيّةُ فرقَ السعرَين (خمسةً هنا)، فصارت صفرا حتّى يتجاوز
     المجموعُ الأرضيّةَ. وهو أثرٌ قيل لصاحب المنصّة صريحا فأمضى القرار، ويُثبَت
     هنا كي لا يُكتشَف في مادّةٍ تسويقيّةٍ تَعِد بما لا يقع. */
  it('⚠️ وتحت الأرضيّة لا يزيد المقعدُ المحالُ المجموعَ شيئا', () => {
    const before = seats({ general: 3, referred: 1, rate: 25, referralRate: 30, minSeats: 8 })
    const after = seats({ general: 3, referred: 2, rate: 25, referralRate: 30, minSeats: 8 })
    expect(before.total, 'الحالةُ الأولى فوق الأرضيّة — فالفحصُ ليس تحتها').toBe(200)
    expect(after.total - before.total, 'زاد المقعدُ المحالُ المجموعَ تحت الأرضيّة').toBe(0)

    /* وفوقها يزيد بسعره كاملا — فالصفرُ أعلاه حكمُ الأرضيّة لا عطبٌ في الجمع */
    const over = seats({ general: 10, referred: 1, rate: 25, referralRate: 30, minSeats: 8 })
    const overPlus = seats({ general: 10, referred: 2, rate: 25, referralRate: 30, minSeats: 8 })
    expect(overPlus.total - over.total).toBe(30)
  })
})

describe('المثالُ يُبنى من أرقامه هو، ولا يُبنى حيث لا يصحّ', () => {
  it('يخرج ثلاثةَ صفوفٍ ومجموعا، والأرقامُ من المعادلة لا من حسابٍ ثانٍ', () => {
    const ex = buildFeeExampleAr(perSeat())!
    expect(ex, 'لا مثالَ أصلا').toBeTruthy()
    expect(ex.rows).toHaveLength(3)
    const expected = [
      seats({ general: 20, referred: 0, rate: 25, referralRate: 30, minSeats: 8 }).total,
      seats({ general: 10, referred: 10, rate: 25, referralRate: 30, minSeats: 8 }).total,
      seats({ general: 0, referred: 20, rate: 25, referralRate: 30, minSeats: 8 }).total,
    ]
    expect(ex.rows.map((r) => r.amount)).toEqual(expected)
    expect(ex.total).toBe(expected.reduce((a, b) => a + b, 0))
  })

  it('ولا يسمّي المقعدَ العامَّ «من تسويق الأكاديميّة» — فذاك وصفٌ لا يحسبه المحرّك', () => {
    const ex = buildFeeExampleAr(perSeat())!
    const all = [...ex.rows.map((r) => r.labelAr), ex.noteAr].join(' ')
    expect(all, 'العامُّ نُسب إلى حملةٍ تسويقيّة').not.toMatch(/تسويق|حمل(ة|ات)|إعلان/)
    expect(all, 'لم يُعرَّف العامُّ بما هو عليه فعلا').toMatch(/لم يسجّل عبر رابطك/)
  })

  it('ويقول إنّ الأعداد افتراضٌ ولا تَعِد بشيء، وإنّ الاتفاقيةَ هي الملزِمة', () => {
    const note = buildFeeExampleAr(perSeat())!.noteAr
    expect(note, 'لا تنويهَ بأنّ الأعداد افتراض').toMatch(/مفترضة/)
    expect(note, 'لا نفيَ للوعد بعددِ مسجّلين').toMatch(/لا تعِد/)
    expect(note, 'لم يُقل إنّ الاتفاقيةَ هي الملزِمة').toMatch(/الاتفاقيةُ وملاحقُها/)
  })

  it('والعملةُ من القاعدة لا كلمةً مكتوبة', () => {
    const ex = buildFeeExampleAr(perSeat({ currency: 'JOD' }))!
    expect(ex.currency, 'عملةٌ غيرُ عملة القاعدة').toBe('JOD')
    expect(JSON.stringify(ex), 'اسمُ عملةٍ مكتوبٌ حرفا في المولِّد').not.toMatch(/دولار/)
  })

  it('وبلا سعرِ إحالةٍ لا يُذكر الرابطُ أصلا — فلا يُوعَد بقناةٍ لا تُحتسب', () => {
    const ex = buildFeeExampleAr(perSeat({ referralRate: null }))!
    const all = [...ex.rows.map((r) => r.labelAr), ex.noteAr].join(' ')
    expect(all).not.toMatch(/رابط/)
  })

  it('وثلاثةٌ لا مثالَ لها: بلا قاعدةٍ، ونسبةُ الإيراد، وسعرٌ غيرُ صالح', () => {
    expect(buildFeeExampleAr(null)).toBeNull()
    expect(buildFeeExampleAr(perSeat({ type: 'revenue_share', rate: '40' }))).toBeNull()
    expect(buildFeeExampleAr(perSeat({ rate: '0' }))).toBeNull()
  })

  it('والثابتُ لكلّ شعبةٍ يخرج بلا افتراضِ مسجّلين أصلا', () => {
    const ex = buildFeeExampleAr(perSeat({ type: 'fixed_per_cohort', rate: '400', referralRate: null }))!
    expect(ex.total).toBe(1200)
    const all = [...ex.rows.map((r) => r.labelAr), ex.noteAr].join(' ')
    expect(all, 'ثابتٌ لكلّ شعبةٍ ومع ذلك افترض عددَ مسجّلين').not.toMatch(/مسجّلا:|عبر رابط/)
  })
})

/* ═══ دورةٌ واحدةٌ بعشرين مسجّلا، وثلاثةُ مصادر ═══

   قرارُ صاحب المنصّة (٢٣ سبتمبر ٢٠٢٦). وكان المثالُ ثلاثَ شعبٍ بأعدادٍ
   مختلفة، فيقارن القارئُ رقمَين يختلفان في شيئين معا — العددِ والمصدر — ولا
   يعزل أثرَ أيّهما. فثُبّت العددُ وتغيّر المصدرُ وحدَه: ما يراه هو ثمنُ
   رابطه صافيا، وهو الدرسُ المقصود. */
describe('مثالُ الدورة الواحدة بثلاثة مصادر', () => {
  const c = { type: 'per_seat', rate: '30', currency: 'USD', minSeats: 8, referralRate: '45' }

  it('ثلاثةُ صفوفٍ لدورةٍ واحدةٍ بعشرين مقعدا: ٦٠٠ · ٧٥٠ · ٩٠٠', () => {
    const ex = buildFeeExampleAr(c)!
    expect(ex.rows.map((r) => r.amount)).toEqual([600, 750, 900])
    expect(
      ex.rows.map((r) => r.seats),
      'العشرون ثابتةٌ في الصفوف الثلاثة — المتغيّرُ مصدرُهم لا عددُهم',
    ).toEqual([20, 20, 20])
    expect(ex.rows.map((r) => r.referred)).toEqual([0, 10, 20])
  })

  it('والحدُّ الأدنى لا يُطبَّق في أيّ صفّ — فهو على مجموع المقاعد المحتسَبة لا على العامّة وحدَها', () => {
    const ex = buildFeeExampleAr(c)!
    expect(ex.rows.some((r) => r.floorApplied)).toBe(false)
  })

  it('وسعرُ الإحالة الأعلى يعطي الصفَّ الأعلى — وإلّا انقلب الحافز', () => {
    const [general, mixed, referred] = buildFeeExampleAr(c)!.rows.map((r) => r.amount)
    expect(general).toBeLessThan(mixed)
    expect(mixed).toBeLessThan(referred)
  })

  it('ولا يُسمَّى الصفُّ شعبةً — فالمثالُ صار دورةً واحدةً لا ثلاثَ شعب', () => {
    const ex = buildFeeExampleAr(c)!
    expect(
      ex.rows.map((r) => r.labelAr).join(' '),
      'بقيت تسميةُ الشعب وقد صار المثالُ دورةً واحدة',
    ).not.toMatch(/الشعبة/)
  })
})

describe('وبلا سعرِ إحالةٍ لا يُبنى مثالُ المصادر أصلا', () => {
  /* أُدخل هذا العطبُ فعلا عند تغيير المثال: صارت التسميةُ تقول «عبر رابط
     إحالتك» لمن لا سعرَ إحالةٍ له — وعدٌ بقناةٍ لا تُحتسب. وأمسكه الحارسُ
     القائمُ، فأُضيف هذا معه ليقول لمَ صفٌّ واحدٌ لا ثلاثة. */
  it('صفٌّ واحدٌ لا ثلاثةٌ متطابقة، ولا ذكرَ لرابطٍ لا يزيده شيئا', () => {
    const ex = buildFeeExampleAr({
      type: 'per_seat', rate: '30', currency: 'USD', minSeats: 8, referralRate: null,
    })!
    expect(ex.rows, 'ثلاثةُ صفوفٍ متطابقةٍ تقول شيئا واحدا ثلاثَ مرّات').toHaveLength(1)
    expect(ex.rows[0].amount).toBe(600)
    expect([...ex.rows.map((r) => r.labelAr), ex.noteAr].join(' ')).not.toMatch(/رابط/)
  })
})

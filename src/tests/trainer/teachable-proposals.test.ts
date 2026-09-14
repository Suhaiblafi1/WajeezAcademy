/* دوراتٌ يقترحها المتقدّم — سجلّاتٌ لا فقرة (أ-٣).

   شكوى ١٣ سبتمبر ٢٠٢٦: «لتصبح مقروءة واحدة تلو الأخرى ليس نصاً». وكان
   الحقلُ فقرةً حرّةً بتلميحٍ يرجو أن يكتب «عنوانا لكل سطر» — والرجاءُ ليس
   بنية.

   والقراراتُ هنا لا في الشاشة، فهي ما يُفحَص: ما الصفُّ المكتوب، وكم
   يُقبل، وماذا يُحذف قبل الإرسال، وكيف يُقرأ عمودٌ مشوَّهٌ بلا أن يسقط
   ما فوقه. */

import { describe, expect, it } from 'vitest'
import {
  MAX_PROPOSALS, cleanProposals, emptyProposal, hasProposal,
  proposalLine, proposalWritten, readProposals, teachableCountAr,
} from '@/application/trainer/teachable-proposals'

const p = (titleAr: string, audienceAr = '') => ({ titleAr, audienceAr })

describe('ما يُعدّ اقتراحا', () => {
  it('⚠️ العنوانُ يلزم ومن هو لا يلزم — فلا يُخسَر اقتراحٌ عند حقلٍ ثانٍ', () => {
    expect(proposalWritten(p('تحليلُ تكلفة الاستحواذ'))).toBe(true)
    expect(proposalWritten(p('تحليلُ تكلفة الاستحواذ', 'لمدراء التسويق'))).toBe(true)
    expect(proposalWritten(p('', 'لمدراء التسويق')), 'جمهورٌ بلا عنوانٍ صار اقتراحا').toBe(false)
  })

  it('⚠️ والفراغُ ليس كتابةً — وإلّا مرّ «تمّ ملؤه» على نموذجٍ فارغ', () => {
    for (const blank of ['', '   ', '\n', '\t  \n']) {
      expect(proposalWritten(p(blank)), JSON.stringify(blank)).toBe(false)
    }
    expect(hasProposal([emptyProposal(), emptyProposal()])).toBe(false)
    expect(hasProposal([emptyProposal(), p('دورة')])).toBe(true)
  })
})

describe('ما يُرسَل إلى الخادم', () => {
  it('⚠️ الصفوفُ الفارغةُ تسقط — فلا تُخزَّن صفوفٌ لا شيءَ فيها', () => {
    /* الشاشةُ تبدأ بصفٍّ فارغٍ وتضيف صفوفا؛ ومن أرسلها كما هي خزّن فراغا. */
    const out = cleanProposals([p('دورةٌ أولى', 'لمدراء'), emptyProposal(), p('  ')])
    expect(out).toEqual([{ titleAr: 'دورةٌ أولى', audienceAr: 'لمدراء' }])
  })

  it('والأطرافُ تُشذَّب في الحقلين معا', () => {
    expect(cleanProposals([p('  دورة  ', '  لمن  ')])).toEqual([{ titleAr: 'دورة', audienceAr: 'لمن' }])
  })

  it('⚠️ والسقفُ عشرون — فمن جاوزها يُفرغ سيرتَه لا يقترح', () => {
    /* الرقمُ مكتوبٌ هنا باليد ولا يُقرأ من الوحدة بقصد: لو قُرئ منها لارتفع
       التوقّعُ مع السقف، ومرّ الحارسُ خضراءَ على رفعٍ لم يره أحد — وهو
       صنفُ الحارس الذي يمنعه دفترُ العمل. فمن أراد سقفا آخرَ بدّله هنا
       صراحةً، ورآه يسقط قبل أن يُبدّله. */
    expect(MAX_PROPOSALS, 'تغيّر السقفُ بلا قرارٍ مكتوب').toBe(20)
    const many = Array.from({ length: 27 }, (_, i) => p(`دورة ${i}`))
    expect(cleanProposals(many)).toHaveLength(20)
  })

  it('⚠️ وما طال يُقصّ ولا يُرَدّ — فلا يسقط الطلبُ كلُّه بحقلٍ طويل', () => {
    const long = 'ن'.repeat(500)
    const [only] = cleanProposals([p(long, long)])
    expect(only.titleAr.length).toBe(200)
    expect(only.audienceAr.length).toBe(200)
  })

  it('ولا يُغيَّر ترتيبُ ما كتبه — هو رتّبها بقصد', () => {
    const rows = [p('ثالثة'), p('أولى'), p('ثانية')]
    expect(cleanProposals(rows).map((x) => x.titleAr)).toEqual(['ثالثة', 'أولى', 'ثانية'])
  })
})

describe('قراءةُ العمود من القاعدة', () => {
  it('⚠️ وما ليس مصفوفةَ كائناتٍ يُقرأ فارغا — لا يُسقط شاشةَ المعتمِد', () => {
    /* العمودُ `Json?` يقبل أيَّ شكل: طلبٌ قديم، أو كتابةٌ يدويّة، أو صيغةٌ
       تغيّرت. ومن قرأه بلا فحصٍ أسقط الشاشةَ بحقلٍ واحدٍ مشوَّه. */
    for (const bad of [null, undefined, 'نصّ', 7, {}, [null], ['نصّ'], [{ x: 1 }]]) {
      expect(readProposals(bad), JSON.stringify(bad)).toEqual([])
    }
  })

  it('وما كان سليما يُقرأ مشذَّبا', () => {
    expect(readProposals([{ titleAr: ' دورة ', audienceAr: ' لمن ' }, { titleAr: '' }]))
      .toEqual([{ titleAr: 'دورة', audienceAr: 'لمن' }])
  })
})

describe('السطرُ كما يُقرأ', () => {
  it('«العنوان — لمن هو»، وبلا جمهورٍ فالعنوانُ وحدَه بلا شَرطةٍ معلَّقة', () => {
    expect(proposalLine(p('دورة', 'لمدراء'))).toBe('دورة — لمدراء')
    expect(proposalLine(p('دورة')), 'بقيت شَرطةٌ بلا ما بعدها').toBe('دورة')
  })
})

/* ═══ «دوراتٌ يصلح لها» في شريط الحقائق ═══

   ─────────── العطبُ الذي كُتب له ───────────

   كان الشريطُ يقرأ `teachableCourseIds.length` وحدَه. ووقع ذلك على أوّل
   مدرّبةٍ حقيقيّةٍ في المنصّة: ثماني دوراتٍ في ملفّها كتبتها بقلمها، وشريطُ
   الحقائق يقول «٠ دوراتٌ يصلح لها» — أي «لا تصلح لشيء».

   ورقمٌ كاذبٌ في أوّل ما تقع عليه العين أسوأُ من غياب الرقم: الشريطُ بُني
   ليُقرأ بنظرةٍ قبل القرار، فمن قرأه ولم يفتح الملفَّ قرّر على كذبة. */
describe('عددُ ما يصلح له — ولا رقمَ يكذب', () => {
  it('⚠️ من كتب بقلمه ولم يختر من الكتالوج لا يُقال عنه «٠»', () => {
    expect(teachableCountAr({ teachableOther: 'ثماني دوراتٍ في فقرةٍ واحدة' })).toBe('بقلمه')
  })

  it('والاقتراحاتُ تُعدّ مع اختيارات الكتالوج لا بدلا عنها', () => {
    expect(teachableCountAr({
      teachableCourseIds: ['C-BIZ-101', 'C-BIZ-103'],
      teachableProposals: [{ titleAr: 'دورةٌ مقترحة' }],
    })).toBe('3')
  })

  it('ومن سمّى فقرتَه صفوفا صار يُعدّ — فالمحرّرُ يُصلح الرقمَ من نفسه', () => {
    const before = { teachableOther: 'ريادةُ الأعمال · التسعير · إدارةُ المشاريع' }
    expect(teachableCountAr(before)).toBe('بقلمه')
    expect(teachableCountAr({
      ...before,
      teachableProposals: [{ titleAr: 'ريادةُ الأعمال' }, { titleAr: 'التسعير' }, { titleAr: 'إدارةُ المشاريع' }],
    })).toBe('3')
  })

  it('ولا يُخمَّن عددٌ من فقرة — «١» عن ثمانٍ ليست أصدقَ من «٠»', () => {
    /* التخمينُ يعيد العطبَ بصورةٍ أخرى، فالنصُّ يبقى نصّا حتّى يُسمّى */
    expect(teachableCountAr({ teachableOther: 'سطرٌ\nوسطرٌ\nوسطرٌ ثالث' })).toBe('بقلمه')
  })

  it('ومن لم يكتب شيئا ولم يختر فصفرٌ صادق', () => {
    expect(teachableCountAr({})).toBe('0')
    expect(teachableCountAr({ teachableCourseIds: [], teachableOther: '   ' })).toBe('0')
  })

  it('وعمودٌ مشوَّهٌ لا يُسقط الشريطَ ولا يُنفخ الرقم', () => {
    expect(teachableCountAr({ teachableProposals: 'ليست مصفوفة' })).toBe('0')
    expect(teachableCountAr({ teachableProposals: [{ titleAr: '  ' }, null, 7] })).toBe('0')
  })
})

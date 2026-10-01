/* ما تغيّر في شروطه هو — `personalChangesAr`.
 *
 * يقرؤها الخادمُ لما يُرسَل في رسالة «أعِدْه للتوقيع»، والشاشةُ لما تُعاينه.
 * والقسمُ الذي تقع فيه لا يُحذَف (علّتُه في `contract-resign.ts`): فما لا تقوله
 * هذه الدالّةُ لا يصل المدرّبَ، وما تقوله زورا يصله خبرا عن تغييرٍ لم يقع.
 */

import { describe, expect, it } from 'vitest'
import { personalChangesAr, type ResignTerms } from '@/application/trainer/contract-resign'

const FEE = { type: 'per_seat', rate: '25', currency: 'USD', minSeats: 0, referralRate: '30' }
const A = { courseId: 'C-A', titleAr: 'دورةُ التحليل' }
const B = { courseId: 'C-B', titleAr: 'دورةُ الإدارة' }
const base: ResignTerms = { compensation: FEE, courses: [A], specialTermsAr: 'بندٌ أوّل' }

describe('ما تغيّر في شروطه هو', () => {
  it('لا شيءَ تغيّر — لا سطر', () => {
    expect(personalChangesAr(base, { ...base })).toEqual([])
  })

  it('والأجرُ يُقابَل بأرقامه: «25» و«25.00» أجرٌ واحد', () => {
    const same = { ...base, compensation: { ...FEE, rate: '25.00', referralRate: '30.0' } }
    expect(personalChangesAr(base, same), 'قيل له إنّ أجرَه تغيّر ولم يتغيّر').toEqual([])
  })

  /* ═══ والأجرُ جملةٌ قصيرةٌ لا البندُ مرّتين (١ أكتوبر ٢٠٢٦) ═══
     كانت «كان: <البندُ كاملا> وصار: <البندُ كاملا>» — فقرأ صاحبُ المنصّة «$25» ثمّ
     «$28» وظنّ أنّ العقدَ يقول الرقمين. وقولُه: «لا داعي لأن نعطيه النصَّ الجديد،
     فقط نكتفي بأنّا رفعنا قيمةَ المقعد الذي تحصل عليه من رابطك». */
  it('⚠️ أجرُ رابط الدعوة: من كم إلى كم — في سطرٍ قصيرٍ لا البندُ مرّتين', () => {
    const lines = personalChangesAr(base, { ...base, compensation: { ...FEE, referralRate: '35' } })
    expect(lines).toEqual(['رفعنا أجرَ المقعد الذي يأتيك عبر رابط دعوتك: من $30 إلى $35.'])
  })

  it('⚠️ والنزولُ يُقال صريحا كما يُقال الصعود', () => {
    expect(personalChangesAr(base, { ...base, compensation: { ...FEE, referralRate: '28' } }))
      .toEqual(['خفّضنا أجرَ المقعد الذي يأتيك عبر رابط دعوتك: من $30 إلى $28.'])
  })

  it('والعامُّ والحدُّ الأدنى كلٌّ في سطره — والأعلى أوّلا كما في العقد', () => {
    const was = { ...base, compensation: { ...FEE, minSeats: 10 } }
    const lines = personalChangesAr(was, { ...was, compensation: { ...FEE, minSeats: 10, rate: '30', referralRate: '40' } })
    expect(lines).toEqual([
      'رفعنا أجرَ المقعد الذي يأتيك عبر رابط دعوتك: من $30 إلى $40.',
      'رفعنا أجرَ المقعد العامّ (من جاء من تسويقنا): من $25 إلى $30.',
      'رفعنا حدَّك الأدنى المضمونَ عن الشعبة: من $250 إلى $300.',
    ])
  })

  it('وأساسٌ آخرُ كلُّه يُقال باسمه — لا رقمٌ يُقابَل بغير جنسه', () => {
    expect(personalChangesAr(base, {
      ...base, compensation: { type: 'fixed_per_cohort', rate: '400', currency: 'USD', minSeats: null, referralRate: null },
    })).toEqual(['صار أساسُ أتعابك «ثابت لكل شعبة» — وأرقامُه في الملحق (ب).'])
  })

  it('⚠️ ولا يُعاد البندُ في سطر الأجر أبدا — أيًّا كان ما تغيّر', () => {
    const variants = [
      { referralRate: '45' }, { referralRate: null }, { rate: '10' }, { minSeats: 12 }, { rate: '40', minSeats: 8, referralRate: '50' },
    ]
    for (const v of variants) {
      for (const line of personalChangesAr(base, { ...base, compensation: { ...FEE, ...v } })) {
        expect(line, `أُعيد نصُّ البند في سطر الأجر: «${line}»`).not.toMatch(/تحتسب أتعاب|كان:|وصار:/)
        expect(line.length, `سطرُ الأجر أطولُ من سطر: «${line}»`).toBeLessThanOrEqual(120)
      }
    }
  })

  it('والدوراتُ: ما أُضيف وما رُفع، كلٌّ في سطره', () => {
    expect(personalChangesAr(base, { ...base, courses: [B] })).toEqual([
      'أُضيف إلى الدورات المؤهَّل لها (الملحق أ): دورةُ الإدارة.',
      'ورُفع من الدورات المؤهَّل لها (الملحق أ): دورةُ التحليل.',
    ])
  })

  it('والبنودُ الخاصّة: تُضاف وتُرفع وتتغيّر — ثلاثُ جملٍ لا واحدة', () => {
    expect(personalChangesAr({ ...base, specialTermsAr: null }, base))
      .toEqual(['وأُضيفت إلى عقدك بنودٌ خاصّةٌ بك (البند 21) — اقرأها في العقد.'])
    expect(personalChangesAr(base, { ...base, specialTermsAr: null }))
      .toEqual(['ورُفعت من عقدك البنودُ الخاصّةُ بك (البند 21).'])
    expect(personalChangesAr(base, { ...base, specialTermsAr: 'بندٌ آخر' }))
      .toEqual(['وتغيّرت البنودُ الخاصّةُ بك (البند 21) — اقرأها في العقد.'])
  })
})

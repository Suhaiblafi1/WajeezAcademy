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

  it('وتغيُّرُ الأجر يُقال بما كان وما صار', () => {
    const lines = personalChangesAr(base, { ...base, compensation: { ...FEE, rate: '40' } })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^تغيّر أساسُ أتعابك \(الملحق ب\) — كان: .+ وصار: .+/)
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

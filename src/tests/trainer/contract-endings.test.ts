/* النهاياتُ الثلاث في صفحة التوقيع.

   كانت اثنتين — يوقّع أو يعتذر — فمن أراد تغييرَ بندٍ واحدٍ لم يجد إلّا
   الاعتذارَ أو التوقيعَ على ما لا يرضاه. والعقدُ عرضٌ يُفاوَض. */

import { describe, expect, it } from 'vitest'
import {
  canRespondToContract, CONTRACT_OPEN_STATUSES, isAmendmentRequested,
} from '@/application/trainer/contract-endings'

describe('النهاياتُ الثلاث', () => {
  it('١) المُرسَلُ وحدَه يُوقَّع أو يُعتذَر عنه أو يُطلَب تعديلُه', () => {
    expect(canRespondToContract('sent')).toBe(true)
    expect([...CONTRACT_OPEN_STATUSES]).toEqual(['sent'])
  })

  it('٢) وطلبُ التعديل يوقف التوقيع — وهو لبُّ النهاية الثانية', () => {
    expect(
      canRespondToContract('amendment_requested'),
      'لو جاز التوقيعُ بعد طلب التعديل لَما أوقفه شيء، ولَوقّع على ما طلب تغييرَه',
    ).toBe(false)
    expect(isAmendmentRequested('amendment_requested')).toBe(true)
  })

  it('٣) ولا يُستجاب لموقَّعٍ ولا ملغًى ولا معتذَرٍ عنه ولا مسودّة', () => {
    const closed = ['signed', 'countersigned', 'declined', 'revoked', 'expired', 'terminated', 'superseded', 'draft']
    const wrong = closed.filter((s) => canRespondToContract(s))
    expect(wrong, 'حالةٌ مغلقةٌ تقبل ردّا').toEqual([])
  })

  it('٤) والقائمةُ مصدرُ الحقيقة — فلا يُكرَّر الشرطُ في الخادم والشاشة فيفترقان', () => {
    for (const s of [...CONTRACT_OPEN_STATUSES]) expect(canRespondToContract(s)).toBe(true)
  })

  it('٥) وطلبُ التعديل ليس اعتذارا — فالعقدُ باقٍ ينتظر نسخةً مصحّحة', () => {
    expect(isAmendmentRequested('declined')).toBe(false)
    expect(isAmendmentRequested('sent')).toBe(false)
  })
})

/* النهاياتُ الثلاث في صفحة التوقيع.

   كانت اثنتين — يوقّع أو يعتذر — فمن أراد تغييرَ بندٍ واحدٍ لم يجد إلّا
   الاعتذارَ أو التوقيعَ على ما لا يرضاه. والعقدُ عرضٌ يُفاوَض. */

import { describe, expect, it } from 'vitest'
import {
  canRespondToContract, CONTRACT_OPEN_STATUSES, isAmendmentRequested,
  CONTRACT_CLOSED_STATUSES, isContractClosed,
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

  /* ═══ ٦) وما أُغلق لا قرارَ فيه — عطبُ ٢٦ سبتمبر ٢٠٢٦ ═══

     لوحةُ مقابلة الاسمَين في شاشة العقود كانت ترسم على كلِّ عقدٍ موقَّعٍ
     نصيحةً واحدة: «فاردُدِ التوقيعَ، ويُركَّب بديلٌ باسمه» — بما فيه
     المغلَق. وفي عقدٍ ملغًى أو مفسوخٍ لا توقيعَ يُردّ.

     و`revoked` و`terminated` هما حالُ ما بين يدَي صاحب المنصّة حين سأل، فلو
     سقطتا من القائمة لَعاد العطبُ على الصفوف التي وُلد منها بعينها. */
  it('٦) الملغى والمفسوخ والمعتذَرُ عنه والمنتهي والمُستبدَلُ: أُغلقت', () => {
    for (const st of ['revoked', 'terminated', 'declined', 'expired', 'superseded']) {
      expect(isContractClosed(st), `حالةٌ مغلقةٌ قُرئت مفتوحة: ${st}`).toBe(true)
    }
  })

  it('٧) والمسودّةُ والمرسَلُ والموقَّعُ والنافذُ والموقوفُ على تعديل: مفتوحة', () => {
    /* وكلُّها يُتَّخذ فيها قرار: تُرسَل، أو تُلغى، أو تُعتمَد، أو يُردّ
       توقيعُها، أو يُجاب طلبُ تعديلها. */
    for (const st of ['draft', 'sent', 'signed', 'countersigned', 'amendment_requested']) {
      expect(isContractClosed(st), `حالةٌ مفتوحةٌ قُرئت مغلقة: ${st}`).toBe(false)
    }
  })

  it('٨) وهذا الحكمُ غيرُ حكمِ «ما مسّه توقيعٌ» — ويفترقان في الطرفين', () => {
    /* ولو خُلطا لَاختفى زرُّ الحذف عن ملغًى لم يوقّعه أحد، أو لَظهر الأمرُ
       بردّ توقيعٍ على عقدٍ ينتظر اعتمادَنا. */
    expect(isContractClosed('revoked'), 'ملغًى لم يوقّعه أحدٌ: مغلَقٌ ومع ذلك يُحذَف').toBe(true)
    expect(isContractClosed('signed'), 'موقَّعٌ ينتظر اعتمادَنا: مفتوحٌ ومع ذلك لا يُحذَف').toBe(false)
  })

  it('٩) والقائمةُ هي مرجعُ الدالّة — فلا تفترق عنها', () => {
    for (const st of [...CONTRACT_CLOSED_STATUSES]) expect(isContractClosed(st)).toBe(true)
    expect(CONTRACT_CLOSED_STATUSES.length, 'نقصت القائمةُ حالةً').toBe(5)
  })
})

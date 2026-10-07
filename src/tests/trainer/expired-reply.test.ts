/* اعتذارٌ نهائيٌّ لمن انقضى رابطُ توقيعه — متى يُعرض، وما يقول (٧ أكتوبر ٢٠٢٦).

   القرارُ وعلّتُه عند `expiredReplyBlockAr` في `src/application/trainer/decline-reply.ts`،
   وما يقع به يحرسه `server/tests/trainer/expired-reply.test.ts`. وهنا:
   ① السؤالُ الذي تسأله الشاشةُ لتُظهر الزرّ والخادمُ ليمنع — بجوابه في كلّ حال.
   ② والنصُّ الأوّل «مختصر» بطلب صاحب المنصّة، ويقول ما وُعد به: الفصولُ القادمة
      وخيارُ البيانات — بلا تحيّةٍ يكرّرها قالبُ البريد. */

import { describe, expect, it } from 'vitest'
import { defaultExpiredReplyAr, expiredReplyBlockAr } from '../../application/trainer/decline-reply'

const NOW = new Date('2026-10-07T10:00:00Z')
const facts = (o: Partial<Parameters<typeof expiredReplyBlockAr>[0]> = {}) => ({
  status: 'sent', tokenExpiresAt: '2026-10-05T00:00:00Z', applicationStatus: 'contract_pending', now: NOW, ...o,
})

describe('① متى يُعرض الاعتذارُ النهائيّ', () => {
  it('على عقدٍ مُرسَلٍ انقضى رابطُه، لطلبٍ في الطابور', () => {
    expect(expiredReplyBlockAr(facts())).toBeNull()
    expect(expiredReplyBlockAr(facts({ applicationStatus: 'conditionally_approved' }))).toBeNull()
  })

  it('لا على رابطٍ حيّ — ولا بلا أجلٍ معروف', () => {
    expect(expiredReplyBlockAr(facts({ tokenExpiresAt: '2026-10-09T00:00:00Z' }))).toMatch(/لم ينقضِ/)
    expect(expiredReplyBlockAr(facts({ tokenExpiresAt: null }))).toMatch(/لم ينقضِ/)
  })

  it('ولا على عقدٍ غيرِ مُرسَل', () => {
    for (const status of ['draft', 'signed', 'revoked', 'declined', 'countersigned']) {
      expect(expiredReplyBlockAr(facts({ status })), status).not.toBeNull()
    }
  })

  it('ولا لمدرّبٍ نشطٍ انقضى رابطُ تجديده — لا يُؤجَّل', () => {
    expect(expiredReplyBlockAr(facts({ applicationStatus: 'active' }))).toMatch(/النشط/)
    expect(expiredReplyBlockAr(facts({ applicationStatus: null }))).not.toBeNull()
  })
})

describe('② والنصُّ مختصرٌ ويقول ما وُعد به', () => {
  const body = defaultExpiredReplyAr()
  it('فقرتان قصيرتان', () => {
    expect(body.split('\n\n')).toHaveLength(2)
    expect(body.length, 'طال النصُّ الأوّل — طلبه «مختصرا»').toBeLessThan(260)
  })
  it('الفصولُ القادمة وخيارُ البيانات — بلا تحيّةٍ ولا لقب', () => {
    expect(body).toMatch(/الفصول القادمة/)
    expect(body).toMatch(/نحذفها نهائيّا/)
    expect(body, 'التحيّةُ باسمه في قالب البريد — ولقبٌ يفترض جنسَه').not.toMatch(/الأستاذ|المحترم|مرحبا/)
  })
})

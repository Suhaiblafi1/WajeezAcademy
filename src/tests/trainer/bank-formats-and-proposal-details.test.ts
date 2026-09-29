/* فورمان صارا أسئلةً وصيغا (٢٩ سبتمبر ٢٠٢٦): الحسابُ البنكيُّ لكلّ الدول،
   والدورةُ المقترحةُ بأسئلة الدمج والإضافة.

   والفحصُ على **ما تُخرجه الدوالّ** لا على ورود نصٍّ في ملفّ: رقمُ IBAN
   صحيحٌ يُقبل وخانةٌ واحدةٌ مبدَّلةٌ تُردّ؛ وحمولةٌ غيرُ موثوقةٍ تُنظَّف فلا
   يمرّ منها خيارٌ لا يُعرف ولا ساعاتٌ خارج الحدّ. */

import { describe, expect, it } from 'vitest'
import {
  ibanChecksumOk, isIbanCountry, normalizeAccount, routingOf, swiftOk,
} from '@/application/trainer/bank-formats'
import {
  cleanProposalDetails, MAX_PROPOSAL_HOURS, proposalDetailRows, proposalMatchText,
} from '@/application/trainer/proposal-details'

describe('صيغُ الحسابات البنكيّة', () => {
  it('⚠️ IBAN صحيحٌ يُقبل — ومبدَّلُ خانةٍ واحدةٍ يُردّ', () => {
    expect(ibanChecksumOk('JO94CBJO0010000000000131000302')).toBe(true)
    expect(ibanChecksumOk('jo94 cbjo 0010 0000 0000 0131 0003 02'), 'المسافاتُ والحروفُ الصغيرة لا تضرّ').toBe(true)
    expect(ibanChecksumOk('GB82WEST12345698765432')).toBe(true)
    expect(ibanChecksumOk('JO94CBJO0010000000000131000303'), 'قُبلت خانةٌ مبدَّلة').toBe(false)
    expect(ibanChecksumOk('000123456789'), 'رقمٌ محلّيٌّ قُبل IBAN').toBe(false)
  })

  it('والدولةُ تقترح النوع: أمريكا والهند بلا IBAN، والأردنُّ والسعوديّةُ به', () => {
    for (const cc of ['US', 'CA', 'IN', 'AU']) expect(isIbanCountry(cc), cc).toBe(false)
    for (const cc of ['JO', 'SA', 'AE', 'GB', 'DE', 'TR']) expect(isIbanCountry(cc), cc).toBe(true)
    expect(routingOf('US').labelAr).toContain('ABA')
    expect(routingOf('IN').labelAr).toContain('IFSC')
    expect(routingOf('ZZ').labelAr, 'دولةٌ لا نعرف رمزَها بلا اسمٍ عامّ').toBeTruthy()
  })

  it('وSWIFT ثماني خاناتٍ أو إحدى عشرة لا غير', () => {
    expect(swiftOk('ARABJOAX')).toBe(true)
    expect(swiftOk('ARABJOAX100')).toBe(true)
    expect(swiftOk('ARABJO')).toBe(false)
    expect(swiftOk('ARABJOAX1')).toBe(false)
    expect(normalizeAccount(' ab-12 cd ')).toBe('AB12CD')
  })
})

describe('أسئلةُ الدورة المقترحة', () => {
  it('⚠️ ما لا يُعرف من الخيارات يسقط — ولا يُحفَظ نصٌّ حرٌّ في خانةِ اختيار', () => {
    const d = cleanProposalDetails({
      level: 'expert', format: 'live_online', merge: 'yes', experience: 'often',
      materials: ['slides', 'hack', 'slides', 'cases'],
      hours: MAX_PROPOSAL_HOURS + 1, topicsAr: '  محورٌ\nمحورٌ ثانٍ  ', injected: 'x',
    })
    expect(d?.level, 'مرّ مستوًى لا وجودَ له').toBeUndefined()
    expect(d?.format).toBe('live_online')
    expect(d?.materials, 'تكرّر خيارٌ أو مرّ مجهول').toEqual(['slides', 'cases'])
    expect(d?.hours, 'مرّت ساعاتٌ خارج الحدّ').toBeUndefined()
    expect(d?.topicsAr).toBe('محورٌ\nمحورٌ ثانٍ')
    expect(d && 'injected' in d, 'مرّ مفتاحٌ لا يُعرف').toBe(false)
  })

  it('والفارغُ كلُّه `null` — لا كائنٌ فارغٌ يُحفظ كأنّه جواب', () => {
    expect(cleanProposalDetails({ audienceAr: '  ', materials: [] })).toBeNull()
    expect(cleanProposalDetails(null)).toBeNull()
    expect(cleanProposalDetails(['level'])).toBeNull()
    expect(cleanProposalDetails({ hours: '12' })?.hours, 'الساعاتُ نصّا من الحقل تُقرأ رقما').toBe(12)
  })

  it('والإدارةُ تقرأ الأجوبةَ بأسمائها، والمرشِّحُ يقارن بالمحاور والأقرب', () => {
    const d = cleanProposalDetails({ level: 'beginner', merge: 'discuss', closestCourseAr: 'تحليل البيانات', topicsAr: 'الجداول' })
    const rows = proposalDetailRows(d)
    expect(rows.find((r) => r.labelAr === 'المستوى')?.valueAr).toBe('مبتدئ')
    expect(rows.find((r) => r.labelAr === 'الدمج')?.valueAr).toBe('نتناقش فيها')
    const text = proposalMatchText('نبذة', d)
    expect(text).toContain('الجداول')
    expect(text).toContain('تحليل البيانات')
  })
})

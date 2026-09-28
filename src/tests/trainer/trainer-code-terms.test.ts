/* البند 4-10 بصيغته الجديدة — نصٌّ واحدٌ يُطبع ويُقبَل، وبصمتُه مع إصداره.

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): خصمُ المدرّب كودٌ بنسبةٍ لا مبلغ. ومن
   وقّع قبل الجيل الثالث عشر وقّع 4-10 على «مبلغٍ معلومٍ لا نسبة»، فيقبل الصيغةَ
   الجديدة مرّةً واحدة قبل أوّل كود (`trainer-code.service.ts`).

   والمقيسُ ثلاثة، كلُّها يقع صامتا لو انكسر:
   ① **النصُّ الذي يُقبَل هو الذي يُطبع** — ثابتٌ واحدٌ في المتن وفي بطاقة القبول.
   ② **وتعديلُه يرفع إصدارَ القبول** — وإلّا بقي قبولُ الأمس على نصٍّ تغيّر، ويُحسم
      من المدرّب بما لم يقبله. والبصمةُ هنا تحمرّ على أيّ حرفٍ يتغيّر، فتُرفَع
      البصمةُ والإصدارُ معا عن قصد.
   ③ **والمتنُ الحاليُّ يحمله** — فمن يوقّع اليومَ لا يُسأل ثانيةً، ومن وقّع على
      الجيل الثاني عشر يُسأل. */

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  CLAUSE_4_10_AR, CONTRACT_BODY_VERSION, renderContractBodyAr,
} from '@/application/trainer/contract-body'
import {
  CODE_TERMS_FIRST_BODY, CODE_TERMS_VERSION, MAX_TRAINER_CODE_PERCENT, MIN_TRAINER_CODE_PERCENT,
  contractCarriesCodeTerms,
} from '@/application/trainer/trainer-code'
import { ACADEMY_LEGAL, academyPartyLineAr } from '@/data/academy-legal'

const BODY = renderContractBodyAr({
  academyPartyLineAr: academyPartyLineAr(),
  academyLegalNameAr: ACADEMY_LEGAL.legalNameAr ?? '',
  academyTradingNameAr: ACADEMY_LEGAL.tradingNameAr ?? 'أكاديمية وجيز',
  governingLawAr: ACADEMY_LEGAL.governingLawAr ?? '',
  disputeVenueAr: ACADEMY_LEGAL.disputeVenueAr ?? '',
  trainerFullName: 'مدرّبُ الاختبار',
  trainerEmail: 'trainer@test.local',
  applicationReference: 'WJ-TR-2026-00077',
  issuedOnAr: '٢٧ سبتمبر ٢٠٢٦',
  courses: [{ courseId: 'C1', titleAr: 'أساسيّاتُ المحاسبة' }],
  compensation: { type: 'per_seat', rate: '25', currency: 'USD', minSeats: 0, referralRate: '30' },
  rateWaivedReasonAr: null,
  hoursNoteAr: null,
  requiredDocuments: [],
  conditional: null,
})

describe('① النصُّ الذي يُقبَل هو الذي يُطبع', () => {
  it('⚠️ المتنُ يحمل البندَ بحروفه، في سطره', () => {
    const line = BODY.split('\n').find((l) => l.startsWith('4-10 '))
    expect(line, 'لا بندَ 4-10 في المتن').toBeTruthy()
    expect(line, 'البندُ المطبوعُ غيرُ الذي يُقبَل').toBe(CLAUSE_4_10_AR)
  })

  it('⚠️ والنسبتان فيه هما حدّا القواعد — لا رقمان يُكتبان', () => {
    expect(CLAUSE_4_10_AR).toContain(`من ${MIN_TRAINER_CODE_PERCENT}% إلى ${MAX_TRAINER_CODE_PERCENT}%`)
  })

  it('ويقول ما يُحسم وما لا يُحسم وما يبقى للقديم', () => {
    /* ما منحه فعلا لا النسبةَ من سعر القائمة؛ والردُّ ينقصه؛ والقديمُ على شروطه */
    expect(CLAUSE_4_10_AR).toContain('الخصم الذي منحه فعلا')
    expect(CLAUSE_4_10_AR).toContain('نقص الحسم بنسبة ما رد')
    expect(CLAUSE_4_10_AR).toContain('يبقى على شروطه التي صدر بها')
  })
})

describe('② وتعديلُه يرفع إصدارَ القبول', () => {
  it('⚠️ البصمةُ والإصدارُ معا — يتغيّران معا أو لا يتغيّران', () => {
    const sha = createHash('sha256').update(CLAUSE_4_10_AR).digest('hex')
    expect(
      { version: CODE_TERMS_VERSION, sha },
      'تغيّر نصُّ البند 4-10: ارفع `CODE_TERMS_VERSION` (و`CODE_TERMS_FIRST_BODY` إلى جيل المتن الذي حمله) ثمّ حدّث البصمة',
    ).toEqual({
      version: 'code-4-10-v1-2026-09-27',
      sha: 'c32ace0ec5cd783b0399f86f9a0078fc442b992346f82b79bf3bf86b2ca6f0d6',
    })
  })
})

describe('③ والمتنُ الحاليُّ يحمله', () => {
  it('⚠️ من يوقّع اليومَ لا يُسأل ثانيةً', () => {
    expect(contractCarriesCodeTerms(CONTRACT_BODY_VERSION), 'المتنُ الحاليُّ لا يحمل الصيغةَ الجديدة').toBe(true)
  })

  it('⚠️ ومن وقّع قبل جيلها يُسأل — ولا يُقرأ الإصدارُ حرفا', () => {
    expect(contractCarriesCodeTerms(`v${CODE_TERMS_FIRST_BODY - 1}-2026-09-27`)).toBe(false)
    expect(contractCarriesCodeTerms('v12-2026-09-27')).toBe(false)
    expect(contractCarriesCodeTerms('v3-2026-09-21')).toBe(false)
    expect(contractCarriesCodeTerms(`v${CODE_TERMS_FIRST_BODY}-2026-09-27`)).toBe(true)
    expect(contractCarriesCodeTerms('v21-2027-01-01'), 'جيلٌ أحدثُ يُقرأ أقدم').toBe(true)
    expect(contractCarriesCodeTerms(null)).toBe(false)
    expect(contractCarriesCodeTerms('draft')).toBe(false)
  })
})

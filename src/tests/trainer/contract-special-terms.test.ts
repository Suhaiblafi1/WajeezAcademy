/* البند 21 — بنودٌ خاصّةٌ بمدرّبٍ بعينه.
 *
 * قرارُ صاحب المنصّة (١ أكتوبر ٢٠٢٦): لكلّ مدرّبٍ أن تُكتب له بنودٌ تخصّه،
 * **تُقدَّم على البنود العامّة فيما تخالفها فيه — إلّا المال**: الأتعابُ
 * وما يتّصل بها أساسُها الملحق (ب) وحده (البند 4-1). وعلّةُ ذلك كلِّه في
 * رأس `specialTermsClauseAr` من `contract-body.ts`.
 *
 * وما يُقاس:
 * ① غيابُها لا يغيّر حرفا — فلا يُرفَع إصدارُ الصياغة ولا يُحدَّث عرضٌ قائمٌ بسببها.
 * ② موضعُها بعد البند 20 وقبل الملاحق، مرقّمةً 21-2 فما بعدها.
 * ③ قاعدةُ التقديم واستثناءُ المال مكتوبان في المتن نفسِه — هما قرارُ صاحب
 *   المنصّة، ومتنٌ يسكت عنهما يترك النزاعَ لقارئٍ يقدّم ما شاء.
 * ④ الخلاصةُ تنبّه إليها، ولا تذكرها حين لا تكون.
 * ⑤ والمحلّلُ يقرؤها كلَّها: ما يُعرَض على المدرّب هو ما وُقّع عليه سطرا سطرا.
 */

import { describe, expect, it } from 'vitest'
import {
  renderContractBodyAr, specialTermsItemsAr, SPECIAL_TERMS_CLAUSE_NO,
  type ContractBodyInput,
} from '@/application/trainer/contract-body'
import { parseContractDoc, documentLinesAr } from '@/application/trainer/contract-sections'
import { ACADEMY_LEGAL, academyPartyLineAr } from '@/data/academy-legal'

const body = (over: Partial<ContractBodyInput> = {}) => renderContractBodyAr({
  academyPartyLineAr: academyPartyLineAr(),
  academyLegalNameAr: ACADEMY_LEGAL.legalNameAr ?? '',
  academyTradingNameAr: ACADEMY_LEGAL.tradingNameAr ?? 'أكاديمية وجيز',
  governingLawAr: ACADEMY_LEGAL.governingLawAr ?? '',
  disputeVenueAr: ACADEMY_LEGAL.disputeVenueAr ?? '',
  trainerFullName: 'اسمٌ قانونيّ',
  trainerEmail: 'trainer@example.com',
  applicationReference: 'WJ-TR-2026-00000',
  issuedOnAr: '١ أكتوبر ٢٠٢٦',
  courses: [{ courseId: 'C-1', titleAr: 'دورةٌ أولى' }],
  compensation: { type: 'per_seat', rate: '30', currency: 'USD', minSeats: 8, referralRate: '45' },
  rateWaivedReasonAr: null,
  hoursNoteAr: null,
  requiredDocuments: [{ kind: 'id', labelAr: 'الهوية', required: true }],
  conditional: null,
  ...over,
})

const TERMS = 'يقدم المدرب دورة التحليل بالإنجليزية عند طلب الأكاديمية\nوتعقد جلساته مساء الجمعة'
const N = SPECIAL_TERMS_CLAUSE_NO
const lineOf = (b: string, prefix: string) => b.split('\n').find((l) => l.startsWith(prefix)) ?? ''
const summaryOf = (b: string) => b.slice(b.indexOf('الخلاصة في سطور'), b.indexOf('ما تعنيه الكلمات في هذا العقد'))

describe('البند 21 — بنودٌ خاصّةٌ بالمدرّب', () => {
  it('① وغيابُها لا يغيّر حرفا من المتن', () => {
    const plain = body()
    expect(plain, 'ظهر البندُ ولا بنودَ خاصّة').not.toContain(`البند ${N} —`)
    for (const empty of [undefined, null, '', '   \n \n  ', '-\n•  \n']) {
      expect(body({ specialTermsAr: empty }), `تغيّر المتنُ لبنودٍ فارغة: ${JSON.stringify(empty)}`).toBe(plain)
    }
  })

  it('② بعد البند 20 وقبل الملحق (أ)، ومرقّمةٌ بعد فقرة التقديم', () => {
    const b = body({ specialTermsAr: TERMS })
    const at20 = b.indexOf('البند 20 —')
    const at21 = b.indexOf(`البند ${N} — بنود خاصة بالمدرب`)
    const atA = b.indexOf('الملحق (أ) —')
    expect(at20, 'لا بندَ 20 — فالموضعُ يُقاس على فراغ').toBeGreaterThan(0)
    expect(at21, 'البندُ 21 قبل البند 20 أو غائب').toBeGreaterThan(at20)
    expect(atA, 'البندُ 21 بعد الملاحق').toBeGreaterThan(at21)
    expect(lineOf(b, `${N}-2 `)).toBe(`${N}-2 يقدم المدرب دورة التحليل بالإنجليزية عند طلب الأكاديمية`)
    expect(lineOf(b, `${N}-3 `)).toBe(`${N}-3 وتعقد جلساته مساء الجمعة`)
  })

  it('③ الخاصُّ مقدَّمٌ على العامّ — إلّا المال، والمتنُ يقولهما', () => {
    const lead = lineOf(body({ specialTermsAr: TERMS }), `${N}-1 `)
    expect(lead, 'لا فقرةَ تقديم').not.toBe('')
    expect(lead, 'سكت المتنُ عن تقديم الخاصّ').toContain('قدم ما في هذا البند')
    expect(lead, 'سقط استثناءُ المال').toContain('إلا ما يتعلق بالأتعاب والحد الأدنى المضمون')
    expect(lead, 'لا يُحال المالُ إلى الملحق (ب) وحده').toContain('ما في الملحق (ب) وحده وفق البند 4-1')
  })

  it('④ والخلاصةُ تنبّه إليها حين تكون، وتسكت حين لا تكون', () => {
    expect(summaryOf(body({ specialTermsAr: TERMS })), 'لا تنبيهَ في الخلاصة').toContain(`(البند ${N})`)
    expect(summaryOf(body()), 'تنبيهٌ عن بنودٍ لا وجودَ لها').not.toContain(`(البند ${N})`)
  })

  it('⑤ والمحلّلُ يقرؤها كلَّها — لا سطرَ يسقط من المعروض', () => {
    const b = body({ specialTermsAr: TERMS })
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean)
    expect(documentLinesAr(parseContractDoc(b))).toEqual(lines)
    const clauses = parseContractDoc(b).sections.filter((s) => s.kind === 'clause')
    expect(clauses).toHaveLength(21)
    expect(clauses[20].numAr).toBe(String(N))
  })

  it('وعلامةُ القائمة تُنزَع — والإحالةُ إلى بندٍ تبقى', () => {
    expect(specialTermsItemsAr('- أوّل\n2. ثانٍ\n٣) ثالث\n• رابع\n\n4-16 لا ينطبق على هذا المدرب\n'))
      .toEqual(['أوّل', 'ثانٍ', 'ثالث', 'رابع', '4-16 لا ينطبق على هذا المدرب'])
  })

  it('ولا تشكيلَ في نصّ البند الثابت ولا في سطر الخلاصة — كسائر المتن', () => {
    const b = body({ specialTermsAr: TERMS })
    const HARAKAT = /[ً-ْٰ]/
    for (const l of [lineOf(b, `البند ${N} —`), lineOf(b, `${N}-1 `), lineOf(b, '· وبنود خاصة بك')]) {
      expect(l, 'سطرٌ غائب').not.toBe('')
      expect(l, `تشكيلٌ في «${l}»`).not.toMatch(HARAKAT)
    }
  })
})

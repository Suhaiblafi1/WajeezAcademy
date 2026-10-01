/* ═══ `v23` — إحالةُ 7-2 تقع على بند الملكيّة لا على بند السرّيّة ═══
 *
 * البند 7-2 يعلّل ألّا تعويضَ عن إلغاء شعبةٍ بأنّ موادَّ المدرّب «تبقى ملكا له
 * على ما هو مبين في البند N». وكان N = 11 منذ `v12` (#308) — والبندُ 11 «السرية»،
 * وملكيّةُ الموادّ في البند 10 «الملكية الفكرية». ومرّ عليه حارسُ الإحالات في
 * `contract-body.test.ts`: يشترط أن تقع الإحالةُ على بندٍ **قائم**، و11 قائم.
 *
 * فهذا يقيس المعنى **بالبنية**: لا يقرأ «البند 10» حرفا، بل يجد في المتن الفقرةَ
 * التي تقول إنّ المدرّبَ يبقى مالكا لما يعدّه، ويشترط أن يكون بندُها هو ما يحيل
 * إليه 7-2. فلو أُدخل بندٌ قبل الملكيّة الفكريّة فتزحزح رقمُها، سقط هنا حتّى
 * تُصحَّح الإحالة — ولا يسقط إن أُعيدت صياغةُ 7-2 وبقيت إحالتُه صادقة.
 */

import { describe, expect, it } from 'vitest'
import {
  renderContractBodyAr, CONTRACT_BODY_VERSION, type ContractBodyInput,
} from '@/application/trainer/contract-body'
import { CONTRACT_CHANGELOG } from '@/application/trainer/contract-changelog'
import { EXTENSION_DAYS, MATERIALS_WINDOW_DAYS } from '@/application/trainer/conditional-offer'
import { ACADEMY_LEGAL, academyPartyLineAr } from '@/data/academy-legal'

const BASE: ContractBodyInput = {
  academyPartyLineAr: academyPartyLineAr(),
  academyLegalNameAr: ACADEMY_LEGAL.legalNameAr,
  academyTradingNameAr: ACADEMY_LEGAL.tradingNameAr,
  governingLawAr: ACADEMY_LEGAL.governingLawAr,
  disputeVenueAr: ACADEMY_LEGAL.disputeVenueAr,
  trainerFullName: 'اسمٌ قانونيّ',
  trainerEmail: 'trainer@example.com',
  applicationReference: 'WJ-TR-2026-00000',
  issuedOnAr: '١ أكتوبر ٢٠٢٦',
  courses: [{ courseId: 'C-1', titleAr: 'دورةٌ أولى' }],
  compensation: { type: 'per_seat', rate: '15', currency: 'USD', minSeats: 15, referralRate: '25' },
  rateWaivedReasonAr: null,
  hoursNoteAr: null,
  requiredDocuments: [{ kind: 'id', labelAr: 'الهوية', required: true }],
  conditional: null,
}

/* والعرضُ المشروطُ يُدخل في البند 2 سبعَ فقراتٍ — فيُقاس المتنان معا */
const BODIES: readonly (readonly [string, string])[] = [
  ['عقدٌ مطلق', renderContractBodyAr(BASE)],
  ['عرضٌ مشروط', renderContractBodyAr({
    ...BASE,
    conditional: {
      orientationOnAr: '٥ أكتوبر ٢٠٢٦', deadlineOnAr: '١٢ أكتوبر ٢٠٢٦',
      windowDays: MATERIALS_WINDOW_DAYS, extensionDays: EXTENSION_DAYS,
    },
  })],
]

const lines = (body: string) => body.split('\n').map((l) => l.trim())

/** رقمُ البند الذي يحيل إليه 7-2 في ملكيّة الموادّ */
function ownershipRefOf72(body: string): number {
  const l = lines(body).find((x) => x.startsWith('7-2 '))
  expect(l, 'لا فقرةَ 7-2 في المتن').toBeTruthy()
  const m = /تبقى ملكا له على ما هو مبين في البند (\d+)/.exec(l!)
  expect(m, 'ذهب من 7-2 تعليلُه بملكيّة الموادّ — أو تغيّرت صيغةُ إحالته').toBeTruthy()
  return Number(m![1])
}

/** البندُ الذي يقول نصُّه إنّ ما يعدّه المدرّبُ يبقى ملكَه — رقمُه وعنوانُه */
function ownerClause(body: string): { n: number; titleAr: string } {
  const ls = lines(body)
  const owns = ls.filter((x) => /^\d+-\d+ /.test(x) && x.includes('ويبقى المدرب مالكا له'))
  expect(owns.length, 'لا فقرةَ تقول إنّ المدرّبَ يبقى مالكا لما يعدّه — أو قالتها اثنتان').toBe(1)
  const n = Number(/^(\d+)-/.exec(owns[0])![1])
  const head = ls.map((x) => /^البند (\d+) — (.+)$/.exec(x)).find((h) => h && Number(h[1]) === n)
  return { n, titleAr: head?.[2] ?? '' }
}

describe('7-2 — ملكيّةُ الموادّ في بندها', () => {
  for (const [name, body] of BODIES) {
    it(`⚠️ ${name}: إحالةُ 7-2 تقع على البند الذي يقول إنّ المدرّبَ يبقى مالكا`, () => {
      const owner = ownerClause(body)
      expect(ownershipRefOf72(body), `7-2 يحيل إلى غير «البند ${owner.n} — ${owner.titleAr}»`).toBe(owner.n)
      expect(owner.titleAr, 'الملكيّةُ في غير بند الملكيّة الفكريّة').toBe('الملكية الفكرية')
    })
  }
})

describe('ونقطةُ `v23` تقول إنّه تصحيحٌ لا تغييرُ حقّ', () => {
  it('الإصدارُ الحاليّ، ونقطتُه تحت «صياغة العقد» تسمّي 7-2', () => {
    expect(CONTRACT_BODY_VERSION).toBe('v23-2026-10-01')
    const v = CONTRACT_CHANGELOG.find((x) => x.version === CONTRACT_BODY_VERSION)
    expect(v, 'إصدارٌ بلا نقاط').toBeDefined()
    expect(v!.points.every((p) => p.topic === 'wording'), 'تصحيحُ إحالةٍ تحت بابٍ يُقرأ تغييرَ حقّ').toBe(true)
    const text = v!.points.map((p) => p.textAr).join(' ')
    expect(text, 'النقطةُ لا تسمّي البندَ الذي صُحّح').toContain('7-2')
    expect(text, 'النقطةُ لا تقول إنّ الحكمَ لم يتغيّر').toContain('بلا تغييرٍ في حكم')
  })
})

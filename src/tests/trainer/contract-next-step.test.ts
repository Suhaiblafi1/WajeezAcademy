/* ═══ كلُّ مدرّبٍ في العقود شريطٌ ينسدل، وبجانب اسمه خطوتُه التالية ═══
 *
 * طلبُ صاحب المنصّة (٣ أكتوبر ٢٠٢٦): «اجعل كلَّ المدرّبين في خانة العقود
 * كأنّها شريطٌ أضغط عليه ينسدل، مع ذكر ما الخطوةُ القادمةُ له بجانب اسمه».
 *
 * والخطوةُ تُقاس على حالات المخطّط نفسِها لا على قائمةٍ هنا: حالةٌ جديدةٌ
 * بلا جوابٍ صادقٍ تُقرأ «انتهى» على عقدٍ حيّ — وذاك كذبٌ يُخفي عملا.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { contractNextStep, type NextStepFacts } from '@/application/trainer/contract-next-step'
import { CONTRACT_TABS } from '@/application/trainer/contract-tabs'
import { statusColumns } from '../../../scripts/status-checks'

const NOW = new Date('2026-10-03T10:00:00Z')
const base = (over: Partial<NextStepFacts>): NextStepFacts => ({
  status: 'draft', gatesActivation: true, documentNameAr: 'صهيب أحمد', signedNameAr: null,
  conditionDeadlineAt: null, conditionPausedAt: null, conditionMetAt: null, now: NOW, ...over,
})
const STATUSES = statusColumns().find((c) => c.model === 'TrainerContract' && c.field === 'status')!.values
const tabOf = (id: string) => CONTRACT_TABS.find((t) => t.id === id)!.statuses!

describe('الخطوةُ التالية تتبع من عليه الدور', () => {
  it('المسحُ قرأ الحالات فعلا', () => {
    expect(STATUSES.length).toBeGreaterThan(5)
  })

  it('⚠️ كلُّ ما في «ينتظرك» خطوتُه عليك', () => {
    for (const st of tabOf('awaiting_you')) {
      expect(contractNextStep(base({ status: st, signedNameAr: 'صهيب أحمد' })).who, st).toBe('you')
    }
  })

  it('وكلُّ ما في «منتهية» لا خطوةَ بعده — وكلُّ حيٍّ له خطوة', () => {
    const closed = tabOf('closed')
    for (const st of STATUSES) {
      const who = contractNextStep(base({ status: st })).who
      expect(who === 'none', st).toBe(closed.includes(st) || st === 'countersigned')
    }
  })

  it('المرسَلُ ينتظرهم — فإن انقضى رابطُه صار عليك', () => {
    expect(contractNextStep(base({ status: 'sent', tokenExpiresAt: '2026-10-05T00:00:00Z' })).who).toBe('them')
    expect(contractNextStep(base({ status: 'sent', tokenExpiresAt: '2026-10-01T00:00:00Z' })).who).toBe('you')
  })

  it('الموقَّعُ باسمٍ مختلفٍ يُقال — لا «اعتمِدْ» مجرّدة', () => {
    expect(contractNextStep(base({ status: 'signed', signedNameAr: 'اسم آخر تماما' })).textAr).toMatch(/مختلف/)
    expect(contractNextStep(base({ status: 'signed', signedNameAr: 'صهيب أحمد' })).textAr).toMatch(/اعتمِدْ/)
  })

  it('في طور الموادّ: يُعِدّ (عليهم) · أرسل (عليك) · انقضت مهلتُه (عليك)', () => {
    const sa = (o: Partial<NextStepFacts>) => contractNextStep(base({ status: 'signature_approved', ...o }))
    expect(sa({ conditionDeadlineAt: '2026-10-08T00:00:00Z' }).who).toBe('them')
    expect(sa({ conditionDeadlineAt: '2026-10-08T00:00:00Z', conditionPausedAt: '2026-10-02T00:00:00Z' }))
      .toEqual({ textAr: expect.stringMatching(/راجِعْها/), who: 'you' })
    expect(sa({ conditionDeadlineAt: '2026-10-01T00:00:00Z' }).textAr).toMatch(/انقضت/)
    expect(sa({ gatesActivation: false }).who).toBe('you')
  })
})

describe('الصفُّ مطويٌّ شريطا في الشاشة', () => {
  const SCREEN = readFileSync(resolve(__dirname, '../../pages/admin/TrainerContracts.tsx'), 'utf8')
  const start = SCREEN.indexOf('contractView.rows.map((g) =>')
  const row = SCREEN.slice(start, SCREEN.indexOf('</ul>\n          )}', start))

  it('المسحُ وجد الصفَّ', () => {
    expect(start).toBeGreaterThan(0)
    expect(row.length).toBeGreaterThan(2000)
  })

  it('زرٌّ يفتح ويطوي — باسمه وخطوته، ويقول حالَه لقارئ الشاشة', () => {
    const bar = row.slice(row.indexOf('<Inset as="button"'), row.indexOf('</Inset>', row.indexOf('<Inset as="button"')))
    expect(bar).toMatch(/aria-expanded=\{isOpen\}/)
    expect(bar).toMatch(/onClick=\{\(\) => toggleRow\(c\.id\)\}/)
    expect(bar).toMatch(/\{docNameOf\(c\)\}/)
    expect(bar).toMatch(/\{step\.textAr\}/)
  })

  it('⚠️ والتفصيلُ كلُّه تحت الفتح — لا زرَّ قرارٍ يُرى مطويّا', () => {
    const gate = row.indexOf('{isOpen && (')
    expect(gate).toBeGreaterThan(row.indexOf('<Inset as="button"'))
    for (const action of ['المتن', 'أرسِلْه للتوقيع', 'عقودٌ سابقةٌ لهذا المدرّب']) {
      expect(row.indexOf(action), action).toBeGreaterThan(gate)
    }
  })
})

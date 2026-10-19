/* ═══ عدّادُ الشعب بجانب اسم المدرّب (١٨ أكتوبر ٢٠٢٦) ═══
 *
 * سؤالُ صاحب المنصّة: «كم دورةً أعدّ شعبَها كلَّها أو جزءا منها؟ ألا يكون عدّادٌ جانبَ اسمه؟».
 * فالكاملةُ ما أُرسلت خطّتُها أو اعتُمدت، والجزئيّةُ شعبةٌ قامت ولم تُرسَل أو رُدّت إليه،
 * وما اعتذر عنه لا يُعدّ من دوراته.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { prepTallyAr, prepTallyDetailAr, prepTallyOf, waitingOnThemselves } from '@/application/trainer/prep-tally'

describe('العدّادُ يفرّق الكاملةَ من الجزئيّة', () => {
  it('المرسلةُ والمعتمدةُ كاملة، والمسودّةُ والمردودةُ جزئيّة، والمعتذَرُ عنها خارجَ العدد', () => {
    const t = prepTallyOf(['done', 'submitted', 'preparing', 'returned', 'to_decide', 'declined'])
    expect(t).toEqual({ total: 5, approved: 1, submitted: 1, partial: 2, notStarted: 1, postponed: 0, declined: 1 })
    expect(prepTallyAr(t)).toBe('الشعب: 2 كاملة · 2 جزئية من 5')
    expect(prepTallyDetailAr(t)).toBe('معتمدة 1 · تنتظر مراجعتك 1 · قيد الإعداد 2 · لم يبدأ 1 · اعتذر عن 1')
  })

  it('من لم يبدأ يُقال له صفر — ومن لا دورةَ له لا عدّادَ له', () => {
    expect(prepTallyAr(prepTallyOf(['to_decide', 'to_decide']))).toBe('الشعب: 0 من 2')
    expect(prepTallyAr(prepTallyOf(['declined']))).toBeNull()
    expect(prepTallyAr(prepTallyOf([]))).toBeNull()
  })

  it('والمؤجّلةُ وحدَها — لا جزئيّةً ولا ناقصة («لا تنسَ أنّهم أجّلوا بعضها»)', () => {
    const t = prepTallyOf(['done', 'preparing', 'postponed', 'postponed'])
    expect(t).toMatchObject({ total: 4, approved: 1, partial: 1, postponed: 2 })
    expect(prepTallyAr(t)).toBe('الشعب: 1 كاملة · 1 جزئية · 2 مؤجلة من 4')
    expect(prepTallyDetailAr(t)).toBe('معتمدة 1 · قيد الإعداد 1 · مؤجلة 2')
  })

  it('ما أتمّه كلَّه يُقرأ كاملا كلُّه', () => {
    expect(prepTallyAr(prepTallyOf(['done', 'submitted', 'done']))).toBe('الشعب: 3 كاملة من 3')
  })
})

describe('والعدّادُ في السطر المطويّ نفسِه — بجانب الاسم', () => {
  const SCREEN = readFileSync(resolve(__dirname, '../../pages/admin/TrainerContracts.tsx'), 'utf8')
  const start = SCREEN.indexOf('contractView.rows.map((g) =>')
  const open = SCREEN.indexOf('<Inset as="button"', start)
  const bar = SCREEN.slice(open, SCREEN.indexOf('</Inset>', open))

  it('بين الاسم والخطوة التالية — يُرى قبل الفتح', () => {
    expect(start).toBeGreaterThan(0)
    const name = bar.indexOf('{docNameOf(c)}')
    const tally = bar.search(/\{prepTallyAr\(c\.prepTally\)\}/)
    expect(name).toBeGreaterThan(0)
    expect(tally, 'العدّادُ ليس في السطر المطويّ').toBeGreaterThan(name)
    expect(bar.indexOf('{step.textAr}')).toBeGreaterThan(tally)
  })
})

/* من يحسب أنّه ينتظرنا ودوراتُه لم تبدأ — «tell me who» (١٩ أكتوبر ٢٠٢٦) */
describe('من لم يبدأ إعداد دوراته وعقده ينتظر توقيعنا', () => {
  const tally = (notStarted: number) => prepTallyOf(Array.from({ length: notStarted }, () => 'to_decide' as const))
  const row = (id: string, o: Partial<{ status: string; gatesActivation: boolean; prepTally: ReturnType<typeof prepTallyOf> | null }>) =>
    ({ id, status: 'signature_approved', gatesActivation: false, prepTally: tally(9), ...o })

  it('يسمي من اعتمد توقيعه ولم نوقعه وفي دوراته ما لم يبدأ — ولا غيره', () => {
    const rows = [
      row('ياسمين', {}),
      row('بدأ كلها', { prepTally: prepTallyOf(['submitted', 'approved']) }),
      row('وقعناه', { status: 'countersigned' }),
      row('مشروط', { gatesActivation: true }),
      row('بلا عداد', { prepTally: null }),
    ]
    expect(waitingOnThemselves(rows).map((r) => r.id)).toEqual(['ياسمين'])
  })

  it('والشاشة تعرض القائمة بأسمائهم', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/admin/TrainerContracts.tsx'), 'utf8')
    expect(page).toMatch(/waitingOnThemselves\(contracts\)\.map\(\(c\) => \([\s\S]{0,120}fullName/)
  })
})

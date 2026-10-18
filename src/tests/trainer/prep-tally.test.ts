/* ═══ عدّادُ الشعب بجانب اسم المدرّب (١٨ أكتوبر ٢٠٢٦) ═══
 *
 * سؤالُ صاحب المنصّة: «كم دورةً أعدّ شعبَها كلَّها أو جزءا منها؟ ألا يكون عدّادٌ جانبَ اسمه؟».
 * فالكاملةُ ما أُرسلت خطّتُها أو اعتُمدت، والجزئيّةُ شعبةٌ قامت ولم تُرسَل أو رُدّت إليه،
 * وما اعتذر عنه لا يُعدّ من دوراته.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { prepTallyAr, prepTallyDetailAr, prepTallyOf } from '@/application/trainer/prep-tally'

describe('العدّادُ يفرّق الكاملةَ من الجزئيّة', () => {
  it('المرسلةُ والمعتمدةُ كاملة، والمسودّةُ والمردودةُ جزئيّة، والمعتذَرُ عنها خارجَ العدد', () => {
    const t = prepTallyOf(['done', 'submitted', 'preparing', 'returned', 'to_decide', 'declined'])
    expect(t).toEqual({ total: 5, approved: 1, submitted: 1, partial: 2, notStarted: 1, declined: 1 })
    expect(prepTallyAr(t)).toBe('الشعب: 2 كاملة · 2 جزئية من 5')
    expect(prepTallyDetailAr(t)).toBe('معتمدة 1 · تنتظر مراجعتك 1 · قيد الإعداد 2 · لم يبدأ 1 · اعتذر عن 1')
  })

  it('من لم يبدأ يُقال له صفر — ومن لا دورةَ له لا عدّادَ له', () => {
    expect(prepTallyAr(prepTallyOf(['to_decide', 'to_decide']))).toBe('الشعب: 0 من 2')
    expect(prepTallyAr(prepTallyOf(['declined']))).toBeNull()
    expect(prepTallyAr(prepTallyOf([]))).toBeNull()
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

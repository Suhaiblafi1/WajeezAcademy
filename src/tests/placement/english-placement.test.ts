/* اختبارُ تحديد مستوى الإنجليزيّة — المسوّدةُ والتصحيحُ والمستوى.

   ١) المسوّدةُ سليمةُ البنية: ستّةٌ لكلّ مستوى، وأربعةُ خياراتٍ بلا تكرار، والجوابُ
      الصحيحُ موزّعٌ على المواضع — لا «الأوّلُ دائما» يُخمَّن.
   ٢) المستوى أعلى ما اجتيز وكلُّ ما دونه مجتاز — والقفزةُ صدفةٌ لا تُحتسب.
   ٣) ولا يُرسَل الجوابُ الصحيحُ إلى المتعلّم.

   ⚠ أُثبت سقوطُه: (أ) حُسب المستوى أعلى ما اجتيز بلا شرط ما دونه فسقط ٢،
   (ب) أُرسل السؤالُ كاملا فسقط ٣ — ثمّ أُعيد كلٌّ فخضرّ. */

import { describe, expect, it } from 'vitest'
import draft from '../../data/placement/english-placement.draft.v1.json'
import {
  PLACEMENT_LEVELS,
  bankIsOpen,
  publicItem,
  scorePlacement,
  type PlacementItem,
} from '../../domain/placement/english-placement'

const items = (draft as { items: PlacementItem[] }).items

const answersFor = (pass: Record<string, number>) => {
  /* لكلّ مستوى: كم سؤالا يُصاب (الباقي يُخطأ عمدا) */
  const out: Record<string, number> = {}
  for (const l of PLACEMENT_LEVELS) {
    items.filter((i) => i.level === l).forEach((i, k) => {
      out[i.id] = k < (pass[l] ?? 0) ? i.answer_index : (i.answer_index + 1) % i.options.length
    })
  }
  return out
}

describe('١) المسوّدة', () => {
  it('ستّةُ أسئلةٍ لكلّ مستوى، وأربعةُ خياراتٍ مختلفة، والمعرّفاتُ فريدة', () => {
    for (const l of PLACEMENT_LEVELS) expect(items.filter((i) => i.level === l)).toHaveLength(6)
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
    for (const i of items) {
      expect(i.options).toHaveLength(4)
      expect(new Set(i.options).size, i.id).toBe(4)
      expect(i.answer_index).toBeGreaterThanOrEqual(0)
      expect(i.answer_index).toBeLessThan(4)
      if (i.skill === 'reading') expect(i.passage, i.id).toBeTruthy()
    }
    expect(bankIsOpen(items)).toBe(true)
  })

  it('والجوابُ الصحيحُ موزّعٌ على المواضع الأربعة', () => {
    const counts = [0, 1, 2, 3].map((k) => items.filter((i) => i.answer_index === k).length)
    for (const c of counts) expect(c).toBeGreaterThanOrEqual(5)
  })
})

describe('٢) المستوى', () => {
  it('أعلى مستوى اجتيز بأربعةٍ من ستّة وكلُّ ما دونه مجتاز', () => {
    expect(scorePlacement(items, answersFor({ A1: 6, A2: 5, B1: 4, B2: 2, C1: 1 })).cefr).toBe('B1')
    expect(scorePlacement(items, answersFor({ A1: 6, A2: 6, B1: 6, B2: 6, C1: 6 })).cefr).toBe('C1')
    expect(scorePlacement(items, answersFor({ A1: 3 })).cefr).toBe('A1')
  })

  it('والقفزةُ صدفة: من أخفق في A2 لا يُحسب في C1 مهما أصاب فيها', () => {
    const r = scorePlacement(items, answersFor({ A1: 6, A2: 2, B1: 6, B2: 6, C1: 6 }))
    expect(r.cefr).toBe('A1')
    expect(r.level).toBe('a1')
  })

  it('وما لم يُجب عنه خطأ — لا يُحسب لصالحه', () => {
    expect(scorePlacement(items, {}).correct).toBe(0)
  })
})

describe('٣) ما يصل المتعلّم', () => {
  it('السؤالُ بلا جوابه الصحيح', () => {
    for (const i of items) expect('answer_index' in publicItem(i)).toBe(false)
  })
})
